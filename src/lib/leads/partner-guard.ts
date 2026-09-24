import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedUser } from "@/lib/auth/api-guard";
import { leadAccess, canReadLead, canWriteLead } from "./access";

/**
 * The people at a lead's customer, reached through the lead.
 *
 * **Why this exists rather than reusing /api/partners/[id]/contacts.** Those
 * routes are gated on `partners.edit`, which is held by Owner and Admin alone
 * - by decision, because the partner list is the whole relationship book. But
 * the person who actually talks to the family is **Sales**, and Sales holds no
 * `partners.*` key at all. So on the day a customer's wife rang from her own
 * number, the only people who could write it down were the two who were not on
 * the call, and the only screen to do it on was Settings-adjacent. Nobody does
 * that, which is why 30 partners had exactly 30 contacts.
 *
 * The rule here is the one `requireProjectAccess` already follows: **access to
 * the parent proves the right to the child.** If you may change this lead, you
 * may record who to ring about it - and only for the partner behind this
 * lead's own client, never any other. That is narrower than `partners.edit`,
 * not wider: it grants nothing about the relationship book as a whole.
 *
 * A lead the caller may not read is reported as missing rather than forbidden,
 * for the reason the project guard gives: "forbidden" confirms it exists.
 */

export interface LeadPartnerOk {
  ok: true;
  /** The partner behind this lead's client - whose contacts these are. */
  partnerId: string;
  leadId: string;
  tenantId: string;
}

export interface LeadPartnerFailed {
  ok: false;
  response: NextResponse;
}

export async function requireLeadPartner(
  supabase: SupabaseClient,
  args: {
    leadId: string;
    user: AuthenticatedUser;
    permissions: Set<string> | undefined;
    mode: "read" | "write";
  }
): Promise<LeadPartnerOk | LeadPartnerFailed> {
  const { leadId, user, permissions, mode } = args;
  const access = leadAccess(permissions, user.isSuperAdmin);

  if (access.denied) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You do not have permission to view leads" },
        { status: 403 }
      ),
    };
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("id, tenant_id, assigned_to, client_id, client:clients!leads_client_id_fkey(partner_id)")
    .eq("id", leadId)
    .eq("tenant_id", user.tenantId)
    .maybeSingle();

  if (!lead || !canReadLead(access, lead, user.id)) {
    return { ok: false, response: NextResponse.json({ error: "Lead not found" }, { status: 404 }) };
  }

  if (mode === "write" && !canWriteLead(access, lead, user.id)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You do not have permission to change this lead" },
        { status: 403 }
      ),
    };
  }

  // PostgREST hands back an embedded to-one as an object, or as a one-element
  // array depending on how it reads the relationship - both shapes occur in
  // this codebase, so neither is assumed.
  const client = Array.isArray(lead.client) ? lead.client[0] : lead.client;
  const partnerId = (client as { partner_id?: string | null } | null)?.partner_id ?? null;

  if (!partnerId) {
    // Every client on this tenant has a partner (the 2026-09-17 backfill, and
    // every create route since makes one), so this is the shape of a lead
    // imported straight into `clients` by some future path rather than a state
    // anything reaches today. It refuses instead of creating a partner here:
    // making an identity as a side effect of opening a contacts list is how
    // duplicates of a customer get born.
    return {
      ok: false,
      response: NextResponse.json(
        { error: "This lead's customer has no partner record, so there is nowhere to keep contacts yet." },
        { status: 409 }
      ),
    };
  }

  return { ok: true, partnerId, leadId: lead.id as string, tenantId: lead.tenant_id as string };
}
