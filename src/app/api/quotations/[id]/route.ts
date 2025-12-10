import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

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

    // Use the view that pulls client data from lead
    const { data: quotation, error: quotationError } = await supabase
      .from("quotations_with_lead")
      .select("*")
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
      // Quotation components with component type and variant info
      supabase
        .from("quotation_components")
        .select(
          `
          *,
          component_type:component_types(id, name, slug, icon),
          component_variant:component_variants(id, name, slug)
        `
        )
        .eq("quotation_id", id)
        .order("display_order", { ascending: true }),
      // Quotation line items with cost item info
      supabase
        .from("quotation_line_items")
        .select(
          `
          *,
          cost_item:cost_items(
            id, name, slug, description,
            category:cost_item_categories(id, name, slug, color)
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

    // Organize line items by space and component for hierarchical view
    const organizedData = organizeQuotationData(
      spaces || [],
      components || [],
      lineItems || []
    );

    // Build assigned_user from view data (already joined in quotations_with_lead)
    const assignedUser = quotation.assigned_to
      ? {
          id: quotation.assigned_to,
          name: quotation.assigned_to_name,
          email: quotation.assigned_to_email,
          avatar_url: quotation.assigned_to_avatar,
        }
      : null;

    return NextResponse.json({
      quotation: {
        ...quotation,
        created_user: createdUser || null,
        updated_user: updatedUser || null,
        assigned_user: assignedUser,
      },
      spaces: organizedData.spaces,
      components: organizedData.orphanComponents, // Components without a space
      lineItems: organizedData.orphanLineItems, // Line items without space or component
      allLineItems: lineItems || [], // Flat list of all line items
      versions: versions || [],
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
  const orphanLineItems: typeof lineItems = [];
  const spaceValues = Array.from(spaceMap.values());
  lineItems.forEach((item) => {
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

    // Check quotation exists and get current state
    const { data: existingQuotation, error: fetchError } = await supabase
      .from("quotations")
      .select("id, status")
      .eq("id", id)
      .single();

    if (fetchError || !existingQuotation) {
      return NextResponse.json(
        { error: "Quotation not found" },
        { status: 404 }
      );
    }

    // Prevent modification of approved/rejected quotations
    if (["approved", "rejected"].includes(existingQuotation.status)) {
      return NextResponse.json(
        {
          error: `Cannot modify a ${existingQuotation.status} quotation. Create a revision instead.`,
        },
        { status: 400 }
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
                      component_variant_id: comp.component_variant_id,
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

                    allLineItems.push({
                      quotation_id: id,
                      quotation_space_id: newSpaceId || null,
                      quotation_component_id: newComponentId || null,
                      cost_item_id: item.cost_item_id,
                      name: item.name,
                      group_name: item.group_name,
                      length: item.length,
                      width: item.width,
                      quantity: item.quantity,
                      unit_code: item.unit_code,
                      rate: item.rate,
                      amount: item.amount,
                      measurement_unit: item.measurement_unit || "ft",
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
        const lineItemsToInsert = lineItems.map(
          (item: Record<string, unknown>, index: number) => ({
            quotation_id: id,
            quotation_space_id: item.quotation_space_id,
            quotation_component_id: item.quotation_component_id,
            cost_item_id: item.cost_item_id,
            name: item.name,
            group_name: item.group_name,
            length: item.length,
            width: item.width,
            quantity: item.quantity,
            unit_code: item.unit_code,
            rate: item.rate,
            amount: item.amount,
            display_order: item.display_order ?? index,
            notes: item.notes,
            metadata: item.metadata,
          })
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

    // Fetch updated quotation
    const { data: updatedQuotation, error: refetchError } = await supabase
      .from("quotations_with_lead")
      .select("*")
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
