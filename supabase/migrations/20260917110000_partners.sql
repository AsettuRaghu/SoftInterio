-- Partners: everyone a business works with, in one place.
--
-- See docs/plans/partners.md. One record per outside party (a person or an
-- organisation), the hats it wears for this business (customer, architect,
-- factory, distributor, producer, contractor - shipped, and a business may
-- add its own), and the people at it. It sits ABOVE the two tables that
-- already hold outside parties: `clients` (every lead creates one) and
-- `stock_vendors` (purchase orders hang off them). Both get a partner_id,
-- both are backfilled, neither is changed otherwise - leads, projects,
-- quotations and purchase orders keep working.
--
-- `platform_identity_id` is the party's OWN account on SoftInterio, when
-- they have one - the customer's portal, a factory that is itself a tenant.
-- Ours to point at, never ours to own: nothing reads it yet, and it is the
-- one column the ecosystem later hangs off. A partner record is a business's
-- VIEW of a party, never the source of truth for the party's identity.
--
-- Same person, twice: within a business the phone number says "same
-- person", email is a second hint. Enforced at creation time by the API
-- ("this is Amulya - use her?"), not by a unique index: the test data has
-- fifteen customers on one phone number and they are kept as fifteen
-- partners so testing is not disturbed.

-- ---------------------------------------------------------------------------
-- Types: the hats. Shipped rows have tenant_id NULL; a business adds beside.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."partner_types" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"     uuid REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
  "code"          text NOT NULL,
  "label"         text NOT NULL,
  "description"   text,
  "display_order" integer NOT NULL DEFAULT 100,
  "is_active"     boolean NOT NULL DEFAULT true,
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("tenant_id", "code")
);
CREATE UNIQUE INDEX IF NOT EXISTS "partner_types_shipped_code" ON "public"."partner_types" ("code") WHERE "tenant_id" IS NULL;

INSERT INTO "public"."partner_types" ("tenant_id", "code", "label", "description", "display_order") VALUES
  (NULL, 'customer',         'Customer',               'The people and companies we build for.',                              10),
  (NULL, 'architect',        'Architect',              'Architects and designers who bring us work, or whom we execute for.', 20),
  (NULL, 'interior_factory', 'Interior Factory / OEM', 'Factories that produce modular units and furniture for us.',          30),
  (NULL, 'distributor',      'Distributor',            'Hardware, accessories, laminates, lighting - the people we buy from.', 40),
  (NULL, 'producer',         'Producer',               'Manufacturers we commission directly.',                               50),
  (NULL, 'contractor',       'Contractor',             'Painting, electrical, civil, false ceiling - trades we bring to site.', 60)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Partners
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."partners" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"            uuid NOT NULL REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
  "kind"                 text NOT NULL DEFAULT 'person' CHECK ("kind" IN ('person', 'organisation')),
  "name"                 text NOT NULL CHECK (length(btrim("name")) > 0),
  "display_name"         text,
  "phone"                text,
  "email"                text,
  "website"              text,
  "address_line1"        text,
  "address_line2"        text,
  "city"                 text,
  "state"                text,
  "pincode"              text,
  "country"              text DEFAULT 'India',
  "gst_number"           text,
  "pan_number"           text,
  "notes"                text,
  "status"               text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'inactive')),
  -- The party's own account on the platform, when they have one. Empty
  -- today; the ecosystem hangs off it later. Never a source of truth here.
  "platform_identity_id" uuid,
  "created_by"           uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "updated_by"           uuid,
  "created_at"           timestamptz NOT NULL DEFAULT now(),
  "updated_at"           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_partners_tenant" ON "public"."partners" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_partners_phone" ON "public"."partners" ("tenant_id", "phone") WHERE "phone" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_partners_email" ON "public"."partners" ("tenant_id", "email") WHERE "email" IS NOT NULL;

COMMENT ON TABLE "public"."partners" IS 'An outside party this business works with, in whatever roles. A business''s view of the party; see docs/plans/partners.md.';
COMMENT ON COLUMN "public"."partners"."platform_identity_id" IS 'The party''s own account on SoftInterio, when they have one. Empty today; nothing reads it.';

-- The hats a partner wears.
CREATE TABLE IF NOT EXISTS "public"."partner_type_links" (
  "partner_id" uuid NOT NULL REFERENCES "public"."partners"("id") ON DELETE CASCADE,
  "type_code"  text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("partner_id", "type_code")
);
CREATE INDEX IF NOT EXISTS "idx_partner_type_links_type" ON "public"."partner_type_links" ("type_code");

-- The people at a partner. Exactly one primary per partner: its owner.
CREATE TABLE IF NOT EXISTS "public"."partner_contacts" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"   uuid NOT NULL REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
  "partner_id"  uuid NOT NULL REFERENCES "public"."partners"("id") ON DELETE CASCADE,
  "name"        text NOT NULL CHECK (length(btrim("name")) > 0),
  "designation" text,
  "phone"       text,
  "email"       text,
  "is_primary"  boolean NOT NULL DEFAULT false,
  "notes"       text,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_partner_contacts_partner" ON "public"."partner_contacts" ("partner_id");
CREATE UNIQUE INDEX IF NOT EXISTS "partner_contacts_one_primary" ON "public"."partner_contacts" ("partner_id") WHERE "is_primary";

-- ---------------------------------------------------------------------------
-- RLS: tenant membership, the same predicate clients uses.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."partner_types"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."partners"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."partner_type_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."partner_contacts"   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_types_read" ON "public"."partner_types";
CREATE POLICY "partner_types_read" ON "public"."partner_types" FOR SELECT TO authenticated
  USING ("tenant_id" IS NULL OR "tenant_id" = public.get_user_tenant_id());
DROP POLICY IF EXISTS "partner_types_write" ON "public"."partner_types";
CREATE POLICY "partner_types_write" ON "public"."partner_types" FOR ALL TO authenticated
  USING ("tenant_id" = public.get_user_tenant_id()) WITH CHECK ("tenant_id" = public.get_user_tenant_id());

DROP POLICY IF EXISTS "partners_tenant" ON "public"."partners";
CREATE POLICY "partners_tenant" ON "public"."partners" FOR ALL TO authenticated
  USING ("tenant_id" = public.get_user_tenant_id()) WITH CHECK ("tenant_id" = public.get_user_tenant_id());

DROP POLICY IF EXISTS "partner_type_links_tenant" ON "public"."partner_type_links";
CREATE POLICY "partner_type_links_tenant" ON "public"."partner_type_links" FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.partners p WHERE p.id = "partner_id" AND p.tenant_id = public.get_user_tenant_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.partners p WHERE p.id = "partner_id" AND p.tenant_id = public.get_user_tenant_id()));

DROP POLICY IF EXISTS "partner_contacts_tenant" ON "public"."partner_contacts";
CREATE POLICY "partner_contacts_tenant" ON "public"."partner_contacts" FOR ALL TO authenticated
  USING ("tenant_id" = public.get_user_tenant_id()) WITH CHECK ("tenant_id" = public.get_user_tenant_id());

-- ---------------------------------------------------------------------------
-- The two tables that already hold outside parties point at their partner.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."clients"       ADD COLUMN IF NOT EXISTS "partner_id" uuid REFERENCES "public"."partners"("id") ON DELETE SET NULL;
ALTER TABLE "public"."stock_vendors" ADD COLUMN IF NOT EXISTS "partner_id" uuid REFERENCES "public"."partners"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "idx_clients_partner"       ON "public"."clients" ("partner_id");
CREATE INDEX IF NOT EXISTS "idx_stock_vendors_partner" ON "public"."stock_vendors" ("partner_id");

-- Backfill: one partner per client (customer), one per vendor (distributor -
-- the business re-hats them). Deliberately no merging by phone here: the
-- test data shares one number across fifteen customers.
DO $$
DECLARE r RECORD; v_id uuid;
BEGIN
  FOR r IN SELECT * FROM public.clients WHERE partner_id IS NULL LOOP
    INSERT INTO public.partners (tenant_id, kind, name, display_name, phone, email, city, state, pincode, country, status, created_by, created_at, updated_at)
    VALUES (r.tenant_id,
            CASE WHEN r.client_type = 'individual' THEN 'person' ELSE 'organisation' END,
            r.name, r.display_name, NULLIF(btrim(r.phone), ''), NULLIF(lower(btrim(r.email)), ''), r.city, r.state, r.pincode, COALESCE(r.country, 'India'),
            CASE WHEN r.status::text IN ('inactive', 'blacklisted', 'archived') THEN 'inactive' ELSE 'active' END,
            r.created_by, r.created_at, r.updated_at)
    RETURNING id INTO v_id;
    INSERT INTO public.partner_type_links (partner_id, type_code) VALUES (v_id, 'customer');
    INSERT INTO public.partner_contacts (tenant_id, partner_id, name, phone, email, is_primary)
    VALUES (r.tenant_id, v_id, r.name, NULLIF(btrim(r.phone), ''), NULLIF(lower(btrim(r.email)), ''), true);
    UPDATE public.clients SET partner_id = v_id WHERE id = r.id;
  END LOOP;

  FOR r IN SELECT * FROM public.stock_vendors WHERE partner_id IS NULL LOOP
    INSERT INTO public.partners (tenant_id, kind, name, display_name, phone, email, website, city, state, pincode, country, gst_number, pan_number, notes, status, created_by, created_at, updated_at)
    VALUES (r.tenant_id, 'organisation', r.name, r.display_name, NULLIF(btrim(r.phone), ''), NULLIF(lower(btrim(r.email)), ''), r.website,
            r.city, r.state, r.pincode, COALESCE(r.country, 'India'), r.gst_number, r.pan_number, r.notes,
            CASE WHEN r.is_active THEN 'active' ELSE 'inactive' END,
            r.created_by, COALESCE(r.created_at, now()), COALESCE(r.updated_at, now()))
    RETURNING id INTO v_id;
    INSERT INTO public.partner_type_links (partner_id, type_code) VALUES (v_id, 'distributor');
    IF r.contact_person IS NOT NULL AND btrim(r.contact_person) <> '' THEN
      INSERT INTO public.partner_contacts (tenant_id, partner_id, name, phone, email, is_primary)
      VALUES (r.tenant_id, v_id, r.contact_person, NULLIF(btrim(r.phone), ''), NULLIF(lower(btrim(r.email)), ''), true);
    ELSE
      INSERT INTO public.partner_contacts (tenant_id, partner_id, name, phone, email, is_primary)
      VALUES (r.tenant_id, v_id, r.name, NULLIF(btrim(r.phone), ''), NULLIF(lower(btrim(r.email)), ''), true);
    END IF;
    UPDATE public.stock_vendors SET partner_id = v_id WHERE id = r.id;
  END LOOP;
END $$;
