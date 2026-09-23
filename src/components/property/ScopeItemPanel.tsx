"use client";

/**
 * One room sheet: a space opened out, with its components inside it. A
 * slide-over from the right, so the list stays behind it, with Previous /
 * Next so a meeting can walk the scope room by room. No tabs (2026-09-18,
 * after a tabbed version with the same headings at two depths read as
 * noise):
 *
 *   the room       pictures (Documents filed under the lead or project,
 *                  tagged `space: …`; library entries pinned) and a thread
 *   each component its options - the cost items the quotation templates
 *                  list for its type, considered or chosen, never priced
 *                  here; for a client/vendor row what is arriving and by
 *                  when; pictures; thread
 *
 * Threads fold behind their counts. A thread entry can be a decision, and
 * "needs rework" becomes a task - that is where rework lives. The change log
 * the trigger writes is kept but not shown here.
 *
 * Tenant team only. Nothing here is customer-facing (docs/plans/scope.md).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpTrayIcon,
  BookmarkIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PhotoIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolidIcon } from "@heroicons/react/24/solid";
import { cn } from "@/utils/cn";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { scopeOwnerLabel, type PropertyScopeItem } from "@/types/property-scope";
import { ScopeDiscussion } from "./ScopeDiscussion";
import { MediaViewer, type MediaItem } from "@/components/ui/MediaViewer";
import { defaultMeasures, mergeMeasures, quantify, splitMeasures, type ComponentCosting } from "@/lib/costing/component-costing";
import { missingMeasures } from "@/lib/scope/measured";
import { questionsOf, stillToAsk } from "@/lib/scope/questions";


interface RefDoc {
  id: string;
  file_name: string;
  file_type: string | null;
  title: string | null;
  signed_url?: string | null;
  created_at: string;
  is_starred?: boolean;
}

interface LibraryEntryLite {
  id: string;
  title: string;
  kind?: string;
  style_code?: string | null;
  images: { url: string | null }[];
  is_starred?: boolean;
}

/** Starred first, then as they were. */
const starredFirst = <T extends { is_starred?: boolean }>(list: T[]) =>
  [...list].sort((a, b) => Number(!!b.is_starred) - Number(!!a.is_starred));



/** The four tabs for one row - a space's own, or a component's inside it. */
/** A thread folded behind its counts; opens to read and post. */
function Thread({
  label,
  scopeItemId,
  propertyId,
  linkedType,
  linkedId,
  readOnly,
  confirm,
  defaultOpen = false,
}: {
  label: string;
  scopeItemId: string;
  propertyId: string;
  linkedType: "lead" | "project";
  linkedId: string;
  readOnly: boolean;
  confirm: ReturnType<typeof useConfirm>["confirm"];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [counts, setCounts] = useState<{ notes: number; decisions: number } | null>(null);
  const onCount = useCallback((c: { notes: number; decisions: number }) => setCounts(c), []);
  const summary = counts
    ? [counts.decisions ? `${counts.decisions} decision${counts.decisions === 1 ? "" : "s"}` : null, counts.notes ? `${counts.notes} note${counts.notes === 1 ? "" : "s"}` : null]
        .filter(Boolean)
        .join(" · ") || "no entries yet"
    : "";
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50">
        <ChatBubbleLeftRightIcon className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        <span className="text-[11px] text-slate-500">{summary}</span>
        <span className="flex-1" />
        <ChevronRightIcon className={cn("w-4 h-4 text-slate-400 transition-transform", open && "rotate-90")} />
      </button>
      {/* Mounted even when closed, so the counts are known; hidden, not unmounted. */}
      <div className={cn("border-t border-slate-100", !open && "hidden")}>
        <ScopeDiscussion scopeItemId={scopeItemId} propertyId={propertyId} linkedType={linkedType} linkedId={linkedId} readOnly={readOnly} confirm={confirm} onCountChange={onCount} />
      </div>
    </div>
  );
}

/**
 * What a component can carry - the cost items its type offers,
 * grouped by category - and what the customer prefers. Three kinds of item,
 * decided in `lib/scope/options` and drawn differently:
 *
 *   exclusive  several answers to one decision (four carcass grades). Tap
 *              one: it is ① and the previous ① slides to ② by itself. Tap
 *              the ① again to clear it; tap the ② to drop the fallback.
 *              Your last tap is your first choice.
 *   counted    in or out, with a "× n" - a tray, a pull-out. No preference.
 *   auto       the only item that follows a rule quantity (Shelf per
 *              shelves): priced from the measurement, nothing to tap.
 *
 * Every tap changes the screen at once and nothing repaints afterwards: the
 * one-①-one-② rule is applied locally (the same rule the database keeps),
 * the save goes out behind it, and only a failure re-reads. The tier shows
 * as a word so the seller can steer to the budget; no prices here - this
 * sheet is shown with the customer.
 *
 * On a project the item also carries who does it (Us / Client): the hob in
 * "Appliances" is the customer's, the chimney is ours.
 */
interface OptionItem {
  cost_item_id: string;
  name: string;
  tier: string | null;
  unit_code: string;
  counted: boolean;
  group_key: string | null;
  quantity_key: string | null;
  auto: boolean;
  quantity: number | null;
  status: "p1" | "p2" | null;
  row_id: string | null;
  scope_owner: string | null;
}
interface OptionGroup {
  /** `question` is how the sheet asks for it; blank falls back to "Which <name>?". */
  category: { id: string; name: string; question?: string | null; decision?: string | null };
  items: OptionItem[];
}

const TIER: Record<string, string> = { basic: "Basic", standard: "Standard", premium: "Premium", luxury: "Luxury" };

/** What a question is called - the same key `lib/scope/questions` counts by. */
const keyOf = (o: { group_key: string | null; cost_item_id: string }) => o.group_key ?? o.cost_item_id;

/**
 * A count with a handful of sensible answers is a question, not a number
 * box: "Any blind corners? None · One (L) · Two (U)". The seller never types
 * a number they then have to interpret.
 *
 * Module level, and it has to stay there. It was declared inside the render
 * block *below* the three lines that read it, which TypeScript cannot catch
 * - the reads are inside arrow functions, so it cannot know when they run -
 * and every expansion of a component with a costing rule threw "Cannot
 * access 'CHOICES' before initialization" (2026-09-23).
 */
const CHOICES: Record<string, { value: number; label: string }[]> = {
  corners: [
    { value: 0, label: "None" },
    { value: 1, label: "One (L-shaped)" },
    { value: 2, label: "Two (U-shaped)" },
  ],
  exposed_sides: [
    { value: 0, label: "None" },
    { value: 1, label: "One end" },
    { value: 2, label: "Both ends" },
  ],
  wall_exposed_sides: [
    { value: 0, label: "None" },
    { value: 1, label: "One end" },
    { value: 2, label: "Both ends" },
  ],
};

function Options({
  item,
  propertyId,
  readOnly,
  onChanged,
  showOwner,
  costing = null,
  onQuestions,
}: {
  item: PropertyScopeItem;
  propertyId: string;
  readOnly: boolean;
  /** The list behind the sheet mirrors the chosen items on the row; called quietly, after a pause. */
  onChanged: () => void;
  /** Done-by per item - shown on a project, where it is decided. */
  showOwner: boolean;
  /** The rule, for naming what an auto item follows. */
  costing?: ComponentCosting | null;
  /** How many questions are still to ask, as the taps happen. */
  onQuestions?: (n: number) => void;
}) {
  const [groups, setGroups] = useState<OptionGroup[] | null>(null);
  const [fromTemplates, setFromTemplates] = useState(true);
  /** Questions answered with "no". Stored, so an unasked question is tellable from a declined one. */
  const [declined, setDeclined] = useState<Set<string>>(new Set());
  // Pictures of the offered items (Design Library entries under them), read
  // once per component: a chip with pictures shows a thumbnail, and opens
  // the viewer - acrylic against laminate, while the customer is choosing.
  const [pictures, setPictures] = useState<Record<string, { entry_id: string; url: string; title: string }[]>>({});
  const [viewing, setViewing] = useState<{ items: { id: string; name: string; url: string; type: string; caption?: string | null }[]; index: number } | null>(null);
  const seq = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/properties/${propertyId}/scope/${item.id}/options`);
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      const gs: OptionGroup[] = json.data?.groups ?? [];
      setGroups(gs);
      setFromTemplates(json.data?.from_templates !== false);
      setDeclined(new Set<string>(json.data?.declined ?? []));
      const ids = gs.flatMap((g) => g.items.map((o) => o.cost_item_id));
      if (ids.length) {
        const pr = await fetch(`/api/library/cost-item-pictures?ids=${ids.join(",")}`);
        const pj = await pr.json().catch(() => ({}));
        if (pr.ok) setPictures(pj.data ?? {});
      }
    } else setGroups([]);
  }, [propertyId, item.id]);

  useEffect(() => {
    // setState happens after the fetch resolves; the rule cannot see through `load`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Counted here from what is drawn, but by `lib/scope/questions` - the
  // same rules the Scope list and the stage gate use, so the amber number
  // on the row and the refusal at the gate cannot disagree with the sheet.
  const toAsk = useMemo(() => {
    if (!groups) return null;
    const offers = groups.flatMap((g) => g.items.map((o) => ({ cost_item_id: o.cost_item_id, quantity_key: o.quantity_key, auto: o.auto })));
    const menu = groups.flatMap((g) => g.items.map((o) => ({ id: o.cost_item_id, category_id: g.category.id, unit_code: o.unit_code, decision: g.category.decision ?? null })));
    const picked = groups.flatMap((g) => g.items.filter((o) => o.status).map((o) => o.cost_item_id));
    return stillToAsk(questionsOf(offers, menu, picked, declined));
  }, [groups, declined]);
  useEffect(() => {
    if (toAsk !== null) onQuestions?.(toAsk);
  }, [toAsk, onQuestions]);

  /** Applies a local change to every item at once, then saves the one that was tapped. */
  const apply = (
    next: (items: OptionItem[]) => OptionItem[],
    tapped: { cost_item_id?: string; status?: "p1" | "p2" | null; scope_owner?: string; quantity?: number | null; decision_key?: string; declined?: boolean },
  ) => {
    setGroups((prev) => (prev ?? []).map((g) => ({ ...g, items: next(g.items) })));
    if (tapped.decision_key) {
      const key = tapped.decision_key;
      setDeclined((prev) => {
        const n = new Set(prev);
        if (tapped.declined === false) n.delete(key);
        else n.add(key);
        return n;
      });
    }
    const mine = ++seq.current;
    void (async () => {
      const res = await fetch(`/api/properties/${propertyId}/scope/${item.id}/options`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tapped),
      });
      if (mine !== seq.current) return;
      if (!res.ok) void load();
      else {
        // Tell the list once the tapping has paused, not on every tap.
        if (settle.current) clearTimeout(settle.current);
        settle.current = setTimeout(onChanged, 900);
      }
    })();
  };

  /** Exclusive: your last tap is ①; the previous ① becomes ②; tap ① or ② to clear. */
  const tapExclusive = (o: OptionItem) => {
    if (readOnly) return;
    if (o.status) {
      apply((items) => items.map((x) => (x.cost_item_id === o.cost_item_id ? { ...x, status: null } : x)), { cost_item_id: o.cost_item_id, status: null });
      return;
    }
    apply(
      (items) =>
        items.map((x) => {
          if (x.cost_item_id === o.cost_item_id) return { ...x, status: "p1" as const };
          if (x.group_key !== o.group_key) return x;
          if (x.status === "p1") return { ...x, status: "p2" as const };
          if (x.status === "p2") return { ...x, status: null };
          return x;
        }),
      { cost_item_id: o.cost_item_id, status: "p1", decision_key: keyOf(o), declined: false },
    );
  };
  /** Counted: in with a count, or out. */
  const setCounted = (o: OptionItem, quantity: number | null) => {
    if (readOnly) return;
    const status = quantity ? ("p1" as const) : null;
    apply(
      (items) => items.map((x) => (x.cost_item_id === o.cost_item_id ? { ...x, status, quantity } : x)),
      { cost_item_id: o.cost_item_id, status, quantity, ...(quantity ? { decision_key: keyOf(o), declined: false } : {}) },
    );
  };

  /** "Not needed" / "No": record the decline and clear whatever was picked. */
  const decline = (key: string, items: OptionItem[]) => {
    if (readOnly) return;
    const ids = new Set(items.map((x) => x.cost_item_id));
    const picked = items.filter((x) => x.status);
    apply(
      (all) => all.map((x) => (ids.has(x.cost_item_id) ? { ...x, status: null, quantity: null } : x)),
      picked.length
        ? { cost_item_id: picked[0].cost_item_id, status: null, decision_key: key, declined: true }
        : { decision_key: key, declined: true },
    );
    // More than one was picked: clear the rest too.
    for (const extra of picked.slice(1)) {
      void fetch(`/api/properties/${propertyId}/scope/${item.id}/options`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cost_item_id: extra.cost_item_id, status: null }),
      });
    }
  };
  const setOwner = (o: OptionItem, scope_owner: string) => {
    apply((items) => items.map((x) => (x.cost_item_id === o.cost_item_id ? { ...x, scope_owner } : x)), { cost_item_id: o.cost_item_id, status: o.status, scope_owner });
  };
  const quantityLabel = (key: string | null) => costing?.quantities.find((q) => q.key === key)?.label ?? key ?? "";
  const showPictures = (o: OptionItem, index = 0) => {
    const pics = pictures[o.cost_item_id] ?? [];
    if (!pics.length) return;
    setViewing({ items: pics.map((p) => ({ id: p.entry_id, name: o.name, url: p.url, type: "image/jpeg" })), index });
  };
  // Every picture of every option in a group, captioned by the option - the
  // finishes side by side, for the conversation at the showroom table.
  const compare = (g: OptionGroup) => {
    const items = g.items.flatMap((o) => (pictures[o.cost_item_id] ?? []).map((p) => ({ id: p.entry_id, name: o.name, url: p.url, type: "image/jpeg", caption: o.status === "p1" ? "First preference" : o.status === "p2" ? "Second preference" : null })));
    if (items.length) setViewing({ items, index: 0 });
  };
  // Pictures stay out of the way: a small "N pictures" link shows when the
  // pointer is over the item (always, where there is no pointer to hover),
  // and opens the viewer. Thumbnails in the row were tried and read as
  // clutter next to forty options.
  const thumb = (o: OptionItem) => {
    const pics = pictures[o.cost_item_id];
    if (!pics?.length) return null;
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); showPictures(o); }}
        title={`See ${pics.length} picture${pics.length === 1 ? "" : "s"} of ${o.name}`}
        className="shrink-0 inline-flex items-center gap-0.5 text-[10px] text-blue-600 hover:underline opacity-0 group-hover/opt:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
      >
        <PhotoIcon className="w-3 h-3" />
        {pics.length}
      </button>
    );
  };

  if (groups === null) return <p className="text-xs text-slate-400">Loading options…</p>;
  if (groups.length === 0) {
    return (
      <p className="text-xs text-slate-400">
        {fromTemplates ? "No options for this component." : "This kind of component offers nothing yet - add items on its page under Settings → Catalogue → Components."}
      </p>
    );
  }

  // Render helpers, CALLED rather than rendered as elements: a component
  // defined inside another is a new type each render and would remount.
  const tier = (o: OptionItem, on: boolean) =>
    o.tier && TIER[o.tier.toLowerCase()] ? <span className={cn("text-[9px] uppercase tracking-wider", on ? "text-emerald-100" : "text-slate-400")}>{TIER[o.tier.toLowerCase()]}</span> : null;
  const owner = (o: OptionItem) =>
    !showOwner || !o.status ? null : readOnly ? (
      o.scope_owner && o.scope_owner !== "us" ? <span className="ml-1 text-[10px] text-amber-700">{scopeOwnerLabel(o.scope_owner as "client")}</span> : null
    ) : (
      <select value={o.scope_owner ?? "us"} onChange={(e) => setOwner(o, e.target.value)} title="Who does this item" className="ml-1 text-[10px] border border-slate-200 rounded px-1 py-0.5 bg-white text-slate-600">
        <option value="us">Us</option>
        <option value="client">Client</option>
        <option value="vendor">Vendor</option>
        <option value="excluded">Not in scope</option>
      </select>
    );

  return (
    <div className="space-y-2.5">
      {groups.map((g) => {
        const autos = g.items.filter((o) => o.auto);
        const counted = g.items.filter((o) => o.counted);
        // A category can hold more than one decision - a kitchen's shutters
        // and its exposed side finish are both "Shutters by finish" but are
        // priced per different quantities, so they are two questions. Group
        // by the decision, not the category (2026-09-23).
        const decisions = new Map<string, OptionItem[]>();
        for (const o of g.items.filter((x) => !x.counted && !x.auto)) {
          const k = o.group_key ?? o.cost_item_id;
          decisions.set(k, [...(decisions.get(k) ?? []), o]);
        }
        const exclusive = g.items.filter((o) => !o.counted && !o.auto);
        const oneOf = exclusive.length > 1 && exclusive.every((o) => o.group_key === exclusive[0].group_key);
        // One optional thing on its own is a yes-or-no question, not a chip
        // among others: "Internal lighting? No · Yes" (2026-09-23).
        const single = decisions.size === 1 && exclusive.length === 1 && counted.length === 0 && autos.length === 0 ? exclusive[0] : counted.length === 1 && exclusive.length === 0 && autos.length === 0 ? counted[0] : null;
        if (single) {
          const yes = !!single.status;
          const no = declined.has(keyOf(single));
          const set = (on: boolean) => {
            if (!on) return decline(keyOf(single), [single]);
            if (single.counted) return setCounted(single, 1);
            apply(
              (items) => items.map((x) => (x.cost_item_id === single.cost_item_id ? { ...x, status: "p1" as const } : x)),
              { cost_item_id: single.cost_item_id, status: "p1", decision_key: keyOf(single), declined: false },
            );
          };
          return (
            <div key={g.category.id} className="grid grid-cols-[9rem_1fr] gap-x-2 items-start">
              <span className={cn("text-[11px] font-medium pt-1", yes || no ? "text-slate-600" : "text-amber-700")}>{g.category.question || `${single.name}?`}</span>
              <div className="flex flex-wrap gap-1.5 items-center">
                {[false, true].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    disabled={readOnly}
                    onClick={() => set(v)}
                    className={cn(
                      "px-2 py-0.5 text-[11px] font-medium rounded-full border transition-colors disabled:cursor-default",
                      (v ? yes : no) ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400",
                    )}
                  >
                    {v ? "Yes" : "No"}
                  </button>
                ))}
                {yes && single.counted && (
                  <span className="inline-flex items-center rounded border border-slate-200 bg-white text-[10px] text-slate-700 tabular-nums">
                    <button type="button" disabled={readOnly} onClick={() => setCounted(single, Math.max(1, (single.quantity ?? 1) - 1))} className="px-1.5 py-0.5 hover:bg-slate-100" title="One fewer">−</button>
                    <span className="px-1.5 min-w-[1.6rem] text-center">{single.quantity ?? 1}</span>
                    <button type="button" disabled={readOnly} onClick={() => setCounted(single, (single.quantity ?? 1) + 1)} className="px-1.5 py-0.5 hover:bg-slate-100" title="One more">+</button>
                  </span>
                )}
                {thumb(single)}
                {owner(single)}
              </div>
            </div>
          );
        }
        return (
          <div key={g.category.id} className="grid grid-cols-[9rem_1fr] gap-x-2 items-start">
            <span
              className={cn(
                "text-[11px] font-medium pt-1",
                [...decisions.entries()].some(([k, its]) => !declined.has(k) && !its.some((o) => o.status)) ? "text-amber-700" : "text-slate-600",
              )}
              title={g.category.name}
            >
              {/* A question rather than a heading: the sheet is a
                  conversation with the customer, not a form (2026-09-23).
                  The wording is the category's, so a tenant can say "How do
                  the doors open?" rather than "Which handles?". */}
              {g.category.question || (oneOf ? `Which ${g.category.name.toLowerCase()}?` : g.category.name)}
              {g.items.some((o) => pictures[o.cost_item_id]?.length) && (
                <span className="block mt-0.5 flex items-center gap-1.5 text-[9px] font-normal">
                  <button type="button" onClick={() => compare(g)} className="text-blue-600 hover:underline" title="Every picture of every option here, one after another">
                    Compare
                  </button>
                  <a href={`/dashboard/library?cost_category=${g.category.id}&customer=1`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-600 hover:underline" title="The Design Library on this category, in customer view">
                    Library
                  </a>
                </span>
              )}
            </span>
            <div className="space-y-1.5">
              {[...decisions.entries()].map(([key, items], di) => (
                <div key={key} className={cn("flex flex-wrap gap-1.5 items-center", di > 0 && "pt-1")}>
                  {/* A second decision inside one category names itself by
                      what it is priced per - the exposed side finish beside
                      the shutters. */}
                  {decisions.size > 1 && (
                    <span className="text-[10px] text-slate-400 mr-0.5">
                      {items.length === 1 ? items[0].name : quantityLabel(items[0].quantity_key) || g.category.name}:
                    </span>
                  )}
                  {items.map((o) => (
                    <span key={o.cost_item_id} className="group/opt inline-flex items-center gap-1">
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => tapExclusive(o)}
                        title={o.status === "p1" ? "First preference - tap to clear" : o.status === "p2" ? "Second preference - tap to drop" : "Tap to make this the first preference"}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border transition-colors disabled:cursor-default",
                          o.status === "p1" ? "bg-emerald-600 text-white border-emerald-600" : o.status === "p2" ? "bg-white text-emerald-700 border-emerald-500" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400",
                        )}
                      >
                        {o.status === "p1" && <span className="text-[10px]">①</span>}
                        {o.status === "p2" && <span className="text-[10px]">②</span>}
                        {o.name}
                        {tier(o, o.status === "p1")}
                      </button>
                      {thumb(o)}
                      {owner(o)}
                    </span>
                  ))}
                  {/* Declining is an answer, and is stored: a question nobody
                      has asked must not look like one the customer turned
                      down (2026-09-23). Offered whether or not anything is
                      picked, so it can be the first tap. */}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => decline(key, items)}
                      className={cn(
                        "px-2 py-0.5 text-[11px] rounded-full border transition-colors",
                        declined.has(key)
                          ? "bg-slate-700 text-white border-slate-700"
                          : "border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600",
                      )}
                      title={declined.has(key) ? "Asked, and not wanted" : "Record that this is not wanted"}
                    >
                      Not needed
                    </button>
                  )}
                </div>
              ))}
              {autos.map((o) => (
                <p key={o.cost_item_id} className="group/opt text-[11px] text-slate-500 flex items-center gap-1">
                  <CheckIcon className="w-3 h-3 text-emerald-600" />
                  <span className="text-slate-700">{o.name}</span>
                  <span className="text-slate-400">· follows {quantityLabel(o.quantity_key)}</span>
                  {thumb(o)}
                </p>
              ))}
              {counted.length > 0 && (
                <div className="space-y-1">
                  {counted.filter((o) => o.status).map((o) => (
                    <div key={o.cost_item_id} className="group/opt flex items-center gap-2 text-[11px]">
                      <span className="inline-flex items-center rounded border border-slate-200 bg-white text-slate-700 tabular-nums">
                        <button type="button" disabled={readOnly} onClick={() => setCounted(o, Math.max(1, (o.quantity ?? 1) - 1))} className="px-1.5 py-0.5 hover:bg-slate-100 disabled:opacity-40" title="One fewer">−</button>
                        <span className="px-1.5 min-w-[1.6rem] text-center">{o.quantity ?? 1}</span>
                        <button type="button" disabled={readOnly} onClick={() => setCounted(o, (o.quantity ?? 1) + 1)} className="px-1.5 py-0.5 hover:bg-slate-100 disabled:opacity-40" title="One more">+</button>
                      </span>
                      <span className="text-slate-800">{o.name}</span>
                      {thumb(o)}
                      {owner(o)}
                      {!readOnly && (
                        <button type="button" onClick={() => setCounted(o, null)} className="text-slate-400 hover:text-red-600" title="Remove">
                          <XMarkIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {!readOnly && counted.some((o) => !o.status) && (
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-slate-400">Add:</span>
                      {counted.filter((o) => !o.status).map((o) => (
                        <span key={o.cost_item_id} className="group/opt inline-flex items-center gap-1">
                          <button type="button" onClick={() => setCounted(o, 1)} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full border border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700">
                            <PlusIcon className="w-3 h-3" />
                            {o.name}
                          </button>
                          {thumb(o)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {viewing && <MediaViewer items={viewing.items} index={viewing.index} onClose={() => setViewing(null)} onIndexChange={(i) => setViewing((v) => (v ? { ...v, index: i } : v))} />}
    </div>
  );
}

/** One component on the room sheet: finish, what is arriving from whom, pictures, its thread. */
function ComponentCard({
  c,
  chosen,
  propertyId,
  linkedType,
  linkedId,
  readOnly,
  confirm,
  onPatch,
  namePrefix,
  open,
  onToggle,
  onChoicesChanged,
  costing = null,
}: {
  c: PropertyScopeItem;
  /** Names of the items chosen for it, for the closed row. */
  chosen: string[];
  propertyId: string;
  linkedType: "lead" | "project";
  linkedId: string;
  readOnly: boolean;
  confirm: ReturnType<typeof useConfirm>["confirm"];
  onPatch: (item: PropertyScopeItem, patch: Partial<PropertyScopeItem>) => Promise<void>;
  namePrefix: string;
  open: boolean;
  onToggle: () => void;
  onChoicesChanged: () => void;
  /** The tenant's costing rule for this component type, when set. */
  costing?: ComponentCosting | null;
}) {
  const [supplied, setSupplied] = useState(c.supplied_detail ?? "");
  // The rule's width / height / length fields are the row's own size
  // columns - typed once, on the list or here - and `measures` holds the
  // rest. Merged for the rule, split again on save.
  // The rule's defaults fill the blanks nobody has typed - a base unit
  // arrives 850 high and 600 deep - so the seller corrects rather than
  // invents. What is stored on the row always wins.
  const [measures, setMeasures] = useState<Record<string, number>>(() => ({ ...defaultMeasures(costing, c, c.measurement_unit), ...mergeMeasures(c) }));
  const missing = missingMeasures(c, costing);
  const [adjusting, setAdjusting] = useState(false);
  // From the list until the sheet is opened, then from the sheet itself.
  const [toAsk, setToAsk] = useState<number>(c.still_to_ask ?? 0);
  const onQuestions = useCallback((n: number) => setToAsk(n), []);
  const derived = costing ? quantify(costing, measures, c.measurement_unit) : null;
  const ours = !c.scope_owner || c.scope_owner === "us";
  const size = c.width || c.height ? `${c.width ?? "—"} × ${c.height ?? "—"} ${c.measurement_unit}` : null;
  const saveMeasures = () => {
    const before = mergeMeasures(c);
    if (JSON.stringify(measures) === JSON.stringify(before)) return;
    const { dims, measures: rest } = splitMeasures(measures);
    void onPatch(c, { ...dims, measures: rest });
  };
  return (
    <li className={cn("rounded-lg border", open ? "border-slate-300 bg-white" : "border-slate-200 bg-white")}>
      <button type="button" onClick={onToggle} className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-slate-50 rounded-lg">
        <ChevronRightIcon className={cn("w-4 h-4 text-slate-400 transition-transform shrink-0", open && "rotate-90")} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-900 truncate">{c.name}</span>
          <span className="block text-[11px] text-slate-500 truncate">
            {c.component_type?.name || ""}
            {size ? ` · ${size}` : ""}
            {chosen.length > 0 ? ` · ${chosen.join(" · ")}` : ""}
            {!ours && <span className="text-amber-700 font-medium"> · {scopeOwnerLabel(c.scope_owner)}{c.scope_owner === "vendor" && c.scope_vendor_name ? ` (${c.scope_vendor_name})` : ""}</span>}
            {ours && missing.length > 0 && <span className="text-amber-700 font-medium"> · not measured</span>}
            {ours && toAsk > 0 && <span className="text-amber-700 font-medium"> · {toAsk} to ask</span>}
          </span>
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
          {costing && (() => {
            // Only what this job needs answering: the size, and anything the
            // rule cannot work out for itself. Everything with a default -
            // depth, doors, exposed sides - is taken as read and shown as one
            // line, opened only if somebody wants to change it (2026-09-23:
            // "I still see a lot of text boxes ... I thought you removed them").
            const isDim = (k: string) => k === "width" || k === "height" || k === "length";
            const asked = costing.fields.filter((f) => isDim(f.key) || f.default == null);
            const questions = costing.fields.filter((f) => CHOICES[f.key]);
            const assumed = costing.fields.filter((f) => !isDim(f.key) && f.default != null && !CHOICES[f.key]);
            const touched = assumed.some((f) => (c.measures as Record<string, number> | null)?.[f.key] != null);
            const ask = (f: (typeof costing.fields)[number]) => {
              const choices = CHOICES[f.key];
              if (!choices) return null;
              const current = Number(measures[f.key] ?? 0);
              return (
                <div key={f.key} className="grid grid-cols-[9rem_1fr] gap-x-2 items-start" title={f.hint}>
                  <span className="text-[11px] font-medium text-slate-600 pt-1">{f.key === "corners" ? "Any blind corners?" : f.key === "wall_exposed_sides" ? "Wall units - exposed ends?" : "Any exposed ends?"}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {choices.map((ch) => (
                      <button
                        key={ch.value}
                        type="button"
                        disabled={readOnly}
                        onClick={() => {
                          const next = { ...measures, [f.key]: ch.value };
                          setMeasures(next);
                          const { dims, measures: rest } = splitMeasures(next);
                          void onPatch(c, { ...dims, measures: rest });
                        }}
                        className={cn(
                          "px-2 py-0.5 text-[11px] font-medium rounded-full border transition-colors disabled:cursor-default",
                          current === ch.value ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400",
                        )}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            };
            const show = (f: (typeof costing.fields)[number]) => (
              <label key={f.key} className={cn("text-[11px]", missing.includes(f.label || f.key) ? "text-amber-700 font-medium" : "text-slate-600")} title={f.hint}>
                {f.label}
                <input
                  type="number"
                  value={measures[f.key] ?? ""}
                  disabled={readOnly}
                  placeholder={f.kind === "count" ? "0" : "—"}
                  onChange={(e) => setMeasures((m) => ({ ...m, [f.key]: e.target.value === "" ? 0 : Number(e.target.value) }))}
                  onBlur={saveMeasures}
                  className={cn("mt-0.5 block w-24 px-2 py-1 text-sm border rounded-md outline-none focus:border-blue-400 text-right disabled:bg-transparent", missing.includes(f.label || f.key) ? "border-amber-300 bg-amber-50/60" : "border-slate-200")}
                />
              </label>
            );
            const summary = assumed
              .map((f) => `${f.label.toLowerCase()} ${measures[f.key] ?? 0}${f.kind === "length" ? ` ${c.measurement_unit}` : ""}`)
              .join(" · ");
            return (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Measurements <span className="normal-case tracking-normal font-normal text-slate-400">· lengths in {c.measurement_unit}</span>
                  {missing.length > 0 && (
                    <span className="ml-2 normal-case tracking-normal font-medium text-amber-700">
                      {missing.length} not measured - anything priced per {missing.length === 1 ? "it" : "them"} comes out at nothing
                    </span>
                  )}
                </p>
                {asked.length > 0 && <div className="flex flex-wrap gap-x-4 gap-y-2">{asked.map(show)}</div>}
                {assumed.length > 0 && (
                  <div className={cn(asked.length > 0 && "mt-2")}>
                    <button
                      type="button"
                      onClick={() => setAdjusting((v) => !v)}
                      className="text-[11px] text-slate-500 hover:text-blue-600 text-left"
                      title="Change what we have assumed for this one"
                    >
                      Taking {summary} · <span className="text-blue-600">{adjusting || touched ? "hide" : "adjust"}</span>
                    </button>
                    {(adjusting || touched) && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">{assumed.map(show)}</div>}
                  </div>
                )}
                {questions.length > 0 && <div className="mt-2 space-y-1.5">{questions.map(ask)}</div>}
                {derived && Object.keys(derived.values).length > 0 && (
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    {costing.quantities.map((q) => `${q.label}: ${Math.round((derived.values[q.key] ?? 0) * 100) / 100} ${q.unit_code}`).join(" · ")}
                  </p>
                )}
              </div>
            );
          })()}
          {ours ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Options</p>
              <Options item={c} propertyId={propertyId} readOnly={readOnly} onChanged={onChoicesChanged} showOwner={linkedType === "project"} costing={costing} onQuestions={onQuestions} />
            </div>
          ) : c.scope_owner === "excluded" ? (
            <p className="text-xs text-slate-500">Not part of this scope.</p>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 mb-1.5">
                Provided by {c.scope_owner === "vendor" ? c.scope_vendor_name || "the vendor" : "the client"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_11rem] gap-2">
                <input
                  value={supplied}
                  disabled={readOnly}
                  onChange={(e) => setSupplied(e.target.value)}
                  onBlur={() => {
                    if (supplied.trim() !== (c.supplied_detail ?? "")) void onPatch(c, { supplied_detail: supplied.trim() || null });
                  }}
                  placeholder="Item and details - make, model, size"
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white outline-none focus:border-amber-400"
                />
                <input
                  type="date"
                  value={c.supplied_expected_by ?? ""}
                  disabled={readOnly}
                  onChange={(e) => void onPatch(c, { supplied_expected_by: e.target.value || null })}
                  title="Expected on site by"
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white outline-none focus:border-amber-400"
                />
              </div>
            </div>
          )}
          <References item={c} propertyId={propertyId} linkedType={linkedType} linkedId={linkedId} readOnly={readOnly} confirm={confirm} namePrefix={namePrefix} compact />
          <Thread label="Discussion" scopeItemId={c.id} propertyId={propertyId} linkedType={linkedType} linkedId={linkedId} readOnly={readOnly} confirm={confirm} />
        </div>
      )}
    </li>
  );
}

export function ScopeItemPanel({
  item,
  items,
  propertyId,
  linkedType,
  linkedId,
  readOnly,
  onClose,
  onNavigate,
  onPatch,
  focusComponentId = null,
  namePrefix,
  onReload,
  costingByType,
}: {
  /** The space being shown - one room sheet. Components sit inside it. */
  item: PropertyScopeItem;
  items: PropertyScopeItem[];
  propertyId: string;
  linkedType: "lead" | "project";
  linkedId: string;
  readOnly: boolean;
  onClose: () => void;
  onNavigate: (item: PropertyScopeItem) => void;
  onPatch: (item: PropertyScopeItem, patch: Partial<PropertyScopeItem>) => Promise<void>;
  focusComponentId?: string | null;
  /** ClientName_LeadNumber - what uploads here are named after. */
  namePrefix: string;
  /** Re-reads the scope, so the list mirrors what was chosen here. */
  onReload: () => void;
  /** Costing rules by component type id, for the measurement fields. */
  costingByType?: Map<string, ComponentCosting>;
}) {
  const { confirm, confirmDialog } = useConfirm();
  const [openComponents, setOpenComponents] = useState<Set<string>>(() => new Set(focusComponentId ? [focusComponentId] : []));

  const byOrder = (a: PropertyScopeItem, b: PropertyScopeItem) => a.display_order - b.display_order;
  const spaces = useMemo(() => items.filter((i) => !i.parent_id && !i.component_type_id).sort(byOrder), [items]);
  const components = useMemo(() => items.filter((i) => i.parent_id === item.id && !i.cost_item_id).sort(byOrder), [items, item.id]);
  const chosenOf = (id: string) => items.filter((i) => i.parent_id === id && i.cost_item_id && i.choice_status === "p1").map((i) => i.name);
  const idx = spaces.findIndex((i) => i.id === item.id);
  const prev = idx > 0 ? spaces[idx - 1] : null;
  const next = idx >= 0 && idx < spaces.length - 1 ? spaces[idx + 1] : null;
  const ours = !item.scope_owner || item.scope_owner === "us";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft" && prev) onNavigate(prev);
      if (e.key === "ArrowRight" && next) onNavigate(next);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onNavigate, prev, next]);

  if (typeof document === "undefined") return null;

  const size = item.length || item.width ? `${item.length ?? "—"} × ${item.width ?? "—"} ${item.measurement_unit}` : null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <aside className="relative h-full w-full lg:w-1/2 lg:max-w-none max-w-2xl bg-white shadow-2xl flex flex-col animate-[slide-in-right_.2s_ease-out]">
        <div className="px-5 pt-4 pb-3 border-b border-slate-200 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">
              Space{idx >= 0 && <span className="ml-2 text-slate-300">{idx + 1} of {spaces.length}</span>}
            </p>
            <h2 className="text-lg font-semibold text-slate-900 truncate">{item.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {item.space_type?.name || ""}
              {size ? ` · ${size}` : ""}
              {" · "}
              <span className={cn(ours ? "text-slate-500" : "text-amber-700 font-medium")}>
                {scopeOwnerLabel(item.scope_owner)}
                {item.scope_owner === "vendor" && item.scope_vendor_name ? ` (${item.scope_vendor_name})` : ""}
              </span>
              {components.length > 0 && ` · ${components.length} component${components.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" disabled={!prev} onClick={() => prev && onNavigate(prev)} title="Previous space (←)" className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30">
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <button type="button" disabled={!next} onClick={() => next && onNavigate(next)} title="Next space (→)" className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30">
              <ChevronRightIcon className="w-5 h-5" />
            </button>
            <button type="button" onClick={onClose} title="Close (Esc)" className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* The room itself: its pictures and its thread. */}
          <References item={item} propertyId={propertyId} linkedType={linkedType} linkedId={linkedId} readOnly={readOnly} confirm={confirm} namePrefix={namePrefix} />
          <Thread label="About the room" scopeItemId={item.id} propertyId={propertyId} linkedType={linkedType} linkedId={linkedId} readOnly={readOnly} confirm={confirm} />

          {/* What goes in it. */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-slate-900">Components</h3>
              <span className="text-xs text-slate-500">{components.length}</span>
              <span className="flex-1" />
              {components.length > 1 && (
                <button
                  type="button"
                  onClick={() => setOpenComponents((o) => (o.size === components.length ? new Set() : new Set(components.map((c) => c.id))))}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  {openComponents.size === components.length ? "Collapse all" : "Expand all"}
                </button>
              )}
            </div>
            {components.length === 0 ? (
              <p className="text-xs text-slate-400">No components in this space yet.</p>
            ) : (
              <ul className="space-y-2">
                {components.map((c) => (
                  <ComponentCard
                    key={c.id}
                    c={c}
                    chosen={chosenOf(c.id)}
                    propertyId={propertyId}
                    linkedType={linkedType}
                    linkedId={linkedId}
                    readOnly={readOnly}
                    confirm={confirm}
                    onPatch={onPatch}
                    namePrefix={namePrefix}
                    open={openComponents.has(c.id)}
                    onToggle={() => setOpenComponents((o) => { const n = new Set(o); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}
                    onChoicesChanged={onReload}
                    costing={c.component_type_id ? costingByType?.get(c.component_type_id) ?? null : null}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
      {confirmDialog}
    </div>,
    document.body,
  );
}

/* ---------------------------------------------------------- References */

function References({
  item,
  propertyId,
  linkedType,
  linkedId,
  readOnly,
  confirm,
  namePrefix,
  compact = false,
}: {
  item: PropertyScopeItem;
  propertyId: string;
  linkedType: "lead" | "project";
  linkedId: string;
  readOnly: boolean;
  confirm: ReturnType<typeof useConfirm>["confirm"];
  namePrefix: string;
  compact?: boolean;
}) {
  const [docs, setDocs] = useState<RefDoc[]>([]);
  // The viewer walks uploads then pinned pictures as one set.
  const [viewing, setViewing] = useState<number | null>(null);
  // ClientName_LeadNumber_Kitchen_Ref3 - counted on from what is already here.
  const clean = (v: string) => v.trim().replace(/[^A-Za-z0-9]+/g, " ").trim().replace(/\s+/g, "");
  const referenceName = (index: number) => `${namePrefix}_${clean(item.name)}_Ref${docs.length + index + 1}`;
  const [pins, setPins] = useState<LibraryEntryLite[]>([]);
  const [uploading, setUploading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [library, setLibrary] = useState<LibraryEntryLite[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [d, p] = await Promise.all([
      fetch(`/api/documents?linked_type=scope_item&linked_id=${item.id}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/properties/${propertyId}/scope/${item.id}/pins`).then((r) => r.json()).catch(() => null),
    ]);
    setDocs(starredFirst(d?.documents ?? []));
    setPins(starredFirst(p?.data ?? []));
  }, [item.id, propertyId]);

  useEffect(() => {
    // setState happens after the fetches resolve; the rule cannot see through `load`.
     
    void load();
  }, [load]);

  const upload = async (files: FileList) => {
    setUploading(true);
    setError(null);
    try {
      for (const [k, file] of Array.from(files).entries()) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("linked_type", "scope_item");
        fd.append("linked_id", item.id);
        fd.append("parent_linked_type", linkedType);
        fd.append("parent_linked_id", linkedId);
        fd.append("category", file.type.startsWith("image/") ? "photo" : "design");
        fd.append("title", referenceName(k));
        fd.append("tags", `space: ${item.name},reference`);
        const res = await fetch("/api/documents", { method: "POST", body: fd });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Upload failed");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const removeDoc = async (d: RefDoc) => {
    if (!(await confirm({ title: `Remove ${d.title || d.file_name}?`, message: "It is removed from this space and from Documents.", confirmLabel: "Remove", tone: "danger" }))) return;
    await fetch(`/api/documents/${d.id}`, { method: "DELETE" });
    await load();
  };

  // A star moves the picture to the front - the one the customer pointed at.
  const starDoc = async (d: RefDoc) => {
    const next = !d.is_starred;
    setDocs((list) => starredFirst(list.map((x) => (x.id === d.id ? { ...x, is_starred: next } : x))));
    await fetch(`/api/documents/${d.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_starred: next }) });
  };
  const starPin = async (p: LibraryEntryLite) => {
    const next = !p.is_starred;
    setPins((list) => starredFirst(list.map((x) => (x.id === p.id ? { ...x, is_starred: next } : x))));
    await fetch(`/api/properties/${propertyId}/scope/${item.id}/pins`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ library_entry_id: p.id, is_starred: next }),
    });
  };

  const openPicker = async () => {
    setPicking(true);
    if (library === null) {
      const res = await fetch("/api/library/entries");
      const json = await res.json().catch(() => ({}));
      setLibrary(res.ok ? json.data ?? [] : []);
    }
  };
  const pin = async (entryId: string) => {
    await fetch(`/api/properties/${propertyId}/scope/${item.id}/pins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ library_entry_id: entryId }),
    });
    await load();
  };
  const unpin = async (entryId: string) => {
    await fetch(`/api/properties/${propertyId}/scope/${item.id}/pins?entry=${entryId}`, { method: "DELETE" });
    await load();
  };

  const pinnedIds = new Set(pins.map((p) => p.id));
  const candidates = (library ?? []).filter((e) => !pinnedIds.has(e.id) && (!q.trim() || e.title.toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <div className={cn("space-y-3", compact ? "" : "")}>
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Pictures</p>
          {!readOnly && (
            <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline disabled:opacity-60">
              <ArrowUpTrayIcon className="w-3.5 h-3.5" /> {uploading ? "Uploading…" : "Add references"}
            </button>
          )}
          <input ref={fileInput} type="file" multiple accept="image/*,.pdf,.dwg,.dxf" className="hidden" onChange={(e) => e.target.files && void upload(e.target.files)} />
        </div>
        {docs.length === 0 ? (
          <p className="text-xs text-slate-400">No references added yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {docs.map((d) => (
              <div key={d.id} className={cn("group relative rounded-md border border-slate-200 overflow-hidden bg-slate-50", compact ? "w-14 h-14" : "w-20 h-20")}>
                <button type="button" onClick={() => setViewing(docs.indexOf(d))} className="block w-full h-full text-left" title={d.title || d.file_name}>
                  {d.file_type?.startsWith("image/") && d.signed_url ? (
                    <img src={d.signed_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <PhotoIcon className="w-5 h-5" />
                    </div>
                  )}
                </button>
                {(d.is_starred || !readOnly) && (
                  <button
                    type="button"
                    onClick={() => !readOnly && void starDoc(d)}
                    title={d.is_starred ? "Starred - shown first" : "Star - show first"}
                    className={cn("absolute top-0.5 left-0.5 w-5 h-5 items-center justify-center rounded bg-white/90", d.is_starred ? "flex text-amber-500" : "hidden group-hover:flex text-slate-400 hover:text-amber-500")}
                  >
                    {d.is_starred ? <StarSolidIcon className="w-3 h-3" /> : <StarIcon className="w-3 h-3" />}
                  </button>
                )}
                {!readOnly && (
                  <button type="button" onClick={() => void removeDoc(d)} title="Remove" className="absolute top-0.5 right-0.5 hidden group-hover:flex w-5 h-5 items-center justify-center rounded bg-white/90 text-slate-500 hover:text-red-600">
                    <TrashIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">From the Design Library</p>
          {!readOnly && !picking && (
            <button type="button" onClick={() => void openPicker()} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
              <BookmarkIcon className="w-3.5 h-3.5" /> Pin an entry
            </button>
          )}
        </div>
        {pins.length === 0 && !picking ? (
          <p className="text-xs text-slate-400">Nothing from the Design Library yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {pins.map((p) => (
              <div key={p.id} className={cn("group relative rounded-md border border-slate-200 overflow-hidden bg-slate-50", compact ? "w-14 h-14" : "w-20 h-20")}>
                <button type="button" onClick={() => setViewing(docs.length + pins.indexOf(p))} className="block w-full h-full text-left" title={p.title}>
                  {p.images[0]?.url ? <img src={p.images[0].url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><PhotoIcon className="w-6 h-6" /></div>}
                </button>
                {(p.is_starred || !readOnly) && (
                  <button
                    type="button"
                    onClick={() => !readOnly && void starPin(p)}
                    title={p.is_starred ? "Starred - shown first" : "Star - show first"}
                    className={cn("absolute top-0.5 left-0.5 w-5 h-5 items-center justify-center rounded bg-white/90", p.is_starred ? "flex text-amber-500" : "hidden group-hover:flex text-slate-400 hover:text-amber-500")}
                  >
                    {p.is_starred ? <StarSolidIcon className="w-3 h-3" /> : <StarIcon className="w-3 h-3" />}
                  </button>
                )}
                {!readOnly && (
                  <button type="button" onClick={() => void unpin(p.id)} title="Unpin" className="absolute top-0.5 right-0.5 hidden group-hover:flex w-5 h-5 items-center justify-center rounded bg-white/90 text-slate-500 hover:text-red-600">
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {picking && (
          <div className="mt-3 rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2 mb-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the library…" autoFocus className="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-md outline-none focus:border-blue-400" />
              <button type="button" onClick={() => setPicking(false)} className="text-xs text-slate-500 hover:text-slate-800">Done</button>
            </div>
            {library === null ? (
              <p className="text-xs text-slate-400">Loading…</p>
            ) : candidates.length === 0 ? (
              <p className="text-xs text-slate-400">Nothing matches.</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 max-h-56 overflow-y-auto">
                {candidates.slice(0, 40).map((e) => (
                  <button key={e.id} type="button" onClick={() => void pin(e.id)} title={`Pin ${e.title}`} className="relative rounded-md border border-slate-200 overflow-hidden bg-slate-50 aspect-square hover:ring-2 hover:ring-blue-400">
                    {e.images[0]?.url ? <img src={e.images[0].url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><PhotoIcon className="w-5 h-5" /></div>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
      {viewing !== null && (() => {
        const set: MediaItem[] = [
          ...docs.map((d) => ({ id: d.id, name: d.title || d.file_name, url: d.signed_url ?? null, type: d.file_type, caption: `Reference · ${item.name}` })),
          ...pins.map((p) => ({ id: `pin-${p.id}`, name: p.title, url: p.images[0]?.url ?? null, type: p.images[0]?.url ? "image/*" : null, caption: "Design Library" })),
        ];
        return <MediaViewer items={set} index={viewing} onClose={() => setViewing(null)} />;
      })()}
    </div>
  );
}

