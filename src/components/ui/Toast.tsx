"use client";

/**
 * Floating toast for action feedback.
 *
 * Inline table edits fire and forget - when the server refuses one there is no
 * form to attach an error to, so failures were only reaching console.error and
 * the user saw nothing happen at all. This gives them somewhere to surface.
 *
 * Deliberately tiny: no provider, no queue, no context. Hold a message in the
 * calling component's state and render this.
 */

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Alert } from "./Alert";

interface ToastProps {
  message: string | null;
  variant?: "success" | "error" | "warning" | "info";
  onDismiss: () => void;
  /** Auto-dismiss delay in ms. 0 keeps it until dismissed. */
  duration?: number;
}

export function Toast({
  message,
  variant = "error",
  onDismiss,
  duration = 6000,
}: ToastProps) {
  useEffect(() => {
    if (!message || duration === 0) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onDismiss]);

  if (!message || typeof window === "undefined") return null;

  return createPortal(
    <div className="fixed top-20 right-4 z-9999 max-w-sm animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="shadow-lg rounded-lg">
        <Alert variant={variant} message={message} onDismiss={onDismiss} />
      </div>
    </div>,
    document.body
  );
}

export default Toast;
