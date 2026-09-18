"use client";

/**
 * The strip above the scope rows: what the customer asked for.
 *
 *   - the floor plan, uploaded first and one click away while sizes are typed
 *     (a Document of category `floor_plan` on the lead or project, so it is
 *     also in the Documents tab and comes across at handover);
 *   - services wanted, as chips drawn from the catalogue's cost item
 *     categories - the tenant's own vocabulary, not ours;
 *   - a line of notes from the first conversation.
 *
 * Saved to property_scope_brief, one row per property, so the project reads
 * the same brief the sale wrote. Preferences (style, finishes, budget) join
 * this row in slice 3 of docs/plans/scope.md.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowTopRightOnSquareIcon,
  ArrowUpTrayIcon,
  DocumentIcon,
  MapIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";
import { fetchConfigOnce } from "@/lib/quotations/config-cache";
import type { ScopeBrief as Brief } from "@/types/property-scope";

interface Category {
  id: string;
  name: string;
  is_active?: boolean;
  is_charge?: boolean;
}

interface FloorPlanDoc {
  id: string;
  title: string | null;
  file_name: string;
  file_type: string | null;
  signed_url?: string | null;
  created_at: string;
}

export function ScopeBrief({
  propertyId,
  linkedType,
  linkedId,
  readOnly = false,
}: {
  propertyId: string;
  linkedType: "lead" | "project";
  linkedId: string;
  readOnly?: boolean;
}) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [plans, setPlans] = useState<FloorPlanDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const loadPlans = useCallback(async () => {
    const res = await fetch(`/api/documents?linked_type=${linkedType}&linked_id=${linkedId}&category=floor_plan`);
    const json = await res.json().catch(() => ({}));
    if (res.ok) setPlans(json.documents ?? []);
  }, [linkedType, linkedId]);

  useEffect(() => {
    void (async () => {
      const [b, cats] = await Promise.all([
        fetch(`/api/properties/${propertyId}/brief`).then((r) => r.json()).catch(() => null),
        fetchConfigOnce<{ quotationCostItemCategories?: Category[] }>(
          "/api/settings/quotation-cost-item-categories",
        ).catch(() => null),
      ]);
      if (b?.data) {
        setBrief(b.data);
        setNotes(b.data.brief_notes ?? "");
      }
      if (cats) {
        setCategories(
          (cats.quotationCostItemCategories ?? []).filter((c) => c.is_active !== false && !c.is_charge),
        );
      }
    })();
    void loadPlans();
  }, [propertyId, loadPlans]);

  const save = async (patch: Partial<Pick<Brief, "services_wanted" | "brief_notes">>) => {
    if (!brief) return;
    const before = brief;
    setBrief({ ...brief, ...patch });
    const res = await fetch(`/api/properties/${propertyId}/brief`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) setBrief(json.data);
    else {
      setBrief(before);
      setError(json.error || "Could not save");
    }
  };

  const toggleService = (id: string) => {
    if (!brief || readOnly) return;
    const has = brief.services_wanted.includes(id);
    void save({
      services_wanted: has ? brief.services_wanted.filter((x) => x !== id) : [...brief.services_wanted, id],
    });
  };

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("linked_type", linkedType);
      fd.append("linked_id", linkedId);
      fd.append("category", "floor_plan");
      fd.append("title", "Floor plan");
      fd.append("tags", JSON.stringify(["floor-plan"]));
      const res = await fetch("/api/documents", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Upload failed");
      await loadPlans();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const latest = plans[0] ?? null;
  const isImage = !!latest?.file_type?.startsWith("image/");

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-1 md:grid-cols-[14rem_1fr] gap-0 md:divide-x divide-slate-100">
        {/* Floor plan */}
        <div className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Floor plan</p>
          {latest ? (
            <div className="space-y-2">
              <a
                href={latest.signed_url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="group block rounded-lg overflow-hidden border border-slate-200 bg-slate-50 aspect-4/3 relative"
                title={latest.file_name}
              >
                {isImage && latest.signed_url ? (
                  <img src={latest.signed_url} alt="Floor plan" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                    <DocumentIcon className="w-8 h-8" />
                    <span className="text-[11px] mt-1 px-2 truncate max-w-full">{latest.file_name}</span>
                  </div>
                )}
                <span className="absolute top-1.5 right-1.5 rounded-md bg-white/90 p-1 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                </span>
              </a>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>{plans.length > 1 ? `${plans.length} on file · latest shown` : "On file"}</span>
                {!readOnly && (
                  <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className="text-blue-600 hover:underline disabled:opacity-60">
                    {uploading ? "Uploading…" : "Replace"}
                  </button>
                )}
              </div>
            </div>
          ) : readOnly ? (
            <p className="text-xs text-slate-400">None on file.</p>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="w-full aspect-4/3 rounded-lg border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-colors flex flex-col items-center justify-center text-slate-500 disabled:opacity-60"
            >
              {uploading ? (
                <span className="text-xs">Uploading…</span>
              ) : (
                <>
                  <MapIcon className="w-7 h-7 text-slate-300" />
                  <span className="text-xs font-medium mt-1.5 inline-flex items-center gap-1"><ArrowUpTrayIcon className="w-3.5 h-3.5" /> Add the floor plan</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">PDF, image or CAD</span>
                </>
              )}
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*,.pdf,.dwg,.dxf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
        </div>

        {/* Services wanted + notes */}
        <div className="p-4 space-y-3 min-w-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Services wanted</p>
            {categories.length === 0 ? (
              <p className="text-xs text-slate-400">No categories in the catalogue yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => {
                  const on = !!brief?.services_wanted.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={readOnly || !brief}
                      onClick={() => toggleService(c.id)}
                      aria-pressed={on}
                      className={cn(
                        "px-2.5 py-1 text-xs font-medium rounded-full border transition-colors disabled:cursor-default",
                        on
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700",
                      )}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">From the conversation</p>
            <textarea
              value={notes}
              disabled={readOnly || !brief}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if ((brief?.brief_notes ?? "") !== notes.trim()) void save({ brief_notes: notes.trim() || null });
              }}
              rows={2}
              placeholder="What they said they want - open to carpentry, timeline, anything worth remembering"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 resize-none disabled:bg-transparent disabled:border-transparent disabled:px-0"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </section>
  );
}
