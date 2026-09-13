-- Say whether it is waiting for something to START or to FINISH.
--
-- can_start_task phrased every blocker as "Earlier step not finished", which
-- was the only kind there was. Now that a link can wait for a predecessor
-- merely to begin, that wording is wrong half the time: a step waiting for its
-- phase to start was told the phase was "not finished", which is true,
-- unhelpful, and suggests a wait that will never end.
--
-- The message now names the wait, so the reason a button is disabled reads as
-- an instruction: "Waiting for Project Planning Kickstart to start" tells
-- somebody exactly what to go and do.

CREATE OR REPLACE FUNCTION "public"."can_start_task"("p_task_id" "uuid")
RETURNS "jsonb"
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_task    RECORD;
    v_prev    TEXT[];
    v_parts   TEXT[];
    v_needs_start TEXT[];
    v_needs_finish TEXT[];
BEGIN
    v_prev := "public"."task_blocking_predecessors"(p_task_id);
    IF v_prev IS NULL OR array_length(v_prev, 1) IS NULL THEN
        RETURN jsonb_build_object('can_start', true);
    END IF;

    SELECT * INTO v_task FROM "public"."tasks" WHERE id = p_task_id;

    -- Split the blockers by what is actually being waited on. Named links know
    -- their wait_type; sibling ordering is always finish-to-start.
    SELECT array_agg(DISTINCT t.title)
      INTO v_needs_start
      FROM "public"."procedure_step_dependencies" dep
      JOIN "public"."tasks" t
        ON t.procedure_step_id = dep.depends_on_step_id
       AND t.procedure_run_id = v_task.procedure_run_id
     WHERE dep.step_id = v_task.procedure_step_id
       AND dep.dependency_type = 'hard'
       AND dep.wait_type = 'after_start'
       AND t.status = 'todo'
       AND t.title = ANY(v_prev);

    SELECT array_agg(DISTINCT title)
      INTO v_needs_finish
      FROM unnest(v_prev) AS title
     WHERE title <> ALL(COALESCE(v_needs_start, ARRAY[]::text[]));

    v_parts := ARRAY[]::text[];

    IF v_needs_start IS NOT NULL AND array_length(v_needs_start, 1) > 0 THEN
        v_parts := v_parts || format('%s to start',
            array_to_string(v_needs_start, ', '));
    END IF;

    IF v_needs_finish IS NOT NULL AND array_length(v_needs_finish, 1) > 0 THEN
        v_parts := v_parts || format('%s to finish',
            array_to_string(v_needs_finish, ', '));
    END IF;

    RETURN jsonb_build_object(
        'can_start', false,
        'reason', 'Waiting for ' || array_to_string(v_parts, ', and '),
        'blocking_predecessors', to_jsonb(v_prev)
    );
END;
$$;

COMMENT ON FUNCTION "public"."can_start_task"("p_task_id" "uuid") IS
  'Whether a task may move to in_progress, with a reason that names whether it waits for a predecessor to start or to finish.';
