"use client";

/**
 * "Make everything Standard."
 *
 * A business sells in grades, and a seller wants to set one and then argue
 * about the few things the customer actually cares about. The tiers already
 * sit on the cost items, so nothing has to be configured for this to work.
 *
 * It fills only what is unanswered: a blanket is a starting point, not a
 * correction, which is what makes it safe to press twice. And it reports
 * what it could NOT answer - a shutter finish is laminate or veneer, chosen
 * by kind rather than by grade, and it is the most expensive line on a
 * wardrobe - so nobody walks away thinking the room is finished.
 */

import React, { useEffect, useRef, useState } from "react";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";

const TIERS = [
  { value: "basic", label: "Budget" },
  { value: "standard", label: "Standard" },
  { value: "premium", label: "Premium" },
  { value: "luxury", label: "Luxury" },
];

export function ApplyGradeButton({
  propertyId,
  scopeItemId = null,
  label = "Apply a grade",
  title = "Answer every graded question at one level - carcass, hinges, handles - and leave the rest to discuss",
  onApplied,
}: {
  propertyId: string;
  /** A component, a space, or null for the whole scope. */
  scopeItemId?: string | null;
  label?: string;
  title?: string;
  onApplied: (message: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const apply = async (tier: string, tierLabel: string) => {
    setBusy(tier);
    const res = await fetch(`/api/properties/${propertyId}/scope/apply-grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, scope_item_id: scopeItemId }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    setOpen(false);
    if (!res.ok) return void onApplied(json.error || "Could not apply that grade");
    const d = json.data ?? {};
    const parts = [
      `${tierLabel}: ${d.answered} question${d.answered === 1 ? "" : "s"} answered across ${d.components} component${d.components === 1 ? "" : "s"}`,
      d.kept ? `${d.kept} already answered, left alone` : null,
      // The honest half. A grade cannot choose a finish, and saying so is
      // the difference between a head start and a quotation missing a line.
      d.unanswered ? `${d.unanswered} still to ask - those are chosen by kind, not by grade` : null,
    ].filter(Boolean);
    await onApplied(parts.join(" · "));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={title}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
      >
        <SparklesIcon className="w-3.5 h-3.5" />
        {label}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-white border border-slate-200 rounded-xl shadow-xl p-1">
          <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Answer at this level
          </p>
          {TIERS.map((t) => (
            <button
              key={t.value}
              type="button"
              disabled={!!busy}
              onClick={() => void apply(t.value, t.label)}
              className={cn(
                "w-full text-left px-2.5 py-1.5 text-sm rounded-md text-slate-700 hover:bg-slate-50 disabled:opacity-50",
                busy === t.value && "bg-slate-100",
              )}
            >
              {busy === t.value ? "Applying…" : t.label}
            </button>
          ))}
          <p className="px-2.5 py-1.5 text-[11px] text-slate-400 border-t border-slate-100 mt-1">
            Only unanswered questions change. What you have already chosen stays.
          </p>
        </div>
      )}
    </div>
  );
}
