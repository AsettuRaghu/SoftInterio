import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import {
  canViewCosts,
  stripCostFields,
} from "@/lib/quotations/cost-visibility";

/** Coerces the builder's mixed string/number payload to a number or null. */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Profit on one line, at the moment it was priced.
 *
 * Derived from amount rather than by re-deriving the measurement: amount is
 * already rate x measure, so measure = amount / rate. That avoids repeating
 * the unit conversion the client owns (mm/cm/inch/ft, area vs length vs
 * count), and - more importantly - guarantees the margin reconciles with the
 * total the client is being shown. A margin computed from an independently
 * derived measure could disagree with the quotation it belongs to.
 *
 * Null when the cost is unknown. Null is not zero margin, and reporting must
 * be able to tell the difference.
 */
function computeMargin(
  rate: number | null,
  amount: number | null,
  quantity: number | null,
  companyCost: number | null
): number | null {
  if (companyCost === null || rate === null) return null;

  // A free line has no rate to divide by, so fall back to the count.
  if (rate === 0) {
    return quantity === null ? null : -companyCost * quantity;
  }
  if (amount === null) return null;

  const measure = amount / rate;
  return (rate - companyCost) * measure;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/quotations/[id] - Get single quotation with lead data
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

    // Query quotations table directly with all necessary relations
    const { data: quotation, error: quotationError } = await supabase
      .from("quotations")
      .select(`
        *,
        lead:leads!lead_id(
          id,
          lead_number,
          stage,
          property:properties(
            id,
            property_name,
            address_line1,
            city,
            pincode,
            carpet_area,
            property_type
          )
        ),
        client:clients!client_id(
          id,
          name,
          email,
          phone
        ),
        assigned_user:users!assigned_to(
          id,
          name,
          email,
          avatar_url
        )
      `)
      .eq("id", id)
      .single();

    if (quotationError) {
      if (quotationError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Quotation not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching quotation:", quotationError);
      return NextResponse.json(
        { error: "Failed to fetch quotation" },
        { status: 500 }
      );
    }

    // Extract relations and flatten data for backward compatibility
    const lead = quotation.lead as { property?: Record<string, unknown> } | null;
    const property = lead?.property as Record<string, unknown> | null;
    const client = quotation.client as { name?: string; email?: string; phone?: string } | null;
    
    // quotations.project_id carries no foreign key (only linked_to_project_id
    // has one), so PostgREST cannot embed the project - it has to be read
    // separately. Only quotations that belong to a project pay for this.
    let project: {
      id: string;
      project_number?: string;
      name?: string;
      status?: string;
    } | null = null;
    if (quotation.project_id) {
      const { data } = await supabase
        .from("projects")
        .select("id, project_number, name, status")
        .eq("id", quotation.project_id)
        .maybeSingle();
      project = data;
    }

    const flattenedQuotation = {
      ...quotation,
      project,
      // Client data from relation
      client_name: client?.name || null,
      client_email: client?.email || null,
      client_phone: client?.phone || null,
      // Property data from lead relation
      property_name: property?.property_name || null,
      property_address: property?.address_line1 || null,
      property_city: property?.city || null,
      carpet_area_sqft: property?.carpet_area || null,
      property_type: property?.property_type || null,
      // Flatten assigned user for backward compatibility
      assigned_to_name: (quotation.assigned_user as { name?: string } | null)?.name,
      assigned_to_email: (quotation.assigned_user as { email?: string } | null)?.email,
      assigned_to_avatar: (quotation.assigned_user as { avatar_url?: string } | null)?.avatar_url,
    };

    // Fetch related data: spaces, components, line items, version history
    const [
      { data: spaces },
      { data: components },
      { data: lineItems },
      { data: versions },
      { data: createdUser },
      { data: updatedUser },
    ] = await Promise.all([
      // Quotation spaces with space type info
      supabase
        .from("quotation_spaces")
        .select(
          `
          *,
          space_type:space_types(id, name, slug, icon)
        `
        )
        .eq("quotation_id", id)
        .order("display_order", { ascending: true }),
      // Quotation components with component type info
      supabase
        .from("quotation_components")
        .select(
          `
          *,
          component_type:component_types(id, name, slug, icon)
        `
        )
        .eq("quotation_id", id)
        .order("display_order", { ascending: true }),
      // Quotation line items with quotation cost item info
      supabase
        .from("quotation_line_items")
        .select(
          `
          *,
          quotation_cost_item:quotation_cost_items(
            id, name, slug, description, default_rate, company_cost, vendor_cost,
            category:quotation_cost_item_categories(id, name, slug, color)
          )
        `
        )
        .eq("quotation_id", id)
        .order("display_order", { ascending: true }),
      // Get all versions of this quotation
      supabase
        .from("quotations")
        .select("id, version, status, grand_total, created_at")
        .eq("quotation_number", quotation.quotation_number)
        .order("version", { ascending: false }),
      // Get created by user
      supabase
        .from("users")
        .select("id, name, avatar_url, email")
        .eq("id", quotation.created_by)
        .single(),
      // Get updated by user
      quotation.updated_by
        ? supabase
            .from("users")
            .select("id, name, avatar_url, email")
            .eq("id", quotation.updated_by)
            .single()
        : Promise.resolve({ data: null }),
    ]);

    // Strip internal costs before anything is organised, so every shape they
    // appear in - nested under a component, orphaned, or the flat list - is
    // covered by the one check rather than three.
    const showCosts = await canViewCosts();
    const visibleLineItems = stripCostFields(lineItems || [], showCosts);

    // Organize line items by space and component for hierarchical view
    const organizedData = organizeQuotationData(
      spaces || [],
      components || [],
      visibleLineItems
    );

    // Build assigned_user from joined data
    const assignedUser = quotation.assigned_user
      ? {
          id: quotation.assigned_to,
          name: flattenedQuotation.assigned_to_name,
          email: flattenedQuotation.assigned_to_email,
          avatar_url: flattenedQuotation.assigned_to_avatar,
        }
      : null;

    return NextResponse.json({
      quotation: {
        ...flattenedQuotation,
        created_user: createdUser || null,
        updated_user: updatedUser || null,
        assigned_user: assignedUser,
      },
      spaces: organizedData.spaces,
      components: organizedData.orphanComponents, // Components without a space
      lineItems: organizedData.orphanLineItems, // Line items without space or component
      allLineItems: visibleLineItems, // Flat list of all line items
      versions: versions || [],
      // Lets the builder decide whether to render the margin panel at all,
      // without it having to guess from whether the fields came back.
      can_view_costs: showCosts,
    });
  } catch (error) {
    console.error("Get quotation API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to organize quotation data hierarchically
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function organizeQuotationData(
  spaces: any[],
  components: any[],
  lineItems: any[]
) {
  // Add backward compatibility alias for cost_item
  const normalizedLineItems = lineItems.map((item) => ({
    ...item,
    // Map new field name to old for backward compatibility
    cost_item: item.quotation_cost_item || item.cost_item,
    cost_item_id: item.quotation_cost_item_id || item.cost_item_id,
  }));

  // Create maps for quick lookup
  const spaceMap = new Map(
    spaces.map((s) => [s.id, { ...s, components: [], lineItems: [] }])
  );
  const componentMap = new Map(
    components.map((c) => [c.id, { ...c, lineItems: [] }])
  );

  // Assign components to spaces
  components.forEach((component) => {
    if (component.space_id && spaceMap.has(component.space_id)) {
      const space = spaceMap.get(component.space_id);
      space.components.push({ ...component, lineItems: [] });
    }
  });

  // Assign line items to components or spaces
  const orphanLineItems: typeof normalizedLineItems = [];
  const spaceValues = Array.from(spaceMap.values());
  normalizedLineItems.forEach((item) => {
    if (
      item.quotation_component_id &&
      componentMap.has(item.quotation_component_id)
    ) {
      // Find component in space or orphan list
      let assigned = false;
      for (const space of spaceValues) {
        const component = space.components.find(
          (c: { id: string }) => c.id === item.quotation_component_id
        );
        if (component) {
          component.lineItems.push(item);
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        const component = componentMap.get(item.quotation_component_id);
        if (component) {
          component.lineItems.push(item);
        }
      }
    } else if (
      item.quotation_space_id &&
      spaceMap.has(item.quotation_space_id)
    ) {
      const space = spaceMap.get(item.quotation_space_id);
      space.lineItems.push(item);
    } else {
      orphanLineItems.push(item);
    }
  });

  // Get orphan components (not assigned to any space)
  const orphanComponents = components.filter((c) => !c.space_id);

  return {
    spaces: Array.from(spaceMap.values()),
    orphanComponents,
    orphanLineItems,
  };
}

// Helper function to create a new version of a quotation
async function createNewVersion(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existingQuotation: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any,
  userId: string,
  versionNotes?: string,
  targetProjectId?: string | null
) {
  try {
    console.log("[createNewVersion] Starting...", {
      existingProjectId: existingQuotation.project_id,
      targetProjectId
    });

    // Get the highest version number for this quotation_number
    const { data: versions, error: versionError } = await supabase
      .from("quotations")
      .select("version")
      .eq("quotation_number", existingQuotation.quotation_number)
      .order("version", { ascending: false })
      .limit(1);

    if (versionError) {
      console.error("[createNewVersion] Error fetching versions:", versionError);
      return NextResponse.json(
        { error: "Failed to fetch version history" },
        { status: 500 }
      );
    }

    const newVersion = (versions?.[0]?.version || 1) + 1;
    console.log("[createNewVersion] New version number:", newVersion);

    // Create the new quotation record (copy from existing + updates from body)
    const { subtotal, tax_percent, tax_amount, grand_total } = body;

    // Use targetProjectId if provided (for transitioning from lead to project)
    // Otherwise keep the existing project_id/lead_id
    const shouldAttachToProject = targetProjectId !== undefined;
    
    const newQuotationData = {
      tenant_id: existingQuotation.tenant_id,
      lead_id: shouldAttachToProject ? null : existingQuotation.lead_id,
      project_id: shouldAttachToProject ? targetProjectId : existingQuotation.project_id,
      client_id: existingQuotation.client_id,
      quotation_number: existingQuotation.quotation_number,
      version: newVersion,
      parent_quotation_id: existingQuotation.id,
      status: "draft" as const,
      title: body.title || existingQuotation.title,
      description: existingQuotation.description,
      valid_from: existingQuotation.valid_from,
      valid_until: body.valid_until || existingQuotation.valid_until,
      subtotal: subtotal ?? existingQuotation.subtotal,
      discount_type: existingQuotation.discount_type,
      discount_value: existingQuotation.discount_value,
      discount_amount: existingQuotation.discount_amount,
      taxable_amount: existingQuotation.taxable_amount,
      tax_percent: tax_percent ?? existingQuotation.tax_percent ?? 18,
      tax_amount: tax_amount ?? existingQuotation.tax_amount,
      overhead_percent: existingQuotation.overhead_percent,
      overhead_amount: existingQuotation.overhead_amount,
      grand_total: grand_total ?? existingQuotation.grand_total,
      payment_terms: existingQuotation.payment_terms,
      terms_and_conditions: existingQuotation.terms_and_conditions,
      notes: versionNotes || body.notes || existingQuotation.notes,
      presentation_level: existingQuotation.presentation_level,
      hide_dimensions: existingQuotation.hide_dimensions,
      assigned_to: body.assigned_to || existingQuotation.assigned_to,
      created_by: userId,
      updated_by: userId,
    };

    console.log("[createNewVersion] Creating new quotation with data:", {
      quotation_number: newQuotationData.quotation_number,
      version: newQuotationData.version,
      tenant_id: newQuotationData.tenant_id,
    });

    const { data: newQuotation, error: createError } = await supabase
      .from("quotations")
      .insert(newQuotationData)
      .select()
      .single();

    if (createError) {
      console.error("[createNewVersion] Error creating quotation:", createError);
      return NextResponse.json(
        { error: `Failed to create new version: ${createError.message}` },
        { status: 500 }
      );
    }

    console.log("[createNewVersion] Created quotation:", newQuotation.id);

    // Now copy spaces, components, and line items
    const { spaces } = body;
    if (spaces && Array.isArray(spaces) && spaces.length > 0) {
      console.log("[createNewVersion] Copying spaces, components, line items...");

      // Track ID mappings
      const spaceIdMap = new Map<number, string>();
      const componentIdMap = new Map<string, string>();

      // Insert spaces
      const spacesToInsert = spaces.map(
        (space: Record<string, unknown>, index: number) => ({
          quotation_id: newQuotation.id,
          space_type_id: space.space_type_id,
          name: space.name,
          description: space.description || null,
          subtotal: space.subtotal || 0,
          display_order: space.sort_order ?? index,
        })
      );

      const { error: spacesError, data: insertedSpaces } = await supabase
        .from("quotation_spaces")
        .insert(spacesToInsert)
        .select("id");

      if (spacesError) {
        console.error("[createNewVersion] Error inserting spaces:", spacesError);
        // Rollback: delete the quotation
        await supabase.from("quotations").delete().eq("id", newQuotation.id);
        return NextResponse.json(
          { error: "Failed to create spaces for new version" },
          { status: 500 }
        );
      }

      // Map space indexes to new IDs
      insertedSpaces?.forEach((s: { id: string }, idx: number) => {
        spaceIdMap.set(idx, s.id);
      });

      console.log("[createNewVersion] Created spaces:", insertedSpaces?.length);

      // Collect and insert components
      const allComponents: Array<{
        data: Record<string, unknown>;
        spaceIndex: number;
        compIndex: number;
      }> = [];

      spaces.forEach(
        (
          space: { components?: Record<string, unknown>[] },
          spaceIndex: number
        ) => {
          if (space.components && insertedSpaces) {
            space.components.forEach(
              (comp: Record<string, unknown>, compIndex: number) => {
                allComponents.push({
                  data: {
                    quotation_id: newQuotation.id,
                    space_id: insertedSpaces[spaceIndex].id,
                    component_type_id: comp.component_type_id,
                    name: comp.name,
                    description: comp.description || null,
                    subtotal: comp.subtotal || 0,
                    display_order: comp.sort_order ?? compIndex,
                  },
                  spaceIndex,
                  compIndex,
                });
              }
            );
          }
        }
      );

      if (allComponents.length > 0) {
        const componentsToInsert = allComponents.map((c) => c.data);
        const { error: componentsError, data: insertedComponents } =
          await supabase
            .from("quotation_components")
            .insert(componentsToInsert)
            .select("id");

        if (componentsError) {
          console.error("[createNewVersion] Error inserting components:", componentsError);
          // Rollback
          await supabase.from("quotation_spaces").delete().eq("quotation_id", newQuotation.id);
          await supabase.from("quotations").delete().eq("id", newQuotation.id);
          return NextResponse.json(
            { error: "Failed to create components for new version" },
            { status: 500 }
          );
        }

        // Map component positions to new IDs
        insertedComponents?.forEach((c: { id: string }, idx: number) => {
          componentIdMap.set(
            `${allComponents[idx].spaceIndex}-${allComponents[idx].compIndex}`,
            c.id
          );
        });

        console.log("[createNewVersion] Created components:", insertedComponents?.length);
      }

      // Insert line items
      const allLineItems: Record<string, unknown>[] = [];
      let displayOrder = 0;

      spaces.forEach(
        (
          space: {
            components?: Array<{
              lineItems?: Array<Record<string, unknown>>;
            }>;
          },
          spaceIndex: number
        ) => {
          if (space.components) {
            space.components.forEach((comp, compIndex: number) => {
              if (comp.lineItems) {
                comp.lineItems.forEach((item: Record<string, unknown>) => {
                  const newSpaceId = spaceIdMap.get(spaceIndex);
                  const newComponentId = componentIdMap.get(
                    `${spaceIndex}-${compIndex}`
                  );

                  allLineItems.push({
                    quotation_id: newQuotation.id,
                    quotation_space_id: newSpaceId || null,
                    quotation_component_id: newComponentId || null,
                    quotation_cost_item_id: item.quotation_cost_item_id || item.cost_item_id,
                    name: item.name,
                    length: item.length,
                    width: item.width,
                    quantity: item.quantity,
                    unit_code: item.unit_code,
                    rate: item.rate,
                    amount: item.amount,
                    measurement_unit: item.measurement_unit || "mm",
                    display_order: displayOrder++,
                    notes: item.notes,
                    metadata: item.metadata,
                  });
                });
              }
            });
          }
        }
      );

      if (allLineItems.length > 0) {
        const { error: lineItemsError } = await supabase
          .from("quotation_line_items")
          .insert(allLineItems);

        if (lineItemsError) {
          console.error("[createNewVersion] Error inserting line items:", lineItemsError);
          // Rollback
          await supabase.from("quotation_components").delete().eq("quotation_id", newQuotation.id);
          await supabase.from("quotation_spaces").delete().eq("quotation_id", newQuotation.id);
          await supabase.from("quotations").delete().eq("id", newQuotation.id);
          return NextResponse.json(
            { error: "Failed to create line items for new version" },
            { status: 500 }
          );
        }

        console.log("[createNewVersion] Created line items:", allLineItems.length);
      }
    }

    console.log("[createNewVersion] Success! New quotation ID:", newQuotation.id);

    // Return success with the new quotation ID so frontend can redirect
    return NextResponse.json({
      success: true,
      quotation: newQuotation,
      newVersionId: newQuotation.id,
      message: `Created version ${newVersion} successfully`,
    });
  } catch (error) {
    console.error("[createNewVersion] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error creating new version" },
      { status: 500 }
    );
  }
}

// PATCH /api/quotations/[id] - Update quotation (only quotation-specific fields, not lead data)
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

    const body = await request.json();
    const { create_new_version, version_notes } = body;

    console.log("[Quotation PATCH] Request received:", {
      quotationId: id,
      createNewVersion: create_new_version,
      versionNotes: version_notes,
      hasSpaces: !!body.spaces,
      spacesCount: body.spaces?.length,
    });

    // Check quotation exists and get current state (fetch more fields for versioning)
    const { data: existingQuotation, error: fetchError } = await supabase
      .from("quotations")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingQuotation) {
      console.error("[Quotation PATCH] Quotation not found:", fetchError);
      return NextResponse.json(
        { error: "Quotation not found" },
        { status: 404 }
      );
    }

    console.log("[Quotation PATCH] Existing quotation:", {
      id: existingQuotation.id,
      quotation_number: existingQuotation.quotation_number,
      version: existingQuotation.version,
      status: existingQuotation.status,
      lead_id: existingQuotation.lead_id,
      project_id: existingQuotation.project_id,
    });

    // Check if quotation is associated with a closed lead (won/lost)
    // Block direct edits, but allow creating new versions (which will attach to project)
    if (existingQuotation.lead_id && !existingQuotation.project_id && !create_new_version) {
      const { data: lead } = await supabase
        .from("leads")
        .select("stage")
        .eq("id", existingQuotation.lead_id)
        .single();
      
      if (lead && ["won", "lost"].includes(lead.stage)) {
        return NextResponse.json(
          {
            error: `Cannot modify quotation associated with a ${lead.stage} lead. The lead is closed and quotations are read-only. To make changes, create a new version instead.`,
            code: "QUOTATION_READ_ONLY_LEAD_CLOSED",
            suggestion: lead.stage === "won" ? "Create a new version to continue working on the project" : "This quotation is archived with the closed lead"
          },
          { status: 403 }
        );
      }
    }

    // A quotation that has left the building is revision-only.
    //
    // "sent" joins approved and rejected here: the client is holding that
    // document, and editing it in place silently changes what they are looking
    // at while the quotation number and version stay the same. A revision
    // makes the change visible on both sides.
    if (
      ["sent", "approved", "rejected"].includes(existingQuotation.status) &&
      !create_new_version
    ) {
      return NextResponse.json(
        {
          error: `Cannot modify a ${existingQuotation.status} quotation. Create a revision instead.`,
        },
        { status: 400 }
      );
    }

    // Handle creating a new version
    if (create_new_version) {
      console.log("[Quotation PATCH] Creating new version...");
      
      // Check if parent quotation is from a closed lead and project exists
      let targetProjectId = existingQuotation.project_id;
      
      if (existingQuotation.lead_id && !existingQuotation.project_id) {
        // Check if lead is closed and has a project
        const { data: lead } = await supabase
          .from("leads")
          .select("stage, project_id")
          .eq("id", existingQuotation.lead_id)
          .single();
        
        if (lead && ["won", "lost", "disqualified"].includes(lead.stage) && lead.project_id) {
          // Lead is closed and has a project - attach new version to project
          targetProjectId = lead.project_id;
          console.log("[Quotation PATCH] Lead is closed, attaching new version to project:", lead.project_id);
        } else if (lead && ["won", "lost", "disqualified"].includes(lead.stage) && !lead.project_id) {
          // Lead is closed but no project - prevent revision
          return NextResponse.json(
            { 
              error: "Cannot revise quotation for a closed lead without a project. Please create a new quotation at the project level.",
              code: "LEAD_CLOSED_NO_PROJECT"
            },
            { status: 400 }
          );
        }
      }
      
      return await createNewVersion(
        supabase,
        existingQuotation,
        body,
        user!.id,
        version_notes,
        targetProjectId
      );
    }

    // Only allow updating quotation-specific fields (not client/property data from lead)
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      "title",
      "description",
      "status",
      "valid_from",
      "valid_until",
      "subtotal",
      "discount_type",
      "discount_value",
      "discount_amount",
      "taxable_amount",
      "tax_percent",
      "tax_amount",
      "overhead_percent",
      "overhead_amount",
      "grand_total",
      "payment_terms",
      "terms_and_conditions",
      "notes",
      "presentation_level",
      "hide_dimensions",
      "assigned_to",
      "template_id",
    ];

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    // Handle line items update if provided
    const { spaces, lineItems } = body;

    // Begin transaction-like operations
    // Update quotation header if there are fields to update
    if (Object.keys(updateData).length > 0) {
      updateData.updated_by = user.id;

      const { error: updateError } = await supabase
        .from("quotations")
        .update(updateData)
        .eq("id", id);

      if (updateError) {
        console.error("Error updating quotation:", updateError);
        return NextResponse.json(
          { error: "Failed to update quotation" },
          { status: 500 }
        );
      }
    }

    // Handle spaces update if provided
    if (spaces && Array.isArray(spaces)) {
      // Delete existing spaces (cascade will delete components and we'll handle line items)
      await supabase.from("quotation_spaces").delete().eq("quotation_id", id);
      await supabase
        .from("quotation_line_items")
        .delete()
        .eq("quotation_id", id);

      // Track ID mappings for line items
      const spaceIdMap = new Map<number, string>(); // index -> new space id
      const componentIdMap = new Map<string, string>(); // "spaceIndex-compIndex" -> new component id

      // Insert new spaces
      if (spaces.length > 0) {
        const spacesToInsert = spaces.map(
          (space: Record<string, unknown>, index: number) => ({
            quotation_id: id,
            space_type_id: space.space_type_id,
            name: space.name,
            description: space.description || null,
            subtotal: space.subtotal || 0,
            display_order: space.sort_order ?? index,
          })
        );

        const { error: spacesError, data: insertedSpaces } = await supabase
          .from("quotation_spaces")
          .insert(spacesToInsert)
          .select("id");

        if (spacesError) {
          console.error("Error inserting spaces:", spacesError);
          return NextResponse.json(
            { error: "Failed to update spaces" },
            { status: 500 }
          );
        }

        // Map space indexes to new IDs
        if (insertedSpaces) {
          insertedSpaces.forEach((s, idx) => {
            spaceIdMap.set(idx, s.id);
          });
        }

        // Insert components for each space and track their IDs
        const allComponents: Array<{
          data: Record<string, unknown>;
          spaceIndex: number;
          compIndex: number;
        }> = [];

        spaces.forEach(
          (
            space: { components?: Record<string, unknown>[] },
            spaceIndex: number
          ) => {
            if (space.components && insertedSpaces) {
              space.components.forEach(
                (comp: Record<string, unknown>, compIndex: number) => {
                  allComponents.push({
                    data: {
                      quotation_id: id,
                      space_id: insertedSpaces[spaceIndex].id,
                      component_type_id: comp.component_type_id,
                      name: comp.name,
                      description: comp.description || null,
                      subtotal: comp.subtotal || 0,
                      display_order: comp.sort_order ?? compIndex,
                      // The component's own size, entered once and pushed down
                      // to its lines. These columns existed all along and were
                      // set on 0 of 169 rows because nothing ever wrote them.
                      width: comp.width ?? null,
                      height: comp.height ?? null,
                      metadata: comp.metadata ?? null,
                    },
                    spaceIndex,
                    compIndex,
                  });
                }
              );
            }
          }
        );

        if (allComponents.length > 0) {
          const componentsToInsert = allComponents.map((c) => c.data);
          const { error: componentsError, data: insertedComponents } =
            await supabase
              .from("quotation_components")
              .insert(componentsToInsert)
              .select("id");

          if (componentsError) {
            console.error("Error inserting components:", componentsError);
            return NextResponse.json(
              { error: "Failed to update components" },
              { status: 500 }
            );
          }

          // Map component positions to new IDs
          if (insertedComponents) {
            allComponents.forEach((c, idx) => {
              componentIdMap.set(
                `${c.spaceIndex}-${c.compIndex}`,
                insertedComponents[idx].id
              );
            });
          }
        }

        // Now insert line items with proper ID mappings
        const allLineItems: Record<string, unknown>[] = [];
        let displayOrder = 0;

        spaces.forEach(
          (
            space: {
              components?: Array<{
                lineItems?: Array<Record<string, unknown>>;
              }>;
            },
            spaceIndex: number
          ) => {
            if (space.components) {
              space.components.forEach((comp, compIndex: number) => {
                if (comp.lineItems) {
                  comp.lineItems.forEach((item: Record<string, unknown>) => {
                    const newSpaceId = spaceIdMap.get(spaceIndex);
                    const newComponentId = componentIdMap.get(
                      `${spaceIndex}-${compIndex}`
                    );

                    const companyCost = toNumber(
                      item.company_cost ?? item.companyCost
                    );
                    const vendorCost = toNumber(
                      item.vendor_cost ?? item.vendorCost
                    );
                    allLineItems.push({
                      quotation_id: id,
                      quotation_space_id: newSpaceId || null,
                      quotation_component_id: newComponentId || null,
                      quotation_cost_item_id: item.quotation_cost_item_id || item.cost_item_id,
                      name: item.name,
                      length: item.length,
                      width: item.width,
                      quantity: item.quantity,
                      unit_code: item.unit_code,
                      rate: item.rate,
                      amount: item.amount,
                      company_cost: companyCost,
                      vendor_cost: vendorCost,
                      margin_amount: computeMargin(
                        toNumber(item.rate),
                        toNumber(item.amount),
                        toNumber(item.quantity),
                        companyCost
                      ),
                      measurement_unit: item.measurement_unit || "mm",
                      display_order: displayOrder++,
                      notes: item.notes,
                      metadata: item.metadata,
                    });
                  });
                }
              });
            }
          }
        );

        if (allLineItems.length > 0) {
          const { error: lineItemsError } = await supabase
            .from("quotation_line_items")
            .insert(allLineItems);

          if (lineItemsError) {
            console.error("Error inserting line items:", lineItemsError);
            return NextResponse.json(
              { error: "Failed to update line items" },
              { status: 500 }
            );
          }
        }
      }
    } else if (lineItems && Array.isArray(lineItems)) {
      // Handle line items update if only lineItems provided (no spaces)
      await supabase
        .from("quotation_line_items")
        .delete()
        .eq("quotation_id", id);

      if (lineItems.length > 0) {
        // Internal costs are captured alongside the client rate.
        //
        // The columns have always existed and the builder has always loaded
        // them, but the insert dropped them - so all 415 existing line items
        // carry a rate and no cost, and "what did we make on this quotation?"
        // had no answer. They are snapshotted here rather than joined at read
        // time on purpose: a cost item's price moves, and a quotation's margin
        // must reflect what things cost when it was priced, not today.
        const lineItemsToInsert = lineItems.map(
          (item: Record<string, unknown>, index: number) => {
            const companyCost = toNumber(item.company_cost ?? item.companyCost);
            const vendorCost = toNumber(item.vendor_cost ?? item.vendorCost);
            return {
              quotation_id: id,
              quotation_space_id: item.quotation_space_id,
              quotation_component_id: item.quotation_component_id,
              quotation_cost_item_id:
                item.quotation_cost_item_id || item.cost_item_id,
              name: item.name,
              length: item.length,
              width: item.width,
              quantity: item.quantity,
              unit_code: item.unit_code,
              rate: item.rate,
              amount: item.amount,
              company_cost: companyCost,
              vendor_cost: vendorCost,
              margin_amount: computeMargin(
                toNumber(item.rate),
                toNumber(item.amount),
                toNumber(item.quantity),
                companyCost
              ),
              display_order: item.display_order ?? index,
              notes: item.notes,
              metadata: item.metadata,
            };
          }
        );

        const { error: lineItemsError } = await supabase
          .from("quotation_line_items")
          .insert(lineItemsToInsert);

        if (lineItemsError) {
          console.error("Error inserting line items:", lineItemsError);
          return NextResponse.json(
            { error: "Failed to update line items" },
            { status: 500 }
          );
        }
      }
    }

    // Fetch updated quotation with relationships
    const { data: updatedQuotation, error: refetchError } = await supabase
      .from("quotations")
      .select(`
        *,
        lead:leads!quotations_lead_id_fkey(
          id,
          lead_number,
          stage,
          client:clients!leads_client_id_fkey(id, name, phone, email)
        ),
        client:clients!quotations_client_id_fkey(id, name, phone, email),
        assigned_user:users!quotations_assigned_to_fkey(id, name, avatar_url),
        created_user:users!quotations_created_by_fkey(id, name, avatar_url)
      `)
      .eq("id", id)
      .single();

    if (refetchError) {
      console.error("Error refetching quotation:", refetchError);
    }

    return NextResponse.json({ quotation: updatedQuotation });
  } catch (error) {
    console.error("Update quotation API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
