-- Migration: enforce task tag uniqueness
-- Created: 2026-09-03
--
-- task_tags had no unique constraint, so nothing stopped a tenant ending up
-- with "Site Visit" three times. The create-tag API already handles error
-- 23505 with "A tag with this name already exists" - that branch was simply
-- unreachable. Now that tags can be created inline from the task modals,
-- duplicates would arrive quickly and quietly ruin tag-based reporting.
--
-- Uniqueness is on lower(name) so "Site Visit" and "site visit" collide,
-- which is what a user expects.

-- ---------------------------------------------------------------------
-- 1. Fold any existing duplicates onto the oldest tag of that name
-- ---------------------------------------------------------------------

-- Repoint assignments to the keeper before deleting the losers.
UPDATE "public"."task_tag_assignments" a
   SET "tag_id" = keeper.keep_id
  FROM (
        SELECT t.id AS dup_id,
               FIRST_VALUE(t.id) OVER (
                   PARTITION BY t.tenant_id, lower(t.name)
                   ORDER BY t.created_at, t.id
               ) AS keep_id
          FROM "public"."task_tags" t
       ) keeper
 WHERE a."tag_id" = keeper.dup_id
   AND keeper.dup_id <> keeper.keep_id;

-- Collapse rows that just became duplicates of an existing assignment.
DELETE FROM "public"."task_tag_assignments" a
 USING "public"."task_tag_assignments" b
 WHERE a."task_id" = b."task_id"
   AND a."tag_id"  = b."tag_id"
   AND a."id" > b."id";

DELETE FROM "public"."task_tags" t
 WHERE EXISTS (
       SELECT 1 FROM "public"."task_tags" other
        WHERE other."tenant_id" = t."tenant_id"
          AND lower(other."name") = lower(t."name")
          AND (other."created_at", other."id") < (t."created_at", t."id")
 );

-- ---------------------------------------------------------------------
-- 2. Constraints
-- ---------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS "idx_task_tags_tenant_name_unique"
    ON "public"."task_tags" USING "btree" ("tenant_id", lower(("name")::"text"));

-- A task should not carry the same tag twice. The update path replaces the
-- whole set so it cannot produce these, but nothing else guaranteed it.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_task_tag_assignments_unique"
    ON "public"."task_tag_assignments" USING "btree" ("task_id", "tag_id");

COMMENT ON INDEX "public"."idx_task_tags_tenant_name_unique" IS 'Tag names are unique per tenant, case-insensitively. Makes the 23505 branch in POST /api/tasks/tags reachable.';
