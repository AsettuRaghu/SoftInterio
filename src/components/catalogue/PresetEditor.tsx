"use client";

/**
 * The preset editor: a name and a list of "space type × count", each
 * optionally naming the components to put in every one of those spaces -
 * blank means "whatever declares it belongs there". Opened from the
 * Presets tab of the Catalogue, which lists presets in the same table as
 * the other tabs (2026-09-22). Sellers pick a preset on an empty scope and
 * adjust; they cannot save one from a lead (docs/plans/scope.md).
 *
 * **Which homes it is for is chosen here**, not inferred from the name
 * (2026-09-23). Qualification used to find a preset by looking for "3bhk"
 * inside its name, so renaming one silently stopped it being used. A preset
 * that names no configuration still falls back to its name, and the panel
 * says so rather than leaving it a mystery.
 */

import React, { useState } from "react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Modal } from "@/components/ui/Modal";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import type { ScopePreset, ScopePresetItem } from "@/types/property-scope";
import { CONFIGURATIONS, CONFIGURATION_LABELS } from "@/lib/scope/configuration";
import { PropertyTypeLabels } from "@/types/leads";

interface TypeOption {
  id: string;
  name: string;
  applicable_space_types?: string[] | null;
}

export function PresetEditor({
  preset,
  spaceTypes,
  componentTypes,
  packages = [],
  onClose,
  onSaved,
}: {
  preset: ScopePreset | null;
  spaceTypes: TypeOption[];
  componentTypes: TypeOption[];
  /** Answer the rooms as they are laid down, not just list them. */
  packages?: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (message: string) => void | Promise<void>;
}) {
  const [name, setName] = useState(preset?.name ?? "");
  const [description, setDescription] = useState(preset?.description ?? "");
  const [items, setItems] = useState<ScopePresetItem[]>(
    preset?.items ?? [{ space_type_id: spaceTypes[0]?.id ?? "", count: 1, component_type_ids: null }],
  );
  const [packageId, setPackageId] = useState<string>(preset?.package_id ?? "");
  const [configurations, setConfigurations] = useState<string[]>(preset?.configurations ?? []);
  const [propertyTypes, setPropertyTypes] = useState<string[]>(preset?.property_types ?? []);
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
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        items: clean,
        configurations,
        property_types: propertyTypes,
        package_id: packageId || null,
      }),
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

        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-700">
            Use this preset for
            <span className="ml-1 font-normal text-slate-400">
              which homes qualification lays it down on
            </span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CONFIGURATIONS.map((c) => {
              const on = configurations.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setConfigurations((prev) => (on ? prev.filter((x) => x !== c) : [...prev, c]))}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-full border transition-colors",
                    on ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400",
                  )}
                >
                  {CONFIGURATION_LABELS[c]}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs font-medium text-slate-700">
            Only for these kinds of property
            <span className="ml-1 font-normal text-slate-400">optional</span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(["villa", "independent_house", "farmhouse", "penthouse", "row_house", "duplex"] as const).map((t) => {
              const on = propertyTypes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPropertyTypes((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-full border transition-colors",
                    on ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400",
                  )}
                >
                  {PropertyTypeLabels[t]}
                </button>
              );
            })}
          </div>
          {packages.length > 0 && (
            <>
              <p className="mt-2 text-xs font-medium text-slate-700">
                Answer the rooms with
                <span className="ml-1 font-normal text-slate-400">optional - the walkthrough becomes a review</span>
              </p>
              <div className="mt-1.5">
                <SearchSelect
                  value={packageId}
                  onChange={setPackageId}
                  emptyLabel="Just list the rooms"
                  options={packages.map((p) => ({ value: p.id, label: p.name }))}
                  className="w-full sm:w-72"
                  buttonClassName="px-2.5 py-1.5 text-xs"
                />
              </div>
            </>
          )}
          <p className="mt-2 text-[11px] text-slate-400">
            {configurations.length === 0 && propertyTypes.length === 0
              ? "Nothing chosen - this preset is matched by its name instead, the way it worked before. Pick above so a rename cannot break it."
              : propertyTypes.length > 0
                ? "A preset naming a property type wins over one that does not, so a Villa preset beats the plain 4 BHK."
                : "Where two presets claim the same home, the one higher in the list wins."}
          </p>
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
                    <SearchSelect
                      value={it.space_type_id}
                      onChange={(v) => update(i, { space_type_id: v, component_type_ids: null })}
                      options={spaceTypes.map((t) => ({ value: t.id, label: t.name }))}
                      className="flex-1"
                      buttonClassName="px-2 py-1.5 rounded-md"
                    />
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
