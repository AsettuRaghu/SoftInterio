"use client";

/**
 * The line above the spaces: the two property facts the scope rests on and
 * a save indicator.
 *
 *   - the floor plan (a Document of category `floor_plan` on the lead or
 *     project, so it is in Documents too and comes across at handover);
 *   - the configuration - 2 BHK, 3 BHK… - a property fact that picks the
 *     preset the scope is laid down from.
 *
 * Both are required to qualify a lead, so on a lead past `new` they are
 * normally already there; this line lets them be changed later. Everything
 * on the Scope tab saves as you go - the indicator is the reassurance.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowTopRightOnSquareIcon, ArrowUpTrayIcon, CheckIcon, MapIcon } from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";
import { CONFIGURATIONS, CONFIGURATION_LABELS, type Configuration } from "@/lib/scope/configuration";

interface FloorPlanDoc {
  id: string;
  file_name: string;
  signed_url?: string | null;
}

export type SaveState = "idle" | "saving" | "saved" | "failed";

export function ScopeHeaderLine({
  linkedType,
  linkedId,
  readOnly,
  configuration,
  onSaveConfiguration,
  saveState,
  onChanged,
}: {
  linkedType: "lead" | "project";
  linkedId: string;
  readOnly: boolean;
  configuration: string | null;
  /** Absent on a project. */
  onSaveConfiguration?: (value: Configuration | null) => Promise<void>;
  saveState: SaveState;
  onChanged?: () => void;
}) {
  const [plans, setPlans] = useState<FloorPlanDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadPlans = useCallback(async () => {
    const res = await fetch(`/api/documents?linked_type=${linkedType}&linked_id=${linkedId}&category=floor_plan`);
    const json = await res.json().catch(() => ({}));
    if (res.ok) setPlans(json.documents ?? []);
  }, [linkedType, linkedId]);

  useEffect(() => {
    // setState happens after the fetch resolves; the rule cannot see through `loadPlans`.
     
    void loadPlans();
  }, [loadPlans]);

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

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 border-b border-slate-200 bg-slate-50/60 text-xs">
      {/* Floor plan */}
      <div className="inline-flex items-center gap-2">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-400">Floor plan</span>
        {latest ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white pl-2 pr-1 py-0.5">
            <a href={latest.signed_url ?? "#"} target="_blank" rel="noreferrer" title={latest.file_name} className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-blue-700 max-w-[12rem]">
              <MapIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="truncate">{latest.file_name}</span>
              <ArrowTopRightOnSquareIcon className="w-3 h-3 text-slate-400 shrink-0" />
            </a>
            {plans.length > 1 && <span className="text-[10px] text-slate-400">+{plans.length - 1}</span>}
            {!readOnly && (
              <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} title="Upload a newer plan" className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-60">
                <ArrowUpTrayIcon className="w-3 h-3" />
              </button>
            )}
          </span>
        ) : readOnly ? (
          <span className="text-slate-400">none</span>
        ) : (
          <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-dashed border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-60">
            <ArrowUpTrayIcon className="w-3 h-3" /> {uploading ? "Uploading…" : "Add"}
          </button>
        )}
        <input ref={fileInput} type="file" accept="image/*,.pdf,.dwg,.dxf" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
      </div>

      {/* Configuration */}
      <div className="inline-flex items-center gap-2">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-400">Configuration</span>
        {readOnly || !onSaveConfiguration ? (
          <span className="text-slate-700 font-medium">{configuration ? CONFIGURATION_LABELS[configuration as Configuration] ?? configuration : "—"}</span>
        ) : (
          <span className="inline-flex rounded-md border border-slate-200 bg-white overflow-hidden">
            {CONFIGURATIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => void onSaveConfiguration(configuration === c ? null : c)}
                className={cn("px-2 py-0.5 text-[11px] font-medium border-r border-slate-200 last:border-r-0", configuration === c ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-50")}
              >
                {CONFIGURATION_LABELS[c]}
              </button>
            ))}
          </span>
        )}
      </div>

      <span className="flex-1" />
      {error && <span className="text-red-600">{error}</span>}
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[11px] transition-opacity",
          saveState === "idle" ? "opacity-0" : "opacity-100",
          saveState === "failed" ? "text-red-600" : saveState === "saving" ? "text-slate-400" : "text-emerald-600",
        )}
        aria-live="polite"
      >
        {saveState === "saving" ? "Saving…" : saveState === "failed" ? "Not saved - try again" : <><CheckIcon className="w-3 h-3" /> Saved</>}
      </span>
    </div>
  );
}
