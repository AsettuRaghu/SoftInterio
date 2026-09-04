-- Migration: revoke anon on tasks_with_timing
-- Created: 2026-09-03
--
-- Follow-up to 20260903085900. That migration revoked anon on the seven views
-- that were leaking; tasks_with_timing was created afterwards and still had a
-- grant. It is NOT leaking - it was declared security_invoker from the start,
-- so RLS already returns 0 rows to an unauthenticated caller. This is purely
-- consistency and defence in depth: no view in this schema should be readable
-- by anon.

REVOKE ALL ON TABLE "public"."tasks_with_timing" FROM "anon";
