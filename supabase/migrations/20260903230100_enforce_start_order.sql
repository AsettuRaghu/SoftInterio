-- Migration: refuse to start a step whose predecessors are unfinished
-- Created: 2026-09-03
--
-- can_complete_task() already refuses out-of-order COMPLETION. Blocking only
-- that would let someone do the work and be told afterwards, which is the
-- worst of both. The start is the moment to intervene.

CREATE OR REPLACE FUNCTION "public"."task_transition"(
    "p_task_id" "uuid",
    "p_user_id" "uuid",
    "p_to"      "public"."task_status",
    "p_reason"  "text" DEFAULT NULL
) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_task     RECORD;
    v_step     RECORD;
    v_gate     jsonb;
    v_parent   RECORD;
    v_reopened boolean := false;
    v_run_done boolean := false;
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
            'from', v_task.status, 'to', p_to
        );
    END IF;

    -- Order gate on the way IN to work. Only from a not-yet-started state:
    -- resuming something already under way must never be blocked, or a task
    -- paused before a predecessor slipped would become unresumable.
    IF p_to = 'in_progress' AND v_task.status = 'todo' THEN
        v_gate := "public"."can_start_task"(p_task_id);
        IF NOT (v_gate->>'can_start')::boolean THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', v_gate->>'reason',
                'blocking_predecessors', v_gate->'blocking_predecessors'
            );
        END IF;
    END IF;

    IF p_to = 'skipped' THEN
        IF v_task.procedure_step_id IS NULL THEN
            RETURN jsonb_build_object('success', false,
                'error', 'Only procedure steps can be skipped. Cancel the task instead.');
        END IF;

        SELECT * INTO v_step FROM "public"."procedure_step_definitions"
         WHERE id = v_task.procedure_step_id;

        IF NOT FOUND OR NOT v_step.can_skip THEN
            RETURN jsonb_build_object('success', false,
                'error', 'This step cannot be skipped.');
        END IF;

        IF v_step.skip_requires_reason AND COALESCE(btrim(p_reason), '') = '' THEN
            RETURN jsonb_build_object('success', false,
                'error', 'A reason is required to skip this step.');
        END IF;
    END IF;

    IF p_to = 'completed' THEN
        v_gate := "public"."can_complete_task"(p_task_id);
        IF NOT (v_gate->>'can_complete')::boolean THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', v_gate->>'reason',
                'open_subtasks', v_gate->'open_subtasks',
                'unmet_requirements', v_gate->'unmet_requirements',
                'blocking_predecessors', v_gate->'blocking_predecessors'
            );
        END IF;
    END IF;

    UPDATE "public"."tasks"
       SET status      = p_to,
           hold_reason = CASE WHEN p_to IN ('on_hold','blocked')
                              THEN NULLIF(btrim(COALESCE(p_reason,'')),'') END,
           skip_reason = CASE WHEN p_to = 'skipped'
                              THEN NULLIF(btrim(COALESCE(p_reason,'')),'') END,
           skipped_at  = CASE WHEN p_to = 'skipped' THEN now() END,
           skipped_by  = CASE WHEN p_to = 'skipped' THEN p_user_id END,
           updated_by  = p_user_id,
           updated_at  = now()
     WHERE id = p_task_id;

    IF v_task.parent_task_id IS NOT NULL
       AND p_to NOT IN ('completed', 'cancelled', 'skipped') THEN
        SELECT * INTO v_parent FROM "public"."tasks" WHERE id = v_task.parent_task_id;
        IF FOUND AND v_parent.status = 'completed' THEN
            UPDATE "public"."tasks"
               SET status = 'in_progress', updated_by = p_user_id, updated_at = now()
             WHERE id = v_task.parent_task_id;
            v_reopened := true;
        END IF;
    END IF;

    IF v_task.procedure_run_id IS NOT NULL
       AND p_to IN ('completed', 'cancelled', 'skipped') THEN
        IF NOT EXISTS (
            SELECT 1 FROM "public"."tasks"
             WHERE procedure_run_id = v_task.procedure_run_id
               AND status NOT IN ('completed', 'cancelled', 'skipped')
        ) THEN
            UPDATE "public"."procedure_runs"
               SET status = 'completed', completed_at = now(), updated_at = now()
             WHERE id = v_task.procedure_run_id AND status = 'active';
            v_run_done := true;
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
        'parent_reopened', v_reopened,
        'run_completed', v_run_done
    );
END;
$$;
