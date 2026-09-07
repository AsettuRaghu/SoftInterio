# Archived migrations

The 43 deltas applied between 2026-09-03 and 2026-09-07, all of them live in
production and all recorded in the remote migration ledger.

They are kept out of `supabase/migrations/` because
`20260101000000_baseline_schema.sql` already contains their effects. Replaying
them on top of the baseline would be redundant, and in the case of the
`CREATE OR REPLACE FUNCTION` ones actively harmful — an old migration would
overwrite a newer function definition with the version it had at the time.

They are kept rather than deleted because each one carries the reasoning for
the change in its comments, which is the only written record of why the schema
looks the way it does.

Do not re-run these. To add schema changes, write a new migration in
`supabase/migrations/` and apply it with `supabase db push`.
