-- Budget, timeline and turnkey-vs-modular are the lead's facts (budget_range,
-- target dates, service_type); the scope shows and edits them there, one
-- source. These columns were asked twice for a day.
ALTER TABLE public.property_scope_brief
  DROP COLUMN IF EXISTS budget_band,
  DROP COLUMN IF EXISTS open_to_carpentry,
  DROP COLUMN IF EXISTS timeline_notes;
