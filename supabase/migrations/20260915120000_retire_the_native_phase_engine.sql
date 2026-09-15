-- Retire the native phase engine. Playbooks are the one way a project is planned.
--
-- SoftInterio grew two engines for the same idea. `project_phases` and its
-- sixteen satellite tables were the first attempt: a phase tree copied from
-- templates at handover, with its own statuses, sub-phases, checklists,
-- approvals, comments and progress triggers. Playbooks (`procedure_*`) are the
-- second and the one in use: they version, nest, gate, carry hours, attach to
-- anything, and execute as ordinary tasks - which is why every product idea
-- from here on (baselines, delay attribution, milestones that drive status)
-- was designed on tasks and would have had to be built twice.
--
-- What is on the live database at the moment of this migration, verified
-- before writing it rather than assumed:
--
--   * one project carries native phases: PRJ-25-0002 (Amulya), 6 phases and
--     18 sub-phases, every one of them `not_started`, created by
--     initialize_project_phases at handover and never touched;
--   * zero rows in activity log, approvals, attachments, comments, status
--     logs, assignees, checklist items and completion requirements;
--   * projects.current_phase_id is null on both projects;
--   * no payment milestone links a phase (the table is empty);
--   * the five global payment milestone *templates* name a phase template as
--     their trigger. That mapping is recorded below so a finance module can
--     re-express it against playbook steps:
--
--         Booking Advance      10%  on_start       Project Kickoff
--         Design Approval      20%  on_completion  Design
--         Production Start     30%  on_start       Procurement
--         Before Installation  30%  on_start       Installation
--         Final Payment        10%  on_completion  Handover
--
-- So nothing recorded about any project is lost. Amulya becomes what the new
-- flow wants anyway: a `new` project with no plan, waiting for its project
-- manager to choose a playbook.
--
-- The migration guards rather than guesses. If any phase or sub-phase has
-- moved past `not_started`, or any of the record-keeping tables holds a row,
-- it refuses, because then there is history that a drop would destroy.

DO $$
DECLARE
  v_started INT;
  v_records INT;
BEGIN
  SELECT COUNT(*) INTO v_started
    FROM (
      SELECT 1 FROM public.project_phases     WHERE status <> 'not_started'
      UNION ALL
      SELECT 1 FROM public.project_sub_phases WHERE status <> 'not_started'
    ) s;
  IF v_started > 0 THEN
    RAISE EXCEPTION 'Refusing to retire native phases: % phase/sub-phase row(s) have been worked on', v_started;
  END IF;

  SELECT
    (SELECT COUNT(*) FROM public.project_phase_activity_log) +
    (SELECT COUNT(*) FROM public.project_phase_approvals) +
    (SELECT COUNT(*) FROM public.project_phase_attachments) +
    (SELECT COUNT(*) FROM public.project_phase_comments) +
    (SELECT COUNT(*) FROM public.project_phase_status_logs) +
    (SELECT COUNT(*) FROM public.project_checklist_items) +
    (SELECT COUNT(*) FROM public.sub_phase_completion_requirements) +
    (SELECT COUNT(*) FROM public.project_payment_milestones WHERE linked_phase_id IS NOT NULL)
  INTO v_records;
  IF v_records > 0 THEN
    RAISE EXCEPTION 'Refusing to retire native phases: % record(s) reference them', v_records;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Functions that still had a phase branch and are kept.
-- ---------------------------------------------------------------------------

-- Progress: the active playbook run answers, and nothing else.
CREATE OR REPLACE FUNCTION "public"."calculate_project_progress"("p_project_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_total INT;
    v_done INT;
BEGIN
    SELECT COUNT(*),
           COUNT(*) FILTER (WHERE t.status IN ('completed', 'skipped', 'cancelled'))
      INTO v_total, v_done
      FROM tasks t
      JOIN procedure_runs pr ON pr.id = t.procedure_run_id
     WHERE pr.related_type = 'project'
       AND pr.related_id = p_project_id
       AND pr.status = 'active';

    IF v_total = 0 THEN RETURN 0; END IF;
    RETURN ROUND(v_done::DECIMAL * 100 / v_total);
END;
$$;

COMMENT ON FUNCTION "public"."calculate_project_progress"("p_project_id" "uuid") IS
  'Overall project progress: settled steps over all steps of the active playbook run. Zero without a run.';

-- Handover: same function without the phase block. The parameter list
-- changes (p_initialize_phases goes), so this is a drop and create rather
-- than a replace - and the one caller, the lead transition route, is updated
-- in the same change.
DROP FUNCTION IF EXISTS "public"."create_project_from_lead"("uuid", "uuid", "text", boolean, "uuid", "uuid", "text", "date", "date");

CREATE FUNCTION "public"."create_project_from_lead"(
    "p_lead_id" "uuid",
    "p_created_by" "uuid",
    "p_project_category" "text" DEFAULT 'turnkey'::"text",
    "p_quotation_id" "uuid" DEFAULT NULL::"uuid",
    "p_project_manager_id" "uuid" DEFAULT NULL::"uuid",
    "p_priority" "text" DEFAULT 'Low'::"text",
    "p_target_start_date" "date" DEFAULT NULL::"date",
    "p_target_end_date" "date" DEFAULT NULL::"date"
) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_lead RECORD;
    v_project_id UUID;
    v_project_number TEXT;
    v_quotation_id UUID := p_quotation_id;
    v_client_id UUID;
    v_property_id UUID;
    v_project_name TEXT;
    v_client_name TEXT;
    v_property_name TEXT;
BEGIN
    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found: %', p_lead_id;
    END IF;

    v_client_id := v_lead.client_id;
    v_property_id := v_lead.property_id;

    -- Already converted: hand back the existing project.
    IF v_lead.project_id IS NOT NULL THEN
        RETURN v_lead.project_id;
    END IF;

    IF v_quotation_id IS NULL THEN
        SELECT id INTO v_quotation_id FROM quotations
        WHERE lead_id = p_lead_id
        ORDER BY created_at DESC LIMIT 1;
    END IF;

    BEGIN
        SELECT generate_project_number(v_lead.tenant_id) INTO v_project_number;
    EXCEPTION WHEN OTHERS THEN
        v_project_number := 'PRJ_' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '_' || floor(random() * 100000)::text;
    END;

    SELECT name INTO v_client_name FROM clients WHERE id = v_client_id;
    SELECT property_name INTO v_property_name FROM properties WHERE id = v_property_id;
    v_project_name := COALESCE(v_client_name, 'New') || '-' || COALESCE(v_property_name, 'Property');

    INSERT INTO projects (
        tenant_id, project_number, name, description,
        client_id, property_id, project_category,
        expected_start_date, expected_end_date,
        actual_cost, contract_value,
        lead_id, quotation_id, status, priority,
        project_manager_id, created_by, is_active
    ) VALUES (
        v_lead.tenant_id,
        v_project_number,
        v_project_name,
        NULL, -- no description column on leads to carry
        v_client_id,
        v_property_id,
        v_lead.service_type::project_category_enum, -- the enums are the same list
        COALESCE(p_target_start_date, v_lead.expected_project_start, v_lead.target_start_date, CURRENT_DATE),
        COALESCE(p_target_end_date, v_lead.target_end_date),
        0,                  -- actual_cost is money spent, and none has been yet
        v_lead.won_amount,  -- the agreed value, frozen at handover
        p_lead_id,
        v_quotation_id,
        'new',
        p_priority::project_priority_enum,
        p_project_manager_id,
        p_created_by,
        true
    ) RETURNING id INTO v_project_id;

    -- The plan is not created here. A project starts with no plan; the
    -- playbook is chosen at kick-off (or auto-started by category, which the
    -- application does after this returns).

    UPDATE leads
    SET project_id = v_project_id,
        updated_at = NOW()
    WHERE id = p_lead_id;

    -- Documents are copied; notes are re-pointed.
    INSERT INTO documents (
        tenant_id, linked_type, linked_id,
        file_name, original_name, file_type, file_extension, file_size,
        storage_bucket, storage_path, category, title, description, tags,
        version, parent_id, is_latest, uploaded_by, created_at, updated_at
    )
    SELECT
        d.tenant_id, 'project'::public.document_linked_type, v_project_id,
        d.file_name, d.original_name, d.file_type, d.file_extension, d.file_size,
        d.storage_bucket, d.storage_path, d.category, d.title, d.description, d.tags,
        d.version, d.parent_id, d.is_latest, d.uploaded_by, NOW(), NOW()
    FROM documents d
    WHERE d.linked_type = 'lead'::public.document_linked_type
      AND d.linked_id = p_lead_id;

    UPDATE lead_notes
    SET project_id = v_project_id,
        updated_at = NOW()
    WHERE lead_id = p_lead_id
      AND project_id IS NULL;

    RETURN v_project_id;
END;
$$;

COMMENT ON FUNCTION "public"."create_project_from_lead"("uuid", "uuid", "text", "uuid", "uuid", "text", "date", "date") IS
  'Creates the project for a won lead: client and property by id, quotation, dates, documents copied, notes re-pointed. No plan - that is chosen at kick-off.';

-- ---------------------------------------------------------------------------
-- 2. Columns on surviving tables that pointed into the cluster.
-- ---------------------------------------------------------------------------

ALTER TABLE "public"."projects"
  DROP COLUMN IF EXISTS "current_phase_id";

-- Payments are parked. When a finance module arrives, a milestone will hang
-- off a playbook step (by step_key on the template, by task on the project),
-- not off a phase. The mapping the templates carried is in the header comment.
--
-- project_payment_milestones_view joined the phase in; it is read by nothing
-- in the application today and is kept, like PaymentsTab, for that module -
-- so it is recreated without the phase columns rather than dropped. (Dropped
-- and created: CREATE OR REPLACE cannot remove a view's columns.)
DROP VIEW IF EXISTS "public"."project_payment_milestones_view";
CREATE VIEW "public"."project_payment_milestones_view" WITH ("security_invoker"='true') AS
 SELECT "pm"."id",
    "pm"."project_id",
    "pm"."name",
    "pm"."description",
    "pm"."percentage",
    "pm"."amount",
    "pm"."status",
    "pm"."due_date",
    "pm"."paid_at",
    "pm"."payment_reference",
    "p"."project_number",
    "p"."name" AS "project_name",
    "p"."tenant_id"
   FROM ("public"."project_payment_milestones" "pm"
     JOIN "public"."projects" "p" ON (("pm"."project_id" = "p"."id")));

COMMENT ON VIEW "public"."project_payment_milestones_view" IS
  'Payment milestones with their project. Parked with the finance module; read by nothing in the app today.';
GRANT ALL ON TABLE "public"."project_payment_milestones_view" TO "authenticated";
GRANT ALL ON TABLE "public"."project_payment_milestones_view" TO "service_role";

ALTER TABLE "public"."project_payment_milestones"
  DROP COLUMN IF EXISTS "linked_phase_id";

ALTER TABLE "public"."project_payment_milestone_templates"
  DROP COLUMN IF EXISTS "trigger_phase_template_id";

-- ---------------------------------------------------------------------------
-- 3. The engine itself. Triggers and policies go with their tables; the
--    functions are dropped explicitly because nothing depends on them and a
--    stray trigger created later could otherwise resurrect one.
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS "public"."project_phases_summary";

DROP FUNCTION IF EXISTS "public"."calculate_phase_progress"("uuid");
DROP FUNCTION IF EXISTS "public"."calculate_sub_phase_progress"("uuid");
DROP FUNCTION IF EXISTS "public"."can_complete_sub_phase"("uuid");
DROP FUNCTION IF EXISTS "public"."can_phase_start"("uuid");
DROP FUNCTION IF EXISTS "public"."can_start_phase"("uuid");
DROP FUNCTION IF EXISTS "public"."can_start_sub_phase"("uuid");
DROP FUNCTION IF EXISTS "public"."complete_sub_phase"("uuid", "uuid", "text");
DROP FUNCTION IF EXISTS "public"."get_project_workflow"("uuid");
DROP FUNCTION IF EXISTS "public"."initialize_project_phases"("uuid", "uuid", "text");
DROP FUNCTION IF EXISTS "public"."initialize_project_phases_v2"("uuid", "uuid", "text");
DROP FUNCTION IF EXISTS "public"."insert_project_sub_phase"("uuid", "uuid", character varying, integer);
DROP FUNCTION IF EXISTS "public"."reinitialize_all_project_phases"("uuid");
DROP FUNCTION IF EXISTS "public"."reinitialize_project_phases"("uuid");
DROP FUNCTION IF EXISTS "public"."skip_sub_phase"("uuid", "uuid", "text");
DROP FUNCTION IF EXISTS "public"."start_sub_phase"("uuid", "uuid");

-- Trigger functions. Their triggers sit on the phase tables and vanish with
-- them; CASCADE covers any that do not.
DROP FUNCTION IF EXISTS "public"."trg_update_phase_progress"() CASCADE;
DROP FUNCTION IF EXISTS "public"."trg_update_sub_phase_progress"() CASCADE;
DROP FUNCTION IF EXISTS "public"."update_phase_progress"() CASCADE;
DROP FUNCTION IF EXISTS "public"."update_project_progress"() CASCADE;
DROP FUNCTION IF EXISTS "public"."trg_update_project_progress"() CASCADE;
DROP FUNCTION IF EXISTS "public"."trg_update_payment_milestone_status"() CASCADE;

-- Tables, children first. CASCADE takes the 31 RLS policies, the indexes and
-- the foreign keys between them.
DROP TABLE IF EXISTS "public"."sub_phase_completion_requirements" CASCADE;
DROP TABLE IF EXISTS "public"."project_checklist_items" CASCADE;
DROP TABLE IF EXISTS "public"."project_sub_phase_assignees" CASCADE;
DROP TABLE IF EXISTS "public"."project_phase_status_logs" CASCADE;
DROP TABLE IF EXISTS "public"."project_phase_comments" CASCADE;
DROP TABLE IF EXISTS "public"."project_phase_attachments" CASCADE;
DROP TABLE IF EXISTS "public"."project_phase_approvals" CASCADE;
DROP TABLE IF EXISTS "public"."project_phase_activity_log" CASCADE;
DROP TABLE IF EXISTS "public"."project_phase_dependencies" CASCADE;
DROP TABLE IF EXISTS "public"."project_sub_phases" CASCADE;
DROP TABLE IF EXISTS "public"."project_phases" CASCADE;
DROP TABLE IF EXISTS "public"."project_phase_dependency_templates" CASCADE;
DROP TABLE IF EXISTS "public"."project_sub_phase_templates" CASCADE;
DROP TABLE IF EXISTS "public"."project_phase_templates" CASCADE;
DROP TABLE IF EXISTS "public"."project_phase_groups" CASCADE;
DROP TABLE IF EXISTS "public"."project_phase_categories" CASCADE;

-- Enum types used only by the tables above. procedure_step_definitions has
-- its own procedure_action_type; procedure_step_dependencies does not use
-- phase_dependency_type_enum. Checked against the schema before listing.
DROP TYPE IF EXISTS "public"."project_phase_status_enum";
DROP TYPE IF EXISTS "public"."project_sub_phase_status_enum";
DROP TYPE IF EXISTS "public"."phase_comment_type_enum";
DROP TYPE IF EXISTS "public"."phase_dependency_type_enum";
DROP TYPE IF EXISTS "public"."sub_phase_action_type";
DROP TYPE IF EXISTS "public"."sub_phase_action_type_enum";

-- Progress was last written by the phase trigger for any project that had
-- phases; recompute from the one source that remains.
UPDATE projects
   SET overall_progress = calculate_project_progress(id)
 WHERE is_active = true;
