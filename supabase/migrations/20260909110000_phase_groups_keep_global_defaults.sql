-- Follow-up to 20260909100000.
--
-- Closing the public read on project_phase_groups was right - the anon key
-- should not read it - but scoping it to the caller's tenant hid the seven
-- seeded rows from everybody, because they are global defaults with a NULL
-- tenant_id (Initiation, Design, Material Selection, Civil Works,
-- Manufacturing, Installation, Completion).
--
-- Nothing read them, so nothing broke: no TypeScript touches this table, and
-- get_project_workflow() is SECURITY DEFINER and so exempt from RLS anyway.
-- Correcting the shape regardless, so the next person to wire this up does not
-- meet an empty list with no explanation.
--
-- Shape: a signed-in user sees the shared defaults plus their own tenant's
-- overrides. Anonymous sees nothing.

DROP POLICY IF EXISTS "View phase groups" ON "public"."project_phase_groups";

CREATE POLICY "View phase groups" ON "public"."project_phase_groups"
  FOR SELECT
  TO "authenticated"
  USING (
    "tenant_id" IS NULL
    OR "tenant_id" = (
      SELECT "users"."tenant_id" FROM "public"."users"
       WHERE "users"."id" = "auth"."uid"()
    )
  );
