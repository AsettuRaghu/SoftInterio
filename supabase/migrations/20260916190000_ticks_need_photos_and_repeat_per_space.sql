-- A tick can ask for a photo, and a step's ticks can repeat once per space.
--
-- Three small additions to what already exists, plus one correction.
--
-- The correction first. 20260916180000 mirrored task_attachments into
-- documents - but task_attachments is a DEPRECATED, empty table; a file
-- attached to a task has been a `documents` row (linked_type = 'task',
-- parent_linked_* = the project) since before the baseline, and the
-- project's Documents tab has read those all along. The mirror could never
-- fire. It goes, and its intent - "a file attached to a step can be found by
-- its stage, step and space" - is done where the rows actually are: a
-- trigger tags every task document on insert.
--
-- Then the additions:
--   * procedure_step_definitions.checklist_lines  jsonb [{label, needs_photo}]
--     the ticks a checklist step carries, each saying whether a photo is the
--     only way to tick it. checklist_items (text[]) stays as the plain labels
--     so nothing reading it breaks; the API derives it from the lines.
--   * procedure_step_definitions.per_space  a checklist step's ticks repeat
--     once for every top-level space in the project's scope, so "photograph
--     each wall" is five ticks on a five-room project, each knowing its room.
--   * task_completion_requirements.needs_photo / scope_item_id  the tick's
--     copy of those two facts.
--   * documents.requirement_id  a photo attached to a tick. Attaching it ticks
--     the line; deleting the last photo un-ticks it; sign_off_requirement
--     refuses to tick a needs_photo line by hand.
--   * property_scope_items.scope_owner / scope_vendor_name  who does this
--     part of the scope: us, the client, a vendor, or nobody (excluded).

-- ---------------------------------------------------------------------------
-- 1. The mirror that could never fire
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS "trg_mirror_task_attachment" ON "public"."task_attachments";
DROP TRIGGER IF EXISTS "trg_unmirror_task_attachment" ON "public"."task_attachments";
DROP FUNCTION IF EXISTS "public"."mirror_task_attachment_to_documents"();
DROP FUNCTION IF EXISTS "public"."unmirror_task_attachment"();

-- ---------------------------------------------------------------------------
-- 2. Columns
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."procedure_step_definitions"
  ADD COLUMN IF NOT EXISTS "checklist_lines" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "per_space" boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN "public"."procedure_step_definitions"."checklist_lines" IS
  'The ticks of a checklist step: [{"label": text, "needs_photo": bool}]. checklist_items holds the same labels for older readers.';
COMMENT ON COLUMN "public"."procedure_step_definitions"."per_space" IS
  'Repeat this step''s ticks once per top-level space in the project''s scope.';

ALTER TABLE "public"."task_completion_requirements"
  ADD COLUMN IF NOT EXISTS "needs_photo" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "scope_item_id" uuid REFERENCES "public"."property_scope_items"("id") ON DELETE SET NULL;

ALTER TABLE "public"."documents"
  ADD COLUMN IF NOT EXISTS "requirement_id" uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_requirement_id_fkey') THEN
    ALTER TABLE "public"."documents"
      ADD CONSTRAINT "documents_requirement_id_fkey" FOREIGN KEY ("requirement_id")
      REFERENCES "public"."task_completion_requirements"("id") ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "idx_documents_requirement" ON "public"."documents" ("requirement_id") WHERE "requirement_id" IS NOT NULL;

ALTER TABLE "public"."property_scope_items"
  ADD COLUMN IF NOT EXISTS "scope_owner" text NOT NULL DEFAULT 'us',
  ADD COLUMN IF NOT EXISTS "scope_vendor_name" text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_scope_items_scope_owner_check') THEN
    ALTER TABLE "public"."property_scope_items"
      ADD CONSTRAINT "property_scope_items_scope_owner_check"
      CHECK ("scope_owner" IN ('us', 'client', 'vendor', 'excluded'));
  END IF;
END $$;
COMMENT ON COLUMN "public"."property_scope_items"."scope_owner" IS
  'Who does this part: us, the client, a vendor the client appointed, or nobody (excluded from scope, named so nobody assumes it later).';

-- ---------------------------------------------------------------------------
-- 3. A checklist step's ticks, with photos and per-space repetition
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."create_step_requirements"(
    "p_task_id" "uuid", "p_step_id" "uuid"
) RETURNS integer
    LANGUAGE "plpgsql"
    AS $fn$
DECLARE
    v_step    RECORD;
    v_task    RECORD;
    v_task_id UUID := p_task_id;
    v_upload  "text";
    v_line    jsonb;
    v_lines   jsonb;
    v_space   RECORD;
    v_spaces  INT := 0;
    v_before  INT;
    v_after   INT;
BEGIN
    SELECT * INTO v_step
      FROM "public"."procedure_step_definitions"
     WHERE id = p_step_id;

    IF NOT FOUND THEN RETURN 0; END IF;

    SELECT COUNT(*) INTO v_before
      FROM "public"."task_completion_requirements" WHERE task_id = p_task_id;

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
            -- The lines: checklist_lines when the editor has written them,
            -- otherwise the plain labels an older playbook carries.
            IF jsonb_typeof(v_step.checklist_lines) = 'array'
               AND jsonb_array_length(v_step.checklist_lines) > 0 THEN
                v_lines := v_step.checklist_lines;
            ELSIF v_step.checklist_items IS NOT NULL
               AND array_length(v_step.checklist_items, 1) IS NOT NULL THEN
                SELECT jsonb_agg(jsonb_build_object('label', x, 'needs_photo', false))
                  INTO v_lines FROM unnest(v_step.checklist_items) AS x;
            ELSE
                v_lines := '[]'::jsonb;
            END IF;

            -- Per space: one tick per line per top-level space of the
            -- project's scope, each knowing its room. A project with no
            -- spaces listed gets the plain lines - there is nothing to
            -- repeat over, and a step with no ticks would be worse.
            IF v_step.per_space THEN
                SELECT t.related_type, t.related_id INTO v_task
                  FROM "public"."tasks" t WHERE t.id = p_task_id;
                IF v_task.related_type = 'project' THEN
                    FOR v_space IN
                        SELECT s.id, s.name
                          FROM "public"."property_scope_items" s
                          JOIN "public"."projects" p ON p.property_id = s.property_id
                         WHERE p.id = v_task.related_id
                           AND s.parent_id IS NULL
                           AND s.scope_owner <> 'excluded'
                         ORDER BY s.display_order, s.name
                    LOOP
                        v_spaces := v_spaces + 1;
                        FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
                            INSERT INTO "public"."task_completion_requirements"
                                (task_id, requirement_type, requirement_key, requirement_label,
                                 needs_photo, scope_item_id)
                            VALUES (v_task_id, 'checklist',
                                    left((v_line->>'label') || ' @ ' || v_space.name, 100),
                                    (v_line->>'label') || ' — ' || v_space.name,
                                    COALESCE((v_line->>'needs_photo')::boolean, false),
                                    v_space.id);
                        END LOOP;
                    END LOOP;
                END IF;
            END IF;

            IF v_spaces = 0 THEN
                FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
                    INSERT INTO "public"."task_completion_requirements"
                        (task_id, requirement_type, requirement_key, requirement_label, needs_photo)
                    VALUES (v_task_id, 'checklist', left(v_line->>'label', 100), v_line->>'label',
                            COALESCE((v_line->>'needs_photo')::boolean, false));
                END LOOP;
            END IF;
        ELSIF v_step.action_type = 'meeting' THEN
            INSERT INTO "public"."task_completion_requirements"
                (task_id, requirement_type, requirement_key, requirement_label)
            VALUES (v_task_id, 'manual', 'meeting_held',
                    'Confirm the meeting took place');
        END IF;

    SELECT COUNT(*) INTO v_after
      FROM "public"."task_completion_requirements" WHERE task_id = p_task_id;

    RETURN v_after - v_before;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. A needs-photo tick is ticked by the photo, not by hand
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."sign_off_requirement"("p_requirement_id" "uuid", "p_user_id" "uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_req RECORD;
BEGIN
    SELECT * INTO v_req FROM "public"."task_completion_requirements"
     WHERE id = p_requirement_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Requirement not found');
    END IF;

    IF v_req.requirement_type NOT IN ('approval', 'checklist', 'manual') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format(
                'A %s requirement is satisfied by doing the thing, not by confirming it.',
                v_req.requirement_type)
        );
    END IF;

    -- The photo is the tick. Confirming without one would make every
    -- "photograph each wall" line worthless.
    IF v_req.needs_photo AND NOT EXISTS (
        SELECT 1 FROM "public"."documents" WHERE requirement_id = v_req.id
    ) THEN
        RETURN jsonb_build_object('success', false,
            'error', 'This line is ticked by attaching a photo to it.');
    END IF;

    IF v_req.is_satisfied THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already signed off');
    END IF;

    UPDATE "public"."task_completion_requirements"
       SET is_satisfied = true,
           satisfied_at = now(),
           satisfied_by = p_user_id,
           note = NULLIF(btrim(COALESCE(p_note, '')), '')
     WHERE id = p_requirement_id;

    RETURN jsonb_build_object('success', true, 'signed_off_at', now());
END;
$$;

-- A document attached to a specific tick satisfies that tick, whatever its
-- type. Without one, a task document satisfies the task's upload gates as
-- before.
CREATE OR REPLACE FUNCTION "public"."trg_satisfy_upload_requirement"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF NEW.linked_type <> 'task' THEN
        RETURN NULL;
    END IF;

    IF NEW.requirement_id IS NOT NULL THEN
        UPDATE "public"."task_completion_requirements"
           SET is_satisfied = true,
               satisfied_at = now(),
               satisfied_by = NEW.uploaded_by,
               reference_type = 'document',
               reference_id = NEW.id
         WHERE id = NEW.requirement_id
           AND task_id = NEW.linked_id
           AND is_satisfied = false;
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

-- Deleting the last photo on a tick un-ticks it. Evidence that is gone is
-- not evidence; the line goes back to wanting one.
CREATE OR REPLACE FUNCTION "public"."trg_untick_on_photo_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF OLD.requirement_id IS NULL THEN RETURN NULL; END IF;
    UPDATE "public"."task_completion_requirements" r
       SET is_satisfied = false, satisfied_at = NULL, satisfied_by = NULL,
           reference_type = NULL, reference_id = NULL
     WHERE r.id = OLD.requirement_id
       AND r.needs_photo
       AND NOT EXISTS (SELECT 1 FROM "public"."documents" d
                        WHERE d.requirement_id = r.id AND d.id <> OLD.id);
    RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS "trg_documents_untick_on_delete" ON "public"."documents";
CREATE TRIGGER "trg_documents_untick_on_delete"
  AFTER DELETE ON "public"."documents"
  FOR EACH ROW EXECUTE FUNCTION "public"."trg_untick_on_photo_delete"();

-- ---------------------------------------------------------------------------
-- 5. A task document is tagged with where it came from
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."task_document_tags"("p_task_id" uuid, "p_requirement_id" uuid)
RETURNS text[]
LANGUAGE sql STABLE
AS $$
  SELECT ARRAY_REMOVE(ARRAY[
           'step: ' || t.title,
           CASE WHEN p.title IS NOT NULL THEN 'stage: ' || p.title END,
           CASE WHEN t.procedure_run_id IS NOT NULL THEN 'playbook' END,
           CASE WHEN s.name IS NOT NULL THEN 'space: ' || s.name END
         ], NULL)
    FROM public.tasks t
    LEFT JOIN public.tasks p ON p.id = t.parent_task_id
    LEFT JOIN public.task_completion_requirements r ON r.id = p_requirement_id
    LEFT JOIN public.property_scope_items s ON s.id = r.scope_item_id
   WHERE t.id = p_task_id;
$$;

CREATE OR REPLACE FUNCTION "public"."trg_tag_task_document"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_tags text[];
BEGIN
  IF NEW.linked_type <> 'task' THEN RETURN NEW; END IF;
  v_tags := public.task_document_tags(NEW.linked_id, NEW.requirement_id);
  IF v_tags IS NULL THEN RETURN NEW; END IF;
  SELECT ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(NEW.tags, '{}') || v_tags) AS x)
    INTO NEW.tags;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "trg_documents_tag_task" ON "public"."documents";
CREATE TRIGGER "trg_documents_tag_task"
  BEFORE INSERT ON "public"."documents"
  FOR EACH ROW EXECUTE FUNCTION "public"."trg_tag_task_document"();

-- Files already on tasks.
UPDATE "public"."documents" d
   SET tags = ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(d.tags, '{}') || public.task_document_tags(d.linked_id, d.requirement_id)) AS x)
 WHERE d.linked_type = 'task'
   AND public.task_document_tags(d.linked_id, d.requirement_id) IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. Revising a playbook carries the new columns
-- ---------------------------------------------------------------------------
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
      owner_type, milestone_role, default_delay_reason, checklist_lines, per_space
    )
    SELECT v_draft_id, NULL, title, description, instructions,
           display_order, action_type, form_schema, required_upload_types,
           approval_role, assign_to_role, assign_to_user, relative_due_days,
           estimated_hours, duration_days, priority, is_required, can_skip,
           skip_requires_reason, allow_parallel, checklist_items, step_key, true,
           owner_type, milestone_role, default_delay_reason, checklist_lines, per_space
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
      owner_type, milestone_role, default_delay_reason, checklist_lines, per_space
    )
    SELECT v_draft_id, c.new_id, s.title, s.description, s.instructions,
           s.display_order, s.action_type, s.form_schema, s.required_upload_types,
           s.approval_role, s.assign_to_role, s.assign_to_user, s.relative_due_days,
           s.estimated_hours, s.duration_days, s.priority, s.is_required, s.can_skip,
           s.skip_requires_reason, s.allow_parallel, s.checklist_items, s.step_key, true,
           s.owner_type, s.milestone_role, s.default_delay_reason, s.checklist_lines, s.per_space
      FROM src s
      JOIN _copied c ON c.old_id = s.parent_step_id
    RETURNING id, display_order
  )
  INSERT INTO _copied (old_id, new_id)
  SELECT src.id, ins.id FROM src JOIN ins ON ins.display_order = src.display_order;

  -- Dependencies are between steps, so they are remapped onto the copies.
  INSERT INTO public.procedure_step_dependencies (step_id, depends_on_step_id, dependency_type, wait_type)
  SELECT f.new_id, t.new_id, d.dependency_type, d.wait_type
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
