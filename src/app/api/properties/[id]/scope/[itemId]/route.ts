import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
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
  "notes",
  "display_order",
  "parent_id",
] as const;

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
      .select("id, name")
      .eq("id", itemId)
      .eq("property_id", propertyId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
