import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Is the scope complete enough for the next stage of the sale?
 *
 * Two gates (decided 2026-09-18), each a list a person can read on the Scope
 * tab before trying the move, and the same list the transition refuses with:
 *
 *   requirement_discussion  floor plan · at least one space · a service wanted
 *   proposal_discussion     every space of ours has a rough size · at least
 *                           one component · a style · a finish
 *
 * Sizes need only be rough; confirming them is the site visit's job. Won adds
 * nothing - the quotation carried it.
 */

export type ScopeGate = "requirement_discussion" | "proposal_discussion";

export interface ScopeReadiness {
  requirement_discussion: { ok: boolean; missing: string[] };
  proposal_discussion: { ok: boolean; missing: string[] };
  facts: {
    floorPlans: number;
    spaces: number;
    spacesWithoutSize: string[];
    components: number;
    services: number;
    styles: number;
    finishes: number;
  };
}

export async function scopeReadiness(
  supabase: SupabaseClient,
  args: { propertyId: string; leadId?: string | null; projectId?: string | null },
): Promise<ScopeReadiness> {
  const { propertyId } = args;
  const docFilter = [
    args.leadId ? `and(linked_type.eq.lead,linked_id.eq.${args.leadId})` : null,
    args.projectId ? `and(linked_type.eq.project,linked_id.eq.${args.projectId})` : null,
  ].filter(Boolean) as string[];

  const [{ data: rows }, { data: brief }, docs] = await Promise.all([
    supabase
      .from("property_scope_items")
      .select("id, name, parent_id, component_type_id, scope_owner, length, width")
      .eq("property_id", propertyId),
    supabase.from("property_scope_brief").select("services_wanted, style_codes, preferred_finishes").eq("property_id", propertyId).maybeSingle(),
    docFilter.length
      ? supabase.from("documents").select("id", { count: "exact", head: true }).eq("category", "floor_plan").or(docFilter.join(","))
      : Promise.resolve({ count: 0 }),
  ]);

  const items = rows ?? [];
  const ours = (o: string | null) => !o || o === "us";
  const spaces = items.filter((r) => !r.component_type_id && !r.parent_id);
  const ourSpaces = spaces.filter((r) => ours(r.scope_owner));
  const components = items.filter((r) => r.component_type_id);
  const spacesWithoutSize = ourSpaces.filter((r) => !(Number(r.length) > 0 && Number(r.width) > 0)).map((r) => r.name);
  const facts = {
    floorPlans: (docs as { count: number | null }).count ?? 0,
    spaces: spaces.length,
    spacesWithoutSize,
    components: components.length,
    services: brief?.services_wanted?.length ?? 0,
    styles: brief?.style_codes?.length ?? 0,
    finishes: brief?.preferred_finishes?.length ?? 0,
  };

  const req: string[] = [];
  if (facts.floorPlans === 0) req.push("Upload the floor plan");
  if (facts.spaces === 0) req.push("List at least one space");
  if (facts.services === 0) req.push("Tick at least one service wanted");

  const prop: string[] = [...req];
  if (facts.spaces > 0 && spacesWithoutSize.length > 0) {
    prop.push(
      spacesWithoutSize.length <= 3
        ? `Give a rough size to ${spacesWithoutSize.join(", ")}`
        : `Give a rough size to ${spacesWithoutSize.length} spaces (${spacesWithoutSize.slice(0, 2).join(", ")}…)`,
    );
  }
  if (facts.components === 0) prop.push("Add at least one component to a space");
  if (facts.styles === 0) prop.push("Pick a style");
  if (facts.finishes === 0) prop.push("Pick a finish they lean to");

  return {
    requirement_discussion: { ok: req.length === 0, missing: req },
    proposal_discussion: { ok: prop.length === 0, missing: prop },
    facts,
  };
}
