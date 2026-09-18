"use client";

/**
 * The bell in the header: unread count on the icon, and a panel of the
 * latest notifications grouped Today / Earlier. Reads everything from
 * NotificationsProvider, which holds the one live subscription per tab -
 * this component fetches nothing of its own.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BellIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { NotificationRow } from "@/components/notifications/NotificationRow";

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { items, unreadCount, loaded, markAllRead } = useNotifications();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const { today, earlier } = useMemo(() => {
    const cut = startOfToday();
    const today = items.filter((n) => new Date(n.created_at).getTime() >= cut);
    const earlier = items.filter((n) => new Date(n.created_at).getTime() < cut);
    return { today, earlier };
  }, [items]);

  const badge = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"}
        aria-expanded={open}
        className={cn(
          "relative p-2.5 rounded-lg transition-colors",
          open ? "bg-slate-100 text-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100",
        )}
      >
        <BellIcon className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold leading-[18px] text-center ring-2 ring-white tabular-nums">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[380px] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-baseline gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
              {unreadCount > 0 && <span className="text-xs text-slate-500">{unreadCount} unread</span>}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button type="button" onClick={() => void markAllRead()} className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-md hover:bg-blue-50">
                  Mark all read
                </button>
              )}
              <Link
                href="/dashboard/settings/notifications"
                onClick={() => setOpen(false)}
                title="Notification settings"
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <Cog6ToothIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {!loaded ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">Loading…</div>
            ) : items.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <BellIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Nothing yet</p>
                <p className="text-xs text-slate-500 mt-1">Tasks handed to you, leads assigned, projects waiting on you - they land here.</p>
              </div>
            ) : (
              <>
                {today.length > 0 && <Group label="Today" rows={today} onNavigate={() => setOpen(false)} />}
                {earlier.length > 0 && <Group label="Earlier" rows={earlier} onNavigate={() => setOpen(false)} />}
              </>
            )}
          </div>

          <div className="border-t border-slate-100 px-4 py-2 text-center">
            <Link href="/dashboard/notifications" onClick={() => setOpen(false)} className="text-xs font-medium text-slate-600 hover:text-blue-600">
              See all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Group({ label, rows, onNavigate }: { label: string; rows: ReturnType<typeof useNotifications>["items"]; onNavigate: () => void }) {
  return (
    <div>
      <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="divide-y divide-slate-100">
        {rows.map((n) => (
          <NotificationRow key={n.id} n={n} compact onNavigate={onNavigate} showRemove />
        ))}
      </div>
    </div>
  );
}
