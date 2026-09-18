-- Scope, third round (2026-09-18).
--
-- * The home's configuration - 2 BHK, 3 BHK… - was captured nowhere (the
--   lead's "subtype" is gated / non-gated). It is a property fact, required
--   with the floor plan when a lead is qualified, and it picks the preset
--   the scope is laid down from.
-- * The brief goes. Services wanted are what the spaces contain; finishes
--   live on the space or component; style, budget and timeline were either
--   unused or the lead's own fields. Its notes belong to the scope-level
--   discussion (scope_item_comments with a null item).

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS configuration text;
ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_configuration_check;
ALTER TABLE public.properties
  ADD CONSTRAINT properties_configuration_check
  CHECK (configuration IS NULL OR configuration IN ('studio','1bhk','2bhk','3bhk','4bhk','5bhk_plus','other'));
COMMENT ON COLUMN public.properties.configuration IS
  'studio · 1bhk … 5bhk_plus · other. Required to qualify a lead; picks the scope preset.';

-- Carry any first-conversation notes into the scope-level thread before the
-- table goes, so nothing typed today is lost.
INSERT INTO public.scope_item_comments (tenant_id, property_id, scope_item_id, body, created_by, created_at)
SELECT tenant_id, property_id, NULL, brief_notes, updated_by, COALESCE(updated_at, now())
FROM public.property_scope_brief
WHERE brief_notes IS NOT NULL AND btrim(brief_notes) <> '';

DROP TABLE IF EXISTS public.property_scope_brief;
