-- Migration: subtasks inherit their parent's linked entity
-- Created: 2026-09-03
--
-- A subtask should belong to the same lead/project as its parent. Three
-- separate creation paths each lost that link in a different way:
--
--   1. Inline "+ subtask" in the task tables sends only
--      {title, status, priority, parent_task_id} - no link at all.
--   2. The nested `subtasks` array in POST /api/tasks: the modal DOES send
--      related_type/related_id, but the handler never maps them into the
--      insert, so they are silently dropped.
--   3. Anything written directly against the table.
--
-- Result: some subtasks show their lead in the Linked column and others show
-- an empty "Link" placeholder, with no pattern a user could infer.
--
-- Fixing it in the API would only cover the callers that remember. A trigger
-- cannot be bypassed, and it will cover procedure steps later too - those are
-- subtasks created by the engine, and they must land on the right entity for
-- the gate evidence to be filed correctly.
--
-- Semantics: inherit only when the child does not specify its own link. An
-- explicit value is respected rather than overwritten.

-- ---------------------------------------------------------------------
-- 1. Inherit on insert
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."trg_tasks_inherit_parent_link"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_parent RECORD;
BEGIN
    IF NEW.parent_task_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.related_type IS NOT NULL OR NEW.related_id IS NOT NULL THEN
        RETURN NEW; -- caller was explicit; leave it alone
    END IF;

    SELECT related_type, related_id INTO v_parent
      FROM "public"."tasks"
     WHERE id = NEW.parent_task_id;

    IF FOUND THEN
        NEW.related_type := v_parent.related_type;
        NEW.related_id   := v_parent.related_id;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."trg_tasks_inherit_parent_link"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "trg_tasks_inherit_parent_link" ON "public"."tasks";
CREATE TRIGGER "trg_tasks_inherit_parent_link"
    BEFORE INSERT ON "public"."tasks"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."trg_tasks_inherit_parent_link"();

-- ---------------------------------------------------------------------
-- 2. Keep children in step when a parent is re-linked
-- ---------------------------------------------------------------------

-- Moving a parent task to a different lead/project and leaving its children
-- pointing at the old one would file their activity against the wrong entity.
CREATE OR REPLACE FUNCTION "public"."trg_tasks_cascade_link_to_subtasks"()
RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.related_type IS NOT DISTINCT FROM OLD.related_type
       AND NEW.related_id IS NOT DISTINCT FROM OLD.related_id THEN
        RETURN NULL;
    END IF;

    UPDATE "public"."tasks"
       SET related_type = NEW.related_type,
           related_id   = NEW.related_id,
           updated_at   = now()
     WHERE parent_task_id = NEW.id
       -- Only children that were following the parent, not ones deliberately
       -- pointed elsewhere.
       AND related_type IS NOT DISTINCT FROM OLD.related_type
       AND related_id IS NOT DISTINCT FROM OLD.related_id;

    RETURN NULL;
END;
$$;

ALTER FUNCTION "public"."trg_tasks_cascade_link_to_subtasks"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "trg_tasks_cascade_link" ON "public"."tasks";
CREATE TRIGGER "trg_tasks_cascade_link"
    AFTER UPDATE OF "related_type", "related_id" ON "public"."tasks"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."trg_tasks_cascade_link_to_subtasks"();

-- ---------------------------------------------------------------------
-- 3. Backfill subtasks that were created unlinked
-- ---------------------------------------------------------------------

UPDATE "public"."tasks" child
   SET related_type = parent.related_type,
       related_id   = parent.related_id
  FROM "public"."tasks" parent
 WHERE child.parent_task_id = parent.id
   AND child.related_type IS NULL
   AND child.related_id IS NULL
   AND parent.related_type IS NOT NULL;

-- Documents already filed against those subtasks were missing their parent
-- entity link for the same reason - repair them from the task.
UPDATE "public"."documents" d
   SET parent_linked_type = t.related_type::"text"::"public"."document_linked_type",
       parent_linked_id   = t.related_id
  FROM "public"."tasks" t
 WHERE d.linked_type = 'task'
   AND d.linked_id = t.id
   AND d.parent_linked_id IS NULL
   AND t.related_type IS NOT NULL;
