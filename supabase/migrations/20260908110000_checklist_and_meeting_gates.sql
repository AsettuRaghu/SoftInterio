-- Make checklist and meeting steps mean something.
--
-- Of the eight action types only upload and approval ever wrote a completion
-- requirement. checklist, meeting, assignment and handover coloured the chip
-- and changed nothing, so a step marked "checklist" completed as freely as a
-- manual one - the discipline the type implied was not there.
--
-- checklist_items lets the template say what has to be ticked. Each becomes a
-- requirement, and sign_off_requirement already accepts the checklist type.
--
-- A meeting step does not book anything. Booking is the calendar's job; what
-- the process depends on is that the meeting happened, so it asks for that to
-- be confirmed. The requirement is typed manual because that is what sign-off
-- accepts today.
--
-- assignment and handover still write nothing. Neither has an obvious gate,
-- and inventing one would be worse than leaving them honest labels.

ALTER TABLE "public"."procedure_step_definitions"
  ADD COLUMN IF NOT EXISTS "checklist_items" "text"[];

COMMENT ON COLUMN "public"."procedure_step_definitions"."checklist_items" IS
  'For a checklist step: each item becomes a completion requirement that must '
  'be ticked before the step can complete.';

CREATE OR REPLACE FUNCTION "public"."start_procedure_run"("p_definition_id" "uuid", "p_related_type" "public"."task_related_type", "p_related_id" "uuid", "p_user_id" "uuid", "p_start_date" "date" DEFAULT CURRENT_DATE) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_def         RECORD;
    v_step        RECORD;
    v_run_id      "uuid";
    v_task_id     "uuid";
    v_parent_map  "jsonb" := '{}'::jsonb;
    v_start_map   "jsonb" := '{}'::jsonb;  -- step_id -> that step's start date
    v_assignee    "uuid";
    v_count       integer := 0;
    v_upload      text;
    v_check       "text";
    v_cursor      date;
    v_last_parent "uuid";
    v_start       date;
    v_due         date;
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

    v_cursor := p_start_date;
    v_last_parent := NULL;

    -- Grouped by parent so a child cursor can walk one family at a time.
    FOR v_step IN
        SELECT * FROM "public"."procedure_step_definitions"
         WHERE definition_id = p_definition_id
           AND is_current = true
         ORDER BY (parent_step_id IS NOT NULL),
                  COALESCE(parent_step_id::text, ''),
                  display_order, created_at
    LOOP
        IF v_step.parent_step_id IS NULL THEN
            v_start := v_cursor;
        ELSE
            -- New family: restart from the parent's own start date.
            IF v_last_parent IS DISTINCT FROM v_step.parent_step_id THEN
                v_cursor := COALESCE(
                    (v_start_map->>v_step.parent_step_id::text)::date,
                    p_start_date
                );
                v_last_parent := v_step.parent_step_id;
            END IF;
            v_start := v_cursor;
        END IF;

        v_due := CASE WHEN v_step.duration_days IS NOT NULL
                      THEN v_start + v_step.duration_days END;

        -- Only an ordered procedure advances the cursor; otherwise every step
        -- is measured from the same starting point. A parallel step branches
        -- without pushing the sequence along.
        IF v_def.enforce_order
           AND NOT v_step.allow_parallel
           AND v_due IS NOT NULL THEN
            v_cursor := v_due;
        END IF;

        v_assignee := NULL;

        -- A named person wins. Naming someone in the playbook is an explicit
        -- decision, where a role is an inference - and the role branch below
        -- only assigns when exactly one person holds it, so on a team with two
        -- designers it declines to guess and the step arrives unowned.
        IF v_step.assign_to_user IS NOT NULL THEN
            SELECT u.id INTO v_assignee
              FROM "public"."users" u
             WHERE u.id = v_step.assign_to_user
               AND u.tenant_id = v_def.tenant_id
               AND u.status = 'active';
        END IF;

        IF v_assignee IS NULL AND v_step.assign_to_role IS NOT NULL THEN
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
            v_run_id, v_step.id, p_related_type, p_related_id,
            v_start, v_due,
            v_step.estimated_hours, v_assignee, p_user_id, p_user_id
        ) RETURNING id INTO v_task_id;

        IF v_step.parent_step_id IS NULL THEN
            v_parent_map := v_parent_map || jsonb_build_object(v_step.id::text, v_task_id::text);
            v_start_map  := v_start_map  || jsonb_build_object(v_step.id::text, v_start::text);
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
        ELSIF v_step.action_type = 'checklist' THEN
            -- One requirement per item, so the step cannot complete until each
            -- has been ticked. Without items it was indistinguishable from a
            -- manual step, which is how it behaved until now.
            IF v_step.checklist_items IS NOT NULL
               AND array_length(v_step.checklist_items, 1) IS NOT NULL THEN
                FOREACH v_check IN ARRAY v_step.checklist_items LOOP
                    INSERT INTO "public"."task_completion_requirements"
                        (task_id, requirement_type, requirement_key, requirement_label)
                    VALUES (v_task_id, 'checklist', left(v_check, 100), v_check);
                END LOOP;
            END IF;
        ELSIF v_step.action_type = 'meeting' THEN
            -- A meeting step does not book anything; it records that the
            -- meeting happened, which is the part the process depends on.
            INSERT INTO "public"."task_completion_requirements"
                (task_id, requirement_type, requirement_key, requirement_label)
            VALUES (v_task_id, 'manual', 'meeting_held',
                    'Confirm the meeting took place');
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 'run_id', v_run_id,
        'definition_name', v_def.name, 'steps_created', v_count
    );
END;
$$;