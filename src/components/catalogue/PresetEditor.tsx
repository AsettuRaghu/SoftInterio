"use client";

/**
 * The preset editor: a name and a list of "space type × count", each
 * optionally naming the components to put in every one of those spaces -
 * blank means "whatever declares it belongs there". Opened from the
 * Presets tab of the Catalogue, which lists presets in the same table as
 * the other tabs (2026-09-22). Sellers pick a preset on an empty scope and
 * adjust; they cannot save one from a lead (docs/plans/scope.md).
 */

import React, { useState } from "react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Modal } from "@/components/ui/Modal";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import type { ScopePreset, ScopePresetItem } from "@/types/property-scope";

interface TypeOption {
  id: string;
  name: string;
  applicable_space_types?: string[] | null;
}

export function PresetEditor({
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
