"use client";

import React, { useState } from "react";
import Link from "next/link";

type LeadStatus =
  | "New"
  | "Contacted"
  | "Qualified"
  | "Proposal"
  | "Negotiation"
  | "Won"
  | "Lost";
type LeadSource =
  | "Website"
  | "Referral"
  | "Social Media"
  | "Trade Show"
  | "Cold Call"
  | "Partner";

interface Lead {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  projectType: string;
  estimatedBudget: number;
  status: LeadStatus;
  source: LeadSource;
  assignedTo: string;
  createdAt: string;
  lastContact: string;
  notes: string;
}

export default function LeadsPage() {
  const [filterStatus, setFilterStatus] = useState<LeadStatus | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");

  const leads: Lead[] = [
    {
      id: 1,
      name: "Michael & Jennifer Thompson",
      company: "Personal",
      email: "thompson.mj@email.com",
      phone: "+1 (555) 234-5678",
      projectType: "Luxury Penthouse Interior",
      estimatedBudget: 180000,
      status: "New",
      source: "Referral",
      assignedTo: "Sarah Mitchell",
      createdAt: "2025-01-26",
      lastContact: "2025-01-26",
      notes:
        "Referred by the Smiths. Looking for complete penthouse renovation.",
    },
    {
      id: 2,
      name: "Robert Chang",
      company: "Grand Plaza Hotels",
      email: "r.chang@grandplazahotels.com",
      phone: "+1 (555) 876-5432",
      projectType: "Hotel Lobby Redesign",
      estimatedBudget: 320000,
      status: "Proposal",
      source: "Trade Show",
      assignedTo: "David Anderson",
      createdAt: "2025-01-20",
      lastContact: "2025-01-25",
      notes: "Met at Interior Design Expo. Proposal sent, awaiting feedback.",
    },
    {
      id: 3,
      name: "Dr. Amanda Foster",
      company: "HealthFirst Clinics",
      email: "a.foster@healthfirst.com",
      phone: "+1 (555) 345-6789",
      projectType: "Medical Clinic Interior",
      estimatedBudget: 95000,
      status: "Won",
      source: "Website",
      assignedTo: "Sarah Mitchell",
      createdAt: "2025-01-05",
      lastContact: "2025-01-24",
      notes: "Contract signed. Project starts February 1st.",
    },
    {
      id: 4,
      name: "David & Lisa Chen",
      company: "Personal",
      email: "chen.family@email.com",
      phone: "+1 (555) 456-7890",
      projectType: "Modern Farmhouse Renovation",
      estimatedBudget: 145000,
      status: "Contacted",
      source: "Social Media",
      assignedTo: "Emily Parker",
      createdAt: "2025-01-22",
      lastContact: "2025-01-24",
      notes: "Found us on Instagram. Scheduled site visit for next week.",
    },
    {
      id: 5,
      name: "James Morrison",
      company: "TechVentures Inc.",
      email: "j.morrison@techventures.com",
      phone: "+1 (555) 567-8901",
      projectType: "Corporate HQ Redesign",
      estimatedBudget: 450000,
      status: "Negotiation",
      source: "Referral",
      assignedTo: "David Anderson",
      createdAt: "2025-01-10",
      lastContact: "2025-01-26",
      notes: "Negotiating scope. They want to phase the project.",
    },
    {
      id: 6,
      name: "Maria Santos",
      company: "Bella Cucina Restaurant",
      email: "maria@bellacucina.com",
      phone: "+1 (555) 678-9012",
      projectType: "Restaurant Interior Design",
      estimatedBudget: 85000,
      status: "Qualified",
      source: "Website",
      assignedTo: "Emily Parker",
      createdAt: "2025-01-18",
      lastContact: "2025-01-23",
      notes: "Expanding to second location. Needs cohesive brand design.",
    },
    {
      id: 7,
      name: "William & Kate Reynolds",
      company: "Personal",
      email: "reynolds.wk@email.com",
      phone: "+1 (555) 789-0123",
      projectType: "Beach House Renovation",
      estimatedBudget: 220000,
      status: "New",
      source: "Partner",
      assignedTo: "Sarah Mitchell",
      createdAt: "2025-01-25",
      lastContact: "2025-01-25",
      notes: "Referred by coastal architects. High-end beach property.",
    },
    {
      id: 8,
      name: "Alexandra Hughes",
      company: "Fashion Forward Boutique",
      email: "alex@fashionforward.com",
      phone: "+1 (555) 890-1234",
      projectType: "Retail Store Design",
      estimatedBudget: 65000,
      status: "Lost",
      source: "Cold Call",
      assignedTo: "Emily Parker",
      createdAt: "2024-12-15",
      lastContact: "2025-01-10",
      notes: "Went with competitor. Budget constraints.",
    },
  ];

  const filteredLeads = leads.filter((lead) => {
    const matchesStatus =
      filterStatus === "All" || lead.status === filterStatus;
    const matchesSearch =
      searchQuery === "" ||
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.projectType.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const statusColors: Record<LeadStatus, string> = {
    New: "bg-purple-100 text-purple-700",
    Contacted: "bg-blue-100 text-blue-700",
    Qualified: "bg-cyan-100 text-cyan-700",
    Proposal: "bg-amber-100 text-amber-700",
    Negotiation: "bg-orange-100 text-orange-700",
    Won: "bg-green-100 text-green-700",
    Lost: "bg-red-100 text-red-700",
  };

  const sourceColors: Record<LeadSource, string> = {
    Website: "bg-slate-100 text-slate-700",
    Referral: "bg-blue-50 text-blue-700",
    "Social Media": "bg-pink-100 text-pink-700",
    "Trade Show": "bg-purple-50 text-purple-700",
    "Cold Call": "bg-gray-100 text-gray-700",
    Partner: "bg-green-50 text-green-700",
  };

  const statusCounts = {
    All: leads.length,
    New: leads.filter((l) => l.status === "New").length,
    Contacted: leads.filter((l) => l.status === "Contacted").length,
    Qualified: leads.filter((l) => l.status === "Qualified").length,
    Proposal: leads.filter((l) => l.status === "Proposal").length,
    Negotiation: leads.filter((l) => l.status === "Negotiation").length,
    Won: leads.filter((l) => l.status === "Won").length,
    Lost: leads.filter((l) => l.status === "Lost").length,
  };

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
            <span className="text-slate-900">Leads</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Leads Management
          </h1>
          <p className="text-slate-600">
            Track and convert potential design clients
          </p>
        </div>
        <button className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium">
          + Add New Lead
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {(Object.keys(statusCounts) as Array<keyof typeof statusCounts>).map(
          (status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status as LeadStatus | "All")}
              className={`p-4 rounded-lg border transition-all ${
                filterStatus === status
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 bg-white hover:border-blue-300"
              }`}
            >
              <p className="text-2xl font-bold text-slate-900">
                {statusCounts[status]}
              </p>
              <p className="text-xs text-slate-600">{status}</p>
            </button>
          )
        )}
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search leads by name, company, or project..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option>All Sources</option>
              <option>Website</option>
              <option>Referral</option>
              <option>Social Media</option>
              <option>Trade Show</option>
            </select>
            <select className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option>All Assignees</option>
              <option>Sarah Mitchell</option>
              <option>David Anderson</option>
              <option>Emily Parker</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Lead
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Project Type
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Est. Budget
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Assigned To
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Last Contact
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-slate-900">{lead.name}</p>
                      <p className="text-sm text-slate-500">{lead.company}</p>
                      <p className="text-xs text-slate-400">{lead.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-900">{lead.projectType}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">
                      ${lead.estimatedBudget.toLocaleString()}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                        statusColors[lead.status]
                      }`}
                    >
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                        sourceColors[lead.source]
                      }`}
                    >
                      {lead.source}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-900">{lead.assignedTo}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-900">{lead.lastContact}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
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
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      </button>
                      <button className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
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
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                      </button>
                      <button className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
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
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
