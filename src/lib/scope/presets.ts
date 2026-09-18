import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScopePresetItem } from "@/types/property-scope";

/**
 * Validates a preset's items against the tenant's own space and component
 * types, so a preset can never name a type from another business or one that
 * has been deleted. Counts are clamped to 1..20; an empty preset is refused.
 */
export async function cleanPresetItems(
  supabase: SupabaseClient,
  tenantId: string,
  raw: unknown,
): Promise<{ ok: true; items: ScopePresetItem[] } | { ok: false; error: string }> {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "A preset needs at least one space" };
  const items: ScopePresetItem[] = raw
    .map((r) => ({
      space_type_id: String((r as { space_type_id?: unknown })?.space_type_id ?? ""),
      count: Math.max(1, Math.min(20, Number((r as { count?: unknown })?.count) || 1)),
      component_type_ids: Array.isArray((r as { component_type_ids?: unknown })?.component_type_ids)
        ? ((r as { component_type_ids: unknown[] }).component_type_ids.map(String))
        : null,
    }))
    .filter((r) => r.space_type_id);
  if (items.length === 0) return { ok: false, error: "A preset needs at least one space" };

  const spaceIds = [...new Set(items.map((i) => i.space_type_id))];
  const compIds = [...new Set(items.flatMap((i) => i.component_type_ids ?? []))];
  const [{ data: spaces }, { data: comps }] = await Promise.all([
    supabase.from("space_types").select("id").in("id", spaceIds).eq("tenant_id", tenantId),
    compIds.length
      ? supabase.from("component_types").select("id").in("id", compIds).eq("tenant_id", tenantId)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  if ((spaces ?? []).length !== spaceIds.length) return { ok: false, error: "A space type is not available" };
  if ((comps ?? []).length !== compIds.length) return { ok: false, error: "A component type is not available" };
  return { ok: true, items };
}
