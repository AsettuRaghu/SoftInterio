/**
 * Who is signed in, verified without a trip to the Auth server.
 *
 * `supabase.auth.getUser()` sends the access token to Supabase Auth on every
 * call - one network round trip before a route has read a single row, and
 * the middleware does it again on every navigation. From a Vercel function
 * that is a cross-continent hop each time.
 *
 * `getClaims()` verifies the token's signature locally against the
 * project's public JSON Web Key Set, which is what a JWT is for. Two things
 * make that work here:
 *
 *   - The JWKS is fetched once per server instance and kept for ten minutes,
 *     then handed to `getClaims` - supabase-js caches it per client, and a
 *     server client lives for one request, so without this it would be
 *     fetched every time.
 *   - **It only helps once the project signs tokens with an asymmetric key**
 *     (Supabase → Project Settings → JWT Keys → migrate to JWT signing
 *     keys). With the legacy shared secret the key set is empty and
 *     `getClaims` falls back to asking the Auth server, exactly as
 *     `getUser` did - so this is safe to run before the switch, and fast
 *     after it.
 *
 * What comes back is the token's `sub` and `email`; the users row is still
 * read by whoever needs status and tenant. A revoked session is honoured
 * within the token's lifetime (one hour by default) rather than instantly -
 * the trade every JWT-based system makes, and the reason the guard still
 * checks the users row for `disabled`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type Jwks = { keys: Array<Record<string, unknown>> };

const JWKS_TTL_MS = 10 * 60 * 1000;
let jwksCache: { jwks: Jwks; at: number } | null = null;
let jwksInFlight: Promise<Jwks | null> | null = null;

async function loadJwks(): Promise<Jwks | null> {
  if (jwksCache && Date.now() - jwksCache.at < JWKS_TTL_MS) return jwksCache.jwks;
  if (jwksInFlight) return jwksInFlight;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  jwksInFlight = fetch(`${url}/auth/v1/.well-known/jwks.json`, { headers: { apikey: key } })
    .then(async (r) => {
      if (!r.ok) return null;
      const jwks = (await r.json()) as Jwks;
      if (!Array.isArray(jwks?.keys)) return null;
      jwksCache = { jwks, at: Date.now() };
      return jwks;
    })
    .catch(() => null)
    .finally(() => {
      jwksInFlight = null;
    });
  return jwksInFlight;
}

export interface VerifiedUser {
  id: string;
  email: string | null;
}

/**
 * The signed-in user from the session cookie, or null.
 *
 * Any failure to verify - no session, an expired token, a network error -
 * reads as "not signed in", which is what every caller did with a failed
 * getUser() too.
 */
export async function getVerifiedUser(supabase: SupabaseClient): Promise<VerifiedUser | null> {
  try {
    const jwks = await loadJwks();
    // An empty key set means the project still signs with the shared secret;
    // passing it would make verification fail outright, so let supabase-js
    // fall back to the Auth server as before.
    const { data, error } = await supabase.auth.getClaims(
      undefined,
      jwks && jwks.keys.length > 0 ? { jwks: jwks as { keys: never[] } } : undefined
    );
    if (error || !data?.claims?.sub) return null;
    const email = data.claims.email;
    return { id: data.claims.sub, email: typeof email === "string" ? email : null };
  } catch {
    return null;
  }
}
