-- Let a project's progress come from its playbook.
--
-- overall_progress is kept up to date by a trigger on project_phases, and a
-- project running a playbook has no phase rows - so it sat at zero however
-- much work was finished. The number is on the projects list and in the
-- header, where zero reads as "nothing has happened".
--
-- Phases still win where they exist, so nothing changes for a project on the
-- old engine. Otherwise the run's steps answer, and they answer the same way
-- the Plan tab already draws them: a step that is completed, skipped or
-- cancelled is settled, and progress is how many are settled.

CREATE OR REPLACE FUNCTION "public"."calculate_project_progress"("p_project_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_total INT;
    v_sum INT;
    v_done INT;
BEGIN
    SELECT COUNT(*), COALESCE(SUM(progress_percentage), 0)
    INTO v_total, v_sum
    FROM project_phases
    WHERE project_id = p_project_id AND status != 'cancelled';

    IF v_total > 0 THEN
        RETURN ROUND(v_sum::DECIMAL / v_total);
    END IF;

    -- No phases: this project is run from a playbook.
    SELECT COUNT(*),
           COUNT(*) FILTER (WHERE t.status IN ('completed', 'skipped', 'cancelled'))
      INTO v_total, v_done
      FROM tasks t
      JOIN procedure_runs pr ON pr.id = t.procedure_run_id
     WHERE pr.related_type = 'project'
       AND pr.related_id = p_project_id
       AND pr.status = 'active';

    IF v_total = 0 THEN RETURN 0; END IF;
    RETURN ROUND(v_done::DECIMAL * 100 / v_total);
END;
$$;

COMMENT ON FUNCTION "public"."calculate_project_progress"("p_project_id" "uuid") IS
  'Overall project progress: from phases where they exist, otherwise from the active playbook run.';

-- The phase trigger cannot fire for a project that has no phases, so the same
-- recalculation has to hang off the tasks a run creates.
CREATE OR REPLACE FUNCTION "public"."update_project_progress_from_task"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_project_id UUID;
    v_run RECORD;
BEGIN
    IF COALESCE(NEW.procedure_run_id, OLD.procedure_run_id) IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    SELECT pr.related_type, pr.related_id INTO v_run
      FROM procedure_runs pr
     WHERE pr.id = COALESCE(NEW.procedure_run_id, OLD.procedure_run_id);

    IF NOT FOUND OR v_run.related_type <> 'project' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    v_project_id := v_run.related_id;

    UPDATE projects
       SET overall_progress = calculate_project_progress(v_project_id),
           updated_at = NOW()
     WHERE id = v_project_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS "trg_project_progress_from_task" ON "public"."tasks";

-- No WHEN clause: it cannot reference NEW and OLD across insert and delete.
-- The function returns early for a task that belongs to no run, which is most
-- of them.
CREATE TRIGGER "trg_project_progress_from_task"
AFTER INSERT OR UPDATE OF "status" OR DELETE ON "public"."tasks"
FOR EACH ROW
EXECUTE FUNCTION "public"."update_project_progress_from_task"();

-- Bring existing projects into line rather than waiting for the next change.
UPDATE projects
   SET overall_progress = calculate_project_progress(id)
 WHERE is_active = true;
