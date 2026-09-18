-- library_styles are addressed by code everywhere in the app, not by id.
ALTER TABLE public.property_scope_brief DROP COLUMN IF EXISTS style_ids;
ALTER TABLE public.property_scope_brief ADD COLUMN IF NOT EXISTS style_codes text[] NOT NULL DEFAULT '{}';
