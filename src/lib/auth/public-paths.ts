/**
 * The paths a person with no account may open. **The only ones.**
 *
 * Everything else under the app redirects to sign-in, which is why the
 * quotation client link has never worked: `/quotation/<token>`, its
 * `client_access_token` column, the share route, the approve and reject routes
 * and `QuotationClientView` have all existed since before the baseline, and a
 * customer opening the link landed on a login page they could never pass.
 *
 * Three rules, and they are the whole reason this is a list and not a pattern:
 *
 *  1. **Exact prefixes, never a regex or a wildcard.** A public surface should
 *     be something a person chose, one path at a time. A pattern is how
 *     `/quotation-config` or `/quotations` ends up public because it happened
 *     to share six characters with something that was.
 *  2. **A prefix must end at a segment boundary.** `/quotation` must match
 *     `/quotation/abc` and NOT `/quotationsecret`, so matching is by equality
 *     or by the prefix plus "/".
 *  3. **Whatever answers behind these paths must use the admin client**, and
 *     must decide for itself what the caller may see. Probed 2026-09-24: RLS
 *     correctly returns zero rows to `anon` on quotations, quotation_spaces,
 *     quotation_components, quotation_line_items, tenant_quotation_settings,
 *     clients and properties - so a public route on the session client sees
 *     nothing and 404s, which is what the page did. Bypassing RLS means the
 *     handler is now the only wall: the token is the authentication, and the
 *     handler owes the checks RLS is no longer making.
 */

/**
 * Page prefixes reachable without a session.
 *
 * `/api/...` is not listed because the middleware never touches it - API routes
 * are guarded one at a time by `protectApiRoute`, and a public API route is one
 * that deliberately does not call it. `/auth/*` and `/` are handled separately
 * by the middleware's own sign-in flow.
 */
export const PUBLIC_PATH_PREFIXES: readonly string[] = [
  // A quotation shared with the customer it was written for. The token is the
  // authentication; the page enforces status, expiry and a rate limit.
  "/quotation",
];

/** Whether this path is one of the deliberately public ones. */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}
