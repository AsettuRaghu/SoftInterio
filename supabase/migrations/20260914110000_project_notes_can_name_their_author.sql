-- The calendar embeds a project note's author through a foreign key that does
-- not exist, so that query fails the same way the requirements one did.
--
--   created_user:users!project_notes_created_by_fkey(...)
--
-- project_notes.created_by is a bare uuid. Found by auditing every
-- `users!<constraint>` embed in the codebase after the requirements panel
-- turned out to have never rendered for exactly this reason - 30 such embeds,
-- and these were the only two naming a constraint that was never created.
--
-- ON DELETE SET NULL: an author leaving must not delete their note.

ALTER TABLE "public"."project_notes"
  DROP CONSTRAINT IF EXISTS "project_notes_created_by_fkey";

ALTER TABLE "public"."project_notes"
  ADD CONSTRAINT "project_notes_created_by_fkey"
  FOREIGN KEY ("created_by")
  REFERENCES "public"."users"("id")
  ON DELETE SET NULL;
