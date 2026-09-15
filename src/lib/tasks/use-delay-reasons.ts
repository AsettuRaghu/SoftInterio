"use client";

import { useEffect, useState } from "react";
import type { DelayReason } from "@/types/tasks";

/**
 * The reasons a hold can carry, fetched once per page load and shared.
 *
 * Same shape as the quotation config cache: the list is tenant-wide and
 * changes rarely, and the hold dialog can open from any row, so one request
 * serves every control on the page rather than one per row.
 */
let cache: Promise<DelayReason[]> | null = null;

function load(): Promise<DelayReason[]> {
  if (!cache) {
    cache = fetch("/api/delay-reasons")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => (j.data ?? []) as DelayReason[])
      .catch(() => {
        cache = null;
        return [];
      });
  }
  return cache;
}

export function invalidateDelayReasons() {
  cache = null;
}

export function useDelayReasons(): DelayReason[] {
  const [reasons, setReasons] = useState<DelayReason[]>([]);
  useEffect(() => {
    let alive = true;
    void load().then((r) => alive && setReasons(r));
    return () => {
      alive = false;
    };
  }, []);
  return reasons;
}
