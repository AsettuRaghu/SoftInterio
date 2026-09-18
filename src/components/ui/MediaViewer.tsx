"use client";

/**
 * The one way to look at a picture or a file in the app: a full-screen
 * viewer over a dark backdrop, with ← → through the set, a counter, the
 * name, and Open / Download for what cannot be shown inline. Images are
 * shown as they are; PDFs in a frame; anything else as a card.
 *
 * Give it every item in the set and the index to start on, so a set of
 * reference pictures or a Documents list can be walked without closing.
 * Keyboard: ← → Esc. Portalled to body so it sits above any panel.
 */

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";

export interface MediaItem {
  id: string;
  name: string;
  url: string | null;
  /** MIME type when known; decides image / pdf / other. */
  type?: string | null;
  /** A line under the name - where it came from, who added it. */
  caption?: string | null;
}

export const kindOf = (t?: string | null): "image" | "pdf" | "other" =>
  t?.startsWith("image/") ? "image" : t === "application/pdf" ? "pdf" : "other";

export function MediaViewer({
  items,
  index,
  onClose,
  onIndexChange,
}: {
  items: MediaItem[];
  index: number;
  onClose: () => void;
  onIndexChange?: (i: number) => void;
}) {
  const [i, setI] = useState(Math.max(0, Math.min(index, items.length - 1)));
  const go = useCallback(
    (to: number) => {
      if (to < 0 || to >= items.length) return;
      setI(to);
      onIndexChange?.(to);
    },
    [items.length, onIndexChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(i - 1);
      if (e.key === "ArrowRight") go(i + 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [i, go, onClose]);

  if (typeof document === "undefined" || items.length === 0) return null;
  const item = items[i];
  const kind = kindOf(item.type);
  const hasPrev = i > 0;
  const hasNext = i < items.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black/85 flex flex-col" onClick={onClose} role="dialog" aria-modal="true">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{item.name}</p>
          {item.caption && <p className="text-xs text-white/60 truncate">{item.caption}</p>}
        </div>
        {items.length > 1 && (
          <span className="text-xs text-white/70 tabular-nums">
            {i + 1} / {items.length}
          </span>
        )}
        {item.url && (
          <>
            <a href={item.url} target="_blank" rel="noreferrer" title="Open in a new tab" className="p-2 rounded-full hover:bg-white/15">
              <ArrowTopRightOnSquareIcon className="w-5 h-5" />
            </a>
            <a href={item.url} download={item.name} title="Download" className="p-2 rounded-full hover:bg-white/15">
              <ArrowDownTrayIcon className="w-5 h-5" />
            </a>
          </>
        )}
        <button type="button" onClick={onClose} title="Close (Esc)" className="p-2 rounded-full hover:bg-white/15">
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Stage */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center px-14 pb-4">
        {hasPrev && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(i - 1);
            }}
            title="Previous (←)"
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/25"
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
        )}
        <div className="max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
          {kind === "image" && item.url ? (
            <img src={item.url} alt={item.name} className="max-h-[calc(100vh-8rem)] max-w-[calc(100vw-7rem)] object-contain rounded-md shadow-2xl select-none" draggable={false} />
          ) : kind === "pdf" && item.url ? (
            <iframe src={item.url} title={item.name} className="h-[calc(100vh-8rem)] w-[min(60rem,calc(100vw-7rem))] rounded-md bg-white shadow-2xl" />
          ) : (
            <div className="rounded-xl bg-white px-10 py-8 text-center max-w-sm">
              <DocumentIcon className="w-12 h-12 text-slate-400 mx-auto" />
              <p className="mt-3 text-sm font-medium text-slate-800 break-all">{item.name}</p>
              <p className="mt-1 text-xs text-slate-500">This kind of file cannot be shown here.</p>
              {item.url && (
                <a href={item.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  <ArrowDownTrayIcon className="w-4 h-4" /> Download
                </a>
              )}
            </div>
          )}
        </div>
        {hasNext && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(i + 1);
            }}
            title="Next (→)"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/25"
          >
            <ChevronRightIcon className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Filmstrip, when there is more than one */}
      {items.length > 1 && (
        <div className="flex justify-center gap-1.5 px-4 pb-4 overflow-x-auto" onClick={(e) => e.stopPropagation()}>
          {items.map((m, k) => (
            <button
              key={m.id}
              type="button"
              onClick={() => go(k)}
              title={m.name}
              className={cn("w-12 h-12 rounded-md overflow-hidden border-2 shrink-0 bg-white/10", k === i ? "border-white" : "border-transparent opacity-60 hover:opacity-100")}
            >
              {kindOf(m.type) === "image" && m.url ? (
                <img src={m.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-white/70"><DocumentIcon className="w-5 h-5" /></span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
