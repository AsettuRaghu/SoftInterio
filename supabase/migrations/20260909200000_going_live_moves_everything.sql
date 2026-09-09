-- Putting a version live makes it THE version, everywhere.
--
-- Until now a run pinned the version it started under and stayed there, so
-- committing v5 changed nothing for a project already running v4 - only new
-- projects picked it up. That was a deliberate choice (a plan under way is not
-- rewritten mid-flight) and it is not what was wanted: several versions live at
-- once is most of what made this confusing. Decided 2026-09-09: going live
-- moves every running project onto the new version.
--
-- Existing work is matched by step_key, which is stable across revisions - that
-- is what the column is for. A task keeps its history, its comments, its
-- attachments and its logged hours, and simply starts pointing at the same step
-- in the newer version.
--
-- Three things can happen to a step between versions:
--
--   still there    the task is repointed, and its title and hours refreshed
--   newly added    a task is created for it, exactly as start_procedure_run would
--   removed        the task is CANCELLED if nobody has touched it, and LEFT
--                  ALONE if work has begun - deleting somebody's recorded work
--                  to tidy up a playbook would be the worse bug
--
-- One transaction, for the same reason revise_playbook is one: a half-migrated
-- run is a plan that disagrees with itself.

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
  v_steps     integer;
  r_run       record;
  r_step      record;
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

  -- The version currently in service, before we replace it.
  SELECT id INTO v_live_id
    FROM public.procedure_definitions
   WHERE root_id = v_draft.root_id AND status = 'committed'
   LIMIT 1;

  -- Supersede first: the auto-start index allows one committed row per
  -- category, so the outgoing version has to step aside before the new one
  -- takes its place.
  IF v_live_id IS NOT NULL THEN
    UPDATE public.procedure_definitions
       SET status = 'superseded', auto_start = false, is_active = false,
           updated_by = p_user_id, updated_at = now()
     WHERE id = v_live_id;
  END IF;

  UPDATE public.procedure_definitions
     SET status = 'committed', is_active = true,
         -- The new version inherits how the old one was adopted.
         auto_start = COALESCE((SELECT auto_start FROM public.procedure_definitions WHERE id = v_live_id), false),
         updated_by = p_user_id, updated_at = now()
   WHERE id = p_definition_id;

  -- Move every running plan in this family onto the new version.
  FOR r_run IN
    SELECT r.* FROM public.procedure_runs r
     JOIN public.procedure_definitions d ON d.id = r.definition_id
    WHERE d.root_id = v_draft.root_id AND r.status = 'active'
  LOOP
    v_runs := v_runs + 1;

    -- Steps that survived: repoint the task and refresh what the playbook now
    -- says about it. Dates and status are untouched - those belong to the work.
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
    GET DIAGNOSTICS v_repointed = ROW_COUNT;

    -- Steps that no longer exist: cancel only what nobody has touched.
    UPDATE public.tasks t
       SET status = 'cancelled', updated_at = now()
     WHERE t.procedure_run_id = r_run.id
       AND t.status IN ('todo', 'not_started')
       AND NOT EXISTS (
             SELECT 1 FROM public.procedure_step_definitions ns
              WHERE ns.id = t.procedure_step_id
                AND ns.definition_id = p_definition_id
           );
    GET DIAGNOSTICS v_cancelled = ROW_COUNT;

    -- Steps that are new in this version: create their tasks.
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
      INSERT INTO public.tasks (
        tenant_id, title, description, status, priority,
        procedure_run_id, procedure_step_id, estimated_hours,
        related_type, related_id, created_by, assigned_to
      ) VALUES (
        r_run.tenant_id, r_step.title, r_step.instructions, 'todo',
        COALESCE(r_step.priority, 'medium'),
        r_run.id, r_step.id, r_step.estimated_hours,
        r_run.related_type, r_run.related_id, p_user_id, r_step.assign_to_user
      );
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
    'tasks_cancelled', v_cancelled
  );
END;
$$;

COMMENT ON FUNCTION "public"."commit_playbook_version"(uuid, uuid) IS
  'Puts a draft into service and moves every running plan onto it, matching existing work by step_key. One transaction.';
