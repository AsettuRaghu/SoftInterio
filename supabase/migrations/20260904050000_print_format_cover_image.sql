-- Cover page is an uploaded image and nothing else.
--
-- Two corrections to the print format table, both safe because it is new and
-- still empty:
--
-- 1. cover_image_url becomes cover_image_path. The only storage bucket is
--    private, so its URLs are signed and expire within the hour - storing one
--    would leave a dead link on every format. The path is stable; a fresh
--    signed URL is minted whenever the image is actually shown.
--
-- 2. cover_title and cover_subtitle are dropped. The cover is a read-only
--    piece of company branding with no dynamic text, so nothing would ever
--    have written them.

ALTER TABLE "public"."quotation_print_formats"
  RENAME COLUMN "cover_image_url" TO "cover_image_path";

ALTER TABLE "public"."quotation_print_formats"
  DROP COLUMN IF EXISTS "cover_title",
  DROP COLUMN IF EXISTS "cover_subtitle";
