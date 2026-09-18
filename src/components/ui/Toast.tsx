"use client";

/**
 * Floating toast for action feedback.
 *
 * Inline table edits fire and forget - when the server refuses one there is no
 * form to attach an error to, so failures were only reaching console.error and
 * the user saw nothing happen at all. This gives them somewhere to surface.
 *
 * Deliberately tiny in code: no provider, no queue, no context. Hold a message
 * in the calling component's state and render this.
 *
 * Not tiny on screen. It used to wrap the inline `Alert` - text-xs, a 16px
 * icon, top-right, max-w-sm - and a completion gate refusing a step read as
 * "the button did nothing". It is now a white card with a coloured edge,
 * bottom-centre, readable type and a headline. A solid-colour banner was
 * tried and was too loud.
 */

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";

type Variant = "success" | "error" | "warning" | "info";

interface ToastProps {
  message: string | null;
  variant?: Variant;
  onDismiss: () => void;
  /** Auto-dismiss delay in ms. 0 keeps it until dismissed. */
  duration?: number;
}

const LOOK: Record<
  Variant,
  { headline: string; accent: string; icon: string; Icon: typeof CheckCircleIcon }
> = {
  success: { headline: "Done", accent: "border-l-emerald-500", icon: "text-emerald-500", Icon: CheckCircleIcon },
  error: { headline: "That did not go through", accent: "border-l-red-500", icon: "text-red-500", Icon: XCircleIcon },
  warning: { headline: "Heads up", accent: "border-l-amber-500", icon: "text-amber-500", Icon: ExclamationTriangleIcon },
  info: { headline: "Note", accent: "border-l-blue-500", icon: "text-blue-500", Icon: InformationCircleIcon },
};

export function Toast({
  message,
  variant = "error",
  onDismiss,
  duration = 8000,
}: ToastProps) {
  useEffect(() => {
    if (!message || duration === 0) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onDismiss]);

  if (!message || typeof window === "undefined") return null;

  const look = LOOK[variant];
  const { Icon } = look;

  return createPortal(
    <div
      role={variant === "error" || variant === "warning" ? "alert" : "status"}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-9999 w-[min(36rem,calc(100vw-2rem))] animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      {/* A white card with a coloured edge and icon: readable at a glance,
          without shouting. A solid red banner was too much. */}
      <div
        className={`flex items-start gap-3 rounded-lg border border-slate-200 border-l-4 bg-white px-4 py-3 shadow-xl ${look.accent}`}
      >
        <Icon className={`w-6 h-6 shrink-0 ${look.icon}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 leading-5">{look.headline}</p>
          <p className="text-sm text-slate-700 leading-5 mt-0.5 wrap-break-word">{message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 -mr-1 -mt-1 rounded-md p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>,
    document.body
  );
}

export default Toast;
