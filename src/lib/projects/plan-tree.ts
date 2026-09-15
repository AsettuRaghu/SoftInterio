/**
 * A playbook run, nested in the playbook's own order.
 *
 * A stage is a top-level task of the run; its steps are the tasks whose
 * parent_task_id is that stage. Both are ordinary tasks - this only reshapes
 * rows the Plan tab already has, so the table can render parents in the
 * sequence the playbook wrote them rather than the sequence the copy happened
 * to insert them.
 *
 * This replaced `playbook-adapter.ts`, which dressed a run up as the older
 * native phase tree so `ManagementTab` could draw it. That engine is gone;
 * the Plan tab is the tasks table and wants ids and order, nothing more.
 *
 * Nothing is written.
 */

/** The task columns the mapping needs. */
export interface PlanTask {
  id: string;
  title: string;
  status: string;
  parent_task_id: string | null;
  procedure_step_id: string | null;
}

export interface PlanStep {
  id: string;
  name: string;
  status: string;
}

export interface PlanStage {
  id: string;
  name: string;
  status: string;
  /** Settled steps over all steps, 0-100. A stage with no steps reports its own state. */
  progress: number;
  steps: PlanStep[];
}

const SETTLED = new Set(["completed", "skipped", "cancelled"]);

export function playbookRunToStages(
  tasks: PlanTask[],
  /** procedure_step_id -> display_order, so the playbook's own order wins. */
  stepOrder?: Map<string, number>
): PlanStage[] {
  // A task whose step is no longer in the playbook (cancelled by a commit)
  // sorts last, not first: 0 put such rows at the top of every stage.
  const orderOf = (t: PlanTask): number =>
    t.procedure_step_id ? (stepOrder?.get(t.procedure_step_id) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;

  // A step the playbook no longer has, cancelled by the commit that removed
  // it, is history rather than plan: it has no date, gates nothing and would
  // only sit in its old stage as a struck-through line.
  const live = tasks.filter(
    (t) => !(t.status === "cancelled" && t.procedure_step_id && stepOrder && !stepOrder.has(t.procedure_step_id))
  );

  const byParent = new Map<string, PlanTask[]>();
  for (const task of live) {
    if (!task.parent_task_id) continue;
    const siblings = byParent.get(task.parent_task_id) ?? [];
    siblings.push(task);
    byParent.set(task.parent_task_id, siblings);
  }

  return live
    .filter((t) => !t.parent_task_id)
    .sort((a, b) => orderOf(a) - orderOf(b))
    .map((root) => {
      const children = (byParent.get(root.id) ?? []).sort(
        (a, b) => orderOf(a) - orderOf(b)
      );
      const done = children.filter((c) => SETTLED.has(c.status)).length;
      return {
        id: root.id,
        name: root.title,
        status: root.status,
        progress: children.length
          ? Math.round((done / children.length) * 100)
          : SETTLED.has(root.status)
            ? 100
            : 0,
        steps: children.map((c) => ({ id: c.id, name: c.title, status: c.status })),
      };
    });
}
