"use client";

import React, { useState } from "react";
import Link from "next/link";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: "Accounting" | "Communication" | "Storage" | "CRM" | "Productivity" | "E-commerce";
  logo: string;
  status: "Connected" | "Available" | "Coming Soon";
  connectedAt?: string;
  lastSync?: string;
}

export default function IntegrationsSettingsPage() {
  const [filterCategory, setFilterCategory] = useState("All");

  const integrations: Integration[] = [
    {
      id: "quickbooks",
      name: "QuickBooks",
      description: "Sync invoices, expenses, and financial data",
      category: "Accounting",
      logo: "QB",
      status: "Connected",
      connectedAt: "Nov 15, 2024",
      lastSync: "5 minutes ago",
    },
    {
      id: "xero",
      name: "Xero",
      description: "Cloud-based accounting software integration",
      category: "Accounting",
      logo: "XE",
      status: "Available",
    },
    {
      id: "slack",
      name: "Slack",
      description: "Get notifications and updates in Slack channels",
      category: "Communication",
      logo: "SL",
      status: "Connected",
      connectedAt: "Sep 1, 2024",
      lastSync: "Just now",
    },
    {
      id: "google-drive",
      name: "Google Drive",
      description: "Store and sync project files with Google Drive",
      category: "Storage",
      logo: "GD",
      status: "Connected",
      connectedAt: "Oct 10, 2024",
      lastSync: "2 hours ago",
    },
    {
      id: "dropbox",
      name: "Dropbox",
      description: "Cloud storage integration for documents",
      category: "Storage",
      logo: "DB",
      status: "Available",
    },
    {
      id: "hubspot",
      name: "HubSpot",
      description: "Sync contacts and deals with HubSpot CRM",
      category: "CRM",
      logo: "HS",
      status: "Available",
    },
    {
      id: "salesforce",
      name: "Salesforce",
      description: "Enterprise CRM integration",
      category: "CRM",
      logo: "SF",
      status: "Available",
    },
    {
      id: "zoom",
      name: "Zoom",
      description: "Schedule and join meetings from projects",
      category: "Communication",
      logo: "ZM",
      status: "Available",
    },
    {
      id: "google-calendar",
      name: "Google Calendar",
      description: "Sync tasks and meetings with Google Calendar",
      category: "Productivity",
      logo: "GC",
      status: "Connected",
      connectedAt: "Aug 20, 2024",
      lastSync: "1 hour ago",
    },
    {
      id: "microsoft-365",
      name: "Microsoft 365",
      description: "Integrate with Outlook, Teams, and OneDrive",
      category: "Productivity",
      logo: "MS",
      status: "Available",
    },
    {
      id: "stripe",
      name: "Stripe",
      description: "Accept online payments for invoices",
      category: "E-commerce",
      logo: "ST",
      status: "Connected",
      connectedAt: "Jan 5, 2025",
      lastSync: "30 minutes ago",
    },
    {
      id: "shopify",
      name: "Shopify",
      description: "E-commerce integration for retail projects",
      category: "E-commerce",
      logo: "SH",
      status: "Coming Soon",
    },
  ];

  const filteredIntegrations = integrations.filter(integration => 
    filterCategory === "All" || integration.category === filterCategory
  );

  const logoColors: Record<string, string> = {
    "QB": "from-green-500 to-green-600",
    "XE": "from-blue-400 to-blue-500",
    "SL": "from-purple-500 to-pink-500",
    "GD": "from-yellow-400 to-green-500",
    "DB": "from-blue-500 to-blue-600",
    "HS": "from-orange-500 to-orange-600",
    "SF": "from-blue-500 to-cyan-500",
    "ZM": "from-blue-400 to-blue-600",
    "GC": "from-blue-500 to-red-500",
    "MS": "from-orange-500 to-blue-500",
    "ST": "from-purple-500 to-purple-600",
    "SH": "from-green-500 to-green-600",
  };

  const stats = {
    total: integrations.length,
    connected: integrations.filter(i => i.status === "Connected").length,
    available: integrations.filter(i => i.status === "Available").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/dashboard/settings" className="hover:text-blue-600">Settings</Link>
            <span>/</span>
            <span className="text-slate-900">Integrations</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Integrations</h1>
          <p className="text-slate-600">Connect your favorite tools and services</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-sm text-slate-600">Available Integrations</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-green-600">{stats.connected}</p>
          <p className="text-sm text-slate-600">Connected</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-blue-600">{stats.available}</p>
          <p className="text-sm text-slate-600">Ready to Connect</p>
        </div>
      </div>

      {/* Connected Integrations */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Connected Integrations</h2>
        <div className="space-y-4">
          {integrations.filter(i => i.status === "Connected").map((integration) => (
            <div key={integration.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-linear-to-br ${logoColors[integration.logo]} flex items-center justify-center text-white font-bold text-sm`}>
                  {integration.logo}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{integration.name}</p>
                  <p className="text-sm text-slate-500">{integration.description}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                    <span>Connected: {integration.connectedAt}</span>
                    <span>•</span>
                    <span>Last sync: {integration.lastSync}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
                  Settings
                </button>
                <button className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                  Disconnect
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {["All", "Accounting", "Communication", "Storage", "CRM", "Productivity", "E-commerce"].map((category) => (
          <button
            key={category}
            onClick={() => setFilterCategory(category)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              filterCategory === category
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Available Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredIntegrations.filter(i => i.status !== "Connected").map((integration) => (
          <div key={integration.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-12 h-12 rounded-xl bg-linear-to-br ${logoColors[integration.logo]} flex items-center justify-center text-white font-bold text-sm`}>
                {integration.logo}
              </div>
              {integration.status === "Coming Soon" && (
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Coming Soon</span>
              )}
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">{integration.name}</h3>
            <p className="text-sm text-slate-600 mb-4">{integration.description}</p>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{integration.category}</span>
            <div className="mt-4">
              {integration.status === "Available" ? (
                <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  Connect
                </button>
              ) : (
                <button className="w-full py-2 bg-slate-100 text-slate-400 rounded-lg cursor-not-allowed font-medium" disabled>
                  Coming Soon
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* API Access */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">API Access</h2>
            <p className="text-sm text-slate-600">Build custom integrations with our REST API</p>
          </div>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Enabled</span>
        </div>
        <div className="mt-4 p-4 bg-slate-900 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 mb-1">API Key</p>
              <code className="text-sm text-green-400">sk_live_••••••••••••••••••••1234</code>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-800 transition-colors">
                Show
              </button>
              <button className="px-3 py-1.5 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-800 transition-colors">
                Copy
              </button>
              <button className="px-3 py-1.5 text-sm text-red-400 border border-red-700 rounded-lg hover:bg-red-900/50 transition-colors">
                Regenerate
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <a href="#" className="text-blue-600 text-sm font-medium hover:text-blue-700">View API Documentation →</a>
          <a href="#" className="text-blue-600 text-sm font-medium hover:text-blue-700">Webhook Settings →</a>
        </div>
      </div>
    </div>
  );
}
