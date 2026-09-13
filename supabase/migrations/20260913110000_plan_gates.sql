-- What the Plan tab is allowed to offer, for every row at once.
--
-- The quick actions were shown for sub-phases only, always enabled, and with
-- bare tooltips reading "Start" and "Skip". So a user pressed Start on a step
-- whose predecessor had not finished, the server refused, and the tooltip had
-- said nothing about why. Phases had no actions at all - the row that decides
-- when a stage begins could not be started from the screen that shows it.
--
-- The rules already exist and are already enforced: can_start_task,
-- can_complete_task, and can_skip/skip_requires_reason on the step definition.
-- What was missing is a way for the UI to ASK before drawing a button. Asking
-- per task would be 33 round trips on this project alone, so this answers for
-- the whole plan in one.
--
-- Deliberately a view of the same functions the transition uses, not a second
-- copy of the rules. A screen that disagrees with the server about what is
-- allowed is worse than one that offers nothing.

CREATE OR REPLACE FUNCTION "public"."project_plan_gates"("p_project_id" uuid)
RETURNS TABLE (
  task_id            uuid,
  status             text,
  is_phase           boolean,
  can_start          boolean,
  start_reason       text,
  can_complete       boolean,
  complete_reason    text,
  can_skip           boolean,
  skip_reason        text,
  skip_needs_reason  boolean,
  can_hold           boolean,
  can_resume         boolean
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  r        record;
  v_start  jsonb;
  v_done   jsonb;
  v_step   record;
BEGIN
  FOR r IN
    SELECT t.id, t.status::text AS status, t.parent_task_id, t.procedure_step_id
      FROM public.tasks t
      JOIN public.procedure_runs pr ON pr.id = t.procedure_run_id
     WHERE pr.related_type = 'project'
       AND pr.related_id = p_project_id
       AND pr.status = 'active'
  LOOP
    task_id  := r.id;
    status   := r.status;
    is_phase := r.parent_task_id IS NULL;

    -- Start: only meaningful from todo, and the order gate decides.
    IF r.status = 'todo' THEN
      v_start      := public.can_start_task(r.id);
      can_start    := (v_start->>'can_start')::boolean;
      start_reason := v_start->>'reason';
    ELSE
      can_start    := false;
      start_reason := CASE
        WHEN r.status IN ('completed', 'skipped', 'cancelled') THEN 'Already finished with'
        ELSE 'Already under way'
      END;
    END IF;

    -- Complete: from anything still open. can_complete_task covers open
    -- subtasks, unmet requirements and unfinished predecessors, which is why a
    -- phase cannot be completed while its steps are open.
    IF r.status IN ('todo', 'in_progress', 'on_hold', 'blocked') THEN
      v_done          := public.can_complete_task(r.id);
      can_complete    := (v_done->>'can_complete')::boolean;
      complete_reason := v_done->>'reason';
    ELSE
      can_complete    := false;
      complete_reason := 'Already finished with';
    END IF;

    -- Skip: playbook steps only, and only where the author allowed it.
    can_skip          := false;
    skip_needs_reason := false;
    skip_reason       := NULL;

    IF r.procedure_step_id IS NULL THEN
      skip_reason := 'Only playbook steps can be skipped';
    ELSIF r.status IN ('completed', 'skipped', 'cancelled') THEN
      skip_reason := 'Already finished with';
    ELSE
      SELECT * INTO v_step FROM public.procedure_step_definitions
       WHERE id = r.procedure_step_id;
      IF FOUND AND v_step.can_skip THEN
        can_skip          := true;
        skip_needs_reason := COALESCE(v_step.skip_requires_reason, true);
      ELSE
        skip_reason := 'The playbook does not allow this step to be skipped';
      END IF;
    END IF;

    can_hold   := r.status = 'in_progress';
    can_resume := r.status IN ('on_hold', 'blocked');

    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION "public"."project_plan_gates"(uuid) IS
  'Per-task gates for a project active playbook run, so the Plan tab can draw only the actions the transition would accept. A view of can_start_task / can_complete_task, never a second copy of the rules.';
