-- Progress must agree with what the Plan tab is showing.
--
-- The previous version read phases first and fell back to the playbook only
-- when a project had none. But a converted project can have both: it keeps the
-- phase rows created before the playbook existed, and PRJ_20251219_0001 has
-- four phases and an active run right now. The Plan tab prefers the run - so
-- the header would have reported progress from stale phases while the tab drew
-- the playbook, and the two would disagree on the same screen.
--
-- Same rule in both places: an active playbook run answers, and phases are the
-- fallback for projects that never had one.

CREATE OR REPLACE FUNCTION "public"."calculate_project_progress"("p_project_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_total INT;
    v_sum INT;
    v_done INT;
BEGIN
    SELECT COUNT(*),
           COUNT(*) FILTER (WHERE t.status IN ('completed', 'skipped', 'cancelled'))
      INTO v_total, v_done
      FROM tasks t
      JOIN procedure_runs pr ON pr.id = t.procedure_run_id
     WHERE pr.related_type = 'project'
       AND pr.related_id = p_project_id
       AND pr.status = 'active';

    IF v_total > 0 THEN
        RETURN ROUND(v_done::DECIMAL * 100 / v_total);
    END IF;

    SELECT COUNT(*), COALESCE(SUM(progress_percentage), 0)
      INTO v_total, v_sum
      FROM project_phases
     WHERE project_id = p_project_id AND status != 'cancelled';

    IF v_total = 0 THEN RETURN 0; END IF;
    RETURN ROUND(v_sum::DECIMAL / v_total);
END;
$$;

COMMENT ON FUNCTION "public"."calculate_project_progress"("p_project_id" "uuid") IS
  'Overall project progress. An active playbook run answers; phases are the fallback.';

UPDATE projects
   SET overall_progress = calculate_project_progress(id)
 WHERE is_active = true;
