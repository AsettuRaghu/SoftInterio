-- One approved VERSION per quotation number - on leads and projects alike.
--
-- The rule used to be "one approved quotation per lead": a unique index on
-- lead_id. That was the right rule while a lead had one quotation and
-- revised it. It is the wrong rule now that a lead or a project can carry
-- several quotations for different things - the kitchen, the false ceiling
-- the client added later, the accessories - each its own number, each with
-- its own versions. Approving the false ceiling must not supersede the
-- kitchen; approving v3 of the kitchen must supersede its v2.
--
-- So the unit is the quotation NUMBER: within one number one version is
-- approved at a time, and approving another supersedes it. The status route
-- does the superseding by number; this index is the guarantee behind it.
-- Projects had no rule at all before this.
--
-- Statuses are reduced at the same time to the ones anything sets:
--   draft · sent · approved · rejected · cancelled (shown as "Withdrawn")
--   · superseded (system only)
-- "viewed", "negotiating" and "expired" were facts, not statuses - the list
-- shows client views and validity from their own columns, and nothing ever
-- set expired automatically; "linked_to_project" and "project_baseline" died
-- with the handover copy. The one expired row becomes cancelled.

DROP INDEX IF EXISTS "public"."quotations_one_approved_per_lead";

CREATE UNIQUE INDEX IF NOT EXISTS "quotations_one_approved_per_number"
  ON "public"."quotations" ("tenant_id", "quotation_number")
  WHERE "status" = 'approved';

COMMENT ON INDEX "public"."quotations_one_approved_per_number" IS
  'Within one quotation number one version is approved at a time; approving another supersedes it. Different numbers on the same lead or project are independent.';

UPDATE "public"."quotations"
   SET "status" = 'cancelled', "updated_at" = now()
 WHERE "status" IN ('expired', 'linked_to_project', 'project_baseline');

UPDATE "public"."quotations"
   SET "status" = 'sent', "updated_at" = now()
 WHERE "status" IN ('viewed', 'negotiating');

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotations_status_allowed') THEN
    ALTER TABLE "public"."quotations"
      ADD CONSTRAINT "quotations_status_allowed"
      CHECK ("status" IN ('draft', 'sent', 'approved', 'rejected', 'cancelled', 'superseded'));
  END IF;
END $$;
