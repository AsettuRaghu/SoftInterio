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

    // Get current lead
    const { data: lead, error: fetchError } = await supabase
      .from("leads")
      .select("*")
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

    // Check required fields based on transition type
    if (to_stage === "qualified") {
      // Qualified requires: property_type, service_type, property_name, target dates
      if (!body.property_type && !lead.property_type) {
        missingFields.push("Property Type");
      }
      if (!body.service_type && !lead.service_type) {
        missingFields.push("Service Type");
      }
      if (!body.property_name && !lead.property_name) {
        missingFields.push("Property Name");
      }
      if (!body.target_start_date && !lead.target_start_date) {
        missingFields.push("Target Start Date");
      }
      if (!body.target_end_date && !lead.target_end_date) {
        missingFields.push("Target End Date");
      }
    }

    if (to_stage === "disqualified") {
      if (!body.disqualification_reason) {
        missingFields.push("Disqualification Reason");
      }
    }

    if (to_stage === "requirement_discussion") {
      // Requirement Discussion requires: carpet_area, flat_number, budget_range
      if (!body.carpet_area_sqft && !lead.carpet_area_sqft) {
        missingFields.push("Carpet Area");
      }
      if (!body.flat_number && !lead.flat_number) {
        missingFields.push("Flat/Unit Number");
      }
      if (!body.budget_range && !lead.budget_range) {
        missingFields.push("Budget Range");
      }
    }

    // Proposal Discussion requires notes
    if (to_stage === "proposal_discussion") {
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

    // Build update object
    const updateData: Record<string, unknown> = {
      stage: to_stage,
    };

    // Add transition-specific fields
    if (to_stage === "qualified") {
      if (body.property_type) updateData.property_type = body.property_type;
      if (body.service_type) updateData.service_type = body.service_type;
      if (body.property_name) updateData.property_name = body.property_name;
      if (body.target_start_date)
        updateData.target_start_date = body.target_start_date;
      if (body.target_end_date)
        updateData.target_end_date = body.target_end_date;

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
      // Also save property fields collected during this transition
      if (body.property_name) updateData.property_name = body.property_name;
      if (body.property_type) updateData.property_type = body.property_type;
      if (body.flat_number) updateData.flat_number = body.flat_number;
      if (body.carpet_area_sqft)
        updateData.carpet_area_sqft = body.carpet_area_sqft;
      if (body.property_address)
        updateData.property_address = body.property_address;
      if (body.property_city) updateData.property_city = body.property_city;
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

          console.log(
            "Creating project with category:",
            projectCategory,
            "for lead:",
            id
          );

          // Call the function to create project from lead
          const { data: createdProjectId, error: projectError } =
            await supabase.rpc("create_project_from_lead", {
              p_lead_id: id,
              p_created_by: user.id,
              p_project_category: projectCategory,
              p_initialize_phases: true,
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
