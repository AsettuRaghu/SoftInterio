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
    console.error("Sign in error:", error);

    // Handle specific errors
    if (
      error.message?.includes("Invalid") ||
      error.message?.includes("credentials")
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (error.message?.includes("Email not confirmed")) {
      return NextResponse.json(
        { success: false, error: "Please verify your email before signing in" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to sign in. Please try again." },
      { status: 500 }
    );
  }
}
