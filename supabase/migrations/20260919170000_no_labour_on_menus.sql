-- Labour lines off every Options Menu (2026-09-19, the user's call): the
-- business quotes fitting inside its rates, so Installation / Fabrication /
-- Finishing Labour are not options a seller picks on the room sheet. The
-- items stay in the catalogue for a quotation that wants them by hand.
DELETE FROM public.quotation_template_line_items li
USING public.quotation_templates t, public.quotation_cost_items ci, public.quotation_cost_item_categories cat
WHERE li.template_id = t.id AND t.is_options_menu
  AND li.cost_item_id = ci.id AND ci.category_id = cat.id AND cat.slug = 'labour';
