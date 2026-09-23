"use client";

/**
 * Filling in a package: the same questions the room sheet asks, answered once
 * for the business instead of once per customer.
 *
 * Grouped by component type, and inside that by question, using
 * `shapeOptions` - so the editor and the sheet cannot disagree about what is
 * a question, what is an accessory and what prices itself. A question shows
 * its answers as a radio; an accessory shows a count; an automatic item is
 * not shown at all, because there is nothing to decide.
 *
 * "Fill from a grade" on creation answers every graded question, which leaves
 * the tenant only the by-kind ones - the finishes and the countertops. That
 * is the difference between ten minutes and an afternoon.
 */

import React, { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, CheckIcon } from "@heroicons/react/24/outline";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/PageLayout";
import { buttonVariants } from "@/components/ui/Button";
import { shapeOptions } from "@/lib/scope/options";
import { cn } from "@/utils/cn";

interface Offer {
  cost_item_id: string; name: string; unit_code: string; quality_tier: string | null;
  quantity_key: string | null; auto: boolean; category_id: string | null;
  category: string | null; question: string | null; decision: string | null; category_order: number;
}
interface TypeRow { id: string; name: string; offers: Offer[] }
interface Entry { component_type_id: string; cost_item_id: string; quantity: number | null }

export default function PackageEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [catalogue, setCatalogue] = useState<TypeRow[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [openType, setOpenType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/scope-packages/${id}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error || "Could not load the package"); setLoading(false); return; }
    setName(json.data.package.name ?? "");
    setDescription(json.data.package.description ?? "");
    setCatalogue(json.data.catalogue ?? []);
    setEntries(json.data.entries ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    // setState happens after the fetch resolves; the rule cannot see through `load`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const key = (t: string, c: string) => `${t}:${c}`;
  const chosen = useMemo(() => new Map(entries.map((e) => [key(e.component_type_id, e.cost_item_id), e])), [entries]);

  /** A question takes one answer, so choosing replaces whatever its group held. */
  const answer = (typeId: string, groupIds: string[], costItemId: string | null) =>
    setEntries((prev) => {
      const without = prev.filter((e) => !(e.component_type_id === typeId && groupIds.includes(e.cost_item_id)));
      return costItemId ? [...without, { component_type_id: typeId, cost_item_id: costItemId, quantity: null }] : without;
    });

  const setCount = (typeId: string, costItemId: string, quantity: number | null) =>
    setEntries((prev) => {
      const without = prev.filter((e) => !(e.component_type_id === typeId && e.cost_item_id === costItemId));
      return quantity ? [...without, { component_type_id: typeId, cost_item_id: costItemId, quantity }] : without;
    });

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/scope-packages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null, entries }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(json.error || "Could not save");
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) return <PageLayout><PageContent><p className="text-sm text-slate-500">Loading…</p></PageContent></PageLayout>;

  return (
    <PageLayout>
      <PageHeader
        title={name || "Package"}
        subtitle={`${entries.length} answer${entries.length === 1 ? "" : "s"} across ${new Set(entries.map((e) => e.component_type_id)).size} component type(s)`}
        breadcrumbs={[
          { label: "Catalogue", href: "/dashboard/settings/catalogue" },
          // Back to the tab this page was opened from.
          { label: "Packages", href: "/dashboard/settings/catalogue?tab=packages" },
          { label: name || "Package" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {saved && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckIcon className="w-3.5 h-3.5" /> Saved</span>}
            <Link href="/dashboard/settings/catalogue?tab=packages" className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
              <ArrowLeftIcon className="w-4 h-4" /> Back
            </Link>
            <button type="button" onClick={() => void save()} disabled={saving} className={cn(buttonVariants(), "disabled:opacity-60")}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        }
      />
      <PageContent>
        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3">
          <label className="text-xs text-slate-600">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400" />
          </label>
          <label className="text-xs text-slate-600">
            Description <span className="text-slate-400">what it includes, in your words</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400" />
          </label>
        </div>

        <p className="text-xs text-slate-500 mb-3">
          Answer only what this package should decide. A component type you say nothing about is left entirely to the seller, and a question you skip is reported as still to ask when the package is applied.
        </p>

        <div className="space-y-2">
          {catalogue.map((t) => {
            const shapes = shapeOptions(
              t.offers.map((o) => ({ cost_item_id: o.cost_item_id, quantity_key: o.quantity_key, auto: o.auto })),
              t.offers.map((o) => ({ id: o.cost_item_id, category_id: o.category_id, unit_code: o.unit_code, decision: o.decision })),
            );
            const mine = entries.filter((e) => e.component_type_id === t.id);
            const groups = new Map<string, Offer[]>();
            const counted: Offer[] = [];
            for (const o of t.offers) {
              const s = shapes.get(o.cost_item_id);
              if (!s || s.auto) continue;
              if (s.counted) counted.push(o);
              else if (s.group_key) groups.set(s.group_key, [...(groups.get(s.group_key) ?? []), o]);
            }
            const open = openType === t.id;
            return (
              <div key={t.id} className="bg-white border border-slate-200 rounded-lg">
                <button type="button" onClick={() => setOpenType(open ? null : t.id)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-800 flex-1">{t.name}</span>
                  <span className={cn("text-xs", mine.length ? "text-emerald-700" : "text-slate-400")}>
                    {mine.length ? `${mine.length} set` : "nothing set"}
                  </span>
                  <span className="text-xs text-slate-400">{groups.size} question{groups.size === 1 ? "" : "s"}</span>
                </button>
                {open && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">
                    {[...groups.entries()].map(([g, items]) => {
                      const ids = items.map((i) => i.cost_item_id);
                      const picked = mine.find((e) => ids.includes(e.cost_item_id));
                      return (
                        <div key={g} className="grid grid-cols-[11rem_1fr] gap-x-3 items-start">
                          <span className="text-xs font-medium text-slate-600 pt-1">
                            {items[0].question || `Which ${items[0].category?.toLowerCase() ?? "one"}?`}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {items.map((o) => (
                              <button
                                key={o.cost_item_id}
                                type="button"
                                onClick={() => answer(t.id, ids, picked?.cost_item_id === o.cost_item_id ? null : o.cost_item_id)}
                                className={cn(
                                  "px-2 py-0.5 text-[11px] font-medium rounded-full border transition-colors",
                                  picked?.cost_item_id === o.cost_item_id ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400",
                                )}
                              >
                                {o.name}
                                {o.quality_tier && <span className="ml-1 text-[9px] uppercase opacity-70">{o.quality_tier}</span>}
                              </button>
                            ))}
                            <span className="text-[11px] text-slate-400 self-center">
                              {picked ? "" : "left to the seller"}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {counted.length > 0 && (
                      <div className="grid grid-cols-[11rem_1fr] gap-x-3 items-start pt-1 border-t border-slate-100">
                        <span className="text-xs font-medium text-slate-600 pt-2">Given as standard</span>
                        <div className="flex flex-wrap gap-1.5 pt-1.5">
                          {counted.map((o) => {
                            const e = chosen.get(key(t.id, o.cost_item_id));
                            return (
                              <span key={o.cost_item_id} className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setCount(t.id, o.cost_item_id, e ? null : 1)}
                                  className={cn(
                                    "px-2 py-0.5 text-[11px] font-medium rounded-full border transition-colors",
                                    e ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-dashed border-slate-300 hover:border-slate-400",
                                  )}
                                >
                                  {o.name}
                                </button>
                                {e && (
                                  <span className="inline-flex items-center rounded border border-slate-200 bg-white text-[10px] tabular-nums">
                                    <button type="button" onClick={() => setCount(t.id, o.cost_item_id, Math.max(1, (e.quantity ?? 1) - 1))} className="px-1.5 py-0.5 hover:bg-slate-100">−</button>
                                    <span className="px-1.5 min-w-[1.4rem] text-center">{e.quantity ?? 1}</span>
                                    <button type="button" onClick={() => setCount(t.id, o.cost_item_id, (e.quantity ?? 1) + 1)} className="px-1.5 py-0.5 hover:bg-slate-100">+</button>
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PageContent>
    </PageLayout>
  );
}
