"use client";

import React, { useState } from "react";

interface PasswordResetModalProps {
  isOpen: boolean;
  memberName: string;
  memberEmail: string;
  temporaryPassword: string;
  onClose: () => void;
}

export function PasswordResetModal({
  isOpen,
  memberName,
  memberEmail,
  temporaryPassword,
  onClose,
}: PasswordResetModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyAll = () => {
    const credentials = `Email: ${memberEmail}\nTemporary Password: ${temporaryPassword}`;
    navigator.clipboard.writeText(credentials);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Password Reset
              </h2>
              <p className="text-sm text-slate-500">
                {memberName}'s password has been reset
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-900 mb-2">
              Share these credentials with {memberName}:
            </p>
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Email
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-blue-200 rounded px-2 py-1.5 text-xs font-mono text-slate-900 break-all">
                    {memberEmail}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(memberEmail);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                    title="Copy email"
                  >
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
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Temporary Password
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-blue-200 rounded px-2 py-1.5 text-xs font-mono text-slate-900 break-all">
                    {temporaryPassword}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(temporaryPassword);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                    title="Copy password"
                  >
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
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-900">
              ⚠️ Important Reminder
            </p>
            <p className="text-xs text-amber-800 mt-1">
              They should change this password immediately after logging in.
              These credentials are temporary and should not be shared
              insecurely.
            </p>
          </div>
        </div>

        <div className="px-5 py-4 bg-slate-50 rounded-b-xl border-t border-slate-200 flex gap-2">
          <button
            onClick={handleCopyAll}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            {copied ? "✓ Copied" : "Copy Credentials"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
