"use client";

/**
 * One subscription per open tab, shared by the bell, the slider and the
 * notifications page.
 *
 * Loads the latest thirty once, then listens on Supabase Realtime for rows
 * where user_id is the signed-in person - the same RLS that scopes the SELECT
 * scopes the stream, so a person only ever hears about their own. A row that
 * arrives while the tab is open goes to the top of the list AND into
 * `incoming`, which the slider drains; rows that were already there when the
 * page loaded never slide in, so opening the app to thirty unread does not
 * fire thirty toasts.
 *
 * Read state is changed optimistically and confirmed by the UPDATE event,
 * which also keeps two tabs in step.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { AppNotification } from "@/types/notifications";

interface Ctx {
  items: AppNotification[];
  unreadCount: number;
  loaded: boolean;
  /** Rows that arrived live and have not been shown as a slider yet. */
  incoming: AppNotification[];
  dismissIncoming: (id: string) => void;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<Ctx | null>(null);

const RECENT = 30;

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useCurrentUser();
  const userId = user?.id ?? null;
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [incoming, setIncoming] = useState<AppNotification[]>([]);
  // Actor names for live rows come from the directory; cached per tab.
  const names = useRef(new Map<string, { id: string; name: string; avatar_url: string | null }>());
  // Mirror for callbacks that need the current list without re-creating.
  const itemsRef = useRef<AppNotification[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?limit=${RECENT}`);
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.notifications ?? []);
      setUnreadCount(json.unread_count ?? 0);
      for (const n of json.notifications ?? []) {
        if (n.triggered_user) names.current.set(n.triggered_user.id, n.triggered_user);
      }
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    void refresh();
  }, [userId, refresh]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        async (payload) => {
          const row = payload.new as AppNotification;
          let actor = row.triggered_by ? names.current.get(row.triggered_by) ?? null : null;
          if (row.triggered_by && !actor) {
            const { data } = await supabase
              .from("tenant_directory")
              .select("id, name, avatar_url")
              .eq("id", row.triggered_by)
              .maybeSingle();
            if (data) {
              names.current.set(data.id, data);
              actor = data;
            }
          }
          const full = { ...row, triggered_user: actor };
          setItems((prev) => (prev.some((p) => p.id === full.id) ? prev : [full, ...prev].slice(0, RECENT)));
          if (!full.is_read) {
            setUnreadCount((c) => c + 1);
            setIncoming((prev) => [...prev, full]);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as AppNotification;
          // payload.old carries only the key (replica identity is default), so
          // the change is judged against what this tab holds. A flip this tab
          // made optimistically is already applied and so counts once.
          const known = itemsRef.current.find((p) => p.id === row.id);
          if (known && known.is_read !== row.is_read) {
            setUnreadCount((c) => Math.max(0, c + (row.is_read ? -1 : 1)));
          }
          setItems((prev) => prev.map((p) => (p.id === row.id ? { ...p, ...row, triggered_user: p.triggered_user } : p)));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const dismissIncoming = useCallback((id: string) => {
    setIncoming((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const markRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    const flipped = itemsRef.current.filter((n) => ids.includes(n.id) && !n.is_read).length;
    setItems((prev) => prev.map((n) => (ids.includes(n.id) && !n.is_read ? { ...n, is_read: true, read_at: now } : n)));
    setUnreadCount((c) => Math.max(0, c - flipped));
    setIncoming((prev) => prev.filter((n) => !ids.includes(n.id)));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_ids: ids }),
    }).catch(() => undefined);
  }, []);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.is_read ? n : { ...n, is_read: true, read_at: now })));
    setUnreadCount(0);
    setIncoming([]);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark_all: true }),
    }).catch(() => undefined);
  }, []);

  const remove = useCallback(async (id: string) => {
    const gone = itemsRef.current.find((n) => n.id === id);
    if (gone && !gone.is_read) setUnreadCount((c) => Math.max(0, c - 1));
    setItems((prev) => prev.filter((n) => n.id !== id));
    setIncoming((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/notifications?id=${id}`, { method: "DELETE" }).catch(() => undefined);
  }, []);

  const value = useMemo<Ctx>(
    () => ({ items, unreadCount, loaded, incoming, dismissIncoming, markRead, markAllRead, remove, refresh }),
    [items, unreadCount, loaded, incoming, dismissIncoming, markRead, markAllRead, remove, refresh],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): Ctx {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationsProvider");
  return ctx;
}
