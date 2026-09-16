-- A delay that is unique - not in the reasons list, not a playbook step -
-- is registered as an ask on the "waiting on" list, and can name the step it
-- holds up. Raising it holds that step (blocked if it has not started,
-- paused if it has) until the ask's expected date, so the plan re-lays;
-- delivering it releases a step that was only waiting to start.

ALTER TABLE "public"."project_dependencies"
  ADD COLUMN IF NOT EXISTS "blocks_task_id" uuid REFERENCES "public"."tasks"("id") ON DELETE SET NULL;
COMMENT ON COLUMN "public"."project_dependencies"."blocks_task_id" IS 'For an ad-hoc ask: the step it holds up. Raising the ask holds the step; delivering it releases a step that had not started.';

-- Every owner gets an "Other" so a hold can carry a reason the list has not
-- met yet; the note says what it was.
INSERT INTO "public"."delay_reasons" ("owner", "code", "label", "display_order") VALUES
  ('client',      'other', 'Other (say what in the note)', 99),
  ('vendor',      'other', 'Other (say what in the note)', 99),
  ('internal',    'other', 'Other (say what in the note)', 99),
  ('third_party', 'other', 'Other (say what in the note)', 99)
ON CONFLICT DO NOTHING;
