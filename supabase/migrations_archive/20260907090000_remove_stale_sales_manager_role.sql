-- Removes a duplicate "Sales Manager" role that grants nothing.
--
-- Two roles share the name. One has slug sales_manager, 58 permissions, and is
-- the one the application's seeded grants target. The other has slug
-- sales-manager, zero permissions and zero users, and predates it - a leftover
-- from before slugs settled on underscores (eight of ten roles use them; the
-- only other hyphen is senior-designer).
--
-- This matters because the two are indistinguishable in a role picker. Assign
-- someone to the wrong "Sales Manager" and they receive no permissions at all,
-- silently - and once the API starts enforcing permissions rather than only
-- checking for a session, that stops being cosmetic and becomes a person who
-- cannot do their job with no visible reason why.
--
-- Nothing references it: no user_roles rows, no role_permissions rows.

DELETE FROM "public"."roles"
 WHERE "slug" = 'sales-manager'
   AND NOT EXISTS (
     SELECT 1 FROM "public"."user_roles" ur
      WHERE ur."role_id" = "roles"."id"
   )
   AND NOT EXISTS (
     SELECT 1 FROM "public"."role_permissions" rp
      WHERE rp."role_id" = "roles"."id"
   );
