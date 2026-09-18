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
  ArrowTopRightOnSquareIcon,
  ArrowUpTrayIcon,
  BookmarkIcon,
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
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
import { SCOPE_OWNER_LABELS, type PropertyScopeItem, type ScopeComment, type ScopeHistoryEntry } from "@/types/property-scope";
import { COMMON_FINISHES } from "@/types/property-scope";

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
}: {
  item: PropertyScopeItem;
  /** Every row, so Previous / Next can walk spaces and their components. */
  items: PropertyScopeItem[];
  propertyId: string;
  linkedType: "lead" | "project";
  linkedId: string;
  readOnly: boolean;
  onClose: () => void;
  onNavigate: (item: PropertyScopeItem) => void;
  /** Saves a field on the row - the tab's own patch, so the list updates too. */
  onPatch: (item: PropertyScopeItem, patch: Partial<PropertyScopeItem> & { reason?: string }) => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("details");
  const { confirm, confirmDialog } = useConfirm();

  // Walk order: spaces in display order, each followed by its components.
  const order = useMemo(() => {
    const byOrder = (a: PropertyScopeItem, b: PropertyScopeItem) => a.display_order - b.display_order;
    const roots = items.filter((i) => !i.parent_id && !i.component_type_id).sort(byOrder);
    const out: PropertyScopeItem[] = [];
    for (const r of roots) {
      out.push(r);
      out.push(...items.filter((i) => i.parent_id === r.id).sort(byOrder));
    }
    return out;
  }, [items]);
  const idx = order.findIndex((i) => i.id === item.id);
  const prev = idx > 0 ? order[idx - 1] : null;
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
  const parent = item.parent_id ? items.find((i) => i.id === item.parent_id) : null;
  const isComponent = !!item.component_type_id;
  const ours = !item.scope_owner || item.scope_owner === "us";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft" && prev) onNavigate(prev);
      if (e.key === "ArrowRight" && next) onNavigate(next);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onNavigate, prev, next]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <aside className="relative h-full w-full max-w-xl bg-white shadow-2xl flex flex-col animate-[slide-in-right_.2s_ease-out]">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-200">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">
                {isComponent ? `${parent?.name ?? "Space"} · component` : "Space"}
                {idx >= 0 && <span className="ml-2 text-slate-300">{idx + 1} of {order.length}</span>}
              </p>
              <h2 className="text-lg font-semibold text-slate-900 truncate">{item.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {item.space_type?.name || item.component_type?.name || ""}
                {item.length || item.width ? ` · ${item.length ?? "—"} × ${item.width ?? "—"} ${item.measurement_unit}` : ""}
                {" · "}
                <span className={cn(ours ? "text-slate-500" : "text-amber-700 font-medium")}>
                  {SCOPE_OWNER_LABELS[item.scope_owner ?? "us"]}
                  {item.scope_owner === "vendor" && item.scope_vendor_name ? ` (${item.scope_vendor_name})` : ""}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" disabled={!prev} onClick={() => prev && onNavigate(prev)} title="Previous (←)" className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <button type="button" disabled={!next} onClick={() => next && onNavigate(next)} title="Next (→)" className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                <ChevronRightIcon className="w-5 h-5" />
              </button>
              <button type="button" onClick={onClose} title="Close (Esc)" className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="mt-3 flex gap-1">
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
                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  tab === key ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === "details" && <DetailsTab key={item.id} item={item} readOnly={readOnly} onPatch={onPatch} />}
          {tab === "references" && (
            <ReferencesTab key={item.id} item={item} propertyId={propertyId} linkedType={linkedType} linkedId={linkedId} readOnly={readOnly} confirm={confirm} />
          )}
          {tab === "discussion" && (
            <DiscussionTab key={item.id} item={item} propertyId={propertyId} linkedType={linkedType} linkedId={linkedId} readOnly={readOnly} confirm={confirm} />
          )}
          {tab === "changes" && <ChangesTab key={item.id} item={item} propertyId={propertyId} />}
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

/* ---------------------------------------------------------- Discussion */

function DiscussionTab({
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
  const [rows, setRows] = useState<ScopeComment[]>([]);
  const [text, setText] = useState("");
  const [decision, setDecision] = useState(false);
  const [rework, setRework] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/properties/${propertyId}/scope/conversation?item=${item.id}`);
    const json = await res.json().catch(() => ({}));
    if (res.ok) setRows(json.data ?? []);
  }, [item.id, propertyId]);

  useEffect(() => {
    // setState happens after the fetch resolves; the rule cannot see through `load`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const post = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/properties/${propertyId}/scope/conversation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope_item_id: item.id, body: text.trim(), is_decision: decision, needs_rework: rework }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error || "Could not save");
    setRows((r) => [...r, json.data]);
    setText("");
    setDecision(false);
    setRework(false);
  };

  const patch = async (c: ScopeComment, p: Partial<ScopeComment>) => {
    setRows((r) => r.map((x) => (x.id === c.id ? { ...x, ...p } : x)));
    await fetch(`/api/properties/${propertyId}/scope/conversation/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
  };

  const remove = async (c: ScopeComment) => {
    if (!(await confirm({ title: "Delete this entry?", message: "It leaves the discussion for good.", confirmLabel: "Delete", tone: "danger" }))) return;
    setRows((r) => r.filter((x) => x.id !== c.id));
    await fetch(`/api/properties/${propertyId}/scope/conversation/${c.id}`, { method: "DELETE" });
  };

  const makeTask = async (c: ScopeComment) => {
    const res = await fetch(`/api/properties/${propertyId}/scope/conversation/${c.id}/task`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ related_type: linkedType, related_id: linkedId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error || "Could not create the task");
    setRows((r) => r.map((x) => (x.id === c.id ? { ...x, task_id: json.data.task_id, needs_rework: true } : x)));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {rows.length === 0 ? (
          <p className="text-xs text-slate-400">No discussion yet. What was said, what was agreed - it goes here and stays with the space into the project.</p>
        ) : (
          rows.map((c) => (
            <div key={c.id} className={cn("group rounded-lg border px-3 py-2", c.is_decision ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white")}>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="font-medium text-slate-700">{c.author_name}</span>
                <span>{new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                {c.is_decision && <span className="inline-flex items-center gap-1 text-emerald-700 font-medium"><CheckBadgeIcon className="w-3.5 h-3.5" /> decision</span>}
                {c.needs_rework && !c.task_id && <span className="text-amber-700 font-medium">needs rework</span>}
                {c.task_id && <Link href={`/dashboard/tasks/${c.task_id}`} className="text-blue-600 hover:underline inline-flex items-center gap-0.5">task <ArrowTopRightOnSquareIcon className="w-3 h-3" /></Link>}
                <span className="flex-1" />
                {!readOnly && (
                  <span className="hidden group-hover:inline-flex items-center gap-1">
                    <button type="button" onClick={() => void patch(c, { is_decision: !c.is_decision })} className="px-1.5 py-0.5 rounded hover:bg-slate-100" title={c.is_decision ? "Back to a note" : "Mark as the decision"}>
                      {c.is_decision ? "un-decide" : "decision"}
                    </button>
                    {!c.task_id && (
                      <button type="button" onClick={() => void makeTask(c)} className="px-1.5 py-0.5 rounded hover:bg-slate-100" title="Turn into a task on this record">
                        make a task
                      </button>
                    )}
                    <button type="button" onClick={() => void remove(c)} className="px-1.5 py-0.5 rounded hover:bg-red-50 text-red-600" title="Delete">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{c.body}</p>
            </div>
          ))
        )}
      </div>
      {!readOnly && (
        <div className="border-t border-slate-200 p-4 space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void post();
            }}
            rows={2}
            placeholder="What was said or agreed… (⌘↵ to post)"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400 resize-none"
          />
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={decision} onChange={(e) => setDecision(e.target.checked)} className="rounded border-slate-300" /> Decision
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={rework} onChange={(e) => setRework(e.target.checked)} className="rounded border-slate-300" /> Needs rework
            </label>
            <span className="flex-1" />
            {error && <span className="text-xs text-red-600">{error}</span>}
            <button type="button" onClick={() => void post()} disabled={busy || !text.trim()} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              Post
            </button>
          </div>
        </div>
      )}
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
