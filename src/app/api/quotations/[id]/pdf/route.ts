import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
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
  
  // Determine measurement type from unit code
  if (["sqft", "sft", "sq.ft"].includes(unitCode)) {
    // Area based
    const length = item.length || 0;
    const width = item.width || 0;
    return length * width * (item.rate || 0);
  } else if (["rft", "ft", "running ft"].includes(unitCode)) {
    // Length based
    return (item.length || 0) * (item.rate || 0);
  } else if (["lot", "lumpsum", "ls", "job"].includes(unitCode)) {
    // Fixed/lumpsum
    return item.rate || 0;
  } else {
    // Quantity based (nos, pcs, etc.)
    return (item.quantity || 1) * (item.rate || 0);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id } = await params;
    const supabase = await createClient();

    // Get quotation with full details including relations
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
      .eq("id", id)
      .single();

    if (quotationError || !quotation) {
      return NextResponse.json(
        { success: false, error: "Quotation not found" },
        { status: 404 }
      );
    }

    // Extract client and property data from relations
    const client = quotation.client as { name?: string; email?: string; phone?: string } | null;
    const lead = quotation.lead as { property?: Record<string, unknown> } | null;
    const property = lead?.property as Record<string, unknown> | null;

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
      .eq("quotation_id", id)
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
      .eq("quotation_id", id)
      .order("display_order");

    // Get line items
    const { data: lineItemsData, error: lineItemsError } = await supabase
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
        cost_item:quotation_cost_item_id (
          id, name, description, category_id,
          category:quotation_cost_item_categories (id, name, display_order, is_charge)
        )
      `)
      .eq("quotation_id", id)
      .order("display_order");

    // A silent failure here printed a document with every price at zero, which
    // is far worse than not printing at all.
    if (lineItemsError) {
      console.error("Error loading line items for PDF:", lineItemsError);
      return NextResponse.json(
        { error: "Could not read the quotation's line items" },
        { status: 500 }
      );
    }
    // Get tenant settings for company/bank details
    const { data: tenantSettings } = await supabase
      .from("tenant_quotation_settings")
      .select("*")
      .eq("tenant_id", quotation.tenant_id)
      .single();

    // The tenant's print format decides how much of the quotation the document
    // shows and where prices appear. One per tenant for now: the default,
    // falling back to whichever single format is active.
    // ?format_id= picks one explicitly; without it the tenant's default wins.
    // Scoped to the tenant either way, so a format id from elsewhere cannot be
    // used to reshape someone else's document.
    const requestedFormatId = request.nextUrl.searchParams.get("format_id");
    let formatQuery = supabase
      .from("quotation_print_formats")
      .select("*")
      .eq("tenant_id", quotation.tenant_id)
      .eq("is_active", true);
    if (requestedFormatId) {
      formatQuery = formatQuery.eq("id", requestedFormatId);
    }
    const { data: printFormats } = await formatQuery
      .order("is_default", { ascending: false })
      .order("display_order", { ascending: true })
      .limit(1);
    const printFormat = printFormats?.[0] || null;

    // The live terms, rendered at print time. Deliberately not snapshotted onto
    // the quotation yet - that belongs with the approve-then-send flow.
    // The clause this print format attaches, falling back to the tenant's
    // default when the format names none. One clause, not every active one -
    // printing them all put V1 and V2 of the same terms back to back.
    const formatClauseId = (
      printFormat as { terms_clause_id?: string | null } | null
    )?.terms_clause_id;

    let clauseQuery = supabase
      .from("quotation_terms_clauses")
      .select("title, content")
      .eq("tenant_id", quotation.tenant_id)
      .eq("is_active", true);
    clauseQuery = formatClauseId
      ? clauseQuery.eq("id", formatClauseId)
      : clauseQuery.order("is_default", { ascending: false });

    const { data: termsClauses } = await clauseQuery
      .order("display_order", { ascending: true })
      .limit(1);

    // Build the spaces hierarchy
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
          category_name: item.cost_item?.category?.name || "Other",
          category_order: item.cost_item?.category?.display_order ?? 99,
          // The Material column is assembled from these rather than typed by
          // hand, so it can never describe a material the quotation no longer
          // uses. Falls back to the cost item's name when it has no
          // description of its own.
          description: item.cost_item?.description || null,
          is_charge: item.cost_item?.category?.is_charge === true,
        }));

        const componentSubtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);

        return {
          name: comp.name || comp.component_type?.name || "Component",
          description: comp.description,
          line_items: lineItems,
          subtotal: componentSubtotal,
        };
      });

      // Also get direct line items (not under components)
      const directLineItems = (lineItemsData || []).filter(
        (li: any) => li.quotation_space_id === space.id && !li.quotation_component_id
      );

      if (directLineItems.length > 0) {
        const directItems: LineItemData[] = directLineItems.map((item: any) => ({
          name: item.name,
          unit_code: item.unit_code,
          length: item.length,
          width: item.width,
          quantity: item.quantity,
          rate: item.rate || 0,
          amount: item.amount || calculateLineItemAmount(item),
          category_name: item.cost_item?.category?.name || "Other",
          category_order: item.cost_item?.category?.display_order ?? 99,
          // The Material column is assembled from these rather than typed by
          // hand, so it can never describe a material the quotation no longer
          // uses. Falls back to the cost item's name when it has no
          // description of its own.
          description: item.cost_item?.description || null,
          is_charge: item.cost_item?.category?.is_charge === true,
        }));

        const directSubtotal = directItems.reduce((sum, li) => sum + li.amount, 0);

        components.push({
          name: "Other Items",
          line_items: directItems,
          subtotal: directSubtotal,
        });
      }

      const spaceSubtotal = components.reduce((sum, c) => sum + c.subtotal, 0);

      // A space whose every line is a charge prints below the room totals
      // rather than as a numbered room. Decided here because it is a property
      // of the contents, not something anyone has to remember to set.
      const allLines = components.flatMap((c) => c.line_items);
      const isCharges =
        allLines.length > 0 &&
        allLines.every((li) => (li as { is_charge?: boolean }).is_charge);

      return {
        name: space.name,
        space_type_name: space.space_type?.name,
        components,
        subtotal: space.subtotal || spaceSubtotal,
        is_charges: isCharges,
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
      // The document is dated when it was raised, and its validity is counted
      // from the day it is printed. A stored valid_until that has already
      // passed would otherwise hand the client a quotation that expired before
      // they received it - QT-20251216-001 was offering 15 January.
      valid_from: quotation.valid_from || quotation.created_at,
      valid_until: (() => {
        const stored = quotation.valid_until;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (stored && new Date(stored) >= today) return stored;
        const days = tenantSettings?.default_validity_days ?? 15;
        const until = new Date(today);
        until.setDate(until.getDate() + days);
        return until.toISOString().slice(0, 10);
      })(),

      client_name: client?.name || undefined,
      client_email: client?.email || undefined,
      client_phone: client?.phone || undefined,

      property_name: (property?.property_name || undefined) as string | undefined,
      property_address: (property?.address_line1 || undefined) as string | undefined,
      property_type: (property?.property_type || undefined) as string | undefined,
      carpet_area: (property?.carpet_area || undefined) as number | undefined,

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
      // A quotation carrying its own terms text overrides the library, which
      // is what a snapshotted quotation will do once that exists.
      terms_sections: quotation.terms_and_conditions
        ? [{ title: "Terms & Conditions", content: quotation.terms_and_conditions }]
        : (termsClauses || []).map((c) => ({ title: c.title, content: c.content })),
      notes: quotation.notes,

      // How the document is laid out comes from the print format; the
      // quotation's own presentation_level stays as the fallback for a tenant
      // with no format configured.
      itemise_to: printFormat?.itemise_to || undefined,
      price_at: printFormat?.price_at || undefined,
      show_descriptions: printFormat?.show_descriptions,
      show_specifications: printFormat?.show_specifications,
      show_quantities: printFormat?.show_quantities,
      show_payment_terms: printFormat?.show_payment_terms,
      show_terms: printFormat?.show_terms,
      cover_enabled: printFormat?.cover_enabled ?? false,
      cover_image_path: printFormat?.cover_image_path || undefined,

      presentation_level: quotation.presentation_level || "space_component",
      hide_dimensions:
        printFormat?.show_dimensions !== undefined
          ? !printFormat.show_dimensions
          : quotation.hide_dimensions ?? true,
      header_color:
        printFormat?.header_color || quotation.header_color || "#1e40af",

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

      show_company_details:
        printFormat?.show_company_details ?? quotation.show_company_details ?? true,
      show_bank_details:
        printFormat?.show_bank_details ?? quotation.show_bank_details ?? true,
      custom_footer_text:
        printFormat?.footer_text || quotation.custom_footer_text,
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
        // ?inline=1 renders in a viewer instead of downloading, which is what
        // the print preview embeds.
        "Content-Disposition": `${
          request.nextUrl.searchParams.get("inline") === "1"
            ? "inline"
            : "attachment"
        }; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to generate PDF",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
