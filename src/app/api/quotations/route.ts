import { NextRequest, NextResponse } from "next/server";
import { normalisePhone } from "@/lib/partners/identity";
import { createClient } from "@/lib/supabase/server";
import { copyScopeToQuotation, type ScopeCopyResult } from "@/lib/quotations/scope-to-quotation";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { getQuotationNumberAndVersion } from "@/utils/quotation-number-generator";
import {
  logQuotationActivity,
  quotationLabel,
} from "@/lib/quotations/log-activity";

// GET /api/quotations - List all quotations with lead data
export async function GET(request: NextRequest) {
  try {
    // Protect API route with user status check
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["quotations.view"],
    });
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
        query = query.in("status", ["draft", "sent"]);
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


    // What the list shows beside each row, read in one query each:
    //  - the project a quotation belongs to (quotations.project_id carries
    //    no foreign key, so it cannot be embedded);
    //  - the owner's name and avatar through tenant_directory - the users
    //    embed above resolves only for the caller and returns null for a
    //    colleague, which read as "no owner" on every row but one's own;
    //  - how many versions the quotation number has, for "v2 of 3".
    const projectIds = [...new Set((quotations || []).map((q: any) => q.project_id).filter(Boolean))] as string[];
    const projectById = new Map<string, any>();
    if (projectIds.length > 0) {
      const { data: projectRows } = await supabase
        .from("projects")
        .select("id, project_number, name, status, client:clients!client_id(name, email, phone), property:properties!property_id(property_name, property_type, city)")
        .in("id", projectIds);
      for (const p of projectRows ?? []) projectById.set(p.id, p);
    }

    const ownerIds = [...new Set((quotations || []).flatMap((q: any) => [q.assigned_to, q.created_by]).filter(Boolean))] as string[];
    const personById = new Map<string, { id: string; name: string; avatar_url: string | null }>();
    if (ownerIds.length > 0) {
      const { data: people } = await supabase.from("tenant_directory").select("id, name, avatar_url").in("id", ownerIds);
      for (const p of people ?? []) personById.set(p.id, p);
    }

    const numbers = [...new Set((quotations || []).map((q: any) => q.quotation_number).filter(Boolean))] as string[];
    const versionsOf = new Map<string, number>();
    if (numbers.length > 0) {
      const { data: versionRows } = await supabase
        .from("quotations")
        .select("quotation_number, version")
        .in("quotation_number", numbers);
      for (const r of versionRows ?? []) {
        versionsOf.set(r.quotation_number, Math.max(versionsOf.get(r.quotation_number) ?? 0, r.version ?? 1));
      }
    }

    for (const q of quotations as any[]) {
      const project = q.project_id ? projectById.get(q.project_id) : null;
      const pClient = project ? (Array.isArray(project.client) ? project.client[0] : project.client) : null;
      const pProperty = project ? (Array.isArray(project.property) ? project.property[0] : project.property) : null;
      if (project) {
        q.project_number = project.project_number;
        q.project_name = project.name;
        q.project_status = project.status;
        if (!q.client_name && pClient?.name) {
          q.client_name = pClient.name;
          q.client_email = pClient.email || "";
          q.client_phone = pClient.phone || "";
        }
        if (!q.property_name && pProperty?.property_name) {
          q.property_name = pProperty.property_name;
          q.property_type = pProperty.property_type || "";
          q.property_city = pProperty.city || null;
        }
      }
      if (q.lead?.property?.city) q.property_city = q.lead.property.city;
      const ownerId = q.assigned_to || q.created_by;
      q.owner = ownerId ? (personById.get(ownerId) ?? null) : null;
      q.versions_total = versionsOf.get(q.quotation_number) ?? q.version ?? 1;
    }

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
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["quotations.create"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();
    const body = await request.json();

    const { lead_id, project_id, template_id , from_scope } = body;
    // Two ways of starting from the scope besides the plain one:
    //   variation   (project only) a quotation of only what the scope has
    //               gained since the project's approved quotations - the
    //               extra work after sign-off, priced on its own.
    const variation = body.variation === true && !!project_id;


    // Standalone quotations are allowed (no lead_id or project_id required).
    // They carry the customer the person typed: a clients row, created here
    // and linked, the same way a directly created project gets one - a
    // quotation has client_id and nothing else to hold a name. A vendor
    // quotation handed to a customer to pay the painter is the usual case.
    const typedClient =
      !lead_id && !project_id && body.client && typeof body.client === "object"
        ? {
            name: String(body.client.name ?? "").trim(),
            phone: String(body.client.phone ?? "").trim() || null,
            email: String(body.client.email ?? "").trim().toLowerCase() || null,
            address: String(body.client.address ?? "").trim() || null,
          }
        : null;
    if (!lead_id && !project_id && !typedClient?.name) {
      return NextResponse.json(
        { error: "A standalone quotation needs the customer's name" },
        { status: 400 }
      );
    }

    // The guard already resolved the tenant. Re-selecting `users` through the
    // session client asked the one table whose only SELECT policy is
    // `id = auth.uid()` for a row it had just been handed, and answered
    // "Failed to get user tenant" when that came back empty - a 500 with no
    // way to act on it, on the way to creating Option 2 (2026-09-24). Same
    // redundant read the calendar carried, same fix.
    const userData = { tenant_id: user.tenantId };

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
        clientId = project.client_id || clientId;
      }
    }

    if (typedClient && typeof body.client?.partner_id === "string" && body.client.partner_id) {
      // A partner we already know: its customer record, or one made now.
      const { data: partner } = await supabase
        .from("partners")
        .select("id, name, phone, email, city, kind, clients:clients(id)")
        .eq("id", body.client.partner_id)
        .maybeSingle();
      if (!partner) return NextResponse.json({ error: "That partner was not found" }, { status: 400 });
      const existing = ((partner as any).clients ?? [])[0];
      if (existing) {
        clientId = existing.id;
      } else {
        const { data: made } = await supabase
          .from("clients")
          .insert({
            tenant_id: userData.tenant_id,
            partner_id: partner.id,
            client_type: partner.kind === "organisation" ? "company" : "individual",
            status: "active",
            name: partner.name,
            phone: partner.phone,
            email: partner.email,
            city: partner.city,
            created_by: user!.id,
          })
          .select("id")
          .single();
        clientId = made?.id ?? null;
        await supabase.from("partner_type_links").upsert({ partner_id: partner.id, type_code: "customer" }, { onConflict: "partner_id,type_code" });
      }
      clientName = partner.name;
    } else if (typedClient) {
      // A new person: a partner above the customer record, so the next form
      // that sees this phone number offers them instead of duplicating.
      const { data: partner } = await supabase
        .from("partners")
        .insert({
          tenant_id: userData.tenant_id,
          kind: "person",
          name: typedClient.name,
          phone: normalisePhone(typedClient.phone),
          email: typedClient.email,
          address_line1: typedClient.address,
          created_by: user!.id,
        })
        .select("id")
        .single();
      if (partner) {
        await supabase.from("partner_type_links").insert({ partner_id: partner.id, type_code: "customer" });
        await supabase.from("partner_contacts").insert({
          tenant_id: userData.tenant_id,
          partner_id: partner.id,
          name: typedClient.name,
          phone: normalisePhone(typedClient.phone),
          email: typedClient.email,
          is_primary: true,
        });
      }
      const { data: made, error: clientError } = await supabase
        .from("clients")
        .insert({
          partner_id: partner?.id ?? null,
          tenant_id: userData.tenant_id,
          client_type: "individual",
          status: "active",
          name: typedClient.name,
          phone: typedClient.phone,
          email: typedClient.email,
          address_line1: typedClient.address,
          created_by: user!.id,
        })
        .select("id")
        .single();
      if (clientError || !made) {
        console.error("[QUOTATION API] Could not create the client:", clientError);
        return NextResponse.json({ error: "Could not save the customer" }, { status: 500 });
      }
      clientId = made.id;
      clientName = typedClient.name;
    }

    const quotationTitle = variation
      ? `Variation for ${clientName || "New Client"}`
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
        // No expiry unless the person creating it chose one. A default of
        // 30 days was a date nobody had decided, and it only ever made the
        // list say "expired".
        valid_until:
          typeof body.valid_until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.valid_until) ? body.valid_until : null,
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

    // Otherwise, build it from the property's Spaces if asked to. Templates
    // win when both are given: a template is a deliberate choice of contents,
    // while scope is the fallback structure.
    let generated: ScopeCopyResult = { spaces: 0, components: 0, lines: 0, skipped: 0, already: 0, added: { spaces: [], components: [], lines: [] }, unsized: [] };
    if (!template_id && from_scope && newQuotation) {
      let pricedOn: string[] | undefined;
      if (variation) {
        const { data: approved } = await supabase.from("quotations").select("id").eq("project_id", project_id).eq("status", "approved");
        pricedOn = (approved ?? []).map((q) => q.id as string);
      }
      generated = await copyScopeToQuotation(
        supabase,
        userData.tenant_id,
        newQuotation.id,
        lead_id || null,
        project_id || null,
        { pricedOn }
      );
    }

    await logQuotationActivity(supabase, {
      quotation: newQuotation,
      type: "quotation_created",
      title: `${quotationLabel(newQuotation)} created`,
      description: template_id
        ? "Created from a template"
        : from_scope
        ? `${variation ? "Variation - only what the scope gained since approval" : "Started from the scope"} - ${generated.spaces} space(s), ${generated.components} component(s), ${generated.lines} item(s)${
            generated.skipped ? `; ${generated.skipped} not ours to price` : ""
          }`
        : undefined,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      quotation: newQuotation,
      generated_from_scope: generated,
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

/**
 * Build a quotation's spaces and components from the property's Spaces tab.
 *
 * A one-time copy, deliberately: see the decision note on
 * src/types/property-scope.ts. Nothing links the two afterwards, so the
 * quotation can be negotiated, revised and reshaped without the scope list
 * arguing with it, and a space can later be deleted without touching any
 * quotation built from it.
 *
 * Dimensions land at the level they were measured at. A room's length x width
 * describes a floor plan and belongs on the space; a wardrobe's width x height
 * describes a face and belongs on the component, where it also feeds the
 * builder's dimension inheritance down to that component's cost items.
 */
