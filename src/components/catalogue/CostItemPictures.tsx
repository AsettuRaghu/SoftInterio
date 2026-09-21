"use client";

/**
 * Pictures of one cost item - what acrylic looks like, which handle that
 * is. Stored as Design Library entries linked to the item (one entry per
 * picture, kind `product`), so nothing is a second file store: they show in
 * the library under the item, on the room sheet's chips, and - when marked
 * visible to the customer - beside the chosen item on the customer summary.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { EyeIcon, EyeSlashIcon, PhotoIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Modal } from "@/components/ui/Modal";
import { MediaViewer } from "@/components/ui/MediaViewer";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { cn } from "@/utils/cn";

interface Picture { entry_id: string; url: string; title: string; visible_to_customer: boolean }

export function CostItemPicturesDialog({ item, onClose, onChanged }: { item: { id: string; name: string }; onClose: () => void; onChanged?: () => void }) {
  const [pictures, setPictures] = useState<Picture[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { confirm, confirmDialog } = useConfirm();

  const load = useCallback(async () => {
    const res = await fetch(`/api/library/cost-item-pictures?ids=${item.id}`);
    const json = await res.json().catch(() => ({}));
    setPictures(res.ok ? (json.data?.[item.id] ?? []) : []);
  }, [item.id]);

  useEffect(() => {
    // setState happens after the fetch resolves; the rule cannot see through `load`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("kind", "product");
    form.set("title", item.name);
    form.set("cost_item_id", item.id);
    form.set("visible_to_customer", "true");
    for (const f of Array.from(files)) form.append("images", f);
    const res = await fetch("/api/library/batch", { method: "POST", body: form });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error || "Could not upload");
    await load();
    onChanged?.();
  };
  const toggle = async (p: Picture) => {
    setPictures((prev) => (prev ?? []).map((x) => (x.entry_id === p.entry_id ? { ...x, visible_to_customer: !x.visible_to_customer } : x)));
    await fetch(`/api/library/entries/${p.entry_id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visible_to_customer: !p.visible_to_customer }) });
  };
  const remove = async (p: Picture) => {
    if (!(await confirm({ title: "Remove this picture?", message: "It leaves the library and every screen that showed it.", confirmLabel: "Remove", tone: "danger" }))) return;
    setPictures((prev) => (prev ?? []).filter((x) => x.entry_id !== p.entry_id));
    await fetch(`/api/library/entries/${p.entry_id}`, { method: "DELETE" });
    onChanged?.();
  };

  return (
    <Modal isOpen onClose={onClose} size="lg" title={item.name} subtitle="Pictures shown on the room sheet while choosing, and - where marked visible - beside the chosen item on the customer summary.">
      <div className="p-5">
        {pictures === null ? (
          <p className="text-xs text-slate-400 py-6">Loading…</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {pictures.map((p, i) => (
              <div key={p.entry_id} className="group relative aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                <button type="button" onClick={() => setViewing(i)} className="block w-full h-full">
                  <img src={p.url} alt={p.title} className="w-full h-full object-cover" />
                </button>
                <div className="absolute inset-x-0 bottom-0 p-1 flex items-center justify-between gap-1 bg-linear-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => void toggle(p)} title={p.visible_to_customer ? "Shown to the customer - click to hide" : "Hidden from the customer - click to show"} className="p-1 rounded bg-white/90 text-slate-700 hover:bg-white">
                    {p.visible_to_customer ? <EyeIcon className="w-3.5 h-3.5" /> : <EyeSlashIcon className="w-3.5 h-3.5" />}
                  </button>
                  <button type="button" onClick={() => void remove(p)} title="Remove" className="p-1 rounded bg-white/90 text-red-600 hover:bg-white"><TrashIcon className="w-3.5 h-3.5" /></button>
                </div>
                {!p.visible_to_customer && <span className="absolute top-1 left-1 text-[9px] font-medium px-1 py-0.5 rounded bg-slate-800/80 text-white">internal</span>}
              </div>
            ))}
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className={cn("aspect-square rounded-lg border-2 border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 flex flex-col items-center justify-center gap-1 text-xs", busy && "opacity-60")}
            >
              <PhotoIcon className="w-6 h-6" />
              {busy ? "Uploading…" : "Add pictures"}
            </button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        <p className="mt-3 text-[11px] text-slate-400">Several at once is fine. Each picture is a Design Library entry under this item - the library shows them too.</p>
      </div>
      {viewing !== null && pictures && (
        <MediaViewer items={pictures.map((p) => ({ id: p.entry_id, name: p.title, url: p.url, type: "image/jpeg", caption: p.visible_to_customer ? "Shown to the customer" : "Internal" }))} index={viewing} onClose={() => setViewing(null)} onIndexChange={setViewing} />
      )}
      {confirmDialog}
    </Modal>
  );
}
