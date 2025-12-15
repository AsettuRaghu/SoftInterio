"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { ChangePlanModal } from "@/components/billing/ChangePlanModal";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/components/ui/PageLayout";
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
        title="Subscription"
        subtitle={
          subscriptionData?.plan?.name || "Manage your subscription and billing"
        }
        basePath={{ label: "Settings", href: "/dashboard/settings" }}
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
                      <p className="text-xs text-slate-500 mb-1">
                        Trial Started
                      </p>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatDate(
                          subscriptionData.subscription.trialStartDate
                        )}
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
                          subscriptionData?.subscription
                            ?.subscriptionStartDate ?? null
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
                  <p className="text-xs text-slate-500 mb-1">
                    Warning Threshold
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {subscriptionData?.warnings?.warningDaysThreshold || 30}{" "}
                    days
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
        </div>
      </PageContent>
    </PageLayout>
  );
}
