import type { SupabaseClient } from "@supabase/supabase-js";
import { missingMeasures, rulesByType } from "./measured";

/**
 * Is the scope complete enough for the next stage of the sale?
 *
 * Decided 2026-09-18 (third round):
 *   qualified                floor plan · configuration (checked by the
 *                            transition; the scope is laid down from the
 *                            matching preset when the lead qualifies)
 *   requirement_discussion   at least one space
 *   proposal_discussion      every space of ours has a rough size and at
 *                            least one component - no empty rooms; a room
 *                            with nothing of ours is marked client/excluded
 *                            - and every component of ours whose type has a
 *                            costing rule has that rule's measurements
 *                            (2026-09-22): without them the quotation prices
 *                            hinges, corners and internals at nothing
 *
 * Sizes need only be rough; confirming them is the site visit's job.
 */

export interface ScopeReadiness {
  requirement_discussion: { ok: boolean; missing: string[] };
  proposal_discussion: { ok: boolean; missing: string[] };
  facts: { floorPlans: number; configuration: string | null; spaces: number; spacesWithoutSize: string[]; emptySpaces: string[]; components: number; unmeasured: { id: string; name: string; missing: string[] }[] };
}

export async function scopeReadiness(
  supabase: SupabaseClient,
  args: { propertyId: string; leadId?: string | null; projectId?: string | null },
): Promise<ScopeReadiness> {
  const docFilter = [
    args.leadId ? `and(linked_type.eq.lead,linked_id.eq.${args.leadId})` : null,
    args.projectId ? `and(linked_type.eq.project,linked_id.eq.${args.projectId})` : null,
  ].filter(Boolean) as string[];

  const [{ data: rows }, { data: property }, docs, { data: types }] = await Promise.all([
    supabase.from("property_scope_items").select("id, name, parent_id, component_type_id, scope_owner, length, width, height, measures").eq("property_id", args.propertyId),
    supabase.from("properties").select("configuration").eq("id", args.propertyId).maybeSingle(),
    docFilter.length
      ? supabase.from("documents").select("id", { count: "exact", head: true }).eq("category", "floor_plan").or(docFilter.join(","))
      : Promise.resolve({ count: 0 }),
    supabase.from("component_types").select("id, config_schema"),
  ]);

  const items = rows ?? [];
  const ours = (o: string | null) => !o || o === "us";
  const spaces = items.filter((r) => !r.component_type_id && !r.parent_id);
  const ourSpaces = spaces.filter((r) => ours(r.scope_owner));
  const components = items.filter((r) => r.component_type_id);
  const spacesWithoutSize = ourSpaces.filter((r) => !(Number(r.length) > 0 && Number(r.width) > 0)).map((r) => r.name);
  const emptySpaces = ourSpaces.filter((r) => !components.some((c) => c.parent_id === r.id && ours(c.scope_owner))).map((r) => r.name);
  const rules = rulesByType(types ?? []);
  const unmeasured = components
    .filter((c) => ours(c.scope_owner))
    .map((c) => ({ id: c.id as string, name: c.name as string, missing: missingMeasures(c, rules.get(c.component_type_id as string)) }))
    .filter((c) => c.missing.length > 0);
  const facts = {
    floorPlans: (docs as { count: number | null }).count ?? 0,
    configuration: property?.configuration ?? null,
    spaces: spaces.length,
    spacesWithoutSize,
    emptySpaces,
    components: components.length,
    unmeasured,
  };

  const few = (names: string[], what = "spaces") => (names.length <= 3 ? names.join(", ") : `${names.length} ${what} (${names.slice(0, 2).join(", ")}…)`);
  const req: string[] = [];
  if (facts.floorPlans === 0) req.push("Upload the floor plan");
  if (!facts.configuration) req.push("Set the configuration (2 BHK, 3 BHK…)");
  if (facts.spaces === 0) req.push("List at least one space");

  const prop: string[] = [...req];
  if (spacesWithoutSize.length) prop.push(`Give a rough size to ${few(spacesWithoutSize)}`);
  if (emptySpaces.length) prop.push(`Add components to ${few(emptySpaces)}, or mark them as the client's / excluded`);
  if (unmeasured.length)
    prop.push(
      `Measure ${few(unmeasured.map((c) => c.name), "components")} - ${unmeasured.length === 1 ? "it needs" : "they need"} ${[...new Set(unmeasured.flatMap((c) => c.missing))].slice(0, 4).join(", ")}`,
    );

  return {
    requirement_discussion: { ok: req.length === 0, missing: req },
    proposal_discussion: { ok: prop.length === 0, missing: prop },
    facts,
  };
}
