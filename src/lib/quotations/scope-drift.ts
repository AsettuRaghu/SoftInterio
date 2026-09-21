import type { createClient } from "@/lib/supabase/server";
import { mergeMeasures } from "@/lib/costing/component-costing";
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
 *   dropped     lines the quotation holds whose scope row is no longer a
 *               first preference, or is gone
 *   not_ours    components the quotation prices whose scope row now says
 *               the client or a vendor does it
 *   last_change when the scope last changed, from its history
 *
 * Nothing here decides anything; the person holding the quotation does -
 * bring the additions in, revise, or leave it.
 */
export interface ScopeDrift {
  additions: { spaces: string[]; components: string[]; lines: string[] };
  resized: { component: string; space: string; from: string; to: string }[];
  dropped: { line: string; component: string }[];
  not_ours: { component: string; owner: string }[];
  last_change: string | null;
  total: number;
  /** Second preferences on the scope's components - what an "Option 2" quotation would use. */
  second_preferences: number;
}

export async function scopeDrift(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  quotationId: string,
  leadId: string | null,
  projectId: string | null,
): Promise<ScopeDrift> {
  const none: ScopeDrift = { additions: { spaces: [], components: [], lines: [] }, resized: [], dropped: [], not_ours: [], last_change: null, total: 0, second_preferences: 0 };

  let propertyId: string | null = null;
  if (leadId) propertyId = (await supabase.from("leads").select("property_id").eq("id", leadId).maybeSingle()).data?.property_id ?? null;
  else if (projectId) propertyId = (await supabase.from("projects").select("property_id").eq("id", projectId).maybeSingle()).data?.property_id ?? null;
  if (!propertyId) return none;

  const [dry, { data: scopeRaw }, { data: spaces }, { data: hist }] = await Promise.all([
    copyScopeToQuotation(supabase, tenantId, quotationId, leadId, projectId, { dryRun: true }),
    supabase.from("property_scope_items").select("id, parent_id, name, scope_owner, choice_status, cost_item_id, width, height, length, measures, measurement_unit").eq("property_id", propertyId).eq("tenant_id", tenantId),
    supabase
      .from("quotation_spaces")
      .select("id, name, components:quotation_components(id, name, width, height, metadata, lines:quotation_line_items(name, quotation_cost_item_id, metadata))")
      .eq("quotation_id", quotationId),
    supabase.from("property_scope_item_history").select("changed_at").eq("property_id", propertyId).order("changed_at", { ascending: false }).limit(1),
  ]);

  type S = { id: string; parent_id: string | null; name: string; scope_owner: string | null; choice_status: string | null; cost_item_id: string | null; width: number | null; height: number | null; length: number | null; measures: Record<string, number> | null; measurement_unit: string | null };
  const scope = new Map(((scopeRaw ?? []) as S[]).map((r) => [r.id, r]));
  const OWNER: Record<string, string> = { client: "the client", vendor: "a vendor", excluded: "nobody - not in scope" };

  const out: ScopeDrift = {
    ...none,
    additions: dry.added,
    last_change: hist?.[0]?.changed_at ?? null,
    second_preferences: [...scope.values()].filter((r) => r.cost_item_id && r.choice_status === "p2" && (!r.scope_owner || r.scope_owner === "us")).length,
  };
  const fmt = (v: number | null | undefined) => (v == null ? "—" : String(Math.round(Number(v) * 100) / 100));

  for (const sp of (spaces ?? []) as Array<{ id: string; name: string; components: Array<{ id: string; name: string; width: number | null; height: number | null; metadata: { scope_item_id?: string; measurement_unit?: string; measures?: Record<string, number> } | null; lines: Array<{ name: string; quotation_cost_item_id: string | null; metadata: { scope_item_id?: string; auto?: boolean } | null }> | null }> | null }>) {
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
          const describe = (m: Record<string, number>) => keys.map((k) => `${k} ${fmt(m[k])}`).join(", ") + (unit ? ` ${unit}` : "");
          out.resized.push({ component: c.name, space: sp.name, from: describe(qm), to: describe(sm) });
        }
      }
      for (const l of c.lines ?? []) {
        const lsid = l.metadata?.scope_item_id;
        if (!lsid || l.metadata?.auto) continue;
        const lrow = scope.get(lsid);
        if (!lrow || lrow.choice_status !== "p1") out.dropped.push({ line: l.name, component: `${c.name} (${sp.name})` });
      }
    }
  }
  out.total = out.additions.spaces.length + out.additions.components.length + out.additions.lines.length + out.resized.length + out.dropped.length + out.not_ours.length;
  return out;
}
