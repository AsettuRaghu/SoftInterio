"use client";

/**
 * The Design Library: what this business makes, sells and admires, as
 * pictures - organised so a designer finds it sitting with a customer.
 *
 * Full-viewport, like Calendar and Documents: a facet rail on the left
 * (kind, space, style, tags, collections - counts on everything, each a
 * filter), an image grid that scrolls on its own, and a lightbox for one
 * entry with its details and actions. "Customer view" hides everything a
 * customer should not see: internal-only entries, notes, the edit tools -
 * it is the mode to switch on before turning the screen around.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import { Chip } from "@/components/ui/list-cells";
import { tagColour } from "@/components/ui/TagInput";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { cn } from "@/utils/cn";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilSquareIcon,
  TrashIcon,
  BookmarkIcon,
  ArrowTopRightOnSquareIcon,
  SwatchIcon,
  CheckIcon,
  Squares2X2Icon,
  FolderArrowDownIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";
import { LIBRARY_KIND_LABELS, type LibraryEntryShape, type LibraryKind } from "@/lib/library/shape";
import { LibraryEntryModal, type LibraryCatalogue, type StyleOption } from "@/components/library/LibraryEntryModal";
import { BatchDropModal, FromProjectModal, BulkTagBar } from "@/components/library/LibraryBatchTools";

interface Collection {
  id: string;
  name: string;
  description: string | null;
  lead: { id: string; lead_number: string; client_name: string | null } | null;
  entry_ids: string[];
}

const KIND_TONE: Record<LibraryKind, string> = {
  our_work: "bg-emerald-600",
  drawing: "bg-sky-600",
  material: "bg-amber-600",
  product: "bg-blue-600",
  process: "bg-slate-600",
  inspiration: "bg-violet-600",
};

const EMPTY_CATALOGUE: LibraryCatalogue = { space_types: [], component_types: [], cost_categories: [], cost_items: [], quality_tiers: [], stages: [] };

export default function LibraryPage() {
  const { hasPermission } = useUserPermissions();
  const canEdit = hasPermission("library.edit");
  const canCreate = hasPermission("library.create");
  const canDelete = hasPermission("library.delete");
  const { confirm, confirmDialog } = useConfirm();

  const [entries, setEntries] = useState<LibraryEntryShape[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [catalogue, setCatalogue] = useState<LibraryCatalogue>(EMPTY_CATALOGUE);
  const [styles, setStyles] = useState<StyleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ message: string; variant: "success" | "error" } | null>(null);

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<LibraryKind | "all">("all");
  const [space, setSpace] = useState("all");
  const [component, setComponent] = useState("all");
  const [costCategory, setCostCategory] = useState("all");
  const [costItem, setCostItem] = useState("all");
  const [tier, setTier] = useState("all");
  const [project, setProject] = useState("all");
  const [stage, setStage] = useState("all");
  const [style, setStyle] = useState("all");
  const [tag, setTag] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [customerView, setCustomerView] = useState(false);

  // Opened with a question already asked - from the room sheet: "show me
  // the shutter finishes", in customer view. Read once, on arrival.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("cost_category")) setCostCategory(q.get("cost_category")!);
    if (q.get("cost_item")) setCostItem(q.get("cost_item")!);
    if (q.get("component")) setComponent(q.get("component")!);
    if (q.get("kind")) setKind(q.get("kind") as LibraryKind);
    if (q.get("customer") === "1") setCustomerView(true);
  }, []);

  const [open, setOpen] = useState<LibraryEntryShape | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [editing, setEditing] = useState<LibraryEntryShape | null>(null);
  const [adding, setAdding] = useState(false);
  const [batching, setBatching] = useState(false);
  const [fromProject, setFromProject] = useState(false);
  const [newCollection, setNewCollection] = useState<string | null>(null);
  // Selection mode: tick entries, tag them together.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const [e, c, cat, st] = await Promise.all([
        fetch("/api/library/entries"),
        fetch("/api/library/collections"),
        fetch("/api/library/catalogue"),
        fetch("/api/library/styles"),
      ]);
      const ej = await e.json().catch(() => ({}));
      const cj = await c.json().catch(() => ({}));
      const catj = await cat.json().catch(() => ({}));
      const sj = await st.json().catch(() => ({}));
      if (e.ok) setEntries(ej.data ?? []);
      else setNotice({ message: ej.error || "Could not load the library", variant: "error" });
      if (c.ok) setCollections(cj.data ?? []);
      if (cat.ok) setCatalogue({ ...EMPTY_CATALOGUE, ...(catj.data ?? {}) });
      if (st.ok) setStyles(sj.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const styleLabel = useMemo(() => new Map(styles.map((s) => [s.code, s.label])), [styles]);

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) for (const t of e.tags) m.set(t, (m.get(t) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inCollection = collectionId ? new Set(collections.find((c) => c.id === collectionId)?.entry_ids ?? []) : null;
    return entries.filter(
      (e) =>
        (!customerView || e.visible_to_customer) &&
        (kind === "all" || e.kind === kind) &&
        (space === "all" || e.space_type_id === space) &&
        (component === "all" || e.component_type_id === component) &&
        (costCategory === "all" || e.cost_category_id === costCategory || e.cost_item?.category_id === costCategory) &&
        (costItem === "all" || e.cost_item_id === costItem) &&
        (tier === "all" || e.quality_tier === tier || e.cost_item?.quality_tier === tier) &&
        (project === "all" || e.project?.id === project) &&
        (stage === "all" || e.stage_key === stage) &&
        (style === "all" || e.style_code === style) &&
        (!tag || e.tags.includes(tag)) &&
        (!inCollection || inCollection.has(e.id)) &&
        (!q || [e.title, e.description, e.space_type?.name, e.component_type?.name, e.cost_item?.name, e.cost_category?.name, styleLabel.get(e.style_code ?? ""), ...e.tags, e.project?.name].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
    );
  }, [entries, query, kind, space, component, costCategory, costItem, tier, project, stage, style, tag, collectionId, collections, customerView, styleLabel]);

  const count = (pred: (e: LibraryEntryShape) => boolean) => entries.filter((e) => (!customerView || e.visible_to_customer) && pred(e)).length;
  const anyFilter = kind !== "all" || space !== "all" || component !== "all" || costCategory !== "all" || costItem !== "all" || tier !== "all" || project !== "all" || stage !== "all" || style !== "all" || tag || collectionId || query;
  const clearAll = () => {
    setKind("all");
    setSpace("all");
    setComponent("all");
    setCostCategory("all");
    setCostItem("all");
    setTier("all");
    setProject("all");
    setStage("all");
    setStyle("all");
    setTag(null);
    setCollectionId(null);
    setQuery("");
  };
  const projectsSeen = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    for (const e of entries) if (e.project) m.set(e.project.id, e.project);
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);
  const applyBulk = async (patch: Record<string, unknown>) => {
    const res = await fetch("/api/library/bulk", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...selected], ...patch }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setNotice({ message: json.error || "Could not apply", variant: "error" });
    const byId = new Map<string, LibraryEntryShape>((json.data ?? []).map((e: LibraryEntryShape) => [e.id, e]));
    setEntries((prev) => prev.map((e) => byId.get(e.id) ?? e));
    setNotice({ message: `Applied to ${selected.size}.`, variant: "success" });
  };
  const addMany = (list: LibraryEntryShape[]) => {
    setEntries((prev) => [...list, ...prev.filter((e) => !list.some((n) => n.id === e.id))]);
    setNotice({ message: `${list.length} added to the library.`, variant: "success" });
  };

  const openEntry = (e: LibraryEntryShape) => {
    setOpen(e);
    setImageIndex(0);
  };
  const upsert = (e: LibraryEntryShape) => {
    setEntries((prev) => (prev.some((x) => x.id === e.id) ? prev.map((x) => (x.id === e.id ? e : x)) : [e, ...prev]));
    if (open?.id === e.id) setOpen(e);
  };

  const remove = async (e: LibraryEntryShape) => {
    if (!(await confirm({ title: `Remove "${e.title}" from the library?`, message: e.images.some((i) => i.document_id) ? "The project's photo stays in its Documents." : "Its pictures are deleted.", confirmLabel: "Remove", tone: "danger" }))) return;
    const res = await fetch(`/api/library/entries/${e.id}`, { method: "DELETE" });
    if (!res.ok) return setNotice({ message: "Could not remove the entry", variant: "error" });
    setEntries((prev) => prev.filter((x) => x.id !== e.id));
    setOpen(null);
    setNotice({ message: "Removed.", variant: "success" });
  };

  const toggleInCollection = async (c: Collection, e: LibraryEntryShape) => {
    const has = c.entry_ids.includes(e.id);
    const res = await fetch(`/api/library/collections/${c.id}/entries${has ? `?entry_id=${e.id}` : ""}`, {
      method: has ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: has ? undefined : JSON.stringify({ entry_id: e.id }),
    });
    if (!res.ok) return setNotice({ message: "Could not update the collection", variant: "error" });
    setCollections((prev) => prev.map((x) => (x.id === c.id ? { ...x, entry_ids: has ? x.entry_ids.filter((id) => id !== e.id) : [...x.entry_ids, e.id] } : x)));
  };

  const createCollection = async (name: string) => {
    const res = await fetch("/api/library/collections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setNotice({ message: json.error || "Could not create the collection", variant: "error" });
    setCollections((prev) => [json.data, ...prev]);
    setNewCollection(null);
  };

  const deleteCollection = async (c: Collection) => {
    if (!(await confirm({ title: `Delete the collection "${c.name}"?`, message: "The entries stay in the library.", confirmLabel: "Delete", tone: "danger" }))) return;
    const res = await fetch(`/api/library/collections/${c.id}`, { method: "DELETE" });
    if (!res.ok) return setNotice({ message: "Could not delete the collection", variant: "error" });
    setCollections((prev) => prev.filter((x) => x.id !== c.id));
    if (collectionId === c.id) setCollectionId(null);
  };

  const rail = "px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5";
  const facetBtn = (on: boolean) =>
    cn("w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors", on ? "bg-blue-50 text-blue-800 font-medium" : "text-slate-600 hover:bg-slate-100");

  return (
    <div className={cn("h-[calc(100vh-88px)] flex flex-col min-h-0", customerView && "bg-white")}>
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[230px_1fr] gap-6">
        {/* Facet rail */}
        {!customerView && (
          <aside className="min-h-0 overflow-y-auto pr-1 space-y-5">
            <div className="flex items-center gap-2 px-1">
              <div className="w-9 h-9 rounded-lg bg-linear-to-br from-rose-500 to-orange-500 text-white flex items-center justify-center shrink-0">
                <SwatchIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-slate-900 leading-tight">Design Library</h1>
                <p className="text-[11px] text-slate-500 tabular-nums">{entries.length} entries</p>
              </div>
            </div>

            <div>
              <p className={rail}>Kind</p>
              <ul className="space-y-0.5">
                <li><button type="button" onClick={() => setKind("all")} className={facetBtn(kind === "all")}><span>Everything</span><span className="text-xs tabular-nums text-slate-400">{count(() => true)}</span></button></li>
                {(Object.keys(LIBRARY_KIND_LABELS) as LibraryKind[]).map((k) => (
                  <li key={k}>
                    <button type="button" onClick={() => setKind(k)} className={facetBtn(kind === k)}>
                      <span className="flex items-center gap-2"><span className={cn("w-2 h-2 rounded-full", KIND_TONE[k])} />{LIBRARY_KIND_LABELS[k]}</span>
                      <span className="text-xs tabular-nums text-slate-400">{count((e) => e.kind === k)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {catalogue.space_types.length > 0 && (
              <div>
                <p className={rail}>Space</p>
                <ul className="space-y-0.5">
                  <li><button type="button" onClick={() => setSpace("all")} className={facetBtn(space === "all")}><span>Any space</span></button></li>
                  {catalogue.space_types.filter((s) => count((e) => e.space_type_id === s.id) > 0).map((s) => (
                    <li key={s.id}>
                      <button type="button" onClick={() => setSpace(s.id)} className={facetBtn(space === s.id)}>
                        <span className="truncate">{s.name}</span>
                        <span className="text-xs tabular-nums text-slate-400">{count((e) => e.space_type_id === s.id)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {catalogue.component_types.some((c) => count((e) => e.component_type_id === c.id) > 0) && (
              <div>
                <p className={rail}>Component</p>
                <ul className="space-y-0.5">
                  <li><button type="button" onClick={() => setComponent("all")} className={facetBtn(component === "all")}><span>Any component</span></button></li>
                  {catalogue.component_types.filter((c) => count((e) => e.component_type_id === c.id) > 0).map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => setComponent(c.id)} className={facetBtn(component === c.id)}>
                        <span className="truncate">{c.name}</span>
                        <span className="text-xs tabular-nums text-slate-400">{count((e) => e.component_type_id === c.id)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {catalogue.cost_categories.some((c) => count((e) => e.cost_category_id === c.id || e.cost_item?.category_id === c.id) > 0) && (
              <div>
                <p className={rail}>Catalogue</p>
                <ul className="space-y-0.5">
                  <li><button type="button" onClick={() => { setCostCategory("all"); setCostItem("all"); }} className={facetBtn(costCategory === "all" && costItem === "all")}><span>Anything</span></button></li>
                  {catalogue.cost_categories
                    .filter((c) => count((e) => e.cost_category_id === c.id || e.cost_item?.category_id === c.id) > 0)
                    .map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => { setCostCategory(c.id); setCostItem("all"); }} className={facetBtn(costCategory === c.id && costItem === "all")}>
                          <span className="truncate">{c.name}</span>
                          <span className="text-xs tabular-nums text-slate-400">{count((e) => e.cost_category_id === c.id || e.cost_item?.category_id === c.id)}</span>
                        </button>
                        {costCategory === c.id && (
                          <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-slate-200 pl-2">
                            {catalogue.cost_items.filter((i) => i.category_id === c.id && count((e) => e.cost_item_id === i.id) > 0).map((i) => (
                              <li key={i.id}>
                                <button type="button" onClick={() => setCostItem(costItem === i.id ? "all" : i.id)} className={facetBtn(costItem === i.id) + " text-xs"}>
                                  <span className="truncate">{i.name}</span>
                                  <span className="tabular-nums text-slate-400">{count((e) => e.cost_item_id === i.id)}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {catalogue.quality_tiers.some((t) => count((e) => e.quality_tier === t || e.cost_item?.quality_tier === t) > 0) && (
              <div>
                <p className={rail}>Grade</p>
                <div className="flex flex-wrap gap-1 px-1">
                  {catalogue.quality_tiers.filter((t) => count((e) => e.quality_tier === t || e.cost_item?.quality_tier === t) > 0).map((t) => (
                    <button key={t} type="button" onClick={() => setTier(tier === t ? "all" : t)} className={cn("px-2 py-0.5 rounded-full text-[11px] border", tier === t ? "bg-slate-800 text-white border-slate-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {projectsSeen.length > 0 && (
              <div>
                <p className={rail}>Project</p>
                <ul className="space-y-0.5">
                  <li><button type="button" onClick={() => setProject("all")} className={facetBtn(project === "all")}><span>Any project</span></button></li>
                  {projectsSeen.filter((pr) => count((e) => e.project?.id === pr.id) > 0).map((pr) => (
                    <li key={pr.id}>
                      <button type="button" onClick={() => setProject(pr.id)} className={facetBtn(project === pr.id)}>
                        <span className="truncate">{pr.name}</span>
                        <span className="text-xs tabular-nums text-slate-400">{count((e) => e.project?.id === pr.id)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {catalogue.stages.some((st) => count((e) => e.stage_key === st.key) > 0) && (
              <div>
                <p className={rail}>Stage</p>
                <ul className="space-y-0.5">
                  <li><button type="button" onClick={() => setStage("all")} className={facetBtn(stage === "all")}><span>Any stage</span></button></li>
                  {catalogue.stages.filter((st) => count((e) => e.stage_key === st.key) > 0).map((st) => (
                    <li key={st.key}>
                      <button type="button" onClick={() => setStage(st.key)} className={facetBtn(stage === st.key)}>
                        <span className="truncate">{st.title}</span>
                        <span className="text-xs tabular-nums text-slate-400">{count((e) => e.stage_key === st.key)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {styles.some((s) => count((e) => e.style_code === s.code) > 0) && (
              <div>
                <p className={rail}>Style</p>
                <div className="flex flex-wrap gap-1 px-1">
                  {styles.filter((s) => count((e) => e.style_code === s.code) > 0).map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => setStyle(style === s.code ? "all" : s.code)}
                      className={cn("px-2 py-0.5 rounded-full text-[11px] border", style === s.code ? "bg-slate-800 text-white border-slate-800" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tagCounts.length > 0 && (
              <div>
                <p className={rail}>Tags</p>
                <div className="flex flex-wrap gap-1 px-1">
                  {tagCounts.slice(0, 30).map(([t, n]) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTag(tag === t ? null : t)}
                      className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border", tag === t ? "bg-slate-800 text-white border-slate-800" : tagColour(t) + " border-transparent hover:brightness-95")}
                    >
                      {t}<span className="opacity-60 tabular-nums">{n}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between px-1 mb-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Collections</p>
                {canCreate && newCollection === null && (
                  <button type="button" onClick={() => setNewCollection("")} className="text-[11px] text-blue-600 hover:underline">New</button>
                )}
              </div>
              {newCollection !== null && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newCollection.trim()) void createCollection(newCollection.trim());
                  }}
                  className="px-1 mb-1.5"
                >
                  <input
                    autoFocus
                    value={newCollection}
                    onChange={(e) => setNewCollection(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && setNewCollection(null)}
                    placeholder="e.g. Amulya - shortlist"
                    className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </form>
              )}
              <ul className="space-y-0.5">
                {collections.map((c) => (
                  <li key={c.id} className="group flex items-center">
                    <button type="button" onClick={() => setCollectionId(collectionId === c.id ? null : c.id)} className={facetBtn(collectionId === c.id) + " flex-1"}>
                      <span className="min-w-0">
                        <span className="block truncate">{c.name}</span>
                        {c.lead && <span className="block text-[10px] text-slate-400 truncate">{c.lead.client_name || c.lead.lead_number}</span>}
                      </span>
                      <span className="text-xs tabular-nums text-slate-400">{c.entry_ids.length}</span>
                    </button>
                    {canDelete && (
                      <button type="button" onClick={() => void deleteCollection(c)} title="Delete collection" className="p-1 text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100">
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                ))}
                {collections.length === 0 && newCollection === null && <li className="px-2 text-xs text-slate-400">None yet - a named set, like a shortlist for a customer.</li>}
              </ul>
            </div>
          </aside>
        )}

        {/* Grid */}
        <div className="min-w-0 min-h-0 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {customerView && (
              <div className="flex items-center gap-2 mr-2">
                <div className="w-9 h-9 rounded-lg bg-linear-to-br from-rose-500 to-orange-500 text-white flex items-center justify-center">
                  <SwatchIcon className="w-5 h-5" />
                </div>
                <h1 className="text-base font-bold text-slate-900">Design Library</h1>
              </div>
            )}
            <div className="relative flex-1 min-w-[220px]">
              <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search titles, tags, spaces, styles..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => setCustomerView((v) => !v)}
              title={customerView ? "Back to the working view" : "Hide internal entries, notes and tools - for showing a customer"}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                customerView ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              )}
            >
              {customerView ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              {customerView ? "Exit customer view" : "Customer view"}
            </button>
            {!customerView && canEdit && (
              <button
                type="button"
                onClick={() => {
                  setSelecting((v) => !v);
                  setSelected(new Set());
                }}
                title="Tick entries and tag them together"
                className={cn("inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors", selecting ? "bg-blue-50 text-blue-800 border-blue-300" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50")}
              >
                <Squares2X2Icon className="w-4 h-4" />
                {selecting ? "Done selecting" : "Select"}
              </button>
            )}
            {!customerView && canCreate && (
              <>
                <button type="button" onClick={() => setFromProject(true)} title="Bring in photos from a project" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border bg-white text-slate-700 border-slate-200 hover:bg-slate-50">
                  <FolderArrowDownIcon className="w-4 h-4" />
                  From a project
                </button>
                <button type="button" onClick={() => setBatching(true)} title="Drop many pictures at once" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border bg-white text-slate-700 border-slate-200 hover:bg-slate-50">
                  <ArrowUpTrayIcon className="w-4 h-4" />
                  Drop a batch
                </button>
                <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                  <PlusIcon className="w-4 h-4" />
                  Add
                </button>
              </>
            )}
          </div>

          {selecting && !customerView && (
            <div className="shrink-0">
              {selected.size === 0 ? (
                <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50/40 px-3 py-2 text-xs text-blue-800 flex items-center gap-3">
                  Tick pictures in the grid to tag them together.
                  <button type="button" onClick={() => setSelected(new Set(visible.map((e) => e.id)))} className="text-blue-700 hover:underline">Select all {visible.length} shown</button>
                </div>
              ) : (
                <BulkTagBar count={selected.size} catalogue={catalogue} styles={styles} tagSuggestions={tagCounts.map(([t]) => t)} onApply={applyBulk} onClear={() => setSelected(new Set())} />
              )}
            </div>
          )}

          {anyFilter && !customerView && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 shrink-0">
              <span>{visible.length} of {entries.length}</span>
              {kind !== "all" && <Pill label={LIBRARY_KIND_LABELS[kind]} onClear={() => setKind("all")} />}
              {space !== "all" && <Pill label={catalogue.space_types.find((s) => s.id === space)?.name ?? "Space"} onClear={() => setSpace("all")} />}
              {component !== "all" && <Pill label={catalogue.component_types.find((c) => c.id === component)?.name ?? "Component"} onClear={() => setComponent("all")} />}
              {costCategory !== "all" && <Pill label={catalogue.cost_categories.find((c) => c.id === costCategory)?.name ?? "Category"} onClear={() => { setCostCategory("all"); setCostItem("all"); }} />}
              {costItem !== "all" && <Pill label={catalogue.cost_items.find((i) => i.id === costItem)?.name ?? "Item"} onClear={() => setCostItem("all")} />}
              {tier !== "all" && <Pill label={tier} onClear={() => setTier("all")} />}
              {project !== "all" && <Pill label={projectsSeen.find((p) => p.id === project)?.name ?? "Project"} onClear={() => setProject("all")} />}
              {stage !== "all" && <Pill label={catalogue.stages.find((st) => st.key === stage)?.title ?? "Stage"} onClear={() => setStage("all")} />}
              {style !== "all" && <Pill label={styleLabel.get(style) ?? style} onClear={() => setStyle("all")} />}
              {tag && <Pill label={`#${tag}`} onClear={() => setTag(null)} />}
              {collectionId && <Pill label={collections.find((c) => c.id === collectionId)?.name ?? "Collection"} onClear={() => setCollectionId(null)} />}
              {query && <Pill label={`"${query}"`} onClear={() => setQuery("")} />}
              <button type="button" onClick={clearAll} className="text-blue-600 hover:underline">Clear all</button>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
            {loading ? (
              <p className="text-sm text-slate-400 px-1">Loading the library…</p>
            ) : visible.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-slate-300 bg-white/60 py-16">
                <SwatchIcon className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-700">{entries.length === 0 ? "The library is empty" : "Nothing matches"}</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  {entries.length === 0
                    ? "Add what you make, what you sell and what inspires you - or promote a photo from a project's Documents tab."
                    : "Try another search, or clear the filters."}
                </p>
              </div>
            ) : (
              <div className="columns-2 md:columns-3 xl:columns-4 2xl:columns-5 gap-3 [column-fill:balance]">
                {visible.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      if (selecting) {
                        setSelected((prev) => {
                          const n = new Set(prev);
                          if (n.has(e.id)) n.delete(e.id);
                          else n.add(e.id);
                          return n;
                        });
                        return;
                      }
                      openEntry(e);
                    }}
                    className={cn(
                      "group relative block w-full mb-3 break-inside-avoid rounded-lg overflow-hidden bg-slate-100 text-left focus:outline-none focus:ring-2 focus:ring-blue-500",
                      selecting && selected.has(e.id) && "ring-4 ring-blue-500"
                    )}
                  >
                    {selecting && (
                      <span className={cn("absolute top-2 right-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center", selected.has(e.id) ? "bg-blue-600 border-blue-600 text-white" : "bg-white/90 border-white text-transparent")}>
                        <CheckIcon className="w-4 h-4" />
                      </span>
                    )}
                    {e.cover_url ? (
                      <img src={e.cover_url} alt={e.title} loading="lazy" className="w-full h-auto block transition-transform duration-300 group-hover:scale-[1.02]" />
                    ) : (
                      <div className="aspect-4/3 flex items-center justify-center text-slate-300"><SwatchIcon className="w-8 h-8" /></div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 via-black/30 to-transparent px-3 pt-8 pb-2.5">
                      <p className="text-sm font-semibold text-white truncate">{e.title}</p>
                      <p className="text-[11px] text-white/80 truncate">
                        {[e.space_type?.name, e.component_type?.name, e.cost_item?.name ?? e.cost_category?.name, e.quality_tier, styleLabel.get(e.style_code ?? "")].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className={cn("absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-medium text-white", KIND_TONE[e.kind])}>
                      {LIBRARY_KIND_LABELS[e.kind]}
                    </span>
                    {!e.visible_to_customer && !customerView && (
                      <span className="absolute top-2 right-2 rounded bg-white/90 p-1 text-slate-600" title="Not shown to customers">
                        <EyeSlashIcon className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {e.images.length > 1 && (
                      <span className="absolute top-2 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white tabular-nums">{e.images.length}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 flex" onClick={() => setOpen(null)}>
          <div className="flex-1 flex items-center justify-center relative p-6" onClick={(e) => e.stopPropagation()}>
            {open.images[imageIndex]?.url ? (
              <img src={open.images[imageIndex].url!} alt={open.title} className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" />
            ) : (
              <div className="text-white/60">No image</div>
            )}
            {open.images.length > 1 && (
              <>
                <button type="button" onClick={() => setImageIndex((i) => (i - 1 + open.images.length) % open.images.length)} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-700 hover:bg-white"><ChevronLeftIcon className="w-5 h-5" /></button>
                <button type="button" onClick={() => setImageIndex((i) => (i + 1) % open.images.length)} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-700 hover:bg-white"><ChevronRightIcon className="w-5 h-5" /></button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {open.images.map((_, i) => (
                    <button key={i} type="button" onClick={() => setImageIndex(i)} className={cn("w-2 h-2 rounded-full", i === imageIndex ? "bg-white" : "bg-white/40")} aria-label={`Image ${i + 1}`} />
                  ))}
                </div>
              </>
            )}
          </div>
          <aside className="w-full max-w-sm bg-white h-full overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <span className={cn("inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white mb-1.5", KIND_TONE[open.kind])}>{LIBRARY_KIND_LABELS[open.kind]}</span>
                <h2 className="text-lg font-bold text-slate-900 leading-tight">{open.title}</h2>
                <p className="text-sm text-slate-500">
                  {[open.space_type?.name, open.component_type?.name, open.cost_category?.name, open.cost_item?.name, open.quality_tier, catalogue.stages.find((st) => st.key === open.stage_key)?.title, styleLabel.get(open.style_code ?? "")].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(null)} className="p-1 text-slate-400 hover:text-slate-700 rounded"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4 flex-1">
              {open.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {open.tags.map((t) => (
                    <button key={t} type="button" onClick={() => { setTag(t); setOpen(null); }} className={cn("px-2 py-0.5 rounded-full text-[11px]", tagColour(t))}>{t}</button>
                  ))}
                </div>
              )}
              {open.description && <p className="text-sm text-slate-700 whitespace-pre-wrap">{open.description}</p>}
              {open.project && (
                <p className="text-xs text-slate-500">
                  Executed at{" "}
                  {customerView ? <span className="font-medium text-slate-700">{open.project.name}</span> : <Link href={`/dashboard/projects/${open.project.id}`} className="font-medium text-blue-600 hover:underline">{open.project.name}</Link>}
                </p>
              )}
              {open.source_url && !customerView && (
                <a href={open.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" /> Source
                </a>
              )}
              {!customerView && (
                <p className="text-xs text-slate-400">
                  {open.visible_to_customer ? "Shown to customers" : "Team only"} · added {new Date(open.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}

              {!customerView && canEdit && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Collections</p>
                  {collections.length === 0 ? (
                    <p className="text-xs text-slate-400">Create one from the rail to start a shortlist.</p>
                  ) : (
                    <ul className="space-y-1">
                      {collections.map((c) => {
                        const has = c.entry_ids.includes(open.id);
                        return (
                          <li key={c.id}>
                            <button type="button" onClick={() => void toggleInCollection(c, open)} className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm border", has ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-700 hover:bg-slate-50")}>
                              <BookmarkIcon className={cn("w-4 h-4", has ? "fill-blue-600 text-blue-600" : "text-slate-400")} />
                              <span className="flex-1 text-left truncate">{c.name}</span>
                              {c.lead && <Chip label={c.lead.client_name || c.lead.lead_number} tone="slate" />}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
            {!customerView && (canEdit || canDelete) && (
              <div className="p-4 border-t border-slate-100 flex items-center gap-2">
                {canEdit && (
                  <button type="button" onClick={() => setEditing(open)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
                    <PencilSquareIcon className="w-4 h-4" /> Edit
                  </button>
                )}
                {canDelete && (
                  <button type="button" onClick={() => void remove(open)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg text-red-600 hover:bg-red-50">
                    <TrashIcon className="w-4 h-4" /> Remove
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>
      )}

      <BatchDropModal
        isOpen={batching}
        onClose={() => setBatching(false)}
        catalogue={catalogue}
        styles={styles}
        tagSuggestions={tagCounts.map(([t]) => t)}
        defaultKind={kind === "all" ? "our_work" : kind}
        onDone={addMany}
      />
      <FromProjectModal
        isOpen={fromProject}
        onClose={() => setFromProject(false)}
        catalogue={catalogue}
        styles={styles}
        tagSuggestions={tagCounts.map(([t]) => t)}
        onDone={addMany}
      />
      <LibraryEntryModal
        isOpen={adding || !!editing}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        catalogue={catalogue}
        styles={styles}
        tagSuggestions={tagCounts.map(([t]) => t)}
        entry={editing}
        defaultKind={kind === "all" ? "inspiration" : kind}
        onSaved={(e) => {
          upsert(e);
          setNotice({ message: editing ? "Saved." : "Added to the library.", variant: "success" });
        }}
      />
      {confirmDialog}
      <Toast message={notice?.message ?? null} variant={notice?.variant ?? "error"} onDismiss={() => setNotice(null)} />
    </div>
  );
}

function Pill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-slate-100 text-slate-700">
      {label}
      <button type="button" onClick={onClear} className="p-0.5 rounded-full hover:bg-slate-200" aria-label={`Clear ${label}`}>
        <XMarkIcon className="w-3 h-3" />
      </button>
    </span>
  );
}
