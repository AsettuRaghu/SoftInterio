"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function PreferencesSettingsPage() {
  const [preferences, setPreferences] = useState({
    // Notifications
    emailNewLead: true,
    emailProjectUpdate: true,
    emailTaskAssigned: true,
    emailInvoicePaid: true,
    emailWeeklyReport: true,
    pushNotifications: true,
    desktopNotifications: false,
    
    // Appearance
    theme: "light",
    sidebarCollapsed: false,
    compactMode: false,
    
    // Regional
    language: "en",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12h",
    currency: "USD",
    firstDayOfWeek: "sunday",
    
    // Dashboard
    showRevenue: true,
    showProjectStats: true,
    showRecentActivity: true,
    showUpcomingTasks: true,
    defaultView: "overview",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/dashboard/settings" className="hover:text-blue-600">Settings</Link>
            <span>/</span>
            <span className="text-slate-900">Preferences</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Preferences</h1>
          <p className="text-slate-600">Customize your experience</p>
        </div>
        <button className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium">
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notifications */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Notifications</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">New Lead Alert</p>
                <p className="text-sm text-slate-500">Get notified when a new lead is created</p>
              </div>
              <button
                onClick={() => setPreferences({ ...preferences, emailNewLead: !preferences.emailNewLead })}
                className={`relative w-12 h-6 rounded-full transition-colors ${preferences.emailNewLead ? "bg-blue-600" : "bg-slate-200"}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${preferences.emailNewLead ? "translate-x-6" : ""}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Project Updates</p>
                <p className="text-sm text-slate-500">Notify when project status changes</p>
              </div>
              <button
                onClick={() => setPreferences({ ...preferences, emailProjectUpdate: !preferences.emailProjectUpdate })}
                className={`relative w-12 h-6 rounded-full transition-colors ${preferences.emailProjectUpdate ? "bg-blue-600" : "bg-slate-200"}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${preferences.emailProjectUpdate ? "translate-x-6" : ""}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Task Assignments</p>
                <p className="text-sm text-slate-500">Notify when a task is assigned to you</p>
              </div>
              <button
                onClick={() => setPreferences({ ...preferences, emailTaskAssigned: !preferences.emailTaskAssigned })}
                className={`relative w-12 h-6 rounded-full transition-colors ${preferences.emailTaskAssigned ? "bg-blue-600" : "bg-slate-200"}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${preferences.emailTaskAssigned ? "translate-x-6" : ""}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Invoice Payments</p>
                <p className="text-sm text-slate-500">Notify when an invoice is paid</p>
              </div>
              <button
                onClick={() => setPreferences({ ...preferences, emailInvoicePaid: !preferences.emailInvoicePaid })}
                className={`relative w-12 h-6 rounded-full transition-colors ${preferences.emailInvoicePaid ? "bg-blue-600" : "bg-slate-200"}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${preferences.emailInvoicePaid ? "translate-x-6" : ""}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Weekly Report</p>
                <p className="text-sm text-slate-500">Receive weekly summary email</p>
              </div>
              <button
                onClick={() => setPreferences({ ...preferences, emailWeeklyReport: !preferences.emailWeeklyReport })}
                className={`relative w-12 h-6 rounded-full transition-colors ${preferences.emailWeeklyReport ? "bg-blue-600" : "bg-slate-200"}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${preferences.emailWeeklyReport ? "translate-x-6" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Appearance</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Theme</label>
              <div className="grid grid-cols-3 gap-3">
                {["light", "dark", "system"].map((theme) => (
                  <button
                    key={theme}
                    onClick={() => setPreferences({ ...preferences, theme })}
                    className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                      preferences.theme === theme
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Compact Mode</p>
                <p className="text-sm text-slate-500">Reduce padding and spacing</p>
              </div>
              <button
                onClick={() => setPreferences({ ...preferences, compactMode: !preferences.compactMode })}
                className={`relative w-12 h-6 rounded-full transition-colors ${preferences.compactMode ? "bg-blue-600" : "bg-slate-200"}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${preferences.compactMode ? "translate-x-6" : ""}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Collapsed Sidebar</p>
                <p className="text-sm text-slate-500">Show icons only in sidebar</p>
              </div>
              <button
                onClick={() => setPreferences({ ...preferences, sidebarCollapsed: !preferences.sidebarCollapsed })}
                className={`relative w-12 h-6 rounded-full transition-colors ${preferences.sidebarCollapsed ? "bg-blue-600" : "bg-slate-200"}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${preferences.sidebarCollapsed ? "translate-x-6" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Regional */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Regional Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Language</label>
              <select
                value={preferences.language}
                onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="en">English (US)</option>
                <option value="en-gb">English (UK)</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Date Format</label>
              <select
                value={preferences.dateFormat}
                onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Time Format</label>
              <select
                value={preferences.timeFormat}
                onChange={(e) => setPreferences({ ...preferences, timeFormat: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="12h">12-hour (AM/PM)</option>
                <option value="24h">24-hour</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Currency</label>
              <select
                value={preferences.currency}
                onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
                <option value="AUD">AUD ($)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Dashboard */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Dashboard Widgets</h2>
          <p className="text-sm text-slate-600 mb-4">Choose what to display on your dashboard</p>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Revenue Overview</p>
                <p className="text-sm text-slate-500">Show revenue charts and metrics</p>
              </div>
              <button
                onClick={() => setPreferences({ ...preferences, showRevenue: !preferences.showRevenue })}
                className={`relative w-12 h-6 rounded-full transition-colors ${preferences.showRevenue ? "bg-blue-600" : "bg-slate-200"}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${preferences.showRevenue ? "translate-x-6" : ""}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Project Statistics</p>
                <p className="text-sm text-slate-500">Show active and completed projects</p>
              </div>
              <button
                onClick={() => setPreferences({ ...preferences, showProjectStats: !preferences.showProjectStats })}
                className={`relative w-12 h-6 rounded-full transition-colors ${preferences.showProjectStats ? "bg-blue-600" : "bg-slate-200"}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${preferences.showProjectStats ? "translate-x-6" : ""}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Recent Activity</p>
                <p className="text-sm text-slate-500">Show recent team activity feed</p>
              </div>
              <button
                onClick={() => setPreferences({ ...preferences, showRecentActivity: !preferences.showRecentActivity })}
                className={`relative w-12 h-6 rounded-full transition-colors ${preferences.showRecentActivity ? "bg-blue-600" : "bg-slate-200"}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${preferences.showRecentActivity ? "translate-x-6" : ""}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Upcoming Tasks</p>
                <p className="text-sm text-slate-500">Show tasks due this week</p>
              </div>
              <button
                onClick={() => setPreferences({ ...preferences, showUpcomingTasks: !preferences.showUpcomingTasks })}
                className={`relative w-12 h-6 rounded-full transition-colors ${preferences.showUpcomingTasks ? "bg-blue-600" : "bg-slate-200"}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${preferences.showUpcomingTasks ? "translate-x-6" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
