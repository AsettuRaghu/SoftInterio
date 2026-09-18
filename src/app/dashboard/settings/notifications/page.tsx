"use client";

/**
 * Settings → Notifications: which kinds reach you in the app.
 *
 * Personal, so no permission gate - everyone chooses for themselves. Every
 * kind is on until switched off; the switch writes one preference row. Email
 * and push are not offered because nothing sends them.
 */

import React, { useEffect, useState } from "react";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/PageLayout";
import { Toast } from "@/components/ui/Toast";
import { BellIcon } from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";
import {
  NOTIFICATION_GROUPS,
  NOTIFICATION_KINDS,
  NOTIFICATION_KIND_LIST,
  type NotificationKind,
} from "@/lib/notifications/kinds";
import { kindGlyph } from "@/components/notifications/NotificationRow";

type Prefs = Record<NotificationKind, boolean>;

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [busy, setBusy] = useState<NotificationKind | null>(null);
  const [notice, setNotice] = useState<{ message: string; variant: "success" | "error" } | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/notifications/preferences");
      const json = await res.json().catch(() => ({}));
      if (res.ok) setPrefs(json.preferences);
      else setNotice({ message: json.error || "Could not load your preferences", variant: "error" });
    })();
  }, []);

  const toggle = async (kind: NotificationKind) => {
    if (!prefs || busy) return;
    const next = !prefs[kind];
    setBusy(kind);
    setPrefs({ ...prefs, [kind]: next });
    const res = await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, in_app: next }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) setPrefs(json.preferences);
    else {
      setPrefs({ ...prefs, [kind]: !next });
      setNotice({ message: json.error || "Could not save", variant: "error" });
    }
    setBusy(null);
  };

  return (
    <PageLayout>
      <PageHeader
        title="Notifications"
        subtitle="What reaches you in the app. Everything is on unless you switch it off here; these are yours alone."
        basePath={{ label: "Settings", href: "/dashboard/settings" }}
        breadcrumbs={[{ label: "Notifications" }]}
        icon={<BellIcon className="w-4 h-4 text-white" />}
        iconBgClass="from-slate-600 to-slate-700"
      />
      <PageContent>
        <div className="max-w-2xl space-y-4">
          {NOTIFICATION_GROUPS.map((group) => {
            const kinds = NOTIFICATION_KIND_LIST.filter((k) => NOTIFICATION_KINDS[k].group === group);
            return (
              <section key={group} className="rounded-lg border border-slate-200 bg-white">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-900">{group}</h2>
                </div>
                <ul className="divide-y divide-slate-100">
                  {kinds.map((kind) => {
                    const { Icon, toneClass } = kindGlyph(kind);
                    const on = prefs ? prefs[kind] : true;
                    return (
                      <li key={kind} className="flex items-center gap-3 px-4 py-3">
                        <span className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", toneClass)}>
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="flex-1 text-sm text-slate-800">{NOTIFICATION_KINDS[kind].label}</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          disabled={!prefs || busy === kind}
                          onClick={() => void toggle(kind)}
                          className={cn(
                            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60",
                            on ? "bg-blue-600" : "bg-slate-300",
                          )}
                        >
                          <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-5" : "translate-x-0.5")} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          <p className="text-xs text-slate-500 px-1">
            You are never notified about your own actions. Reminders for follow-ups and meetings, and office holidays and birthdays, are coming next.
          </p>
        </div>
        <Toast message={notice?.message ?? null} variant={notice?.variant ?? "error"} onDismiss={() => setNotice(null)} />
      </PageContent>
    </PageLayout>
  );
}
