"use client";

/**
 * The project's plan.
 *
 * This is the tasks table, scoped to the playbook run — not a second table.
 *
 * It used to be ManagementTab: 1,287 lines with its own StatusBadge, its own
 * start/pause/complete buttons, its own notes prompt and its own hand-drawn
 * assignee and date cells, sitting beside a tasks module that already had all
 * of it. Every bug reported here for a fortnight came from that split — a start
 * button on a completed row, Pause not appearing, a prompt demanding notes to
 * begin a step, statuses going stale, a refresh that blanked the page. Each was
 * fixed once in the tasks module and stayed broken here, or the reverse.
 *
 * A stage IS a task and a step IS its subtask, so there was never a second
 * thing to render. What the plan genuinely adds over the tasks list is two
 * columns — expected against logged hours, and progress — and those are now an
 * opt-in prop on the shared table rather than a reason to own a copy of it.
 *
 * ManagementTab survived for a while for projects on the older native phase
 * engine. That engine was retired on 2026-09-15; a playbook is the only plan.
 */

import React from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import TaskTableReusable, { type PlanGate } from "@/components/tasks/TaskTableReusable";
import type { Task } from "@/types/tasks";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

interface PlanTabProps {
  projectId: string;
  /** Every task on the project; the run's own are selected from these. */
  tasks: Task[];
  /** The active run, when a playbook is driving this project. */
  runId: string | null;
  /**
   * The run's stages in playbook order, each carrying its steps. Comes from the
   * plan API, which sorts on the step definitions' display_order.
   */
  orderedStages: { id: string; steps?: { id: string }[] }[];
  projectClosed?: boolean;
  teamMembers: TeamMember[];
  /**
   * What the server would accept on each row, read by the page together with
   * the tasks so buttons and rows change in the same render. Left out, the
   * tab reads them itself whenever the tasks change.
   */
  gates?: Record<string, PlanGate>;
  onRefresh: () => void;
  onTaskClick?: (task: Task) => void;
}

export function PlanTab({
  projectId,
  tasks,
  runId,
  orderedStages,
  projectClosed = false,
  teamMembers,
  gates: gatesProp,
  onRefresh,
  onTaskClick,
}: PlanTabProps) {
  const { user } = useCurrentUser();

  /**
   * What the server would accept on each row, re-read whenever the tasks do.
   * A Start the transition would refuse is drawn disabled with its reason on
   * the row - "Waiting for Layout Drawings to finish" - rather than turning
   * red after a click. One round trip for the whole plan.
   */
  const [ownGates, setOwnGates] = React.useState<Record<string, PlanGate>>({});
  const gates = gatesProp ?? ownGates;
  React.useEffect(() => {
    if (!runId || gatesProp) return;
    let alive = true;
    fetch(`/api/projects/${projectId}/plan-gates`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && j?.data?.gates && setOwnGates(j.data.gates))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [projectId, runId, tasks, gatesProp]);

  /**
   * The plan, in the playbook's own order, nested.
   *
   * Two things the table cannot work out for itself:
   *
   * 1. It renders whatever `externalTasks` holds as top-level rows. Handing it
   *    every task in the run put the steps alongside their stages as siblings.
   *    It wants PARENTS only, with their children on `subtasks`.
   *
   * 2. Its default order is by creation, and a playbook's tasks are created in
   *    whatever order the copy happened to insert them. The order that means
   *    something is the one written in the playbook, which `orderedStages`
   *    already carries - the plan API sorts by the step definitions'
   *    display_order.
   *
   * So the stage list drives both: which rows exist, and in what sequence.
   */
  const planRows = React.useMemo(() => {
    if (!runId || orderedStages.length === 0) return [];

    const byId = new Map(tasks.map((t) => [t.id, t]));
    const settled = ["completed", "skipped", "cancelled"];

    return orderedStages
      .map((stage) => {
        const parent = byId.get(stage.id);
        if (!parent) return null;

        const children = (stage.steps ?? [])
          .map((sub: { id: string }) => byId.get(sub.id))
          .filter(Boolean) as Task[];

        return {
          ...parent,
          subtasks: children,
          subtask_count: children.length,
          completed_subtask_count: children.filter((c) =>
            settled.includes((c as { status: string }).status)
          ).length,
        };
      })
      .filter(Boolean) as Task[];
  }, [tasks, runId, orderedStages]);

  if (!user) {
    return <div className="h-32 bg-slate-100 rounded-lg animate-pulse" />;
  }

  return (
    <TaskTableReusable
      relatedType="project"
      relatedId={projectId}
      currentUserId={user.id}
      externalTeamMembers={teamMembers.map((tm) => ({
        id: tm.id,
        full_name: tm.name,
        email: tm.email,
        avatar_url: tm.avatar_url,
      }))}
      // The plan is the whole plan: no "my tasks" split, no search chrome, and
      // no create button - a step comes from the playbook, not from this table.
      showHeader={false}
      compact
      showTabs={false}
      showCreateButton={false}
      showPlanColumns
      preserveOrder
      // A plan is read top to bottom; paging it into 25s would cut a stage off
      // from its own steps.
      initialPageSize={200}
      allowEdit={!projectClosed}
      readOnly={projectClosed}
      externalTasks={planRows as never[]}
      gates={gates}
      onTaskClick={(task) => onTaskClick?.(task as unknown as Task)}
      onRefresh={onRefresh}
    />
  );
}

export default PlanTab;
