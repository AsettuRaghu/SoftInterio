-- Migration: Procedures engine functions
-- Created: 2026-09-03
--
-- can_complete_task() generalises can_complete_sub_phase(). The subtask gate
-- previously lived inline in task_transition(); it moves here so there is ONE
-- place that answers "may this task be completed?" - procedures, subtasks and
-- eventually project phases all consult the same function.

-- ---------------------------------------------------------------------
-- 1. The gate
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."can_complete_task"("p_task_id" "uuid")
RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_task     RECORD;
    v_open     TEXT[];
    v_unmet    TEXT[];
BEGIN
    SELECT * INTO v_task FROM "public"."tasks" WHERE id = p_task_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('can_complete', false, 'reason', 'Task not found');
    END IF;

    -- Open subtasks. Cancelled and skipped children are settled: both were
    -- deliberate decisions, and blocking on them forever would push people to
    -- fake-complete work, which is worse data than an honest skip.
    SELECT array_agg(title ORDER BY created_at) INTO v_open
      FROM "public"."tasks"
     WHERE parent_task_id = p_task_id
       AND status NOT IN ('completed', 'cancelled', 'skipped');

    IF v_open IS NOT NULL AND array_length(v_open, 1) > 0 THEN
        RETURN jsonb_build_object(
            'can_complete', false,
            'reason', format(
                '%s subtask%s still open. Complete or cancel %s first.',
                array_length(v_open, 1),
                CASE WHEN array_length(v_open, 1) = 1 THEN '' ELSE 's' END,
                CASE WHEN array_length(v_open, 1) = 1 THEN 'it' ELSE 'them' END
            ),
            'open_subtasks', to_jsonb(v_open)
        );
    END IF;

    -- Procedure gates: uploads, checklists, forms, approvals.
    SELECT array_agg(COALESCE(requirement_label, requirement_key)) INTO v_unmet
      FROM "public"."task_completion_requirements"
     WHERE task_id = p_task_id
       AND is_required = true
       AND is_satisfied = false;

    IF v_unmet IS NOT NULL AND array_length(v_unmet, 1) > 0 THEN
        RETURN jsonb_build_object(
            'can_complete', false,
            'reason', format('Not yet done: %s', array_to_string(v_unmet, ', ')),
            'unmet_requirements', to_jsonb(v_unmet)
        );
    END IF;

    RETURN jsonb_build_object('can_complete', true);
END;
$$;

ALTER FUNCTION "public"."can_complete_task"("uuid") OWNER TO "postgres";
COMMENT ON FUNCTION "public"."can_complete_task"("uuid") IS 'Single source of truth for whether a task may complete: open subtasks plus unmet procedure requirements.';

-- ---------------------------------------------------------------------
-- 2. Re-point task_transition() at the shared gate, and support skipping
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

    -- Skipping is only permitted where the step definition allows it. A plain
    -- task (no procedure step) is never skippable - use cancel.
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
                'unmet_requirements', v_gate->'unmet_requirements'
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

    -- Reopening a child under a settled parent would recreate the exact state
    -- the gate forbids.
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

    -- A run finishes when nothing required is left outstanding.
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

-- ---------------------------------------------------------------------
-- 3. Allowed transitions gain 'skipped'
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
        WHEN 'todo'        THEN p_to IN ('in_progress', 'completed', 'cancelled', 'skipped')
        WHEN 'in_progress' THEN p_to IN ('on_hold', 'blocked', 'completed', 'cancelled', 'skipped')
        WHEN 'on_hold'     THEN p_to IN ('in_progress', 'blocked', 'completed', 'cancelled', 'skipped')
        WHEN 'blocked'     THEN p_to IN ('in_progress', 'on_hold', 'completed', 'cancelled', 'skipped')
        WHEN 'completed'   THEN p_to IN ('in_progress', 'todo')
        WHEN 'cancelled'   THEN p_to IN ('todo')
        WHEN 'skipped'     THEN p_to IN ('todo', 'in_progress')  -- un-skip
        ELSE false
    END;
END;
$$;
