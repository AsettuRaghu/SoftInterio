import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { UpdateTaskInput } from "@/types/tasks";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/tasks/[id] - Get single task with all related data
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Transform to expected format
    const task = {
      ...rawTask,
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
        .from("task_attachments")
        .select(
          `
          *,
          uploaded_user:users!task_attachments_uploaded_by_fkey(id, name, avatar_url)
        `
        )
        .eq("task_id", id)
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
            .select("client_name, lead_number")
            .eq("id", task.related_id)
            .single();
          relatedName = lead
            ? `${lead.lead_number} - ${lead.client_name}`
            : null;
          break;
        case "quotation":
          const { data: quotation } = await supabase
            .from("quotations")
            .select("quotation_number, client_name")
            .eq("id", task.related_id)
            .single();
          relatedName = quotation
            ? `${quotation.quotation_number} - ${quotation.client_name}`
            : null;
          break;
        case "project":
          const { data: project } = await supabase
            .from("projects")
            .select("name, project_number")
            .eq("id", task.related_id)
            .single();
          relatedName = project
            ? `${project.project_number || ""} - ${project.name}`
            : null;
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
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: UpdateTaskInput = await request.json();

    // Check task exists
    const { data: existingTask, error: fetchError } = await supabase
      .from("tasks")
      .select(
        "id, status, is_from_template, template_id, assigned_to, created_by"
      )
      .eq("id", id)
      .single();

    if (fetchError || !existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_by: user.id,
    };

    const allowedFields = [
      "title",
      "description",
      "priority",
      "status",
      "start_date",
      "due_date",
      "estimated_hours",
      "actual_hours",
      "assigned_to",
    ];

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field as keyof UpdateTaskInput];
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

    // Transform to expected format
    const transformedTask = fullTask
      ? {
          ...fullTask,
          assigned_to_name: fullTask.assigned_user?.name || null,
          assigned_to_email: fullTask.assigned_user?.email || null,
          assigned_to_avatar: fullTask.assigned_user?.avatar_url || null,
          created_by_name: fullTask.created_by_user?.name || null,
          created_by_email: fullTask.created_by_user?.email || null,
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
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check task exists
    const { data: existingTask, error: fetchError } = await supabase
      .from("tasks")
      .select("id, is_from_template, created_by")
      .eq("id", id)
      .single();

    if (fetchError || !existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
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
