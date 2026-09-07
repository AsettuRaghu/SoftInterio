"use client";

import React from "react";
import Link from "next/link";
import {
  ChartBarIcon,
  ClockIcon,
  CurrencyRupeeIcon,
  UserGroupIcon,
  DocumentChartBarIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";

const reportCards = [
  {
    title: "Project Status Summary",
    description:
      "Overview of all projects by status (planning, in-progress, completed, on-hold)",
    icon: ChartBarIcon,
    href: "/dashboard/projects/reports/status",
    color: "bg-blue-50 text-blue-600",
    comingSoon: true,
  },
  {
    title: "Phase Progress Report",
    description:
      "Detailed breakdown of phase completion across all active projects",
    icon: ArrowTrendingUpIcon,
    href: "/dashboard/projects/reports/phases",
    color: "bg-emerald-50 text-emerald-600",
    comingSoon: true,
  },
  {
    title: "Timeline Analysis",
    description:
      "Projects on track vs delayed, with timeline variance analysis",
    icon: ClockIcon,
    href: "/dashboard/projects/reports/timeline",
    color: "bg-amber-50 text-amber-600",
    comingSoon: true,
  },
  {
    title: "Budget vs Actual",
    description:
      "Financial performance comparing quoted amounts to actual costs",
    icon: CurrencyRupeeIcon,
    href: "/dashboard/projects/reports/budget",
    color: "bg-purple-50 text-purple-600",
    comingSoon: true,
  },
  {
    title: "Team Workload",
    description:
      "Project distribution across team members and workload analysis",
    icon: UserGroupIcon,
    href: "/dashboard/projects/reports/workload",
    color: "bg-pink-50 text-pink-600",
    comingSoon: true,
  },
  {
    title: "Lead Conversion",
    description: "Track lead-to-project conversion rates and success metrics",
    icon: DocumentChartBarIcon,
    href: "/dashboard/projects/reports/conversion",
    color: "bg-cyan-50 text-cyan-600",
    comingSoon: true,
  },
];

export default function ProjectReportsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Project Reports
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Analytics and insights for your interior design projects
        </p>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportCards.map((report) => (
          <div
            key={report.title}
            className="relative bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
          >
            {report.comingSoon && (
              <span className="absolute top-3 right-3 px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500 rounded-full">
                Coming Soon
              </span>
            )}
            <div
              className={`w-10 h-10 rounded-lg ${report.color} flex items-center justify-center mb-4`}
            >
              <report.icon className="h-5 w-5" />
            </div>
            <h3 className="font-medium text-slate-900 mb-1">{report.title}</h3>
            <p className="text-sm text-slate-500">{report.description}</p>
          </div>
        ))}
      </div>

      {/* Quick Stats Placeholder */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-medium text-slate-900 mb-4">
          Quick Insights
        </h2>
        <div className="text-center py-12 text-slate-500">
          <DocumentChartBarIcon className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p>Detailed project analytics coming soon</p>
          <p className="text-sm mt-1">
            Track performance, timelines, and budgets across all projects
          </p>
        </div>
      </div>
    </div>
  );
}
