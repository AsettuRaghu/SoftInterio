"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Alert } from "@/components/ui/Alert";
import { ChangePlanModal } from "@/components/billing/ChangePlanModal";
import { PaymentModal } from "@/components/billing/PaymentModal";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/components/ui/PageLayout";
import { uiLogger } from "@/lib/logger";
import { CreditCardIcon } from "@heroicons/react/24/outline";
import { getSubscriptionStatus } from "@/lib/billing/subscription-status";
import type { SubscriptionStatus } from "@/lib/billing/subscription-status";
import { subscriptionLogger, planLogger } from "@/lib/activity-logger";

// Types
interface PlanFeature {
  key: string;
  name: string;
  included: boolean;
  limit: number | null;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  maxUsers: number;
  maxProjects: number;
  maxStorageGb: number;
  isFeatured: boolean;
  displayOrder: number;
  features: PlanFeature[];
}

interface UsageMetric {
  current: number;
  limit: number;
  percentage: number;
  unlimited: boolean;
}

interface Subscription {
  id: string;
  status: "trial" | "active" | "past_due" | "cancelled" | "expired";
  billingCycle: "monthly" | "yearly";
  isTrial: boolean;
  trialDaysGranted: number;
  trialStartDate: string | null;
  trialEndDate: string | null;
  trialDaysRemaining: number | null;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  subscriptionDaysRemaining: number | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  description: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  status: "draft" | "pending" | "paid" | "failed" | "refunded" | "cancelled";
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  paymentMethod: string | null;
  invoicePdfUrl: string | null;
  dueDate: string | null;
  createdAt: string;
}

interface BillingConfig {
  allowedBillingCycles: string[];
  allowMonthly: boolean;
  allowYearly: boolean;
}

interface Warnings {
  warningDaysThreshold: number;
  showTrialWarning: boolean;
  showSubscriptionWarning: boolean;
  showPayButton: boolean;
  isInGracePeriod: boolean;
  message: string | null;
}

interface SubscriptionData {
  tenant: { id: string; name: string };
  subscription: Subscription | null;
  plan: Plan | null;
  features: PlanFeature[];
  usage: {
    users: UsageMetric;
    projects: UsageMetric;
    storage: UsageMetric;
  };
  warnings: Warnings;
  billingConfig: BillingConfig;
}

// Helper to format currency
const formatCurrency = (amount: number, currency = "INR") => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Helper to format date
const formatDate = (dateString: string | null) => {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// Compact Usage Bar Component
const UsageBar = ({
  label,
  current,
  limit,
  percentage,
  unlimited,
  unit = "",
}: {
  label: string;
  current: number;
  limit: number;
  percentage: number;
  unlimited: boolean;
  unit?: string;
}) => {
  const getBarColor = () => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 75) return "bg-amber-500";
    return "bg-blue-500";
  };

  const getTextColor = () => {
    if (percentage >= 90) return "text-red-600";
    if (percentage >= 75) return "text-amber-600";
    return "text-slate-600";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-700">{label}</span>
        <span className={`text-xs ${getTextColor()}`}>
          {current}
          {unit} / {unlimited ? "∞" : `${limit}${unit}`}
        </span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${getBarColor()}`}
          style={{ width: unlimited ? "5%" : `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
};

// Status Badge Component
const StatusBadge = ({
  status,
}: {
  status: Subscription["status"] | Invoice["status"];
}) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    trial: { bg: "bg-purple-100", text: "text-purple-700", label: "Trial" },
    active: { bg: "bg-green-100", text: "text-green-700", label: "Active" },
    past_due: { bg: "bg-red-100", text: "text-red-700", label: "Past Due" },
    cancelled: {
      bg: "bg-slate-100",
      text: "text-slate-700",
      label: "Cancelled",
    },
    expired: { bg: "bg-red-100", text: "text-red-700", label: "Expired" },
    draft: { bg: "bg-slate-100", text: "text-slate-600", label: "Draft" },
    pending: { bg: "bg-amber-100", text: "text-amber-700", label: "Pending" },
    paid: { bg: "bg-green-100", text: "text-green-700", label: "Paid" },
    failed: { bg: "bg-red-100", text: "text-red-700", label: "Failed" },
    refunded: { bg: "bg-blue-100", text: "text-blue-700", label: "Refunded" },
  };

  const { bg, text, label } = config[status] || config.active;

  return (
    <span
      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${bg} ${text}`}
    >
      {label}
    </span>
  );
};

export default function BillingSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionData, setSubscriptionData] =
    useState<SubscriptionData | null>(null);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [changeSuccess, setChangeSuccess] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [invoicePage, setInvoicePage] = useState(1);
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus | null>(null);
  const invoicesPerPage = 10;

  // Get billing cycle from subscription data
  const billingCycle = subscriptionData?.subscription?.billingCycle || "yearly";

  // Fetch subscription data
  const fetchSubscription = useCallback(async () => {
    try {
      uiLogger.debug("Fetching subscription data", {
        action: "fetch_subscription",
        timestamp: new Date().toISOString(),
      });

      const res = await fetch("/api/billing/subscription");

      uiLogger.debug("Subscription fetch response", {
        status: res.status,
        ok: res.ok,
      });

      if (!res.ok) {
        throw new Error("Failed to fetch subscription");
      }

      const data = await res.json();

      uiLogger.debug("Subscription data parsed", {
        hasSubscription: !!data?.subscription,
        subscriptionStatus: data?.subscription?.status,
        subscriptionIsTrial: data?.subscription?.isTrial,
        hasPlan: !!data?.plan,
        planName: data?.plan?.name,
        planId: data?.plan?.id,
        planSlug: data?.plan?.slug,
        usageStats: {
          users: `${data?.usage?.users?.current}/${data?.usage?.users?.limit}`,
          projects: `${data?.usage?.projects?.current}/${data?.usage?.projects?.limit}`,
        },
      });

      setSubscriptionData(data);

      // Calculate subscription status using utility function
      if (data?.subscription) {
        const rawSubscription = {
          id: data.subscription.id,
          status: data.subscription.status,
          is_trial: data.subscription.isTrial,
          trial_start_date: data.subscription.trialStartDate,
          trial_end_date: data.subscription.trialEndDate,
          subscription_start_date: data.subscription.subscriptionStartDate,
          subscription_end_date: data.subscription.subscriptionEndDate,
          current_period_start: data.subscription.currentPeriodStart,
          current_period_end: data.subscription.currentPeriodEnd,
          last_payment_date: null, // Will be set from payment records
          grace_period_days: 7,
          grace_period_end: null,
        };
        const status = getSubscriptionStatus(rawSubscription);
        setSubscriptionStatus(status);

        uiLogger.debug("Subscription status calculated", {
          calculatedStatus: status,
        });
      }

      uiLogger.debug("Subscription data loaded successfully", {
        status: data?.subscription?.status,
      });
    } catch (err) {
      uiLogger.error("Failed to fetch subscription", err, {
        action: "fetch_subscription",
        errorType: err instanceof Error ? err.constructor.name : typeof err,
      });
      setError("Failed to load subscription data");
    }
  }, []);

  // Fetch all plans
  const fetchPlans = useCallback(async () => {
    try {
      uiLogger.debug("Fetching plans", { action: "fetch_plans" });
      const res = await fetch("/api/billing/plans");
      if (!res.ok) throw new Error("Failed to fetch plans");
      const data = await res.json();
      setAllPlans(data.plans || []);
      uiLogger.debug("Plans loaded", { count: data.plans?.length || 0 });
    } catch (err) {
      uiLogger.error("Failed to fetch plans", err, { action: "fetch_plans" });
    }
  }, []);

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    try {
      uiLogger.debug("Fetching invoices", { action: "fetch_invoices" });
      const res = await fetch("/api/billing/invoices?limit=10");
      if (!res.ok) throw new Error("Failed to fetch invoices");
      const data = await res.json();
      setInvoices(data.invoices || []);
      uiLogger.debug("Invoices loaded", { count: data.invoices?.length || 0 });
    } catch (err) {
      uiLogger.error("Failed to fetch invoices", err, {
        action: "fetch_invoices",
      });
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchSubscription(), fetchPlans(), fetchInvoices()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchSubscription, fetchPlans, fetchInvoices]);

  // Handle plan change
  const handleChangePlan = async () => {
    if (!selectedPlan) return;

    uiLogger.info("Changing subscription plan", {
      action: "change_plan",
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      billingCycle: billingCycle,
    });
    setIsChangingPlan(true);
    setError(null);

    try {
      const requestBody = {
        planId: selectedPlan.id,
        billingCycle: billingCycle,
      };

      uiLogger.info("Sending plan change request", {
        action: "change_plan_request",
        requestBody,
      });

      const res = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      uiLogger.info("Plan change response received", {
        action: "change_plan_response",
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
      });

      const data = await res.json();

      uiLogger.info("Plan change response parsed", {
        action: "change_plan_parsed",
        responseKeys: Object.keys(data),
        success: data.success,
        changeType: data.changeType,
        hasMessage: !!data.message,
      });

      if (!res.ok) {
        const errorMessage = data.error || "Failed to change plan";
        uiLogger.error(
          "Plan change failed (API error)",
          new Error(errorMessage),
          {
            action: "change_plan_error",
            status: res.status,
            error: data.error,
            details: data.details,
          },
        );
        throw new Error(errorMessage);
      }

      if (!data.success) {
        const errorMessage = data.error || "Plan change was not successful";
        uiLogger.error("Plan change not successful", new Error(errorMessage), {
          action: "change_plan_unsuccessful",
          response: data,
        });
        throw new Error(errorMessage);
      }

      uiLogger.info("Plan changed successfully", {
        action: "change_plan_success",
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        changeType: data.changeType,
        effectiveAt: data.effectiveAt,
        message: data.message,
        changeRequestId: data.changeRequest?.id,
      });

      setChangeSuccess(data.message);
      setShowPlanModal(false);
      setSelectedPlan(null);

      uiLogger.info("Fetching updated subscription", {
        action: "fetch_subscription",
      });
      await fetchSubscription();

      setTimeout(() => setChangeSuccess(null), 5000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to change plan";
      uiLogger.error("Failed to change plan (exception)", err, {
        action: "change_plan_exception",
        errorType: err instanceof Error ? err.constructor.name : typeof err,
      });
      setError(errorMessage);
    } finally {
      setIsChangingPlan(false);
    }
  };

  // Calculate if plan is upgrade or downgrade
  const isPlanUpgrade = (plan: Plan) => {
    if (!subscriptionData?.plan) return true;
    const currentPrice = subscriptionData.plan.priceMonthly;
    return plan.priceMonthly > currentPrice;
  };

  // Get days remaining to show
  const getDaysRemaining = () => {
    const sub = subscriptionData?.subscription;
    if (!sub) return null;

    if (sub.isTrial && sub.trialDaysRemaining !== null) {
      return { days: sub.trialDaysRemaining, type: "trial" };
    }
    if (sub.subscriptionDaysRemaining !== null) {
      return { days: sub.subscriptionDaysRemaining, type: "subscription" };
    }
    return null;
  };

  // Check if should show days remaining warning
  const shouldShowDaysWarning = () => {
    const daysInfo = getDaysRemaining();
    if (!daysInfo) return false;
    const threshold = subscriptionData?.warnings?.warningDaysThreshold || 30;
    return daysInfo.days <= threshold;
  };

  if (isLoading) {
    return (
      <PageLayout isLoading={true} loadingText="Loading subscription data...">
        <></>
      </PageLayout>
    );
  }

  if (!subscriptionData) {
    return (
      <PageLayout>
        <PageHeader
          title="Subscription"
          subtitle="Manage your subscription and billing"
          basePath={{ label: "Settings", href: "/dashboard/settings" }}
          breadcrumbs={[{ label: "Billing" }]}
          icon={<CreditCardIcon className="w-4 h-4 text-white" />}
          iconBgClass="from-green-500 to-green-600"
        />
        <PageContent>
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Unable to Load Subscription
            </h3>
            <p className="text-sm text-red-600 mb-4">
              {error || "There was an error loading your subscription data."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
            >
              Retry
            </button>
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  const daysInfo = getDaysRemaining();
  const showDaysWarning = shouldShowDaysWarning();

  return (
    <PageLayout>
      <PageHeader
        title="Billing & Subscription"
        subtitle="Manage your subscription, plans, and payment history"
        basePath={{ label: "Settings", href: "/dashboard/settings" }}
        breadcrumbs={[{ label: "Billing & Subscription" }]}
        icon={<CreditCardIcon className="w-4 h-4 text-white" />}
        iconBgClass="from-green-500 to-green-600"
        status={
          subscriptionData?.subscription?.isTrial
            ? "trial"
            : subscriptionData?.subscription?.status === "active"
              ? "active"
              : "inactive"
        }
      />
      <PageContent>
        <div className="space-y-4">
          {/* Alerts */}
          {error && (
            <Alert
              variant="error"
              message={error}
              onDismiss={() => setError(null)}
            />
          )}
          {changeSuccess && (
            <Alert
              variant="success"
              message={changeSuccess}
              onDismiss={() => setChangeSuccess(null)}
            />
          )}

          {/* Expiry Warning Alert */}
          {subscriptionStatus?.state === "expiring-soon" &&
            subscriptionStatus?.daysUntilExpiry !== null && (
              <Alert
                variant="warning"
                message={`Your subscription will expire in ${subscriptionStatus.daysUntilExpiry} days. Please renew your subscription to maintain access.`}
                onDismiss={() => {}}
              />
            )}

          {/* SECTION 1: Subscription Details */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Subscription Details
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  View and manage your subscription plan
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {subscriptionStatus?.showPayNowButton && (
                  <button
                    onClick={() => {
                      if (
                        subscriptionData?.plan?.id &&
                        subscriptionStatus?.canPayNow
                      ) {
                        setShowPaymentModal(true);
                      }
                    }}
                    disabled={!subscriptionStatus?.canPayNow}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      subscriptionStatus?.canPayNow
                        ? subscriptionStatus.state === "expiring-soon"
                          ? "bg-amber-600 text-white hover:bg-amber-700"
                          : "bg-green-600 text-white hover:bg-green-700"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    💳 {subscriptionStatus?.payNowButtonLabel}
                  </button>
                )}
                <button
                  onClick={() => setShowPlanModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Change Plan
                </button>
              </div>
            </div>

            {/* Subscription Card */}
            <div className="p-6 bg-white border-b border-slate-200">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 shrink-0 bg-linear-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center text-white text-lg font-bold">
                  {subscriptionData?.plan?.name?.charAt(0) || "?"}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1.5">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {subscriptionData?.plan?.name || "No Plan Selected"}
                    </h3>
                    {subscriptionData?.subscription && (
                      <StatusBadge
                        status={
                          subscriptionData.subscription.isTrial
                            ? "trial"
                            : subscriptionData.subscription.status
                        }
                      />
                    )}
                  </div>
                  <p className="text-sm text-slate-600">
                    {subscriptionData?.plan?.description ||
                      "Select a plan to get started"}
                  </p>
                </div>
              </div>
            </div>

            {/* Subscription Information Grid */}
            <div className="p-6 bg-white">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">
                Subscription Information
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {/* Billing Cycle */}
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Billing Cycle
                  </p>
                  <p className="text-sm font-semibold text-slate-900 capitalize">
                    {subscriptionData?.subscription?.billingCycle || "Yearly"}
                  </p>
                </div>

                {/* Status */}
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Status
                  </p>
                  <p className="text-sm font-semibold text-slate-900 capitalize">
                    {subscriptionData?.subscription?.status || "Unknown"}
                  </p>
                </div>

                {/* Trial Start Date - Show only if on trial */}
                {subscriptionStatus?.showTrialDates &&
                  subscriptionData?.subscription?.trialStartDate && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                        Trial Start Date
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatDate(
                          subscriptionData.subscription.trialStartDate,
                        )}
                      </p>
                    </div>
                  )}

                {/* Trial End Date - Show only if on trial */}
                {subscriptionStatus?.showTrialDates &&
                  subscriptionData?.subscription?.trialEndDate && (
                    <div
                      className={
                        subscriptionStatus?.daysUntilExpiry !== null &&
                        subscriptionStatus?.daysUntilExpiry <= 15
                          ? "p-3 rounded-lg bg-amber-50 border border-amber-200"
                          : ""
                      }
                    >
                      <p
                        className={`text-xs font-medium uppercase tracking-wide mb-2 ${
                          subscriptionStatus?.daysUntilExpiry !== null &&
                          subscriptionStatus?.daysUntilExpiry <= 15
                            ? "text-amber-700"
                            : "text-slate-500"
                        }`}
                      >
                        Trial End Date
                      </p>
                      <p
                        className={`text-sm font-semibold ${
                          subscriptionStatus?.daysUntilExpiry !== null &&
                          subscriptionStatus?.daysUntilExpiry <= 15
                            ? "text-amber-900"
                            : "text-slate-900"
                        }`}
                      >
                        {formatDate(subscriptionData.subscription.trialEndDate)}
                      </p>
                      {subscriptionStatus?.daysUntilExpiry !== null &&
                        subscriptionStatus?.daysUntilExpiry <= 15 && (
                          <p className="text-xs text-amber-700 mt-1">
                            {subscriptionStatus.daysUntilExpiry} days remaining
                          </p>
                        )}
                    </div>
                  )}

                {/* Subscription Start Date - Show only if active subscription */}
                {subscriptionStatus?.showSubscriptionDates &&
                  subscriptionData?.subscription?.subscriptionStartDate && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                        Subscription Start
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatDate(
                          subscriptionData.subscription.subscriptionStartDate,
                        )}
                      </p>
                    </div>
                  )}

                {/* Subscription End Date - Show only if active subscription */}
                {subscriptionStatus?.showSubscriptionDates &&
                  subscriptionData?.subscription?.subscriptionEndDate && (
                    <div
                      className={
                        subscriptionStatus?.daysUntilExpiry !== null &&
                        subscriptionStatus?.daysUntilExpiry <= 15
                          ? "p-3 rounded-lg bg-amber-50 border border-amber-200"
                          : ""
                      }
                    >
                      <p
                        className={`text-xs font-medium uppercase tracking-wide mb-2 ${
                          subscriptionStatus?.daysUntilExpiry !== null &&
                          subscriptionStatus?.daysUntilExpiry <= 15
                            ? "text-amber-700"
                            : "text-slate-500"
                        }`}
                      >
                        Subscription End
                      </p>
                      <p
                        className={`text-sm font-semibold ${
                          subscriptionStatus?.daysUntilExpiry !== null &&
                          subscriptionStatus?.daysUntilExpiry <= 15
                            ? "text-amber-900"
                            : "text-slate-900"
                        }`}
                      >
                        {formatDate(
                          subscriptionData.subscription.subscriptionEndDate,
                        )}
                      </p>
                      {subscriptionStatus?.daysUntilExpiry !== null &&
                        subscriptionStatus?.daysUntilExpiry <= 15 && (
                          <p className="text-xs text-amber-700 mt-1">
                            {subscriptionStatus.daysUntilExpiry} days remaining
                          </p>
                        )}
                    </div>
                  )}
              </div>
            </div>

            {/* Resource Usage Section */}
            {subscriptionData?.usage && (
              <div className="p-6 bg-slate-50/50 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">
                  Resource Usage
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <UsageBar
                    label="Team Members"
                    current={subscriptionData.usage.users.current}
                    limit={subscriptionData.usage.users.limit}
                    percentage={subscriptionData.usage.users.percentage}
                    unlimited={subscriptionData.usage.users.unlimited}
                  />
                  <UsageBar
                    label="Projects"
                    current={subscriptionData.usage.projects.current}
                    limit={subscriptionData.usage.projects.limit}
                    percentage={subscriptionData.usage.projects.percentage}
                    unlimited={subscriptionData.usage.projects.unlimited}
                  />
                  <UsageBar
                    label="Storage"
                    current={subscriptionData.usage.storage.current}
                    limit={subscriptionData.usage.storage.limit}
                    percentage={subscriptionData.usage.storage.percentage}
                    unlimited={subscriptionData.usage.storage.unlimited}
                    unit=" GB"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: Payment Details */}
          <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-100/50 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">
                Payment Details
              </h2>
              <p className="text-[10px] text-slate-500">
                View and download your payment invoices
              </p>
            </div>

            {/* Table Content */}
            <div className="p-4 bg-white">
              {invoices.length === 0 ? (
                <div className="text-center py-8">
                  <svg
                    className="w-12 h-12 text-slate-300 mx-auto mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-sm font-medium text-slate-600">
                    No payment history
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Invoices will appear here once you make a payment
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/50">
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            Invoice
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            Subscription Period
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            Paid Date
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {invoices
                          .slice(
                            (invoicePage - 1) * invoicesPerPage,
                            invoicePage * invoicesPerPage,
                          )
                          .map((invoice) => (
                            <tr
                              key={invoice.id}
                              className="hover:bg-slate-50 transition-colors"
                            >
                              {/* Invoice Number */}
                              <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-blue-50 rounded flex items-center justify-center">
                                    <svg
                                      className="w-4 h-4 text-blue-600"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path d="M5 3a2 2 0 012-2h6a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V3z" />
                                    </svg>
                                  </div>
                                  <span>{invoice.invoiceNumber}</span>
                                </div>
                              </td>

                              {/* Subscription Period */}
                              <td className="px-4 py-3 text-sm text-slate-900">
                                <div className="space-y-0.5">
                                  <p className="font-medium">
                                    {invoice.periodStart && invoice.periodEnd
                                      ? `${formatDate(invoice.periodStart)} - ${formatDate(invoice.periodEnd)}`
                                      : "—"}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {invoice.description || "Subscription"}
                                  </p>
                                </div>
                              </td>

                              {/* Paid Date */}
                              <td className="px-4 py-3 text-sm text-slate-600">
                                {formatDate(
                                  invoice.paidAt || invoice.createdAt,
                                )}
                              </td>

                              {/* Amount */}
                              <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                                {formatCurrency(
                                  invoice.totalAmount / 100,
                                  invoice.currency,
                                )}
                              </td>

                              {/* Status */}
                              <td className="px-4 py-3">
                                <StatusBadge status={invoice.status} />
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {invoice.invoicePdfUrl && (
                                    <>
                                      <a
                                        href={invoice.invoicePdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                        title="View invoice"
                                      >
                                        <svg
                                          className="w-3.5 h-3.5"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                          />
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                          />
                                        </svg>
                                        View
                                      </a>
                                      <a
                                        href={invoice.invoicePdfUrl}
                                        download
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                                        title="Download invoice"
                                      >
                                        <svg
                                          className="w-3.5 h-3.5"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                          />
                                        </svg>
                                        Download
                                      </a>
                                    </>
                                  )}
                                  {!invoice.invoicePdfUrl && (
                                    <span className="text-slate-400 text-xs">
                                      —
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {Math.ceil(invoices.length / invoicesPerPage) > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs text-slate-600">
                        Showing{" "}
                        <span className="font-semibold">
                          {(invoicePage - 1) * invoicesPerPage + 1}
                        </span>{" "}
                        to{" "}
                        <span className="font-semibold">
                          {Math.min(
                            invoicePage * invoicesPerPage,
                            invoices.length,
                          )}
                        </span>{" "}
                        of{" "}
                        <span className="font-semibold">{invoices.length}</span>{" "}
                        payments
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            setInvoicePage((prev) => Math.max(prev - 1, 1))
                          }
                          disabled={invoicePage === 1}
                          className="p-1 text-slate-600 hover:bg-slate-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Previous page"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 19l-7-7 7-7"
                            />
                          </svg>
                        </button>
                        <span className="text-xs text-slate-600 px-2 py-1 bg-slate-50 rounded">
                          {invoicePage} /{" "}
                          {Math.ceil(invoices.length / invoicesPerPage)}
                        </span>
                        <button
                          onClick={() =>
                            setInvoicePage((prev) =>
                              Math.min(
                                prev + 1,
                                Math.ceil(invoices.length / invoicesPerPage),
                              ),
                            )
                          }
                          disabled={
                            invoicePage ===
                            Math.ceil(invoices.length / invoicesPerPage)
                          }
                          className="p-1 text-slate-600 hover:bg-slate-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Next page"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Plan Change Modal */}
          <ChangePlanModal
            isOpen={showPlanModal}
            onClose={() => {
              setShowPlanModal(false);
              setSelectedPlan(null);
            }}
            subscriptionData={subscriptionData}
            allPlans={allPlans}
            billingCycle={billingCycle}
            isChangingPlan={isChangingPlan}
            onPlanChange={handleChangePlan}
          />

          {/* Payment Modal */}
          <PaymentModal
            isOpen={showPaymentModal}
            onClose={() => setShowPaymentModal(false)}
            planId={subscriptionData?.plan?.id || ""}
            billingCycle={billingCycle as "monthly" | "yearly"}
            onSuccess={(invoiceId) => {
              uiLogger.info("Payment successful", {
                action: "payment_success",
                invoiceId,
              });
              setPaymentSuccess(
                "Payment successful! Your subscription is now active.",
              );
              setTimeout(() => {
                setPaymentSuccess(null);
                fetchSubscription();
              }, 3000);
            }}
            onError={(errorMessage) => {
              uiLogger.error("Payment failed", new Error(errorMessage), {
                action: "payment_error",
              });
              setError(errorMessage);
            }}
          />
        </div>
      </PageContent>
    </PageLayout>
  );
}
