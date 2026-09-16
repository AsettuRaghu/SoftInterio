-- A file attached to a step is the record of that step, and it belongs with
-- the project's documents.
--
-- task_attachments and documents are two stores that never met: a site
-- measurement sheet uploaded on "Site Measurement Collection" satisfied the
-- step's gate and then vanished from view - the project's Documents tab reads
-- `documents` only. Now a file attached to any task of a project is mirrored
-- there, same storage object, categorised (photo for images, otherwise
-- reference) and tagged with the stage and the step, so it can be found by
-- either. Deleting the attachment removes the mirror; the object itself is
-- the attachment's to delete.

CREATE OR REPLACE FUNCTION "public"."mirror_task_attachment_to_documents"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task    RECORD;
  v_stage   text;
  v_tags    text[];
  v_cat     public.document_category;
BEGIN
  SELECT t.id, t.title, t.related_type, t.related_id, t.parent_task_id, t.procedure_run_id, t.tenant_id
    INTO v_task FROM public.tasks t WHERE t.id = NEW.task_id;
  IF NOT FOUND OR v_task.related_type <> 'project' OR v_task.related_id IS NULL OR NEW.storage_path IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_task.parent_task_id IS NOT NULL THEN
    SELECT title INTO v_stage FROM public.tasks WHERE id = v_task.parent_task_id;
  END IF;

  v_tags := ARRAY['step: ' || v_task.title];
  IF v_stage IS NOT NULL THEN v_tags := v_tags || ('stage: ' || v_stage); END IF;
  IF v_task.procedure_run_id IS NOT NULL THEN v_tags := v_tags || 'playbook'; END IF;

  v_cat := CASE WHEN COALESCE(NEW.file_type, '') LIKE 'image/%' THEN 'photo'::public.document_category
                ELSE 'reference'::public.document_category END;

  INSERT INTO public.documents (
    tenant_id, linked_type, linked_id, file_name, original_name, file_type, file_extension, file_size,
    storage_bucket, storage_path, category, title, description, tags, uploaded_by
  ) VALUES (
    COALESCE(NEW.tenant_id, v_task.tenant_id), 'project', v_task.related_id,
    NEW.file_name, NEW.file_name, NEW.file_type,
    NULLIF(lower(substring(NEW.file_name from '\\.([A-Za-z0-9]+)$')), ''),
    NEW.file_size, COALESCE(NEW.storage_bucket, 'documents'), NEW.storage_path,
    v_cat, NEW.file_name, NEW.description, v_tags, NEW.uploaded_by
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_mirror_task_attachment" ON "public"."task_attachments";
CREATE TRIGGER "trg_mirror_task_attachment"
  AFTER INSERT ON "public"."task_attachments"
  FOR EACH ROW EXECUTE FUNCTION "public"."mirror_task_attachment_to_documents"();

CREATE OR REPLACE FUNCTION "public"."unmirror_task_attachment"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.documents WHERE storage_path = OLD.storage_path AND linked_type = 'project';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS "trg_unmirror_task_attachment" ON "public"."task_attachments";
CREATE TRIGGER "trg_unmirror_task_attachment"
  AFTER DELETE ON "public"."task_attachments"
  FOR EACH ROW EXECUTE FUNCTION "public"."unmirror_task_attachment"();

-- Files already attached to project steps.
INSERT INTO public.documents (
  tenant_id, linked_type, linked_id, file_name, original_name, file_type, file_extension, file_size,
  storage_bucket, storage_path, category, title, description, tags, uploaded_by
)
SELECT COALESCE(a.tenant_id, t.tenant_id), 'project', t.related_id,
       a.file_name, a.file_name, a.file_type,
       NULLIF(lower(substring(a.file_name from '\\.([A-Za-z0-9]+)$')), ''),
       a.file_size, COALESCE(a.storage_bucket, 'documents'), a.storage_path,
       CASE WHEN COALESCE(a.file_type, '') LIKE 'image/%' THEN 'photo'::public.document_category ELSE 'reference'::public.document_category END,
       a.file_name, a.description,
       ARRAY['step: ' || t.title] || COALESCE(ARRAY['stage: ' || p.title], '{}') || CASE WHEN t.procedure_run_id IS NOT NULL THEN ARRAY['playbook'] ELSE '{}' END,
       a.uploaded_by
  FROM public.task_attachments a
  JOIN public.tasks t ON t.id = a.task_id
  LEFT JOIN public.tasks p ON p.id = t.parent_task_id
 WHERE t.related_type = 'project' AND t.related_id IS NOT NULL AND a.storage_path IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.storage_path = a.storage_path AND d.linked_type = 'project');
