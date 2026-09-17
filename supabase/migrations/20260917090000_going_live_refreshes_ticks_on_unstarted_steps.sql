-- Going live refreshes the ticks on steps nobody has started.
--
-- commit_playbook_version() repointed a running plan's tasks at the new
-- version's steps and took their title and hours - and left their gates as
-- they were, because the gates had been written when the run started. So a
-- checklist added to a step in v10 reached no project already on v9: the
-- step said the new title and offered the old ticks. And a step that was
-- NEW in the version arrived with no gates at all - commit inserted the
-- task and never called create_step_requirements, which start_procedure_run
-- and the sync both do.
--
-- Now, per run: a repointed step whose status is still todo has its
-- requirements replaced from the step it now points at; a step under way,
-- held or finished keeps the ticks it was given, for the same reason a
-- removed step is only cancelled while it is todo - the record of work begun
-- belongs to the work. A new step's task gets its gates. The result reports
-- ticks_refreshed.

CREATE OR REPLACE FUNCTION "public"."commit_playbook_version"(
  "p_definition_id" uuid,
  "p_user_id" uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_draft     public.procedure_definitions%ROWTYPE;
  v_live_id   uuid;
  v_runs      integer := 0;
  v_repointed integer := 0;
  v_added     integer := 0;
  v_cancelled integer := 0;
  v_n         integer;
  v_steps     integer;
  v_parent    uuid;
  v_ticks     integer := 0;
  v_new_id    uuid;
  r_run       record;
  r_step      record;
  r_task      record;
BEGIN
  SELECT * INTO v_draft FROM public.procedure_definitions WHERE id = p_definition_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Playbook not found');
  END IF;

  IF v_draft.status <> 'draft' THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Only a draft can be put into service.');
  END IF;

  SELECT count(*) INTO v_steps
    FROM public.procedure_step_definitions
   WHERE definition_id = p_definition_id AND is_current;

  IF v_steps = 0 THEN
    RETURN jsonb_build_object('success', false,
      'error', 'This playbook has no steps yet.');
  END IF;

  SELECT id INTO v_live_id
    FROM public.procedure_definitions
   WHERE root_id = v_draft.root_id AND status = 'committed'
   LIMIT 1;

  IF v_live_id IS NOT NULL THEN
    UPDATE public.procedure_definitions
       SET status = 'superseded', auto_start = false, is_active = false,
           updated_by = p_user_id, updated_at = now()
     WHERE id = v_live_id;
  END IF;

  UPDATE public.procedure_definitions
     SET status = 'committed', is_active = true,
         auto_start = COALESCE(
           (SELECT auto_start FROM public.procedure_definitions WHERE id = v_live_id), false),
         updated_by = p_user_id, updated_at = now()
   WHERE id = p_definition_id;

  FOR r_run IN
    SELECT r.* FROM public.procedure_runs r
     JOIN public.procedure_definitions d ON d.id = r.definition_id
    WHERE d.root_id = v_draft.root_id AND r.status = 'active'
  LOOP
    v_runs := v_runs + 1;

    UPDATE public.tasks t
       SET procedure_step_id = ns.id,
           title             = ns.title,
           estimated_hours   = ns.estimated_hours,
           updated_at        = now()
      FROM public.procedure_step_definitions os
      JOIN public.procedure_step_definitions ns
        ON ns.step_key = os.step_key
       AND ns.definition_id = p_definition_id
       AND ns.is_current
     WHERE t.procedure_run_id = r_run.id
       AND t.procedure_step_id = os.id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_repointed := v_repointed + v_n;

    -- A step nobody has started takes the new version's ticks whole: its
    -- gates are replaced from the step it now points at. A step under way,
    -- held or finished keeps the ticks it was given - the record of what was
    -- checked belongs to the work, not the playbook.
    FOR r_task IN
      SELECT t.id, t.procedure_step_id
        FROM public.tasks t
       WHERE t.procedure_run_id = r_run.id
         AND t.status = 'todo'
         AND EXISTS (SELECT 1 FROM public.procedure_step_definitions ns
                      WHERE ns.id = t.procedure_step_id AND ns.definition_id = p_definition_id)
    LOOP
      DELETE FROM public.task_completion_requirements WHERE task_id = r_task.id;
      v_ticks := v_ticks + public.create_step_requirements(r_task.id, r_task.procedure_step_id);
    END LOOP;

    UPDATE public.tasks t
       SET status = 'cancelled', updated_at = now()
     WHERE t.procedure_run_id = r_run.id
       AND t.status = 'todo'
       AND NOT EXISTS (
             SELECT 1 FROM public.procedure_step_definitions ns
              WHERE ns.id = t.procedure_step_id
                AND ns.definition_id = p_definition_id
           );
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_cancelled := v_cancelled + v_n;

    FOR r_step IN
      SELECT ns.* FROM public.procedure_step_definitions ns
       WHERE ns.definition_id = p_definition_id AND ns.is_current
         AND NOT EXISTS (
               SELECT 1 FROM public.tasks t
                WHERE t.procedure_run_id = r_run.id
                  AND t.procedure_step_id = ns.id
             )
       ORDER BY ns.display_order
    LOOP
      -- The Plan tab builds its tree from parent_task_id. Without this a new
      -- child step becomes an extra phase.
      v_parent := NULL;
      IF r_step.parent_step_id IS NOT NULL THEN
        SELECT t.id INTO v_parent
          FROM public.tasks t
         WHERE t.procedure_run_id = r_run.id
           AND t.procedure_step_id = r_step.parent_step_id
         LIMIT 1;
      END IF;

      INSERT INTO public.tasks (
        tenant_id, title, description, status, priority,
        procedure_run_id, procedure_step_id, parent_task_id, estimated_hours,
        related_type, related_id, created_by, assigned_to
      ) VALUES (
        r_run.tenant_id, r_step.title, r_step.instructions, 'todo',
        COALESCE(r_step.priority, 'medium'),
        r_run.id, r_step.id, v_parent, r_step.estimated_hours,
        r_run.related_type, r_run.related_id, p_user_id, r_step.assign_to_user
      )
      RETURNING id INTO v_new_id;
      -- The gates the step puts on its task. start_procedure_run and the
      -- sync both do this; commit did not, so a step added by a new version
      -- arrived with no ticks at all.
      v_ticks := v_ticks + public.create_step_requirements(v_new_id, r_step.id);
      v_added := v_added + 1;
    END LOOP;

    UPDATE public.procedure_runs
       SET definition_id = p_definition_id,
           definition_version = v_draft.version,
           updated_at = now()
     WHERE id = r_run.id;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'version', v_draft.version,
    'runs_moved', v_runs,
    'tasks_repointed', v_repointed,
    'tasks_added', v_added,
    'tasks_cancelled', v_cancelled,
    'ticks_refreshed', v_ticks
  );
END;
$$;

