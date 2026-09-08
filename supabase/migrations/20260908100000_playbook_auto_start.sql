-- Let a playbook start itself.
--
-- Adopting a playbook still meant someone remembering to press start on every
-- project, which is the one manual step that undoes the whole point of
-- configuring the process once. A playbook can now say which projects it is
-- for, and the project answers by starting it.
--
-- auto_start_project_category is null for "any project". Matching stays
-- deliberately narrow - the project's category, and the business type the
-- playbook already declares - because a rule nobody can predict is worse than
-- pressing a button.

ALTER TABLE "public"."procedure_definitions"
  ADD COLUMN IF NOT EXISTS "auto_start" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "public"."procedure_definitions"
  ADD COLUMN IF NOT EXISTS "auto_start_project_category" "text";

COMMENT ON COLUMN "public"."procedure_definitions"."auto_start" IS
  'Start this playbook automatically when a matching entity is created.';

COMMENT ON COLUMN "public"."procedure_definitions"."auto_start_project_category" IS
  'Restrict auto-start to one project_category. Null means any.';

-- Only an active playbook can be picked up, and only one per category, so a
-- project cannot silently acquire three overlapping processes.
CREATE UNIQUE INDEX IF NOT EXISTS "procedure_definitions_one_auto_start_per_category"
  ON "public"."procedure_definitions" (
    "tenant_id",
    "applies_to",
    COALESCE("auto_start_project_category", '*')
  )
  WHERE "auto_start" = true AND "is_active" = true;
