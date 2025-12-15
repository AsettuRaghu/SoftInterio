"use client";

import React, { useState, useMemo } from "react";

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

interface SubscriptionData {
  tenant: { id: string; name: string };
  subscription: Subscription | null;
  plan: Plan | null;
  features: PlanFeature[];
  usage: {
    users: {
      current: number;
      limit: number;
      percentage: number;
      unlimited: boolean;
    };
    projects: {
      current: number;
      limit: number;
      percentage: number;
      unlimited: boolean;
    };
    storage: {
      current: number;
      limit: number;
      percentage: number;
      unlimited: boolean;
    };
  };
  warnings: {
    warningDaysThreshold: number;
    showTrialWarning: boolean;
    showSubscriptionWarning: boolean;
    showPayButton: boolean;
    isInGracePeriod: boolean;
    message: string | null;
  };
  billingConfig: {
    allowedBillingCycles: string[];
    allowMonthly: boolean;
    allowYearly: boolean;
  };
}

interface ChangePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptionData: SubscriptionData | null;
  allPlans: Plan[];
  billingCycle: "monthly" | "yearly";
  isChangingPlan: boolean;
  onPlanChange: () => void;
}

const formatCurrency = (amount: number, currency = "INR") => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export function ChangePlanModal({
  isOpen,
  onClose,
  subscriptionData,
  allPlans,
  billingCycle,
  isChangingPlan,
  onPlanChange,
}: ChangePlanModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

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

  const daysInfo = getDaysRemaining();

  const handleClose = () => {
    setSelectedPlan(null);
    onClose();
  };

  const handleConfirm = () => {
    onPlanChange();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {selectedPlan
                ? (isPlanUpgrade(selectedPlan) ? "Upgrade" : "Downgrade") +
                  " Plan"
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
              onClick={handleClose}
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
                const isCurrentPlan = subscriptionData?.plan?.id === plan.id;
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
                    onClick={() => !isCurrentPlan && setSelectedPlan(plan)}
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
                        Your upgrade will take effect immediately. You&apos;ll
                        be charged a prorated amount for the remaining days in
                        your current billing period.
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
                        remaining time on your current plan. Your downgrade will
                        take effect at the end of your current billing period.
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
                                subscriptionData?.subscription?.trialEndDate ||
                                null
                            )}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-amber-700 mt-3">
                        Please ensure your usage is within the new plan&apos;s
                        limits before the downgrade takes effect.
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
                  onClick={handleConfirm}
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
  );
}
