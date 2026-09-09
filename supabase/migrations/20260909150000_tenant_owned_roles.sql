-- Let a tenant shape its own roles.
--
-- All 21 roles ship with tenant_id NULL and is_system_role true, which means
-- every business on the platform shares them. Editing "Sales" would have
-- edited it for everyone. The schema already anticipated tenant-owned roles -
-- there are INSERT, UPDATE and DELETE policies scoped to the caller's tenant,
-- and a unique_role_slug_per_tenant constraint - but the SELECT policy reads
--
--   USING (is_system_role = true)
--
-- so a role a tenant created would have been invisible to the people it was
-- created for. That is the gap this closes.
--
-- The model mirrors protected playbooks, which solved the same problem: what
-- SoftInterio ships is a read-only proposal, and customising it takes a copy
-- the tenant owns. We propose the practice; they decide how they work.

DROP POLICY IF EXISTS "Anyone can read system roles" ON "public"."roles";

CREATE POLICY "Read system and own tenant roles" ON "public"."roles"
  FOR SELECT
  USING (
    "is_system_role" = true
    OR "tenant_id" = (
      SELECT "users"."tenant_id" FROM "public"."users"
       WHERE "users"."id" = "auth"."uid"()
    )
  );

-- Editing a role definition is a different act from assigning one to a person,
-- so it gets its own key rather than overloading team.roles.assign. Without
-- this, changing what a role may do would sit behind the same permission as
-- putting someone into it.
INSERT INTO "public"."permissions" ("key", "module", "description", "is_system_permission")
VALUES (
  'team.roles.manage',
  'team',
  'Create, edit and delete roles',
  true
)
ON CONFLICT ("key") DO NOTHING;

-- Owner and Admin, matching team.permissions.manage. Deliberately not the
-- whole manager tier: this rewrites what every holder of a role may do.
INSERT INTO "public"."role_permissions" ("role_id", "permission_id", "granted")
SELECT r."id", p."id", true
  FROM "public"."roles" r
  CROSS JOIN "public"."permissions" p
 WHERE r."name" IN ('Owner', 'Admin')
   AND p."key" = 'team.roles.manage'
   AND NOT EXISTS (
     SELECT 1 FROM "public"."role_permissions" rp
      WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
   );
