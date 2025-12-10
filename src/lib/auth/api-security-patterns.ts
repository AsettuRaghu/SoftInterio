/**
 * API Security Standards for SoftInterio
 *
 * This document outlines the security requirements for all API routes.
 * All data-access APIs MUST follow these patterns.
 */

// ============================================
// REQUIRED IMPORTS
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// ============================================
// STANDARD PROTECTED ROUTE PATTERN
// ============================================

/**
 * Every protected API route MUST follow this pattern:
 *
 * 1. Call protectApiRoute() at the start
 * 2. Check guard.success and return error if false
 * 3. Use guard.user for user info (id, tenantId, email, etc.)
 * 4. Filter all queries by tenant_id for security
 * 5. Use createClient() (NOT createAdminClient) for data queries
 */

// EXAMPLE: Protected GET route
export async function GET_EXAMPLE(request: NextRequest) {
  try {
    // Step 1: Protect the route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    // Step 2: Extract user info
    const { user } = guard;

    // Step 3: Create Supabase client (uses RLS)
    const supabase = await createClient();

    // Step 4: Query with tenant_id filter
    const { data, error } = await supabase
      .from("your_table")
      .select("*")
      .eq("tenant_id", user!.tenantId); // ALWAYS filter by tenant

    if (error) {
      return createErrorResponse("Failed to fetch data", 500);
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return createErrorResponse("Internal server error", 500);
  }
}

// EXAMPLE: Protected POST route with permission check
export async function POST_EXAMPLE(request: NextRequest) {
  try {
    // Step 1: Protect with permission requirement
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["resource.create"],
      requireAllPermissions: true,
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();
    const body = await request.json();

    // Step 2: Create with tenant_id
    const { data, error } = await supabase
      .from("your_table")
      .insert({
        tenant_id: user!.tenantId, // ALWAYS include tenant_id
        created_by: user!.id,
        ...body,
      })
      .select()
      .single();

    if (error) {
      return createErrorResponse("Failed to create", 500);
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return createErrorResponse("Internal server error", 500);
  }
}

// ============================================
// WHEN TO USE ADMIN CLIENT
// ============================================

/**
 * createAdminClient() should ONLY be used for:
 *
 * 1. Auth operations (creating users, updating passwords)
 * 2. Cross-tenant operations (super admin features)
 * 3. Queries that need to bypass RLS for joins
 *
 * EVEN when using adminClient, you MUST:
 * - First authenticate with protectApiRoute()
 * - Filter queries by tenant_id
 * - Verify the user has permission for the operation
 */

// EXAMPLE: Admin client usage (ONLY when absolutely necessary)
import { createAdminClient } from "@/lib/supabase/admin";

export async function ADMIN_EXAMPLE(request: NextRequest) {
  try {
    // STILL protect the route first!
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const adminClient = createAdminClient();

    // STILL filter by tenant_id!
    const { data } = await adminClient
      .from("some_table")
      .select("*, related_table(*)")
      .eq("tenant_id", user!.tenantId); // NEVER skip this!

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return createErrorResponse("Internal server error", 500);
  }
}

// ============================================
// SECURITY CHECKLIST FOR NEW ROUTES
// ============================================

/**
 * Before creating any new API route, verify:
 *
 * ✅ Uses protectApiRoute() at the start
 * ✅ Returns createErrorResponse() on guard failure
 * ✅ Filters all queries by user!.tenantId
 * ✅ Uses createClient() (not createAdminClient)
 * ✅ Validates request body for required fields
 * ✅ Uses proper HTTP status codes
 * ✅ Logs errors for debugging
 * ✅ Has rate limiting for sensitive operations
 */

// ============================================
// ROUTES THAT DON'T NEED PROTECTION
// ============================================

/**
 * These routes are public and don't need protectApiRoute():
 *
 * - /api/auth/signin
 * - /api/auth/signup
 * - /api/auth/forgot-password
 * - /api/auth/validate-invite
 * - /api/auth/complete-invite
 * - /api/billing/plans (public pricing)
 *
 * All other routes MUST be protected!
 */
