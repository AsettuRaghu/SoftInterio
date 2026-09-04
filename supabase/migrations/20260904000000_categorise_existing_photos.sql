-- Migration: categorise image uploads as photos
-- Created: 2026-09-04
--
-- Files uploaded through a task were all written with category 'other',
-- because the upload route hardcoded it. In the Documents module a site photo
-- was therefore indistinguishable from a contract, which defeats the point of
-- having a category at all.
--
-- The route now derives it from the MIME type. This corrects what is already
-- stored. Only rows still sitting at the default are touched - a category
-- somebody chose deliberately is left alone.

UPDATE "public"."documents"
   SET category = 'photo'::"public"."document_category",
       updated_at = now()
 WHERE category = 'other'
   AND file_type LIKE 'image/%';
