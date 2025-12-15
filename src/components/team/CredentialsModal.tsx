"use client";

import React from "react";

interface CredentialsModalProps {
  isOpen: boolean;
  email: string;
  password: string;
  loginUrl: string;
  shareMessage: string;
  onClose: () => void;
  onCopyAll: () => void;
}

export function CredentialsModal({
  isOpen,
  email,
  password,
  loginUrl,
  shareMessage,
  onClose,
  onCopyAll,
}: CredentialsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Team Member Added!
              </h2>
              <p className="text-sm text-slate-500">
                Share these credentials with the new member
              </p>
            </div>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Email
              </label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-white px-3 py-2 rounded border border-slate-200">
                  {email}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(email)}
                  className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
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
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Temporary Password
              </label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-white px-3 py-2 rounded border border-slate-200">
                  {password}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(password)}
                  className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
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
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Login URL
              </label>
              <div className="mt-1">
                <code className="block text-sm font-mono bg-white px-3 py-2 rounded border border-slate-200 text-blue-600 break-all">
                  {loginUrl}
                </code>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onCopyAll}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
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
              Copy All to Share
            </button>
          </div>

          <p className="text-xs text-slate-500 text-center">
            The user should change their password after first login.
          </p>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
