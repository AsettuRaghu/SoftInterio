-- Sensible starting mappings for which components belong in which spaces.
--
-- Only fills rows where applicable_space_types is still null, so a tenant who
-- has already classified something keeps their answer. Matched on slug, so a
-- tenant missing a space type simply gets a shorter list rather than an error.
--
-- Components that genuinely go anywhere - false ceiling, wall panelling - are
-- deliberately left null. Null means "no restriction", and inventing a list for
-- them would hide them from rooms they legitimately belong in.

-- Kitchen units: kitchens only.
UPDATE "public"."component_types" ct
SET "applicable_space_types" = (
  SELECT array_agg(st."id") FROM "public"."space_types" st
  WHERE st."tenant_id" = ct."tenant_id" AND st."slug" IN ('kitchen')
)
WHERE ct."applicable_space_types" IS NULL
  AND ct."slug" IN ('kitchen-base-unit', 'kitchen-wall-unit',
                    'kitchen-tall-unit', 'kitchen-loft-unit');

-- Wardrobes and beds: sleeping spaces.
UPDATE "public"."component_types" ct
SET "applicable_space_types" = (
  SELECT array_agg(st."id") FROM "public"."space_types" st
  WHERE st."tenant_id" = ct."tenant_id"
    AND st."slug" IN ('bedroom', 'servant-room')
)
WHERE ct."applicable_space_types" IS NULL
  AND (ct."slug" LIKE 'wardrobe%' OR ct."slug" = 'bed');

-- Dressing table: bedrooms.
UPDATE "public"."component_types" ct
SET "applicable_space_types" = (
  SELECT array_agg(st."id") FROM "public"."space_types" st
  WHERE st."tenant_id" = ct."tenant_id" AND st."slug" IN ('bedroom')
)
WHERE ct."applicable_space_types" IS NULL AND ct."slug" = 'dressing-table';

-- Study table: a study, or a bedroom doubling as one.
UPDATE "public"."component_types" ct
SET "applicable_space_types" = (
  SELECT array_agg(st."id") FROM "public"."space_types" st
  WHERE st."tenant_id" = ct."tenant_id"
    AND st."slug" IN ('study-room', 'bedroom')
)
WHERE ct."applicable_space_types" IS NULL AND ct."slug" = 'study-table';

-- TV unit: living areas and bedrooms.
UPDATE "public"."component_types" ct
SET "applicable_space_types" = (
  SELECT array_agg(st."id") FROM "public"."space_types" st
  WHERE st."tenant_id" = ct."tenant_id"
    AND st."slug" IN ('living-room', 'bedroom', 'theater-room')
)
WHERE ct."applicable_space_types" IS NULL AND ct."slug" = 'tv-unit';

-- Crockery unit: where food is served or stored.
UPDATE "public"."component_types" ct
SET "applicable_space_types" = (
  SELECT array_agg(st."id") FROM "public"."space_types" st
  WHERE st."tenant_id" = ct."tenant_id" AND st."slug" IN ('dining', 'kitchen')
)
WHERE ct."applicable_space_types" IS NULL AND ct."slug" = 'crockery-unit';

-- Bar unit: entertaining spaces.
UPDATE "public"."component_types" ct
SET "applicable_space_types" = (
  SELECT array_agg(st."id") FROM "public"."space_types" st
  WHERE st."tenant_id" = ct."tenant_id"
    AND st."slug" IN ('living-room', 'dining')
)
WHERE ct."applicable_space_types" IS NULL AND ct."slug" = 'bar-unit';

-- Console table: circulation spaces.
UPDATE "public"."component_types" ct
SET "applicable_space_types" = (
  SELECT array_agg(st."id") FROM "public"."space_types" st
  WHERE st."tenant_id" = ct."tenant_id"
    AND st."slug" IN ('foyer', 'entrance', 'living-room', 'passage')
)
WHERE ct."applicable_space_types" IS NULL AND ct."slug" = 'console-table';

-- Shoe rack: entry points and the utility area.
UPDATE "public"."component_types" ct
SET "applicable_space_types" = (
  SELECT array_agg(st."id") FROM "public"."space_types" st
  WHERE st."tenant_id" = ct."tenant_id"
    AND st."slug" IN ('foyer', 'entrance', 'utility')
)
WHERE ct."applicable_space_types" IS NULL AND ct."slug" = 'shoe-rack';

-- Vanity: bathrooms.
UPDATE "public"."component_types" ct
SET "applicable_space_types" = (
  SELECT array_agg(st."id") FROM "public"."space_types" st
  WHERE st."tenant_id" = ct."tenant_id" AND st."slug" IN ('bathroom')
)
WHERE ct."applicable_space_types" IS NULL AND ct."slug" = 'vanity';

-- A tenant may have none of the matched space types, in which case the
-- subquery returns null and the row stays unrestricted - which is correct.
