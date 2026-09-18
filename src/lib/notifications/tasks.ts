/**
 * Task events, shared by the task PATCH and the transition route so the
 * same change tells the same people whichever door it came through.
 *
 *   assigned   -> the new assignee            "Raghu assigned you 'Site measurement'"
 *   completed  -> the creator (not the doer)  "Priya completed 'Site measurement'"
 *   reopened   -> the assignee (not the doer) "Raghu reopened 'Site measurement'"
 *
 * The actor is never told; notify() removes them.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { namesOf, notify } from "./notify";

export interface TaskForNotice {
  id: string;
  title: string;
  assigned_to: string | null;
  created_by: string | null;
}

export async function notifyTaskChange(
  supabase: SupabaseClient,
  args: {
    tenantId: string;
    actor: string;
    task: TaskForNotice;
    assignedTo?: { from: string | null; to: string | null };
    status?: { from: string; to: string };
  },
): Promise<void> {
  const { tenantId, actor, task } = args;
  const nameOf = await namesOf(supabase, [actor]);
  const who = nameOf(actor);
  const url = `/dashboard/tasks/${task.id}`;

  if (args.assignedTo && args.assignedTo.to && args.assignedTo.to !== args.assignedTo.from) {
    await notify(supabase, {
      tenantId,
      to: [args.assignedTo.to],
      actor,
      kind: "task_assigned",
      title: "New task for you",
      message: `${who} assigned you "${task.title}"`,
      entity: { type: "task", id: task.id },
      actionUrl: url,
    });
  }

  if (args.status && args.status.to !== args.status.from) {
    const { from, to } = args.status;
    if (to === "completed") {
      await notify(supabase, {
        tenantId,
        to: [task.created_by],
        actor,
        kind: "task_completed",
        title: "Task completed",
        message: `${who} completed "${task.title}"`,
        entity: { type: "task", id: task.id },
        actionUrl: url,
      });
    } else if (["completed", "cancelled", "skipped"].includes(from)) {
      // Coming back out of a settled state is a reopen, whatever it is called.
      await notify(supabase, {
        tenantId,
        to: [task.assigned_to],
        actor,
        kind: "task_reopened",
        title: "Task reopened",
        message: `${who} reopened "${task.title}"`,
        entity: { type: "task", id: task.id },
        actionUrl: url,
        priority: "high",
      });
    }
  }
}
