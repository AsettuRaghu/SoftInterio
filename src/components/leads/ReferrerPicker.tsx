"use client";

import { useCallback, useEffect, useState } from "react";
import { SearchSelect } from "@/components/ui/SearchSelect";

/**
 * Who sent us this lead.
 *
 * Shown only when the source says it was a referral, because that is the only
 * time the question has an answer: `architect_referral` picks from the
 * architects, `client_referral` from the customers. Both are partners, so both
 * write the one `leads.referred_by_partner_id`.
 *
 * It matters more than its size suggests. On this business more than 95% of
 * leads arrive this way, and the referrer is who gets chased when the customer
 * stops answering and thanked when the job closes - neither of which a source
 * code alone can tell you.
 *
 * The list comes from `/api/partners/referrers`, not `/api/partners`: the second
 * needs `partners.view`, which the salesperson filling this in does not have.
 */

/** Which partner type each referral source draws from. Nothing else shows the field. */
export const REFERRAL_SOURCE_TYPE: Record<string, { type: string; label: string; empty: string }> = {
  architect_referral: {
    type: "architect",
    label: "Which architect referred them?",
    empty: "No architects on record yet - add them under Partners → Architects.",
  },
  client_referral: {
    type: "customer",
    label: "Which customer referred them?",
    empty: "No customers on record yet.",
  },
};

export default function ReferrerPicker({
  leadSource,
  value,
  onChange,
  className,
}: {
  leadSource: string | null | undefined;
  value: string | null | undefined;
  onChange: (partnerId: string | null) => void;
  className?: string;
}) {
  const config = leadSource ? REFERRAL_SOURCE_TYPE[leadSource] : undefined;
  const [options, setOptions] = useState<{ value: string; label: string; hint?: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (type: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/partners/referrers?type=${encodeURIComponent(type)}`);
      const json = await res.json().catch(() => ({}));
      setOptions(
        ((json.data ?? []) as { id: string; name: string; phone: string | null }[]).map((p) => ({
          value: p.id,
          label: p.name,
          hint: p.phone ?? undefined,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!config) return;
    void load(config.type);
    // The list is per type, so it is re-read when the source changes to the
    // other kind of referral and not otherwise.
  }, [config, load]);

  // A source that is not a referral clears the referrer rather than leaving a
  // stale architect on a walk-in.
  useEffect(() => {
    if (!config && value) onChange(null);
  }, [config, value, onChange]);

  if (!config) return null;

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{config.label}</label>
      <SearchSelect
        options={options}
        value={value ?? ""}
        onChange={(v: string) => onChange(v || null)}
        placeholder={loading ? "Loading…" : "Search by name or phone"}
        emptyLabel="Not recorded"
        disabled={loading}
        className="w-full"
        buttonClassName="w-full justify-between px-4 py-2.5 border border-slate-200 rounded-lg bg-white"
      />
      {!loading && options.length === 0 && (
        <p className="mt-1 text-xs text-amber-700">{config.empty}</p>
      )}
      <p className="mt-1 text-[11px] text-slate-500">
        So they can be chased if the customer goes quiet, and thanked when it closes.
      </p>
    </div>
  );
}
