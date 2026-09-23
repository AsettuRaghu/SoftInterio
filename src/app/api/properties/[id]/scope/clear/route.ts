import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { logLeadActivity } from "@/lib/activity/log";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Start the scope again.
 *
 * Picking the wrong preset left a seller deleting rooms one at a time, and
 * from Requirement discussion on the row delete refuses to remove the last
 * space or the last component of a space - correctly, because those guards
 * exist to stop a room being left empty. Clearing the lot is a different and
 * deliberate act, so it gets its own door rather than a loophole in theirs.
 *
 * POST -> { cleared }
 *
 * **Refused once a quotation exists**, which is the line that matters: a
 * quotation is built from the scope and then frozen, so emptying the scope
 * underneath one leaves a priced document whose every line reads as "not in
 * the scope". Changing what is being built after a price has been given is a
 * variation, not a restart. The stage is not the test - a quotation is, and
 * `trg_lead_stage_change` creates one the moment a lead reaches proposal
 * discussion, so in practice the line falls where you would expect.
 *
 * Documents filed against a space (`linked_type = scope_item`) are left
 * alone: the pictures a customer sent are theirs, not the room list's, and
 * they stay on the lead's Documents tab where they can be re-attached.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const guard = await protectApiRoute(request, { requiredPermissions: ["leads.edit"] });
  if (!guard.success) return createErrorResponse(guard.error!, guard.statusCode!);
  const { user } = guard;
  const { id: propertyId } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("tenant_id", user.tenantId)
    .maybeSingle();
  if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });

  const { data: lead } = await supabase
    .from("leads")
    .select("id, tenant_id")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("property_id", propertyId)
    .limit(1)
    .maybeSingle();

  // Any quotation on either side of the handover closes this door.
  const ids = [lead?.id, project?.id].filter(Boolean) as string[];
  if (ids.length) {
    const filters = [lead?.id ? `lead_id.eq.${lead.id}` : null, project?.id ? `project_id.eq.${project.id}` : null].filter(Boolean) as string[];
    const { count } = await supabase
      .from("quotations")
      .select("id", { count: "exact", head: true })
      .or(filters.join(","));
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            "A quotation has already been built from this scope, so it cannot be started again. Change the rooms you need to and the quotation will report the difference, or raise a variation.",
          reason: "quotation_exists",
        },
        { status: 409 },
      );
    }
  }

  const { count: before } = await supabase
    .from("property_scope_items")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);
  if ((before ?? 0) === 0) return NextResponse.json({ data: { cleared: 0 } });

  // One delete: components and their chosen items cascade from their space.
  const { error } = await supabase.from("property_scope_items").delete().eq("property_id", propertyId);
  if (error) {
    console.error("[scope] clear failed", error.message);
    return NextResponse.json({ error: "Could not clear the scope" }, { status: 500 });
  }

  if (lead) {
    await logLeadActivity(supabase, {
      leadId: lead.id,
      tenantId: lead.tenant_id,
      userId: user.id,
      type: "lead_updated",
      title: "Scope started again",
      description: `Cleared ${before} row(s) from the scope. The presets are offered again on the empty list.`,
    });
  }

  return NextResponse.json({ data: { cleared: before ?? 0 } });
}
