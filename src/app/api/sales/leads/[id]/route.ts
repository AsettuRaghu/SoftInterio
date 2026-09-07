import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import {
  logLeadActivity,
  describeChanges,
  LEAD_FIELD_LABELS,
} from "@/lib/activity/log";
import type { UpdateLeadInput } from "@/types/leads";
import { validateLeadDates, type LeadDateFields } from "@/lib/dates/lead-dates";
import { leadAccess, canReadLead, canWriteLead } from "@/lib/leads/access";
import { requestLogger } from "@/lib/logger/request";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/sales/leads/[id] - Get single lead with all related data
export async function GET(request: NextRequest, { params }: RouteParams) {
  let log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();
    log = requestLogger(request, { userId: user.id });
    const access = leadAccess(guard.permissions, user.isSuperAdmin);

    if (access.denied) {
      log.warn("Lead read refused: no permission", { leadId: id });
      return NextResponse.json(
        { error: "You do not have permission to view leads" },
        { status: 403 }
      );
    }

    // Use admin client for fetching leads with user data (bypasses RLS for foreign key joins)
    const supabaseAdmin = createAdminClient();

    // Get user's tenant first for security
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get lead with related data using admin client
    const { data: lead, error: leadError } = await supabaseAdmin
      .from("leads")
      .select(
        `
        *,
        client:clients!leads_client_id_fkey(id, name, phone, email, city, address_line1, pincode),
        property:properties!leads_property_id_fkey(id, property_name, unit_number, category, property_type, property_subtype, carpet_area, address_line1, city, pincode),
        assigned_user:users!leads_assigned_to_fkey(id, name, avatar_url, email),
        created_user:users!leads_created_by_fkey(id, name, avatar_url, email)
      `
      )
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (leadError) {
      if (leadError.code === "PGRST116") {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }
      log.error("Error fetching lead", leadError, { leadId: id });
      return NextResponse.json(
        { error: "Failed to fetch lead" },
        { status: 500 }
      );
    }

    // Checked before the related data is fetched, so a lead the caller may not
    // see does not have its notes, documents and activities read out of the
    // database on the way to being refused. Answered as 404 rather than 403:
    // whether a particular lead exists is itself information.
    if (!canReadLead(access, lead, user.id)) {
      log.warn("Lead access refused", { leadId: id });
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Fetch related data in parallel using admin client
    const [
      { data: familyMembers },
      { data: stageHistory },
      { data: activities },
      { data: notes },
      { data: documents },
      { data: tasks },
      { data: quotations },
      { data: calendarEvents },
    ] = await Promise.all([
      supabaseAdmin
        .from("lead_family_members")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("lead_stage_history")
        .select(
          `
          *,
          changed_user:users!lead_stage_history_changed_by_fkey(id, name, avatar_url)
        `
        )
        .eq("lead_id", id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("lead_activities")
        .select(
          `
          *,
          created_user:users!lead_activities_created_by_fkey(id, name, avatar_url)
        `
        )
        .eq("lead_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("lead_notes")
        .select(
          `
          *,
          created_user:users!lead_notes_created_by_fkey(id, name, avatar_url)
        `
        )
        .eq("lead_id", id)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false }),
      // Fetch documents from unified documents table
      supabaseAdmin
        .from("documents")
        .select(
          `
          *,
          uploaded_user:users!documents_uploaded_by_fkey(id, name, avatar_url)
        `
        )
        .eq("linked_type", "lead")
        .eq("linked_id", id)
        .eq("is_latest", true)
        .order("created_at", { ascending: false }),
      // Fetch tasks from main tasks table (linked via related_type/related_id)
      supabaseAdmin
        .from("tasks")
        .select(
          `
          *,
          assigned_user:users!tasks_assigned_to_fkey(id, name, avatar_url, email),
          created_user:users!tasks_created_by_fkey(id, name, avatar_url, email)
        `
        )
        .eq("tenant_id", userData.tenant_id)
        .eq("related_type", "lead")
        .eq("related_id", id)
        .is("parent_task_id", null)
        .order("created_at", { ascending: false }),
      // Fetch quotations with relationships
      supabaseAdmin
        .from("quotations")
        .select(`
          *,
          lead:leads!quotations_lead_id_fkey(
            id,
            lead_number,
            client:clients!leads_client_id_fkey(id, name, phone, email)
          ),
          client:clients!quotations_client_id_fkey(id, name, phone, email),
          assigned_user:users!quotations_assigned_to_fkey(id, name, avatar_url),
          created_user:users!quotations_created_by_fkey(id, name, avatar_url)
        `)
        .eq("lead_id", id)
        .order("version", { ascending: false }),
      // Fetch calendar events linked to this lead
      supabaseAdmin
        .from("calendar_events")
        .select(
          `
          *,
          created_user:users!calendar_events_created_by_fkey(id, name, avatar_url)
        `
        )
        .eq("tenant_id", userData.tenant_id)
        .eq("linked_type", "lead")
        .eq("linked_id", id)
        .order("scheduled_at", { ascending: false }),
    ]);

    // Fetch subtasks for parent tasks
    if (tasks && tasks.length > 0) {
      const parentTaskIds = tasks.map((t) => t.id);
      const { data: allSubtasks } = await supabaseAdmin
        .from("tasks")
        .select(
          `
          *,
          assigned_user:users!tasks_assigned_to_fkey(id, name, avatar_url, email)
        `
        )
        .in("parent_task_id", parentTaskIds)
        .order("created_at", { ascending: true });

      if (allSubtasks && allSubtasks.length > 0) {
        // Group subtasks by parent
        const subtaskMap = new Map<string, any[]>();
        const countMap = new Map<
          string,
          { total: number; completed: number }
        >();

        allSubtasks.forEach((st) => {
          if (!subtaskMap.has(st.parent_task_id)) {
            subtaskMap.set(st.parent_task_id, []);
          }
          subtaskMap.get(st.parent_task_id)!.push(st);

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

        // Attach subtasks and counts to parent tasks
        tasks.forEach((task: any) => {
          const counts = countMap.get(task.id);
          if (counts) {
            task.subtask_count = counts.total;
            task.completed_subtask_count = counts.completed;
          } else {
            task.subtask_count = 0;
            task.completed_subtask_count = 0;
          }
          task.subtasks = subtaskMap.get(task.id) || [];
        });
      } else {
        // No subtasks, set counts to 0
        tasks.forEach((task: any) => {
          task.subtask_count = 0;
          task.completed_subtask_count = 0;
          task.subtasks = [];
        });
      }

      // Add related_name for each task (all are linked to this lead)
      const leadClientName = (lead.client as { name?: string } | null)?.name || "Unknown Client";
      const relatedName = lead.lead_number 
        ? `${lead.lead_number} • ${leadClientName}` 
        : leadClientName;
      
      tasks.forEach((task: any) => {
        task.related_name = relatedName;
      });
    }

    // Debug: Log tasks being fetched
    log.debug("Lead detail loaded", { leadId: id, taskCount: tasks?.length || 0 });

    // Add spaces and components counts to quotations
    if (quotations && quotations.length > 0) {
      const quotationIds = quotations.map((q: any) => q.id);

      // Fetch spaces counts
      const { data: spaceCounts } = await supabaseAdmin
        .from("quotation_spaces")
        .select("quotation_id")
        .in("quotation_id", quotationIds);

      // Fetch components counts
      const { data: componentCounts } = await supabaseAdmin
        .from("quotation_components")
        .select("quotation_id")
        .in("quotation_id", quotationIds);

      // Create count maps
      const spacesCountMap: { [key: string]: number } = {};
      const componentsCountMap: { [key: string]: number } = {};

      if (spaceCounts) {
        spaceCounts.forEach((item: any) => {
          spacesCountMap[item.quotation_id] = (spacesCountMap[item.quotation_id] || 0) + 1;
        });
      }

      if (componentCounts) {
        componentCounts.forEach((item: any) => {
          componentsCountMap[item.quotation_id] = (componentsCountMap[item.quotation_id] || 0) + 1;
        });
      }

      // Add counts to each quotation
      quotations.forEach((q: any) => {
        q.spaces_count = spacesCountMap[q.id] || 0;
        q.components_count = componentsCountMap[q.id] || 0;
      });
    }

    return NextResponse.json({
      lead,
      familyMembers: familyMembers || [],
      stageHistory: stageHistory || [],
      activities: activities || [],
      notes: notes || [],
      documents: documents || [],
      tasks: tasks || [],
      quotations: quotations || [],
      calendarEvents: calendarEvents || [],
    });
  } catch (error) {
    log.error("Get lead API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/sales/leads/[id] - Update lead and linked client/property records
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  let log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();
    log = requestLogger(request, { userId: user.id });
    const access = leadAccess(guard.permissions, user.isSuperAdmin);

    const body: UpdateLeadInput = await request.json();

    // Check lead exists and get current state with linked records
    const { data: existingLead, error: fetchError } = await supabase
      .from("leads")
      .select(
        `id, stage, assigned_to, client_id, property_id, tenant_id,
         service_type, lead_source, target_start_date, target_end_date,
         budget_range, won_amount, contract_signed_date,
         expected_project_start, priority,
         client:clients!leads_client_id_fkey(name, phone, email),
         property:properties!leads_property_id_fkey(
           property_name, unit_number, category, property_type,
           property_subtype, carpet_area, address_line1, city, pincode)`
      )
      .eq("id", id)
      .single();

    if (fetchError || !existingLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // leads.edit changes any lead; leads.edit_own changes only leads assigned
    // to the caller. Checked against the stored assignment rather than the
    // request body, or a caller could reassign a lead to themselves in the
    // same request that grants them the right to edit it.
    if (!canWriteLead(access, existingLead, user.id)) {
      log.warn("Lead update refused", {
        leadId: id,
        assignedTo: existingLead.assigned_to,
      });
      return NextResponse.json(
        { error: "You do not have permission to edit this lead" },
        { status: 403 }
      );
    }

    // Prevent modification of closed leads (won/lost/disqualified)
    // These leads are read-only for audit purposes
    if (["won", "lost", "disqualified"].includes(existingLead.stage)) {
      return NextResponse.json(
        {
          error: `Cannot modify a ${existingLead.stage} lead. This lead is closed and read-only. ${existingLead.stage === 'won' ? 'Make changes at the project level instead.' : 'This lead is archived.'}`,
          code: "LEAD_CLOSED",
          stage: existingLead.stage
        },
        { status: 403 }
      );
    }

    // Snapshot the fields the edit modal can touch, flattened into the same
    // key space the request body uses, so the two can be diffed directly.
    // Taken before STEP 1 - the client and property rows are updated in place
    // below, and re-reading afterwards would compare a row against itself.
    const beforeClient: any = Array.isArray((existingLead as any).client)
      ? (existingLead as any).client[0]
      : (existingLead as any).client;
    const beforeProperty: any = Array.isArray((existingLead as any).property)
      ? (existingLead as any).property[0]
      : (existingLead as any).property;

    const before: Record<string, unknown> = {
      client_name: beforeClient?.name ?? null,
      phone: beforeClient?.phone ?? null,
      email: beforeClient?.email ?? null,
      property_name: beforeProperty?.property_name ?? null,
      unit_number: beforeProperty?.unit_number ?? null,
      property_category: beforeProperty?.category ?? null,
      property_type: beforeProperty?.property_type ?? null,
      property_subtype: beforeProperty?.property_subtype ?? null,
      carpet_area: beforeProperty?.carpet_area ?? null,
      property_address: beforeProperty?.address_line1 ?? null,
      property_city: beforeProperty?.city ?? null,
      property_pincode: beforeProperty?.pincode ?? null,
      service_type: (existingLead as any).service_type ?? null,
      lead_source: (existingLead as any).lead_source ?? null,
      target_start_date: (existingLead as any).target_start_date ?? null,
      target_end_date: (existingLead as any).target_end_date ?? null,
      budget_range: (existingLead as any).budget_range ?? null,
      assigned_to: existingLead.assigned_to ?? null,
      won_amount: (existingLead as any).won_amount ?? null,
      contract_signed_date: (existingLead as any).contract_signed_date ?? null,
      expected_project_start: (existingLead as any).expected_project_start ?? null,
      priority: (existingLead as any).priority ?? null,
    };

    // Reject nonsensical dates before any write runs. The property update in
    // STEP 2 lands before the lead update, so failing later than this would
    // leave half the change applied.
    const dateProblems = validateLeadDates(
      body as LeadDateFields,
      existingLead as LeadDateFields
    );
    if (dateProblems.length > 0) {
      return NextResponse.json(
        { error: dateProblems.join(". "), invalidDates: dateProblems },
        { status: 400 }
      );
    }

    // Initialize lead update data object (may be populated by property creation below)
    const leadUpdateData: Record<string, unknown> = {};

    // STEP 1: Update Client record if client fields provided
    const clientFields = ["client_name", "phone", "email"];
    const hasClientUpdates = clientFields.some((f) => f in body);
    
    if (hasClientUpdates && existingLead.client_id) {
      const clientUpdateData: Record<string, unknown> = {};
      if ("client_name" in body) clientUpdateData.name = body.client_name;
      if ("phone" in body) clientUpdateData.phone = body.phone;
      if ("email" in body) clientUpdateData.email = body.email?.toLowerCase() || null;
      
      if (Object.keys(clientUpdateData).length > 0) {
        const { error: clientError } = await supabase
          .from("clients")
          .update(clientUpdateData)
          .eq("id", existingLead.client_id);
        
        if (clientError) {
          log.error("Error updating client", clientError);
          return NextResponse.json(
            { error: "Failed to update client record" },
            { status: 500 }
          );
        }
      }
    }

    // STEP 2: Update Property record if property fields provided
    const propertyFields = [
      "property_name", "unit_number", "property_category", "property_type",
      "property_subtype", "carpet_area", "property_address", "property_city", "property_pincode"
    ];
    const hasPropertyUpdates = propertyFields.some((f) => f in body);
    
    if (hasPropertyUpdates) {
      const propertyUpdateData: Record<string, unknown> = {};
      if ("property_name" in body) propertyUpdateData.property_name = body.property_name;
      if ("unit_number" in body) propertyUpdateData.unit_number = body.unit_number;
      if ("property_category" in body) propertyUpdateData.category = body.property_category;
      if ("property_type" in body) propertyUpdateData.property_type = body.property_type;
      if ("property_subtype" in body) propertyUpdateData.property_subtype = body.property_subtype;
      if ("carpet_area" in body) propertyUpdateData.carpet_area = body.carpet_area;
      if ("property_address" in body) propertyUpdateData.address_line1 = body.property_address;
      if ("property_city" in body) propertyUpdateData.city = body.property_city;
      if ("property_pincode" in body) propertyUpdateData.pincode = body.property_pincode;
      
      if (Object.keys(propertyUpdateData).length > 0) {
        if (existingLead.property_id) {
          // Update existing property
          const { error: propertyError } = await supabase
            .from("properties")
            .update(propertyUpdateData)
            .eq("id", existingLead.property_id);
          
          if (propertyError) {
            log.error("Error updating property", propertyError);
            return NextResponse.json(
              { error: `Failed to update property: ${propertyError.message}` },
              { status: 500 }
            );
          }
        } else {
          // Create new property if one doesn't exist
          const { data: newProperty, error: createPropertyError } = await supabase
            .from("properties")
            .insert({
              tenant_id: existingLead.tenant_id,
              property_name: body.property_name || null,
              unit_number: body.unit_number || null,
              category: body.property_category || "residential",
              property_type: body.property_type || "apartment",
              property_subtype: body.property_subtype || null,
              carpet_area: body.carpet_area || null,
              address_line1: body.property_address || null,
              city: body.property_city || "Unknown",
              pincode: body.property_pincode || null,
            })
            .select("id")
            .single();
          
          if (createPropertyError) {
            log.error("Error creating property", createPropertyError);
            return NextResponse.json(
              { error: `Failed to create property: ${createPropertyError.message}` },
              { status: 500 }
            );
          }
          
          if (newProperty) {
            // Link the new property to the lead - use leadUpdateData directly
            leadUpdateData.property_id = newProperty.id;
          }
        }
      }
    }

    // STEP 3: Build lead update object
    const leadAllowedFields = [
      "service_type",
      "lead_source",
      "target_start_date",
      "target_end_date",
      "budget_range",
      "assigned_to",
      "won_amount",
      "contract_signed_date",
      "expected_project_start",
      "priority",
      "property_id", // In case we created a new property
    ];

    for (const field of leadAllowedFields) {
      if (field in body) {
        leadUpdateData[field] = body[field as keyof UpdateLeadInput];
      }
    }

    // Only update lead if there are lead-specific fields to update
    if (Object.keys(leadUpdateData).length > 0) {
      const { error: updateError } = await supabase
        .from("leads")
        .update(leadUpdateData)
        .eq("id", id);

      if (updateError) {
        log.error("Error updating lead", updateError);
        return NextResponse.json(
          { error: "Failed to update lead" },
          { status: 500 }
        );
      }
    }

    // STEP 3b: Record what actually changed on the timeline.
    //
    // Only fields present in the request are considered, and describeChanges
    // drops those whose value did not move - so re-saving the modal without
    // touching anything writes nothing, rather than a stream of empty
    // "Lead updated" rows.
    const after: Record<string, unknown> = {};
    for (const field of Object.keys(before)) {
      if (field in body) after[field] = body[field as keyof UpdateLeadInput];
    }
    // STEP 1 lowercases the address before storing it, so compare the same
    // form - otherwise merely retyping an email in different case reads as a
    // change that never happened.
    if ("email" in after) {
      after.email = (after.email as string | null)?.toLowerCase() || null;
    }

    // A change of owner is what a manager scans the timeline for, so it gets
    // its own entry and is kept out of the generic field diff.
    const reassigned =
      "assigned_to" in after &&
      (before.assigned_to ?? null) !== (after.assigned_to ?? null);
    delete after.assigned_to;

    if (reassigned) {
      // Resolve both ids to names in one round trip; an unassigned side is null.
      const ids = [before.assigned_to, body.assigned_to].filter(
        Boolean
      ) as string[];
      const { data: people } = ids.length
        ? await supabase.from("users").select("id, name").in("id", ids)
        : { data: [] as { id: string; name: string }[] };
      const nameOf = (uid: unknown) =>
        uid ? people?.find((p) => p.id === uid)?.name ?? "Unknown user" : "Unassigned";

      await logLeadActivity(supabase, {
        leadId: id,
        tenantId: existingLead.tenant_id,
        userId: user.id,
        type: "assignment_changed",
        title: "Lead reassigned",
        description: `${nameOf(before.assigned_to)} → ${nameOf(body.assigned_to)}`,
      });
    }

    const summary = describeChanges(before, after, LEAD_FIELD_LABELS);
    if (summary) {
      await logLeadActivity(supabase, {
        leadId: id,
        tenantId: existingLead.tenant_id,
        userId: user.id,
        type: "lead_updated",
        title: "Lead details updated",
        description: summary,
      });
    }

    // STEP 4: Fetch and return updated lead with joined data
    const supabaseAdmin = createAdminClient();
    const { data: lead, error: refetchError } = await supabaseAdmin
      .from("leads")
      .select(
        `
        *,
        client:clients!leads_client_id_fkey(id, name, phone, email, city),
        property:properties!leads_property_id_fkey(id, property_name, unit_number, category, property_type, property_subtype, carpet_area, address_line1, city, pincode),
        assigned_user:users!leads_assigned_to_fkey(id, name, avatar_url),
        created_user:users!leads_created_by_fkey(id, name, avatar_url)
      `
      )
      .eq("id", id)
      .single();

    if (refetchError) {
      log.error("Error refetching lead", refetchError);
      return NextResponse.json(
        { error: "Lead updated but failed to fetch" },
        { status: 500 }
      );
    }

    return NextResponse.json({ lead });
  } catch (error) {
    log.error("Update lead API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/sales/leads/[id] - Delete lead (soft delete or hard delete based on business rules)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  let log = requestLogger(request);

  try {
    // Protect API route
    const guard = await protectApiRoute(request, { loadPermissions: true });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();
    log = requestLogger(request, { userId: user.id });

    // This handler carried a "TODO: Check user has delete permission" and then
    // hard-deleted the lead. Any signed-in member of the tenant could destroy
    // any lead, with its notes, activities and stage history, permanently.
    //
    // leads.delete is deliberately narrow - Owner, Admin and Sales Manager -
    // and unlike editing there is no _own variant: deleting is not something a
    // salesperson does to their own pipeline.
    if (!user.isSuperAdmin && !guard.permissions?.has("leads.delete")) {
      log.warn("Lead delete refused", { leadId: id });
      return NextResponse.json(
        { error: "You do not have permission to delete leads" },
        { status: 403 }
      );
    }

    // Read before deleting: afterwards there is nothing left to say what was
    // destroyed, and a deletion is the one action nobody can undo.
    const { data: doomed } = await supabase
      .from("leads")
      .select("lead_number, stage, assigned_to, client:clients(name)")
      .eq("id", id)
      .maybeSingle();

    const { error: deleteError } = await supabase
      .from("leads")
      .delete()
      .eq("id", id);

    if (deleteError) {
      log.error("Error deleting lead", deleteError, { leadId: id });
      return NextResponse.json(
        { error: "Failed to delete lead" },
        { status: 500 }
      );
    }

    log.info("Lead deleted", {
      leadId: id,
      leadNumber: doomed?.lead_number,
      stage: doomed?.stage,
      client: (doomed?.client as { name?: string } | null)?.name,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Delete lead API error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
