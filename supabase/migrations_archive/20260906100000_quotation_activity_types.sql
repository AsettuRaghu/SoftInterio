-- Activity types for the three quotation events worth a timeline entry:
-- created, revised, and status changed.
--
-- Postgres will not let a new enum value be added and then used in the same
-- transaction, so this migration only widens the types. The function and route
-- changes that use them are in 20260906100100.
--
-- lead_activity_type_enum already has quotation_sent and quotation_revised.
-- What it lacks is a value for "a quotation now exists" and one for "its
-- status moved", which is why create_quotation_for_lead has been logging
-- creation as quotation_sent - a timeline claiming eleven quotations were sent
-- to clients when none had been.

ALTER TYPE "public"."lead_activity_type_enum"
  ADD VALUE IF NOT EXISTS 'quotation_created';
ALTER TYPE "public"."lead_activity_type_enum"
  ADD VALUE IF NOT EXISTS 'quotation_status_changed';

-- The project side had no quotation vocabulary at all, which matters more
-- there: once a quotation is copied into a project as its baseline, it is the
-- document the work is delivered against.
ALTER TYPE "public"."project_activity_type_enum"
  ADD VALUE IF NOT EXISTS 'quotation_created';
ALTER TYPE "public"."project_activity_type_enum"
  ADD VALUE IF NOT EXISTS 'quotation_revised';
ALTER TYPE "public"."project_activity_type_enum"
  ADD VALUE IF NOT EXISTS 'quotation_status_changed';
