-- A step MAY wait for its phase to start. It may not wait for it to finish.
--
-- Yesterday's migration banned the shape outright, which was too broad. Only
-- one of the two readings is circular:
--
--   child waits for parent AFTER_FINISH   deadlock. task_transition refuses to
--                                         complete a parent while a subtask is
--                                         open, so neither can ever move.
--   child waits for parent AFTER_START    coherent, and useful. Start the
--                                         phase, and its steps become
--                                         available. Nothing waits on anything
--                                         that waits on it.
--
-- The second is what was configured in the first place - "for the sub tasks to
-- start, the respective parent task to be started" - and banning it left the
-- first step of a phase with nothing it could wait for at all.
--
-- So the rule narrows: the pairing is refused only with after_finish.

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

  IF v_parent IS NOT NULL
     AND v_parent = NEW.depends_on_step_id
     AND NEW.wait_type = 'after_finish' THEN
    RAISE EXCEPTION 'A step cannot wait for its phase to FINISH - the phase cannot finish until its steps do. Wait for it to start instead.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "public"."reject_circular_step_dependency"() IS
  'Refuses a step waiting for itself, and a step waiting for its own phase to FINISH. Waiting for the phase to START is allowed and is the useful case. Deeper cycles are not detected.';
