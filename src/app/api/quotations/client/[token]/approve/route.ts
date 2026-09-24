import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications/notify";
import { resolveClientLink, refusalMessage } from "@/lib/quotations/client-link";

/**
 * The customer approves their quotation, with no account.
 *
 * POST /api/quotations/client/[token]/approve
 *
 * `protectApiRoute` is deliberately NOT called - the token is the
 * authentication. `resolveClientLink` is the authorisation, and it is shared
 * with the page, the PDF and reject so the four surfaces cannot drift: it
 * looked up the quotation through the SESSION client before, which RLS answers
 * with nothing for a caller who is not signed in, so this route could only ever
 * have 404'd for the audience it was written for.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const gate = await resolveClientLink(token, "answer");
    if (!gate.ok) {
      const { status, message } = refusalMessage(gate.refusal);
      return NextResponse.json({ success: false, error: message }, { status });
    }
    const { quotation } = gate;
    // Past the token, every write is the admin client's: there is no session.
    const supabase = createAdminClient();

    // The same rule as approving from inside: one approved version per
    // quotation number, so the version the client approves supersedes the
    // one approved before it - and nothing else on the lead or project.
    await supabase
      .from("quotations")
      .update({ status: "superseded" })
      .eq("tenant_id", quotation.tenant_id)
      .eq("quotation_number", quotation.quotation_number)
      .eq("status", "approved")
      .neq("id", quotation.id);

    // Update quotation status
    const { error: updateError } = await supabase
      .from("quotations")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("id", quotation.id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Failed to approve quotation" },
        { status: 500 }
      );
    }

    // Log activity
    try {
      await supabase.from("quotation_activities").insert({
        quotation_id: quotation.id,
        activity_type: "approved",
        title: "Client Approved Quotation",
        description: "Quotation was approved by the client via portal",
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        user_agent: request.headers.get("user-agent"),
      });
    } catch {
      // Ignore activity logging errors
    }

    // The client is not signed in, so this is the one producer that writes
    // through the admin client. Audience: whoever owns the lead or manages
    // the project, else whoever made the quotation.
    try {
      const admin = supabase;
      const owners: (string | null)[] = [];
      if (quotation.lead_id) {
        const { data: lead } = await admin.from("leads").select("assigned_to").eq("id", quotation.lead_id).maybeSingle();
        owners.push(lead?.assigned_to ?? null);
      }
      if (quotation.project_id) {
        const { data: project } = await admin.from("projects").select("project_manager_id").eq("id", quotation.project_id).maybeSingle();
        owners.push(project?.project_manager_id ?? null);
      }
      if (!owners.some(Boolean)) owners.push(quotation.assigned_to ?? quotation.created_by ?? null);
      await notify(admin, {
        tenantId: quotation.tenant_id,
        to: owners,
        kind: "quotation_approved",
        title: "Client approved a quotation",
        message: `${quotation.quotation_number}${quotation.version ? ` v${quotation.version}` : ""} was approved by the client`,
        entity: { type: "quotation", id: quotation.id },
        actionUrl: `/dashboard/quotations/${quotation.id}`,
        priority: "high",
        dedupeKey: `quotation_approved:${quotation.id}`,
      });
    } catch (e) {
      console.error("[client approve] notify failed", e);
    }

    return NextResponse.json({
      success: true,
      message: "Quotation approved successfully",
    });
  } catch (error) {
    console.error("Error approving quotation:", error);
    return NextResponse.json(
      { success: false, error: "Failed to approve quotation" },
      { status: 500 }
    );
  }
}
