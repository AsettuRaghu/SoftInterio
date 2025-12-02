import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/billing/change-plan
// Request a plan change (upgrade or downgrade)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { planId, billingCycle } = body;

    if (!planId) {
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    // Get user's tenant and check permissions
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("tenant_id, is_super_admin")
      .eq("id", user.id)
      .single();

    if (userError || !userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    // Check if user has billing permission (owner or admin)
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

    const isOwnerOrAdmin =
      userData.is_super_admin ||
      userRoles?.some(
        (ur) =>
          ur.role &&
          typeof ur.role === "object" &&
          "hierarchy_level" in ur.role &&
          (ur.role as { hierarchy_level: number }).hierarchy_level <= 1
      );

    if (!isOwnerOrAdmin) {
      return NextResponse.json(
        { error: "Only owners and admins can change the subscription plan" },
        { status: 403 }
      );
    }

    const tenantId = userData.tenant_id;

    // Get the target plan
    const { data: targetPlan, error: planError } = await adminSupabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .eq("is_active", true)
      .single();

    if (planError || !targetPlan) {
      return NextResponse.json(
        { error: "Invalid or inactive plan" },
        { status: 400 }
      );
    }

    // Get current subscription
    const { data: currentSub } = await adminSupabase
      .from("tenant_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("tenant_id", tenantId)
      .single();

    // Determine change type
    let changeType: "upgrade" | "downgrade" | "cancel" | "reactivate" =
      "upgrade";
    if (currentSub?.plan) {
      const currentPrice = currentSub.plan.price_monthly;
      const targetPrice = targetPlan.price_monthly;
      changeType = targetPrice > currentPrice ? "upgrade" : "downgrade";
    }

    // For downgrades, check if current usage exceeds new plan limits
    if (changeType === "downgrade") {
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

    // Create change request
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

    // For upgrades, apply immediately
    if (changeType === "upgrade") {
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

      if (currentSub) {
        await adminSupabase
          .from("tenant_subscriptions")
          .update(subscriptionData)
          .eq("id", currentSub.id);
      } else {
        await adminSupabase
          .from("tenant_subscriptions")
          .insert(subscriptionData);
      }

      // Update tenant's plan reference
      await adminSupabase
        .from("tenants")
        .update({ subscription_plan_id: planId })
        .eq("id", tenantId);

      // Mark change request as completed
      await adminSupabase
        .from("subscription_change_requests")
        .update({
          status: "completed",
          processed_at: now.toISOString(),
        })
        .eq("id", changeRequest.id);
    }

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("Error changing plan:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
