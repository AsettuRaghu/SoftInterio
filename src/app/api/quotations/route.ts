import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { getQuotationNumberAndVersion } from "@/utils/quotation-number-generator";

// GET /api/quotations - List all quotations with lead data
export async function GET(request: NextRequest) {
  try {
    // Protect API route with user status check
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const leadId = searchParams.get("lead_id");
    const projectId = searchParams.get("project_id");
    const leadStatus = searchParams.get("lead_status") || "active"; // active or inactive
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Use the base table and join related tables
    let query = supabase
      .from("quotations")
      .select(`
        *,
        lead:leads(
          id,
          lead_number,
          stage,
          service_type,
          budget_range,
          lead_source,
          client_id,
          property_id,
          client:clients(
             id,
             name,
             email,
             phone
          ),
          property:properties(
             id,
             property_name,
             address_line1,
             city,
             pincode,
             unit_number,
             carpet_area,
             property_type
          )
        ),
        client:clients(
          id,
          name,
          email,
          phone
        ),
        assigned_user:users!quotations_assigned_to_fkey(
          id,
          name,
          email,
          avatar_url
        ),
        created_user:users!quotations_created_by_fkey(
          id,
          name,
          email,
          avatar_url
        )
      `, { count: "exact" });

    // Filter by lead status (active leads vs inactive leads)
    if (leadStatus === "active") {
      // Active leads: exclude won, lost, disqualified
      // Note: Filtering on joined tables can be tricky. 
      // For now, we'll try to rely on the client or valid Supabase syntax if possible.
      // But standard 'not' on joined column might fail if not inner join.
      // query = query.not("lead.stage", "in", "(won,lost,disqualified)");
      
      // Alternative: Filter locally or rely on lead_id being present?
      // For now, disabling strict server-side nested filtering to prevent 500 error.
    } else if (leadStatus === "inactive") {
      // Inactive leads: only won, lost, disqualified
      // query = query.in("lead.stage", ["won", "lost", "disqualified"]);
    }
    // If leadStatus is "all", no filter is applied

    // Filter by status
    if (status && status !== "all") {
      if (status === "active") {
        query = query.in("status", ["draft", "sent", "viewed", "negotiating"]);
      } else {
        query = query.eq("status", status);
      }
    }

    // Filter by lead
    if (leadId) {
      query = query.eq("lead_id", leadId);
    }

    // Filter by project
    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    // Order by created_at desc, then version desc
    query = query
      .order("created_at", { ascending: false })
      .order("version", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: rawQuotations, error, count } = await query;

    if (error) {
      console.error("Error fetching quotations:", error);
      return NextResponse.json(
        { error: "Failed to fetch quotations" },
        { status: 500 }
      );
    }

    // Process the data to match expected format with flattened relations
    const quotations = (rawQuotations || []).map((q: any) => {
      // Resolve client info - prefer direct client relation, fallback to lead's client
      const clientName = q.client?.name || q.lead?.client?.name || "";
      const clientEmail = q.client?.email || q.lead?.client?.email || "";
      const clientPhone = q.client?.phone || q.lead?.client?.phone || "";
      
      // Resolve property info from lead relation
      const propertyName = q.lead?.property?.property_name || "";
      const propertyAddress = q.lead?.property?.address_line1 || "";
      const propertyType = q.lead?.property?.property_type || "";
      const carpetArea = q.lead?.property?.carpet_area;
      const flatNumber = q.lead?.property?.unit_number;

      return {
        ...q,
        lead_number: q.lead?.lead_number || "",
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        property_name: propertyName,
        property_address: propertyAddress,
        property_type: propertyType,
        carpet_area_sqft: carpetArea,
        flat_number: flatNumber,
        assigned_to_name: q.assigned_user?.name,
        assigned_to_email: q.assigned_user?.email,
        assigned_to_avatar: q.assigned_user?.avatar_url,
        created_by_name: q.created_user?.name,
        lead_stage: q.lead?.stage
      };
    }); 


    // Fetch spaces and components counts for all quotations
    const quotationIds = (quotations || []).map((q) => q.id);
    
    let spacesCountMap: Record<string, number> = {};
    let componentsCountMap: Record<string, number> = {};

    if (quotationIds.length > 0) {
      // Get spaces counts
      const { data: spaceCounts } = await supabase
        .from("quotation_spaces")
        .select("quotation_id")
        .in("quotation_id", quotationIds);

      if (spaceCounts) {
        spacesCountMap = spaceCounts.reduce((acc, item) => {
          acc[item.quotation_id] = (acc[item.quotation_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }

      // Get components counts
      const { data: componentCounts } = await supabase
        .from("quotation_components")
        .select("quotation_id")
        .in("quotation_id", quotationIds);

      if (componentCounts) {
        componentsCountMap = componentCounts.reduce((acc, item) => {
          acc[item.quotation_id] = (acc[item.quotation_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }
    }

    // Add counts to each quotation
    const quotationsWithCounts = (quotations || []).map((q) => ({
      ...q,
      spaces_count: spacesCountMap[q.id] || 0,
      components_count: componentsCountMap[q.id] || 0,
    }));

    return NextResponse.json({
      quotations: quotationsWithCounts,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Quotations API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/quotations - Create a new quotation manually
export async function POST(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();
    const body = await request.json();

    const { lead_id, project_id, template_id } = body;

    // Standalone quotations are allowed (no lead_id or project_id required)

    // Get user's tenant_id
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user!.id)
      .single();

    if (userError || !userData?.tenant_id) {
      return NextResponse.json(
        { error: "Failed to get user tenant" },
        { status: 500 }
      );
    }

    // Generate or retrieve quotation number
    // For a given lead/project, all quotations share the same number with version incrementing
    const { quotationNumber, nextVersion } = await getQuotationNumberAndVersion(
      userData.tenant_id,
      lead_id,
      project_id
    );

    console.log(`[QUOTATION API] Generated quotation number: ${quotationNumber}, version: ${nextVersion}`);

    const today = new Date();

    // Get lead/project details for client info
    let clientName = "";
    let clientEmail = "";
    let clientPhone = "";
    let propertyName = "";
    let propertyAddress = "";
    let propertyType = null;
    let carpetArea = null;
    let clientId = null;

    if (lead_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select(`
          *,
          client:clients(*),
          property:properties(*)
        `)
        .eq("id", lead_id)
        .single();

      if (!lead) {
        return NextResponse.json(
          { error: "Lead not found" },
          { status: 404 }
        );
      }

      // Prevent creating new quotations for closed leads (won/lost/disqualified)
      if (["won", "lost", "disqualified"].includes(lead.stage)) {
        return NextResponse.json(
          { 
            error: `Cannot create new quotations for a ${lead.stage} lead. The lead is closed. Please create quotations at the project level instead.`,
            code: "LEAD_CLOSED"
          },
          { status: 400 }
        );
      }

      clientName = lead.client?.name || lead.client_name || "";
      clientEmail = lead.client?.email || lead.client_email || "";
      clientPhone = lead.client?.phone || lead.client_phone || "";
      propertyName = lead.property?.name || lead.property_name || "";
      propertyAddress = lead.property?.address || lead.property_address || "";
      propertyType = lead.property?.property_type || lead.property_type;
      carpetArea = lead.property?.carpet_area || lead.carpet_area;
      clientId = lead.client_id;
    }

    if (project_id) {
      const { data: project } = await supabase
        .from("projects")
        .select(`
          *,
          client:clients(*),
          property:properties(*)
        `)
        .eq("id", project_id)
        .single();

      if (project) {
        clientName = project.client?.name || clientName;
        clientEmail = project.client?.email || clientEmail;
        clientPhone = project.client?.phone || clientPhone;
        propertyName = project.property?.name || propertyName;
        propertyAddress = project.property?.address || propertyAddress;
        propertyType = project.property?.property_type || propertyType;
        carpetArea = project.property?.carpet_area || carpetArea;
        clientId = project.client_id || clientId;
      }
    }

    // Create the quotation
    // Determine title based on whether it's linked or standalone
    const isStandalone = !lead_id && !project_id;
    const quotationTitle = isStandalone 
      ? "Standalone Quotation"
      : `Quotation for ${clientName || "New Client"}`;

    const { data: newQuotation, error: createError } = await supabase
      .from("quotations")
      .insert({
        tenant_id: userData.tenant_id,
        quotation_number: quotationNumber,
        version: nextVersion,
        lead_id: lead_id || null,
        project_id: project_id || null,
        client_id: clientId || null,
        status: "draft",
        title: quotationTitle,
        presentation_level: "space_component",
        hide_dimensions: true,
        valid_from: today.toISOString(),
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_by: user!.id,
        subtotal: 0,
        discount_value: 0,
        discount_amount: 0,
        taxable_amount: 0,
        tax_percent: 0,
        tax_amount: 0,
        overhead_percent: 0,
        overhead_amount: 0,
        grand_total: 0,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating quotation:", createError);
      return NextResponse.json(
        { error: "Failed to create quotation" },
        { status: 500 }
      );
    }

    // If template_id is provided, copy template contents
    if (template_id && newQuotation) {
      await copyTemplateToQuotation(supabase, template_id, newQuotation.id);
    }

    return NextResponse.json({
      success: true,
      quotation: newQuotation,
      message: "Quotation created successfully",
    });
  } catch (error) {
    console.error("Create quotation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Copy template contents to a new quotation
 * 
 * Template Hierarchy:
 * - template_spaces (linked via space_type_id to space_types)
 * - quotation_template_line_items (linked via template_space_id to template_spaces, 
 *                        component_type_id to component_types,
 *                        cost_item_id to quotation_cost_items)
 * 
 * Quotation Hierarchy:
 * - quotation_spaces (Level 1)
 * - quotation_components (Level 2) - Created by grouping line items by component_type
 * - quotation_line_items (Level 3)
 * 
 * Mapping:
 * template_spaces → quotation_spaces
 * quotation_template_line_items grouped by (template_space_id + component_type_id) → quotation_components
 * quotation_template_line_items → quotation_line_items
 */
async function copyTemplateToQuotation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  templateId: string,
  quotationId: string
) {
  console.log(`\n========== COPYING TEMPLATE TO QUOTATION ==========`);
  console.log(`Template ID: ${templateId}`);
  console.log(`Quotation ID: ${quotationId}`);

  // Maps to track ID relationships
  const templateSpaceToQuotationSpace: Record<string, string> = {};
  const componentKey_to_QuotationComponentId: Record<string, string> = {};

  // ============================================================
  // STEP 1: Fetch and copy SPACES
  // ============================================================
  console.log(`\n--- STEP 1: Copying Spaces ---`);
  
  const { data: templateSpaces, error: spacesError } = await supabase
    .from("template_spaces")
    .select(`
      id,
      template_id,
      space_type_id,
      default_name,
      display_order,
      space_type:space_types(id, name, slug, description, icon)
    `)
    .eq("template_id", templateId)
    .order("display_order");

  if (spacesError) {
    console.error("Error fetching template spaces:", spacesError);
    return;
  }

  console.log(`Found ${templateSpaces?.length || 0} template spaces`);

  if (templateSpaces && templateSpaces.length > 0) {
    for (const tSpace of templateSpaces) {
      // space_type comes as array from Supabase relation, get first element
      const spaceType = Array.isArray(tSpace.space_type) ? tSpace.space_type[0] : tSpace.space_type;
      // Use default_name if set, otherwise use space_type name
      const spaceName = tSpace.default_name || spaceType?.name || "Unnamed Space";
      
      console.log(`  Creating space: "${spaceName}" (template_space_id: ${tSpace.id})`);

      const { data: newSpace, error: spaceInsertError } = await supabase
        .from("quotation_spaces")
        .insert({
          quotation_id: quotationId,
          space_type_id: tSpace.space_type_id,
          name: spaceName,
          description: spaceType?.description || null,
          display_order: tSpace.display_order || 0,
        })
        .select("id")
        .single();

      if (spaceInsertError) {
        console.error(`  ERROR creating space "${spaceName}":`, spaceInsertError);
      } else if (newSpace) {
        templateSpaceToQuotationSpace[tSpace.id] = newSpace.id;
        console.log(`  ✓ Created quotation_space: ${newSpace.id}`);
      }
    }
  }

  console.log(`Spaces created: ${Object.keys(templateSpaceToQuotationSpace).length}`);

  // ============================================================
  // STEP 2: Fetch ALL template line items
  // ============================================================
  console.log(`\n--- STEP 2: Fetching Line Items ---`);

  const { data: templateLineItems, error: lineItemsError } = await supabase
    .from("quotation_template_line_items")
    .select(`
      id,
      template_id,
      template_space_id,
      space_type_id,
      component_type_id,
      cost_item_id,
      rate,
      display_order,
      notes,
      metadata,
      measurement_unit,
      cost_item:quotation_cost_items(id, name, slug, unit_code, default_rate, company_cost, vendor_cost, description),
      component_type:component_types(id, name, slug, description, icon)
    `)
    .eq("template_id", templateId)
    .order("template_space_id", { nullsFirst: false })
    .order("component_type_id", { nullsFirst: false })
    .order("display_order");

  if (lineItemsError) {
    console.error("Error fetching template line items:", lineItemsError);
    return;
  }

  console.log(`Found ${templateLineItems?.length || 0} template line items`);

  if (!templateLineItems || templateLineItems.length === 0) {
    console.log("No line items to copy");
    return;
  }

  // ============================================================
  // STEP 3: Group line items by (space + component) to create components
  // ============================================================
  console.log(`\n--- STEP 3: Grouping Line Items by Component ---`);

  // Group line items by template_space_id + component_type_id
  const componentGroups = new Map<string, {
    templateSpaceId: string | null;
    quotationSpaceId: string | null;
    componentTypeId: string | null;
    componentName: string;
    lineItems: typeof templateLineItems;
  }>();

  for (const item of templateLineItems) {
    // Determine which quotation space this belongs to
    // Priority: template_space_id > space_type_id (for backwards compatibility)
    let quotationSpaceId: string | null = null;
    
    if (item.template_space_id && templateSpaceToQuotationSpace[item.template_space_id]) {
      quotationSpaceId = templateSpaceToQuotationSpace[item.template_space_id];
    }

    // component_type comes as array from Supabase relation, get first element
    const componentType = Array.isArray(item.component_type) ? item.component_type[0] : item.component_type;

    // Create a unique key for this space+component combination
    const groupKey = `${item.template_space_id || 'no-space'}_${item.component_type_id || 'no-component'}`;

    if (!componentGroups.has(groupKey)) {
      componentGroups.set(groupKey, {
        templateSpaceId: item.template_space_id,
        quotationSpaceId: quotationSpaceId,
        componentTypeId: item.component_type_id,
        componentName: componentType?.name || "General Items",
        lineItems: [],
      });
    }
    
    componentGroups.get(groupKey)!.lineItems.push(item);
  }

  console.log(`Created ${componentGroups.size} component groups`);

  // ============================================================
  // STEP 4: Create components and line items
  // ============================================================
  console.log(`\n--- STEP 4: Creating Components and Line Items ---`);

  let totalComponentsCreated = 0;
  let totalLineItemsCreated = 0;
  let componentDisplayOrder = 0;

  for (const [groupKey, group] of Array.from(componentGroups.entries())) {
    console.log(`\n  Processing group: ${groupKey}`);
    console.log(`    Space ID: ${group.quotationSpaceId || 'none'}`);
    console.log(`    Component Type: ${group.componentName}`);
    console.log(`    Line Items: ${group.lineItems.length}`);

    let quotationComponentId: string | null = null;

    // Only create a component if we have a space AND a component_type
    if (group.quotationSpaceId && group.componentTypeId) {
      const { data: newComponent, error: componentError } = await supabase
        .from("quotation_components")
        .insert({
          quotation_id: quotationId,
          space_id: group.quotationSpaceId,
          component_type_id: group.componentTypeId,
          name: group.componentName,
          display_order: componentDisplayOrder++,
        })
        .select("id")
        .single();

      if (componentError) {
        console.error(`    ERROR creating component "${group.componentName}":`, componentError);
      } else if (newComponent) {
        quotationComponentId = newComponent.id;
        componentKey_to_QuotationComponentId[groupKey] = newComponent.id;
        totalComponentsCreated++;
        console.log(`    ✓ Created component: ${newComponent.id}`);
      }
    } else {
      console.log(`    ⚠ Skipping component creation (no space or no component_type)`);
    }

    // Create line items for this group
    let lineItemDisplayOrder = 0;
    for (const item of group.lineItems) {
      // cost_item comes as array from Supabase relation, get first element
      const costItem = Array.isArray(item.cost_item) ? item.cost_item[0] : item.cost_item;
      const itemName = costItem?.name || "Unnamed Item";
      const unitCode = costItem?.unit_code || "sqft";
      const rate = item.rate ?? costItem?.default_rate ?? 0;
      const companyCost = costItem?.company_cost ?? null;
      const vendorCost = costItem?.vendor_cost ?? null;

      const { error: lineItemError } = await supabase
        .from("quotation_line_items")
        .insert({
          quotation_id: quotationId,
          quotation_space_id: group.quotationSpaceId,
          quotation_component_id: quotationComponentId,
          quotation_cost_item_id: item.cost_item_id,
          name: itemName,
          unit_code: unitCode,
          rate: rate,
          amount: 0, // User will enter dimensions/quantity
          quantity: null, // User will enter
          length: null, // User will enter
          width: null, // User will enter
          display_order: lineItemDisplayOrder++,
          notes: item.notes,
          metadata: item.metadata,
          measurement_unit: item.measurement_unit || "mm",
          company_cost: companyCost,
          vendor_cost: vendorCost,
        });

      if (lineItemError) {
        console.error(`    ERROR creating line item "${itemName}":`, lineItemError);
      } else {
        totalLineItemsCreated++;
        console.log(`      ✓ Line item: ${itemName}`);
      }
    }
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log(`\n========== TEMPLATE COPY COMPLETE ==========`);
  console.log(`Spaces created: ${Object.keys(templateSpaceToQuotationSpace).length}`);
  console.log(`Components created: ${totalComponentsCreated}`);
  console.log(`Line items created: ${totalLineItemsCreated}`);
  console.log(`=============================================\n`);
}
