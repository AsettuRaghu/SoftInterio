/**
 * Task Status Transition API
 * POST /api/tasks/[id]/transition
 *
 * The validated way to start / pause / block / resume / complete / cancel a task.
 * Delegates to the task_transition() DB function so that transition rules,
 * status history and work sessions are all enforced in one place regardless of
 * which client calls it.
 *
 * Prefer this over PATCHing tasks.status directly.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import type { TaskStatus, TaskTransitionResult } from "@/types/tasks";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "on_hold",
  "blocked",
  "completed",
  "cancelled",
];

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

    const body = await request.json();
    const status = body.status as TaskStatus;
    const reason: string | undefined = body.reason?.trim() || undefined;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // A reason is intentionally NOT required here. The compact row controls
    // pause in one click with nowhere to ask for one, and rejecting that made
    // the button silently fail. The full TaskStatusControls variant still
    // collects a reason via its modal before calling this.

    // Confirm the task is visible to this tenant before touching it. The RPC
    // runs as the caller, but this gives a proper 404 instead of a DB error.
    const { data: existingTask, error: fetchError } = await supabase
      .from("tasks")
      .select("id, title, status, related_type, related_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const { data, error } = await supabase.rpc("task_transition", {
      p_task_id: id,
      p_user_id: user.id,
      p_to: status,
      p_reason: reason ?? null,
    });

    if (error) {
      console.error("Error transitioning task:", error);
      return NextResponse.json(
        { error: "Failed to update task status" },
        { status: 500 }
      );
    }

    const result = data as TaskTransitionResult;

    // The RPC reports rule violations in its payload, not as a thrown error.
    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error || "Invalid status transition" },
        { status: 409 }
      );
    }

    // Mirror the change onto the linked entity's timeline, matching what the
    // existing PATCH handler does.
    if (existingTask.status !== status && existingTask.related_id) {
      const description = `Task "${existingTask.title}": status changed to ${status}${
        reason ? ` (${reason})` : ""
      }`;
      const title = status === "completed" ? "Task completed" : "Task updated";

      if (existingTask.related_type === "lead") {
        await supabase.from("lead_activities").insert({
          lead_id: existingTask.related_id,
          activity_type: "task_completed",
          title,
          description,
          created_by: user.id,
        });
      } else if (existingTask.related_type === "project") {
        await supabase.from("project_activities").insert({
          project_id: existingTask.related_id,
          activity_type: "task_completed",
          title,
          description,
          created_by: user.id,
        });
      }
    }

    // Return the live timing row so the caller can update in place.
    const { data: task } = await supabase
      .from("tasks_with_timing")
      .select("*")
      .eq("id", id)
      .single();

    return NextResponse.json({ success: true, task, transition: result });
  } catch (error) {
    console.error("Task transition API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
