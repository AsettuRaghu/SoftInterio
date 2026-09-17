"use client";

/**
 * Add or edit a library entry. Built like the app's other dialogs: sections
 * with icons, labels above fields, examples as placeholders.
 *
 * Creating needs at least one image and posts multipart; editing patches
 * the fields and adds images separately, because an entry's pictures are
 * rows of their own.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { buttonVariants } from "@/components/ui/Button";
import { TagInput } from "@/components/ui/TagInput";
import { cn } from "@/utils/cn";
import { PhotoIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { LIBRARY_KIND_HELP, LIBRARY_KIND_LABELS, type LibraryEntryShape, type LibraryKind } from "@/lib/library/shape";

export interface SpaceTypeOption {
  id: string;
  name: string;
}
export interface StyleOption {
  code: string;
  label: string;
}
/** The vocabulary the library links to - GET /api/library/catalogue. */
export interface LibraryCatalogue {
  space_types: SpaceTypeOption[];
  component_types: { id: string; name: string }[];
  cost_categories: { id: string; name: string }[];
  cost_items: { id: string; name: string; category_id: string | null; quality_tier: string | null }[];
  quality_tiers: string[];
  stages: { key: string; title: string; playbook: string }[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  catalogue: LibraryCatalogue;
  styles: StyleOption[];
  tagSuggestions: string[];
  /** Editing this entry; absent means creating. */
  entry?: LibraryEntryShape | null;
  defaultKind?: LibraryKind;
  onSaved: (entry: LibraryEntryShape) => void;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <h3 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100">{title}</h3>
    {children}
  </div>
);

export function LibraryEntryModal({ isOpen, onClose, catalogue, styles, tagSuggestions, entry, defaultKind = "inspiration", onSaved }: Props) {
  const spaceTypes = catalogue.space_types;
  const editing = !!entry;
  const [kind, setKind] = useState<LibraryKind>(defaultKind);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [spaceTypeId, setSpaceTypeId] = useState("");
  const [componentTypeId, setComponentTypeId] = useState("");
  const [costCategoryId, setCostCategoryId] = useState("");
  const [costItemId, setCostItemId] = useState("");
  const [tier, setTier] = useState("");
  const [stageKey, setStageKey] = useState("");
  const [styleCode, setStyleCode] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [visible, setVisible] = useState(true);
  const [sourceUrl, setSourceUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setKind(entry?.kind ?? defaultKind);
    setTitle(entry?.title ?? "");
    setDescription(entry?.description ?? "");
    setSpaceTypeId(entry?.space_type_id ?? "");
    setComponentTypeId(entry?.component_type_id ?? "");
    setCostCategoryId(entry?.cost_category_id ?? entry?.cost_item?.category_id ?? "");
    setCostItemId(entry?.cost_item_id ?? "");
    setTier(entry?.quality_tier ?? "");
    setStageKey(entry?.stage_key ?? "");
    setStyleCode(entry?.style_code ?? "");
    setTags(entry?.tags ?? []);
    setVisible(entry?.visible_to_customer ?? true);
    setSourceUrl(entry?.source_url ?? "");
    setFiles([]);
    setError(null);
  }, [isOpen, entry, defaultKind]);

  // Object URLs for the chosen files, made once per selection and released
  // when it changes.
  const previews = useMemo(() => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const save = async () => {
    setError(null);
    if (!title.trim()) return setError("Give it a title.");
    if (!editing && files.length === 0) return setError("Add at least one image.");
    setBusy(true);
    try {
      let res: Response;
      if (editing) {
        res = await fetch(`/api/library/entries/${entry!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind, title, description, tags, visible_to_customer: visible, source_url: sourceUrl,
            space_type_id: spaceTypeId || null, component_type_id: componentTypeId || null,
            cost_category_id: costCategoryId || null, cost_item_id: costItemId || null,
            quality_tier: tier || null, stage_key: stageKey || null, style_code: styleCode || null,
          }),
        });
        if (res.ok && files.length) {
          const fd = new FormData();
          files.forEach((f) => fd.append("images", f));
          res = await fetch(`/api/library/entries/${entry!.id}/images`, { method: "POST", body: fd });
        }
      } else {
        const fd = new FormData();
        fd.append("kind", kind);
        fd.append("title", title);
        fd.append("description", description);
        fd.append("space_type_id", spaceTypeId);
        fd.append("component_type_id", componentTypeId);
        fd.append("cost_category_id", costCategoryId);
        fd.append("cost_item_id", costItemId);
        fd.append("quality_tier", tier);
        fd.append("stage_key", stageKey);
        fd.append("style_code", styleCode);
        fd.append("tags", tags.join(","));
        fd.append("visible_to_customer", visible ? "true" : "false");
        fd.append("source_url", sourceUrl);
        files.forEach((f) => fd.append("images", f));
        res = await fetch("/api/library/entries", { method: "POST", body: fd });
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setError(json.error || "Could not save");
      onSaved(json.data);
      onClose();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const label = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? "Edit entry" : "Add to the library"}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={cn(buttonVariants({ variant: "outline" }))}>Cancel</button>
          <button type="button" disabled={busy} onClick={() => void save()} className={cn(buttonVariants())}>
            {busy ? "Saving…" : editing ? "Save changes" : "Add"}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <Section title="What is it?">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {(Object.keys(LIBRARY_KIND_LABELS) as LibraryKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-colors",
                  kind === k ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                )}
              >
                <span className={cn("block text-sm font-medium", kind === k ? "text-blue-800" : "text-slate-800")}>{LIBRARY_KIND_LABELS[k]}</span>
                <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">{LIBRARY_KIND_HELP[k]}</span>
              </button>
            ))}
          </div>
          <div>
            <label className={label}>Title <span className="text-red-500">*</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. L-shaped kitchen with tall unit, matte olive" autoFocus className={input} />
          </div>
          {/* What it is ABOUT: the catalogue. Which links are offered
              follows the kind - a material is about a cost item and a
              tier; a process picture is about a stage. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {kind !== "material" && kind !== "process" && (
              <div>
                <label className={label}>Space</label>
                <select value={spaceTypeId} onChange={(e) => setSpaceTypeId(e.target.value)} className={input}>
                  <option value="">—</option>
                  {spaceTypes.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            {(kind === "our_work" || kind === "drawing" || kind === "product" || kind === "inspiration") && (
              <div>
                <label className={label}>Component</label>
                <select value={componentTypeId} onChange={(e) => setComponentTypeId(e.target.value)} className={input}>
                  <option value="">—</option>
                  {catalogue.component_types.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            {(kind === "material" || kind === "product") && (
              <>
                <div>
                  <label className={label}>Category</label>
                  <select
                    value={costCategoryId}
                    onChange={(e) => {
                      setCostCategoryId(e.target.value);
                      setCostItemId("");
                    }}
                    className={input}
                  >
                    <option value="">—</option>
                    {catalogue.cost_categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Cost item</label>
                  <select value={costItemId} onChange={(e) => setCostItemId(e.target.value)} className={input} disabled={!costCategoryId && catalogue.cost_items.length > 60}>
                    <option value="">{costCategoryId ? "—" : "Pick a category first"}</option>
                    {catalogue.cost_items
                      .filter((i) => !costCategoryId || i.category_id === costCategoryId)
                      .map((i) => (
                        <option key={i.id} value={i.id}>{i.name}{i.quality_tier ? ` · ${i.quality_tier}` : ""}</option>
                      ))}
                  </select>
                </div>
                {catalogue.quality_tiers.length > 0 && (
                  <div>
                    <label className={label}>Grade</label>
                    <select value={tier} onChange={(e) => setTier(e.target.value)} className={input}>
                      <option value="">—</option>
                      {catalogue.quality_tiers.map((t) => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
            {kind === "process" && (
              <div className="md:col-span-2">
                <label className={label}>Stage of the plan</label>
                <select value={stageKey} onChange={(e) => setStageKey(e.target.value)} className={input}>
                  <option value="">—</option>
                  {catalogue.stages.map((st) => (
                    <option key={st.key} value={st.key}>{st.title}{catalogue.stages.some((o) => o.key !== st.key && o.playbook !== st.playbook) ? ` · ${st.playbook}` : ""}</option>
                  ))}
                </select>
              </div>
            )}
            {kind !== "material" && kind !== "process" && (
              <div>
                <label className={label}>Style</label>
                <select value={styleCode} onChange={(e) => setStyleCode(e.target.value)} className={input}>
                  <option value="">—</option>
                  {styles.map((s) => (
                    <option key={s.code} value={s.code}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className={label}>Tags</label>
            <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} placeholder="e.g. olive, handleless, quartz" />
          </div>
        </Section>

        <Section title="Pictures">
          <label className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
            <PhotoIcon className="w-6 h-6 text-slate-400" />
            <span className="text-sm text-slate-600">{editing ? "Add more pictures" : "Choose pictures"}</span>
            <span className="text-xs text-slate-400">JPG, PNG, WebP · up to 20MB each</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                e.target.value = "";
                setFiles((prev) => [...prev, ...picked]);
              }}
            />
          </label>
          {(previews.length > 0 || (entry?.images.length ?? 0) > 0) && (
            <div className="grid grid-cols-4 gap-2">
              {entry?.images.map((img) => (
                <div key={img.id} className="aspect-square rounded-md overflow-hidden bg-slate-100">
                  {img.url && <img src={img.url} alt="" className="w-full h-full object-cover" />}
                </div>
              ))}
              {previews.map((p, i) => (
                <div key={p.url} className="relative aspect-square rounded-md overflow-hidden bg-slate-100 ring-2 ring-blue-300">
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, k) => k !== i))}
                    className="absolute top-1 right-1 rounded-full bg-white/90 p-0.5 text-slate-600 hover:text-red-600"
                    aria-label="Remove"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Notes and where it came from">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What to say about it when showing it. Materials, finish, what the client liked." className={cn(input, "resize-none")} />
          {kind === "inspiration" && (
            <input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="Source link (optional)" className={input} />
          )}
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="mt-0.5" />
            <span>
              Show to customers
              <span className="block text-xs text-slate-500">Off keeps it for the team - a reference we would not present, or work we cannot show.</span>
            </span>
          </label>
        </Section>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
