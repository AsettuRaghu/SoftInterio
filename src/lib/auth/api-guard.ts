/**
 * API Route Protection Guard
 *
 * This module provides security utilities for protecting API routes:
 * 1. Authentication verification
 * 2. User status validation (disabled/deleted check)
 * 3. Tenant membership verification
 * 4. Rate limiting
 * 5. Permission checks
 *
 * @module api-guard
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================
// Types
// ============================================

export interface AuthenticatedUser {
  id: string;
  email: string;
  tenantId: string;
  status: string;
  isSuperAdmin: boolean;
  name?: string;
}

// Discriminated union for better type narrowing
export type GuardResult = 
  | { success: true; user: AuthenticatedUser; error?: undefined; statusCode?: undefined }
  | { success: false; user?: undefined; error: string; statusCode: number };

export interface GuardOptions {
  /** Check tenant membership in tenant_users table */
  checkTenantMembership?: boolean;
  /** Required permissions for this endpoint */
  requiredPermissions?: string[];
  /** Require all permissions (AND) or any permission (OR) */
  requireAllPermissions?: boolean;
}

// ============================================
// In-memory rate limiter (for development)
// For production, use Redis-based rate limiting
// ============================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  rateLimitStore.forEach((entry, key) => {
    if (entry.resetAt < now) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach((key) => rateLimitStore.delete(key));
}, 5 * 60 * 1000);

/**
 * Check rate limit for a given identifier
 * @param identifier - Unique identifier (IP, user ID, etc.)
 * @param limit - Max requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns true if rate limit exceeded
 */
export function isRateLimited(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60 * 1000
): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetAt < now) {
    // Create new entry or reset expired one
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return false;
  }

  entry.count++;
  return entry.count > limit;
}

/**
 * Get rate limit info for headers
 */
export function getRateLimitInfo(
  identifier: string,
  limit: number = 100
): { remaining: number; resetAt: number } {
  const entry = rateLimitStore.get(identifier);
  if (!entry) {
    return { remaining: limit, resetAt: Date.now() + 60000 };
  }
  return {
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

// ============================================
// Main Guard Function
// ============================================

/**
 * Protect an API route with authentication and authorization checks
 *
 * @param request - Next.js request object
 * @param options - Guard options
 * @returns GuardResult with user info or error
 *
 * @example
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const guard = await protectApiRoute(request);
 *   if (!guard.success) {
 *     return NextResponse.json({ error: guard.error }, { status: guard.statusCode });
 *   }
 *   const { user } = guard;
 *   // user is now authenticated and active
 * }
 * ```
 */
export async function protectApiRoute(
  request: NextRequest,
  options: GuardOptions = {}
): Promise<GuardResult> {
  const {
    checkTenantMembership = true,
    requiredPermissions = [],
    requireAllPermissions = true,
  } = options;

  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // ----------------------------------------
    // Step 1: Verify Authentication
    // ----------------------------------------
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return {
        success: false,
        error: "Not authenticated",
        statusCode: 401,
      };
    }

    // ----------------------------------------
    // Step 2: Get User Record & Check Status
    // ----------------------------------------
    const { data: userData, error: userError } = await adminClient
      .from("users")
      .select("id, email, name, tenant_id, status, is_super_admin")
      .eq("id", authUser.id)
      .single();

    if (userError || !userData) {
      console.error("[API GUARD] User not found:", authUser.id);
      return {
        success: false,
        error: "Account not found",
        statusCode: 404,
      };
    }

    // Check if user is disabled or deleted
    if (userData.status === "disabled" || userData.status === "deleted") {
      console.log("[API GUARD] User account is deactivated:", authUser.id);

      // Sign out the deactivated user
      await supabase.auth.signOut();

      return {
        success: false,
        error:
          "Your account has been deactivated. Please contact your administrator.",
        statusCode: 403,
      };
    }

    // ----------------------------------------
    // Step 3: Check Tenant Membership (if enabled)
    // ----------------------------------------
    if (checkTenantMembership && userData.tenant_id) {
      const { data: membership, error: membershipError } = await adminClient
        .from("tenant_users")
        .select("is_active")
        .eq("user_id", authUser.id)
        .eq("tenant_id", userData.tenant_id)
        .single();

      // If membership exists and is inactive, deny access
      if (!membershipError && membership && !membership.is_active) {
        console.log("[API GUARD] User membership is inactive:", authUser.id);

        // Sign out the removed user
        await supabase.auth.signOut();

        return {
          success: false,
          error: "Your access to this organization has been revoked.",
          statusCode: 403,
        };
      }
    }

    // ----------------------------------------
    // Step 4: Check Permissions (if required)
    // ----------------------------------------
    if (requiredPermissions.length > 0 && !userData.is_super_admin) {
      const { data: userPermissions } = await adminClient
        .from("user_roles")
        .select(
          `
          role:roles(
            role_permissions(
              permission:permissions(key)
            )
          )
        `
        )
        .eq("user_id", authUser.id);

      // Extract permission keys
      const permissionKeys = new Set<string>();
      userPermissions?.forEach((ur: any) => {
        ur.role?.role_permissions?.forEach((rp: any) => {
          if (rp.permission?.key) {
            permissionKeys.add(rp.permission.key);
          }
        });
      });

      // Check if user has required permissions
      const hasPermissions = requireAllPermissions
        ? requiredPermissions.every((p) => permissionKeys.has(p))
        : requiredPermissions.some((p) => permissionKeys.has(p));

      if (!hasPermissions) {
        return {
          success: false,
          error: "You do not have permission to perform this action",
          statusCode: 403,
        };
      }
    }

    // ----------------------------------------
    // Step 5: Return Authenticated User
    // ----------------------------------------
    return {
      success: true,
      user: {
        id: userData.id,
        email: userData.email,
        tenantId: userData.tenant_id,
        status: userData.status,
        isSuperAdmin: userData.is_super_admin,
        name: userData.name,
      },
    };
  } catch (error: any) {
    console.error("[API GUARD] Unexpected error:", error);
    return {
      success: false,
      error: "Internal server error",
      statusCode: 500,
    };
  }
}

// ============================================
// Helper: Create Error Response
// ============================================

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: string,
  statusCode: number = 500,
  details?: any
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(details && { details }),
    },
    { status: statusCode }
  );
}

// ============================================
// Helper: Create Success Response
// ============================================

/**
 * Create a standardized success response
 */
export function createSuccessResponse(
  data: any,
  statusCode: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status: statusCode }
  );
}

// ============================================
// Specific Rate Limiters
// ============================================

/**
 * Rate limiter for authentication endpoints (stricter)
 * 10 attempts per 15 minutes
 */
export function isAuthRateLimited(identifier: string): boolean {
  return isRateLimited(`auth:${identifier}`, 10, 15 * 60 * 1000);
}

/**
 * Rate limiter for general API endpoints
 * 100 requests per minute
 */
export function isApiRateLimited(identifier: string): boolean {
  return isRateLimited(`api:${identifier}`, 100, 60 * 1000);
}

/**
 * Rate limiter for password reset
 * 3 attempts per hour
 */
export function isPasswordResetRateLimited(identifier: string): boolean {
  return isRateLimited(`pwd-reset:${identifier}`, 3, 60 * 60 * 1000);
}
