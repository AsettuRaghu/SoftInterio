/**
 * Sign Up API Route
 * POST /api/auth/signup
 * Creates new tenant and user account
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createTenant,
  registerUser,
  sendVerificationEmail,
} from "@/lib/auth/service";
import type { SignUpData } from "@/types/database.types";

export async function POST(request: NextRequest) {
  console.log("[SIGNUP API] POST /api/auth/signup - Request received");

  try {
    const body: SignUpData = await request.json();
    console.log("[SIGNUP API] Request body parsed:", {
      email: body.email,
      name: body.name,
      company_name: body.company_name,
      tenant_type: body.tenant_type,
      has_phone: !!body.phone,
      has_password: !!body.password,
      selected_plan: body.selected_plan,
    });

    // Validate required fields
    if (
      !body.email ||
      !body.password ||
      !body.name ||
      !body.company_name ||
      !body.tenant_type
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate password strength (min 8 characters)
    if (body.password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: "Password must be at least 8 characters long",
        },
        { status: 400 }
      );
    }

    // 1. Create tenant (company account)
    console.log("[SIGNUP API] Creating tenant...");
    const tenant = await createTenant({
      tenant_type: body.tenant_type,
      company_name: body.company_name,
      email: body.email,
      phone: body.phone,
      selected_plan: body.selected_plan,
    });
    console.log("[SIGNUP API] Tenant created successfully:", tenant.id);

    // 2. Register user (this will be the super admin)
    console.log("[SIGNUP API] Registering user...");
    const { user } = await registerUser(body, tenant.id);
    console.log("[SIGNUP API] User registered successfully:", user.id);

    // 3. Send verification email (non-blocking)
    sendVerificationEmail(body.email).catch((error) => {
      console.error("Failed to send verification email:", error);
    });

    return NextResponse.json(
      {
        success: true,
        message:
          "Account created successfully. Please check your email to verify your account.",
        data: {
          tenant: {
            id: tenant.id,
            company_name: tenant.company_name,
            tenant_type: tenant.tenant_type,
          },
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[SIGNUP API] ========== ERROR ==========");
    console.error("[SIGNUP API] Error type:", error.constructor.name);
    console.error("[SIGNUP API] Error message:", error.message);
    console.error("[SIGNUP API] Error stack:", error.stack);
    if (error.code) console.error("[SIGNUP API] Error code:", error.code);
    if (error.details)
      console.error("[SIGNUP API] Error details:", error.details);
    console.error("[SIGNUP API] ============================");

    // Handle specific errors
    if (
      error.message?.includes("duplicate key") ||
      error.message?.includes("already exists")
    ) {
      console.log("[SIGNUP API] Returning 409 - Duplicate account");
      return NextResponse.json(
        { success: false, error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    console.log("[SIGNUP API] Returning 500 - Generic error");
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create account. Please try again.",
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
