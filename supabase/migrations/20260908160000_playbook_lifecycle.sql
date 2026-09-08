-- A playbook has a life: draft, committed, retired.
--
-- Until now is_active did two jobs badly. "Inactive" could not tell you whether
-- a playbook had never been finished or had been deliberately taken out of
-- service, and a committed playbook that ten projects were running could still
-- be edited freely - the version quietly moved and nobody was told.
--
--   draft      - being written. Steps may change. Cannot be run.
--   committed  - in service. The contract is frozen: steps, gates, order,
--                dependencies and hours cannot change. Wording still can,
--                because forcing a new version to fix a typo is how a process
--                stops being maintained.
--   retired    - no new plans adopt it. Plans already running it are
--                untouched, because they pinned their version at the start.
--
-- Revising means going back to draft at the next version. Steps already in use
-- keep their own rows - a run resolves tasks through procedure_step_id, which
-- still points at the version it began under.

ALTER TABLE "public"."procedure_definitions"
  ADD COLUMN IF NOT EXISTS "status" "text" NOT NULL DEFAULT 'draft';

ALTER TABLE "public"."procedure_definitions"
  DROP CONSTRAINT IF EXISTS "procedure_definitions_status_check";

ALTER TABLE "public"."procedure_definitions"
  ADD CONSTRAINT "procedure_definitions_status_check"
  CHECK ("status" IN ('draft', 'committed', 'retired'));

COMMENT ON COLUMN "public"."procedure_definitions"."status" IS
  'draft: editable, cannot run. committed: in service, contract frozen. '
  'retired: no new runs, existing runs unaffected.';

-- Anything already switched on was in service, whatever it was called.
UPDATE "public"."procedure_definitions"
   SET "status" = CASE WHEN "is_active" THEN 'committed' ELSE 'draft' END;

-- Only a committed playbook can be picked up automatically. A draft is
-- half-written and a retired one is deliberately out of service; neither
-- should land on a new project.
DROP INDEX IF EXISTS "procedure_definitions_one_auto_start_per_category";

CREATE UNIQUE INDEX IF NOT EXISTS "procedure_definitions_one_auto_start_per_category"
  ON "public"."procedure_definitions" (
    "tenant_id",
    "applies_to",
    COALESCE("auto_start_project_category", '*')
  )
  WHERE "auto_start" = true AND "status" = 'committed';
