-- A playbook step says who does it, and whether it means something for the
-- project's status.
--
-- First of the lifecycle changes (docs/plans/project-lifecycle-and-delay-ledger.md).
--
-- owner_type: who a step waits on. `internal` is our own work and the default;
-- `client` is something the client must do (hand over the site, approve the
-- 3D); `vendor` is something a supplier must deliver. A client- or
-- vendor-owned step becomes an entry on the project's "waiting on" list at
-- kick-off, and its lateness is counted against that owner automatically -
-- that is what marking it means, and why it is a property of the step rather
-- than something the project manager decides per project.
--
-- milestone_role: what completing the step means for the project's status.
-- `kickoff` proposes new -> in_progress, `handover` proposes
-- in_progress -> completed, `client_facing` changes nothing and marks the step
-- for the client's timeline. Status is driven from here, not from a fixed
-- list, so an interiors company and an architect practice get different
-- lifecycles by writing different playbooks. The system proposes; the project
-- manager confirms. At most one kickoff and one handover per playbook version.
--
-- Both are carried across revisions by step_key like every other step field,
-- so revise_playbook is redefined to copy them.

CREATE TYPE "public"."step_owner_type" AS ENUM ('internal', 'client', 'vendor');
CREATE TYPE "public"."step_milestone_role" AS ENUM ('kickoff', 'handover', 'client_facing');

ALTER TABLE "public"."procedure_step_definitions"
  ADD COLUMN IF NOT EXISTS "owner_type" "public"."step_owner_type" NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS "milestone_role" "public"."step_milestone_role";

COMMENT ON COLUMN "public"."procedure_step_definitions"."owner_type" IS
  'Who this step waits on: internal (us), client, or vendor. Client/vendor steps are the project''s "waiting on" list and their lateness counts against that owner.';
COMMENT ON COLUMN "public"."procedure_step_definitions"."milestone_role" IS
  'What completing this step means for project status: kickoff (proposes in_progress), handover (proposes completed), client_facing (shown to the client, no status effect).';

-- One kickoff and one handover per version. Scoped to current steps so a
-- superseded version's rows never collide with the copy that replaced them.
CREATE UNIQUE INDEX IF NOT EXISTS "procedure_step_one_status_milestone_per_definition"
  ON "public"."procedure_step_definitions" ("definition_id", "milestone_role")
  WHERE "milestone_role" IN ('kickoff', 'handover') AND "is_current";

-- revise_playbook enumerates the columns it copies; the two new ones join the
-- list. Otherwise identical to 20260909190000.
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
      owner_type, milestone_role
    )
    SELECT v_draft_id, NULL, title, description, instructions,
           display_order, action_type, form_schema, required_upload_types,
           approval_role, assign_to_role, assign_to_user, relative_due_days,
           estimated_hours, duration_days, priority, is_required, can_skip,
           skip_requires_reason, allow_parallel, checklist_items, step_key, true,
           owner_type, milestone_role
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
      owner_type, milestone_role
    )
    SELECT v_draft_id, c.new_id, s.title, s.description, s.instructions,
           s.display_order, s.action_type, s.form_schema, s.required_upload_types,
           s.approval_role, s.assign_to_role, s.assign_to_user, s.relative_due_days,
           s.estimated_hours, s.duration_days, s.priority, s.is_required, s.can_skip,
           s.skip_requires_reason, s.allow_parallel, s.checklist_items, s.step_key, true,
           s.owner_type, s.milestone_role
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
