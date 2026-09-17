"use client";

/**
 * The two ways many pictures reach the library at once, and the way they
 * are tagged together afterwards.
 *
 *   BatchDropModal   drop up to forty pictures; one entry each, sharing the
 *                    kind and links set here; titles from file names.
 *   FromProjectModal pick a project, see its photos, tick the ones to bring
 *                    in - they stay the project's files.
 *   BulkTagBar       sits over the grid while entries are selected: set the
 *                    kind, space, component, cost item, tier, stage, style,
 *                    visibility, add or remove tags - for all of them.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { buttonVariants } from "@/components/ui/Button";
import { TagInput } from "@/components/ui/TagInput";
import { cn } from "@/utils/cn";
import { PhotoIcon, XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import { LIBRARY_KIND_LABELS, type LibraryEntryShape, type LibraryKind } from "@/lib/library/shape";
import type { LibraryCatalogue, StyleOption } from "@/components/library/LibraryEntryModal";

const input = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white";
const label = "block text-xs font-medium text-slate-600 mb-1";

/** The shared "what it is about" fields, used by all three tools. */
export function LinkFields({
  catalogue,
  styles,
  value,
  onChange,
  kind,
  allowBlank = false,
}: {
  catalogue: LibraryCatalogue;
  styles: StyleOption[];
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  kind: LibraryKind | "";
  /** In bulk tagging, blank means "leave as is" rather than "clear". */
  allowBlank?: boolean;
}) {
  const set = (k: string, v: string) => onChange({ ...value, [k]: v });
  const blank = allowBlank ? "(leave as is)" : "—";
  const showSpace = kind !== "material" && kind !== "process";
  const showComponent = kind === "" || ["our_work", "drawing", "product", "inspiration"].includes(kind);
  const showCatalogue = kind === "" || kind === "material" || kind === "product";
  const showStage = kind === "" || kind === "process";
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {showSpace && (
        <div>
          <label className={label}>Space</label>
          <select value={value.space_type_id ?? ""} onChange={(e) => set("space_type_id", e.target.value)} className={input}>
            <option value="">{blank}</option>
            {catalogue.space_types.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      {showComponent && (
        <div>
          <label className={label}>Component</label>
          <select value={value.component_type_id ?? ""} onChange={(e) => set("component_type_id", e.target.value)} className={input}>
            <option value="">{blank}</option>
            {catalogue.component_types.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      {showCatalogue && (
        <>
          <div>
            <label className={label}>Category</label>
            <select value={value.cost_category_id ?? ""} onChange={(e) => onChange({ ...value, cost_category_id: e.target.value, cost_item_id: "" })} className={input}>
              <option value="">{blank}</option>
              {catalogue.cost_categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Cost item</label>
            <select value={value.cost_item_id ?? ""} onChange={(e) => set("cost_item_id", e.target.value)} className={input}>
              <option value="">{blank}</option>
              {catalogue.cost_items.filter((i) => !value.cost_category_id || i.category_id === value.cost_category_id).map((i) => (
                <option key={i.id} value={i.id}>{i.name}{i.quality_tier ? ` · ${i.quality_tier}` : ""}</option>
              ))}
            </select>
          </div>
          {catalogue.quality_tiers.length > 0 && (
            <div>
              <label className={label}>Grade</label>
              <select value={value.quality_tier ?? ""} onChange={(e) => set("quality_tier", e.target.value)} className={input}>
                <option value="">{blank}</option>
                {catalogue.quality_tiers.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
          )}
        </>
      )}
      {showStage && (
        <div>
          <label className={label}>Stage</label>
          <select value={value.stage_key ?? ""} onChange={(e) => set("stage_key", e.target.value)} className={input}>
            <option value="">{blank}</option>
            {catalogue.stages.map((st) => <option key={st.key} value={st.key}>{st.title}</option>)}
          </select>
        </div>
      )}
      {showSpace && (
        <div>
          <label className={label}>Style</label>
          <select value={value.style_code ?? ""} onChange={(e) => set("style_code", e.target.value)} className={input}>
            <option value="">{blank}</option>
            {styles.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

function KindPicker({ value, onChange, allowBlank = false }: { value: LibraryKind | ""; onChange: (k: LibraryKind | "") => void; allowBlank?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {allowBlank && (
        <button type="button" onClick={() => onChange("")} className={cn("px-2.5 py-1 rounded-full text-xs border", value === "" ? "bg-slate-800 text-white border-slate-800" : "bg-white border-slate-200 text-slate-600")}>
          leave as is
        </button>
      )}
      {(Object.keys(LIBRARY_KIND_LABELS) as LibraryKind[]).map((k) => (
        <button key={k} type="button" onClick={() => onChange(k)} className={cn("px-2.5 py-1 rounded-full text-xs border", value === k ? "bg-blue-600 text-white border-blue-600" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")}>
          {LIBRARY_KIND_LABELS[k]}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ batch drop */

export function BatchDropModal({
  isOpen,
  onClose,
  catalogue,
  styles,
  tagSuggestions,
  defaultKind,
  onDone,
}: {
  isOpen: boolean;
  onClose: () => void;
  catalogue: LibraryCatalogue;
  styles: StyleOption[];
  tagSuggestions: string[];
  defaultKind: LibraryKind;
  onDone: (entries: LibraryEntryShape[]) => void;
}) {
  const [kind, setKind] = useState<LibraryKind>(defaultKind);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [visible, setVisible] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    setKind(defaultKind);
    setLinks({});
    setTags([]);
    setVisible(true);
    setFiles([]);
    setError(null);
  }, [isOpen, defaultKind]);
  const previews = useMemo(() => files.map((f) => ({ f, url: URL.createObjectURL(f) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const send = async () => {
    if (files.length === 0) return setError("Choose some pictures.");
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("kind", kind);
      for (const [k, v] of Object.entries(links)) fd.append(k, v);
      fd.append("tags", tags.join(","));
      fd.append("visible_to_customer", visible ? "true" : "false");
      files.forEach((f) => fd.append("images", f));
      const res = await fetch("/api/library/batch", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setError(json.error || "Could not upload");
      onDone(json.data ?? []);
      onClose();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Drop a batch"
      subtitle="Up to forty pictures at once. They share what you set here; titles come from the file names, and you can tag them further afterwards."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={cn(buttonVariants({ variant: "outline" }))}>Cancel</button>
          <button type="button" disabled={busy || files.length === 0} onClick={() => void send()} className={cn(buttonVariants())}>
            {busy ? `Uploading ${files.length}…` : `Add ${files.length || ""} ${files.length === 1 ? "picture" : "pictures"}`}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label
          className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 px-4 py-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
            setFiles((prev) => [...prev, ...dropped].slice(0, 40));
          }}
        >
          <PhotoIcon className="w-7 h-7 text-slate-400" />
          <span className="text-sm text-slate-700">Drop pictures here, or click to choose</span>
          <span className="text-xs text-slate-400">JPG, PNG, WebP · up to 20MB each · 40 per batch</span>
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { const picked = Array.from(e.target.files ?? []); e.target.value = ""; setFiles((prev) => [...prev, ...picked].slice(0, 40)); }} />
        </label>
        {previews.length > 0 && (
          <div className="grid grid-cols-5 md:grid-cols-8 gap-1.5 max-h-40 overflow-y-auto">
            {previews.map((p, i) => (
              <div key={p.url} className="relative aspect-square rounded overflow-hidden bg-slate-100">
                <img src={p.url} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setFiles((prev) => prev.filter((_, k) => k !== i))} className="absolute top-0.5 right-0.5 rounded-full bg-white/90 p-0.5 text-slate-600 hover:text-red-600" aria-label="Remove"><XMarkIcon className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}
        <div>
          <label className={label}>These are</label>
          <KindPicker value={kind} onChange={(k) => setKind((k || defaultKind) as LibraryKind)} />
        </div>
        <LinkFields catalogue={catalogue} styles={styles} value={links} onChange={setLinks} kind={kind} />
        <div>
          <label className={label}>Tags for all of them</label>
          <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} placeholder="e.g. site photo, before, after" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
          Show to customers
        </label>
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------- from project */

interface ProjectOption {
  id: string;
  name: string;
  project_number: string;
  client_name?: string;
}
interface ProjectPhoto {
  id: string;
  name: string;
  url: string | null;
  tags: string[];
  in_library: boolean;
}

export function FromProjectModal({
  isOpen,
  onClose,
  catalogue,
  styles,
  tagSuggestions,
  onDone,
}: {
  isOpen: boolean;
  onClose: () => void;
  catalogue: LibraryCatalogue;
  styles: StyleOption[];
  tagSuggestions: string[];
  onDone: (entries: LibraryEntryShape[]) => void;
}) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<LibraryKind>("our_work");
  const [links, setLinks] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setProjectId("");
    setPhotos([]);
    setPicked(new Set());
    setKind("our_work");
    setLinks({});
    setTags([]);
    setError(null);
    fetch("/api/projects?limit=200")
      .then((r) => r.json())
      .then((j) => setProjects((j.projects ?? []).map((p: any) => ({ id: p.id, name: p.name, project_number: p.project_number, client_name: p.client_name }))))
      .catch(() => setProjects([]));
  }, [isOpen]);

  useEffect(() => {
    if (!projectId) return;
    setLoadingPhotos(true);
    setPicked(new Set());
    fetch(`/api/library/project-photos?project_id=${projectId}`)
      .then((r) => r.json())
      .then((j) => setPhotos(j.data ?? []))
      .catch(() => setPhotos([]))
      .finally(() => setLoadingPhotos(false));
  }, [projectId]);

  const bring = async () => {
    if (picked.size === 0) return setError("Tick the pictures to bring in.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/library/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_ids: [...picked], kind, tags, ...Object.fromEntries(Object.entries(links).filter(([, v]) => v)) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setError(json.error || "Could not bring them in");
      onDone(Array.isArray(json.data) ? json.data : [json.data]);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="From a project"
      subtitle="Pick a project, tick its photos. They stay the project's files; the library points at them and remembers where they came from."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={cn(buttonVariants({ variant: "outline" }))}>Cancel</button>
          <button type="button" disabled={busy || picked.size === 0} onClick={() => void bring()} className={cn(buttonVariants())}>
            {busy ? "Bringing in…" : `Bring in ${picked.size || ""}`}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={input} autoFocus>
          <option value="">Choose a project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.client_name ? `${p.client_name} · ` : ""}{p.project_number} · {p.name}</option>
          ))}
        </select>
        {projectId && (
          loadingPhotos ? (
            <p className="text-sm text-slate-400">Loading photos…</p>
          ) : photos.length === 0 ? (
            <p className="text-sm text-slate-400">This project has no photos yet.</p>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{photos.length} photos · {photos.filter((p) => p.in_library).length} already in the library</span>
                <button type="button" onClick={() => setPicked(new Set(photos.filter((p) => !p.in_library).map((p) => p.id)))} className="text-blue-600 hover:underline">Select all new</button>
              </div>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-1.5 max-h-64 overflow-y-auto">
                {photos.map((p) => {
                  const on = picked.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={p.in_library}
                      onClick={() => setPicked((prev) => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })}
                      title={p.in_library ? `${p.name} · already in the library` : p.name}
                      className={cn("relative aspect-square rounded overflow-hidden bg-slate-100", on && "ring-2 ring-blue-500", p.in_library && "opacity-40")}
                    >
                      {p.url && <img src={p.url} alt="" className="w-full h-full object-cover" />}
                      {on && <span className="absolute top-1 right-1 rounded-full bg-blue-600 text-white p-0.5"><CheckIcon className="w-3 h-3" /></span>}
                    </button>
                  );
                })}
              </div>
              <div>
                <label className={label}>These are</label>
                <KindPicker value={kind} onChange={(k) => setKind((k || "our_work") as LibraryKind)} />
              </div>
              <LinkFields catalogue={catalogue} styles={styles} value={links} onChange={setLinks} kind={kind} />
              <div>
                <label className={label}>Tags for all of them</label>
                <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} placeholder="e.g. handover, kitchen" />
              </div>
            </>
          )
        )}
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------- bulk tag */

export function BulkTagBar({
  count,
  catalogue,
  styles,
  tagSuggestions,
  onApply,
  onClear,
}: {
  count: number;
  catalogue: LibraryCatalogue;
  styles: StyleOption[];
  tagSuggestions: string[];
  onApply: (patch: Record<string, unknown>) => Promise<void>;
  onClear: () => void;
}) {
  const [kind, setKind] = useState<LibraryKind | "">("");
  const [links, setLinks] = useState<Record<string, string>>({});
  const [add, setAdd] = useState<string[]>([]);
  const [remove, setRemove] = useState<string[]>([]);
  const [visible, setVisible] = useState<"" | "yes" | "no">("");
  const [busy, setBusy] = useState(false);
  const dirty = kind || Object.values(links).some(Boolean) || add.length || remove.length || visible;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 space-y-3">
      <div className="flex items-center gap-3">
        <p className="text-sm font-semibold text-blue-900">{count} selected</p>
        <p className="text-xs text-blue-700">Set what applies to all of them; anything left as is stays as it is.</p>
        <span className="flex-1" />
        <button type="button" onClick={onClear} className="text-xs text-blue-700 hover:underline">Clear selection</button>
      </div>
      <div>
        <label className={label}>Kind</label>
        <KindPicker value={kind} onChange={setKind} allowBlank />
      </div>
      <LinkFields catalogue={catalogue} styles={styles} value={links} onChange={setLinks} kind={kind} allowBlank />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className={label}>Add tags</label>
          <TagInput value={add} onChange={setAdd} suggestions={tagSuggestions} placeholder="tags to add" />
        </div>
        <div>
          <label className={label}>Remove tags</label>
          <TagInput value={remove} onChange={setRemove} suggestions={tagSuggestions} placeholder="tags to take away" />
        </div>
        <div>
          <label className={label}>Show to customers</label>
          <select value={visible} onChange={(e) => setVisible(e.target.value as "" | "yes" | "no")} className={input}>
            <option value="">(leave as is)</option>
            <option value="yes">Yes</option>
            <option value="no">No - team only</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const patch: Record<string, unknown> = {};
              if (kind) patch.kind = kind;
              for (const [k, v] of Object.entries(links)) if (v) patch[k] = v;
              if (add.length) patch.add_tags = add;
              if (remove.length) patch.remove_tags = remove;
              if (visible) patch.visible_to_customer = visible === "yes";
              await onApply(patch);
              setKind("");
              setLinks({});
              setAdd([]);
              setRemove([]);
              setVisible("");
            } finally {
              setBusy(false);
            }
          }}
          className={cn(buttonVariants())}
        >
          {busy ? "Applying…" : `Apply to ${count}`}
        </button>
      </div>
    </div>
  );
}
