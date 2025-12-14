import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { QuotationClientView } from "./QuotationClientView";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ClientQuotationPage({ params }: PageProps) {
  const { token } = await params;

  if (!token || token.length < 32) {
    notFound();
  }

  const supabase = await createClient();

  // Find quotation by token (no auth required) with relations
  const { data: rawQuotation, error } = await supabase
    .from("quotations")
    .select(
      `
      id,
      tenant_id,
      quotation_number,
      version,
      title,
      description,
      status,
      valid_from,
      valid_until,
      subtotal,
      discount_type,
      discount_value,
      discount_amount,
      tax_percent,
      tax_amount,
      grand_total,
      payment_terms,
      terms_and_conditions,
      notes,
      presentation_level,
      hide_dimensions,
      client_access_token,
      client_access_expires_at,
      client:clients!client_id(
        id,
        name,
        email,
        phone
      ),
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
    `
    )
    .eq("client_access_token", token)
    .single();

  if (error || !rawQuotation) {
    notFound();
  }

  // Extract client and property data from relations
  const client = rawQuotation.client as {
    name?: string;
    email?: string;
    phone?: string;
  } | null;
  const lead = rawQuotation.lead as {
    property?: Record<string, unknown>;
  } | null;
  const property = lead?.property as Record<string, unknown> | null;

  // Flatten data for component compatibility
  const quotation = {
    ...rawQuotation,
    client_name: client?.name || null,
    client_email: client?.email || null,
    client_phone: client?.phone || null,
    property_name: property?.property_name as string | null | undefined,
    property_address: property?.address_line1 as string | null | undefined,
    property_type: property?.property_type as string | null | undefined,
    carpet_area: property?.carpet_area as number | null | undefined,
  };

  // Check if expired
  if (quotation.client_access_expires_at) {
    const expiresAt = new Date(quotation.client_access_expires_at);
    if (expiresAt < new Date()) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">
              Link Expired
            </h1>
            <p className="text-slate-600">
              This quotation link has expired. Please contact the sender to
              request a new link.
            </p>
          </div>
        </div>
      );
    }
  }

  // Track view (server action would be better but this works)
  try {
    await supabase
      .from("quotations")
      .update({
        client_view_count: (quotation as any).client_view_count
          ? (quotation as any).client_view_count + 1
          : 1,
        last_client_view_at: new Date().toISOString(),
        viewed_at:
          quotation.status === "sent" ? new Date().toISOString() : undefined,
        status: quotation.status === "sent" ? "viewed" : quotation.status,
      })
      .eq("id", quotation.id);
  } catch (e) {
    // Ignore tracking errors
  }

  // Get spaces and components
  const { data: spacesData } = await supabase
    .from("quotation_spaces")
    .select(
      `
      id,
      name,
      description,
      display_order,
      subtotal,
      space_type:space_type_id (id, name)
    `
    )
    .eq("quotation_id", quotation.id)
    .order("display_order");

  const { data: componentsData } = await supabase
    .from("quotation_components")
    .select(
      `
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
    `
    )
    .eq("quotation_id", quotation.id)
    .order("display_order");

  const { data: lineItemsData } = await supabase
    .from("quotation_line_items")
    .select(
      `
      id,
      quotation_space_id,
      quotation_component_id,
      name,
      group_name,
      length,
      width,
      quantity,
      unit_code,
      rate,
      amount,
      display_order
    `
    )
    .eq("quotation_id", quotation.id)
    .order("display_order");

  // Get tenant settings for company info
  const { data: tenantSettings } = await supabase
    .from("tenant_quotation_settings")
    .select("*")
    .eq("tenant_id", quotation.tenant_id)
    .single();

  // Build hierarchy
  const spaces = (spacesData || []).map((space: any) => {
    const spaceComponents = (componentsData || []).filter(
      (c: any) => c.space_id === space.id
    );

    const components = spaceComponents.map((comp: any) => {
      const compLineItems = (lineItemsData || []).filter(
        (li: any) => li.quotation_component_id === comp.id
      );

      return {
        id: comp.id,
        name: comp.name || comp.component_type?.name,
        description: comp.description,
        line_items: compLineItems.map((item: any) => ({
          id: item.id,
          name: item.name,
          group_name: item.group_name,
          unit_code: item.unit_code,
          length: item.length,
          width: item.width,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
        })),
        subtotal:
          comp.subtotal ||
          compLineItems.reduce(
            (sum: number, li: any) => sum + (li.amount || 0),
            0
          ),
      };
    });

    return {
      id: space.id,
      name: space.name,
      space_type_name: space.space_type?.name,
      components,
      subtotal:
        space.subtotal ||
        components.reduce((sum: number, c: any) => sum + c.subtotal, 0),
    };
  });

  return (
    <QuotationClientView
      quotation={{
        ...quotation,
        spaces,
      }}
      company={
        tenantSettings
          ? {
              name: tenantSettings.company_name,
              address: tenantSettings.company_address,
              phone: tenantSettings.company_phone,
              email: tenantSettings.company_email,
              website: tenantSettings.company_website,
              logo_url: tenantSettings.company_logo_url,
            }
          : undefined
      }
      token={token}
    />
  );
}
