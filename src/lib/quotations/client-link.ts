import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * What a quotation share token entitles the holder to.
 *
 * One place, because there are four surfaces behind the token - the page, the
 * PDF, approve and reject - and each used to decide for itself. They already
 * disagreed: the page allowed any status through, approve allowed only `sent`,
 * and reject wrote `negotiating`, a status that was retired and now fails the
 * CHECK on the column.
 *
 * **The token is the authentication and this is the authorisation.** Behind a
 * public path the admin client is mandatory (RLS returns nothing to `anon`, so
 * the session client simply 404s - which is exactly what the page did for nine
 * months), and that means RLS is no longer deciding anything. Every check it
 * would have made has to be made here.
 */

/** Only a document that has actually been issued may be read by its customer. */
const READABLE = new Set(["sent", "approved", "rejected"]);

/** Only an issued document still awaiting an answer may be answered. */
const ANSWERABLE = new Set(["sent"]);

export type LinkRefusal =
  | { kind: "not_found" }
  | { kind: "expired" }
  | { kind: "superseded" }
  | { kind: "not_issued" }
  | { kind: "already_answered"; status: string }
  | { kind: "rate_limited" };

/** What a refusal should say to the customer, and with what code. */
export function refusalMessage(r: LinkRefusal): { status: number; message: string } {
  switch (r.kind) {
    case "expired":
      return { status: 410, message: "This link has expired. Please ask for a new one." };
    case "superseded":
      return {
        status: 410,
        message:
          "This quotation has been replaced by a newer version. Please ask for the current one.",
      };
    case "not_issued":
      // Deliberately does not say "this is a draft". The holder has a link the
      // business gave them; what they need is to know to ask, not our status.
      return { status: 404, message: "This link is not active. Please contact us for the current quotation." };
    case "already_answered":
      return {
        status: 409,
        message:
          r.status === "approved"
            ? "This quotation has already been approved."
            : "This quotation has already been answered. Please contact us.",
      };
    case "rate_limited":
      return { status: 429, message: "Too many requests. Please wait a minute and try again." };
    default:
      return { status: 404, message: "This link is not valid." };
  }
}

/**
 * The caller's address, for the read limit.
 *
 * Behind Vercel the connecting address is a proxy, so the first entry of
 * x-forwarded-for is the client. It is spoofable by anyone who wants to be
 * rate-limited separately, which is the accepted weakness of every IP limit -
 * it raises the cost of casual enumeration, it is not a wall. The write limit
 * is keyed on the token instead, which cannot be spoofed without having it.
 */
export function callerIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export interface ClientLinkQuotation {
  id: string;
  tenant_id: string;
  status: string;
  quotation_number: string;
  version: number;
  client_access_expires_at: string | null;
  lead_id: string | null;
  project_id: string | null;
  created_by: string | null;
  assigned_to: string | null;
}

/**
 * Resolve a share token to the quotation it opens, or say why it does not.
 *
 * `mode` is "read" for the page and the PDF, "answer" for approve and reject.
 * A token is looked up on an exact match of the full string; there is no
 * prefix search and no partial match, so a truncated token is simply not found.
 */
export async function resolveClientLink(
  token: string,
  mode: "read" | "answer"
): Promise<{ ok: true; quotation: ClientLinkQuotation } | { ok: false; refusal: LinkRefusal }> {
  // A token is two UUIDs with the dashes stripped. Anything shorter than 32 is
  // not a token that this app has ever issued, so it is refused without a query.
  if (!token || token.length < 32 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return { ok: false, refusal: { kind: "not_found" } };
  }

  const admin = createAdminClient();

  const limit = await admin.rpc("public_rate_hit", {
    p_bucket: mode === "answer" ? `quotation-answer:${token}` : `quotation-token:${token}`,
    // Answering is a once-ever act, so a handful covers a double-click and a
    // retry. Reading is a person refreshing and forwarding to their spouse.
    p_limit: mode === "answer" ? 10 : 60,
    p_window_seconds: 60,
  });
  // Fails open on an error from the limiter itself - see the migration.
  if (limit.data === false) return { ok: false, refusal: { kind: "rate_limited" } };

  const { data } = await admin
    .from("quotations")
    .select(
      "id, tenant_id, status, quotation_number, version, client_access_expires_at, lead_id, project_id, created_by, assigned_to"
    )
    .eq("client_access_token", token)
    .maybeSingle();

  if (!data) return { ok: false, refusal: { kind: "not_found" } };
  const quotation = data as ClientLinkQuotation;

  if (quotation.client_access_expires_at) {
    if (new Date(quotation.client_access_expires_at) < new Date()) {
      return { ok: false, refusal: { kind: "expired" } };
    }
  }

  // Checked before the status test so the customer is told their link is stale
  // rather than that it was never valid - and so a bookmarked v1 can never show
  // a price that is no longer the agreed one.
  if (quotation.status === "superseded") {
    return { ok: false, refusal: { kind: "superseded" } };
  }

  if (!READABLE.has(quotation.status)) {
    // draft and cancelled. A draft with a live token is not hypothetical: one
    // existed on this tenant when the public path was opened up, valid for
    // another eleven days.
    return { ok: false, refusal: { kind: "not_issued" } };
  }

  if (mode === "answer" && !ANSWERABLE.has(quotation.status)) {
    return { ok: false, refusal: { kind: "already_answered", status: quotation.status } };
  }

  return { ok: true, quotation };
}

/**
 * Whether a quotation in this status may be shared at all.
 *
 * The same rule as reading, minus `rejected`: re-issuing a link to a document
 * the customer has already turned down is a revision, not a share.
 */
export function canShareStatus(status: string): boolean {
  return status === "sent" || status === "approved";
}
