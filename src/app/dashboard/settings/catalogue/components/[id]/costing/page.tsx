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
 *   Offers      what this component offers on the Scope Scope Sheet - the
 *               cost items a seller can pick for it - and what each one is
 *               priced per (`component_type_offers`). The one place the
 *               offer is decided; the Scope Sheet and the builder read it.
 *
 * Lengths are typed in whatever unit the row uses and are in feet inside a
 * formula, so multiplying two lengths gives square feet.
 */

import React, { use, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon, CalculatorIcon, XMarkIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/PageLayout";
import { Toast } from "@/components/ui/Toast";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { invalidateQuotationConfig } from "@/lib/quotations/config-cache";
import { quantify, validateCosting, KEY_RE, type ComponentCosting, type CostingField, type CostingQuantity } from "@/lib/costing/component-costing";
import { shapeOptions } from "@/lib/scope/options";

const UNIT_CODES = ["sqft", "rft", "nos", "set", "lot", "lumpsum", "kg", "ltr"];
const KIND_LABEL = { length: "Length", count: "Count", number: "Number" } as const;

interface LineRow {
  cost_item_id: string;
  name: string;
  unit_code: string;
  category: string | null;
  category_id: string | null;
  category_order: number;
  quantity_key: string | null;
  /** Prices itself with nothing to tap - the tenant's call, per item. */
  auto: boolean;
  ask_as: string | null;
}
interface CatalogueItem {
  id: string;
  name: string;
  unit_code: string;
  category: string | null;
  category_id: string | null;
  category_order: number;
}

const slug = (label: string) => label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[0-9]/, "n$&");

export default function ComponentCostingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [name, setName] = useState("");
  const [costing, setCosting] = useState<ComponentCosting | null>(null);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [picking, setPicking] = useState(false);
  const [pickSearch, setPickSearch] = useState("");
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
    setCatalogue(json.data.catalogue ?? []);
  }, [id]);

  useEffect(() => {
    // setState happens after the fetch resolves; the rule cannot see through `load`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const problems = useMemo(() => (costing ? validateCosting(costing) : []), [costing]);
  // How each offered item will behave on the Scope Sheet, from the same
  // rule the sheet and the quotation use.
  const shapes = useMemo(
    () => shapeOptions(lines.map((l) => ({ cost_item_id: l.cost_item_id, quantity_key: l.quantity_key, auto: l.auto, ask_as: l.ask_as })), lines.map((l) => ({ id: l.cost_item_id, category_id: l.category_id, unit_code: l.unit_code }))),
    [lines],
  );
  const behaviour = (costItemId: string) => {
    const sh = shapes.get(costItemId);
    if (!sh) return null;
    if (sh.auto) return { label: "Automatic", hint: "Priced from the measurement, nothing to tap - skipped when its quantity is 0", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    if (sh.counted) return { label: "Counted", hint: "In or out, with a × n", tone: "text-slate-600 bg-slate-50 border-slate-200" };
    const alone = !lines.some((o) => o.cost_item_id !== costItemId && shapes.get(o.cost_item_id)?.group_key === sh.group_key);
    if (alone) return { label: "Optional", hint: "Tap to include, tap again to leave out - the customer's choice", tone: "text-slate-700 bg-slate-50 border-slate-200" };
    return { label: "One of these", hint: "One of the items of its category priced the same way - choosing one replaces whichever was chosen before", tone: "text-blue-700 bg-blue-50 border-blue-200" };
  };

  // Adding and removing take effect at once - the offer is not part of Save,
  // which covers the rule and the priced-per dropdowns - so say so.
  const setLine = (costItemId: string, patch: Partial<Pick<LineRow, "quantity_key" | "auto" | "ask_as">>) => {
    setLines((prev) => prev.map((x) => (x.cost_item_id === costItemId ? { ...x, ...patch } : x)));
    setDirty(true);
  };

  const changeMenu = async (patch: { add?: string[]; remove?: string[] }, itemName?: string) => {
    const res = await fetch(`/api/quotations/config/component-types/${id}/costing`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setNotice({ message: json.error || "Could not change the offer", variant: "error" });
    invalidateQuotationConfig();
    await load();
    if (itemName) setNotice({ message: patch.add ? `${itemName} added - offered on every ${name || "component"} of this type from now` : `${itemName} taken off this component's offer`, variant: "success" });
  };
  const offered = useMemo(() => new Set(lines.map((l) => l.cost_item_id)), [lines]);
  const pickable = useMemo(() => {
    const q = pickSearch.trim().toLowerCase();
    return catalogue
      .filter((c) => !offered.has(c.id))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.category ?? "").toLowerCase().includes(q))
      .sort((a, b) => a.category_order - b.category_order || (a.category ?? "").localeCompare(b.category ?? "") || a.name.localeCompare(b.name));
  }, [catalogue, offered, pickSearch]);
  const live = useMemo(
    () => (costing ? quantify(costing, sample, "ft") : { values: {} as Record<string, number>, errors: {} as Record<string, string>, ruled: {} as Record<string, number>, overridden: [] as string[] }),
    [costing, sample],
  );

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
      body: JSON.stringify({ costing, lines: lines.map((l) => ({ cost_item_id: l.cost_item_id, quantity_key: l.quantity_key, auto: l.auto, ask_as: l.ask_as })) }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setNotice({ message: json.error || "Could not save", variant: "error" });
    invalidateQuotationConfig();
    setDirty(false);
    setNotice({ message: "Saved", variant: "success" });
  };

  return (
    <PageLayout isLoading={!costing} loadingText="Loading…">
      <PageHeader
        title={name || "Component"}
        subtitle="How this component is measured, what it offers on the Scope Sheet, and what each item is priced per. Lengths are in feet inside a formula, whatever unit was typed."
        basePath={{ label: "Settings", href: "/dashboard/settings" }}
        breadcrumbs={[
          { label: "Catalogue", href: "/dashboard/settings/catalogue" },
          // Back to the tab this page was opened from, not the Catalogue's first tab.
          { label: "Components", href: "/dashboard/settings/catalogue?tab=components" },
          { label: name || "Component" },
        ]}
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
                      <li key={i} className="px-4 py-2 grid grid-cols-[1fr_9rem_7rem_7rem_1fr_auto] gap-2 items-center">
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
                        <input
                          value={f.default ?? ""}
                          placeholder="Default"
                          title="What it is when nobody types anything: a number in the row's unit (a base unit 850 high, 0 for none), or a formula over the fields above it in feet (ceil(width / 2) is one door per two feet). A field with a default is never asked for."
                          onChange={(e) => {
                            const t = e.target.value.trim();
                            setField(i, { default: t === "" ? undefined : Number.isFinite(Number(t)) ? Number(t) : t });
                          }}
                          className={cn("w-28 px-2 py-1.5 text-xs border rounded-md outline-none focus:border-blue-400", typeof f.default === "string" ? "font-mono border-slate-200" : "text-right border-slate-200")}
                        />
                        <input value={f.hint ?? ""} placeholder="Hint for whoever measures (optional)" onChange={(e) => setField(i, { hint: e.target.value })} className="px-2 py-1.5 text-xs border border-slate-200 rounded-md outline-none focus:border-blue-400" />
                        <span className="inline-flex items-center gap-0.5">
                          <button type="button" onClick={() => update({ fields: move(costing.fields, i, -1) })} className="p-1 rounded text-slate-400 hover:text-slate-700"><ArrowUpIcon className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => update({ fields: move(costing.fields, i, 1) })} className="p-1 rounded text-slate-400 hover:text-slate-700"><ArrowDownIcon className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => update({ fields: costing.fields.filter((_, k) => k !== i) })} className="p-1 rounded text-slate-400 hover:text-red-600"><TrashIcon className="w-3.5 h-3.5" /></button>
                        </span>

                        {/* A count with a handful of sensible answers is a
                            question, not a number box: "Any blind corners?
                            None · One (L-shaped) · Two (U-shaped)". The seller
                            never types a number whose meaning they then have
                            to work out. Only counts, because asking a width
                            this way makes no sense. */}
                        {f.kind === "count" && (
                          <div className="col-span-6 pl-1 pt-1.5 mt-0.5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-start">
                            <input
                              value={f.question ?? ""}
                              placeholder='Ask it as a question, e.g. "Any blind corners?" (optional)'
                              title="With answers below, the Scope Sheet asks this instead of showing a number box."
                              onChange={(e) => setField(i, { question: e.target.value || undefined })}
                              className="px-2 py-1.5 text-xs border border-slate-200 rounded-md outline-none focus:border-blue-400"
                            />
                            <div className="flex flex-wrap items-center gap-1.5">
                              {(f.choices ?? []).map((ch, ci) => (
                                <span key={ci} className="inline-flex items-center rounded-md border border-slate-200 bg-white">
                                  <input
                                    type="number"
                                    value={ch.value}
                                    title="The number this answer means"
                                    onChange={(e) => {
                                      const next = [...(f.choices ?? [])];
                                      next[ci] = { ...ch, value: Number(e.target.value) || 0 };
                                      setField(i, { choices: next });
                                    }}
                                    className="w-12 px-1.5 py-1 text-xs text-right tabular-nums border-0 border-r border-slate-200 outline-none"
                                  />
                                  <input
                                    value={ch.label}
                                    placeholder="Label"
                                    onChange={(e) => {
                                      const next = [...(f.choices ?? [])];
                                      next[ci] = { ...ch, label: e.target.value };
                                      setField(i, { choices: next });
                                    }}
                                    className="w-28 px-1.5 py-1 text-xs outline-none"
                                  />
                                  <button
                                    type="button"
                                    title="Remove this answer"
                                    onClick={() => setField(i, { choices: (f.choices ?? []).filter((_, k) => k !== ci) })}
                                    className="px-1.5 py-1 text-slate-400 hover:text-red-600"
                                  >
                                    <XMarkIcon className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                              <button
                                type="button"
                                onClick={() => setField(i, { choices: [...(f.choices ?? []), { value: (f.choices?.length ?? 0), label: "" }] })}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 rounded-md border border-dashed border-blue-200 hover:bg-blue-50"
                              >
                                <PlusIcon className="w-3 h-3" /> Answer
                              </button>
                              {(f.choices?.length ?? 0) === 0 && (
                                <span className="text-[11px] text-slate-400">no answers - asked as a number box</span>
                              )}
                            </div>
                          </div>
                        )}
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

              {/* What it offers */}
              <section className="rounded-lg border border-slate-200 bg-white">
                <div className="px-4 py-3 border-b border-slate-100 flex items-start gap-3">
                  <div className="flex-1">
                    <h2 className="text-sm font-semibold text-slate-900">What it offers on the Scope Sheet</h2>
                    <p className="text-xs text-slate-500">
                      The items a seller can pick for a {name || "component"} of this type, what each is priced per, and how the Scope Sheet asks for it. <b>One of these</b> makes the items of a group answers to one question; <b>How many</b> is a thing you count with a × n; <b>Automatic</b> prices it from the measurement with nothing to tap, and is only right for a quantity that can be 0. Left to <b>work it out</b>, a per-piece item with no quantity is counted and everything else is a question. Adding and removing take effect at once; Save is for the rule and these dropdowns.
                    </p>
                  </div>
                  <button type="button" onClick={() => setPicking((p) => !p)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 shrink-0">
                    <PlusIcon className="w-3.5 h-3.5" /> Add items
                  </button>
                </div>
                {picking && (
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <div className="relative mb-2">
                      <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                      <input value={pickSearch} onChange={(e) => setPickSearch(e.target.value)} placeholder="Search the catalogue" className="w-full pl-8 pr-2 py-1.5 text-sm border border-slate-200 rounded-md bg-white outline-none focus:border-blue-400" />
                    </div>
                    {pickable.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">Nothing else to add.</p>
                    ) : (
                      <div className="max-h-64 overflow-y-auto flex flex-wrap gap-1.5">
                        {pickable.map((c) => (
                          <button key={c.id} type="button" onClick={() => void changeMenu({ add: [c.id] }, c.name)} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border border-dashed border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800" title={`${c.category ?? "Uncategorised"} · ${c.unit_code}`}>
                            <PlusIcon className="w-3 h-3" />
                            {c.name}
                            <span className="text-[9px] text-slate-400">{c.category}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {lines.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-slate-400">This component offers nothing yet - add items from the catalogue and they appear on every Scope Sheet that has one.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {lines.map((l) => {
                      const b = behaviour(l.cost_item_id);
                      return (
                        <li key={l.cost_item_id} className="px-4 py-2 flex items-center gap-3">
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm text-slate-800 truncate">{l.name}</span>
                            <span className="block text-[11px] text-slate-500">{l.category ?? "Uncategorised"} · catalogue unit {l.unit_code}</span>
                          </span>
                          {b && <span className={cn("shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border", b.tone)} title={b.hint}>{b.label}</span>}
                          <select
                            value={l.quantity_key ?? ""}
                            onChange={(e) => setLine(l.cost_item_id, { quantity_key: e.target.value || null, ...(e.target.value ? {} : { auto: false }) })}
                            className="px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white min-w-[14rem]"
                          >
                            <option value="">Per piece / one face</option>
                            {costing.quantities.map((q) => (
                              <option key={q.key} value={q.key}>per {q.label || q.key} ({q.unit_code})</option>
                            ))}
                          </select>
                          {/* How the sheet asks for it, said rather than
                              deduced from the unit and the priced-per - which
                              nobody could guess, and which could not express a
                              per-piece family like four drawer grades wanting
                              to be one question (2026-09-24). Automatic needs
                              something to be automatic from, so it is only
                              offered once a quantity is chosen. */}
                          <select
                            value={l.ask_as ?? ""}
                            onChange={(e) => {
                              const v = e.target.value || null;
                              setLine(l.cost_item_id, { ask_as: v, auto: v === "auto" });
                            }}
                            title="One of these: several answers to one question. How many: a thing you count. Automatic: priced from the measurement with nothing to tap - only right for a quantity that can be 0."
                            className="px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white min-w-[10rem]"
                          >
                            <option value="">Asked as: work it out</option>
                            <option value="one_of">One of these</option>
                            <option value="count">How many</option>
                            <option value="auto" disabled={!l.quantity_key}>Automatic</option>
                          </select>
                          <button type="button" onClick={() => void changeMenu({ remove: [l.cost_item_id] }, l.name)} className="p-1 text-slate-400 hover:text-red-600 rounded" title="Take off this component's offer">
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </li>
                      );
                    })}
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
