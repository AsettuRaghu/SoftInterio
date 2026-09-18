"use client";

/**
 * Requirements - the first section of the Scope tab: what the customer asked
 * for, gathered once.
 *
 *   - the floor plan (a Document of category `floor_plan` on the lead or
 *     project, so it is in Documents too and comes across at handover);
 *   - the lead's own facts - service type, budget, target dates, carpet area -
 *     shown here and edited here, saved to the lead. One source, two doors;
 *     nothing is asked twice. Read-only once the record is a project;
 *   - services wanted, as chips from the catalogue's cost item categories;
 *   - style (library styles) and the finishes they lean to;
 *   - the notes of the first conversation.
 *
 * Saved to property_scope_brief, one row per property, so the project reads
 * the same brief the sale wrote. Nothing here is customer-facing.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowTopRightOnSquareIcon, ArrowUpTrayIcon, MapIcon } from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";
import { fetchConfigOnce } from "@/lib/quotations/config-cache";
import { COMMON_FINISHES, type ScopeBrief as Brief } from "@/types/property-scope";
import { BudgetRangeLabels, ServiceTypeLabels, type BudgetRange, type ServiceType } from "@/types/leads";

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

/** The lead's facts the scope shows; edited through onSaveFacts. */
export interface LeadFacts {
  service_type: string | null;
  budget_range: string | null;
  target_start_date: string | null;
  target_end_date: string | null;
  carpet_area: number | null;
}

function Label({ children, need }: { children: React.ReactNode; need?: boolean }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
      {children}
      {need && <span className="ml-1 text-amber-600 normal-case tracking-normal font-medium">· needed</span>}
    </p>
  );
}

export function ScopeBrief({
  propertyId,
  linkedType,
  linkedId,
  readOnly = false,
  facts,
  onSaveFacts,
  onChanged,
}: {
  propertyId: string;
  linkedType: "lead" | "project";
  linkedId: string;
  readOnly?: boolean;
  facts?: LeadFacts | null;
  /** Absent on a project: the facts are read-only there. */
  onSaveFacts?: (patch: Partial<LeadFacts>) => Promise<void>;
  /** Anything that can move the readiness strip. */
  onChanged?: () => void;
}) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [styles, setStyles] = useState<StyleOption[]>([]);
  const [plans, setPlans] = useState<FloorPlanDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [customFinish, setCustomFinish] = useState("");
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
        fetchConfigOnce<{ quotationCostItemCategories?: Category[] }>("/api/settings/quotation-cost-item-categories").catch(() => null),
        fetchConfigOnce<{ data?: StyleOption[] }>("/api/library/styles").catch(() => null),
      ]);
      if (b?.data) {
        setBrief(b.data);
        setNotes(b.data.brief_notes ?? "");
      }
      if (cats) setCategories((cats.quotationCostItemCategories ?? []).filter((c) => c.is_active !== false && !c.is_charge));
      if (st?.data) setStyles(st.data);
    })();
    void loadPlans();
  }, [propertyId, loadPlans]);

  // Every save is numbered; a reply older than the latest request is
  // dropped, so quick successive clicks never see an earlier answer land on
  // top of a later choice.
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
    if (mine !== seq.current) return;
    if (res.ok) {
      setBrief(json.data);
      onChanged?.();
    } else setError(json.error || "Could not save");
  };

  const toggleIn = (field: "services_wanted" | "style_codes" | "preferred_finishes", value: string) => {
    const current = briefRef.current;
    if (!current || readOnly) return;
    const list = current[field] ?? [];
    void save({ [field]: list.includes(value) ? list.filter((x) => x !== value) : [...list, value] } as Partial<Brief>);
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
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const latest = plans[0] ?? null;
  const factsEditable = !readOnly && !!onSaveFacts;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: the plan and the lead's facts */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <div>
          <Label need={!latest}>Floor plan</Label>
          {latest ? (
            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 pl-2.5 pr-1 py-1 max-w-full">
              <a href={latest.signed_url ?? "#"} target="_blank" rel="noreferrer" title={latest.file_name} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-blue-700 min-w-0">
                <MapIcon className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="truncate">{latest.file_name}</span>
                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </a>
              {plans.length > 1 && <span className="text-[10px] text-slate-400 ml-1">+{plans.length - 1}</span>}
              {!readOnly && (
                <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} title="Upload a newer plan" className="ml-1 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 disabled:opacity-60">
                  <ArrowUpTrayIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : readOnly ? (
            <p className="text-xs text-slate-400">None on file.</p>
          ) : (
            <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-dashed border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-60">
              <ArrowUpTrayIcon className="w-3.5 h-3.5" />
              {uploading ? "Uploading…" : "Add the floor plan"}
            </button>
          )}
          <input ref={fileInput} type="file" accept="image/*,.pdf,.dwg,.dxf" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        </div>

        {facts && (
          <div>
            <Label>From the lead{onSaveFacts ? " · edits save to the lead" : ""}</Label>
            <dl className="grid grid-cols-[6.5rem_1fr] gap-y-1.5 gap-x-2 text-xs items-center">
              <dt className="text-slate-500">Service</dt>
              <dd>
                {factsEditable ? (
                  <select value={facts.service_type ?? ""} onChange={(e) => void onSaveFacts?.({ service_type: e.target.value || null })} className="w-full px-2 py-1 border border-slate-200 rounded-md bg-white outline-none focus:border-blue-400">
                    <option value="">—</option>
                    {(Object.keys(ServiceTypeLabels) as ServiceType[]).map((k) => (
                      <option key={k} value={k}>{ServiceTypeLabels[k]}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-slate-800">{facts.service_type ? ServiceTypeLabels[facts.service_type as ServiceType] ?? facts.service_type : "—"}</span>
                )}
              </dd>
              <dt className="text-slate-500">Budget</dt>
              <dd>
                {factsEditable ? (
                  <select value={facts.budget_range ?? ""} onChange={(e) => void onSaveFacts?.({ budget_range: e.target.value || null })} className="w-full px-2 py-1 border border-slate-200 rounded-md bg-white outline-none focus:border-blue-400">
                    <option value="">—</option>
                    {(Object.keys(BudgetRangeLabels) as BudgetRange[]).map((k) => (
                      <option key={k} value={k}>{BudgetRangeLabels[k]}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-slate-800">{facts.budget_range ? BudgetRangeLabels[facts.budget_range as BudgetRange] ?? facts.budget_range : "—"}</span>
                )}
              </dd>
              <dt className="text-slate-500">Timeline</dt>
              <dd className="flex items-center gap-1 flex-wrap">
                {factsEditable ? (
                  <>
                    <input type="date" value={facts.target_start_date ?? ""} onChange={(e) => void onSaveFacts?.({ target_start_date: e.target.value || null })} className="px-2 py-1 border border-slate-200 rounded-md bg-white outline-none focus:border-blue-400" />
                    <span className="text-slate-400">→</span>
                    <input type="date" value={facts.target_end_date ?? ""} onChange={(e) => void onSaveFacts?.({ target_end_date: e.target.value || null })} className="px-2 py-1 border border-slate-200 rounded-md bg-white outline-none focus:border-blue-400" />
                  </>
                ) : (
                  <span className="text-slate-800">
                    {[facts.target_start_date, facts.target_end_date]
                      .filter(Boolean)
                      .map((d) => new Date(d as string).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }))
                      .join(" → ") || "—"}
                  </span>
                )}
              </dd>
              <dt className="text-slate-500">Carpet area</dt>
              <dd>
                {factsEditable ? (
                  <span className="inline-flex items-center gap-1">
                    <input
                      type="number"
                      defaultValue={facts.carpet_area ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value === "" ? null : Number(e.target.value);
                        if (v !== (facts.carpet_area ?? null)) void onSaveFacts?.({ carpet_area: v });
                      }}
                      className="w-24 px-2 py-1 border border-slate-200 rounded-md bg-white outline-none focus:border-blue-400 text-right"
                    />
                    <span className="text-slate-500">sqft</span>
                  </span>
                ) : (
                  <span className="text-slate-800">{facts.carpet_area ? `${facts.carpet_area} sqft` : "—"}</span>
                )}
              </dd>
            </dl>
          </div>
        )}
      </section>

      {/* Right: what they want */}
      <section className="lg:col-span-2 rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <div>
          <Label need={!!brief && brief.services_wanted.length === 0}>Services wanted</Label>
          {categories.length === 0 ? (
            <p className="text-xs text-slate-400">No categories in the catalogue yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => {
                const on = !!brief?.services_wanted.includes(c.id);
                return (
                  <button key={c.id} type="button" disabled={readOnly || !brief} onClick={() => toggleIn("services_wanted", c.id)} aria-pressed={on}
                    className={cn("px-2.5 py-1 text-xs font-medium rounded-full border transition-colors disabled:cursor-default", on ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700")}>
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}
          <p className="mt-1 text-[11px] text-slate-400">The quotation builder ticks each of these off as it is quoted.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label need={!!brief && brief.style_codes.length === 0}>Style</Label>
            {styles.length === 0 ? (
              <p className="text-xs text-slate-400">No styles in the Design Library yet.</p>
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
            <Label need={!!brief && brief.preferred_finishes.length === 0}>Finishes they lean to</Label>
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
            <p className="mt-1 text-[11px] text-slate-400">A space can name its own finish where it differs.</p>
          </div>
        </div>

        <div>
          <Label>From the conversation</Label>
          <textarea
            value={notes}
            disabled={readOnly || !brief}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if ((brief?.brief_notes ?? "") !== notes.trim()) void save({ brief_notes: notes.trim() || null });
            }}
            rows={2}
            placeholder="What they said they want - anything worth remembering that no field holds"
            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 resize-none disabled:bg-transparent disabled:border-transparent disabled:px-0"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </section>
    </div>
  );
}
