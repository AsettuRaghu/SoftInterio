-- A quotation has no expiry unless someone sets one.
--
-- Every new quotation was stamped valid for 30 days - by the API on create,
-- by create_quotation_for_lead() when a lead reaches proposal discussion,
-- and the PDF then invented a fresh 15 days whenever the stored date had
-- passed. Nobody chose any of those dates, so they meant nothing and the
-- list kept saying "expired". Validity is now optional: picked when
-- creating, or set on the quotation page; the document prints it only when
-- it is set. Rows stamped by the old defaults are cleared where the date
-- was never touched (exactly created + 30 days).

UPDATE "public"."quotations"
   SET "valid_until" = NULL
 WHERE "valid_until" IS NOT NULL
   AND "valid_until" = ("created_at"::date + INTERVAL '30 days')::date;

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
        NULL,  -- no expiry unless someone sets one
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
