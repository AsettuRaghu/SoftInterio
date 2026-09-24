import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications/notify";
import { resolveClientLink, refusalMessage } from "@/lib/quotations/client-link";

/**
 * The customer asks for changes instead of approving.
 *
 * POST /api/quotations/client/[token]/reject   { reason }
 *
 * **This route could never have worked.** Two independent reasons, and the
 * second outlived the first: it looked the quotation up through the session
 * client, which RLS answers with nothing for somebody who is not signed in; and
 * it then wrote `status: "negotiating"`, which the CHECK on the column refuses -
 * `negotiating` was retired on 2026-09-17 as "a fact, not a status". Verified
 * against the live constraint before this rewrite: the update is rejected.
 *
 * The honest status is **rejected**, with the reason recorded. That is not a
 * final no in the business sense - the seller answers it with Revise, which is
 * the supported way to change a quotation that has gone out - and it is what the
 * screen has always called `actionComplete: "rejected"` under a button labelled
 * "Request Changes".
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = String(body?.reason ?? "").trim();

    const gate = await resolveClientLink(token, "answer");
    if (!gate.ok) {
      const { status, message } = refusalMessage(gate.refusal);
      return NextResponse.json({ success: false, error: message }, { status });
    }
    const { quotation } = gate;
    // Past the token there is no session, so every write is the admin client's.
    const supabase = createAdminClient();

    if (!reason) {
      // The screen already requires it; asked for again here because the whole
      // value of this answer to the seller is knowing what to change.
      return NextResponse.json(
        { success: false, error: "Please say what you would like changed." },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("quotations")
      .update({
        status: "rejected",
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq("id", quotation.id);

    if (updateError) {
      console.error("[client reject] update failed", updateError.message);
      return NextResponse.json(
        { success: false, error: "Could not submit your feedback. Please contact us." },
        { status: 500 }
      );
    }

    try {
      await supabase.from("quotation_activities").insert({
        quotation_id: quotation.id,
        activity_type: "rejected",
        title: "Client requested changes",
        description: reason,
        metadata: { reason, via: "client_link" },
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        user_agent: request.headers.get("user-agent"),
      });
    } catch {
      // A quotation that has been answered matters more than its activity row.
    }

    // The seller has to hear this, and nobody is signed in to see it happen -
    // the same audience and the same admin-client producer as approve.
    try {
      const owners: (string | null)[] = [];
      if (quotation.lead_id) {
        const { data: lead } = await supabase
          .from("leads")
          .select("assigned_to")
          .eq("id", quotation.lead_id)
          .maybeSingle();
        owners.push(lead?.assigned_to ?? null);
      }
      if (quotation.project_id) {
        const { data: project } = await supabase
          .from("projects")
          .select("project_manager_id")
          .eq("id", quotation.project_id)
          .maybeSingle();
        owners.push(project?.project_manager_id ?? null);
      }
      if (!owners.some(Boolean)) owners.push(quotation.assigned_to ?? quotation.created_by ?? null);
      await notify(supabase, {
        tenantId: quotation.tenant_id,
        to: owners,
        kind: "quotation_rejected",
        title: "Client asked for changes",
        message: `${quotation.quotation_number}${quotation.version ? ` v${quotation.version}` : ""}: ${reason.slice(0, 140)}`,
        entity: { type: "quotation", id: quotation.id },
        actionUrl: `/dashboard/quotations/${quotation.id}`,
        priority: "high",
        dedupeKey: `quotation_rejected:${quotation.id}`,
      });
    } catch {
      // A failure to tell somebody never fails the change it describes.
    }

    return NextResponse.json({ success: true, message: "Thank you - we will be in touch." });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    return NextResponse.json(
      { success: false, error: "Could not submit your feedback. Please contact us." },
      { status: 500 }
    );
  }
}
