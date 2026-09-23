"use client";

/**
 * The Scope tab: what we are doing for this customer - the rooms and areas
 * and what goes in them. Each row opens out to its own details, references,
 * discussion and change log; there is no scope-level thread - the lead's
 * Notes tab is for anything not about a particular space.
 *
 * Was "Spaces" until 2026-09-18; see docs/plans/scope.md.
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
import { fetchConfigOnce } from "@/lib/quotations/config-cache";
import { AddSpacesModal } from "./AddSpacesModal";
import { CheckIcon } from "@heroicons/react/24/outline";
import { hasCosting, readCosting, type ComponentCosting } from "@/lib/costing/component-costing";
import { missingMeasures } from "@/lib/scope/measured";
import { ScopeItemPanel } from "./ScopeItemPanel";
import { ApplyGradeButton } from "./ApplyGradeButton";
import {
  PlusIcon,
  TrashIcon,
  ChatBubbleLeftRightIcon,
  PresentationChartBarIcon,
  HomeModernIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,
  Bars2Icon,
} from "@heroicons/react/24/outline";
import {
  MEASUREMENT_STATUS_LABELS,
  SCOPE_OWNER_LABELS,
  type PropertyScopeItem,
  type ScopeOwner,
  type ScopeBulkEntry,
  type ScopeMeasurementUnit,
  type ScopePreset,
  scopeOwnerLabel,
} from "@/types/property-scope";

/**
 * The scope rows this tab last had, per property.
 *
 * Switching tabs unmounts the tab, so coming back re-ran the whole load and
 * sat on a spinner for it - the scope request is ~270ms of queries behind the
 * API guard's fixed ~650ms, so about a second every time, to show rows that had
 * not changed since the last look.
 *
 * Cached rows go on screen immediately and the fetch still runs behind them, so
 * the data is never stale for longer than one round trip. Same bargain the
 * calendar table already makes: stale rows for a moment beat an empty spinner.
 *
 * Keeping it in step needs no invalidation logic, because this tab already
 * treats `items` as the authority - every add, edit and delete updates it
 * directly rather than refetching - so the cache simply mirrors it.
 */
const scopeCache = new Map<string, PropertyScopeItem[]>();

interface SpaceTypeOption {
  id: string;
  name: string;
  slug: string;
  is_container?: boolean;
  /** On component types: which space types this suits. Null means any. */
  applicable_space_types?: string[] | null;
  /** On component types: the tenant's costing rule, when one is set. */
  config_schema?: Record<string, unknown> | null;
}

interface ScopeTabProps {
  propertyId: string | null;
  /** The lead or project this scope is being viewed from - where the floor
   *  plan is uploaded and filed. */
  linkedType: "lead" | "project";
  linkedId: string;
  readOnly?: boolean;
  /** ClientName_LeadNumber (or project number) - what uploads are named after. */
  namePrefix: string;
  /** The lead's stage. From Requirement discussion on (and on any project)
   *  the last space, and the last component of a space of ours, cannot be
   *  removed - the button says so instead of the server refusing after. */
  stage?: string | null;
  /**
   * Called after a space or component is added or removed - never on a field
   * edit. The lead page deliberately does not pass it: reloading the whole
   * lead made the page flash on every blur, and nothing there depends on
   * scope. Kept for a caller that shows a count.
   */
  onChanged?: () => void;
}

export function ScopeTab({
  propertyId,
  linkedType,
  linkedId,
  readOnly = false,
  namePrefix,
  stage = null,
  onChanged,
}: ScopeTabProps) {
  const keepFilled =
    linkedType === "project" || ["requirement_discussion", "proposal_discussion", "won"].includes(stage ?? "");
  const isOurs = (i: PropertyScopeItem) => !i.scope_owner || i.scope_owner === "us";
  /** Why this row cannot be removed right now, or null. */
  const removeBlock = (item: PropertyScopeItem): string | null => {
    if (!keepFilled) return null;
    if (!item.component_type_id) {
      const spaces = items.filter((i) => !i.parent_id && !i.component_type_id);
      return spaces.length <= 1 ? "At least one space is mandatory from Requirement discussion on." : null;
    }
    const parent = items.find((i) => i.id === item.parent_id);
    if (!parent || !isOurs(parent) || !isOurs(item)) return null;
    const siblings = items.filter((i) => i.parent_id === parent.id && isOurs(i));
    return siblings.length <= 1
      ? `${parent.name} keeps at least one component. Mark the space as the client's or excluded if nothing there is ours.`
      : null;
  };
  const { confirmDialog } = useConfirm();
  /**
   * ↑ / ↓ / Enter in a name or size field move to the same field on the
   * previous / next visible row, so a list can be filled top to bottom
   * without the mouse. Rows are rendered in visible order, so the DOM order
   * of the inputs is the row order. Arrow keys on a number input would
   * otherwise step the value.
   */
  const navKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown" && e.key !== "Enter") return;
    const el = e.currentTarget;
    const col = el.dataset.navCol;
    if (!col) return;
    const all = Array.from(document.querySelectorAll<HTMLInputElement>(`input[data-nav-col="${col}"]`));
    const i = all.indexOf(el);
    if (i < 0) return;
    const next = e.key === "ArrowUp" ? all[i - 1] : all[i + 1];
    e.preventDefault();
    if (next) {
      next.focus();
      next.select();
    } else {
      el.blur();
    }
  };
  // Every edit saves as it happens; this is the reassurance in the header.
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (state: "idle" | "saving" | "saved" | "failed") => {
    setSaveState(state);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (state === "saved") saveTimer.current = setTimeout(() => setSaveState("idle"), 2500);
  };
  const [items, setItems] = useState<PropertyScopeItem[]>([]);
  const [spaceTypes, setSpaceTypes] = useState<SpaceTypeOption[]>([]);
  const [componentTypes, setComponentTypes] = useState<SpaceTypeOption[]>([]);
  // Read from the cost item catalogue, so a tier chosen here always matches
  // something that can actually be priced.
  const [presets, setPresets] = useState<ScopePreset[]>([]);
  // A preset card on the empty state opens the add dialog already filled.
  const [presetToOpen, setPresetToOpen] = useState<ScopePreset | null>(null);
  // The space opened out in the side panel (and the component to expand in
  // it, when a component row was clicked); the walkthrough starts at the first.
  const [openTarget, setOpenTarget] = useState<{ spaceId: string; componentId: string | null } | null>(null);
  // Each component type's costing rule, for the sheet's measurement fields.
  const costingByType = useMemo(() => {
    const m = new Map<string, ComponentCosting>();
    for (const t of componentTypes) {
      const c = readCosting(t.config_schema);
      if (hasCosting(c)) m.set(t.id, c);
    }
    return m;
  }, [componentTypes]);
  /** What a component still needs measured - the same rule the gate uses. */
  const notMeasured = (item: PropertyScopeItem) =>
    item.component_type_id && (!item.scope_owner || item.scope_owner === "us")
      ? missingMeasures(item, costingByType.get(item.component_type_id))
      : [];

  const openItem = (id: string) => {
    const row = items.find((i) => i.id === id);
    if (!row) return;
    if (row.component_type_id && row.parent_id) setOpenTarget({ spaceId: row.parent_id, componentId: row.id });
    else setOpenTarget({ spaceId: row.id, componentId: null });
  };
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
  /** What a blanket action just did - green, and it clears itself. */
  const [notice, setNotice] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const loadedRef = useRef(false);
  /**
   * Rows removed on purpose, so a PATCH that loses the race to a DELETE
   * does not report a failure for a row the person meant to delete.
   */
  const removed = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }
    // Whatever this property showed last time, on screen now.
    const cached = scopeCache.get(propertyId);
    if (cached) {
      setItems(cached);
      setIsLoading(false);
    }
    try {
      setError(null);
      /*
       * Only the scope is genuinely per-property. The other three are
       * tenant-wide catalogue lists that change when somebody edits them on
       * the config screen, and this tab was refetching all of them every time
       * it was opened - three separate API routes, each paying the guard's
       * fixed cost (an Auth-server round trip plus a users lookup, ~650ms
       * together) before reading a row. See lib/quotations/config-cache.
       */
      const [scopeRes, types, comps, presetList] = await Promise.all([
        fetch(`/api/properties/${propertyId}/scope`),
        fetchConfigOnce<{ data?: SpaceTypeOption[] }>(
          "/api/quotations/config/space-types"
        ).catch(() => null),
        fetchConfigOnce<{ data?: SpaceTypeOption[] }>(
          "/api/quotations/config/component-types"
        ).catch(() => null),
        fetchConfigOnce<{ data?: ScopePreset[] }>("/api/scope-presets").catch(() => null),
      ]);
      if (!scopeRes.ok) throw new Error("Failed to load property scope");
      const scope = await scopeRes.json();
      setItems(scope.items || []);
      loadedRef.current = true;
      // Config is best-effort: a failure there leaves the pickers empty rather
      // than hiding the scope this tab exists to show.
      if (types) setSpaceTypes(types.data || []);
      if (comps) setComponentTypes(comps.data || []);
      if (presetList) setPresets(presetList.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * Mirror what is on screen, so the next visit starts from it. Guarded on the
   * load having completed: without that, the empty initial state would be
   * written over a good cache and the next open would paint nothing.
   */
  useEffect(() => {
    if (propertyId && loadedRef.current) {
      scopeCache.set(propertyId, items);
    }
  }, [propertyId, items]);

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
  // Cost-item rows (a component's chosen items) are not listed here; the
  // room sheet shows them. They still travel in `items` for the panel.
  const childrenOf = (id: string) =>
    items.filter((i) => i.parent_id === id && !i.cost_item_id).sort(byOrder);

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
      flash("saving");
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
      flash("saved");
    } catch (err) {
      // Deleting a row you were editing sends the blur's PATCH and the
      // DELETE together; whichever order they land in, the PATCH failing
      // against a row that is gone is the expected outcome, not a fault to
      // report over the delete that caused it.
      if (removed.current.has(item.id)) return;
      flash("failed");
      // Put the row back the way it was rather than leaving a value on screen
      // that was never stored. Only this row is restored - reloading the whole
      // list would throw away anything else being edited.
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      setError(err instanceof Error ? err.message : "Failed to save");
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
    const block = removeBlock(item);
    if (block) {
      setError(block);
      return;
    }
    const kids = childrenOf(item.id);

    // Children go with the parent in the database, so they go here too.
    const removedIds = new Set([item.id, ...kids.map((k) => k.id)]);
    const previous = items;
    for (const rid of removedIds) removed.current.add(rid);
    setItems((prev) => prev.filter((i) => !removedIds.has(i.id)));

    try {
      const response = await fetch(
        `/api/properties/${propertyId}/scope/${item.id}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to remove");
      }
      onChanged?.();
    } catch (err) {
      for (const rid of removedIds) removed.current.delete(rid);
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
              data-nav-col="name"
              onKeyDown={navKey}
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
            {(() => {
              const gaps = notMeasured(item);
              if (gaps.length === 0) return null;
              return (
                <button
                  type="button"
                  onClick={() => setOpenTarget({ spaceId: item.parent_id ?? item.id, componentId: item.id })}
                  title={`Not measured: ${gaps.join(", ")}. Anything priced per these comes out at nothing.`}
                  className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 hover:bg-amber-100"
                >
                  <ExclamationTriangleIcon className="w-3 h-3" />
                  {gaps.length} not measured
                </button>
              );
            })()}
            {(item.still_to_ask ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => setOpenTarget({ spaceId: item.parent_id ?? item.id, componentId: item.id })}
                title="Questions nobody has answered or marked not needed. Anything not chosen is a line the quotation will not carry."
                className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 hover:bg-amber-100"
              >
                <QuestionMarkCircleIcon className="w-3 h-3" />
                {item.still_to_ask} to ask
              </button>
            )}
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
                + components{kidCount > 0 && <span className="text-slate-400"> ({kidCount})</span>}
              </button>
            )}
          </div>
        </td>
        <td className="px-3 py-2 text-xs text-slate-500">
          {item.component_type?.name || item.space_type?.name || "—"}
        </td>
        <td className="px-3 py-2">
          {/* Who does this part. A kitchen is ours and its counter top the
              client's, so it sits on spaces and components alike. Grouped by
              this, the list is the document the client signs; a later "that
              was never in scope" is answered by the excluded rows. */}
          <div className="flex items-center gap-1">
            <select
              value={item.scope_owner ?? "us"}
              disabled={readOnly}
              onChange={(e) =>
                void patchItem(item, {
                  scope_owner: e.target.value as ScopeOwner,
                  ...(e.target.value !== "vendor" ? { scope_vendor_name: null } : {}),
                })
              }
              className={`px-1.5 py-0.5 text-[10px] font-medium rounded border outline-none disabled:opacity-100 ${
                item.scope_owner === "client"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : item.scope_owner === "vendor"
                    ? "bg-violet-50 text-violet-700 border-violet-200"
                    : item.scope_owner === "excluded"
                      ? "bg-slate-100 text-slate-500 border-slate-200 line-through"
                      : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              {(Object.keys(SCOPE_OWNER_LABELS) as ScopeOwner[]).map((k) => (
                <option key={k} value={k}>
                  {scopeOwnerLabel(k)}
                </option>
              ))}
            </select>
            {item.scope_owner === "vendor" && (
              <input
                type="text"
                value={item.scope_vendor_name ?? ""}
                disabled={readOnly}
                placeholder="who?"
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((i) =>
                      i.id === item.id ? { ...i, scope_vendor_name: e.target.value } : i
                    )
                  )
                }
                onBlur={(e) => {
                  const v = e.target.value.trim() || null;
                  if (v !== (item.scope_vendor_name ?? null)) {
                    void patchItem(item, { scope_vendor_name: v });
                  }
                }}
                className="w-20 px-1.5 py-0.5 text-[10px] border border-slate-200 rounded outline-none focus:border-blue-400 disabled:border-transparent disabled:bg-transparent"
              />
            )}
          </div>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1">
            {(item.component_type_id ? (["width", "height"] as const) : (["length", "width"] as const)).map((field, idx) => (
              <React.Fragment key={field}>
                {idx > 0 && <span className="text-slate-300 text-xs">×</span>}
                <input
                  type="number"
                  value={item[field] ?? ""}
                  disabled={readOnly}
                  placeholder="—"
                  data-nav-col={field}
                  onKeyDown={navKey}
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
          <span className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => openItem(item.id)}
              title="Open: finish, what the client supplies, references, discussion, changes"
              className="w-6.5 h-6.5 inline-flex items-center justify-center rounded-md border bg-white text-slate-500 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all"
            >
              <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
            </button>
          {!readOnly && (
            <button
              onClick={() => void removeItem(item)}
              disabled={!!removeBlock(item)}
              title={removeBlock(item) ?? (item.component_type_id ? "Remove component" : "Remove space")}
              className="w-6.5 h-6.5 inline-flex items-center justify-center rounded-md border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:border-red-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-50 disabled:hover:border-red-200"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          )}
          </span>
        </td>
      </tr>
      {!isCollapsed && kids.map((child) => renderRow(child, depth + 1))}
    </React.Fragment>
    );
  };

  return (
    <div className="space-y-4">
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Spaces and what goes in them
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {items.length
              ? `${items.length} row${items.length === 1 ? "" : "s"} — the quotation starts from these`
              : "Room by room, then the components inside each"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
        {/* Everything here saves as you go; this is the reassurance. */}
        <span
          className={`inline-flex items-center gap-1 text-[11px] transition-opacity ${saveState === "idle" ? "opacity-0" : "opacity-100"} ${
            saveState === "failed" ? "text-red-600" : saveState === "saving" ? "text-slate-400" : "text-emerald-600"
          }`}
          aria-live="polite"
        >
          {saveState === "saving" ? "Saving…" : saveState === "failed" ? "Not saved - try again" : <><CheckIcon className="w-3 h-3" /> Saved</>}
        </span>
        {roots.length > 0 && !readOnly && propertyId && (
          <ApplyGradeButton
            propertyId={propertyId}
            onApplied={async (message) => {
              setError(null);
              setNotice(message);
              await load();
            }}
          />
        )}
        {roots.length > 0 && (
          <a
            href={`/scope-summary/${propertyId}?${linkedType}=${linkedId}`}
            target="_blank"
            rel="noreferrer"
            title="A page for the customer: rooms, what is planned, the finishes chosen, their pictures - no prices"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <DocumentTextIcon className="w-3.5 h-3.5" />
            Customer summary
          </a>
        )}
        {roots.length > 0 && (
          <button
            type="button"
            onClick={() => setOpenTarget({ spaceId: roots[0].id, componentId: null })}
            title="Go through the scope space by space - for sitting with the customer"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <PresentationChartBarIcon className="w-3.5 h-3.5" />
            Walkthrough
          </button>
        )}
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
      {notice && (
        <div className="m-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start justify-between gap-3">
          <p className="text-sm text-emerald-800">{notice}</p>
          <button type="button" onClick={() => setNotice(null)} className="text-emerald-700 hover:text-emerald-900 text-xs shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="p-8 text-center">
          <HomeModernIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700 mb-1">
            No spaces listed yet
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add the rooms and areas the client wants work in. These carry
            through to the quotation and the project, so they only get entered
            once.
          </p>
          {!readOnly && presets.length > 0 && (
            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Start from a preset</p>
              <div className="flex flex-wrap justify-center gap-2">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setAddTarget({ kind: "space" });
                      setPresetToOpen(p);
                      setShowAdd(true);
                    }}
                    title={p.description ?? undefined}
                    className="px-3 py-2 text-left rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors min-w-[8rem]"
                  >
                    <span className="block text-sm font-semibold text-blue-800">{p.name}</span>
                    <span className="block text-[11px] text-blue-700/80">
                      {p.items.reduce((n, i) => n + i.count, 0)} spaces
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Opens the add dialog filled in — adjust, then add.</p>
            </div>
          )}
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
                  style={{ width: "14%" }}
                  title="Who does this part: us, the client, a vendor, or nobody"
                >
                  Done by
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
          setPresetToOpen(null);
        }}
        target={addTarget}
        spaceTypes={spaceTypes}
        componentTypes={componentTypesForTarget}
        containers={containers}
        presets={presets}
        showQuickStarts={items.length === 0}
        initialPreset={presetToOpen}
        onAdd={addSpaces}
      />
      {confirmDialog}
    </div>
    {openTarget && propertyId && (() => {
      const current = items.find((i) => i.id === openTarget.spaceId);
      if (!current) return null;
      return (
        <ScopeItemPanel
          key={`${openTarget.spaceId}:${openTarget.componentId ?? ""}`}
          item={current}
          items={items}
          propertyId={propertyId}
          linkedType={linkedType}
          linkedId={linkedId}
          readOnly={readOnly}
          focusComponentId={openTarget.componentId}
          namePrefix={namePrefix}
          costingByType={costingByType}
          onReload={() => void load()}
          onClose={() => setOpenTarget(null)}
          onNavigate={(i) => setOpenTarget({ spaceId: i.id, componentId: null })}
          onPatch={patchItem}
        />
      );
    })()}
    </div>
  );
}

export default ScopeTab;
