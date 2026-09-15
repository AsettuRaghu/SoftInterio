-- kick_off_project(): the Confirm at the bottom of the kick-off checklist.
--
-- Separate from 20260915140000 because it names enum values that migration
-- adds, and Postgres will not use a new enum value inside the transaction
-- that added it.
--
-- It checks first and writes nothing unless everything is in place - the
-- same shape as the lead's won transition. The caller shows the `missing`
-- list beside the checklist; the API never reaches this with an incomplete
-- checklist in normal use, so the function is the guard, not the UI.
--
-- On success, in one transaction:
--   * baseline v1 - every task of the run, with its planned dates, hours and
--     owner as they stand right now;
--   * committed_* - the dates Sales promised, copied from expected_* so they
--     survive later edits; expected_* then become the agreed plan's span;
--   * status -> in_progress, kicked_off_at/by;
--   * two timeline entries: kicked off (with the PM's note) and plan agreed.

CREATE OR REPLACE FUNCTION "public"."kick_off_project"(
  "p_project_id" uuid,
  "p_user_id"    uuid,
  "p_note"       text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project     public.projects%ROWTYPE;
  v_run_id      uuid;
  v_missing     text[] := '{}';
  v_unowned     text[];
  v_undated     text[];
  v_asks        text[];
  v_baseline_id uuid;
  v_stages      integer;
  v_steps       integer;
  v_start       date;
  v_end         date;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Project not found');
  END IF;
  IF v_project.kicked_off_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'This project has already been kicked off');
  END IF;
  IF v_project.status <> 'new' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only a new project can be kicked off');
  END IF;

  -- 1. Handover reviewed.
  IF v_project.handover_reviewed_at IS NULL THEN
    v_missing := array_append(v_missing, 'handover_review');
  END IF;

  -- 2. A playbook is running.
  SELECT id INTO v_run_id
    FROM public.procedure_runs
   WHERE related_type = 'project' AND related_id = p_project_id AND status = 'active'
   ORDER BY started_at DESC LIMIT 1;
  IF v_run_id IS NULL THEN
    v_missing := array_append(v_missing, 'playbook');
  ELSE
    -- 3. Every stage has an owner and dates.
    SELECT array_agg(title ORDER BY created_at) INTO v_unowned
      FROM public.tasks
     WHERE procedure_run_id = v_run_id AND parent_task_id IS NULL AND assigned_to IS NULL;
    IF v_unowned IS NOT NULL THEN
      v_missing := array_append(v_missing, 'stage_owners');
    END IF;

    SELECT array_agg(title ORDER BY created_at) INTO v_undated
      FROM public.tasks
     WHERE procedure_run_id = v_run_id AND parent_task_id IS NULL
       AND (start_date IS NULL OR due_date IS NULL);
    IF v_undated IS NOT NULL THEN
      v_missing := array_append(v_missing, 'stage_dates');
    END IF;
  END IF;

  -- 4. Every open ask has an expected date.
  SELECT array_agg(description ORDER BY raised_at) INTO v_asks
    FROM public.project_dependencies
   WHERE project_id = p_project_id AND resolved_at IS NULL AND expected_by IS NULL;
  IF v_asks IS NOT NULL THEN
    v_missing := array_append(v_missing, 'ask_dates');
  END IF;

  -- 5. A note.
  IF p_note IS NULL OR btrim(p_note) = '' THEN
    v_missing := array_append(v_missing, 'note');
  END IF;

  IF array_length(v_missing, 1) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'missing', to_jsonb(v_missing),
      'unowned_stages', to_jsonb(COALESCE(v_unowned, '{}')),
      'undated_stages', to_jsonb(COALESCE(v_undated, '{}')),
      'undated_asks',   to_jsonb(COALESCE(v_asks, '{}'))
    );
  END IF;

  -- Baseline v1: the plan as it stands.
  INSERT INTO public.plan_baselines (project_id, run_id, version, set_by)
  VALUES (p_project_id, v_run_id, 1, p_user_id)
  RETURNING id INTO v_baseline_id;

  INSERT INTO public.plan_baseline_tasks (baseline_id, task_id, start_date, due_date, estimated_hours, assigned_to)
  SELECT v_baseline_id, id, start_date, due_date, estimated_hours, assigned_to
    FROM public.tasks
   WHERE procedure_run_id = v_run_id;

  SELECT COUNT(*) FILTER (WHERE parent_task_id IS NULL),
         COUNT(*) FILTER (WHERE parent_task_id IS NOT NULL),
         MIN(start_date), MAX(due_date)
    INTO v_stages, v_steps, v_start, v_end
    FROM public.tasks
   WHERE procedure_run_id = v_run_id;

  UPDATE public.projects
     SET status               = 'in_progress',
         committed_start_date = COALESCE(committed_start_date, expected_start_date),
         committed_end_date   = COALESCE(committed_end_date, expected_end_date),
         expected_start_date  = COALESCE(v_start, expected_start_date),
         expected_end_date    = COALESCE(v_end, expected_end_date),
         kicked_off_at        = now(),
         kicked_off_by        = p_user_id,
         updated_at           = now()
   WHERE id = p_project_id;

  INSERT INTO public.project_activities (project_id, activity_type, title, description, created_by)
  VALUES
    (p_project_id, 'project_kicked_off', 'Kicked off', btrim(p_note), p_user_id),
    (p_project_id, 'plan_agreed',
     'Plan agreed (v1)',
     format('%s stage(s), %s step(s). %s to %s.',
            v_stages, v_steps,
            to_char(v_start, 'DD Mon YYYY'), to_char(v_end, 'DD Mon YYYY')),
     p_user_id);

  RETURN jsonb_build_object('success', true, 'baseline_id', v_baseline_id, 'version', 1);
END;
$$;

COMMENT ON FUNCTION "public"."kick_off_project"(uuid, uuid, text) IS
  'Confirms the kick-off checklist: refuses with a missing[] list, or records baseline v1, keeps the sales-committed dates, moves the project to in_progress and writes the timeline - atomically.';
