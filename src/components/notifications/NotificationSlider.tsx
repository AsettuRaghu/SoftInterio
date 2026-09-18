"use client";

/**
 * The slide-in for a notification that arrives while you are working.
 *
 * Bottom-right, newest at the bottom, at most three on screen; each one
 * leaves on its own after eight seconds, on its close button, or when it is
 * clicked (which also marks it read and follows the link). Only rows that
 * arrive live reach here - the provider never queues what was already
 * waiting when the page loaded.
 *
 * Bottom-right rather than bottom-centre so it does not sit on the app's
 * own Toast, which reports the outcome of something you just did.
 */

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";
import { useNotifications } from "./NotificationsProvider";
import { kindGlyph } from "./NotificationRow";
import type { AppNotification } from "@/types/notifications";

const VISIBLE = 3;
const LINGER_MS = 8000;

export function NotificationSlider() {
  const { incoming, dismissIncoming } = useNotifications();
  const shown = incoming.slice(0, VISIBLE);
  if (typeof document === "undefined" || shown.length === 0) return null;

  return createPortal(
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 w-[360px] max-w-[calc(100vw-2.5rem)] pointer-events-none">
      {shown.map((n) => (
        <Card key={n.id} n={n} onDone={() => dismissIncoming(n.id)} />
      ))}
    </div>,
    document.body,
  );
}

function Card({ n, onDone }: { n: AppNotification; onDone: () => void }) {
  const router = useRouter();
  const { markRead } = useNotifications();
  const { Icon, toneClass } = kindGlyph(n.type);

  useEffect(() => {
    const t = setTimeout(onDone, LINGER_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  const open = () => {
    void markRead([n.id]);
    onDone();
    if (n.action_url) router.push(n.action_url);
  };

  return (
    <div
      role="status"
      className="pointer-events-auto relative bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-[slide-in-right_.25s_ease-out]"
    >
      <button type="button" onClick={open} className="flex items-start gap-3 w-full text-left px-4 py-3 hover:bg-slate-50">
        <span className={cn("shrink-0 w-9 h-9 rounded-full flex items-center justify-center", toneClass)}>
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900 truncate">{n.title}</span>
          <span className="block text-xs text-slate-600 mt-0.5 leading-snug line-clamp-2">{n.message}</span>
        </span>
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDone}
        className="absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
      <div className="h-0.5 bg-blue-100">
        <div className="h-full bg-blue-500 animate-[drain_8s_linear_forwards]" />
      </div>
    </div>
  );
}
