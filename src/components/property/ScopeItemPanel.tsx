"use client";

/**
 * One scope row, opened out: what we know about a space or component beyond
 * its size. A slide-over from the right, so the list stays behind it, with
 * Previous / Next so a meeting can walk the scope room by room.
 *
 *   Details     finish they want; for a client/vendor row what is arriving
 *               from them and by when (the project register)
 *   References  pictures and drawings uploaded against this row (Documents,
 *               filed under the lead or project too, tagged `space: …`) and
 *               Design Library entries pinned to it
 *   Discussion  notes and decisions; an entry can become a task
 *   Changes     the log every edit writes, with the reason where one was given
 *
 * Tenant team only. Nothing here is customer-facing (docs/plans/scope.md).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowUpTrayIcon,
  BookmarkIcon,
  ChatBubbleLeftRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  PhotoIcon,
  TrashIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { SCOPE_OWNER_LABELS, type PropertyScopeItem, type ScopeHistoryEntry } from "@/types/property-scope";
import { COMMON_FINISHES } from "@/types/property-scope";
import { ScopeDiscussion } from "./ScopeDiscussion";

type Tab = "details" | "references" | "discussion" | "changes";

interface RefDoc {
  id: string;
  file_name: string;
  file_type: string | null;
  title: string | null;
  signed_url?: string | null;
  created_at: string;
}

interface LibraryEntryLite {
  id: string;
  title: string;
  kind?: string;
  style_code?: string | null;
  images: { url: string | null }[];
}

const FIELD_LABELS: Record<string, string> = {
  name: "name",
  length: "length",
  width: "width",
  height: "height",
  measurement_unit: "unit",
  measurement_status: "measurement",
  measurement_source: "measured by",
  quality_tier: "quality",
  scope_owner: "done by",
  scope_vendor_name: "vendor",
  preferred_finish: "finish",
  supplied_detail: "supplied item",
  supplied_expected_by: "expected by",
  notes: "notes",
  parent_id: "space",
};

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

/** The four tabs for one row - a space's own, or a component's inside it. */
function ItemBody({
  item,
  propertyId,
  linkedType,
  linkedId,
  readOnly,
  confirm,
  onPatch,
  compact = false,
}: {
  item: PropertyScopeItem;
  propertyId: string;
  linkedType: "lead" | "project";
  linkedId: string;
  readOnly: boolean;
  confirm: ReturnType<typeof useConfirm>["confirm"];
  onPatch: (item: PropertyScopeItem, patch: Partial<PropertyScopeItem> & { reason?: string }) => Promise<void>;
  compact?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("details");
  return (
    <div>
      <div className={cn("flex gap-1", compact ? "px-3 pt-2" : "px-5 pt-3")}>
        {(
          [
            ["details", "Details", WrenchScrewdriverIcon],
            ["references", "References", PhotoIcon],
            ["discussion", "Discussion", ChatBubbleLeftRightIcon],
            ["changes", "Changes", ClockIcon],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex items-center gap-1.5 font-medium rounded-md transition-colors",
              compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
              tab === key ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>
      <div className={compact ? "[&>div]:p-3 [&>ol]:p-3 [&>p]:p-3" : ""}>
        {tab === "details" && <DetailsTab key={item.id} item={item} readOnly={readOnly} onPatch={onPatch} />}
        {tab === "references" && (
          <ReferencesTab key={item.id} item={item} propertyId={propertyId} linkedType={linkedType} linkedId={linkedId} readOnly={readOnly} confirm={confirm} />
        )}
        {tab === "discussion" && (
          <ScopeDiscussion key={item.id} scopeItemId={item.id} propertyId={propertyId} linkedType={linkedType} linkedId={linkedId} readOnly={readOnly} confirm={confirm} />
        )}
        {tab === "changes" && <ChangesTab key={item.id} item={item} propertyId={propertyId} />}
      </div>
    </div>
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
}: {
  /** The space being shown. Opening a component opens its space with that
   *  component expanded - components live inside their space here. */
  item: PropertyScopeItem;
  /** Every row, so Previous / Next can walk the spaces. */
  items: PropertyScopeItem[];
  propertyId: string;
  linkedType: "lead" | "project";
  linkedId: string;
  readOnly: boolean;
  onClose: () => void;
  onNavigate: (item: PropertyScopeItem) => void;
  /** Saves a field on the row - the tab's own patch, so the list updates too. */
  onPatch: (item: PropertyScopeItem, patch: Partial<PropertyScopeItem> & { reason?: string }) => Promise<void>;
  focusComponentId?: string | null;
}) {
  const { confirm, confirmDialog } = useConfirm();
  const [openComponents, setOpenComponents] = useState<Set<string>>(() => new Set(focusComponentId ? [focusComponentId] : []));
  const [counts, setCounts] = useState<Map<string, { notes: number; decisions: number }>>(new Map());

  const byOrder = (a: PropertyScopeItem, b: PropertyScopeItem) => a.display_order - b.display_order;
  const spaces = useMemo(() => items.filter((i) => !i.parent_id && !i.component_type_id).sort(byOrder), [items]);
  const components = useMemo(() => items.filter((i) => i.parent_id === item.id).sort(byOrder), [items, item.id]);
  const idx = spaces.findIndex((i) => i.id === item.id);
  const prev = idx > 0 ? spaces[idx - 1] : null;
  const next = idx >= 0 && idx < spaces.length - 1 ? spaces[idx + 1] : null;
  const ours = !item.scope_owner || item.scope_owner === "us";

  // Mounted with key={space id + focused component}, so opening from a
  // component row starts with that component expanded - no effect needed.

  // How much has been said about each component, for its row.
  useEffect(() => {
    let live = true;
    void (async () => {
      const res = await fetch(`/api/properties/${propertyId}/scope/conversation`);
      const json = await res.json().catch(() => ({}));
      if (!live || !res.ok) return;
      const m = new Map<string, { notes: number; decisions: number }>();
      for (const c of (json.data ?? []) as { scope_item_id: string | null; is_decision: boolean }[]) {
        if (!c.scope_item_id) continue;
        const cur = m.get(c.scope_item_id) ?? { notes: 0, decisions: 0 };
        if (c.is_decision) cur.decisions += 1;
        else cur.notes += 1;
        m.set(c.scope_item_id, cur);
      }
      setCounts(m);
    })();
    return () => {
      live = false;
    };
  }, [propertyId, item.id]);

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

  const size = (i: PropertyScopeItem) => (i.length || i.width ? `${i.length ?? "—"} × ${i.width ?? "—"} ${i.measurement_unit}` : null);

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <aside className="relative h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-[slide-in-right_.2s_ease-out]">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-200">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">
                Space{idx >= 0 && <span className="ml-2 text-slate-300">{idx + 1} of {spaces.length}</span>}
              </p>
              <h2 className="text-lg font-semibold text-slate-900 truncate">{item.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {item.space_type?.name || ""}
                {size(item) ? ` · ${size(item)}` : ""}
                {" · "}
                <span className={cn(ours ? "text-slate-500" : "text-amber-700 font-medium")}>
                  {SCOPE_OWNER_LABELS[item.scope_owner ?? "us"]}
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
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* The space's own */}
          <ItemBody item={item} propertyId={propertyId} linkedType={linkedType} linkedId={linkedId} readOnly={readOnly} confirm={confirm} onPatch={onPatch} />

          {/* Its components, each opening out to its own four tabs */}
          <div className="border-t border-slate-200 mt-2">
            <div className="px-5 py-3 flex items-center gap-2">
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
              <p className="px-5 pb-5 text-xs text-slate-400">No components listed in this space yet - add them from the list.</p>
            ) : (
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {components.map((c) => {
                  const open = openComponents.has(c.id);
                  const n = counts.get(c.id);
                  const cOurs = !c.scope_owner || c.scope_owner === "us";
                  return (
                    <li key={c.id} className={cn(open && "bg-slate-50/60")}>
                      <button
                        type="button"
                        onClick={() => setOpenComponents((o) => { const s2 = new Set(o); if (s2.has(c.id)) s2.delete(c.id); else s2.add(c.id); return s2; })}
                        className="w-full px-5 py-2.5 flex items-center gap-3 text-left hover:bg-slate-50"
                      >
                        <ChevronRightIcon className={cn("w-4 h-4 text-slate-400 transition-transform", open && "rotate-90")} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-900 truncate">{c.name}</span>
                          <span className="block text-[11px] text-slate-500">
                            {c.component_type?.name || ""}
                            {size(c) ? ` · ${size(c)}` : ""}
                            {c.preferred_finish ? ` · ${c.preferred_finish}` : ""}
                            {!cOurs && <span className="text-amber-700 font-medium"> · {SCOPE_OWNER_LABELS[c.scope_owner ?? "us"]}</span>}
                          </span>
                        </span>
                        {n && (n.notes > 0 || n.decisions > 0) && (
                          <span className="shrink-0 text-[11px] text-slate-500">
                            {n.decisions > 0 && <span className="text-emerald-700">{n.decisions} decision{n.decisions === 1 ? "" : "s"}</span>}
                            {n.decisions > 0 && n.notes > 0 && " · "}
                            {n.notes > 0 && `${n.notes} note${n.notes === 1 ? "" : "s"}`}
                          </span>
                        )}
                      </button>
                      {open && (
                        <div className="pb-2 border-t border-slate-100 bg-white mx-3 mb-3 rounded-lg border">
                          <ItemBody item={c} propertyId={propertyId} linkedType={linkedType} linkedId={linkedId} readOnly={readOnly} confirm={confirm} onPatch={onPatch} compact />
                        </div>
                      )}
                    </li>
                  );
                })}
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

/* ------------------------------------------------------------- Details */

function DetailsTab({
  item,
  readOnly,
  onPatch,
}: {
  item: PropertyScopeItem;
  readOnly: boolean;
  onPatch: (item: PropertyScopeItem, patch: Partial<PropertyScopeItem> & { reason?: string }) => Promise<void>;
}) {
  const [finish, setFinish] = useState(item.preferred_finish ?? "");
  const [supplied, setSupplied] = useState(item.supplied_detail ?? "");
  const [expected, setExpected] = useState(item.supplied_expected_by ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [reason, setReason] = useState("");
  // Mounted with key={item.id}, so walking to another row remounts this
  // form with that row's values - no effect needed to re-sync.

  const ours = !item.scope_owner || item.scope_owner === "us";
  const commit = (patch: Partial<PropertyScopeItem>) => void onPatch(item, { ...patch, reason: reason.trim() || undefined });

  return (
    <div className="p-5 space-y-5">
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Finish they want here</p>
        <div className="flex flex-wrap gap-1.5 items-center">
          {COMMON_FINISHES.map((f) => (
            <button
              key={f}
              type="button"
              disabled={readOnly}
              onClick={() => {
                const v = finish === f ? "" : f;
                setFinish(v);
                commit({ preferred_finish: v || null });
              }}
              className={cn("px-2 py-0.5 text-[11px] font-medium rounded-full border", finish === f ? "bg-amber-500 text-white border-amber-500" : "bg-white text-slate-600 border-slate-200 hover:border-amber-300")}
            >
              {f}
            </button>
          ))}
          <input
            value={COMMON_FINISHES.includes(finish) ? "" : finish}
            disabled={readOnly}
            placeholder="other…"
            onChange={(e) => setFinish(e.target.value)}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== (item.preferred_finish ?? "")) commit({ preferred_finish: v });
            }}
            className="w-24 px-2 py-0.5 text-[11px] border border-dashed border-slate-300 rounded-full outline-none focus:border-amber-400"
          />
        </div>
        <p className="mt-1 text-[11px] text-slate-400">Leave blank to follow the brief.</p>
      </section>

      {!ours && item.scope_owner !== "excluded" && (
        <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 mb-2">
            Arriving from {item.scope_owner === "vendor" ? item.scope_vendor_name || "the vendor" : "the client"}
          </p>
          <label className="block text-xs text-slate-600">
            What exactly
            <input
              value={supplied}
              disabled={readOnly}
              onChange={(e) => setSupplied(e.target.value)}
              onBlur={() => {
                if (supplied.trim() !== (item.supplied_detail ?? "")) commit({ supplied_detail: supplied.trim() || null });
              }}
              placeholder="Faber 90cm built-in hood, model X · 6×6.5 ft bed, existing"
              className="mt-1 w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white outline-none focus:border-amber-400"
            />
          </label>
          <label className="block text-xs text-slate-600 mt-2">
            Expected on site by
            <input
              type="date"
              value={expected}
              disabled={readOnly}
              onChange={(e) => {
                setExpected(e.target.value);
                commit({ supplied_expected_by: e.target.value || null });
              }}
              className="mt-1 px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white outline-none focus:border-amber-400"
            />
          </label>
          <p className="mt-2 text-[11px] text-amber-700/80">The design fits around this and the site knows what is coming from whom. It is never priced.</p>
        </section>
      )}

      {item.scope_owner === "excluded" && (
        <p className="text-xs text-slate-500 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          Marked as not in scope, so &ldquo;that was never included&rdquo; has an answer later.
        </p>
      )}

      <section>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Notes</p>
        <textarea
          value={notes}
          disabled={readOnly}
          rows={3}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes.trim() !== (item.notes ?? "")) commit({ notes: notes.trim() || null });
          }}
          placeholder="Anything about this space worth remembering"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400 resize-none disabled:bg-transparent"
        />
      </section>

      {!readOnly && (
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Why (goes on the change log)</p>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="site column found · client changed their mind · measured on 14 Sep"
            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400"
          />
          <p className="mt-1 text-[11px] text-slate-400">Applies to the next change you make on this row, from here or from the list.</p>
        </section>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- References */

function ReferencesTab({
  item,
  propertyId,
  linkedType,
  linkedId,
  readOnly,
  confirm,
}: {
  item: PropertyScopeItem;
  propertyId: string;
  linkedType: "lead" | "project";
  linkedId: string;
  readOnly: boolean;
  confirm: ReturnType<typeof useConfirm>["confirm"];
}) {
  const [docs, setDocs] = useState<RefDoc[]>([]);
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
    setDocs(d?.documents ?? []);
    setPins(p?.data ?? []);
  }, [item.id, propertyId]);

  useEffect(() => {
    // setState happens after the fetches resolve; the rule cannot see through `load`.
     
    void load();
  }, [load]);

  const upload = async (files: FileList) => {
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("linked_type", "scope_item");
        fd.append("linked_id", item.id);
        fd.append("parent_linked_type", linkedType);
        fd.append("parent_linked_id", linkedId);
        fd.append("category", file.type.startsWith("image/") ? "photo" : "design");
        fd.append("tags", JSON.stringify([`space: ${item.name}`, "reference"]));
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
    if (!(await confirm({ title: `Remove ${d.file_name}?`, message: "It is removed from this space and from Documents.", confirmLabel: "Remove", tone: "danger" }))) return;
    await fetch(`/api/documents/${d.id}`, { method: "DELETE" });
    await load();
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
    <div className="p-5 space-y-5">
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Uploaded for this {item.component_type_id ? "component" : "space"}</p>
          {!readOnly && (
            <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline disabled:opacity-60">
              <ArrowUpTrayIcon className="w-3.5 h-3.5" /> {uploading ? "Uploading…" : "Add pictures or drawings"}
            </button>
          )}
          <input ref={fileInput} type="file" multiple accept="image/*,.pdf,.dwg,.dxf" className="hidden" onChange={(e) => e.target.files && void upload(e.target.files)} />
        </div>
        {docs.length === 0 ? (
          <p className="text-xs text-slate-400">Nothing yet - the customer&rsquo;s screenshots, a drawing, a photo of what they have.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {docs.map((d) => (
              <div key={d.id} className="group relative rounded-lg border border-slate-200 overflow-hidden bg-slate-50 aspect-4/3">
                <a href={d.signed_url ?? "#"} target="_blank" rel="noreferrer" className="block w-full h-full" title={d.file_name}>
                  {d.file_type?.startsWith("image/") && d.signed_url ? (
                    <img src={d.signed_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 px-2">
                      <PhotoIcon className="w-6 h-6" />
                      <span className="text-[10px] mt-1 truncate max-w-full">{d.file_name}</span>
                    </div>
                  )}
                </a>
                {!readOnly && (
                  <button type="button" onClick={() => void removeDoc(d)} title="Remove" className="absolute top-1 right-1 hidden group-hover:flex w-6 h-6 items-center justify-center rounded-md bg-white/90 text-slate-500 hover:text-red-600">
                    <TrashIcon className="w-3.5 h-3.5" />
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
          <p className="text-xs text-slate-400">Nothing pinned. &ldquo;They liked this one&rdquo; lives here.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {pins.map((p) => (
              <div key={p.id} className="group relative rounded-lg border border-slate-200 overflow-hidden bg-slate-50 aspect-4/3">
                <Link href={`/dashboard/library?entry=${p.id}`} className="block w-full h-full" title={p.title}>
                  {p.images[0]?.url ? <img src={p.images[0].url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><PhotoIcon className="w-6 h-6" /></div>}
                  <span className="absolute bottom-0 inset-x-0 bg-linear-to-t from-black/60 to-transparent px-1.5 pb-1 pt-4 text-[10px] text-white truncate">{p.title}</span>
                </Link>
                {!readOnly && (
                  <button type="button" onClick={() => void unpin(p.id)} title="Unpin" className="absolute top-1 right-1 hidden group-hover:flex w-6 h-6 items-center justify-center rounded-md bg-white/90 text-slate-500 hover:text-red-600">
                    <XMarkIcon className="w-3.5 h-3.5" />
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
    </div>
  );
}

/* ------------------------------------------------------------- Changes */

function ChangesTab({ item, propertyId }: { item: PropertyScopeItem; propertyId: string }) {
  const [rows, setRows] = useState<ScopeHistoryEntry[] | null>(null);
  useEffect(() => {
    let live = true;
    void (async () => {
      const res = await fetch(`/api/properties/${propertyId}/scope/history?item=${item.id}`);
      const json = await res.json().catch(() => ({}));
      if (live) setRows(res.ok ? json.data ?? [] : []);
    })();
    return () => {
      live = false;
    };
  }, [item.id, propertyId]);

  if (rows === null) return <p className="p-5 text-xs text-slate-400">Loading…</p>;
  if (rows.length === 0) return <p className="p-5 text-xs text-slate-400">No changes recorded yet.</p>;
  return (
    <ol className="p-5 space-y-3">
      {rows.map((h) => (
        <li key={h.id} className="relative pl-4 border-l-2 border-slate-200">
          <div className="text-[11px] text-slate-500">
            <span className="font-medium text-slate-700">{h.changed_by_name}</span>{" "}
            {h.action === "added" ? "added this" : h.action === "removed" ? "removed this" : "changed"}{" "}
            <span>· {new Date(h.changed_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
          </div>
          {h.action === "changed" && (
            <ul className="mt-1 text-sm text-slate-800 space-y-0.5">
              {Object.entries(h.changes).map(([field, ch]) => (
                <li key={field}>
                  <span className="text-slate-500">{FIELD_LABELS[field] ?? field}:</span>{" "}
                  <span className="line-through text-slate-400">{show(ch.from)}</span> → <span className="font-medium">{show(ch.to)}</span>
                </li>
              ))}
            </ul>
          )}
          {h.reason && <p className="mt-1 text-xs text-slate-600 italic">&ldquo;{h.reason}&rdquo;</p>}
        </li>
      ))}
    </ol>
  );
}
