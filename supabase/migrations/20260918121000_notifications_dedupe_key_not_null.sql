-- ON CONFLICT (user_id, dedupe_key) through PostgREST cannot infer a partial
-- unique index, so the key is always present: a caller that has no natural
-- key gets a random one and the index is a plain unique index.
DROP INDEX IF EXISTS public.notifications_dedupe;
UPDATE public.notifications SET dedupe_key = gen_random_uuid()::text WHERE dedupe_key IS NULL;
ALTER TABLE public.notifications
  ALTER COLUMN dedupe_key SET DEFAULT gen_random_uuid()::text,
  ALTER COLUMN dedupe_key SET NOT NULL;
CREATE UNIQUE INDEX notifications_dedupe ON public.notifications (user_id, dedupe_key);
