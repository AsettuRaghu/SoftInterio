-- Typical components for a space type.
--
-- "A bedroom usually gets a wardrobe, a TV unit and a false ceiling." Without
-- this, adding four bedrooms to a property means four separate trips to the
-- component picker, which is exactly the repetition that makes sellers avoid
-- capturing scope at all.
--
-- Deliberately a table rather than a jsonb column on space_types: these are
-- real references to component_types, and a foreign key means a component type
-- cannot be deleted while quietly leaving a broken default behind.

CREATE TABLE IF NOT EXISTS "public"."space_type_default_components" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
  "space_type_id" uuid NOT NULL
    REFERENCES "public"."space_types"("id") ON DELETE CASCADE,
  "component_type_id" uuid NOT NULL
    REFERENCES "public"."component_types"("id") ON DELETE CASCADE,

  -- Most rooms take one of each, but two wardrobes in a master bedroom is
  -- common enough to be worth storing rather than making people add a second.
  "quantity" integer NOT NULL DEFAULT 1 CHECK ("quantity" > 0 AND "quantity" <= 20),
  "display_order" integer NOT NULL DEFAULT 0,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  -- One row per component type per space type; quantity carries the count.
  CONSTRAINT "space_type_default_components_unique"
    UNIQUE ("space_type_id", "component_type_id")
);

CREATE INDEX IF NOT EXISTS "idx_stdc_space_type"
  ON "public"."space_type_default_components" ("space_type_id", "display_order");
CREATE INDEX IF NOT EXISTS "idx_stdc_tenant"
  ON "public"."space_type_default_components" ("tenant_id");

ALTER TABLE "public"."space_type_default_components" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stdc_tenant_access" ON "public"."space_type_default_components";
CREATE POLICY "stdc_tenant_access" ON "public"."space_type_default_components"
  FOR ALL TO authenticated
  USING (
    "tenant_id" IN (
      SELECT "tenant_id" FROM "public"."users" WHERE "id" = auth.uid()
    )
  )
  WITH CHECK (
    "tenant_id" IN (
      SELECT "tenant_id" FROM "public"."users" WHERE "id" = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS "trg_stdc_touch" ON "public"."space_type_default_components";
CREATE TRIGGER "trg_stdc_touch"
  BEFORE UPDATE ON "public"."space_type_default_components"
  FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();
