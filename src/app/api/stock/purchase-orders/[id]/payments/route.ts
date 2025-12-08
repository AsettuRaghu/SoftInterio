import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/stock/purchase-orders/[id]/payments - Get payments for a PO
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log("[Payments API] GET request for PO:", id);

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    console.log(
      "[Payments API] Auth check - User:",
      user?.id,
      "Error:",
      authError
    );

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's tenant_id
    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    console.log(
      "[Payments API] Tenant check - Tenant:",
      userData?.tenant_id,
      "Error:",
      userDataError
    );

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    // Verify PO exists and belongs to tenant
    const { data: po, error: poError } = await supabase
      .from("stock_purchase_orders")
      .select("id, total_amount, payment_status")
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    console.log("[Payments API] PO check - PO:", po?.id, "Error:", poError);

    if (poError || !po) {
      console.log("[Payments API] PO not found or error:", poError);
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      );
    }

    // Fetch payments
    console.log("[Payments API] Fetching payments for PO:", id);
    const { data: payments, error } = await supabase
      .from("po_payments")
      .select("*")
      .eq("po_id", id)
      .eq("tenant_id", userData.tenant_id)
      .order("payment_date", { ascending: false });

    console.log(
      "[Payments API] Payments result - Count:",
      payments?.length,
      "Error:",
      error
    );

    if (error) {
      console.error("[Payments API] Error fetching payments:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch user names for payments (separate query to avoid join issues)
    let paymentsWithUsers = payments || [];
    if (payments && payments.length > 0) {
      const userIds = Array.from(
        new Set(payments.map((p) => p.created_by).filter(Boolean))
      );
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, full_name")
          .in("id", userIds);

        const userMap = new Map(users?.map((u) => [u.id, u.full_name]) || []);
        paymentsWithUsers = payments.map((p) => ({
          ...p,
          created_by_user: p.created_by
            ? { full_name: userMap.get(p.created_by) || null }
            : null,
        }));
      }
    }

    // Calculate totals
    const totalPaid =
      payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const balance = Number(po.total_amount) - totalPaid;

    console.log("[Payments API] Success - returning payments");
    return NextResponse.json({
      payments: paymentsWithUsers,
      summary: {
        total_amount: po.total_amount,
        total_paid: totalPaid,
        balance: balance,
        payment_status: po.payment_status,
      },
    });
  } catch (error) {
    console.error("PO Payments API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/stock/purchase-orders/[id]/payments - Record a payment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's tenant_id
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    // Verify PO exists and belongs to tenant
    const { data: po, error: poError } = await supabase
      .from("stock_purchase_orders")
      .select("id, total_amount, payment_status, status")
      .eq("id", id)
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (poError || !po) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      amount,
      payment_date,
      payment_type = "regular",
      payment_method,
      reference_number,
      bank_reference,
      notes,
    } = body;

    // Validate required fields
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid payment amount is required" },
        { status: 400 }
      );
    }

    // Calculate existing payments
    const { data: existingPayments } = await supabase
      .from("po_payments")
      .select("amount")
      .eq("po_id", id)
      .eq("tenant_id", userData.tenant_id);

    const totalPaid =
      existingPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const balance = Number(po.total_amount) - totalPaid;

    // Don't allow overpayment
    if (amount > balance) {
      return NextResponse.json(
        {
          error: `Payment amount exceeds balance. Maximum allowed: ${balance.toFixed(
            2
          )}`,
        },
        { status: 400 }
      );
    }

    // Insert payment
    const { data: payment, error: insertError } = await supabase
      .from("po_payments")
      .insert({
        tenant_id: userData.tenant_id,
        po_id: id,
        amount,
        payment_date: payment_date || new Date().toISOString().split("T")[0],
        payment_type,
        payment_method,
        reference_number,
        bank_reference,
        notes,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating payment:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Update payment status on PO
    const newTotalPaid = totalPaid + amount;
    let newPaymentStatus: string;

    if (newTotalPaid >= Number(po.total_amount)) {
      newPaymentStatus = "fully_paid";
    } else if (payment_type === "advance" && totalPaid === 0) {
      newPaymentStatus = "advance_paid";
    } else {
      newPaymentStatus = "partially_paid";
    }

    const { error: updateError } = await supabase
      .from("stock_purchase_orders")
      .update({ payment_status: newPaymentStatus })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating payment status:", updateError);
      // Don't fail the request, payment was recorded
    }

    // If fully paid and fully received, auto-close the PO
    if (newPaymentStatus === "fully_paid" && po.status === "fully_received") {
      await supabase
        .from("stock_purchase_orders")
        .update({
          status: "closed",
          closed_by: user.id,
          closed_at: new Date().toISOString(),
        })
        .eq("id", id);
    }

    return NextResponse.json({
      payment,
      summary: {
        total_amount: po.total_amount,
        total_paid: newTotalPaid,
        balance: Number(po.total_amount) - newTotalPaid,
        payment_status: newPaymentStatus,
      },
    });
  } catch (error) {
    console.error("PO Payments POST Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
