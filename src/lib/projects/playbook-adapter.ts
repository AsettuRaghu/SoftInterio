import type {
  ProjectPhase,
  ProjectSubPhase,
  ProjectPhaseStatus,
  ProjectSubPhaseStatus,
} from "@/types/projects";

/**
 * Renders a playbook run as a phase tree.
 *
 * SoftInterio grew two engines for the same idea. The phase engine has
 * templates, sub-phases, statuses and requirements; the playbook engine has
 * definitions, steps, runs and the same eight action types, spelled
 * identically. The difference is that the playbook engine nests, versions,
 * targets a vertical through tenant_type, and executes as ordinary tasks -
 * and it is the one carrying the real 25-step Modular Design process.
 *
 * This adapter is the evidence for converging on it. A run's parent tasks
 * become phases and its child tasks become sub-phases, which is enough for the
 * existing phase tree to draw a playbook without knowing it is looking at one.
 * If that renders, the tree is a view and not an engine, and the second engine
 * can go.
 *
 * Nothing is written. This only reshapes rows that already exist.
 */

/** The task columns the mapping needs. */
export interface PlaybookTask {
  id: string;
  title: string;
  status: string;
  parent_task_id: string | null;
  procedure_step_id: string | null;
  /** When the work is planned to begin. Distinct from started_at. */
  start_date?: string | null;
  due_date?: string | null;
  assigned_to?: string | null;
  /** When it actually began. Set by the transition, not by the planner. */
  started_at?: string | null;
  /** Expected effort, written into the playbook. */
  estimated_hours?: number | null;
  /** Effort actually logged. The pair is how overruns become visible. */
  actual_hours?: number | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PlaybookUser {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

/**
 * Task and phase vocabularies are nearly the same already - further evidence
 * these are one concept. Only the ends differ: a task starts at "todo" where a
 * phase starts at "not_started", and a sub-phase has no "blocked" or
 * "cancelled" to map onto.
 */
function toPhaseStatus(taskStatus: string): ProjectPhaseStatus {
  switch (taskStatus) {
    case "todo":
      return "not_started";
    case "skipped":
      // A phase cannot be skipped, and a skipped step is done being worked on.
      return "completed";
    case "in_progress":
    case "on_hold":
    case "completed":
    case "cancelled":
    case "blocked":
      return taskStatus as ProjectPhaseStatus;
    default:
      return "not_started";
  }
}

function toSubPhaseStatus(taskStatus: string): ProjectSubPhaseStatus {
  switch (taskStatus) {
    case "todo":
      return "not_started";
    case "blocked":
      // No blocked state here; a blocked step is not being worked on.
      return "on_hold";
    case "cancelled":
      return "skipped";
    case "in_progress":
    case "on_hold":
    case "completed":
    case "skipped":
      return taskStatus as ProjectSubPhaseStatus;
    default:
      return "not_started";
  }
}

const COUNTS_AS_DONE = new Set(["completed", "skipped", "cancelled"]);

/** A phase's effort is its own plus its steps'. Undefined when nothing has any. */
function sumHours(
  root: PlaybookTask,
  children: PlaybookTask[],
  field: "estimated_hours" | "actual_hours"
): number | undefined {
  const values = [root, ...children]
    .map((t) => t[field])
    .filter((v): v is number => typeof v === "number");
  if (values.length === 0) return undefined;
  return Math.round(values.reduce((a, b) => a + b, 0) * 10) / 10;
}

export interface PlaybookToPhasesArgs {
  projectId: string;
  tasks: PlaybookTask[];
  /** procedure_step_id -> display_order, so the playbook's own order wins. */
  stepOrder?: Map<string, number>;
  /** user id -> user, for the assignee avatars the tree draws. */
  users?: Map<string, PlaybookUser>;
}

export function playbookRunToPhases({
  projectId,
  tasks,
  stepOrder,
  users,
}: PlaybookToPhasesArgs): ProjectPhase[] {
  const orderOf = (t: PlaybookTask): number => {
    if (!t.procedure_step_id) return 0;
    return stepOrder?.get(t.procedure_step_id) ?? 0;
  };

  const byParent = new Map<string, PlaybookTask[]>();
  for (const task of tasks) {
    if (!task.parent_task_id) continue;
    const siblings = byParent.get(task.parent_task_id) ?? [];
    siblings.push(task);
    byParent.set(task.parent_task_id, siblings);
  }

  const roots = tasks
    .filter((t) => !t.parent_task_id)
    .sort((a, b) => orderOf(a) - orderOf(b));

  return roots.map((root, index) => {
    const children = (byParent.get(root.id) ?? []).sort(
      (a, b) => orderOf(a) - orderOf(b)
    );

    const subPhases: ProjectSubPhase[] = children.map((child, childIndex) => ({
      id: child.id,
      project_phase_id: root.id,
      name: child.title,
      status: toSubPhaseStatus(child.status),
      progress_percentage: COUNTS_AS_DONE.has(child.status) ? 100 : 0,
      progress_mode: "manual",
      assigned_to: child.assigned_to ?? undefined,
      display_order: childIndex,
      estimated_hours: child.estimated_hours ?? undefined,
      actual_hours: child.actual_hours ?? undefined,
      planned_start_date: child.start_date ?? undefined,
      planned_end_date: child.due_date ?? undefined,
      due_date: child.due_date ?? undefined,
      actual_start_date: child.started_at ?? undefined,
      actual_end_date: child.completed_at ?? undefined,
      completed_at: child.completed_at ?? undefined,
      created_at: child.created_at ?? new Date().toISOString(),
      updated_at: child.updated_at ?? new Date().toISOString(),
      is_enabled: true,
      can_remove: false,
      is_custom: false,
      assigned_user: child.assigned_to
        ? users?.get(child.assigned_to)
        : undefined,
    }));

    // A phase with steps reports how many are done. A phase with none falls
    // back to its own state, which is how a single-step stage behaves.
    const done = children.filter((c) => COUNTS_AS_DONE.has(c.status)).length;
    const progress = children.length
      ? Math.round((done / children.length) * 100)
      : COUNTS_AS_DONE.has(root.status)
        ? 100
        : 0;

    return {
      id: root.id,
      project_id: projectId,
      name: root.title,
      status: toPhaseStatus(root.status),
      progress_percentage: progress,
      progress_mode: "auto",
      assigned_to: root.assigned_to ?? undefined,
      display_order: index,
      // start_date is the plan; started_at is what happened. Reading only the
      // second made a planned start look as though saving had erased it.
      // A parent's own hours plus everything under it, so a phase reports the
      // effort of the work it contains rather than of its header row.
      estimated_hours: sumHours(root, children, "estimated_hours"),
      actual_hours: sumHours(root, children, "actual_hours"),
      planned_start_date: root.start_date ?? undefined,
      planned_end_date: root.due_date ?? undefined,
      actual_start_date: root.started_at ?? undefined,
      actual_end_date: root.completed_at ?? undefined,
      created_at: root.created_at ?? new Date().toISOString(),
      updated_at: root.updated_at ?? new Date().toISOString(),
      is_enabled: true,
      can_remove: false,
      is_custom: false,
      assigned_user: root.assigned_to ? users?.get(root.assigned_to) : undefined,
      sub_phases: subPhases,
    };
  });
}

/**
 * The mapping above, run backwards.
 *
 * The Plan tab edits what it is shown. When what it is shown came from a
 * playbook, the node is a task and the edit has to land on the task - the
 * phase routes look up phase rows and answer "Not found" for a task id.
 */
export function toTaskStatus(status: string): string {
  switch (status) {
    case "not_started":
      return "todo";
    case "in_progress":
    case "on_hold":
    case "completed":
    case "skipped":
    case "cancelled":
    case "blocked":
      return status;
    default:
      return "todo";
  }
}

/** What the Plan tab can change on a node, in task vocabulary. */
export interface PlaybookNodeUpdate {
  status?: string;
  start_date?: string | null;
  due_date?: string | null;
  assigned_to?: string | null;
  /**
   * Why the status changed. The task PATCH hands this to task_transition,
   * which records it against the transition - so the note the user is asked
   * for is kept rather than collected and dropped.
   */
  hold_reason?: string;
}

/**
 * Translates a phase-shaped edit into a task-shaped one. Only the fields the
 * task API actually accepts are carried; a phase edit form offers a few things
 * a task has no home for, and silently dropping them here is better than
 * sending fields that would be ignored anyway.
 */
export function phaseEditToTaskUpdate(edit: {
  status?: string;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  due_date?: string | null;
  assigned_to?: string | null;
  notes?: string | null;
  status_change_notes?: string | null;
}): PlaybookNodeUpdate {
  const update: PlaybookNodeUpdate = {};
  if (edit.status) update.status = toTaskStatus(edit.status);
  if (edit.planned_start_date !== undefined)
    update.start_date = edit.planned_start_date || null;
  const end = edit.planned_end_date ?? edit.due_date;
  if (end !== undefined) update.due_date = end || null;
  if (edit.assigned_to !== undefined)
    update.assigned_to = edit.assigned_to || null;
  const reason = edit.status_change_notes ?? edit.notes;
  if (reason) update.hold_reason = reason;
  return update;
}
