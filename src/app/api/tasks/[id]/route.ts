import { NextRequest, NextResponse } from "next/server";
import { readHold } from "@/lib/tasks/hold";
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
        playbook_step:procedure_step_definitions!tasks_procedure_step_id_fkey(owner_type, default_delay_reason),
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
          assigned_user:users!tasks_assigned_to_fkey(id, name, email, avatar_url),
          playbook_step:procedure_step_definitions!tasks_procedure_step_id_fkey(owner_type, default_delay_reason)
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
    const guard = await protectApiRoute(request, { loadPermissions: true });
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
        "id, title, status, priority, start_date, due_date, estimated_hours, description, is_from_template, template_id, assigned_to, created_by, related_type, related_id, procedure_step_id, procedure_run_id"
      )
      .eq("id", id)
      .single();

    if (fetchError || !existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    /**
     * What the playbook fixed, the project cannot quietly undo.
     *
     * A step that names a person is a decision made once, deliberately, when
     * the process was written - the point of a template is that not everything
     * is up for renegotiation on every project. A step that names only a role
     * leaves the person open but keeps the discipline: whoever ends up with it
     * has to actually be a project manager.
     *
     * A step that names neither is free, which is most of them.
     *
     * tasks.edit_all is the way round it, held by Admin, Manager and Owner.
     */
    // A finished task is not edited; it is reopened first. The tables make
    // settled rows read-only, but that is a courtesy - this is the rule.
    // Description and tags stay editable (a note on why it was skipped is
    // exactly what one adds afterwards); the fields that describe the work
    // - title, priority, dates, hours, assignee - do not.
    if (
      ["completed", "cancelled", "skipped"].includes(existingTask.status) &&
      !(body.status && body.status !== existingTask.status)
    ) {
      const frozen = ["title", "priority", "start_date", "due_date", "estimated_hours", "assigned_to"].filter(
        (f) => f in body && (body as Record<string, unknown>)[f] !== (existingTask as Record<string, unknown>)[f]
      );
      if (frozen.length > 0) {
        return NextResponse.json(
          {
            error: `This task is ${existingTask.status.replace("_", " ")}. Reopen it to change its ${frozen
              .map((f) => f.replace("_", " "))
              .join(", ")}.`,
            reason: "task_settled",
          },
          { status: 409 }
        );
      }
    }

    // Dates and hours that make sense.
    {
      const start = ("start_date" in body ? body.start_date : existingTask.start_date) || null;
      const due = ("due_date" in body ? body.due_date : existingTask.due_date) || null;
      if (start && due && String(due) < String(start)) {
        return NextResponse.json(
          { error: "The due date cannot be before the start date.", reason: "dates_out_of_order" },
          { status: 400 }
        );
      }
      if ("estimated_hours" in body && body.estimated_hours != null) {
        const h = Number(body.estimated_hours);
        if (!Number.isFinite(h) || h < 0) {
          return NextResponse.json({ error: "Estimated hours cannot be negative.", reason: "bad_hours" }, { status: 400 });
        }
      }
    }

    // Work in progress always has an owner. Clearing the assignee on a
    // running task would leave a clock running against nobody; reassign it
    // to someone else, or pause it first. Mirrors the rule that nothing goes
    // in progress without an owner.
    if (
      "assigned_to" in body &&
      !body.assigned_to &&
      existingTask.assigned_to &&
      existingTask.status === "in_progress"
    ) {
      return NextResponse.json(
        {
          error: "This task is in progress - assign it to someone else, or pause it before unassigning.",
          reason: "in_progress_needs_owner",
        },
        { status: 409 }
      );
    }

    if (
      "assigned_to" in body &&
      body.assigned_to !== existingTask.assigned_to &&
      existingTask.procedure_step_id &&
      !guard.permissions.has("tasks.edit_all")
    ) {
      const { data: step } = await supabase
        .from("procedure_step_definitions")
        .select("assign_to_user, assign_to_role")
        .eq("id", existingTask.procedure_step_id)
        .maybeSingle();

      if (step?.assign_to_user) {
        return NextResponse.json(
          {
            error:
              "The playbook assigns this step to a specific person. Ask someone who can override the playbook to change it.",
            reason: "assignee_fixed_by_playbook",
          },
          { status: 403 }
        );
      }

      if (step?.assign_to_role && body.assigned_to) {
        const { data: holdsRole } = await supabase
          .from("user_roles")
          .select("user_id, role:roles!inner(slug)")
          .eq("user_id", body.assigned_to);

        const ok = (holdsRole ?? []).some((r: any) => {
          const role = Array.isArray(r.role) ? r.role[0] : r.role;
          return role?.slug === step.assign_to_role;
        });

        if (!ok) {
          return NextResponse.json(
            {
              error: `The playbook reserves this step for the ${step.assign_to_role.replace(
                /_/g,
                " "
              )} role. Choose someone who holds it.`,
              reason: "assignee_role_fixed_by_playbook",
              requiredRole: step.assign_to_role,
            },
            { status: 403 }
          );
        }
      }
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
          ...readHold(body as Record<string, unknown>),
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

    // Who/why/until added to a hold already in effect - the row's "who are
    // we waiting on?" after an immediate pause. Only while the task is held,
    // and only when no status change is in the same request (the transition
    // carries them itself then). The newest history row is updated too, so
    // the delay log sees the owner on the hold that is actually running.
    if (
      !body.status &&
      (existingTask.status === "on_hold" || existingTask.status === "blocked") &&
      ("hold_owner" in body || "hold_reason_code" in body || "hold_expected_until" in body || "hold_counterpart" in body || "hold_reason" in body)
    ) {
      const h = readHold(body as Record<string, unknown>);
      const holdPatch: Record<string, unknown> = {};
      if ("hold_owner" in body) holdPatch.hold_owner = h.p_hold_owner;
      if ("hold_reason_code" in body) holdPatch.hold_reason_code = h.p_hold_reason_code;
      if ("hold_expected_until" in body) holdPatch.hold_expected_until = h.p_hold_expected_until;
      if ("hold_counterpart" in body) holdPatch.hold_counterpart = h.p_hold_counterpart;
      if ("hold_reason" in body) holdPatch.hold_reason = (body as { hold_reason?: string | null }).hold_reason || null;
      Object.assign(updateData, holdPatch);
      const { data: last } = await supabase
        .from("task_status_history")
        .select("id")
        .eq("task_id", id)
        .in("to_status", ["on_hold", "blocked"])
        .order("changed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last) {
        const { hold_reason: reasonText, ...rest } = holdPatch as { hold_reason?: unknown } & Record<string, unknown>;
        await supabase
          .from("task_status_history")
          .update({ ...rest, ...(reasonText !== undefined ? { reason: reasonText } : {}) })
          .eq("id", last.id);
      }
    }

    // A date a person changes on a plan step is pinned: the scheduler lays
    // the rest of the plan around it instead of overwriting it. Only a real
    // change pins - the edit modal echoes unchanged dates back.
    if (existingTask.procedure_run_id) {
      const dateChanged =
        ("start_date" in body && (body.start_date || null) !== (existingTask.start_date || null)) ||
        ("due_date" in body && (body.due_date || null) !== (existingTask.due_date || null));
      if (dateChanged) updateData.dates_pinned = true;
      if ("dates_pinned" in body && body.dates_pinned === false) updateData.dates_pinned = false;
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
          ? await supabase.from("tenant_directory").select("id, name").in("id", ids)
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
        playbook_step:procedure_step_definitions!tasks_procedure_step_id_fkey(owner_type, default_delay_reason),
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

/**
 * DELETE /api/tasks/[id]
 *
 * Deleting a task used to require nothing beyond a session: any signed-in user
 * could hard-delete any of them, and parent_task_id cascades, so one click
 * could take a parent and every subtask under it.
 *
 * Three rules now stand between a task and deletion.
 *
 * 1. You deleted what you made, or you hold tasks.delete. Ownership alone
 *    would strand every task whose creator has left the company, so the
 *    permission is the way back in - the same shape as everywhere else here:
 *    granted the permission, allowed the action.
 * 2. A playbook step is never deleted. It is a record of a governed process,
 *    and removing one quietly rewrites what the team agreed to do. Skipping is
 *    the sanctioned way not to do a step, and cancelling the run is the way to
 *    undo starting one.
 * 3. A parent takes its children with it, so the count has to be acknowledged
 *    with ?cascade=true rather than discovered afterwards.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

    // Check task exists and get related entity info
    const { data: existingTask, error: fetchError } = await supabase
      .from("tasks")
      .select(
        "id, title, is_from_template, created_by, related_type, related_id, procedure_run_id"
      )
      .eq("id", id)
      .single();

    if (fetchError || !existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Rule 2 first: a playbook step is refused outright, so the answer does not
    // depend on who is asking.
    if (existingTask.procedure_run_id) {
      return NextResponse.json(
        {
          error:
            "This is a playbook step and cannot be deleted. Skip it if it is not needed on this project, or cancel the playbook run if it was started by mistake.",
          reason: "playbook_step",
        },
        { status: 409 }
      );
    }

    // Rule 1.
    const isCreator = existingTask.created_by === user.id;
    const mayDeleteAny = guard.permissions.has("tasks.delete");
    if (!isCreator && !mayDeleteAny) {
      return NextResponse.json(
        {
          error:
            "Only the person who created this task can delete it. Ask them, or someone who can delete any task.",
          reason: "not_creator",
        },
        { status: 403 }
      );
    }

    // Rule 3.
    const { count: childCount } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("parent_task_id", id);

    const { searchParams } = new URL(request.url);
    if (childCount && childCount > 0 && searchParams.get("cascade") !== "true") {
      return NextResponse.json(
        {
          error: `This task has ${childCount} subtask${
            childCount === 1 ? "" : "s"
          }, which will be deleted with it.`,
          reason: "has_subtasks",
          childCount,
        },
        { status: 409 }
      );
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
