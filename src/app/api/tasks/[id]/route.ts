import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import {
  logLeadActivity,
  logProjectActivity,
  describeChanges,
} from "@/lib/activity/log";

/** Task fields whose edits are worth naming on the parent timeline. */
const TASK_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  priority: "Priority",
  due_date: "Due date",
  description: "Description",
};
import type { UpdateTaskInput } from "@/types/tasks";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/tasks/[id] - Get single task with all related data
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

    // Get task with user joins
    const { data: rawTask, error: taskError } = await supabase
      .from("tasks")
      .select(
        `
        *,
        assigned_user:users!tasks_assigned_to_fkey(id, name, email, avatar_url),
        created_by_user:users!tasks_created_by_fkey(id, name, email),
        completed_by_user:users!tasks_completed_by_fkey(id, name),
        template:task_templates(id, name, category)
      `
      )
      .eq("id", id)
      .single();

    if (taskError) {
      if (taskError.code === "PGRST116") {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }
      console.error("Error fetching task:", taskError);
      return NextResponse.json(
        { error: "Failed to fetch task", details: taskError.message },
        { status: 500 }
      );
    }

    // Live timing (running session / current hold) lives on the view, which
    // has no FK metadata for PostgREST embedding - so fetch it alongside
    // rather than joining. Settled totals are already on the base row.
    const { data: timing } = await supabase
      .from("tasks_with_timing")
      .select(
        "live_active_seconds, live_held_seconds, is_clock_running, lead_time_seconds, cycle_time_seconds, start_count, resume_count, original_lead_time_seconds, is_rework, open_subtask_count"
      )
      .eq("id", id)
      .single();

    // Transform to expected format
    const task = {
      ...rawTask,
      ...(timing || {}),
      assigned_to_name: rawTask.assigned_user?.name || null,
      assigned_to_email: rawTask.assigned_user?.email || null,
      assigned_to_avatar: rawTask.assigned_user?.avatar_url || null,
      created_by_name: rawTask.created_by_user?.name || null,
      created_by_email: rawTask.created_by_user?.email || null,
      completed_by_name: rawTask.completed_by_user?.name || null,
      template_name: rawTask.template?.name || null,
      template_category: rawTask.template?.category || null,
    };

    // Fetch related data in parallel
    const [
      { data: subtasksRaw },
      { data: comments },
      { data: attachments },
      { data: activities },
      { data: tagAssignments },
    ] = await Promise.all([
      // Subtasks
      supabase
        .from("tasks")
        .select(
          `
          *,
          assigned_user:users!tasks_assigned_to_fkey(id, name, email, avatar_url)
        `
        )
        .eq("parent_task_id", id)
        .order("created_at", { ascending: true }),
      // Comments
      supabase
        .from("task_comments")
        .select(
          `
          *,
          created_user:users!task_comments_created_by_fkey(id, name, avatar_url)
        `
        )
        .eq("task_id", id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true }),
      // Attachments
      supabase
        .from("documents")
        .select(
          `
          *,
          uploaded_user:users!documents_uploaded_by_fkey(id, name, avatar_url)
        `
        )
        .eq("linked_type", "task")
        .eq("linked_id", id)
        .eq("is_latest", true)
        .order("created_at", { ascending: false }),
      // Activities
      supabase
        .from("task_activities")
        .select(
          `
          *,
          created_user:users(id, name, avatar_url)
        `
        )
        .eq("task_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      // Tags
      supabase
        .from("task_tag_assignments")
        .select(
          `
          tag:task_tags(id, name, color)
        `
        )
        .eq("task_id", id),
    ]);

    // Transform subtasks
    const subtasks = (subtasksRaw || []).map((st) => ({
      ...st,
      assigned_to_name: st.assigned_user?.name || null,
      assigned_to_email: st.assigned_user?.email || null,
      assigned_to_avatar: st.assigned_user?.avatar_url || null,
      subtask_count: 0,
      completed_subtask_count: 0,
    }));

    // Get related entity name if applicable
    let relatedName = null;
    if (task.related_type && task.related_id) {
      switch (task.related_type) {
        case "lead":
          const { data: lead } = await supabase
            .from("leads")
            .select("lead_number, client:clients(name)")
            .eq("id", task.related_id)
            .single();
          const leadClientName = (lead?.client as { name?: string } | null)?.name || "Unknown Client";
          // Format: "LEAD-001 • Client Name"
          relatedName = lead && lead.lead_number
            ? `${lead.lead_number} • ${leadClientName}`
            : leadClientName;
          break;
        case "quotation":
          const { data: quotation } = await supabase
            .from("quotations")
            .select(`
              quotation_number,
              client:clients!client_id(name)
            `)
            .eq("id", task.related_id)
            .single();
          const clientName = (quotation?.client as { name?: string } | null)?.name || "Unknown Client";
          // Format: "QUOT-001 • Client Name"
          relatedName = quotation && quotation.quotation_number
            ? `${quotation.quotation_number} • ${clientName}`
            : clientName;
          break;
        case "project":
          const { data: project } = await supabase
            .from("projects")
            .select("project_number, client:clients(name)")
            .eq("id", task.related_id)
            .single();
          const projectClientName = (project?.client as { name?: string } | null)?.name || "Unknown Client";
          // Format: "PROJ-001 • Client Name"
          relatedName = project && project.project_number
            ? `${project.project_number} • ${projectClientName}`
            : projectClientName;
          break;
        case "client":
          const { data: client } = await supabase
            .from("clients")
            .select("name")
            .eq("id", task.related_id)
            .single();
          relatedName = client?.name || null;
          break;
      }
    }

    return NextResponse.json({
      task: {
        ...task,
        related_name: relatedName,
        tags: tagAssignments?.map((ta) => ta.tag).filter(Boolean) || [],
        subtask_count: subtasks.length,
        completed_subtask_count: subtasks.filter(
          (s) => s.status === "completed"
        ).length,
      },
      subtasks,
      comments:
        comments?.map((c) => ({
          ...c,
          created_by_name: c.created_user?.name,
          created_by_avatar: c.created_user?.avatar_url,
        })) || [],
      attachments:
        attachments?.map((a) => ({
          ...a,
          uploaded_by_name: a.uploaded_user?.name,
        })) || [],
      activities:
        activities?.map((a) => ({
          ...a,
          created_by_name: a.created_user?.name,
          created_by_avatar: a.created_user?.avatar_url,
        })) || [],
    });
  } catch (error) {
    console.error("Get task API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/[id] - Update task
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

    const body: UpdateTaskInput = await request.json();

    // Check task exists and get related entity info
    const { data: existingTask, error: fetchError } = await supabase
      .from("tasks")
      .select(
        "id, title, status, priority, due_date, description, is_from_template, template_id, assigned_to, created_by, related_type, related_id"
      )
      .eq("id", id)
      .single();

    if (fetchError || !existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Status changes go through task_transition() so that transition rules,
    // status history and work sessions stay consistent no matter which client
    // made the change. Everything else is a plain field update.
    if (body.status && body.status !== existingTask.status) {
      const { data: transition, error: transitionError } = await supabase.rpc(
        "task_transition",
        {
          p_task_id: id,
          p_user_id: user.id,
          p_to: body.status,
          p_reason: (body as { hold_reason?: string }).hold_reason ?? null,
        }
      );

      if (transitionError) {
        console.error("Error transitioning task:", transitionError);
        return NextResponse.json(
          { error: "Failed to update task status" },
          { status: 500 }
        );
      }

      if (!(transition as { success?: boolean })?.success) {
        return NextResponse.json(
          {
            error:
              (transition as { error?: string })?.error ||
              "Invalid status transition",
          },
          { status: 409 }
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_by: user.id,
    };

    // 'status' is deliberately absent - handled by the RPC above.
    // 'actual_hours' is derived from work sessions and must not be overwritten.
    const allowedFields = [
      "title",
      "description",
      "priority",
      "start_date",
      "due_date",
      "estimated_hours",
      "assigned_to",
      "related_type",
      "related_id",
    ];

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field as keyof UpdateTaskInput];
      }
    }

    // Tags are a full replacement of the assignment set: whatever the client
    // sends becomes the complete list. Sending [] clears them.
    if ("tag_ids" in body && Array.isArray(body.tag_ids)) {
      const tagIds = body.tag_ids as string[];

      await supabase.from("task_tag_assignments").delete().eq("task_id", id);

      if (tagIds.length > 0) {
        const { error: tagError } = await supabase
          .from("task_tag_assignments")
          .insert(tagIds.map((tagId) => ({ task_id: id, tag_id: tagId })));

        if (tagError) {
          console.error("Error updating task tags:", tagError);
          return NextResponse.json(
            { error: "Failed to update tags" },
            { status: 500 }
          );
        }
      }
    }

    // Update task
    const { data: task, error: updateError } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating task:", updateError);
      return NextResponse.json(
        { error: "Failed to update task" },
        { status: 500 }
      );
    }

    // Record the edit on the parent lead or project timeline.
    //
    // Previously only a status change was logged, and always as
    // "task_completed" - so reopening a task appeared on the timeline as a
    // completion, and renaming one or moving its due date left no trace at all.
    if (existingTask.related_id && existingTask.related_type) {
      const write = (entry: {
        type: string;
        title: string;
        description?: string | null;
      }) =>
        existingTask.related_type === "lead"
          ? logLeadActivity(supabase, {
              ...entry,
              leadId: existingTask.related_id,
              tenantId: user.tenantId,
              userId: user.id,
            })
          : logProjectActivity(supabase, {
              ...entry,
              projectId: existingTask.related_id,
              userId: user.id,
            });

      const statusChanged = body.status && body.status !== existingTask.status;

      if (statusChanged) {
        const completed = body.status === "completed";
        await write({
          type: completed ? "task_completed" : "task_updated",
          title: completed ? "Task completed" : "Task status changed",
          description: `Task "${existingTask.title}": status changed to ${body.status}`,
        });
      }

      // Reassignment is worth its own line - it changes who is accountable.
      if (
        "assigned_to" in body &&
        (body.assigned_to ?? null) !== (existingTask.assigned_to ?? null)
      ) {
        const ids = [existingTask.assigned_to, body.assigned_to].filter(
          Boolean
        ) as string[];
        const { data: people } = ids.length
          ? await supabase.from("users").select("id, name").in("id", ids)
          : { data: [] as { id: string; name: string }[] };
        const nameOf = (uid: unknown) =>
          uid
            ? people?.find((pp) => pp.id === uid)?.name ?? "Unknown user"
            : "Unassigned";

        await write({
          type: "task_updated",
          title: "Task reassigned",
          description: `Task "${existingTask.title}": ${nameOf(
            existingTask.assigned_to
          )} → ${nameOf(body.assigned_to)}`,
        });
      }

      // Everything else the edit touched, as one line. Status and assignee are
      // excluded because they were just reported on their own.
      const before = {
        title: existingTask.title,
        priority: (existingTask as any).priority,
        due_date: (existingTask as any).due_date,
        description: (existingTask as any).description,
      };
      const after: Record<string, unknown> = {};
      for (const field of Object.keys(before)) {
        if (field in body) after[field] = (body as Record<string, unknown>)[field];
      }
      const summary = describeChanges(before, after, TASK_FIELD_LABELS);
      if (summary) {
        await write({
          type: "task_updated",
          title: "Task updated",
          description: `Task "${existingTask.title}": ${summary}`,
        });
      }
    }

    // Fetch updated task with details
    const { data: fullTask } = await supabase
      .from("tasks")
      .select(
        `
        *,
        assigned_user:users!tasks_assigned_to_fkey(id, name, email, avatar_url),
        created_by_user:users!tasks_created_by_fkey(id, name, email)
      `
      )
      .eq("id", id)
      .single();

    // Tags and live timing come from elsewhere, so pull them alongside - the
    // caller merges this straight into its local state and would otherwise
    // show stale tags right after editing them.
    const [{ data: updatedTags }, { data: timing }] = await Promise.all([
      supabase
        .from("task_tag_assignments")
        .select("tag:task_tags(id, name, color)")
        .eq("task_id", id),
      supabase
        .from("tasks_with_timing")
        .select(
          "live_active_seconds, live_held_seconds, is_clock_running, lead_time_seconds, cycle_time_seconds, start_count, resume_count, original_lead_time_seconds, is_rework, open_subtask_count"
        )
        .eq("id", id)
        .single(),
    ]);

    // Transform to expected format
    const transformedTask = fullTask
      ? {
          ...fullTask,
          ...(timing || {}),
          assigned_to_name: fullTask.assigned_user?.name || null,
          assigned_to_email: fullTask.assigned_user?.email || null,
          assigned_to_avatar: fullTask.assigned_user?.avatar_url || null,
          created_by_name: fullTask.created_by_user?.name || null,
          created_by_email: fullTask.created_by_user?.email || null,
          tags: updatedTags?.map((ta) => ta.tag).filter(Boolean) || [],
        }
      : null;

    return NextResponse.json({ task: transformedTask });
  } catch (error) {
    console.error("Update task API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id] - Delete task
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

    // Check task exists and get related entity info
    const { data: existingTask, error: fetchError } = await supabase
      .from("tasks")
      .select("id, title, is_from_template, created_by, related_type, related_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Create activity in related entity's timeline before deletion
    if (existingTask.related_type === "lead" && existingTask.related_id) {
      await supabase.from("lead_activities").insert({
        lead_id: existingTask.related_id,
        activity_type: "task_deleted",
        title: "Task deleted",
        description: `Task "${existingTask.title}" was deleted`,
        created_by: user.id,
      });
    } else if (existingTask.related_type === "project" && existingTask.related_id) {
      await supabase.from("project_activities").insert({
        project_id: existingTask.related_id,
        activity_type: "task_deleted",
        title: "Task deleted",
        description: `Task "${existingTask.title}" was deleted`,
        created_by: user.id,
      });
    }

    // Delete task (cascade will handle subtasks, comments, attachments, etc.)
    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting task:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete task" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete task API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
