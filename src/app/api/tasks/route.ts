import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TaskFilters, CreateTaskInput } from "@/types/tasks";

// GET /api/tasks - List tasks with filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const assignedTo = searchParams.get("assigned_to");
    const relatedType = searchParams.get("related_type");
    const relatedId = searchParams.get("related_id");
    const search = searchParams.get("search");
    const parentOnly = searchParams.get("parent_only") === "true";
    const dueDateFrom = searchParams.get("due_date_from");
    const dueDateTo = searchParams.get("due_date_to");
    const sortBy = searchParams.get("sort_by") || "created_at";
    const sortOrder = searchParams.get("sort_order") || "desc";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query using the tasks table directly with joins
    let query = supabase.from("tasks").select(
      `
        *,
        assigned_user:users!tasks_assigned_to_fkey(id, name, email, avatar_url),
        created_by_user:users!tasks_created_by_fkey(id, name, email)
      `,
      { count: "exact" }
    );

    // Parent only filter (for main list view)
    if (parentOnly) {
      query = query.is("parent_task_id", null);
    }

    // Status filter
    if (status) {
      const statuses = status.split(",");
      query = query.in("status", statuses);
    }

    // Priority filter
    if (priority) {
      const priorities = priority.split(",");
      query = query.in("priority", priorities);
    }

    // Assigned to filter
    if (assignedTo) {
      if (assignedTo === "unassigned") {
        query = query.is("assigned_to", null);
      } else if (assignedTo === "me") {
        query = query.eq("assigned_to", user.id);
      } else {
        query = query.eq("assigned_to", assignedTo);
      }
    }

    // Related entity filter
    if (relatedType && relatedId) {
      query = query.eq("related_type", relatedType).eq("related_id", relatedId);
    } else if (relatedType) {
      query = query.eq("related_type", relatedType);
    }

    // Due date range
    if (dueDateFrom) {
      query = query.gte("due_date", dueDateFrom);
    }
    if (dueDateTo) {
      query = query.lte("due_date", dueDateTo);
    }

    // Search
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,description.ilike.%${search}%,task_number.ilike.%${search}%`
      );
    }

    // Sorting
    const ascending = sortOrder === "asc";
    query = query.order(sortBy, { ascending });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: rawTasks, error, count } = await query;

    if (error) {
      console.error("Error fetching tasks:", error);
      return NextResponse.json(
        { error: "Failed to fetch tasks", details: error.message },
        { status: 500 }
      );
    }

    // Transform to match expected format
    const tasks = (rawTasks || []).map((task) => ({
      ...task,
      assigned_to_name: task.assigned_user?.name || null,
      assigned_to_email: task.assigned_user?.email || null,
      assigned_to_avatar: task.assigned_user?.avatar_url || null,
      created_by_name: task.created_by_user?.name || null,
      created_by_email: task.created_by_user?.email || null,
      subtask_count: 0,
      completed_subtask_count: 0,
      comment_count: 0,
      attachment_count: 0,
    }));

    // Get subtask counts for parent tasks
    if (tasks.length > 0) {
      const taskIds = tasks.map((t) => t.id);

      // Fetch subtask counts
      const { data: subtaskCounts } = await supabase
        .from("tasks")
        .select("parent_task_id, status")
        .in("parent_task_id", taskIds);

      if (subtaskCounts) {
        const countMap = new Map<
          string,
          { total: number; completed: number }
        >();
        subtaskCounts.forEach((st) => {
          if (!countMap.has(st.parent_task_id)) {
            countMap.set(st.parent_task_id, { total: 0, completed: 0 });
          }
          const counts = countMap.get(st.parent_task_id)!;
          counts.total++;
          if (st.status === "completed") {
            counts.completed++;
          }
        });

        tasks.forEach((task) => {
          const counts = countMap.get(task.id);
          if (counts) {
            task.subtask_count = counts.total;
            task.completed_subtask_count = counts.completed;
          }
        });
      }
    }

    // Fetch tags for all tasks
    if (tasks.length > 0) {
      const taskIds = tasks.map((t) => t.id);
      const { data: tagAssignments } = await supabase
        .from("task_tag_assignments")
        .select(
          `
          task_id,
          tag:task_tags(id, name, color)
        `
        )
        .in("task_id", taskIds);

      if (tagAssignments) {
        const tagMap = new Map<string, any[]>();
        tagAssignments.forEach((ta) => {
          if (!tagMap.has(ta.task_id)) {
            tagMap.set(ta.task_id, []);
          }
          if (ta.tag) {
            tagMap.get(ta.task_id)!.push(ta.tag);
          }
        });

        tasks.forEach((task) => {
          (task as any).tags = tagMap.get(task.id) || [];
        });
      }
    }

    return NextResponse.json({
      tasks,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error("List tasks API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CreateTaskInput = await request.json();

    // Validate required fields
    if (!body.title?.trim()) {
      return NextResponse.json(
        { error: "Task title is required" },
        { status: 400 }
      );
    }

    // Get user's tenant
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: "User tenant not found" },
        { status: 404 }
      );
    }

    // Create task
    const { data: task, error: createError } = await supabase
      .from("tasks")
      .insert({
        tenant_id: userData.tenant_id,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        priority: body.priority || "medium",
        status: "todo",
        parent_task_id: body.parent_task_id || null,
        start_date: body.start_date || null,
        due_date: body.due_date || null,
        estimated_hours: body.estimated_hours || null,
        assigned_to: body.assigned_to || null,
        related_type: body.related_type || null,
        related_id: body.related_id || null,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating task:", createError);
      return NextResponse.json(
        { error: "Failed to create task" },
        { status: 500 }
      );
    }

    // Add tags if provided
    if (body.tag_ids && body.tag_ids.length > 0) {
      const tagAssignments = body.tag_ids.map((tagId) => ({
        task_id: task.id,
        tag_id: tagId,
      }));

      await supabase.from("task_tag_assignments").insert(tagAssignments);
    }

    // Log activity
    await supabase.from("task_activities").insert({
      task_id: task.id,
      activity_type: "created",
      description: "Task created",
      created_by: user.id,
    });

    // Fetch full task with details
    const { data: fullTask } = await supabase
      .from("tasks")
      .select(
        `
        *,
        assigned_user:users!tasks_assigned_to_fkey(id, name, email, avatar_url),
        created_by_user:users!tasks_created_by_fkey(id, name, email)
      `
      )
      .eq("id", task.id)
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
          subtask_count: 0,
          completed_subtask_count: 0,
        }
      : null;

    return NextResponse.json({ task: transformedTask }, { status: 201 });
  } catch (error) {
    console.error("Create task API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
