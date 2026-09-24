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

// POST /api/quotations/[id]/revision - Create a new revision of a quotation
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["quotations.create"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

    /**
     * **A draft cannot be revised**, because it already IS the editable version.
     *
     * Revise exists to fork a document that has gone out: the price was sent,
     * the client wants changes, and the sent version has to stay on record while
     * a new one is written. On a draft it does the opposite of what anyone
     * means - it creates v+1 and strands the draft you were working in, under
     * the same number, both editable, with nothing on either saying which is
     * live.
     *
     * There was no guard here and the button sat in the builder's header, which
     * is the one place you only ever see a draft. The damage is on record:
     * QT-20251216-001 reached **ten versions** (v1-v8 all cancelled), and three
     * quotation numbers still hold more than one live draft (2026-09-24).
     */
    const { data: current } = await supabase
      .from("quotations")
      .select("status, quotation_number, version")
      .eq("id", id)
      .maybeSingle();

    if (!current) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }
    if (current.status === "draft") {
      return NextResponse.json(
        {
          error:
            "This is still a draft, so there is nothing to revise - edit it directly. Revise is for a quotation that has already gone out.",
          reason: "draft_is_already_editable",
        },
        { status: 409 }
      );
    }

    // Call the database function to create revision
    const { data, error } = await supabase.rpc("create_quotation_revision", {
      p_quotation_id: id,
      p_user_id: user.id,
    });

    if (error) {
      console.error("Error creating revision:", error);
      return NextResponse.json(
        { error: error.message || "Failed to create revision" },
        { status: 500 }
      );
    }

    // Fetch the newly created quotation with relationships
    const { data: newQuotation, error: fetchError } = await supabase
      .from("quotations")
      .select(`
        *,
        lead:leads(
          id,
          lead_number,
          stage,
          client:clients(id, name, phone, email)
        ),
        client:clients(id, name, phone, email)
      `)
      .eq("id", data)
      .single();

    if (fetchError) {
      console.error("Error fetching new revision:", fetchError);
      return NextResponse.json(
        { error: "Revision created but failed to fetch details" },
        { status: 500 }
      );
    }

    // Log activity in lead's timeline if quotation is linked to a lead
    if (newQuotation.lead_id) {
      try {
        // The guard already holds the tenant. Re-reading `users` for it is the
        // trap that answered "Failed to get user tenant" on POST /api/quotations -
        // and `users` is the one table whose only SELECT policy is id = auth.uid().
        const tenantId = user.tenantId;

        if (tenantId) {
          // Was activity_type "quotation_created", which is not a value the
          // lead_activity_type_enum accepts - the insert failed every time and
          // the surrounding catch swallowed it, so revisions have never
          // appeared on a timeline.
          await logQuotationActivity(supabase, {
            quotation: { ...newQuotation, tenant_id: tenantId },
            type: "quotation_revised",
            title: `${quotationLabel(newQuotation)} created as a revision`,
            description: `Revision of ${newQuotation.quotation_number}`,
            userId: user.id,
          });
        }
      } catch (activityError) {
        // Don't fail the revision creation if activity logging fails
        console.error("Failed to log quotation revision activity:", activityError);
      }
    }

    return NextResponse.json({
      quotation: newQuotation,
      message: `Created revision v${newQuotation.version}`,
    });
  } catch (error) {
    console.error("Create revision API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
