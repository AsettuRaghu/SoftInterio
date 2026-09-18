import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import type { CreateTaskInput } from "@/types/tasks";

// GET /api/tasks - List tasks with filters
export async function GET(request: NextRequest) {
  try {
    // Protect API route with user status check
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    /*
     * Who sees which tasks.
     *
     * `tasks.view` is granted to nearly every role and labelled "view all", so
     * it cannot mean all - it is the basic right to use the module. The real
     * split:
     *
     *   tasks.view_all   every task in the business (Admin, Owner, Manager,
     *                    Senior Designer).
     *   tasks.view_team  your own tasks PLUS every task on the work you are
     *                    responsible for - the projects you manage and the
     *                    leads assigned to you. There is no team table and no
     *                    reporting line (the model is flat), so "team" is
     *                    defined by responsibility, decided 2026-09-16. A
     *                    Finance Manager, who owns no project or lead, sees
     *                    their own until the finance module has entities.
     *   everyone else    tasks assigned to them or created by them.
     *
     * A list scoped to a lead or a project is the entity's own view and is
     * gated by that entity's access instead, so a plan stays whole for anyone
     * who may open the project.
     */

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

    const seesAll = user.isSuperAdmin || guard.permissions?.has("tasks.view_all");
    const seesTeam = !seesAll && guard.permissions?.has("tasks.view_team");
    let ownedProjectIds: string[] = [];
    let ownedLeadIds: string[] = [];
    if (seesTeam && !relatedType) {
      const [{ data: myProjects }, { data: myLeads }] = await Promise.all([
        supabase.from("projects").select("id").eq("tenant_id", user.tenantId).eq("project_manager_id", user.id),
        supabase.from("leads").select("id").eq("tenant_id", user.tenantId).eq("assigned_to", user.id),
      ]);
      ownedProjectIds = (myProjects ?? []).map((p) => p.id);
      ownedLeadIds = (myLeads ?? []).map((l) => l.id);
    }

    // Build query using the tasks table directly with joins
    let query = supabase.from("tasks").select(
      `
        *,
        assigned_user:users!tasks_assigned_to_fkey(id, name, email, avatar_url),
        playbook_step:procedure_step_definitions!tasks_procedure_step_id_fkey(owner_type, default_delay_reason, display_order),
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

    if (!relatedType && !seesAll) {
      const clauses = [`assigned_to.eq.${user!.id}`, `created_by.eq.${user!.id}`];
      if (seesTeam) {
        if (ownedProjectIds.length) clauses.push(`and(related_type.eq.project,related_id.in.(${ownedProjectIds.join(",")}))`);
        if (ownedLeadIds.length) clauses.push(`and(related_type.eq.lead,related_id.in.(${ownedLeadIds.join(",")}))`);
      }
      query = query.or(clauses.join(","));
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
          assigned_user:users!tasks_assigned_to_fkey(id, name, email, avatar_url),
          playbook_step:procedure_step_definitions!tasks_procedure_step_id_fkey(owner_type, default_delay_reason, display_order)
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
        const subtaskLeadMap = new Map<string, string>();
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

        // The same for projects. A subtask of a playbook phase is linked to the
        // project, and without this its Linked column showed the bare word
        // "Project" beside a parent naming the real one.
        const subtaskProjectIds = allSubtasks
          .filter((st) => st.related_type === "project" && st.related_id)
          .map((st) => st.related_id);

        const subtaskProjectMap = new Map<string, string>();
        if (subtaskProjectIds.length > 0) {
          const { data: subtaskProjects } = await supabase
            .from("projects")
            .select("id, name, project_number, client:clients(name)")
            .in("id", subtaskProjectIds);

          if (subtaskProjects) {
            subtaskProjects.forEach((project: any) => {
              const clientName =
                (project.client as { name?: string } | null)?.name ||
                "Unknown Client";
              subtaskProjectMap.set(
                project.id,
                project.name ||
                  (project.project_number
                    ? `${project.project_number} • ${clientName}`
                    : clientName)
              );
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

          // Get related_name for subtask.
          //
          // Projects were never resolved here - only leads - so every subtask
          // came back with an empty related_name and the list fell back to the
          // literal word "Project" while its parent showed the real name.
          let relatedName = "";
          if (st.related_type === "lead" && st.related_id) {
            relatedName = subtaskLeadMap.get(st.related_id) || "";
          } else if (st.related_type === "project" && st.related_id) {
            relatedName = subtaskProjectMap.get(st.related_id) || "";
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

    // Every row rendered by the client, parents AND the subtasks nested under
    // them. Subtasks were previously excluded, so their rows had no
    // open_subtask_count and no live timing - which made their timer buttons
    // behave differently from their parents' for no visible reason.
    const allRenderedTasks: any[] = [
      ...tasks,
      ...tasks.flatMap((t: any) => t.subtasks || []),
    ];

    // Fetch live timing in one round trip. The view has no FK metadata for
    // PostgREST embedding, so it is merged in rather than joined.
    if (allRenderedTasks.length > 0) {
      const { data: timings } = await supabase
        .from("tasks_with_timing")
        .select(
          "id, live_active_seconds, live_held_seconds, is_clock_running, lead_time_seconds, cycle_time_seconds, start_count, resume_count, original_lead_time_seconds, is_rework, open_subtask_count"
        )
        .in(
          "id",
          allRenderedTasks.map((t) => t.id)
        );

      if (timings) {
        const timingMap = new Map(timings.map((t) => [t.id, t]));
        allRenderedTasks.forEach((task) => {
          const timing = timingMap.get(task.id);
          if (timing) Object.assign(task, timing);
        });
      }
    }

    // Whether a row is a playbook step, and of which stage. Any client - the
    // list page, a phone - can tell a plan step from a plain task from this
    // alone, without joining anything.
    {
      const titleById = new Map<string, string>();
      for (const t of allRenderedTasks as any[]) titleById.set(t.id, t.title);
      const missingParents = [
        ...new Set(
          (allRenderedTasks as any[])
            .filter((t) => t.parent_task_id && !titleById.has(t.parent_task_id))
            .map((t) => t.parent_task_id as string)
        ),
      ];
      if (missingParents.length > 0) {
        const { data: parents } = await supabase.from("tasks").select("id, title").in("id", missingParents);
        for (const pr of parents ?? []) titleById.set(pr.id, pr.title);
      }
      (allRenderedTasks as any[]).forEach((t) => {
        t.is_plan_step = !!t.procedure_run_id;
        t.stage_title = t.parent_task_id && t.procedure_run_id ? titleById.get(t.parent_task_id) ?? null : null;
        // The playbook's own order, so any list can show a plan the way the
        // playbook wrote it without knowing anything about playbooks.
        t.plan_order = t.procedure_run_id ? (t.playbook_step?.display_order ?? null) : null;
      });
    }

    // The agreed plan, where the project has one: each step's dates as they
    // were at kick-off (latest baseline). Early / late on the plan is measured
    // against these, and a step yet to start can show where it was agreed to
    // be. One query per project in the result set.
    if (allRenderedTasks.length > 0) {
      const projectIds = [
        ...new Set(
          allRenderedTasks
            .filter((t: any) => t.related_type === "project" && t.related_id)
            .map((t: any) => t.related_id as string)
        ),
      ];
      if (projectIds.length > 0) {
        const { data: baselines } = await supabase
          .from("plan_baselines")
          .select("id, project_id, version")
          .in("project_id", projectIds)
          .order("version", { ascending: false });
        const latestByProject = new Map<string, { id: string; version: number }>();
        for (const b of baselines ?? []) {
          if (!latestByProject.has(b.project_id)) latestByProject.set(b.project_id, { id: b.id, version: b.version });
        }
        const baselineIds = [...latestByProject.values()].map((b) => b.id);
        if (baselineIds.length > 0) {
          const { data: agreed } = await supabase
            .from("plan_baseline_tasks")
            .select("baseline_id, task_id, start_date, due_date")
            .in("baseline_id", baselineIds)
            .in("task_id", allRenderedTasks.map((t: any) => t.id));
          const versionOf = new Map([...latestByProject.values()].map((b) => [b.id, b.version]));
          const byTask = new Map((agreed ?? []).map((a) => [a.task_id, a]));
          allRenderedTasks.forEach((task: any) => {
            const a = byTask.get(task.id);
            if (a) {
              task.agreed_start_date = a.start_date;
              task.agreed_due_date = a.due_date;
              task.agreed_version = versionOf.get(a.baseline_id) ?? null;
            }
          });
        }
      }
    }

    // Fetch tags for all rendered rows, subtasks included.
    if (allRenderedTasks.length > 0) {
      const taskIds = allRenderedTasks.map((t) => t.id);
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

        allRenderedTasks.forEach((task) => {
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
            .select("id, name, project_number, client:clients(name)")
            .in("id", projectIds);

          if (projects) {
            const projectMap = new Map<string, string>();
            projects.forEach((project: any) => {
              const clientName =
                (project.client as { name?: string } | null)?.name || "Unknown Client";
              /**
               * The project's own name, which is what people call it.
               *
               * This used to read "PRJ_20251219_0001 • Dileepnath Raju" - a
               * number and a client, never the project. Nobody refers to work
               * by its record number, and the column truncates, so the number
               * was most of what you could see.
               */
              const name =
                project.name ||
                (project.project_number
                  ? `${project.project_number} • ${clientName}`
                  : clientName);
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
      scope: relatedType ? "entity" : seesAll ? "all" : seesTeam ? "team" : "own",
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
          // The modal sends these but they were never mapped in, so every
          // subtask created here lost its lead/project. A database trigger
          // now backstops this for all callers, but sending the right value
          // from the start keeps the intent visible.
          related_type: subtask.related_type ?? body.related_type ?? null,
          related_id: subtask.related_id ?? body.related_id ?? null,
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
        playbook_step:procedure_step_definitions!tasks_procedure_step_id_fkey(owner_type, default_delay_reason, display_order),
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
