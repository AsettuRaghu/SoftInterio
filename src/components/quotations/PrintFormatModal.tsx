"use client";

/**
 * Create or edit a print format.
 *
 * The three settings at the top are deliberately separate controls rather than
 * one "detail level" dropdown. Depth and pricing are different questions, and
 * conflating them is what stopped the old presentation_level enum expressing
 * the arrangement interior sellers ask for most: show every component, but
 * price only at the space level.
 */

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { XMarkIcon } from "@heroicons/react/24/outline";
import {
  ITEMISE_LEVEL_LABELS,
  PRICE_AT_LABELS,
  type ItemiseLevel,
  type PriceAtLevel,
  type QuotationPrintFormat,
} from "@/types/quotations";

interface PrintFormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Null creates a new format. */
  format: QuotationPrintFormat | null;
  onSaved: () => void;
}

type FormState = {
  name: string;
  description: string;
  itemise_to: ItemiseLevel;
  price_at: PriceAtLevel;
  show_descriptions: boolean;
  show_specifications: boolean;
  show_dimensions: boolean;
  show_quantities: boolean;
  show_company_details: boolean;
  show_bank_details: boolean;
  show_payment_terms: boolean;
  show_terms: boolean;
  /** Which clause this format prints. Empty means the tenant default. */
  terms_clause_id: string;
  cover_enabled: boolean;
  cover_image_path: string;
  footer_text: string;
  is_default: boolean;
  is_active: boolean;
};

const BLANK: FormState = {
  name: "",
  description: "",
  itemise_to: "component",
  price_at: "component",
  show_descriptions: false,
  show_specifications: false,
  show_dimensions: true,
  show_quantities: true,
  show_company_details: true,
  show_bank_details: true,
  show_payment_terms: true,
  show_terms: true,
  terms_clause_id: "",
  cover_enabled: false,
  cover_image_path: "",
  footer_text: "",
  is_default: false,
  is_active: true,
};

/** Small labelled switch, so the many toggles below stay scannable. */
function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      <span className="min-w-0">
        <span className="block text-sm text-slate-700">{label}</span>
        {hint && (
          <span className="block text-[11px] text-slate-400">{hint}</span>
        )}
      </span>
    </label>
  );
}

export function PrintFormatModal({
  isOpen,
  onClose,
  format,
  onSaved,
}: PrintFormatModalProps) {
  const [form, setForm] = useState<FormState>(BLANK);
  // Attaching the terms here rather than relying on a tenant-wide default lets
  // a client document and an internal one carry different terms, and stops a
  // second active clause being a trap for whoever next changes the default.
  const [clauses, setClauses] = useState<
    Array<{ id: string; title: string; is_default?: boolean }>
  >([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    void (async () => {
      const res = await fetch("/api/quotations/terms-clauses");
      if (!res.ok) return;
      const data = await res.json();
      setClauses(data.clauses || []);
    })();
  }, [isOpen]);
  const [isUploading, setIsUploading] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Uploads immediately rather than on save, so the preview shown here and the
   * cover the PDF prints are the same stored object.
   */
  const uploadCover = async (file: File) => {
    try {
      setIsUploading(true);
      setError(null);
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/quotations/print-formats/cover", {
        method: "POST",
        body,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed");
      setForm((f) => ({ ...f, cover_image_path: data.path }));
      setCoverPreview(data.preview_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (format) {
      setForm({
        name: format.name,
        description: format.description || "",
        itemise_to: format.itemise_to,
        price_at: format.price_at,
        show_descriptions: format.show_descriptions,
        show_specifications: format.show_specifications,
        show_dimensions: format.show_dimensions,
        show_quantities: format.show_quantities,
        show_company_details: format.show_company_details,
        show_bank_details: format.show_bank_details,
        show_payment_terms: format.show_payment_terms,
        show_terms: format.show_terms,
        terms_clause_id:
          (format as { terms_clause_id?: string | null }).terms_clause_id || "",
        cover_enabled: format.cover_enabled,
        cover_image_path: format.cover_image_path || "",
        footer_text: format.footer_text || "",
        is_default: format.is_default,
        is_active: format.is_active,
      });
      setCoverPreview(format.cover_preview_url || null);
    } else {
      setForm(BLANK);
      setCoverPreview(null);
    }
  }, [isOpen, format]);

  if (!isOpen) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const url = format
        ? `/api/quotations/print-formats/${format.id}`
        : "/api/quotations/print-formats";

      const response = await fetch(url, {
        method: format ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          description: form.description.trim() || null,
          // Empty means "use the tenant default", which the column stores as
          // null - an empty string is not a uuid and the insert would fail.
          terms_clause_id: form.terms_clause_id || null,
          cover_image_path: form.cover_image_path.trim() || null,
          footer_text: form.footer_text.trim() || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save");

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[6vh]">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[86vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            {format ? "Edit print format" : "New print format"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Identity */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Client presentation"
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="When should this format be used?"
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                />
              </div>
            </div>

            {/* The two axes that matter most */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900">
                What the client sees
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Show detail down to
                  </label>
                  <select
                    value={form.itemise_to}
                    onChange={(e) =>
                      set("itemise_to", e.target.value as ItemiseLevel)
                    }
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    {(
                      Object.keys(ITEMISE_LEVEL_LABELS) as ItemiseLevel[]
                    ).map((k) => (
                      <option key={k} value={k}>
                        {ITEMISE_LEVEL_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Show prices at
                  </label>
                  <select
                    value={form.price_at}
                    onChange={(e) =>
                      set("price_at", e.target.value as PriceAtLevel)
                    }
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    {(Object.keys(PRICE_AT_LABELS) as PriceAtLevel[]).map(
                      (k) => (
                        <option key={k} value={k}>
                          {PRICE_AT_LABELS[k]}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                These are separate on purpose. Listing every component while
                pricing only per space shows the full scope without inviting a
                line-by-line comparison.
              </p>
            </div>

            {/* Verbosity */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                Detail on each line
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <Toggle
                  label="Descriptions"
                  hint="The written description under each name"
                  checked={form.show_descriptions}
                  onChange={(v) => set("show_descriptions", v)}
                />
                <Toggle
                  label="Specifications"
                  hint="Material and finish details"
                  checked={form.show_specifications}
                  onChange={(v) => set("show_specifications", v)}
                />
                <Toggle
                  label="Dimensions"
                  checked={form.show_dimensions}
                  onChange={(v) => set("show_dimensions", v)}
                />
                <Toggle
                  label="Quantities"
                  checked={form.show_quantities}
                  onChange={(v) => set("show_quantities", v)}
                />
              </div>
            </div>

            {/* Sections */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                Sections to include
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <Toggle
                  label="Company details"
                  checked={form.show_company_details}
                  onChange={(v) => set("show_company_details", v)}
                />
                <Toggle
                  label="Bank details"
                  checked={form.show_bank_details}
                  onChange={(v) => set("show_bank_details", v)}
                />
                <Toggle
                  label="Payment schedule"
                  checked={form.show_payment_terms}
                  onChange={(v) => set("show_payment_terms", v)}
                />
                <Toggle
                  label="Terms & conditions"
                  checked={form.show_terms}
                  onChange={(v) => set("show_terms", v)}
                />
              </div>

              {form.show_terms && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Which terms
                  </label>
                  <select
                    value={form.terms_clause_id}
                    onChange={(e) => set("terms_clause_id", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    <option value="">
                      Use the default clause
                      {clauses.find((c) => c.is_default)
                        ? ` (${clauses.find((c) => c.is_default)!.title})`
                        : ""}
                    </option>
                    {clauses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    One clause prints, as its own section. A format with none
                    chosen falls back to the tenant default.
                  </p>
                </div>
              )}
            </div>

            {/* Cover page */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                Cover page
              </h3>
              <Toggle
                label="Start with a cover page"
                hint="A full-page image before the quotation itself"
                checked={form.cover_enabled}
                onChange={(v) => set("cover_enabled", v)}
              />
              {form.cover_enabled && (
                <div className="mt-3 pl-6 space-y-2">
                  {coverPreview ? (
                    <div className="relative inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={coverPreview}
                        alt="Cover page"
                        className="max-h-44 rounded-lg border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          set("cover_image_path", "");
                          setCoverPreview(null);
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:text-red-600 shadow-sm"
                        title="Remove cover image"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-1 px-4 py-6 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadCover(file);
                          e.target.value = "";
                        }}
                      />
                      <span className="text-sm font-medium text-slate-600">
                        {isUploading ? "Uploading..." : "Upload cover image"}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        PNG, JPG or WebP up to 10MB
                      </span>
                    </label>
                  )}
                  <p className="text-[11px] text-slate-400">
                    The cover prints exactly as uploaded. Nothing is written
                    over it, so any wording belongs in the artwork itself.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Footer text
              </label>
              <input
                type="text"
                value={form.footer_text}
                onChange={(e) => set("footer_text", e.target.value)}
                placeholder="Shown at the bottom of every page"
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              />
            </div>

            {/* Status */}
            <div className="pt-2 border-t border-slate-100">
              <Toggle
                label="Use as the default format"
                hint="Only one format can be the default; setting this moves it."
                checked={form.is_default}
                onChange={(v) => set("is_default", v)}
              />
              <Toggle
                label="Active"
                hint="Inactive formats stay saved but are not offered when printing."
                checked={form.is_active}
                onChange={(v) => set("is_active", v)}
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : format ? "Save Changes" : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PrintFormatModal;
