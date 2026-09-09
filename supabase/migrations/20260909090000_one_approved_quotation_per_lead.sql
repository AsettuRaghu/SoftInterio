-- One approved quotation per lead.
--
-- Nothing stopped two quotations on one lead being approved at once, and the
-- won transition picks from whatever is approved - so "which price did we
-- actually agree?" had no answer in the data. A lead has one agreed price.
--
-- Baseline copies are excluded. Converting a lead copies its quotation onto
-- the project as a frozen baseline, and that copy is approved too - it carries
-- baseline_quotation_id, which the lead's own quotation never does. Counting
-- it would make the rule unsatisfiable for every converted lead, which is
-- exactly the state lead 169803ed is in today.
--
-- Superseded revisions are already cancelled rather than left approved, so
-- revising and approving v2 does not collide with v1.

CREATE UNIQUE INDEX IF NOT EXISTS "quotations_one_approved_per_lead"
  ON "public"."quotations" ("lead_id")
  WHERE "status" = 'approved'
    AND "baseline_quotation_id" IS NULL
    AND "lead_id" IS NOT NULL;

COMMENT ON INDEX "public"."quotations_one_approved_per_lead" IS
  'A lead has one agreed price. Project baseline copies are excluded - they are a record of what was agreed, not a competing quotation.';
