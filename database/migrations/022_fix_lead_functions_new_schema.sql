-- Migration: Fix functions that use old schema
-- These functions were referencing old schema where client/property data was on leads table directly
-- Now they need to join with clients and properties tables

-- =============================================================================
-- FIX 1: create_quotation_for_lead function (used when moving to proposal_discussion)
-- =============================================================================

CREATE OR REPLACE FUNCTION "public"."create_quotation_for_lead"("p_lead_id" "uuid", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_tenant_id UUID;
    v_quotation_id UUID;
    v_quotation_number VARCHAR(50);
    v_lead RECORD;
    v_client RECORD;
    v_property RECORD;
    v_assignee UUID;
BEGIN
    -- Get lead details
    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found: %', p_lead_id;
    END IF;
    
    v_tenant_id := v_lead.tenant_id;
    
    -- Get client details (from linked client record)
    SELECT * INTO v_client FROM clients WHERE id = v_lead.client_id;
    
    -- Get property details (from linked property record, may be null)
    IF v_lead.property_id IS NOT NULL THEN
        SELECT * INTO v_property FROM properties WHERE id = v_lead.property_id;
    END IF;
    
    -- Determine assignee: provided user > lead's assigned user > lead creator
    v_assignee := COALESCE(p_user_id, v_lead.assigned_to, v_lead.created_by);
    
    -- Generate quotation number
    v_quotation_number := generate_quotation_number(v_tenant_id);
    
    -- Create the quotation with data from clients and properties tables
    INSERT INTO quotations (
        tenant_id,
        quotation_number,
        version,
        lead_id,
        client_name,
        client_email,
        client_phone,
        property_name,
        property_address,
        property_type,
        carpet_area,
        title,
        status,
        valid_from,
        valid_until,
        auto_created,
        assigned_to,
        created_by,
        updated_by
    ) VALUES (
        v_tenant_id,
        v_quotation_number,
        1,
        p_lead_id,
        v_client.name,
        v_client.email,
        v_client.phone,
        v_property.property_name,
        v_property.address_line1,
        COALESCE(v_property.property_type, 'apartment')::VARCHAR,
        v_property.carpet_area,
        COALESCE(v_lead.service_type::VARCHAR, 'Interior') || ' - ' || v_client.name,
        'draft',
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '30 days',
        true,
        v_assignee,
        v_assignee,
        v_assignee
    )
    RETURNING id INTO v_quotation_id;
    
    INSERT INTO lead_activities (
        lead_id,
        activity_type,
        title,
        description,
        created_by
    ) VALUES (
        p_lead_id,
        'quotation_sent',
        'Quotation Created',
        'Auto-created quotation ' || v_quotation_number || ' when lead moved to Proposal Discussion stage',
        v_assignee
    );
    
    RETURN v_quotation_id;
END;
$$;

COMMENT ON FUNCTION "public"."create_quotation_for_lead" IS 'Creates a new quotation for a lead. Called automatically when lead moves to proposal_discussion stage. Now pulls client data from clients table and property data from properties table.';


-- =============================================================================
-- FIX 2: create_project_from_lead function (used when marking lead as Won)
-- =============================================================================

CREATE OR REPLACE FUNCTION "public"."create_project_from_lead"(
    "p_lead_id" "uuid", 
    "p_created_by" "uuid", 
    "p_project_category" "text" DEFAULT 'turnkey'::"text", 
    "p_initialize_phases" boolean DEFAULT true
) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_lead RECORD;
    v_client RECORD;
    v_property RECORD;
    v_project_id UUID;
    v_project_number TEXT;
    v_property_type project_property_type_enum;
    v_project_category project_category_enum;
    v_project_name TEXT;
BEGIN
    -- Get lead details
    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found: %', p_lead_id;
    END IF;
    
    -- Get client details (from linked client record)
    SELECT * INTO v_client FROM clients WHERE id = v_lead.client_id;
    
    -- Get property details (from linked property record, may be null)
    IF v_lead.property_id IS NOT NULL THEN
        SELECT * INTO v_property FROM properties WHERE id = v_lead.property_id;
    END IF;
    
    -- Check if project already exists for this lead
    IF v_lead.project_id IS NOT NULL THEN
        RETURN v_lead.project_id; -- Return existing project
    END IF;
    
    -- Map property_type to projects.property_type (from properties table)
    BEGIN
        v_property_type := COALESCE(v_property.property_type, 'apartment')::TEXT::project_property_type_enum;
    EXCEPTION WHEN OTHERS THEN
        v_property_type := 'apartment'::project_property_type_enum;
    END;
    
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
    
    -- Generate project number (with fallback)
    BEGIN
        SELECT generate_project_number(v_lead.tenant_id) INTO v_project_number;
    EXCEPTION WHEN OTHERS THEN
        v_project_number := 'PRJ-' || to_char(NOW(), 'YYYYMMDD') || '-' || floor(random() * 10000)::text;
    END;
    
    -- Generate project name (use property name or client name)
    v_project_name := COALESCE(
        v_property.property_name, 
        v_client.name || '''s ' || 
        CASE 
            WHEN v_property.property_type::TEXT LIKE 'apartment%' THEN 'Apartment'
            WHEN v_property.property_type::TEXT LIKE 'villa%' THEN 'Villa'
            WHEN v_property.property_type::TEXT = 'independent_house' THEN 'House'
            WHEN v_property.property_type::TEXT LIKE 'commercial%' THEN 'Commercial'
            ELSE 'Property'
        END || ' Project'
    );
    
    -- Create project with aligned fields
    INSERT INTO projects (
        tenant_id,
        project_number,
        name,
        description,
        -- Client info (from clients table)
        client_name,
        client_email,
        client_phone,
        -- Property info (from properties table)
        property_type,
        property_name,
        flat_number,
        carpet_area_sqft,
        -- Location (from properties table)
        site_address,
        city,
        pincode,
        -- Project classification
        project_category,
        project_type,  -- Keep for backward compatibility
        -- Dates
        start_date,
        expected_end_date,
        -- Financials
        quoted_amount,
        budget_amount,
        budget_range,
        -- Lead tracking
        lead_source,
        lead_source_detail,
        sales_rep_id,
        lead_won_date,
        -- References
        converted_from_lead_id,
        lead_id,
        -- Status
        status,
        created_by,
        is_active
    ) VALUES (
        v_lead.tenant_id,
        v_project_number,
        v_project_name,
        v_lead.project_scope,
        -- Client info (from clients table)
        v_client.name,
        v_client.email,
        v_client.phone,
        -- Property info (from properties table)
        v_property_type,
        v_property.property_name,
        v_property.unit_number,
        v_property.carpet_area,
        -- Location (from properties table)
        v_property.address_line1,
        COALESCE(v_property.city, 'Unknown'),
        v_property.pincode,
        -- Project classification
        v_project_category,
        -- Legacy project_type (backward compatibility)
        CASE 
            WHEN v_property.property_type::TEXT LIKE 'apartment%' THEN 'apartment'
            WHEN v_property.property_type::TEXT LIKE 'villa%' THEN 'villa'
            WHEN v_property.property_type::TEXT = 'independent_house' THEN 'residential'
            WHEN v_property.property_type::TEXT LIKE 'commercial_office%' THEN 'office'
            WHEN v_property.property_type::TEXT LIKE 'commercial_retail%' THEN 'retail'
            WHEN v_property.property_type::TEXT LIKE 'commercial%' THEN 'commercial'
            ELSE 'residential'
        END,
        -- Dates
        COALESCE(v_lead.expected_project_start, v_lead.target_start_date, CURRENT_DATE),
        v_lead.target_end_date,
        -- Financials
        COALESCE(v_lead.won_amount, v_lead.estimated_value, 0),
        COALESCE(v_lead.won_amount, v_lead.estimated_value, 0),
        v_lead.budget_range::TEXT,
        -- Lead tracking
        v_lead.lead_source::TEXT,
        v_lead.lead_source_detail,
        v_lead.assigned_to,
        v_lead.won_at,
        -- References
        p_lead_id,
        p_lead_id,
        -- Status
        'planning',
        p_created_by,
        true
    ) RETURNING id INTO v_project_id;
    
    -- Update lead with project reference
    UPDATE leads 
    SET project_id = v_project_id,
        updated_at = NOW()
    WHERE id = p_lead_id;
    
    -- Initialize phases if requested
    IF p_initialize_phases THEN
        BEGIN
            PERFORM initialize_project_phases(
                v_project_id, 
                v_lead.tenant_id, 
                v_project_category::TEXT
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Phase initialization failed: %', SQLERRM;
        END;
    END IF;
    
    -- Create activity log
    INSERT INTO lead_activities (
        lead_id,
        activity_type,
        title,
        description,
        created_by
    ) VALUES (
        p_lead_id,
        'other',
        'Project Created',
        'Project ' || v_project_number || ' created from this lead',
        p_created_by
    );
    
    RETURN v_project_id;
END;
$$;

-- Add comment
COMMENT ON FUNCTION "public"."create_project_from_lead" IS 'Creates a project from a lead, pulling client data from clients table and property data from properties table';
