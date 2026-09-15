-- Remove the last handover copy, PRJ_20251219_2158
--
-- `20260915090000` stopped handover from copying the approved quotation and
-- superseded the one copy that already existed, rather than deleting it. Keeping
-- it turned out to be the wrong call for a different reason than correctness: a
-- third quotation on the project, under a number from another module, is a
-- question every reader has to ask and answer before they can trust the screen.
--
-- It is safe to delete because it carries nothing unique. Verified against the
-- live database before writing this:
--
--     ORIGINAL  QT-2025-0004 v2      approved    grand_total 2116372.49
--                                    5 spaces, 6 components, 17 line items
--     COPY      PRJ_20251219_2158 v1 superseded  grand_total 2116372.49
--                                    5 spaces, 6 components, 17 line items
--
-- subtotal, tax_amount and every line item's quantity/rate/amount matched too.
-- The project already points at the original, and nothing else referenced the
-- copy.
--
-- This is the one irreversible step in the sequence. The guards below make it
-- refuse rather than guess: it will not run if the copy is still referenced, if
-- the original is missing, or if the two are not equivalent - so a database in a
-- different state gets an exception instead of a silent deletion.

DO $$
DECLARE
  v_copy_id    uuid;
  v_source_id  uuid;
  v_lead_id    uuid;
  v_copy_total numeric;
  v_src_total  numeric;
  v_copy_lines int;
  v_src_lines  int;
  v_refs       int;
BEGIN
  SELECT id, lead_id, grand_total
    INTO v_copy_id, v_lead_id, v_copy_total
    FROM "public"."quotations"
   WHERE quotation_number = 'PRJ_20251219_2158'
     AND baseline_quotation_id IS NOT NULL;

  IF v_copy_id IS NULL THEN
    RAISE NOTICE 'No handover copy found - already removed, nothing to do.';
    RETURN;
  END IF;

  -- Guard 1: nothing may still point at it.
  SELECT count(*) INTO v_refs
    FROM "public"."projects"
   WHERE quotation_id = v_copy_id
      OR baseline_quotation_id = v_copy_id;
  IF v_refs > 0 THEN
    RAISE EXCEPTION
      'Refusing to delete: % project(s) still reference this quotation. Repoint them first.', v_refs;
  END IF;

  SELECT count(*) INTO v_refs
    FROM "public"."quotations"
   WHERE baseline_quotation_id = v_copy_id
     AND id <> v_copy_id;
  IF v_refs > 0 THEN
    RAISE EXCEPTION
      'Refusing to delete: % other quotation(s) name this one as their baseline.', v_refs;
  END IF;

  -- Guard 2: the original must exist.
  SELECT id, grand_total INTO v_source_id, v_src_total
    FROM "public"."quotations"
   WHERE lead_id = v_lead_id
     AND status = 'approved'
     AND baseline_quotation_id IS NULL
   ORDER BY version DESC
   LIMIT 1;

  IF v_source_id IS NULL THEN
    RAISE EXCEPTION
      'Refusing to delete: no approved quotation remains on this lead, so the copy is the only record.';
  END IF;

  -- Guard 3: and it must carry the same money and the same number of lines.
  SELECT count(*) INTO v_copy_lines
    FROM "public"."quotation_line_items" WHERE quotation_id = v_copy_id;
  SELECT count(*) INTO v_src_lines
    FROM "public"."quotation_line_items" WHERE quotation_id = v_source_id;

  IF v_copy_total <> v_src_total OR v_copy_lines <> v_src_lines THEN
    RAISE EXCEPTION
      'Refusing to delete: copy (% / % lines) is not equivalent to the original (% / % lines).',
      v_copy_total, v_copy_lines, v_src_total, v_src_lines;
  END IF;

  -- Children first. Not relying on ON DELETE CASCADE: whether each of these
  -- carries one is not something to discover by deleting a parent.
  DELETE FROM "public"."quotation_line_items" WHERE quotation_id = v_copy_id;
  DELETE FROM "public"."quotation_components" WHERE quotation_id = v_copy_id;
  DELETE FROM "public"."quotation_spaces"     WHERE quotation_id = v_copy_id;
  DELETE FROM "public"."quotations"           WHERE id = v_copy_id;

  RAISE NOTICE
    'Deleted handover copy % (equivalent to kept original %): % line items, and its spaces and components.',
    v_copy_id, v_source_id, v_copy_lines;
END $$;
