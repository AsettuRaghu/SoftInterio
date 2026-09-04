/**
 * Task Timing API
 * GET /api/tasks/[id]/timing
 *
 * Returns the two event logs behind a task's numbers:
 *   - status_history: elapsed time, i.e. how long it sat in each status
 *   - work_sessions:  effort, i.e. who actually worked on it and for how long
 *
 * Plus a per-status and per-user rollup so callers don't re-aggregate.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import type {
  TaskStatus,
  TaskStatusHistoryEntry,
  TaskWorkSession,
} from "@/types/tasks";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id } = await params;
    const supabase = await createClient();

    // The view carries the live counters (running session / current hold).
    const { data: task, error: taskError } = await supabase
      .from("tasks_with_timing")
      .select("*")
      .eq("id", id)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const [{ data: history }, { data: sessions }] = await Promise.all([
      supabase
        .from("task_status_history")
        .select("*, changed_by_user:users!task_status_history_changed_by_fkey(id, name, avatar_url)")
        .eq("task_id", id)
        .order("changed_at", { ascending: true }),
      supabase
        .from("task_work_sessions")
        .select("*, user:users!task_work_sessions_user_id_fkey(id, name, avatar_url)")
        .eq("task_id", id)
        .order("started_at", { ascending: true }),
    ]);

    const statusHistory = (history || []) as (TaskStatusHistoryEntry & {
      changed_by_user?: { id: string; name: string; avatar_url?: string };
    })[];
    const workSessions = (sessions || []) as (TaskWorkSession & {
      user?: { id: string; name: string; avatar_url?: string };
    })[];

    // Time spent in each status. duration_seconds on a history row describes
    // the status being LEFT, so it accumulates against from_status.
    const timeInStatus: Partial<Record<TaskStatus, number>> = {};
    for (const entry of statusHistory) {
      if (!entry.from_status) continue;
      timeInStatus[entry.from_status] =
        (timeInStatus[entry.from_status] || 0) + (entry.duration_seconds || 0);
    }

    // Effort split by person, so "who actually did this" is answerable.
    const effortByUser: Record<
      string,
      { user_id: string; name: string; avatar_url?: string; seconds: number }
    > = {};
    for (const session of workSessions) {
      const userId = session.user_id;
      if (!userId) continue;
      if (!effortByUser[userId]) {
        effortByUser[userId] = {
          user_id: userId,
          name: session.user?.name || "Unknown",
          avatar_url: session.user?.avatar_url,
          seconds: 0,
        };
      }
      effortByUser[userId].seconds += session.duration_seconds || 0;
    }

    return NextResponse.json({
      task,
      summary: {
        live_active_seconds: task.live_active_seconds ?? 0,
        live_held_seconds: task.live_held_seconds ?? 0,
        is_clock_running: task.is_clock_running ?? false,
        lead_time_seconds: task.lead_time_seconds ?? null,
        cycle_time_seconds: task.cycle_time_seconds ?? null,
        estimated_hours: task.estimated_hours ?? null,
        time_in_status: timeInStatus,
        effort_by_user: Object.values(effortByUser).sort(
          (a, b) => b.seconds - a.seconds
        ),
      },
      status_history: statusHistory,
      work_sessions: workSessions,
    });
  } catch (error) {
    console.error("Task timing API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
