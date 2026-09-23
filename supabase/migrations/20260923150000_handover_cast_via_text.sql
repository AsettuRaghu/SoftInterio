-- The one broken cast, and nothing else (2026-09-23).
--
-- Every lead → project handover has failed since 2026-09-15 with
--   cannot cast type service_type_enum to project_category_enum
-- The function, recreated when the native phase engine was retired, casts
-- the lead's service type straight to the project's category with the
-- comment "the enums are the same list". They are, label for label - but
-- **Postgres will not cast one enum type to another**, identical labels or
-- not. It has to go through text. Nothing else has converted a lead since,
-- so it sat broken for eight days: the route catches the error, leaves the
-- lead won, and reports that the project could not be created.
--
-- This replays the function exactly as it was written, with that one
-- expression changed. Three attempts at rewriting it from memory each
-- broke something else (priority, status, the document copy) - the lesson
-- being to change the line, not the function.

CREATE OR REPLACE FUNCTION "public"."create_project_from_lead"(
    "p_lead_id" "uuid",
    "p_created_by" "uuid",
    "p_project_category" "text" DEFAULT 'turnkey'::"text",
    "p_quotation_id" "uuid" DEFAULT NULL::"uuid",
    "p_project_manager_id" "uuid" DEFAULT NULL::"uuid",
    "p_priority" "text" DEFAULT 'Low'::"text",
    "p_target_start_date" "date" DEFAULT NULL::"date",
    "p_target_end_date" "date" DEFAULT NULL::"date"
) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_lead RECORD;
    v_project_id UUID;
    v_project_number TEXT;
    v_quotation_id UUID := p_quotation_id;
    v_client_id UUID;
    v_property_id UUID;
    v_project_name TEXT;
    v_client_name TEXT;
    v_property_name TEXT;
BEGIN
    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found: %', p_lead_id;
    END IF;

    v_client_id := v_lead.client_id;
    v_property_id := v_lead.property_id;

    -- Already converted: hand back the existing project.
    IF v_lead.project_id IS NOT NULL THEN
        RETURN v_lead.project_id;
    END IF;

    IF v_quotation_id IS NULL THEN
        SELECT id INTO v_quotation_id FROM quotations
        WHERE lead_id = p_lead_id
        ORDER BY created_at DESC LIMIT 1;
    END IF;

    BEGIN
        SELECT generate_project_number(v_lead.tenant_id) INTO v_project_number;
    EXCEPTION WHEN OTHERS THEN
        v_project_number := 'PRJ_' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '_' || floor(random() * 100000)::text;
    END;

    SELECT name INTO v_client_name FROM clients WHERE id = v_client_id;
    SELECT property_name INTO v_property_name FROM properties WHERE id = v_property_id;
    v_project_name := COALESCE(v_client_name, 'New') || '-' || COALESCE(v_property_name, 'Property');

    INSERT INTO projects (
        tenant_id, project_number, name, description,
        client_id, property_id, project_category,
        expected_start_date, expected_end_date,
        actual_cost, contract_value,
        lead_id, quotation_id, status, priority,
        project_manager_id, created_by, is_active
    ) VALUES (
        v_lead.tenant_id,
        v_project_number,
        v_project_name,
        NULL, -- no description column on leads to carry
        v_client_id,
        v_property_id,
        v_lead.service_type::text::project_category_enum, -- same labels, still two types
        COALESCE(p_target_start_date, v_lead.expected_project_start, v_lead.target_start_date, CURRENT_DATE),
        COALESCE(p_target_end_date, v_lead.target_end_date),
        0,                  -- actual_cost is money spent, and none has been yet
        v_lead.won_amount,  -- the agreed value, frozen at handover
        p_lead_id,
        v_quotation_id,
        'new',
        p_priority::project_priority_enum,
        p_project_manager_id,
        p_created_by,
        true
    ) RETURNING id INTO v_project_id;

    -- The plan is not created here. A project starts with no plan; the
    -- playbook is chosen at kick-off (or auto-started by category, which the
    -- application does after this returns).

    UPDATE leads
    SET project_id = v_project_id,
        updated_at = NOW()
    WHERE id = p_lead_id;

    -- Documents are copied; notes are re-pointed.
    INSERT INTO documents (
        tenant_id, linked_type, linked_id,
        file_name, original_name, file_type, file_extension, file_size,
        storage_bucket, storage_path, category, title, description, tags,
        version, parent_id, is_latest, uploaded_by, created_at, updated_at
    )
    SELECT
        d.tenant_id, 'project'::public.document_linked_type, v_project_id,
        d.file_name, d.original_name, d.file_type, d.file_extension, d.file_size,
        d.storage_bucket, d.storage_path, d.category, d.title, d.description, d.tags,
        d.version, d.parent_id, d.is_latest, d.uploaded_by, NOW(), NOW()
    FROM documents d
    WHERE d.linked_type = 'lead'::public.document_linked_type
      AND d.linked_id = p_lead_id;

    UPDATE lead_notes
    SET project_id = v_project_id,
        updated_at = NOW()
    WHERE lead_id = p_lead_id
      AND project_id IS NULL;

    RETURN v_project_id;
END;
$$;

