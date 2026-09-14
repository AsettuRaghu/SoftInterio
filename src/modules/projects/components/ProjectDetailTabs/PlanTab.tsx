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
 * A phase IS a task and a step IS its subtask, so there was never a second
 * thing to render. What the plan genuinely adds over the tasks list is two
 * columns — expected against logged hours, and progress — and those are now an
 * opt-in prop on the shared table rather than a reason to own a copy of it.
 *
 * Projects still on the older native phase engine keep ManagementTab; those
 * rows are genuinely not tasks.
 */

import React from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import TaskTableReusable from "@/components/tasks/TaskTableReusable";
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
  projectClosed?: boolean;
  teamMembers: TeamMember[];
  onRefresh: () => void;
  onTaskClick?: (task: Task) => void;
}

export function PlanTab({
  projectId,
  tasks,
  runId,
  projectClosed = false,
  teamMembers,
  onRefresh,
  onTaskClick,
}: PlanTabProps) {
  const { user } = useCurrentUser();

  /**
   * Only the plan's own tasks.
   *
   * A project carries ad-hoc tasks alongside its playbook; the Tasks tab shows
   * both, the plan shows the governed process. Subtasks come with their parent,
   * so filtering on the parents is enough.
   */
  const planTasks = React.useMemo(() => {
    if (!runId) return [];
    return tasks.filter(
      (t) => (t as { procedure_run_id?: string | null }).procedure_run_id === runId
    );
  }, [tasks, runId]);

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
      allowEdit={!projectClosed}
      readOnly={projectClosed}
      externalTasks={planTasks as never[]}
      onTaskClick={(task) => onTaskClick?.(task as unknown as Task)}
      onRefresh={onRefresh}
    />
  );
}

export default PlanTab;
