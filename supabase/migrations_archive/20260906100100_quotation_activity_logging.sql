-- Uses the enum values added in 20260906100000. A separate migration because
-- Postgres refuses to use an enum value added in the same transaction.
--
-- create_quotation_for_lead logged every quotation as 'quotation_sent',
-- including the ones the stage trigger raises automatically. The title said
-- "Quotation Created" while the type said sent, so the timeline read one way
-- and filtered another. Only that CASE changes; the numbering, versioning and
-- defaults logic is the existing body, replaced verbatim.

CREATE OR REPLACE FUNCTION "public"."create_quotation_for_lead"("p_lead_id" "uuid", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_tenant_id UUID;
    v_quotation_id UUID;
    v_quotation_number VARCHAR(50);
    v_new_version INTEGER;
    v_lead RECORD;
    v_client RECORD;
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
    
    -- Determine assignee: provided user > lead's assigned user > lead creator
    v_assignee := COALESCE(p_user_id, v_lead.assigned_to, v_lead.created_by);
    
    -- Check if lead already has a quotation
    -- If exists: reuse the same quotation_number but create a new version (revision)
    -- If not: generate new quotation_number with version 1
    SELECT 
        quotation_number,
        COALESCE(MAX(version), 0) + 1
    INTO 
        v_quotation_number,
        v_new_version
    FROM quotations 
    WHERE lead_id = p_lead_id 
        AND tenant_id = v_tenant_id
    GROUP BY quotation_number;
    
    -- If no existing quotation found, generate new quotation number
    IF v_quotation_number IS NULL THEN
        v_quotation_number := generate_quotation_number(v_tenant_id);
        v_new_version := 1;
    END IF;
    
    -- Create the quotation (either new or revision) WITHOUT redundant fields
    INSERT INTO quotations (
        tenant_id,
        quotation_number,
        version,
        lead_id,
        client_id,
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
        v_new_version,
        p_lead_id,
        v_lead.client_id,
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
    
    -- Log activity based on whether it's a new quotation or revision
    INSERT INTO lead_activities (
        lead_id,
        activity_type,
        title,
        description,
        created_by
    ) VALUES (
        p_lead_id,
        -- Was 'quotation_sent' for both branches, so a timeline claimed a
        -- quotation had gone to the client when it had only been raised.
        CASE
            WHEN v_new_version = 1 THEN 'quotation_created'::lead_activity_type_enum
            ELSE 'quotation_revised'::lead_activity_type_enum
        END,
        CASE 
            WHEN v_new_version = 1 THEN 'Quotation Created'
            ELSE 'Quotation Revised'
        END,
        CASE 
            WHEN v_new_version = 1 THEN 'Auto-created quotation ' || v_quotation_number || ' when lead moved to Proposal Discussion stage'
            ELSE 'Auto-created revision ' || v_quotation_number || ' v' || v_new_version || ' when returning to Proposal Discussion stage'
        END,
        v_assignee
    );
    
    RETURN v_quotation_id;
END;
$$;


-- Existing rows overstate what happened. Correcting them so the timeline stops
-- reporting eleven quotations as sent to clients when none had been.
UPDATE lead_activities
   SET activity_type = 'quotation_created'
 WHERE activity_type = 'quotation_sent'
   AND title = 'Quotation Created';

UPDATE lead_activities
   SET activity_type = 'quotation_revised'
 WHERE activity_type = 'quotation_sent'
   AND title = 'Quotation Revised';
