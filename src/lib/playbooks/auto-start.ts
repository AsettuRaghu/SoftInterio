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

    // The project now has a playbook, so the native phases created moments
    // ago by initialize_project_phases describe the same work a second time.
    // They are invisible while the run is active - the Plan tab prefers the
    // run - and reappear the moment it is cancelled, which is what once read
    // as "it shows a completely different playbook I'm not aware of".
    await discardUntouchedPhases(supabase, projectId, log);

    return { started: true, playbookId: chosen.id, runId };
  } catch (err) {
    log?.warn("Auto-start threw", { projectId, error: String(err) });
    return { started: false };
  }
}


/**
 * Remove native phases for a project that has just adopted a playbook.
 *
 * Only when **nothing has happened on them**: every phase not_started and
 * every sub-phase untouched. That is the honest test of "this is scaffolding
 * nobody has used", and it is true at auto-start because the rows are seconds
 * old. A project with real progress on its phases keeps them, playbook or not
 * - deleting somebody's recorded work to tidy up a data model would be a far
 * worse bug than the duplication it fixes.
 *
 * Quiet on failure, like everything else here: a leftover phase row is a
 * cosmetic problem, a failed conversion is not.
 */
async function discardUntouchedPhases(
  supabase: SupabaseClient,
  projectId: string,
  log?: RequestLogger
): Promise<void> {
  try {
    const { data: phases } = await supabase
      .from("project_phases")
      .select("id, status")
      .eq("project_id", projectId);

    if (!phases?.length) return;

    if (phases.some((p) => p.status !== "not_started")) {
      log?.info("Kept native phases: work has already been recorded on them", {
        projectId,
      });
      return;
    }

    const phaseIds = phases.map((p) => p.id);

    const { data: subPhases } = await supabase
      .from("project_sub_phases")
      .select("id, status")
      .in("project_phase_id", phaseIds);

    if (subPhases?.some((s) => s.status !== "not_started")) {
      log?.info("Kept native phases: a sub-phase has been started", { projectId });
      return;
    }

    // A milestone pointing at a phase would be orphaned by this, so leave the
    // phases alone rather than break the payment schedule.
    const { count: milestones } = await supabase
      .from("project_payment_milestones")
      .select("*", { count: "exact", head: true })
      .in("linked_phase_id", phaseIds);

    if (milestones && milestones > 0) {
      log?.info("Kept native phases: payment milestones are linked to them", {
        projectId,
      });
      return;
    }

    await supabase.from("project_sub_phases").delete().in("project_phase_id", phaseIds);
    await supabase.from("project_phases").delete().eq("project_id", projectId);

    log?.info("Discarded unused native phases in favour of the playbook", {
      projectId,
      phases: phaseIds.length,
    });
  } catch (err) {
    log?.warn("Could not tidy native phases after auto-start", {
      projectId,
      error: String(err),
    });
  }
}
