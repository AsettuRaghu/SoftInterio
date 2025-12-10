/**
 * Current User API Route
 * GET /api/auth/me - Get the current authenticated user
 *
 * Security features:
 * - Full user status validation
 * - Tenant membership check
 * - Auto-logout on deactivation
 */

import { NextRequest, NextResponse } from "next/server";
import {
  protectApiRoute,
  createErrorResponse,
  createSuccessResponse,
} from "@/lib/auth/api-guard";

export async function GET(request: NextRequest) {
  try {
    // Use the full protection which includes status and membership checks
    const guard = await protectApiRoute(request);

    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    return createSuccessResponse(guard.user);
  } catch (error: any) {
    console.error("[AUTH/ME] Error:", error);
    return createErrorResponse(
      error.message || "Failed to get current user",
      500
    );
  }
}
