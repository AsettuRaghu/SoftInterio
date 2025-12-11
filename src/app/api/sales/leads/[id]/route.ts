import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import type { UpdateLeadInput } from "@/types/leads";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/sales/leads/[id] - Get single lead with all related data
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
      console.error("Error fetching lead:", leadError);
      return NextResponse.json(
        { error: "Failed to fetch lead" },
        { status: 500 }
      );
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
      supabaseAdmin
        .from("lead_documents")
        .select(
          `
          *,
          uploaded_user:users!lead_documents_uploaded_by_fkey(id, name, avatar_url)
        `
        )
        .eq("lead_id", id)
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
        .eq("related_type", "lead")
        .eq("related_id", id)
        .is("parent_task_id", null)
        .order("created_at", { ascending: false }),
      // Fetch quotations using the view (pulls client data from lead)
      supabaseAdmin
        .from("quotations_with_lead")
        .select("*")
        .eq("lead_id", id)
        .order("version", { ascending: false }),
    ]);

    return NextResponse.json({
      lead,
      familyMembers: familyMembers || [],
      stageHistory: stageHistory || [],
      activities: activities || [],
      notes: notes || [],
      documents: documents || [],
      tasks: tasks || [],
      quotations: quotations || [],
    });
  } catch (error) {
    console.error("Get lead API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/sales/leads/[id] - Update lead
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

    const body: UpdateLeadInput = await request.json();

    // Check lead exists and get current state
    const { data: existingLead, error: fetchError } = await supabase
      .from("leads")
      .select("id, stage, assigned_to")
      .eq("id", id)
      .single();

    if (fetchError || !existingLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Prevent modification of terminal leads
    if (["won", "lost", "disqualified"].includes(existingLead.stage)) {
      return NextResponse.json(
        {
          error: `Cannot modify a ${existingLead.stage} lead`,
        },
        { status: 400 }
      );
    }

    // Define required fields per stage
    const getRequiredFieldsForStage = (stage: string): string[] => {
      const newFields = ["client_name", "phone"];
      const qualifiedFields = [
        ...newFields,
        "property_type",
        "service_type",
        "property_name",
        "target_start_date",
        "target_end_date",
      ];
      const requirementFields = [
        ...qualifiedFields,
        "carpet_area_sqft",
        "flat_number",
        "budget_range",
      ];

      switch (stage) {
        case "new":
          return newFields;
        case "qualified":
          return qualifiedFields;
        case "requirement_discussion":
        case "proposal_discussion":
          return requirementFields;
        default:
          return newFields;
      }
    };

    const requiredFields = getRequiredFieldsForStage(existingLead.stage);
    const fieldLabels: Record<string, string> = {
      client_name: "Client Name",
      phone: "Phone Number",
      property_type: "Property Type",
      service_type: "Service Type",
      property_name: "Property Name",
      target_start_date: "Target Start Date",
      target_end_date: "Target End Date",
      carpet_area_sqft: "Carpet Area",
      flat_number: "Flat/Unit Number",
      budget_range: "Budget Range",
    };

    // Check if any required field is being set to empty/null
    const emptyRequiredFields: string[] = [];
    for (const field of requiredFields) {
      if (field in body) {
        const value = body[field as keyof typeof body];
        if (value === null || value === undefined || value === "") {
          emptyRequiredFields.push(fieldLabels[field] || field);
        }
      }
    }

    if (emptyRequiredFields.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot clear required fields for the "${existingLead.stage}" stage`,
          missingFields: emptyRequiredFields,
        },
        { status: 400 }
      );
    }

    // Build update object (exclude fields that shouldn't be directly updated)
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      "client_name",
      "phone",
      "email",
      "property_type",
      "service_type",
      "lead_source",
      "lead_source_detail",
      "target_start_date",
      "target_end_date",
      "property_name",
      "flat_number",
      "property_address",
      "property_city",
      "property_pincode",
      "carpet_area_sqft",
      "budget_range",
      "estimated_value",
      "project_scope",
      "special_requirements",
      "priority",
      "lead_score",
      "next_followup_date",
      "next_followup_notes",
      "assigned_to",
    ];

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field as keyof UpdateLeadInput];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Update lead
    const { data: lead, error: updateError } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", id)
      .select(
        `
        *,
        assigned_user:users!leads_assigned_to_fkey(id, name, avatar_url),
        created_user:users!leads_created_by_fkey(id, name, avatar_url)
      `
      )
      .single();

    if (updateError) {
      console.error("Error updating lead:", updateError);
      return NextResponse.json(
        { error: "Failed to update lead" },
        { status: 500 }
      );
    }

    return NextResponse.json({ lead });
  } catch (error) {
    console.error("Update lead API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/sales/leads/[id] - Delete lead (soft delete or hard delete based on business rules)
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

    // TODO: Check user has delete permission

    // For now, we do hard delete (could add soft delete later)
    const { error: deleteError } = await supabase
      .from("leads")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting lead:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete lead" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete lead API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
