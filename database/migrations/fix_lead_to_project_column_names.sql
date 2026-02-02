-- Migration: Fix Lead to Project Conversion - Column Name Errors
-- Issue: Both create_project_from_lead RPC functions were using incorrect column name 'start_date' 
--        instead of the correct 'expected_start_date'
-- Error: "column "start_date" of relation "projects" does not exist"
-- Date: 2026-01-11

-- =====================================================
-- FIX VERSION 1: Recreate create_project_from_lead (basic version)
-- =====================================================

CREATE OR REPLACE FUNCTION "public"."create_project_from_lead"("p_lead_id" "uuid", "p_created_by" "uuid", "p_project_category" "text" DEFAULT 'turnkey'::"text", "p_initialize_phases" boolean DEFAULT true, "p_quotation_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_lead RECORD;
    v_project_id UUID;
    v_project_number TEXT;
    v_project_category project_category_enum;
    v_quotation_id UUID := p_quotation_id;
    v_client_id UUID;
    v_property_id UUID;
    v_project_name TEXT;
    v_client_name TEXT;
BEGIN
    -- Get lead details
    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found: %', p_lead_id;
    END IF;
    
    -- Set Client and Property IDs from Lead
    v_client_id := v_lead.client_id;
    v_property_id := v_lead.property_id;
    
    -- Check if project already exists for this lead
    IF v_lead.project_id IS NOT NULL THEN
        RETURN v_lead.project_id; -- Return existing project
    END IF;

    -- If no quotation ID provided, try to find the latest one for this lead
    IF v_quotation_id IS NULL THEN
        SELECT id INTO v_quotation_id FROM quotations 
        WHERE lead_id = p_lead_id 
        ORDER BY created_at DESC LIMIT 1;
    END IF;
    
    -- Map leads.service_type to projects.project_category
    v_project_category := CASE 
        WHEN v_lead.service_type::TEXT = 'turnkey' THEN 'turnkey'::project_category_enum
        WHEN v_lead.service_type::TEXT = 'modular' THEN 'modular'::project_category_enum
        WHEN v_lead.service_type::TEXT = 'renovation' THEN 'renovation'::project_category_enum
        WHEN v_lead.service_type::TEXT = 'consultation' THEN 'consultation'::project_category_enum
        WHEN v_lead.service_type::TEXT = 'commercial_fitout' THEN 'commercial_fitout'::project_category_enum
        WHEN v_lead.service_type::TEXT = 'other' THEN 'other'::project_category_enum
        WHEN p_project_category = 'hybrid' THEN 'hybrid'::project_category_enum
        ELSE 'turnkey'::project_category_enum
    END;
    
    -- Generate project number
    BEGIN
        SELECT generate_project_number(v_lead.tenant_id) INTO v_project_number;
    EXCEPTION WHEN OTHERS THEN
        v_project_number := 'PRJ_' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '_' || floor(random() * 100000)::text;
    END;
    
    -- Generate project name using Client Name + Category/Type
    SELECT name INTO v_client_name FROM clients WHERE id = v_client_id;
    v_project_name := COALESCE(v_client_name, 'New') || ' - ' || INITCAP(v_project_category::TEXT) || ' Project';
    
    -- Create project with correct column names
    INSERT INTO projects (
        tenant_id,
        project_number,
        name,
        description,
        client_id,
        property_id,
        project_category,
        expected_start_date,
        expected_end_date,
        actual_cost,
        lead_id,
        quotation_id,
        status,
        created_by,
        is_active
    ) VALUES (
        v_lead.tenant_id,
        v_project_number,
        v_project_name,
        NULL, -- description: not available from leads table
        v_client_id,
        v_property_id,
        v_project_category,
        COALESCE(v_lead.expected_project_start, v_lead.target_start_date, CURRENT_DATE),
        v_lead.target_end_date,
        0, -- actual_cost starts at 0
        p_lead_id,
        v_quotation_id,
        'planning',
        p_created_by,
        true
    ) RETURNING id INTO v_project_id;
    
    -- Update lead with project reference
    UPDATE leads 
    SET project_id = v_project_id,
        updated_at = NOW()
    WHERE id = p_lead_id;

    -- Copy all documents from lead to project
    -- Documents in the unified documents table are linked by linked_type and linked_id
    INSERT INTO documents (
        tenant_id,
        linked_type,
        linked_id,
        file_name,
        original_name,
        file_type,
        file_extension,
        file_size,
        storage_bucket,
        storage_path,
        category,
        title,
        description,
        tags,
        version,
        parent_id,
        is_latest,
        uploaded_by,
        created_at,
        updated_at
    )
    SELECT
        d.tenant_id,
        'project'::public.document_linked_type, -- Change linked_type to project
        v_project_id, -- Link to the new project
        d.file_name,
        d.original_name,
        d.file_type,
        d.file_extension,
        d.file_size,
        d.storage_bucket,
        d.storage_path,
        d.category,
        d.title,
        d.description,
        d.tags,
        d.version,
        d.parent_id,
        d.is_latest,
        d.uploaded_by,
        NOW(),
        NOW()
    FROM documents d
    WHERE d.linked_type = 'lead'::public.document_linked_type 
    AND d.linked_id = p_lead_id;

    -- Copy lead notes to project (these can be associated with both lead and project)
    UPDATE lead_notes
    SET project_id = v_project_id,
        updated_at = NOW()
    WHERE lead_id = p_lead_id
    AND project_id IS NULL; -- Only update if not already linked to project
    
    -- Initialize phases if requested
    IF p_initialize_phases THEN
        BEGIN
            -- Only initialize if phases table exists
            -- Correct columns: planned_start_date, planned_end_date (not start_date, expected_end_date)
            -- Phases: Project Kickoff > Design > Procurement > Site Work > Installation > Handover
            INSERT INTO project_phases (project_id, name, planned_start_date, planned_end_date, status, display_order)
            VALUES 
                (v_project_id, 'Project Kickoff', CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', 'not_started', 1),
                (v_project_id, 'Design', CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '30 days', 'not_started', 2),
                (v_project_id, 'Procurement', CURRENT_DATE + INTERVAL '30 days', CURRENT_DATE + INTERVAL '60 days', 'not_started', 3),
                (v_project_id, 'Site Work', CURRENT_DATE + INTERVAL '60 days', CURRENT_DATE + INTERVAL '90 days', 'not_started', 4),
                (v_project_id, 'Installation', CURRENT_DATE + INTERVAL '90 days', COALESCE(v_lead.target_end_date, CURRENT_DATE + INTERVAL '120 days'), 'not_started', 5),
                (v_project_id, 'Handover', COALESCE(v_lead.target_end_date, CURRENT_DATE + INTERVAL '120 days'), COALESCE(v_lead.target_end_date, CURRENT_DATE + INTERVAL '120 days') + INTERVAL '5 days', 'not_started', 6);
        EXCEPTION WHEN undefined_table THEN
            NULL; -- Phases table doesn't exist, skip initialization
        END;
    END IF;
    
    RETURN v_project_id;
END;
$$;

ALTER FUNCTION "public"."create_project_from_lead"("p_lead_id" "uuid", "p_created_by" "uuid", "p_project_category" "text", "p_initialize_phases" boolean, "p_quotation_id" "uuid") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."create_project_from_lead"("p_lead_id" "uuid", "p_created_by" "uuid", "p_project_category" "text", "p_initialize_phases" boolean, "p_quotation_id" "uuid") IS 'Creates a new project from a won lead with quotation linking and phase initialization';


-- =====================================================
-- FIX VERSION 2: Recreate create_project_from_lead (extended version with project manager, priority, and dates)
-- =====================================================

CREATE OR REPLACE FUNCTION "public"."create_project_from_lead"("p_lead_id" "uuid", "p_created_by" "uuid", "p_project_category" "text" DEFAULT 'turnkey'::"text", "p_initialize_phases" boolean DEFAULT true, "p_quotation_id" "uuid" DEFAULT NULL::"uuid", "p_project_manager_id" "uuid" DEFAULT NULL::"uuid", "p_priority" "text" DEFAULT 'Low'::"text", "p_target_start_date" "date" DEFAULT NULL::"date", "p_target_end_date" "date" DEFAULT NULL::"date") RETURNS "uuid"
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
    v_kickoff_phase_id UUID;
BEGIN
    -- Get lead details
    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found: %', p_lead_id;
    END IF;
    
    -- Set Client and Property IDs from Lead
    v_client_id := v_lead.client_id;
    v_property_id := v_lead.property_id;
    
    -- Check if project already exists for this lead
    IF v_lead.project_id IS NOT NULL THEN
        RETURN v_lead.project_id; -- Return existing project
    END IF;

    -- If no quotation ID provided, try to find the latest one for this lead
    IF v_quotation_id IS NULL THEN
        SELECT id INTO v_quotation_id FROM quotations 
        WHERE lead_id = p_lead_id 
        ORDER BY created_at DESC LIMIT 1;
    END IF;
    
    -- Generate project number
    BEGIN
        SELECT generate_project_number(v_lead.tenant_id) INTO v_project_number;
    EXCEPTION WHEN OTHERS THEN
        v_project_number := 'PRJ_' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '_' || floor(random() * 100000)::text;
    END;
    
    -- Generate project name: ClientName-PropertyName (e.g., "Israeli Man-Villa Sunrise")
    SELECT name INTO v_client_name FROM clients WHERE id = v_client_id;
    SELECT property_name INTO v_property_name FROM properties WHERE id = v_property_id;
    v_project_name := COALESCE(v_client_name, 'New') || '-' || COALESCE(v_property_name, 'Property');

    -- Create project with proper initialization of all fields
    -- CORRECTED: Using 'expected_start_date' and 'expected_end_date' (not 'start_date' and 'expected_end_date')
    INSERT INTO projects (
        tenant_id,
        project_number,
        name,
        description,
        client_id,
        property_id,
        project_category,
        expected_start_date,
        expected_end_date,
        actual_cost,
        lead_id,
        quotation_id,
        status,
        priority,
        project_manager_id,
        created_by,
        is_active
    ) VALUES (
        v_lead.tenant_id,
        v_project_number,
        v_project_name,
        NULL, -- description: not available from leads table
        v_client_id,
        v_property_id,
        v_lead.service_type::project_category_enum, -- Use service_type directly (enums are identical)
        COALESCE(p_target_start_date, v_lead.expected_project_start, v_lead.target_start_date, CURRENT_DATE),
        COALESCE(p_target_end_date, v_lead.target_end_date),
        0, -- actual_cost starts at 0
        p_lead_id,
        v_quotation_id,
        'new',
        p_priority::project_priority_enum, -- Use provided priority parameter
        p_project_manager_id, -- Assign selected project manager
        p_created_by,
        true
    ) RETURNING id INTO v_project_id;
    
    -- Find or create "Project Kickoff" phase and set as current phase
    IF p_initialize_phases THEN
        SELECT id INTO v_kickoff_phase_id 
        FROM project_phases 
        WHERE tenant_id = v_lead.tenant_id 
        AND name = 'Project Kickoff'
        LIMIT 1;
        
        -- If Project Kickoff phase exists, update project with it
        IF v_kickoff_phase_id IS NOT NULL THEN
            UPDATE projects 
            SET current_phase_id = v_kickoff_phase_id
            WHERE id = v_project_id;
        END IF;
    END IF;
    
    -- Update lead with project reference
    UPDATE leads 
    SET project_id = v_project_id,
        updated_at = NOW()
    WHERE id = p_lead_id;

    -- Copy all documents from lead to project
    INSERT INTO documents (
        tenant_id,
        linked_type,
        linked_id,
        file_name,
        original_name,
        file_type,
        file_extension,
        file_size,
        storage_bucket,
        storage_path,
        category,
        title,
        description,
        tags,
        version,
        parent_id,
        is_latest,
        uploaded_by,
        created_at,
        updated_at
    )
    SELECT
        d.tenant_id,
        'project'::public.document_linked_type,
        v_project_id,
        d.file_name,
        d.original_name,
        d.file_type,
        d.file_extension,
        d.file_size,
        d.storage_bucket,
        d.storage_path,
        d.category,
        d.title,
        d.description,
        d.tags,
        d.version,
        d.parent_id,
        d.is_latest,
        d.uploaded_by,
        NOW(),
        NOW()
    FROM documents d
    WHERE d.linked_type = 'lead'::public.document_linked_type 
    AND d.linked_id = p_lead_id;

    -- Copy lead notes to project
    UPDATE lead_notes
    SET project_id = v_project_id,
        updated_at = NOW()
    WHERE lead_id = p_lead_id
    AND project_id IS NULL;

    RETURN v_project_id;
END;
$$;

ALTER FUNCTION "public"."create_project_from_lead"("p_lead_id" "uuid", "p_created_by" "uuid", "p_project_category" "text", "p_initialize_phases" boolean, "p_quotation_id" "uuid", "p_project_manager_id" "uuid", "p_priority" "text", "p_target_start_date" "date", "p_target_end_date" "date") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."create_project_from_lead"("p_lead_id" "uuid", "p_created_by" "uuid", "p_project_category" "text", "p_initialize_phases" boolean, "p_quotation_id" "uuid", "p_project_manager_id" "uuid", "p_priority" "text", "p_target_start_date" "date", "p_target_end_date" "date") IS 'Creates a new project from a won lead with project manager assignment, priority, and custom dates. Includes quotation linking and phase initialization.';
