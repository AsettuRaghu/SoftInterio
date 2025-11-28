/**
 * Reset Password API Route
 * POST /api/auth/reset-password
 * Updates user password with reset token
 */

import { NextRequest, NextResponse } from "next/server";
import { updatePassword } from "@/lib/auth/service";

export async function POST(request: NextRequest) {
  console.log(
    "[RESET PASSWORD API] POST /api/auth/reset-password - Request received"
  );

  try {
    const { password, code, accessToken } = await request.json();

    if (!password) {
      console.log("[RESET PASSWORD API] Validation failed: Password missing");
      return NextResponse.json(
        { success: false, error: "Password is required" },
        { status: 400 }
      );
    }

    if (!code && !accessToken) {
      console.log(
        "[RESET PASSWORD API] Validation failed: Reset code/token missing"
      );
      return NextResponse.json(
        { success: false, error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      console.log("[RESET PASSWORD API] Validation failed: Password too short");
      return NextResponse.json(
        {
          success: false,
          error: "Password must be at least 8 characters long",
        },
        { status: 400 }
      );
    }

    console.log(
      "[RESET PASSWORD API] Updating password with",
      code ? "code" : "access token",
      "..."
    );
    await updatePassword(password, code, accessToken);
    console.log("[RESET PASSWORD API] Password updated successfully");

    return NextResponse.json(
      {
        success: true,
        message: "Password updated successfully",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[RESET PASSWORD API] ========== ERROR ==========");
    console.error("[RESET PASSWORD API] Error:", error);
    console.error("[RESET PASSWORD API] Error message:", error.message);
    console.error("[RESET PASSWORD API] ============================");

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to reset password. Please try again.",
      },
      { status: 500 }
    );
  }
}
