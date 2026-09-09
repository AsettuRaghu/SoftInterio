-- Grant a permission to one person, without inventing a role for them.
--
-- Until now the only way to give somebody a single capability was to edit a
-- role others share, or create a role for one person. That sits against the
-- stated model: a person can do what their granted permissions say. Asking for
-- an assignable "Quotation Approval" is what surfaced it.
--
-- This is an overlay, not a replacement. Roles still carry the bulk of a
-- person's access; a row here adjusts one permission for one user, in either
-- direction:
--
--   granted = true   add this permission regardless of the user's roles
--   granted = false  remove it even though a role grants it
--
-- The revoke direction matters as much as the grant. Taking one capability
-- away from one person previously meant removing them from a role and
-- rebuilding everything else that role gave them.
--
-- Precedence is: user overlay beats roles, always. A super admin still bypasses
-- the lot, as before.

CREATE TABLE IF NOT EXISTS "public"."user_permissions" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"       uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "permission_id" uuid NOT NULL REFERENCES "public"."permissions"("id") ON DELETE CASCADE,
  "granted"       boolean NOT NULL,
  "tenant_id"     uuid NOT NULL REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
  -- Who made the decision, kept for the audit trail. SET NULL rather than
  -- CASCADE: the grantor leaving must not silently drop the grant.
  "granted_by"    uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "reason"        text,
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  "updated_at"    timestamptz NOT NULL DEFAULT now(),
  -- One decision per person per permission; changing your mind updates the row
  -- rather than stacking a second, contradictory one.
  CONSTRAINT "user_permissions_unique" UNIQUE ("user_id", "permission_id")
);

CREATE INDEX IF NOT EXISTS "idx_user_permissions_user"
  ON "public"."user_permissions" ("user_id");

ALTER TABLE "public"."user_permissions" ENABLE ROW LEVEL SECURITY;

-- Readable within the tenant so the team screen can show who has what.
-- Writes go through a permission-gated API on the admin client, so no write
-- policy is defined here - RLS denies what it does not permit.
CREATE POLICY "View user permissions in tenant" ON "public"."user_permissions"
  FOR SELECT TO "authenticated"
  USING ("tenant_id" = (
    SELECT "users"."tenant_id" FROM "public"."users"
     WHERE "users"."id" = "auth"."uid"()
  ));

COMMENT ON TABLE "public"."user_permissions" IS
  'Per-user overlay on role-derived permissions. granted=true adds, granted=false revokes. Beats roles either way.';
