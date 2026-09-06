import { createClient } from "@/lib/supabase/server";

/** Statuses that mean a task still needs someone to do something. */
export const OPEN_TASK_STATUSES = ["todo", "in_progress", "on_hold"] as const;

export interface PendingWork {
  tasks: Array<{ id: string; title: string; status: string; due_date?: string | null }>;
  followUps: Array<{ id: string; content: string; follow_up_at: string }>;
}

/**
 * What is still outstanding on a lead: open tasks, and follow-ups nobody has
 * marked dealt with.
 *
 * Tasks hang off a lead through related_type/related_id rather than a lead_id
 * column - worth knowing, because other tables in this schema do have a
 * lead_id and a query written from memory finds nothing.
 */
export async function getPendingLeadWork(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string
): Promise<PendingWork> {
  const [{ data: tasks }, { data: notes }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status, due_date")
      .eq("related_type", "lead")
      .eq("related_id", leadId)
      .in("status", OPEN_TASK_STATUSES as unknown as string[])
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("lead_notes")
      .select("id, content, follow_up_at")
      .eq("lead_id", leadId)
      .not("follow_up_at", "is", null)
      .is("follow_up_done_at", null)
      .order("follow_up_at", { ascending: true }),
  ]);

  return {
    tasks: tasks || [],
    followUps: (notes || []) as PendingWork["followUps"],
  };
}

/**
 * Closes everything outstanding on a lead that is going nowhere.
 *
 * A lost or disqualified lead's tasks are not "still to do" - nobody is going
 * to write that proposal - but deleting them would erase that they existed.
 * Cancelling with a reason keeps the history and takes them off everyone's
 * list, which is the whole point of doing it here rather than leaving them to
 * rot as permanently overdue.
 */
export async function cancelPendingLeadWork(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  userId: string,
  reason: string
): Promise<{ tasks: number; followUps: number }> {
  const pending = await getPendingLeadWork(supabase, leadId);

  if (pending.tasks.length > 0) {
    await supabase
      .from("tasks")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
        hold_reason: reason,
      })
      .in("id", pending.tasks.map((t) => t.id));
  }

  if (pending.followUps.length > 0) {
    // Marked done rather than cleared: the follow-up stopped mattering, and
    // wiping the date would lose that it was ever scheduled.
    await supabase
      .from("lead_notes")
      .update({
        follow_up_done_at: new Date().toISOString(),
        follow_up_done_by: userId,
      })
      .in("id", pending.followUps.map((n) => n.id));
  }

  return { tasks: pending.tasks.length, followUps: pending.followUps.length };
}
