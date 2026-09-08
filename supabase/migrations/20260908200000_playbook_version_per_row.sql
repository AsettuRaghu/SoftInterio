-- A version of a playbook becomes a thing in its own right.
--
-- A version was a number on a row, so a playbook could only be in one state at
-- a time. Revising therefore took it out of service: the row went to draft,
-- and start_procedure_run refuses anything not committed, so while v4 was
-- being written no project could adopt v3 - the process everyone was happily
-- using vanished until the editing finished.
--
-- Each version is now its own row, tied to its siblings by root_id. v3 stays
-- committed and adoptable while v4 is drafted beside it, and committing v4
-- supersedes v3. Steps already belong to a definition row, and a run already
-- points at one, so pinning gets simpler rather than harder - a plan on v1
-- resolves v1 because that is literally the row it points at.
--
-- The split of existing data is inferential and runs once. Steps are inserted
-- in a batch each time a playbook is saved, so a batch is a version; they are
-- numbered in the order they were created. For the Modular Design Template
-- that gives 25 steps on 3 September as v1 - which the live run confirms, since
-- its tasks point at exactly those rows - then 24 and 24 today as v2 and v3.

ALTER TABLE "public"."procedure_definitions"
  ADD COLUMN IF NOT EXISTS "root_id" "uuid";

-- Every playbook that exists is the root of its own family.
UPDATE "public"."procedure_definitions" SET "root_id" = "id" WHERE "root_id" IS NULL;

ALTER TABLE "public"."procedure_definitions"
  ALTER COLUMN "root_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "procedure_definitions_root_idx"
  ON "public"."procedure_definitions" ("root_id", "version");

ALTER TABLE "public"."procedure_definitions"
  DROP CONSTRAINT IF EXISTS "procedure_definitions_status_check";

ALTER TABLE "public"."procedure_definitions"
  ADD CONSTRAINT "procedure_definitions_status_check"
  CHECK ("status" IN ('draft', 'committed', 'superseded', 'retired'));

COMMENT ON COLUMN "public"."procedure_definitions"."root_id" IS
  'Ties the versions of one playbook together. The first version''s own id.';

-- Split superseded steps out into the versions they belonged to.
DO $$
DECLARE
    v_def     RECORD;
    v_batch   RECORD;
    v_new_id  UUID;
    v_n       INT;
BEGIN
    FOR v_def IN
        SELECT * FROM "public"."procedure_definitions" WHERE "version" > 1
    LOOP
        v_n := 0;

        FOR v_batch IN
            SELECT MIN("created_at") AS at,
                   ARRAY_AGG("id") AS step_ids
              FROM "public"."procedure_step_definitions"
             WHERE "definition_id" = v_def."id"
               AND "is_current" = false
             GROUP BY date_trunc('minute', "created_at")
             ORDER BY MIN("created_at")
        LOOP
            v_n := v_n + 1;

            INSERT INTO "public"."procedure_definitions" (
                "tenant_id", "root_id", "name", "description", "version",
                "applies_to", "tenant_type", "is_active", "is_protected",
                "enforce_order", "status", "auto_start",
                "auto_start_project_category", "created_by", "updated_by",
                "created_at", "updated_at"
            ) VALUES (
                v_def."tenant_id", v_def."root_id", v_def."name",
                v_def."description", v_n, v_def."applies_to",
                v_def."tenant_type", false, v_def."is_protected",
                v_def."enforce_order", 'superseded', false, NULL,
                v_def."created_by", v_def."updated_by", v_batch.at, v_batch.at
            ) RETURNING "id" INTO v_new_id;

            -- The steps of that version move to it, and become current there:
            -- they are the whole of that version, not leftovers of this one.
            UPDATE "public"."procedure_step_definitions"
               SET "definition_id" = v_new_id,
                   "is_current" = true
             WHERE "id" = ANY(v_batch.step_ids);

            -- A plan that started on this version now points at the row that
            -- actually holds it.
            UPDATE "public"."procedure_runs"
               SET "definition_id" = v_new_id
             WHERE "definition_id" = v_def."id"
               AND "definition_version" = v_n;
        END LOOP;
    END LOOP;
END $$;
