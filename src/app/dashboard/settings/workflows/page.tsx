"use client";

import React, { useState } from "react";
import Link from "next/link";

interface Workflow {
  id: number;
  name: string;
  description: string;
  trigger: string;
  status: "Active" | "Inactive" | "Draft";
  steps: number;
  lastRun?: string;
  runsThisMonth: number;
}

export default function WorkflowsSettingsPage() {
  const [filterStatus, setFilterStatus] = useState("All");

  const workflows: Workflow[] = [
    {
      id: 1,
      name: "New Lead Notification",
      description: "Send email notification to sales team when a new lead is created",
      trigger: "Lead Created",
      status: "Active",
      steps: 3,
      lastRun: "2 hours ago",
      runsThisMonth: 45,
    },
    {
      id: 2,
      name: "Project Status Update",
      description: "Notify client via email when project status changes",
      trigger: "Project Status Changed",
      status: "Active",
      steps: 4,
      lastRun: "30 minutes ago",
      runsThisMonth: 128,
    },
    {
      id: 3,
      name: "Invoice Reminder",
      description: "Send reminder email 7 days before invoice due date",
      trigger: "Schedule (Daily)",
      status: "Active",
      steps: 5,
      lastRun: "Yesterday",
      runsThisMonth: 23,
    },
    {
      id: 4,
      name: "Task Overdue Alert",
      description: "Notify assignee and project manager when task is overdue",
      trigger: "Task Overdue",
      status: "Active",
      steps: 4,
      lastRun: "3 hours ago",
      runsThisMonth: 67,
    },
    {
      id: 5,
      name: "Welcome Email Sequence",
      description: "Send onboarding emails to new clients",
      trigger: "Client Created",
      status: "Active",
      steps: 6,
      lastRun: "1 day ago",
      runsThisMonth: 12,
    },
    {
      id: 6,
      name: "Quotation Approval Request",
      description: "Request approval from manager for quotations above $50,000",
      trigger: "Quotation Created",
      status: "Active",
      steps: 5,
      lastRun: "4 hours ago",
      runsThisMonth: 8,
    },
    {
      id: 7,
      name: "Low Stock Alert",
      description: "Notify procurement when inventory items fall below threshold",
      trigger: "Inventory Low",
      status: "Inactive",
      steps: 3,
      lastRun: "1 week ago",
      runsThisMonth: 0,
    },
    {
      id: 8,
      name: "Project Completion Feedback",
      description: "Send feedback request to client after project completion",
      trigger: "Project Completed",
      status: "Draft",
      steps: 4,
      runsThisMonth: 0,
    },
  ];

  const filteredWorkflows = workflows.filter(workflow => 
    filterStatus === "All" || workflow.status === filterStatus
  );

  const statusColors: Record<string, string> = {
    "Active": "bg-green-100 text-green-700",
    "Inactive": "bg-slate-100 text-slate-700",
    "Draft": "bg-amber-100 text-amber-700",
  };

  const stats = {
    total: workflows.length,
    active: workflows.filter(w => w.status === "Active").length,
    totalRuns: workflows.reduce((sum, w) => sum + w.runsThisMonth, 0),
    avgSteps: Math.round(workflows.reduce((sum, w) => sum + w.steps, 0) / workflows.length),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/dashboard/settings" className="hover:text-blue-600">Settings</Link>
            <span>/</span>
            <span className="text-slate-900">Workflows</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Workflows</h1>
          <p className="text-slate-600">Automate tasks and notifications</p>
        </div>
        <button className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium">
          + Create Workflow
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-sm text-slate-600">Total Workflows</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          <p className="text-sm text-slate-600">Active</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-blue-600">{stats.totalRuns}</p>
          <p className="text-sm text-slate-600">Runs This Month</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-purple-600">{stats.avgSteps}</p>
          <p className="text-sm text-slate-600">Avg. Steps</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {["All", "Active", "Inactive", "Draft"].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              filterStatus === status
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Workflows List */}
      <div className="space-y-4">
        {filteredWorkflows.map((workflow) => (
          <div key={workflow.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-slate-900">{workflow.name}</h3>
                  <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${statusColors[workflow.status]}`}>
                    {workflow.status}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-3">{workflow.description}</p>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Trigger: {workflow.trigger}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span>{workflow.steps} steps</span>
                  </div>
                  {workflow.lastRun && (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Last run: {workflow.lastRun}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-blue-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>{workflow.runsThisMonth} runs this month</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                {workflow.status === "Active" ? (
                  <button className="px-3 py-1.5 text-sm text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors">
                    Pause
                  </button>
                ) : workflow.status === "Inactive" ? (
                  <button className="px-3 py-1.5 text-sm text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition-colors">
                    Activate
                  </button>
                ) : (
                  <button className="px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
                    Publish
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Workflow Templates */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Workflow Templates</h2>
        <p className="text-sm text-slate-600 mb-4">Get started quickly with pre-built workflow templates</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-dashed border-slate-300 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-all">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h4 className="font-medium text-slate-900 mb-1">Client Onboarding</h4>
            <p className="text-xs text-slate-500">Welcome emails and setup tasks</p>
          </div>
          <div className="border border-dashed border-slate-300 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-all">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h4 className="font-medium text-slate-900 mb-1">Approval Chain</h4>
            <p className="text-xs text-slate-500">Multi-level approval workflows</p>
          </div>
          <div className="border border-dashed border-slate-300 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-all">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h4 className="font-medium text-slate-900 mb-1">Reminder Sequence</h4>
            <p className="text-xs text-slate-500">Scheduled follow-up reminders</p>
          </div>
        </div>
      </div>
    </div>
  );
}
