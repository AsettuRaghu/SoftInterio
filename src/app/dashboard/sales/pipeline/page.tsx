"use client";

import React, { useState } from "react";
import Link from "next/link";

interface Deal {
  id: number;
  name: string;
  client: string;
  value: number;
  stage: string;
  probability: number;
  assignedTo: string;
  expectedClose: string;
  lastActivity: string;
  projectType: string;
}

export default function PipelinePage() {
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  const stages = [
    {
      id: "discovery",
      name: "Discovery",
      color: "bg-slate-100 border-slate-300",
    },
    {
      id: "qualification",
      name: "Qualification",
      color: "bg-blue-50 border-blue-300",
    },
    {
      id: "proposal",
      name: "Proposal & Negotiation",
      color: "bg-orange-50 border-orange-300",
    },
    {
      id: "closed-won",
      name: "Closed Won",
      color: "bg-green-50 border-green-300",
    },
    {
      id: "closed-lost",
      name: "Closed Lost",
      color: "bg-red-50 border-red-300",
    },
  ];

  const deals: Deal[] = [
    // Discovery
    {
      id: 1,
      name: "Beach House Renovation",
      client: "William & Kate Reynolds",
      value: 220000,
      stage: "discovery",
      probability: 20,
      assignedTo: "Sarah Mitchell",
      expectedClose: "2025-04-15",
      lastActivity: "Initial consultation scheduled",
      projectType: "Residential",
    },
    {
      id: 2,
      name: "Art Gallery Space",
      client: "Modern Arts Foundation",
      value: 175000,
      stage: "discovery",
      probability: 25,
      assignedTo: "Emily Parker",
      expectedClose: "2025-05-01",
      lastActivity: "Site visit completed",
      projectType: "Commercial",
    },
    // Qualification
    {
      id: 3,
      name: "Restaurant Chain Refresh",
      client: "Gourmet Group",
      value: 275000,
      stage: "qualification",
      probability: 40,
      assignedTo: "David Anderson",
      expectedClose: "2025-03-30",
      lastActivity: "Requirements gathering",
      projectType: "Hospitality",
    },
    {
      id: 4,
      name: "Modern Farmhouse",
      client: "David & Lisa Chen",
      value: 145000,
      stage: "qualification",
      probability: 45,
      assignedTo: "Emily Parker",
      expectedClose: "2025-03-15",
      lastActivity: "Design brief approved",
      projectType: "Residential",
    },
    // Proposal
    {
      id: 5,
      name: "Hotel Lobby Redesign",
      client: "Grand Plaza Hotels",
      value: 320000,
      stage: "proposal",
      probability: 55,
      assignedTo: "David Anderson",
      expectedClose: "2025-02-28",
      lastActivity: "Proposal sent, awaiting response",
      projectType: "Hospitality",
    },
    {
      id: 6,
      name: "Luxury Resort Villas",
      client: "Paradise Resorts",
      value: 380000,
      stage: "proposal",
      probability: 60,
      assignedTo: "Sarah Mitchell",
      expectedClose: "2025-03-10",
      lastActivity: "Presentation scheduled",
      projectType: "Hospitality",
    },
    {
      id: 7,
      name: "Wellness Spa Center",
      client: "Tranquil Wellness LLC",
      value: 195000,
      stage: "proposal",
      probability: 50,
      assignedTo: "Emily Parker",
      expectedClose: "2025-02-25",
      lastActivity: "Design concepts under review",
      projectType: "Commercial",
    },
    // Proposal & Negotiation (additional)
    {
      id: 8,
      name: "Corporate HQ Redesign",
      client: "TechVentures Inc.",
      value: 450000,
      stage: "proposal",
      probability: 75,
      assignedTo: "David Anderson",
      expectedClose: "2025-02-15",
      lastActivity: "Final pricing discussion",
      projectType: "Commercial",
    },
    {
      id: 9,
      name: "Boutique Hotel Suites",
      client: "Urban Oasis Hotels",
      value: 285000,
      stage: "proposal",
      probability: 80,
      assignedTo: "Sarah Mitchell",
      expectedClose: "2025-02-10",
      lastActivity: "Contract review in progress",
      projectType: "Hospitality",
    },
    // Closed Won
    {
      id: 10,
      name: "Medical Clinic Interior",
      client: "HealthFirst Clinics",
      value: 95000,
      stage: "closed-won",
      probability: 100,
      assignedTo: "Sarah Mitchell",
      expectedClose: "2025-01-24",
      lastActivity: "Contract signed",
      projectType: "Healthcare",
    },
    {
      id: 11,
      name: "Executive Penthouse",
      client: "Marcus & Elena Rodriguez",
      value: 340000,
      stage: "closed-won",
      probability: 100,
      assignedTo: "David Anderson",
      expectedClose: "2025-01-20",
      lastActivity: "Project kickoff completed",
      projectType: "Residential",
    },
    // Closed Lost
    {
      id: 12,
      name: "Fashion Boutique",
      client: "Fashion Forward Boutique",
      value: 65000,
      stage: "closed-lost",
      probability: 0,
      assignedTo: "Emily Parker",
      expectedClose: "2025-01-10",
      lastActivity: "Lost to competitor",
      projectType: "Retail",
    },
  ];

  const getDealsForStage = (stageId: string) =>
    deals.filter((d) => d.stage === stageId);
  const getStageValue = (stageId: string) =>
    getDealsForStage(stageId).reduce((sum, d) => sum + d.value, 0);
  const totalPipelineValue = stages
    .slice(0, 4)
    .reduce((sum, stage) => sum + getStageValue(stage.id), 0);
  const weightedValue = deals
    .filter((d) => !d.stage.includes("closed"))
    .reduce((sum, d) => sum + (d.value * d.probability) / 100, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/dashboard/sales" className="hover:text-blue-600">
              Sales
            </Link>
            <span>/</span>
            <span className="text-slate-900">Pipeline</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Sales Pipeline
          </h1>
          <p className="text-slate-600">
            Visualize and manage your deal pipeline
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === "kanban"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Board
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === "list"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              List
            </button>
          </div>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            + Add Deal
          </button>
        </div>
      </div>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600">Total Pipeline</p>
          <p className="text-2xl font-bold text-slate-900">
            ${(totalPipelineValue / 1000000).toFixed(2)}M
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {deals.filter((d) => !d.stage.includes("closed")).length} active
            deals
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600">Weighted Value</p>
          <p className="text-2xl font-bold text-green-600">
            ${(weightedValue / 1000).toFixed(0)}K
          </p>
          <p className="text-xs text-slate-500 mt-1">Expected revenue</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600">Won This Month</p>
          <p className="text-2xl font-bold text-blue-600">
            ${(getStageValue("closed-won") / 1000).toFixed(0)}K
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {getDealsForStage("closed-won").length} deals closed
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-600">Avg. Deal Size</p>
          <p className="text-2xl font-bold text-purple-600">
            $
            {(
              totalPipelineValue /
              deals.filter((d) => !d.stage.includes("closed")).length /
              1000
            ).toFixed(0)}
            K
          </p>
          <p className="text-xs text-slate-500 mt-1">All active deals</p>
        </div>
      </div>

      {viewMode === "kanban" ? (
        /* Kanban Board View */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <div key={stage.id} className="shrink-0 w-80">
              <div
                className={`rounded-xl border-2 ${stage.color} overflow-hidden`}
              >
                {/* Stage Header */}
                <div className="p-4 bg-white/50 backdrop-blur border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">
                      {stage.name}
                    </h3>
                    <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium bg-white rounded-full shadow-sm">
                      {getDealsForStage(stage.id).length}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    ${(getStageValue(stage.id) / 1000).toFixed(0)}K
                  </p>
                </div>

                {/* Deals */}
                <div className="p-3 space-y-3 min-h-[200px] bg-white/30">
                  {getDealsForStage(stage.id).map((deal) => (
                    <div
                      key={deal.id}
                      className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-slate-900 text-sm">
                          {deal.name}
                        </h4>
                        <span className="text-xs font-medium text-slate-500">
                          {deal.probability}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">
                        {deal.client}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">
                          ${(deal.value / 1000).toFixed(0)}K
                        </span>
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                            deal.projectType === "Residential"
                              ? "bg-blue-100 text-blue-700"
                              : deal.projectType === "Commercial"
                              ? "bg-purple-100 text-purple-700"
                              : deal.projectType === "Hospitality"
                              ? "bg-amber-100 text-amber-700"
                              : deal.projectType === "Healthcare"
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {deal.projectType}
                        </span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <div className="w-5 h-5 bg-slate-200 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">
                              {deal.assignedTo
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </div>
                            <span className="text-xs text-slate-500">
                              {deal.assignedTo.split(" ")[0]}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400">
                            {deal.expectedClose}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">
                    Deal
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">
                    Value
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">
                    Stage
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">
                    Probability
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">
                    Owner
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">
                    Close Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deals
                  .filter((d) => !d.stage.includes("closed"))
                  .map((deal) => (
                    <tr
                      key={deal.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">
                          {deal.name}
                        </p>
                        <p className="text-sm text-slate-500">{deal.client}</p>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        ${deal.value.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            deal.stage === "discovery"
                              ? "bg-slate-100 text-slate-700"
                              : deal.stage === "qualification"
                              ? "bg-blue-100 text-blue-700"
                              : deal.stage === "proposal"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {stages.find((s) => s.id === deal.stage)?.name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                deal.probability >= 70
                                  ? "bg-green-500"
                                  : deal.probability >= 50
                                  ? "bg-amber-500"
                                  : "bg-slate-400"
                              }`}
                              style={{ width: `${deal.probability}%` }}
                            />
                          </div>
                          <span className="text-sm text-slate-600">
                            {deal.probability}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">
                          {deal.projectType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {deal.assignedTo}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {deal.expectedClose}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
