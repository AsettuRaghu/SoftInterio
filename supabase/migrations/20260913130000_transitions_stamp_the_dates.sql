-- Starting a task records when it started. Completing it records when it ended.
--
-- task_transition set status, hold_reason, skip_reason and the skip stamps, and
-- never touched started_at or completed_at. So pressing Start recorded nothing
-- about when work began and pressing Complete recorded nothing about when it
-- finished - which is why the Plan tab's actual start and end columns read "-"
-- however many times somebody used the buttons, and why the task page appeared
-- to accept a transition and then show no dates.
--
-- The columns were all there: started_at, first_started_at, completed_at,
-- first_completed_at, completion_count, completed_by. Nothing wrote them.
--
-- The distinction between started_at and first_started_at matters because work
-- restarts: a task reopened and started again moves started_at, while
-- first_started_at keeps the date somebody first picked it up, which is what a
-- planned-versus-actual comparison needs. Same for the completion pair, and
-- completion_count counts how many times it was called done - a step completed
-- three times is a process problem worth being able to see.
--
-- start_date is NOT touched. That is the PLAN - what the playbook derived from
-- its hours - and started_at is what happened. Overwriting the plan with the
-- actual is how you lose the ability to tell that something ran late.

CREATE OR REPLACE FUNCTION "public"."task_transition"(
    "p_task_id" "uuid",
    "p_user_id" "uuid",
    "p_to" "public"."task_status",
    "p_reason" "text" DEFAULT NULL::"text"
) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_task     RECORD;
    v_step     RECORD;
    v_gate     jsonb;
    v_parent   RECORD;
    v_reopened boolean := false;
    v_allowed  boolean;
BEGIN
    SELECT * INTO v_task FROM "public"."tasks" WHERE id = p_task_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Task not found');
    END IF;

    IF v_task.status = p_to THEN
        RETURN jsonb_build_object('success', false,
            'error', format('This task is already %s', p_to));
    END IF;

    -- Which moves are legal at all.
    v_allowed := CASE
        WHEN p_to = 'in_progress' THEN v_task.status IN ('todo','on_hold','blocked','completed')
        WHEN p_to = 'on_hold'     THEN v_task.status IN ('in_progress','blocked')
        WHEN p_to = 'blocked'     THEN v_task.status IN ('todo','in_progress','on_hold')
        WHEN p_to = 'completed'   THEN v_task.status IN ('todo','in_progress','on_hold','blocked')
        WHEN p_to = 'skipped'     THEN v_task.status IN ('todo','in_progress','on_hold','blocked')
        WHEN p_to = 'cancelled'   THEN v_task.status <> 'completed'
        WHEN p_to = 'todo'        THEN v_task.status IN ('in_progress','on_hold','blocked')
        ELSE false
    END;

    IF NOT v_allowed THEN
        RETURN jsonb_build_object('success', false,
            'error', format('Cannot move a task from %s to %s', v_task.status, p_to),
            'from', v_task.status, 'to', p_to);
    END IF;

    -- Order gate on the way IN to work. Only from a not-yet-started state:
    -- resuming something already under way must never be blocked, or a task
    -- paused before a predecessor slipped would become unresumable.
    IF p_to = 'in_progress' AND v_task.status = 'todo' THEN
        v_gate := "public"."can_start_task"(p_task_id);
        IF NOT (v_gate->>'can_start')::boolean THEN
            RETURN jsonb_build_object('success', false,
                'error', v_gate->>'reason',
                'blocking_predecessors', v_gate->'blocking_predecessors');
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
           skip_reason = CASE WHEN p_to = 'skipped'
                              THEN NULLIF(btrim(COALESCE(p_reason,'')),'') END,
           skipped_at  = CASE WHEN p_to = 'skipped' THEN now() END,
           skipped_by  = CASE WHEN p_to = 'skipped' THEN p_user_id END,

           -- When work began. Moved every time it restarts; first_started_at
           -- keeps the original, which is what planned-versus-actual needs.
           started_at = CASE
               WHEN p_to = 'in_progress' THEN now()
               ELSE "tasks".started_at
           END,
           first_started_at = CASE
               WHEN p_to = 'in_progress' AND "tasks".first_started_at IS NULL THEN now()
               ELSE "tasks".first_started_at
           END,

           -- When it finished. Cleared on the way back out of completed, so a
           -- reopened task does not keep claiming an end date it no longer has.
           completed_at = CASE
               WHEN p_to = 'completed' THEN now()
               WHEN p_to IN ('todo','in_progress','on_hold','blocked') THEN NULL
               ELSE "tasks".completed_at
           END,
           first_completed_at = CASE
               WHEN p_to = 'completed' AND "tasks".first_completed_at IS NULL THEN now()
               ELSE "tasks".first_completed_at
           END,
           completed_by = CASE
               WHEN p_to = 'completed' THEN p_user_id
               WHEN p_to IN ('todo','in_progress','on_hold','blocked') THEN NULL
               ELSE "tasks".completed_by
           END,
           -- How many times this was called done. A step completed three times
           -- is a process problem worth being able to see.
           completion_count = COALESCE("tasks".completion_count, 0)
               + CASE WHEN p_to = 'completed' THEN 1 ELSE 0 END,

           updated_by  = p_user_id,
           updated_at  = now()
     WHERE id = p_task_id;

    IF v_task.parent_task_id IS NOT NULL
       AND p_to NOT IN ('completed', 'cancelled', 'skipped') THEN
        SELECT * INTO v_parent FROM "public"."tasks" WHERE id = v_task.parent_task_id;
        IF FOUND AND v_parent.status = 'completed' THEN
            UPDATE "public"."tasks"
               SET status = 'in_progress',
                   completed_at = NULL,
                   completed_by = NULL,
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
        'actual_hours', v_task.actual_hours,
        'parent_reopened', v_reopened
    );
END;
$$;

COMMENT ON FUNCTION "public"."task_transition"("p_task_id" "uuid", "p_user_id" "uuid", "p_to" "public"."task_status", "p_reason" "text") IS
  'Validated task status change. Stamps started_at and completed_at (and their first_* originals), clears the end date when a task reopens, counts completions, blocks completing a parent with open subtasks, and reopens a completed parent when a subtask reopens. Never touches start_date, which is the plan.';
