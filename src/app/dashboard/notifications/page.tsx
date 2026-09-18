"use client";

/**
 * Every notification you have, newest first, with All / Unread and paging.
 * The bell shows the latest thirty; this is the rest. Read state and removals
 * are taken from the provider's live list where it knows the row, so a click
 * here and a click in the bell agree at once; a new arrival re-reads page 1.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BellIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/PageLayout";
import { cn } from "@/utils/cn";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import type { AppNotification } from "@/types/notifications";

const PAGE = 30;

export default function NotificationsPage() {
  const { items: live, unreadCount, markAllRead } = useNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (p: number, replace: boolean) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/notifications?page=${p}&limit=${PAGE}${filter === "unread" ? "&unread=true" : ""}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return;
        setRows((prev) => (replace ? json.notifications : [...prev, ...json.notifications]));
        setHasMore(!!json.has_more);
        setPage(p);
      } finally {
        setLoading(false);
      }
    },
    [filter],
  );

  // First page follows the filter, and a new arrival (the newest live id).
  const newestLiveId = live[0]?.id ?? null;
  useEffect(() => {
    void load(1, true);
  }, [load, newestLiveId]);

  // Overlay what the provider knows: read flips made anywhere show here at
  // once, and a removed row leaves the list without a refetch.
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const display = useMemo(() => {
    const byId = new Map(live.map((n) => [n.id, n]));
    return rows
      .filter((r) => !removed.has(r.id))
      .map((r) => byId.get(r.id) ?? r)
      .filter((r) => filter === "all" || !r.is_read);
  }, [rows, live, removed, filter]);

  const clearRead = async () => {
    await fetch("/api/notifications?read=true", { method: "DELETE" }).catch(() => undefined);
    void load(1, true);
  };

  return (
    <PageLayout>
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : "You are all caught up"}
        breadcrumbs={[{ label: "Notifications" }]}
        icon={<BellIcon className="w-5 h-5 text-white" />}
        iconBgClass="from-blue-500 to-blue-600"
        actions={
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button type="button" onClick={() => void markAllRead()} className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">
                Mark all read
              </button>
            )}
            <button type="button" onClick={() => void clearRead()} className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
              Clear read
            </button>
            <Link href="/dashboard/settings/notifications" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title="Notification settings">
              <Cog6ToothIcon className="w-5 h-5" />
            </Link>
          </div>
        }
      />
      <PageContent noPadding>
        <div className="max-w-3xl">
          <div className="flex items-center gap-1 px-4 py-3 border-b border-slate-200">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  filter === f ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {f === "all" ? "All" : `Unread${unreadCount ? ` (${unreadCount})` : ""}`}
              </button>
            ))}
          </div>

          {display.length === 0 && !loading ? (
            <div className="px-6 py-16 text-center">
              <BellIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">{filter === "unread" ? "Nothing unread" : "Nothing yet"}</p>
              <p className="text-xs text-slate-500 mt-1">Tasks handed to you, leads assigned, projects waiting on you - they land here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {display.map((n) => (
                <NotificationRow key={n.id} n={n} showRemove onRemoved={() => setRemoved((prev) => new Set(prev).add(n.id))} />
              ))}
            </div>
          )}

          {hasMore && (
            <div className="px-4 py-4 text-center border-t border-slate-100">
              <button type="button" disabled={loading} onClick={() => void load(page + 1, false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-60">
                {loading ? "Loading…" : "Show older"}
              </button>
            </div>
          )}
        </div>
      </PageContent>
    </PageLayout>
  );
}
