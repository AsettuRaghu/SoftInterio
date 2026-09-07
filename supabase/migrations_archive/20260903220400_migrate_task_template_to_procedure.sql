-- Migration: convert the existing task template into a procedure
-- Created: 2026-09-03
--
-- "Modular Design Template" - 25 items, never once instantiated. It reads as a
-- design workflow with review and approval checkpoints, which is precisely
-- what a task template could not express: no ordering (every sort_order was
-- 0-3 with duplicates), no gates, no assignment. That is why it was never used.
--
-- Converting it gives Procedures a real workload to be proven against rather
-- than an invented example. Step action types are inferred from the titles the
-- team actually wrote:
--   "Site Measurement Collection", "Collect all the drawings" -> upload
--   "Internal Review", "Client Confirmation", "Approved version" -> approval
--   "Client Visit scheduled", "Client Discussion", "Presentation" -> meeting
--   everything else -> manual
--
-- task_templates is left in place but deactivated. Dropping it is a separate
-- decision once the Procedures UI replaces the Task Templates page.

DO $$
DECLARE
    v_tpl        RECORD;
    v_def_id     "uuid";
    v_item       RECORD;
    v_step_id    "uuid";
    v_map        "jsonb" := '{}'::jsonb;
    v_action     "public"."procedure_action_type";
    v_order      integer := 0;
BEGIN
    FOR v_tpl IN SELECT * FROM "public"."task_templates" WHERE is_active = true LOOP

        -- Skip if already converted.
        IF EXISTS (SELECT 1 FROM "public"."procedure_definitions"
                    WHERE tenant_id = v_tpl.tenant_id AND name = v_tpl.name) THEN
            CONTINUE;
        END IF;

        INSERT INTO "public"."procedure_definitions" (
            tenant_id, name, description, applies_to, is_active, is_protected,
            created_by
        ) VALUES (
            v_tpl.tenant_id,
            v_tpl.name,
            COALESCE(v_tpl.description,
                     'Converted from the task template of the same name.'),
            'project',
            true,
            v_tpl.is_protected,
            v_tpl.created_by
        ) RETURNING id INTO v_def_id;

        v_order := 0;
        v_map := '{}'::jsonb;

        FOR v_item IN
            SELECT * FROM "public"."task_template_items"
             WHERE template_id = v_tpl.id
             ORDER BY (parent_item_id IS NOT NULL), sort_order, created_at
        LOOP
            v_action := CASE
                WHEN v_item.title ILIKE '%measurement%'
                  OR v_item.title ILIKE '%collect%'
                  OR v_item.title ILIKE '%drawing%'
                  OR v_item.title ILIKE '%photo%'      THEN 'upload'
                WHEN v_item.title ILIKE '%review%'
                  OR v_item.title ILIKE '%confirmation%'
                  OR v_item.title ILIKE '%approved%'
                  OR v_item.title ILIKE '%approval%'   THEN 'approval'
                WHEN v_item.title ILIKE '%visit%'
                  OR v_item.title ILIKE '%discussion%'
                  OR v_item.title ILIKE '%presentation%'
                  OR v_item.title ILIKE '%meeting%'    THEN 'meeting'
                WHEN v_item.title ILIKE '%handover%'   THEN 'handover'
                ELSE 'manual'
            END::"public"."procedure_action_type";

            v_order := v_order + 1;

            INSERT INTO "public"."procedure_step_definitions" (
                definition_id, parent_step_id, title, description,
                display_order, action_type,
                assign_to_role, relative_due_days, estimated_hours, priority,
                is_required, can_skip
            ) VALUES (
                v_def_id,
                CASE WHEN v_item.parent_item_id IS NOT NULL
                     THEN (v_map->>v_item.parent_item_id::text)::uuid END,
                v_item.title,
                v_item.description,
                v_order,
                v_action,
                v_item.assign_to_role,
                v_item.relative_due_days,
                v_item.estimated_hours,
                COALESCE(v_item.priority, 'medium'),
                true,
                -- Meetings and reviews are the ones that genuinely may not
                -- apply on a given project; evidence steps are not skippable.
                v_action IN ('meeting', 'manual')
            ) RETURNING id INTO v_step_id;

            IF v_item.parent_item_id IS NULL THEN
                v_map := v_map || jsonb_build_object(v_item.id::text, v_step_id::text);
            END IF;
        END LOOP;

        RAISE NOTICE 'Converted template "%" into a procedure with % steps',
                     v_tpl.name, v_order;
    END LOOP;
END $$;

-- Deactivated, not deleted: the Task Templates page still renders it until the
-- Procedures UI replaces that menu item.
UPDATE "public"."task_templates" SET is_active = false WHERE is_active = true;
COMMENT ON TABLE "public"."task_templates" IS 'SUPERSEDED by procedure_definitions. Kept read-only until the Procedures UI replaces the Task Templates page.';
