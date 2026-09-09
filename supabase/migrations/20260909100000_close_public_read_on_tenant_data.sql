-- Stop the anon key reading other businesses' data.
--
-- The anon key is published in the browser bundle - that is what it is for,
-- and it is safe only because row level security decides what it can see. Two
-- policies were written as USING (true), which permits everyone including
-- somebody who has never signed in.
--
-- "Users can view own tenant" was the serious one. Despite the name it had no
-- condition at all, so the anon key returned every tenant on the platform:
-- company names, registration and GST numbers, email addresses, phone numbers,
-- postal addresses, subscription plan and status. Found while checking whether
-- it was safe to publish the key to Vercel. It was not.
--
-- project_phase_groups carries tenant_id and was equally open.
--
-- The catalogues stay public on purpose: permissions, role_permissions and
-- subscription_plan_features describe the product, not any customer.

DROP POLICY IF EXISTS "Users can view own tenant" ON "public"."tenants";

-- Same shape as the UPDATE policy beside it, which was written correctly.
CREATE POLICY "Users can view own tenant" ON "public"."tenants"
  FOR SELECT
  USING ("id" = (
    SELECT "users"."tenant_id" FROM "public"."users"
     WHERE "users"."id" = "auth"."uid"()
  ));

DROP POLICY IF EXISTS "View phase groups" ON "public"."project_phase_groups";

CREATE POLICY "View phase groups" ON "public"."project_phase_groups"
  FOR SELECT
  USING ("tenant_id" = (
    SELECT "users"."tenant_id" FROM "public"."users"
     WHERE "users"."id" = "auth"."uid"()
  ));
