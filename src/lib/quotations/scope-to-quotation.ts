import { createClient } from "@/lib/supabase/server";

/**
 * Builds a quotation's rooms and components from the property's Spaces tab.
 *
 * Lives here rather than beside one caller because two very different paths
 * need it: the create-quotation API, and the lead stage transition - where a
 * database trigger (trg_lead_stage_change) creates the quotation the moment a
 * lead reaches proposal_discussion, long before any application code could.
 *
 * The copy is one-way and one-time. Per the standing decision, spaces and
 * quotations stay independent afterwards: no foreign key back to the scope
 * row, no sync prompt, no deactivation.
 */
export async function copyScopeToQuotation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  quotationId: string,
  leadId: string | null,
  projectId: string | null
): Promise<{ spaces: number; components: number }> {
  const empty = { spaces: 0, components: 0 };

  try {
    // Scope hangs off the property, which both a lead and a project point at.
    let propertyId: string | null = null;
    if (leadId) {
      const { data } = await supabase
        .from("leads")
        .select("property_id")
        .eq("id", leadId)
        .maybeSingle();
      propertyId = data?.property_id ?? null;
    } else if (projectId) {
      const { data } = await supabase
        .from("projects")
        .select("property_id")
        .eq("id", projectId)
        .maybeSingle();
      propertyId = data?.property_id ?? null;
    }

    if (!propertyId) return empty;

    const { data: scope } = await supabase
      .from("property_scope_items")
      .select("*")
      .eq("property_id", propertyId)
      // Belt and braces alongside RLS: the property id came from a lead or
      // project row, and copying another tenant's scope would be silent.
      .eq("tenant_id", tenantId)
      .order("display_order", { ascending: true });

    if (!scope?.length) return empty;

    const spaceRows = scope.filter(
      (r: Record<string, unknown>) => !r.component_type_id && !r.parent_id
    );
    if (!spaceRows.length) return empty;

    const { data: insertedSpaces, error: spaceError } = await supabase
      .from("quotation_spaces")
      .insert(
        spaceRows.map((r: Record<string, unknown>, index: number) => ({
          quotation_id: quotationId,
          space_type_id: r.space_type_id,
          name: r.name,
          display_order: index,
          length: r.length,
          width: r.width,
          height: r.height,
          measurement_unit: r.measurement_unit,
          subtotal: 0,
        }))
      )
      .select("id");

    if (spaceError || !insertedSpaces) {
      console.error("Error copying scope spaces:", spaceError);
      return empty;
    }

    // Position maps to position, since both lists are in display_order.
    const quotationSpaceByScopeId = new Map<string, string>();
    spaceRows.forEach((r: Record<string, unknown>, index: number) => {
      const created = insertedSpaces[index];
      if (created) quotationSpaceByScopeId.set(String(r.id), created.id);
    });

    const componentRows = scope.filter(
      (r: Record<string, unknown>) =>
        r.component_type_id && quotationSpaceByScopeId.has(String(r.parent_id))
    );

    if (!componentRows.length) {
      return { spaces: insertedSpaces.length, components: 0 };
    }

    const { data: insertedComponents, error: componentError } = await supabase
      .from("quotation_components")
      .insert(
        componentRows.map((r: Record<string, unknown>, index: number) => ({
          quotation_id: quotationId,
          space_id: quotationSpaceByScopeId.get(String(r.parent_id)),
          component_type_id: r.component_type_id,
          name: r.name,
          // A component is measured as a face: width across, height up. The
          // scope row's "length" is its second face dimension.
          width: r.width,
          height: r.length,
          display_order: index,
          // The builder reads the unit from metadata, and without it every
          // dimension would be read as millimetres.
          metadata: r.measurement_unit
            ? { measurement_unit: r.measurement_unit }
            : null,
          subtotal: 0,
        }))
      )
      .select("id");

    if (componentError) {
      console.error("Error copying scope components:", componentError);
      return { spaces: insertedSpaces.length, components: 0 };
    }

    return {
      spaces: insertedSpaces.length,
      components: insertedComponents?.length || 0,
    };
  } catch (error) {
    // The quotation itself is already created and usable, so a failure here is
    // reported rather than losing the whole request.
    console.error("copyScopeToQuotation failed:", error);
    return empty;
  }
}
