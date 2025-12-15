"use client";

import React from "react";

interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string;
  hierarchy_level: number;
  is_default?: boolean;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  status:
    | "active"
    | "invited"
    | "pending_verification"
    | "disabled"
    | "deleted";
  is_super_admin: boolean;
  last_login_at?: string;
  created_at: string;
  roles: Role[];
}

interface EditMemberModalProps {
  isOpen: boolean;
  member: TeamMember | null;
  selectedRoleIds: string[];
  originalRoleIds: string[];
  isSaving: boolean;
  roles: Role[];
  isOwner: boolean;
  onClose: () => void;
  onRoleToggle: (roleId: string) => void;
  onSave: () => void;
  onDelete: (memberId: string, memberName: string) => void;
  onReactivate: (memberId: string, memberName: string) => void;
  onTransferOwnership: (memberId: string, memberName: string) => void;
}

const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const avatarColors = [
  "from-blue-500 to-cyan-500",
  "from-purple-500 to-pink-500",
  "from-green-500 to-emerald-500",
  "from-orange-500 to-red-500",
  "from-indigo-500 to-blue-500",
  "from-cyan-500 to-blue-500",
];

export function EditMemberModal({
  isOpen,
  member,
  selectedRoleIds,
  originalRoleIds,
  isSaving,
  roles,
  isOwner,
  onClose,
  onRoleToggle,
  onSave,
  onDelete,
  onReactivate,
  onTransferOwnership,
}: EditMemberModalProps) {
  if (!isOpen || !member) return null;

  const hasEditChanges =
    JSON.stringify(selectedRoleIds.sort()) !==
    JSON.stringify(originalRoleIds.sort());

  const canDelete = member.status !== "deleted" && !member.is_super_admin;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            Edit Team Member
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage roles for this member
          </p>
        </div>

        <div className="p-5 space-y-5">
          {/* Member Info - Read Only */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
            <div
              className={`w-12 h-12 rounded-full bg-linear-to-br ${avatarColors[0]} flex items-center justify-center text-white font-medium text-sm shrink-0`}
            >
              {getInitials(member.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{member.name}</p>
              <p className="text-sm text-slate-500">{member.email}</p>
            </div>
            {member.is_super_admin && (
              <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                Owner
              </span>
            )}
          </div>

          {/* Roles Section */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Assigned Roles
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Click on roles to toggle them. Active roles are highlighted.
            </p>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => {
                const isSelected = selectedRoleIds.includes(role.id);
                const isOwnerRole = role.slug === "owner";
                const memberIsOwner = member.is_super_admin;

                // Owner role can only be for super_admin users
                if (isOwnerRole && !memberIsOwner) return null;
                // Don't show owner role as editable - it's linked to is_super_admin
                if (isOwnerRole) {
                  return (
                    <span
                      key={role.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-purple-100 text-purple-700 cursor-not-allowed"
                      title="Owner role cannot be changed"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {role.name}
                    </span>
                  );
                }

                return (
                  <button
                    key={role.id}
                    onClick={() => onRoleToggle(role.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                    }`}
                  >
                    {isSelected && (
                      <svg
                        className="w-3.5 h-3.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    {role.name}
                  </button>
                );
              })}
            </div>
            {selectedRoleIds.length === 0 && !member.is_super_admin && (
              <p className="mt-2 text-xs text-amber-600">
                ⚠️ User should have at least one role assigned
              </p>
            )}
          </div>

          {/* Danger Zone / Status Section */}
          {canDelete && (
            <div className="pt-4 border-t border-slate-200">
              <label
                className={`block text-xs font-semibold uppercase tracking-wide mb-3 ${
                  member.status === "disabled"
                    ? "text-slate-500"
                    : "text-red-500"
                }`}
              >
                {member.status === "disabled" ? "Member Status" : "Danger Zone"}
              </label>
              {member.status === "disabled" ? (
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-100 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-green-700">
                      Reactivate User
                    </p>
                    <p className="text-xs text-green-600">
                      Restore access to the system
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onReactivate(member.id, member.name);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-green-700 bg-white border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    Reactivate
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-red-700">
                      Deactivate User
                    </p>
                    <p className="text-xs text-red-600">
                      Remove access to the system
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onDelete(member.id, member.name);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    Deactivate
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Ownership Transfer - Only visible to Owner for active non-owner members */}
          {isOwner &&
            member &&
            !member.is_super_admin &&
            member.status === "active" && (
              <div className="pt-4 border-t border-slate-200">
                <label className="block text-xs font-semibold text-red-600 uppercase tracking-wide mb-3">
                  ⚠️ Critical Action
                </label>
                <div className="p-3 bg-red-50 border-2 border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-red-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-700">
                        Transfer Ownership
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        Make <strong>{member.name}</strong> the new Owner. You
                        will be demoted to Admin and lose ownership privileges.
                        This cannot be undone by you.
                      </p>
                      <button
                        onClick={() => {
                          onClose();
                          onTransferOwnership(member.id, member.name);
                        }}
                        className="mt-3 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Transfer Ownership to {member.name.split(" ")[0]}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isSaving || !hasEditChanges}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              hasEditChanges
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            } disabled:opacity-50`}
          >
            {isSaving ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving...
              </>
            ) : hasEditChanges ? (
              <>
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
                Save Changes
              </>
            ) : (
              "Edit Roles"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
