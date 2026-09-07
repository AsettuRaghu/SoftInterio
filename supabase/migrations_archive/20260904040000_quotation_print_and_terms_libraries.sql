-- Quotation Print Library and Quotation T&C Library.
--
-- Both are tenant-scoped catalogues that a quotation will later reference.
-- Neither changes how quotations are stored today; this migration only adds
-- the libraries and their policies, so nothing existing behaves differently
-- until the builder starts using them.

-- ---------------------------------------------------------------------------
-- Print formats
-- ---------------------------------------------------------------------------
--
-- Replaces the single presentation_level enum, which conflated three
-- independent questions and so could not express the arrangement interior
-- sellers most often want: show every component, but price only at the space
-- level. The three axes are separate columns here:
--
--   itemise_to  - how far down the hierarchy the document goes
--   price_at    - where money appears, which is NOT the same question
--   show_*      - how verbose each visible level is
--
-- Named and reusable because a company prints the same way every time, and
-- because one quotation often needs two documents: a space-level version for
-- the client and a cost-item-level version for the site team.

CREATE TABLE IF NOT EXISTS "public"."quotation_print_formats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "public"."tenants"("id") ON DELETE CASCADE,

  "name" text NOT NULL,
  "description" text,

  -- Cover page. A single full-bleed image rather than a layout editor: it
  -- covers a moodboard render, an architect's drawing or a title sheet
  -- equally well, and needs no design tooling.
  "cover_enabled" boolean NOT NULL DEFAULT false,
  "cover_image_url" text,
  "cover_title" text,
  "cover_subtitle" text,

  -- Axis 1: depth of itemisation.
  "itemise_to" text NOT NULL DEFAULT 'component'
    CHECK ("itemise_to" IN ('space', 'component', 'category', 'cost_item')),

  -- Axis 2: where prices are printed. 'none' produces a scope document with
  -- no figures at all, which is a real thing sellers send early on.
  "price_at" text NOT NULL DEFAULT 'component'
    CHECK ("price_at" IN ('space', 'component', 'category', 'cost_item', 'none')),

  -- Axis 3: verbosity at whatever levels are visible.
  "show_descriptions" boolean NOT NULL DEFAULT false,
  "show_specifications" boolean NOT NULL DEFAULT false,
  "show_dimensions" boolean NOT NULL DEFAULT true,
  "show_quantities" boolean NOT NULL DEFAULT true,

  -- Sections.
  "show_company_details" boolean NOT NULL DEFAULT true,
  "show_bank_details" boolean NOT NULL DEFAULT true,
  "show_payment_terms" boolean NOT NULL DEFAULT true,
  "show_terms" boolean NOT NULL DEFAULT true,

  -- Theme.
  "header_color" text NOT NULL DEFAULT '#1e293b',
  "footer_text" text,

  -- Exactly one default per tenant, enforced by the unique index below.
  "is_default" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "display_order" integer NOT NULL DEFAULT 0,

  "created_by" uuid REFERENCES "public"."users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "quotation_print_formats_name_not_blank" CHECK (length(trim("name")) > 0)
);

CREATE INDEX IF NOT EXISTS "idx_qpf_tenant"
  ON "public"."quotation_print_formats" ("tenant_id");

-- A partial unique index rather than a constraint: only the row flagged
-- default participates, so the rest are free to be false.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_qpf_one_default_per_tenant"
  ON "public"."quotation_print_formats" ("tenant_id")
  WHERE "is_default";

-- Names are the handle users pick these by, so duplicates would be confusing.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_qpf_unique_name_per_tenant"
  ON "public"."quotation_print_formats" ("tenant_id", lower("name"));

-- ---------------------------------------------------------------------------
-- Terms & conditions clauses
-- ---------------------------------------------------------------------------
--
-- A library of reusable clauses rather than one blob per tenant, because the
-- clauses that vary are vertical-specific: an architect needs drawing
-- ownership and statutory exclusions, a contractor needs retention and defect
-- liability, an interior vendor needs site readiness and material warranty.
--
-- Assembled text is snapshotted onto the quotation when it is created, and
-- frozen once sent. Referencing the library from a sent quotation would let an
-- edit here silently rewrite terms a client had already agreed to.

CREATE TABLE IF NOT EXISTS "public"."quotation_terms_clauses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "public"."tenants"("id") ON DELETE CASCADE,

  "title" text NOT NULL,
  "content" text NOT NULL,

  -- Free text rather than an enum: the useful groupings differ per vertical
  -- and tenants will invent their own.
  "category" text,

  -- Included automatically on a new quotation. Several clauses can be
  -- defaults, unlike print formats where exactly one applies.
  "is_default" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "display_order" integer NOT NULL DEFAULT 0,

  "created_by" uuid REFERENCES "public"."users"("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "quotation_terms_clauses_title_not_blank" CHECK (length(trim("title")) > 0),
  CONSTRAINT "quotation_terms_clauses_content_not_blank" CHECK (length(trim("content")) > 0)
);

CREATE INDEX IF NOT EXISTS "idx_qtc_tenant"
  ON "public"."quotation_terms_clauses" ("tenant_id");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_qtc_unique_title_per_tenant"
  ON "public"."quotation_terms_clauses" ("tenant_id", lower("title"));

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Same shape as the other tenant-scoped configuration tables: a row is visible
-- to members of its tenant and to nobody else.

ALTER TABLE "public"."quotation_print_formats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."quotation_terms_clauses" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qpf_tenant_access" ON "public"."quotation_print_formats";
CREATE POLICY "qpf_tenant_access" ON "public"."quotation_print_formats"
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

DROP POLICY IF EXISTS "qtc_tenant_access" ON "public"."quotation_terms_clauses";
CREATE POLICY "qtc_tenant_access" ON "public"."quotation_terms_clauses"
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

-- Keep updated_at honest without every caller remembering to set it.
CREATE OR REPLACE FUNCTION "public"."touch_updated_at"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_qpf_touch" ON "public"."quotation_print_formats";
CREATE TRIGGER "trg_qpf_touch" BEFORE UPDATE ON "public"."quotation_print_formats"
  FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();

DROP TRIGGER IF EXISTS "trg_qtc_touch" ON "public"."quotation_terms_clauses";
CREATE TRIGGER "trg_qtc_touch" BEFORE UPDATE ON "public"."quotation_terms_clauses"
  FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();
