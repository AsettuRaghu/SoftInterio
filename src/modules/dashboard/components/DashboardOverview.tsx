"use client";

import React from "react";

export function DashboardOverview() {
  const stats = [
    { title: "Total Projects", value: "24", change: "+12%" },
    { title: "Active Clients", value: "18", change: "+5%" },
    { title: "Revenue (Month)", value: "$45,200", change: "+18%" },
    { title: "Pending Tasks", value: "7", change: "-3%" },
  ];

  const recentProjects = [
    {
      name: "Modern Villa Design",
      client: "John Smith",
      status: "In Progress",
      progress: 75,
    },
    {
      name: "Office Renovation",
      client: "ABC Corp",
      status: "In Progress",
      progress: 25,
    },
    {
      name: "Apartment Makeover",
      client: "Sarah Johnson",
      status: "Completed",
      progress: 100,
    },
    {
      name: "Restaurant Interior",
      client: "Food Co.",
      status: "In Progress",
      progress: 60,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-white rounded-xl border-2 border-blue-200 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Dashboard</h1>
        <p className="text-slate-600 text-base leading-relaxed">
          Welcome back! Here's what's happening with your projects.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all hover:border-blue-300 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  {stat.title}
                </p>
                <p className="text-xl font-bold text-slate-900 mt-1">
                  {stat.value}
                </p>
              </div>
              <div
                className={`text-xs font-medium ${
                  stat.change.startsWith("+")
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {stat.change}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Projects */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-semibold text-slate-900">
            Recent Projects
          </h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {recentProjects.map((project, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-white hover:bg-blue-50/50 rounded-lg transition-all duration-200 border border-slate-200 hover:border-blue-300"
              >
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-900 mb-1">
                    {project.name}
                  </h3>
                  <p className="text-sm text-slate-600">{project.client}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      project.status === "Completed"
                        ? "bg-green-100 text-green-800"
                        : project.status === "In Progress"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {project.status}
                  </span>
                  <div className="w-16 bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-linear-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-700">
                    {project.progress}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Quick Actions
          </h3>
          <div className="space-y-2">
            <button className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors border border-slate-200 hover:border-blue-300">
              + Create New Project
            </button>
            <button className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors border border-slate-200 hover:border-blue-300">
              + Add Client
            </button>
            <button className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors border border-slate-200 hover:border-blue-300">
              + Schedule Meeting
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Upcoming Tasks
          </h3>
          <div className="space-y-3">
            <div className="text-sm p-3 rounded-md bg-slate-50 border-l-3 border-blue-500">
              <p className="font-medium text-slate-900">Client presentation</p>
              <p className="text-slate-600 text-xs mt-1">Tomorrow, 2:00 PM</p>
            </div>
            <div className="text-sm p-3 rounded-md bg-slate-50 border-l-3 border-blue-500">
              <p className="font-medium text-slate-900">Site visit</p>
              <p className="text-slate-600 text-xs mt-1">Friday, 10:00 AM</p>
            </div>
            <div className="text-sm p-3 rounded-md bg-slate-50 border-l-3 border-blue-500">
              <p className="font-medium text-slate-900">Material delivery</p>
              <p className="text-slate-600 text-xs mt-1">
                Next Monday, 9:00 AM
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            System Status
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded-md bg-slate-50">
              <span className="text-sm text-slate-700">System Health</span>
              <span className="text-sm font-semibold text-green-600">
                Excellent
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-slate-50">
              <span className="text-sm text-slate-700">Storage Used</span>
              <span className="text-sm font-semibold text-slate-900">
                24.5 GB
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-slate-50">
              <span className="text-sm text-slate-700">Last Backup</span>
              <span className="text-sm font-semibold text-slate-900">
                2 hours ago
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
