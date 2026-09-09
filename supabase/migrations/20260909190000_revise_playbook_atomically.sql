-- Copy a playbook version in one transaction.
--
-- Revising was several statements from the application: insert the draft,
-- insert the parents, insert the children, insert the dependencies. Between
-- any two of them the draft is visible to everyone, half made - and the editor
-- renders whatever it finds, because its hydration nests children under their
-- parent and silently drops any child whose parent is missing. A draft caught
-- mid-copy therefore looks like a complete, shorter playbook.
--
-- Saving from that screen is what does the damage: replaceSteps rewrites the
-- draft to match what the editor can see, and the steps that never copied are
-- deleted for good. This happened twice to the Modular Design Template, each
-- time leaving a v5 with 8 phases and none of v4's 24 child steps.
--
-- Application-level rollback cannot close that window. The request can be
-- abandoned between statements - a navigation, a dev-server recompile, a
-- dropped connection - and then no rollback code runs at all. A function runs
-- inside one transaction, so either the whole revision exists or none of it
-- does, and nothing can observe a partial one.

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
      skip_requires_reason, allow_parallel, checklist_items, step_key, is_current
    )
    SELECT v_draft_id, NULL, title, description, instructions,
           display_order, action_type, form_schema, required_upload_types,
           approval_role, assign_to_role, assign_to_user, relative_due_days,
           estimated_hours, duration_days, priority, is_required, can_skip,
           skip_requires_reason, allow_parallel, checklist_items, step_key, true
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
      skip_requires_reason, allow_parallel, checklist_items, step_key, is_current
    )
    SELECT v_draft_id, c.new_id, s.title, s.description, s.instructions,
           s.display_order, s.action_type, s.form_schema, s.required_upload_types,
           s.approval_role, s.assign_to_role, s.assign_to_user, s.relative_due_days,
           s.estimated_hours, s.duration_days, s.priority, s.is_required, s.can_skip,
           s.skip_requires_reason, s.allow_parallel, s.checklist_items, s.step_key, true
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

COMMENT ON FUNCTION "public"."revise_playbook"(uuid, uuid) IS
  'Copies a playbook version into a new draft in one transaction. Either the whole revision exists or none of it does.';
