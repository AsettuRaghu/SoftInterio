"use client";

/**
 * Conversation - the third section of the Scope tab: the discussion about the
 * scope as a whole, every decision taken across all spaces in one list (what
 * you read before sitting with the customer again), and the full change log.
 */

import React, { useCallback, useEffect, useState } from "react";
import { CheckBadgeIcon } from "@heroicons/react/24/outline";
import type { useConfirm } from "@/components/ui/ConfirmDialog";
import type { PropertyScopeItem, ScopeComment, ScopeHistoryEntry } from "@/types/property-scope";
import { ScopeDiscussion } from "./ScopeDiscussion";

const FIELD_LABELS: Record<string, string> = {
  name: "name", length: "length", width: "width", height: "height", measurement_unit: "unit",
  measurement_status: "measurement", measurement_source: "measured by", quality_tier: "quality",
  scope_owner: "done by", scope_vendor_name: "vendor", preferred_finish: "finish",
  supplied_detail: "supplied item", supplied_expected_by: "expected by", notes: "notes", parent_id: "space",
};
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

export function ScopeConversation({
  propertyId,
  linkedType,
  linkedId,
  items,
  readOnly,
  confirm,
  onOpenItem,
}: {
  propertyId: string;
  linkedType: "lead" | "project";
  linkedId: string;
  items: PropertyScopeItem[];
  readOnly: boolean;
  confirm: ReturnType<typeof useConfirm>["confirm"];
  onOpenItem: (id: string) => void;
}) {
  const [decisions, setDecisions] = useState<ScopeComment[]>([]);
  const [history, setHistory] = useState<ScopeHistoryEntry[]>([]);

  const load = useCallback(async () => {
    const [d, h] = await Promise.all([
      fetch(`/api/properties/${propertyId}/scope/conversation?decisions=1`).then((r) => r.json()).catch(() => null),
      fetch(`/api/properties/${propertyId}/scope/history?limit=60`).then((r) => r.json()).catch(() => null),
    ]);
    setDecisions(d?.data ?? []);
    setHistory(h?.data ?? []);
  }, [propertyId]);

  useEffect(() => {
    // setState happens after the fetches resolve; the rule cannot see through `load`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const nameOf = (id: string | null) => (id ? items.find((i) => i.id === id)?.name ?? "a space no longer listed" : "the scope as a whole");

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <section className="xl:col-span-2 rounded-lg border border-slate-200 bg-white flex flex-col min-h-[24rem]">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">About the scope as a whole</h3>
          <p className="text-xs text-slate-500">Anything not about one particular space. A space&rsquo;s own thread is in its panel.</p>
        </div>
        <div className="flex-1 min-h-0">
          <ScopeDiscussion scopeItemId={null} propertyId={propertyId} linkedType={linkedType} linkedId={linkedId} readOnly={readOnly} confirm={confirm} />
        </div>
      </section>

      <div className="space-y-4">
        <section className="rounded-lg border border-emerald-200 bg-white">
          <div className="px-4 py-3 border-b border-emerald-100 bg-emerald-50/50 rounded-t-lg flex items-center gap-2">
            <CheckBadgeIcon className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-900">Decisions</h3>
            <span className="text-xs text-slate-500">{decisions.length}</span>
          </div>
          {decisions.length === 0 ? (
            <p className="px-4 py-6 text-xs text-slate-400">None yet. Mark an entry as a decision and it shows here, across every space.</p>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[22rem] overflow-y-auto">
              {decisions.map((d) => (
                <li key={d.id} className="px-4 py-2.5">
                  <button type="button" onClick={() => d.scope_item_id && onOpenItem(d.scope_item_id)} className="text-[11px] font-medium text-emerald-700 hover:underline disabled:no-underline" disabled={!d.scope_item_id}>
                    {nameOf(d.scope_item_id)}
                  </button>
                  <p className="text-sm text-slate-800 mt-0.5">{d.body}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{d.author_name} · {new Date(d.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Change log</h3>
            <p className="text-xs text-slate-500">Every edit to a space or component, with the reason where one was given.</p>
          </div>
          {history.length === 0 ? (
            <p className="px-4 py-6 text-xs text-slate-400">Nothing recorded yet.</p>
          ) : (
            <ol className="divide-y divide-slate-100 max-h-[26rem] overflow-y-auto">
              {history.map((h) => (
                <li key={h.id} className="px-4 py-2.5 text-xs">
                  <div className="text-slate-500">
                    <span className="font-medium text-slate-700">{h.changed_by_name}</span>{" "}
                    {h.action === "added" ? "added" : h.action === "removed" ? "removed" : "changed"}{" "}
                    <button type="button" onClick={() => onOpenItem(h.scope_item_id)} className="font-medium text-slate-800 hover:underline">{h.item_name}</button>
                    <span className="text-slate-400"> · {new Date(h.changed_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                  {h.action === "changed" && (
                    <p className="text-slate-700 mt-0.5">
                      {Object.entries(h.changes).map(([f, ch], i) => (
                        <span key={f}>{i > 0 ? " · " : ""}{FIELD_LABELS[f] ?? f}: <span className="line-through text-slate-400">{show(ch.from)}</span> → {show(ch.to)}</span>
                      ))}
                    </p>
                  )}
                  {h.reason && <p className="text-slate-600 italic mt-0.5">&ldquo;{h.reason}&rdquo;</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
