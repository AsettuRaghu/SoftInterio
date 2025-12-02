-- ============================================================================
-- SEED DATA FOR QUOTATION MODULE V2
-- Migration: 016_quotation_seed_data_v2.sql
-- 
-- Provides default master data for the flexible hierarchy:
-- Space Types (generic) > Components > Component Variants > Cost Items
-- ============================================================================

-- Create a function to seed data for a tenant
-- This function will delete existing v2 data and recreate it
CREATE OR REPLACE FUNCTION seed_quotation_master_data_v2(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
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
    v_comp_dressing_table UUID;
    v_comp_bar_unit UUID;
    
    -- Cost Item Category IDs
    v_cat_material UUID;
    v_cat_hardware UUID;
    v_cat_finish UUID;
    v_cat_labour UUID;
    v_cat_service UUID;
BEGIN
    -- ========================================================================
    -- DELETE EXISTING DATA (order matters due to foreign keys)
    -- ========================================================================
    
    DELETE FROM component_variants WHERE tenant_id = p_tenant_id AND is_system = true;
    DELETE FROM cost_items WHERE tenant_id = p_tenant_id AND is_system = true;
    DELETE FROM cost_item_categories WHERE tenant_id = p_tenant_id AND is_system = true;
    DELETE FROM component_types WHERE tenant_id = p_tenant_id AND is_system = true;
    DELETE FROM space_types WHERE tenant_id = p_tenant_id AND is_system = true;
    
    -- ========================================================================
    -- SPACE TYPES (Generic - user names instances in quotation)
    -- ========================================================================
    
    INSERT INTO space_types (tenant_id, name, slug, description, icon, display_order, is_active, is_system) VALUES
        (p_tenant_id, 'Bedroom', 'bedroom', 'Any bedroom (Master, Kids, Guest, etc.)', 'bed', 1, true, true),
        (p_tenant_id, 'Kitchen', 'kitchen', 'Cooking and food preparation area', 'utensils', 2, true, true),
        (p_tenant_id, 'Living Room', 'living-room', 'Main living/drawing area', 'sofa', 3, true, true),
        (p_tenant_id, 'Dining', 'dining', 'Dining area', 'utensils-crossed', 4, true, true),
        (p_tenant_id, 'Bathroom', 'bathroom', 'Any bathroom/toilet', 'bath', 5, true, true),
        (p_tenant_id, 'Balcony', 'balcony', 'Any balcony or terrace', 'sun', 6, true, true),
        (p_tenant_id, 'Foyer', 'foyer', 'Entrance/lobby area', 'door-open', 7, true, true),
        (p_tenant_id, 'Study', 'study', 'Study room or home office', 'book-open', 8, true, true),
        (p_tenant_id, 'Pooja Room', 'pooja-room', 'Prayer/worship room', 'flame', 9, true, true),
        (p_tenant_id, 'Utility', 'utility', 'Utility/service area', 'wrench', 10, true, true),
        (p_tenant_id, 'Store Room', 'store-room', 'Storage room', 'archive', 11, true, true),
        (p_tenant_id, 'Theater Room', 'theater-room', 'Home theater', 'film', 12, true, true),
        (p_tenant_id, 'Terrace', 'terrace', 'Open terrace', 'cloud-sun', 13, true, true),
        (p_tenant_id, 'Passage', 'passage', 'Corridor/Hallway', 'move-horizontal', 14, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;

    -- ========================================================================
    -- COMPONENT TYPES (What gets built)
    -- ========================================================================
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Wardrobe', 'wardrobe', 'Storage wardrobe with shutters', 'rectangle-vertical', 1, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_wardrobe FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'wardrobe';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'TV Unit', 'tv-unit', 'Entertainment unit for TV', 'tv', 2, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_tv_unit FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'tv-unit';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'False Ceiling', 'false-ceiling', 'Decorative ceiling work', 'layers', 3, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_false_ceiling FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'false-ceiling';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Modular Kitchen', 'modular-kitchen', 'Complete modular kitchen', 'utensils', 4, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_modular_kitchen FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'modular-kitchen';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Vanity', 'vanity', 'Bathroom vanity with storage', 'square', 5, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_vanity FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'vanity';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Shoe Rack', 'shoe-rack', 'Footwear storage unit', 'footprints', 6, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_shoe_rack FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'shoe-rack';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Crockery Unit', 'crockery-unit', 'Display and storage for crockery', 'wine', 7, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_crockery FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'crockery-unit';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Study Table', 'study-table', 'Desk for study or work', 'laptop', 8, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_study_table FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'study-table';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Bed', 'bed', 'Bed with headboard', 'bed', 9, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_bed FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'bed';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Console', 'console', 'Decorative console table', 'gallery-horizontal-end', 10, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_console FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'console';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Dressing Table', 'dressing-table', 'Vanity/dressing unit', 'square-user', 11, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_dressing_table FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'dressing-table';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Bar Unit', 'bar-unit', 'Home bar counter', 'beer', 12, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_bar_unit FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'bar-unit';

    -- ========================================================================
    -- COMPONENT VARIANTS (Types of components - optional level)
    -- ========================================================================
    
    -- Wardrobe Variants
    INSERT INTO component_variants (tenant_id, component_type_id, name, slug, description, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_comp_wardrobe, 'Sliding', 'sliding', 'Sliding shutter wardrobe', 1, true, true),
        (p_tenant_id, v_comp_wardrobe, 'Openable', 'openable', 'Hinged door wardrobe', 2, true, true),
        (p_tenant_id, v_comp_wardrobe, 'Sliding with Loft', 'sliding-loft', 'Sliding wardrobe with top loft', 3, true, true),
        (p_tenant_id, v_comp_wardrobe, 'Openable with Loft', 'openable-loft', 'Openable wardrobe with top loft', 4, true, true),
        (p_tenant_id, v_comp_wardrobe, 'Walk-in', 'walk-in', 'Walk-in closet style', 5, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    -- Modular Kitchen Variants
    INSERT INTO component_variants (tenant_id, component_type_id, name, slug, description, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_comp_modular_kitchen, 'L-Shape', 'l-shape', 'L-shaped kitchen layout', 1, true, true),
        (p_tenant_id, v_comp_modular_kitchen, 'U-Shape', 'u-shape', 'U-shaped kitchen layout', 2, true, true),
        (p_tenant_id, v_comp_modular_kitchen, 'Parallel', 'parallel', 'Parallel/Galley kitchen', 3, true, true),
        (p_tenant_id, v_comp_modular_kitchen, 'Straight', 'straight', 'Single wall kitchen', 4, true, true),
        (p_tenant_id, v_comp_modular_kitchen, 'Island', 'island', 'Kitchen with island', 5, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    -- False Ceiling Variants
    INSERT INTO component_variants (tenant_id, component_type_id, name, slug, description, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_comp_false_ceiling, 'Plain', 'plain', 'Simple plain ceiling', 1, true, true),
        (p_tenant_id, v_comp_false_ceiling, 'Peripheral Cove', 'peripheral-cove', 'With peripheral cove lighting', 2, true, true),
        (p_tenant_id, v_comp_false_ceiling, 'Designer', 'designer', 'Custom designer ceiling', 3, true, true),
        (p_tenant_id, v_comp_false_ceiling, 'Box Type', 'box-type', 'Box/Tray ceiling', 4, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    -- TV Unit Variants
    INSERT INTO component_variants (tenant_id, component_type_id, name, slug, description, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_comp_tv_unit, 'Wall Mounted', 'wall-mounted', 'Wall mounted unit', 1, true, true),
        (p_tenant_id, v_comp_tv_unit, 'Floor Standing', 'floor-standing', 'Floor standing unit', 2, true, true),
        (p_tenant_id, v_comp_tv_unit, 'Full Wall', 'full-wall', 'Full wall entertainment unit', 3, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    -- Vanity Variants
    INSERT INTO component_variants (tenant_id, component_type_id, name, slug, description, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_comp_vanity, 'Wall Hung', 'wall-hung', 'Wall hung vanity', 1, true, true),
        (p_tenant_id, v_comp_vanity, 'Floor Standing', 'floor-standing', 'Floor standing vanity', 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    -- Bed Variants
    INSERT INTO component_variants (tenant_id, component_type_id, name, slug, description, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_comp_bed, 'Platform', 'platform', 'Platform bed with headboard', 1, true, true),
        (p_tenant_id, v_comp_bed, 'Storage', 'storage', 'Bed with hydraulic storage', 2, true, true),
        (p_tenant_id, v_comp_bed, 'Poster', 'poster', 'Four poster bed', 3, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    -- ========================================================================
    -- COST ITEM CATEGORIES
    -- ========================================================================
    
    INSERT INTO cost_item_categories (id, tenant_id, name, slug, description, icon, color, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Material', 'material', 'Raw materials like plywood, MDF, etc.', 'box', '#4A5568', 1, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_cat_material FROM cost_item_categories WHERE tenant_id = p_tenant_id AND slug = 'material';
    
    INSERT INTO cost_item_categories (id, tenant_id, name, slug, description, icon, color, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Hardware', 'hardware', 'Hardware items like hinges, channels, handles', 'wrench', '#2D3748', 2, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_cat_hardware FROM cost_item_categories WHERE tenant_id = p_tenant_id AND slug = 'hardware';
    
    INSERT INTO cost_item_categories (id, tenant_id, name, slug, description, icon, color, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Finish', 'finish', 'Finishing materials like laminates, PU, acrylic', 'paintbrush', '#553C9A', 3, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_cat_finish FROM cost_item_categories WHERE tenant_id = p_tenant_id AND slug = 'finish';
    
    INSERT INTO cost_item_categories (id, tenant_id, name, slug, description, icon, color, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Labour', 'labour', 'Labour and workmanship costs', 'users', '#2B6CB0', 4, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_cat_labour FROM cost_item_categories WHERE tenant_id = p_tenant_id AND slug = 'labour';
    
    INSERT INTO cost_item_categories (id, tenant_id, name, slug, description, icon, color, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Service', 'service', 'Services like installation, transport', 'truck', '#276749', 5, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_cat_service FROM cost_item_categories WHERE tenant_id = p_tenant_id AND slug = 'service';

    -- ========================================================================
    -- COST ITEMS (Anything with a price)
    -- ========================================================================
    
    -- Materials (Area based - sqft)
    INSERT INTO cost_items (tenant_id, category_id, name, slug, description, unit_code, default_rate, quality_tier, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_cat_material, 'HDHMR PreLam 18mm', 'hdhmr-prelam-18mm', 'High Density HMR with pre-laminate finish', 'sqft', 85.00, 'standard', 1, true, true),
        (p_tenant_id, v_cat_material, 'HDHMR PreLam 25mm', 'hdhmr-prelam-25mm', 'High Density HMR 25mm for shelves', 'sqft', 95.00, 'standard', 2, true, true),
        (p_tenant_id, v_cat_material, 'Marine Plywood 18mm', 'marine-ply-18mm', 'BWP Marine grade plywood', 'sqft', 95.00, 'premium', 3, true, true),
        (p_tenant_id, v_cat_material, 'Marine Plywood 12mm', 'marine-ply-12mm', 'BWP Marine grade plywood 12mm', 'sqft', 75.00, 'premium', 4, true, true),
        (p_tenant_id, v_cat_material, 'MDF 18mm', 'mdf-18mm', 'Medium Density Fibreboard', 'sqft', 55.00, 'budget', 5, true, true),
        (p_tenant_id, v_cat_material, 'Particle Board 18mm', 'particle-board-18mm', 'Standard particle board', 'sqft', 45.00, 'budget', 6, true, true),
        (p_tenant_id, v_cat_material, 'Glass (Clear) 5mm', 'glass-clear-5mm', 'Clear float glass', 'sqft', 65.00, 'standard', 7, true, true),
        (p_tenant_id, v_cat_material, 'Glass (Frosted) 5mm', 'glass-frosted-5mm', 'Frosted glass', 'sqft', 85.00, 'standard', 8, true, true),
        (p_tenant_id, v_cat_material, 'Mirror 4mm', 'mirror-4mm', 'Standard mirror', 'sqft', 75.00, 'standard', 9, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    
    -- Finishes (Area based - sqft)
    INSERT INTO cost_items (tenant_id, category_id, name, slug, description, unit_code, default_rate, quality_tier, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_cat_finish, 'Laminate (Economy)', 'laminate-economy', 'Standard laminate finish', 'sqft', 35.00, 'budget', 1, true, true),
        (p_tenant_id, v_cat_finish, 'Laminate (Premium)', 'laminate-premium', 'Premium laminate (Merino, Century)', 'sqft', 55.00, 'standard', 2, true, true),
        (p_tenant_id, v_cat_finish, 'PU Finish', 'pu-finish', 'Polyurethane paint finish', 'sqft', 120.00, 'premium', 3, true, true),
        (p_tenant_id, v_cat_finish, 'Acrylic 1mm', 'acrylic-1mm', '1mm Acrylic sheet finish', 'sqft', 65.00, 'standard', 4, true, true),
        (p_tenant_id, v_cat_finish, 'Acrylic 2mm', 'acrylic-2mm', '2mm Acrylic sheet finish', 'sqft', 95.00, 'premium', 5, true, true),
        (p_tenant_id, v_cat_finish, 'Veneer (Natural)', 'veneer-natural', 'Natural wood veneer', 'sqft', 150.00, 'luxury', 6, true, true),
        (p_tenant_id, v_cat_finish, 'Veneer (Engineered)', 'veneer-engineered', 'Engineered veneer', 'sqft', 95.00, 'premium', 7, true, true),
        (p_tenant_id, v_cat_finish, 'Lacquer Finish', 'lacquer-finish', 'High gloss lacquer', 'sqft', 180.00, 'luxury', 8, true, true),
        (p_tenant_id, v_cat_finish, 'Membrane Finish', 'membrane-finish', 'PVC membrane finish', 'sqft', 75.00, 'standard', 9, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    
    -- Hardware (Quantity based - nos)
    INSERT INTO cost_items (tenant_id, category_id, name, slug, description, unit_code, default_rate, quality_tier, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_cat_hardware, 'Hinge (Standard)', 'hinge-standard', 'Standard concealed hinge', 'nos', 45.00, 'budget', 1, true, true),
        (p_tenant_id, v_cat_hardware, 'Hinge (Soft Close)', 'hinge-soft-close', 'Soft close hydraulic hinge', 'nos', 95.00, 'standard', 2, true, true),
        (p_tenant_id, v_cat_hardware, 'Hinge (German)', 'hinge-german', 'German brand (Hettich/Blum)', 'nos', 180.00, 'premium', 3, true, true),
        (p_tenant_id, v_cat_hardware, 'Drawer Channel (Standard)', 'drawer-channel-standard', 'Standard ball bearing channel', 'nos', 150.00, 'budget', 4, true, true),
        (p_tenant_id, v_cat_hardware, 'Drawer Channel (Soft Close)', 'drawer-channel-soft-close', 'Soft close drawer channel', 'nos', 350.00, 'standard', 5, true, true),
        (p_tenant_id, v_cat_hardware, 'Drawer Channel (Tandem)', 'drawer-channel-tandem', 'Tandem box system', 'nos', 850.00, 'premium', 6, true, true),
        (p_tenant_id, v_cat_hardware, 'Handle (Standard)', 'handle-standard', 'Standard cabinet handle', 'nos', 45.00, 'budget', 7, true, true),
        (p_tenant_id, v_cat_hardware, 'Handle (Premium)', 'handle-premium', 'Premium designer handle', 'nos', 150.00, 'standard', 8, true, true),
        (p_tenant_id, v_cat_hardware, 'Handle (Italian)', 'handle-italian', 'Imported Italian handle', 'nos', 450.00, 'luxury', 9, true, true),
        (p_tenant_id, v_cat_hardware, 'Sliding Mechanism (2 Door)', 'sliding-mechanism-2door', 'Sliding wardrobe mechanism for 2 doors', 'nos', 4500.00, 'standard', 10, true, true),
        (p_tenant_id, v_cat_hardware, 'Sliding Mechanism (3 Door)', 'sliding-mechanism-3door', 'Sliding wardrobe mechanism for 3 doors', 'nos', 6500.00, 'standard', 11, true, true),
        (p_tenant_id, v_cat_hardware, 'Hydraulic Bed Mechanism', 'hydraulic-bed', 'Hydraulic lift for storage bed', 'nos', 8500.00, 'standard', 12, true, true),
        (p_tenant_id, v_cat_hardware, 'Profile (Aluminium)', 'profile-aluminium', 'Aluminium profile for glass/shutter', 'rft', 85.00, 'standard', 13, true, true),
        (p_tenant_id, v_cat_hardware, 'Profile (G Handle)', 'profile-g-handle', 'G-profile handle', 'rft', 120.00, 'standard', 14, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    
    -- Labour (Area or Job based)
    INSERT INTO cost_items (tenant_id, category_id, name, slug, description, unit_code, default_rate, quality_tier, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_cat_labour, 'Carpentry Labour', 'carpentry-labour', 'Carpentry work labour per sqft', 'sqft', 45.00, 'standard', 1, true, true),
        (p_tenant_id, v_cat_labour, 'Lamination Labour', 'lamination-labour', 'Laminate application labour', 'sqft', 15.00, 'standard', 2, true, true),
        (p_tenant_id, v_cat_labour, 'PU Labour', 'pu-labour', 'PU finish application labour', 'sqft', 65.00, 'standard', 3, true, true),
        (p_tenant_id, v_cat_labour, 'False Ceiling Labour', 'false-ceiling-labour', 'False ceiling installation', 'sqft', 25.00, 'standard', 4, true, true),
        (p_tenant_id, v_cat_labour, 'Hardware Fitting', 'hardware-fitting', 'Hardware installation per piece', 'nos', 25.00, 'standard', 5, true, true),
        (p_tenant_id, v_cat_labour, 'Glass Fitting', 'glass-fitting', 'Glass cutting and fitting', 'sqft', 35.00, 'standard', 6, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    
    -- Services (Job/Fixed based)
    INSERT INTO cost_items (tenant_id, category_id, name, slug, description, unit_code, default_rate, quality_tier, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_cat_service, 'Design Consultation', 'design-consultation', 'Interior design consultation', 'job', 15000.00, 'standard', 1, true, true),
        (p_tenant_id, v_cat_service, '3D Visualization', '3d-visualization', '3D rendering per room', 'nos', 5000.00, 'standard', 2, true, true),
        (p_tenant_id, v_cat_service, 'Site Supervision', 'site-supervision', 'On-site project supervision', 'job', 25000.00, 'standard', 3, true, true),
        (p_tenant_id, v_cat_service, 'Transportation', 'transportation', 'Material transportation', 'job', 8000.00, 'standard', 4, true, true),
        (p_tenant_id, v_cat_service, 'Site Cleaning', 'site-cleaning', 'Post-work site cleanup', 'job', 5000.00, 'standard', 5, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;

    RAISE NOTICE 'V2 Seed data created successfully for tenant %', p_tenant_id;
END;
$$;

-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================
-- 
-- To seed data for a specific tenant, run:
-- SELECT seed_quotation_master_data_v2('your-tenant-uuid-here');
--
-- ============================================================================

COMMENT ON FUNCTION seed_quotation_master_data_v2(UUID) IS 
    'Seeds the quotation module V2 master data (space types, components, variants, cost item categories, cost items) for a specific tenant.';
