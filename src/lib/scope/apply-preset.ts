import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScopePreset } from "@/types/property-scope";
import { presetMatches, type Configuration } from "./configuration";
import { getDefaultMeasurementUnit } from "@/lib/settings/measurement-unit";

/**
 * Lays a preset down on an empty scope: its spaces with counts, each filled
 * with the components the preset names, or - when it names none - those
 * that declare they belong in that space type. Used when a lead is
 * qualified, so the requirement discussion opens on rooms rather than a
 * blank list. Does nothing on a scope that already has rows.
 *
 * `reason` says why nothing happened, because the two cases read very
 * differently to a seller: a scope that already has rows is correct and
 * silent, while NO PRESET MATCHING the configuration leaves them staring at
 * a blank Requirement discussion. The match is by name (`presetMatches`), so
 * renaming "3 BHK" is enough to cause it - and `other` matches nothing by
 * design. The transition reports it (2026-09-23).
 */
export interface ScopePresetOutcome {
  applied: string | null;
  spaces: number;
  components: number;
  reason: "applied" | "scope_not_empty" | "no_preset";
}

export async function applyPresetForConfiguration(
  supabase: SupabaseClient,
  args: { tenantId: string; userId: string; propertyId: string; configuration: Configuration; propertyType?: string | null },
): Promise<ScopePresetOutcome> {
  const none = (reason: ScopePresetOutcome["reason"]): ScopePresetOutcome => ({ applied: null, spaces: 0, components: 0, reason });
  const { count } = await supabase.from("property_scope_items").select("id", { count: "exact", head: true }).eq("property_id", args.propertyId);
  if ((count ?? 0) > 0) return none("scope_not_empty");

  const { data: presets } = await supabase.from("scope_presets").select("*").eq("tenant_id", args.tenantId).eq("is_active", true).order("display_order");
  const preset = ((presets ?? []) as ScopePreset[]).find((p) => presetMatches(p.name, args.configuration, args.propertyType));
  if (!preset || preset.items.length === 0) return none("no_preset");

  const spaceTypeIds = [...new Set(preset.items.map((i) => i.space_type_id))];
  const [{ data: spaceTypes }, { data: componentTypes }] = await Promise.all([
    supabase.from("space_types").select("id, name").in("id", spaceTypeIds).eq("tenant_id", args.tenantId),
    supabase.from("component_types").select("id, name, applicable_space_types").eq("tenant_id", args.tenantId).eq("is_active", true),
  ]);
  const spaceName = new Map((spaceTypes ?? []).map((t) => [t.id, t.name as string]));
  const comps = (componentTypes ?? []) as { id: string; name: string; applicable_space_types: string[] | null }[];
  const compById = new Map(comps.map((c) => [c.id, c]));

  const unit = await getDefaultMeasurementUnit(supabase, args.tenantId);
  let order = 0;
  const spaceRows: Record<string, unknown>[] = [];
  const plan: { spaceIndex: number; componentTypeIds: string[] }[] = [];
  for (const item of preset.items) {
    const name = spaceName.get(item.space_type_id);
    if (!name) continue;
    const ids =
      item.component_type_ids ??
      comps.filter((c) => (c.applicable_space_types ?? []).includes(item.space_type_id)).map((c) => c.id);
    for (let i = 0; i < item.count; i++) {
      plan.push({ spaceIndex: spaceRows.length, componentTypeIds: ids });
      spaceRows.push({
        tenant_id: args.tenantId,
        property_id: args.propertyId,
        space_type_id: item.space_type_id,
        name: item.count === 1 ? name : `${name} ${i + 1}`,
        display_order: order++,
        measurement_unit: unit,
        created_by: args.userId,
      });
    }
  }
  if (spaceRows.length === 0) return none("no_preset");

  const { data: spaces, error } = await supabase.from("property_scope_items").insert(spaceRows).select("id");
  if (error || !spaces) {
    console.error("[scope] preset spaces failed", error?.message);
    return none("no_preset");
  }

  const compRows: Record<string, unknown>[] = [];
  for (const p of plan) {
    const space = spaces[p.spaceIndex];
    if (!space) continue;
    for (const cid of p.componentTypeIds) {
      const c = compById.get(cid);
      if (!c) continue;
      compRows.push({
        tenant_id: args.tenantId,
        property_id: args.propertyId,
        parent_id: space.id,
        component_type_id: cid,
        name: c.name,
        display_order: order++,
        measurement_unit: unit,
        created_by: args.userId,
      });
    }
  }
  if (compRows.length) {
    const { error: e2 } = await supabase.from("property_scope_items").insert(compRows);
    if (e2) console.error("[scope] preset components failed", e2.message);
  }
  return { applied: preset.name, spaces: spaces.length, components: compRows.length, reason: "applied" };
}
