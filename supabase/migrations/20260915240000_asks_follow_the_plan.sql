-- A "waiting on" entry that came from a playbook step follows that step's
-- planned due date - until a person sets the date by hand, after which it is
-- theirs. The entries were stamped once at creation and never moved, so the
-- panel disagreed with the plan beneath it the moment the plan re-laid.

ALTER TABLE "public"."project_dependencies"
  ADD COLUMN IF NOT EXISTS "expected_by_set_by_hand" boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION "public"."ask_follows_its_step"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
    UPDATE public.project_dependencies
       SET expected_by = NEW.due_date
     WHERE task_id = NEW.id AND NOT expected_by_set_by_hand
       AND expected_by IS DISTINCT FROM NEW.due_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_ask_follows_its_step" ON "public"."tasks";
CREATE TRIGGER "trg_ask_follows_its_step"
  AFTER UPDATE OF "due_date" ON "public"."tasks"
  FOR EACH ROW EXECUTE FUNCTION "public"."ask_follows_its_step"();

-- Line every step-backed ask up with its step now.
UPDATE public.project_dependencies d
   SET expected_by = t.due_date
  FROM public.tasks t
 WHERE t.id = d.task_id AND NOT d.expected_by_set_by_hand
   AND d.expected_by IS DISTINCT FROM t.due_date;
