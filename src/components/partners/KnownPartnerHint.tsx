"use client";

/**
 * "We already know this person."
 *
 * Sits under a phone/email field on any form that would otherwise create a
 * new customer - the new lead, the standalone quotation. As the number is
 * typed it asks /api/partners/match and offers the partners that match, so
 * a returning customer is picked rather than duplicated. Picking one hands
 * back the partner; clearing it goes back to "a new person".
 */

import React, { useEffect, useState } from "react";

export interface KnownPartner {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  types: string[];
  client_id: string | null;
  leads_count: number;
  projects_count: number;
  matched_on: string[];
}

interface Props {
  phone: string;
  email: string;
  /** The partner the form is currently using, if any. */
  chosen: KnownPartner | null;
  onChoose: (p: KnownPartner | null) => void;
}

export function KnownPartnerHint({ phone, email, chosen, onChoose }: Props) {
  const [matches, setMatches] = useState<KnownPartner[]>([]);
  const digits = phone.replace(/\D/g, "");
  const mail = email.trim();
  // Nothing is asked - or shown - until there is a full number or an email.
  const queryable = digits.length >= 10 || mail.includes("@");

  useEffect(() => {
    if (chosen || !queryable) return;
    const t = setTimeout(async () => {
      try {
        const q = new URLSearchParams();
        if (digits.length >= 10) q.set("phone", digits);
        if (mail.includes("@")) q.set("email", mail);
        const res = await fetch(`/api/partners/match?${q}`);
        const json = await res.json().catch(() => ({}));
        setMatches(res.ok ? (json.data ?? []) : []);
      } catch {
        setMatches([]);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [digits, mail, chosen, queryable]);

  if (chosen) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs flex items-center gap-2">
        <span className="flex-1 text-emerald-800">
          Using <span className="font-medium">{chosen.name}</span> - a customer we already know
          {chosen.projects_count ? ` · ${chosen.projects_count} project${chosen.projects_count === 1 ? "" : "s"}` : ""}
          {chosen.leads_count ? ` · ${chosen.leads_count} lead${chosen.leads_count === 1 ? "" : "s"}` : ""}
        </span>
        <button type="button" onClick={() => onChoose(null)} className="text-emerald-700 hover:underline">
          Not them
        </button>
      </div>
    );
  }
  if (!queryable || matches.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
      <p className="font-medium text-amber-800 mb-1">We may already know this person</p>
      <ul className="space-y-1">
        {matches.map((m) => (
          <li key={m.id} className="flex items-center gap-2">
            <span className="flex-1 min-w-0 text-slate-700">
              <span className="font-medium">{m.name}</span>
              <span className="text-slate-500">
                {" "}
                · {m.matched_on.join(" & ")} match
                {m.projects_count ? ` · ${m.projects_count} project${m.projects_count === 1 ? "" : "s"}` : ""}
                {m.leads_count ? ` · ${m.leads_count} lead${m.leads_count === 1 ? "" : "s"}` : ""}
                {m.city ? ` · ${m.city}` : ""}
              </span>
            </span>
            <button type="button" onClick={() => onChoose(m)} className="shrink-0 text-blue-700 hover:underline">
              Use them
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
