-- Property scope: the rooms and areas a client actually wants work in.
--
-- Captured by the seller during the lead, long before a quotation exists, and
-- deliberately hung off properties rather than leads. A property already spans
-- both sides of the funnel - 13 of 15 leads and both projects point at one -
-- so scope entered during the sales conversation is the same scope the project
-- executes against, with nothing copied and nothing to fall out of step.
--
-- This inverts what happens today. The project Rooms tab currently derives its
-- rooms from quotation_spaces of the approved quotation, which means rooms
-- cannot exist before a quotation does, and a room is a by-product of a
-- commercial document rather than a fact about the building.

-- ---------------------------------------------------------------------------
-- Space types gain a container flag
-- ---------------------------------------------------------------------------
--
-- Interiors are flat: a property has rooms. Architecture nests: a property has
-- floors, and a floor has a reception and a cafeteria. One self-referencing
-- table serves both, but the UI has to know which types may hold children or
-- someone will nest a wardrobe inside a washroom.

ALTER TABLE "public"."space_types"
  ADD COLUMN IF NOT EXISTS "is_container" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "public"."space_types"."is_container" IS
  'Whether spaces of this type may contain other spaces. False for rooms; true '
  'for things like Floor or Block, which architecture and multi-storey work need.';

-- ---------------------------------------------------------------------------
-- Scope items
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."property_scope_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
  "property_id" uuid NOT NULL REFERENCES "public"."properties"("id") ON DELETE CASCADE,

  -- Self-reference for the nesting architecture needs. Deleting a floor takes
  -- its rooms with it, which is what anyone would expect.
  "parent_id" uuid REFERENCES "public"."property_scope_items"("id") ON DELETE CASCADE,

  -- The vocabulary is tenant-scoped already, so an architect tenant defines
  -- Elevation and Landscaping while an interior tenant keeps Pooja Room.
  "space_type_id" uuid REFERENCES "public"."space_types"("id") ON DELETE SET NULL,

  -- One row per real room. "5 washrooms" is entered as a count and expanded
  -- immediately, because every washroom diverges later: different sizes,
  -- measured separately, becoming separate quotation spaces and separate work.
  "name" text NOT NULL,
  "display_order" integer NOT NULL DEFAULT 0,

  -- Rough at the sales table, confirmed after a site visit. Nullable
  -- throughout: a seller with a layout PDF often has no numbers at all.
  "length" numeric,
  "width" numeric,
  "height" numeric,
  "measurement_unit" text NOT NULL DEFAULT 'ft'
    CHECK ("measurement_unit" IN ('mm', 'cm', 'inch', 'ft', 'm')),

  -- Provenance matters more than it looks: you quote on rough numbers and cut
  -- material on confirmed ones, and replacing one with the other is exactly
  -- when a quotation should ask to be reviewed.
  "measurement_source" text NOT NULL DEFAULT 'discussion'
    CHECK ("measurement_source" IN ('discussion', 'client_cad', 'site_survey')),
  "measurement_status" text NOT NULL DEFAULT 'rough'
    CHECK ("measurement_status" IN ('rough', 'confirmed')),

  "notes" text,

  "created_by" uuid REFERENCES "public"."users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "property_scope_items_name_not_blank"
    CHECK (length(trim("name")) > 0),
  -- Cheap guard against the obvious cycle. Deeper cycles are prevented by the
  -- UI only offering containers as parents, and are not worth a recursive
  -- trigger here.
  CONSTRAINT "property_scope_items_no_self_parent"
    CHECK ("parent_id" IS NULL OR "parent_id" <> "id")
);

CREATE INDEX IF NOT EXISTS "idx_psi_property"
  ON "public"."property_scope_items" ("property_id", "display_order");
CREATE INDEX IF NOT EXISTS "idx_psi_parent"
  ON "public"."property_scope_items" ("parent_id");
CREATE INDEX IF NOT EXISTS "idx_psi_tenant"
  ON "public"."property_scope_items" ("tenant_id");

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Same shape as the other tenant-scoped tables.

ALTER TABLE "public"."property_scope_items" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "psi_tenant_access" ON "public"."property_scope_items";
CREATE POLICY "psi_tenant_access" ON "public"."property_scope_items"
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

DROP TRIGGER IF EXISTS "trg_psi_touch" ON "public"."property_scope_items";
CREATE TRIGGER "trg_psi_touch" BEFORE UPDATE ON "public"."property_scope_items"
  FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();
