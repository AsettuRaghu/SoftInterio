import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { generateUniqueProjectNumber } from "@/utils/project-number-generator";
import { projectAccess } from "@/lib/projects/access";
import { allowsDirectProjectCreate } from "@/lib/projects/settings";
import { requestLogger } from "@/lib/logger/request";
import {
  deriveStagesFromPlaybook,
  EMPTY_STAGES,
} from "@/lib/projects/stages";

// GET /api/projects - List projects with their derived stage summary
export async function GET(request: NextRequest) {
  const log = requestLogger(request);

  try {
    // loadPermissions rather than requiredPermissions: the list is readable
    // with either the broad or the own-only grant, and the handler has to know
    // which one it got in order to scope the query.
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const access = projectAccess(guard.permissions, user.isSuperAdmin);

    if (access.denied) {
      log.warn("Projects list denied", { userId: user.id });
      return NextResponse.json(
        { error: "You do not have permission to view projects" },
        { status: 403 }
      );
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const project_category = searchParams.get("project_category") || "";
    const project_type = searchParams.get("project_type") || "";
    const project_manager_id = searchParams.get("project_manager_id") || "";
    const is_active = searchParams.get("is_active");

    let query = supabase
      .from("projects")
      .select(
        `
        id,
        project_number,
        name,
        description,
        status,
        priority,
        expected_start_date,
        expected_end_date,
        actual_start_date,
        actual_end_date,
        actual_cost,
        contract_value,
        overall_progress,
        kicked_off_at,
        committed_end_date,
        created_at,
        updated_at,
        project_category,
        is_active,
        client:clients!client_id(name),
        project_manager:users!project_manager_id(id, name, email, avatar_url),
        property:properties!property_id(property_name, property_type, category, carpet_area, city),
        lead:leads!lead_id(service_type)
      `,
        { count: "exact" }
      )
      .eq("tenant_id", user.tenantId)
      .order("created_at", { ascending: false });

    // Someone limited to their own sees the projects they manage or created.
    // Applied before the caller-supplied filters so a crafted query string
    // cannot widen it.
    if (!access.readAll) {
      query = query.or(
        `project_manager_id.eq.${user.id},created_by.eq.${user.id}`
      );
    }

    // Apply filters
    if (search) {
      // For searching linked client name, we need to rely on the client relation
      // Supabase/PostgREST doesn't support easy deep filtering on joined generic columns without embedding
      // A common workaround is searching the project name/number normally, 
      // OR doing a separate search for clients and filtering by ID.
      // For now, simpler fuzzy search on project fields:
      query = query.or(
        `project_number.ilike.%${search}%,name.ilike.%${search}%`
      );
    }

    if (status) {
      // "in_progress,on_hold" asks for either.
      const statuses = status.split(",").map((v) => v.trim()).filter(Boolean);
      query = statuses.length > 1 ? query.in("status", statuses) : query.eq("status", statuses[0]);
    }

    if (project_category) {
      query = query.eq("project_category", project_category);
    }

    if (project_type) {
      query = query.eq("project_type", project_type);
    }

    if (project_manager_id) {
      query = query.eq("project_manager_id", project_manager_id);
    }

    if (is_active !== null && is_active !== "") {
      query = query.eq("is_active", is_active === "true");
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: projects, error, count } = await query;

    if (error) {
      log.error("Error fetching projects", error);
      return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    }

    // Attach flat client_name and property/service data to projects
    let projectsWithClientName = projects?.map((p: any) => {
      const pClient = Array.isArray(p.client) ? p.client[0] : p.client;
      const pProperty = Array.isArray(p.property) ? p.property[0] : p.property;
      const pLead = Array.isArray(p.lead) ? p.lead[0] : p.lead;
      return {
        ...p,
        client_name: pClient?.name || "Unknown Client",
        service_type: pLead?.service_type,
        property_name: pProperty?.property_name || "Unknown Property",
        property_type: pProperty?.property_type,
        property_category: pProperty?.category,
        carpet_area: pProperty?.carpet_area,
        city: pProperty?.city,
        // contract_value is the agreed value; actual_cost is money spent.
        // These were previously the same field, which is why every project
        // showed as worth nothing.
        contract_value: p.contract_value ?? null,
        project_type: p.project_category, // Use project_category as project_type
        priority: p.priority || "Medium", // Default to Medium if not set
        current_phase: null, // Filled in below from the derived stages
      };
    }) || [];

    const projectIds = projectsWithClientName.map((p: any) => p.id);

    /*
     * The project manager's name comes from tenant_directory, not the
     * `project_manager:users!project_manager_id` embed above. That embed goes
     * through `users`, whose policies are own-row-only, so it resolves for the
     * caller and returns null for every colleague - the Assigned To column
     * would have read "Unassigned" on a project managed by anyone else.
     */
    if (projectIds.length) {
      const pmIds = [
        ...new Set(
          projectsWithClientName
            .map((p: any) => p.project_manager_id)
            .filter(Boolean)
        ),
      ];
      if (pmIds.length) {
        const { data: people } = await supabase
          .from("tenant_directory")
          .select("id, name, email, avatar_url")
          .in("id", pmIds);
        const byId = new Map((people ?? []).map((u: any) => [u.id, u]));
        projectsWithClientName = projectsWithClientName.map((p: any) => ({
          ...p,
          project_manager: p.project_manager_id
            ? byId.get(p.project_manager_id) ?? p.project_manager ?? null
            : null,
        }));
      }
    }

    /*
     * Where each project has got to.
     *
     * Derived exactly as GET /api/projects/[id]/stages derives it - a stage is
     * a top-level playbook step - but batched across the page: one query for
     * every active run, one for their tasks, one for step order. A project
     * with no run has no stages. Nothing is read from a stored column: the
     * tasks already hold this fact, and a stored copy is the one that goes
     * stale.
     */
    if (projectIds.length) {
      const { data: runs } = await supabase
        .from("procedure_runs")
        .select("id, related_id, definition_id, definition_name, definition_version, started_at")
        .eq("related_type", "project")
        .in("related_id", projectIds)
        .eq("status", "active")
        .order("started_at", { ascending: false });

      // Most recently started run per project, as the single-project route.
      const runByProject = new Map<string, any>();
      for (const r of runs ?? []) {
        if (!runByProject.has(r.related_id)) runByProject.set(r.related_id, r);
      }
      const runIds = [...runByProject.values()].map((r) => r.id);
      const definitionIds = [
        ...new Set([...runByProject.values()].map((r) => r.definition_id)),
      ];

      const [{ data: runTasks }, { data: steps }] =
        await Promise.all([
          runIds.length
            ? supabase
                .from("tasks")
                .select("id, title, status, parent_task_id, procedure_step_id, procedure_run_id")
                .in("procedure_run_id", runIds)
            : Promise.resolve({ data: [] as any[] }),
          definitionIds.length
            ? supabase
                .from("procedure_step_definitions")
                .select("id, display_order")
                .in("definition_id", definitionIds)
            : Promise.resolve({ data: [] as any[] }),
        ]);

      const stepOrder = new Map(
        (steps ?? []).map((st: any) => [st.id, st.display_order ?? 0])
      );

      // The agreed plan's end for each kicked-off project: the latest
      // baseline, and the last due date among its stages. Two queries for
      // the whole page, so the list can say "agreed 10 Dec → now 22 Dec".
      const agreedEndByProject = new Map<string, string>();
      {
        const { data: baselines } = await supabase
          .from("plan_baselines")
          .select("id, project_id, version")
          .in("project_id", projectIds)
          .order("version", { ascending: false });
        const latest = new Map<string, string>();
        for (const b of baselines ?? []) if (!latest.has(b.project_id)) latest.set(b.project_id, b.id);
        if (latest.size > 0) {
          const { data: bt } = await supabase
            .from("plan_baseline_tasks")
            .select("baseline_id, due_date, task:tasks!task_id(parent_task_id)")
            .in("baseline_id", [...latest.values()]);
          const projectOfBaseline = new Map([...latest.entries()].map(([pid, bid]) => [bid, pid]));
          for (const r of bt ?? []) {
            const t = r.task as unknown as { parent_task_id: string | null } | null;
            if (t?.parent_task_id || !r.due_date) continue;
            const pid = projectOfBaseline.get(r.baseline_id);
            if (!pid) continue;
            const cur = agreedEndByProject.get(pid);
            if (!cur || r.due_date > cur) agreedEndByProject.set(pid, r.due_date);
          }
        }
      }
      const tasksByRun = new Map<string, any[]>();
      for (const t of runTasks ?? []) {
        const list = tasksByRun.get(t.procedure_run_id) ?? [];
        list.push(t);
        tasksByRun.set(t.procedure_run_id, list);
      }
      projectsWithClientName = projectsWithClientName.map((p: any) => {
        const run = runByProject.get(p.id);
        const derived = run
          ? deriveStagesFromPlaybook({
              tasks: tasksByRun.get(run.id) ?? [],
              stepOrder,
              playbook: {
                name: run.definition_name,
                version: run.definition_version,
              },
            })
          : EMPTY_STAGES;

        /*
         * Every stage that is under way, not just one. A playbook can run
         * stages in parallel (`allow_parallel`), so "which stage is this on"
         * can honestly have two answers - Procurement and 3D Design at once
         * is the normal shape of a fit-out. `currentIndex` picks one of them
         * and would have hidden the other.
         *
         * When nothing is under way the next not-started stage is named
         * instead, so a project between stages still says where it is going
         * rather than showing a dash.
         */
        const active = derived.stages.filter((st) => st.status === "in_progress");
        const nextUp = derived.stages.find((st) => st.status === "not_started");
        const done = derived.stages.filter(
          (st) => st.status === "completed" || st.status === "skipped"
        ).length;
        const current =
          derived.currentIndex >= 0 ? derived.stages[derived.currentIndex] : null;

        return {
          ...p,
          agreed_end_date: agreedEndByProject.get(p.id) ?? null,
          // Kept for the stage filter, which reads a single name.
          current_phase: current?.name ?? null,
          stage_summary: derived.stages.length
            ? {
                active: active.map((st) => ({ name: st.name, progress: st.progress })),
                next: active.length ? null : (nextUp?.name ?? null),
                done,
                total: derived.stages.length,
                source: derived.source,
                // Per-stage progress, for the hover on the bar.
                breakdown: derived.stages.map((st) => ({
                  name: st.name,
                  status: st.status,
                  progress: st.progress,
                })),
              }
            : null,
        };
      });
    }

    /*
     * The last three things that happened, and the next three things owed.
     *
     * The same enrichment the leads list does, for the same reason: a list
     * that shows only a status and a percentage makes you open every row to
     * learn whether anything is moving. Batched across the page - four queries
     * rather than four per row.
     *
     * Meetings on a project live in calendar_events only; the lead-side split
     * into lead_activities does not apply here. But project_activities does
     * carry meeting_scheduled_at too, so both are read for the same reason the
     * leads list reads both of its tables.
     */
    if (projectIds.length) {
      const [
        { data: recent },
        { data: followUps },
        { data: dueTasks },
        { data: events },
        { data: meetings },
      ] = await Promise.all([
        supabase
          .from("project_activities")
          .select("project_id, activity_type, title, description, created_at")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("project_notes")
          .select("project_id, content, follow_up_at")
          .in("project_id", projectIds)
          .not("follow_up_at", "is", null)
          .is("follow_up_done_at", null),
        supabase
          .from("tasks")
          .select("related_id, title, due_date, status")
          .eq("related_type", "project")
          .in("related_id", projectIds)
          .in("status", ["todo", "in_progress", "on_hold"])
          .not("due_date", "is", null),
        supabase
          .from("calendar_events")
          .select("linked_id, title, event_type, scheduled_at")
          .eq("linked_type", "project")
          .in("linked_id", projectIds)
          .eq("is_completed", false),
        supabase
          .from("project_activities")
          .select("project_id, title, activity_type, meeting_scheduled_at")
          .in("project_id", projectIds)
          .not("meeting_scheduled_at", "is", null)
          .eq("meeting_completed", false),
      ]);

      // Newest first, so the first three seen per project are the three most
      // recent.
      const recentByProject = new Map<string, any[]>();
      for (const a of recent ?? []) {
        const list = recentByProject.get(a.project_id) ?? [];
        if (list.length < 3) {
          list.push(a);
          recentByProject.set(a.project_id, list);
        }
      }

      const upcoming = new Map<string, Array<{ kind: string; label: string; at: string }>>();
      const add = (id: string, entry: { kind: string; label: string; at: string }) => {
        const list = upcoming.get(id) ?? [];
        list.push(entry);
        upcoming.set(id, list);
      };
      (followUps ?? []).forEach((n: any) =>
        add(n.project_id, {
          kind: "follow_up",
          label: (n.content || "").split("\n")[0].slice(0, 80) || "Follow-up",
          at: n.follow_up_at,
        })
      );
      (dueTasks ?? []).forEach((t: any) =>
        add(t.related_id, { kind: "task", label: t.title, at: t.due_date })
      );
      (events ?? []).forEach((e: any) =>
        add(e.linked_id, {
          kind: "calendar",
          label: e.title || e.event_type || "Meeting",
          at: e.scheduled_at,
        })
      );
      (meetings ?? []).forEach((m: any) =>
        add(m.project_id, {
          kind: "calendar",
          label: m.title || m.activity_type || "Meeting",
          at: m.meeting_scheduled_at,
        })
      );

      projectsWithClientName = projectsWithClientName.map((p: any) => {
        const list = recentByProject.get(p.id) ?? [];
        return {
          ...p,
          last_activity_at: list[0]?.created_at ?? null,
          last_activity_type: list[0]?.activity_type ?? null,
          last_activity_detail: list[0]
            ? list[0].description || list[0].title || null
            : null,
          recent_activities: list.map((a: any) => ({
            type: a.activity_type,
            detail: a.description || a.title || null,
            at: a.created_at,
          })),
          upcoming_items: (upcoming.get(p.id) ?? [])
            // Soonest first; overdue sorts to the top because it is furthest
            // in the past.
            .sort((a, b) => (a.at < b.at ? -1 : 1))
            .slice(0, 3),
        };
      });
    }

    return NextResponse.json({
      projects: projectsWithClientName,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    log.error("Unhandled error listing projects", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project directly (tenant opt-in)
export async function POST(request: NextRequest) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["projects.create"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    // A project normally comes from a won lead, which brings the client,
    // property, quotation and scope with it. Direct creation is opt-in per
    // tenant. Checked here and not only in the UI: a hidden button is not a
    // control.
    if (!(await allowsDirectProjectCreate(supabase, user.tenantId))) {
      log.warn("Direct project creation is disabled for this tenant", {
        tenantId: user.tenantId,
      });
      return NextResponse.json(
        {
          error:
            "Projects are created from won leads. Direct creation is turned off for your organisation.",
          directCreateDisabled: true,
        },
        { status: 403 }
      );
    }

    // Check usage limits - can add projects?
    const { canAddProject } = await import("@/lib/billing/usage");
    const usageCheck = await canAddProject(user.tenantId);
    if (!usageCheck.canAdd) {
      log.info("Project limit reached", { tenantId: user.tenantId });
      return NextResponse.json(
        {
          error: usageCheck.message || "Project limit reached",
          upsellRequired: true,
          usage: {
            current: usageCheck.current,
            limit: usageCheck.limit,
            percentage: usageCheck.percentage,
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      client_name,
      client_email,
      client_phone,
      site_address,
      city,
      state,
      pincode,
      project_type,
      project_category = "turnkey",
      start_date,
      expected_end_date,
      project_manager_id,
      lead_id,
      quotation_id,
      notes,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    if (!client_name?.trim()) {
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 }
      );
    }

    /**
     * The client and the property are separate records.
     *
     * This handler used to insert client_name, client_email, client_phone,
     * site_address, city, state, pincode, project_type, quoted_amount and
     * budget_amount straight onto projects. None of those are columns there,
     * so every request died with PGRST204 and manual project creation had
     * never once worked - unnoticed, because real projects come from the
     * create_project_from_lead RPC.
     *
     * The steps below mirror POST /api/sales/leads, which has always created
     * the client and property this way: a new client each time rather than
     * matching on email, the property optional, and both rolled back by hand
     * if the row that needed them fails.
     */

    // STEP 1: Create the client record.
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        tenant_id: user.tenantId,
        client_type: "individual",
        status: "active",
        name: client_name.trim(),
        phone: client_phone?.trim() || null,
        email: client_email?.trim().toLowerCase() || null,
        address_line1: site_address?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        pincode: pincode?.trim() || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (clientError) {
      log.error("Error creating client for project", clientError);
      return NextResponse.json(
        { error: "Failed to create client record" },
        { status: 500 }
      );
    }

    // STEP 2: Create the property record, if there is anything to put in it.
    // Optional, exactly as on a lead - a project without a site address is
    // still a project.
    let propertyId: string | null = null;
    if (site_address || city || pincode) {
      const { data: property, error: propertyError } = await supabase
        .from("properties")
        .insert({
          tenant_id: user.tenantId,
          property_name: name.trim(),
          category: project_type || "residential",
          address_line1: site_address?.trim() || null,
          city: city?.trim() || "Unknown",
          pincode: pincode?.trim() || null,
        })
        .select("id")
        .single();

      if (propertyError) {
        log.warn("Continuing without a property record", {
          error: propertyError.message,
        });
      } else {
        propertyId = property.id;
      }
    }

    // Generate project number with retry logic to handle duplicates
    let projectNumber: string;
    try {
      projectNumber = await generateUniqueProjectNumber(user.tenantId);
    } catch (err) {
      log.error("Error generating project number", err);
      await supabase.from("clients").delete().eq("id", client.id);
      if (propertyId) {
        await supabase.from("properties").delete().eq("id", propertyId);
      }
      return NextResponse.json(
        { error: "Failed to generate project number" },
        { status: 500 }
      );
    }

    // STEP 3: Create the project itself.
    //
    // Only real columns. quoted_amount and budget_amount are deliberately not
    // stored: projects has no home for either, and actual_cost is not one -
    // the Overview tab shows it as money spent. A project's value comes from
    // its quotation, which is where the app already models it.
    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        tenant_id: user.tenantId,
        project_number: projectNumber,
        name: name.trim(),
        description: description || null,
        client_id: client.id,
        property_id: propertyId,
        project_category: project_category || "turnkey",
        // The form field is start_date; this used to read expected_start_date
        // off the body and so silently dropped whatever was typed.
        expected_start_date: start_date || null,
        expected_end_date: expected_end_date || null,
        project_manager_id: project_manager_id || null,
        lead_id: lead_id || null,
        quotation_id: quotation_id || null,
        notes: notes || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      log.error("Error creating project", error);
      // Undo the client and property so a failed attempt leaves nothing behind.
      await supabase.from("clients").delete().eq("id", client.id);
      if (propertyId) {
        await supabase.from("properties").delete().eq("id", propertyId);
      }
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }

    log.info("Project created", {
      projectId: project.id,
      projectNumber,
      fromLead: !!lead_id,
    });

    // No playbook is started here: the plan is chosen at kick-off.

    // Update the lead with project_id reference if created from a lead
    if (lead_id && project) {
      try {
        // Tenant-scoped: lead_id arrives in the request body, so without this
        // a caller could stamp their project id onto another business's lead.
        await supabase
          .from("leads")
          .update({ project_id: project.id })
          .eq("id", lead_id)
          .eq("tenant_id", user.tenantId);
      } catch (leadUpdateError) {
        log.error("Error linking project to lead", leadUpdateError, { projectId: project.id, leadId: lead_id });
      }
    }

    const { data: created } = await supabase
      .from("projects")
      .select(
        `
        *,
        project_manager:users!project_manager_id(id, name, email, avatar_url)
      `
      )
      .eq("id", project.id)
      .single();

    return NextResponse.json({ project: created || project }, { status: 201 });
  } catch (error) {
    log.error("Unhandled error creating project", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
