-- Going live repoints running tasks at the new version's steps; a step that
-- became client- or vendor-owned in that version must raise its "waiting on"
-- entry then, not only when a task is first created. Found on the first
-- commit after owner_type existed: 33 tasks repointed, 9 now external, 2
-- entries raised (the two that were new tasks).

DROP TRIGGER IF EXISTS "trg_raise_dependency_for_external_step" ON "public"."tasks";
CREATE TRIGGER "trg_raise_dependency_for_external_step"
  AFTER INSERT OR UPDATE OF "procedure_step_id" ON "public"."tasks"
  FOR EACH ROW EXECUTE FUNCTION "public"."raise_dependency_for_external_step"();

-- Backfill for anything repointed before this trigger existed.
INSERT INTO public.project_dependencies (project_id, task_id, owner_type, description, expected_by, raised_by, resolved_at)
SELECT t.related_id, t.id, s.owner_type, t.title, t.due_date, t.created_by,
       CASE WHEN t.status IN ('completed', 'skipped', 'cancelled') THEN COALESCE(t.completed_at, now()) END
  FROM public.tasks t
  JOIN public.procedure_step_definitions s ON s.id = t.procedure_step_id
 WHERE t.related_type = 'project' AND s.owner_type <> 'internal'
ON CONFLICT (task_id) DO NOTHING;
