/**
 * Subscription Validation Helpers
 * Utility functions to validate subscription data programmatically
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface SubscriptionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    tenantId: string;
    subscriptionId: string | null;
    planName: string | null;
    currentState: string;
  };
}

/**
 * Validate a tenant's subscription data
 */
export async function validateTenantSubscription(
  supabase: SupabaseClient,
  tenantId: string
): Promise<SubscriptionValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Fetch tenant
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      return {
        isValid: false,
        errors: ["Tenant not found"],
        warnings: [],
        metadata: {
          tenantId,
          subscriptionId: null,
          planName: null,
          currentState: "TENANT_NOT_FOUND",
        },
      };
    }

    // Fetch subscription
    const { data: subscription } = await supabase
      .from("tenant_subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("tenant_id", tenantId)
      .single();

    // Check 1: Subscription exists
    if (!subscription) {
      errors.push("No subscription record found for tenant");
      return {
        isValid: false,
        errors,
        warnings,
        metadata: {
          tenantId,
          subscriptionId: null,
          planName: null,
          currentState: "NO_SUBSCRIPTION",
        },
      };
    }

    const planName = subscription.plan?.name || "Unknown";

    // Check 2: Plan exists and is valid
    if (!subscription.plan_id) {
      errors.push("Subscription has no plan assigned");
    } else if (!subscription.plan || !subscription.plan.is_active) {
      errors.push(
        "Subscription plan is not found or inactive in database"
      );
    }

    // Check 3: Tenant and subscription plan match
    if (tenant.subscription_plan_id !== subscription.plan_id) {
      warnings.push(
        `Tenant's plan (${tenant.subscription_plan_id}) differs from subscription plan (${subscription.plan_id})`
      );
    }

    // Check 4: Trial dates validation
    if (subscription.is_trial) {
      if (!subscription.trial_start_date) {
        errors.push("Trial subscription missing trial_start_date");
      }
      if (!subscription.trial_end_date) {
        errors.push("Trial subscription missing trial_end_date");
      }
      if (
        subscription.trial_start_date &&
        subscription.trial_end_date &&
        new Date(subscription.trial_start_date) >
          new Date(subscription.trial_end_date)
      ) {
        errors.push(
          "Trial start date is after trial end date"
        );
      }
    }

    // Check 5: Subscription dates validation (if not trial)
    if (!subscription.is_trial) {
      if (!subscription.subscription_start_date) {
        errors.push("Active subscription missing subscription_start_date");
      }
      if (!subscription.subscription_end_date) {
        errors.push("Active subscription missing subscription_end_date");
      }
      if (
        subscription.subscription_start_date &&
        subscription.subscription_end_date
      ) {
        if (
          new Date(subscription.subscription_start_date) >
          new Date(subscription.subscription_end_date)
        ) {
          errors.push(
            "Subscription start date is after subscription end date"
          );
        }
      }

      // Check if payment made for non-trial
      if (!subscription.last_payment_date) {
        warnings.push(
          "Non-trial subscription has no payment record yet"
        );
      }
    }

    // Check 6: Current period dates
    if (!subscription.current_period_start) {
      errors.push("Missing current_period_start");
    }
    if (!subscription.current_period_end) {
      errors.push("Missing current_period_end");
    }

    // Check 7: Status consistency
    const now = new Date();
    const expectedStatus = determineExpectedStatus(subscription, now);
    if (subscription.status !== expectedStatus.calculated) {
      warnings.push(
        `Status "${subscription.status}" doesn't match calculated status "${expectedStatus.calculated}"`
      );
    }

    // Check 8: Billing cycle is valid
    if (!["monthly", "yearly"].includes(subscription.billing_cycle)) {
      errors.push(
        `Invalid billing cycle: ${subscription.billing_cycle}`
      );
    }

    const isValid = errors.length === 0;
    return {
      isValid,
      errors,
      warnings,
      metadata: {
        tenantId,
        subscriptionId: subscription.id,
        planName,
        currentState: expectedStatus.state,
      },
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [
        `Validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
      warnings: [],
      metadata: {
        tenantId,
        subscriptionId: null,
        planName: null,
        currentState: "ERROR",
      },
    };
  }
}

/**
 * Validate all tenants' subscriptions (bulk validation)
 */
export async function validateAllSubscriptions(
  supabase: SupabaseClient
): Promise<{
  totalTenants: number;
  validSubscriptions: number;
  invalidSubscriptions: number;
  details: SubscriptionValidationResult[];
}> {
  const { data: tenants, error } = await supabase
    .from("tenants")
    .select("id")
    .neq("status", "deleted");

  if (error || !tenants) {
    return {
      totalTenants: 0,
      validSubscriptions: 0,
      invalidSubscriptions: 0,
      details: [],
    };
  }

  const results: SubscriptionValidationResult[] = [];

  for (const tenant of tenants) {
    const result = await validateTenantSubscription(supabase, tenant.id);
    results.push(result);
  }

  return {
    totalTenants: tenants.length,
    validSubscriptions: results.filter((r) => r.isValid).length,
    invalidSubscriptions: results.filter((r) => !r.isValid).length,
    details: results,
  };
}

/**
 * Determine expected subscription status based on dates
 */
function determineExpectedStatus(
  subscription: any,
  now: Date = new Date()
): { state: string; calculated: string } {
  if (subscription.is_trial) {
    const trialEnd = subscription.trial_end_date
      ? new Date(subscription.trial_end_date)
      : null;
    if (trialEnd && now < trialEnd) {
      return {
        state: "ON_TRIAL",
        calculated: "trial",
      };
    } else {
      return {
        state: "TRIAL_EXPIRED",
        calculated: "trial",
      };
    }
  } else {
    const subEnd = subscription.subscription_end_date
      ? new Date(subscription.subscription_end_date)
      : null;
    if (subEnd && now < subEnd) {
      return {
        state: "ACTIVE_SUBSCRIPTION",
        calculated: "active",
      };
    } else {
      return {
        state: "SUBSCRIPTION_EXPIRED",
        calculated: "active",
      };
    }
  }
}

/**
 * Check for specific validation issue by type
 */
export async function checkValidationIssueByType(
  supabase: SupabaseClient,
  issueType:
    | "NO_SUBSCRIPTION"
    | "MISSING_PLAN"
    | "MISSING_DATES"
    | "STATUS_MISMATCH"
    | "NO_PAYMENT"
): Promise<string[]> {
  const affectedTenants: string[] = [];

  if (issueType === "NO_SUBSCRIPTION") {
    const { data } = await supabase
      .from("tenants")
      .select("id")
      .neq("status", "deleted");

    if (data) {
      for (const tenant of data) {
        const { data: sub } = await supabase
          .from("tenant_subscriptions")
          .select("id")
          .eq("tenant_id", tenant.id)
          .single();

        if (!sub) {
          affectedTenants.push(tenant.id);
        }
      }
    }
  } else if (issueType === "MISSING_PLAN") {
    const { data } = await supabase
      .from("tenant_subscriptions")
      .select("id, tenant_id")
      .or("plan_id.is.null,plan_id.eq.''");

    affectedTenants.push(...(data?.map((r) => r.tenant_id) || []));
  } else if (issueType === "MISSING_DATES") {
    const { data } = await supabase.rpc(
      "get_subscriptions_with_missing_dates"
    );
    affectedTenants.push(...(data?.map((r: any) => r.tenant_id) || []));
  } else if (issueType === "NO_PAYMENT") {
    const { data } = await supabase
      .from("tenant_subscriptions")
      .select("id, tenant_id")
      .eq("is_trial", false)
      .is("last_payment_date", null);

    affectedTenants.push(...(data?.map((r) => r.tenant_id) || []));
  }

  return affectedTenants;
}

/**
 * Get subscription statistics
 */
export async function getSubscriptionStats(
  supabase: SupabaseClient
): Promise<{
  totalTenants: number;
  onTrial: number;
  active: number;
  expired: number;
  noSubscription: number;
  expiringIn15Days: number;
}> {
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id")
    .neq("status", "deleted");

  const { data: stats } = await supabase.rpc("get_subscription_stats");

  return {
    totalTenants: tenants?.length || 0,
    onTrial: stats?.on_trial || 0,
    active: stats?.active || 0,
    expired: stats?.expired || 0,
    noSubscription: stats?.no_subscription || 0,
    expiringIn15Days: stats?.expiring_in_15_days || 0,
  };
}

/**
 * Export validation report to JSON
 */
export async function generateValidationReport(
  supabase: SupabaseClient
): Promise<string> {
  const allValidations = await validateAllSubscriptions(supabase);
  const stats = await getSubscriptionStats(supabase);

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTenants: allValidations.totalTenants,
      validSubscriptions: allValidations.validSubscriptions,
      invalidSubscriptions: allValidations.invalidSubscriptions,
      stats,
    },
    issues: allValidations.details
      .filter((d) => !d.isValid || d.warnings.length > 0)
      .map((d) => ({
        tenantId: d.metadata.tenantId,
        planName: d.metadata.planName,
        state: d.metadata.currentState,
        errors: d.errors,
        warnings: d.warnings,
      })),
  };

  return JSON.stringify(report, null, 2);
}
