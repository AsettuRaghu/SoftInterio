/**
 * Payment Gateway Service
 * Handles payment operations with Razorpay
 */

import Razorpay from "razorpay";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { subscriptionLogger, invoiceLogger } from "@/lib/activity-logger";

// Helper to get Razorpay instance (lazy initialization)
function getRazorpayInstance(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

  // Enhanced debug logging
  console.log("[RAZORPAY] Environment check:");
  console.log("[RAZORPAY] - process.env exists:", !!process.env);
  console.log("[RAZORPAY] - NODE_ENV:", process.env.NODE_ENV);
  console.log("[RAZORPAY] - RAZORPAY_KEY_ID set:", !!process.env.RAZORPAY_KEY_ID);
  console.log("[RAZORPAY] - RAZORPAY_KEY_ID value:", process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.substring(0, 15) + "..." : "NOT SET");
  console.log("[RAZORPAY] - RAZORPAY_KEY_SECRET set:", !!process.env.RAZORPAY_KEY_SECRET);
  console.log("[RAZORPAY] - Cleaned keyId length:", keyId?.length || 0);
  console.log("[RAZORPAY] - Cleaned keySecret length:", keySecret?.length || 0);

  if (!keyId || !keySecret) {
    const missingVars = [];
    if (!keyId) missingVars.push("RAZORPAY_KEY_ID");
    if (!keySecret) missingVars.push("RAZORPAY_KEY_SECRET");

    const errorMsg = `Razorpay credentials not configured. Missing: ${missingVars.join(", ")}. Please add to .env.local or environment.`;
    console.error("[RAZORPAY] ERROR:", errorMsg);
    throw new Error(errorMsg);
  }

  console.log("[RAZORPAY] ✓ Credentials found, initializing Razorpay");
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

export interface PaymentOrder {
  orderId: string;
  amount: number; // in paise (e.g., 9900 = ₹99)
  currency: string;
  keyId: string;
  description: string;
  customerId: string;
  email: string;
  contactNumber: string;
}

export interface PaymentVerification {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface PaymentResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Create a payment order with Razorpay
 * Returns order details to be passed to the frontend for payment processing
 */
export async function createPaymentOrder(
  tenantId: string,
  planId: string,
  billingCycle: "monthly" | "yearly"
): Promise<PaymentResponse> {
  try {
    const supabase = await createClient();

    // Get user info
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return {
        success: false,
        error: "User not authenticated",
      };
    }

    // Get user details
    const { data: userProfile } = await supabase
      .from("users")
      .select("name, email, phone")
      .eq("id", userData.user.id)
      .single();

    // Get plan details
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (!plan) {
      return {
        success: false,
        error: "Plan not found",
      };
    }

    // Calculate amount based on billing cycle
    const amount =
      billingCycle === "yearly" ? plan.price_yearly : plan.price_monthly;
    const amountInPaise = Math.round(amount * 100); // Convert to paise

    // Create Razorpay order
    // Receipt must be max 40 characters
    const shortTenantId = tenantId.substring(0, 8);
    const timestamp = Math.floor(Date.now() / 1000);
    const receipt = `ord_${shortTenantId}_${timestamp}`.substring(0, 40);

    const orderData = {
      amount: amountInPaise,
      currency: "INR",
      receipt: receipt,
      description: `${plan.name} Subscription (${billingCycle})`,
      notes: {
        tenant_id: tenantId,
        plan_id: planId,
        billing_cycle: billingCycle,
      },
    };

    const razorpay = getRazorpayInstance();
    const order = await razorpay.orders.create(orderData);

    // Store payment record in database
    const { error: dbError } = await supabase
      .from("subscription_payments")
      .insert({
        tenant_id: tenantId,
        plan_id: planId,
        amount: amount,
        currency: "INR",
        status: "pending",
        external_id: order.id,
        billing_cycle: billingCycle,
        description: orderData.description,
      });

    if (dbError) {
      console.error("[PAYMENT] Database error:", dbError);
      return {
        success: false,
        error: "Failed to create payment order",
      };
    }

    return {
      success: true,
      data: {
        orderId: order.id,
        amount: amount,
        amountInPaise: amountInPaise,
        currency: "INR",
        keyId: process.env.RAZORPAY_KEY_ID!,
        planName: plan.name,
        description: orderData.description,
        email: userProfile?.email || userData.user.email,
        contactNumber: userProfile?.phone || "",
        customerName: userProfile?.name || userData.user.user_metadata?.name || "",
      },
    };
  } catch (error) {
    console.error("[PAYMENT] Error creating order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create payment order",
    };
  }
}

/**
 * Verify payment signature and process payment
 * Called after user completes payment on frontend
 */
export async function verifyPayment(
  tenantId: string,
  orderId: string,
  paymentId: string,
  signature: string
): Promise<PaymentResponse> {
  try {
    console.log("[PAYMENT] Verifying payment signature", { orderId, paymentId });
    
    // Verify signature with Razorpay
    const isSignatureValid = verifySignature(orderId, paymentId, signature);
    if (!isSignatureValid) {
      console.error("[PAYMENT] Invalid signature for payment", { orderId, paymentId });
      await subscriptionLogger.paymentFailed(
        tenantId,
        undefined,
        "Invalid payment signature - verification failed"
      );
      return {
        success: false,
        error: "Invalid payment signature",
      };
    }

    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // Get payment record
    const { data: paymentRecord } = await supabase
      .from("subscription_payments")
      .select("*")
      .eq("external_id", orderId)
      .eq("tenant_id", tenantId)
      .single();

    if (!paymentRecord) {
      console.error("[PAYMENT] Payment record not found", { orderId, tenantId });
      await subscriptionLogger.paymentFailed(
        tenantId,
        undefined,
        "Payment record not found in database"
      );
      return {
        success: false,
        error: "Payment record not found",
      };
    }

    console.log("[PAYMENT] Payment record found", {
      paymentId: paymentRecord.id,
      amount: paymentRecord.amount,
      planId: paymentRecord.plan_id,
    });

    // Fetch payment details from Razorpay to confirm
    const razorpay = getRazorpayInstance();
    const payment = await razorpay.payments.fetch(paymentId);
    if (payment.status !== "captured") {
      console.error("[PAYMENT] Payment not captured by Razorpay", {
        paymentId,
        status: payment.status,
      });
      await subscriptionLogger.paymentFailed(
        tenantId,
        undefined,
        `Payment not captured. Status: ${payment.status}`
      );
      return {
        success: false,
        error: "Payment not captured by Razorpay",
      };
    }

    console.log("[PAYMENT] ✓ Payment captured by Razorpay", { paymentId });

    // Update payment record to success
    const { error: paymentUpdateError } = await adminSupabase
      .from("subscription_payments")
      .update({
        status: "success",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRecord.id);

    if (paymentUpdateError) {
      console.error("[PAYMENT] Error updating payment:", paymentUpdateError);
      await subscriptionLogger.paymentFailed(
        tenantId,
        undefined,
        "Failed to update payment status in database"
      );
      return {
        success: false,
        error: "Failed to update payment status",
      };
    }

    console.log("[PAYMENT] ✓ Payment record updated to success", { paymentId });

    // Get current subscription to preserve trial dates and calculate invoice period
    const { data: currentSubscription } = await supabase
      .from("tenant_subscriptions")
      .select("trial_start_date, trial_end_date")
      .eq("tenant_id", tenantId)
      .single();

    // Calculate subscription dates from trial_end_date (or from now if no trial)
    let subscriptionStartDate = new Date();
    let subscriptionEndDate = new Date();

    if (currentSubscription?.trial_end_date) {
      subscriptionStartDate = new Date(currentSubscription.trial_end_date);
    }

    subscriptionEndDate = new Date(subscriptionStartDate);
    if (paymentRecord.billing_cycle === "yearly") {
      subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);
    } else {
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);
    }

    console.log("[PAYMENT] Calculated subscription dates", {
      startDate: subscriptionStartDate.toISOString(),
      endDate: subscriptionEndDate.toISOString(),
      billingCycle: paymentRecord.billing_cycle,
    });

    // Create invoice with period dates matching subscription dates
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const { data: invoice, error: invoiceError } = await adminSupabase
      .from("subscription_invoices")
      .insert({
        tenant_id: tenantId,
        invoice_number: invoiceNumber,
        subtotal: paymentRecord.amount,
        tax_amount: 0,
        discount_amount: 0,
        total_amount: paymentRecord.amount,
        currency: "INR",
        status: "paid",
        period_start: subscriptionStartDate.toISOString(),
        period_end: subscriptionEndDate.toISOString(),
        paid_at: new Date().toISOString(),
        payment_provider_invoice_id: paymentId,
        payment_provider: "razorpay",
      })
      .select("id")
      .single();

    if (invoiceError) {
      console.error("[PAYMENT] Error creating invoice:", invoiceError);
      await subscriptionLogger.paymentFailed(
        tenantId,
        undefined,
        "Failed to create invoice after payment"
      );
      return {
        success: false,
        error: "Failed to create invoice",
      };
    }

    console.log("[PAYMENT] ✓ Invoice created", { invoiceNumber, invoiceId: invoice?.id });
    
    // Log invoice creation
    await invoiceLogger.invoiceCreated(tenantId, invoiceNumber, paymentRecord.amount);

    const { error: subscriptionUpdateError } = await adminSupabase
      .from("tenant_subscriptions")
      .update({
        plan_id: paymentRecord.plan_id,
        status: "active",
        is_trial: false,
        trial_start_date: currentSubscription?.trial_start_date, // Preserve trial start date
        trial_end_date: currentSubscription?.trial_end_date, // Preserve trial end date
        subscription_start_date: subscriptionStartDate.toISOString(),
        subscription_end_date: subscriptionEndDate.toISOString(),
        billing_cycle: paymentRecord.billing_cycle,
        last_payment_date: new Date().toISOString(),
        last_payment_amount: paymentRecord.amount,
        next_billing_date: subscriptionEndDate.toISOString(),
        auto_renew: true,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId);

    if (subscriptionUpdateError) {
      console.error("[PAYMENT] Error updating subscription:", subscriptionUpdateError);
      await subscriptionLogger.paymentFailed(
        tenantId,
        undefined,
        "Failed to activate subscription after payment"
      );
      return {
        success: false,
        error: "Failed to activate subscription",
      };
    }

    console.log("[PAYMENT] ✓ Subscription updated and activated", {
      tenantId,
      planId: paymentRecord.plan_id,
      subscriptionEndDate: subscriptionEndDate.toISOString(),
    });
    
    // Log successful payment and subscription activation
    await subscriptionLogger.paymentCompleted(
      tenantId,
      "", // Will be populated from auth context in API route
      paymentRecord.plan_id,
      paymentRecord.amount,
      paymentId
    );
    
    await subscriptionLogger.subscriptionActivated(
      tenantId,
      "",
      paymentRecord.plan_id,
      subscriptionStartDate.toISOString(),
      subscriptionEndDate.toISOString()
    );

    console.log("[PAYMENT] ✅ Payment verification complete - SUCCESS", {
      tenantId,
      paymentId,
      invoiceNumber,
    });

    return {
      success: true,
      data: {
        invoiceId: invoice?.id,
        invoiceNumber: invoiceNumber,
        message: "Payment successful! Your subscription is now active.",
      },
    };
  } catch (error) {
    console.error("[PAYMENT] Error verifying payment:", error);
    await subscriptionLogger.paymentFailed(
      tenantId,
      undefined,
      error instanceof Error ? error.message : "Unknown error during payment verification"
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to verify payment",
    };
  }
}

/**
 * Verify Razorpay payment signature
 * HMAC-SHA256 signature verification
 */
function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  try {
    const shasum = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!);
    const message = `${orderId}|${paymentId}`;
    shasum.update(message);
    const digest = shasum.digest("hex");
    return digest === signature;
  } catch (error) {
    console.error("[PAYMENT] Signature verification error:", error);
    return false;
  }
}

/**
 * Process webhook event from Razorpay
 * Called when Razorpay sends a webhook for payment events
 */
export async function handleWebhookEvent(
  event: string,
  payload: any,
  signature: string
): Promise<PaymentResponse> {
  try {
    // Verify webhook signature
    const isValid = verifyWebhookSignature(JSON.stringify(payload), signature);
    if (!isValid) {
      return {
        success: false,
        error: "Invalid webhook signature",
      };
    }

    const adminSupabase = createAdminClient();

    switch (event) {
      case "payment.authorized": {
        const { order_id, id: paymentId } = payload.payment;

        // Update payment record
        const { error } = await adminSupabase
          .from("subscription_payments")
          .update({
            status: "success",
            updated_at: new Date().toISOString(),
          })
          .eq("external_id", order_id);

        if (error) {
          console.error("[WEBHOOK] Error updating payment:", error);
          return { success: false, error: error.message };
        }

        return { success: true };
      }

      case "payment.failed": {
        const { order_id, id: paymentId, error_description } = payload.payment;

        // Update payment record with error
        const { error } = await adminSupabase
          .from("subscription_payments")
          .update({
            status: "failed",
            error_message: error_description,
            updated_at: new Date().toISOString(),
          })
          .eq("external_id", order_id);

        if (error) {
          console.error("[WEBHOOK] Error updating failed payment:", error);
          return { success: false, error: error.message };
        }

        return { success: true };
      }

      default:
        return { success: true, data: { message: "Event acknowledged" } };
    }
  } catch (error) {
    console.error("[WEBHOOK] Error processing webhook:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process webhook",
    };
  }
}

/**
 * Verify webhook signature from Razorpay
 */
function verifyWebhookSignature(payload: string, signature: string): boolean {
  try {
    const shasum = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!);
    shasum.update(payload);
    const digest = shasum.digest("hex");
    return digest === signature;
  } catch (error) {
    console.error("[WEBHOOK] Signature verification error:", error);
    return false;
  }
}
