import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { QuotationPDF } from "@/components/quotations/QuotationPDF";
import type { 
  QuotationPDFData, 
  SpaceData, 
  ComponentData, 
  LineItemData 
} from "@/components/quotations/QuotationPDF";
import React from "react";

// Helper to calculate line item amount
function calculateLineItemAmount(item: any): number {
  const unitCode = item.unit_code?.toLowerCase() || "nos";
  
  if (["sqft", "sft", "sq.ft"].includes(unitCode)) {
    const length = item.length || 0;
    const width = item.width || 0;
    return length * width * (item.rate || 0);
  } else if (["rft", "ft", "running ft"].includes(unitCode)) {
    return (item.length || 0) * (item.rate || 0);
  } else if (["lot", "lumpsum", "ls", "job"].includes(unitCode)) {
    return item.rate || 0;
  } else {
    return (item.quantity || 1) * (item.rate || 0);
  }
}

/**
 * Client downloads PDF via token (no auth required)
 * GET /api/quotations/client/[token]/pdf
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = await createClient();

    // Find quotation by token (no auth required) with relations
    const { data: quotation, error: quotationError } = await supabase
      .from("quotations")
      .select(`
        *,
        client:clients!client_id(id, name, email, phone),
        lead:leads!lead_id(
          id,
          property:properties(
            id,
            property_name,
            address_line1,
            city,
            carpet_area,
            property_type
          )
        )
      `)
      .eq("client_access_token", token)
      .single();

    if (quotationError || !quotation) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired link" },
        { status: 404 }
      );
    }

    // Extract client and property data from relations
    const client = quotation.client as { name?: string; email?: string; phone?: string } | null;
    const lead = quotation.lead as { property?: Record<string, unknown> } | null;
    const property = lead?.property as Record<string, unknown> | null;

    // Check if expired
    if (quotation.client_access_expires_at) {
      const expiresAt = new Date(quotation.client_access_expires_at);
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { success: false, error: "Link has expired" },
          { status: 410 }
        );
      }
    }

    // Get spaces
    const { data: spacesData } = await supabase
      .from("quotation_spaces")
      .select(`
        id,
        name,
        description,
        display_order,
        subtotal,
        space_type:space_type_id (id, name)
      `)
      .eq("quotation_id", quotation.id)
      .order("display_order");

    // Get components
    const { data: componentsData } = await supabase
      .from("quotation_components")
      .select(`
        id,
        space_id,
        name,
        description,
        width,
        height,
        depth,
        display_order,
        subtotal,
        component_type:component_type_id (id, name)
      `)
      .eq("quotation_id", quotation.id)
      .order("display_order");

    // Get line items
    const { data: lineItemsData } = await supabase
      .from("quotation_line_items")
      .select(`
        id,
        quotation_space_id,
        quotation_component_id,
        name,
        length,
        width,
        quantity,
        unit_code,
        rate,
        amount,
        display_order,
        cost_item:cost_item_id (id, name, category_id)
      `)
      .eq("quotation_id", quotation.id)
      .order("display_order");

    // Get tenant settings
    const { data: tenantSettings } = await supabase
      .from("tenant_quotation_settings")
      .select("*")
      .eq("tenant_id", quotation.tenant_id)
      .single();

    // Build spaces hierarchy
    const spaces: SpaceData[] = (spacesData || []).map((space: any) => {
      const spaceComponents = (componentsData || []).filter(
        (c: any) => c.space_id === space.id
      );

      const components: ComponentData[] = spaceComponents.map((comp: any) => {
        const compLineItems = (lineItemsData || []).filter(
          (li: any) => li.quotation_component_id === comp.id
        );

        const lineItems: LineItemData[] = compLineItems.map((item: any) => ({
          name: item.name,
          unit_code: item.unit_code,
          length: item.length,
          width: item.width,
          quantity: item.quantity,
          rate: item.rate || 0,
          amount: item.amount || calculateLineItemAmount(item),
        }));

        const componentSubtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);

        return {
          name: comp.name || comp.component_type?.name || "Component",
          description: comp.description,
          line_items: lineItems,
          subtotal: componentSubtotal,
        };
      });

      const spaceSubtotal = components.reduce((sum, c) => sum + c.subtotal, 0);

      return {
        name: space.name,
        space_type_name: space.space_type?.name,
        components,
        subtotal: space.subtotal || spaceSubtotal,
      };
    });

    // Calculate totals
    const subtotal = spaces.reduce((sum, s) => sum + s.subtotal, 0);
    const discountAmount = quotation.discount_amount || 0;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = quotation.tax_amount || (taxableAmount * (quotation.tax_percent || 18) / 100);
    const grandTotal = quotation.grand_total || (taxableAmount + taxAmount);

    // Build PDF data
    const pdfData: QuotationPDFData = {
      quotation_number: quotation.quotation_number,
      version: quotation.version || 1,
      title: quotation.title,
      status: quotation.status,
      valid_from: quotation.valid_from,
      valid_until: quotation.valid_until,

      client_name: client?.name || null,
      client_email: client?.email || null,
      client_phone: client?.phone || null,

      property_name: property?.property_name as string | null | undefined,
      property_address: property?.address_line1 as string | null | undefined,
      property_type: property?.property_type as string | null | undefined,
      carpet_area: property?.carpet_area as number | null | undefined,

      subtotal: subtotal,
      discount_type: quotation.discount_type,
      discount_value: quotation.discount_value,
      discount_amount: discountAmount,
      taxable_amount: taxableAmount,
      tax_percent: quotation.tax_percent || 18,
      tax_amount: taxAmount,
      grand_total: grandTotal,

      spaces,

      payment_terms: quotation.payment_terms,
      terms_and_conditions: quotation.terms_and_conditions,
      notes: quotation.notes,

      presentation_level: quotation.presentation_level || "space_component",
      hide_dimensions: quotation.hide_dimensions ?? true,
      header_color: quotation.header_color || "#1e40af",

      company: tenantSettings ? {
        name: tenantSettings.company_name,
        address: tenantSettings.company_address,
        phone: tenantSettings.company_phone,
        email: tenantSettings.company_email,
        website: tenantSettings.company_website,
        gstin: tenantSettings.company_gstin,
        logo_url: tenantSettings.company_logo_url,
      } : undefined,

      bank: tenantSettings ? {
        bank_name: tenantSettings.bank_name,
        account_name: tenantSettings.bank_account_name,
        account_number: tenantSettings.bank_account_number,
        ifsc_code: tenantSettings.bank_ifsc_code,
        branch: tenantSettings.bank_branch,
      } : undefined,

      show_company_details: true,
      show_bank_details: true,
    };

    // Generate PDF
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfElement = React.createElement(QuotationPDF, { data: pdfData }) as any;
    const pdfBuffer = await renderToBuffer(pdfElement);

    // Return PDF
    const filename = `${quotation.quotation_number}-v${quotation.version || 1}.pdf`;
    
    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(pdfBuffer);
    
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
