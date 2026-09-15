-- The playbook's own links place a step; the built-in order only fills the
-- gaps. "3D Design waits for 2D Designs to start" and "Client Selections waits
-- for 3D Design to start" mean those stages overlap, and the one-after-another
-- default was overruling the author. A step with any explicit link is placed
-- by its links alone. And a not-started step cannot start before today.

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
    -- Skipped and cancelled steps take no time: NULL dates, which every
    -- MAX() below ignores, so nothing waits for them and no stage stretches
    -- to cover them.
    s = CASE
          WHEN status IN ('skipped','cancelled') THEN NULL
          WHEN status = 'completed' THEN COALESCE(actual_start, old_start, actual_end)
          WHEN status IN ('in_progress','on_hold','blocked') THEN COALESCE(actual_start, old_start, CURRENT_DATE)
          ELSE old_start END,
    e = CASE
          WHEN status IN ('skipped','cancelled') THEN NULL
          WHEN status = 'completed' THEN COALESCE(actual_end, old_due, actual_start)
          WHEN status IN ('on_hold','blocked') THEN GREATEST(COALESCE(hold_expected_until, old_due, CURRENT_DATE), CURRENT_DATE)
          WHEN status = 'in_progress' THEN GREATEST(COALESCE(old_due, CURRENT_DATE), CURRENT_DATE)
          ELSE old_due END
  WHERE status <> 'todo' OR (pinned AND old_start IS NOT NULL AND old_due IS NOT NULL);

  -- Everything else, to a fixed point. Stages before steps, in playbook order.
  FOR v_pass IN 1..80 LOOP
    v_dirty := false;
    FOR r IN SELECT * FROM _plan WHERE NOT fixed ORDER BY (parent IS NOT NULL), ord LOOP
      -- The floor: the project's planned start for a stage, its own stage's
      -- start for a step. A step inside a stage already under way follows
      -- that stage, not the project's original start date.
      -- The project's planned start anchors only the FIRST stage; every
      -- later stage follows from order and dependencies. Using it as a floor
      -- for all of them held a stage back to the original start date even
      -- when the stage before it had already finished.
      IF r.parent IS NULL THEN
        SELECT CASE WHEN COUNT(*) = 0 THEN v_anchor ELSE DATE '1970-01-01' END INTO v_start
          FROM _plan p WHERE p.parent IS NULL AND p.ord < r.ord;
      ELSE
        SELECT COALESCE(MAX(s), v_anchor) INTO v_start FROM _plan WHERE id = r.parent;
      END IF;

      -- After the previous sibling, or alongside it if Parallel - but ONLY
      -- when the playbook says nothing explicit about this step. A step with
      -- its own "waits for" links is placed by those links alone: "3D Design
      -- waits for 2D Designs to start" means they overlap, and the built-in
      -- one-after-another rule must not quietly turn that into "after 2D
      -- finishes". (It also removes the sibling/link cycle that once sent a
      -- plan into next year.)
      IF NOT EXISTS (SELECT 1 FROM public.procedure_step_dependencies d WHERE d.step_id = r.step_id) THEN
        SELECT GREATEST(v_start, COALESCE(MAX(x), v_start)) INTO v_start
          FROM (SELECT CASE WHEN r.parallel THEN p.s ELSE p.e + 1 END AS x
                  FROM _plan p
                 WHERE p.parent IS NOT DISTINCT FROM r.parent AND p.ord < r.ord AND p.id <> r.id
                   AND p.status NOT IN ('skipped','cancelled')
                 ORDER BY p.ord DESC LIMIT 1) q;
      END IF;

      -- After (or alongside) whatever it explicitly waits for.
      SELECT GREATEST(v_start, COALESCE(MAX(CASE WHEN d.wait_type = 'after_start' THEN p.s ELSE p.e + 1 END), v_start))
        INTO v_start
        FROM public.procedure_step_dependencies d
        JOIN _plan p ON p.step_id = d.depends_on_step_id
       WHERE d.step_id = r.step_id;

      -- Work that has not started cannot start in the past. The baseline keeps
      -- the original date; this is the honest current plan.
      v_start := GREATEST(v_start, CURRENT_DATE);

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
    -- A stage under way ends when its last step does - its own old due date
    -- is not a floor, or a stale value would never be corrected. Inside the
    -- loop, so the stages after it see the corrected end on the next pass.
    UPDATE _plan p SET e = x.e
      FROM (SELECT p2.id, GREATEST(MAX(c.e), CURRENT_DATE) AS e
              FROM _plan p2 JOIN _plan c ON c.parent = p2.id
             WHERE p2.status = 'in_progress' GROUP BY p2.id) x
     WHERE p.id = x.id AND p.e IS DISTINCT FROM x.e;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN v_dirty := true; END IF;

    EXIT WHEN NOT v_dirty;
    IF v_pass = 80 THEN
      RAISE WARNING 'reschedule_run(%): did not settle in 80 passes - a dependency cycle in the playbook?', p_run_id;
    END IF;
  END LOOP;

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

SELECT public.reschedule_run(id) FROM public.procedure_runs WHERE status = 'active';
