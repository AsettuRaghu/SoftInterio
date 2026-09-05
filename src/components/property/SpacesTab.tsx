"use client";

/**
 * The Spaces tab: what rooms and areas the client wants work in.
 *
 * Written during the sales conversation and stored against the property, so
 * the same rows serve the quotation and later the project. Distinct from the
 * property facts on the Overview tab, which are an address and a size - this
 * is what is actually inside.
 *
 * Built as a shared component because the project side needs the identical
 * screen; its Rooms tab currently derives rooms from the approved quotation,
 * which is backwards.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { AddSpacesModal } from "./AddSpacesModal";
import {
  PlusIcon,
  TrashIcon,
  HomeModernIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Bars2Icon,
} from "@heroicons/react/24/outline";
import {
  MEASUREMENT_STATUS_LABELS,
  formatQualityTier,
  type PropertyScopeItem,
  type ScopeBulkEntry,
  type ScopeMeasurementUnit,
  type QualityTier,
} from "@/types/property-scope";

interface SpaceTypeOption {
  id: string;
  name: string;
  slug: string;
  is_container?: boolean;
  /** On component types: which space types this suits. Null means any. */
  applicable_space_types?: string[] | null;
}

interface SpacesTabProps {
  propertyId: string | null;
  readOnly?: boolean;
  /**
   * Called after a space or component is added or removed - never on a field
   * edit. The lead page deliberately does not pass it: reloading the whole
   * lead made the page flash on every blur, and nothing there depends on
   * scope. Kept for a caller that shows a count.
   */
  onChanged?: () => void;
}

export function SpacesTab({
  propertyId,
  readOnly = false,
  onChanged,
}: SpacesTabProps) {
  const { confirm, confirmDialog } = useConfirm();
  const [items, setItems] = useState<PropertyScopeItem[]>([]);
  const [spaceTypes, setSpaceTypes] = useState<SpaceTypeOption[]>([]);
  const [componentTypes, setComponentTypes] = useState<SpaceTypeOption[]>([]);
  // Read from the cost item catalogue, so a tier chosen here always matches
  // something that can actually be priced.
  const [qualityTiers, setQualityTiers] = useState<string[]>([]);
  // Which space is having components added, if any.
  const [addTarget, setAddTarget] = useState<
    { kind: "space" } | { kind: "component"; spaceId: string; spaceName: string }
  >({ kind: "space" });
  // Which spaces are open. Empty means everything is closed, which is the
  // default: a property with sixteen rooms is a list to scan, not a wall of
  // components to scroll past.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  // The name as it stood when the field was focused, so a rename can be
  // detected after onChange has already updated the row.
  const nameAtFocus = useRef<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }
    try {
      setError(null);
      const [scopeRes, typesRes, compRes, tiersRes] = await Promise.all([
        fetch(`/api/properties/${propertyId}/scope`),
        fetch("/api/quotations/config/space-types"),
        fetch("/api/quotations/config/component-types"),
        fetch("/api/quotations/config/quality-tiers"),
      ]);
      if (!scopeRes.ok) throw new Error("Failed to load property scope");
      const scope = await scopeRes.json();
      setItems(scope.items || []);
      // Both config endpoints return { data }.
      if (typesRes.ok) setSpaceTypes((await typesRes.json()).data || []);
      if (compRes.ok) setComponentTypes((await compRes.json()).data || []);
      if (tiersRes.ok) {
        const t = await tiersRes.json();
        setQualityTiers((t.tiers || []).map((x: { name: string }) => x.name));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Only the components that suit the space being added to.
   *
   * A component type with no spaces listed is unrestricted and always offered
   * - not classifying something should not make it disappear. Without this the
   * picker inside a Bedroom offers Kitchen Tall Unit.
   */
  const componentTypesForTarget = useMemo(() => {
    if (addTarget.kind !== "component") return componentTypes;
    const space = items.find((i) => i.id === addTarget.spaceId);
    const spaceTypeId = space?.space_type_id;
    if (!spaceTypeId) return componentTypes;
    return componentTypes.filter(
      (c) =>
        !c.applicable_space_types?.length ||
        c.applicable_space_types.includes(spaceTypeId)
    );
  }, [addTarget, componentTypes, items]);

  const containers = useMemo(
    () =>
      items
        .filter((i) => i.space_type?.is_container)
        .map((i) => ({ id: i.id, name: i.name })),
    [items]
  );

  // A row is a space or a component. Spaces sit at the root (or inside a
  // container, for architects); components always sit inside a space.
  const byOrder = (a: PropertyScopeItem, b: PropertyScopeItem) =>
    a.display_order - b.display_order;
  const roots = items
    .filter((i) => !i.parent_id && !i.component_type_id)
    .sort(byOrder);
  const childrenOf = (id: string) =>
    items.filter((i) => i.parent_id === id).sort(byOrder);

  /**
   * Saves one field. Edits are sent on blur rather than on every keystroke -
   * a seller adjusting five room sizes should not generate fifty requests.
   */
  const patchItem = async (
    item: PropertyScopeItem,
    updates: Partial<PropertyScopeItem>
  ) => {
    if (!propertyId) return;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, ...updates } : i))
    );
    try {
      setSavingId(item.id);
      const response = await fetch(
        `/api/properties/${propertyId}/scope/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }
    } catch (err) {
      // Put the row back the way it was rather than leaving a value on screen
      // that was never stored. Only this row is restored - reloading the whole
      // list would throw away anything else being edited.
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingId(null);
    }
  };

  /**
   * Writes a new order for one sibling list.
   *
   * Renumbers rather than swapping values: display_order is not unique - rows
   * created in separate batches can share a number - and swapping two equal
   * values does nothing. Only the rows whose position actually changed are
   * written.
   */
  const reorderSiblings = async (ordered: PropertyScopeItem[]) => {
    if (!propertyId || readOnly) return;

    const changed = ordered
      .map((row, position) => ({ row, position }))
      .filter(({ row, position }) => row.display_order !== position);

    if (changed.length === 0) return;

    const previous = items;
    const newOrderById = new Map(
      changed.map(({ row, position }) => [row.id, position])
    );
    setItems((prev) =>
      prev.map((i) =>
        newOrderById.has(i.id)
          ? { ...i, display_order: newOrderById.get(i.id)! }
          : i
      )
    );

    try {
      const results = await Promise.all(
        changed.map(({ row, position }) =>
          fetch(`/api/properties/${propertyId}/scope/${row.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ display_order: position }),
          })
        )
      );
      if (results.some((r) => !r.ok)) throw new Error("Failed to reorder");
    } catch (err) {
      setItems(previous);
      setError(err instanceof Error ? err.message : "Failed to reorder");
    }
  };

  /**
   * Drop handler.
   *
   * Siblings only - a component stays in its space and a space stays at the
   * root. Dragging a wardrobe into another bedroom is a different operation,
   * and one that would be easy to trigger by accident while reordering.
   */
  const handleDrop = (target: PropertyScopeItem) => {
    const draggedId = dragging;
    setDragging(null);
    setDragOverId(null);
    if (!draggedId || draggedId === target.id) return;

    const dragged = items.find((i) => i.id === draggedId);
    if (!dragged) return;
    if ((dragged.parent_id || null) !== (target.parent_id || null)) return;

    const siblings = target.parent_id
      ? childrenOf(target.parent_id)
      : roots;

    const from = siblings.findIndex((i) => i.id === draggedId);
    const to = siblings.findIndex((i) => i.id === target.id);
    if (from === -1 || to === -1) return;

    const reordered = [...siblings];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    void reorderSiblings(reordered);
  };

  const removeItem = async (item: PropertyScopeItem) => {
    if (!propertyId) return;
    const kids = childrenOf(item.id);
    const message = kids.length
      ? `Remove "${item.name}" and the ${kids.length} component${
          kids.length === 1 ? "" : "s"
        } inside it?`
      : `Remove "${item.name}"?`;
    if (
      !(await confirm({
        title: kids.length ? `Remove "${item.name}" and its contents?` : `Remove "${item.name}"?`,
        message: kids.length
          ? `The ${kids.length} component${kids.length === 1 ? "" : "s"} inside it will be removed too.`
          : undefined,
        confirmLabel: "Remove",
      }))
    ) {
      return;
    }

    // Children go with the parent in the database, so they go here too.
    const removedIds = new Set([item.id, ...kids.map((k) => k.id)]);
    const previous = items;
    setItems((prev) => prev.filter((i) => !removedIds.has(i.id)));

    try {
      const response = await fetch(
        `/api/properties/${propertyId}/scope/${item.id}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Failed to remove");
      onChanged?.();
    } catch (err) {
      setItems(previous);
      setError(err instanceof Error ? err.message : "Failed to remove");
    }
  };

  const addSpaces = async (
    entries: ScopeBulkEntry[],
    componentsBySpaceType: Record<string, string[]>
  ) => {
    if (!propertyId) return;
    const response = await fetch(`/api/properties/${propertyId}/scope`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries,
        components_by_space_type: componentsBySpaceType,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to add spaces");
    // The response carries the rows just created, so they can be appended
    // directly rather than refetching the whole scope.
    setItems((prev) => [...prev, ...(data.items || [])]);
    onChanged?.();
  };

  if (!propertyId) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
        <HomeModernIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-700 mb-1">
          No property linked yet
        </p>
        <p className="text-xs text-slate-500">
          Add the property details on the Overview tab first, then come back to
          list its spaces.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  // Only spaces that actually hold components can be collapsed, so the
  // control is driven by those rather than by every row.
  const collapsibleIds = roots
    .filter((r) => childrenOf(r.id).length > 0)
    .map((r) => r.id);
  const anyExpanded = collapsibleIds.some((id) => expanded.has(id));

  const toggleAll = () =>
    setExpanded(anyExpanded ? new Set() : new Set(collapsibleIds));

  const toggleCollapsed = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderRow = (item: PropertyScopeItem, depth = 0) => {
    const kids = childrenOf(item.id);
    const kidCount = kids.length;
    const isCollapsed = !expanded.has(item.id);
    return (
    <React.Fragment key={item.id}>
      <tr
        draggable={!readOnly}
        onDragStart={() => setDragging(item.id)}
        onDragEnd={() => {
          setDragging(null);
          setDragOverId(null);
        }}
        onDragOver={(e) => {
          // Only a sibling is a valid target, so the row highlights only when
          // dropping there would actually do something.
          const dragged = items.find((i) => i.id === dragging);
          if (!dragged || dragged.id === item.id) return;
          if ((dragged.parent_id || null) !== (item.parent_id || null)) return;
          e.preventDefault();
          setDragOverId(item.id);
        }}
        onDragLeave={() => setDragOverId((id) => (id === item.id ? null : id))}
        onDrop={() => handleDrop(item)}
        className={`border-b border-slate-100 transition-colors ${
          dragging === item.id
            ? "opacity-40"
            : dragOverId === item.id
            ? "bg-blue-50 border-blue-300"
            : "hover:bg-slate-50"
        }`}
      >
        <td className="px-3 py-2" style={{ paddingLeft: 12 + depth * 20 }}>
          <div className="flex items-center gap-2">
            {!readOnly && (
              <span
                title="Drag to reorder"
                className="shrink-0 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500"
              >
                <Bars2Icon className="w-3.5 h-3.5" />
              </span>
            )}
            {!item.component_type_id && (
              <button
                type="button"
                onClick={() => toggleCollapsed(item.id)}
                title={isCollapsed ? "Show components" : "Hide components"}
                className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
              >
                {isCollapsed ? (
                  <ChevronRightIcon className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDownIcon className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            {item.component_type_id && (
              <span className="w-5 shrink-0 text-slate-300 text-center">·</span>
            )}
            <input
              value={item.name}
              disabled={readOnly}
              onChange={(e) =>
                setItems((prev) =>
                  prev.map((i) =>
                    i.id === item.id ? { ...i, name: e.target.value } : i
                  )
                )
              }
              onFocus={(e) => {
                nameAtFocus.current = e.target.value;
              }}
              onBlur={(e) => {
                const value = e.target.value.trim();

                // Emptying a name is not a rename - put back what was there,
                // since the API rejects a blank one anyway.
                if (!value) {
                  setItems((prev) =>
                    prev.map((i) =>
                      i.id === item.id
                        ? { ...i, name: nameAtFocus.current }
                        : i
                    )
                  );
                  return;
                }

                // Compared against the value at focus, not against item.name.
                // onChange already wrote the typed text into items, so by the
                // time this runs item.name IS the new value - the old check
                // was always false and nothing was ever saved.
                if (value !== nameAtFocus.current) {
                  void patchItem(item, { name: value });
                }
              }}
              className="flex-1 min-w-0 w-full text-sm font-medium text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-400 rounded px-1.5 py-0.5 outline-none disabled:cursor-default"
            />
            {item.space_type?.is_container && (
              <span className="shrink-0 text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                container
              </span>
            )}
            {!item.component_type_id && !readOnly && (
              <button
                type="button"
                onClick={() => {
                  setAddTarget({
                    kind: "component",
                    spaceId: item.id,
                    spaceName: item.name,
                  });
                  setShowAdd(true);
                }}
                className="text-[11px] text-blue-600 hover:underline shrink-0"
              >
                + components
              </button>
            )}
            {!item.component_type_id && kidCount > 0 && (
              <span className="shrink-0 text-[10px] text-slate-400">
                {kidCount} component{kidCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2 text-xs text-slate-500">
          {item.component_type?.name || item.space_type?.name || "—"}
        </td>
        <td className="px-3 py-2">
          {item.component_type_id ? (
            <select
              value={item.quality_tier || ""}
              disabled={readOnly}
              onChange={(e) =>
                void patchItem(item, {
                  quality_tier: (e.target.value || null) as QualityTier | null,
                })
              }
              className="px-1.5 py-1 text-xs border border-slate-200 rounded bg-white outline-none focus:border-blue-400 disabled:border-transparent disabled:bg-transparent"
            >
              <option value="">—</option>
              {/* A tier already stored but no longer in the catalogue still
                  shows, so an edit elsewhere cannot silently blank it. */}
              {[
                ...new Set(
                  [...qualityTiers, item.quality_tier].filter(Boolean) as string[]
                ),
              ].map((t) => (
                <option key={t} value={t}>
                  {formatQualityTier(t)}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1">
            {(["length", "width"] as const).map((field, idx) => (
              <React.Fragment key={field}>
                {idx > 0 && <span className="text-slate-300 text-xs">×</span>}
                <input
                  type="number"
                  value={item[field] ?? ""}
                  disabled={readOnly}
                  placeholder="—"
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((i) =>
                        i.id === item.id
                          ? {
                              ...i,
                              [field]:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            }
                          : i
                      )
                    )
                  }
                  onBlur={(e) =>
                    void patchItem(item, {
                      [field]:
                        e.target.value === "" ? null : Number(e.target.value),
                    } as Partial<PropertyScopeItem>)
                  }
                  className="w-16 px-1.5 py-1 text-xs text-right border border-slate-200 rounded outline-none focus:border-blue-400 disabled:bg-transparent disabled:border-transparent"
                />
              </React.Fragment>
            ))}
            <select
              value={item.measurement_unit}
              disabled={readOnly}
              onChange={(e) =>
                void patchItem(item, {
                  measurement_unit: e.target.value as ScopeMeasurementUnit,
                })
              }
              className="px-1 py-1 text-xs border border-slate-200 rounded bg-white outline-none focus:border-blue-400 disabled:border-transparent disabled:bg-transparent"
            >
              {["ft", "m", "mm", "cm", "inch"].map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </td>
        <td className="px-3 py-2">
          {/* Rough numbers from a sales chat and confirmed numbers from a site
              visit look identical once typed, so the difference is recorded
              explicitly. */}
          <select
            value={item.measurement_status}
            disabled={readOnly}
            onChange={(e) =>
              void patchItem(item, {
                measurement_status: e.target
                  .value as PropertyScopeItem["measurement_status"],
              })
            }
            className={`px-1.5 py-0.5 text-[10px] font-medium rounded border outline-none ${
              item.measurement_status === "confirmed"
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {(
              Object.keys(MEASUREMENT_STATUS_LABELS) as Array<
                keyof typeof MEASUREMENT_STATUS_LABELS
              >
            ).map((k) => (
              <option key={k} value={k}>
                {MEASUREMENT_STATUS_LABELS[k]}
              </option>
            ))}
          </select>
        </td>
        <td className="px-3 py-2 text-right">
          {!readOnly && (
            <span className="inline-flex items-center gap-1.5">
            <button
              onClick={() => void removeItem(item)}
              disabled={savingId === item.id}
              title="Remove space"
              className="w-6.5 h-6.5 inline-flex items-center justify-center rounded-md border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:border-red-300 transition-all disabled:opacity-50"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
            </span>
          )}
        </td>
      </tr>
      {!isCollapsed && kids.map((child) => renderRow(child, depth + 1))}
    </React.Fragment>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Spaces in this property
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {items.length
              ? `${items.length} space${items.length === 1 ? "" : "s"} — used to build the quotation`
              : "What the client wants work in, room by room"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
        {/* One control rather than two: in a mixed state the useful action is
            to collapse whatever is still open. */}
        {collapsibleIds.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {anyExpanded ? (
              <>
                <ChevronUpIcon className="w-3.5 h-3.5" />
                Collapse all
              </>
            ) : (
              <>
                <ChevronDownIcon className="w-3.5 h-3.5" />
                Expand all
              </>
            )}
          </button>
        )}
        {!readOnly && (
          <button
            onClick={() => {
              setAddTarget({ kind: "space" });
              setShowAdd(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-all shrink-0"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Add Spaces
          </button>
        )}
        </div>
      </div>

      {error && (
        <div className="m-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {items.length === 0 ? (
        <div className="p-10 text-center">
          <HomeModernIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700 mb-1">
            No spaces listed yet
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add the rooms and areas the client wants work in. These carry
            through to the quotation and the project, so they only get entered
            once.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th
                  className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider"
                  style={{ width: "30%" }}
                >
                  Space
                </th>
                <th
                  className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider"
                  style={{ width: "14%" }}
                >
                  Type
                </th>
                <th
                  className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider"
                  style={{ width: "12%" }}
                >
                  Quality
                </th>
                <th
                  className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider"
                  style={{ width: "24%" }}
                >
                  Size
                </th>
                <th
                  className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider"
                  style={{ width: "12%" }}
                >
                  Measurement
                </th>
                <th className="px-3 py-2" style={{ width: "8%" }} />
              </tr>
            </thead>
            <tbody>{roots.map((item) => renderRow(item))}</tbody>
          </table>
        </div>
      )}

      <AddSpacesModal
        isOpen={showAdd}
        onClose={() => {
          setShowAdd(false);
          setAddTarget({ kind: "space" });
        }}
        target={addTarget}
        spaceTypes={spaceTypes}
        componentTypes={componentTypesForTarget}
        containers={containers}
        showQuickStarts={items.length === 0}
        onAdd={addSpaces}
      />
      {confirmDialog}
    </div>
  );
}

export default SpacesTab;
