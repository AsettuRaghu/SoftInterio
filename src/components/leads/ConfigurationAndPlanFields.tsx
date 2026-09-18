"use client";

/**
 * The two property facts the scope rests on, as form fields: the
 * configuration (2 BHK…) and the floor plan. Used by the create-lead form,
 * the edit-lead dialog and the stage dialog, so they look and behave the
 * same everywhere - optional when a lead is entered, required from
 * Qualified, like the rest of the property fields.
 *
 * The plan is a Document on the lead. On an existing lead it uploads at
 * once; on a lead being created there is nothing to attach it to yet, so
 * the file is held and the create form uploads it after the lead exists.
 */

import React, { useEffect, useRef, useState } from "react";
import { ArrowUpTrayIcon, MapIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";
import { CONFIGURATIONS, CONFIGURATION_LABELS } from "@/lib/scope/configuration";

export async function uploadFloorPlan(leadId: string, file: File): Promise<void> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("linked_type", "lead");
  fd.append("linked_id", leadId);
  fd.append("category", "floor_plan");
  // The file's own name as the title; the category says what it is.
  fd.append("title", file.name.replace(/\.[^.]+$/, ""));
  fd.append("tags", "floor plan");
  const res = await fetch("/api/documents", { method: "POST", body: fd });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Floor plan upload failed");
}

export function ConfigurationField({
  value,
  onChange,
  required = false,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  /** The edit dialog's smaller controls; the create form and stage dialog use the larger. */
  compact?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        Configuration {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white",
          compact ? "px-3 py-2 text-sm" : "px-4 py-2.5",
        )}
      >
        <option value="">Select configuration</option>
        {CONFIGURATIONS.map((c) => (
          <option key={c} value={c}>
            {CONFIGURATION_LABELS[c]}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Existing lead: shows what is on file, uploads a new one at once.
 * New lead (no leadId): holds the chosen file for the caller to upload.
 */
export function FloorPlanField({
  leadId,
  required = false,
  pendingFile,
  onPendingFile,
  onUploaded,
}: {
  leadId?: string | null;
  required?: boolean;
  pendingFile?: File | null;
  onPendingFile?: (f: File | null) => void;
  onUploaded?: () => void;
}) {
  const [onFile, setOnFile] = useState<{ name: string; url: string | null } | null | undefined>(leadId ? undefined : null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!leadId) return;
    let live = true;
    void (async () => {
      try {
        const res = await fetch(`/api/documents?linked_type=lead&linked_id=${leadId}&category=floor_plan`);
        const json = await res.json().catch(() => ({}));
        if (!live) return;
        const d = res.ok ? json.documents?.[0] : null;
        setOnFile(d ? { name: d.file_name, url: d.signed_url ?? null } : null);
      } catch {
        // The check failed (a dropped request); offer the upload rather than
        // sit on "Checking…" - the server still knows what is on file.
        if (live) setOnFile(null);
      }
    })();
    return () => {
      live = false;
    };
  }, [leadId]);

  const choose = async (file: File) => {
    setError(null);
    if (!leadId) {
      onPendingFile?.(file);
      return;
    }
    setUploading(true);
    try {
      await uploadFloorPlan(leadId, file);
      setOnFile({ name: file.name, url: null });
      onUploaded?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  const have = leadId ? onFile : pendingFile ? { name: pendingFile.name, url: null } : null;

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        Floor plan {required && <span className="text-red-500">*</span>}
      </label>
      {leadId && onFile === undefined ? (
        <p className="text-xs text-slate-400 py-2">Checking…</p>
      ) : have ? (
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-sm text-emerald-800 max-w-full">
          <MapIcon className="w-4 h-4 shrink-0" />
          {have.url ? (
            <a href={have.url} target="_blank" rel="noreferrer" className="truncate max-w-[14rem] hover:underline">{have.name}</a>
          ) : (
            <span className="truncate max-w-[14rem]">{have.name}</span>
          )}
          <button type="button" onClick={() => input.current?.click()} className="text-xs text-emerald-700 hover:underline shrink-0">replace</button>
          {!leadId && (
            <button type="button" onClick={() => onPendingFile?.(null)} title="Remove" className="p-0.5 rounded text-emerald-700 hover:bg-emerald-100 shrink-0">
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={uploading}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-sm disabled:opacity-60",
            required ? "border-amber-300 text-amber-800 hover:bg-amber-50" : "border-slate-300 text-slate-600 hover:bg-slate-50",
          )}
        >
          <ArrowUpTrayIcon className="w-4 h-4" />
          {uploading ? "Uploading…" : leadId ? "Upload the floor plan" : "Choose the floor plan"}
        </button>
      )}
      <input ref={input} type="file" accept="image/*,.pdf,.dwg,.dxf" className="hidden" onChange={(e) => e.target.files?.[0] && void choose(e.target.files[0])} />
      {/* Native required check for a new lead: a hidden input carrying the file name. */}
      {required && !leadId && <input tabIndex={-1} required value={pendingFile?.name ?? ""} onChange={() => undefined} className="sr-only" aria-hidden />}
      <p className="mt-1 text-[11px] text-slate-500">PDF, image or CAD. Filed under the lead&rsquo;s Documents.</p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
