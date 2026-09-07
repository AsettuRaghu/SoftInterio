"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * The tenant's workflow policy flags.
 *
 * Read straight from tenant_settings, the same way the Company settings page
 * does. These decide what the UI offers, never what it is allowed to do - the
 * matching check on the server is the actual control. A flag here only spares
 * someone a button that would answer 403.
 */
export interface TenantSettings {
  /** Whether the New Project button is offered at all. */
  allowDirectProjectCreate: boolean;
  /** Whether winning a lead opens a project by itself. */
  autoCreateProjectOnWon: boolean;
}

const CLOSED: TenantSettings = {
  allowDirectProjectCreate: false,
  autoCreateProjectOnWon: true,
};

export function useTenantSettings() {
  const [settings, setSettings] = useState<TenantSettings>(CLOSED);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: userData } = await supabase
          .from("users")
          .select("tenant_id")
          .eq("id", user.id)
          .single();
        if (!userData?.tenant_id) return;

        const { data } = await supabase
          .from("tenant_settings")
          .select("allow_direct_project_create, auto_create_project_on_won")
          .eq("tenant_id", userData.tenant_id)
          .maybeSingle();

        if (cancelled) return;
        setSettings({
          allowDirectProjectCreate: data?.allow_direct_project_create === true,
          autoCreateProjectOnWon: data?.auto_create_project_on_won !== false,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, loading };
}
