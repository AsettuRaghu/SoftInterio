import type { SupabaseClient } from "@supabase/supabase-js";
import type { RequestLogger } from "@/lib/logger/request";

/**
 * Start whichever playbook this project is for.
 *
 * Configuring a process once only pays off if nobody has to remember to apply
 * it. A playbook marked auto_start says which projects it covers - a category,
 * or any - and this is what makes the project pick it up.
 *
 * Deliberately quiet about failure. A project that exists without its playbook
 * is recoverable in a click; a conversion that rolls back because a playbook
 * was misconfigured is not.
 */
export async function autoStartProjectPlaybook(
  supabase: SupabaseClient,
  args: {
    tenantId: string;
    projectId: string;
    projectCategory?: string | null;
    userId: string;
    log?: RequestLogger;
  }
): Promise<{ started: boolean; playbookId?: string; runId?: string }> {
  const { tenantId, projectId, projectCategory, userId, log } = args;

  try {
    // A playbook naming this category beats one that takes any, so a modular
    // project gets the modular process rather than the general one.
    const { data: candidates, error } = await supabase
      .from("procedure_definitions")
      .select("id, name, auto_start_project_category")
      .eq("tenant_id", tenantId)
      .eq("applies_to", "project")
      .eq("auto_start", true)
      .eq("is_active", true);

    if (error) {
      log?.warn("Could not look up auto-start playbooks", {
        error: error.message,
      });
      return { started: false };
    }
    if (!candidates || candidates.length === 0) return { started: false };

    const specific = candidates.find(
      (c) =>
        c.auto_start_project_category &&
        c.auto_start_project_category === projectCategory
    );
    const general = candidates.find((c) => !c.auto_start_project_category);
    const chosen = specific ?? general;
    if (!chosen) return { started: false };

    // Never start a second copy of the same process on one project.
    const { data: existing } = await supabase
      .from("procedure_runs")
      .select("id")
      .eq("related_type", "project")
      .eq("related_id", projectId)
      .eq("definition_id", chosen.id)
      .maybeSingle();

    if (existing) return { started: false };

    const { data, error: runError } = await supabase.rpc(
      "start_procedure_run",
      {
        p_definition_id: chosen.id,
        p_related_type: "project",
        p_related_id: projectId,
        p_user_id: userId,
      }
    );

    if (runError) {
      log?.warn("Auto-start failed", {
        projectId,
        playbookId: chosen.id,
        error: runError.message,
      });
      return { started: false };
    }

    const runId = (data as { run_id?: string })?.run_id;
    log?.info("Playbook auto-started", {
      projectId,
      playbook: chosen.name,
      runId,
    });
    return { started: true, playbookId: chosen.id, runId };
  } catch (err) {
    log?.warn("Auto-start threw", { projectId, error: String(err) });
    return { started: false };
  }
}
