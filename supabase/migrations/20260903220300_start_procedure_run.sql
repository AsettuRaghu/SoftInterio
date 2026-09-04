-- Migration: instantiate a procedure as tasks
-- Created: 2026-09-03
--
-- start_procedure_run() turns a definition into live work: one task per step,
-- nested steps becoming subtasks, plus the completion requirements that gate
-- each one.
--
-- Assignment: assign_to_role is resolved only when EXACTLY ONE person in the
-- tenant holds that role. Two candidates means the system does not know who
-- should do it, so the step is left unassigned as a team queue rather than
-- guessing an owner who then ignores it.

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

    -- Version and name are snapshotted: editing the definition later must not
    -- rewrite the rules of a run already under way.
    INSERT INTO "public"."procedure_runs" (
        tenant_id, definition_id, definition_version, definition_name,
        related_type, related_id, started_by
    ) VALUES (
        v_def.tenant_id, v_def.id, v_def.version, v_def.name,
        p_related_type, p_related_id, p_user_id
    ) RETURNING id INTO v_run_id;

    -- Parents before children, so parent_step_id can be mapped to a real task.
    FOR v_step IN
        SELECT * FROM "public"."procedure_step_definitions"
         WHERE definition_id = p_definition_id
         ORDER BY (parent_step_id IS NOT NULL), display_order, created_at
    LOOP
        v_assignee := NULL;
        IF v_step.assign_to_role IS NOT NULL THEN
            SELECT u.id INTO v_assignee
              FROM "public"."users" u
              JOIN "public"."user_roles" ur ON ur.user_id = u.id
              JOIN "public"."roles" r ON r.id = ur.role_id
             WHERE u.tenant_id = v_def.tenant_id
               AND u.status = 'active'
               AND r.slug = v_step.assign_to_role
             GROUP BY u.id
             HAVING COUNT(*) > 0;

            -- More than one holder: leave it for the team queue.
            IF (SELECT COUNT(DISTINCT u.id)
                  FROM "public"."users" u
                  JOIN "public"."user_roles" ur ON ur.user_id = u.id
                  JOIN "public"."roles" r ON r.id = ur.role_id
                 WHERE u.tenant_id = v_def.tenant_id
                   AND u.status = 'active'
                   AND r.slug = v_step.assign_to_role) <> 1 THEN
                v_assignee := NULL;
            END IF;
        END IF;

        INSERT INTO "public"."tasks" (
            tenant_id, task_number, title, description,
            priority, status,
            parent_task_id,
            procedure_run_id, procedure_step_id,
            related_type, related_id,
            start_date, due_date, estimated_hours,
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
            v_run_id,
            v_step.id,
            p_related_type,
            p_related_id,
            p_start_date,
            CASE WHEN v_step.relative_due_days IS NOT NULL
                 THEN p_start_date + v_step.relative_due_days END,
            v_step.estimated_hours,
            v_assignee,
            p_user_id, p_user_id
        ) RETURNING id INTO v_task_id;

        IF v_step.parent_step_id IS NULL THEN
            v_parent_map := v_parent_map || jsonb_build_object(v_step.id::text, v_task_id::text);
        END IF;

        v_count := v_count + 1;

        -- Materialise the gates. These are what can_complete_task() checks.
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
        'success', true,
        'run_id', v_run_id,
        'definition_name', v_def.name,
        'steps_created', v_count
    );
END;
$$;

ALTER FUNCTION "public"."start_procedure_run"("uuid", "public"."task_related_type", "uuid", "uuid", "date") OWNER TO "postgres";

-- ---------------------------------------------------------------------
-- Upload gates satisfy themselves when a file lands on the task
-- ---------------------------------------------------------------------

-- Task files are documents with linked_type='task', so watch that table.
CREATE OR REPLACE FUNCTION "public"."trg_satisfy_upload_requirement"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF NEW.linked_type <> 'task' THEN
        RETURN NULL;
    END IF;

    UPDATE "public"."task_completion_requirements"
       SET is_satisfied = true,
           satisfied_at = now(),
           satisfied_by = NEW.uploaded_by,
           reference_type = 'document',
           reference_id = NEW.id
     WHERE task_id = NEW.linked_id
       AND requirement_type = 'upload'
       AND is_satisfied = false;

    RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."trg_satisfy_upload_requirement"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "trg_documents_satisfy_upload" ON "public"."documents";
CREATE TRIGGER "trg_documents_satisfy_upload"
    AFTER INSERT ON "public"."documents"
    FOR EACH ROW EXECUTE FUNCTION "public"."trg_satisfy_upload_requirement"();

-- ---------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------

ALTER TABLE "public"."procedure_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."procedure_step_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."procedure_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."task_completion_requirements" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "procedure_definitions_access" ON "public"."procedure_definitions";
CREATE POLICY "procedure_definitions_access" ON "public"."procedure_definitions"
    USING ("tenant_id" = "public"."get_user_tenant_id"());

DROP POLICY IF EXISTS "procedure_step_definitions_access" ON "public"."procedure_step_definitions";
CREATE POLICY "procedure_step_definitions_access" ON "public"."procedure_step_definitions"
    USING ("definition_id" IN (SELECT id FROM "public"."procedure_definitions"
                                WHERE tenant_id = "public"."get_user_tenant_id"()));

DROP POLICY IF EXISTS "procedure_runs_access" ON "public"."procedure_runs";
CREATE POLICY "procedure_runs_access" ON "public"."procedure_runs"
    USING ("tenant_id" = "public"."get_user_tenant_id"());

DROP POLICY IF EXISTS "task_completion_requirements_access" ON "public"."task_completion_requirements";
CREATE POLICY "task_completion_requirements_access" ON "public"."task_completion_requirements"
    USING ("task_id" IN (SELECT id FROM "public"."tasks"
                          WHERE tenant_id = "public"."get_user_tenant_id"()));

GRANT ALL ON TABLE "public"."procedure_definitions" TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."procedure_step_definitions" TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."procedure_runs" TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."task_completion_requirements" TO "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."can_complete_task"("uuid") TO "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."start_procedure_run"("uuid", "public"."task_related_type", "uuid", "uuid", "date") TO "authenticated", "service_role";
