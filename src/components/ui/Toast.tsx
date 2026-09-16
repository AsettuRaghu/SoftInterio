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
 * "the button did nothing". It is now its own thing: bottom-centre, readable
 * type, a bold headline, a clear icon, and it stays until read or dismissed.
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
  { headline: string; wrap: string; icon: string; Icon: typeof CheckCircleIcon }
> = {
  success: {
    headline: "Done",
    wrap: "bg-emerald-600 text-white",
    icon: "text-emerald-100",
    Icon: CheckCircleIcon,
  },
  error: {
    headline: "That did not go through",
    wrap: "bg-red-600 text-white",
    icon: "text-red-100",
    Icon: XCircleIcon,
  },
  warning: {
    headline: "Heads up",
    wrap: "bg-amber-500 text-white",
    icon: "text-amber-50",
    Icon: ExclamationTriangleIcon,
  },
  info: {
    headline: "Note",
    wrap: "bg-slate-800 text-white",
    icon: "text-slate-200",
    Icon: InformationCircleIcon,
  },
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
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-9999 w-[min(42rem,calc(100vw-2rem))] animate-in fade-in slide-in-from-bottom-3 duration-200"
    >
      <div className={`flex items-start gap-3 rounded-xl px-5 py-4 shadow-2xl ring-1 ring-black/10 ${look.wrap}`}>
        <Icon className={`w-7 h-7 shrink-0 mt-0.5 ${look.icon}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-5">{look.headline}</p>
          <p className="text-base leading-6 mt-0.5 break-words">{message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 -mr-1 -mt-1 rounded-md p-1.5 hover:bg-white/15 transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
    </div>,
    document.body
  );
}

export default Toast;
