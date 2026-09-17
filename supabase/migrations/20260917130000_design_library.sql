-- The Design Library: what this business makes, sells and admires, as
-- pictures - organised so a designer finds it sitting with a customer.
--
-- Three kinds of entry in one shape:
--   our_work      a photo from a project, promoted here; keeps the project
--   product       something we sell, optionally the cost item it represents
--   inspiration   a reference - a magazine, a client's own photo, a URL
-- Every entry has a space type (the tenant's own, from space_types), a
-- style, tags, and `visible_to_customer` - the customer portal will read
-- only the yes, and the kind labels stop someone else's work being shown
-- as ours.
--
-- Images are rows of their own pointing at storage; a promoted photo keeps
-- `document_id` so the library references the project's file rather than
-- becoming a second file store. Collections are named sets ("Amulya -
-- shortlist", "Small-flat kitchens"), optionally tied to a lead - the
-- bridge from browsing to the sales conversation.
--
-- Gated on the library.* keys that already exist (view: nearly everyone;
-- create/edit: Owner, Admin, Design Manager, Stock Manager; delete: Owner,
-- Admin, Senior Designer).

CREATE TABLE IF NOT EXISTS "public"."library_styles" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"     uuid REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
  "code"          text NOT NULL,
  "label"         text NOT NULL,
  "display_order" integer NOT NULL DEFAULT 100,
  "is_active"     boolean NOT NULL DEFAULT true,
  UNIQUE ("tenant_id", "code")
);
CREATE UNIQUE INDEX IF NOT EXISTS "library_styles_shipped_code" ON "public"."library_styles" ("code") WHERE "tenant_id" IS NULL;
INSERT INTO "public"."library_styles" ("tenant_id", "code", "label", "display_order") VALUES
  (NULL, 'modern', 'Modern', 10), (NULL, 'contemporary', 'Contemporary', 20), (NULL, 'minimalist', 'Minimalist', 30),
  (NULL, 'scandinavian', 'Scandinavian', 40), (NULL, 'industrial', 'Industrial', 50), (NULL, 'traditional', 'Traditional', 60),
  (NULL, 'luxury', 'Luxury', 70), (NULL, 'classic', 'Classic', 80)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS "public"."library_entries" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"           uuid NOT NULL REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
  "kind"                text NOT NULL CHECK ("kind" IN ('our_work', 'product', 'inspiration')),
  "title"               text NOT NULL CHECK (length(btrim("title")) > 0),
  "description"         text,
  "space_type_id"       uuid REFERENCES "public"."space_types"("id") ON DELETE SET NULL,
  "style_code"          text,
  "tags"                text[] NOT NULL DEFAULT '{}',
  "visible_to_customer" boolean NOT NULL DEFAULT true,
  -- Provenance and links, each optional.
  "project_id"          uuid REFERENCES "public"."projects"("id") ON DELETE SET NULL,
  "cost_item_id"        uuid,
  "partner_id"          uuid REFERENCES "public"."partners"("id") ON DELETE SET NULL,
  "source_url"          text,
  "created_by"          uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "created_at"          timestamptz NOT NULL DEFAULT now(),
  "updated_at"          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_library_entries_tenant" ON "public"."library_entries" ("tenant_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_library_entries_tags" ON "public"."library_entries" USING gin ("tags");

CREATE TABLE IF NOT EXISTS "public"."library_entry_images" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"      uuid NOT NULL REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
  "entry_id"       uuid NOT NULL REFERENCES "public"."library_entries"("id") ON DELETE CASCADE,
  "storage_bucket" text NOT NULL DEFAULT 'documents',
  "storage_path"   text NOT NULL,
  "file_type"      text,
  "file_size"      integer,
  -- Set when the image is a project's document, promoted. The file is the
  -- document's; deleting the document leaves the entry without it.
  "document_id"    uuid REFERENCES "public"."documents"("id") ON DELETE CASCADE,
  "display_order"  integer NOT NULL DEFAULT 0,
  "created_at"     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_library_entry_images_entry" ON "public"."library_entry_images" ("entry_id", "display_order");

CREATE TABLE IF NOT EXISTS "public"."library_collections" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"   uuid NOT NULL REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
  "name"        text NOT NULL CHECK (length(btrim("name")) > 0),
  "description" text,
  -- A shortlist for a conversation.
  "lead_id"     uuid REFERENCES "public"."leads"("id") ON DELETE SET NULL,
  "created_by"  uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "public"."library_collection_entries" (
  "collection_id" uuid NOT NULL REFERENCES "public"."library_collections"("id") ON DELETE CASCADE,
  "entry_id"      uuid NOT NULL REFERENCES "public"."library_entries"("id") ON DELETE CASCADE,
  "added_at"      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("collection_id", "entry_id")
);

ALTER TABLE "public"."library_styles"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."library_entries"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."library_entry_images"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."library_collections"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."library_collection_entries" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "library_styles_read" ON "public"."library_styles";
CREATE POLICY "library_styles_read" ON "public"."library_styles" FOR SELECT TO authenticated
  USING ("tenant_id" IS NULL OR "tenant_id" = public.get_user_tenant_id());
DROP POLICY IF EXISTS "library_styles_write" ON "public"."library_styles";
CREATE POLICY "library_styles_write" ON "public"."library_styles" FOR ALL TO authenticated
  USING ("tenant_id" = public.get_user_tenant_id()) WITH CHECK ("tenant_id" = public.get_user_tenant_id());
DROP POLICY IF EXISTS "library_entries_tenant" ON "public"."library_entries";
CREATE POLICY "library_entries_tenant" ON "public"."library_entries" FOR ALL TO authenticated
  USING ("tenant_id" = public.get_user_tenant_id()) WITH CHECK ("tenant_id" = public.get_user_tenant_id());
DROP POLICY IF EXISTS "library_entry_images_tenant" ON "public"."library_entry_images";
CREATE POLICY "library_entry_images_tenant" ON "public"."library_entry_images" FOR ALL TO authenticated
  USING ("tenant_id" = public.get_user_tenant_id()) WITH CHECK ("tenant_id" = public.get_user_tenant_id());
DROP POLICY IF EXISTS "library_collections_tenant" ON "public"."library_collections";
CREATE POLICY "library_collections_tenant" ON "public"."library_collections" FOR ALL TO authenticated
  USING ("tenant_id" = public.get_user_tenant_id()) WITH CHECK ("tenant_id" = public.get_user_tenant_id());
DROP POLICY IF EXISTS "library_collection_entries_tenant" ON "public"."library_collection_entries";
CREATE POLICY "library_collection_entries_tenant" ON "public"."library_collection_entries" FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.library_collections c WHERE c.id = "collection_id" AND c.tenant_id = public.get_user_tenant_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.library_collections c WHERE c.id = "collection_id" AND c.tenant_id = public.get_user_tenant_id()));
