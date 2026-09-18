"use client";

/**
 * The strip above the scope rows: what the customer asked for.
 *
 *   - the floor plan, a small pill that opens the file when needed
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
  MapIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";
import { fetchConfigOnce } from "@/lib/quotations/config-cache";
import {
  BUDGET_BAND_LABELS,
  COMMON_FINISHES,
  type BudgetBand,
  type ScopeBrief as Brief,
} from "@/types/property-scope";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

interface Category {
  id: string;
  name: string;
  is_active?: boolean;
  is_charge?: boolean;
}

interface StyleOption {
  code: string;
  label: string;
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
  const [timeline, setTimeline] = useState("");
  const [styles, setStyles] = useState<StyleOption[]>([]);
  const [customFinish, setCustomFinish] = useState("");
  // Preferences fold away once the brief is set; the chips row is what is
  // read most. Opened by default while nothing has been chosen yet.
  const [showPrefs, setShowPrefs] = useState<boolean | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadPlans = useCallback(async () => {
    const res = await fetch(`/api/documents?linked_type=${linkedType}&linked_id=${linkedId}&category=floor_plan`);
    const json = await res.json().catch(() => ({}));
    if (res.ok) setPlans(json.documents ?? []);
  }, [linkedType, linkedId]);

  useEffect(() => {
    void (async () => {
      const [b, cats, st] = await Promise.all([
        fetch(`/api/properties/${propertyId}/brief`).then((r) => r.json()).catch(() => null),
        fetchConfigOnce<{ quotationCostItemCategories?: Category[] }>(
          "/api/settings/quotation-cost-item-categories",
        ).catch(() => null),
        fetchConfigOnce<{ data?: StyleOption[] }>("/api/library/styles").catch(() => null),
      ]);
      if (b?.data) {
        setBrief(b.data);
        setNotes(b.data.brief_notes ?? "");
        setTimeline(b.data.timeline_notes ?? "");
        const hasPrefs =
          (b.data.style_codes?.length ?? 0) + (b.data.preferred_finishes?.length ?? 0) > 0 ||
          !!b.data.budget_band || b.data.open_to_carpentry !== null;
        setShowPrefs((open) => (open === null ? !hasPrefs : open));
      }
      if (st?.data) setStyles(st.data);
      if (cats) {
        setCategories(
          (cats.quotationCostItemCategories ?? []).filter((c) => c.is_active !== false && !c.is_charge),
        );
      }
    })();
    void loadPlans();
  }, [propertyId, loadPlans]);

  // Every save is numbered; a reply older than the latest request is
  // dropped, so quick successive clicks never see an earlier answer land on
  // top of a later choice. The screen is the truth; the server confirms it.
  const seq = useRef(0);
  const briefRef = useRef<Brief | null>(null);
  useEffect(() => {
    briefRef.current = brief;
  }, [brief]);

  const save = async (patch: Partial<Omit<Brief, "property_id" | "updated_at">>) => {
    const mine = ++seq.current;
    setBrief((b) => (b ? { ...b, ...patch } : b));
    const res = await fetch(`/api/properties/${propertyId}/brief`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json().catch(() => ({}));
    if (mine !== seq.current) return; // a later save is in flight
    if (res.ok) setBrief(json.data);
    else setError(json.error || "Could not save");
  };

  const toggleIn = (field: "services_wanted" | "style_codes" | "preferred_finishes", value: string) => {
    const current = briefRef.current;
    if (!current || readOnly) return;
    const list = current[field] ?? [];
    const has = list.includes(value);
    void save({ [field]: has ? list.filter((x) => x !== value) : [...list, value] } as Partial<Brief>);
  };
  const toggleService = (id: string) => toggleIn("services_wanted", id);

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

  return (
    <section className="rounded-lg border border-slate-200 bg-white px-4 py-3 space-y-2.5">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        {/* Services wanted */}
        <div className="flex-1 min-w-[16rem]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Services wanted</p>
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

        {/* Floor plan - a pill, not a picture; click to open when needed. */}
        <div className="shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Floor plan</p>
          {latest ? (
            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 pl-2.5 pr-1 py-1">
              <a
                href={latest.signed_url ?? "#"}
                target="_blank"
                rel="noreferrer"
                title={latest.file_name}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-blue-700 max-w-[14rem]"
              >
                <MapIcon className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="truncate">{latest.file_name}</span>
                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </a>
              {plans.length > 1 && <span className="text-[10px] text-slate-400 ml-1">+{plans.length - 1}</span>}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                  title="Upload a newer plan"
                  className="ml-1 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 disabled:opacity-60"
                >
                  <ArrowUpTrayIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : readOnly ? (
            <p className="text-xs text-slate-400">None on file.</p>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-dashed border-slate-300 text-slate-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50/40 disabled:opacity-60"
            >
              <ArrowUpTrayIcon className="w-3.5 h-3.5" />
              {uploading ? "Uploading…" : "Add floor plan"}
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
      </div>

      {/* Preferences: the sales-cycle memory. */}
      <div className="border-t border-slate-100 pt-2">
        <button
          type="button"
          onClick={() => setShowPrefs((o) => !o)}
          className="w-full flex items-center gap-2 text-left"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Preferences</span>
          {!showPrefs && brief && (
            <span className="text-xs text-slate-500 truncate">
              {[
                brief.style_codes.map((c) => styles.find((s) => s.code === c)?.label ?? c).join(", "),
                brief.preferred_finishes.join(", "),
                brief.budget_band ? BUDGET_BAND_LABELS[brief.budget_band] : "",
                brief.open_to_carpentry === true ? "open to carpentry" : brief.open_to_carpentry === false ? "modular only" : "",
              ]
                .filter(Boolean)
                .join(" · ") || "none noted yet"}
            </span>
          )}
          <span className="flex-1" />
          {showPrefs ? <ChevronUpIcon className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDownIcon className="w-3.5 h-3.5 text-slate-400" />}
        </button>
        {showPrefs && (
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <p className="text-[11px] font-medium text-slate-600 mb-1">Style</p>
              {styles.length === 0 ? (
                <p className="text-xs text-slate-400">No styles in the library yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {styles.map((st) => {
                    const on = !!brief?.style_codes.includes(st.code);
                    return (
                      <button key={st.code} type="button" disabled={readOnly || !brief} onClick={() => toggleIn("style_codes", st.code)} aria-pressed={on}
                        className={cn("px-2 py-0.5 text-[11px] font-medium rounded-full border transition-colors disabled:cursor-default", on ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-700")}>
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-600 mb-1">Finishes they lean to</p>
              <div className="flex flex-wrap gap-1.5 items-center">
                {[...COMMON_FINISHES, ...(brief?.preferred_finishes ?? []).filter((f) => !COMMON_FINISHES.includes(f))].map((f) => {
                  const on = !!brief?.preferred_finishes.includes(f);
                  return (
                    <button key={f} type="button" disabled={readOnly || !brief} onClick={() => toggleIn("preferred_finishes", f)} aria-pressed={on}
                      className={cn("px-2 py-0.5 text-[11px] font-medium rounded-full border transition-colors disabled:cursor-default", on ? "bg-amber-500 text-white border-amber-500" : "bg-white text-slate-600 border-slate-200 hover:border-amber-300 hover:text-amber-700")}>
                      {f}
                    </button>
                  );
                })}
                {!readOnly && (
                  <input
                    value={customFinish}
                    onChange={(e) => setCustomFinish(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customFinish.trim()) {
                        e.preventDefault();
                        toggleIn("preferred_finishes", customFinish.trim());
                        setCustomFinish("");
                      }
                    }}
                    placeholder="other…"
                    className="w-20 px-2 py-0.5 text-[11px] border border-dashed border-slate-300 rounded-full outline-none focus:border-amber-400"
                  />
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 md:col-span-2">
              <label className="text-[11px] font-medium text-slate-600">
                Budget band
                <select
                  value={brief?.budget_band ?? ""}
                  disabled={readOnly || !brief}
                  onChange={(e) => void save({ budget_band: (e.target.value || null) as BudgetBand | null })}
                  className="ml-2 px-2 py-1 text-xs border border-slate-200 rounded-md bg-white outline-none focus:border-blue-400 disabled:bg-transparent"
                >
                  <option value="">not discussed</option>
                  {(Object.keys(BUDGET_BAND_LABELS) as BudgetBand[]).map((b) => (
                    <option key={b} value={b}>{BUDGET_BAND_LABELS[b]}</option>
                  ))}
                </select>
              </label>
              <div className="text-[11px] font-medium text-slate-600 inline-flex items-center gap-2">
                Carpentry
                <span className="inline-flex rounded-md border border-slate-200 overflow-hidden">
                  {([
                    [true, "Open to it"],
                    [false, "Modular only"],
                    [null, "Not asked"],
                  ] as const).map(([v, label]) => (
                    <button key={String(v)} type="button" disabled={readOnly || !brief} onClick={() => void save({ open_to_carpentry: v })}
                      className={cn("px-2 py-1 text-[11px] font-medium border-r border-slate-200 last:border-r-0", (brief?.open_to_carpentry ?? null) === v ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50")}>
                      {label}
                    </button>
                  ))}
                </span>
              </div>
              <label className="flex-1 min-w-[14rem] text-[11px] font-medium text-slate-600 inline-flex items-center gap-2">
                Timeline
                <input
                  value={timeline}
                  disabled={readOnly || !brief}
                  onChange={(e) => setTimeline(e.target.value)}
                  onBlur={() => {
                    if ((brief?.timeline_notes ?? "") !== timeline.trim()) void save({ timeline_notes: timeline.trim() || null });
                  }}
                  placeholder="move-in by Diwali, possession in March…"
                  className="flex-1 px-2 py-1 text-xs font-normal border border-slate-200 rounded-md outline-none focus:border-blue-400 disabled:bg-transparent disabled:border-transparent"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* One line from the conversation; grows only if there is more to say. */}
      <textarea
        value={notes}
        disabled={readOnly || !brief}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => {
          if ((brief?.brief_notes ?? "") !== notes.trim()) void save({ brief_notes: notes.trim() || null });
        }}
        rows={notes.length > 90 ? 2 : 1}
        placeholder="From the conversation - open to carpentry, timeline, anything worth remembering"
        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 resize-none disabled:bg-transparent disabled:border-transparent disabled:px-0"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </section>
  );
}
