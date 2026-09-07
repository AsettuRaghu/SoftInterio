-- Replace the generated margin_amount column with a plain one.
--
-- The generated definition computed:
--
--   (rate - company_cost) * length * width / 144
--
-- The /144 is square inches per square foot, so the formula assumes dimensions
-- are in INCHES. This application stores them in millimetres by default - the
-- builder explicitly defaults to mm "for precision" - so the figure came out
-- wrong by orders of magnitude: a 1000x1000mm panel at Rs.50 margin per sqft
-- should be about Rs.538 and the column produced Rs.347,222.
--
-- It also ignored quantity entirely, and ignored measurement_unit, so it could
-- not have been correct for count-based or length-based lines either.
--
-- Being generated, it also rejected any insert that mentioned it, which meant
-- the save path could not write margin at all.
--
-- The replacement is written by the application, which already owns unit
-- conversion (calculateSqft handles mm/cm/inch/ft). Duplicating that logic in
-- SQL would guarantee the two drift.
--
-- Nothing is lost: the column is null on all 452 existing rows, because it
-- depended on company_cost, which the save path never wrote.

ALTER TABLE "public"."quotation_line_items"
  DROP COLUMN IF EXISTS "margin_amount";

ALTER TABLE "public"."quotation_line_items"
  ADD COLUMN "margin_amount" numeric;

COMMENT ON COLUMN "public"."quotation_line_items"."margin_amount" IS
  'Profit on this line at the time it was priced: (rate - company_cost) x the '
  'same measure that produced amount. Written by the API, never by the client. '
  'Null when company_cost is unknown - which is not the same as zero margin.';
