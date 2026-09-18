-- In-app notifications, base version (2026-09-18).
--
-- The tables existed in the baseline with one producer: a trigger on leads
-- that told every Owner/Admin/Manager/Sales Manager about a won lead - an
-- audience chosen by role slug, which is the hierarchy the rest of the app
-- refuses. From here notifications are written by the application routes
-- that already know the actor, the subject and the one or two people it
-- concerns (see src/lib/notifications/notify.ts), so:
--
--   * the kind is text, not an enum - a new kind must not need a migration;
--   * the role-based trigger and the enum-typed helper function go;
--   * a dedupe_key lets a scheduled producer (reminders, later) write the same
--     notice at most once per person;
--   * the table joins the realtime publication, so an open tab hears a new
--     row within a second. RLS (own rows only) applies to the stream too.

-- 1. The role-based producer.
DROP TRIGGER IF EXISTS trigger_notify_lead_won ON public.leads;
DROP FUNCTION IF EXISTS public.notify_lead_won();
DROP FUNCTION IF EXISTS public.create_notification(
  uuid, uuid, public.notification_type_enum, character varying, text,
  character varying, uuid, text, uuid, public.notification_priority_enum, jsonb
);

-- 2. Kind is text.
ALTER TABLE public.notifications
  ALTER COLUMN type TYPE text USING type::text;
ALTER TABLE public.notification_preferences
  ALTER COLUMN notification_type TYPE text USING notification_type::text;
DROP TYPE IF EXISTS public.notification_type_enum;

-- 3. Idempotency for producers that may run twice.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dedupe_key text;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe
  ON public.notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- The bell reads "my unread, newest first".
CREATE INDEX IF NOT EXISTS notifications_user_unread_created
  ON public.notifications (user_id, is_read, created_at DESC);

-- 4. Live delivery.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- 5. The insert policy said "any row in my tenant", which is right for a
--    route writing to a colleague. Deleting was not covered at all; a person
--    may clear their own.
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

COMMENT ON COLUMN public.notifications.type IS
  'Kind, free text - see NOTIFICATION_KINDS in src/lib/notifications/kinds.ts';
COMMENT ON COLUMN public.notifications.dedupe_key IS
  'Optional; with user_id it makes a notice unique, so a producer that runs twice writes once.';
