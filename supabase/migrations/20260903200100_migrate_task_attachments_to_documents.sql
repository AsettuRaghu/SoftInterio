-- Migration: fold task attachments into the documents module
-- Created: 2026-09-03
-- Depends on 20260903200000_document_linked_type_task.sql
--
-- Files uploaded on a task lived in task_attachments and were invisible to the
-- Documents module, to the lead/project Documents tab, and to document search.
-- A site photo captured on a task did not appear in the project's document
-- record - which is exactly where anyone would look for it, and exactly what
-- the Procedures upload gates will be capturing.
--
-- Two tables holding one concept also means categories, tags, titles, search
-- and versioning only ever get built on one of them.
--
-- A task belongs to a lead or project via tasks.related_type/related_id, so
-- linked_type='task' alone would still not surface the file on the parent's
-- Documents tab. parent_linked_type/parent_linked_id carry that second link,
-- letting one row appear in both places.

-- ---------------------------------------------------------------------
-- 1. Parent link
-- ---------------------------------------------------------------------

ALTER TABLE "public"."documents"
    ADD COLUMN IF NOT EXISTS "parent_linked_type" "public"."document_linked_type",
    ADD COLUMN IF NOT EXISTS "parent_linked_id"   "uuid";

COMMENT ON COLUMN "public"."documents"."parent_linked_type" IS 'Secondary link for documents attached to a nested entity. A file on a task carries linked_type=task plus the task''s lead/project here, so it appears in both places.';

CREATE INDEX IF NOT EXISTS "idx_documents_parent_linked"
    ON "public"."documents" USING "btree" ("parent_linked_type", "parent_linked_id");

CREATE INDEX IF NOT EXISTS "idx_documents_linked"
    ON "public"."documents" USING "btree" ("linked_type", "linked_id");

-- ---------------------------------------------------------------------
-- 2. Move existing task attachments across
-- ---------------------------------------------------------------------

INSERT INTO "public"."documents" (
    tenant_id, linked_type, linked_id,
    parent_linked_type, parent_linked_id,
    file_name, original_name, file_type, file_extension, file_size,
    storage_bucket, storage_path, category, description, uploaded_by, created_at
)
SELECT
    a.tenant_id,
    'task'::"public"."document_linked_type",
    a.task_id,
    -- The task's own link, when it has one.
    CASE WHEN t.related_type IS NOT NULL
         THEN t.related_type::"text"::"public"."document_linked_type" END,
    t.related_id,
    -- documents.file_name is the STORED name; task_attachments.file_name was
    -- the original, so recover the stored one from the path.
    COALESCE(regexp_replace(a.storage_path, '^.*/', ''), a.file_name),
    a.file_name,
    a.file_type,
    NULLIF(regexp_replace(a.file_name, '^.*\.', '.'), a.file_name),
    a.file_size,
    COALESCE(a.storage_bucket, 'documents'),
    a.storage_path,
    'other'::"public"."document_category",
    a.description,
    a.uploaded_by,
    a.created_at
FROM "public"."task_attachments" a
JOIN "public"."tasks" t ON t.id = a.task_id
WHERE a.storage_path IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM "public"."documents" d WHERE d.storage_path = a.storage_path
  );

-- Rows are now in documents; the originals would double-count against quota.
DELETE FROM "public"."task_attachments"
 WHERE storage_path IS NOT NULL
   AND storage_path IN (SELECT storage_path FROM "public"."documents");

COMMENT ON TABLE "public"."task_attachments" IS 'DEPRECATED. Task files are documents with linked_type=task. Retained empty so historic references do not break; drop once nothing reads it.';

-- ---------------------------------------------------------------------
-- 3. Correct the storage rollups after moving rows between tables
-- ---------------------------------------------------------------------

DO $$
DECLARE t RECORD;
BEGIN
    FOR t IN SELECT id FROM "public"."tenants" LOOP
        PERFORM "public"."recalc_tenant_storage"(t.id);
    END LOOP;
END $$;
