-- Profiles is a by-kind category, not a ladder (2026-09-22). C-Profile and
-- G-Profile were created through the form, which defaults the grade to
-- "standard", so two of the five carried a tier and Reprice read the
-- category as graded - it would have swapped one profile for another when
-- somebody upgraded a quotation. A category is graded only when its whole
-- family is.
UPDATE public.quotation_cost_items ci SET quality_tier = NULL
FROM public.quotation_cost_item_categories cat
WHERE ci.category_id = cat.id AND cat.slug = 'profiles' AND ci.quality_tier IS NOT NULL;
