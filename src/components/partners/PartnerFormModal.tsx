"use client";

/**
 * Add or edit a partner.
 *
 * Name, what they are to us (one or more hats), phone and email, and where.
 * As the phone or email is typed the dialog asks the server whether we
 * already know this person and offers them - the one place a returning
 * customer stops becoming a second record. See docs/plans/partners.md §3.
 */

import React, { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/utils/cn";

export interface PartnerType {
  code: string;
  label: string;
  description?: string | null;
}

export interface PartnerFormValues {
  name: string;
  kind: "person" | "organisation";
  types: string[];
  phone: string;
  email: string;
  city: string;
  website: string;
  gst_number: string;
  notes: string;
}

interface Match {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  types: string[];
  leads_count: number;
  projects_count: number;
  matched_on: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  types: PartnerType[];
  /** Pre-selected hat when opened from a typed list. */
  defaultType?: string;
  initial?: Partial<PartnerFormValues> & { id?: string };
  onSaved: (id: string) => void;
  /** Called instead of creating, when the user picks a partner we already know. */
  onPickExisting?: (id: string) => void;
}

const EMPTY: PartnerFormValues = {
  name: "",
  kind: "person",
  types: [],
  phone: "",
  email: "",
  city: "",
  website: "",
  gst_number: "",
  notes: "",
};

export function PartnerFormModal({ isOpen, onClose, types, defaultType, initial, onSaved, onPickExisting }: Props) {
  const [values, setValues] = useState<PartnerFormValues>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const editing = !!initial?.id;

  useEffect(() => {
    if (!isOpen) return;
    // With one type on offer it is simply set; the chips only appear when
    // there is a choice to make.
    const only = types.length === 1 ? [types[0].code] : [];
    setValues({ ...EMPTY, ...(initial ?? {}), types: initial?.types ?? (defaultType ? [defaultType] : only) });
    setError(null);
    setMatches([]);
  }, [isOpen, initial, defaultType, types]);

  // Do we already know this person? Asked as the phone or email is typed,
  // only while creating.
  useEffect(() => {
    if (!isOpen || editing) return;
    const phone = values.phone.replace(/\D/g, "");
    const email = values.email.trim();
    if (phone.length < 10 && !email.includes("@")) {
      setMatches([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const q = new URLSearchParams();
        if (phone.length >= 10) q.set("phone", phone);
        if (email.includes("@")) q.set("email", email);
        const res = await fetch(`/api/partners/match?${q}`);
        const json = await res.json().catch(() => ({}));
        setMatches(res.ok ? (json.data ?? []) : []);
      } catch {
        setMatches([]);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [values.phone, values.email, isOpen, editing]);

  const set = <K extends keyof PartnerFormValues>(k: K, v: PartnerFormValues[K]) => setValues((s) => ({ ...s, [k]: v }));
  const toggleType = (code: string) =>
    set("types", values.types.includes(code) ? values.types.filter((t) => t !== code) : [...values.types, code]);

  const save = async () => {
    setError(null);
    if (!values.name.trim()) return setError("Give the partner a name.");
    if (values.types.length === 0) return setError("Choose at least one type - what is this partner to us?");
    setBusy(true);
    try {
      const res = await fetch(editing ? `/api/partners/${initial!.id}` : "/api/partners", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not save");
        return;
      }
      onSaved(editing ? initial!.id! : json.data.id);
      onClose();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        editing
          ? `Edit ${types.length === 1 ? types[0].label.toLowerCase() : "partner"}`
          : `New ${types.length === 1 ? types[0].label.toLowerCase() : "partner"}`
      }
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={cn(buttonVariants({ variant: "outline" }))}>
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={() => void save()} className={cn(buttonVariants())}>
            {busy ? "Saving…" : editing ? "Save" : "Add"}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          {(["person", "organisation"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => set("kind", k)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg border",
                values.kind === k ? "bg-blue-50 border-blue-300 text-blue-800" : "bg-white border-slate-200 text-slate-600"
              )}
            >
              {k === "person" ? "A person" : "An organisation"}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder={values.kind === "person" ? "Full name *" : "Organisation name *"}
          autoFocus
          className={input}
        />

        {types.length > 1 && (
        <div>
          <p className="text-xs font-medium text-slate-600 mb-1">What are they to us?</p>
          <div className="flex flex-wrap gap-1.5">
            {types.map((t) => (
              <button
                key={t.code}
                type="button"
                onClick={() => toggleType(t.code)}
                title={t.description ?? undefined}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-full border",
                  values.types.includes(t.code)
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <input type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Phone" className={input} />
          <input type="email" value={values.email} onChange={(e) => set("email", e.target.value)} placeholder="Email" className={input} />
        </div>

        {matches.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
            <p className="text-xs font-medium text-amber-800 mb-1.5">We may already know this person</p>
            <ul className="space-y-1">
              {matches.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 min-w-0">
                    <span className="font-medium text-slate-800">{m.name}</span>
                    <span className="text-slate-500">
                      {" "}
                      · {m.matched_on.join(" & ")} match
                      {m.leads_count ? ` · ${m.leads_count} lead${m.leads_count === 1 ? "" : "s"}` : ""}
                      {m.projects_count ? ` · ${m.projects_count} project${m.projects_count === 1 ? "" : "s"}` : ""}
                      {m.city ? ` · ${m.city}` : ""}
                    </span>
                  </span>
                  {onPickExisting && (
                    <button
                      type="button"
                      onClick={() => {
                        onPickExisting(m.id);
                        onClose();
                      }}
                      className="shrink-0 text-blue-700 hover:underline"
                    >
                      Use this one
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <input type="text" value={values.city} onChange={(e) => set("city", e.target.value)} placeholder="City" className={input} />
          {values.kind === "organisation" ? (
            <input type="text" value={values.gst_number} onChange={(e) => set("gst_number", e.target.value)} placeholder="GST number" className={input} />
          ) : (
            <span />
          )}
        </div>
        {values.kind === "organisation" && (
          <input type="url" value={values.website} onChange={(e) => set("website", e.target.value)} placeholder="Website" className={input} />
        )}
        <textarea
          value={values.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Notes - how we came to work with them, what to remember"
          rows={2}
          className={cn(input, "resize-none")}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
