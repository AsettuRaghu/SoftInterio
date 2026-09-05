import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { logLeadActivity } from "@/lib/activity/log";
import type { ScopeBulkEntry } from "@/types/property-scope";

/**
 * Scope for one property: the rooms and areas a client wants work in.
 *
 * Reached from a lead's Property tab, but addressed by property because that
 * is where the data belongs - the same rows serve the project once the lead is
 * won, with nothing copied across.
 */

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Confirms the property is inside the caller's tenant.
 *
 * RLS already scopes property_scope_items, but properties are read here to
 * decide what to write, and a row created against another tenant's property id
 * would be invisible to everyone afterwards. Better to refuse it outright.
 */
async function assertPropertyInTenant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  tenantId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return !!data;
}

/** The lead this property belongs to, if any, so scope edits reach a timeline. */
async function findLeadForProperty(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string
): Promise<{ id: string; tenant_id: string } | null> {
  const { data } = await supabase
    .from("leads")
    .select("id, tenant_id")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

// GET /api/properties/[id]/scope
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["leads.view"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id: propertyId } = await params;
    const supabase = await createClient();

    if (!(await assertPropertyInTenant(supabase, propertyId, user.tenantId))) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("property_scope_items")
      .select(
        `*,
         space_type:space_types(id, name, slug, icon, is_container),
         component_type:component_types(id, name, slug, icon)`
      )
      .eq("property_id", propertyId)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading property scope:", error);
      return NextResponse.json(
        { error: "Failed to load scope" },
        { status: 500 }
      );
    }

    return NextResponse.json({ items: data || [] });
  } catch (error) {
    console.error("Property scope GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/properties/[id]/scope
 *
 * Takes counts and expands them: { space_type_id, count: 5 } becomes five rows
 * named "Washroom 1" through "Washroom 5". Entry is bulk because typing
 * sixteen rooms is what stops people using the tab; storage is one row per real
 * room because every room diverges later - different sizes, measured
 * separately, becoming separate quotation spaces and separate work.
 *
 * Numbering continues from whatever already exists, so adding two more
 * balconies to three appends 4 and 5 rather than colliding.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["leads.edit"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id: propertyId } = await params;
    const supabase = await createClient();
    const body = await request.json();

    if (!(await assertPropertyInTenant(supabase, propertyId, user.tenantId))) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const entries: ScopeBulkEntry[] = Array.isArray(body.entries)
      ? body.entries
      : [];
    // An entry names a space type or a component type. Requiring
    // space_type_id here silently discarded every component entry, so adding
    // components to a space failed with "Nothing to add".
    const wanted = entries.filter(
      (e) => (e.space_type_id || e.component_type_id) && Number(e.count) > 0
    );

    if (wanted.length === 0) {
      return NextResponse.json(
        { error: "Nothing to add" },
        { status: 400 }
      );
    }

    // Cap the whole request rather than each line: someone typing 999 into one
    // box should not be able to create a thousand rows.
    const totalRequested = wanted.reduce((sum, e) => sum + Number(e.count), 0);
    if (totalRequested > 100) {
      return NextResponse.json(
        { error: "That would add more than 100 spaces at once" },
        { status: 400 }
      );
    }

    // Every entry is a space or a component, never both - the same rule the
    // table enforces.
    if (wanted.some((e) => e.space_type_id && e.component_type_id)) {
      return NextResponse.json(
        { error: "An entry cannot be both a space and a component" },
        { status: 400 }
      );
    }
    if (wanted.some((e) => e.component_type_id && !e.parent_id)) {
      return NextResponse.json(
        { error: "Components must be added inside a space" },
        { status: 400 }
      );
    }

    const spaceTypeIds = [
      ...new Set(wanted.map((e) => e.space_type_id).filter(Boolean)),
    ] as string[];
    const componentTypeIds = [
      ...new Set(wanted.map((e) => e.component_type_id).filter(Boolean)),
    ] as string[];

    const [{ data: spaceTypes }, { data: componentTypes }] = await Promise.all([
      spaceTypeIds.length
        ? supabase
            .from("space_types")
            .select("id, name")
            .in("id", spaceTypeIds)
            .eq("tenant_id", user.tenantId)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      componentTypeIds.length
        ? supabase
            .from("component_types")
            .select("id, name")
            .in("id", componentTypeIds)
            .eq("tenant_id", user.tenantId)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const nameByType = new Map<string, string>();
    for (const t of [...(spaceTypes || []), ...(componentTypes || [])]) {
      nameByType.set(t.id, t.name);
    }

    if (nameByType.size !== spaceTypeIds.length + componentTypeIds.length) {
      return NextResponse.json(
        { error: "One or more types are not available" },
        { status: 400 }
      );
    }

    // Parents must be real spaces on this property, or a crafted request could
    // hang components off another property's rooms.
    const parentIds = [
      ...new Set(wanted.map((e) => e.parent_id).filter(Boolean)),
    ] as string[];
    if (parentIds.length) {
      const { data: parents } = await supabase
        .from("property_scope_items")
        .select("id")
        .in("id", parentIds)
        .eq("property_id", propertyId)
        .is("component_type_id", null);
      if ((parents || []).length !== parentIds.length) {
        return NextResponse.json(
          { error: "Components must be added inside a space on this property" },
          { status: 400 }
        );
      }
    }

    const { data: existing } = await supabase
      .from("property_scope_items")
      .select("space_type_id, component_type_id, parent_id, display_order")
      .eq("property_id", propertyId);

    // Numbering restarts per space: a second wardrobe in the master bedroom is
    // "Wardrobe 2" there, regardless of how many wardrobes exist elsewhere.
    const countKey = (
      typeId: string,
      parentId: string | null | undefined
    ) => `${typeId}::${parentId || "root"}`;

    const seenByKey = new Map<string, number>();
    let nextOrder = 0;
    for (const row of existing || []) {
      const typeId = row.component_type_id || row.space_type_id;
      if (typeId) {
        const key = countKey(typeId, row.parent_id);
        seenByKey.set(key, (seenByKey.get(key) || 0) + 1);
      }
      nextOrder = Math.max(nextOrder, (row.display_order ?? 0) + 1);
    }

    const rows: Record<string, unknown>[] = [];
    for (const entry of wanted) {
      const typeId = (entry.space_type_id || entry.component_type_id) as string;
      const typeName = nameByType.get(typeId) || "Space";
      const key = countKey(typeId, entry.parent_id);
      const alreadyThere = seenByKey.get(key) || 0;

      for (let i = 0; i < Number(entry.count); i++) {
        const index = alreadyThere + i + 1;
        rows.push({
          tenant_id: user.tenantId,
          property_id: propertyId,
          parent_id: entry.parent_id || null,
          space_type_id: entry.space_type_id || null,
          component_type_id: entry.component_type_id || null,
          // A single one of its kind reads better without a "1" after it.
          name:
            alreadyThere === 0 && Number(entry.count) === 1
              ? typeName
              : `${typeName} ${index}`,
          display_order: nextOrder++,
          created_by: user.id,
        });
      }
    }

    const { data: inserted, error } = await supabase
      .from("property_scope_items")
      .insert(rows)
      .select(
        `*,
         space_type:space_types(id, name, slug, icon, is_container),
         component_type:component_types(id, name, slug, icon)`
      );

    if (error) {
      console.error("Error adding scope items:", error);
      return NextResponse.json(
        { error: "Failed to add spaces" },
        { status: 500 }
      );
    }

    /**
     * Fill each new space with the components chosen for its type.
     *
     * The caller sends a map of space type -> component types, worked out from
     * which components declare they belong in that space. Doing it here rather
     * than in a second request keeps a half-created space from existing if the
     * page is closed mid-way.
     *
     * Only spaces get filled; components do not contain components.
     */
    const componentsBySpaceType: Record<string, string[]> =
      body.components_by_space_type && typeof body.components_by_space_type === "object"
        ? body.components_by_space_type
        : {};

    let createdComponents: Record<string, unknown>[] = [];
    const newSpaces = (inserted || []).filter(
      (row: { space_type_id: string | null }) => row.space_type_id
    );

    if (Object.keys(componentsBySpaceType).length && newSpaces.length) {
      const requestedIds = [
        ...new Set(Object.values(componentsBySpaceType).flat()),
      ];

      // Names for the rows, and a check that every id is this tenant's.
      const { data: compTypes } = await supabase
        .from("component_types")
        .select("id, name")
        .in("id", requestedIds)
        .eq("tenant_id", user.tenantId);

      const compNameById = new Map(
        (compTypes || []).map((c: { id: string; name: string }) => [c.id, c.name])
      );

      const rows: Record<string, unknown>[] = [];
      let order = nextOrder;
      for (const space of newSpaces as {
        id: string;
        space_type_id: string;
      }[]) {
        for (const componentTypeId of
          componentsBySpaceType[space.space_type_id] || []) {
          const name = compNameById.get(componentTypeId);
          if (!name) continue; // unknown or another tenant's - skip quietly
          rows.push({
            tenant_id: user.tenantId,
            property_id: propertyId,
            parent_id: space.id,
            component_type_id: componentTypeId,
            name,
            display_order: order++,
            created_by: user.id,
          });
        }
      }

      if (rows.length) {
        const { data: insertedComponents, error: componentError } =
          await supabase
            .from("property_scope_items")
            .insert(rows)
            .select(
              `*,
               space_type:space_types(id, name, slug, icon, is_container),
               component_type:component_types(id, name, slug, icon)`
            );
        if (componentError) {
          // The spaces are saved and useful on their own, so this is reported
          // rather than failing the whole request.
          console.error("Error adding space components:", componentError);
        } else {
          createdComponents = insertedComponents || [];
        }
      }
    }

    // Scope is a sales decision, so it belongs on the lead's timeline.
    const lead = await findLeadForProperty(supabase, propertyId);
    if (lead) {
      await logLeadActivity(supabase, {
        leadId: lead.id,
        tenantId: lead.tenant_id,
        userId: user.id,
        type: "lead_updated",
        title: "Property scope updated",
        description: `Added ${rows.length} space${
          rows.length === 1 ? "" : "s"
        }: ${wanted
          .map(
            (e) =>
              `${nameByType.get(
                (e.space_type_id || e.component_type_id) as string
              )} x${e.count}`
          )
          .join(", ")}${
          createdComponents.length
            ? ` with ${createdComponents.length} component${
                createdComponents.length === 1 ? "" : "s"
              }`
            : ""
        }`,
      });
    }

    // Spaces and their components together, so the caller can append both.
    return NextResponse.json(
      { items: [...(inserted || []), ...createdComponents] },
      { status: 201 }
    );
  } catch (error) {
    console.error("Property scope POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
