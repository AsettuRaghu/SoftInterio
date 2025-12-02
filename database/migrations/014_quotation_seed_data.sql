-- ============================================================================
-- SEED DATA FOR QUOTATION MODULE
-- Migration: 014_quotation_seed_data.sql
-- 
-- Provides default master data for the 4-level hierarchy:
-- Space > Component > Type > Cost Attributes
-- ============================================================================

-- ============================================================================
-- SECTION 1: SPACE TYPES
-- ============================================================================

-- Insert default space types (system-defined)
-- Note: Replace 'YOUR_TENANT_ID' with actual tenant_id when running
-- For multi-tenant, this should be run per tenant or use a function

-- Create a function to seed data for a tenant
-- This function is idempotent - safe to run multiple times
CREATE OR REPLACE FUNCTION seed_quotation_master_data(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    -- Space Type IDs
    v_space_master_bedroom UUID;
    v_space_bedroom UUID;
    v_space_living_room UUID;
    v_space_kitchen UUID;
    v_space_dining UUID;
    v_space_bathroom UUID;
    v_space_foyer UUID;
    v_space_balcony UUID;
    v_space_pooja UUID;
    v_space_study UUID;
    
    -- Component Type IDs
    v_comp_wardrobe UUID;
    v_comp_tv_unit UUID;
    v_comp_false_ceiling UUID;
    v_comp_modular_kitchen UUID;
    v_comp_vanity UUID;
    v_comp_shoe_rack UUID;
    v_comp_crockery UUID;
    v_comp_study_table UUID;
    v_comp_bed UUID;
    v_comp_console UUID;
    
    -- Cost Attribute Type IDs
    v_attr_area UUID;
    v_attr_quantity UUID;
    v_attr_labour UUID;
    v_attr_hardware UUID;
BEGIN
    -- ========================================================================
    -- DELETE EXISTING DATA (order matters due to foreign keys)
    -- ========================================================================
    
    -- Delete in reverse order of dependencies
    DELETE FROM component_variant_types WHERE tenant_id = p_tenant_id AND is_system = true;
    DELETE FROM cost_attribute_types WHERE tenant_id = p_tenant_id;  -- no is_system column
    DELETE FROM component_types WHERE tenant_id = p_tenant_id AND is_system = true;
    DELETE FROM space_types WHERE tenant_id = p_tenant_id AND is_system = true;
    
    -- ========================================================================
    -- SPACE TYPES (fresh insert after delete)
    -- ========================================================================
    
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Master Bedroom', 'master-bedroom', 'Primary bedroom with attached bathroom', 'bed-double', 1, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_space_master_bedroom FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'master-bedroom';
    
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Bedroom', 'bedroom', 'Secondary bedroom', 'bed', 2, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_space_bedroom FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'bedroom';
    
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Living Room', 'living-room', 'Main living area', 'sofa', 3, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_space_living_room FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'living-room';
    
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Kitchen', 'kitchen', 'Cooking and food preparation area', 'utensils', 4, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_space_kitchen FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'kitchen';
    
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Dining', 'dining', 'Dining area', 'utensils-crossed', 5, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_space_dining FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'dining';
    
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Bathroom', 'bathroom', 'Bathroom/Toilet area', 'bath', 6, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_space_bathroom FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'bathroom';
    
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Foyer', 'foyer', 'Entrance/Foyer area', 'door-open', 7, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_space_foyer FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'foyer';
    
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Balcony', 'balcony', 'Balcony or terrace area', 'sun', 8, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_space_balcony FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'balcony';
    
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Pooja Room', 'pooja-room', 'Prayer/Worship room', 'flame', 9, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_space_pooja FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'pooja-room';
    
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Study', 'study', 'Study or home office', 'book-open', 10, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_space_study FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'study';

    -- ========================================================================
    -- COMPONENT TYPES
    -- ========================================================================
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Wardrobe', 'wardrobe', 'Storage wardrobe with shutters', 'rectangle-vertical', 8, 8, 2, 1, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_wardrobe FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'wardrobe';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'TV Unit', 'tv-unit', 'Entertainment unit for TV and accessories', 'tv', 8, 8, 1.5, 2, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_tv_unit FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'tv-unit';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'False Ceiling', 'false-ceiling', 'Decorative ceiling work', 'layers', NULL, NULL, NULL, 3, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_false_ceiling FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'false-ceiling';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Modular Kitchen', 'modular-kitchen', 'Complete modular kitchen setup', 'utensils', NULL, NULL, 2, 4, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_modular_kitchen FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'modular-kitchen';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Vanity', 'vanity', 'Bathroom vanity with mirror and storage', 'square', 4, 3, 1.5, 5, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_vanity FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'vanity';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Shoe Rack', 'shoe-rack', 'Footwear storage unit', 'footprints', 4, 6, 1, 6, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_shoe_rack FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'shoe-rack';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Crockery Unit', 'crockery-unit', 'Display and storage for crockery', 'wine', 6, 8, 1.5, 7, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_crockery FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'crockery-unit';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Study Table', 'study-table', 'Desk for study or work', 'laptop', 5, 3, 2, 8, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_study_table FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'study-table';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Bed', 'bed', 'Bed with headboard and storage', 'bed', 6, 4, 7, 9, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_bed FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'bed';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Console', 'console', 'Decorative console table', 'gallery-horizontal-end', 4, 3, 1, 10, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_console FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'console';

    -- ========================================================================
    -- COST ATTRIBUTE TYPES
    -- ========================================================================
    
    INSERT INTO cost_attribute_types (id, tenant_id, name, slug, description, data_type, unit, display_order, is_active)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Area', 'area', 'Area measurement (L x W)', 'area', 'sqft', 1, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_attr_area FROM cost_attribute_types WHERE tenant_id = p_tenant_id AND slug = 'area';
    
    INSERT INTO cost_attribute_types (id, tenant_id, name, slug, description, data_type, unit, display_order, is_active)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Quantity', 'quantity', 'Number of units', 'count', 'nos', 2, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_attr_quantity FROM cost_attribute_types WHERE tenant_id = p_tenant_id AND slug = 'quantity';
    
    INSERT INTO cost_attribute_types (id, tenant_id, name, slug, description, data_type, unit, display_order, is_active)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Labour', 'labour', 'Labour cost', 'number', 'nos', 3, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_attr_labour FROM cost_attribute_types WHERE tenant_id = p_tenant_id AND slug = 'labour';
    
    INSERT INTO cost_attribute_types (id, tenant_id, name, slug, description, data_type, unit, display_order, is_active)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Hardware', 'hardware', 'Hardware items count', 'count', 'nos', 4, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_attr_hardware FROM cost_attribute_types WHERE tenant_id = p_tenant_id AND slug = 'hardware';

    -- ========================================================================
    -- COMPONENT VARIANT TYPES (The "Type" level)
    -- ========================================================================
    
    -- Wardrobe Variants
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_wardrobe, 'Ceiling Sliding', 'ceiling-sliding', 'Floor to ceiling wardrobe with sliding shutters', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft", "calculation": "L x W", "rate_field": "carcass_rate"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft", "calculation": "L x W", "rate_field": "shutter_rate"},
                {"name": "Sliding Mechanism", "type": "quantity", "unit": "nos", "per_shutter": true},
                {"name": "Labour", "type": "quantity", "unit": "nos", "rate_per_sqft": true}
            ]
         }'::jsonb, 1, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_wardrobe, 'Openable', 'openable', 'Wardrobe with hinged openable shutters', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft", "calculation": "L x W"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft", "calculation": "L x W"},
                {"name": "Hinges", "type": "quantity", "unit": "nos", "per_shutter": 4},
                {"name": "Labour", "type": "quantity", "unit": "nos", "rate_per_sqft": true}
            ]
         }'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_wardrobe, 'Openable With Loft', 'openable-with-loft', 'Wardrobe with openable shutters and top loft storage', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft", "calculation": "L x W"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft", "calculation": "L x W"},
                {"name": "Loft Area", "type": "area", "unit": "sqft", "calculation": "L x W"},
                {"name": "Hinges", "type": "quantity", "unit": "nos", "per_shutter": 4},
                {"name": "Labour", "type": "quantity", "unit": "nos", "rate_per_sqft": true}
            ]
         }'::jsonb, 3, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_wardrobe, 'Sliding With Loft', 'sliding-with-loft', 'Sliding wardrobe with top loft storage', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft", "calculation": "L x W"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft", "calculation": "L x W"},
                {"name": "Loft Area", "type": "area", "unit": "sqft", "calculation": "L x W"},
                {"name": "Sliding Mechanism", "type": "quantity", "unit": "nos", "per_shutter": true},
                {"name": "Labour", "type": "quantity", "unit": "nos", "rate_per_sqft": true}
            ]
         }'::jsonb, 4, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    -- Modular Kitchen Variants
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_modular_kitchen, 'L-Shape', 'l-shape', 'L-shaped modular kitchen layout', 
         '{
            "attributes": [
                {"name": "Base Cabinets Area", "type": "area", "unit": "sqft"},
                {"name": "Wall Cabinets Area", "type": "area", "unit": "sqft"},
                {"name": "Countertop Area", "type": "area", "unit": "sqft"},
                {"name": "Tall Unit Area", "type": "area", "unit": "sqft"},
                {"name": "Hardware", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 1, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_modular_kitchen, 'U-Shape', 'u-shape', 'U-shaped modular kitchen layout', 
         '{
            "attributes": [
                {"name": "Base Cabinets Area", "type": "area", "unit": "sqft"},
                {"name": "Wall Cabinets Area", "type": "area", "unit": "sqft"},
                {"name": "Countertop Area", "type": "area", "unit": "sqft"},
                {"name": "Tall Unit Area", "type": "area", "unit": "sqft"},
                {"name": "Hardware", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_modular_kitchen, 'Parallel', 'parallel', 'Parallel/Galley modular kitchen layout', 
         '{
            "attributes": [
                {"name": "Base Cabinets Area", "type": "area", "unit": "sqft"},
                {"name": "Wall Cabinets Area", "type": "area", "unit": "sqft"},
                {"name": "Countertop Area", "type": "area", "unit": "sqft"},
                {"name": "Hardware", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 3, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_modular_kitchen, 'Straight', 'straight', 'Single wall straight kitchen layout', 
         '{
            "attributes": [
                {"name": "Base Cabinets Area", "type": "area", "unit": "sqft"},
                {"name": "Wall Cabinets Area", "type": "area", "unit": "sqft"},
                {"name": "Countertop Area", "type": "area", "unit": "sqft"},
                {"name": "Hardware", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 4, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_modular_kitchen, 'Island', 'island', 'Kitchen with central island', 
         '{
            "attributes": [
                {"name": "Base Cabinets Area", "type": "area", "unit": "sqft"},
                {"name": "Wall Cabinets Area", "type": "area", "unit": "sqft"},
                {"name": "Island Area", "type": "area", "unit": "sqft"},
                {"name": "Countertop Area", "type": "area", "unit": "sqft"},
                {"name": "Tall Unit Area", "type": "area", "unit": "sqft"},
                {"name": "Hardware", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 5, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    -- False Ceiling Variants
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_false_ceiling, 'Plain', 'plain', 'Simple plain false ceiling', 
         '{
            "attributes": [
                {"name": "Ceiling Area", "type": "area", "unit": "sqft"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 1, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_false_ceiling, 'Peripheral Cove', 'peripheral-cove', 'False ceiling with peripheral cove lighting', 
         '{
            "attributes": [
                {"name": "Ceiling Area", "type": "area", "unit": "sqft"},
                {"name": "Cove Running Feet", "type": "quantity", "unit": "rft"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_false_ceiling, 'Designer', 'designer', 'Custom designer false ceiling', 
         '{
            "attributes": [
                {"name": "Ceiling Area", "type": "area", "unit": "sqft"},
                {"name": "Cove Running Feet", "type": "quantity", "unit": "rft"},
                {"name": "Profile Running Feet", "type": "quantity", "unit": "rft"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 3, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    -- TV Unit Variants
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_tv_unit, 'Wall Mounted', 'wall-mounted', 'Wall mounted TV unit', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft"},
                {"name": "Hinges", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 1, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_tv_unit, 'Floor Standing', 'floor-standing', 'Floor standing TV unit with storage', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft"},
                {"name": "Drawers", "type": "quantity", "unit": "nos"},
                {"name": "Hinges", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_tv_unit, 'Full Wall', 'full-wall', 'Full wall entertainment unit', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft"},
                {"name": "Back Panel Area", "type": "area", "unit": "sqft"},
                {"name": "Drawers", "type": "quantity", "unit": "nos"},
                {"name": "Hinges", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 3, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    -- Vanity Variants
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_vanity, 'Wall Hung', 'wall-hung', 'Wall hung vanity unit', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft"},
                {"name": "Countertop", "type": "quantity", "unit": "nos"},
                {"name": "Mirror", "type": "quantity", "unit": "nos"},
                {"name": "Hardware", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 1, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_vanity, 'Floor Standing', 'floor-standing', 'Floor standing vanity unit', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft"},
                {"name": "Countertop", "type": "quantity", "unit": "nos"},
                {"name": "Mirror", "type": "quantity", "unit": "nos"},
                {"name": "Hardware", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    -- Shoe Rack Variants
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_shoe_rack, 'Open Shelves', 'open-shelves', 'Open shelf shoe rack', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Shelves", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 1, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_shoe_rack, 'With Shutters', 'with-shutters', 'Shoe rack with shutter doors', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft"},
                {"name": "Shelves", "type": "quantity", "unit": "nos"},
                {"name": "Hinges", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    -- Crockery Unit Variants
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_crockery, 'Open Display', 'open-display', 'Open display crockery unit', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Glass Shelves", "type": "quantity", "unit": "nos"},
                {"name": "Back Panel Area", "type": "area", "unit": "sqft"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 1, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_crockery, 'Glass Shutters', 'glass-shutters', 'Crockery unit with glass shutter doors', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Glass Shutter Area", "type": "area", "unit": "sqft"},
                {"name": "Wooden Shutter Area", "type": "area", "unit": "sqft"},
                {"name": "Drawers", "type": "quantity", "unit": "nos"},
                {"name": "Hinges", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    -- Study Table Variants
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_study_table, 'Simple', 'simple', 'Simple study table with drawers', 
         '{
            "attributes": [
                {"name": "Table Top Area", "type": "area", "unit": "sqft"},
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Drawers", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 1, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_study_table, 'With Overhead Storage', 'with-overhead', 'Study table with overhead storage', 
         '{
            "attributes": [
                {"name": "Table Top Area", "type": "area", "unit": "sqft"},
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Overhead Storage Area", "type": "area", "unit": "sqft"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft"},
                {"name": "Drawers", "type": "quantity", "unit": "nos"},
                {"name": "Hinges", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    -- Bed Variants
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_bed, 'Platform Bed', 'platform', 'Platform bed with headboard', 
         '{
            "attributes": [
                {"name": "Platform Area", "type": "area", "unit": "sqft"},
                {"name": "Headboard Area", "type": "area", "unit": "sqft"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 1, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_bed, 'Storage Bed', 'storage', 'Bed with under-storage', 
         '{
            "attributes": [
                {"name": "Platform Area", "type": "area", "unit": "sqft"},
                {"name": "Headboard Area", "type": "area", "unit": "sqft"},
                {"name": "Storage Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Hydraulic Mechanism", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    -- Console Variants
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_console, 'Wall Mounted', 'wall-mounted', 'Wall mounted console table', 
         '{
            "attributes": [
                {"name": "Top Area", "type": "area", "unit": "sqft"},
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Drawers", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 1, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_console, 'Floor Standing', 'floor-standing', 'Floor standing console table', 
         '{
            "attributes": [
                {"name": "Top Area", "type": "area", "unit": "sqft"},
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Drawers", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    RAISE NOTICE 'Seed data created successfully for tenant %', p_tenant_id;
END;
$$;

-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================
-- 
-- To seed data for a specific tenant, run:
-- SELECT seed_quotation_master_data('your-tenant-uuid-here');
--
-- To seed data for all existing tenants:
-- DO $$
-- DECLARE
--     t_id UUID;
-- BEGIN
--     FOR t_id IN SELECT id FROM tenants LOOP
--         PERFORM seed_quotation_master_data(t_id);
--     END LOOP;
-- END $$;
-- ============================================================================

COMMENT ON FUNCTION seed_quotation_master_data(UUID) IS 
    'Seeds the quotation module master data (space types, component types, variant types, cost attributes) for a specific tenant.';
