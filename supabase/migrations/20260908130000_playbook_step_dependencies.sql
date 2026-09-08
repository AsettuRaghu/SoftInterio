-- Let one step wait on another by name.
--
-- Ordering was all or nothing: enforce_order queued every step behind its
-- earlier siblings, and allow_parallel exempted a step from that entirely.
-- A real process is neither. "3D Design waits until the layout is signed off,
-- but the ceiling lights quotation can run alongside" cannot be said with one
-- switch on the playbook and one flag on the step.
--
-- A dependency holds regardless of enforce_order, because naming it is a
-- deliberate statement about this step and this one only. Soft dependencies
-- are recorded but do not block - they are advice for whoever is scheduling,
-- and the phase engine drew the same distinction.

CREATE TABLE IF NOT EXISTS "public"."procedure_step_dependencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "step_id" "uuid" NOT NULL,
    "depends_on_step_id" "uuid" NOT NULL,
    "dependency_type" "text" DEFAULT 'hard' NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "procedure_step_dependencies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "procedure_step_dependencies_type_check"
        CHECK ("dependency_type" IN ('hard', 'soft')),
    -- A step waiting on itself would never start.
    CONSTRAINT "procedure_step_dependencies_not_self"
        CHECK ("step_id" <> "depends_on_step_id")
);

ALTER TABLE "public"."procedure_step_dependencies"
  ADD CONSTRAINT "procedure_step_dependencies_step_id_fkey"
  FOREIGN KEY ("step_id")
  REFERENCES "public"."procedure_step_definitions"("id") ON DELETE CASCADE;

ALTER TABLE "public"."procedure_step_dependencies"
  ADD CONSTRAINT "procedure_step_dependencies_depends_on_fkey"
  FOREIGN KEY ("depends_on_step_id")
  REFERENCES "public"."procedure_step_definitions"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "procedure_step_dependencies_unique"
  ON "public"."procedure_step_dependencies" ("step_id", "depends_on_step_id");

ALTER TABLE "public"."procedure_step_dependencies" ENABLE ROW LEVEL SECURITY;

-- Scoped through the playbook that owns the step, the way every other child of
-- a definition is.
CREATE POLICY "Playbook step dependencies follow their playbook"
  ON "public"."procedure_step_dependencies"
  USING ("step_id" IN (
    SELECT sd."id"
      FROM "public"."procedure_step_definitions" sd
      JOIN "public"."procedure_definitions" pd ON pd."id" = sd."definition_id"
     WHERE pd."tenant_id" IN (
       SELECT u."tenant_id" FROM "public"."users" u WHERE u."id" = "auth"."uid"()
     )
  ));

CREATE OR REPLACE FUNCTION "public"."task_blocking_predecessors"("p_task_id" "uuid") RETURNS "text"[]
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

    -- Named dependencies come first, because they hold whatever the ordering
    -- setting says. enforce_order is a blunt instrument - everything queues,
    -- or nothing does - and a real process needs to say that 3D waits on the
    -- layout sign-off while the ceiling quotation runs alongside.
    SELECT array_agg(t.title ORDER BY sd.display_order)
      INTO v_blockers
      FROM "public"."procedure_step_dependencies" dep
      JOIN "public"."procedure_step_definitions" sd
        ON sd.id = dep.depends_on_step_id
      JOIN "public"."tasks" t
        ON t.procedure_step_id = dep.depends_on_step_id
       AND t.procedure_run_id = v_task.procedure_run_id
     WHERE dep.step_id = v_step.id
       AND dep.dependency_type = 'hard'
       AND t.status NOT IN ('completed', 'cancelled', 'skipped');

    IF v_blockers IS NOT NULL AND array_length(v_blockers, 1) > 0 THEN
        RETURN v_blockers;
    END IF;

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