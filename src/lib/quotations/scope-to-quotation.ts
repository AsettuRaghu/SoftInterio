import { createClient } from "@/lib/supabase/server";
import { calculateSqft, convertToFeet, getMeasurementInfo, type MeasurementUnit } from "@/components/quotations/types";

/**
 * Brings the property's scope into a quotation - the rooms and components
 * from the Scope tab, with their sizes - adding only what the quotation does
 * not already have.
 *
 * Lives here rather than beside one caller because three paths need it: the
 * create-quotation API, the lead stage transition (where a database trigger
 * creates the quotation before any application code runs), and the builder's
 * "Bring in from scope" action on a draft.
 *
 * The rules (docs/plans/scope.md, decided 2026-09-18):
 *
 *  - PULL, never sync. Nothing here runs unless a person creates a quotation
 *    or presses the button; nothing ever changes or removes a line the
 *    quotation already has. A space's or component's size is copied when the
 *    row is created and not touched again.
 *  - ONLY WHAT IS MISSING. A scope row already represented in the quotation
 *    is skipped - matched by the provenance pointer `metadata.scope_item_id`
 *    written at copy time, and for rows older than that pointer by type and
 *    name. There is deliberately no foreign key: the pointer says where a
 *    line came from, and nothing reads it except this function.
 *  - NOT OURS, NOT PRICED. A scope row whose Done-by is client, vendor or
 *    excluded is never brought in, and a space so marked takes its
 *    components with it.
 *  - A component is measured as a face: width across, height up. The scope
 *    row's "length" is its second face dimension.
 *  - `metadata.measurement_status` is carried so the builder can say a size
 *    is still rough.
 *  - A component's FIRST-PREFERENCE cost items (the third level of the
 *    scope) become its line items, at the catalogue's rate and sized from
 *    the component; second preferences stay behind (an alternative
 *    quotation is a later feature), and so does any item the client keeps
 *    for themselves. A line already present for that cost item is left alone.
 */

type Row = Record<string, unknown> & {
  id: string;
  parent_id: string | null;
  space_type_id: string | null;
  component_type_id: string | null;
  name: string;
  scope_owner: string | null;
  cost_item_id: string | null;
  choice_status: string | null;
  measurement_status: string | null;
  measurement_unit: string | null;
  length: number | null;
  width: number | null;
  height: number | null;
  display_order: number;
};

export interface ScopeCopyResult {
  spaces: number;
  components: number;
  /** Chosen cost items copied as line items. */
  lines: number;
  /** Rows not ours to price, left out. */
  skipped: number;
  /** Rows already in the quotation, left alone. */
  already: number;
}

const OURS = (owner: string | null | undefined) => !owner || owner === "us";

export async function copyScopeToQuotation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  quotationId: string,
  leadId: string | null,
  projectId: string | null,
): Promise<ScopeCopyResult> {
  const empty: ScopeCopyResult = { spaces: 0, components: 0, lines: 0, skipped: 0, already: 0 };

  try {
    // Scope hangs off the property, which both a lead and a project point at.
    let propertyId: string | null = null;
    if (leadId) {
      const { data } = await supabase.from("leads").select("property_id").eq("id", leadId).maybeSingle();
      propertyId = data?.property_id ?? null;
    } else if (projectId) {
      const { data } = await supabase.from("projects").select("property_id").eq("id", projectId).maybeSingle();
      propertyId = data?.property_id ?? null;
    }
    if (!propertyId) return empty;

    const [{ data: scopeRaw }, { data: existingSpaces }] = await Promise.all([
      supabase
        .from("property_scope_items")
        .select("*")
        .eq("property_id", propertyId)
        // Belt and braces alongside RLS: the property id came from a lead or
        // project row, and copying another tenant's scope would be silent.
        .eq("tenant_id", tenantId)
        .order("display_order", { ascending: true }),
      supabase
        .from("quotation_spaces")
        .select("id, name, space_type_id, display_order, metadata, components:quotation_components(id, name, component_type_id, width, height, metadata, lines:quotation_line_items(quotation_cost_item_id))")
        .eq("quotation_id", quotationId),
    ]);
    const scope = (scopeRaw ?? []) as Row[];
    if (!scope.length) return empty;

    // What the quotation already holds, by provenance and by type+name.
    const spaceByScopeId = new Map<string, string>();
    const spaceByTypeName = new Map<string, string>();
    const compScopeIds = new Set<string>();
    const compByTypeName = new Set<string>();
    // Where each scope component already lives, with the cost items it holds.
    const qcompByScopeId = new Map<string, { id: string; width: number | null; height: number | null; unit: string; lines: Set<string> }>();
    const qcompByTypeName = new Map<string, { id: string; width: number | null; height: number | null; unit: string; lines: Set<string> }>();
    let maxOrder = -1;
    for (const qs of (existingSpaces ?? []) as Array<{
      id: string; name: string; space_type_id: string | null; display_order: number | null;
      metadata: { scope_item_id?: string } | null;
      components: Array<{ id: string; name: string; component_type_id: string | null; width: number | null; height: number | null; metadata: { scope_item_id?: string; measurement_unit?: string } | null; lines: Array<{ quotation_cost_item_id: string | null }> | null }> | null;
    }>) {
      if (qs.metadata?.scope_item_id) spaceByScopeId.set(qs.metadata.scope_item_id, qs.id);
      spaceByTypeName.set(`${qs.space_type_id ?? ""}::${qs.name.trim().toLowerCase()}`, qs.id);
      maxOrder = Math.max(maxOrder, qs.display_order ?? 0);
      for (const c of qs.components ?? []) {
        const info = { id: c.id, width: c.width, height: c.height, unit: c.metadata?.measurement_unit ?? "mm", lines: new Set((c.lines ?? []).map((l) => l.quotation_cost_item_id).filter(Boolean) as string[]) };
        if (c.metadata?.scope_item_id) {
          compScopeIds.add(c.metadata.scope_item_id);
          qcompByScopeId.set(c.metadata.scope_item_id, info);
        }
        const key = `${qs.id}::${c.component_type_id ?? ""}::${c.name.trim().toLowerCase()}`;
        compByTypeName.add(key);
        qcompByTypeName.set(key, info);
      }
    }

    const result: ScopeCopyResult = { ...empty };
    const spaceRows = scope.filter((r) => !r.component_type_id && !r.parent_id);
    // Where each scope space lands in the quotation - existing or new.
    const quotationSpaceByScopeId = new Map<string, string>();
    const toInsert: Row[] = [];

    for (const r of spaceRows) {
      if (!OURS(r.scope_owner)) {
        result.skipped += 1 + scope.filter((c) => c.parent_id === r.id).length;
        continue;
      }
      const existing = spaceByScopeId.get(r.id) ?? spaceByTypeName.get(`${r.space_type_id ?? ""}::${r.name.trim().toLowerCase()}`);
      if (existing) {
        quotationSpaceByScopeId.set(r.id, existing);
        result.already += 1;
      } else {
        toInsert.push(r);
      }
    }

    if (toInsert.length) {
      const { data: inserted, error } = await supabase
        .from("quotation_spaces")
        .insert(
          toInsert.map((r, i) => ({
            quotation_id: quotationId,
            space_type_id: r.space_type_id,
            name: r.name,
            display_order: maxOrder + 1 + i,
            length: r.length,
            width: r.width,
            height: r.height,
            measurement_unit: r.measurement_unit,
            subtotal: 0,
            metadata: { scope_item_id: r.id, measurement_status: r.measurement_status },
          })),
        )
        .select("id");
      if (error || !inserted) {
        console.error("Error copying scope spaces:", error);
        return result;
      }
      // Position maps to position, since both lists are in the same order.
      toInsert.forEach((r, i) => {
        if (inserted[i]) quotationSpaceByScopeId.set(r.id, inserted[i].id);
      });
      result.spaces = inserted.length;
    }

    const compRows: Array<{ r: Row; spaceId: string }> = [];
    // Scope component id -> quotation component (existing or new) for the lines.
    const targetByScopeComp = new Map<string, { id: string; width: number | null; height: number | null; unit: string; lines: Set<string> }>();
    for (const r of scope) {
      if (!r.component_type_id || !r.parent_id || r.cost_item_id) continue;
      const spaceId = quotationSpaceByScopeId.get(r.parent_id);
      if (!spaceId) continue; // its space was not ours, or is not in the quotation
      if (!OURS(r.scope_owner)) {
        result.skipped += 1;
        continue;
      }
      const key = `${spaceId}::${r.component_type_id}::${r.name.trim().toLowerCase()}`;
      const existingComp = qcompByScopeId.get(r.id) ?? qcompByTypeName.get(key);
      if (existingComp) {
        targetByScopeComp.set(r.id, existingComp);
        result.already += 1;
        continue;
      }
      compRows.push({ r, spaceId });
    }

    if (compRows.length) {
      const { data: inserted, error } = await supabase
        .from("quotation_components")
        .insert(
          compRows.map(({ r, spaceId }, index) => ({
            quotation_id: quotationId,
            space_id: spaceId,
            component_type_id: r.component_type_id,
            name: r.name,
            width: r.width,
            height: r.length,
            display_order: index,
            // The builder reads the unit from metadata, and without it every
            // dimension would be read as millimetres.
            metadata: {
              measurement_unit: r.measurement_unit ?? undefined,
              scope_item_id: r.id,
              measurement_status: r.measurement_status,
            },
            subtotal: 0,
          })),
        )
        .select("id");
      if (error) console.error("Error copying scope components:", error);
      else {
        result.components = inserted?.length ?? 0;
        compRows.forEach(({ r }, i) => {
          if (inserted?.[i]) targetByScopeComp.set(r.id, { id: inserted[i].id, width: r.width, height: r.length, unit: r.measurement_unit ?? "mm", lines: new Set() });
        });
      }
    }

    // The third level: first-preference cost items become line items, sized
    // from the component at the catalogue's rate. Second preferences and
    // items the client keeps stay behind.
    const chosen = scope.filter((r) => r.cost_item_id && r.choice_status === "p1" && OURS(r.scope_owner) && r.parent_id && targetByScopeComp.has(r.parent_id));
    const wantedIds = [...new Set(chosen.map((r) => r.cost_item_id as string))];
    if (wantedIds.length) {
      const { data: costItems } = await supabase
        .from("quotation_cost_items")
        .select("id, name, unit_code, default_rate, company_cost, vendor_cost")
        .in("id", wantedIds);
      const byId = new Map((costItems ?? []).map((c) => [c.id as string, c]));
      const lineRows: Record<string, unknown>[] = [];
      for (const r of chosen) {
        const target = targetByScopeComp.get(r.parent_id as string)!;
        const ci = byId.get(r.cost_item_id as string);
        if (!ci || target.lines.has(ci.id)) {
          if (ci) result.already += 1;
          continue;
        }
        const unit = (target.unit || "mm") as MeasurementUnit;
        const kind = getMeasurementInfo(ci.unit_code).type;
        const rate = Number(ci.default_rate) || 0;
        // The same arithmetic the builder uses; a measured line follows the
        // component's size until somebody types its own.
        const amount =
          kind === "area" ? calculateSqft(target.width, target.height, unit) * rate
          : kind === "length" ? convertToFeet(target.width || 0, unit) * rate
          : kind === "fixed" ? rate
          : rate;
        lineRows.push({
          quotation_id: quotationId,
          quotation_component_id: target.id,
          quotation_cost_item_id: ci.id,
          name: ci.name,
          length: kind === "area" || kind === "length" ? target.width : null,
          width: kind === "area" ? target.height : null,
          quantity: 1,
          unit_code: ci.unit_code,
          rate,
          amount: Math.round(amount * 100) / 100,
          measurement_unit: unit,
          company_cost: ci.company_cost ?? null,
          vendor_cost: ci.vendor_cost ?? null,
          display_order: target.lines.size + lineRows.filter((l) => l.quotation_component_id === target.id).length,
          metadata: { follows_component: kind === "area" || kind === "length", scope_item_id: r.id },
        });
        target.lines.add(ci.id);
      }
      if (lineRows.length) {
        const { data: inserted, error } = await supabase.from("quotation_line_items").insert(lineRows).select("id");
        if (error) console.error("Error copying scope cost items:", error);
        else result.lines = inserted?.length ?? 0;
      }
    }

    return result;
  } catch (e) {
    console.error("copyScopeToQuotation failed", e);
    return empty;
  }
}
