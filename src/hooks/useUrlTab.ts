"use client";

/**
 * A tab that survives a reload, the back button and a shared link.
 *
 * Every detail page held its tab in state alone, so the address never moved
 * off the record's own URL: pressing refresh on the Documents tab of a lead
 * reopened Overview, and a link sent to a colleague always landed them on
 * Overview too (2026-09-23). The Catalogue had solved this for itself; this
 * is that solution, once, for the pages that need it.
 *
 * The URL is read in an effect rather than in the initial state, because
 * `window` does not exist while the page is rendered on the server and a
 * first paint that disagrees with the markup is a hydration error. So the
 * fallback tab paints for one frame and the URL's tab replaces it - which
 * is invisible, and correct even with JavaScript disabled.
 *
 * `replaceState`, not `push`: switching tabs is looking around a record, not
 * navigating, and pushing would make Back walk every tab you glanced at
 * before leaving the page. It also avoids Next's router, which would refetch
 * the route's data on every tab click.
 */

import { useCallback, useEffect, useState } from "react";

export function useUrlTab<T extends string>(
  tabs: readonly T[],
  fallback: T,
  param = "tab",
): [T, (tab: T) => void] {
  const [tab, setTab] = useState<T>(fallback);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get(param);
    if (fromUrl && (tabs as readonly string[]).includes(fromUrl)) setTab(fromUrl as T);
    // Only on mount: afterwards this hook is what writes the URL, and
    // re-reading it would fight with the tab the person just pressed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = useCallback(
    (next: T) => {
      setTab(next);
      const url = new URL(window.location.href);
      url.searchParams.set(param, next);
      window.history.replaceState(window.history.state, "", url);
    },
    [param],
  );

  return [tab, select];
}
