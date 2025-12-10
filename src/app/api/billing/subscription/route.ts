import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

// GET /api/billing/subscription
// Returns comprehensive subscription status, plan details, usage, and warnings
export async function GET(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    // Get user's tenant
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData?.tenant_id) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }

    const tenantId = userData.tenant_id;

    // Get tenant info
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, company_name, subscription_plan_id, status")
      .eq("id", tenantId)
      .single();

    if (tenantError) {
      console.error("Error fetching tenant:", tenantError);
      return NextResponse.json(
        { error: "Failed to fetch tenant" },
        { status: 500 }
      );
    }

    // Get subscription details with all new fields
    const { data: subscription, error: subscriptionError } = await supabase
      .from("tenant_subscriptions")
      .select(
        `
        id,
        status,
        billing_cycle,
        is_trial,
        trial_days_granted,
        trial_start_date,
        trial_end_date,
        subscription_start_date,
        subscription_end_date,
        current_period_start,
        current_period_end,
        grace_period_days,
        grace_period_end,
        auto_renew,
        next_billing_date,
        last_payment_date,
        last_payment_amount,
        cancelled_at,
        cancellation_reason,
        cancellation_effective_date,
        plan_id
      `
      )
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (subscriptionError) {
      console.error("Error fetching subscription:", subscriptionError);
    }

    // Get billing config for warning threshold and billing options
    let warningDaysThreshold = 30;
    let allowedBillingCycles: string[] = ["yearly"]; // Default to yearly only
    let allowMonthly = false;
    try {
      const { data: billingConfig } = await supabase
        .from("system_config")
        .select("config_value")
        .eq("config_key", "billing_settings")
        .single();

      if (billingConfig?.config_value) {
        if (billingConfig.config_value.warning_days_threshold) {
          warningDaysThreshold =
            billingConfig.config_value.warning_days_threshold;
        }
        if (billingConfig.config_value.enabled_cycles) {
          allowedBillingCycles = billingConfig.config_value.enabled_cycles;
        }
        if (billingConfig.config_value.allow_monthly !== undefined) {
          allowMonthly = billingConfig.config_value.allow_monthly;
        }
      }
    } catch {
      // Use default if config not available
    }

    // Get the plan
    const planId = subscription?.plan_id || tenant.subscription_plan_id;
    let plan = null;
    let planFeatures: Array<{
      feature_key: string;
      feature_name: string;
      included: boolean;
      limit_value: number | null;
    }> = [];

    if (planId) {
      const { data: planData } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("id", planId)
        .single();

      plan = planData;

      const { data: features } = await supabase
        .from("subscription_plan_features")
        .select("*")
        .eq("plan_id", planId);

      planFeatures = features || [];
    }

    // Get usage data
    let usage = null;
    try {
      const { data: usageData } = await supabase
        .from("tenant_usage")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      usage = usageData;
    } catch {
      // Table might not exist
    }

    // Calculate days remaining and warning flags
    const now = new Date();
    let trialDaysRemaining: number | null = null;
    let subscriptionDaysRemaining: number | null = null;
    let showTrialWarning = false;
    let showSubscriptionWarning = false;
    let showPayButton = false;
    let isInGracePeriod = false;

    if (subscription) {
      // Trial days remaining
      if (subscription.is_trial && subscription.trial_end_date) {
        const trialEnd = new Date(subscription.trial_end_date);
        trialDaysRemaining = Math.max(
          0,
          Math.ceil(
            (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          )
        );
        showTrialWarning = trialDaysRemaining <= warningDaysThreshold;
        if (showTrialWarning) showPayButton = true;
      }

      // Subscription days remaining
      if (subscription.subscription_end_date) {
        const subEnd = new Date(subscription.subscription_end_date);
        subscriptionDaysRemaining = Math.max(
          0,
          Math.ceil((subEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        );
        if (!subscription.is_trial) {
          showSubscriptionWarning =
            subscriptionDaysRemaining <= warningDaysThreshold;
          if (showSubscriptionWarning) showPayButton = true;
        }
      }

      // Grace period check
      if (subscription.status === "expired" && subscription.grace_period_end) {
        const graceEnd = new Date(subscription.grace_period_end);
        isInGracePeriod = now < graceEnd;
      }

      // Show pay button for expired/past_due
      if (
        subscription.status === "expired" ||
        subscription.status === "past_due"
      ) {
        showPayButton = true;
      }
    }

    // Calculate usage percentages
    const usageData = {
      users: {
        current: usage?.current_users || 0,
        limit: plan?.max_users || 5,
        percentage:
          plan?.max_users && plan.max_users > 0
            ? Math.round(((usage?.current_users || 0) / plan.max_users) * 100)
            : 0,
        unlimited: plan?.max_users === -1,
      },
      projects: {
        current: usage?.current_projects || 0,
        limit: plan?.max_projects || 50,
        percentage:
          plan?.max_projects && plan.max_projects > 0
            ? Math.round(
                ((usage?.current_projects || 0) / plan.max_projects) * 100
              )
            : 0,
        unlimited: plan?.max_projects === -1,
      },
      storage: {
        current: usage?.storage_used_bytes
          ? Math.round((usage.storage_used_bytes / 1073741824) * 100) / 100
          : 0,
        limit: plan?.max_storage_gb || 25,
        percentage:
          plan?.max_storage_gb && plan.max_storage_gb > 0
            ? Math.round(
                ((usage?.storage_used_bytes || 0) /
                  1073741824 /
                  plan.max_storage_gb) *
                  100
              )
            : 0,
        unlimited: false,
      },
    };

    // Generate warning message
    let warningMessage: string | null = null;
    if (showTrialWarning) {
      warningMessage = `Your trial ends in ${trialDaysRemaining} days. Upgrade now to continue using SoftInterio.`;
    } else if (showSubscriptionWarning) {
      warningMessage = `Your subscription expires in ${subscriptionDaysRemaining} days. Renew now to avoid interruption.`;
    } else if (subscription?.status === "expired") {
      if (isInGracePeriod) {
        warningMessage = `Your subscription has expired. You have ${subscription.grace_period_days} days to renew.`;
      } else {
        warningMessage =
          "Your subscription has expired. Please renew to continue.";
      }
    }

    return NextResponse.json({
      tenant: {
        id: tenant.id,
        name: tenant.company_name,
        status: tenant.status,
      },
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            billingCycle: subscription.billing_cycle,

            // Trial info
            isTrial: subscription.is_trial,
            trialDaysGranted: subscription.trial_days_granted,
            trialStartDate: subscription.trial_start_date,
            trialEndDate: subscription.trial_end_date,
            trialDaysRemaining,

            // Subscription info
            subscriptionStartDate: subscription.subscription_start_date,
            subscriptionEndDate: subscription.subscription_end_date,
            subscriptionDaysRemaining,

            // Current period
            currentPeriodStart: subscription.current_period_start,
            currentPeriodEnd: subscription.current_period_end,

            // Grace period
            gracePeriodDays: subscription.grace_period_days,
            gracePeriodEnd: subscription.grace_period_end,
            isInGracePeriod,

            // Payment
            autoRenew: subscription.auto_renew,
            nextBillingDate: subscription.next_billing_date,
            lastPaymentDate: subscription.last_payment_date,
            lastPaymentAmount: subscription.last_payment_amount,

            // Cancellation
            cancelledAt: subscription.cancelled_at,
            cancellationReason: subscription.cancellation_reason,
            cancellationEffectiveDate: subscription.cancellation_effective_date,
          }
        : null,
      plan: plan
        ? {
            id: plan.id,
            name: plan.name,
            slug: plan.slug,
            description: plan.description,
            priceMonthly: plan.price_monthly,
            priceYearly: plan.price_yearly,
            maxUsers: plan.max_users,
            maxProjects: plan.max_projects,
            maxStorageGb: plan.max_storage_gb,
            isFeatured: plan.is_featured,
          }
        : null,
      features: planFeatures.map((f) => ({
        key: f.feature_key,
        name: f.feature_name,
        included: f.included,
        limit: f.limit_value,
      })),
      usage: usageData,

      // Warning flags for UI
      warnings: {
        warningDaysThreshold,
        showTrialWarning,
        showSubscriptionWarning,
        showPayButton,
        isInGracePeriod,
        message: warningMessage,
      },

      // Billing configuration
      billingConfig: {
        allowedBillingCycles,
        allowMonthly: allowMonthly || allowedBillingCycles.includes("monthly"),
        allowYearly: allowedBillingCycles.includes("yearly"),
      },
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
