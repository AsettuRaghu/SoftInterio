import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { requireProjectAccess } from "@/lib/projects/guard";
import { projectClosingBlockers, describeBlockers } from "@/lib/projects/closing";
import { requestLogger } from "@/lib/logger/request";
import { logProjectActivity } from "@/lib/activity/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id] - Get single project with its client, property, lead and milestones
export async function GET(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    const gate = await requireProjectAccess(supabase, {
      projectId: id,
      user,
      permissions: guard.permissions,
      mode: "read",
    });
    if (!gate.ok) return gate.response;

    // Fetch project with relations
    const { data: project, error } = await supabase
      .from("projects")
      .select(
        `
        *,
        project_manager:users!project_manager_id(id, name, email, avatar_url),
        client:clients!client_id(id, name, email, phone),
        property:properties!property_id(id, property_name, property_type, property_subtype, category, unit_number, address_line1, city, pincode, carpet_area),
        lead:leads!lead_id(id, lead_number, service_type, lead_source, budget_range, won_amount)
      `
      )
      .eq("id", id)
      .eq("tenant_id", user.tenantId)
      .single();

    if (error) {
      log.error("Error fetching project", error, { projectId: id });
      return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
    }

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Fetch full project details with client and property relations for flattening
    // Note: We fetch all related data separately to avoid Supabase join syntax issues
    const { data: fullProject, error: fullProjectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (fullProjectError) {
       log.error("Error fetching full project details", fullProjectError, { projectId: id });
       return NextResponse.json(
         { error: "Failed to fetch project details" },
         { status: 500 }
       );
    }
    
    // Fetch project manager data separately if project_manager_id exists
    let pManager = null;
    if (fullProject?.project_manager_id) {
      // tenant_directory, because `users` only ever returns the caller's own
      // row - so this .single() resolved to null for every manager but
      // yourself and the manager card rendered blank.
      const { data: managerData } = await supabase
        .from("tenant_directory")
        .select("id, name, email, avatar_url")
        .eq("id", fullProject.project_manager_id)
        .single();
      pManager = managerData;
    }
    
    // Fetch client data separately if client_id exists
    let pClient = null;
    if (fullProject?.client_id) {
      const { data: clientData } = await supabase
        .from("clients")
        .select("name, email, phone")
        .eq("id", fullProject.client_id)
        .single();
      pClient = clientData;
    }
    
    // Fetch property data separately if property_id exists
    let pProperty = null;
    if (fullProject?.property_id) {
      /*
       * `category` was absent from this select while the edit dialog read
       * `property.category` to populate its Category control. So the value saved
       * correctly, came back undefined, and reopening the dialog showed nothing
       * selected - and saving again submitted "" and cleared what had just been
       * set.
       */
      const { data: propertyData } = await supabase
        .from("properties")
        .select(`
          id,
          property_name,
          property_type,
          property_subtype,
          category,
          unit_number,
          address_line1,
          city,
          pincode,
          carpet_area
        `)
        .eq("id", fullProject.property_id)
        .single();
      pProperty = propertyData;
    }
    
    // Fetch lead data if converted from lead
    let pLead = null;
    let effectiveSalesRep = null;
    let assignedByUser = null;
    if (fullProject?.lead_id) {
      const { data: leadData, error: leadError } = await supabase
        .from("leads")
        .select(`
          id,
          lead_number,
          lead_source,
          service_type,
          stage,
          budget_range,
          won_amount,
          won_at,
          contract_signed_date,
          expected_project_start,
          target_start_date,
          target_end_date,
          assigned_to,
          assigned_by,
          assigned_user:users!leads_assigned_to_fkey(id, name, email, avatar_url),
          created_by_user:users!leads_assigned_by_fkey(id, name, email, avatar_url)
        `)
        .eq("id", fullProject.lead_id)
        .single();
      
      if (leadError) {
        log.error("Error fetching linked lead", leadError, { projectId: id, leadId: fullProject.lead_id });
      }
      
      pLead = leadData;
      effectiveSalesRep = leadData?.assigned_user;
      assignedByUser = leadData?.created_by_user;
    }
    
    const flattenedProject = {
      ...project,
      
      // Relations - all fetched separately
      client: pClient,
      property: pProperty,
      lead: pLead,
      sales_rep: effectiveSalesRep,
      assigned_by_user: assignedByUser,
      project_manager: pManager || project.project_manager
    };

    // The agreed plan: the latest baseline's span, for the Overview's
    // "promised / agreed / current / actual" reading.
    const { data: latestBaseline } = await supabase
      .from("plan_baselines")
      .select("id, version, set_at")
      .eq("project_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    let agreedPlan: { version: number; set_at: string; start: string | null; end: string | null } | null = null;
    if (latestBaseline) {
      const { data: span } = await supabase
        .from("plan_baseline_tasks")
        .select("start_date, due_date, task:tasks!task_id(parent_task_id, status)")
        .eq("baseline_id", latestBaseline.id);
      const tops = (span ?? []).filter((r: any) => !r.task?.parent_task_id && r.start_date && r.due_date);
      const starts = tops.map((r: any) => r.start_date as string).sort();
      const ends = tops.map((r: any) => r.due_date as string).sort();
      agreedPlan = {
        version: latestBaseline.version,
        set_at: latestBaseline.set_at,
        start: starts[0] ?? null,
        end: ends[ends.length - 1] ?? null,
      };
    }

    // Fetch payment milestones
    const { data: paymentMilestones } = await supabase
      .from("project_payment_milestones")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true });

    // A second lead fetch used to live here. It selected nine columns that do
    // not exist on leads - property_name, flat_number, carpet_area_sqft,
    // project_scope, special_requirements and the rest all moved to the
    // properties table - so the query failed every time. Its result was
    // assigned to a variable that was never returned, and the lead_activities
    // it guarded were therefore always null. Nothing reads them, and lead
    // activities deliberately do not carry into a project's timeline anyway.
    // The lead this page needs is already fetched above as pLead.

    // Fetch calendar events linked to this project
    const { data: calendarEvents } = await supabaseAdmin
      .from("calendar_events")
      .select(
        `
        *,
        created_user:users!calendar_events_created_by_fkey(id, name, avatar_url)
      `
      )
      .eq("tenant_id", user.tenantId)
      .eq("linked_type", "project")
      .eq("linked_id", id)
      .order("scheduled_at", { ascending: false });

    return NextResponse.json({
      project: {
        ...flattenedProject,
        // Flatten client and property info for frontend convenience
        client_name: pClient?.name || flattenedProject.client_name || "Unknown Client",
        client_email: pClient?.email || flattenedProject.client_email,
        client_phone: pClient?.phone || flattenedProject.client_phone,
        property_name: pProperty?.property_name || project.property?.property_name || flattenedProject.property_name || "Unknown Property",
        property: pProperty || project.property, // Use pProperty if available, fallback to initial query result
        priority: fullProject?.priority,
        contract_value: fullProject?.contract_value ?? null,
        actual_cost: fullProject?.actual_cost,
        lead_id: fullProject?.lead_id, // Include lead_id for navigation
        won_amount: pLead?.won_amount, // Include won amount from lead
        payment_milestones: paymentMilestones || [],
        agreed_plan: agreedPlan,
        calendar_events: calendarEvents || [],
      },
    });
  } catch (error) {
    log.error("Unhandled error fetching project", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id] - Update project
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

    const gate = await requireProjectAccess(supabase, {
      projectId: id,
      user,
      permissions: guard.permissions,
      mode: "write",
    });
    if (!gate.ok) return gate.response;

    const body = await request.json();

    // Separate property updates from project updates
    // Extended property fields need to be extracted
    const {
        property_category,
        property_subtype,
        age_of_property,
        parking_slots,
        has_lift,
        has_gym,
        has_power_backup,
        has_security,
        // Existing flat property fields that we want to sync to property table
        property_name,
        property_type,
        flat_number, // maps to unit_number
        carpet_area_sqft, // maps to carpet_area
        site_address, // maps to address_line1
        city,
        pincode,
        // Client updates
        client_name,
        client_email,
        client_phone,
        // Project specific fields that shouldn't be forwarded
        payment_milestones,
        project_manager,
        ...projectUpdateData
    } = body;

    // 1. Update Project Table
    const { data: existingProject, error: fetchError } = await supabase
        .from("projects")
        /*
         * status is read so a close can be told from an edit that merely echoes
         * the current status back. The rest are read to diff against, so the
         * timeline entry can say what actually changed rather than "edited".
         */
        .select(
          "property_id, status, name, notes, description, priority, project_category, project_manager_id, expected_start_date, expected_end_date, actual_start_date, kicked_off_at"
        )
        .eq("id", id)
        .eq("tenant_id", user.tenantId)
        .single();

    if (fetchError) throw fetchError;

    // Prepare project updates (keep original project fields)
    // We can also update the denormalized fields on project if they exist there, 
    // but we prioritize checking what columns actually exist. 
    // Based on schemas, project has property_type, etc. So we should update project too if those columns exist.
    // However, the prompt says "removed from projects table".
    // So we primarily rely on `projectUpdateData`. 
    // We will manually add back the ones that ARE on the project table if needed.
    // Checking types: Project has property_type, project_category, status, etc.
    
    // Allowlist, not a spread of whatever arrived.
    //
    // This previously did `{ ...projectUpdateData }` - every body key that the
    // destructure above did not happen to name went straight into the UPDATE.
    // The .eq("tenant_id") below decides which row is matched but not what the
    // SET clause may touch, so a request carrying tenant_id could hand the
    // project to another business, and created_by, project_number or id were
    // equally writable. It also meant sending back a field the projects table
    // does not have - project_type and quoted_amount are computed for the
    // response, not columns - failed the whole request with a schema error.
    //
    // Identity and audit columns are absent on purpose: id, tenant_id,
    // project_number, created_by, created_at. is_active is absent too, so
    // archiving stays with DELETE, which requires projects.delete.
    const EDITABLE_PROJECT_FIELDS = [
      "name",
      "description",
      "status",
      "priority",
      "project_category",
      "expected_start_date",
      "expected_end_date",
      "actual_start_date",
      "actual_end_date",
      "actual_cost",
      "overall_progress",
      "notes",
      "project_manager_id",
      "client_id",
      "property_id",
      "quotation_id",
      "baseline_quotation_id",
      "lead_id",
      "next_follow_up_at",
    ] as const;

    const projectUpdates: Record<string, unknown> = {};
    for (const field of EDITABLE_PROJECT_FIELDS) {
      if (field in projectUpdateData) {
        projectUpdates[field] = (projectUpdateData as Record<string, unknown>)[field];
      }
    }

    /*
     * new -> in_progress is kick-off, and only kick-off. Setting the status by
     * hand would skip the plan, the agreed dates and the timeline entry that
     * make a project's start a recorded thing. The Plan tab has the checklist.
     */
    if (
      projectUpdates.status === "in_progress" &&
      existingProject?.status === "new" &&
      !existingProject?.kicked_off_at
    ) {
      return NextResponse.json(
        {
          error: "Kick off the project from its Plan tab to move it to In Progress.",
          reason: "kickoff_required",
        },
        { status: 409 }
      );
    }

    /*
     * A project moved back to in_progress by hand (from on_hold) has started,
     * if nothing else has said so. Tasks stamp this through a trigger when the
     * first one starts. Never overwrites a date already set or supplied.
     */
    if (
      projectUpdates.status === "in_progress" &&
      existingProject?.status !== "in_progress" &&
      !existingProject?.actual_start_date &&
      projectUpdates.actual_start_date === undefined
    ) {
      projectUpdates.actual_start_date = new Date().toISOString().slice(0, 10);
    }

    const rejected = Object.keys(projectUpdateData).filter(
      (k) => !(EDITABLE_PROJECT_FIELDS as readonly string[]).includes(k)
    );
    if (rejected.length > 0) {
      // Not an error - the detail response carries plenty of derived fields a
      // form may echo back. Logged so a genuinely missing column is visible
      // rather than silently discarded.
      log.debug("Ignored non-editable project fields", {
        projectId: id,
        fields: rejected,
      });
    }

    // Closing a project requires it to be clear, the same way winning a lead
    // does. Without this, "completed" was a free-text value anyone could set
    // while the playbook still showed twenty steps open - and the playbook was
    // the honest one.
    const isClosing =
      projectUpdates.status === "completed" &&
      existingProject?.status !== "completed";

    if (isClosing) {
      const check = await projectClosingBlockers(supabase, id);
      if (!check.ok) {
        return NextResponse.json(
          {
            error: describeBlockers(check.blockers),
            reason: "project_not_clear",
            blockers: check.blockers,
          },
          { status: 409 }
        );
      }
    }

    const { data: project, error } = await supabase
      .from("projects")
      .update(projectUpdates)
      .eq("id", id)
      .eq("tenant_id", user.tenantId)
      .select()
      .single();

    if (error) {
      log.error("Error updating project", error, { projectId: id });
      return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
    }

    // The project is finished, so its playbook run is too. Leaving the run
    // active would keep the plan open on a closed project and keep it counting
    // toward "one run at a time".
    if (isClosing) {
      const { data: activeRun } = await supabase
        .from("procedure_runs")
        .select("id")
        .eq("related_type", "project")
        .eq("related_id", id)
        .eq("status", "active")
        .maybeSingle();

      if (activeRun) {
        await supabase
          .from("procedure_runs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", activeRun.id);
      }
    }

    log.info("Project updated", {
      projectId: id,
      fields: Object.keys(projectUpdates),
    });

    /*
     * Things that went wrong without failing the request. The project's own
     * columns are written first, so a later failure on the linked property or
     * client cannot be reported as "the save failed" - but it must be reported.
     */
    const warnings: string[] = [];

    // 2. Update Property Table if property_id exists
    if (existingProject?.property_id) {
      const propertyUpdates: any = {};
      
      // Map fields
      if (property_name !== undefined) propertyUpdates.property_name = property_name;
      if (property_type !== undefined) propertyUpdates.property_type = property_type;
      if (flat_number !== undefined) propertyUpdates.unit_number = flat_number;
      if (carpet_area_sqft !== undefined) propertyUpdates.carpet_area = carpet_area_sqft;
      if (site_address !== undefined) propertyUpdates.address_line1 = site_address;
      if (city !== undefined) propertyUpdates.city = city;
      if (pincode !== undefined) propertyUpdates.pincode = pincode;

      /*
       * The category and subtype the lead also edits.
       *
       * `properties.category` is what the lead calls property_category; the
       * column names differ and the mapping belongs here rather than in the
       * form.
       */
      if (property_category !== undefined)
        propertyUpdates.category = property_category;
      if (property_subtype !== undefined)
        propertyUpdates.property_subtype = property_subtype;

      /*
       * There used to be ten more mappings here - block_tower, built_up_area,
       * super_built_up_area, bedrooms, bathrooms, balconies, floor_number,
       * total_floors, facing, furnishing_status - and **not one of those columns
       * exists on `properties`**.
       *
       * PostgREST rejects the whole statement when any column in it is unknown,
       * and `block_tower` was sent on every save because the form always
       * included it. So every property edit made from a project - name, type,
       * unit number, carpet area, address, city, pincode - was refused as a
       * batch, and the error below was logged and swallowed. That is why project
       * details drifted from the lead's: they could not be corrected here.
       *
       * Verified against the live schema: the update succeeds without
       * block_tower and is rejected with it.
       */
      if (Object.keys(propertyUpdates).length > 0) {
        const { error: propError } = await supabase
          .from("properties")
          .update(propertyUpdates)
          .eq("id", existingProject.property_id);

        if (propError) {
          log.error("Error updating linked property", propError, {
            projectId: id,
            propertyId: existingProject.property_id,
          });
          /*
           * Reported, not swallowed. The project's own columns have already been
           * written so failing the whole request would misdescribe what
           * happened - but silence is how the bug above survived, so the caller
           * is told and can show it.
           */
          warnings.push(
            "The project was saved, but its property details could not be updated."
          );
        }
      }
    }

    // 3. Update Client Table if client information is provided
    if (client_name !== undefined || client_email !== undefined || client_phone !== undefined) {
      // First, fetch the current project to get client_id
      const { data: currentProject, error: currentProjectError } = await supabase
        .from("projects")
        .select("client_id")
        .eq("id", id)
        .eq("tenant_id", user.tenantId)
        .single();

      if (!currentProjectError && currentProject?.client_id) {
        const clientUpdates: any = {};
        
        if (client_name !== undefined) clientUpdates.name = client_name;
        if (client_email !== undefined) clientUpdates.email = client_email;
        if (client_phone !== undefined) clientUpdates.phone = client_phone;

        if (Object.keys(clientUpdates).length > 0) {
          const { error: clientError } = await supabase
            .from("clients")
            .update(clientUpdates)
            .eq("id", currentProject.client_id)
            .eq("tenant_id", user.tenantId);
          
          if (clientError) {
            log.error("Error updating linked client", clientError, { projectId: id, clientId: currentProject.client_id });
            warnings.push(
              "The project was saved, but its client details could not be updated."
            );
          }
        }
      }
    }

    /*
     * The timeline gets told.
     *
     * An edit to a project left no trace at all: the Timeline tab showed tasks,
     * documents and meetings while a change of manager, dates or status passed
     * silently. `logProjectActivity` swallows its own failures, so this cannot
     * break the save it describes.
     *
     * Two entries rather than one, because they are read differently. The
     * `project_updated` line says which fields moved and is scanned; the
     * `note_added` line carries the note itself and is read. Folding a note into
     * a field list would bury the only part with something to say.
     *
     * `project_updated` and `note_added` are both real members of
     * project_activity_type_enum - verified against the live enum, because an
     * invalid value here fails the insert and the logger swallows it.
     */
    const changed: string[] = [];
    const diff = (label: string, before: unknown, after: unknown) => {
      if (after === undefined) return;
      const a = before ?? "";
      const b = after ?? "";
      if (String(a) !== String(b)) changed.push(label);
    };
    /*
     * From `body`, not from destructured names: these reach the update through
     * the EDITABLE_PROJECT_FIELDS allowlist rather than being pulled out
     * individually, so there are no locals to compare.
     */
    const b = body as Record<string, unknown>;
    diff("name", existingProject?.name, b.name);
    diff("status", existingProject?.status, b.status);
    diff("priority", existingProject?.priority, b.priority);
    diff("category", existingProject?.project_category, b.project_category);
    diff("project manager", existingProject?.project_manager_id, b.project_manager_id);
    diff("expected start", existingProject?.expected_start_date, b.expected_start_date);
    diff("expected end", existingProject?.expected_end_date, b.expected_end_date);
    diff("description", existingProject?.description, b.description);

    const notesChanged =
      b.notes !== undefined &&
      String(existingProject?.notes ?? "") !== String(b.notes ?? "");

    if (changed.length > 0) {
      await logProjectActivity(supabase, {
        projectId: id,
        type: "project_updated",
        title: "Project details updated",
        description: `Changed: ${changed.join(", ")}.`,
        userId: user.id,
      });
    }

    if (notesChanged && String(b.notes ?? "").trim()) {
      await logProjectActivity(supabase, {
        projectId: id,
        type: "note_added",
        title: "Note updated on the project",
        description: String(b.notes).trim(),
        userId: user.id,
      });
    }

    // Warnings, so a half-applied save says so rather than looking clean.
    return NextResponse.json(
      warnings.length ? { project, warnings } : { project }
    );
  } catch (error) {
    log.error("Unhandled error updating project", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Soft delete project
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const log = requestLogger(request);

  try {
    // Archiving is its own permission - holding projects.edit is not enough.
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["projects.delete"],
      loadPermissions: true,
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

    // Confirms the project exists in this tenant before reporting success.
    // Without it the update matched nothing and still answered { success:
    // true }, so a wrong id looked exactly like a completed archive.
    const gate = await requireProjectAccess(supabase, {
      projectId: id,
      user,
      permissions: guard.permissions,
      mode: "write",
    });
    if (!gate.ok) return gate.response;

    // Soft delete by setting is_active = false
    const { error } = await supabase
      .from("projects")
      .update({ is_active: false })
      .eq("id", id)
      .eq("tenant_id", user.tenantId);

    if (error) {
      log.error("Error archiving project", error, { projectId: id });
      return NextResponse.json({ error: "Failed to archive project" }, { status: 500 });
    }

    log.info("Project archived", {
      projectId: id,
      projectNumber: gate.project.project_number,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Unhandled error archiving project", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
