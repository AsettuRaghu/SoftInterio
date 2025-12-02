/**
 * Sign In API Route
 * POST /api/auth/signin
 * Authenticates user with email and password
 */

import { NextRequest, NextResponse } from "next/server";
import { signInWithEmail } from "@/lib/auth/service";
import type { SignInData } from "@/types/database.types";

export async function POST(request: NextRequest) {
  try {
    const body: SignInData = await request.json();

    // Validate required fields
    if (!body.email || !body.password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Authenticate user
    const { user, session } = await signInWithEmail(body.email, body.password);

    if (!user || !session) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Signed in successfully",
        data: {
          user: {
            id: user.id,
            email: user.email,
          },
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Sign in error:", error.message);

    // Handle specific errors - pass through meaningful messages
    const errorMessage = error.message || "";

    // Account deactivated or access revoked
    if (
      errorMessage.includes("deactivated") ||
      errorMessage.includes("revoked") ||
      errorMessage.includes("Account not found")
    ) {
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 403 }
      );
    }

    // Invalid credentials
    if (
      errorMessage.includes("Invalid") ||
      errorMessage.includes("credentials") ||
      errorMessage.includes("Invalid login credentials")
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Email not confirmed
    if (errorMessage.includes("Email not confirmed")) {
      return NextResponse.json(
        { success: false, error: "Please verify your email before signing in" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage || "Failed to sign in. Please try again.",
      },
      { status: 500 }
    );
  }
}
