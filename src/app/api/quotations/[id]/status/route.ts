import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import {
  logQuotationActivity,
  quotationLabel,
} from "@/lib/quotations/log-activity";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/quotations/[id]/status - Update quotation status
/** Reads as an event on a timeline rather than a state name. */
const STATUS_WORDING: Record<string, string> = {
  draft: "moved back to draft",
  sent: "sent to the client",
  viewed: "viewed by the client",
  approved: "approved",
  rejected: "rejected",
  expired: "marked expired",
  cancelled: "cancelled",
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const body = await request.json();
    const { status, notes } = body;

    // Validate status
    const validStatuses = [
      "draft",
      "sent",
      "viewed",
      "negotiating",
      "approved",
      "rejected",
      "expired",
      "cancelled",
    ];

    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if quotation exists and belongs to user's tenant
    // Also check if the linked lead is closed (won/lost/disqualified)
    const { data: existingQuotation, error: fetchError } = await supabase
      .from("quotations")
      .select(`
        id, 
        tenant_id, 
        status, 
        quotation_number,
        lead_id,
        baseline_quotation_id,
        lead:leads!lead_id(
          id,
          stage
        )
      `)
      .eq("id", id)
      .single();

    if (fetchError || !existingQuotation) {
      return NextResponse.json(
        { error: "Quotation not found" },
        { status: 404 }
      );
    }

    // Check if lead is closed (won/lost/disqualified)
    const lead = existingQuotation.lead as { stage?: string } | null;
    if (lead?.stage && ["won", "lost", "disqualified"].includes(lead.stage)) {
      return NextResponse.json(
        { 
          error: "Cannot change status - quotation is linked to a closed lead",
          lead_stage: lead.stage 
        },
        { status: 403 }
      );
    }

    /**
     * Approving is the moment a price becomes the agreed price, so it is the
     * one status change that needs a say in who may make it. It was open to
     * anyone signed in, and quotations.approve existed unused.
     */
    if (status === "approved" && !guard.permissions.has("quotations.approve")) {
      // Logged with what was actually resolved: a refusal that only says "you
      // cannot" is impossible to tell apart from permissions failing to load.
      console.warn("[quotations] approve refused", {
        userId: user.id,
        permissionsResolved: guard.permissions.size,
        hasApprove: guard.permissions.has("quotations.approve"),
      });
      return NextResponse.json(
        {
          error:
            "You do not have permission to approve a quotation. Ask someone who can.",
          reason: "cannot_approve",
        },
        { status: 403 }
      );
    }

    /**
     * A lead has one agreed price.
     *
     * Approving supersedes whatever was approved before. Doing it here means
     * the database constraint is never the thing the user meets; they get a
     * sentence saying what was replaced.
     *
     * "Superseded", not "cancelled": nobody withdrew it, and it may have been
     * the right price at the time. It is simply not the agreed one any more,
     * and that difference is what someone needs a year later when they ask why
     * a quotation was dropped.
     *
     * Baseline copies are left alone: they record what a project was sold on,
     * not a competing offer.
     */
    let supersededNumber: string | null = null;
    if (
      status === "approved" &&
      existingQuotation.lead_id &&
      !existingQuotation.baseline_quotation_id
    ) {
      const { data: alreadyApproved } = await supabase
        .from("quotations")
        .select("id, quotation_number")
        .eq("lead_id", existingQuotation.lead_id)
        .eq("status", "approved")
        .is("baseline_quotation_id", null)
        .neq("id", id)
        .maybeSingle();

      if (alreadyApproved) {
        const { error: supersedeError } = await supabase
          .from("quotations")
          .update({ status: "superseded", updated_by: user.id })
          .eq("id", alreadyApproved.id);

        if (supersedeError) {
          return NextResponse.json(
            {
              error: `Could not supersede ${alreadyApproved.quotation_number}, so this was not approved.`,
            },
            { status: 500 }
          );
        }
        supersededNumber = alreadyApproved.quotation_number;
      }
    }

    // A quotation may be saved half-measured - that is how one gets built -
    // but it must not reach a client that way. The check that used to block
    // every save lives here instead, where it costs nothing during the work
    // and catches the one moment that matters.
    if (status === "sent") {
      const { data: lines } = await supabase
        .from("quotation_line_items")
        .select("id, unit_code, length, width, quantity, rate")
        .eq("quotation_id", id);

      const unpriced = (lines || []).filter((li) => {
        const unit = (li.unit_code || "").toLowerCase();
        if (!li.rate || Number(li.rate) <= 0) return true;
        if (["sqft", "sqm"].includes(unit)) return !li.length || !li.width;
        if (["rft", "rm"].includes(unit)) return !li.length;
        if (["nos", "set", "kg", "ltr"].includes(unit)) return !li.quantity;
        return false;
      });

      if (unpriced.length > 0) {
        return NextResponse.json(
          {
            error: `${unpriced.length} line${
              unpriced.length === 1 ? "" : "s"
            } still need a measurement, quantity or rate. Complete them before sending.`,
            code: "QUOTATION_INCOMPLETE",
            incomplete_lines: unpriced.length,
          },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      status,
      updated_by: user.id,
    };

    // Set timestamp fields based on status
    if (status === "sent") {
      updateData.sent_at = new Date().toISOString();
    } else if (status === "approved") {
      updateData.approved_at = new Date().toISOString();
    } else if (status === "rejected") {
      updateData.rejected_at = new Date().toISOString();
      if (notes) {
        updateData.rejection_reason = notes;
      }
    }

    // If notes provided and it's cancelled, store it in notes field
    if (status === "cancelled" && notes) {
      updateData.notes = notes;
    }

    // Update quotation status
    const { data: updated, error: updateError } = await supabase
      .from("quotations")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating quotation status:", updateError);
      return NextResponse.json(
        { error: "Failed to update status" },
        { status: 500 }
      );
    }

    // A status move is the event people ask about afterwards - when did this
    // go out, when was it approved - so it belongs on the timeline of whatever
    // the quotation hangs off.
    await logQuotationActivity(supabase, {
      quotation: updated,
      type: "quotation_status_changed",
      title: `${quotationLabel(updated)} ${STATUS_WORDING[status] || status}`,
      description: notes || undefined,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      quotation: updated,
      supersededNumber,
      message: supersededNumber
        ? `Approved. ${supersededNumber} was the approved quotation and is now superseded.`
        : `Quotation marked as ${status}`,
    });
  } catch (error) {
    console.error("Status update API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
