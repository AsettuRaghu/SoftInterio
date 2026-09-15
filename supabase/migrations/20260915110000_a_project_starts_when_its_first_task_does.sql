-- A project starts when its first task does
--
-- projects.actual_start_date has existed since the baseline and nothing wrote
-- it: not the status change to in_progress, not the first task starting, not
-- the edit dialog. project_phases has its own actual_start_date and a function
-- that stamps it, which is probably where the assumption that "something sets
-- this" came from. So every project carried planned dates and no actual ones,
-- and the Timelines column had nothing to project from - PRJ_20251219_0001 sat
-- at 9% done with a planned start still in the future and no recorded start.
--
-- The honest start of a project is the moment its first task is started. That
-- is what task_transition stamps as first_started_at, so a trigger on that
-- column carries it up to the project, once, and never overwrites a date that is
-- already there.

CREATE OR REPLACE FUNCTION "public"."stamp_project_actual_start"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.related_type = 'project'
     AND NEW.related_id IS NOT NULL
     AND NEW.first_started_at IS NOT NULL
     AND (OLD.first_started_at IS NULL) THEN
    UPDATE "public"."projects"
       SET actual_start_date = NEW.first_started_at::date,
           updated_at = NOW()
     WHERE id = NEW.related_id
       AND actual_start_date IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_actual_start_from_task ON "public"."tasks";
CREATE TRIGGER trg_project_actual_start_from_task
  AFTER UPDATE OF first_started_at ON "public"."tasks"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."stamp_project_actual_start"();

COMMENT ON FUNCTION "public"."stamp_project_actual_start"() IS
  'Sets projects.actual_start_date the first time any of the project''s tasks '
  'is started. Never overwrites a date already set. Added 2026-09-15 because '
  'nothing wrote that column, so no project had a recorded start.';

-- ---------------------------------------------------------------------------
-- Backfill: every project already under way takes the date its first task
-- started. Verified beforehand: one project qualifies, PRJ_20251219_0001, whose
-- earliest task started 2026-09-03.

UPDATE "public"."projects" p
   SET actual_start_date = s.first_start,
       updated_at = NOW()
  FROM (
    SELECT related_id AS project_id, MIN(first_started_at)::date AS first_start
      FROM "public"."tasks"
     WHERE related_type = 'project'
       AND first_started_at IS NOT NULL
     GROUP BY related_id
  ) s
 WHERE p.id = s.project_id
   AND p.actual_start_date IS NULL;
