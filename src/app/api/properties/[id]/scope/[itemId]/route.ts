import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { afterScopeChange } from "@/lib/scope/after-change";
import { logLeadActivity } from "@/lib/activity/log";

/** Rename, measure or remove a single scope item. */

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>;
}

const WRITABLE = [
  "name",
  "length",
  "width",
  "height",
  "measurement_unit",
  "measurement_source",
  "measurement_status",
  // Free text, read from the catalogue's tiers - see CLAUDE.md on why it is
  // not an enum. Was missing here, so the Quality dropdown saved nothing.
  "quality_tier",
  "notes",
  "display_order",
  "parent_id",
  // Who does this part of the scope. A client or vendor row is work we wait
  // for; an excluded row is named so nobody assumes it later.
  "scope_owner",
  "scope_vendor_name",
  // The register: what finish they want, and for a client/vendor row what
  // is arriving from them and by when.
  "preferred_finish",
  "supplied_detail",
  "supplied_expected_by",
] as const;

const SCOPE_OWNERS = new Set(["us", "client", "vendor", "excluded"]);

async function findLeadForProperty(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string
) {
  const { data } = await supabase
    .from("leads")
    .select("id, tenant_id")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["leads.edit"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id: propertyId, itemId } = await params;
    const supabase = await createClient();
    const body = await request.json();

    // RLS scopes this to the tenant; matching on property too stops an item id
    // from one property being edited through another's URL.
    const { data: existing } = await supabase
      .from("property_scope_items")
      .select("id, name")
      .eq("id", itemId)
      .eq("property_id", propertyId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if ("name" in body && !String(body.name || "").trim()) {
      return NextResponse.json(
        { error: "Name cannot be empty" },
        { status: 400 }
      );
    }

    // A space cannot be its own parent; deeper cycles are prevented by the UI
    // only offering container types as parents.
    if ("scope_owner" in body && !SCOPE_OWNERS.has(String(body.scope_owner))) {
      return NextResponse.json(
        { error: "scope_owner must be us, client, vendor or excluded" },
        { status: 400 }
      );
    }
    if (body.parent_id === itemId) {
      return NextResponse.json(
        { error: "A space cannot contain itself" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    for (const key of WRITABLE) {
      if (key in body) updates[key] = body[key];
    }
    if (typeof updates.name === "string") updates.name = updates.name.trim();
    // An empty patch used to reach PostgREST, which answers "0 rows" and read
    // as "Failed to update space" - say what actually happened instead.
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update: none of the fields sent can be changed here." },
        { status: 400 }
      );
    }

    // The history trigger records what changed; the reason, when given, is
    // added to that row afterwards - see below.
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    const { data, error } = await supabase
      .from("property_scope_items")
      .update(updates)
      .eq("id", itemId)
      .select(`*, space_type:space_types(id, name, slug, icon, is_container)`)
      .single();

    if (error) {
      console.error("Error updating scope item:", error);
      return NextResponse.json(
        { error: "Failed to update space" },
        { status: 500 }
      );
    }

    // Attach the reason to the change the trigger just logged (the newest
    // row for this item by this person), and tell the project manager when
    // the scope moves under a project that has been kicked off.
    if (Object.keys(updates).length) {
      void afterScopeChange(supabase, {
        propertyId,
        itemId,
        itemName: String(data?.name ?? existing.name),
        reason,
        actor: guard.user.id,
        tenantId: guard.user.tenantId,
        changed: Object.keys(updates),
      });
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    console.error("Scope item PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["leads.edit"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id: propertyId, itemId } = await params;
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("property_scope_items")
      .select("id, name, parent_id, component_type_id, scope_owner")
      .eq("id", itemId)
      .eq("property_id", propertyId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // From Requirement discussion on, the scope is what the sale rests on:
    // the last space cannot go, and a space of ours cannot be emptied of
    // components - mark it the client's or excluded instead (2026-09-18).
    const leadForGate = await supabase
      .from("leads")
      .select("stage")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const pastRequirements = ["requirement_discussion", "proposal_discussion", "won"].includes(leadForGate.data?.stage ?? "");
    if (pastRequirements) {
      if (!existing.component_type_id) {
        const { count } = await supabase
          .from("property_scope_items")
          .select("id", { count: "exact", head: true })
          .eq("property_id", propertyId)
          .is("component_type_id", null)
          .is("parent_id", null);
        if ((count ?? 0) <= 1) {
          return NextResponse.json(
            { error: "The scope needs at least one space from Requirement discussion on." },
            { status: 409 }
          );
        }
      } else if (existing.parent_id) {
        const { data: parent } = await supabase
          .from("property_scope_items")
          .select("scope_owner")
          .eq("id", existing.parent_id)
          .maybeSingle();
        const parentOurs = !parent?.scope_owner || parent.scope_owner === "us";
        if (parentOurs) {
          const { count } = await supabase
            .from("property_scope_items")
            .select("id", { count: "exact", head: true })
            .eq("parent_id", existing.parent_id)
            .or("scope_owner.is.null,scope_owner.eq.us");
          if ((count ?? 0) <= 1 && (!existing.scope_owner || existing.scope_owner === "us")) {
            return NextResponse.json(
              { error: "A space of ours keeps at least one component from Requirement discussion on. Mark the space as the client's or excluded if nothing there is ours." },
              { status: 409 }
            );
          }
        }
      }
    }

    // Children cascade in the database, so removing a floor removes its rooms.
    const { error } = await supabase
      .from("property_scope_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      console.error("Error deleting scope item:", error);
      return NextResponse.json(
        { error: "Failed to delete space" },
        { status: 500 }
      );
    }

    const lead = await findLeadForProperty(supabase, propertyId);
    if (lead) {
      await logLeadActivity(supabase, {
        leadId: lead.id,
        tenantId: lead.tenant_id,
        userId: user.id,
        type: "lead_updated",
        title: "Property scope updated",
        description: `Removed "${existing.name}" from the property scope`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Scope item DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
