import { createClient } from "@/lib/supabase/server";
import { calculateSqft, convertToFeet, getMeasurementInfo, type MeasurementUnit } from "@/components/quotations/types";
import { hasCosting, mergeMeasures, quantify, readCosting } from "@/lib/costing/component-costing";
import { shapeOptions } from "@/lib/scope/options";

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
 *
 * Options (2026-09-21):
 *  - `dryRun`     report what WOULD be added, by name, and write nothing -
 *                 the scope-drift notice on a quotation is this.
 *  - `preference` "p2" builds the alternative quotation: for each decision
 *                 the ② is taken where there is one, else the ①.
 *  - `pricedOn`   a variation: items already priced on those quotations
 *                 (the project's approved ones) count as present, and a
 *                 component or space created here that ends up carrying
 *                 nothing new is removed again - so the result is only what
 *                 has changed since sign-off.
 */

export interface ScopeCopyOptions {
  dryRun?: boolean;
  preference?: "p1" | "p2";
  pricedOn?: string[];
}

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
  measures: Record<string, number> | null;
  choice_quantity: number | null;
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
  /** What was (or, dry, would be) added, by name. */
  added: { spaces: string[]; components: string[]; lines: string[] };
}

const OURS = (owner: string | null | undefined) => !owner || owner === "us";

export async function copyScopeToQuotation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  quotationId: string,
  leadId: string | null,
  projectId: string | null,
  options: ScopeCopyOptions = {},
): Promise<ScopeCopyResult> {
  const empty: ScopeCopyResult = { spaces: 0, components: 0, lines: 0, skipped: 0, already: 0, added: { spaces: [], components: [], lines: [] } };
  const dry = !!options.dryRun;
  const preference = options.preference ?? "p1";

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

    // A variation counts what the named quotations already price as present:
    // "<scope component>::<cost item>" from their components' provenance.
    const pricedElsewhere = new Set<string>();
    if (options.pricedOn?.length) {
      const { data: others } = await supabase
        .from("quotation_components")
        .select("metadata, lines:quotation_line_items(quotation_cost_item_id), space:quotation_spaces!inner(quotation_id)")
        .in("space.quotation_id", options.pricedOn);
      for (const c of (others ?? []) as Array<{ metadata: { scope_item_id?: string } | null; lines: Array<{ quotation_cost_item_id: string | null }> | null }>) {
        const sid = c.metadata?.scope_item_id;
        if (!sid) continue;
        for (const l of c.lines ?? []) if (l.quotation_cost_item_id) pricedElsewhere.add(`${sid}::${l.quotation_cost_item_id}`);
      }
    }

    const spaceName = (id: string | null) => scope.find((x) => x.id === id)?.name ?? "";

    // What the quotation already holds, by provenance and by type+name.
    const spaceByScopeId = new Map<string, string>();
    const spaceByTypeName = new Map<string, string>();
    const compScopeIds = new Set<string>();
    const compByTypeName = new Set<string>();
    // Where each scope component already lives, with the cost items it holds.
    type Target = { id: string; width: number | null; height: number | null; unit: string; lines: Set<string>; componentTypeId: string | null; measures: Record<string, number> | null };
    const qcompByScopeId = new Map<string, Target>();
    const qcompByTypeName = new Map<string, Target>();
    let maxOrder = -1;
    for (const qs of (existingSpaces ?? []) as Array<{
      id: string; name: string; space_type_id: string | null; display_order: number | null;
      metadata: { scope_item_id?: string } | null;
      components: Array<{ id: string; name: string; component_type_id: string | null; width: number | null; height: number | null; metadata: { scope_item_id?: string; measurement_unit?: string; measures?: Record<string, number> } | null; lines: Array<{ quotation_cost_item_id: string | null }> | null }> | null;
    }>) {
      if (qs.metadata?.scope_item_id) spaceByScopeId.set(qs.metadata.scope_item_id, qs.id);
      spaceByTypeName.set(`${qs.space_type_id ?? ""}::${qs.name.trim().toLowerCase()}`, qs.id);
      maxOrder = Math.max(maxOrder, qs.display_order ?? 0);
      for (const c of qs.components ?? []) {
        const info: Target = { id: c.id, width: c.width, height: c.height, unit: c.metadata?.measurement_unit ?? "mm", lines: new Set((c.lines ?? []).map((l) => l.quotation_cost_item_id).filter(Boolean) as string[]), componentTypeId: c.component_type_id, measures: c.metadata?.measures ?? null };
        if (c.metadata?.scope_item_id) {
          compScopeIds.add(c.metadata.scope_item_id);
          qcompByScopeId.set(c.metadata.scope_item_id, info);
        }
        const key = `${qs.id}::${c.component_type_id ?? ""}::${c.name.trim().toLowerCase()}`;
        compByTypeName.add(key);
        qcompByTypeName.set(key, info);
      }
    }

    const result: ScopeCopyResult = { ...empty, added: { spaces: [], components: [], lines: [] } };
    const createdSpaces = new Set<string>();
    const createdComps = new Set<string>();
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

    if (toInsert.length && dry) {
      toInsert.forEach((r) => quotationSpaceByScopeId.set(r.id, `dry-${r.id}`));
      result.spaces = toInsert.length;
      result.added.spaces = toInsert.map((r) => r.name);
    } else if (toInsert.length) {
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
        if (inserted[i]) {
          quotationSpaceByScopeId.set(r.id, inserted[i].id);
          createdSpaces.add(inserted[i].id);
        }
      });
      result.spaces = inserted.length;
      result.added.spaces = toInsert.map((r) => r.name);
    }

    const compRows: Array<{ r: Row; spaceId: string }> = [];
    // Scope component id -> quotation component (existing or new) for the lines.
    const targetByScopeComp = new Map<string, Target>();
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

    if (compRows.length && dry) {
      compRows.forEach(({ r }) => targetByScopeComp.set(r.id, { id: `dry-${r.id}`, width: r.width, height: r.height ?? r.length, unit: r.measurement_unit ?? "mm", lines: new Set(), componentTypeId: r.component_type_id, measures: r.measures ?? null }));
      result.components = compRows.length;
      result.added.components = compRows.map(({ r }) => `${r.name} (${spaceName(r.parent_id)})`);
    } else if (compRows.length) {
      const { data: inserted, error } = await supabase
        .from("quotation_components")
        .insert(
          compRows.map(({ r, spaceId }, index) => ({
            quotation_id: quotationId,
            space_id: spaceId,
            component_type_id: r.component_type_id,
            name: r.name,
            width: r.width,
            // A component is width × height; rows older than the height
            // column being used on the list carried the height in `length`.
            height: r.height ?? r.length,
            display_order: index,
            // The builder reads the unit from metadata, and without it every
            // dimension would be read as millimetres.
            metadata: {
              measurement_unit: r.measurement_unit ?? undefined,
              scope_item_id: r.id,
              measurement_status: r.measurement_status,
              ...(r.measures ? { measures: r.measures } : {}),
            },
            subtotal: 0,
          })),
        )
        .select("id");
      if (error) console.error("Error copying scope components:", error);
      else {
        result.components = inserted?.length ?? 0;
        compRows.forEach(({ r }, i) => {
          if (inserted?.[i]) {
            targetByScopeComp.set(r.id, { id: inserted[i].id, width: r.width, height: r.height ?? r.length, unit: r.measurement_unit ?? "mm", lines: new Set(), componentTypeId: r.component_type_id, measures: r.measures ?? null });
            createdComps.add(inserted[i].id);
          }
        });
        result.added.components = compRows.map(({ r }) => `${r.name} (${spaceName(r.parent_id)})`);
      }
    }

    // The third level: first-preference cost items become line items, sized
    // from the component at the catalogue's rate. Second preferences and
    // items the client keeps stay behind. An AUTO item - the only item on
    // the offer that follows a rule quantity (Shelf per shelves) - is a
    // decision with one answer, so it is priced from the measurement without
    // having been tapped, and skipped when its quantity is 0.
    // The picked rows under components we can price. Resolved per decision
    // once the shapes are known: ① by default; for the alternative quotation
    // the ② where a decision has one, else its ①.
    const picked = scope.filter((r) => r.cost_item_id && (r.choice_status === "p1" || r.choice_status === "p2") && OURS(r.scope_owner) && r.parent_id && targetByScopeComp.has(r.parent_id));
    const typeIds = [...new Set([...targetByScopeComp.values()].map((t) => t.componentTypeId).filter(Boolean) as string[])];
    const [{ data: types }, { data: offerRows }] = await Promise.all([
      typeIds.length ? supabase.from("component_types").select("id, config_schema").in("id", typeIds) : Promise.resolve({ data: [] as { id: string; config_schema: unknown }[] }),
      typeIds.length
        ? supabase.from("component_type_offers").select("component_type_id, cost_item_id, quantity_key").in("component_type_id", typeIds)
        : Promise.resolve({ data: [] as { component_type_id: string; cost_item_id: string; quantity_key: string | null }[] }),
    ]);
    const ruleByType = new Map((types ?? []).map((t) => [t.id as string, readCosting(t.config_schema)]));
    // What each type offers, and what each item is priced per on it.
    const menuByType = new Map<string, { cost_item_id: string; quantity_key: string | null }[]>();
    for (const typeId of typeIds) {
      menuByType.set(typeId, (offerRows ?? []).filter((r) => r.component_type_id === typeId).map((r) => ({ cost_item_id: r.cost_item_id as string, quantity_key: (r.quantity_key as string | null) ?? null })));
    }
    const menuIds = [...new Set([...menuByType.values()].flat().map((l) => l.cost_item_id))];
    const wantedIds = [...new Set([...picked.map((r) => r.cost_item_id as string), ...menuIds])];
    if (wantedIds.length) {
      const { data: costItems } = await supabase.from("quotation_cost_items").select("id, name, unit_code, default_rate, company_cost, vendor_cost, category_id").in("id", wantedIds);
      const byId = new Map((costItems ?? []).map((c) => [c.id as string, c]));
      const shapesByType = new Map<string, ReturnType<typeof shapeOptions>>();
      for (const [typeId, lines] of menuByType) {
        const items = lines.map((l) => byId.get(l.cost_item_id)).filter(Boolean).map((c) => ({ id: c!.id as string, category_id: (c!.category_id as string | null) ?? null, unit_code: c!.unit_code as string }));
        shapesByType.set(typeId, shapeOptions(lines, items));
      }
      const keyFor = new Map<string, string>();
      for (const [typeId, lines] of menuByType) for (const l of lines) if (l.quantity_key) keyFor.set(`${typeId}::${l.cost_item_id}`, l.quantity_key);
      // One row per decision: among the picked rows of a component that share
      // a group, the ② when asked for and present, else the ①. Counted rows
      // (no group) come through on ① alone.
      const chosen: Row[] = [];
      const byComponent = new Map<string, Row[]>();
      for (const r of picked) byComponent.set(r.parent_id as string, [...(byComponent.get(r.parent_id as string) ?? []), r]);
      for (const [parentId, rows] of byComponent) {
        const typeId = scope.find((x) => x.id === parentId)?.component_type_id ?? null;
        const shapes = typeId ? shapesByType.get(typeId) : undefined;
        const groups = new Map<string, Row[]>();
        for (const r of rows) {
          const g = shapes?.get(r.cost_item_id as string)?.group_key ?? `row:${r.id}`;
          groups.set(g, [...(groups.get(g) ?? []), r]);
        }
        for (const rows2 of groups.values()) {
          const p1 = rows2.find((r) => r.choice_status === "p1");
          const p2 = rows2.find((r) => r.choice_status === "p2");
          const take = preference === "p2" ? p2 ?? p1 : p1;
          if (take) chosen.push(take);
        }
      }
      // Auto items on each component, unless a row already says something.
      const rowsFor = (parentId: string) => scope.filter((r) => r.parent_id === parentId && r.cost_item_id);
      const candidates: { id: string | null; parent_id: string; cost_item_id: string; choice_quantity: number | null }[] = chosen.map((r) => ({ id: r.id, parent_id: r.parent_id as string, cost_item_id: r.cost_item_id as string, choice_quantity: r.choice_quantity == null ? null : Number(r.choice_quantity) }));
      for (const r of scope) {
        if (!targetByScopeComp.has(r.id) || !OURS(r.scope_owner) || !r.component_type_id) continue;
        const shapes = shapesByType.get(r.component_type_id);
        if (!shapes) continue;
        const said = new Set(rowsFor(r.id).map((x) => x.cost_item_id as string));
        for (const [itemId, shape] of shapes) if (shape.auto && !said.has(itemId)) candidates.push({ id: null, parent_id: r.id, cost_item_id: itemId, choice_quantity: null });
      }
      const lineRows: Record<string, unknown>[] = [];
      for (const r of candidates) {
        const target = targetByScopeComp.get(r.parent_id)!;
        const ci = byId.get(r.cost_item_id as string);
        if (!ci || target.lines.has(ci.id) || pricedElsewhere.has(`${r.parent_id}::${ci.id}`)) {
          if (ci) result.already += 1;
          continue;
        }
        const unit = (target.unit || "mm") as MeasurementUnit;
        const kind = getMeasurementInfo(ci.unit_code).type;
        const rate = Number(ci.default_rate) || 0;
        // Priced per one of the tenant's quantities when the type has a rule
        // and the template says which; else the builder's own arithmetic on
        // the component's one face.
        const rule = target.componentTypeId ? ruleByType.get(target.componentTypeId) : undefined;
        const quantityKey = target.componentTypeId ? keyFor.get(`${target.componentTypeId}::${ci.id}`) ?? null : null;
        const ruled = !!(rule && hasCosting(rule) && quantityKey && rule.quantities.some((q) => q.key === quantityKey));
        const derived = ruled ? quantify(rule!, mergeMeasures(target), unit).values[quantityKey!] ?? 0 : null;
        // An auto item with nothing to measure against is not a line.
        if (r.id === null && !(derived && derived > 0)) continue;
        // A per-piece item carries how many were chosen (two wooden drawers).
        const count = kind === "quantity" ? Number(r.choice_quantity) || 1 : 1;
        const amount = ruled
          ? (derived ?? 0) * rate
          : kind === "area" ? calculateSqft(target.width, target.height, unit) * rate
          : kind === "length" ? convertToFeet(target.width || 0, unit) * rate
          : kind === "fixed" ? rate
          : count * rate;
        lineRows.push({
          quotation_id: quotationId,
          quotation_component_id: target.id,
          quotation_cost_item_id: ci.id,
          name: ci.name,
          length: !ruled && (kind === "area" || kind === "length") ? target.width : null,
          width: !ruled && kind === "area" ? target.height : null,
          quantity: ruled ? Math.round((derived ?? 0) * 100) / 100 : count,
          unit_code: ci.unit_code,
          rate,
          amount: Math.round(amount * 100) / 100,
          measurement_unit: unit,
          company_cost: ci.company_cost ?? null,
          vendor_cost: ci.vendor_cost ?? null,
          display_order: target.lines.size + lineRows.filter((l) => l.quotation_component_id === target.id).length,
          metadata: { follows_component: !ruled && (kind === "area" || kind === "length"), scope_item_id: r.id ?? undefined, auto: r.id === null || undefined, quantity_key: ruled ? quantityKey : null },
        });
        target.lines.add(ci.id);
        result.added.lines.push(`${ci.name} (${scope.find((x) => x.id === r.parent_id)?.name ?? ""})`);
      }
      if (dry) {
        result.lines = lineRows.length;
      } else if (lineRows.length) {
        const { data: inserted, error } = await supabase.from("quotation_line_items").insert(lineRows).select("id");
        if (error) console.error("Error copying scope cost items:", error);
        else result.lines = inserted?.length ?? 0;
      }
    }

    // A variation carries only what changed: a component or space made here
    // that ended up holding nothing new goes again.
    if (options.pricedOn?.length && !dry) {
      const carrying = new Set([...targetByScopeComp.values()].filter((t) => t.lines.size > 0).map((t) => t.id));
      const emptyComps = [...createdComps].filter((id) => !carrying.has(id));
      if (emptyComps.length) await supabase.from("quotation_components").delete().in("id", emptyComps);
      result.components -= emptyComps.length;
      if (createdSpaces.size) {
        const { data: left } = await supabase.from("quotation_components").select("space_id").in("space_id", [...createdSpaces]);
        const busy = new Set((left ?? []).map((c) => c.space_id as string));
        const emptySpaces = [...createdSpaces].filter((id) => !busy.has(id));
        if (emptySpaces.length) await supabase.from("quotation_spaces").delete().in("id", emptySpaces);
        result.spaces -= emptySpaces.length;
      }
    }

    return result;
  } catch (e) {
    console.error("copyScopeToQuotation failed", e);
    return empty;
  }
}
