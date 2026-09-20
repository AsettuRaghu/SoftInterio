-- What a component offers is a property of the component type
-- (2026-09-20, agreed with the user: "is this the way we should handle
-- this?" - no). The Scope room sheet's options had been read from
-- quotation templates: first from every template naming the type, then
-- from templates flagged `is_options_menu`, then hidden from the template
-- screens. Three explanations for one idea. Now it is one table, beside
-- the costing rule that already lives on the type:
--
--   component_type_offers   one row per item a component type offers,
--                           with what that item is PRICED PER on it.
--
-- "Priced per" moves here too: a hinge being per `hinges` on a wardrobe is
-- a fact about the component and the item, not about any template, so
-- quotation_template_line_items.quantity_key goes. Templates are templates
-- again; the 29 menu templates and the flag are removed.
--
-- Backfill keeps today's behaviour exactly: a type's flagged menu lines
-- become its offers; a type with no menu takes every active template's
-- lines for it, which is what the room sheet fell back to.

CREATE TABLE IF NOT EXISTS public.component_type_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  component_type_id uuid NOT NULL REFERENCES public.component_types(id) ON DELETE CASCADE,
  cost_item_id uuid NOT NULL REFERENCES public.quotation_cost_items(id) ON DELETE CASCADE,
  quantity_key text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (component_type_id, cost_item_id)
);
COMMENT ON TABLE public.component_type_offers IS
  'What a component type offers on the Scope room sheet, and what each item is priced per (a quantity key of the type''s costing rule; null = per piece or the one face). See lib/scope/options.';
CREATE INDEX IF NOT EXISTS idx_cto_type ON public.component_type_offers (component_type_id, display_order);
CREATE INDEX IF NOT EXISTS idx_cto_tenant ON public.component_type_offers (tenant_id);

ALTER TABLE public.component_type_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS component_type_offers_tenant_access ON public.component_type_offers;
CREATE POLICY component_type_offers_tenant_access ON public.component_type_offers
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id())
  WITH CHECK (tenant_id = public.get_user_tenant_id());

-- Backfill: flagged menus first, else every active template's lines.
WITH src AS (
  SELECT li.component_type_id, li.cost_item_id, li.quantity_key, li.display_order, t.tenant_id, t.is_options_menu
  FROM public.quotation_template_line_items li
  JOIN public.quotation_templates t ON t.id = li.template_id
  WHERE li.component_type_id IS NOT NULL AND li.cost_item_id IS NOT NULL AND t.is_active
), has_menu AS (
  SELECT DISTINCT component_type_id FROM src WHERE is_options_menu
), chosen AS (
  SELECT s.* FROM src s
  WHERE s.is_options_menu OR s.component_type_id NOT IN (SELECT component_type_id FROM has_menu)
), one AS (
  SELECT DISTINCT ON (component_type_id, cost_item_id)
         tenant_id, component_type_id, cost_item_id, quantity_key, display_order
  FROM chosen
  ORDER BY component_type_id, cost_item_id, (quantity_key IS NULL), display_order
)
INSERT INTO public.component_type_offers (tenant_id, component_type_id, cost_item_id, quantity_key, display_order)
SELECT tenant_id, component_type_id, cost_item_id, quantity_key, display_order FROM one
ON CONFLICT (component_type_id, cost_item_id) DO NOTHING;

-- The shortcut goes: menu templates, their lines, the flag, the column.
DELETE FROM public.quotation_template_line_items li
USING public.quotation_templates t WHERE li.template_id = t.id AND t.is_options_menu;
DELETE FROM public.quotation_templates WHERE is_options_menu;
ALTER TABLE public.quotation_templates DROP COLUMN IF EXISTS is_options_menu;
ALTER TABLE public.quotation_template_line_items DROP COLUMN IF EXISTS quantity_key;

-- The trigger that keeps one ① and one ② among alternatives reads the
-- offers now.
CREATE OR REPLACE FUNCTION public.scope_item_group_key(p_type uuid, p_item uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
           WHEN lower(ci.unit_code) IN ('nos','set','kg','ltr','pcs') AND o.quantity_key IS NULL THEN NULL
           ELSE ci.category_id::text || ':' || coalesce(o.quantity_key, 'face')
         END
  FROM public.quotation_cost_items ci
  LEFT JOIN public.component_type_offers o ON o.component_type_id = p_type AND o.cost_item_id = ci.id
  WHERE ci.id = p_item;
$$;
DROP FUNCTION IF EXISTS public.scope_item_group_key(uuid, uuid, boolean);

CREATE OR REPLACE FUNCTION public.scope_choice_alternatives()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_type uuid;
  v_key text;
  v_old_p1 uuid;
  v_old_p2 uuid;
BEGIN
  IF NEW.cost_item_id IS NULL OR NEW.choice_status IS NULL THEN RETURN NEW; END IF;
  SELECT component_type_id INTO v_type FROM public.property_scope_items WHERE id = NEW.parent_id;
  IF v_type IS NULL THEN RETURN NEW; END IF;
  v_key := public.scope_item_group_key(v_type, NEW.cost_item_id);
  IF v_key IS NULL THEN RETURN NEW; END IF;

  SELECT s.id INTO v_old_p1 FROM public.property_scope_items s
  WHERE s.parent_id = NEW.parent_id AND s.id <> NEW.id AND s.cost_item_id IS NOT NULL AND s.choice_status = 'p1'
    AND public.scope_item_group_key(v_type, s.cost_item_id) = v_key
  LIMIT 1;
  SELECT s.id INTO v_old_p2 FROM public.property_scope_items s
  WHERE s.parent_id = NEW.parent_id AND s.id <> NEW.id AND s.cost_item_id IS NOT NULL AND s.choice_status = 'p2'
    AND public.scope_item_group_key(v_type, s.cost_item_id) = v_key
  LIMIT 1;

  IF NEW.choice_status = 'p1' THEN
    IF v_old_p1 IS NOT NULL AND v_old_p2 IS NOT NULL THEN
      DELETE FROM public.property_scope_items WHERE id = v_old_p2;
    END IF;
    IF v_old_p1 IS NOT NULL THEN
      UPDATE public.property_scope_items SET choice_status = 'p2' WHERE id = v_old_p1;
    END IF;
  ELSIF v_old_p2 IS NOT NULL THEN
    DELETE FROM public.property_scope_items WHERE id = v_old_p2;
  END IF;
  RETURN NEW;
END $$;
