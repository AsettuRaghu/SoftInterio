import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// POST /api/billing/change-plan
// Request a plan change (upgrade or downgrade)
export async function POST(request: NextRequest) {
  try {
    console.log("=== PLAN CHANGE REQUEST START ===");
    
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      console.log("API guard failed:", guard.error);
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    console.log("User authenticated:", { userId: user.id, email: user.email });

    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // Get request body
    const body = await request.json();
    const { planId, billingCycle } = body;
    console.log("Request body:", { planId, billingCycle });

    if (!planId) {
      console.log("Plan ID missing");
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    // Get user's tenant and check permissions
    console.log("Fetching user tenant...");
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("tenant_id, is_super_admin")
      .eq("id", user.id)
      .single();

    if (userError || !userData?.tenant_id) {
      console.log("User tenant fetch failed:", { userError, userData });
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    console.log("User tenant found:", { tenantId: userData.tenant_id, isSuperAdmin: userData.is_super_admin });

    // Check if user has billing permission (owner or admin)
    console.log("Checking user permissions...");
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select(
        `
        role:roles (
          name,
          hierarchy_level
        )
      `
      )
      .eq("user_id", user.id);

    console.log("User roles fetched:", { rolesCount: userRoles?.length, roles: userRoles });

    const isOwnerOrAdmin =
      userData.is_super_admin ||
      userRoles?.some(
        (ur) =>
          ur.role &&
          typeof ur.role === "object" &&
          "hierarchy_level" in ur.role &&
          (ur.role as { hierarchy_level: number }).hierarchy_level <= 1
      );

    console.log("Permission check result:", { isOwnerOrAdmin });

    if (!isOwnerOrAdmin) {
      console.log("User lacks billing permissions");
      return NextResponse.json(
        { error: "Only owners and admins can change the subscription plan" },
        { status: 403 }
      );
    }

    const tenantId = userData.tenant_id;

    // Get the target plan
    console.log("Fetching target plan:", { planId });
    const { data: targetPlan, error: planError } = await adminSupabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .eq("is_active", true)
      .single();

    if (planError || !targetPlan) {
      console.log("Target plan fetch failed:", { planError, targetPlan });
      return NextResponse.json(
        { error: "Invalid or inactive plan" },
        { status: 400 }
      );
    }

    console.log("Target plan found:", { planId: targetPlan.id, name: targetPlan.name, price: targetPlan.price_monthly });

    // Get current subscription
    console.log("Fetching current subscription...");
    const { data: currentSub } = await adminSupabase
      .from("tenant_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("tenant_id", tenantId)
      .single();

    console.log("Current subscription fetched:", { 
      hasCurrentSub: !!currentSub, 
      currentPlanId: currentSub?.plan_id, 
      currentPlanName: currentSub?.plan?.name 
    });

    // Determine change type
    let changeType: "upgrade" | "downgrade" | "cancel" | "reactivate" =
      "upgrade";
    if (currentSub?.plan) {
      const currentPrice = currentSub.plan.price_monthly;
      const targetPrice = targetPlan.price_monthly;
      changeType = targetPrice > currentPrice ? "upgrade" : "downgrade";
      console.log("Change type determined:", { 
        currentPrice, 
        targetPrice, 
        changeType 
      });
    }

    // For downgrades, check if current usage exceeds new plan limits
    if (changeType === "downgrade") {
      console.log("Checking downgrade usage limits...");
      const { data: usage } = await adminSupabase
        .from("tenant_usage")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

      if (usage) {
        const issues: string[] = [];

        if (
          targetPlan.max_users !== -1 &&
          usage.current_users > targetPlan.max_users
        ) {
          issues.push(
            `You have ${usage.current_users} users but the ${targetPlan.name} plan only allows ${targetPlan.max_users}`
          );
        }

        if (
          targetPlan.max_projects !== -1 &&
          usage.current_projects > targetPlan.max_projects
        ) {
          issues.push(
            `You have ${usage.current_projects} projects but the ${targetPlan.name} plan only allows ${targetPlan.max_projects}`
          );
        }

        const storageUsedGb = (usage.storage_used_bytes || 0) / 1073741824;
        if (storageUsedGb > targetPlan.max_storage_gb) {
          issues.push(
            `You're using ${storageUsedGb.toFixed(1)} GB storage but the ${
              targetPlan.name
            } plan only allows ${targetPlan.max_storage_gb} GB`
          );
        }

        console.log("Downgrade usage check:", { issues, usageValidation: issues.length === 0 });

        if (issues.length > 0) {
          return NextResponse.json(
            {
              error: "Cannot downgrade due to usage limits",
              details: issues,
            },
            { status: 400 }
          );
        }
      }
    }

    // Calculate effective date and proration
    const now = new Date();
    const effectiveAt =
      changeType === "upgrade"
        ? now // Upgrades are immediate
        : currentSub?.current_period_end
        ? new Date(currentSub.current_period_end) // Downgrades at period end
        : now;

    console.log("Effective date calculated:", { 
      changeType, 
      now: now.toISOString(), 
      effectiveAt: effectiveAt.toISOString() 
    });

    // Create change request
    console.log("Creating change request...");
    const { data: changeRequest, error: changeError } = await adminSupabase
      .from("subscription_change_requests")
      .insert({
        tenant_id: tenantId,
        change_type: changeType,
        from_plan_id: currentSub?.plan_id || null,
        to_plan_id: planId,
        requested_at: now.toISOString(),
        effective_at: effectiveAt.toISOString(),
        status: changeType === "upgrade" ? "completed" : "scheduled",
        requested_by: user.id,
      })
      .select()
      .single();

    if (changeError) {
      console.error("Error creating change request:", changeError);
      return NextResponse.json(
        { error: "Failed to process plan change" },
        { status: 500 }
      );
    }

    console.log("Change request created:", { 
      changeRequestId: changeRequest.id, 
      status: changeRequest.status 
    });

    // For upgrades, apply immediately
    if (changeType === "upgrade") {
      console.log("Processing upgrade, applying immediately...");
      // Update or create subscription
      const subscriptionData = {
        tenant_id: tenantId,
        plan_id: planId,
        status: "active" as const,
        billing_cycle: (billingCycle || "monthly") as "monthly" | "yearly",
        current_period_start: now.toISOString(),
        current_period_end: new Date(
          now.getTime() +
            (billingCycle === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000
        ).toISOString(),
        is_trial: false,
      };

      console.log("Subscription data prepared:", subscriptionData);

      if (currentSub) {
        console.log("Updating existing subscription...");
        const updateResult = await adminSupabase
          .from("tenant_subscriptions")
          .update(subscriptionData)
          .eq("id", currentSub.id);
        console.log("Subscription updated:", updateResult);
      } else {
        console.log("Creating new subscription...");
        const insertResult = await adminSupabase
          .from("tenant_subscriptions")
          .insert(subscriptionData);
        console.log("Subscription created:", insertResult);
      }

      // Update tenant's plan reference
      console.log("Updating tenant plan reference...");
      const tenantUpdateResult = await adminSupabase
        .from("tenants")
        .update({ subscription_plan_id: planId })
        .eq("id", tenantId);
      console.log("Tenant updated:", tenantUpdateResult);

      // Mark change request as completed
      console.log("Marking change request as completed...");
      const changeCompletionResult = await adminSupabase
        .from("subscription_change_requests")
        .update({
          status: "completed",
          processed_at: now.toISOString(),
        })
        .eq("id", changeRequest.id);
      console.log("Change request completed:", changeCompletionResult);
    }

    const response = {
      success: true,
      changeType,
      effectiveAt: effectiveAt.toISOString(),
      message:
        changeType === "upgrade"
          ? `Successfully upgraded to ${targetPlan.name} plan!`
          : `Your plan will change to ${targetPlan.name} at the end of the current billing period.`,
      changeRequest: {
        id: changeRequest.id,
        status: changeRequest.status,
      },
    };

    console.log("=== PLAN CHANGE RESPONSE ===");
    console.log("Response:", response);
    console.log("=== END PLAN CHANGE ===");

    return NextResponse.json(response);
  } catch (error) {
    console.error("=== PLAN CHANGE ERROR ===");
    console.error("Error changing plan:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
