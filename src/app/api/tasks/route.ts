import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import type { TaskFilters, CreateTaskInput } from "@/types/tasks";

// GET /api/tasks - List tasks with filters
export async function GET(request: NextRequest) {
  try {
    // Protect API route with user status check
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

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
        query = query.eq("assigned_to", user!.id);
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
      subtasks: [] as any[],
    }));

    // Get subtasks for parent tasks (prefetch for instant expansion)
    if (tasks.length > 0) {
      const taskIds = tasks.map((t) => t.id);

      // Fetch full subtask data for instant expansion
      const { data: allSubtasks } = await supabase
        .from("tasks")
        .select(
          `
          *,
          assigned_user:users!tasks_assigned_to_fkey(id, name, email, avatar_url)
        `
        )
        .in("parent_task_id", taskIds)
        .order("created_at", { ascending: true });

      if (allSubtasks) {
        // Collect all lead IDs from subtasks to fetch names
        const subtaskLeadIds = allSubtasks
          .filter((st) => st.related_type === "lead" && st.related_id)
          .map((st) => st.related_id);

        // Fetch lead names for subtasks
        let subtaskLeadMap = new Map<string, string>();
        if (subtaskLeadIds.length > 0) {
          const { data: subtaskLeads } = await supabase
            .from("leads")
            .select("id, lead_number, client:clients(name)")
            .in("id", subtaskLeadIds);

          if (subtaskLeads) {
            subtaskLeads.forEach((lead: any) => {
              const clientName = (lead.client as { name?: string } | null)?.name || "Unknown Client";
              // Format: "LEAD-001 • Client Name"
              const name = lead.lead_number 
                ? `${lead.lead_number} • ${clientName}` 
                : clientName;
              subtaskLeadMap.set(lead.id, name);
            });
          }
        }

        const subtaskMap = new Map<string, any[]>();
        const countMap = new Map<
          string,
          { total: number; completed: number }
        >();

        allSubtasks.forEach((st) => {
          // Group subtasks by parent
          if (!subtaskMap.has(st.parent_task_id)) {
            subtaskMap.set(st.parent_task_id, []);
          }

          // Get related_name for subtask
          let relatedName = "";
          if (st.related_type === "lead" && st.related_id) {
            relatedName = subtaskLeadMap.get(st.related_id) || "";
          }

          subtaskMap.get(st.parent_task_id)!.push({
            ...st,
            assigned_to_name: st.assigned_user?.name || null,
            assigned_to_email: st.assigned_user?.email || null,
            assigned_to_avatar: st.assigned_user?.avatar_url || null,
            related_name: relatedName,
            subtask_count: 0,
            completed_subtask_count: 0,
          });

          // Count for parent
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
          task.subtasks = subtaskMap.get(task.id) || [];
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

    // Fetch related entity names (leads/projects)
    if (tasks.length > 0) {
      const leadIds = tasks
        .filter((t) => t.related_type === "lead" && t.related_id)
        .map((t) => t.related_id);

      if (leadIds.length > 0) {
        const { data: leads } = await supabase
          .from("leads")
          .select("id, lead_number, client:clients(name)")
          .in("id", leadIds);

        if (leads) {
          const leadMap = new Map<string, string>();
          leads.forEach((lead: any) => {
            const clientName = (lead.client as { name?: string } | null)?.name || "Unknown Client";
            // Format: "LEAD-001 • Client Name"
            const name = lead.lead_number 
              ? `${lead.lead_number} • ${clientName}` 
              : clientName;
            leadMap.set(lead.id, name);
          });

          tasks.forEach((task) => {
            if (task.related_type === "lead" && task.related_id) {
              (task as any).related_name = leadMap.get(task.related_id) || "";
            }
          });
        }
      }

      // Fetch project names if any tasks are linked to projects
      const projectIds = tasks
        .filter((t) => t.related_type === "project" && t.related_id)
        .map((t) => t.related_id);

      if (projectIds.length > 0) {
        try {
          const { data: projects } = await supabase
            .from("projects")
            .select("id, project_number, client:clients(name)")
            .in("id", projectIds);

          if (projects) {
            const projectMap = new Map<string, string>();
            projects.forEach((project: any) => {
              const clientName = (project.client as { name?: string } | null)?.name || "Unknown Client";
              // Format: "PROJ-001 • Client Name"
              const name = project.project_number 
                ? `${project.project_number} • ${clientName}` 
                : clientName;
              projectMap.set(project.id, name);
            });

            tasks.forEach((task) => {
              if (task.related_type === "project" && task.related_id) {
                (task as any).related_name =
                  projectMap.get(task.related_id) || "";
              }
            });
          }
        } catch {
          // Projects table might not exist yet
        }
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
    // Protect API route with user status check
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["tasks.create"],
      requireAllPermissions: false, // Super admin also gets access
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    const body: CreateTaskInput = await request.json();

    // Validate required fields
    if (!body.title?.trim()) {
      return NextResponse.json(
        { error: "Task title is required" },
        { status: 400 }
      );
    }

    // Create task using the user's tenant from guard
    const { data: task, error: createError } = await supabase
      .from("tasks")
      .insert({
        tenant_id: user!.tenantId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        priority: body.priority || null,
        status: body.status || "todo",
        parent_task_id: body.parent_task_id || null,
        start_date: body.start_date || null,
        due_date: body.due_date || null,
        estimated_hours: body.estimated_hours || null,
        assigned_to: body.assigned_to || user!.id,
        related_type: body.related_type || null,
        related_id: body.related_id || null,
        created_by: user!.id,
        updated_by: user!.id,
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

    // Create subtasks if provided
    if (body.subtasks && body.subtasks.length > 0) {
      const subtasksToInsert = body.subtasks
        .filter((st) => st.title?.trim())
        .map((subtask) => ({
          tenant_id: user!.tenantId,
          title: subtask.title.trim(),
          description: subtask.description?.trim() || null,
          priority: subtask.priority || null,
          status: subtask.status || "todo",
          parent_task_id: task.id,
          start_date: subtask.start_date || null,
          due_date: subtask.due_date || null,
          estimated_hours: subtask.estimated_hours || null,
          assigned_to: subtask.assigned_to || null,
          created_by: user!.id,
          updated_by: user!.id,
        }));

      if (subtasksToInsert.length > 0) {
        const { error: subtaskError } = await supabase
          .from("tasks")
          .insert(subtasksToInsert);

        if (subtaskError) {
          console.error("Error creating subtasks:", subtaskError);
          // Don't fail the entire request, just log the error
        }
      }
    }

    // Log activity
    await supabase.from("task_activities").insert({
      task_id: task.id,
      activity_type: "created",
      description: "Task created",
      created_by: user!.id,
    });

    // Create activity in related entity's timeline (lead or project)
    if (body.related_type === "lead" && body.related_id) {
      await supabase.from("lead_activities").insert({
        lead_id: body.related_id,
        activity_type: "task_created",
        title: "Task created",
        description: `Task "${body.title.trim()}" was created`,
        created_by: user!.id,
      });
    } else if (body.related_type === "project" && body.related_id) {
      await supabase.from("project_activities").insert({
        project_id: body.related_id,
        activity_type: "task_created",
        title: "Task created",
        description: `Task "${body.title.trim()}" was created`,
        created_by: user!.id,
      });
    }

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
          subtask_count:
            body.subtasks?.filter((st) => st.title?.trim()).length || 0,
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
