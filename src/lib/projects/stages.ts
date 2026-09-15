/**
 * Where a project has actually got to.
 *
 * The header showed three dots — new, in progress, completed — which is the
 * record's status, not the work's. "In progress" covered everything between
 * the first drawing and the last snag, so the one question anyone asks walking
 * past a screen ("where is this?") had no answer on the page.
 *
 * A stage is a **top-level playbook step**. That is the whole point of
 * converging on the playbook engine: the stages of a project are not a fixed
 * list SoftInterio decides, they are whatever the tenant wrote down. An
 * interiors firm running the Modular Design playbook gets 2D Designs → 3D
 * Design → Client Selections → Procurement → Production → Installation →
 * Handover; an architect practice running theirs gets something else entirely,
 * with no code change.
 *
 * A project with no active run has no stages. The older native phase engine
 * used to answer here as a fallback; it was retired on 2026-09-15, so there is
 * one engine and one derivation.
 *
 * Nothing here writes. Stage is derived on read, every time — a stored
 * "current stage" column would be a second copy of a fact the tasks already
 * know, and it is always the copy that goes stale.
 */

/** Task statuses that mean the step is finished with, one way or another. */
const SETTLED = new Set(["completed", "done", "skipped", "cancelled"]);
/** …and those that mean it is genuinely under way. */
const ACTIVE = new Set(["in_progress", "review", "blocked", "on_hold"]);

export type StageStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "skipped"
  | "cancelled";

export interface ProjectStage {
  id: string;
  name: string;
  status: StageStatus;
  /** 0-100, from the stage's own children where it has them. */
  progress: number;
  /** How many child steps, and how many are settled. */
  stepCount: number;
  stepsDone: number;
}

export interface DerivedStages {
  stages: ProjectStage[];
  /** Index of the stage the project is on, or -1 when there are no stages. */
  currentIndex: number;
  /** Overall completion across every stage, 0-100. */
  progress: number;
  /** Whether a playbook answered, or there is nothing to derive from. */
  source: "playbook" | "none";
  /** The playbook's name and version, when one is driving. */
  playbook?: { name: string; version: number };
}

interface StageTask {
  id: string;
  title: string;
  status: string;
  parent_task_id: string | null;
  procedure_step_id: string | null;
}

function stageStatusOfTask(status: string): StageStatus {
  if (status === "cancelled") return "cancelled";
  if (status === "skipped") return "skipped";
  if (SETTLED.has(status)) return "completed";
  if (ACTIVE.has(status)) return "in_progress";
  return "not_started";
}

/**
 * The stage the project is on: the first one not yet settled.
 *
 * A stage genuinely under way wins over an earlier one that is merely not
 * started — real projects run ahead of themselves, and pointing at an untouched
 * first stage while the third is in flight would be worse than useless.
 */
function pickCurrent(stages: ProjectStage[]): number {
  if (!stages.length) return -1;

  const active = stages.findIndex((s) => s.status === "in_progress");
  if (active !== -1) return active;

  const unsettled = stages.findIndex(
    (s) => s.status !== "completed" && s.status !== "skipped" && s.status !== "cancelled"
  );
  // Everything settled means the last stage is where it ended.
  return unsettled === -1 ? stages.length - 1 : unsettled;
}

/** Completion across stages, counting a skipped stage as finished with. */
function overallProgress(stages: ProjectStage[]): number {
  const counted = stages.filter((s) => s.status !== "cancelled");
  if (!counted.length) return 0;
  const total = counted.reduce((n, s) => n + s.progress, 0);
  return Math.round(total / counted.length);
}

export interface DeriveFromPlaybookArgs {
  tasks: StageTask[];
  /** procedure_step_id -> display_order, so the playbook's own order wins. */
  stepOrder?: Map<string, number>;
  playbook?: { name: string; version: number };
}

/**
 * Stages from a run's top-level tasks.
 *
 * Ordering comes from the step definitions rather than task creation order,
 * matching playbookRunToPhases() — the Plan tab and this header must not
 * disagree about which stage is third.
 */
export function deriveStagesFromPlaybook({
  tasks,
  stepOrder,
  playbook,
}: DeriveFromPlaybookArgs): DerivedStages {
  const orderOf = (t: StageTask): number =>
    t.procedure_step_id
      ? (stepOrder?.get(t.procedure_step_id) ?? Number.MAX_SAFE_INTEGER)
      : Number.MAX_SAFE_INTEGER;

  const children = new Map<string, StageTask[]>();
  for (const task of tasks) {
    if (!task.parent_task_id) continue;
    const list = children.get(task.parent_task_id) ?? [];
    list.push(task);
    children.set(task.parent_task_id, list);
  }

  const stages: ProjectStage[] = tasks
    .filter((t) => !t.parent_task_id)
    .sort((a, b) => orderOf(a) - orderOf(b))
    .map((root) => {
      const kids = children.get(root.id) ?? [];
      const done = kids.filter((k) => SETTLED.has(k.status)).length;
      const status = stageStatusOfTask(root.status);

      // A stage with children reports their completion; one without is all or
      // nothing, because there is nothing finer to count.
      const progress = kids.length
        ? Math.round((done / kids.length) * 100)
        : status === "completed" || status === "skipped"
          ? 100
          : status === "in_progress"
            ? 50
            : 0;

      return {
        id: root.id,
        name: root.title,
        status,
        progress,
        stepCount: kids.length,
        stepsDone: done,
      };
    });

  return {
    stages,
    currentIndex: pickCurrent(stages),
    progress: overallProgress(stages),
    source: stages.length ? "playbook" : "none",
    playbook,
  };
}

export const EMPTY_STAGES: DerivedStages = {
  stages: [],
  currentIndex: -1,
  progress: 0,
  source: "none",
};
