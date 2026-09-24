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
    // Superseded is the system's to set, below, never picked.
    const validStatuses = ["draft", "sent", "approved", "rejected", "cancelled"];

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
     * One approved version per quotation NUMBER.
     *
     * Approving v3 of QT-0004 supersedes the approved v2 of QT-0004 - and
     * only that. QT-0011 on the same lead or project is a different
     * quotation for a different thing and is left alone. Same rule on a lead
     * and on a project. Doing it here means the unique index
     * (quotations_one_approved_per_number) is never the thing the user
     * meets; they get a sentence saying which version was replaced.
     *
     * "Superseded", not "cancelled": nobody withdrew it, and it may have been
     * the right price at the time. It is simply not the agreed one any more,
     * and that difference is what someone needs a year later when they ask
     * why a quotation was dropped.
     */
    let supersededNumber: string | null = null;
    if (status === "approved") {
      const { data: alreadyApproved } = await supabase
        .from("quotations")
        .select("id, quotation_number, version")
        .eq("tenant_id", existingQuotation.tenant_id)
        .eq("quotation_number", existingQuotation.quotation_number)
        .eq("status", "approved")
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
              error: `Could not supersede ${alreadyApproved.quotation_number} v${alreadyApproved.version}, so this was not approved.`,
            },
            { status: 500 }
          );
        }
        supersededNumber = `${alreadyApproved.quotation_number} v${alreadyApproved.version}`;
      }
    }

    // A quotation may be saved half-measured - that is how one gets built -
    // but it must not reach a client that way. The check that used to block
    // every save lives here instead, where it costs nothing during the work
    // and catches the one moment that matters.
    if (status === "sent") {
      const { data: lines } = await supabase
        .from("quotation_line_items")
        .select(
          "id, name, unit_code, length, width, quantity, rate, metadata, component:quotation_components(name, space:quotation_spaces(name))"
        )
        .eq("quotation_id", id);

      const unpriced = (lines || []).filter((li) => {
        const unit = (li.unit_code || "").toLowerCase();
        if (!li.rate || Number(li.rate) <= 0) return true;

        /**
         * **A rule-priced line has no length or width, by design**, so asking
         * for them calls a correctly priced line incomplete.
         *
         * `metadata.quantity_key` means the quantity comes from the component's
         * costing rule - 95.91 sqft of front elevation derived from its size -
         * and is stored on the line, while length and width are meaningless for
         * it. Demanding them here refused to SEND a quotation that was entirely
         * right: on QT-20260924-001, 45 of 97 lines were reported as needing a
         * measurement and every one of them had a quantity, a rate and an
         * amount, with zero lines genuinely missing a rate. That was the whole
         * of "45 lines still need a measurement" (2026-09-24).
         *
         * This is the same bug that produced the amber "43 lines need size"
         * strip in the builder, fixed there two days earlier and left here -
         * which is the argument for the two tests agreeing. The honest question
         * for a ruled line is whether the rule produced anything.
         */
        if (li.metadata?.quantity_key) return !li.quantity || Number(li.quantity) <= 0;

        if (["sqft", "sqm"].includes(unit)) return !li.length || !li.width;
        if (["rft", "rm"].includes(unit)) return !li.length;
        if (["nos", "set", "kg", "ltr"].includes(unit)) return !li.quantity;
        return false;
      });

      if (unpriced.length > 0) {
        /**
         * **Name them.** "2 lines still need a measurement, quantity or rate" is
         * a dead end on a 97-line quotation: it is true, it blocks the send, and
         * it does not say where to look. The two that survive the ruled-line fix
         * above are a real case worth seeing - a Blind Corner Pull-out priced per
         * `corners` on a kitchen with no corners, so the rule derives 0 and the
         * line is worth nothing. That is a decision to take (drop the line, or
         * say how many corners there are), not a mystery to hunt.
         */
        const where = (li: { component?: unknown }) => {
          const c = (Array.isArray(li.component) ? li.component[0] : li.component) as
            | { name?: string; space?: { name?: string } | { name?: string }[] }
            | null;
          const sp = Array.isArray(c?.space) ? c?.space[0] : c?.space;
          return [c?.name, sp?.name].filter(Boolean).join(", ");
        };
        const named = unpriced.slice(0, 4).map((li) => {
          const w = where(li);
          return w ? `${li.name} (${w})` : li.name;
        });
        const rest = unpriced.length - named.length;

        return NextResponse.json(
          {
            error: `${unpriced.length} line${
              unpriced.length === 1 ? "" : "s"
            } still need a measurement, quantity or rate before this can be sent: ${named.join("; ")}${
              rest > 0 ? `, and ${rest} more` : ""
            }.`,
            code: "QUOTATION_INCOMPLETE",
            incomplete_lines: unpriced.length,
            incomplete: unpriced.map((li) => ({ name: li.name, where: where(li) })),
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
        ? `Approved. ${supersededNumber} was the approved version and is now superseded.`
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
