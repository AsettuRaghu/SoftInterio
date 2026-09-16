-- The rest of the task rules.
--
--  11. Complete needs an owner, like Start does.
--  12. A stage put on hold takes its running steps with it (same hold: who,
--      why, until); a stage cancelled takes its open steps with it. Resuming
--      a stage does not resume its steps.
--  13. Starting a step starts its stage, through the stage's own rules (an
--      owner, its predecessors) - and says so if the stage cannot start.
--  14. Skipped and cancelled tasks can be reopened; they were dead ends.
--
-- task_transition otherwise as 20260916110000. The remaining rules of the
-- set (a finished task is not edited except to reopen it; due on or after
-- start; hours not negative; a running task is not unassigned) live in
-- PATCH /api/tasks/[id], where the edits arrive.

CREATE OR REPLACE FUNCTION "public"."task_transition"(
    "p_task_id" "uuid",
    "p_user_id" "uuid",
    "p_to" "public"."task_status",
    "p_reason" "text" DEFAULT NULL::"text",
    "p_hold_owner" "text" DEFAULT NULL::"text",
    "p_hold_reason_code" "text" DEFAULT NULL::"text",
    "p_hold_expected_until" "date" DEFAULT NULL::"date",
    "p_hold_counterpart" "text" DEFAULT NULL::"text"
) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_child    RECORD;
    v_task     RECORD;
    v_step     RECORD;
    v_gate     jsonb;
    v_parent   RECORD;
    v_reopened boolean := false;
    v_allowed  boolean;
    v_now      timestamptz := now();
BEGIN
    SELECT * INTO v_task FROM "public"."tasks" WHERE id = p_task_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Task not found');
    END IF;

    -- Starting needs an owner. Not enforced by can_start_task alone: that is
    -- what the UI asks, and this is what actually refuses.
    IF p_to = 'in_progress' AND v_task.assigned_to IS NULL THEN
        RETURN jsonb_build_object('success', false,
            'error', 'Assign this task to someone before starting it.',
            'reason', 'unassigned');
    END IF;

    IF p_to = 'completed' AND v_task.assigned_to IS NULL THEN
        RETURN jsonb_build_object('success', false,
            'error', 'Assign this task to someone before completing it.',
            'reason', 'unassigned');
    END IF;

    IF v_task.status = p_to THEN
        RETURN jsonb_build_object('success', false,
            'error', format('This task is already %s', p_to));
    END IF;

    v_allowed := CASE
        WHEN p_to = 'in_progress' THEN v_task.status IN ('todo','on_hold','blocked','completed','skipped','cancelled')
        WHEN p_to = 'on_hold'     THEN v_task.status IN ('in_progress','blocked')
        WHEN p_to = 'blocked'     THEN v_task.status IN ('todo','in_progress','on_hold')
        WHEN p_to = 'completed'   THEN v_task.status IN ('todo','in_progress','on_hold','blocked')
        WHEN p_to = 'skipped'     THEN v_task.status IN ('todo','in_progress','on_hold','blocked')
        WHEN p_to = 'cancelled'   THEN v_task.status <> 'completed'
        WHEN p_to = 'todo'        THEN v_task.status IN ('in_progress','on_hold','blocked','skipped','cancelled')
        ELSE false
    END;

    IF NOT v_allowed THEN
        RETURN jsonb_build_object('success', false,
            'error', format('Cannot move a task from %s to %s', v_task.status, p_to),
            'from', v_task.status, 'to', p_to);
    END IF;

    IF p_to = 'in_progress' AND v_task.status = 'todo' THEN
        v_gate := "public"."can_start_task"(p_task_id);
        IF NOT (v_gate->>'can_start')::boolean THEN
            RETURN jsonb_build_object('success', false,
                'error', v_gate->>'reason',
                'blocking_predecessors', v_gate->'blocking_predecessors');
        END IF;

        -- A step under way means its stage is under way. Start the stage
        -- first (through the same rules - it needs an owner and its own
        -- predecessors), and say so if that cannot happen.
        IF v_task.parent_task_id IS NOT NULL THEN
            SELECT * INTO v_parent FROM "public"."tasks" WHERE id = v_task.parent_task_id;
            IF FOUND AND v_parent.status = 'todo' THEN
                v_gate := "public"."task_transition"(v_parent.id, p_user_id, 'in_progress');
                IF NOT (v_gate->>'success')::boolean THEN
                    RETURN jsonb_build_object('success', false,
                        'error', format('Its stage "%s" cannot start yet: %s', v_parent.title, v_gate->>'error'));
                END IF;
            END IF;
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
            RETURN jsonb_build_object('success', false,
                'error', v_gate->>'reason',
                'open_subtasks', v_gate->'open_subtasks',
                'unmet_requirements', v_gate->'unmet_requirements',
                'blocking_predecessors', v_gate->'blocking_predecessors');
        END IF;
    END IF;

    UPDATE "public"."tasks"
       SET status      = p_to,
           hold_reason = CASE WHEN p_to IN ('on_hold','blocked')
                              THEN NULLIF(btrim(COALESCE(p_reason,'')),'') END,
           -- Who we are waiting on, why, and until when. Recorded here, in
           -- the same UPDATE, so the status-history row written by the
           -- trigger carries them - a second UPDATE would be too late.
           hold_owner          = CASE WHEN p_to IN ('on_hold','blocked') THEN p_hold_owner END,
           hold_reason_code    = CASE WHEN p_to IN ('on_hold','blocked') THEN p_hold_reason_code END,
           hold_expected_until = CASE WHEN p_to IN ('on_hold','blocked') THEN p_hold_expected_until END,
           hold_counterpart    = CASE WHEN p_to IN ('on_hold','blocked') THEN NULLIF(btrim(COALESCE(p_hold_counterpart,'')),'') END,
           skip_reason = CASE WHEN p_to = 'skipped'
                              THEN NULLIF(btrim(COALESCE(p_reason,'')),'') END,
           skipped_at  = CASE WHEN p_to = 'skipped' THEN v_now END,
           skipped_by  = CASE WHEN p_to = 'skipped' THEN p_user_id END,

           -- When work began. Completing something that was never started
           -- stamps the same moment as its end: the work happened, nobody
           -- tracked it, and a zero-length record beats a blank. Never
           -- overwrites a start that was actually recorded.
           started_at = CASE
               WHEN p_to = 'in_progress' THEN v_now
               WHEN p_to = 'completed' AND "tasks".started_at IS NULL THEN v_now
               ELSE "tasks".started_at
           END,
           first_started_at = CASE
               WHEN p_to IN ('in_progress','completed')
                    AND "tasks".first_started_at IS NULL THEN v_now
               ELSE "tasks".first_started_at
           END,

           completed_at = CASE
               WHEN p_to = 'completed' THEN v_now
               WHEN p_to IN ('todo','in_progress','on_hold','blocked') THEN NULL
               ELSE "tasks".completed_at
           END,
           first_completed_at = CASE
               WHEN p_to = 'completed' AND "tasks".first_completed_at IS NULL THEN v_now
               ELSE "tasks".first_completed_at
           END,
           completed_by = CASE
               WHEN p_to = 'completed' THEN p_user_id
               WHEN p_to IN ('todo','in_progress','on_hold','blocked') THEN NULL
               ELSE "tasks".completed_by
           END,
           completion_count = COALESCE("tasks".completion_count, 0)
               + CASE WHEN p_to = 'completed' THEN 1 ELSE 0 END,

           updated_by  = p_user_id,
           updated_at  = v_now
     WHERE id = p_task_id;

    -- A stage put on hold takes its running steps with it, on the same hold;
    -- a stage cancelled takes its open steps with it. Resuming a stage does
    -- NOT resume its steps: people resume the step they pick up.
    IF v_task.parent_task_id IS NULL THEN
        IF p_to = 'on_hold' THEN
            FOR v_child IN SELECT id FROM "public"."tasks"
                            WHERE parent_task_id = p_task_id AND status = 'in_progress' LOOP
                PERFORM "public"."task_transition"(v_child.id, p_user_id, 'on_hold', p_reason,
                                                    p_hold_owner, p_hold_reason_code, p_hold_expected_until, p_hold_counterpart);
            END LOOP;
        ELSIF p_to = 'cancelled' THEN
            FOR v_child IN SELECT id FROM "public"."tasks"
                            WHERE parent_task_id = p_task_id
                              AND status NOT IN ('completed','cancelled','skipped') LOOP
                PERFORM "public"."task_transition"(v_child.id, p_user_id, 'cancelled', p_reason);
            END LOOP;
        END IF;
    END IF;

    IF v_task.parent_task_id IS NOT NULL
       AND p_to NOT IN ('completed', 'cancelled', 'skipped') THEN
        SELECT * INTO v_parent FROM "public"."tasks" WHERE id = v_task.parent_task_id;
        IF FOUND AND v_parent.status = 'completed' THEN
            UPDATE "public"."tasks"
               SET status = 'in_progress',
                   completed_at = NULL,
                   completed_by = NULL,
                   updated_by = p_user_id,
                   updated_at = v_now
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
        'actual_hours', v_task.actual_hours,
        'parent_reopened', v_reopened
    );
END;
$$;
