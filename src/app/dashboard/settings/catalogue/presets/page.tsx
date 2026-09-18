"use client";

/**
 * Settings → Catalogue → Presets: the curated starting points for a scope.
 *
 * A preset is a name and a list of "space type × count", each optionally
 * naming the components to put in every one of those spaces - blank means
 * "whatever declares it belongs there", which is what the add dialog defaults
 * to anyway. Sellers pick one on an empty scope and adjust; they cannot save
 * one from a lead (decided 2026-09-18, docs/plans/scope.md).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  RectangleStackIcon,
  XMarkIcon,
  EyeSlashIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/PageLayout";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { fetchConfigOnce, invalidateQuotationConfig } from "@/lib/quotations/config-cache";
import type { ScopePreset, ScopePresetItem } from "@/types/property-scope";

interface TypeOption {
  id: string;
  name: string;
  applicable_space_types?: string[] | null;
}

export default function ScopePresetsPage() {
  const { confirm, confirmDialog } = useConfirm();
  const [presets, setPresets] = useState<ScopePreset[]>([]);
  const [spaceTypes, setSpaceTypes] = useState<TypeOption[]>([]);
  const [componentTypes, setComponentTypes] = useState<TypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ScopePreset | "new" | null>(null);
  const [notice, setNotice] = useState<{ message: string; variant: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    const [p, st, ct] = await Promise.all([
      fetch("/api/scope-presets?all=1").then((r) => r.json()).catch(() => null),
      fetchConfigOnce<{ data?: TypeOption[] }>("/api/quotations/config/space-types").catch(() => null),
      fetchConfigOnce<{ data?: TypeOption[] }>("/api/quotations/config/component-types").catch(() => null),
    ]);
    if (p?.data) setPresets(p.data);
    if (st?.data) setSpaceTypes(st.data);
    if (ct?.data) setComponentTypes(ct.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    // setState happens after the fetches resolve; the rule cannot see through `load`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const spaceName = useMemo(() => new Map(spaceTypes.map((t) => [t.id, t.name])), [spaceTypes]);

  const afterChange = async () => {
    invalidateQuotationConfig();
    await load();
  };

  const toggleActive = async (p: ScopePreset) => {
    const res = await fetch(`/api/scope-presets/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !p.is_active }),
    });
    if (!res.ok) setNotice({ message: "Could not save", variant: "error" });
    await afterChange();
  };

  const remove = async (p: ScopePreset) => {
    if (!(await confirm({ title: `Delete "${p.name}"?`, message: "Scopes already started from it are untouched.", confirmLabel: "Delete", tone: "danger" }))) return;
    const res = await fetch(`/api/scope-presets/${p.id}`, { method: "DELETE" });
    if (!res.ok) setNotice({ message: "Could not delete", variant: "error" });
    else setNotice({ message: "Preset deleted", variant: "success" });
    await afterChange();
  };

  return (
    <PageLayout>
      <PageHeader
        title="Scope presets"
        subtitle="One click lays down the usual spaces and their components. Sellers pick one on an empty scope and adjust from there."
        basePath={{ label: "Settings", href: "/dashboard/settings" }}
        breadcrumbs={[{ label: "Catalogue", href: "/dashboard/settings/catalogue" }, { label: "Presets" }]}
        icon={<RectangleStackIcon className="w-4 h-4 text-white" />}
        iconBgClass="from-blue-500 to-blue-600"
        actions={
          <button type="button" onClick={() => setEditing("new")} className={cn(buttonVariants(), "inline-flex items-center gap-1.5")}>
            <PlusIcon className="w-4 h-4" /> New preset
          </button>
        }
      />
      <PageContent>
        {loading ? (
          <div className="h-40 rounded-lg bg-slate-100 animate-pulse" />
        ) : presets.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white px-6 py-14 text-center">
            <RectangleStackIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700">No presets yet</p>
            <p className="text-xs text-slate-500 mt-1">Start with the configurations you sell most - a 2 BHK, a kitchen on its own.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {presets.map((p) => (
              <section key={p.id} className={cn("rounded-lg border bg-white", p.is_active ? "border-slate-200" : "border-slate-200 opacity-60")}>
                <div className="px-4 py-3 border-b border-slate-100 flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-slate-900 truncate">{p.name}</h2>
                    {p.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{p.description}</p>}
                    {!p.is_active && <span className="inline-block mt-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">Hidden</span>}
                  </div>
                  <button type="button" title={p.is_active ? "Hide from sellers" : "Show to sellers"} onClick={() => void toggleActive(p)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                    {p.is_active ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                  <button type="button" title="Edit" onClick={() => setEditing(p)} className="p-1.5 rounded-md text-slate-400 hover:text-blue-700 hover:bg-blue-50">
                    <PencilSquareIcon className="w-4 h-4" />
                  </button>
                  <button type="button" title="Delete" onClick={() => void remove(p)} className="p-1.5 rounded-md text-slate-400 hover:text-red-700 hover:bg-red-50">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
                <ul className="px-4 py-3 space-y-1">
                  {p.items.map((it, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">
                        {spaceName.get(it.space_type_id) ?? "Unknown space"}
                        <span className="text-slate-400"> ×{it.count}</span>
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {it.component_type_ids ? `${it.component_type_ids.length} component${it.component_type_ids.length === 1 ? "" : "s"}` : "usual components"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-slate-500">
          Space and component types are on the <Link href="/dashboard/settings/catalogue" className="text-blue-600 hover:underline">Catalogue</Link>.
        </p>
        <Toast message={notice?.message ?? null} variant={notice?.variant ?? "error"} onDismiss={() => setNotice(null)} />
        {confirmDialog}
      </PageContent>

      {editing && (
        <PresetEditor
          preset={editing === "new" ? null : editing}
          spaceTypes={spaceTypes}
          componentTypes={componentTypes}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => {
            setEditing(null);
            setNotice({ message: msg, variant: "success" });
            await afterChange();
          }}
        />
      )}
    </PageLayout>
  );
}

function PresetEditor({
  preset,
  spaceTypes,
  componentTypes,
  onClose,
  onSaved,
}: {
  preset: ScopePreset | null;
  spaceTypes: TypeOption[];
  componentTypes: TypeOption[];
  onClose: () => void;
  onSaved: (message: string) => void | Promise<void>;
}) {
  const [name, setName] = useState(preset?.name ?? "");
  const [description, setDescription] = useState(preset?.description ?? "");
  const [items, setItems] = useState<ScopePresetItem[]>(
    preset?.items ?? [{ space_type_id: spaceTypes[0]?.id ?? "", count: 1, component_type_ids: null }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Which rows have their component list open. */
  const [openRows, setOpenRows] = useState<Set<number>>(new Set());

  const applicable = (spaceTypeId: string) =>
    componentTypes.filter((c) => !c.applicable_space_types?.length || c.applicable_space_types.includes(spaceTypeId));

  const update = (i: number, patch: Partial<ScopePresetItem>) =>
    setItems((prev) => prev.map((it, k) => (k === i ? { ...it, ...patch } : it)));

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError("Give the preset a name.");
    const clean = items.filter((it) => it.space_type_id);
    if (clean.length === 0) return setError("Add at least one space.");
    setSaving(true);
    const res = await fetch(preset ? `/api/scope-presets/${preset.id}` : "/api/scope-presets", {
      method: preset ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null, items: clean }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(json.error || "Could not save");
    await onSaved(preset ? "Preset saved" : "Preset created");
  };

  return (
    <Modal isOpen onClose={onClose} title={preset ? "Edit preset" : "New preset"} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3">
          <label className="text-xs text-slate-600">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="2 BHK modular" className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400" autoFocus />
          </label>
          <label className="text-xs text-slate-600">
            Description <span className="text-slate-400">(optional)</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What it suits, what it leaves out" className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400" />
          </label>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-slate-700">Spaces</p>
            <button type="button" onClick={() => setItems((p) => [...p, { space_type_id: spaceTypes[0]?.id ?? "", count: 1, component_type_ids: null }])} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
              <PlusIcon className="w-3.5 h-3.5" /> Add a space
            </button>
          </div>
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
            {items.map((it, i) => {
              const options = applicable(it.space_type_id);
              const explicit = it.component_type_ids;
              const open = openRows.has(i);
              return (
                <div key={i} className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <select value={it.space_type_id} onChange={(e) => update(i, { space_type_id: e.target.value, component_type_ids: null })} className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded-md bg-white outline-none focus:border-blue-400">
                      {spaceTypes.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <span className="text-xs text-slate-400">×</span>
                    <input type="number" min={1} max={20} value={it.count} onChange={(e) => update(i, { count: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} className="w-16 px-2 py-1.5 text-sm text-right border border-slate-200 rounded-md outline-none focus:border-blue-400" />
                    <button
                      type="button"
                      onClick={() => setOpenRows((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                      className={cn("text-[11px] px-2 py-1 rounded-md border", explicit ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:bg-slate-50")}
                      title="Which components go in each of these"
                    >
                      {explicit ? `${explicit.length} chosen` : "usual components"}
                    </button>
                    <button type="button" onClick={() => setItems((p) => p.filter((_, k) => k !== i))} className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50" title="Remove">
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                  {open && (
                    <div className="mt-2 ml-1 flex flex-wrap gap-1.5">
                      {options.length === 0 ? (
                        <span className="text-[11px] text-slate-400">No component types declare this space.</span>
                      ) : (
                        <>
                          <button type="button" onClick={() => update(i, { component_type_ids: null })} className={cn("px-2 py-0.5 text-[11px] rounded-full border", !explicit ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200")}>
                            Usual (all that belong here)
                          </button>
                          {options.map((c) => {
                            const on = explicit ? explicit.includes(c.id) : true;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  const base = explicit ?? options.map((o) => o.id);
                                  update(i, { component_type_ids: on ? base.filter((x) => x !== c.id) : [...base, c.id] });
                                }}
                                className={cn("px-2 py-0.5 text-[11px] rounded-full border", on ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200")}
                              >
                                {c.name}
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Blank components mean whatever declares it belongs in that space type - the same default the add dialog uses.</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={() => void save()} disabled={saving} className={cn(buttonVariants(), "disabled:opacity-60")}>
            {saving ? "Saving…" : preset ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
