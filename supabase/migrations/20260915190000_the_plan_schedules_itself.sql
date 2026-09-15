-- The plan schedules itself.
--
-- Until now a run gave every step the same start date - the day the playbook
-- was started - and a due date from its hours, and nothing ever read the
-- dependencies or the order again. So a step that "waits for 2D Designs to
-- finish" showed a start date before 2D Designs ended, and the plan looked
-- wrong on the first day. Step 3's shift trigger only ever pushed dates later.
--
-- reschedule_run(run) lays the not-yet-started part of a plan out from three
-- things, every time anything about the run changes:
--
--   * the playbook's rules - hours (8h = 1 day, rounded up), "waits for X to
--     finish / to start", sibling order within a stage unless a step is
--     marked Parallel, stage order unless a stage is marked Parallel;
--   * reality - a completed step is its actual dates; a step in progress or
--     on hold ends no earlier than today, or its "expected until";
--   * the project manager - dates set by hand are pinned (tasks.dates_pinned)
--     and treated as fixed.
--
-- Finishing early pulls the plan forward; finishing late or being held pushes
-- it back. The agreed plan (plan_baselines) is the snapshot at kick-off and is
-- never touched by this. Calendar days, not working days, for now.

ALTER TABLE "public"."tasks"
  ADD COLUMN IF NOT EXISTS "dates_pinned" boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN "public"."tasks"."dates_pinned" IS 'Dates set by a person; the scheduler treats them as fixed.';

CREATE OR REPLACE FUNCTION "public"."reschedule_run"(
  "p_run_id" uuid,
  "p_anchor" date DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_run     public.procedure_runs%ROWTYPE;
  v_anchor  date;
  v_pass    integer;
  v_dirty   boolean;
  v_changed integer := 0;
  v_n       integer;
  r         record;
  v_start   date;
  v_due     date;
BEGIN
  SELECT * INTO v_run FROM public.procedure_runs WHERE id = p_run_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Re-entrancy: writing dates fires the triggers that call this.
  IF current_setting('softinterio.rescheduling', true) = '1' THEN RETURN 0; END IF;
  PERFORM set_config('softinterio.rescheduling', '1', true);

  v_anchor := COALESCE(
    p_anchor,
    CASE WHEN v_run.related_type = 'project'
         THEN (SELECT expected_start_date FROM public.projects WHERE id = v_run.related_id) END,
    v_run.started_at::date
  );

  DROP TABLE IF EXISTS _plan;
  CREATE TEMP TABLE _plan ON COMMIT DROP AS
  SELECT t.id,
         t.parent_task_id                 AS parent,
         t.status,
         t.dates_pinned                   AS pinned,
         t.start_date                     AS old_start,
         t.due_date                       AS old_due,
         t.first_started_at::date         AS actual_start,
         t.completed_at::date             AS actual_end,
         t.hold_expected_until,
         GREATEST(1, CEIL(COALESCE(t.estimated_hours, sd.estimated_hours, 8) / 8.0))::integer AS dur,
         COALESCE(sd.allow_parallel, false) AS parallel,
         COALESCE(sd.display_order, 0)    AS ord,
         t.procedure_step_id              AS step_id,
         NULL::date                       AS s,
         NULL::date                       AS e,
         false                            AS fixed
    FROM public.tasks t
    LEFT JOIN public.procedure_step_definitions sd ON sd.id = t.procedure_step_id
   WHERE t.procedure_run_id = p_run_id;

  -- What reality and the PM have already decided.
  UPDATE _plan SET fixed = true,
    s = CASE
          WHEN status IN ('completed','skipped','cancelled') THEN COALESCE(actual_start, old_start, actual_end)
          WHEN status IN ('in_progress','on_hold','blocked') THEN COALESCE(actual_start, old_start, CURRENT_DATE)
          ELSE old_start END,
    e = CASE
          WHEN status IN ('completed','skipped','cancelled') THEN COALESCE(actual_end, old_due, actual_start)
          WHEN status IN ('on_hold','blocked') THEN GREATEST(COALESCE(hold_expected_until, old_due, CURRENT_DATE), CURRENT_DATE)
          WHEN status = 'in_progress' THEN GREATEST(COALESCE(old_due, CURRENT_DATE), CURRENT_DATE)
          ELSE old_due END
  WHERE status <> 'todo' OR (pinned AND old_start IS NOT NULL AND old_due IS NOT NULL);

  -- Everything else, to a fixed point. Stages before steps, in playbook order.
  FOR v_pass IN 1..80 LOOP
    v_dirty := false;
    FOR r IN SELECT * FROM _plan WHERE NOT fixed ORDER BY (parent IS NOT NULL), ord LOOP
      v_start := v_anchor;

      -- A step starts no earlier than its stage.
      IF r.parent IS NOT NULL THEN
        SELECT GREATEST(v_start, COALESCE(MAX(s), v_start)) INTO v_start FROM _plan WHERE id = r.parent;
      END IF;

      -- After the previous sibling, or alongside it if Parallel.
      SELECT GREATEST(v_start, COALESCE(MAX(x), v_start)) INTO v_start
        FROM (SELECT CASE WHEN r.parallel THEN p.s ELSE p.e + 1 END AS x
                FROM _plan p
               WHERE p.parent IS NOT DISTINCT FROM r.parent AND p.ord < r.ord AND p.id <> r.id
               ORDER BY p.ord DESC LIMIT 1) q;

      -- After (or alongside) whatever it explicitly waits for.
      SELECT GREATEST(v_start, COALESCE(MAX(CASE WHEN d.wait_type = 'after_start' THEN p.s ELSE p.e + 1 END), v_start))
        INTO v_start
        FROM public.procedure_step_dependencies d
        JOIN _plan p ON p.step_id = d.depends_on_step_id
       WHERE d.step_id = r.step_id;

      v_due := v_start + r.dur - 1;

      -- A stage lasts as long as its steps.
      IF r.parent IS NULL THEN
        SELECT GREATEST(v_due, COALESCE(MAX(e), v_due)) INTO v_due FROM _plan c WHERE c.parent = r.id;
      END IF;

      IF r.s IS DISTINCT FROM v_start OR r.e IS DISTINCT FROM v_due THEN
        UPDATE _plan SET s = v_start, e = v_due WHERE id = r.id;
        v_dirty := true;
      END IF;
    END LOOP;
    EXIT WHEN NOT v_dirty;
  END LOOP;

  -- A stage under way still ends when its last step does.
  UPDATE _plan p SET e = x.e
    FROM (SELECT p2.id, GREATEST(p2.e, MAX(c.e)) AS e
            FROM _plan p2 JOIN _plan c ON c.parent = p2.id
           WHERE p2.status = 'in_progress' GROUP BY p2.id, p2.e) x
   WHERE p.id = x.id AND p.e IS DISTINCT FROM x.e;

  -- Not started: both dates are the plan's to set.
  UPDATE public.tasks t
     SET start_date = p.s, due_date = p.e, updated_at = now()
    FROM _plan p
   WHERE p.id = t.id AND NOT p.fixed
     AND p.s IS NOT NULL AND p.e IS NOT NULL
     AND (t.start_date IS DISTINCT FROM p.s OR t.due_date IS DISTINCT FROM p.e);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_changed := v_changed + v_n;

  -- Under way or held: start_date stays the plan (started_at is what happened);
  -- only the end moves, to today or the expected date.
  UPDATE public.tasks t
     SET due_date = p.e, updated_at = now()
    FROM _plan p
   WHERE p.id = t.id AND p.status IN ('in_progress','on_hold','blocked')
     AND p.e IS NOT NULL AND t.due_date IS DISTINCT FROM p.e;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_changed := v_changed + v_n;

  DROP TABLE _plan;
  PERFORM set_config('softinterio.rescheduling', '0', true);
  RETURN v_changed;
END;
$$;

COMMENT ON FUNCTION "public"."reschedule_run"(uuid, date) IS
  'Lays out the not-started part of a run from the playbook''s rules, reality and pinned dates. Returns how many tasks were re-dated. plan_baselines is untouched.';

-- The one-way shift from step 3 is superseded; the scheduler handles both
-- directions and the held step's own due date.
DROP TRIGGER IF EXISTS "trg_plan_shifts_with_reality" ON "public"."tasks";
DROP FUNCTION IF EXISTS "public"."trg_plan_shifts_with_reality"();
DROP FUNCTION IF EXISTS "public"."shift_dependent_steps"(uuid, integer, uuid);

-- Reschedule after any statement that creates or changes tasks of a run.
-- Statement-level with transition tables, so a run start (36 inserts) or a
-- commit (33 repoints) schedules once, not per row.
CREATE OR REPLACE FUNCTION "public"."trg_reschedule_runs_after_insert"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r record;
BEGIN
  IF current_setting('softinterio.rescheduling', true) = '1' THEN RETURN NULL; END IF;
  FOR r IN SELECT DISTINCT n.procedure_run_id AS run_id FROM new_rows n WHERE n.procedure_run_id IS NOT NULL LOOP
    PERFORM public.reschedule_run(r.run_id);
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."trg_reschedule_runs_after_update"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r        record;
  v_n      integer;
  v_why    text;
BEGIN
  IF current_setting('softinterio.rescheduling', true) = '1' THEN RETURN NULL; END IF;

  -- Only the columns the schedule reads. A transition-table trigger cannot
  -- carry a column list, so the filter lives here.
  FOR r IN SELECT DISTINCT n.procedure_run_id AS run_id, n.related_type, n.related_id
             FROM new_rows n
             JOIN old_rows o ON o.id = n.id
            WHERE n.procedure_run_id IS NOT NULL
              AND (n.status IS DISTINCT FROM o.status
                   OR n.start_date IS DISTINCT FROM o.start_date
                   OR n.due_date IS DISTINCT FROM o.due_date
                   OR n.hold_expected_until IS DISTINCT FROM o.hold_expected_until
                   OR n.estimated_hours IS DISTINCT FROM o.estimated_hours
                   OR n.dates_pinned IS DISTINCT FROM o.dates_pinned
                   OR n.procedure_step_id IS DISTINCT FROM o.procedure_step_id) LOOP
    v_n := public.reschedule_run(r.run_id);

    IF v_n > 0 AND r.related_type = 'project' AND r.related_id IS NOT NULL THEN
      -- Name what caused it, when a status moved in this statement.
      SELECT string_agg(format('"%s" %s', n.title,
               CASE n.status WHEN 'completed' THEN 'finished' WHEN 'on_hold' THEN 'put on hold'
                             WHEN 'blocked' THEN 'blocked' WHEN 'in_progress' THEN 'started' ELSE n.status::text END), ', ')
        INTO v_why
        FROM new_rows n JOIN old_rows o ON o.id = n.id
       WHERE n.procedure_run_id = r.run_id AND n.status IS DISTINCT FROM o.status;
      IF v_why IS NOT NULL THEN
        INSERT INTO public.project_activities (project_id, activity_type, title, description, created_by)
        SELECT r.related_id, 'plan_shifted',
               format('%s step(s) re-dated', v_n),
               format('After %s.', v_why),
               COALESCE((SELECT updated_by FROM public.tasks WHERE procedure_run_id = r.run_id ORDER BY updated_at DESC LIMIT 1),
                        (SELECT created_by FROM public.projects WHERE id = r.related_id));
      END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS "trg_reschedule_after_insert" ON "public"."tasks";
CREATE TRIGGER "trg_reschedule_after_insert"
  AFTER INSERT ON "public"."tasks"
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_reschedule_runs_after_insert"();

DROP TRIGGER IF EXISTS "trg_reschedule_after_update" ON "public"."tasks";
CREATE TRIGGER "trg_reschedule_after_update"
  AFTER UPDATE ON "public"."tasks"
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION "public"."trg_reschedule_runs_after_update"();

-- Kick-off schedules once more before it snapshots the baseline.
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

  -- Lay the plan out from its rules and reality one last time, so the
  -- baseline is the schedule and not whatever the run happened to insert.
  PERFORM public.reschedule_run(v_run_id);

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

-- Lay out every active run now.
SELECT public.reschedule_run(id) FROM public.procedure_runs WHERE status = 'active';
