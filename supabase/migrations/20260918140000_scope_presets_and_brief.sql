-- Scope, slice 1 (2026-09-18): presets and the brief. See docs/plans/scope.md.
--
-- * scope_presets: "2BHK modular", "Kitchen only" - one click lays down the
--   spaces and their usual components. Curated under Settings → Catalogue,
--   never saved from a lead. items is
--     [{ space_type_id, count, component_type_ids: uuid[] | null }]
--   where null means "the components that declare they belong in that space".
--   Seeded per tenant from the quick starts that were hard-coded in the app.
--
-- * property_scope_brief: what the customer asked for, one row per property
--   beside its scope rows - services wanted (cost item categories) and the
--   notes of the first conversation. Preferences (style, finishes, budget
--   band) land on this row in slice 3.

CREATE TABLE IF NOT EXISTS public.scope_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scope_presets_tenant ON public.scope_presets (tenant_id, display_order);

ALTER TABLE public.scope_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scope_presets_tenant_access ON public.scope_presets;
CREATE POLICY scope_presets_tenant_access ON public.scope_presets
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE TABLE IF NOT EXISTS public.property_scope_brief (
  property_id uuid PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- quotation_cost_item_categories ids: modular, carpentry, false ceiling…
  services_wanted uuid[] NOT NULL DEFAULT '{}',
  brief_notes text,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.property_scope_brief ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS property_scope_brief_tenant_access ON public.property_scope_brief;
CREATE POLICY property_scope_brief_tenant_access ON public.property_scope_brief
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Seed: the five quick starts the app used to hard-code, resolved against
-- each tenant's own space types by slug. A slug a tenant does not have is
-- skipped; a tenant with no matching types gets no preset.
DO $$
DECLARE
  t record;
  p record;
  v_items jsonb;
  v_order int;
BEGIN
  FOR t IN SELECT DISTINCT tenant_id FROM public.space_types LOOP
    v_order := 0;
    FOR p IN
      SELECT * FROM (VALUES
        ('1 BHK', '{"bedroom":1,"living-room":1,"kitchen":1,"bathroom":1,"balcony":1}'::jsonb),
        ('2 BHK', '{"bedroom":2,"living-room":1,"kitchen":1,"bathroom":2,"balcony":1}'::jsonb),
        ('3 BHK', '{"bedroom":3,"living-room":1,"dining":1,"kitchen":1,"bathroom":3,"balcony":2,"pooja-room":1}'::jsonb),
        ('4 BHK', '{"bedroom":4,"living-room":1,"dining":1,"kitchen":1,"bathroom":4,"balcony":2,"pooja-room":1,"utility":1}'::jsonb),
        ('Villa', '{"bedroom":4,"living-room":1,"dining":1,"kitchen":1,"bathroom":4,"balcony":2,"pooja-room":1,"utility":1,"study":1}'::jsonb)
      ) AS v(name, counts)
    LOOP
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'space_type_id', st.id,
               'count', (c.value)::int,
               'component_type_ids', NULL) ORDER BY st.display_order, st.name), '[]'::jsonb)
        INTO v_items
        FROM jsonb_each_text(p.counts) AS c(slug, value)
        JOIN public.space_types st ON st.tenant_id = t.tenant_id AND st.slug = c.slug;
      IF jsonb_array_length(v_items) > 0
         AND NOT EXISTS (SELECT 1 FROM public.scope_presets WHERE tenant_id = t.tenant_id AND name = p.name) THEN
        INSERT INTO public.scope_presets (tenant_id, name, description, items, display_order)
        VALUES (t.tenant_id, p.name, 'The usual rooms; components as each space type declares them.', v_items, v_order);
        v_order := v_order + 1;
      END IF;
    END LOOP;
  END LOOP;
END $$;

COMMENT ON TABLE public.scope_presets IS 'Curated starting points for a scope: spaces with counts and their components. Settings → Catalogue → Presets.';
COMMENT ON TABLE public.property_scope_brief IS 'What the customer asked for, per property: services wanted (cost item categories), notes; preferences later.';
