import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { validateLeadDates } from "@/lib/dates/lead-dates";
import { copyScopeToQuotation } from "@/lib/quotations/scope-to-quotation";
import type { StageTransitionInput, LeadStage } from "@/types/leads";
import {
  isValidStageTransition,
  getRequiredFieldsForTransition,
  LeadStageLabels,
} from "@/types/leads";
import { logLeadActivity } from "@/lib/activity/log";
import { generateUniqueProjectNumber } from "@/utils/project-number-generator";
import {
  getPendingLeadWork,
  cancelPendingLeadWork,
} from "@/lib/leads/pending-work";

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
      
      // MANDATORY: Quotation selection is required for won transitions
      if (!body.selected_quotation_id) {
        missingFields.push("Selected Quotation");
      }
      
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

    // Winning a lead closes it, so nothing may be left hanging on it. Checked
    // before any write: a lead that is half-won with a project half-created is
    // far harder to recover from than one that was simply refused.
    //
    // Only for "won". A lost or disqualified lead has outstanding work too, and
    // demanding someone tick off tasks for a deal that is dead is busywork -
    // those are cancelled further down instead.
    if (to_stage === "won") {
      const pending = await getPendingLeadWork(supabase, id);
      if (pending.tasks.length > 0 || pending.followUps.length > 0) {
        return NextResponse.json(
          {
            error:
              "This lead still has work outstanding. Complete or cancel it before marking the lead won.",
            code: "LEAD_HAS_PENDING_WORK",
            pending_tasks: pending.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              due_date: t.due_date,
            })),
            pending_follow_ups: pending.followUps.map((n) => ({
              id: n.id,
              follow_up_at: n.follow_up_at,
              excerpt:
                n.content.length > 80
                  ? `${n.content.slice(0, 80)}...`
                  : n.content,
            })),
          },
          { status: 409 }
        );
      }
    }

    // Every date this transition would write has to make sense before anything
    // is persisted. The modal guards these too, but min= on a date input is a
    // browser courtesy rather than a constraint, and it is absent entirely for
    // anything calling this route directly.
    const dateProblems = validateLeadDates(
      {
        target_start_date: body.target_start_date,
        target_end_date: body.target_end_date,
        contract_signed_date: body.contract_signed_date,
        expected_project_start: body.expected_project_start,
        expected_project_end: body.expected_project_end,
      },
      lead
    );

    if (dateProblems.length > 0) {
      return NextResponse.json(
        { error: dateProblems.join(". "), invalidDates: dateProblems },
        { status: 400 }
      );
    }

    // VALIDATION: For "won" stage, validate the selected quotation
    if (to_stage === "won" && body.selected_quotation_id) {
      const { data: selectedQuotation, error: quotationError } = await supabase
        .from("quotations")
        .select("id, status, quotation_number, version")
        .eq("id", body.selected_quotation_id)
        .eq("lead_id", id)
        .single();

      if (quotationError || !selectedQuotation) {
        return NextResponse.json(
          { 
            error: "Selected quotation not found or does not belong to this lead",
            details: "The quotation must exist and be linked to this lead"
          },
          { status: 400 }
        );
      }

      // Only allow approved quotations to be linked to projects
      if (selectedQuotation.status !== "approved") {
        return NextResponse.json(
          { 
            error: `Cannot link quotation to project - status is '${selectedQuotation.status}'`,
            details: "Only approved quotations can be linked to projects. Please approve the quotation first.",
            quotation_number: selectedQuotation.quotation_number,
            version: selectedQuotation.version
          },
          { status: 400 }
        );
      }
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
      if (body.budget_range) updateData.budget_range = body.budget_range;
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
    }

    if (to_stage === "lost") {
      updateData.lost_reason = body.lost_reason;
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

    // A dead lead's tasks are not still to do. Cancelling them with the reason
    // keeps the record that they existed while taking them off everyone's list,
    // which is better than leaving them to sit as permanently overdue work on
    // a deal nobody is pursuing.
    if (["lost", "disqualified"].includes(to_stage)) {
      const reasonText =
        to_stage === "lost"
          ? body.lost_reason || "Lead lost"
          : body.disqualification_reason || "Lead disqualified";
      const cancelled = await cancelPendingLeadWork(
        supabase,
        id,
        user.id,
        `Lead ${to_stage}: ${reasonText}`
      );

      if (cancelled.tasks > 0 || cancelled.followUps > 0) {
        const parts = [];
        if (cancelled.tasks) parts.push(`${cancelled.tasks} task(s) cancelled`);
        if (cancelled.followUps)
          parts.push(`${cancelled.followUps} follow-up(s) closed`);
        await logLeadActivity(supabase, {
          leadId: id,
          tenantId: lead.tenant_id,
          userId: user.id,
          type: "other",
          title: "Outstanding work closed",
          description: `${parts.join(", ")} because the lead was marked ${to_stage}.`,
        });
      }
    }

    // Reaching proposal_discussion auto-creates a quotation, but not here -
    // the trg_lead_stage_change trigger does it inside the UPDATE above, by
    // calling create_quotation_for_lead(). That function knows nothing about
    // the Spaces tab, so what it produces is an empty shell.
    //
    // Rather than reimplement the copy in PL/pgSQL and keep two versions in
    // step, we fill the shell here using the same routine the manual create
    // flow uses. It only ever touches a quotation the trigger just made
    // (auto_created, still empty), so re-running a transition cannot disturb
    // work someone has already done in the builder.
    if (to_stage === "proposal_discussion") {
      try {
        const { data: autoQuotation } = await supabase
          .from("quotations")
          .select("id")
          .eq("lead_id", id)
          .eq("auto_created", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (autoQuotation) {
          const { count: existingSpaces } = await supabase
            .from("quotation_spaces")
            .select("*", { count: "exact", head: true })
            .eq("quotation_id", autoQuotation.id);

          if (!existingSpaces) {
            await copyScopeToQuotation(
              supabase,
              lead.tenant_id,
              autoQuotation.id,
              id,
              null
            );
          }
        }
      } catch (scopeErr) {
        // The stage change itself has already succeeded and must stand. An
        // empty quotation is recoverable in the builder; a failed transition
        // is not.
        console.error("Error building quotation from scope:", scopeErr);
      }
    }

    // Note: Stage change is automatically recorded in lead_stage_history table via database trigger
    // However, we log activities for important stage actions with their reasons/notes

    // The note the user is made to type when moving a lead between stages is
    // recorded as a real note, not just buried in an activity description.
    //
    // Previously this was inconsistent: disqualified and lost created a
    // lead_notes row, but won and every ordinary forward stage kept the text
    // only inside the activity row - so a note the user was *required* to
    // write could not be found again in the Notes tab. Worse, the forward-stage
    // case logged an activity typed "note_added" when no note existed at all.
    //
    // The note text is whichever field that stage collects.
    const stageNoteText: string | undefined =
      to_stage === "disqualified"
        ? body.disqualification_notes
        : to_stage === "lost"
        ? body.lost_notes
        : body.change_reason;

    const fromLabel =
      LeadStageLabels[lead.stage as LeadStage] || lead.stage || "";
    const toLabel = LeadStageLabels[to_stage as LeadStage] || to_stage;

    let stageNoteId: string | null = null;
    if (stageNoteText?.trim()) {
      // The prefix keeps the note self-describing in a list that mixes
      // stage notes with ordinary ones. lead_notes has no category column
      // (project_notes does - the two tables have drifted), so the context
      // has to live in the text.
      const { data: createdNote, error: noteError } = await supabase
        .from("lead_notes")
        .insert({
          lead_id: id,
          content: `[${fromLabel} → ${toLabel}] ${stageNoteText.trim()}`,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (noteError) {
        // The stage change itself has already succeeded; losing the note copy
        // must not fail the request.
        console.error("Failed to record stage-change note:", noteError);
      } else {
        stageNoteId = createdNote?.id ?? null;
      }
    }

    // Supplementary activity rows carrying the reason. The stage change itself
    // is recorded separately in lead_stage_history by a database trigger.
    if (to_stage === "disqualified") {
      await logLeadActivity(supabase, {
        leadId: id,
        tenantId: lead.tenant_id,
        userId: user.id,
        linkedNoteId: stageNoteId,
        type: "stage_changed",
        title: "Lead Disqualified",
        description: `Reason: ${body.disqualification_reason || "Not specified"}${
          body.disqualification_notes ? ` - ${body.disqualification_notes}` : ""
        }`,
      });
    } else if (to_stage === "lost") {
      await logLeadActivity(supabase, {
        leadId: id,
        tenantId: lead.tenant_id,
        userId: user.id,
        linkedNoteId: stageNoteId,
        type: "stage_changed",
        title: "Lead Lost",
        description: `Reason: ${body.lost_reason || "Not specified"}${
          body.lost_notes ? ` - ${body.lost_notes}` : ""
        }`,
      });
    } else if (to_stage === "won") {
      await logLeadActivity(supabase, {
        leadId: id,
        tenantId: lead.tenant_id,
        userId: user.id,
        linkedNoteId: stageNoteId,
        type: "stage_changed",
        title: "Lead Won",
        description: `Won Amount: ₹${body.won_amount || "Not specified"}${
          body.change_reason ? ` - ${body.change_reason}` : ""
        }`,
      });
    } else if (stageNoteId) {
      // A note really was created now, so note_added is accurate.
      await logLeadActivity(supabase, {
        leadId: id,
        tenantId: lead.tenant_id,
        userId: user.id,
        linkedNoteId: stageNoteId,
        type: "note_added",
        title: "Note added on stage change",
        description: body.change_reason,
      });
    }

    // Auto-create project when lead is marked as Won
    let projectId: string | null = null;
    let projectCreationError: any = null;
    let shouldCreateProject = true;
    
    if (to_stage === "won") {
      try {
        // Check tenant setting for auto-project creation
        // Default to true if setting doesn't exist
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

          // Use selected quotation (already validated above for "won" stage)
          let winningQuotationId = body.selected_quotation_id || null;
          let projectQuotationId: string | null = null;

          console.log(
            "Creating project with category:",
            projectCategory,
            "for lead:",
            id,
            "linked quotation:", 
            winningQuotationId
          );

          // Try to create project using RPC first, with retry logic for duplicate key errors
          let createdProjectId: string | null = null;
          let projectError: any = null;
          const maxRetries = 3;
          
          for (let attempt = 0; attempt < maxRetries; attempt++) {
            const { data: rpcResult, error: rpcError } =
              await supabase.rpc("create_project_from_lead", {
                p_lead_id: id,
                p_created_by: user.id,
                p_project_category: projectCategory,
                p_initialize_phases: true,
                p_quotation_id: winningQuotationId,
                p_project_manager_id: body.project_manager_id || null,
                p_priority: body.project_priority || "Low",
                p_target_start_date: body.expected_project_start || null,
                p_target_end_date: body.expected_project_end || null
              });

            if (!rpcError) {
              createdProjectId = rpcResult;
              break;
            }

            projectError = rpcError;
            
            // Check if it's a duplicate key error
            if (
              rpcError &&
              typeof rpcError === 'object' &&
              'code' in rpcError &&
              rpcError.code === '23505'
            ) {
              console.warn(
                `Duplicate project number on attempt ${attempt + 1}/${maxRetries}, retrying...`,
                rpcError.message
              );
              
              // Wait before retrying with exponential backoff
              if (attempt < maxRetries - 1) {
                const delay = 100 * Math.pow(2, attempt);
                await new Promise((resolve) => setTimeout(resolve, delay));
              }
            } else {
              // Not a duplicate key error, don't retry
              break;
            }
          }

          if (projectError) {
            console.error("Error creating project from lead after retries:", projectError);
            // Store the error to return to client
            projectCreationError = projectError;
          } else if (createdProjectId) {
            console.log("Project created successfully:", createdProjectId);
            projectId = createdProjectId;

            // STEP: Copy and lock quotation for the project
            if (to_stage === "won" && winningQuotationId) {
              try {
                // 1. Lock the original quotation (sales side)
                console.log(
                  "[Quotation] Locking original quotation:",
                  winningQuotationId,
                  "for project:",
                  projectId
                );

                const { error: lockError } = await supabase.rpc(
                  "lock_quotation_for_project",
                  {
                    p_quotation_id: winningQuotationId,
                    p_project_id: projectId,
                  }
                );

                if (lockError) {
                  console.warn(
                    "Warning: Failed to lock original quotation:",
                    lockError
                  );
                  // Don't fail project creation if locking fails
                } else {
                  console.log(
                    "[Quotation] Original quotation locked successfully"
                  );
                }

                // 2. Copy quotation to project (create V1 baseline)
                console.log(
                  "[Quotation] Copying quotation to project:",
                  winningQuotationId
                );

                const { data: copiedQuotationId, error: copyError } =
                  await supabase.rpc("copy_quotation_to_project", {
                    p_source_quotation_id: winningQuotationId,
                    p_project_id: projectId,
                    p_created_by: user.id,
                  });

                if (copyError) {
                  console.error("Error copying quotation:", copyError);
                  projectCreationError = copyError;
                } else if (copiedQuotationId) {
                  projectQuotationId = copiedQuotationId;
                  console.log(
                    "[Quotation] Quotation copied successfully:",
                    projectQuotationId
                  );

                  // 3. Update project with baseline quotation reference
                  const { error: updateProjectError } = await supabase
                    .from("projects")
                    .update({
                      baseline_quotation_id: projectQuotationId,
                      quotation_id: projectQuotationId,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", projectId);

                  if (updateProjectError) {
                    console.error(
                      "Error updating project quotation reference:",
                      updateProjectError
                    );
                    // Don't fail - quotation is copied even if link fails
                  } else {
                    console.log(
                      "[Quotation] Project linked to quotation successfully"
                    );
                  }
                }
              } catch (quotationErr) {
                console.error("Error in quotation linking flow:", quotationErr);
                // Don't fail project creation if quotation operations fail
                projectCreationError = quotationErr;
              }
            }
          }
        }
      } catch (projectErr) {
        console.error("Error in project creation flow:", projectErr);
        projectCreationError = projectErr;
      }

      // If project creation was required but failed, rollback the lead stage update
      if (shouldCreateProject && !body.skip_project_creation && projectCreationError) {
        console.error("Rolling back lead stage update due to project creation failure");
        
        // Rollback: update lead back to previous stage
        await supabase
          .from("leads")
          .update({ stage: lead.stage })
          .eq("id", id);

        return NextResponse.json(
          {
            error: "Failed to create project from lead",
            details: projectCreationError.message || String(projectCreationError),
            code: projectCreationError.code || "PROJECT_CREATION_FAILED",
          },
          { status: 400 }
        );
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
