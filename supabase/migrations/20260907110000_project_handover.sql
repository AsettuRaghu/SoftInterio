-- Complete the lead -> project handover.
--
-- Three things were being dropped when a won lead became a project.
--
-- 1. The agreed value. The function hardcoded actual_cost = 0 and carried
--    won_amount nowhere, so every project read as worth nothing: the list
--    aliases actual_cost to "quoted_amount", so the Total Value figure on
--    /dashboard/projects showed zero against real won work.
--
--    contract_value is a new column rather than a reuse of actual_cost, which
--    means money *spent* and is shown as such on the Overview tab. It is
--    stored rather than read back off the lead so that editing a won lead
--    cannot silently restate a running project's value, and so a project
--    created without a lead has somewhere to keep it.
--
-- 2. The phases. p_initialize_phases has always defaulted to true and the
--    transition route passes it explicitly, but the block it controls only
--    ever *looked up* a phase - nothing called initialize_project_phases. A
--    converted project therefore started with no phases at all and the
--    Project Mgmt tab, which is the default tab, opened empty.
--
-- 3. The current phase. The kickoff lookup matched on tenant_id and name, not
--    on the project, so it would happily adopt another project's phase row as
--    this project's current_phase_id. It found nothing today only because no
--    phase is named exactly 'Project Kickoff'.
--
-- Not fixed here: description stays NULL. The obvious sources would have been
-- the lead's scope and special requirements, and neither column exists - that
-- detail lives on the property and the quotation.

ALTER TABLE "public"."projects"
  ADD COLUMN IF NOT EXISTS "contract_value" NUMERIC(14,2);

COMMENT ON COLUMN "public"."projects"."contract_value" IS
  'The agreed value of the work, frozen at handover from the lead''s won_amount. '
  'Distinct from actual_cost, which is money spent.';

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
        contract_value,
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
        0, -- actual_cost is money spent, and none has been yet
        v_lead.won_amount, -- the agreed value, frozen at handover
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
        -- Create the phases. p_initialize_phases promised this and never did
        -- it: the block only ever looked a phase up, so a project converted
        -- from a lead started with none and the Project Mgmt tab was empty.
        -- Guarded so a re-run cannot double up, and the failure is swallowed
        -- rather than rolling back the whole conversion - a project without
        -- phases is recoverable, a lost project is not.
        IF NOT EXISTS (SELECT 1 FROM project_phases WHERE project_id = v_project_id) THEN
            BEGIN
                PERFORM public.initialize_project_phases(
                    v_project_id,
                    v_lead.tenant_id,
                    COALESCE(v_lead.service_type::text, p_project_category)
                );
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'initialize_project_phases failed for project %: %', v_project_id, SQLERRM;
            END;
        END IF;

        -- Scoped to this project. It used to match on tenant_id and name, so
        -- it could adopt another project's phase as this one's current phase.
        SELECT id INTO v_kickoff_phase_id
        FROM project_phases
        WHERE project_id = v_project_id
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

-- Backfill the projects that were converted before contract_value existed.
UPDATE "public"."projects" p
   SET "contract_value" = l."won_amount"
  FROM "public"."leads" l
 WHERE p."lead_id" = l."id"
   AND p."contract_value" IS NULL
   AND l."won_amount" IS NOT NULL;
