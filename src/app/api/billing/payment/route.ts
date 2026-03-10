/**
 * Payment API Route
 * POST - Create payment order
 * PUT - Verify payment and activate subscription
 */

import { NextRequest, NextResponse } from "next/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { createPaymentOrder, verifyPayment } from "@/lib/billing/payment";
import { createClient } from "@/lib/supabase/server";

interface CreatePaymentRequest {
  planId: string;
  billingCycle: "monthly" | "yearly";
}

interface VerifyPaymentRequest {
  orderId: string;
  paymentId: string;
  signature: string;
}

// POST /api/billing/payment
// Create a payment order
export async function POST(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    // Get user's tenant
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

    const body: CreatePaymentRequest = await request.json();
    const { planId, billingCycle } = body;

    // Validate input
    if (!planId || !billingCycle) {
      return NextResponse.json(
        { error: "Missing required fields: planId, billingCycle" },
        { status: 400 }
      );
    }

    if (!["monthly", "yearly"].includes(billingCycle)) {
      return NextResponse.json(
        { error: "Invalid billingCycle. Must be 'monthly' or 'yearly'" },
        { status: 400 }
      );
    }

    // Create payment order
    const result = await createPaymentOrder(userData.tenant_id, planId, billingCycle);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("[PAYMENT API] Error in POST:", error);
    return NextResponse.json(
      { error: "Failed to create payment order" },
      { status: 500 }
    );
  }
}

// PUT /api/billing/payment
// Verify payment and activate subscription
export async function PUT(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    // Get user's tenant
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

    const body: VerifyPaymentRequest = await request.json();
    const { orderId, paymentId, signature } = body;

    // Validate input
    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        { error: "Missing required fields: orderId, paymentId, signature" },
        { status: 400 }
      );
    }

    // Verify payment
    const result = await verifyPayment(
      userData.tenant_id,
      orderId,
      paymentId,
      signature
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.data?.message,
      data: result.data,
    });
  } catch (error) {
    console.error("[PAYMENT API] Error in PUT:", error);
    return NextResponse.json(
      { error: "Failed to verify payment" },
      { status: 500 }
    );
  }
}
