-- A hold has an owner, and the plan moves with reality.
--
-- Step 3 of docs/plans/project-lifecycle-and-delay-ledger.md.
--
-- Putting a step on hold now records WHO we are waiting on (client, vendor,
-- us, or someone else), WHY (a code from a short, tenant-editable list) and
-- UNTIL WHEN. Those three are what the delay log is made of: every day a step
-- sits on hold is counted against that owner, at that stage, for that reason.
-- They are written by task_transition in the same UPDATE as the status, so
-- the status-history row - the durable record of the hold - carries them.
--
-- And the current plan shifts by itself. When a step finishes late, or is put
-- on hold until a date past its due date, every step that waits on it moves by
-- the same number of days (only steps not yet started; the agreed plan in
-- plan_baselines is untouched). Without this, planned dates downstream of a
-- late step were simply wrong until somebody re-typed them, and the gap
-- between "agreed" and "current" - which IS the delay - was invisible.

-- ---------------------------------------------------------------------------
-- 1. The reasons list. Shipped defaults (tenant_id NULL); a business adds
--    its own. Same bargain as playbooks and roles.
-- ---------------------------------------------------------------------------

CREATE TABLE "public"."delay_reasons" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"     uuid REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
  "owner"         text NOT NULL CHECK ("owner" IN ('client', 'vendor', 'internal', 'third_party')),
  "code"          text NOT NULL,
  "label"         text NOT NULL,
  "display_order" integer NOT NULL DEFAULT 0,
  "is_active"     boolean NOT NULL DEFAULT true,
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("tenant_id", "code")
);

CREATE UNIQUE INDEX "delay_reasons_default_code" ON "public"."delay_reasons" ("code") WHERE "tenant_id" IS NULL;

ALTER TABLE "public"."delay_reasons" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "defaults and own reasons are readable" ON "public"."delay_reasons"
  FOR SELECT USING ("tenant_id" IS NULL OR "tenant_id" = "public"."get_user_tenant_id"());
CREATE POLICY "tenants manage their own reasons" ON "public"."delay_reasons"
  FOR ALL USING ("tenant_id" = "public"."get_user_tenant_id"())
  WITH CHECK ("tenant_id" = "public"."get_user_tenant_id"());
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."delay_reasons" TO "authenticated";
GRANT ALL ON "public"."delay_reasons" TO "service_role";

INSERT INTO "public"."delay_reasons" ("owner", "code", "label", "display_order") VALUES
  ('client',      'site_not_ready',      'Site not ready / possession pending', 10),
  ('client',      'design_change',       'Design change requested',            20),
  ('client',      'approval_pending',    'Approval pending',                   30),
  ('client',      'selection_pending',   'Selections not made',                40),
  ('client',      'payment_pending',     'Payment pending',                    50),
  ('vendor',      'lead_time',           'Vendor lead time',                   10),
  ('vendor',      'quality_rejection',   'Material rejected on quality',       20),
  ('vendor',      'short_supply',        'Short supply / stock-out',           30),
  ('internal',    'design_rework',       'Design rework',                      10),
  ('internal',    'capacity',            'Team capacity',                      20),
  ('internal',    'production',          'Production delay',                   30),
  ('internal',    'site_execution',      'Site execution delay',               40),
  ('third_party', 'society_permission',  'Society / building permission',      10),
  ('third_party', 'regulatory',          'Regulatory / government',            20),
  ('third_party', 'weather',             'Weather',                            30),
  ('third_party', 'transport',           'Transport / logistics',              40);

-- ---------------------------------------------------------------------------
-- 2. A hold carries its owner, reason and expected end - on the task while it
--    is held, and on the history row for ever.
-- ---------------------------------------------------------------------------

ALTER TABLE "public"."tasks"
  ADD COLUMN IF NOT EXISTS "hold_owner" text CHECK ("hold_owner" IN ('client', 'vendor', 'internal', 'third_party')),
  ADD COLUMN IF NOT EXISTS "hold_reason_code" text,
  ADD COLUMN IF NOT EXISTS "hold_expected_until" date,
  ADD COLUMN IF NOT EXISTS "hold_counterpart" text;

ALTER TABLE "public"."task_status_history"
  ADD COLUMN IF NOT EXISTS "hold_owner" text,
  ADD COLUMN IF NOT EXISTS "hold_reason_code" text,
  ADD COLUMN IF NOT EXISTS "hold_expected_until" date,
  ADD COLUMN IF NOT EXISTS "hold_counterpart" text;

-- A step can name the reason a hold on it usually has, so the dialog opens
-- pre-filled ("Client approves 3D" -> approval_pending).
ALTER TABLE "public"."procedure_step_definitions"
  ADD COLUMN IF NOT EXISTS "default_delay_reason" text;

-- ---------------------------------------------------------------------------
-- 2b. task_transition takes the owner, reason, expected date and counterpart;
--     the history trigger copies them onto the row it writes. Both otherwise
--     identical to their previous definitions (20260914090000 and baseline).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."task_transition"(
    "p_task_id" "uuid",
    "p_user_id" "uuid",
    "p_to" "public"."task_status",
    "p_reason" "text" DEFAULT NULL::"text",
    "p_hold_owner" "text" DEFAULT NULL::"text",
    "p_hold_reason_code" "text" DEFAULT NULL::"text",
    "p_hold_expected_until" "date" DEFAULT NULL::"date",
    "p_hold_counterpart" "text" DEFAULT NULL::"text"
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
    v_now      timestamptz := now();
BEGIN
    SELECT * INTO v_task FROM "public"."tasks" WHERE id = p_task_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Task not found');
    END IF;

    IF v_task.status = p_to THEN
        RETURN jsonb_build_object('success', false,
            'error', format('This task is already %s', p_to));
    END IF;

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
           -- Who we are waiting on, why, and until when. Recorded here, in
           -- the same UPDATE, so the status-history row written by the
           -- trigger carries them - a second UPDATE would be too late.
           hold_owner          = CASE WHEN p_to IN ('on_hold','blocked') THEN p_hold_owner END,
           hold_reason_code    = CASE WHEN p_to IN ('on_hold','blocked') THEN p_hold_reason_code END,
           hold_expected_until = CASE WHEN p_to IN ('on_hold','blocked') THEN p_hold_expected_until END,
           hold_counterpart    = CASE WHEN p_to IN ('on_hold','blocked') THEN NULLIF(btrim(COALESCE(p_hold_counterpart,'')),'') END,
           skip_reason = CASE WHEN p_to = 'skipped'
                              THEN NULLIF(btrim(COALESCE(p_reason,'')),'') END,
           skipped_at  = CASE WHEN p_to = 'skipped' THEN v_now END,
           skipped_by  = CASE WHEN p_to = 'skipped' THEN p_user_id END,

           -- When work began. Completing something that was never started
           -- stamps the same moment as its end: the work happened, nobody
           -- tracked it, and a zero-length record beats a blank. Never
           -- overwrites a start that was actually recorded.
           started_at = CASE
               WHEN p_to = 'in_progress' THEN v_now
               WHEN p_to = 'completed' AND "tasks".started_at IS NULL THEN v_now
               ELSE "tasks".started_at
           END,
           first_started_at = CASE
               WHEN p_to IN ('in_progress','completed')
                    AND "tasks".first_started_at IS NULL THEN v_now
               ELSE "tasks".first_started_at
           END,

           completed_at = CASE
               WHEN p_to = 'completed' THEN v_now
               WHEN p_to IN ('todo','in_progress','on_hold','blocked') THEN NULL
               ELSE "tasks".completed_at
           END,
           first_completed_at = CASE
               WHEN p_to = 'completed' AND "tasks".first_completed_at IS NULL THEN v_now
               ELSE "tasks".first_completed_at
           END,
           completed_by = CASE
               WHEN p_to = 'completed' THEN p_user_id
               WHEN p_to IN ('todo','in_progress','on_hold','blocked') THEN NULL
               ELSE "tasks".completed_by
           END,
           completion_count = COALESCE("tasks".completion_count, 0)
               + CASE WHEN p_to = 'completed' THEN 1 ELSE 0 END,

           updated_by  = p_user_id,
           updated_at  = v_now
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
                   updated_at = v_now
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


CREATE OR REPLACE FUNCTION "public"."trg_tasks_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_now         timestamp with time zone := now();
    v_last_change timestamp with time zone;
    v_duration    bigint;
    v_actor       "uuid";
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;

    v_actor := COALESCE(NEW.updated_by, NEW.completed_by, NEW.assigned_to, OLD.assigned_to);

    SELECT COALESCE(MAX(changed_at), OLD.created_at)
      INTO v_last_change
      FROM "public"."task_status_history"
     WHERE task_id = NEW.id;

    v_duration := GREATEST(0, (EXTRACT(EPOCH FROM (v_now - COALESCE(v_last_change, v_now))))::bigint);

    INSERT INTO "public"."task_status_history"
        (task_id, tenant_id, from_status, to_status, duration_seconds, reason, changed_by, changed_at,
         hold_owner, hold_reason_code, hold_expected_until, hold_counterpart)
    VALUES
        (NEW.id, NEW.tenant_id, OLD.status, NEW.status, v_duration, NEW.hold_reason, v_actor, v_now,
         NEW.hold_owner, NEW.hold_reason_code, NEW.hold_expected_until, NEW.hold_counterpart);

    IF OLD.status IN ('on_hold', 'blocked') THEN
        NEW.total_held_seconds := COALESCE(OLD.total_held_seconds, 0) + v_duration;
    END IF;

    IF NEW.status = 'in_progress' THEN
        NEW.started_at := v_now;
        IF NEW.first_started_at IS NULL THEN
            NEW.first_started_at := v_now;
        END IF;

        IF v_actor IS NOT NULL THEN
            INSERT INTO "public"."task_work_sessions" (task_id, tenant_id, user_id, started_at, source)
            VALUES (NEW.id, NEW.tenant_id, v_actor, v_now, 'status')
            ON CONFLICT (task_id, user_id) WHERE (ended_at IS NULL) DO NOTHING;
        END IF;

        -- Clear the CURRENT completion so lead/cycle time read NULL while the
        -- task is back in flight. first_completed_at and completion_count are
        -- deliberately left alone - that is the permanent record.
        NEW.completed_at := NULL;
        NEW.completed_by := NULL;
        NEW.cancelled_at := NULL;
        NEW.cancelled_by := NULL;
    ELSE
        UPDATE "public"."task_work_sessions"
           SET ended_at = v_now
         WHERE task_id = NEW.id
           AND ended_at IS NULL;

        SELECT COALESCE(SUM(duration_seconds), 0)
          INTO NEW.total_active_seconds
          FROM "public"."task_work_sessions"
         WHERE task_id = NEW.id
           AND ended_at IS NOT NULL;

        NEW.actual_hours := ROUND((NEW.total_active_seconds / 3600.0)::numeric, 2);
    END IF;

    IF NEW.status = 'completed' THEN
        NEW.completed_at := COALESCE(NEW.completed_at, v_now);
        NEW.completed_by := COALESCE(NEW.completed_by, v_actor);
        -- Permanent record: set once, counted every time.
        NEW.first_completed_at := COALESCE(NEW.first_completed_at, v_now);
        NEW.completion_count := COALESCE(OLD.completion_count, 0) + 1;
    END IF;

    IF NEW.status = 'cancelled' THEN
        NEW.cancelled_at := COALESCE(NEW.cancelled_at, v_now);
        NEW.cancelled_by := COALESCE(NEW.cancelled_by, v_actor);
    END IF;

    IF NEW.status NOT IN ('on_hold', 'blocked') THEN
        NEW.hold_reason := NULL;
        NEW.hold_owner := NULL;
        NEW.hold_reason_code := NULL;
        NEW.hold_expected_until := NULL;
        NEW.hold_counterpart := NULL;
    END IF;

    RETURN NEW;
END;
$$;


-- revise_playbook: default_delay_reason joins the copied columns.
CREATE OR REPLACE FUNCTION "public"."revise_playbook"(
  "p_definition_id" uuid,
  "p_user_id" uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_src        public.procedure_definitions%ROWTYPE;
  v_draft_id   uuid;
  v_next       integer;
  v_open_draft uuid;
  v_steps      integer;
BEGIN
  SELECT * INTO v_src FROM public.procedure_definitions WHERE id = p_definition_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Playbook not found');
  END IF;

  IF v_src.is_protected THEN
    RETURN jsonb_build_object('success', false,
      'error', 'This playbook is provided by SoftInterio. Copy it first.');
  END IF;

  -- One open draft per family, so two people cannot revise into each other.
  SELECT id INTO v_open_draft
    FROM public.procedure_definitions
   WHERE root_id = v_src.root_id AND status = 'draft'
   LIMIT 1;

  IF v_open_draft IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'draft_id', v_open_draft,
      'error', 'A draft of this playbook is already open.');
  END IF;

  SELECT COALESCE(MAX(version), v_src.version) + 1 INTO v_next
    FROM public.procedure_definitions WHERE root_id = v_src.root_id;

  INSERT INTO public.procedure_definitions (
    tenant_id, root_id, name, description, version, applies_to, tenant_type,
    enforce_order, auto_start, auto_start_project_category,
    is_protected, is_active, status, created_by, updated_by
  ) VALUES (
    v_src.tenant_id, v_src.root_id, v_src.name, v_src.description, v_next,
    v_src.applies_to, v_src.tenant_type, v_src.enforce_order,
    -- The flag belongs to whichever version is in service, so a draft never
    -- competes with the live one for the auto-start slot.
    false, v_src.auto_start_project_category,
    false, false, 'draft', p_user_id, p_user_id
  )
  RETURNING id INTO v_draft_id;

  -- Parents and children in one statement each, with the new parent resolved
  -- by matching display_order, which is unique within a definition.
  CREATE TEMP TABLE _copied (old_id uuid, new_id uuid) ON COMMIT DROP;

  WITH src AS (
    SELECT * FROM public.procedure_step_definitions
     WHERE definition_id = p_definition_id AND is_current AND parent_step_id IS NULL
  ), ins AS (
    INSERT INTO public.procedure_step_definitions (
      definition_id, parent_step_id, title, description, instructions,
      display_order, action_type, form_schema, required_upload_types,
      approval_role, assign_to_role, assign_to_user, relative_due_days,
      estimated_hours, duration_days, priority, is_required, can_skip,
      skip_requires_reason, allow_parallel, checklist_items, step_key, is_current,
      owner_type, milestone_role, default_delay_reason
    )
    SELECT v_draft_id, NULL, title, description, instructions,
           display_order, action_type, form_schema, required_upload_types,
           approval_role, assign_to_role, assign_to_user, relative_due_days,
           estimated_hours, duration_days, priority, is_required, can_skip,
           skip_requires_reason, allow_parallel, checklist_items, step_key, true,
           owner_type, milestone_role, default_delay_reason
      FROM src
    RETURNING id, display_order
  )
  INSERT INTO _copied (old_id, new_id)
  SELECT src.id, ins.id FROM src JOIN ins ON ins.display_order = src.display_order;

  WITH src AS (
    SELECT * FROM public.procedure_step_definitions
     WHERE definition_id = p_definition_id AND is_current AND parent_step_id IS NOT NULL
  ), ins AS (
    INSERT INTO public.procedure_step_definitions (
      definition_id, parent_step_id, title, description, instructions,
      display_order, action_type, form_schema, required_upload_types,
      approval_role, assign_to_role, assign_to_user, relative_due_days,
      estimated_hours, duration_days, priority, is_required, can_skip,
      skip_requires_reason, allow_parallel, checklist_items, step_key, is_current,
      owner_type, milestone_role, default_delay_reason
    )
    SELECT v_draft_id, c.new_id, s.title, s.description, s.instructions,
           s.display_order, s.action_type, s.form_schema, s.required_upload_types,
           s.approval_role, s.assign_to_role, s.assign_to_user, s.relative_due_days,
           s.estimated_hours, s.duration_days, s.priority, s.is_required, s.can_skip,
           s.skip_requires_reason, s.allow_parallel, s.checklist_items, s.step_key, true,
           s.owner_type, s.milestone_role, s.default_delay_reason
      FROM src s
      JOIN _copied c ON c.old_id = s.parent_step_id
    RETURNING id, display_order
  )
  INSERT INTO _copied (old_id, new_id)
  SELECT src.id, ins.id FROM src JOIN ins ON ins.display_order = src.display_order;

  -- Dependencies are between steps, so they are remapped onto the copies.
  INSERT INTO public.procedure_step_dependencies (step_id, depends_on_step_id, dependency_type)
  SELECT f.new_id, t.new_id, d.dependency_type
    FROM public.procedure_step_dependencies d
    JOIN _copied f ON f.old_id = d.step_id
    JOIN _copied t ON t.old_id = d.depends_on_step_id;

  -- Every current step must have arrived, or the whole thing rolls back.
  SELECT count(*) INTO v_steps FROM _copied;

  IF v_steps <> (
    SELECT count(*) FROM public.procedure_step_definitions
     WHERE definition_id = p_definition_id AND is_current
  ) THEN
    RAISE EXCEPTION 'Revision copied % of % steps', v_steps,
      (SELECT count(*) FROM public.procedure_step_definitions
        WHERE definition_id = p_definition_id AND is_current);
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'draft_id', v_draft_id, 'version', v_next, 'steps', v_steps
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. The current plan moves with reality.
-- ---------------------------------------------------------------------------

ALTER TYPE "public"."project_activity_type_enum" ADD VALUE IF NOT EXISTS 'plan_shifted';

-- Push every not-yet-started step that waits on this one (directly or
-- through others), and the steps inside any stage pushed, by p_days.
-- Returns how many moved.
CREATE OR REPLACE FUNCTION "public"."shift_dependent_steps"(
  "p_task_id" uuid,
  "p_days"    integer,
  "p_user_id" uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task   public.tasks%ROWTYPE;
  v_moved  integer := 0;
  v_names  text;
BEGIN
  IF p_days IS NULL OR p_days <= 0 THEN RETURN 0; END IF;
  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id;
  IF NOT FOUND OR v_task.procedure_run_id IS NULL THEN RETURN 0; END IF;

  WITH RECURSIVE affected AS (
    -- Steps whose definition waits on this step's definition, in this run.
    SELECT t.id
      FROM public.tasks t
      JOIN public.procedure_step_dependencies d ON d.step_id = t.procedure_step_id
     WHERE t.procedure_run_id = v_task.procedure_run_id
       AND d.depends_on_step_id = v_task.procedure_step_id
    UNION
    -- ...and whatever waits on those, and the steps inside any pushed stage.
    SELECT t.id
      FROM affected a
      JOIN public.tasks src ON src.id = a.id
      JOIN public.tasks t
        ON t.procedure_run_id = src.procedure_run_id
       AND (t.parent_task_id = src.id
            OR EXISTS (SELECT 1 FROM public.procedure_step_dependencies d
                        WHERE d.step_id = t.procedure_step_id
                          AND d.depends_on_step_id = src.procedure_step_id))
  ),
  moved AS (
    UPDATE public.tasks t
       SET start_date = t.start_date + p_days,
           due_date   = t.due_date + p_days,
           updated_at = now()
      FROM affected a
     WHERE t.id = a.id
       AND t.id <> p_task_id
       AND t.status = 'todo'
    RETURNING t.title
  )
  SELECT COUNT(*), string_agg(title, ', ' ORDER BY title) INTO v_moved, v_names FROM moved;

  IF v_moved > 0 AND v_task.related_type = 'project' AND v_task.related_id IS NOT NULL THEN
    INSERT INTO public.project_activities (project_id, activity_type, title, description, created_by)
    VALUES (v_task.related_id, 'plan_shifted',
            format('%s step(s) moved %s day(s) later', v_moved, p_days),
            format('Because "%s" %s. Moved: %s', v_task.title,
                   CASE WHEN v_task.status IN ('on_hold','blocked') THEN 'is on hold' ELSE 'finished late' END,
                   v_names),
            COALESCE(p_user_id, v_task.updated_by, v_task.created_by));
  END IF;

  RETURN v_moved;
END;
$$;

COMMENT ON FUNCTION "public"."shift_dependent_steps"(uuid, integer, uuid) IS
  'Pushes every not-started step that waits on the given step (transitively, and steps inside pushed stages) by N days. The agreed plan (plan_baselines) is untouched.';

-- Fires on the two events that make a plan late: a step finishing after its
-- due date, and a step being held until a date past its due date. BEFORE, so
-- the held step can take its expected date as its new due date in the same
-- write.
CREATE OR REPLACE FUNCTION "public"."trg_plan_shifts_with_reality"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_delta integer;
BEGIN
  IF NEW.procedure_run_id IS NULL THEN RETURN NEW; END IF;

  -- Finished late.
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed'
     AND NEW.due_date IS NOT NULL THEN
    v_delta := (COALESCE(NEW.completed_at, now())::date - NEW.due_date);
    IF v_delta > 0 THEN
      PERFORM public.shift_dependent_steps(NEW.id, v_delta, NEW.updated_by);
    END IF;
  END IF;

  -- Held past its due date: it will not be done before then, so say so.
  IF NEW.status IN ('on_hold', 'blocked')
     AND (OLD.status NOT IN ('on_hold', 'blocked') OR NEW.hold_expected_until IS DISTINCT FROM OLD.hold_expected_until)
     AND NEW.hold_expected_until IS NOT NULL AND NEW.due_date IS NOT NULL
     AND NEW.hold_expected_until > NEW.due_date THEN
    v_delta := NEW.hold_expected_until - NEW.due_date;
    NEW.due_date := NEW.hold_expected_until;
    PERFORM public.shift_dependent_steps(NEW.id, v_delta, NEW.updated_by);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_plan_shifts_with_reality" ON "public"."tasks";
CREATE TRIGGER "trg_plan_shifts_with_reality"
  BEFORE UPDATE OF "status", "hold_expected_until" ON "public"."tasks"
  FOR EACH ROW EXECUTE FUNCTION "public"."trg_plan_shifts_with_reality"();
