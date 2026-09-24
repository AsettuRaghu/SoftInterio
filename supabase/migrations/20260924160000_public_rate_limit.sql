-- A cap on the paths anybody can reach.
--
-- `/quotation/<token>` is the product's first public surface. The token is the
-- authentication and it is 64 hex characters from two UUIDs, so it is not
-- guessable in any practical sense - but "not guessable" is a property of
-- today's token generator, and an unmetered public endpoint is the thing that
-- makes trying worthwhile. This sheds attempts cheaply instead of trusting the
-- entropy for ever.
--
-- In the DATABASE rather than in memory, because the functions are serverless:
-- a per-instance counter resets whenever a new instance handles the request,
-- which means it counts almost nothing under the load it exists to stop.
--
-- A fixed window, not a sliding one. A burst straddling two windows can reach
-- twice the limit, which is the accepted cost of this being one row and one
-- statement. Anything finer wants a real rate limiter, and that decision should
-- come with the reason a real one is needed.

CREATE TABLE IF NOT EXISTS public.public_rate_limit (
  -- "<kind>:<who>" - the caller's IP for a read, the token for a write. Named
  -- by the caller so one table serves every public path.
  bucket text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL
);

COMMENT ON TABLE public.public_rate_limit IS
  'Fixed-window counters for unauthenticated endpoints. Written only by public_rate_hit(); no RLS policy, so PostgREST exposes nothing - the anon and authenticated roles are granted nothing on it.';

CREATE INDEX IF NOT EXISTS public_rate_limit_expires_idx ON public.public_rate_limit (expires_at);

-- RLS on with NO policy: deny by default. The function below is SECURITY
-- DEFINER, so it still writes; nothing reaches the table through the API.
ALTER TABLE public.public_rate_limit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_rate_limit FROM anon, authenticated;

/**
 * Count one hit against a bucket. Returns true when it is within the limit.
 *
 * Fails OPEN on its own errors by never raising: a rate limiter that takes the
 * feature down when it has a bad day is worse than the burst it prevents. It
 * does not fail open on being over the limit - that returns false.
 */
CREATE OR REPLACE FUNCTION public.public_rate_hit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  -- One statement, so two concurrent requests cannot both read 1 and write 2.
  -- An expired row is reset rather than deleted: the same caller is the most
  -- likely next caller, so the row is about to be needed again.
  INSERT INTO public.public_rate_limit (bucket, count, expires_at)
  VALUES (p_bucket, 1, now() + make_interval(secs => p_window_seconds))
  ON CONFLICT (bucket) DO UPDATE
    SET count = CASE
                  WHEN public_rate_limit.expires_at < now() THEN 1
                  ELSE public_rate_limit.count + 1
                END,
        expires_at = CASE
                       WHEN public_rate_limit.expires_at < now()
                       THEN now() + make_interval(secs => p_window_seconds)
                       ELSE public_rate_limit.expires_at
                     END
  RETURNING count INTO v_count;

  -- Opportunistic housekeeping: buckets for callers who never came back would
  -- otherwise accumulate for ever. One in a hundred hits pays for it.
  IF random() < 0.01 THEN
    DELETE FROM public.public_rate_limit WHERE expires_at < now() - interval '1 day';
  END IF;

  RETURN v_count <= p_limit;
END $$;

COMMENT ON FUNCTION public.public_rate_hit(text, integer, integer) IS
  'Fixed-window rate limit for public endpoints. Returns true while the bucket is within p_limit for p_window_seconds.';

GRANT EXECUTE ON FUNCTION public.public_rate_hit(text, integer, integer) TO service_role;
