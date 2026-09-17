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
  /** The person we deal with at an organisation; the primary contact. */
  contact_name: string;
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
  contact_name: "",
  types: [],
  phone: "",
  email: "",
  city: "",
  website: "",
  gst_number: "",
  notes: "",
};

/*
 * Module-scope, not inside the component: a component defined inside another
 * is a new type on every render, and React remounts it - every input in the
 * section would lose focus on each keystroke (the TaskRow lesson).
 */
const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
      <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center">{icon}</div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
    </div>
    {children}
  </div>
);
const PersonIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);
const PhoneIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);
const NoteIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);


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
    if (!values.name.trim()) return setError(values.kind === "organisation" ? "Give the organisation a name." : "Give the person a name.");
    if (values.kind === "organisation" && !editing && !values.contact_name.trim()) return setError("Who do we deal with there? Name the person.");
    if (values.types.length === 0) return setError("Choose at least one type - what is this partner to us?");
    setBusy(true);
    try {
      const res = await fetch(editing ? `/api/partners/${initial!.id}` : "/api/partners", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          contact:
            values.kind === "organisation" && values.contact_name.trim()
              ? { name: values.contact_name.trim(), phone: values.phone, email: values.email }
              : undefined,
        }),
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

  const input =
    "w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const label = "block text-sm font-medium text-slate-700 mb-1";
  const noun = types.length === 1 ? types[0].label.toLowerCase() : "partner";
  const isOrg = values.kind === "organisation";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? `Edit ${noun}` : `Add ${noun}`}
      subtitle={
        editing
          ? undefined
          : `A ${noun} we work with. If we already know them, the form will say so as you type their number.`
      }
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={cn(buttonVariants({ variant: "outline" }))}>
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={() => void save()} className={cn(buttonVariants())}>
            {busy ? "Saving…" : editing ? "Save changes" : `Add ${noun}`}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <Section icon={PersonIcon} title={isOrg ? "The organisation" : "The person"}>
          {/* A person is their own contact; an organisation names the person
              we deal with, and can carry more on its Contacts tab. */}
          <div>
            <label className={label}>This {noun} is</label>
            <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
              {(["person", "organisation"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => set("kind", k)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium",
                    values.kind === k ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {k === "person" ? "A person" : "An organisation"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={isOrg ? "" : "md:col-span-2"}>
              <label className={label}>
                {isOrg ? "Organisation / company name" : "Full name"} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={isOrg ? "e.g. Studio Arc Designs" : "e.g. Amulya Rao"}
                autoFocus
                className={input}
              />
            </div>
            {isOrg && (
              <div>
                <label className={label}>
                  Person we deal with <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={values.contact_name}
                  onChange={(e) => set("contact_name", e.target.value)}
                  placeholder="e.g. Priya Menon, Principal Architect"
                  className={input}
                />
              </div>
            )}
          </div>

          {/* Opened from a typed list the hat is the list's and is not
              asked; editing offers the chips so a customer can also become
              an architect, or the reverse. */}
          {types.length > 1 && !defaultType && (
            <div>
              <label className={label}>What are they to us?</label>
              <div className="flex flex-wrap gap-1.5">
                {types.map((t) => (
                  <button
                    key={t.code}
                    type="button"
                    onClick={() => toggleType(t.code)}
                    title={t.description ?? undefined}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-full border",
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
        </Section>

        <Section icon={PhoneIcon} title="How to reach them">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label}>Phone {isOrg ? "(the person's)" : ""}</label>
              <input
                type="tel"
                value={values.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+91 98765 43210"
                className={input}
              />
              {!editing && <p className="text-xs text-slate-500 mt-1">The phone number is how we recognise a returning {noun}.</p>}
            </div>
            <div>
              <label className={label}>Email</label>
              <input
                type="email"
                value={values.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="name@example.com"
                className={input}
              />
            </div>
          </div>

          {matches.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-800 mb-1.5">We may already know this {noun}</p>
              <ul className="space-y-1.5">
                {matches.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 text-sm">
                    <span className="flex-1 min-w-0">
                      <span className="font-medium text-slate-800">{m.name}</span>
                      <span className="text-slate-500">
                        {" "}
                        · {m.matched_on.join(" & ")} match
                        {m.projects_count ? ` · ${m.projects_count} project${m.projects_count === 1 ? "" : "s"}` : ""}
                        {m.leads_count ? ` · ${m.leads_count} lead${m.leads_count === 1 ? "" : "s"}` : ""}
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
                        className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-100"
                      >
                        Open instead
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={label}>City</label>
              <input type="text" value={values.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Bengaluru" className={input} />
            </div>
            {isOrg && (
              <div>
                <label className={label}>Website</label>
                <input type="url" value={values.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" className={input} />
              </div>
            )}
            {isOrg && (
              <div>
                <label className={label}>GST number</label>
                <input type="text" value={values.gst_number} onChange={(e) => set("gst_number", e.target.value)} placeholder="29ABCDE1234F1Z5" className={input} />
              </div>
            )}
          </div>
        </Section>

        <Section icon={NoteIcon} title="Notes">
          <textarea
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="How we came to work with them, what to remember - anything the next person should know."
            rows={3}
            className={cn(input, "resize-none")}
          />
        </Section>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
