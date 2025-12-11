"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { LeadStatistics, LeadStage } from "@/types/leads";
import { LeadStageLabels, LeadStageColors } from "@/types/leads";
import { PageLayout, PageHeader, StatBadge } from "@/components/ui/PageLayout";
import { ChartBarIcon } from "@heroicons/react/24/outline";
import { uiLogger } from "@/lib/logger";

export default function SalesReportsPage() {
  const [statistics, setStatistics] = useState<LeadStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<
    "week" | "month" | "quarter" | "year"
  >("month");

  // Fetch statistics
  const fetchStatistics = useCallback(async () => {
    try {
      setIsLoading(true);
      uiLogger.info("Fetching sales statistics...", {
        module: "SalesReportsPage",
        action: "fetch_statistics",
      });
      const response = await fetch("/api/sales/leads/statistics");
      if (!response.ok) throw new Error("Failed to fetch statistics");

      const data = await response.json();
      setStatistics(data.statistics);
      uiLogger.info("Statistics loaded successfully", {
        module: "SalesReportsPage",
        action: "statistics_loaded",
      });
    } catch (err) {
      uiLogger.error("Failed to fetch statistics", err as Error, {
        module: "SalesReportsPage",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  // Format currency
  const formatCurrency = (amount: number | null) => {
    if (!amount) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate conversion rate
  const conversionRate = statistics
    ? statistics.total > 0
      ? ((statistics.won / statistics.total) * 100).toFixed(1)
      : "0.0"
    : "0.0";

  // Calculate pipeline stages for funnel
  const pipelineStages: {
    stage: LeadStage;
    count: number;
    percentage: number;
  }[] = statistics
    ? [
        {
          stage: "new",
          count: statistics.new,
          percentage:
            statistics.total > 0
              ? (statistics.new / statistics.total) * 100
              : 0,
        },
        {
          stage: "qualified",
          count: statistics.qualified,
          percentage:
            statistics.total > 0
              ? (statistics.qualified / statistics.total) * 100
              : 0,
        },
        {
          stage: "requirement_discussion",
          count: statistics.requirement_discussion,
          percentage:
            statistics.total > 0
              ? (statistics.requirement_discussion / statistics.total) * 100
              : 0,
        },
        {
          stage: "proposal_discussion",
          count: statistics.proposal_discussion,
          percentage:
            statistics.total > 0
              ? (statistics.proposal_discussion / statistics.total) * 100
              : 0,
        },
        {
          stage: "won",
          count: statistics.won,
          percentage:
            statistics.total > 0
              ? (statistics.won / statistics.total) * 100
              : 0,
        },
      ]
    : [];

  return (
    <PageLayout isLoading={isLoading} loadingText="Loading reports...">
      {/* Header */}
      <PageHeader
        title="Sales Reports"
        subtitle="Analytics and insights for your sales pipeline"
        breadcrumbs={[{ label: "Reports" }]}
        basePath={{ label: "Sales", href: "/dashboard/sales" }}
        icon={<ChartBarIcon className="w-5 h-5 text-white" />}
        iconBgClass="from-purple-500 to-purple-600"
        stats={
          statistics ? (
            <>
              <StatBadge label="Leads" value={statistics.total} color="slate" />
              <StatBadge
                label="Conv."
                value={`${conversionRate}%`}
                color="green"
              />
              <StatBadge
                label="Pipeline"
                value={formatCurrency(statistics.pipeline_value)}
                color="blue"
              />
            </>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-1.5">
            {(["week", "month", "quarter", "year"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  dateRange === range
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        }
      />

      {statistics && (
        <>
          {/* Key Metrics - More compact */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-xs">Total Leads</span>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-blue-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {statistics?.total || 0}
              </p>
              <p className="text-xs text-green-600">
                +{statistics?.this_month_new || 0} this month
              </p>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-xs">Pipeline Value</span>
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-purple-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(statistics?.pipeline_value || 0)}
              </p>
              <p className="text-xs text-slate-500">In active stages</p>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-xs">Won Value</span>
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(statistics?.won_value || 0)}
              </p>
              <p className="text-xs text-green-600">
                {statistics?.this_month_won || 0} won this month
              </p>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-xs">Conversion Rate</span>
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-amber-600"
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
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {conversionRate}%
              </p>
              <p className="text-xs text-slate-500">Leads to Won</p>
            </div>
          </div>

          {/* Charts Row - More compact */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Sales Funnel */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">
                Sales Funnel
              </h3>
              <div className="space-y-3">
                {pipelineStages.map((item, index) => {
                  const colors = LeadStageColors[item.stage];
                  const widthPercent = Math.max(item.percentage, 10);

                  return (
                    <div key={item.stage}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-700">
                          {LeadStageLabels[item.stage]}
                        </span>
                        <span className="text-xs text-slate-500">
                          {item.count} ({item.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-6 bg-slate-100 rounded overflow-hidden">
                        <div
                          className={`h-full ${colors.bg} ${colors.text} flex items-center justify-center text-[10px] font-medium transition-all duration-500`}
                          style={{ width: `${widthPercent}%` }}
                        >
                          {item.count}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stage Distribution */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">
                Lead Status Overview
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {statistics &&
                  [
                    { label: "New", count: statistics.new, color: "purple" },
                    {
                      label: "Qualified",
                      count: statistics.qualified,
                      color: "blue",
                    },
                    {
                      label: "In Discussion",
                      count:
                        statistics.requirement_discussion +
                        statistics.proposal_discussion,
                      color: "cyan",
                    },
                    { label: "Won", count: statistics.won, color: "green" },
                    { label: "Lost", count: statistics.lost, color: "red" },
                    {
                      label: "Disqualified",
                      count: statistics.disqualified,
                      color: "gray",
                    },
                    {
                      label: "Follow-up",
                      count: statistics.needs_followup,
                      color: "amber",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="p-3 rounded-lg"
                      style={{
                        backgroundColor:
                          item.color === "purple"
                            ? "#f3e8ff"
                            : item.color === "blue"
                            ? "#dbeafe"
                            : item.color === "cyan"
                            ? "#cffafe"
                            : item.color === "orange"
                            ? "#ffedd5"
                            : item.color === "green"
                            ? "#dcfce7"
                            : item.color === "red"
                            ? "#fee2e2"
                            : item.color === "amber"
                            ? "#fef3c7"
                            : "#f3f4f6",
                      }}
                    >
                      <p className="text-xl font-bold text-slate-900">
                        {item.count}
                      </p>
                      <p className="text-xs text-slate-600">{item.label}</p>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Performance Metrics - Compact */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">
              Performance Metrics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Win Rate */}
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="w-20 h-20 mx-auto mb-3 relative">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      stroke="#e5e7eb"
                      strokeWidth="6"
                      fill="none"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      stroke="#22c55e"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={`${
                        parseFloat(conversionRate) * 2.01
                      } 201`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-green-600">
                      {conversionRate}%
                    </span>
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-900">Win Rate</p>
                <p className="text-xs text-slate-500">
                  {statistics?.won || 0} of {statistics?.total || 0}
                </p>
              </div>

              {/* Loss Rate */}
              <div className="text-center p-4 bg-red-50 rounded-lg">
                {(() => {
                  const lossRate =
                    statistics && statistics.total > 0
                      ? ((statistics.lost / statistics.total) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <>
                      <div className="w-20 h-20 mx-auto mb-3 relative">
                        <svg className="w-20 h-20 transform -rotate-90">
                          <circle
                            cx="40"
                            cy="40"
                            r="32"
                            stroke="#e5e7eb"
                            strokeWidth="6"
                            fill="none"
                          />
                          <circle
                            cx="40"
                            cy="40"
                            r="32"
                            stroke="#ef4444"
                            strokeWidth="6"
                            fill="none"
                            strokeDasharray={`${
                              parseFloat(lossRate) * 2.01
                            } 201`}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold text-red-600">
                            {lossRate}%
                          </span>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-slate-900">
                        Loss Rate
                      </p>
                      <p className="text-xs text-slate-500">
                        {statistics?.lost || 0} of {statistics?.total || 0}
                      </p>
                    </>
                  );
                })()}
              </div>

              {/* Active Pipeline */}
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                {(() => {
                  const activeCount = statistics
                    ? statistics.total -
                      statistics.won -
                      statistics.lost -
                      statistics.disqualified
                    : 0;
                  const activeRate =
                    statistics && statistics.total > 0
                      ? ((activeCount / statistics.total) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <>
                      <div className="w-20 h-20 mx-auto mb-3 relative">
                        <svg className="w-20 h-20 transform -rotate-90">
                          <circle
                            cx="40"
                            cy="40"
                            r="32"
                            stroke="#e5e7eb"
                            strokeWidth="6"
                            fill="none"
                          />
                          <circle
                            cx="40"
                            cy="40"
                            r="32"
                            stroke="#3b82f6"
                            strokeWidth="6"
                            fill="none"
                            strokeDasharray={`${
                              parseFloat(activeRate) * 2.01
                            } 201`}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-bold text-blue-600">
                            {activeRate}%
                          </span>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-slate-900">
                        Active Pipeline
                      </p>
                      <p className="text-xs text-slate-500">
                        {activeCount} leads
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Action Items - Compact */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Action Required
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
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
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-bold text-amber-700">
                    {statistics?.needs_followup || 0}
                  </p>
                  <p className="text-xs text-amber-600">
                    Leads need follow-up (3+ days)
                  </p>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
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
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-bold text-blue-700">
                    {statistics?.new || 0}
                  </p>
                  <p className="text-xs text-blue-600">New leads to qualify</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </PageLayout>
  );
}
