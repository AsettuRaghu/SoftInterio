import type { createClient } from "@/lib/supabase/server";
import { mergeMeasures, readCosting } from "@/lib/costing/component-costing";
import { copyScopeToQuotation } from "./scope-to-quotation";

/**
 * How far the scope has moved from a quotation - read, never applied.
 *
 * A quotation is a commercial document and does not follow the room list;
 * that rule stands. What was missing was anyone HEARING that the room list
 * had moved: the customer added a tall unit at the site visit and the
 * seller holding the sent quotation had no way to know. This answers, for
 * one quotation:
 *
 *   additions   what "Bring in from scope" would add right now (a dry run
 *               of the copy) - rooms, components, chosen items
 *   resized     components the quotation holds whose scope row now has a
 *               different size or measurement
 *   dropped     lines the quotation holds whose scope row is no longer
 *               chosen, or is gone
 *   not_ours    components the quotation prices whose scope row now says
 *               the client or a vendor does it
 *   not_in_scope  lines priced here that the Scope Sheet does not list -
 *               somebody added them in the builder. The other direction,
 *               and the one that was missing: a quotation may be ahead of
 *               the scope as easily as behind it (2026-09-22)
 *   last_change when the scope last changed, from its history
 *
 * It compares against the answers on the Scope Sheet. The one quotation ever
 * built from the retired second preferences is compared the same way - its
 * lines were chosen once, and reporting them all as drifted would be true
 * and useless.
 *
 * Nothing here decides anything; the person holding the quotation does -
 * bring the additions in, revise, or leave it.
 */
export interface ScopeDrift {
  additions: { spaces: string[]; components: string[]; lines: string[] };
  resized: { component: string; space: string; from: string; to: string }[];
  dropped: { line: string; component: string }[];
  not_ours: { component: string; owner: string }[];
  /** Priced here, not on the Scope Sheet - with what it would take to add it back. */
  /**
   * A line priced here that the Scope Sheet does not list.
   *
   * `scope_item_id` is the COMPONENT's scope row, and it is null for a whole
   * component added in the builder - which is the common case, because adding a
   * Study Table in the editor creates no scope row for it. `space_scope_id` is
   * then what makes the line placeable: "Add to the Scope Sheet" can create the
   * component under that space and hang the items off it. With neither there is
   * nowhere to put it and a person has to decide.
   */
  not_in_scope: {
    line: string;
    component: string;
    cost_item_id: string | null;
    /** The component's own scope row, when it has one. */
    scope_item_id: string | null;
    /** The quotation component, so the builder can offer this on the thing itself. */
    component_id: string | null;
    component_name: string | null;
    component_type_id: string | null;
    /** The space's scope row, so a missing component can be created under it. */
    space_scope_id: string | null;
  }[];
  last_change: string | null;
  total: number;
}

export async function scopeDrift(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  quotationId: string,
  leadId: string | null,
  projectId: string | null,
): Promise<ScopeDrift> {
  const none: ScopeDrift = { additions: { spaces: [], components: [], lines: [] }, resized: [], dropped: [], not_ours: [], not_in_scope: [], last_change: null, total: 0 };

  let propertyId: string | null = null;
  if (leadId) propertyId = (await supabase.from("leads").select("property_id").eq("id", leadId).maybeSingle()).data?.property_id ?? null;
  else if (projectId) propertyId = (await supabase.from("projects").select("property_id").eq("id", projectId).maybeSingle()).data?.property_id ?? null;
  if (!propertyId) return none;

  const [dry, { data: scopeRaw }, { data: spaces, error: spacesError }, { data: hist }, { data: autoOffers }, { data: types }] = await Promise.all([
    copyScopeToQuotation(supabase, tenantId, quotationId, leadId, projectId, { dryRun: true }),
    supabase.from("property_scope_items").select("id, parent_id, name, scope_owner, choice_status, cost_item_id, width, height, length, measures, measurement_unit").eq("property_id", propertyId).eq("tenant_id", tenantId),
    supabase
      .from("quotation_spaces")
      // No `measurement_unit` column on quotation_components - the unit lives in
      // `metadata.measurement_unit`. Naming it here cost an hour: the select
      // failed, `spaces` came back null, the loop never ran and the whole notice
      // silently reported no drift at all.
      .select("id, name, metadata, components:quotation_components(id, name, component_type_id, width, height, metadata, lines:quotation_line_items(id, name, quotation_cost_item_id, metadata))")
      .eq("quotation_id", quotationId),
    supabase.from("property_scope_item_history").select("changed_at").eq("property_id", propertyId).order("changed_at", { ascending: false }).limit(1),
    supabase.from("component_type_offers").select("component_type_id, cost_item_id").eq("auto", true).eq("tenant_id", tenantId),
    supabase.from("component_types").select("id, config_schema").eq("tenant_id", tenantId),
  ]);
  /**
   * **Do not swallow this one.** Every read here destructures `data` alone, and
   * when the spaces select named a column that does not exist the result was a
   * notice confidently reporting NO drift - the worst possible failure for a
   * thing whose entire job is to report a difference. A quotation with nothing
   * to say and a quotation that could not be read must not look the same.
   */
  if (spacesError) {
    console.error("[scope-drift] could not read the quotation's spaces", spacesError.message);
    throw new Error(`Could not read the quotation for drift: ${spacesError.message}`);
  }

  // An automatic item is priced by the rule without anyone tapping, so it is
  // never "added in the builder" even though no scope row names it.
  const autoFor = new Set(((autoOffers ?? []) as { component_type_id: string; cost_item_id: string }[]).map((o) => `${o.component_type_id}::${o.cost_item_id}`));
  // A count is a number; only a length carries the row's unit.
  const lengthKeys = new Map<string, Set<string>>();
  for (const t of (types ?? []) as { id: string; config_schema: unknown }[]) {
    const fields = readCosting(t.config_schema).fields;
    lengthKeys.set(t.id, new Set(fields.filter((f) => f.kind === "length").map((f) => f.key)));
  }

  type S = { id: string; parent_id: string | null; name: string; scope_owner: string | null; choice_status: string | null; cost_item_id: string | null; width: number | null; height: number | null; length: number | null; measures: Record<string, number> | null; measurement_unit: string | null };
  const scope = new Map(((scopeRaw ?? []) as S[]).map((r) => [r.id, r]));
  const OWNER: Record<string, string> = { client: "the client", vendor: "a vendor", excluded: "nobody - not in scope" };

  const out: ScopeDrift = {
    ...none,
    additions: dry.added,
    last_change: hist?.[0]?.changed_at ?? null,
  };
  const fmt = (v: number | null | undefined) => (v == null ? "—" : String(Math.round(Number(v) * 100) / 100));

  for (const sp of (spaces ?? []) as Array<{ id: string; name: string; metadata: { scope_item_id?: string } | null; components: Array<{ id: string; name: string; component_type_id: string | null; width: number | null; height: number | null; metadata: { scope_item_id?: string; measurement_unit?: string; measures?: Record<string, number> } | null; lines: Array<{ name: string; quotation_cost_item_id: string | null; metadata: { scope_item_id?: string; auto?: boolean } | null }> | null }> | null }>) {
    for (const c of sp.components ?? []) {
      const sid = c.metadata?.scope_item_id;
      const row = sid ? scope.get(sid) : undefined;
      if (row) {
        if (row.scope_owner && row.scope_owner !== "us") out.not_ours.push({ component: `${c.name} (${sp.name})`, owner: OWNER[row.scope_owner] ?? row.scope_owner });
        // Size: the quotation's own width × height against the scope's, and
        // the rule's other measures against what the quotation stored.
        const qm = mergeMeasures({ width: c.width, height: c.height, measures: c.metadata?.measures ?? null });
        const sm = mergeMeasures({ width: row.width, height: row.height ?? row.length, measures: row.measures ?? null });
        const keys = [...new Set([...Object.keys(qm), ...Object.keys(sm)])].filter((k) => (qm[k] ?? 0) !== (sm[k] ?? 0));
        if (keys.length) {
          const unit = row.measurement_unit ?? c.metadata?.measurement_unit ?? "";
          const lens = lengthKeys.get(c.component_type_id ?? "") ?? new Set(["width", "height", "length"]);
          const label = (k: string) => (lens.has(k) || ["width", "height", "length"].includes(k) ? `${k} in ${unit || "the row's unit"}` : k);
          const describe = (m: Record<string, number>) => keys.map((k) => `${label(k)} ${fmt(m[k])}`).join(", ");
          out.resized.push({ component: c.name, space: sp.name, from: describe(qm), to: describe(sm) });
        }
      }
      // What the component's Scope Sheet says it carries, so a line with no
      // provenance can still be recognised by its cost item.
      const chosen = new Set(
        [...scope.values()].filter((x) => x.parent_id === sid && x.cost_item_id && x.choice_status === "p1").map((x) => x.cost_item_id as string),
      );
      for (const l of c.lines ?? []) {
        const lsid = l.metadata?.scope_item_id;
        if (l.metadata?.auto) continue;
        if (!lsid) {
          // Added in the builder: the quotation is ahead of the scope.
          const isAuto = !!c.component_type_id && !!l.quotation_cost_item_id && autoFor.has(`${c.component_type_id}::${l.quotation_cost_item_id}`);
          if (!isAuto && (!l.quotation_cost_item_id || !chosen.has(l.quotation_cost_item_id))) {
            out.not_in_scope.push({
              line: l.name,
              component: `${c.name} (${sp.name})`,
              cost_item_id: l.quotation_cost_item_id ?? null,
              scope_item_id: sid ?? null,
              component_id: c.id,
              component_name: c.name,
              component_type_id: c.component_type_id ?? null,
              space_scope_id: sp.metadata?.scope_item_id ?? null,
            });
          }
          continue;
        }
        /**
         * **The row id is a hint; the cost item is the answer.**
         *
         * `metadata.scope_item_id` points at the `property_scope_items` ROW the
         * line came from, and that row does not survive being re-chosen: one
         * answer per question is kept by deleting whatever else answered it, so
         * clearing a carcass and picking the same one again produces a NEW row
         * with a new id. Every quotation line pointing at the old id then read
         * as "no longer chosen" while the Scope Sheet said exactly what it had
         * always said.
         *
         * Found on QT-20260924-001 (2026-09-24): its Master Bedroom wardrobe
         * reported "Carcass - Standard no longer chosen", and the scope had
         * Carcass - Standard chosen all along - on a row created an hour after
         * the quotation, the original having been deleted by the trigger.
         *
         * **Retiring the second preference is what exposed this.** Until
         * 2026-09-24 a displaced answer was demoted to `p2`, so the row survived
         * with its id and a re-choice left the pointer intact. Deleting it
         * instead is right, and it means nothing may depend on a scope row's
         * identity outliving a change of mind.
         *
         * So a line is dropped only when the scope no longer chooses that cost
         * item on that component. A genuine change - Standard swapped for
         * Premium - still reports, because Standard leaves `chosen`.
         */
        const lrow = scope.get(lsid);
        const stillChosen =
          lrow?.choice_status === "p1" ||
          (!!l.quotation_cost_item_id && chosen.has(l.quotation_cost_item_id));
        if (!stillChosen) out.dropped.push({ line: l.name, component: `${c.name} (${sp.name})` });
      }
    }
  }
  out.total = out.additions.spaces.length + out.additions.components.length + out.additions.lines.length + out.resized.length + out.dropped.length + out.not_ours.length + out.not_in_scope.length;
  return out;
}
