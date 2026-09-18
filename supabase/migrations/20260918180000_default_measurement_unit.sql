-- The unit a business measures in. Every place a unit is chosen - a scope
-- row, a quotation component or line - starts on this and can be changed
-- per row. mm / cm / inch / ft are the four both the scope and the builder
-- understand. Settings → Config.
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS default_measurement_unit text NOT NULL DEFAULT 'ft';
ALTER TABLE public.tenant_settings
  DROP CONSTRAINT IF EXISTS tenant_settings_default_measurement_unit_check;
ALTER TABLE public.tenant_settings
  ADD CONSTRAINT tenant_settings_default_measurement_unit_check
  CHECK (default_measurement_unit IN ('mm', 'cm', 'inch', 'ft'));
