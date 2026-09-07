-- Migration: preserve completion history, and gate parent completion on subtasks
-- Created: 2026-09-03
--
-- PART 1 - completion becomes an event, not just a state
--
-- Reopening a task cleared completed_at, which silently rewrote history:
--   1st completion  completed_at=09:32:58  lead=2   cycle=2
--   after reopen    completed_at=NULL      lead=null cycle=null
--   2nd completion  completed_at=09:33:02  lead=6   cycle=6
-- The original completion vanished from the task row, so "tasks completed in
-- August" changed retroactively and rework was invisible.
--
-- task_status_history had every completion all along, so nothing was lost -
-- only the denormalised rollup was lossy. This adds two columns that survive
-- a reopen:
--   first_completed_at - the ORIGINAL completion, never overwritten
--   completion_count   - how many times this task has been completed
-- completion_count > 1 is rework, which for site work ("did it pass first
-- inspection?") is the whole point of measuring any of this.
--
-- completed_at still clears on reopen, deliberately: while a task is back in
-- progress it is genuinely not complete, and lead/cycle time should read NULL.
-- The permanent record lives in first_completed_at.
--
-- PART 2 - a parent cannot complete while subtasks are open
--
-- Nothing enforced this, so a parent could sit "completed" with children still
-- in progress. The gate counts a subtask as settled when it is completed OR
-- cancelled - a cancelled subtask has been consciously dropped and should not
-- block its parent forever.
--
-- The inverse is enforced too: reopening a subtask under a completed parent
-- reopens the parent, because leaving it completed would recreate exactly the
-- invalid state this gate exists to prevent.

-- ---------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------

ALTER TABLE "public"."tasks"
    ADD COLUMN IF NOT EXISTS "first_completed_at" timestamp with time zone,
    ADD COLUMN IF NOT EXISTS "completion_count"   integer DEFAULT 0 NOT NULL;

COMMENT ON COLUMN "public"."tasks"."first_completed_at" IS 'The ORIGINAL completion. Never overwritten, survives reopen - so historical "completed in month X" reporting stays stable.';
COMMENT ON COLUMN "public"."tasks"."completion_count" IS 'Times this task has been completed. Greater than 1 means rework.';

-- Backfill from the event log, which has always had the full picture.
UPDATE "public"."tasks" t
   SET first_completed_at = h.first_at,
       completion_count   = h.n
  FROM (
        SELECT task_id, MIN(changed_at) AS first_at, COUNT(*)::integer AS n
          FROM "public"."task_status_history"
         WHERE to_status = 'completed'
         GROUP BY task_id
       ) h
 WHERE h.task_id = t.id
   AND t.completion_count = 0;

-- Tasks completed before the history table existed.
UPDATE "public"."tasks"
   SET first_completed_at = completed_at,
       completion_count   = 1
 WHERE status = 'completed'
   AND completed_at IS NOT NULL
   AND first_completed_at IS NULL;

-- ---------------------------------------------------------------------
-- 2. Trigger: record every completion
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."trg_tasks_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_now         timestamp with time zone := now();
    v_last_change timestamp with time zone;
    v_duration    bigint;
    v_actor       "uuid";
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;

    v_actor := COALESCE(NEW.updated_by, NEW.completed_by, NEW.assigned_to, OLD.assigned_to);

    SELECT COALESCE(MAX(changed_at), OLD.created_at)
      INTO v_last_change
      FROM "public"."task_status_history"
     WHERE task_id = NEW.id;

    v_duration := GREATEST(0, (EXTRACT(EPOCH FROM (v_now - COALESCE(v_last_change, v_now))))::bigint);

    INSERT INTO "public"."task_status_history"
        (task_id, tenant_id, from_status, to_status, duration_seconds, reason, changed_by, changed_at)
    VALUES
        (NEW.id, NEW.tenant_id, OLD.status, NEW.status, v_duration, NEW.hold_reason, v_actor, v_now);

    IF OLD.status IN ('on_hold', 'blocked') THEN
        NEW.total_held_seconds := COALESCE(OLD.total_held_seconds, 0) + v_duration;
    END IF;

    IF NEW.status = 'in_progress' THEN
        NEW.started_at := v_now;
        IF NEW.first_started_at IS NULL THEN
            NEW.first_started_at := v_now;
        END IF;

        IF v_actor IS NOT NULL THEN
            INSERT INTO "public"."task_work_sessions" (task_id, tenant_id, user_id, started_at, source)
            VALUES (NEW.id, NEW.tenant_id, v_actor, v_now, 'status')
            ON CONFLICT (task_id, user_id) WHERE (ended_at IS NULL) DO NOTHING;
        END IF;

        -- Clear the CURRENT completion so lead/cycle time read NULL while the
        -- task is back in flight. first_completed_at and completion_count are
        -- deliberately left alone - that is the permanent record.
        NEW.completed_at := NULL;
        NEW.completed_by := NULL;
        NEW.cancelled_at := NULL;
        NEW.cancelled_by := NULL;
    ELSE
        UPDATE "public"."task_work_sessions"
           SET ended_at = v_now
         WHERE task_id = NEW.id
           AND ended_at IS NULL;

        SELECT COALESCE(SUM(duration_seconds), 0)
          INTO NEW.total_active_seconds
          FROM "public"."task_work_sessions"
         WHERE task_id = NEW.id
           AND ended_at IS NOT NULL;

        NEW.actual_hours := ROUND((NEW.total_active_seconds / 3600.0)::numeric, 2);
    END IF;

    IF NEW.status = 'completed' THEN
        NEW.completed_at := COALESCE(NEW.completed_at, v_now);
        NEW.completed_by := COALESCE(NEW.completed_by, v_actor);
        -- Permanent record: set once, counted every time.
        NEW.first_completed_at := COALESCE(NEW.first_completed_at, v_now);
        NEW.completion_count := COALESCE(OLD.completion_count, 0) + 1;
    END IF;

    IF NEW.status = 'cancelled' THEN
        NEW.cancelled_at := COALESCE(NEW.cancelled_at, v_now);
        NEW.cancelled_by := COALESCE(NEW.cancelled_by, v_actor);
    END IF;

    IF NEW.status NOT IN ('on_hold', 'blocked') THEN
        NEW.hold_reason := NULL;
    END IF;

    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. Subtask gate inside task_transition()
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."task_transition"(
    "p_task_id" "uuid",
    "p_user_id" "uuid",
    "p_to"      "public"."task_status",
    "p_reason"  "text" DEFAULT NULL
) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_task        RECORD;
    v_open_titles TEXT[];
    v_parent      RECORD;
    v_reopened    boolean := false;
BEGIN
    SELECT * INTO v_task FROM "public"."tasks" WHERE id = p_task_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Task not found');
    END IF;

    IF v_task.status = p_to THEN
        RETURN jsonb_build_object('success', true, 'message', 'No change', 'status', p_to);
    END IF;

    IF NOT "public"."is_valid_task_transition"(v_task.status, p_to) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('Cannot move a task from %s to %s', v_task.status, p_to),
            'from', v_task.status,
            'to', p_to
        );
    END IF;

    -- A parent cannot complete while any child is still live. Cancelled
    -- children do not block: they were consciously dropped.
    IF p_to = 'completed' THEN
        SELECT array_agg(title ORDER BY created_at)
          INTO v_open_titles
          FROM "public"."tasks"
         WHERE parent_task_id = p_task_id
           AND status NOT IN ('completed', 'cancelled');

        IF v_open_titles IS NOT NULL AND array_length(v_open_titles, 1) > 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', format(
                    '%s subtask%s still open. Complete or cancel %s first.',
                    array_length(v_open_titles, 1),
                    CASE WHEN array_length(v_open_titles, 1) = 1 THEN '' ELSE 's' END,
                    CASE WHEN array_length(v_open_titles, 1) = 1 THEN 'it' ELSE 'them' END
                ),
                'open_subtasks', to_jsonb(v_open_titles)
            );
        END IF;
    END IF;

    UPDATE "public"."tasks"
       SET status      = p_to,
           hold_reason = NULLIF(btrim(COALESCE(p_reason, '')), ''),
           updated_by  = p_user_id,
           updated_at  = now()
     WHERE id = p_task_id;

    -- Inverse of the gate: a subtask coming back to life under a completed
    -- parent would recreate the exact state the gate forbids, so reopen the
    -- parent too.
    IF v_task.parent_task_id IS NOT NULL
       AND p_to NOT IN ('completed', 'cancelled') THEN
        SELECT * INTO v_parent FROM "public"."tasks" WHERE id = v_task.parent_task_id;

        IF FOUND AND v_parent.status = 'completed' THEN
            UPDATE "public"."tasks"
               SET status     = 'in_progress',
                   updated_by = p_user_id,
                   updated_at = now()
             WHERE id = v_task.parent_task_id;
            v_reopened := true;
        END IF;
    END IF;

    SELECT * INTO v_task FROM "public"."tasks" WHERE id = p_task_id;

    RETURN jsonb_build_object(
        'success', true,
        'status', v_task.status,
        'started_at', v_task.started_at,
        'first_started_at', v_task.first_started_at,
        'completed_at', v_task.completed_at,
        'first_completed_at', v_task.first_completed_at,
        'completion_count', v_task.completion_count,
        'total_active_seconds', v_task.total_active_seconds,
        'total_held_seconds', v_task.total_held_seconds,
        'parent_reopened', v_reopened
    );
END;
$$;

COMMENT ON FUNCTION "public"."task_transition"("uuid", "uuid", "public"."task_status", "text") IS 'Validated task status change. Blocks completing a parent with open subtasks, and reopens a completed parent when one of its subtasks is reopened.';

-- ---------------------------------------------------------------------
-- 4. View: expose rework and the original completion
-- ---------------------------------------------------------------------

-- DROP then CREATE, not CREATE OR REPLACE. The view selects t.*, so adding
-- columns to tasks shifts every computed column along and Postgres rejects
-- the replace with "cannot change name of view column". Nothing depends on
-- this view except application queries, so dropping it is safe.
DROP VIEW IF EXISTS "public"."tasks_with_timing";

CREATE VIEW "public"."tasks_with_timing" WITH ("security_invoker" = 'true') AS
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

    (SELECT COUNT(*) FROM "public"."task_status_history" h
      WHERE h.task_id = t.id AND h.to_status = 'in_progress')::integer AS "start_count",

    GREATEST(0, (SELECT COUNT(*) FROM "public"."task_status_history" h
                  WHERE h.task_id = t.id AND h.to_status = 'in_progress') - 1)::integer AS "resume_count",

    -- Stable across reopens, unlike lead_time_seconds.
    CASE WHEN t.first_completed_at IS NOT NULL
         THEN (EXTRACT(EPOCH FROM (t.first_completed_at - t.created_at)))::bigint END AS "original_lead_time_seconds",

    (t.completion_count > 1) AS "is_rework",

    -- Subtasks that would block this task from completing.
    (SELECT COUNT(*) FROM "public"."tasks" st
      WHERE st.parent_task_id = t.id
        AND st.status NOT IN ('completed', 'cancelled'))::integer AS "open_subtask_count"
FROM "public"."tasks" t;

COMMENT ON VIEW "public"."tasks_with_timing" IS 'Tasks plus live timing. lead/cycle_time reflect the CURRENT completion and go NULL on reopen; original_lead_time_seconds is stable. is_rework means completed more than once. open_subtask_count is what blocks completion.';

GRANT ALL ON TABLE "public"."tasks_with_timing" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks_with_timing" TO "service_role";
REVOKE ALL ON TABLE "public"."tasks_with_timing" FROM "anon";
