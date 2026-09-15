import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Which playbook this kind of project should follow.
 *
 * A playbook marked auto_start says which projects it covers - a category,
 * or any. Until 2026-09-15 that started the run the moment the project was
 * created, so a won lead arrived with a plan nobody had looked at. Kick-off
 * is where the plan is decided now, so this only *suggests*: the kick-off
 * checklist pre-selects it and the project manager confirms or picks another.
 *
 * A playbook naming this category beats one that takes any, so a modular
 * project is offered the modular process rather than the general one.
 */
export async function suggestProjectPlaybook(
  supabase: SupabaseClient,
  args: { tenantId: string; projectCategory?: string | null }
): Promise<{ id: string; name: string; version: number } | null> {
  const { data: candidates, error } = await supabase
    .from("procedure_definitions")
    .select("id, name, version, auto_start_project_category")
    .eq("tenant_id", args.tenantId)
    .eq("applies_to", "project")
    .eq("auto_start", true)
    .eq("is_active", true)
    .eq("status", "committed");

  if (error || !candidates?.length) return null;

  const specific = candidates.find(
    (c) =>
      c.auto_start_project_category &&
      c.auto_start_project_category === args.projectCategory
  );
  const general = candidates.find((c) => !c.auto_start_project_category);
  const chosen = specific ?? general;
  return chosen ? { id: chosen.id, name: chosen.name, version: chosen.version } : null;
}
