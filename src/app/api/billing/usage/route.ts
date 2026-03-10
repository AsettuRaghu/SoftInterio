/**
 * Billing Usage API Route
 * GET /api/billing/usage - Get current usage and limits
 */

import { NextRequest, NextResponse } from "next/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { getTenantUsageLimits } from "@/lib/billing/usage";

// GET /api/billing/usage
// Returns current usage metrics and plan limits
export async function GET(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await (await import("@/lib/supabase/server")).createClient();

    // Get user's tenant
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    // Get usage limits
    const usage = await getTenantUsageLimits(userData.tenant_id);

    if (!usage) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: usage,
    });
  } catch (error) {
    console.error("[BILLING USAGE API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage limits" },
      { status: 500 }
    );
  }
}
