-- Attach the approved quotation to the project; stop copying it
--
-- Marking a lead won used to run copy_quotation_to_project(), which duplicated
-- the quotation and its whole tree - header, spaces, components, every line item
-- - under a fresh 'PRJ_<date>_<random>' number, then pointed the project at the
-- duplicate. Two facts made that pointless:
--
--   1. An approved quotation cannot be edited. The API refuses it and tells you
--      to revise, and a revision inserts a new row. The copy froze something
--      already frozen by its status.
--   2. The original was already attached. lock_quotation_for_project() sets
--      linked_to_project_id, and the approved quotation carried project_id too,
--      so the association the copy existed to create was already in place.
--
-- The copy did cost: a duplicated tree per conversion, a fourth quotation
-- numbering format whose suffix is FLOOR(RANDOM() * 10000) and can collide, an
-- exemption in quotations_one_approved_per_lead to stop the copy breaching a
-- rule it had no business being in, and a project whose quotation_id named a
-- number nobody in the sales conversation had seen.
--
-- The application no longer calls the function. It is kept, not dropped: removing
-- it in the same change that stops calling it would remove the way back if the
-- reasoning above turns out to be wrong.

COMMENT ON FUNCTION "public"."copy_quotation_to_project"(
  "p_source_quotation_id" "uuid", "p_project_id" "uuid", "p_created_by" "uuid"
) IS
  'NO LONGER CALLED (2026-09-15). The lead transition now attaches the approved '
  'quotation to the project instead of duplicating it - an approved quotation is '
  'already immutable, and it was already linked. Kept rather than dropped so the '
  'change is reversible. Do not call this from new code.';

-- ---------------------------------------------------------------------------
-- The one existing copy
--
-- PRJ_20251219_2158 v1, on PRJ_20251219_0001, copied from QT-2025-0004 v2.
-- It is the only row in the database with baseline_quotation_id set.
--
-- Order matters. The project is repointed FIRST: if quotation_id still named the
-- copy when the copy stopped being the approved one, the project's Quotations tab
-- would lose the document it was built on.

DO $$
DECLARE
  v_project_id  uuid;
  v_source_id   uuid;
  v_copy_id     uuid;
BEGIN
  SELECT q.id, q.project_id
    INTO v_copy_id, v_project_id
    FROM "public"."quotations" q
   WHERE q.quotation_number = 'PRJ_20251219_2158'
     AND q.baseline_quotation_id = q.id
   LIMIT 1;

  IF v_copy_id IS NULL THEN
    RAISE NOTICE 'No baseline copy found - nothing to migrate.';
    RETURN;
  END IF;

  -- The lead-side approved quotation this was copied from. Found by lead and
  -- status rather than by number, so the same migration works if it is re-run
  -- against a database where the numbers differ.
  SELECT q.id INTO v_source_id
    FROM "public"."quotations" q
   WHERE q.lead_id = (SELECT lead_id FROM "public"."quotations" WHERE id = v_copy_id)
     AND q.status = 'approved'
     AND q.baseline_quotation_id IS NULL
   ORDER BY q.version DESC
   LIMIT 1;

  IF v_source_id IS NULL THEN
    RAISE EXCEPTION 'Found the copy but not its source approved quotation; refusing to continue.';
  END IF;

  -- 1. Point the project at the real quotation, and make sure it is attached.
  UPDATE "public"."projects"
     SET quotation_id = v_source_id,
         baseline_quotation_id = NULL,
         updated_at = NOW()
   WHERE id = v_project_id;

  UPDATE "public"."quotations"
     SET project_id = v_project_id,
         linked_to_project_id = v_project_id,
         is_locked = true,
         updated_at = NOW()
   WHERE id = v_source_id;

  -- 2. Now the copy can stop competing for "the approved quotation". Superseded
  --    rather than deleted: nobody withdrew it, it records that a handover
  --    snapshot was once taken, and deleting it would take its spaces,
  --    components and line items with it irreversibly.
  UPDATE "public"."quotations"
     SET status = 'superseded',
         notes = COALESCE(notes || E'\n\n', '') ||
           'Superseded 2026-09-15: this was a baseline copy taken at handover. '
           'The project now points at the lead''s approved quotation directly, so '
           'this duplicate is kept only as a record that a snapshot existed.',
         updated_at = NOW()
   WHERE id = v_copy_id;

  RAISE NOTICE 'Repointed project % to quotation %, superseded copy %',
    v_project_id, v_source_id, v_copy_id;
END $$;

-- ---------------------------------------------------------------------------
-- The index can now say what it means
--
-- The exemption existed only because the copy would otherwise breach the rule.
-- With no new baselines being created, and the one existing copy superseded, a
-- lead has exactly one approved quotation again.
--
-- Run after the block above, or the copy - approved on the same lead as its
-- source - breaches it.

DROP INDEX IF EXISTS "public"."quotations_one_approved_per_lead";

CREATE UNIQUE INDEX "quotations_one_approved_per_lead"
  ON "public"."quotations" ("lead_id")
  WHERE "status" = 'approved'
    AND "lead_id" IS NOT NULL;

COMMENT ON INDEX "public"."quotations_one_approved_per_lead" IS
  'A lead has one approved quotation. The AND baseline_quotation_id IS NULL '
  'exemption was dropped on 2026-09-15: it existed only so a handover copy could '
  'sit approved alongside its source, and handover no longer copies.';
