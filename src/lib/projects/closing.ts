/**
 * What stops a project being called finished.
 *
 * The project's status was a free-text field on a PATCH: anything could set it
 * to "completed" with twenty playbook steps still open. The playbook then said
 * the work was half done while the project said it was over, and the honest
 * one was the playbook.
 *
 * This mirrors the rule leads already follow - winning a lead requires it to be
 * clear, and refuses with a 409 and the list of what is outstanding. The point
 * is not to make closing hard; it is that a project ends by dealing with the
 * remaining work, and "deal with" includes skipping it with a reason. A step
 * nobody can skip and nobody has done is genuinely not finished.
 *
 * Open playbook steps are what blocks. A project with no active run has no
 * plan and therefore nothing outstanding to close.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Statuses that mean a piece of work is finished with, one way or another. */
const SETTLED = new Set(["completed", "done", "skipped", "cancelled"]);

export interface ClosingBlocker {
  id: string;
  title: string;
  /** Where it came from, so the message can name the right screen. */
  kind: "playbook_step";
  status: string;
  /** False when the step must be completed rather than skipped. */
  canSkip: boolean;
}

export interface ClosingCheck {
  ok: boolean;
  blockers: ClosingBlocker[];
  /** The active run, when a playbook is driving. Completed alongside the project. */
  activeRunId: string | null;
}

/**
 * Everything still open on a project.
 *
 * Read-only. The caller decides what to do about it, which keeps this usable
 * for a warning on screen as well as a refusal in the API.
 */
export async function projectClosingBlockers(
  supabase: SupabaseClient,
  projectId: string
): Promise<ClosingCheck> {
  const blockers: ClosingBlocker[] = [];

  const { data: run } = await supabase
    .from("procedure_runs")
    .select("id")
    .eq("related_type", "project")
    .eq("related_id", projectId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (run) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, status, procedure_step_id")
      .eq("procedure_run_id", run.id);

    const open = (tasks ?? []).filter((t: any) => !SETTLED.has(t.status));

    // can_skip lives on the step definition, not the task, and it decides
    // whether "skip it" is even an option the person has.
    const stepIds = open
      .map((t: any) => t.procedure_step_id)
      .filter((v: string | null): v is string => !!v);

    const skippable = new Map<string, boolean>();
    if (stepIds.length) {
      const { data: steps } = await supabase
        .from("procedure_step_definitions")
        .select("id, can_skip")
        .in("id", stepIds);
      for (const s of steps ?? []) {
        skippable.set((s as any).id, (s as any).can_skip !== false);
      }
    }

    for (const task of open) {
      blockers.push({
        id: task.id,
        title: task.title,
        kind: "playbook_step",
        status: task.status,
        canSkip: task.procedure_step_id
          ? (skippable.get(task.procedure_step_id) ?? true)
          : true,
      });
    }

    return { ok: blockers.length === 0, blockers, activeRunId: run.id };
  }

  // No playbook, no plan: nothing stands in the way of closing.
  return { ok: blockers.length === 0, blockers, activeRunId: null };
}

/**
 * A sentence a person can act on, rather than a count.
 *
 * Names what is outstanding and separates the steps that can be skipped from
 * the ones that have to be done - those are different problems and lead to
 * different actions.
 */
export function describeBlockers(blockers: ClosingBlocker[]): string {
  const mustDo = blockers.filter((b) => !b.canSkip);
  const total = blockers.length;
  const noun = total === 1 ? "step is" : "steps are";
  const them = total === 1 ? "it" : "them";

  if (mustDo.length === 0) {
    return `${total} ${noun} still open. Complete or skip ${them}, then close the project.`;
  }

  const named = mustDo
    .slice(0, 3)
    .map((b) => `"${b.title}"`)
    .join(", ");
  const more = mustDo.length > 3 ? ` and ${mustDo.length - 3} more` : "";

  return `${total} ${noun} still open, and ${mustDo.length} cannot be skipped: ${named}${more}.`;
}
