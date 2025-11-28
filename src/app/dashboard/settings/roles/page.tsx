"use client";

import React, { useState } from "react";
import Link from "next/link";

interface Role {
  id: number;
  name: string;
  description: string;
  members: number;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
}

export default function RolesSettingsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const roles: Role[] = [
    {
      id: 1,
      name: "Owner",
      description: "Full access to all features and settings. Can manage billing and delete the organization.",
      members: 1,
      permissions: ["*"],
      isSystem: true,
      createdAt: "2018-03-15",
    },
    {
      id: 2,
      name: "Admin",
      description: "Can manage team members, settings, and all business operations except billing.",
      members: 2,
      permissions: ["projects.*", "clients.*", "team.manage", "settings.*", "reports.*", "finance.*"],
      isSystem: true,
      createdAt: "2018-03-15",
    },
    {
      id: 3,
      name: "Senior Designer",
      description: "Can manage projects, create quotations, and access client information. Can mentor junior designers.",
      members: 3,
      permissions: ["projects.*", "clients.read", "quotations.*", "documents.*", "library.*", "reports.read"],
      isSystem: false,
      createdAt: "2020-06-01",
    },
    {
      id: 4,
      name: "Designer",
      description: "Can work on assigned projects, create documents, and access the design library.",
      members: 5,
      permissions: ["projects.assigned", "clients.read", "quotations.create", "documents.*", "library.read"],
      isSystem: false,
      createdAt: "2020-06-01",
    },
    {
      id: 5,
      name: "Project Manager",
      description: "Oversees project timelines, manages tasks, and coordinates with clients.",
      members: 2,
      permissions: ["projects.*", "clients.*", "tasks.*", "calendar.*", "reports.projects"],
      isSystem: false,
      createdAt: "2021-02-15",
    },
    {
      id: 6,
      name: "Sales Representative",
      description: "Manages leads, contacts clients, and creates initial proposals.",
      members: 3,
      permissions: ["sales.*", "clients.*", "quotations.create", "calendar.*"],
      isSystem: false,
      createdAt: "2021-11-20",
    },
    {
      id: 7,
      name: "Finance Manager",
      description: "Manages invoices, payments, expenses, and financial reporting.",
      members: 1,
      permissions: ["finance.*", "reports.finance", "clients.billing"],
      isSystem: false,
      createdAt: "2022-01-05",
    },
    {
      id: 8,
      name: "Viewer",
      description: "Read-only access to projects and documents. Ideal for stakeholders.",
      members: 0,
      permissions: ["projects.read", "documents.read", "reports.read"],
      isSystem: true,
      createdAt: "2018-03-15",
    },
  ];

  const permissionCategories = [
    { name: "Projects", permissions: ["projects.read", "projects.create", "projects.edit", "projects.delete", "projects.assigned"] },
    { name: "Clients", permissions: ["clients.read", "clients.create", "clients.edit", "clients.delete", "clients.billing"] },
    { name: "Sales", permissions: ["sales.leads", "sales.pipeline", "sales.contacts"] },
    { name: "Quotations", permissions: ["quotations.read", "quotations.create", "quotations.edit", "quotations.approve"] },
    { name: "Finance", permissions: ["finance.invoices", "finance.payments", "finance.expenses"] },
    { name: "Team", permissions: ["team.read", "team.manage", "team.roles"] },
    { name: "Documents", permissions: ["documents.read", "documents.create", "documents.delete"] },
    { name: "Reports", permissions: ["reports.read", "reports.projects", "reports.finance", "reports.export"] },
    { name: "Settings", permissions: ["settings.read", "settings.edit", "settings.billing"] },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/dashboard/settings" className="hover:text-blue-600">Settings</Link>
            <span>/</span>
            <span className="text-slate-900">Roles & Permissions</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Roles & Permissions</h1>
          <p className="text-slate-600">Define roles and control access to features</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium"
        >
          + Create Role
        </button>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role) => (
          <div
            key={role.id}
            onClick={() => setSelectedRole(role)}
            className={`bg-white rounded-xl border border-slate-200 p-5 cursor-pointer hover:shadow-md transition-all ${selectedRole?.id === role.id ? "ring-2 ring-blue-500" : ""}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900">{role.name}</h3>
                {role.isSystem && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">System</span>
                )}
              </div>
              <span className="text-sm text-slate-500">{role.members} members</span>
            </div>
            <p className="text-sm text-slate-600 mb-4 line-clamp-2">{role.description}</p>
            <div className="flex flex-wrap gap-1">
              {role.permissions.slice(0, 3).map((perm) => (
                <span key={perm} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                  {perm === "*" ? "Full Access" : perm.split(".")[0]}
                </span>
              ))}
              {role.permissions.length > 3 && (
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                  +{role.permissions.length - 3} more
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Role Details */}
      {selectedRole && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{selectedRole.name}</h2>
              <p className="text-slate-600">{selectedRole.description}</p>
            </div>
            {!selectedRole.isSystem && (
              <div className="flex gap-2">
                <button className="px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium">
                  Edit Role
                </button>
                <button className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors font-medium">
                  Delete
                </button>
              </div>
            )}
          </div>

          <h3 className="font-semibold text-slate-900 mb-4">Permissions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {permissionCategories.map((category) => (
              <div key={category.name} className="border border-slate-200 rounded-lg p-4">
                <h4 className="font-medium text-slate-900 mb-3">{category.name}</h4>
                <div className="space-y-2">
                  {category.permissions.map((perm) => {
                    const hasPermission = selectedRole.permissions.includes("*") || 
                      selectedRole.permissions.includes(`${category.name.toLowerCase()}.*`) ||
                      selectedRole.permissions.includes(perm);
                    return (
                      <label key={perm} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={hasPermission}
                          disabled={selectedRole.isSystem}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          readOnly
                        />
                        <span className={`text-sm ${hasPermission ? "text-slate-900" : "text-slate-400"}`}>
                          {perm.split(".")[1]?.charAt(0).toUpperCase() + perm.split(".")[1]?.slice(1) || "All"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Create New Role</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Role Name</label>
                <input
                  type="text"
                  placeholder="e.g., Junior Designer"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Description</label>
                <textarea
                  placeholder="Describe what this role can do..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Base on Existing Role</label>
                <select className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Start from scratch</option>
                  <option value="designer">Designer</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-all duration-200 font-medium"
              >
                Create Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
