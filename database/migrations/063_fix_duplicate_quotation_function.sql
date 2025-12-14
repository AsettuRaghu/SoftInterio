-- Migration: Fix duplicate_quotation function to remove references to deleted columns
-- Date: 2025-12-14
-- Description: Updates the duplicate_quotation function to remove client_name, client_email, 
--              client_phone, property_name, property_address, property_type, and carpet_area
--              columns that were deleted in migration 062

-- Drop and recreate the duplicate_quotation function without the removed columns
CREATE OR REPLACE FUNCTION "public"."duplicate_quotation"("p_quotation_id" "uuid", "p_user_id" "uuid") 
RETURNS "uuid"
LANGUAGE "plpgsql"
AS $$
DECLARE
    v_new_quotation_id UUID;
    v_new_version INTEGER;
    v_quotation RECORD;
    v_space_mapping JSONB := '{}';
    v_component_mapping JSONB := '{}';
    v_old_space RECORD;
    v_new_space_id UUID;
    v_old_component RECORD;
    v_new_component_id UUID;
BEGIN
    -- Get current quotation
    SELECT * INTO v_quotation FROM quotations WHERE id = p_quotation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quotation not found: %', p_quotation_id;
    END IF;
    
    -- Get max version for this quotation number across all versions
    SELECT COALESCE(MAX(version), 0) + 1 INTO v_new_version
    FROM quotations
    WHERE tenant_id = v_quotation.tenant_id
    AND quotation_number = v_quotation.quotation_number;
    
    -- Create new quotation header (removed client_name, client_email, client_phone, 
    -- property_name, property_address, property_type, carpet_area columns)
    INSERT INTO quotations (
        tenant_id, quotation_number, version, parent_quotation_id,
        lead_id, client_id, project_id,
        title, description, status,
        valid_from, valid_until,
        discount_type, discount_value, tax_percent, overhead_percent,
        payment_terms, terms_and_conditions, notes,
        presentation_level, hide_dimensions,
        assigned_to, template_id,
        created_by, updated_by
    )
    SELECT 
        tenant_id, quotation_number, v_new_version, id,
        lead_id, client_id, project_id,
        title, description, 'draft',
        CURRENT_DATE, valid_until,
        discount_type, discount_value, tax_percent, overhead_percent,
        payment_terms, terms_and_conditions, notes,
        COALESCE(presentation_level, 'space_component'), COALESCE(hide_dimensions, true),
        assigned_to, template_id,
        p_user_id, p_user_id
    FROM quotations WHERE id = p_quotation_id
    RETURNING id INTO v_new_quotation_id;
    
    -- Copy quotation_spaces
    FOR v_old_space IN 
        SELECT * FROM quotation_spaces 
        WHERE quotation_id = p_quotation_id 
        ORDER BY display_order
    LOOP
        INSERT INTO quotation_spaces (
            quotation_id, space_type_id, name, description, 
            display_order, subtotal, metadata
        )
        VALUES (
            v_new_quotation_id, v_old_space.space_type_id, v_old_space.name, v_old_space.description,
            v_old_space.display_order, v_old_space.subtotal, v_old_space.metadata
        )
        RETURNING id INTO v_new_space_id;
        
        v_space_mapping := v_space_mapping || jsonb_build_object(v_old_space.id::text, v_new_space_id::text);
    END LOOP;
    
    -- Copy quotation_components
    FOR v_old_component IN 
        SELECT * FROM quotation_components 
        WHERE quotation_id = p_quotation_id 
        ORDER BY display_order
    LOOP
        INSERT INTO quotation_components (
            quotation_id, space_id, component_type_id, name, description,
            width, height, depth, configuration, display_order, subtotal, metadata
        )
        VALUES (
            v_new_quotation_id, 
            CASE 
                WHEN v_old_component.space_id IS NOT NULL 
                THEN (v_space_mapping->>v_old_component.space_id::text)::uuid 
                ELSE NULL 
            END,
            v_old_component.component_type_id, v_old_component.name, v_old_component.description,
            v_old_component.width, v_old_component.height, v_old_component.depth,
            v_old_component.configuration, v_old_component.display_order, 
            v_old_component.subtotal, v_old_component.metadata
        )
        RETURNING id INTO v_new_component_id;
        
        v_component_mapping := v_component_mapping || jsonb_build_object(v_old_component.id::text, v_new_component_id::text);
    END LOOP;
    
    -- Copy quotation_line_items
    INSERT INTO quotation_line_items (
        quotation_id, space_id, component_id, cost_item_id,
        name, description, unit_code, quantity, rate, amount, 
        display_order, notes, metadata
    )
    SELECT 
        v_new_quotation_id,
        CASE 
            WHEN space_id IS NOT NULL 
            THEN (v_space_mapping->>space_id::text)::uuid 
            ELSE NULL 
        END,
        CASE 
            WHEN component_id IS NOT NULL 
            THEN (v_component_mapping->>component_id::text)::uuid 
            ELSE NULL 
        END,
        cost_item_id,
        name, description, unit_code, quantity, rate, amount,
        display_order, notes, metadata
    FROM quotation_line_items
    WHERE quotation_id = p_quotation_id
    ORDER BY display_order;
    
    -- Recalculate totals for the new quotation
    PERFORM recalculate_quotation_totals(v_new_quotation_id);
    
    RETURN v_new_quotation_id;
END;
$$;

COMMENT ON FUNCTION "public"."duplicate_quotation"("p_quotation_id" "uuid", "p_user_id" "uuid") 
IS 'Creates a copy/revision of a quotation with proper ID mapping. Updated to remove deleted redundant columns.';
