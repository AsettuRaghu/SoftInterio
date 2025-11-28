/**
 * Forgot Password API Route
 * POST /api/auth/forgot-password
 * Sends password reset email
 */

import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/auth/service";

export async function POST(request: NextRequest) {
  console.log(
    "[FORGOT PASSWORD API] POST /api/auth/forgot-password - Request received"
  );

  try {
    const { email } = await request.json();
    console.log("[FORGOT PASSWORD API] Email:", email);

    if (!email) {
      console.log("[FORGOT PASSWORD API] Validation failed: Email missing");
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    console.log("[FORGOT PASSWORD API] Requesting password reset...");
    await requestPasswordReset(email);
    console.log("[FORGOT PASSWORD API] Password reset email sent successfully");

    return NextResponse.json(
      {
        success: true,
        message:
          "If an account exists with this email, you will receive password reset instructions.",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Forgot password error:", error);

    // Don't reveal if email exists for security
    return NextResponse.json(
      {
        success: true,
        message:
          "If an account exists with this email, you will receive password reset instructions.",
      },
      { status: 200 }
    );
  }
}
