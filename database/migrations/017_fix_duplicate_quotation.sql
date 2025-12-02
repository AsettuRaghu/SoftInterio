-- ============================================================================
-- MIGRATION 017: Fix duplicate_quotation function
-- 
-- Issue: The function from migration 015 used 'sort_order' for quotation_spaces
-- but the actual column is 'display_order' (from migration 009)
-- ============================================================================

-- Drop and recreate the function with correct column names
CREATE OR REPLACE FUNCTION duplicate_quotation(p_quotation_id UUID, p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_new_quotation_id UUID;
    v_new_version INTEGER;
    v_old_version INTEGER;
BEGIN
    -- Get current version
    SELECT version INTO v_old_version FROM quotations WHERE id = p_quotation_id;
    v_new_version := COALESCE(v_old_version, 0) + 1;
    
    -- Create new quotation header (includes new V2 fields)
    INSERT INTO quotations (
        tenant_id, quotation_number, version, parent_quotation_id,
        lead_id, client_id, project_id,
        client_name, client_email, client_phone,
        property_name, property_address, property_type, carpet_area,
        title, description, status,
        valid_from, valid_until,
        discount_type, discount_value, tax_percent, overhead_percent,
        payment_terms, terms_and_conditions, notes,
        presentation_level, hide_dimensions,
        created_by, updated_by
    )
    SELECT 
        tenant_id, quotation_number, v_new_version, id,
        lead_id, client_id, project_id,
        client_name, client_email, client_phone,
        property_name, property_address, property_type, carpet_area,
        title, description, 'draft',
        CURRENT_DATE, valid_until,
        discount_type, discount_value, tax_percent, overhead_percent,
        payment_terms, terms_and_conditions, notes,
        COALESCE(presentation_level, 'space_component'), COALESCE(hide_dimensions, true),
        p_user_id, p_user_id
    FROM quotations WHERE id = p_quotation_id
    RETURNING id INTO v_new_quotation_id;
    
    -- Copy spaces (using display_order, not sort_order)
    INSERT INTO quotation_spaces (quotation_id, space_type_id, name, description, display_order, subtotal, metadata)
    SELECT v_new_quotation_id, space_type_id, name, description, display_order, subtotal, metadata
    FROM quotation_spaces WHERE quotation_id = p_quotation_id;
    
    -- Copy components (need to map old space IDs to new using display_order)
    INSERT INTO quotation_components (
        quotation_id, space_id, component_type_id, component_variant_id,
        name, description, subtotal, display_order
    )
    SELECT 
        v_new_quotation_id, 
        ns.id,
        oc.component_type_id,
        oc.component_variant_id,
        oc.name, oc.description, oc.subtotal, oc.display_order
    FROM quotation_components oc
    JOIN quotation_spaces os ON os.id = oc.space_id
    JOIN quotation_spaces ns ON ns.quotation_id = v_new_quotation_id 
        AND ns.display_order = os.display_order
    WHERE oc.quotation_id = p_quotation_id;
    
    -- Copy V2 line items with proper space/component mapping
    -- First, insert line items with space but no component
    INSERT INTO quotation_line_items (
        quotation_id, quotation_space_id, quotation_component_id,
        cost_item_id, name, group_name,
        length, width, quantity, unit_code, rate, amount,
        display_order, notes, metadata
    )
    SELECT 
        v_new_quotation_id,
        ns.id,
        NULL, -- Will handle component mapping separately
        oli.cost_item_id, oli.name, oli.group_name,
        oli.length, oli.width, oli.quantity, oli.unit_code, oli.rate, oli.amount,
        oli.display_order, oli.notes, oli.metadata
    FROM quotation_line_items oli
    JOIN quotation_spaces os ON os.id = oli.quotation_space_id
    JOIN quotation_spaces ns ON ns.quotation_id = v_new_quotation_id 
        AND ns.display_order = os.display_order
    WHERE oli.quotation_id = p_quotation_id
      AND oli.quotation_component_id IS NULL;
    
    -- Then, insert line items with component (need to map component IDs using display_order)
    INSERT INTO quotation_line_items (
        quotation_id, quotation_space_id, quotation_component_id,
        cost_item_id, name, group_name,
        length, width, quantity, unit_code, rate, amount,
        display_order, notes, metadata
    )
    SELECT 
        v_new_quotation_id,
        ns.id,
        nc.id,
        oli.cost_item_id, oli.name, oli.group_name,
        oli.length, oli.width, oli.quantity, oli.unit_code, oli.rate, oli.amount,
        oli.display_order, oli.notes, oli.metadata
    FROM quotation_line_items oli
    JOIN quotation_components oc ON oc.id = oli.quotation_component_id
    JOIN quotation_spaces os ON os.id = oc.space_id
    JOIN quotation_spaces ns ON ns.quotation_id = v_new_quotation_id 
        AND ns.display_order = os.display_order
    JOIN quotation_components nc ON nc.space_id = ns.id 
        AND nc.display_order = oc.display_order
    WHERE oli.quotation_id = p_quotation_id
      AND oli.quotation_component_id IS NOT NULL;
    
    -- Also insert line items without any space/component (orphan items)
    INSERT INTO quotation_line_items (
        quotation_id, quotation_space_id, quotation_component_id,
        cost_item_id, name, group_name,
        length, width, quantity, unit_code, rate, amount,
        display_order, notes, metadata
    )
    SELECT 
        v_new_quotation_id,
        NULL,
        NULL,
        oli.cost_item_id, oli.name, oli.group_name,
        oli.length, oli.width, oli.quantity, oli.unit_code, oli.rate, oli.amount,
        oli.display_order, oli.notes, oli.metadata
    FROM quotation_line_items oli
    WHERE oli.quotation_id = p_quotation_id
      AND oli.quotation_space_id IS NULL
      AND oli.quotation_component_id IS NULL;
    
    -- Keep backward compatibility: also copy old materials and cost attributes if they exist
    -- (for quotations created before V2)
    INSERT INTO quotation_materials (
        quotation_id, component_id, material_id, category_id,
        name, category_name, specifications, display_order, metadata
    )
    SELECT 
        v_new_quotation_id,
        nc.id,
        om.material_id, om.category_id,
        om.name, om.category_name, om.specifications, om.display_order, om.metadata
    FROM quotation_materials om
    JOIN quotation_components oc ON oc.id = om.component_id
    JOIN quotation_spaces os ON os.id = oc.space_id
    JOIN quotation_spaces ns ON ns.quotation_id = v_new_quotation_id 
        AND ns.display_order = os.display_order
    JOIN quotation_components nc ON nc.space_id = ns.id 
        AND nc.display_order = oc.display_order
    WHERE om.quotation_id = p_quotation_id;
    
    -- Copy cost attributes (backward compatibility)
    INSERT INTO quotation_cost_attributes (
        quotation_id, material_id, attribute_type_id,
        name, quantity, unit, rate, amount, is_auto_calculated, calculation_source, display_order, metadata
    )
    SELECT 
        v_new_quotation_id,
        nm.id,
        oca.attribute_type_id,
        oca.name, oca.quantity, oca.unit, oca.rate, oca.amount, 
        oca.is_auto_calculated, oca.calculation_source, oca.display_order, oca.metadata
    FROM quotation_cost_attributes oca
    JOIN quotation_materials om ON om.id = oca.material_id
    JOIN quotation_components oc ON oc.id = om.component_id
    JOIN quotation_spaces os ON os.id = oc.space_id
    JOIN quotation_spaces ns ON ns.quotation_id = v_new_quotation_id 
        AND ns.display_order = os.display_order
    JOIN quotation_components nc ON nc.space_id = ns.id 
        AND nc.display_order = oc.display_order
    JOIN quotation_materials nm ON nm.component_id = nc.id 
        AND nm.display_order = om.display_order
    WHERE oca.quotation_id = p_quotation_id;
    
    RETURN v_new_quotation_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION duplicate_quotation IS 'Creates a copy/revision of a quotation including all V2 line items and backward-compatible materials. Fixed to use display_order column.';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- Changes made:
-- 1. Fixed duplicate_quotation function to use 'display_order' instead of 'sort_order'
--    for quotation_spaces and quotation_components tables
-- 2. Removed non-existent columns (length, width, area) from quotation_spaces insert
-- 3. Removed non-existent columns from quotation_components insert
