-- Two reasons the Production stage needs.
--
-- Finished goods are made by a vendor and shipped by one; neither "lead time"
-- nor "short supply" describes a factory running behind or a truck that has
-- not left. Shipped defaults, so every tenant gets them.

INSERT INTO "public"."delay_reasons" ("owner", "code", "label", "display_order") VALUES
  ('vendor', 'production_delay', 'Production delay at vendor', 40),
  ('vendor', 'dispatch_delay',   'Dispatch / transport delay',  50)
ON CONFLICT DO NOTHING;
