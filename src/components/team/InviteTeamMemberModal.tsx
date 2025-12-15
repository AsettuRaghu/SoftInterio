"use client";

import React from "react";
import { Alert } from "@/components/ui/Alert";

interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string;
  hierarchy_level: number;
  is_default?: boolean;
}

interface InviteTeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteForm: {
    firstName: string;
    lastName: string;
    email: string;
    roleIds: string[];
    password: string;
  };
  onFormChange: (
    updates: Partial<InviteTeamMemberModalProps["inviteForm"]>
  ) => void;
  roles: Role[];
  modalError: string | null;
  isSending: boolean;
  onSubmit: () => void;
}

export function InviteTeamMemberModal({
  isOpen,
  onClose,
  inviteForm,
  onFormChange,
  roles,
  modalError,
  isSending,
  onSubmit,
}: InviteTeamMemberModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            Invite Team Member
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Send an invitation to join your organization
          </p>
        </div>

        <div className="p-5 space-y-4">
          {modalError && <Alert variant="error" message={modalError} />}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                First Name *
              </label>
              <input
                type="text"
                value={inviteForm.firstName}
                onChange={(e) => onFormChange({ firstName: e.target.value })}
                placeholder="Enter first name"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                value={inviteForm.lastName}
                onChange={(e) => onFormChange({ lastName: e.target.value })}
                placeholder="Enter last name"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={inviteForm.email}
              onChange={(e) => onFormChange({ email: e.target.value })}
              placeholder="name@company.com"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password *
            </label>
            <input
              type="text"
              value={inviteForm.password}
              onChange={(e) => onFormChange({ password: e.target.value })}
              placeholder="Set a password (min 8 characters)"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              minLength={8}
            />
            <p className="text-xs text-slate-500 mt-1">
              You'll share this password with the user after they're added.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Roles & Permissions *
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Select one or more roles. Multiple roles combine their
              permissions.
            </p>
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {roles.map((role) => {
                const isSelected = inviteForm.roleIds.includes(role.id);
                return (
                  <label
                    key={role.id}
                    className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-slate-50 transition-colors ${
                      isSelected ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onFormChange({
                            roleIds: [...inviteForm.roleIds, role.id],
                          });
                        } else {
                          onFormChange({
                            roleIds: inviteForm.roleIds.filter(
                              (id) => id !== role.id
                            ),
                          });
                        }
                      }}
                      className="mt-0.5 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">
                          {role.name}
                        </span>
                        <span className="text-xs text-slate-400">
                          Level {role.hierarchy_level}
                        </span>
                      </div>
                      {role.description && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {role.description}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
            {inviteForm.roleIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {inviteForm.roleIds.map((roleId) => {
                  const role = roles.find((r) => r.id === roleId);
                  if (!role) return null;
                  return (
                    <span
                      key={roleId}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full"
                    >
                      {role.name}
                      <button
                        type="button"
                        onClick={() =>
                          onFormChange({
                            roleIds: inviteForm.roleIds.filter(
                              (id) => id !== roleId
                            ),
                          })
                        }
                        className="hover:text-blue-900"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2.5 p-3 bg-blue-50 rounded-lg">
            <svg
              className="w-4 h-4 text-blue-600 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="text-xs text-blue-700">
              <p className="font-medium">What happens next?</p>
              <p className="text-blue-600 mt-0.5">
                The user account will be created immediately. You'll receive the
                login credentials to share with them.
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSending}
            className="flex-1 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isSending}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSending ? (
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
                Adding...
              </>
            ) : (
              <>
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Team Member
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
