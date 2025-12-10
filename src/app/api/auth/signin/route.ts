/**
 * Sign In API Route
 * POST /api/auth/signin
 * Authenticates user with email and password
 *
 * Security features:
 * - Rate limiting (10 attempts per 15 minutes)
 * - Deactivation check in signInWithEmail
 */

import { NextRequest, NextResponse } from "next/server";
import { signInWithEmail } from "@/lib/auth/service";
import { isAuthRateLimited, getRateLimitInfo } from "@/lib/auth/api-guard";
import type { SignInData } from "@/types/database.types";

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // Check rate limit
    if (isAuthRateLimited(clientIp)) {
      const rateLimitInfo = getRateLimitInfo(`auth:${clientIp}`, 10);
      return NextResponse.json(
        {
          success: false,
          error: "Too many login attempts. Please try again later.",
          retryAfter: Math.ceil((rateLimitInfo.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((rateLimitInfo.resetAt - Date.now()) / 1000)
            ),
            "X-RateLimit-Remaining": String(rateLimitInfo.remaining),
          },
        }
      );
    }

    const body: SignInData = await request.json();

    // Validate required fields
    if (!body.email || !body.password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Authenticate user (includes deactivation check)
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
