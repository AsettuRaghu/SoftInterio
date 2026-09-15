-- Kick-off: how a project goes from "just won" to "in progress".
--
-- Step 2 of docs/plans/project-lifecycle-and-delay-ledger.md.
--
-- A won lead produces a `new` project with no plan. Kick-off is the project
-- manager taking it from Sales: reviewing the handover, choosing the
-- playbook, setting dates and owners, listing what the client must do, and
-- confirming. Confirming records the agreed plan (baseline v1), keeps the
-- dates Sales promised, moves the status to in_progress, and writes the
-- timeline. It is one function so that either all of it happens or none of it
-- does - the same reason revise_playbook is one function.
--
-- new -> in_progress is now only reachable through kick-off. The PATCH route
-- refuses a hand-set status change for that pair.

-- ---------------------------------------------------------------------------
-- 1. The project remembers the hand-off.
-- ---------------------------------------------------------------------------

ALTER TABLE "public"."projects"
  -- The dates Sales told the client. Copied from expected_* at kick-off so
  -- they survive every later edit of the plan.
  ADD COLUMN IF NOT EXISTS "committed_start_date" date,
  ADD COLUMN IF NOT EXISTS "committed_end_date" date,
  -- The checklist's first tick: the PM has read what Sales handed over.
  ADD COLUMN IF NOT EXISTS "handover_reviewed_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "handover_reviewed_by" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "kicked_off_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "kicked_off_by" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL;

COMMENT ON COLUMN "public"."projects"."committed_start_date" IS 'What Sales promised the client. Copied from expected_start_date at kick-off; never moves after.';
COMMENT ON COLUMN "public"."projects"."committed_end_date" IS 'What Sales promised the client. Copied from expected_end_date at kick-off; never moves after.';

-- ---------------------------------------------------------------------------
-- 2. The agreed plan, versioned.
-- ---------------------------------------------------------------------------

CREATE TABLE "public"."plan_baselines" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id"         uuid NOT NULL REFERENCES "public"."projects"("id") ON DELETE CASCADE,
  "run_id"             uuid NOT NULL REFERENCES "public"."procedure_runs"("id") ON DELETE CASCADE,
  "version"            integer NOT NULL,
  -- v1 has no reason; it is the plan. From v2 on, a new plan says why.
  "reason"             text,
  "delay_owner"        text CHECK ("delay_owner" IN ('client', 'vendor', 'internal', 'third_party')),
  "delay_reason_code"  text,
  "client_informed_at" timestamptz,
  "set_by"             uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "set_at"             timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("project_id", "version")
);

COMMENT ON TABLE "public"."plan_baselines" IS 'The agreed plan for a project, versioned. v1 is recorded at kick-off; a later version is a re-plan with a reason and a delay owner.';

CREATE TABLE "public"."plan_baseline_tasks" (
  "baseline_id"     uuid NOT NULL REFERENCES "public"."plan_baselines"("id") ON DELETE CASCADE,
  "task_id"         uuid NOT NULL REFERENCES "public"."tasks"("id") ON DELETE CASCADE,
  "start_date"      date,
  "due_date"        date,
  "estimated_hours" numeric(6,2),
  "assigned_to"     uuid,
  PRIMARY KEY ("baseline_id", "task_id")
);

CREATE INDEX "idx_plan_baseline_tasks_task" ON "public"."plan_baseline_tasks" ("task_id");

-- ---------------------------------------------------------------------------
-- 3. What the client (or a vendor) must do: the "waiting on" list.
-- ---------------------------------------------------------------------------

CREATE TABLE "public"."project_dependencies" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id"        uuid NOT NULL REFERENCES "public"."projects"("id") ON DELETE CASCADE,
  -- The playbook step this is, when it came from one. Null for an ad-hoc ask.
  "task_id"           uuid REFERENCES "public"."tasks"("id") ON DELETE CASCADE,
  "owner_type"        "public"."step_owner_type" NOT NULL,
  "counterpart"       text,
  "description"       text NOT NULL,
  "expected_by"       date,
  "raised_at"         timestamptz NOT NULL DEFAULT now(),
  "raised_by"         uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "resolved_at"       timestamptz,
  "resolved_by"       uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "delay_reason_code" text,
  CONSTRAINT "project_dependencies_not_internal" CHECK ("owner_type" <> 'internal'),
  UNIQUE ("task_id")
);

CREATE INDEX "idx_project_dependencies_project" ON "public"."project_dependencies" ("project_id", "resolved_at");

COMMENT ON TABLE "public"."project_dependencies" IS 'Things the project waits on someone else for. One row per client/vendor step of the playbook (created when the task is), plus ad-hoc asks.';

-- RLS: tenant-scoped through the project, like the other project children.
ALTER TABLE "public"."plan_baselines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."plan_baseline_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."project_dependencies" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read plan baselines" ON "public"."plan_baselines"
  FOR SELECT USING (EXISTS (SELECT 1 FROM "public"."projects" p WHERE p."id" = "project_id" AND p."tenant_id" = "public"."get_user_tenant_id"()));
CREATE POLICY "tenant members read baseline tasks" ON "public"."plan_baseline_tasks"
  FOR SELECT USING (EXISTS (SELECT 1 FROM "public"."plan_baselines" b JOIN "public"."projects" p ON p."id" = b."project_id" WHERE b."id" = "baseline_id" AND p."tenant_id" = "public"."get_user_tenant_id"()));
CREATE POLICY "tenant members manage dependencies" ON "public"."project_dependencies"
  FOR ALL USING (EXISTS (SELECT 1 FROM "public"."projects" p WHERE p."id" = "project_id" AND p."tenant_id" = "public"."get_user_tenant_id"()))
  WITH CHECK (EXISTS (SELECT 1 FROM "public"."projects" p WHERE p."id" = "project_id" AND p."tenant_id" = "public"."get_user_tenant_id"()));

GRANT SELECT ON "public"."plan_baselines", "public"."plan_baseline_tasks" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."project_dependencies" TO "authenticated";
GRANT ALL ON "public"."plan_baselines", "public"."plan_baseline_tasks", "public"."project_dependencies" TO "service_role";

-- ---------------------------------------------------------------------------
-- 4. A client or vendor step becomes a "waiting on" entry the moment its task
--    exists. Covers start_procedure_run, sync, and commit-created tasks alike,
--    because all three insert tasks.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."raise_dependency_for_external_step"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner "public"."step_owner_type";
BEGIN
  IF NEW.related_type <> 'project' OR NEW.related_id IS NULL OR NEW.procedure_step_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT owner_type INTO v_owner
    FROM public.procedure_step_definitions
   WHERE id = NEW.procedure_step_id;

  IF v_owner IS NULL OR v_owner = 'internal' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.project_dependencies (project_id, task_id, owner_type, description, expected_by, raised_by)
  VALUES (NEW.related_id, NEW.id, v_owner, NEW.title, NEW.due_date, NEW.created_by)
  ON CONFLICT (task_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_raise_dependency_for_external_step" ON "public"."tasks";
CREATE TRIGGER "trg_raise_dependency_for_external_step"
  AFTER INSERT ON "public"."tasks"
  FOR EACH ROW EXECUTE FUNCTION "public"."raise_dependency_for_external_step"();

-- Settling the step settles the ask; reopening it reopens the ask.
CREATE OR REPLACE FUNCTION "public"."settle_dependency_with_task"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status IN ('completed', 'skipped', 'cancelled') AND OLD.status NOT IN ('completed', 'skipped', 'cancelled') THEN
    UPDATE public.project_dependencies
       SET resolved_at = COALESCE(NEW.completed_at, now())
     WHERE task_id = NEW.id AND resolved_at IS NULL;
  ELSIF NEW.status NOT IN ('completed', 'skipped', 'cancelled') AND OLD.status IN ('completed', 'skipped', 'cancelled') THEN
    UPDATE public.project_dependencies
       SET resolved_at = NULL, resolved_by = NULL
     WHERE task_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_settle_dependency_with_task" ON "public"."tasks";
CREATE TRIGGER "trg_settle_dependency_with_task"
  AFTER UPDATE OF "status" ON "public"."tasks"
  FOR EACH ROW EXECUTE FUNCTION "public"."settle_dependency_with_task"();

-- Existing runs: raise the asks their client/vendor steps already imply.
INSERT INTO public.project_dependencies (project_id, task_id, owner_type, description, expected_by, raised_by, resolved_at)
SELECT t.related_id, t.id, s.owner_type, t.title, t.due_date, t.created_by,
       CASE WHEN t.status IN ('completed', 'skipped', 'cancelled') THEN COALESCE(t.completed_at, now()) END
  FROM public.tasks t
  JOIN public.procedure_step_definitions s ON s.id = t.procedure_step_id
 WHERE t.related_type = 'project' AND s.owner_type <> 'internal'
ON CONFLICT (task_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Timeline vocabulary.
-- ---------------------------------------------------------------------------

ALTER TYPE "public"."project_activity_type_enum" ADD VALUE IF NOT EXISTS 'project_kicked_off';
ALTER TYPE "public"."project_activity_type_enum" ADD VALUE IF NOT EXISTS 'plan_agreed';
ALTER TYPE "public"."project_activity_type_enum" ADD VALUE IF NOT EXISTS 'dependency_raised';
ALTER TYPE "public"."project_activity_type_enum" ADD VALUE IF NOT EXISTS 'dependency_resolved';
