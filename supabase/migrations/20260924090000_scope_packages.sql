-- A package is what a business sells as one thing.
--
-- "Our Standard wardrobe: BWP ply carcass, laminate shutters, soft-close
-- hinges, a hanging rod and two tandem drawers." A grade gets most of the
-- way there for free - `quality_tier` is already on the items - but it
-- cannot answer a question whose answers are chosen by KIND: a shutter
-- finish is laminate or acrylic or veneer, and at 600 to 1,600 a square foot
-- it is the most expensive line on a wardrobe. Across this catalogue a grade
-- reaches 61 of 99 questions. A package names the item for every question,
-- and carries the accessories a business gives as standard with their counts.
--
-- The point is speed at the start: the seller lays a home down, presses one
-- package, and the walkthrough becomes a REVIEW rather than data entry - the
-- team refines the few things the customer actually argues about, later and
-- as deeply as they like.
--
--   scope_packages        the named thing
--   scope_package_items   one row per answer: in this component type, this
--                         cost item, optionally this many
--
-- `quantity` is null for an answer to a question (a carcass is not counted)
-- and a number for an accessory (two tandem drawers). No rates here, ever:
-- a package says WHICH items, and the price stays on the item - otherwise it
-- quietly becomes a second price list.
--
-- `scope_presets.package_id` closes the loop: qualifying a lead lays the
-- rooms down AND answers them.

CREATE TABLE IF NOT EXISTS public.scope_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scope_packages_tenant ON public.scope_packages (tenant_id, display_order);

ALTER TABLE public.scope_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scope_packages_tenant_access ON public.scope_packages;
CREATE POLICY scope_packages_tenant_access ON public.scope_packages
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

CREATE TABLE IF NOT EXISTS public.scope_package_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.scope_packages(id) ON DELETE CASCADE,
  component_type_id uuid NOT NULL REFERENCES public.component_types(id) ON DELETE CASCADE,
  cost_item_id uuid NOT NULL REFERENCES public.quotation_cost_items(id) ON DELETE CASCADE,
  -- null: the answer to a question. A number: how many of an accessory.
  quantity numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, component_type_id, cost_item_id)
);
CREATE INDEX IF NOT EXISTS scope_package_items_package ON public.scope_package_items (package_id, component_type_id);

ALTER TABLE public.scope_package_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scope_package_items_tenant_access ON public.scope_package_items;
CREATE POLICY scope_package_items_tenant_access ON public.scope_package_items
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

ALTER TABLE public.scope_presets
  ADD COLUMN IF NOT EXISTS package_id uuid REFERENCES public.scope_packages(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.scope_presets.package_id IS
  'Applied to the scope this preset lays down, so qualifying a lead answers the rooms as well as listing them.';
