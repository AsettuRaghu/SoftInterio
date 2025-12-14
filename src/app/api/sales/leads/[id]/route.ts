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

// PATCH /api/sales/leads/[id] - Update lead and linked client/property records
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

    // Check lead exists and get current state with linked records
    const { data: existingLead, error: fetchError } = await supabase
      .from("leads")
      .select("id, stage, assigned_to, client_id, property_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
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
          console.error("Error updating client:", clientError);
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
            console.error("Error updating property:", propertyError);
            // Don't fail - property update is non-critical
          }
        } else {
          // Create new property if one doesn't exist
          const { data: userData } = await supabase
            .from("users")
            .select("tenant_id")
            .eq("id", user.id)
            .single();
          
          if (userData?.tenant_id) {
            const { data: newProperty, error: createPropertyError } = await supabase
              .from("properties")
              .insert({
                tenant_id: userData.tenant_id,
                property_name: body.property_name || null,
                unit_number: body.unit_number || null,
                category: body.property_category || "residential",
                property_type: body.property_type || "apartment",
                property_subtype: body.property_subtype || null,
                carpet_area: body.carpet_area || null,
                address_line1: body.property_address || null,
                city: body.property_city || "Unknown",
                pincode: body.property_pincode || null,
                created_by: user.id,
              })
              .select("id")
              .single();
            
            if (!createPropertyError && newProperty) {
              // Link the new property to the lead - use leadUpdateData directly
              leadUpdateData.property_id = newProperty.id;
            }
          }
        }
      }
    }

    // STEP 3: Build lead update object
    const leadAllowedFields = [
      "service_type",
      "lead_source",
      "lead_source_detail",
      "target_start_date",
      "target_end_date",
      "budget_range",
      "estimated_value",
      "project_scope",
      "special_requirements",
      "lead_score",
      "next_followup_date",
      "next_followup_notes",
      "assigned_to",
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
        console.error("Error updating lead:", updateError);
        return NextResponse.json(
          { error: "Failed to update lead" },
          { status: 500 }
        );
      }
    }

    // STEP 4: Fetch and return updated lead with joined data
    const supabaseAdmin = createAdminClient();
    const { data: lead, error: refetchError } = await supabaseAdmin
      .from("leads")
      .select(
        `
        *,
        client:clients!leads_client_id_fkey(id, name, phone, email, city),
        property:properties!leads_property_id_fkey(id, property_name, unit_number, category, property_type, property_subtype, carpet_area, city),
        assigned_user:users!leads_assigned_to_fkey(id, name, avatar_url),
        created_user:users!leads_created_by_fkey(id, name, avatar_url)
      `
      )
      .eq("id", id)
      .single();

    if (refetchError) {
      console.error("Error refetching lead:", refetchError);
      return NextResponse.json(
        { error: "Lead updated but failed to fetch" },
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
