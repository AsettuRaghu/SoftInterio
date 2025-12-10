import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/billing/invoices
// Returns invoice history for the tenant
export async function GET(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get user's tenant
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    const tenantId = userData.tenant_id;

    // Get invoices
    const {
      data: invoices,
      error: invoicesError,
      count,
    } = await supabase
      .from("subscription_invoices")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (invoicesError) {
      console.error("Error fetching invoices:", invoicesError);
      return NextResponse.json(
        { error: "Failed to fetch invoices" },
        { status: 500 }
      );
    }

    // Format response
    const formattedInvoices = invoices?.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      description: inv.description,
      subtotal: inv.subtotal,
      taxAmount: inv.tax_amount,
      discountAmount: inv.discount_amount,
      totalAmount: inv.total_amount,
      currency: inv.currency,
      status: inv.status,
      periodStart: inv.period_start,
      periodEnd: inv.period_end,
      paidAt: inv.paid_at,
      paymentMethod: inv.payment_method,
      invoicePdfUrl: inv.invoice_pdf_url,
      dueDate: inv.due_date,
      createdAt: inv.created_at,
    }));

    return NextResponse.json({
      invoices: formattedInvoices || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
