-- Migration: enforce step order, and stop edits from gutting live runs
-- Created: 2026-09-03
--
-- PROBLEM 1 - order was decorative
-- display_order sorted the display and nothing else. allow_parallel was
-- written on every step and read by no code at all, so a 25-step procedure
-- let anyone start the final sign-off before the first measurement. The
-- engine comment claimed "sequential by default" - it was not.
--
-- Enforcement is opt-in per definition (enforce_order, default FALSE) so no
-- existing procedure changes behaviour underneath anyone. allow_parallel is
-- the per-step escape hatch for work that genuinely does not queue.
--
-- PROBLEM 2 - editing a procedure gutted runs already under way
-- replaceSteps() DELETEs every step row, and tasks.procedure_step_id is
-- ON DELETE SET NULL. So editing a procedure silently stripped action_type,
-- can_skip and instructions from every in-flight task pointing at it. Runs
-- pin definition_version precisely so their rules cannot change - that was
-- worthless while the steps themselves disappeared.
--
-- Steps are now superseded rather than deleted: is_current=false keeps the
-- row alive for the runs that reference it, and current listings filter it out.

ALTER TABLE "public"."procedure_definitions"
    ADD COLUMN IF NOT EXISTS "enforce_order" boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN "public"."procedure_definitions"."enforce_order" IS 'When true a step cannot start until its preceding siblings are settled. Steps marked allow_parallel are exempt.';

ALTER TABLE "public"."procedure_step_definitions"
    ADD COLUMN IF NOT EXISTS "is_current" boolean DEFAULT true NOT NULL;

COMMENT ON COLUMN "public"."procedure_step_definitions"."is_current" IS 'False once superseded by an edit. The row survives so live runs keep their step definition; only current rows are listed or instantiated.';

CREATE INDEX IF NOT EXISTS "idx_procedure_steps_current"
    ON "public"."procedure_step_definitions" ("definition_id", "is_current", "display_order");

-- ---------------------------------------------------------------------
-- Predecessor check
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."task_blocking_predecessors"("p_task_id" "uuid")
RETURNS TEXT[]
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_task RECORD;
    v_step RECORD;
    v_enforce boolean;
    v_blockers TEXT[];
BEGIN
    SELECT * INTO v_task FROM "public"."tasks" WHERE id = p_task_id;
    IF NOT FOUND OR v_task.procedure_step_id IS NULL THEN
        RETURN NULL; -- not a procedure step
    END IF;

    SELECT sd.*, pd.enforce_order
      INTO v_step
      FROM "public"."procedure_step_definitions" sd
      JOIN "public"."procedure_definitions" pd ON pd.id = sd.definition_id
     WHERE sd.id = v_task.procedure_step_id;

    IF NOT FOUND THEN RETURN NULL; END IF;

    v_enforce := v_step.enforce_order;
    IF NOT v_enforce OR v_step.allow_parallel THEN
        RETURN NULL;
    END IF;

    -- Earlier siblings at the same level, within this same run. Nesting means
    -- a child queues behind its siblings, not behind the whole procedure.
    SELECT array_agg(t.title ORDER BY sd.display_order)
      INTO v_blockers
      FROM "public"."tasks" t
      JOIN "public"."procedure_step_definitions" sd ON sd.id = t.procedure_step_id
     WHERE t.procedure_run_id = v_task.procedure_run_id
       AND sd.definition_id = v_step.definition_id
       AND sd.parent_step_id IS NOT DISTINCT FROM v_step.parent_step_id
       AND sd.display_order < v_step.display_order
       AND sd.allow_parallel = false
       AND t.status NOT IN ('completed', 'cancelled', 'skipped');

    RETURN v_blockers;
END;
$$;

ALTER FUNCTION "public"."task_blocking_predecessors"("uuid") OWNER TO "postgres";

-- ---------------------------------------------------------------------
-- Wire it into the gate
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."can_complete_task"("p_task_id" "uuid")
RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_task  RECORD;
    v_open  TEXT[];
    v_unmet TEXT[];
    v_prev  TEXT[];
BEGIN
    SELECT * INTO v_task FROM "public"."tasks" WHERE id = p_task_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('can_complete', false, 'reason', 'Task not found');
    END IF;

    v_prev := "public"."task_blocking_predecessors"(p_task_id);
    IF v_prev IS NOT NULL AND array_length(v_prev, 1) > 0 THEN
        RETURN jsonb_build_object(
            'can_complete', false,
            'reason', format('Earlier step%s not finished: %s',
                CASE WHEN array_length(v_prev,1) = 1 THEN '' ELSE 's' END,
                array_to_string(v_prev, ', ')),
            'blocking_predecessors', to_jsonb(v_prev)
        );
    END IF;

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

-- Starting out of order is the thing worth preventing; blocking only
-- completion would let someone do the work first and be refused afterwards.
CREATE OR REPLACE FUNCTION "public"."can_start_task"("p_task_id" "uuid")
RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_prev TEXT[];
BEGIN
    v_prev := "public"."task_blocking_predecessors"(p_task_id);
    IF v_prev IS NOT NULL AND array_length(v_prev, 1) > 0 THEN
        RETURN jsonb_build_object(
            'can_start', false,
            'reason', format('Earlier step%s not finished: %s',
                CASE WHEN array_length(v_prev,1) = 1 THEN '' ELSE 's' END,
                array_to_string(v_prev, ', ')),
            'blocking_predecessors', to_jsonb(v_prev)
        );
    END IF;
    RETURN jsonb_build_object('can_start', true);
END;
$$;

ALTER FUNCTION "public"."can_start_task"("uuid") OWNER TO "postgres";

-- Only instantiate current steps.
CREATE OR REPLACE FUNCTION "public"."start_procedure_run"(
    "p_definition_id" "uuid",
    "p_related_type"  "public"."task_related_type",
    "p_related_id"    "uuid",
    "p_user_id"       "uuid",
    "p_start_date"    "date" DEFAULT CURRENT_DATE
) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_def        RECORD;
    v_step       RECORD;
    v_run_id     "uuid";
    v_task_id    "uuid";
    v_parent_map "jsonb" := '{}'::jsonb;
    v_assignee   "uuid";
    v_count      integer := 0;
    v_upload     text;
BEGIN
    SELECT * INTO v_def FROM "public"."procedure_definitions"
     WHERE id = p_definition_id AND is_active = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Procedure not found or inactive');
    END IF;

    IF v_def.applies_to <> p_related_type THEN
        RETURN jsonb_build_object('success', false,
            'error', format('This procedure applies to %s, not %s', v_def.applies_to, p_related_type));
    END IF;

    INSERT INTO "public"."procedure_runs" (
        tenant_id, definition_id, definition_version, definition_name,
        related_type, related_id, started_by
    ) VALUES (
        v_def.tenant_id, v_def.id, v_def.version, v_def.name,
        p_related_type, p_related_id, p_user_id
    ) RETURNING id INTO v_run_id;

    FOR v_step IN
        SELECT * FROM "public"."procedure_step_definitions"
         WHERE definition_id = p_definition_id
           AND is_current = true
         ORDER BY (parent_step_id IS NOT NULL), display_order, created_at
    LOOP
        v_assignee := NULL;
        IF v_step.assign_to_role IS NOT NULL THEN
            IF (SELECT COUNT(DISTINCT u.id)
                  FROM "public"."users" u
                  JOIN "public"."user_roles" ur ON ur.user_id = u.id
                  JOIN "public"."roles" r ON r.id = ur.role_id
                 WHERE u.tenant_id = v_def.tenant_id
                   AND u.status = 'active'
                   AND r.slug = v_step.assign_to_role) = 1 THEN
                SELECT DISTINCT u.id INTO v_assignee
                  FROM "public"."users" u
                  JOIN "public"."user_roles" ur ON ur.user_id = u.id
                  JOIN "public"."roles" r ON r.id = ur.role_id
                 WHERE u.tenant_id = v_def.tenant_id
                   AND u.status = 'active'
                   AND r.slug = v_step.assign_to_role;
            END IF;
        END IF;

        INSERT INTO "public"."tasks" (
            tenant_id, task_number, title, description, priority, status,
            parent_task_id, procedure_run_id, procedure_step_id,
            related_type, related_id, start_date, due_date, estimated_hours,
            assigned_to, created_by, updated_by
        ) VALUES (
            v_def.tenant_id,
            "public"."generate_task_number"(v_def.tenant_id),
            v_step.title,
            COALESCE(v_step.instructions, v_step.description),
            COALESCE(v_step.priority, 'medium'),
            'todo',
            CASE WHEN v_step.parent_step_id IS NOT NULL
                 THEN (v_parent_map->>v_step.parent_step_id::text)::uuid END,
            v_run_id, v_step.id, p_related_type, p_related_id, p_start_date,
            CASE WHEN v_step.relative_due_days IS NOT NULL
                 THEN p_start_date + v_step.relative_due_days END,
            v_step.estimated_hours, v_assignee, p_user_id, p_user_id
        ) RETURNING id INTO v_task_id;

        IF v_step.parent_step_id IS NULL THEN
            v_parent_map := v_parent_map || jsonb_build_object(v_step.id::text, v_task_id::text);
        END IF;

        v_count := v_count + 1;

        IF v_step.action_type = 'upload' THEN
            IF v_step.required_upload_types IS NULL
               OR array_length(v_step.required_upload_types, 1) IS NULL THEN
                INSERT INTO "public"."task_completion_requirements"
                    (task_id, requirement_type, requirement_key, requirement_label)
                VALUES (v_task_id, 'upload', 'any_file', 'Attach at least one file');
            ELSE
                FOREACH v_upload IN ARRAY v_step.required_upload_types LOOP
                    INSERT INTO "public"."task_completion_requirements"
                        (task_id, requirement_type, requirement_key, requirement_label)
                    VALUES (v_task_id, 'upload', v_upload, format('Attach: %s', v_upload));
                END LOOP;
            END IF;
        ELSIF v_step.action_type = 'approval' THEN
            INSERT INTO "public"."task_completion_requirements"
                (task_id, requirement_type, requirement_key, requirement_label)
            VALUES (v_task_id, 'approval', COALESCE(v_step.approval_role, 'any'),
                    format('Approval from %s', COALESCE(v_step.approval_role, 'an approver')));
        ELSIF v_step.action_type = 'form' AND v_step.form_schema IS NOT NULL THEN
            INSERT INTO "public"."task_completion_requirements"
                (task_id, requirement_type, requirement_key, requirement_label)
            VALUES (v_task_id, 'form', 'form_complete', 'Fill in the required fields');
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 'run_id', v_run_id,
        'definition_name', v_def.name, 'steps_created', v_count
    );
END;
$$;

GRANT ALL ON FUNCTION "public"."can_start_task"("uuid") TO "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."task_blocking_predecessors"("uuid") TO "authenticated", "service_role";
