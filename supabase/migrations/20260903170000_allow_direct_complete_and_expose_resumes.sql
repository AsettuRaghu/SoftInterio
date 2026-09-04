-- Migration: allow todo -> completed, and expose start/resume counts
-- Created: 2026-09-03
--
-- Part 1 -------------------------------------------------------------------
-- The original transition rules forbade todo -> completed, forcing everyone
-- to press Start before they could tick a task off. The intent was to keep
-- cycle time meaningful, but it blocks the most common action in the whole
-- module to protect a metric.
--
-- A task completed without ever being started has zero worked seconds and a
-- NULL cycle time. That is ACCURATE - nobody tracked the work - not corrupt.
-- The metric stays honest either way, so the restriction only cost usability.
--
-- Part 2 -------------------------------------------------------------------
-- first_started_at and started_at already distinguish a first start from a
-- resume, and task_status_history records every entry into in_progress. This
-- surfaces the counts so the UI does not need a second query to say
-- "started once, resumed 3 times".

-- ---------------------------------------------------------------------
-- 1. Transition rules
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."is_valid_task_transition"(
    "p_from" "public"."task_status",
    "p_to"   "public"."task_status"
) RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
    IF p_from IS NULL OR p_from = p_to THEN
        RETURN true;
    END IF;

    RETURN CASE p_from
        -- todo -> completed is now allowed: ticking off a task you never
        -- formally started is normal. It simply records no worked time.
        WHEN 'todo'        THEN p_to IN ('in_progress', 'completed', 'cancelled')
        WHEN 'in_progress' THEN p_to IN ('on_hold', 'blocked', 'completed', 'cancelled')
        WHEN 'on_hold'     THEN p_to IN ('in_progress', 'blocked', 'completed', 'cancelled')
        WHEN 'blocked'     THEN p_to IN ('in_progress', 'on_hold', 'completed', 'cancelled')
        WHEN 'completed'   THEN p_to IN ('in_progress', 'todo')   -- reopen
        WHEN 'cancelled'   THEN p_to IN ('todo')                  -- reactivate
        ELSE false
    END;
END;
$$;

COMMENT ON FUNCTION "public"."is_valid_task_transition"("public"."task_status", "public"."task_status") IS 'Allowed task status transitions. Advisory - enforced in the task_transition() RPC, not by constraint. todo->completed is permitted and records zero worked time.';


-- ---------------------------------------------------------------------
-- 2. Expose start / resume counts
-- ---------------------------------------------------------------------

-- New columns are appended, so CREATE OR REPLACE is safe.
CREATE OR REPLACE VIEW "public"."tasks_with_timing" WITH ("security_invoker" = 'true') AS
SELECT
    t.*,
    (t.total_active_seconds + COALESCE((
        SELECT SUM(GREATEST(0, (EXTRACT(EPOCH FROM (now() - ws.started_at)))::bigint))
          FROM "public"."task_work_sessions" ws
         WHERE ws.task_id = t.id AND ws.ended_at IS NULL
    ), 0))::bigint AS "live_active_seconds",

    (t.total_held_seconds + CASE
        WHEN t.status IN ('on_hold', 'blocked')
        THEN GREATEST(0, (EXTRACT(EPOCH FROM (now() - COALESCE(
                (SELECT MAX(changed_at) FROM "public"."task_status_history" h WHERE h.task_id = t.id),
                t.created_at))))::bigint)
        ELSE 0
    END)::bigint AS "live_held_seconds",

    EXISTS (
        SELECT 1 FROM "public"."task_work_sessions" ws
         WHERE ws.task_id = t.id AND ws.ended_at IS NULL
    ) AS "is_clock_running",

    CASE WHEN t.completed_at IS NOT NULL
         THEN (EXTRACT(EPOCH FROM (t.completed_at - t.created_at)))::bigint END AS "lead_time_seconds",
    CASE WHEN t.completed_at IS NOT NULL AND t.first_started_at IS NOT NULL
         THEN (EXTRACT(EPOCH FROM (t.completed_at - t.first_started_at)))::bigint END AS "cycle_time_seconds",

    -- Every entry into in_progress. The first is the original start; the
    -- rest are resumes after a pause, block or reopen.
    (SELECT COUNT(*) FROM "public"."task_status_history" h
      WHERE h.task_id = t.id AND h.to_status = 'in_progress')::integer AS "start_count",

    GREATEST(0, (SELECT COUNT(*) FROM "public"."task_status_history" h
                  WHERE h.task_id = t.id AND h.to_status = 'in_progress') - 1)::integer AS "resume_count"
FROM "public"."tasks" t;

COMMENT ON VIEW "public"."tasks_with_timing" IS 'Tasks plus live timing. live_* columns include the in-flight session/hold; the underlying tasks columns hold only settled totals. start_count counts every entry into in_progress; resume_count excludes the first.';

GRANT ALL ON TABLE "public"."tasks_with_timing" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks_with_timing" TO "service_role";
REVOKE ALL ON TABLE "public"."tasks_with_timing" FROM "anon";
