/**
 * Razorpay Webhook Handler
 * POST /api/billing/webhook/razorpay
 * Handles payment events from Razorpay
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { handleWebhookEvent } from "@/lib/billing/payment";

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-razorpay-signature");
    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature header" },
        { status: 400 }
      );
    }

    const body = await request.text();

    // Verify webhook signature
    const isValid = verifyWebhookSignature(body, signature);
    if (!isValid) {
      console.warn("[WEBHOOK] Invalid signature for webhook");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(body);
    const eventType = payload.event;

    console.log(`[WEBHOOK] Received event: ${eventType}`);

    // Handle webhook event
    const result = await handleWebhookEvent(eventType, payload, signature);

    if (!result.success) {
      console.error(`[WEBHOOK] Error handling event ${eventType}:`, result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Webhook processed successfully",
    });
  } catch (error) {
    console.error("[WEBHOOK] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

/**
 * Verify webhook signature from Razorpay
 * Using X-Razorpay-Signature header
 */
function verifyWebhookSignature(payload: string, signature: string): boolean {
  try {
    const shasum = crypto.createHmac(
      "sha256",
      process.env.RAZORPAY_WEBHOOK_SECRET!
    );
    shasum.update(payload);
    const digest = shasum.digest("hex");
    return digest === signature;
  } catch (error) {
    console.error("[WEBHOOK] Signature verification error:", error);
    return false;
  }
}
