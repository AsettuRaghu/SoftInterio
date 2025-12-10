/**
 * Sign Out API Route
 * POST /api/auth/signout
 *
 * Signs out the current user by:
 * 1. Invalidating the Supabase session
 * 2. Clearing any server-side session data
 * 3. Returning appropriate response for client-side cleanup
 *
 * Best Practices Implemented:
 * - Centralized logging
 * - Structured error handling
 * - Graceful degradation (always redirects even on error)
 */

import { NextRequest, NextResponse } from "next/server";
import { signOut } from "@/lib/auth/service";
import { authLogger } from "@/lib/logger";
import { createApiErrorResponse } from "@/lib/errors";

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  authLogger.info("Sign out request received", {
    action: "SIGNOUT",
    requestId,
  });

  try {
    // Perform sign out
    await signOut();

    authLogger.info("Sign out completed successfully", {
      action: "SIGNOUT",
      requestId,
    });

    // Return success with cache control headers to prevent caching
    return NextResponse.json(
      {
        success: true,
        message: "Signed out successfully",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error) {
    // Log the error but still return a response that allows logout
    // Even if server-side logout fails, client should still clear local state
    authLogger.error("Sign out error occurred", error, {
      action: "SIGNOUT",
      requestId,
    });

    // Return a "soft" error - indicate failure but allow client to proceed
    // This prevents users from being stuck in a logged-in state
    return NextResponse.json(
      {
        success: false,
        error: "Sign out encountered an issue, but you have been logged out locally.",
        shouldClearLocalState: true, // Hint to client to clear local state anyway
      },
      {
        status: 200, // Use 200 to allow client-side logout to proceed
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  }
}
