-- "Waits for" needs to say WHICH part it waits for, and a child must never
-- wait for its own parent.
--
-- Two problems, one of them a deadlock.
--
-- 1. A hard dependency blocked a step until its predecessor was COMPLETED.
--    That is the only reading the function had, and it is not the only reading
--    a person means. "Layout Drawings waits for 2D Designs" was configured
--    expecting "2D Designs has to be under way", and got "2D Designs has to be
--    finished".
--
-- 2. Pointing a child at its parent is circular and nothing stopped it.
--    task_transition refuses to complete a parent while a subtask is open, and
--    the dependency refused to start the subtask until the parent completed.
--    Neither can ever move. Eleven of the 34 dependencies on the Modular
--    Design Template were in exactly that state, across eight phases - the
--    whole playbook was unstartable.
--
-- A phase in this model is a container, not work of its own: it begins when the
-- first step inside it begins. So "this step waits for its phase" can never
-- mean anything useful, and is now refused rather than merely discouraged.
--
-- wait_type is the fix for the first problem, in the vocabulary planners
-- already use:
--
--   after_finish  the predecessor must be completed, skipped or cancelled
--                 (finish-to-start - what every existing row meant)
--   after_start   the predecessor must merely have begun
--                 (start-to-start - what was actually wanted)

ALTER TABLE "public"."procedure_step_dependencies"
  ADD COLUMN IF NOT EXISTS "wait_type" text NOT NULL DEFAULT 'after_finish';

ALTER TABLE "public"."procedure_step_dependencies"
  DROP CONSTRAINT IF EXISTS "procedure_step_dependencies_wait_type_check";

ALTER TABLE "public"."procedure_step_dependencies"
  ADD CONSTRAINT "procedure_step_dependencies_wait_type_check"
  CHECK ("wait_type" IN ('after_finish', 'after_start'));

COMMENT ON COLUMN "public"."procedure_step_dependencies"."wait_type" IS
  'after_finish = predecessor must be settled (finish-to-start). after_start = predecessor must merely have begun (start-to-start).';

-- Clear the circular rows. Not converted to after_start: a step inside a phase
-- is already inside it, so the link says nothing either way.
DELETE FROM "public"."procedure_step_dependencies" d
 USING "public"."procedure_step_definitions" s
 WHERE d."step_id" = s."id"
   AND d."depends_on_step_id" = s."parent_step_id";

-- …and a step can never depend on itself.
DELETE FROM "public"."procedure_step_dependencies"
 WHERE "step_id" = "depends_on_step_id";

CREATE OR REPLACE FUNCTION "public"."reject_circular_step_dependency"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent uuid;
BEGIN
  IF NEW.step_id = NEW.depends_on_step_id THEN
    RAISE EXCEPTION 'A step cannot wait for itself'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT parent_step_id INTO v_parent
    FROM public.procedure_step_definitions WHERE id = NEW.step_id;

  IF v_parent IS NOT NULL AND v_parent = NEW.depends_on_step_id THEN
    RAISE EXCEPTION 'A step cannot wait for the phase it belongs to - it is already inside it, and the phase cannot finish until its steps do'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_reject_circular_step_dependency"
  ON "public"."procedure_step_dependencies";
CREATE TRIGGER "trg_reject_circular_step_dependency"
  BEFORE INSERT OR UPDATE ON "public"."procedure_step_dependencies"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."reject_circular_step_dependency"();

-- The gate now reads wait_type.
CREATE OR REPLACE FUNCTION "public"."task_blocking_predecessors"("p_task_id" "uuid")
RETURNS "text"[]
LANGUAGE plpgsql STABLE
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
    --
    -- 'todo' is the whole of "has not begun", so that is what an after_start
    -- link waits on.
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
       AND (
             (dep.wait_type = 'after_finish'
              AND t.status NOT IN ('completed', 'cancelled', 'skipped'))
          OR (dep.wait_type = 'after_start'
              AND t.status = 'todo')
           );

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
