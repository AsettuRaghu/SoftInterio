import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import type { StageTransitionInput, LeadStage } from "@/types/leads";
import {
  isValidStageTransition,
  getRequiredFieldsForTransition,
} from "@/types/leads";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/sales/leads/[id]/transition - Change lead stage
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const { id } = await params;
    const supabase = await createClient();

    const body: StageTransitionInput = await request.json();
    const { to_stage } = body;

    if (!to_stage) {
      return NextResponse.json(
        { error: "Target stage is required" },
        { status: 400 }
      );
    }

    // Get current lead with linked property data
    const { data: lead, error: fetchError } = await supabase
      .from("leads")
      .select(`
        *,
        property:properties!leads_property_id_fkey(id, property_name, unit_number, category, property_type, property_subtype, carpet_area, city)
      `)
      .eq("id", id)
      .single();

    if (fetchError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const fromStage = lead.stage as LeadStage;

    // Validate transition
    if (!isValidStageTransition(fromStage, to_stage)) {
      return NextResponse.json(
        {
          error: `Invalid transition from ${fromStage} to ${to_stage}`,
        },
        { status: 400 }
      );
    }

    // Check permission for Won transition
    if (to_stage === "won") {
      const { data: permissionData, error: permissionError } =
        await supabase.rpc("can_move_lead_to_won", { p_user_id: user.id });

      if (permissionError) {
        console.error("Error checking won permission:", permissionError);
        return NextResponse.json(
          { error: "Failed to verify permissions" },
          { status: 500 }
        );
      }

      if (!permissionData) {
        return NextResponse.json(
          {
            error:
              "You don't have permission to mark leads as Won. Only Sales Managers and above can perform this action.",
          },
          { status: 403 }
        );
      }
    }

    // Get required fields for this transition
    const requirements = getRequiredFieldsForTransition(fromStage, to_stage);
    const missingFields: string[] = [];

    // Helper function to check qualified stage requirements
    const checkQualifiedRequirements = () => {
      // Qualified requires: property_category, property_type, property_subtype (community), service_type, property_name, target dates
      if (!body.property_category && !lead.property?.category) {
        missingFields.push("Property Category");
      }
      if (!body.property_type && !lead.property?.property_type) {
        missingFields.push("Property Type");
      }
      if (!body.property_subtype && !lead.property?.property_subtype) {
        missingFields.push("Community Type");
      }
      if (!body.service_type && !lead.service_type) {
        missingFields.push("Service Type");
      }
      if (!body.property_name && !lead.property?.property_name) {
        missingFields.push("Property Name");
      }
      if (!body.target_start_date && !lead.target_start_date) {
        missingFields.push("Target Start Date");
      }
      if (!body.target_end_date && !lead.target_end_date) {
        missingFields.push("Target End Date");
      }
    };

    // Helper function to check requirement_discussion stage requirements
    const checkRequirementDiscussionRequirements = () => {
      // Requirement Discussion requires: carpet_area, unit_number, budget_range
      if (!body.carpet_area && !lead.property?.carpet_area) {
        missingFields.push("Carpet Area");
      }
      if (!body.unit_number && !lead.property?.unit_number) {
        missingFields.push("Flat/Unit Number");
      }
      if (!body.budget_range && !lead.budget_range) {
        missingFields.push("Budget Range");
      }
    };

    // Check required fields based on transition type
    // Validation is CUMULATIVE - later stages require all previous stage fields
    if (to_stage === "qualified") {
      checkQualifiedRequirements();
    }

    if (to_stage === "disqualified") {
      if (!body.disqualification_reason) {
        missingFields.push("Disqualification Reason");
      }
    }

    if (to_stage === "requirement_discussion") {
      // Requires: ALL qualified fields + requirement_discussion specific fields
      checkQualifiedRequirements();
      checkRequirementDiscussionRequirements();
    }

    // Proposal Discussion requires all previous stage fields + notes
    if (to_stage === "proposal_discussion") {
      // Requires: ALL qualified fields + ALL requirement_discussion fields + notes
      checkQualifiedRequirements();
      checkRequirementDiscussionRequirements();
      if (!body.change_reason) {
        missingFields.push("Notes");
      }
    }

    if (to_stage === "lost") {
      if (!body.lost_reason) {
        missingFields.push("Lost Reason");
      }
      if (!body.lost_notes) {
        missingFields.push("Notes");
      }
    }

    if (to_stage === "won") {
      // Won requires all previous fields + won-specific fields
      checkQualifiedRequirements();
      checkRequirementDiscussionRequirements();
      if (!body.won_amount) {
        missingFields.push("Won Amount");
      }
      if (!body.contract_signed_date) {
        missingFields.push("Contract Signed Date");
      }
      if (!body.expected_project_start) {
        missingFields.push("Expected Project Start");
      }
      if (!body.change_reason) {
        missingFields.push("Notes");
      }
    }

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          missingFields,
        },
        { status: 400 }
      );
    }

    // STEP 1: Update or Create Property record if property fields provided
    const propertyFields = [
      "property_name", "unit_number", "property_category", "property_type",
      "property_subtype", "carpet_area"
    ];
    const hasPropertyUpdates = propertyFields.some((f) => f in body && body[f as keyof StageTransitionInput]);
    
    let propertyId = lead.property_id;
    
    if (hasPropertyUpdates) {
      const propertyData: Record<string, unknown> = {};
      if (body.property_name) propertyData.property_name = body.property_name;
      if (body.unit_number) propertyData.unit_number = body.unit_number;
      if (body.property_category) propertyData.category = body.property_category;
      if (body.property_type) propertyData.property_type = body.property_type;
      if (body.property_subtype) propertyData.property_subtype = body.property_subtype;
      if (body.carpet_area) propertyData.carpet_area = body.carpet_area;
      
      if (Object.keys(propertyData).length > 0) {
        if (lead.property_id) {
          // Update existing property
          const { error: propertyError } = await supabase
            .from("properties")
            .update(propertyData)
            .eq("id", lead.property_id);
          
          if (propertyError) {
            console.error("Error updating property:", propertyError);
            // Don't fail - continue with lead update
          }
        } else {
          // Create new property record since lead has no property yet
          const { data: newProperty, error: createPropertyError } = await supabase
            .from("properties")
            .insert({
              tenant_id: lead.tenant_id,
              ...propertyData,
              city: "Unknown", // Required field with default
              created_by: user.id,
            })
            .select("id")
            .single();
          
          if (createPropertyError) {
            console.error("Error creating property:", createPropertyError);
            // Don't fail - continue with lead update
          } else if (newProperty) {
            propertyId = newProperty.id;
          }
        }
      }
    }

    // STEP 2: Build lead update object (only lead-specific fields)
    const updateData: Record<string, unknown> = {
      stage: to_stage,
    };
    
    // Link the property if we created a new one
    if (propertyId && propertyId !== lead.property_id) {
      updateData.property_id = propertyId;
    }

    // Add transition-specific fields that belong on the lead
    if (to_stage === "qualified") {
      if (body.service_type) updateData.service_type = body.service_type;
      if (body.target_start_date) updateData.target_start_date = body.target_start_date;
      if (body.target_end_date) updateData.target_end_date = body.target_end_date;

      // Handle assignment - assign to current user if not specified
      const assignTo = body.assigned_to || user.id;
      updateData.assigned_to = assignTo;
      updateData.assigned_at = new Date().toISOString();
      updateData.assigned_by = user.id;
    }

    if (to_stage === "disqualified") {
      updateData.disqualification_reason = body.disqualification_reason;
      updateData.disqualification_notes = body.disqualification_notes || null;
    }

    if (to_stage === "requirement_discussion") {
      if (body.budget_range) updateData.budget_range = body.budget_range;
      if (body.project_scope) updateData.project_scope = body.project_scope;
    }

    if (to_stage === "lost") {
      updateData.lost_reason = body.lost_reason;
      updateData.lost_to_competitor = body.lost_to_competitor || null;
      updateData.lost_notes = body.lost_notes || null;
    }

    if (to_stage === "won") {
      updateData.won_amount = body.won_amount;
      updateData.won_at = new Date().toISOString();
      updateData.contract_signed_date = body.contract_signed_date;
      updateData.expected_project_start = body.expected_project_start;
    }

    // Check if won approval is needed
    // TODO: Implement approval check from tenant settings
    // For now, we skip approval

    // Update lead
    const { data: updatedLead, error: updateError } = await supabase
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
      console.error("Error transitioning lead:", updateError);
      return NextResponse.json(
        { error: "Failed to update lead stage" },
        { status: 500 }
      );
    }

    // Create activity for stage change
    await supabase.from("lead_activities").insert({
      lead_id: id,
      activity_type: "stage_changed",
      title: `Stage changed to ${to_stage.replace("_", " ")}`,
      description:
        body.change_reason ||
        `Moved from ${fromStage.replace("_", " ")} to ${to_stage.replace(
          "_",
          " "
        )}`,
      created_by: user.id,
    });

    // Auto-create project when lead is marked as Won
    let projectId: string | null = null;
    if (to_stage === "won") {
      try {
        // Check tenant setting for auto-project creation
        // Default to true if setting doesn't exist
        let shouldCreateProject = true;

        try {
          const { data: tenantSetting } = await supabase
            .from("tenant_settings")
            .select("auto_create_project_on_won")
            .eq("tenant_id", lead.tenant_id)
            .single();

          if (
            tenantSetting &&
            tenantSetting.auto_create_project_on_won === false
          ) {
            shouldCreateProject = false;
          }
        } catch (settingErr) {
          // If column doesn't exist or query fails, default to creating project
          console.log(
            "Tenant settings query failed, defaulting to create project:",
            settingErr
          );
        }

        console.log(
          "Should create project:",
          shouldCreateProject,
          "Skip flag:",
          body.skip_project_creation
        );

        if (shouldCreateProject && !body.skip_project_creation) {
          // Determine project category from service_type
          const projectCategory =
            lead.service_type === "modular" ? "modular" : "turnkey";

          // Use selected quotation if provided, otherwise auto-find
          let winningQuotationId = body.selected_quotation_id || null;
          
          // If no quotation selected, try to find one automatically
          if (!winningQuotationId) {
            const { data: winningQuotation } = await supabase
              .from("quotations")
              .select("id")
              .eq("lead_id", id)
              .in("status", ["approved", "signed", "accepted"]) 
              .order("updated_at", { ascending: false })
              .limit(1)
              .single();
              
            if (winningQuotation) {
              winningQuotationId = winningQuotation.id;
            } else {
               // Fallback: Try to find latest sent quotation if no approved/signed one exists
               const { data: latestQuotation } = await supabase
                  .from("quotations")
                  .select("id")
                  .eq("lead_id", id)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .single();
                  
               if (latestQuotation) {
                 winningQuotationId = latestQuotation.id;
               }
            }
          }

          console.log(
            "Creating project with category:",
            projectCategory,
            "for lead:",
            id,
            "linked quotation:", 
            winningQuotationId
          );

          // Call the function to create project from lead
          const { data: createdProjectId, error: projectError } =
            await supabase.rpc("create_project_from_lead", {
              p_lead_id: id,
              p_created_by: user.id,
              p_project_category: projectCategory,
              p_initialize_phases: true,
              p_quotation_id: winningQuotationId
            });

          if (projectError) {
            console.error("Error creating project from lead:", projectError);
            // Don't fail the transition, just log the error
          } else {
            console.log("Project created successfully:", createdProjectId);
            projectId = createdProjectId;
          }
        }
      } catch (projectErr) {
        console.error("Error in project creation flow:", projectErr);
        // Don't fail the transition
      }
    }

    return NextResponse.json({
      lead: updatedLead,
      project_id: projectId,
      project_created: projectId !== null,
    });
  } catch (error) {
    console.error("Stage transition API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
