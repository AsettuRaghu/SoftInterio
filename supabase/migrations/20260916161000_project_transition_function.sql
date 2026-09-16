-- project_transition(): see 20260916160000 for the rules. Separate file
-- because it uses enum values that migration adds.

CREATE OR REPLACE FUNCTION "public"."project_transition"(
  "p_project_id"          uuid,
  "p_user_id"             uuid,
  "p_to"                  text,
  "p_note"                text,
  "p_hold_owner"          text DEFAULT NULL,
  "p_hold_reason_code"    text DEFAULT NULL,
  "p_hold_expected_until" date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_p        public.projects%ROWTYPE;
  v_run      public.procedure_runs%ROWTYPE;
  v_open     text[];
  v_owed     text[];
  v_handover text;
  v_days     integer;
  v_title    text;
  v_desc     text;
  v_step     RECORD;
BEGIN
  SELECT * INTO v_p FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Project not found');
  END IF;
  IF p_note IS NULL OR btrim(p_note) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Say why - the note is what the timeline keeps.', 'reason', 'note_required');
  END IF;
  IF v_p.status = p_to THEN
    RETURN jsonb_build_object('success', false, 'error', format('This project is already %s', replace(p_to, '_', ' ')));
  END IF;

  -- The allowed moves.
  IF NOT (
       (v_p.status = 'new'         AND p_to = 'cancelled')
    OR (v_p.status = 'in_progress' AND p_to IN ('on_hold', 'completed', 'cancelled'))
    OR (v_p.status = 'on_hold'     AND p_to IN ('in_progress', 'cancelled'))
    OR (v_p.status = 'completed'   AND p_to = 'in_progress')
    OR (v_p.status = 'cancelled'   AND p_to = 'in_progress')
  ) THEN
    IF v_p.status = 'new' AND p_to = 'in_progress' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Kick off the project from its Plan tab to move it to In Progress.', 'reason', 'kickoff_required');
    END IF;
    IF p_to = 'new' THEN
      RETURN jsonb_build_object('success', false, 'error', 'A project that has been kicked off does not go back to New.', 'reason', 'no_way_back');
    END IF;
    RETURN jsonb_build_object('success', false,
      'error', format('A project that is %s cannot be moved to %s.', replace(v_p.status, '_', ' '), replace(p_to, '_', ' ')));
  END IF;

  SELECT * INTO v_run FROM public.procedure_runs
   WHERE related_type = 'project' AND related_id = p_project_id AND status IN ('active', 'completed')
   ORDER BY started_at DESC LIMIT 1;

  -- ------------------------------------------------------------- on hold
  IF p_to = 'on_hold' THEN
    IF p_hold_owner IS NULL OR p_hold_owner NOT IN ('client', 'vendor', 'internal', 'third_party') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Say who we are waiting on.', 'reason', 'hold_owner_required');
    END IF;
    IF p_hold_reason_code IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Say why.', 'reason', 'hold_reason_required');
    END IF;

    -- Running steps stop with the project, on the same hold.
    IF v_run.id IS NOT NULL AND v_run.status = 'active' THEN
      FOR v_step IN SELECT id FROM public.tasks WHERE procedure_run_id = v_run.id AND status = 'in_progress' LOOP
        PERFORM public.task_transition(v_step.id, p_user_id, 'on_hold', p_note, p_hold_owner, p_hold_reason_code, p_hold_expected_until, NULL);
      END LOOP;
    END IF;

    UPDATE public.projects
       SET status = 'on_hold', hold_owner = p_hold_owner, hold_reason_code = p_hold_reason_code,
           hold_expected_until = p_hold_expected_until, held_at = now(), updated_at = now()
     WHERE id = p_project_id;

    v_title := format('On hold - waiting on %s', CASE p_hold_owner WHEN 'internal' THEN 'us' WHEN 'third_party' THEN 'someone else' ELSE 'the ' || p_hold_owner END);
    v_desc  := format('%s%s. %s', p_hold_reason_code,
                      CASE WHEN p_hold_expected_until IS NOT NULL THEN ' - expected until ' || to_char(p_hold_expected_until, 'DD Mon YYYY') ELSE '' END,
                      btrim(p_note));
    INSERT INTO public.project_activities (project_id, activity_type, title, description, created_by)
    VALUES (p_project_id, 'project_held', v_title, v_desc, p_user_id);

  -- ------------------------------------------------------------- resume
  ELSIF v_p.status = 'on_hold' AND p_to = 'in_progress' THEN
    v_days := GREATEST(0, (CURRENT_DATE - COALESCE(v_p.held_at::date, CURRENT_DATE)));
    UPDATE public.projects
       SET status = 'in_progress', hold_owner = NULL, hold_reason_code = NULL, hold_expected_until = NULL, held_at = NULL, updated_at = now()
     WHERE id = p_project_id;
    INSERT INTO public.project_activities (project_id, activity_type, title, description, created_by)
    VALUES (p_project_id, 'project_resumed',
            format('Resumed after %s day(s) on hold', v_days),
            format('Waited on %s (%s). %s', COALESCE(v_p.hold_owner, 'nobody named'), COALESCE(v_p.hold_reason_code, '-'), btrim(p_note)),
            p_user_id);
    -- Steps are resumed one by one by whoever picks them up.

  -- ------------------------------------------------------------- complete
  ELSIF p_to = 'completed' THEN
    IF v_run.id IS NOT NULL AND v_run.status = 'active' THEN
      SELECT array_agg(title ORDER BY created_at) INTO v_open
        FROM public.tasks WHERE procedure_run_id = v_run.id AND status NOT IN ('completed', 'skipped', 'cancelled');
      IF v_open IS NOT NULL THEN
        RETURN jsonb_build_object('success', false,
          'error', format('%s step(s) still open: %s', array_length(v_open, 1), array_to_string(v_open[1:5], ', ')),
          'reason', 'project_not_clear', 'open_steps', to_jsonb(v_open));
      END IF;

      -- The handover milestone, where the playbook names one, must be done.
      SELECT t.title INTO v_handover
        FROM public.tasks t JOIN public.procedure_step_definitions s ON s.id = t.procedure_step_id
       WHERE t.procedure_run_id = v_run.id AND s.milestone_role = 'handover' AND t.status <> 'completed'
       LIMIT 1;
      IF v_handover IS NOT NULL THEN
        RETURN jsonb_build_object('success', false,
          'error', format('"%s" is the handover milestone and is not complete.', v_handover),
          'reason', 'handover_not_signed');
      END IF;
    END IF;

    SELECT array_agg(description ORDER BY raised_at) INTO v_owed
      FROM public.project_dependencies WHERE project_id = p_project_id AND resolved_at IS NULL;
    IF v_owed IS NOT NULL THEN
      RETURN jsonb_build_object('success', false,
        'error', format('Still waiting on others for: %s', array_to_string(v_owed[1:5], ', ')),
        'reason', 'asks_open', 'open_asks', to_jsonb(v_owed));
    END IF;

    UPDATE public.projects
       SET status = 'completed', completed_at = now(), actual_end_date = COALESCE(actual_end_date, CURRENT_DATE), updated_at = now()
     WHERE id = p_project_id;
    IF v_run.id IS NOT NULL AND v_run.status = 'active' THEN
      UPDATE public.procedure_runs SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = v_run.id;
    END IF;
    INSERT INTO public.project_activities (project_id, activity_type, title, description, created_by)
    VALUES (p_project_id, 'project_completed', 'Project completed', btrim(p_note), p_user_id);

  -- ------------------------------------------------------------- cancel
  ELSIF p_to = 'cancelled' THEN
    IF v_run.id IS NOT NULL AND v_run.status = 'active' THEN
      FOR v_step IN SELECT id FROM public.tasks
                     WHERE procedure_run_id = v_run.id AND parent_task_id IS NULL
                       AND status NOT IN ('completed', 'skipped', 'cancelled') LOOP
        PERFORM public.task_transition(v_step.id, p_user_id, 'cancelled', p_note);
      END LOOP;
      UPDATE public.procedure_runs SET status = 'cancelled', cancelled_at = now(), cancel_reason = btrim(p_note), updated_at = now() WHERE id = v_run.id;
    END IF;
    UPDATE public.projects
       SET status = 'cancelled', cancelled_at = now(), hold_owner = NULL, hold_reason_code = NULL, hold_expected_until = NULL, held_at = NULL, updated_at = now()
     WHERE id = p_project_id;
    INSERT INTO public.project_activities (project_id, activity_type, title, description, created_by)
    VALUES (p_project_id, 'project_cancelled', 'Project cancelled', btrim(p_note), p_user_id);

  -- ------------------------------------------------------------- reopen
  ELSIF p_to = 'in_progress' AND v_p.status IN ('completed', 'cancelled') THEN
    UPDATE public.projects
       SET status = 'in_progress', completed_at = NULL, cancelled_at = NULL, actual_end_date = NULL, updated_at = now()
     WHERE id = p_project_id;
    -- The run comes back with the project. Its steps keep their statuses;
    -- reopening the handover step is then a task-level act.
    IF v_run.id IS NOT NULL AND v_run.status = 'completed' THEN
      UPDATE public.procedure_runs SET status = 'active', completed_at = NULL, updated_at = now() WHERE id = v_run.id;
    END IF;
    IF v_p.status = 'cancelled' THEN
      SELECT * INTO v_run FROM public.procedure_runs
       WHERE related_type = 'project' AND related_id = p_project_id AND status = 'cancelled'
       ORDER BY cancelled_at DESC LIMIT 1;
      IF FOUND THEN
        UPDATE public.procedure_runs SET status = 'active', cancelled_at = NULL, cancel_reason = NULL, updated_at = now() WHERE id = v_run.id;
      END IF;
    END IF;
    INSERT INTO public.project_activities (project_id, activity_type, title, description, created_by)
    VALUES (p_project_id, 'project_reopened', format('Reopened (was %s)', v_p.status), btrim(p_note), p_user_id);
  END IF;

  RETURN jsonb_build_object('success', true, 'status', p_to);
END;
$$;

COMMENT ON FUNCTION "public"."project_transition"(uuid, uuid, text, text, text, text, date) IS
  'The one way a project''s status changes after kick-off: rules, cascades to the run and its steps, and a timeline entry, in one transaction.';
