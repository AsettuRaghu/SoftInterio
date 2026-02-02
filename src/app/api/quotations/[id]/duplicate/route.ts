import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { getQuotationNumberAndVersion } from "@/utils/quotation-number-generator";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();
    const { id } = await params;

    // Fetch the original quotation
    const { data: original, error: fetchError } = await supabase
      .from("quotations")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !original) {
      return NextResponse.json(
        { error: "Quotation not found" },
        { status: 404 }
      );
    }

    // Fetch related data: spaces, components, line items
    const [spacesResult, componentsResult, lineItemsResult] = await Promise.all([
      supabase
        .from("quotation_spaces")
        .select("*")
        .eq("quotation_id", id)
        .order("display_order", { ascending: true }),
      supabase
        .from("quotation_components")
        .select("*")
        .eq("quotation_id", id)
        .order("display_order", { ascending: true }),
      supabase
        .from("quotation_line_items")
        .select("*")
        .eq("quotation_id", id)
        .order("display_order", { ascending: true }),
    ]);

    // Generate new quotation number
    const today = new Date();

    // Get quotation number and version - reuses existing number if for same lead/project
    const { quotationNumber, nextVersion } = await getQuotationNumberAndVersion(
      original.tenant_id,
      original.lead_id,
      original.project_id
    );

    // Create new quotation as a copy
    const duplicateData = {
      tenant_id: original.tenant_id,
      lead_id: original.lead_id,
      client_id: original.client_id,
      project_id: original.project_id,
      quotation_number: quotationNumber,
      version: nextVersion,
      status: "draft" as const,
      title: original.title ? `${original.title} (Copy)` : "Quotation (Copy)",
      description: original.description,
      subtotal: original.subtotal,
      discount_type: original.discount_type,
      discount_value: original.discount_value,
      discount_amount: original.discount_amount,
      taxable_amount: original.taxable_amount,
      tax_percent: original.tax_percent,
      tax_amount: original.tax_amount,
      overhead_percent: original.overhead_percent,
      overhead_amount: original.overhead_amount,
      grand_total: original.grand_total,
      payment_terms: original.payment_terms,
      terms_and_conditions: original.terms_and_conditions,
      notes: original.notes,
      presentation_level: original.presentation_level,
      hide_dimensions: original.hide_dimensions,
      valid_from: original.valid_from,
      valid_until: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(), // 30 days from now
      created_by: user!.id,
    };

    const { data: newQuotation, error: createError } = await supabase
      .from("quotations")
      .insert(duplicateData)
      .select()
      .single();

    if (createError || !newQuotation) {
      console.error("Error creating duplicate quotation:", createError);
      return NextResponse.json(
        { error: "Failed to duplicate quotation" },
        { status: 500 }
      );
    }

    // Build ID mappings for spaces and components to properly link line items
    const spaceIdMapping: Record<string, string> = {};
    const componentIdMapping: Record<string, string> = {};

    // Copy spaces and build mapping
    if (spacesResult.data && spacesResult.data.length > 0) {
      for (const space of spacesResult.data) {
        const { data: newSpace, error: spaceError } = await supabase
          .from("quotation_spaces")
          .insert({
            quotation_id: newQuotation.id,
            space_type_id: space.space_type_id,
            name: space.name,
            description: space.description,
            length: space.length,
            width: space.width,
            area: space.area,
            subtotal: space.subtotal,
            display_order: space.display_order,
            metadata: space.metadata,
          })
          .select("id")
          .single();

        if (spaceError) {
          console.error("Error copying space:", spaceError);
        } else if (newSpace) {
          spaceIdMapping[space.id] = newSpace.id;
        }
      }
    }

    // Copy components and build mapping
    if (componentsResult.data && componentsResult.data.length > 0) {
      for (const component of componentsResult.data) {
        const { data: newComponent, error: componentError } = await supabase
          .from("quotation_components")
          .insert({
            quotation_id: newQuotation.id,
            space_id: component.space_id ? spaceIdMapping[component.space_id] || null : null,
            component_type_id: component.component_type_id,
            name: component.name,
            description: component.description,
            length: component.length,
            width: component.width,
            area: component.area,
            subtotal: component.subtotal,
            display_order: component.display_order,
            metadata: component.metadata,
          })
          .select("id")
          .single();

        if (componentError) {
          console.error("Error copying component:", componentError);
        } else if (newComponent) {
          componentIdMapping[component.id] = newComponent.id;
        }
      }
    }

    // Copy line items with proper ID mapping
    if (lineItemsResult.data && lineItemsResult.data.length > 0) {
      const newLineItems = lineItemsResult.data.map((item) => ({
        quotation_id: newQuotation.id,
        quotation_space_id: item.quotation_space_id 
          ? spaceIdMapping[item.quotation_space_id] || null 
          : null,
        quotation_component_id: item.quotation_component_id 
          ? componentIdMapping[item.quotation_component_id] || null 
          : null,
        quotation_cost_item_id: item.quotation_cost_item_id,
        name: item.name,
        length: item.length,
        width: item.width,
        measurement_unit: item.measurement_unit,
        quantity: item.quantity,
        unit_code: item.unit_code,
        rate: item.rate,
        amount: item.amount,
        display_order: item.display_order,
        notes: item.notes,
        metadata: item.metadata,
      }));

      const { error: itemsError } = await supabase
        .from("quotation_line_items")
        .insert(newLineItems);

      if (itemsError) {
        console.error("Error copying line items:", itemsError);
      }
    }

    return NextResponse.json({
      success: true,
      quotation: newQuotation,
      message: "Quotation duplicated successfully",
    });
  } catch (err) {
    console.error("Duplicate quotation error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
