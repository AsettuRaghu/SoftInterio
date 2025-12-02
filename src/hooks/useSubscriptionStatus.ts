"use client";

import { useState, useEffect, useCallback } from "react";

export interface SubscriptionWarnings {
  warningDaysThreshold: number;
  showTrialWarning: boolean;
  showSubscriptionWarning: boolean;
  showPayButton: boolean;
  isInGracePeriod: boolean;
  message: string | null;
}

export interface SubscriptionStatus {
  // Subscription state
  status: "trial" | "active" | "past_due" | "cancelled" | "expired" | null;
  billingCycle: "monthly" | "yearly" | null;

  // Trial info
  isTrial: boolean;
  trialDaysGranted: number | null;
  trialStartDate: string | null;
  trialEndDate: string | null;
  trialDaysRemaining: number | null;

  // Subscription dates
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  subscriptionDaysRemaining: number | null;

  // Plan info
  planName: string | null;
  planSlug: string | null;

  // Warning flags
  warnings: SubscriptionWarnings;

  // Loading/error states
  isLoading: boolean;
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
}

export function useSubscriptionStatus(): SubscriptionStatus {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    subscription: Record<string, unknown> | null;
    plan: Record<string, unknown> | null;
    warnings: SubscriptionWarnings;
  } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch("/api/billing/subscription");
      if (!res.ok) {
        throw new Error("Failed to fetch subscription status");
      }

      const json = await res.json();
      setData({
        subscription: json.subscription,
        plan: json.plan,
        warnings: json.warnings || {
          warningDaysThreshold: 30,
          showTrialWarning: false,
          showSubscriptionWarning: false,
          showPayButton: false,
          isInGracePeriod: false,
          message: null,
        },
      });
    } catch (err) {
      console.error("Error fetching subscription status:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const subscription = data?.subscription;
  const plan = data?.plan;
  const warnings = data?.warnings || {
    warningDaysThreshold: 30,
    showTrialWarning: false,
    showSubscriptionWarning: false,
    showPayButton: false,
    isInGracePeriod: false,
    message: null,
  };

  return {
    status: (subscription?.status as SubscriptionStatus["status"]) || null,
    billingCycle:
      (subscription?.billingCycle as SubscriptionStatus["billingCycle"]) ||
      null,

    isTrial: Boolean(subscription?.isTrial),
    trialDaysGranted: (subscription?.trialDaysGranted as number) || null,
    trialStartDate: (subscription?.trialStartDate as string) || null,
    trialEndDate: (subscription?.trialEndDate as string) || null,
    trialDaysRemaining: (subscription?.trialDaysRemaining as number) || null,

    subscriptionStartDate:
      (subscription?.subscriptionStartDate as string) || null,
    subscriptionEndDate: (subscription?.subscriptionEndDate as string) || null,
    subscriptionDaysRemaining:
      (subscription?.subscriptionDaysRemaining as number) || null,

    planName: (plan?.name as string) || null,
    planSlug: (plan?.slug as string) || null,

    warnings,

    isLoading,
    error,
    refresh: fetchStatus,
  };
}

// Helper function to format days remaining in a human-readable way
export function formatDaysRemaining(days: number | null): string {
  if (days === null) return "";
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  if (days < 7) return `${days} days`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "1 week" : `${weeks} weeks`;
  }
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month" : `${months} months`;
}

// Helper to get status color
export function getStatusColor(
  status: SubscriptionStatus["status"]
): "green" | "yellow" | "red" | "gray" {
  switch (status) {
    case "active":
      return "green";
    case "trial":
      return "yellow";
    case "past_due":
    case "expired":
      return "red";
    case "cancelled":
    default:
      return "gray";
  }
}
