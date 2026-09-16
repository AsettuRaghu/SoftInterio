-- The default reasons are unique by code, so four "other" rows collided and
-- only the client's survived. One code per owner.
DELETE FROM "public"."delay_reasons" WHERE "tenant_id" IS NULL AND "code" = 'other';
INSERT INTO "public"."delay_reasons" ("owner", "code", "label", "display_order") VALUES
  ('client',      'other_client',      'Other (say what in the note)', 99),
  ('vendor',      'other_vendor',      'Other (say what in the note)', 99),
  ('internal',    'other_internal',    'Other (say what in the note)', 99),
  ('third_party', 'other_third_party', 'Other (say what in the note)', 99)
ON CONFLICT DO NOTHING;
