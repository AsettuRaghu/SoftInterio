-- Tax comes off the print format, and the terms clause goes on it.
--
-- show_tax was the wrong place to decide this. A quotation already owns its
-- tax: set tax_percent to zero and there is no GST, which is a decision about
-- that quotation rather than about how it is laid out. Two switches for one
-- outcome is how a document ends up disagreeing with the record behind it, so
-- the format no longer has an opinion and the PDF prints whatever the
-- quotation carries.

ALTER TABLE "public"."quotation_print_formats"
  DROP COLUMN IF EXISTS "show_tax";

-- Which terms a format attaches. Previously the PDF took whichever clause was
-- marked default for the tenant, so a client document and an internal one
-- could not carry different terms - and keeping a second clause active at all
-- was a trap for whoever next changed the default.
ALTER TABLE "public"."quotation_print_formats"
  ADD COLUMN IF NOT EXISTS "terms_clause_id" uuid
    REFERENCES "public"."quotation_terms_clauses"("id") ON DELETE SET NULL;

COMMENT ON COLUMN "public"."quotation_print_formats"."terms_clause_id" IS
  'The terms clause this format prints. Null falls back to the tenant default, '
  'so an unconfigured format still produces a complete document.';

-- ON DELETE SET NULL rather than RESTRICT: deleting a clause should not be
-- blocked by a print format, and a format that loses its clause falls back to
-- the default rather than printing nothing.
