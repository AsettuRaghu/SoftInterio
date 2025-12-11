"use client";

import React from "react";
import Link from "next/link";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "@/components/ui/PageLayout";
import {
  PresentationChartLineIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { uiLogger } from "@/lib/logger";

export default function SalesPage() {
  // Log page mount
  React.useEffect(() => {
    uiLogger.info("Sales Dashboard page mounted", { module: "SalesPage" });
  }, []);

  const salesStats = {
    totalLeads: 48,
    qualifiedLeads: 32,
    proposalsSent: 18,
    wonDeals: 12,
    conversionRate: 25,
    pipelineValue: 2850000,
    avgDealSize: 87500,
    monthlyTarget: 500000,
    monthlyAchieved: 385000,
  };

  const recentActivities = [
    {
      id: 1,
      type: "lead",
      title: "New Lead: Luxury Penthouse Project",
      client: "Michael & Jennifer Thompson",
      value: "$180,000",
      time: "2 hours ago",
      status: "New",
    },
    {
      id: 2,
      type: "proposal",
      title: "Proposal Sent: Boutique Hotel Lobby",
      client: "Grand Plaza Hotels",
      value: "$320,000",
      time: "5 hours ago",
      status: "Pending",
    },
    {
      id: 3,
      type: "won",
      title: "Deal Won: Medical Clinic Interior",
      client: "HealthFirst Clinics",
      value: "$95,000",
      time: "1 day ago",
      status: "Won",
    },
    {
      id: 4,
      type: "meeting",
      title: "Consultation: Modern Farmhouse Renovation",
      client: "David & Lisa Chen",
      value: "$145,000",
      time: "1 day ago",
      status: "Scheduled",
    },
  ];

  const topDeals = [
    {
      name: "Corporate HQ Redesign",
      client: "TechVentures Inc.",
      value: 450000,
      stage: "Proposal & Negotiation",
      probability: 75,
    },
    {
      name: "Luxury Resort Villas",
      client: "Paradise Resorts",
      value: 380000,
      stage: "Proposal & Negotiation",
      probability: 60,
    },
    {
      name: "Restaurant Chain Refresh",
      client: "Gourmet Group",
      value: 275000,
      stage: "Discovery",
      probability: 40,
    },
  ];

  return (
    <PageLayout>
      {/* Header */}
      <PageHeader
        title="Sales Dashboard"
        subtitle="Track leads, manage pipeline, and close deals"
        icon={<PresentationChartLineIcon className="w-5 h-5 text-white" />}
        iconBgClass="from-blue-500 to-blue-600"
        actions={
          <div className="flex gap-3">
            <Link
              href="/dashboard/sales/leads"
              className="bg-white text-blue-600 px-4 py-2 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors font-medium text-sm"
            >
              View Leads
            </Link>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2">
              <PlusIcon className="w-4 h-4" />
              Add Lead
            </button>
          </div>
        }
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Leads</p>
              <p className="text-2xl font-bold text-slate-900">
                {salesStats.totalLeads}
              </p>
              <p className="text-xs text-green-600 mt-1">↑ 12 new this week</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600"
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
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Pipeline Value</p>
              <p className="text-2xl font-bold text-slate-900">
                ${(salesStats.pipelineValue / 1000000).toFixed(2)}M
              </p>
              <p className="text-xs text-green-600 mt-1">
                ↑ 18% from last month
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-600"
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
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Conversion Rate</p>
              <p className="text-2xl font-bold text-slate-900">
                {salesStats.conversionRate}%
              </p>
              <p className="text-xs text-green-600 mt-1">↑ 3% improvement</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-purple-600"
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
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Avg. Deal Size</p>
              <p className="text-2xl font-bold text-slate-900">
                ${(salesStats.avgDealSize / 1000).toFixed(1)}K
              </p>
              <p className="text-xs text-amber-600 mt-1">Target: $100K</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-amber-600"
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
        </div>
      </div>

      {/* Monthly Target Progress */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Monthly Target Progress
          </h2>
          <span className="text-sm text-slate-500">
            ${(salesStats.monthlyAchieved / 1000).toFixed(0)}K of $
            {(salesStats.monthlyTarget / 1000).toFixed(0)}K
          </span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-4">
          <div
            className="bg-linear-to-r from-blue-500 to-blue-600 h-4 rounded-full transition-all duration-500"
            style={{
              width: `${
                (salesStats.monthlyAchieved / salesStats.monthlyTarget) * 100
              }%`,
            }}
          />
        </div>
        <p className="text-sm text-slate-600 mt-2">
          {(
            (salesStats.monthlyAchieved / salesStats.monthlyTarget) *
            100
          ).toFixed(0)}
          % achieved • $
          {(
            (salesStats.monthlyTarget - salesStats.monthlyAchieved) /
            1000
          ).toFixed(0)}
          K remaining
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">
              Recent Activity
            </h2>
          </div>
          <div className="p-4 space-y-4">
            {recentActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 p-3 rounded-lg hover:bg-slate-50"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    activity.type === "won"
                      ? "bg-green-100"
                      : activity.type === "proposal"
                      ? "bg-blue-100"
                      : activity.type === "lead"
                      ? "bg-purple-100"
                      : "bg-amber-100"
                  }`}
                >
                  {activity.type === "won" && (
                    <svg
                      className="w-5 h-5 text-green-600"
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
                  )}
                  {activity.type === "proposal" && (
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
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  )}
                  {activity.type === "lead" && (
                    <svg
                      className="w-5 h-5 text-purple-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                      />
                    </svg>
                  )}
                  {activity.type === "meeting" && (
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
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {activity.title}
                  </p>
                  <p className="text-sm text-slate-500">{activity.client}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-semibold text-slate-900">
                      {activity.value}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-400">
                      {activity.time}
                    </span>
                  </div>
                </div>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    activity.status === "Won"
                      ? "bg-green-100 text-green-700"
                      : activity.status === "New"
                      ? "bg-purple-100 text-purple-700"
                      : activity.status === "Pending"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {activity.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Deals in Pipeline */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Top Deals in Pipeline
            </h2>
            <Link
              href="/dashboard/sales/pipeline"
              className="text-blue-600 text-sm hover:text-blue-700"
            >
              View All →
            </Link>
          </div>
          <div className="p-4 space-y-4">
            {topDeals.map((deal, index) => (
              <div
                key={index}
                className="p-4 border border-slate-200 rounded-lg"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-slate-900">{deal.name}</h3>
                    <p className="text-sm text-slate-500">{deal.client}</p>
                  </div>
                  <span className="text-lg font-bold text-slate-900">
                    ${(deal.value / 1000).toFixed(0)}K
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      deal.stage === "Proposal & Negotiation"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {deal.stage}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>Probability</span>
                      <span>{deal.probability}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          deal.probability >= 70
                            ? "bg-green-500"
                            : deal.probability >= 50
                            ? "bg-blue-500"
                            : "bg-amber-500"
                        }`}
                        style={{ width: `${deal.probability}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/dashboard/sales/leads"
          className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-purple-600"
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
              <h3 className="font-semibold text-slate-900">Leads</h3>
              <p className="text-sm text-slate-500">Manage potential clients</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/sales/pipeline"
          className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600"
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
              <h3 className="font-semibold text-slate-900">Pipeline</h3>
              <p className="text-sm text-slate-500">Track deal progress</p>
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/sales/contacts"
          className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Contacts</h3>
              <p className="text-sm text-slate-500">Client directory</p>
            </div>
          </div>
        </Link>
      </div>
    </PageLayout>
  );
}
