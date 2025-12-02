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
  checkExistingUser,
  registerExistingUserToNewTenant,
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

    // FIRST: Check if user already exists
    console.log("[SIGNUP API] Checking for existing user...");
    const existingUserCheck = await checkExistingUser(body.email);

    if (existingUserCheck.exists) {
      if (existingUserCheck.isActive) {
        // Active user - they should sign in first
        return NextResponse.json(
          {
            success: false,
            error: "An account with this email already exists and is active. Please sign in to your existing account first.",
          },
          { status: 409 }
        );
      }

      // Disabled user - allow them to create a new company
      console.log("[SIGNUP API] Existing disabled user, creating new company...");
      
      // Create tenant with company email (not user email to avoid unique constraint)
      // Use company name-based email or generate unique one
      const tenantEmail = `${body.company_name.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}@company.internal`;
      
      const tenant = await createTenant({
        tenant_type: body.tenant_type,
        company_name: body.company_name,
        email: tenantEmail, // Use generated email to avoid conflict
        phone: body.phone,
        selected_plan: body.selected_plan,
      });
      console.log("[SIGNUP API] Tenant created for existing user:", tenant.id);

      // Register existing user to new tenant
      const result = await registerExistingUserToNewTenant(
        existingUserCheck.authUserId!,
        existingUserCheck.userRecord!,
        tenant.id,
        body
      );

      return NextResponse.json(
        {
          success: true,
          message: "Your new company has been created! We've sent you an email to set up your password. Please check your inbox and click the link to complete the setup.",
          data: {
            tenant: {
              id: tenant.id,
              company_name: tenant.company_name,
              tenant_type: tenant.tenant_type,
            },
            user: {
              id: result.user.id,
              name: result.user.name,
              email: result.user.email,
            },
            requiresPasswordReset: true,
          },
        },
        { status: 201 }
      );
    }

    // NEW USER FLOW: Create tenant first, then user
    console.log("[SIGNUP API] New user, creating tenant...");
    const tenant = await createTenant({
      tenant_type: body.tenant_type,
      company_name: body.company_name,
      email: body.email,
      phone: body.phone,
      selected_plan: body.selected_plan,
    });
    console.log("[SIGNUP API] Tenant created successfully:", tenant.id);

    // Register new user
    console.log("[SIGNUP API] Registering new user...");
    const { user } = await registerUser(body, tenant.id);
    console.log("[SIGNUP API] User registered successfully:", user.id);

    // Send verification email
    sendVerificationEmail(body.email).catch((error) => {
      console.error("Failed to send verification email:", error);
    });

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully. Please check your email to verify your account.",
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
          requiresPasswordReset: false,
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
    if (error.message?.includes("already exists and is active")) {
      // Active user trying to create another company
      console.log("[SIGNUP API] Returning 409 - Active user exists");
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 }
      );
    }

    if (
      error.message?.includes("duplicate key") ||
      error.message?.includes("already registered")
    ) {
      console.log("[SIGNUP API] Returning 409 - Duplicate account");
      return NextResponse.json(
        { success: false, error: error.message },
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
