-- =====================================================
-- Stock Module Seed Data
-- =====================================================
-- Run this AFTER 022_stock_module_schema.sql
-- Populates stock tables with realistic interior design data
-- =====================================================

-- NOTE: This script uses a dynamic approach to insert data
-- for the current tenant. Run these commands in your Supabase SQL editor.

-- ============================================================================
-- STEP 1: Get your tenant_id first
-- Run this query and note your tenant_id:
-- SELECT id, company_name FROM tenants LIMIT 5;
-- ============================================================================

-- Then replace 'YOUR_TENANT_ID_HERE' with your actual tenant UUID in the queries below

-- ============================================================================
-- SECTION 1: SEED VENDORS
-- ============================================================================

-- For easier use, let's create a function that seeds data for a specific tenant
CREATE OR REPLACE FUNCTION seed_stock_data(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_vendor_plywood UUID;
    v_vendor_hardware UUID;
    v_vendor_fabric UUID;
    v_vendor_glass UUID;
    v_vendor_paint UUID;
    v_vendor_laminate UUID;
    v_vendor_stone UUID;
    v_vendor_electrical UUID;
BEGIN
    -- =========================================================================
    -- INSERT VENDORS
    -- =========================================================================
    
    -- 1. Plywood & Wood Vendor
    INSERT INTO stock_vendors (id, tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (gen_random_uuid(), p_tenant_id, 'VND-0001', 'Century Plyboards India Ltd', 'Century Ply', 'Rajesh Kumar', 'sales@centuryply.com', '9876543210', 'Bangalore', 'Karnataka', '29AAACR5055K1ZK', 'Net 30', 30, 5, true)
    RETURNING id INTO v_vendor_plywood;

    -- 2. Hardware Vendor
    INSERT INTO stock_vendors (id, tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (gen_random_uuid(), p_tenant_id, 'VND-0002', 'Hettich India Pvt Ltd', 'Hettich', 'Amit Sharma', 'orders@hettich.in', '9876543211', 'Pune', 'Maharashtra', '27AABCH1234K1Z5', 'Net 45', 45, 5, true)
    RETURNING id INTO v_vendor_hardware;

    -- 3. Fabric & Upholstery Vendor
    INSERT INTO stock_vendors (id, tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (gen_random_uuid(), p_tenant_id, 'VND-0003', 'D''Decor Home Fabrics', 'D''Decor', 'Priya Patel', 'wholesale@ddecor.com', '9876543212', 'Mumbai', 'Maharashtra', '27AABCD5678K1Z2', 'Net 30', 30, 4, true)
    RETURNING id INTO v_vendor_fabric;

    -- 4. Glass Vendor
    INSERT INTO stock_vendors (id, tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (gen_random_uuid(), p_tenant_id, 'VND-0004', 'Saint-Gobain Glass India', 'Saint-Gobain', 'Vikram Singh', 'commercial@saint-gobain.in', '9876543213', 'Chennai', 'Tamil Nadu', '33AABCS9012K1Z8', 'Net 30', 30, 5, true)
    RETURNING id INTO v_vendor_glass;

    -- 5. Paint Vendor
    INSERT INTO stock_vendors (id, tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (gen_random_uuid(), p_tenant_id, 'VND-0005', 'Asian Paints Ltd', 'Asian Paints', 'Suresh Menon', 'dealers@asianpaints.com', '9876543214', 'Mumbai', 'Maharashtra', '27AAACA3456K1Z3', 'Net 15', 15, 5, true)
    RETURNING id INTO v_vendor_paint;

    -- 6. Laminate Vendor
    INSERT INTO stock_vendors (id, tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (gen_random_uuid(), p_tenant_id, 'VND-0006', 'Merino Industries Ltd', 'Merino Laminates', 'Deepak Jain', 'sales@merinoindia.com', '9876543215', 'New Delhi', 'Delhi', '07AABCM7890K1Z1', 'Net 30', 30, 4, true)
    RETURNING id INTO v_vendor_laminate;

    -- 7. Stone & Marble Vendor
    INSERT INTO stock_vendors (id, tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (gen_random_uuid(), p_tenant_id, 'VND-0007', 'Pokarna Engineered Stone', 'Pokarna', 'Rahul Agarwal', 'orders@pokarna.com', '9876543216', 'Hyderabad', 'Telangana', '36AABCP2345K1Z7', 'Net 45', 45, 4, true)
    RETURNING id INTO v_vendor_stone;

    -- 8. Electrical & Lighting Vendor
    INSERT INTO stock_vendors (id, tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (gen_random_uuid(), p_tenant_id, 'VND-0008', 'Havells India Ltd', 'Havells', 'Ankit Gupta', 'b2b@havells.com', '9876543217', 'Noida', 'Uttar Pradesh', '09AAACH6789K1Z4', 'Net 30', 30, 5, true)
    RETURNING id INTO v_vendor_electrical;

    -- =========================================================================
    -- INSERT MATERIALS - PLYWOOD & WOOD
    -- =========================================================================
    
    INSERT INTO stock_materials (company_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, preferred_vendor_id, storage_location, is_active) VALUES
    -- Plywood
    (p_tenant_id, '18mm BWP Marine Plywood', 'PLY-BWP-18', 'Boiling Water Proof plywood for wet areas, 8x4 ft sheets', 'Plywood', 'raw_material', 'sheet', 45, 20, 30, 2800, 3500, v_vendor_plywood, 'Warehouse A - Section 1', true),
    (p_tenant_id, '12mm BWP Marine Plywood', 'PLY-BWP-12', 'Boiling Water Proof plywood, 8x4 ft sheets', 'Plywood', 'raw_material', 'sheet', 60, 25, 40, 2200, 2750, v_vendor_plywood, 'Warehouse A - Section 1', true),
    (p_tenant_id, '18mm MR Grade Plywood', 'PLY-MR-18', 'Moisture Resistant plywood for general use, 8x4 ft sheets', 'Plywood', 'raw_material', 'sheet', 80, 30, 50, 1800, 2250, v_vendor_plywood, 'Warehouse A - Section 1', true),
    (p_tenant_id, '12mm MR Grade Plywood', 'PLY-MR-12', 'Moisture Resistant plywood, 8x4 ft sheets', 'Plywood', 'raw_material', 'sheet', 100, 40, 60, 1400, 1750, v_vendor_plywood, 'Warehouse A - Section 1', true),
    (p_tenant_id, '6mm MR Grade Plywood', 'PLY-MR-06', 'Thin plywood for backing, 8x4 ft sheets', 'Plywood', 'raw_material', 'sheet', 50, 20, 30, 850, 1100, v_vendor_plywood, 'Warehouse A - Section 1', true),
    (p_tenant_id, '19mm Block Board', 'PLY-BB-19', 'Block board for furniture cores, 8x4 ft sheets', 'Plywood', 'raw_material', 'sheet', 35, 15, 25, 2400, 3000, v_vendor_plywood, 'Warehouse A - Section 2', true),
    (p_tenant_id, '18mm Pre-Laminated MDF', 'MDF-PL-18', 'White pre-laminated MDF board, 8x4 ft', 'MDF', 'raw_material', 'sheet', 40, 15, 25, 1600, 2000, v_vendor_plywood, 'Warehouse A - Section 2', true),
    (p_tenant_id, '12mm Plain MDF', 'MDF-PL-12', 'Plain MDF for painting, 8x4 ft', 'MDF', 'raw_material', 'sheet', 55, 20, 30, 1100, 1400, v_vendor_plywood, 'Warehouse A - Section 2', true),
    (p_tenant_id, '8mm HDHMR Board', 'HDHMR-08', 'High Density HMR board, termite proof, 8x4 ft', 'HDHMR', 'raw_material', 'sheet', 30, 10, 20, 1900, 2400, v_vendor_plywood, 'Warehouse A - Section 2', true);

    -- =========================================================================
    -- INSERT MATERIALS - HARDWARE
    -- =========================================================================
    
    INSERT INTO stock_materials (company_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, preferred_vendor_id, storage_location, is_active) VALUES
    -- Hinges
    (p_tenant_id, 'Soft Close Hinge - Full Overlay', 'HW-HNG-SC-FO', 'Hettich soft close cabinet hinge, full overlay', 'Hardware - Hinges', 'hardware', 'pair', 200, 50, 100, 180, 250, v_vendor_hardware, 'Warehouse B - Rack 1', true),
    (p_tenant_id, 'Soft Close Hinge - Half Overlay', 'HW-HNG-SC-HO', 'Hettich soft close cabinet hinge, half overlay', 'Hardware - Hinges', 'hardware', 'pair', 150, 40, 80, 180, 250, v_vendor_hardware, 'Warehouse B - Rack 1', true),
    (p_tenant_id, 'Hydraulic Hinge 165°', 'HW-HNG-HYD-165', 'Wide angle hydraulic hinge for corner cabinets', 'Hardware - Hinges', 'hardware', 'pair', 80, 20, 40, 350, 480, v_vendor_hardware, 'Warehouse B - Rack 1', true),
    -- Channels & Slides
    (p_tenant_id, 'Telescopic Channel 18"', 'HW-CH-TEL-18', 'Ball bearing telescopic drawer channel, 18 inch', 'Hardware - Channels', 'hardware', 'pair', 120, 30, 60, 450, 600, v_vendor_hardware, 'Warehouse B - Rack 2', true),
    (p_tenant_id, 'Telescopic Channel 20"', 'HW-CH-TEL-20', 'Ball bearing telescopic drawer channel, 20 inch', 'Hardware - Channels', 'hardware', 'pair', 100, 25, 50, 500, 680, v_vendor_hardware, 'Warehouse B - Rack 2', true),
    (p_tenant_id, 'Soft Close Telescopic 18"', 'HW-CH-SC-18', 'Soft close telescopic channel, 18 inch', 'Hardware - Channels', 'hardware', 'pair', 80, 20, 40, 850, 1150, v_vendor_hardware, 'Warehouse B - Rack 2', true),
    (p_tenant_id, 'Tandem Box 500mm', 'HW-TB-500', 'Hettich Tandem Box drawer system, 500mm depth', 'Hardware - Drawer Systems', 'hardware', 'set', 25, 10, 15, 3200, 4200, v_vendor_hardware, 'Warehouse B - Rack 3', true),
    -- Handles & Knobs
    (p_tenant_id, 'Profile Handle 6" - Black', 'HW-HDL-PF-6B', 'Aluminum profile handle, matte black, 6 inch', 'Hardware - Handles', 'hardware', 'pcs', 100, 25, 50, 120, 180, v_vendor_hardware, 'Warehouse B - Rack 4', true),
    (p_tenant_id, 'Profile Handle 8" - Black', 'HW-HDL-PF-8B', 'Aluminum profile handle, matte black, 8 inch', 'Hardware - Handles', 'hardware', 'pcs', 80, 20, 40, 150, 220, v_vendor_hardware, 'Warehouse B - Rack 4', true),
    (p_tenant_id, 'G-Profile Handle - SS', 'HW-HDL-GP-SS', 'Stainless steel G-profile for modular kitchen', 'Hardware - Handles', 'hardware', 'rft', 200, 50, 100, 85, 120, v_vendor_hardware, 'Warehouse B - Rack 4', true),
    -- Kitchen Hardware
    (p_tenant_id, 'Corner Carousel Unit', 'HW-KIT-CCU', 'Revolving corner unit for L-shaped kitchen, 900mm', 'Hardware - Kitchen', 'hardware', 'set', 8, 3, 5, 8500, 11500, v_vendor_hardware, 'Warehouse B - Rack 5', true),
    (p_tenant_id, 'Tall Unit Pull-Out', 'HW-KIT-TPO', 'Tall unit pull-out basket system, 5 tier', 'Hardware - Kitchen', 'hardware', 'set', 6, 2, 4, 12000, 16000, v_vendor_hardware, 'Warehouse B - Rack 5', true),
    (p_tenant_id, 'Cutlery Tray Insert', 'HW-KIT-CTI', 'Wooden cutlery organizer, fits 600mm drawer', 'Hardware - Kitchen', 'hardware', 'pcs', 20, 5, 10, 1800, 2500, v_vendor_hardware, 'Warehouse B - Rack 5', true);

    -- =========================================================================
    -- INSERT MATERIALS - LAMINATES
    -- =========================================================================
    
    INSERT INTO stock_materials (company_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, 'Laminate - Natural Oak', 'LAM-WD-NOK', 'Merino 1mm decorative laminate, natural oak finish, 8x4 ft', 'Laminates - Wood Grain', 'raw_material', 'sheet', 30, 10, 20, 1400, 1800, v_vendor_laminate, 'Warehouse A - Section 3', true),
    (p_tenant_id, 'Laminate - Walnut Dark', 'LAM-WD-WDK', 'Merino 1mm decorative laminate, dark walnut, 8x4 ft', 'Laminates - Wood Grain', 'raw_material', 'sheet', 25, 10, 15, 1400, 1800, v_vendor_laminate, 'Warehouse A - Section 3', true),
    (p_tenant_id, 'Laminate - White Gloss', 'LAM-SO-WHG', 'High gloss white solid color laminate, 8x4 ft', 'Laminates - Solid', 'raw_material', 'sheet', 40, 15, 25, 1200, 1550, v_vendor_laminate, 'Warehouse A - Section 3', true),
    (p_tenant_id, 'Laminate - Grey Matt', 'LAM-SO-GRM', 'Matt grey solid color laminate, 8x4 ft', 'Laminates - Solid', 'raw_material', 'sheet', 35, 12, 20, 1200, 1550, v_vendor_laminate, 'Warehouse A - Section 3', true),
    (p_tenant_id, 'Laminate - Charcoal', 'LAM-SO-CHR', 'Charcoal solid laminate with texture, 8x4 ft', 'Laminates - Solid', 'raw_material', 'sheet', 20, 8, 15, 1350, 1750, v_vendor_laminate, 'Warehouse A - Section 3', true),
    (p_tenant_id, 'Acrylic Laminate - White', 'LAM-AC-WHT', 'High gloss acrylic finish laminate, white, 8x4 ft', 'Laminates - Acrylic', 'raw_material', 'sheet', 15, 5, 10, 3800, 4800, v_vendor_laminate, 'Warehouse A - Section 3', true),
    (p_tenant_id, 'PU Finish Laminate - Cream', 'LAM-PU-CRM', 'Premium PU painted finish, cream, 8x4 ft', 'Laminates - PU', 'raw_material', 'sheet', 12, 4, 8, 4500, 5800, v_vendor_laminate, 'Warehouse A - Section 3', true);

    -- =========================================================================
    -- INSERT MATERIALS - PAINTS & FINISHES
    -- =========================================================================
    
    INSERT INTO stock_materials (company_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, 'Primer - White', 'PNT-PRM-WHT', 'Asian Paints wood primer, white, 4 litre', 'Paints - Primer', 'consumable', 'can', 25, 10, 15, 850, 1100, v_vendor_paint, 'Warehouse C - Section 1', true),
    (p_tenant_id, 'PU Clear Finish - Matt', 'PNT-PU-CLM', 'Polyurethane clear coat, matt finish, 4 litre', 'Paints - PU', 'consumable', 'can', 15, 5, 10, 2800, 3600, v_vendor_paint, 'Warehouse C - Section 1', true),
    (p_tenant_id, 'PU Clear Finish - Gloss', 'PNT-PU-CLG', 'Polyurethane clear coat, gloss finish, 4 litre', 'Paints - PU', 'consumable', 'can', 12, 4, 8, 2800, 3600, v_vendor_paint, 'Warehouse C - Section 1', true),
    (p_tenant_id, 'Duco Paint - White', 'PNT-DCO-WHT', 'Nitrocellulose duco paint, white, 4 litre', 'Paints - Duco', 'consumable', 'can', 10, 3, 6, 3200, 4100, v_vendor_paint, 'Warehouse C - Section 1', true),
    (p_tenant_id, 'Wood Stain - Walnut', 'PNT-STN-WAL', 'Wood stain, walnut shade, 1 litre', 'Paints - Stain', 'consumable', 'can', 18, 6, 12, 650, 850, v_vendor_paint, 'Warehouse C - Section 1', true),
    (p_tenant_id, 'Wood Stain - Mahogany', 'PNT-STN-MAH', 'Wood stain, mahogany shade, 1 litre', 'Paints - Stain', 'consumable', 'can', 15, 5, 10, 650, 850, v_vendor_paint, 'Warehouse C - Section 1', true);

    -- =========================================================================
    -- INSERT MATERIALS - ADHESIVES & CONSUMABLES
    -- =========================================================================
    
    INSERT INTO stock_materials (company_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, 'Fevicol SH', 'ADH-FEV-SH', 'Synthetic resin adhesive for plywood, 50 kg drum', 'Adhesives', 'consumable', 'drum', 8, 3, 5, 4500, 5500, v_vendor_plywood, 'Warehouse C - Section 2', true),
    (p_tenant_id, 'Fevicol Marine', 'ADH-FEV-MR', 'Waterproof adhesive for wet areas, 20 kg', 'Adhesives', 'consumable', 'bucket', 6, 2, 4, 3200, 4000, v_vendor_plywood, 'Warehouse C - Section 2', true),
    (p_tenant_id, 'Contact Adhesive SR', 'ADH-CON-SR', 'Spray grade contact adhesive, 5 litre', 'Adhesives', 'consumable', 'can', 15, 5, 10, 1800, 2300, v_vendor_plywood, 'Warehouse C - Section 2', true),
    (p_tenant_id, 'PVC Edge Band - White 22mm', 'EDG-PVC-W22', 'PVC edge banding tape, white, 22mm x 50m roll', 'Edge Bands', 'consumable', 'roll', 25, 8, 15, 450, 600, v_vendor_laminate, 'Warehouse C - Section 3', true),
    (p_tenant_id, 'PVC Edge Band - Black 22mm', 'EDG-PVC-B22', 'PVC edge banding tape, black, 22mm x 50m roll', 'Edge Bands', 'consumable', 'roll', 20, 6, 12, 450, 600, v_vendor_laminate, 'Warehouse C - Section 3', true),
    (p_tenant_id, 'ABS Edge Band - Oak 22mm', 'EDG-ABS-O22', 'ABS edge banding with wood grain, 22mm x 25m roll', 'Edge Bands', 'consumable', 'roll', 15, 5, 10, 680, 900, v_vendor_laminate, 'Warehouse C - Section 3', true),
    (p_tenant_id, 'Sandpaper 120 Grit', 'SND-120', 'Sandpaper sheet 120 grit, 9x11 inch', 'Abrasives', 'consumable', 'sheet', 200, 50, 100, 25, 40, v_vendor_paint, 'Warehouse C - Section 4', true),
    (p_tenant_id, 'Sandpaper 220 Grit', 'SND-220', 'Sandpaper sheet 220 grit, 9x11 inch', 'Abrasives', 'consumable', 'sheet', 200, 50, 100, 28, 45, v_vendor_paint, 'Warehouse C - Section 4', true),
    (p_tenant_id, 'Sandpaper 400 Grit', 'SND-400', 'Sandpaper sheet 400 grit for finishing, 9x11 inch', 'Abrasives', 'consumable', 'sheet', 150, 40, 80, 32, 50, v_vendor_paint, 'Warehouse C - Section 4', true);

    -- =========================================================================
    -- INSERT MATERIALS - GLASS
    -- =========================================================================
    
    INSERT INTO stock_materials (company_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, 'Clear Float Glass 5mm', 'GLS-CLR-05', 'Clear float glass 5mm thick, per sqft', 'Glass - Clear', 'raw_material', 'sqft', 500, 100, 200, 85, 120, v_vendor_glass, 'Warehouse D - Section 1', true),
    (p_tenant_id, 'Clear Float Glass 8mm', 'GLS-CLR-08', 'Clear float glass 8mm thick, per sqft', 'Glass - Clear', 'raw_material', 'sqft', 300, 80, 150, 140, 190, v_vendor_glass, 'Warehouse D - Section 1', true),
    (p_tenant_id, 'Toughened Glass 10mm', 'GLS-TGH-10', 'Tempered safety glass 10mm, per sqft', 'Glass - Toughened', 'raw_material', 'sqft', 200, 50, 100, 280, 380, v_vendor_glass, 'Warehouse D - Section 1', true),
    (p_tenant_id, 'Frosted Glass 5mm', 'GLS-FRS-05', 'Acid etched frosted glass 5mm, per sqft', 'Glass - Frosted', 'raw_material', 'sqft', 150, 40, 80, 120, 165, v_vendor_glass, 'Warehouse D - Section 2', true),
    (p_tenant_id, 'Lacquered Glass - White', 'GLS-LAC-WHT', 'Back painted white glass 5mm, per sqft', 'Glass - Lacquered', 'raw_material', 'sqft', 100, 30, 50, 180, 250, v_vendor_glass, 'Warehouse D - Section 2', true),
    (p_tenant_id, 'Lacquered Glass - Black', 'GLS-LAC-BLK', 'Back painted black glass 5mm, per sqft', 'Glass - Lacquered', 'raw_material', 'sqft', 80, 25, 40, 180, 250, v_vendor_glass, 'Warehouse D - Section 2', true),
    (p_tenant_id, 'Mirror - Clear 4mm', 'GLS-MIR-04', 'Clear silver mirror 4mm, per sqft', 'Glass - Mirror', 'raw_material', 'sqft', 200, 50, 100, 95, 140, v_vendor_glass, 'Warehouse D - Section 3', true),
    (p_tenant_id, 'Mirror - Bronze Tint', 'GLS-MIR-BRZ', 'Bronze tinted mirror 4mm, per sqft', 'Glass - Mirror', 'raw_material', 'sqft', 80, 20, 40, 130, 185, v_vendor_glass, 'Warehouse D - Section 3', true);

    -- =========================================================================
    -- INSERT MATERIALS - FABRICS & UPHOLSTERY
    -- =========================================================================
    
    INSERT INTO stock_materials (company_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, 'Upholstery Fabric - Linen Grey', 'FAB-UPH-LGR', 'Premium linen blend upholstery fabric, grey, per meter', 'Fabrics - Upholstery', 'raw_material', 'mtr', 80, 20, 40, 650, 900, v_vendor_fabric, 'Warehouse E - Section 1', true),
    (p_tenant_id, 'Upholstery Fabric - Velvet Blue', 'FAB-UPH-VBL', 'Velvet upholstery fabric, royal blue, per meter', 'Fabrics - Upholstery', 'raw_material', 'mtr', 50, 15, 25, 1200, 1650, v_vendor_fabric, 'Warehouse E - Section 1', true),
    (p_tenant_id, 'Curtain Fabric - Blackout', 'FAB-CUR-BLK', 'Blackout curtain fabric, multiple colors, per meter', 'Fabrics - Curtains', 'raw_material', 'mtr', 100, 30, 50, 450, 650, v_vendor_fabric, 'Warehouse E - Section 2', true),
    (p_tenant_id, 'Curtain Fabric - Sheer White', 'FAB-CUR-SHW', 'Sheer voile curtain fabric, white, per meter', 'Fabrics - Curtains', 'raw_material', 'mtr', 120, 40, 60, 280, 400, v_vendor_fabric, 'Warehouse E - Section 2', true),
    (p_tenant_id, 'Leather - Tan Full Grain', 'FAB-LTH-TFG', 'Full grain leather, tan, per sqft', 'Fabrics - Leather', 'raw_material', 'sqft', 150, 40, 80, 180, 260, v_vendor_fabric, 'Warehouse E - Section 3', true),
    (p_tenant_id, 'Leatherette - Black', 'FAB-LRT-BLK', 'Premium leatherette/rexine, black, per meter', 'Fabrics - Leatherette', 'raw_material', 'mtr', 100, 25, 50, 350, 500, v_vendor_fabric, 'Warehouse E - Section 3', true),
    (p_tenant_id, 'Foam - 40 Density', 'FAB-FOM-40D', 'High resilience foam 40 density, per sqft (2" thick)', 'Fabrics - Foam', 'raw_material', 'sqft', 200, 50, 100, 65, 95, v_vendor_fabric, 'Warehouse E - Section 4', true),
    (p_tenant_id, 'Foam - 32 Density', 'FAB-FOM-32D', 'Medium density foam 32 density, per sqft (2" thick)', 'Fabrics - Foam', 'raw_material', 'sqft', 250, 60, 120, 45, 70, v_vendor_fabric, 'Warehouse E - Section 4', true);

    -- =========================================================================
    -- INSERT MATERIALS - STONE & COUNTERTOPS
    -- =========================================================================
    
    INSERT INTO stock_materials (company_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, 'Quartz Slab - Calacatta White', 'STN-QTZ-CAL', 'Engineered quartz, calacatta pattern, per sqft', 'Stone - Quartz', 'raw_material', 'sqft', 100, 25, 50, 550, 750, v_vendor_stone, 'Warehouse F - Section 1', true),
    (p_tenant_id, 'Quartz Slab - Pure White', 'STN-QTZ-PWH', 'Engineered quartz, pure white, per sqft', 'Stone - Quartz', 'raw_material', 'sqft', 120, 30, 60, 450, 620, v_vendor_stone, 'Warehouse F - Section 1', true),
    (p_tenant_id, 'Quartz Slab - Grey Mist', 'STN-QTZ-GRM', 'Engineered quartz, grey with subtle pattern, per sqft', 'Stone - Quartz', 'raw_material', 'sqft', 80, 20, 40, 480, 660, v_vendor_stone, 'Warehouse F - Section 1', true),
    (p_tenant_id, 'Granite - Black Galaxy', 'STN-GRN-BKG', 'Natural granite, black galaxy, per sqft', 'Stone - Granite', 'raw_material', 'sqft', 60, 15, 30, 280, 400, v_vendor_stone, 'Warehouse F - Section 2', true),
    (p_tenant_id, 'Granite - Tan Brown', 'STN-GRN-TBR', 'Natural granite, tan brown, per sqft', 'Stone - Granite', 'raw_material', 'sqft', 50, 12, 25, 220, 320, v_vendor_stone, 'Warehouse F - Section 2', true),
    (p_tenant_id, 'Italian Marble - Statuario', 'STN-MRB-STA', 'Premium Italian marble, statuario, per sqft', 'Stone - Marble', 'raw_material', 'sqft', 40, 10, 20, 1200, 1650, v_vendor_stone, 'Warehouse F - Section 3', true),
    (p_tenant_id, 'Indian Marble - Makrana White', 'STN-MRB-MAK', 'Indian white marble from Makrana, per sqft', 'Stone - Marble', 'raw_material', 'sqft', 80, 20, 40, 380, 520, v_vendor_stone, 'Warehouse F - Section 3', true);

    -- =========================================================================
    -- INSERT MATERIALS - ELECTRICAL & LIGHTING
    -- =========================================================================
    
    INSERT INTO stock_materials (company_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, 'LED Strip Light - Warm White', 'ELC-LED-WWH', 'LED strip 12V, warm white 3000K, per meter', 'Electrical - LED', 'accessory', 'mtr', 100, 25, 50, 120, 180, v_vendor_electrical, 'Warehouse G - Section 1', true),
    (p_tenant_id, 'LED Strip Light - Cool White', 'ELC-LED-CWH', 'LED strip 12V, cool white 6000K, per meter', 'Electrical - LED', 'accessory', 'mtr', 80, 20, 40, 120, 180, v_vendor_electrical, 'Warehouse G - Section 1', true),
    (p_tenant_id, 'LED Driver 30W', 'ELC-DRV-30W', 'Constant voltage LED driver 12V 30W', 'Electrical - Drivers', 'accessory', 'pcs', 30, 10, 20, 350, 480, v_vendor_electrical, 'Warehouse G - Section 2', true),
    (p_tenant_id, 'LED Driver 60W', 'ELC-DRV-60W', 'Constant voltage LED driver 12V 60W', 'Electrical - Drivers', 'accessory', 'pcs', 25, 8, 15, 550, 750, v_vendor_electrical, 'Warehouse G - Section 2', true),
    (p_tenant_id, 'COB Profile Light 10W', 'ELC-COB-10W', 'Recessed COB profile light 10W, warm white', 'Electrical - Lights', 'accessory', 'pcs', 50, 15, 30, 280, 400, v_vendor_electrical, 'Warehouse G - Section 3', true),
    (p_tenant_id, 'Modular Switch - 6A', 'ELC-SWT-06A', 'Havells modular switch 6A', 'Electrical - Switches', 'accessory', 'pcs', 100, 30, 50, 85, 125, v_vendor_electrical, 'Warehouse G - Section 4', true),
    (p_tenant_id, 'Modular Socket - 16A', 'ELC-SOK-16A', 'Havells modular socket 16A with shutter', 'Electrical - Switches', 'accessory', 'pcs', 60, 20, 35, 145, 210, v_vendor_electrical, 'Warehouse G - Section 4', true),
    (p_tenant_id, 'USB Charging Module', 'ELC-USB-2P', 'Dual USB charging module 2.1A', 'Electrical - Switches', 'accessory', 'pcs', 40, 10, 20, 380, 520, v_vendor_electrical, 'Warehouse G - Section 4', true);

    RETURN 'Stock data seeded successfully for tenant: ' || p_tenant_id::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HOW TO USE THIS SCRIPT
-- ============================================================================
-- 
-- 1. First, run the CREATE FUNCTION statement above
-- 
-- 2. Then find your tenant_id:
--    SELECT id, company_name FROM tenants;
-- 
-- 3. Call the function with your tenant_id:
--    SELECT seed_stock_data('your-tenant-uuid-here');
-- 
-- Example:
--    SELECT seed_stock_data('12345678-1234-1234-1234-123456789abc');
-- 
-- ============================================================================

-- To verify the data was inserted:
-- SELECT COUNT(*) as vendor_count FROM stock_vendors;
-- SELECT COUNT(*) as material_count FROM stock_materials;
-- SELECT category, COUNT(*) FROM stock_materials GROUP BY category ORDER BY category;
