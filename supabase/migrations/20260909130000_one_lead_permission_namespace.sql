-- Collapse two lead permission namespaces into the one the code enforces.
--
-- The app has always enforced leads.*; sales.leads.* was granted alongside it
-- and read only by the navigation and the middleware's route table. That split
-- did not lock Manager out cleanly - it did something worse. Manager held
-- sales.leads.view, so the nav showed Leads and the middleware allowed
-- /dashboard/sales/leads, and then leadAccess() found neither leads.view nor
-- leads.view_own and refused. The menu worked and the page was broken.
--
-- Owner and Admin already hold all 18 leads.* keys and Sales holds a coherent
-- own-scoped set, so only Manager actually changes here.
--
-- Manager's 7 sales.leads.* grants translate as:
--   view, view_all -> leads.view          (leads.view already means "all")
--   create         -> leads.create
--   edit_all       -> leads.edit
--   assign         -> leads.assign
--   mark_won       -> leads.convert + leads.stage_change
--   disqualify     -> leads.stage_change
-- Deliberately NOT granted: leads.delete and leads.export - Manager held
-- neither in the old namespace, and this is a translation, not a promotion.
--
-- The four sub-resource keys are added because the lead detail page calls
-- routes that enforce them (leads.notes.create, leads.activities.create). A
-- Manager who may open a lead but not read its notes has a broken page, which
-- is the same class of bug this migration exists to fix.

INSERT INTO "public"."role_permissions" ("role_id", "permission_id", "granted")
SELECT r."id", p."id", true
  FROM "public"."roles" r
  CROSS JOIN "public"."permissions" p
 WHERE r."name" = 'Manager'
   AND p."key" IN (
     'leads.view',
     'leads.create',
     'leads.edit',
     'leads.assign',
     'leads.convert',
     'leads.stage_change',
     'leads.notes.view',
     'leads.notes.create',
     'leads.activities.view',
     'leads.activities.create'
   )
   AND NOT EXISTS (
     SELECT 1 FROM "public"."role_permissions" rp
      WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
   );

-- Retire the namespace. Deleting the permission rows cascades to
-- role_permissions, removing all 39 grants across Owner, Admin, Manager and
-- Sales. The five code references (route-permissions.ts, navigation.tsx) are
-- removed in the same change - the generated PermissionKey union would fail
-- the build otherwise, which is the drift check doing its job.
DELETE FROM "public"."permissions" WHERE "key" LIKE 'sales.leads.%';
