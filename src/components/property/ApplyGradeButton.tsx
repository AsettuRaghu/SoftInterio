"use client";

/**
 * "Make everything Standard" - a blanket over a component, a room or a home.
 *
 * Two kinds, offered together because the seller's question is the same one:
 *
 *   a PACKAGE  what the business sells as one thing, configured under
 *              Settings → Catalogue → Packages: the item for every question
 *              plus the accessories given as standard. Listed first, because
 *              a tenant who has made one means it.
 *   a GRADE    every graded family at one tier, from `quality_tier`. Needs no
 *              configuration at all, and is the honest fallback before any
 *              package exists - it reaches 61 of 99 questions here.
 *
 * Both fill only what is unanswered: a blanket is a starting point, not a
 * correction, which is what makes either safe to press twice. And both report
 * what they could NOT answer - a grade cannot choose a shutter finish, and a
 * package can have a gap in it - so nobody walks away thinking the room is
 * finished.
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
  label = "Apply a package",
  title = "Answer the questions in one press, from a package you have set up or from a grade",
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
  const [packages, setPackages] = useState<{ id: string; name: string; description: string | null }[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Read when the menu is first opened, not on mount: most visits to a scope
  // never press this, and the list is a whole extra round trip.
  useEffect(() => {
    if (!open || packages !== null) return;
    void (async () => {
      const res = await fetch("/api/scope-packages");
      const json = await res.json().catch(() => ({}));
      setPackages(res.ok ? json.data ?? [] : []);
    })();
  }, [open, packages]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const apply = async (what: { tier?: string; packageId?: string }, label: string) => {
    setBusy(what.tier ?? what.packageId ?? "");
    const path = what.packageId ? "apply-package" : "apply-grade";
    const res = await fetch(`/api/properties/${propertyId}/scope/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(what.packageId ? { package_id: what.packageId, scope_item_id: scopeItemId } : { tier: what.tier, scope_item_id: scopeItemId }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    setOpen(false);
    if (!res.ok) return void onApplied(json.error || "Could not apply that grade");
    const d = json.data ?? {};
    const parts = [
      `${label}: ${d.answered} question${d.answered === 1 ? "" : "s"} answered across ${d.components} component${d.components === 1 ? "" : "s"}`,
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
          {packages === null ? (
            <p className="px-2.5 py-2 text-xs text-slate-400">Loading…</p>
          ) : packages.length > 0 ? (
            <>
              <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Your packages
              </p>
              {packages.map((pk) => (
                <button
                  key={pk.id}
                  type="button"
                  disabled={!!busy}
                  title={pk.description ?? undefined}
                  onClick={() => void apply({ packageId: pk.id }, pk.name)}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 text-sm rounded-md text-slate-700 hover:bg-slate-50 disabled:opacity-50",
                    busy === pk.id && "bg-slate-100",
                  )}
                >
                  {busy === pk.id ? "Applying…" : pk.name}
                </button>
              ))}
            </>
          ) : null}
          <p className={cn("px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400", packages?.length && "border-t border-slate-100 mt-1")}>
            Or just a grade
          </p>
          {TIERS.map((t) => (
            <button
              key={t.value}
              type="button"
              disabled={!!busy}
              onClick={() => void apply({ tier: t.value }, t.label)}
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
