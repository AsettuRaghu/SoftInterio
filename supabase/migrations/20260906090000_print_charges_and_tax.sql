-- Two flags the printed quotation needs, both on tables that already exist.
--
-- is_charge marks a cost item category as a charge rather than scope -
-- delivery, site cleanup, floor protection. A space made up entirely of such
-- items prints as a trailing "Additional charges" block instead of a numbered
-- room, which is where a transport line belongs on a client document: between
-- the room totals and the grand total, not inflating a room.
--
-- Nothing about the arithmetic changes. The charges are still ordinary line
-- items in an ordinary space, so the builder and the PDF agree on every total;
-- only the presentation differs. A charge dropped inside Kitchen still prints
-- inside Kitchen - the document never silently moves someone's line.

ALTER TABLE "public"."quotation_cost_item_categories"
  ADD COLUMN IF NOT EXISTS "is_charge" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "public"."quotation_cost_item_categories"."is_charge" IS
  'Items in this category are charges (delivery, cleanup, protection) rather '
  'than quoted scope. A space containing only these prints as an additional '
  'charges block instead of a numbered room.';

-- show_tax joins the other show_* flags. A client document that says "GST at
-- actuals" in its notes must not also print a computed GST row, and until now
-- the PDF always printed one.

ALTER TABLE "public"."quotation_print_formats"
  ADD COLUMN IF NOT EXISTS "show_tax" boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN "public"."quotation_print_formats"."show_tax" IS
  'Print the tax row. False for documents that quote pre-tax and state "GST at '
  'actuals" in the notes instead.';

-- The seeded Service category is exactly this: delivery, site cleanup and the
-- two site-protection lines.
UPDATE "public"."quotation_cost_item_categories"
   SET "is_charge" = true
 WHERE "slug" = 'service';
