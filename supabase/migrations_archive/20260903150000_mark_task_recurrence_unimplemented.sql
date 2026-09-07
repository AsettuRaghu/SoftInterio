-- Migration: document that task recurrence is not implemented
-- Created: 2026-09-03
--
-- tasks.is_recurring / recurrence_rule / recurrence_end_date have existed
-- since the module was built, but nothing reads or writes them: no scheduler,
-- no recurrence engine, no UI, no API field. A column named is_recurring that
-- silently does nothing is worse than no column at all, because the next
-- person to look at the schema will assume the feature works.
--
-- Deliberately NOT dropping them - that is a product call, and recurrence is
-- a reasonable thing to want. This just makes the state of affairs explicit
-- until someone decides.

COMMENT ON COLUMN "public"."tasks"."is_recurring" IS 'NOT IMPLEMENTED. No scheduler or recurrence engine exists; nothing reads or writes this. Build the feature or drop the column.';
COMMENT ON COLUMN "public"."tasks"."recurrence_rule" IS 'NOT IMPLEMENTED. Intended for an RRULE string, but no code parses it.';
COMMENT ON COLUMN "public"."tasks"."recurrence_end_date" IS 'NOT IMPLEMENTED. Companion to recurrence_rule, unused.';
