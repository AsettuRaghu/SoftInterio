-- Partners is for Owners and Admins.
--
-- It was gated on clients.view, which eight roles hold - sales, finance,
-- project managers and their staff - because that key guarded the old
-- customer list. Partners is the business's whole relationship book, and
-- the decision (2026-09-17) is that only Owner and Admin see it. Four keys
-- of its own; Owner receives them through trg_grant_new_permission_to_owner,
-- Admin by the grant below. Other roles get one only if a business grants
-- it - per user or on its own copy of a role - which is the flat model.

INSERT INTO "public"."permissions" ("key", "module", "description", "is_system_permission")
VALUES
  ('partners.view',   'partners', 'See the partners this business works with', true),
  ('partners.create', 'partners', 'Add a partner',                              true),
  ('partners.edit',   'partners', 'Edit a partner and its contacts',            true),
  ('partners.delete', 'partners', 'Delete a partner with no records against it', true)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "public"."role_permissions" ("role_id", "permission_id", "granted")
SELECT r."id", p."id", true
  FROM "public"."roles" r
  CROSS JOIN "public"."permissions" p
 WHERE r."tenant_id" IS NULL
   AND r."slug" IN ('owner', 'admin')
   AND p."key" IN ('partners.view', 'partners.create', 'partners.edit', 'partners.delete')
   AND NOT EXISTS (
     SELECT 1 FROM "public"."role_permissions" rp
      WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
   );
