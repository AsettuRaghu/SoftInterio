"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  SettingsPageLayout,
  SettingsPageHeader,
  SettingsPageContent,
} from "@/components/ui/SettingsPageLayout";
import { uiLogger } from "@/lib/logger";
import { CreditCardIcon } from "@heroicons/react/24/outline";

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

  // Get billing cycle from subscription data
  const billingCycle = subscriptionData?.subscription?.billingCycle || "yearly";

  // Fetch subscription data
  const fetchSubscription = useCallback(async () => {
    try {
      uiLogger.debug("Fetching subscription data", {
        action: "fetch_subscription",
      });
      const res = await fetch("/api/billing/subscription");
      if (!res.ok) throw new Error("Failed to fetch subscription");
      const data = await res.json();
      setSubscriptionData(data);
      uiLogger.debug("Subscription data loaded", {
        status: data?.subscription?.status,
      });
    } catch (err) {
      uiLogger.error("Failed to fetch subscription", err, {
        action: "fetch_subscription",
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
    });
    setIsChangingPlan(true);
    setError(null);

    try {
      const res = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlan.id,
          billingCycle: billingCycle,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to change plan");
      }

      uiLogger.info("Plan changed successfully", {
        action: "change_plan",
        planId: selectedPlan.id,
      });
      setChangeSuccess(data.message);
      setShowPlanModal(false);
      setSelectedPlan(null);
      await fetchSubscription();

      setTimeout(() => setChangeSuccess(null), 5000);
    } catch (err) {
      uiLogger.error("Failed to change plan", err, { action: "change_plan" });
      setError(err instanceof Error ? err.message : "Failed to change plan");
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
      <SettingsPageLayout
        isLoading={true}
        loadingText="Loading subscription data..."
      />
    );
  }

  if (!subscriptionData) {
    return (
      <SettingsPageLayout>
        <SettingsPageHeader
          title="Subscription"
          subtitle="Manage your subscription and billing"
          breadcrumbs={[{ label: "Billing" }]}
          icon={<CreditCardIcon className="w-4 h-4 text-white" />}
          iconBgClass="from-green-500 to-green-600"
        />
        <SettingsPageContent>
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
        </SettingsPageContent>
      </SettingsPageLayout>
    );
  }

  const daysInfo = getDaysRemaining();
  const showDaysWarning = shouldShowDaysWarning();

  return (
    <SettingsPageLayout>
      <SettingsPageHeader
        title="Subscription"
        subtitle={
          subscriptionData?.plan?.name || "Manage your subscription and billing"
        }
        breadcrumbs={[{ label: "Billing" }]}
        icon={<CreditCardIcon className="w-4 h-4 text-white" />}
        iconBgClass="from-green-500 to-green-600"
        status={
          subscriptionData?.subscription?.status === "active"
            ? "active"
            : "pending"
        }
        actions={
          <button
            onClick={() => setShowPlanModal(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
          >
            Change Plan
          </button>
        }
      />
      <SettingsPageContent>
        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}
        {changeSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-lg text-sm flex items-center justify-between">
            <span>{changeSuccess}</span>
            <button
              onClick={() => setChangeSuccess(null)}
              className="text-green-500 hover:text-green-700"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Current Plan Card - Compact Design like Company Details */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {/* Section Header with Plan Name */}
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-linear-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-sm">
                  {subscriptionData?.plan?.name?.charAt(0) || "?"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900">
                      {subscriptionData?.plan?.name || "No Plan"}
                    </h2>
                    {subscriptionData?.subscription && (
                      <StatusBadge
                        status={subscriptionData.subscription.status}
                      />
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    {subscriptionData?.plan?.description ||
                      "Select a plan to get started"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPlanModal(true)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Change Plan
                </button>
              </div>
            </div>
          </div>

          {/* Section Content */}
          <div className="p-5">
            {/* Subscription Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {/* Billing Term */}
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Billing Term</p>
                <p className="text-sm font-semibold text-slate-900 capitalize">
                  {subscriptionData?.subscription?.billingCycle || "Yearly"}
                </p>
              </div>

              {/* Trial/Subscription Dates */}
              {subscriptionData?.subscription?.isTrial ? (
                <>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Trial Started</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatDate(subscriptionData.subscription.trialStartDate)}
                    </p>
                  </div>
                  <div
                    className={`rounded-lg p-3 ${
                      showDaysWarning ? "bg-amber-50" : "bg-slate-50"
                    }`}
                  >
                    <p className="text-xs text-slate-500 mb-1">Trial Ends</p>
                    <p
                      className={`text-sm font-semibold ${
                        showDaysWarning ? "text-amber-700" : "text-slate-900"
                      }`}
                    >
                      {formatDate(subscriptionData.subscription.trialEndDate)}
                      {daysInfo && (
                        <span
                          className={`ml-1 text-xs font-normal ${
                            showDaysWarning
                              ? "text-amber-600"
                              : "text-slate-500"
                          }`}
                        >
                          ({daysInfo.days} days)
                        </span>
                      )}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">
                      Subscription Started
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatDate(
                        subscriptionData?.subscription?.subscriptionStartDate ??
                          null
                      )}
                    </p>
                  </div>
                  <div
                    className={`rounded-lg p-3 ${
                      showDaysWarning ? "bg-amber-50" : "bg-slate-50"
                    }`}
                  >
                    <p className="text-xs text-slate-500 mb-1">
                      Subscription Ends
                    </p>
                    <p
                      className={`text-sm font-semibold ${
                        showDaysWarning ? "text-amber-700" : "text-slate-900"
                      }`}
                    >
                      {formatDate(
                        subscriptionData?.subscription?.subscriptionEndDate ??
                          null
                      )}
                      {daysInfo && (
                        <span
                          className={`ml-1 text-xs font-normal ${
                            showDaysWarning
                              ? "text-amber-600"
                              : "text-slate-500"
                          }`}
                        >
                          ({daysInfo.days} days)
                        </span>
                      )}
                    </p>
                  </div>
                </>
              )}

              {/* Warning Threshold */}
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Warning Threshold</p>
                <p className="text-sm font-semibold text-slate-900">
                  {subscriptionData?.warnings?.warningDaysThreshold || 30} days
                </p>
              </div>
            </div>

            {/* Usage / Consumption */}
            {subscriptionData?.usage && (
              <div className="border-t border-slate-100 pt-4 mb-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Resource Usage
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            {/* Included Features - Compact Tags */}
            {subscriptionData?.features &&
              subscriptionData.features.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Included Features
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {subscriptionData.features
                      .filter((f) => f.included)
                      .map((feature) => (
                        <span
                          key={feature.key}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs"
                        >
                          <svg
                            className="w-3 h-3 text-green-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {feature.name}
                        </span>
                      ))}
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* Invoice History */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h2 className="text-sm font-semibold text-slate-900">
                Payment History
              </h2>
            </div>
            {invoices.length > 0 && (
              <Link
                href="/dashboard/settings/billing/invoices"
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                View All
              </Link>
            )}
          </div>

          <div className="p-5">
            {invoices.length === 0 ? (
              <div className="text-center py-6">
                <svg
                  className="w-10 h-10 text-slate-300 mx-auto mb-2"
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
                <p className="text-sm text-slate-500">No payment history</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Invoices will appear here once you make a payment
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                        Invoice
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                        Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                        Amount
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map((invoice) => (
                      <tr
                        key={invoice.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-2.5 text-sm font-medium text-slate-900">
                          {invoice.invoiceNumber}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-slate-600">
                          {formatDate(invoice.createdAt)}
                        </td>
                        <td className="px-4 py-2.5 text-sm font-medium text-slate-900">
                          {formatCurrency(
                            invoice.totalAmount / 100,
                            invoice.currency
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={invoice.status} />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {invoice.invoicePdfUrl ? (
                            <a
                              href={invoice.invoicePdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 text-sm font-medium hover:text-blue-700"
                            >
                              Download
                            </a>
                          ) : (
                            <span className="text-slate-400 text-sm">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Plan Selection Modal */}
        {showPlanModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {selectedPlan
                      ? (isPlanUpgrade(selectedPlan)
                          ? "Upgrade"
                          : "Downgrade") + " Plan"
                      : "Change Plan"}
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Select a plan that fits your business needs
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Show billing cycle info (read-only from current subscription) */}
                  <span className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium capitalize">
                    {billingCycle} billing
                  </span>
                  <button
                    onClick={() => {
                      setShowPlanModal(false);
                      setSelectedPlan(null);
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto flex-1">
                {!selectedPlan ? (
                  // Plan Selection View
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {allPlans.map((plan) => {
                      const isCurrentPlan =
                        subscriptionData?.plan?.id === plan.id;
                      const price =
                        billingCycle === "yearly"
                          ? plan.priceYearly
                          : plan.priceMonthly;
                      const isUpgrade = isPlanUpgrade(plan);

                      return (
                        <div
                          key={plan.id}
                          className={`rounded-lg border p-5 transition-all ${
                            isCurrentPlan
                              ? "border-green-500 ring-2 ring-green-100 bg-green-50/50 cursor-default"
                              : "border-slate-200 hover:border-blue-300 hover:shadow-md cursor-pointer"
                          } ${
                            plan.isFeatured && !isCurrentPlan
                              ? "border-blue-500 ring-2 ring-blue-100"
                              : ""
                          }`}
                          onClick={() =>
                            !isCurrentPlan && setSelectedPlan(plan)
                          }
                        >
                          <div className="flex items-center justify-between mb-2 min-h-6">
                            {isCurrentPlan && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                <svg
                                  className="w-3 h-3"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                Current Plan
                              </span>
                            )}
                            {plan.isFeatured && !isCurrentPlan && (
                              <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                                Most Popular
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg font-semibold text-slate-900">
                            {plan.name}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1 mb-3">
                            {plan.description}
                          </p>
                          <div className="mb-4">
                            <span className="text-2xl font-bold text-slate-900">
                              {formatCurrency(price)}
                            </span>
                            <span className="text-slate-500 text-sm">
                              /{billingCycle === "yearly" ? "yr" : "mo"}
                            </span>
                          </div>

                          {/* Limits */}
                          <div className="space-y-1.5 mb-4 text-sm">
                            <div className="flex items-center gap-2 text-slate-600">
                              <svg
                                className="w-4 h-4 text-slate-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                                />
                              </svg>
                              {plan.maxUsers === -1
                                ? "Unlimited users"
                                : `Up to ${plan.maxUsers} users`}
                            </div>
                            <div className="flex items-center gap-2 text-slate-600">
                              <svg
                                className="w-4 h-4 text-slate-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                />
                              </svg>
                              {plan.maxProjects === -1
                                ? "Unlimited projects"
                                : `Up to ${plan.maxProjects} projects`}
                            </div>
                            <div className="flex items-center gap-2 text-slate-600">
                              <svg
                                className="w-4 h-4 text-slate-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                                />
                              </svg>
                              {plan.maxStorageGb} GB storage
                            </div>
                          </div>

                          {/* Select Button */}
                          {!isCurrentPlan && (
                            <div
                              className={`w-full py-2 rounded-lg font-medium text-sm text-center ${
                                isUpgrade
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {isUpgrade
                                ? "Select to Upgrade"
                                : "Select to Downgrade"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // Confirmation View
                  <div className="max-w-lg mx-auto">
                    {/* Plan Change Summary */}
                    <div className="bg-slate-50 rounded-xl p-5 mb-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                            Current Plan
                          </p>
                          <p className="font-semibold text-slate-900">
                            {subscriptionData?.plan?.name || "None"}
                          </p>
                        </div>
                        <svg
                          className="w-8 h-8 text-slate-300"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 8l4 4m0 0l-4 4m4-4H3"
                          />
                        </svg>
                        <div className="text-right">
                          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                            New Plan
                          </p>
                          <p className="font-semibold text-slate-900">
                            {selectedPlan.name}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Proration / Policy Information */}
                    {isPlanUpgrade(selectedPlan) ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-5">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                            <svg
                              className="w-5 h-5 text-blue-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                              />
                            </svg>
                          </div>
                          <div>
                            <h4 className="font-semibold text-blue-900 mb-1">
                              Upgrade Payment
                            </h4>
                            <p className="text-sm text-blue-800 mb-3">
                              Your upgrade will take effect immediately.
                              You&apos;ll be charged a prorated amount for the
                              remaining days in your current billing period.
                            </p>
                            {daysInfo && (
                              <div className="bg-blue-100 rounded-lg p-3">
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-blue-700">
                                    Days remaining:
                                  </span>
                                  <span className="font-semibold text-blue-900">
                                    {daysInfo.days} days
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-5">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                            <svg
                              className="w-5 h-5 text-amber-600"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                          </div>
                          <div>
                            <h4 className="font-semibold text-amber-900 mb-1">
                              Downgrade Policy
                            </h4>
                            <p className="text-sm text-amber-800 mb-3">
                              <strong>No refunds</strong> will be issued for the
                              remaining time on your current plan. Your
                              downgrade will take effect at the end of your
                              current billing period.
                            </p>
                            <div className="bg-amber-100 rounded-lg p-3">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-amber-700">
                                  Current period ends:
                                </span>
                                <span className="font-semibold text-amber-900">
                                  {formatDate(
                                    subscriptionData?.subscription
                                      ?.subscriptionEndDate ||
                                      subscriptionData?.subscription
                                        ?.trialEndDate ||
                                      null
                                  )}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-amber-700 mt-3">
                              Please ensure your usage is within the new
                              plan&apos;s limits before the downgrade takes
                              effect.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => setSelectedPlan(null)}
                        disabled={isChangingPlan}
                        className="flex-1 px-4 py-3 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium disabled:opacity-50"
                      >
                        ← Back to Plans
                      </button>
                      <button
                        onClick={handleChangePlan}
                        disabled={isChangingPlan}
                        className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                          isPlanUpgrade(selectedPlan)
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-amber-600 text-white hover:bg-amber-700"
                        }`}
                      >
                        {isChangingPlan ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg
                              className="w-4 h-4 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              />
                            </svg>
                            Processing...
                          </span>
                        ) : isPlanUpgrade(selectedPlan) ? (
                          "Confirm Upgrade"
                        ) : (
                          "Confirm Downgrade"
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </SettingsPageContent>
    </SettingsPageLayout>
  );
}
