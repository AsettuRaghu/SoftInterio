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
 *   each component the finish they want - a finish belongs on a wall unit
 *                  or a wallpaper, never on "Master Bedroom"; for a client/
 *                  vendor row what is arriving and by when; pictures; thread
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
  ChevronLeftIcon,
  ChevronRightIcon,
  PhotoIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { COMMON_FINISHES, scopeOwnerLabel, type PropertyScopeItem } from "@/types/property-scope";
import { ScopeDiscussion } from "./ScopeDiscussion";
import { MediaViewer, type MediaItem } from "@/components/ui/MediaViewer";


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
        .join(" · ") || "nothing yet"
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

/** One component on the room sheet: finish, what is arriving from whom, pictures, its thread. */
function ComponentCard({
  c,
  propertyId,
  linkedType,
  linkedId,
  readOnly,
  confirm,
  onPatch,
  namePrefix,
  open,
  onToggle,
}: {
  c: PropertyScopeItem;
  propertyId: string;
  linkedType: "lead" | "project";
  linkedId: string;
  readOnly: boolean;
  confirm: ReturnType<typeof useConfirm>["confirm"];
  onPatch: (item: PropertyScopeItem, patch: Partial<PropertyScopeItem>) => Promise<void>;
  namePrefix: string;
  open: boolean;
  onToggle: () => void;
}) {
  const [finish, setFinish] = useState(c.preferred_finish ?? "");
  const [supplied, setSupplied] = useState(c.supplied_detail ?? "");
  const ours = !c.scope_owner || c.scope_owner === "us";
  const size = c.length || c.width ? `${c.length ?? "—"} × ${c.width ?? "—"} ${c.measurement_unit}` : null;
  return (
    <li className={cn("rounded-lg border", open ? "border-slate-300 bg-white" : "border-slate-200 bg-white")}>
      <button type="button" onClick={onToggle} className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-slate-50 rounded-lg">
        <ChevronRightIcon className={cn("w-4 h-4 text-slate-400 transition-transform shrink-0", open && "rotate-90")} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-900 truncate">{c.name}</span>
          <span className="block text-[11px] text-slate-500 truncate">
            {c.component_type?.name || ""}
            {size ? ` · ${size}` : ""}
            {c.preferred_finish ? ` · ${c.preferred_finish}` : ""}
            {!ours && <span className="text-amber-700 font-medium"> · {scopeOwnerLabel(c.scope_owner)}{c.scope_owner === "vendor" && c.scope_vendor_name ? ` (${c.scope_vendor_name})` : ""}</span>}
          </span>
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
          {ours ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Finish</p>
              <div className="flex flex-wrap gap-1.5 items-center">
                {COMMON_FINISHES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    disabled={readOnly}
                    onClick={() => {
                      const v = finish === f ? "" : f;
                      setFinish(v);
                      void onPatch(c, { preferred_finish: v || null });
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
                    if (v && v !== (c.preferred_finish ?? "")) void onPatch(c, { preferred_finish: v });
                  }}
                  className="w-24 px-2 py-0.5 text-[11px] border border-dashed border-slate-300 rounded-full outline-none focus:border-amber-400"
                />
              </div>
            </div>
          ) : c.scope_owner === "excluded" ? (
            <p className="text-xs text-slate-500">Not in scope - named so &ldquo;that was never included&rdquo; has an answer later.</p>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 mb-1.5">
                Arriving from {c.scope_owner === "vendor" ? c.scope_vendor_name || "the vendor" : "the client"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_11rem] gap-2">
                <input
                  value={supplied}
                  disabled={readOnly}
                  onChange={(e) => setSupplied(e.target.value)}
                  onBlur={() => {
                    if (supplied.trim() !== (c.supplied_detail ?? "")) void onPatch(c, { supplied_detail: supplied.trim() || null });
                  }}
                  placeholder="What exactly - Faber 90cm hood, model X · 6×6.5 ft bed, existing"
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
}) {
  const { confirm, confirmDialog } = useConfirm();
  const [openComponents, setOpenComponents] = useState<Set<string>>(() => new Set(focusComponentId ? [focusComponentId] : []));

  const byOrder = (a: PropertyScopeItem, b: PropertyScopeItem) => a.display_order - b.display_order;
  const spaces = useMemo(() => items.filter((i) => !i.parent_id && !i.component_type_id).sort(byOrder), [items]);
  const components = useMemo(() => items.filter((i) => i.parent_id === item.id).sort(byOrder), [items, item.id]);
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
      <aside className="relative h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-[slide-in-right_.2s_ease-out]">
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
              <p className="text-xs text-slate-400">None listed in this space yet - add them from the list.</p>
            ) : (
              <ul className="space-y-2">
                {components.map((c) => (
                  <ComponentCard
                    key={c.id}
                    c={c}
                    propertyId={propertyId}
                    linkedType={linkedType}
                    linkedId={linkedId}
                    readOnly={readOnly}
                    confirm={confirm}
                    onPatch={onPatch}
                    namePrefix={namePrefix}
                    open={openComponents.has(c.id)}
                    onToggle={() => setOpenComponents((o) => { const n = new Set(o); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}
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
          <p className="text-xs text-slate-400">None yet - their screenshots, a drawing, a photo of what they have.</p>
        ) : (
          <div className={cn("grid gap-2", compact ? "grid-cols-4" : "grid-cols-3")}>
            {docs.map((d) => (
              <div key={d.id} className="group relative rounded-lg border border-slate-200 overflow-hidden bg-slate-50 aspect-4/3">
                <button type="button" onClick={() => setViewing(docs.indexOf(d))} className="block w-full h-full text-left" title={d.title || d.file_name}>
                  {d.file_type?.startsWith("image/") && d.signed_url ? (
                    <img src={d.signed_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 px-2">
                      <PhotoIcon className="w-6 h-6" />
                      <span className="text-[10px] mt-1 truncate max-w-full">{d.title || d.file_name}</span>
                    </div>
                  )}
                </button>
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
          <p className="text-xs text-slate-400">Nothing pinned from the library.</p>
        ) : (
          <div className={cn("grid gap-2", compact ? "grid-cols-4" : "grid-cols-3")}>
            {pins.map((p) => (
              <div key={p.id} className="group relative rounded-lg border border-slate-200 overflow-hidden bg-slate-50 aspect-4/3">
                <button type="button" onClick={() => setViewing(docs.length + pins.indexOf(p))} className="block w-full h-full text-left" title={p.title}>
                  {p.images[0]?.url ? <img src={p.images[0].url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><PhotoIcon className="w-6 h-6" /></div>}
                  <span className="absolute bottom-0 inset-x-0 bg-linear-to-t from-black/60 to-transparent px-1.5 pb-1 pt-4 text-[10px] text-white truncate">{p.title}</span>
                </button>
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

