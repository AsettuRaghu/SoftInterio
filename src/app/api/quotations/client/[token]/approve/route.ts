import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications/notify";

/**
 * Client approves quotation via token
 * POST /api/quotations/client/[token]/approve
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = await createClient();

    // Find quotation by token
    const { data: quotation, error: findError } = await supabase
      .from("quotations")
      .select("id, tenant_id, status, quotation_number, version, client_access_expires_at, lead_id, project_id, created_by, assigned_to")
      .eq("client_access_token", token)
      .single();

    if (findError || !quotation) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired link" },
        { status: 404 }
      );
    }

    // Check if expired
    if (quotation.client_access_expires_at) {
      const expiresAt = new Date(quotation.client_access_expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { success: false, error: "Link has expired" },
          { status: 410 }
        );
      }
    }

    // Check if quotation can be approved
    const validStatuses = ["sent"];
    if (!validStatuses.includes(quotation.status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Quotation cannot be approved (current status: ${quotation.status})` 
        },
        { status: 400 }
      );
    }

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
      const admin = createAdminClient();
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
