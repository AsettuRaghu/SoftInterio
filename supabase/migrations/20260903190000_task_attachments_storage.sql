-- Migration: make task attachments storable, and start tracking storage usage
-- Created: 2026-09-03
--
-- PART 1 - task_attachments needs storage columns
--
-- The table had file_url only. The documents bucket is PRIVATE, so a stored
-- URL would be a signed link that expires - useless a minute later. The
-- documents table solves this by keeping storage_bucket + storage_path and
-- minting a signed URL per read; task_attachments now does the same.
--
-- tenant_id is denormalised on for two reasons: the storage path is
-- tenant-scoped, and usage rollups should not have to join through tasks.
-- The table is empty (0 rows), so this costs nothing.
--
-- PART 2 - storage_used_bytes has never been written
--
-- tenant_usage.storage_used_bytes is READ in the billing page and in
-- change-plan downgrade validation, but nothing has ever written it. 19
-- documents are uploaded and every tenant still reports 0 bytes. So the
-- billing page shows "0 GB used" permanently and a downgrade is validated
-- against a number that is always zero.
--
-- Maintaining it in the API would only cover the paths that remember to. A
-- trigger cannot be bypassed, so it is maintained in the database from both
-- documents and task_attachments, and backfilled from what already exists.

-- ---------------------------------------------------------------------
-- 1. Storage columns on task_attachments
-- ---------------------------------------------------------------------

ALTER TABLE "public"."task_attachments"
    ADD COLUMN IF NOT EXISTS "tenant_id"      "uuid",
    ADD COLUMN IF NOT EXISTS "storage_bucket" character varying(100),
    ADD COLUMN IF NOT EXISTS "storage_path"   "text",
    ADD COLUMN IF NOT EXISTS "description"    "text";

COMMENT ON COLUMN "public"."task_attachments"."storage_path" IS 'Path within storage_bucket. The bucket is private, so read paths mint a short-lived signed URL rather than storing one.';
COMMENT ON COLUMN "public"."task_attachments"."file_url" IS 'Legacy. Kept for older rows; new uploads use storage_bucket + storage_path.';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_attachments_tenant_id_fkey') THEN
        ALTER TABLE ONLY "public"."task_attachments"
            ADD CONSTRAINT "task_attachments_tenant_id_fkey"
            FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_task_attachments_tenant"
    ON "public"."task_attachments" USING "btree" ("tenant_id");

-- file_url was NOT NULL, which blocks the new storage_path-based rows.
ALTER TABLE "public"."task_attachments" ALTER COLUMN "file_url" DROP NOT NULL;

-- ---------------------------------------------------------------------
-- 2. Storage usage rollup
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."recalc_tenant_storage"("p_tenant_id" "uuid")
RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_docs  bigint;
    v_atts  bigint;
    v_count integer;
BEGIN
    SELECT COALESCE(SUM(file_size), 0), COUNT(*)
      INTO v_docs, v_count
      FROM "public"."documents"
     WHERE tenant_id = p_tenant_id;

    SELECT COALESCE(SUM(file_size), 0)
      INTO v_atts
      FROM "public"."task_attachments"
     WHERE tenant_id = p_tenant_id;

    UPDATE "public"."tenant_usage"
       SET storage_used_bytes = v_docs + v_atts,
           documents_count    = v_count,
           last_calculated_at = now(),
           updated_at         = now()
     WHERE tenant_id = p_tenant_id;

    -- A tenant with no usage row yet still needs one.
    IF NOT FOUND THEN
        INSERT INTO "public"."tenant_usage" (tenant_id, storage_used_bytes, documents_count)
        VALUES (p_tenant_id, v_docs + v_atts, v_count)
        ON CONFLICT DO NOTHING;
    END IF;
END;
$$;

ALTER FUNCTION "public"."recalc_tenant_storage"("uuid") OWNER TO "postgres";
COMMENT ON FUNCTION "public"."recalc_tenant_storage"("uuid") IS 'Recompute tenant_usage.storage_used_bytes from documents + task_attachments. Called by triggers on both tables.';

CREATE OR REPLACE FUNCTION "public"."trg_recalc_tenant_storage"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    PERFORM "public"."recalc_tenant_storage"(
        COALESCE(NEW.tenant_id, OLD.tenant_id)
    );
    RETURN NULL; -- AFTER trigger, return value unused
END;
$$;

ALTER FUNCTION "public"."trg_recalc_tenant_storage"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "trg_documents_storage" ON "public"."documents";
CREATE TRIGGER "trg_documents_storage"
    AFTER INSERT OR DELETE OR UPDATE OF "file_size" ON "public"."documents"
    FOR EACH ROW EXECUTE FUNCTION "public"."trg_recalc_tenant_storage"();

DROP TRIGGER IF EXISTS "trg_task_attachments_storage" ON "public"."task_attachments";
CREATE TRIGGER "trg_task_attachments_storage"
    AFTER INSERT OR DELETE OR UPDATE OF "file_size" ON "public"."task_attachments"
    FOR EACH ROW EXECUTE FUNCTION "public"."trg_recalc_tenant_storage"();

-- ---------------------------------------------------------------------
-- 3. Backfill what is already stored
-- ---------------------------------------------------------------------

DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM "public"."tenants" LOOP
        PERFORM "public"."recalc_tenant_storage"(t.id);
    END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 4. Grants
-- ---------------------------------------------------------------------

GRANT ALL ON FUNCTION "public"."recalc_tenant_storage"("uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalc_tenant_storage"("uuid") TO "service_role";
