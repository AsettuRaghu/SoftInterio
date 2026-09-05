"use client";

/**
 * Share a quotation with the client.
 *
 * Replaces two half-measures: a "Share" button that copied a link and told you
 * so in an alert(), and a "Send to Client" button that opened a mailto: link -
 * which does nothing at all on a machine with no desktop mail client
 * configured, and silently so.
 *
 * Neither of them moved the quotation out of draft, which broke the client
 * portal outright: the approve and reject endpoints only accept a quotation in
 * sent / viewed / negotiating, so a client following a shared link was told
 * "Quotation cannot be approved (current status: draft)". That is why no
 * quotation in the database has ever reached sent or viewed.
 *
 * Sharing from here marks it sent, which is also what starts the view tracking
 * the quotation already carries columns for.
 */

import React, { useEffect, useState } from "react";
import {
  XMarkIcon,
  LinkIcon,
  EnvelopeIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";

interface ShareQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: {
    id: string;
    quotation_number: string;
    status: string;
    client_name?: string | null;
    client_phone?: string | null;
    grand_total?: number | null;
  } | null;
  /** Called after the status changes, so the page can refresh. */
  onShared?: () => void;
}

/** Digits only, with India's country code when the number is a bare 10-digit. */
function toWhatsAppNumber(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function ShareQuotationModal({
  isOpen,
  onClose,
  quotation,
  onShared,
}: ShareQuotationModalProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [markedSent, setMarkedSent] = useState(false);

  useEffect(() => {
    if (!isOpen || !quotation) return;

    setError(null);
    setCopied(false);
    setMarkedSent(false);
    setShareUrl(null);

    void (async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/quotations/${quotation.id}/share`,
          { method: "POST" }
        );
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Could not create a share link");
        }
        setShareUrl(data.data.share_url);
        setExpiresAt(data.data.expires_at || null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not create a share link"
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, [isOpen, quotation]);

  if (!isOpen || !quotation) return null;

  /**
   * A draft the client can open is a draft the client cannot act on, so any
   * share moves it to sent. Failure here is reported rather than swallowed:
   * silently leaving it in draft is what caused the original problem.
   */
  const markAsSent = async () => {
    if (quotation.status !== "draft" || markedSent) return true;
    try {
      const response = await fetch(`/api/quotations/${quotation.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sent" }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Could not mark the quotation as sent");
      }
      setMarkedSent(true);
      onShared?.();
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Shared, but could not mark it as sent"
      );
      return false;
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    await markAsSent();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy - select the link above and copy it manually.");
    }
  };

  const message = shareUrl
    ? `Hello ${quotation.client_name || "there"},\n\nHere is quotation ${
        quotation.quotation_number
      }:\n${shareUrl}`
    : "";

  const shareOnWhatsApp = async () => {
    if (!shareUrl) return;
    await markAsSent();
    const number = toWhatsAppNumber(quotation.client_phone);
    // wa.me with no number opens the contact picker, which is the sensible
    // fallback when the client has no phone recorded.
    const url = number
      ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareByEmail = async () => {
    if (!shareUrl) return;
    await markAsSent();
    const subject = `Quotation ${quotation.quotation_number}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(message)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            Share quotation
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {isLoading ? (
            <p className="text-sm text-slate-400">Creating a secure link...</p>
          ) : (
            <>
              {shareUrl && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    Client link
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={shareUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-600"
                    />
                    <button
                      type="button"
                      onClick={copyLink}
                      title="Copy link"
                      className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 transition-colors"
                    >
                      {copied ? (
                        <CheckIcon className="w-4 h-4 text-green-600" />
                      ) : (
                        <LinkIcon className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {expiresAt && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Link expires {new Date(expiresAt).toLocaleDateString()}.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={shareOnWhatsApp}
                  disabled={!shareUrl}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-white bg-[#25D366] rounded-lg hover:bg-[#20BD5A] transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.898 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={shareByEmail}
                  disabled={!shareUrl}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <EnvelopeIcon className="w-4 h-4" />
                  Email
                </button>
              </div>

              {quotation.status === "draft" && !markedSent && (
                <p className="text-[11px] text-slate-400">
                  Sharing marks this quotation as sent, which is what lets the
                  client approve or reject it.
                </p>
              )}
              {markedSent && (
                <p className="text-[11px] text-green-600">
                  Marked as sent. The client can now approve or reject it.
                </p>
              )}
              {error && <p className="text-xs text-red-600">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ShareQuotationModal;
