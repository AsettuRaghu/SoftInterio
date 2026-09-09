-- Follow-up to 20260909160000, which locked Owner's grants against DELETE and
-- in doing so made it impossible to delete a permission at all.
--
-- role_permissions.permission_id cascades. Deleting a permission therefore
-- deletes Owner's grant for it, the lock refused that, and the whole statement
-- failed - so retiring a permission (as 20260909130000 did for the 12
-- sales.leads.* keys) would now error out. Found by the lock's own test, which
-- inserted a probe permission and could not remove it afterwards.
--
-- The fix distinguishes the two cases the lock was conflating:
--
--   removing a permission FROM Owner        still refused
--   removing the PERMISSION ITSELF          allowed, and takes Owner's row
--
-- A transaction-local flag set while a permission is being deleted is what
-- tells them apart. It is set by a BEFORE DELETE trigger on permissions, so it
-- can only be true inside exactly that operation, and it resets at the end of
-- the transaction (set_config's third argument).

CREATE OR REPLACE FUNCTION "public"."mark_permission_deletion"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('softinterio.deleting_permission', 'on', true);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS "trg_mark_permission_deletion" ON "public"."permissions";
CREATE TRIGGER "trg_mark_permission_deletion"
  BEFORE DELETE ON "public"."permissions"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."mark_permission_deletion"();

CREATE OR REPLACE FUNCTION "public"."owner_permissions_are_locked"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_role uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_role := OLD.role_id;
  ELSE
    target_role := NEW.role_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.roles
     WHERE id = target_role AND slug = 'owner' AND tenant_id IS NULL
  ) THEN
    -- Granting something new to Owner is how a new permission arrives.
    IF TG_OP = 'INSERT' AND NEW.granted IS DISTINCT FROM false THEN
      RETURN NEW;
    END IF;

    -- The permission itself is going away, so its grant goes with it. This is
    -- not "Owner loses a permission" - there is no longer a permission to lose.
    IF TG_OP = 'DELETE'
       AND current_setting('softinterio.deleting_permission', true) = 'on' THEN
      RETURN OLD;
    END IF;

    RAISE EXCEPTION
      'The Owner role holds every permission and cannot be changed'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Remove the probe permission the lock test could not clean up.
DELETE FROM "public"."permissions" WHERE "key" = '__locktest.probe';
