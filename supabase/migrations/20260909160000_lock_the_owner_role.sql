-- The Owner role holds everything, permanently, and nobody may edit it.
--
-- Two problems this closes.
--
-- Admin holds team.roles.manage, so an Admin could reach the Owner role
-- through the role editor. ensureTenantOwnedRole() refuses it in application
-- code, but "locked at all times" should not depend on every future caller
-- remembering to ask that helper first - so the rule lives in the database,
-- where a stray admin-client write cannot get around it either.
--
-- And Owner completeness was manual. It holds all 254 permissions today only
-- because the migration that added team.roles.manage granted it explicitly.
-- The next permission added by someone who forgets that step leaves Owner
-- quietly short of "all permissions", which is the kind of gap nobody notices
-- until an owner is refused something in their own business.
--
-- Scoped to the shipped Owner role - tenant_id IS NULL, slug 'owner'. A tenant
-- who creates their own role called "Owner" has made an ordinary custom role
-- and may edit it freely; it is not this one.
--
-- Deliberate maintenance still has a way through:
--   ALTER TABLE role_permissions DISABLE TRIGGER trg_owner_permissions_locked;

-- 1. Every permission that exists now belongs to Owner. No-op today (254/254),
--    kept so this migration is complete on a fresh database.
INSERT INTO "public"."role_permissions" ("role_id", "permission_id", "granted")
SELECT r."id", p."id", true
  FROM "public"."roles" r
  CROSS JOIN "public"."permissions" p
 WHERE r."slug" = 'owner' AND r."tenant_id" IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM "public"."role_permissions" rp
      WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
   );

-- 2. Every permission added from now on belongs to Owner too.
CREATE OR REPLACE FUNCTION "public"."grant_new_permission_to_owner"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.role_permissions (role_id, permission_id, granted)
  SELECT r.id, NEW.id, true
    FROM public.roles r
   WHERE r.slug = 'owner' AND r.tenant_id IS NULL
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_grant_new_permission_to_owner" ON "public"."permissions";
CREATE TRIGGER "trg_grant_new_permission_to_owner"
  AFTER INSERT ON "public"."permissions"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."grant_new_permission_to_owner"();

-- 3. Owner's grants cannot be changed, removed, or inserted as a revoke.
CREATE OR REPLACE FUNCTION "public"."owner_permissions_are_locked"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_role uuid;
BEGIN
  -- TG_OP decides which record carries the role; NEW and OLD cannot both be
  -- referenced across INSERT and DELETE.
  IF TG_OP = 'DELETE' THEN
    target_role := OLD.role_id;
  ELSE
    target_role := NEW.role_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.roles
     WHERE id = target_role AND slug = 'owner' AND tenant_id IS NULL
  ) THEN
    -- An insert granting something is the one permitted write: that is how a
    -- new permission reaches Owner.
    IF TG_OP = 'INSERT' AND NEW.granted IS DISTINCT FROM false THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'The Owner role holds every permission and cannot be changed'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_owner_permissions_locked" ON "public"."role_permissions";
CREATE TRIGGER "trg_owner_permissions_locked"
  BEFORE INSERT OR UPDATE OR DELETE ON "public"."role_permissions"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."owner_permissions_are_locked"();

-- 4. The Owner role itself cannot be renamed, re-slugged or deleted. Ownership
--    transfer moves user_roles and users.is_super_admin, never this row, so it
--    is unaffected.
CREATE OR REPLACE FUNCTION "public"."owner_role_is_locked"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.slug = 'owner' AND OLD.tenant_id IS NULL THEN
      RAISE EXCEPTION 'The Owner role cannot be deleted'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.slug = 'owner' AND OLD.tenant_id IS NULL
     AND (NEW.slug IS DISTINCT FROM OLD.slug
          OR NEW.name IS DISTINCT FROM OLD.name
          OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
          OR NEW.hierarchy_level IS DISTINCT FROM OLD.hierarchy_level) THEN
    RAISE EXCEPTION 'The Owner role cannot be modified'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_owner_role_locked" ON "public"."roles";
CREATE TRIGGER "trg_owner_role_locked"
  BEFORE UPDATE OR DELETE ON "public"."roles"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."owner_role_is_locked"();
