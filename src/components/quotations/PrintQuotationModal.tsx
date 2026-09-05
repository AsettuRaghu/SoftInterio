"use client";

import React, { useEffect, useRef, useState } from "react";

interface PrintQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotationId: string;
  quotationNumber: string;
}

interface PrintFormat {
  id: string;
  name: string;
  description?: string;
  itemise_to: string;
  price_at: string;
  is_default?: boolean;
}

interface PrintContext {
  formats?: PrintFormat[];
  defaultFormatId?: string | null;
  terms?: { title: string };
}

const LEVEL_LABEL: Record<string, string> = {
  space: "rooms",
  component: "components",
  category: "cost categories",
  cost_item: "individual cost items",
  none: "nothing",
};

/**
 * Preview and print a quotation without leaving the builder.
 *
 * Shows the real PDF rather than an HTML approximation of it - the whole point
 * is to see what the client will receive, and a second rendering that merely
 * resembles it would drift from the document it claims to preview.
 */
export function PrintQuotationModal({
  isOpen,
  onClose,
  quotationId,
  quotationNumber,
}: PrintQuotationModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<PrintContext>({});
  const [formatId, setFormatId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  // The format list is fetched once; the document is re-rendered whenever the
  // choice changes, so the preview always matches what Download and Print give.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/quotations/${quotationId}/print-context`);
      if (!res.ok || cancelled) return;
      const ctx: PrintContext = await res.json();
      setContext(ctx);
      setFormatId((current) => current ?? ctx.defaultFormatId ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, quotationId]);

  useEffect(() => {
    if (!isOpen) return;
    let revoked: string | null = null;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      setSavedMessage(null);
      try {
        const query = new URLSearchParams({ inline: "1" });
        if (formatId) query.set("format_id", formatId);
        const pdfRes = await fetch(
          `/api/quotations/${quotationId}/pdf?${query.toString()}`
        );

        if (!pdfRes.ok) {
          const data = await pdfRes.json().catch(() => ({}));
          // The route reports the underlying cause in `details`; dropping it
          // left "Failed to generate PDF" as the only thing anyone ever saw.
          throw new Error(
            [data.error || "Could not generate the PDF", data.details]
              .filter(Boolean)
              .join(" — ")
          );
        }
        const url = URL.createObjectURL(await pdfRes.blob());
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        revoked = url;
        setBlobUrl(url);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not generate the PDF");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
      setBlobUrl(null);
    };
  }, [isOpen, quotationId, formatId]);

  if (!isOpen) return null;

  const selectedFormat = (context.formats || []).find((f) => f.id === formatId);

  const download = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${quotationNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Printing goes through the embedded viewer so the browser prints the PDF
  // itself, not a screenshot of the page around it.
  const print = () => frameRef.current?.contentWindow?.print();

  const saveToDocuments = async () => {
    setIsSaving(true);
    setSavedMessage(null);
    try {
      const res = await fetch(`/api/quotations/${quotationId}/save-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format_id: formatId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the document");
      setSavedMessage("Saved to Documents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the document");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-xl w-full max-w-5xl h-full max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-900">
              Print {quotationNumber}
            </h2>
            <div className="mt-1.5 flex items-center gap-2">
              <select
                value={formatId || ""}
                onChange={(e) => setFormatId(e.target.value)}
                disabled={!context.formats?.length}
                className="px-2 py-1 text-sm border border-slate-200 rounded-md bg-white focus:ring-1 focus:ring-blue-500 outline-none max-w-[280px]"
              >
                {(context.formats || []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              {/* Spells out what the chosen format actually does, so a
                  surprising document leads to the Print Library rather than
                  to a bug report. */}
              <span className="text-xs text-slate-500 truncate">
                {selectedFormat
                  ? `${
                      LEVEL_LABEL[selectedFormat.itemise_to] ||
                      selectedFormat.itemise_to
                    } · priced at ${
                      LEVEL_LABEL[selectedFormat.price_at] ||
                      selectedFormat.price_at
                    }`
                  : ""}
                {context.terms ? ` · ${context.terms.title}` : ""}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 shrink-0"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 bg-slate-100">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-slate-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center px-6">
              <p className="text-sm text-red-600 text-center whitespace-pre-wrap">
                {error}
              </p>
            </div>
          ) : blobUrl ? (
            <iframe
              ref={frameRef}
              src={blobUrl}
              title={`${quotationNumber} preview`}
              className="w-full h-full border-0"
            />
          ) : null}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-3">
          <span className="text-xs text-green-600">{savedMessage}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={saveToDocuments}
              disabled={!blobUrl || isSaving}
              className="px-3 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save to Documents"}
            </button>
            <button
              onClick={download}
              disabled={!blobUrl}
              className="px-3 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              Download
            </button>
            <button
              onClick={print}
              disabled={!blobUrl}
              className="px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50"
            >
              Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
