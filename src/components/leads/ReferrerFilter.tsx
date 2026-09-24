"use client";

import { useEffect, useState } from "react";
import { SearchSelect } from "@/components/ui/SearchSelect";

/**
 * "What has Naveen sent us?"
 *
 * One filter over both kinds of referrer, because both are partners and the
 * question is the same whichever hat they wear. A `SearchSelect` rather than a
 * dropdown: it grows with every architect and customer on the books, and a
 * native `<select>` cannot be typed into.
 *
 * Reads the same narrow `/api/partners/referrers` the lead form uses, so a
 * salesperson - who holds no `partners.*` key - can filter by it.
 */
export default function ReferrerFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (partnerId: string) => void;
}) {
  const [options, setOptions] = useState<{ value: string; label: string; hint?: string }[]>([]);

  useEffect(() => {
    let live = true;
    void (async () => {
      const both = await Promise.all(
        ["architect", "customer"].map(async (type) => {
          const res = await fetch(`/api/partners/referrers?type=${type}`);
          const json = await res.json().catch(() => ({}));
          return ((json.data ?? []) as { id: string; name: string; phone: string | null }[]).map((p) => ({
            value: p.id,
            label: p.name,
            hint: type === "architect" ? "Architect" : "Customer",
            phone: p.phone,
          }));
        })
      );
      if (!live) return;
      // A partner wearing both hats appears once.
      const seen = new Set<string>();
      setOptions(
        both.flat().filter((o) => {
          if (seen.has(o.value)) return false;
          seen.add(o.value);
          return true;
        })
      );
    })();
    return () => {
      live = false;
    };
  }, []);

  return (
    <SearchSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Referred by"
      emptyLabel="Anyone"
      align="right"
    />
  );
}
