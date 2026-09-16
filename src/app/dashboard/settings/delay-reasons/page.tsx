"use client";

/**
 * Settings → Delay reasons.
 *
 * The short list a hold picks "why" from, grouped by who owns the delay. The
 * shipped defaults are shared by every business and are shown read-only; a
 * tenant adds its own beside them and can hide either kind (a hidden reason
 * stays on the holds that used it). Same bargain as playbooks and roles: we
 * propose the practice, they decide how they work.
 */

import React, { useCallback, useEffect, useState } from "react";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/PageLayout";
import { Toast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { invalidateDelayReasons } from "@/lib/tasks/use-delay-reasons";
import { DelayOwnerLabels, type DelayOwner } from "@/types/tasks";

interface Reason {
  id: string;
  tenant_id: string | null;
  owner: DelayOwner;
  code: string;
  label: string;
  display_order: number;
  is_active: boolean;
}

const OWNER_BLURB: Record<DelayOwner, string> = {
  client: "The client has not done something the work needs.",
  vendor: "A supplier or fabricator has not delivered.",
  internal: "Our own team ran late.",
  third_party: "Someone outside the project: society, government, weather, transport.",
};

export default function DelayReasonsPage() {
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ message: string; variant: "success" | "error" } | null>(null);
  const [draft, setDraft] = useState<Record<DelayOwner, string>>({ client: "", vendor: "", internal: "", third_party: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/delay-reasons?all=1");
      const json = await res.json();
      if (res.ok) setReasons(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const act = async (key: string, fn: () => Promise<Response>, ok: string) => {
    setBusy(key);
    try {
      const res = await fn();
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ message: json.error || "That did not save", variant: "error" });
        return false;
      }
      invalidateDelayReasons();
      await load();
      setNotice({ message: ok, variant: "success" });
      return true;
    } catch {
      setNotice({ message: "Could not reach the server", variant: "error" });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const add = async (owner: DelayOwner) => {
    const label = draft[owner].trim();
    if (!label) return;
    const ok = await act(`add:${owner}`, () =>
      fetch("/api/delay-reasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, label }),
      }), `Added "${label}".`);
    if (ok) setDraft((d) => ({ ...d, [owner]: "" }));
  };

  const toggle = (r: Reason) =>
    act(r.id, () =>
      fetch(`/api/delay-reasons/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !r.is_active }),
      }), r.is_active ? `"${r.label}" hidden.` : `"${r.label}" shown again.`);

  const remove = async (r: Reason) => {
    if (!(await confirm({ title: `Remove "${r.label}"?`, message: "Holds that used it keep their record; it just stops being offered.", confirmLabel: "Remove", tone: "danger" }))) return;
    await act(r.id, () => fetch(`/api/delay-reasons/${r.id}`, { method: "DELETE" }), `"${r.label}" removed.`);
  };

  return (
    <PageLayout isLoading={loading} loadingText="Loading delay reasons...">
      <PageHeader
        title="Delay reasons"
        subtitle="What a hold can say about why. Grouped by who owns the delay - it is what the delay log counts against."
        basePath={{ label: "Settings", href: "/dashboard/settings" }}
        breadcrumbs={[{ label: "Delay reasons" }]}
      />
      <PageContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(Object.keys(DelayOwnerLabels) as DelayOwner[]).map((owner) => {
            const rows = reasons.filter((r) => r.owner === owner);
            return (
              <section key={owner} className="rounded-lg border border-slate-200 bg-white">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-800">{DelayOwnerLabels[owner]}</h2>
                  <p className="text-xs text-slate-500">{OWNER_BLURB[owner]}</p>
                </div>
                <ul className="divide-y divide-slate-100">
                  {rows.map((r) => {
                    const shipped = !r.tenant_id;
                    return (
                      <li key={r.id} className={cn("px-4 py-2 flex items-center gap-3 text-sm", !r.is_active && "opacity-50")}>
                        <span className={cn("flex-1", !r.is_active && "line-through")}>{r.label}</span>
                        {shipped && (
                          <span className="text-[10px] uppercase tracking-wide text-slate-400" title="Shipped with SoftInterio, shared by every business">
                            default
                          </span>
                        )}
                        {!shipped && (
                          <>
                            <button
                              type="button"
                              disabled={busy === r.id}
                              onClick={() => void toggle(r)}
                              className="text-xs text-slate-500 hover:text-slate-800"
                            >
                              {r.is_active ? "Hide" : "Show"}
                            </button>
                            <button
                              type="button"
                              disabled={busy === r.id}
                              onClick={() => void remove(r)}
                              className="text-xs text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2">
                  <input
                    type="text"
                    value={draft[owner]}
                    onChange={(e) => setDraft((d) => ({ ...d, [owner]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && void add(owner)}
                    placeholder="Add a reason of your own"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    disabled={busy === `add:${owner}` || !draft[owner].trim()}
                    onClick={() => void add(owner)}
                    className={cn(buttonVariants({ size: "sm" }))}
                  >
                    Add
                  </button>
                </div>
              </section>
            );
          })}
        </div>
        {confirmDialog}
        <Toast message={notice?.message ?? null} variant={notice?.variant ?? "error"} onDismiss={() => setNotice(null)} />
      </PageContent>
    </PageLayout>
  );
}
