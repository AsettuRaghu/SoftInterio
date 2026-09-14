-- The completion-requirements panel has never rendered. This is why.
--
-- GET /api/tasks/[id]/requirements selects
--
--   satisfied_user:users!task_completion_requirements_satisfied_by_fkey(...)
--
-- and that foreign key does not exist. task_completion_requirements.satisfied_by
-- is a bare uuid column, so PostgREST answers "Could not find a relationship
-- between 'task_completion_requirements' and 'users'", the route returns
-- nothing, and TaskRequirements renders an empty panel.
--
-- The effect: every gate a playbook step can carry - confirm a meeting, tick a
-- checklist, get a sign-off - was invisible and unsatisfiable. A step arrived
-- blocked with nothing on the page to unblock it, which is exactly what
-- "Project Planning Kickstart cannot be completed and I see no option to
-- confirm the meeting" is.
--
-- ON DELETE SET NULL, not CASCADE: somebody leaving the business must not
-- delete the record that a sign-off happened. The requirement stays satisfied
-- and simply stops naming who did it.

ALTER TABLE "public"."task_completion_requirements"
  DROP CONSTRAINT IF EXISTS "task_completion_requirements_satisfied_by_fkey";

ALTER TABLE "public"."task_completion_requirements"
  ADD CONSTRAINT "task_completion_requirements_satisfied_by_fkey"
  FOREIGN KEY ("satisfied_by")
  REFERENCES "public"."users"("id")
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_task_completion_requirements_task"
  ON "public"."task_completion_requirements" ("task_id");
