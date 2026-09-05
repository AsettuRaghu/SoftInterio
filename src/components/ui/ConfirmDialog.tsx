"use client";

/**
 * Confirmation dialog, and a hook that makes it a drop-in for window.confirm.
 *
 * The browser's confirm() is a modal the page cannot style, cannot theme, and
 * cannot explain anything in - it renders as a bare OS alert with an app URL
 * at the top, which reads like a browser warning rather than part of the
 * product. It also blocks the main thread, so nothing behind it repaints.
 *
 * Usage mirrors what it replaces, so call sites barely change:
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   if (!(await confirm({ title: "Delete note?" }))) return;
 *   ...
 *   return <>{content}{confirmDialog}</>;
 */

import React, { useCallback, useState } from "react";
import { ExclamationTriangleIcon, TrashIcon } from "@heroicons/react/24/outline";

export interface ConfirmOptions {
  title: string;
  /** The consequence, in a sentence. Omit when the title says everything. */
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger colours the action red and shows a bin; warning is amber. */
  tone?: "danger" | "warning";
}

interface ConfirmDialogProps extends ConfirmOptions {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isBusy?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  onCancel,
  isBusy = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const danger = tone === "danger";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 p-5 w-full max-w-sm mx-4">
        <div className="text-center">
          <div
            className={`mx-auto w-10 h-10 rounded-full flex items-center justify-center mb-3 ${
              danger ? "bg-red-100" : "bg-amber-100"
            }`}
          >
            {danger ? (
              <TrashIcon className="w-5 h-5 text-red-600" />
            ) : (
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-600" />
            )}
          </div>
          <h3 className="text-base font-semibold text-slate-800 mb-1">
            {title}
          </h3>
          {message && (
            <p className="text-xs text-slate-500 mb-4 whitespace-pre-line">
              {message}
            </p>
          )}
          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isBusy}
              className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isBusy}
              className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
                danger
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {isBusy ? "Working..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Promise-based confirmation.
 *
 * Returns the dialog element to render and an async confirm() that resolves
 * true or false, so an existing `if (!confirm(...)) return;` becomes
 * `if (!(await confirm({...}))) return;` and nothing else has to move.
 */
export function useConfirm() {
  const [state, setState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: ((value: boolean) => void) | null;
  }>({ isOpen: false, options: { title: "" }, resolve: null });

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ isOpen: true, options, resolve });
      }),
    []
  );

  const settle = useCallback(
    (value: boolean) => {
      state.resolve?.(value);
      setState((s) => ({ ...s, isOpen: false, resolve: null }));
    },
    [state]
  );

  const confirmDialog = (
    <ConfirmDialog
      isOpen={state.isOpen}
      {...state.options}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, confirmDialog };
}

export default ConfirmDialog;
