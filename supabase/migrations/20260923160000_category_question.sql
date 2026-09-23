-- A category can say how it is asked (2026-09-23), so the room sheet reads
-- as a conversation rather than as a catalogue:
--
--   question  the prompt. Blank falls back to "Which <name>?", which is why
--             "Shutters by Finish" read as "Which shutters by finish?".
--   decision  two categories with the same decision are ONE question. The
--             doors either take handles or they are handleless with a
--             profile - two categories, one thing to decide - and until now
--             nothing said so, so a seller could answer both or neither and
--             was never asked the question at all.
--
-- Both optional and both the tenant's: a blank decision means the category
-- is its own question, which is every other category.
ALTER TABLE public.quotation_cost_item_categories
  ADD COLUMN IF NOT EXISTS question text,
  ADD COLUMN IF NOT EXISTS decision text;
COMMENT ON COLUMN public.quotation_cost_item_categories.question IS
  'How the room sheet asks for this - "Which shutter finish?". Blank falls back to "Which <name>?".';
COMMENT ON COLUMN public.quotation_cost_item_categories.decision IS
  'Categories sharing a decision are asked as one question - handles and profiles are both "How do the doors open?". Blank means this category is its own question.';

UPDATE public.quotation_cost_item_categories SET question = v.q, decision = v.d
FROM (VALUES
  ('carcass',          'Which carcass?',                 NULL),
  ('shutters',         'Which shutter grade?',           NULL),
  ('shutter-finishes', 'Which shutter finish?',          NULL),
  ('hinges',           'Which hinges?',                  NULL),
  ('handles',          'How do the doors open?',         'door_opening'),
  ('profiles',         'How do the doors open?',         'door_opening'),
  ('sliding-systems',  'Which sliding system?',          NULL),
  ('drawer-systems',   'Which drawer system?',           NULL),
  ('countertop',       'Which countertop?',              NULL),
  ('dado-backsplash',  'Which dado / backsplash?',       NULL),
  ('wall-paneling',    'Which wall panelling?',          NULL),
  ('profile-lighting', 'Which profile lighting?',        NULL),
  ('lighting',         'Lighting?',                      NULL),
  ('glass-mirror',     'Glass or mirror?',               NULL),
  ('internals',        'What goes inside?',              NULL),
  ('accessories',      'Anything else?',                 NULL),
  ('appliances',       'Which appliances?',              NULL),
  ('false-ceiling',    'Which ceiling?',                 NULL),
  ('painting',         'Which paint?',                   NULL),
  ('electrical',       'What electrical work?',          NULL),
  ('civil-plumbing',   'What civil or plumbing work?',   NULL),
  ('soft-furnishings', 'Which soft furnishings?',        NULL),
  ('labour',           'Which labour?',                  NULL),
  ('service',          'Which site services?',           NULL)
) AS v(slug, q, d)
WHERE quotation_cost_item_categories.slug = v.slug;
