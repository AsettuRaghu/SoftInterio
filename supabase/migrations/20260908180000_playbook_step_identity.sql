-- Give a step an identity that survives a revision.
--
-- Editing a playbook marks every current step is_current = false and inserts
-- fresh rows, which is what lets a running plan keep resolving the rules it
-- began under. The cost is that nothing connects v2's "Layout Drawings" to
-- v1's - they are unrelated rows that happen to share a title.
--
-- That makes it impossible to say anything useful about drift. "Two steps were
-- added" needs to know which steps are the same step. step_key is carried
-- across revisions by the editor, so a step keeps its identity while its rules
-- change, and a genuinely new step gets a new one.
--
-- Existing rows each get their own key. Steps that were the same step across
-- earlier versions will not be reconnected retroactively - there is nothing
-- left to reconnect them by, and pretending otherwise would be a guess.

ALTER TABLE "public"."procedure_step_definitions"
  ADD COLUMN IF NOT EXISTS "step_key" "uuid" NOT NULL DEFAULT "gen_random_uuid"();

COMMENT ON COLUMN "public"."procedure_step_definitions"."step_key" IS
  'Stable across revisions: the same step in v1 and v3 shares a step_key. '
  'Used to tell an added step from a changed one.';

CREATE INDEX IF NOT EXISTS "procedure_step_definitions_step_key_idx"
  ON "public"."procedure_step_definitions" ("definition_id", "step_key");
