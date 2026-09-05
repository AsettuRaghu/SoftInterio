"use client";

/**
 * Add spaces to a property's scope, by count.
 *
 * The whole point is that nobody types sixteen rooms. The seller sets numbers
 * against space types and everything is created in one action, pre-filled from
 * the property type so a 4BHK arrives already looking like a 4BHK.
 *
 * Rows are still created individually - "5 washrooms" becomes five rows -
 * because every room diverges later. That expansion happens server-side; this
 * screen only collects counts.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { XMarkIcon, MinusIcon, PlusIcon } from "@heroicons/react/24/outline";
import {
  SCOPE_QUICK_STARTS,
  SCOPE_QUICK_START_LABELS,
  type ScopeBulkEntry,
} from "@/types/property-scope";

interface SpaceTypeOption {
  id: string;
  name: string;
  slug: string;
  is_container?: boolean;
  /** On component types: the space types this suits. Null means any. */
  applicable_space_types?: string[] | null;
}

interface AddSpacesModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Adding components into one space rather than spaces into the property.
   * The grid, counting and numbering are identical; only the vocabulary and
   * the destination change, so one modal serves both.
   */
  target?: { kind: "space" } | { kind: "component"; spaceId: string; spaceName: string };
  spaceTypes: SpaceTypeOption[];
  componentTypes?: SpaceTypeOption[];

  /** Containers already in the scope, so a room can be put on a floor. */
  containers?: { id: string; name: string }[];
  /** Quick-start chips are only offered while the scope is still empty. */
  showQuickStarts?: boolean;
  onAdd: (
    entries: ScopeBulkEntry[],
    componentsBySpaceType: Record<string, string[]>
  ) => Promise<void>;
}

export function AddSpacesModal({
  isOpen,
  onClose,
  target = { kind: "space" },
  spaceTypes,
  componentTypes = [],
  containers = [],
  showQuickStarts = false,
  onAdd,
}: AddSpacesModalProps) {
  const addingComponents = target.kind === "component";
  const options = addingComponents ? componentTypes : spaceTypes;
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [parentId, setParentId] = useState<string>("");
  /**
   * Which components go into each space type being added.
   *
   * Seeded with everything that declares it belongs there, so pressing Add
   * without touching this behaves as "adopt the applicable components". The
   * list is here rather than after the fact because a bedroom matches all four
   * wardrobe variants - and un-ticking three once beats deleting twelve from
   * four bedrooms afterwards.
   */
  const [componentPicks, setComponentPicks] = useState<
    Record<string, string[]>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bySlug = useMemo(
    () => new Map(options.map((t) => [t.slug, t.id])),
    [options]
  );

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setParentId("");
    setCounts({});
    setComponentPicks({});
  }, [isOpen]);

  /** Components that declare they belong in this space type. */
  const applicableTo = useCallback(
    (spaceTypeId: string) =>
      componentTypes.filter((c) =>
        (c.applicable_space_types || []).includes(spaceTypeId)
      ),
    [componentTypes]
  );

  // Whenever a space type is given a count, adopt its components by default.
  useEffect(() => {
    if (addingComponents) return;
    setComponentPicks((prev) => {
      const next = { ...prev };
      for (const [typeId, n] of Object.entries(counts)) {
        if (n > 0 && next[typeId] === undefined) {
          next[typeId] = applicableTo(typeId).map((c) => c.id);
        }
        if (n === 0) delete next[typeId];
      }
      return next;
    });
  }, [counts, applicableTo, addingComponents]);

  /**
   * Fills the grid from a configuration the seller picks. Replaces rather than
   * adds, so clicking 3 BHK after 4 BHK gives three bedrooms instead of seven.
   */
  const applyQuickStart = (key: string) => {
    const preset = SCOPE_QUICK_STARTS[key];
    if (!preset) return;
    const seeded: Record<string, number> = {};
    for (const [slug, n] of Object.entries(preset)) {
      const id = bySlug.get(slug);
      if (id) seeded[id] = n;
    }
    setCounts(seeded);
  };

  if (!isOpen) return null;

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  // Components are created once per space, so four bedrooms with two picks
  // each means eight rows.
  const componentTotal = addingComponents
    ? 0
    : Object.entries(counts).reduce(
        (sum, [typeId, n]) => sum + n * (componentPicks[typeId]?.length || 0),
        0
      );

  const setCount = (id: string, value: number) =>
    setCounts((c) => ({ ...c, [id]: Math.max(0, Math.min(50, value)) }));

  const handleSubmit = async () => {
    const entries: ScopeBulkEntry[] = Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([typeId, count]) =>
        addingComponents
          ? {
              component_type_id: typeId,
              count,
              parent_id: (target as { spaceId: string }).spaceId,
            }
          : {
              space_type_id: typeId,
              count,
              parent_id: parentId || null,
            }
      );

    if (entries.length === 0) {
      setError("Set a count against at least one space");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      // Only for the space types actually being added.
      const picks: Record<string, string[]> = {};
      for (const [typeId, n] of Object.entries(counts)) {
        if (n > 0 && componentPicks[typeId]?.length) {
          picks[typeId] = componentPicks[typeId];
        }
      }
      await onAdd(entries, addingComponents ? {} : picks);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add spaces");
    } finally {
      setIsSaving(false);
    }
  };

  // Containers are laid out first: a floor is chosen before the rooms on it.
  const ordered = [...options].sort(
    (a, b) => Number(!!b.is_container) - Number(!!a.is_container)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[7vh]">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full max-h-[82vh] flex flex-col overflow-hidden ${
          addingComponents ? "max-w-xl" : "max-w-3xl"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {addingComponents ? "Add components" : "Add spaces"}
            </h2>
            {addingComponents && (
              <p className="text-xs text-slate-500 mt-0.5">
                Into {(target as { spaceName: string }).spaceName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {showQuickStarts && !addingComponents && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Start from a configuration
              </label>
              <div className="flex flex-wrap gap-1.5">
                {SCOPE_QUICK_START_LABELS.map((q) => (
                  <button
                    key={q.key}
                    type="button"
                    onClick={() => applyQuickStart(q.key)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Fills the counts below — adjust anything before adding.
              </p>
            </div>
          )}

          {containers.length > 0 && !addingComponents && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Add inside
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              >
                <option value="">The property itself</option>
                {containers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={addingComponents ? "" : "grid grid-cols-2 gap-4"}>
          <div>
            {!addingComponents && (
              <p className="text-xs font-medium text-slate-500 mb-1.5">
                How many of each
              </p>
            )}
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-72 overflow-y-auto">
            {ordered.map((type) => {
              const n = counts[type.id] || 0;
              return (
                <div
                  key={type.id}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <span className="text-sm text-slate-700">
                    {type.name}
                    {type.is_container && (
                      <span className="ml-2 text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                        can contain others
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCount(type.id, n - 1)}
                      disabled={n === 0}
                      className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <MinusIcon className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      value={n || ""}
                      onChange={(e) =>
                        setCount(type.id, Number(e.target.value) || 0)
                      }
                      placeholder="0"
                      className="w-12 text-center px-1 py-1 text-sm border border-slate-200 rounded-md outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setCount(type.id, n + 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          </div>

          {/* Right column: what goes inside whatever was chosen on the left.
              Previously this sat underneath, so the two halves read as
              unrelated steps rather than one decision. */}
          {!addingComponents && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">
                Components in each
              </p>
              <div className="border border-slate-200 rounded-xl max-h-72 overflow-y-auto p-3 space-y-4">
                {Object.entries(counts).filter(([, n]) => n > 0).length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    Choose a space on the left and its usual components appear
                    here.
                  </p>
                ) : (
                  Object.entries(counts)
                    .filter(([, n]) => n > 0)
                    .map(([typeId, n]) => {
                      const type = spaceTypes.find((t) => t.id === typeId);
                      const options = applicableTo(typeId);
                      if (!type) return null;
                      const picked = componentPicks[typeId] || [];
                      return (
                        <div key={typeId}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-slate-700">
                              {type.name}
                              <span className="ml-1 text-slate-400">x{n}</span>
                            </span>
                            {options.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setComponentPicks((prev) => ({
                                    ...prev,
                                    [typeId]:
                                      picked.length === options.length
                                        ? []
                                        : options.map((o) => o.id),
                                  }))
                                }
                                className="text-[11px] text-blue-600 hover:underline"
                              >
                                {picked.length === options.length
                                  ? "Clear"
                                  : "All"}
                              </button>
                            )}
                          </div>
                          {options.length === 0 ? (
                            <p className="text-[11px] text-slate-400">
                              No components are mapped to this space yet.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {options.map((o) => {
                                const on = picked.includes(o.id);
                                return (
                                  <button
                                    key={o.id}
                                    type="button"
                                    onClick={() =>
                                      setComponentPicks((prev) => ({
                                        ...prev,
                                        [typeId]: on
                                          ? picked.filter((x) => x !== o.id)
                                          : [...picked, o.id],
                                      }))
                                    }
                                    className={`px-2 py-1 text-xs font-medium rounded-md border transition-colors ${
                                      on
                                        ? "bg-blue-600 text-white border-blue-600"
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    }`}
                                  >
                                    {o.name}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {total > 0
              ? `${total} ${addingComponents ? "component" : "space"}${
                  total === 1 ? "" : "s"
                }${
                  componentTotal > 0 ? ` and ${componentTotal} components` : ""
                } will be added`
              : "Nothing selected yet"}
          </span>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || total === 0}
            >
              {isSaving ? "Adding..." : `Add ${total || ""}`.trim()}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddSpacesModal;
