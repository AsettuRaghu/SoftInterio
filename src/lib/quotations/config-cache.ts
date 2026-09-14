"use client";

/**
 * Quotation reference data, fetched once per page load.
 *
 * Space types, component types and quality tiers are tenant-wide catalogue
 * settings that change when somebody edits them on Settings, which is to say
 * almost never. The Spaces tab refetched all three every time it was opened,
 * and each one is a separate API route paying the guard's fixed cost first -
 * `supabase.auth.getUser()` is a call to the Auth server (~370ms measured) and
 * the users lookup behind it another ~280ms. So roughly 650ms of overhead per
 * route before a single row is read, three times over, to re-read lists that
 * had not changed since the last time the tab was open.
 *
 * The promise is cached rather than the value, so two components mounting at
 * once share one request instead of racing. Failures are evicted, so a blip
 * does not poison the tab for the rest of the session.
 *
 * `invalidateQuotationConfig()` exists because the config screen edits exactly
 * these lists; it calls this after a successful save so the next read is
 * fresh rather than waiting out the TTL.
 */

const TTL_MS = 5 * 60 * 1000;

interface Entry {
  at: number;
  value: Promise<unknown>;
}

const cache = new Map<string, Entry>();

export function fetchConfigOnce<T = unknown>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return hit.value as Promise<T>;
  }

  const value = fetch(url).then((response) => {
    if (!response.ok) throw new Error(`Failed to load ${url}`);
    return response.json();
  });

  // A rejected promise left in the map would be handed to every later caller.
  value.catch(() => {
    if (cache.get(url)?.value === value) cache.delete(url);
  });

  cache.set(url, { at: Date.now(), value });
  return value as Promise<T>;
}

/** Drop the cache after the catalogue has been edited. */
export function invalidateQuotationConfig(): void {
  cache.clear();
}
