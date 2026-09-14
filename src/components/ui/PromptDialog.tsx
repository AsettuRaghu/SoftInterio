"use client";

/**
 * Ask for a sentence, in the app rather than in the browser chrome.
 *
 * `window.prompt` is the last of the browser dialogs still in use here, and the
 * worst of them: an unstyled OS box with the app's URL above it, asking someone
 * to justify cancelling a governed process. It cannot show what the consequence
 * is, cannot mark the field required, and blocks the page behind it from
 * repainting while somebody thinks.
 *
 * Deliberately a sibling of ConfirmDialog rather than a variant of it. A
 * confirmation is a yes-or-no about something already described; this collects a
 * value, so it needs a field, a required rule and a submit that can be refused -
 * and folding both into one component would mean a dialog that sometimes has an
 * input and sometimes does not.
 *
 *   const { prompt, promptDialog } = usePrompt();
 *   const reason = await prompt({ title: "Why?", required: true });
 *   if (reason === null) return;   // cancelled
 *   ...
 *   return <>{content}{promptDialog}</>;
 */

import React, { useCallback, useEffect, useState } from "react";
import { PencilSquareIcon } from "@heroicons/react/24/outline";

export interface PromptOptions {
  title: string;
  /** The consequence, in a sentence. */
  message?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Refuse an empty answer. Cancelling is still always allowed. */
  required?: boolean;
  /** Several lines, for a reason or a note. */
  multiline?: boolean;
  initialValue?: string;
}

export function usePrompt() {
  const [state, setState] = useState<{
    isOpen: boolean;
    options: PromptOptions;
    resolve: ((value: string | null) => void) | null;
  }>({ isOpen: false, options: { title: "" }, resolve: null });
  const [value, setValue] = useState("");

  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setValue(options.initialValue ?? "");
        setState({ isOpen: true, options, resolve });
      }),
    []
  );

  const settle = useCallback(
    (result: string | null) => {
      state.resolve?.(result);
      setState((s) => ({ ...s, isOpen: false, resolve: null }));
    },
    [state]
  );

  // Escape cancels, as it does in the dialog this replaces.
  useEffect(() => {
    if (!state.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.isOpen, settle]);

  const o = state.options;
  const trimmed = value.trim();
  const canSubmit = !o.required || trimmed.length > 0;

  const promptDialog = state.isOpen ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => settle(null)} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) settle(trimmed);
        }}
        className="relative bg-white rounded-xl shadow-xl border border-slate-200 p-5 w-full max-w-md mx-4"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <PencilSquareIcon className="w-5 h-5 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-800">{o.title}</h3>
            {o.message && (
              <p className="mt-1 text-xs text-slate-500 whitespace-pre-line">
                {o.message}
              </p>
            )}
          </div>
        </div>

        {o.multiline ? (
          <textarea
            autoFocus
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={o.placeholder}
            className="mt-3 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
          />
        ) : (
          <input
            autoFocus
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={o.placeholder}
            className="mt-3 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
          />
        )}

        {o.required && !canSubmit && (
          <p className="mt-1.5 text-[11px] text-slate-400">
            A reason is required.
          </p>
        )}

        <div className="flex items-center gap-3 mt-4">
          <button
            type="button"
            onClick={() => settle(null)}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {o.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg bg-amber-600 hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {o.confirmLabel ?? "Continue"}
          </button>
        </div>
      </form>
    </div>
  ) : null;

  return { prompt, promptDialog };
}

export default usePrompt;
