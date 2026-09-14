-- A tenant can name its own people
--
-- The only SELECT policies on `users` are `id = auth.uid()`, twice over
-- ("Users can read own record" and "Users can see their own profile" say the
-- same thing, which is a sign nobody designed this). So through the session
-- client a person can see exactly one user row: their own. Every surface that
-- names a colleague was therefore wrong, and wrong *silently*:
--
--   * the sales report's By owner table put 14 of 15 leads under "Unassigned",
--     because `userName[id] || "Unassigned"` cannot tell "nobody owns this"
--     apart from "I am not allowed to see who does";
--   * the leads CSV export did the same, in a file people keep;
--   * lead and task history showed "Unknown user" for a colleague's actions;
--   * a project's manager card rendered blank - that lookup ends in
--     `.single()`, which returns null rather than an error;
--   * the project-manager picker offered only the person using it, so nobody
--     else could be made a project manager at all.
--
-- The leads *list* looked right only because it uses the admin client, which
-- bypasses RLS entirely. That is the pattern to stop copying: reaching for the
-- admin client to work around a policy also discards the tenant wall.
--
-- This is a directory, not a widening of `users`. It carries what is needed to
-- name and pick a person - id, name, email, avatar, status - and deliberately
-- not `phone`, `last_login_at`, `email_verified_at` or `is_super_admin`.
-- Within one business a colleague's name and work email are not secrets; their
-- phone number and login history are somebody else's business.
--
-- `security_invoker = false` is the point of the view and is set explicitly:
-- it runs as its owner, so the base table's own-row-only policy does not
-- apply, and the WHERE clause is then the only wall. `get_user_tenant_id()` is
-- SECURITY DEFINER, so it resolves even though the caller cannot read the row
-- it reads. Cross-tenant isolation rests on that predicate - do not remove it,
-- and do not add a column to this view without deciding it is directory data.

CREATE OR REPLACE VIEW public.tenant_directory
WITH (security_invoker = false) AS
  SELECT
    u.id,
    u.tenant_id,
    u.name,
    u.email,
    u.avatar_url,
    u.status
  FROM public.users u
  WHERE u.tenant_id = public.get_user_tenant_id();

ALTER VIEW public.tenant_directory OWNER TO postgres;

COMMENT ON VIEW public.tenant_directory IS
  'Name-and-pick directory of the caller''s own tenant. Exists because the '
  'policies on users are own-row-only, which left every teammate name in the '
  'app reading as "Unassigned" or "Unknown user". Names, not contact details: '
  'no phone, no login history. Tenant isolation is the WHERE clause.';

-- Signed-in callers only. The anon key must see nothing here - it ships in the
-- browser bundle, and a directory of names and work emails is exactly the kind
-- of thing that should not answer to it.
REVOKE ALL ON public.tenant_directory FROM PUBLIC;
REVOKE ALL ON public.tenant_directory FROM anon;
GRANT SELECT ON public.tenant_directory TO authenticated;
