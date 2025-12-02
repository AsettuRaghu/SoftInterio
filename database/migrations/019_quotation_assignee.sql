-- ============================================================================
-- MIGRATION 019: Add assigned_to field to quotations
-- 
-- Purpose: Allow quotations to be assigned to team members for work distribution
-- ============================================================================

-- Add assigned_to column to quotations table
ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add index for faster lookups by assignee
CREATE INDEX IF NOT EXISTS idx_quotations_assigned_to ON quotations(assigned_to);

-- Drop and recreate the quotations_with_lead view to include assigned user info
DROP VIEW IF EXISTS quotations_with_lead;
CREATE VIEW quotations_with_lead AS
SELECT 
    q.id,
    q.tenant_id,
    q.quotation_number,
    q.version,
    q.parent_quotation_id,
    q.lead_id,
    q.client_id,
    q.project_id,
    q.title,
    q.description,
    q.status,
    q.valid_from,
    q.valid_until,
    q.subtotal,
    q.discount_type,
    q.discount_value,
    q.discount_amount,
    q.taxable_amount,
    q.tax_percent,
    q.tax_amount,
    q.overhead_percent,
    q.overhead_amount,
    q.grand_total,
    q.payment_terms,
    q.terms_and_conditions,
    q.notes,
    q.sent_at,
    q.viewed_at,
    q.approved_at,
    q.rejected_at,
    q.rejection_reason,
    q.assigned_to,
    q.created_by,
    q.updated_by,
    q.created_at,
    q.updated_at,
    -- Lead data (client info comes from lead, with fallback to quotation fields)
    COALESCE(l.client_name, q.client_name) AS client_name,
    COALESCE(l.email, q.client_email) AS client_email,
    COALESCE(l.phone, q.client_phone) AS client_phone,
    COALESCE(l.property_name, q.property_name) AS property_name,
    COALESCE(l.property_address, q.property_address) AS property_address,
    l.property_city,
    l.property_pincode,
    l.flat_number,
    l.carpet_area_sqft,
    COALESCE(l.property_type::TEXT, q.property_type) AS property_type,
    l.service_type,
    l.budget_range,
    l.estimated_value,
    l.lead_source,
    l.stage AS lead_stage,
    -- Assigned user info
    au.name AS assigned_to_name,
    au.email AS assigned_to_email,
    au.avatar_url AS assigned_to_avatar
FROM quotations q
LEFT JOIN leads l ON l.id = q.lead_id
LEFT JOIN users au ON au.id = q.assigned_to;

-- Update duplicate_quotation to copy assigned_to
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
    
    -- Create new quotation header (now includes assigned_to)
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
        assigned_to,
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
        assigned_to, -- Keep same assignee for revision
        p_user_id, p_user_id
    FROM quotations WHERE id = p_quotation_id
    RETURNING id INTO v_new_quotation_id;
    
    -- Copy spaces
    INSERT INTO quotation_spaces (quotation_id, space_type_id, name, description, display_order, subtotal, metadata)
    SELECT v_new_quotation_id, space_type_id, name, description, display_order, subtotal, metadata
    FROM quotation_spaces WHERE quotation_id = p_quotation_id;
    
    -- Copy components
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
    
    -- Copy line items with space but no component
    INSERT INTO quotation_line_items (
        quotation_id, quotation_space_id, quotation_component_id,
        cost_item_id, name, group_name,
        length, width, quantity, unit_code, rate, amount,
        measurement_unit, display_order, notes, metadata
    )
    SELECT 
        v_new_quotation_id,
        ns.id,
        NULL,
        oli.cost_item_id, oli.name, oli.group_name,
        oli.length, oli.width, oli.quantity, oli.unit_code, oli.rate, oli.amount,
        oli.measurement_unit, oli.display_order, oli.notes, oli.metadata
    FROM quotation_line_items oli
    JOIN quotation_spaces os ON os.id = oli.quotation_space_id
    JOIN quotation_spaces ns ON ns.quotation_id = v_new_quotation_id 
        AND ns.display_order = os.display_order
    WHERE oli.quotation_id = p_quotation_id
      AND oli.quotation_component_id IS NULL;
    
    -- Copy line items with component
    INSERT INTO quotation_line_items (
        quotation_id, quotation_space_id, quotation_component_id,
        cost_item_id, name, group_name,
        length, width, quantity, unit_code, rate, amount,
        measurement_unit, display_order, notes, metadata
    )
    SELECT 
        v_new_quotation_id,
        ns.id,
        nc.id,
        oli.cost_item_id, oli.name, oli.group_name,
        oli.length, oli.width, oli.quantity, oli.unit_code, oli.rate, oli.amount,
        oli.measurement_unit, oli.display_order, oli.notes, oli.metadata
    FROM quotation_line_items oli
    JOIN quotation_components oc ON oc.id = oli.quotation_component_id
    JOIN quotation_spaces os ON os.id = oc.space_id
    JOIN quotation_spaces ns ON ns.quotation_id = v_new_quotation_id 
        AND ns.display_order = os.display_order
    JOIN quotation_components nc ON nc.space_id = ns.id 
        AND nc.display_order = oc.display_order
    WHERE oli.quotation_id = p_quotation_id
      AND oli.quotation_component_id IS NOT NULL;
    
    -- Copy orphan line items
    INSERT INTO quotation_line_items (
        quotation_id, quotation_space_id, quotation_component_id,
        cost_item_id, name, group_name,
        length, width, quantity, unit_code, rate, amount,
        measurement_unit, display_order, notes, metadata
    )
    SELECT 
        v_new_quotation_id,
        NULL,
        NULL,
        oli.cost_item_id, oli.name, oli.group_name,
        oli.length, oli.width, oli.quantity, oli.unit_code, oli.rate, oli.amount,
        oli.measurement_unit, oli.display_order, oli.notes, oli.metadata
    FROM quotation_line_items oli
    WHERE oli.quotation_id = p_quotation_id
      AND oli.quotation_space_id IS NULL
      AND oli.quotation_component_id IS NULL;
    
    -- Copy materials (backward compatibility)
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

COMMENT ON FUNCTION duplicate_quotation IS 'Creates a copy/revision of a quotation including assigned_to field.';

-- ============================================================================
-- Update create_quotation_for_lead to auto-assign to creator
-- ============================================================================

CREATE OR REPLACE FUNCTION create_quotation_for_lead(
    p_lead_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
    v_quotation_id UUID;
    v_quotation_number VARCHAR(50);
    v_lead RECORD;
    v_assignee UUID;
BEGIN
    -- Get lead details
    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found: %', p_lead_id;
    END IF;
    
    v_tenant_id := v_lead.tenant_id;
    
    -- Determine assignee: provided user > lead's assigned user > lead creator
    v_assignee := COALESCE(p_user_id, v_lead.assigned_to, v_lead.created_by);
    
    -- Generate quotation number
    v_quotation_number := generate_quotation_number(v_tenant_id);
    
    -- Create the quotation with assigned_to set to creator
    INSERT INTO quotations (
        tenant_id,
        quotation_number,
        version,
        lead_id,
        -- Snapshot fields (deprecated but kept for compatibility)
        client_name,
        client_email,
        client_phone,
        property_name,
        property_address,
        property_type,
        carpet_area,
        -- Quotation fields
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
        1,  -- First version
        p_lead_id,
        -- Snapshot from lead (for backward compatibility)
        v_lead.client_name,
        v_lead.email,
        v_lead.phone,
        v_lead.property_name,
        v_lead.property_address,
        v_lead.property_type::VARCHAR,
        v_lead.carpet_area_sqft,
        -- Default title
        COALESCE(v_lead.service_type::VARCHAR, 'Interior') || ' - ' || v_lead.client_name,
        'draft',
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '30 days',
        true,  -- auto_created
        v_assignee,  -- Auto-assign to creator
        v_assignee,
        v_assignee
    )
    RETURNING id INTO v_quotation_id;
    
    -- Log activity on lead
    INSERT INTO lead_activities (
        lead_id,
        activity_type,
        title,
        description,
        created_by
    ) VALUES (
        p_lead_id,
        'quotation_sent',  -- Using existing type
        'Quotation Created',
        'Auto-created quotation ' || v_quotation_number || ' when lead moved to Proposal Discussion stage',
        v_assignee
    );
    
    RETURN v_quotation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_quotation_for_lead IS 'Creates a new quotation for a lead with auto-assignment to creator.';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- Changes made:
-- 1. Added assigned_to column to quotations table (references users)
-- 2. Added index for faster assignee lookups
-- 3. Updated quotations_with_lead view to include assigned user info
-- 4. Updated duplicate_quotation to copy assigned_to field
