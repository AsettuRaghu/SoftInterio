"use client";

/**
 * Settings → Catalogue → Components → Costing: how this business measures a
 * component and how each cost line follows from that measurement. The
 * platform holds no rule of its own; every word here is the tenant's.
 *
 *   Fields      what you measure ("run A", "blind corner", "drawer count")
 *   Quantities  what you cost against - a formula over the fields, written
 *               the way you would on paper, evaluated live against a sample
 *               measurement so a mistake shows as it is typed
 *   Priced per  which quantity each cost item your templates put on this
 *               component is priced per
 *
 * Lengths are typed in whatever unit the row uses and are in feet inside a
 * formula, so multiplying two lengths gives square feet.
 */

import React, { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon, CalculatorIcon } from "@heroicons/react/24/outline";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/PageLayout";
import { Toast } from "@/components/ui/Toast";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { invalidateQuotationConfig } from "@/lib/quotations/config-cache";
import { quantify, validateCosting, KEY_RE, type ComponentCosting, type CostingField, type CostingQuantity } from "@/lib/costing/component-costing";

const UNIT_CODES = ["sqft", "rft", "nos", "set", "lot", "lumpsum", "kg", "ltr"];
const KIND_LABEL = { length: "Length", count: "Count", number: "Number" } as const;

interface LineRow {
  cost_item_id: string;
  name: string;
  unit_code: string;
  category: string | null;
  quantity_key: string | null;
  template_count: number;
}

const slug = (label: string) => label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[0-9]/, "n$&");

export default function ComponentCostingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [name, setName] = useState("");
  const [costing, setCosting] = useState<ComponentCosting | null>(null);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [sample, setSample] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<{ message: string; variant: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/quotations/config/component-types/${id}/costing`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setNotice({ message: json.error || "Could not load", variant: "error" });
    setName(json.data.name);
    setCosting(json.data.costing);
    setLines(json.data.lines);
  }, [id]);

  useEffect(() => {
    // setState happens after the fetch resolves; the rule cannot see through `load`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const problems = useMemo(() => (costing ? validateCosting(costing) : []), [costing]);
  const live = useMemo(() => (costing ? quantify(costing, sample, "ft") : { values: {}, errors: {} }), [costing, sample]);

  const update = (patch: Partial<ComponentCosting>) => {
    setCosting((c) => (c ? { ...c, ...patch } : c));
    setDirty(true);
  };
  const setField = (i: number, p: Partial<CostingField>) => update({ fields: costing!.fields.map((f, k) => (k === i ? { ...f, ...p } : f)) });
  const setQty = (i: number, p: Partial<CostingQuantity>) => update({ quantities: costing!.quantities.map((q, k) => (k === i ? { ...q, ...p } : q)) });
  const move = <T,>(list: T[], i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  const save = async () => {
    if (!costing) return;
    if (problems.length) return setNotice({ message: problems[0], variant: "error" });
    setSaving(true);
    const res = await fetch(`/api/quotations/config/component-types/${id}/costing`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ costing, lines: lines.map((l) => ({ cost_item_id: l.cost_item_id, quantity_key: l.quantity_key })) }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setNotice({ message: json.error || "Could not save", variant: "error" });
    invalidateQuotationConfig();
    setDirty(false);
    setNotice({ message: "Costing rule saved", variant: "success" });
  };

  return (
    <PageLayout isLoading={!costing} loadingText="Loading…">
      <PageHeader
        title={name ? `${name} · Costing` : "Costing"}
        subtitle="How you measure this component and how each cost line follows from it. Lengths are in feet inside a formula, whatever unit was typed."
        basePath={{ label: "Settings", href: "/dashboard/settings" }}
        breadcrumbs={[{ label: "Catalogue", href: "/dashboard/settings/catalogue" }, { label: name || "Component" }, { label: "Costing" }]}
        icon={<CalculatorIcon className="w-4 h-4 text-white" />}
        iconBgClass="from-blue-500 to-blue-600"
        actions={
          <button type="button" onClick={() => void save()} disabled={saving || !dirty} className={cn(buttonVariants(), "disabled:opacity-60")}>
            {saving ? "Saving…" : "Save"}
          </button>
        }
      />
      <PageContent>
        {costing && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_20rem] gap-4">
            <div className="space-y-4">
              {/* Fields */}
              <section className="rounded-lg border border-slate-200 bg-white">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">What you measure</h2>
                    <p className="text-xs text-slate-500">One number each. A length is typed in the row&rsquo;s unit; a count is a whole number.</p>
                  </div>
                  <span className="flex-1" />
                  <button type="button" onClick={() => update({ fields: [...costing.fields, { key: "", label: "", kind: "length" }] })} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                    <PlusIcon className="w-3.5 h-3.5" /> Add a field
                  </button>
                </div>
                {costing.fields.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-slate-400">No fields yet. Start with what your team writes down at the site.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {costing.fields.map((f, i) => (
                      <li key={i} className="px-4 py-2 grid grid-cols-[1fr_9rem_7rem_1fr_auto] gap-2 items-center">
                        <input
                          value={f.label}
                          placeholder="Label - Counter run"
                          onChange={(e) => setField(i, { label: e.target.value, key: f.key && f.key !== slug(f.label) ? f.key : slug(e.target.value) })}
                          className="px-2 py-1.5 text-sm border border-slate-200 rounded-md outline-none focus:border-blue-400"
                        />
                        <input
                          value={f.key}
                          placeholder="key_in_formulas"
                          onChange={(e) => setField(i, { key: e.target.value.toLowerCase() })}
                          className={cn("px-2 py-1.5 text-xs font-mono border rounded-md outline-none focus:border-blue-400", KEY_RE.test(f.key) ? "border-slate-200" : "border-red-300 bg-red-50")}
                        />
                        <select value={f.kind} onChange={(e) => setField(i, { kind: e.target.value as CostingField["kind"] })} className="px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white">
                          {(Object.keys(KIND_LABEL) as CostingField["kind"][]).map((k) => (
                            <option key={k} value={k}>{KIND_LABEL[k]}</option>
                          ))}
                        </select>
                        <input value={f.hint ?? ""} placeholder="Hint for whoever measures (optional)" onChange={(e) => setField(i, { hint: e.target.value })} className="px-2 py-1.5 text-xs border border-slate-200 rounded-md outline-none focus:border-blue-400" />
                        <span className="inline-flex items-center gap-0.5">
                          <button type="button" onClick={() => update({ fields: move(costing.fields, i, -1) })} className="p-1 rounded text-slate-400 hover:text-slate-700"><ArrowUpIcon className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => update({ fields: move(costing.fields, i, 1) })} className="p-1 rounded text-slate-400 hover:text-slate-700"><ArrowDownIcon className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => update({ fields: costing.fields.filter((_, k) => k !== i) })} className="p-1 rounded text-slate-400 hover:text-red-600"><TrashIcon className="w-3.5 h-3.5" /></button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Quantities */}
              <section className="rounded-lg border border-slate-200 bg-white">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">What you cost against</h2>
                    <p className="text-xs text-slate-500">A formula over the fields - and over quantities above it. <code className="text-[11px]">+ − × ÷ ( )</code>, and max, min, round, ceil, floor.</p>
                  </div>
                  <span className="flex-1" />
                  <button type="button" onClick={() => update({ quantities: [...costing.quantities, { key: "", label: "", unit_code: "sqft", formula: "" }] })} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                    <PlusIcon className="w-3.5 h-3.5" /> Add a quantity
                  </button>
                </div>
                {costing.quantities.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-slate-400">No quantities yet - shutter area, counter length, hinge count…</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {costing.quantities.map((q, i) => (
                      <li key={i} className="px-4 py-2 grid grid-cols-[1fr_9rem_5rem_1.6fr_6rem_auto] gap-2 items-center">
                        <input value={q.label} placeholder="Label - Shutter area" onChange={(e) => setQty(i, { label: e.target.value, key: q.key && q.key !== slug(q.label) ? q.key : slug(e.target.value) })} className="px-2 py-1.5 text-sm border border-slate-200 rounded-md outline-none focus:border-blue-400" />
                        <input value={q.key} placeholder="key" onChange={(e) => setQty(i, { key: e.target.value.toLowerCase() })} className={cn("px-2 py-1.5 text-xs font-mono border rounded-md outline-none focus:border-blue-400", KEY_RE.test(q.key) ? "border-slate-200" : "border-red-300 bg-red-50")} />
                        <select value={q.unit_code} onChange={(e) => setQty(i, { unit_code: e.target.value })} className="px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white">
                          {UNIT_CODES.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                        <input
                          value={q.formula}
                          placeholder="run_length * base_height"
                          onChange={(e) => setQty(i, { formula: e.target.value })}
                          className={cn("px-2 py-1.5 text-sm font-mono border rounded-md outline-none focus:border-blue-400", live.errors[q.key] ? "border-amber-300 bg-amber-50" : "border-slate-200")}
                          title={live.errors[q.key] ?? ""}
                        />
                        <span className={cn("text-xs tabular-nums text-right", live.errors[q.key] ? "text-amber-700" : "text-slate-700")} title={live.errors[q.key] ?? "With the sample measurement"}>
                          {live.errors[q.key] ? "…" : `${Math.round((live.values[q.key] ?? 0) * 100) / 100} ${q.unit_code}`}
                        </span>
                        <span className="inline-flex items-center gap-0.5">
                          <button type="button" onClick={() => update({ quantities: move(costing.quantities, i, -1) })} className="p-1 rounded text-slate-400 hover:text-slate-700"><ArrowUpIcon className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => update({ quantities: move(costing.quantities, i, 1) })} className="p-1 rounded text-slate-400 hover:text-slate-700"><ArrowDownIcon className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => update({ quantities: costing.quantities.filter((_, k) => k !== i) })} className="p-1 rounded text-slate-400 hover:text-red-600"><TrashIcon className="w-3.5 h-3.5" /></button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {problems.length > 0 && (
                  <ul className="px-4 py-2 border-t border-amber-100 bg-amber-50 text-xs text-amber-800 space-y-0.5">
                    {problems.map((p) => (
                      <li key={p}>· {p}</li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Priced per */}
              <section className="rounded-lg border border-slate-200 bg-white">
                <div className="px-4 py-3 border-b border-slate-100">
                  <h2 className="text-sm font-semibold text-slate-900">What each cost item is priced per</h2>
                  <p className="text-xs text-slate-500">
                    The cost items your quotation templates put on a {name || "component"} of this type. Leave one blank to keep it as it was: per piece, or per the component&rsquo;s one face.
                  </p>
                </div>
                {lines.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-slate-400">
                    No template lists cost items for this component type yet. Add them on a <Link href="/dashboard/quotations/templates" className="text-blue-600 hover:underline">quotation template</Link> and they appear here.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {lines.map((l) => (
                      <li key={l.cost_item_id} className="px-4 py-2 flex items-center gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-slate-800 truncate">{l.name}</span>
                          <span className="block text-[11px] text-slate-500">{l.category ?? "Uncategorised"} · catalogue unit {l.unit_code} · in {l.template_count} template{l.template_count === 1 ? "" : "s"}</span>
                        </span>
                        <select
                          value={l.quantity_key ?? ""}
                          onChange={(e) => {
                            setLines((prev) => prev.map((x) => (x.cost_item_id === l.cost_item_id ? { ...x, quantity_key: e.target.value || null } : x)));
                            setDirty(true);
                          }}
                          className="px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white min-w-[14rem]"
                        >
                          <option value="">As before (per piece / one face)</option>
                          {costing.quantities.map((q) => (
                            <option key={q.key} value={q.key}>per {q.label || q.key} ({q.unit_code})</option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* Sample measurement */}
            <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4 h-fit xl:sticky xl:top-24">
              <h2 className="text-sm font-semibold text-slate-900">Try it</h2>
              <p className="text-xs text-slate-500 mt-0.5 mb-3">Type a sample measurement (in feet) and watch the quantities on the left.</p>
              {costing.fields.length === 0 ? (
                <p className="text-xs text-slate-400">Add a field first.</p>
              ) : (
                <div className="space-y-2">
                  {costing.fields.filter((f) => KEY_RE.test(f.key)).map((f) => (
                    <label key={f.key} className="block text-xs text-slate-600">
                      {f.label || f.key}
                      <input
                        type="number"
                        value={sample[f.key] ?? ""}
                        onChange={(e) => setSample((s) => ({ ...s, [f.key]: e.target.value === "" ? 0 : Number(e.target.value) }))}
                        className="mt-0.5 w-full px-2 py-1 text-sm border border-slate-200 rounded-md bg-white outline-none focus:border-blue-400"
                      />
                    </label>
                  ))}
                </div>
              )}
            </aside>
          </div>
        )}
        <Toast message={notice?.message ?? null} variant={notice?.variant ?? "error"} onDismiss={() => setNotice(null)} />
      </PageContent>
    </PageLayout>
  );
}
