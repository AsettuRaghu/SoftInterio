/**
 * Subscription Validation API
 * POST /api/debug/validate-subscriptions
 * 
 * Admin-only endpoint for subscription validation
 * Provides validation reports and health checks
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import {
  validateTenantSubscription,
  validateAllSubscriptions,
  checkValidationIssueByType,
  getSubscriptionStats,
  generateValidationReport,
} from "@/lib/billing/subscription-validation";

type ValidationAction = 
  | "validate-all"
  | "validate-tenant"
  | "check-issues"
  | "get-stats"
  | "generate-report";

export async function POST(request: NextRequest) {
  try {
    // Protect route - admin only
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = createAdminClient();

    // Check if user is admin
    const { data: userData } = await supabase
      .from("users")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();

    if (!userData?.is_super_admin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action: ValidationAction = body.action || "validate-all";
    const tenantId = body.tenantId;

    console.log("[SUBSCRIPTION VALIDATION] Action:", action, { tenantId });

    let result;

    switch (action) {
      case "validate-all":
        console.log("[SUBSCRIPTION VALIDATION] Validating all subscriptions...");
        result = await validateAllSubscriptions(supabase);
        console.log("[SUBSCRIPTION VALIDATION] Total issues found:", {
          invalid: result.invalidSubscriptions,
          total: result.totalTenants,
        });
        break;

      case "validate-tenant": {
        if (!tenantId) {
          return NextResponse.json(
            { error: "tenantId required for validate-tenant action" },
            { status: 400 }
          );
        }
        console.log(
          "[SUBSCRIPTION VALIDATION] Validating tenant:",
          tenantId
        );
        result = await validateTenantSubscription(supabase, tenantId);
        console.log("[SUBSCRIPTION VALIDATION] Tenant validation result:", {
          isValid: result.isValid,
          errorCount: result.errors.length,
          warningCount: result.warnings.length,
        });
        break;
      }

      case "check-issues": {
        const issueType = body.issueType || "NO_SUBSCRIPTION";
        console.log(
          "[SUBSCRIPTION VALIDATION] Checking for issues:",
          issueType
        );
        const affectedTenants = await checkValidationIssueByType(
          supabase,
          issueType
        );
        console.log(
          "[SUBSCRIPTION VALIDATION] Affected tenants:",
          affectedTenants.length
        );
        result = {
          issueType,
          affectedTenants,
          count: affectedTenants.length,
        };
        break;
      }

      case "get-stats":
        console.log("[SUBSCRIPTION VALIDATION] Getting subscription stats...");
        result = await getSubscriptionStats(supabase);
        console.log("[SUBSCRIPTION VALIDATION] Stats:", result);
        break;

      case "generate-report":
        console.log("[SUBSCRIPTION VALIDATION] Generating validation report...");
        const reportJson = await generateValidationReport(supabase);
        const report = JSON.parse(reportJson);
        console.log("[SUBSCRIPTION VALIDATION] Report generated:", {
          timestamp: report.timestamp,
          valid: report.summary.validSubscriptions,
          invalid: report.summary.invalidSubscriptions,
        });
        result = report;
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      timestamp: new Date().toISOString(),
      data: result,
    });
  } catch (error) {
    console.error("[SUBSCRIPTION VALIDATION] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Validation failed",
      },
      { status: 500 }
    );
  }
}

// GET /api/debug/validate-subscriptions?action=get-stats
export async function GET(request: NextRequest) {
  try {
    // Protect route - admin only
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = createAdminClient();

    // Check if user is admin
    const { data: userData } = await supabase
      .from("users")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();

    if (!userData?.is_super_admin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "get-stats";

    console.log("[SUBSCRIPTION VALIDATION] GET Action:", action);

    if (action === "get-stats") {
      const stats = await getSubscriptionStats(supabase);
      return NextResponse.json({
        success: true,
        action,
        timestamp: new Date().toISOString(),
        data: stats,
      });
    }

    return NextResponse.json(
      { error: `GET action not supported: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    console.error("[SUBSCRIPTION VALIDATION] GET Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Validation failed",
      },
      { status: 500 }
    );
  }
}
