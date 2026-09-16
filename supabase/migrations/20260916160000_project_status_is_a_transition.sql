-- A project's status changes through one function, with rules, like a task's.
--
-- Until now PATCH /api/projects/[id] took any status the edit dialog sent.
-- In Progress could go back to New (un-kicking a kick-off), to On Hold with
-- nobody named, or to Cancelled while the playbook run kept going. Only
-- Completed was guarded, and only against open steps.
--
-- project_transition(project, user, to, note, hold owner/reason/until):
--
--   new         -> cancelled                      (reason)
--   in_progress -> on_hold                        (who, why, until; running steps go on hold with it)
--   in_progress -> completed                      (no open steps, handover milestone done, nothing owed by the client)
--   in_progress -> cancelled                      (reason; run and open steps cancelled)
--   on_hold     -> in_progress                    (resume; days held logged against the owner)
--   on_hold     -> cancelled                      (reason)
--   completed   -> in_progress                    (reopen; the run comes back)
--   cancelled   -> in_progress                    (reopen; the run comes back)
--   new -> in_progress is kick_off_project(), never this.
--   Nothing goes back to new. Completed and cancelled go nowhere but reopen.
--
-- Every move needs a note - it is the line on the timeline someone reads
-- later to learn why.

ALTER TABLE "public"."projects"
  ADD COLUMN IF NOT EXISTS "hold_owner" text CHECK ("hold_owner" IN ('client', 'vendor', 'internal', 'third_party')),
  ADD COLUMN IF NOT EXISTS "hold_reason_code" text,
  ADD COLUMN IF NOT EXISTS "hold_expected_until" date,
  ADD COLUMN IF NOT EXISTS "held_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "completed_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "cancelled_at" timestamptz;

ALTER TYPE "public"."project_activity_type_enum" ADD VALUE IF NOT EXISTS 'project_held';
ALTER TYPE "public"."project_activity_type_enum" ADD VALUE IF NOT EXISTS 'project_resumed';
ALTER TYPE "public"."project_activity_type_enum" ADD VALUE IF NOT EXISTS 'project_completed';
ALTER TYPE "public"."project_activity_type_enum" ADD VALUE IF NOT EXISTS 'project_cancelled';
ALTER TYPE "public"."project_activity_type_enum" ADD VALUE IF NOT EXISTS 'project_reopened';
