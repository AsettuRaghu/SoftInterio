-- =====================================================
-- Updated Stock Seed Data with Brands & Pricing Tiers
-- =====================================================
-- Run this AFTER:
--   022_stock_module_schema.sql
--   024_brands_and_vendor_pricing.sql
--   026_pricing_and_revenue_heads.sql
-- =====================================================

-- Drop existing seed function if exists
DROP FUNCTION IF EXISTS seed_stock_data_v2(UUID);

CREATE OR REPLACE FUNCTION seed_stock_data_v2(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
    -- Brand IDs
    v_brand_century UUID;
    v_brand_greenply UUID;
    v_brand_hettich UUID;
    v_brand_hafele UUID;
    v_brand_ebco UUID;
    v_brand_merino UUID;
    v_brand_greenlam UUID;
    v_brand_asian_paints UUID;
    v_brand_berger UUID;
    v_brand_saint_gobain UUID;
    v_brand_asahi UUID;
    v_brand_ddecor UUID;
    v_brand_pokarna UUID;
    v_brand_havells UUID;
    v_brand_philips UUID;
    v_brand_fevicol UUID;
    -- Appliance Brands
    v_brand_faber UUID;
    v_brand_elica UUID;
    v_brand_bosch UUID;
    v_brand_kaff UUID;
    
    -- Vendor IDs (Local dealers)
    v_vendor_krishna_ply UUID;
    v_vendor_sharma_hardware UUID;
    v_vendor_city_laminates UUID;
    v_vendor_decor_fabrics UUID;
    v_vendor_glass_world UUID;
    v_vendor_paint_house UUID;
    v_vendor_stone_mart UUID;
    v_vendor_electric_plaza UUID;
    v_vendor_kitchen_world UUID;  -- New vendor for appliances
    
    -- Material IDs (for vendor pricing)
    v_mat_ply_bwp_18 UUID;
    v_mat_ply_mr_18 UUID;
    v_mat_hinge_sc UUID;
    v_mat_channel_18 UUID;
    
    -- Revenue head IDs
    v_rev_ply UUID;
    v_rev_hw UUID;
    v_rev_lam UUID;
    v_rev_paint UUID;
    v_rev_glass UUID;
    v_rev_stone UUID;
    v_rev_app UUID;
    v_rev_light UUID;
BEGIN
    -- Clean existing data for this tenant first (in order of dependencies)
    DELETE FROM commission_items WHERE tenant_id = p_tenant_id;
    DELETE FROM stock_vendor_materials WHERE tenant_id = p_tenant_id;
    DELETE FROM stock_vendor_brands WHERE tenant_id = p_tenant_id;
    DELETE FROM stock_materials WHERE company_id = p_tenant_id;
    DELETE FROM stock_vendors WHERE tenant_id = p_tenant_id;
    DELETE FROM stock_brands WHERE tenant_id = p_tenant_id;
    
    -- Get revenue head IDs (created by seed_revenue_heads)
    SELECT id INTO v_rev_ply FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-PLY';
    SELECT id INTO v_rev_hw FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-HW';
    SELECT id INTO v_rev_lam FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-LAM';
    SELECT id INTO v_rev_paint FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-PAINT';
    SELECT id INTO v_rev_glass FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-GLASS';
    SELECT id INTO v_rev_stone FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-STONE';
    SELECT id INTO v_rev_app FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-COMM-APP';
    SELECT id INTO v_rev_light FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-COMM-LIGHT';
    -- =========================================================================
    -- STEP 1: INSERT BRANDS (Manufacturers)
    -- =========================================================================
    
    -- Plywood Brands
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-CENTURY', 'Century Plyboards India Ltd', 'Century Ply', 'www.centuryply.com', ARRAY['Plywood', 'MDF', 'Veneers'], 'premium', true)
    RETURNING id INTO v_brand_century;
    
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-GREENPLY', 'Greenply Industries Ltd', 'Greenply', 'www.greenply.com', ARRAY['Plywood', 'MDF', 'Block Board'], 'premium', true)
    RETURNING id INTO v_brand_greenply;
    
    -- Hardware Brands
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, country, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-HETTICH', 'Hettich International', 'Hettich', 'www.hettich.com', 'Germany', ARRAY['Hinges', 'Channels', 'Drawer Systems', 'Kitchen Hardware'], 'luxury', true)
    RETURNING id INTO v_brand_hettich;
    
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, country, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-HAFELE', 'Häfele GmbH', 'Hafele', 'www.hafele.com', 'Germany', ARRAY['Hinges', 'Channels', 'Kitchen Hardware', 'Handles'], 'luxury', true)
    RETURNING id INTO v_brand_hafele;
    
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-EBCO', 'Ebco Private Limited', 'Ebco', 'www.ebco.in', ARRAY['Hinges', 'Channels', 'Kitchen Hardware'], 'standard', true)
    RETURNING id INTO v_brand_ebco;
    
    -- Laminate Brands
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-MERINO', 'Merino Industries Ltd', 'Merino', 'www.merinolam.com', ARRAY['Laminates', 'Compacts', 'Acrylic'], 'premium', true)
    RETURNING id INTO v_brand_merino;
    
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-GREENLAM', 'Greenlam Industries Ltd', 'Greenlam', 'www.greenlam.com', ARRAY['Laminates', 'Veneers', 'Compacts'], 'premium', true)
    RETURNING id INTO v_brand_greenlam;
    
    -- Paint Brands
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-ASIANPAINTS', 'Asian Paints Ltd', 'Asian Paints', 'www.asianpaints.com', ARRAY['Paints', 'Wood Finishes', 'PU Coatings'], 'premium', true)
    RETURNING id INTO v_brand_asian_paints;
    
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-BERGER', 'Berger Paints India Ltd', 'Berger', 'www.bergerpaints.com', ARRAY['Paints', 'Wood Finishes'], 'standard', true)
    RETURNING id INTO v_brand_berger;
    
    -- Glass Brands
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, country, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-SAINTGOBAIN', 'Saint-Gobain Glass', 'Saint-Gobain', 'www.saint-gobain-glass.com', 'France', ARRAY['Float Glass', 'Toughened Glass', 'Mirror'], 'luxury', true)
    RETURNING id INTO v_brand_saint_gobain;
    
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-ASAHI', 'Asahi India Glass Ltd', 'AIS Glass', 'www.aisglass.com', ARRAY['Float Glass', 'Toughened Glass', 'Lacquered Glass'], 'premium', true)
    RETURNING id INTO v_brand_asahi;
    
    -- Fabric Brand
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-DDECOR', 'D''Decor Home Fabrics', 'D''Decor', 'www.ddecor.com', ARRAY['Upholstery', 'Curtains', 'Wallcoverings'], 'premium', true)
    RETURNING id INTO v_brand_ddecor;
    
    -- Stone Brand
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-POKARNA', 'Pokarna Engineered Stone Ltd', 'Pokarna/Quantra', 'www.pokarna.com', ARRAY['Quartz', 'Engineered Stone'], 'premium', true)
    RETURNING id INTO v_brand_pokarna;
    
    -- Electrical Brands
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-HAVELLS', 'Havells India Ltd', 'Havells', 'www.havells.com', ARRAY['Switches', 'Wiring', 'Lighting'], 'premium', true)
    RETURNING id INTO v_brand_havells;
    
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, country, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-PHILIPS', 'Signify (Philips Lighting)', 'Philips', 'www.signify.com', 'Netherlands', ARRAY['LED Lighting', 'Drivers'], 'premium', true)
    RETURNING id INTO v_brand_philips;
    
    -- Adhesive Brand
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-FEVICOL', 'Pidilite Industries Ltd', 'Fevicol/Pidilite', 'www.pidilite.com', ARRAY['Adhesives', 'Sealants'], 'premium', true)
    RETURNING id INTO v_brand_fevicol;
    
    -- Kitchen Appliance Brands (Commission items)
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, country, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-FABER', 'Faber S.p.A.', 'Faber', 'www.faberindia.com', 'Italy', ARRAY['Chimneys', 'Hobs', 'Ovens'], 'premium', true)
    RETURNING id INTO v_brand_faber;
    
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, country, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-ELICA', 'Elica S.p.A.', 'Elica', 'www.elica.com', 'Italy', ARRAY['Chimneys', 'Hobs'], 'luxury', true)
    RETURNING id INTO v_brand_elica;
    
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, country, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-BOSCH', 'Robert Bosch GmbH', 'Bosch', 'www.bosch-home.in', 'Germany', ARRAY['Chimneys', 'Hobs', 'Ovens', 'Dishwashers'], 'luxury', true)
    RETURNING id INTO v_brand_bosch;
    
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-KAFF', 'Kaff Appliances India Pvt Ltd', 'Kaff', 'www.kaff.in', ARRAY['Chimneys', 'Hobs', 'Sinks'], 'standard', true)
    RETURNING id INTO v_brand_kaff;

    -- =========================================================================
    -- STEP 2: INSERT VENDORS (Local Dealers/Distributors)
    -- =========================================================================
    
    INSERT INTO stock_vendors (tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (p_tenant_id, 'VND-0001', 'Krishna Plywood & Timber', 'Krishna Ply', 'Ramesh Agarwal', 'sales@krishnaply.com', '9876543210', 'Bangalore', 'Karnataka', '29AAACR5055K1ZK', 'Net 30', 30, 5, true)
    RETURNING id INTO v_vendor_krishna_ply;
    
    INSERT INTO stock_vendors (tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (p_tenant_id, 'VND-0002', 'Sharma Hardware Solutions', 'Sharma Hardware', 'Vijay Sharma', 'orders@sharmahw.com', '9876543211', 'Bangalore', 'Karnataka', '29AABCH1234K1Z5', 'Net 45', 45, 5, true)
    RETURNING id INTO v_vendor_sharma_hardware;
    
    INSERT INTO stock_vendors (tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (p_tenant_id, 'VND-0003', 'City Laminates & Veneers', 'City Laminates', 'Pradeep Jain', 'info@citylaminates.com', '9876543212', 'Bangalore', 'Karnataka', '29AABCD5678K1Z2', 'Net 30', 30, 4, true)
    RETURNING id INTO v_vendor_city_laminates;
    
    INSERT INTO stock_vendors (tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (p_tenant_id, 'VND-0004', 'Decor Fabrics & Furnishings', 'Decor Fabrics', 'Meena Patel', 'wholesale@decorfabrics.com', '9876543213', 'Bangalore', 'Karnataka', '29AABCS9012K1Z8', 'Net 30', 30, 4, true)
    RETURNING id INTO v_vendor_decor_fabrics;
    
    INSERT INTO stock_vendors (tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (p_tenant_id, 'VND-0005', 'Glass World India', 'Glass World', 'Sunil Reddy', 'sales@glassworld.in', '9876543214', 'Bangalore', 'Karnataka', '29AAACA3456K1Z3', 'Net 15', 15, 5, true)
    RETURNING id INTO v_vendor_glass_world;
    
    INSERT INTO stock_vendors (tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (p_tenant_id, 'VND-0006', 'The Paint House', 'Paint House', 'Deepak Gupta', 'orders@painthouse.com', '9876543215', 'Bangalore', 'Karnataka', '29AABCM7890K1Z1', 'Net 15', 15, 4, true)
    RETURNING id INTO v_vendor_paint_house;
    
    INSERT INTO stock_vendors (tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (p_tenant_id, 'VND-0007', 'Stone Mart Enterprises', 'Stone Mart', 'Rakesh Agarwal', 'info@stonemart.in', '9876543216', 'Bangalore', 'Karnataka', '29AABCP2345K1Z7', 'Net 45', 45, 4, true)
    RETURNING id INTO v_vendor_stone_mart;
    
    INSERT INTO stock_vendors (tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (p_tenant_id, 'VND-0008', 'Electric Plaza', 'Electric Plaza', 'Ankit Verma', 'b2b@electricplaza.com', '9876543217', 'Bangalore', 'Karnataka', '29AAACH6789K1Z4', 'Net 30', 30, 5, true)
    RETURNING id INTO v_vendor_electric_plaza;
    
    INSERT INTO stock_vendors (tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (p_tenant_id, 'VND-0009', 'Kitchen World Appliances', 'Kitchen World', 'Sanjay Mehta', 'dealer@kitchenworld.in', '9876543218', 'Bangalore', 'Karnataka', '29AABCK1234K1Z9', 'Net 45', 45, 5, true)
    RETURNING id INTO v_vendor_kitchen_world;

    -- =========================================================================
    -- STEP 3: LINK VENDORS TO BRANDS
    -- =========================================================================
    
    -- Krishna Ply sells Century, Greenply
    INSERT INTO stock_vendor_brands (tenant_id, vendor_id, brand_id, is_authorized_dealer, discount_percent) VALUES
    (p_tenant_id, v_vendor_krishna_ply, v_brand_century, true, 5),
    (p_tenant_id, v_vendor_krishna_ply, v_brand_greenply, true, 5),
    (p_tenant_id, v_vendor_krishna_ply, v_brand_fevicol, false, 2);
    
    -- Sharma Hardware sells Hettich, Hafele, Ebco
    INSERT INTO stock_vendor_brands (tenant_id, vendor_id, brand_id, is_authorized_dealer, discount_percent) VALUES
    (p_tenant_id, v_vendor_sharma_hardware, v_brand_hettich, true, 8),
    (p_tenant_id, v_vendor_sharma_hardware, v_brand_hafele, true, 8),
    (p_tenant_id, v_vendor_sharma_hardware, v_brand_ebco, true, 10);
    
    -- City Laminates sells Merino, Greenlam
    INSERT INTO stock_vendor_brands (tenant_id, vendor_id, brand_id, is_authorized_dealer, discount_percent) VALUES
    (p_tenant_id, v_vendor_city_laminates, v_brand_merino, true, 6),
    (p_tenant_id, v_vendor_city_laminates, v_brand_greenlam, true, 6);
    
    -- Decor Fabrics sells D'Decor
    INSERT INTO stock_vendor_brands (tenant_id, vendor_id, brand_id, is_authorized_dealer, discount_percent) VALUES
    (p_tenant_id, v_vendor_decor_fabrics, v_brand_ddecor, true, 10);
    
    -- Glass World sells Saint-Gobain, AIS
    INSERT INTO stock_vendor_brands (tenant_id, vendor_id, brand_id, is_authorized_dealer, discount_percent) VALUES
    (p_tenant_id, v_vendor_glass_world, v_brand_saint_gobain, true, 5),
    (p_tenant_id, v_vendor_glass_world, v_brand_asahi, true, 5);
    
    -- Paint House sells Asian Paints, Berger
    INSERT INTO stock_vendor_brands (tenant_id, vendor_id, brand_id, is_authorized_dealer, discount_percent) VALUES
    (p_tenant_id, v_vendor_paint_house, v_brand_asian_paints, true, 8),
    (p_tenant_id, v_vendor_paint_house, v_brand_berger, true, 10);
    
    -- Stone Mart sells Pokarna
    INSERT INTO stock_vendor_brands (tenant_id, vendor_id, brand_id, is_authorized_dealer, discount_percent) VALUES
    (p_tenant_id, v_vendor_stone_mart, v_brand_pokarna, true, 5);
    
    -- Electric Plaza sells Havells, Philips
    INSERT INTO stock_vendor_brands (tenant_id, vendor_id, brand_id, is_authorized_dealer, discount_percent) VALUES
    (p_tenant_id, v_vendor_electric_plaza, v_brand_havells, true, 12),
    (p_tenant_id, v_vendor_electric_plaza, v_brand_philips, true, 10);
    
    -- Kitchen World sells Faber, Elica, Bosch, Kaff
    INSERT INTO stock_vendor_brands (tenant_id, vendor_id, brand_id, is_authorized_dealer, discount_percent) VALUES
    (p_tenant_id, v_vendor_kitchen_world, v_brand_faber, true, 18),
    (p_tenant_id, v_vendor_kitchen_world, v_brand_elica, true, 15),
    (p_tenant_id, v_vendor_kitchen_world, v_brand_bosch, true, 12),
    (p_tenant_id, v_vendor_kitchen_world, v_brand_kaff, true, 20);

    -- =========================================================================
    -- STEP 4: INSERT MATERIALS WITH FULL PRICING TIERS
    -- Columns: vendor_cost, company_cost, retail_price, markup_percent
    -- =========================================================================
    
    -- PLYWOOD (Century brand from Krishna Ply vendor)
    -- vendor_cost = what we pay | company_cost = our quotation rate | retail_price = MRP
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active)
    VALUES (p_tenant_id, v_brand_century, '18mm BWP Marine Plywood - Century', 'PLY-CEN-BWP-18', 'Century Boiling Water Proof plywood for wet areas, 8x4 ft sheets', 'Plywood', 'raw_material', 'sheet', 45, 20, 30, 2800, 3500, 2800, 3300, 3500, 17.86, v_rev_ply, false, v_vendor_krishna_ply, 'Warehouse A - Section 1', true)
    RETURNING id INTO v_mat_ply_bwp_18;
    
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active)
    VALUES (p_tenant_id, v_brand_century, '12mm BWP Marine Plywood - Century', 'PLY-CEN-BWP-12', 'Century Boiling Water Proof plywood, 8x4 ft sheets', 'Plywood', 'raw_material', 'sheet', 60, 25, 40, 2200, 2750, 2200, 2600, 2750, 18.18, v_rev_ply, false, v_vendor_krishna_ply, 'Warehouse A - Section 1', true);
    
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active)
    VALUES (p_tenant_id, v_brand_century, '18mm MR Grade Plywood - Century', 'PLY-CEN-MR-18', 'Century Moisture Resistant plywood, 8x4 ft sheets', 'Plywood', 'raw_material', 'sheet', 80, 30, 50, 1800, 2250, 1800, 2125, 2250, 18.06, v_rev_ply, false, v_vendor_krishna_ply, 'Warehouse A - Section 1', true)
    RETURNING id INTO v_mat_ply_mr_18;
    
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, v_brand_greenply, '18mm BWP Plywood - Greenply', 'PLY-GRN-BWP-18', 'Greenply BWP grade, 8x4 ft sheets', 'Plywood', 'raw_material', 'sheet', 40, 20, 30, 2700, 3400, 2700, 3200, 3400, 18.52, v_rev_ply, false, v_vendor_krishna_ply, 'Warehouse A - Section 1', true),
    (p_tenant_id, v_brand_century, '19mm Block Board - Century', 'PLY-CEN-BB-19', 'Century block board for furniture cores, 8x4 ft', 'Plywood', 'raw_material', 'sheet', 35, 15, 25, 2400, 3000, 2400, 2850, 3000, 18.75, v_rev_ply, false, v_vendor_krishna_ply, 'Warehouse A - Section 2', true),
    (p_tenant_id, v_brand_century, '18mm Pre-Laminated MDF - Century', 'MDF-CEN-PL-18', 'Century white pre-laminated MDF board, 8x4 ft', 'MDF', 'raw_material', 'sheet', 40, 15, 25, 1600, 2000, 1600, 1850, 2000, 15.63, v_rev_ply, false, v_vendor_krishna_ply, 'Warehouse A - Section 2', true);

    -- HARDWARE (Hettich brand from Sharma Hardware) - Higher markup for premium hardware
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active)
    VALUES (p_tenant_id, v_brand_hettich, 'Soft Close Hinge - Full Overlay - Hettich', 'HW-HET-SC-FO', 'Hettich Sensys soft close cabinet hinge, full overlay', 'Hardware - Hinges', 'hardware', 'pair', 200, 50, 100, 220, 300, 220, 275, 300, 25.00, v_rev_hw, false, v_vendor_sharma_hardware, 'Warehouse B - Rack 1', true)
    RETURNING id INTO v_mat_hinge_sc;
    
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active)
    VALUES (p_tenant_id, v_brand_hettich, 'Telescopic Channel 18" - Hettich', 'HW-HET-TEL-18', 'Hettich ball bearing telescopic drawer channel, 18 inch', 'Hardware - Channels', 'hardware', 'pair', 120, 30, 60, 550, 720, 550, 690, 720, 25.45, v_rev_hw, false, v_vendor_sharma_hardware, 'Warehouse B - Rack 2', true)
    RETURNING id INTO v_mat_channel_18;
    
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, v_brand_hettich, 'Tandem Box 500mm - Hettich', 'HW-HET-TB-500', 'Hettich ArciTech/Tandem Box drawer system, 500mm', 'Hardware - Drawer Systems', 'hardware', 'set', 25, 10, 15, 3500, 4500, 3500, 4375, 4500, 25.00, v_rev_hw, false, v_vendor_sharma_hardware, 'Warehouse B - Rack 3', true),
    (p_tenant_id, v_brand_hafele, 'Soft Close Hinge - Hafele', 'HW-HAF-SC-FO', 'Hafele soft close cabinet hinge, full overlay', 'Hardware - Hinges', 'hardware', 'pair', 150, 40, 80, 200, 280, 200, 250, 280, 25.00, v_rev_hw, false, v_vendor_sharma_hardware, 'Warehouse B - Rack 1', true),
    (p_tenant_id, v_brand_ebco, 'Telescopic Channel 18" - Ebco', 'HW-EBC-TEL-18', 'Ebco economy telescopic channel, 18 inch', 'Hardware - Channels', 'hardware', 'pair', 100, 30, 50, 350, 480, 350, 420, 480, 20.00, v_rev_hw, false, v_vendor_sharma_hardware, 'Warehouse B - Rack 2', true),
    (p_tenant_id, v_brand_hettich, 'Corner Carousel Unit - Hettich', 'HW-HET-CCU', 'Hettich Le Mans corner unit for L-shaped kitchen', 'Hardware - Kitchen', 'hardware', 'set', 8, 3, 5, 12000, 16000, 12000, 15000, 16000, 25.00, v_rev_hw, false, v_vendor_sharma_hardware, 'Warehouse B - Rack 5', true);
    
    -- LAMINATES (Merino brand from City Laminates)
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, v_brand_merino, 'Laminate Natural Oak - Merino', 'LAM-MER-NOK', 'Merino 1mm decorative laminate, natural oak, 8x4 ft', 'Laminates - Wood Grain', 'raw_material', 'sheet', 30, 10, 20, 1400, 1800, 1400, 1680, 1800, 20.00, v_rev_lam, false, v_vendor_city_laminates, 'Warehouse A - Section 3', true),
    (p_tenant_id, v_brand_merino, 'Laminate White Gloss - Merino', 'LAM-MER-WHG', 'Merino high gloss white solid laminate, 8x4 ft', 'Laminates - Solid', 'raw_material', 'sheet', 40, 15, 25, 1200, 1550, 1200, 1440, 1550, 20.00, v_rev_lam, false, v_vendor_city_laminates, 'Warehouse A - Section 3', true),
    (p_tenant_id, v_brand_greenlam, 'Laminate Walnut Dark - Greenlam', 'LAM-GRL-WDK', 'Greenlam dark walnut laminate, 8x4 ft', 'Laminates - Wood Grain', 'raw_material', 'sheet', 25, 10, 15, 1450, 1850, 1450, 1740, 1850, 20.00, v_rev_lam, false, v_vendor_city_laminates, 'Warehouse A - Section 3', true),
    (p_tenant_id, v_brand_merino, 'Acrylic Laminate White - Merino', 'LAM-MER-AC-WHT', 'Merino Acrylam high gloss acrylic, white, 8x4 ft', 'Laminates - Acrylic', 'raw_material', 'sheet', 15, 5, 10, 3800, 4800, 3800, 4560, 4800, 20.00, v_rev_lam, false, v_vendor_city_laminates, 'Warehouse A - Section 3', true);
    
    -- PAINTS (Asian Paints from Paint House)
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, v_brand_asian_paints, 'Wood Primer - Asian Paints', 'PNT-AP-PRM', 'Asian Paints wood primer, white, 4 litre', 'Paints - Primer', 'consumable', 'can', 25, 10, 15, 850, 1100, 850, 980, 1100, 15.29, v_rev_paint, false, v_vendor_paint_house, 'Warehouse C - Section 1', true),
    (p_tenant_id, v_brand_asian_paints, 'PU Clear Matt - Asian Paints', 'PNT-AP-PU-CLM', 'Asian Paints Woodtech PU clear matt, 4 litre', 'Paints - PU', 'consumable', 'can', 15, 5, 10, 2800, 3600, 2800, 3220, 3600, 15.00, v_rev_paint, false, v_vendor_paint_house, 'Warehouse C - Section 1', true),
    (p_tenant_id, v_brand_berger, 'Wood Stain Walnut - Berger', 'PNT-BG-STN-WAL', 'Berger wood stain, walnut shade, 1 litre', 'Paints - Stain', 'consumable', 'can', 18, 6, 12, 600, 800, 600, 690, 800, 15.00, v_rev_paint, false, v_vendor_paint_house, 'Warehouse C - Section 1', true);
    
    -- ADHESIVES (Fevicol from Krishna Ply)
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, v_brand_fevicol, 'Fevicol SH', 'ADH-FEV-SH', 'Fevicol SH synthetic resin adhesive, 50 kg drum', 'Adhesives', 'consumable', 'drum', 8, 3, 5, 4500, 5500, 4500, 5175, 5500, 15.00, NULL, false, v_vendor_krishna_ply, 'Warehouse C - Section 2', true),
    (p_tenant_id, v_brand_fevicol, 'Fevicol Marine', 'ADH-FEV-MR', 'Fevicol Marine waterproof adhesive, 20 kg', 'Adhesives', 'consumable', 'bucket', 6, 2, 4, 3200, 4000, 3200, 3680, 4000, 15.00, NULL, false, v_vendor_krishna_ply, 'Warehouse C - Section 2', true);
    
    -- GLASS (Saint-Gobain from Glass World)
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, v_brand_saint_gobain, 'Clear Float Glass 5mm - Saint-Gobain', 'GLS-SG-CLR-05', 'Saint-Gobain clear float glass 5mm, per sqft', 'Glass - Clear', 'raw_material', 'sqft', 500, 100, 200, 90, 130, 90, 110, 130, 22.22, v_rev_glass, false, v_vendor_glass_world, 'Warehouse D - Section 1', true),
    (p_tenant_id, v_brand_saint_gobain, 'Toughened Glass 10mm - Saint-Gobain', 'GLS-SG-TGH-10', 'Saint-Gobain Planidur tempered glass 10mm, per sqft', 'Glass - Toughened', 'raw_material', 'sqft', 200, 50, 100, 300, 400, 300, 370, 400, 23.33, v_rev_glass, false, v_vendor_glass_world, 'Warehouse D - Section 1', true),
    (p_tenant_id, v_brand_asahi, 'Lacquered Glass White - AIS', 'GLS-AIS-LAC-WHT', 'AIS Décor back painted white glass, per sqft', 'Glass - Lacquered', 'raw_material', 'sqft', 100, 30, 50, 180, 250, 180, 220, 250, 22.22, v_rev_glass, false, v_vendor_glass_world, 'Warehouse D - Section 2', true),
    (p_tenant_id, v_brand_saint_gobain, 'Mirror Clear 4mm - Saint-Gobain', 'GLS-SG-MIR-04', 'Saint-Gobain silver mirror 4mm, per sqft', 'Glass - Mirror', 'raw_material', 'sqft', 200, 50, 100, 100, 150, 100, 122, 150, 22.00, v_rev_glass, false, v_vendor_glass_world, 'Warehouse D - Section 3', true);
    
    -- FABRICS (D'Decor from Decor Fabrics)
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, v_brand_ddecor, 'Upholstery Linen Grey - D''Decor', 'FAB-DD-UPH-LGR', 'D''Decor premium linen blend upholstery, grey, per mtr', 'Fabrics - Upholstery', 'raw_material', 'mtr', 80, 20, 40, 700, 950, 700, 840, 950, 20.00, NULL, false, v_vendor_decor_fabrics, 'Warehouse E - Section 1', true),
    (p_tenant_id, v_brand_ddecor, 'Blackout Curtain - D''Decor', 'FAB-DD-CUR-BLK', 'D''Decor blackout curtain fabric, per mtr', 'Fabrics - Curtains', 'raw_material', 'mtr', 100, 30, 50, 500, 700, 500, 600, 700, 20.00, NULL, false, v_vendor_decor_fabrics, 'Warehouse E - Section 2', true);
    
    -- STONE (Pokarna from Stone Mart)
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, v_brand_pokarna, 'Quartz Calacatta White - Quantra', 'STN-QNT-CAL', 'Quantra (Pokarna) engineered quartz, calacatta, per sqft', 'Stone - Quartz', 'raw_material', 'sqft', 100, 25, 50, 550, 750, 550, 660, 750, 20.00, v_rev_stone, false, v_vendor_stone_mart, 'Warehouse F - Section 1', true),
    (p_tenant_id, v_brand_pokarna, 'Quartz Pure White - Quantra', 'STN-QNT-PWH', 'Quantra (Pokarna) pure white quartz, per sqft', 'Stone - Quartz', 'raw_material', 'sqft', 120, 30, 60, 450, 620, 450, 540, 620, 20.00, v_rev_stone, false, v_vendor_stone_mart, 'Warehouse F - Section 1', true);
    
    -- ELECTRICAL (Havells, Philips from Electric Plaza) - These earn lighting commission
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, commission_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, v_brand_philips, 'LED Strip Warm White - Philips', 'ELC-PH-LED-WWH', 'Philips LED strip 12V, warm white 3000K, per mtr', 'Electrical - LED', 'accessory', 'mtr', 100, 25, 50, 150, 220, 150, 220, 220, NULL, 31.82, v_rev_light, true, v_vendor_electric_plaza, 'Warehouse G - Section 1', true),
    (p_tenant_id, v_brand_havells, 'Modular Switch 6A - Havells', 'ELC-HV-SWT-06A', 'Havells Pearlz modular switch 6A', 'Electrical - Switches', 'accessory', 'pcs', 100, 30, 50, 95, 140, 95, 140, 140, NULL, 32.14, v_rev_light, true, v_vendor_electric_plaza, 'Warehouse G - Section 4', true),
    (p_tenant_id, v_brand_havells, 'USB Charging Module - Havells', 'ELC-HV-USB-2P', 'Havells dual USB charging module 2.1A', 'Electrical - Switches', 'accessory', 'pcs', 40, 10, 20, 400, 550, 400, 550, 550, NULL, 27.27, v_rev_light, true, v_vendor_electric_plaza, 'Warehouse G - Section 4', true);
    
    -- =========================================================================
    -- KITCHEN APPLIANCES (Commission Items - Sell at MRP, earn commission)
    -- These are NOT marked up. Customer pays MRP, we earn the dealer margin.
    -- vendor_cost = dealer price | company_cost = MRP | retail_price = MRP
    -- is_commission_item = true | commission_percent = calculated
    -- =========================================================================
    
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, commission_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active) VALUES
    -- Chimneys (High-value commission items)
    (p_tenant_id, v_brand_faber, 'Kitchen Chimney 90cm - Faber Hood Zenith', 'APP-FAB-CHM-90', 'Faber Hood Zenith 90cm wall mounted chimney, 1200 m³/hr', 'Appliances - Chimney', 'accessory', 'pcs', 5, 2, 3, 32000, 45000, 32000, 45000, 45000, NULL, 28.89, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true),
    (p_tenant_id, v_brand_elica, 'Kitchen Chimney 90cm - Elica WDFL 906', 'APP-ELC-CHM-90', 'Elica WDFL 906 HAC MS NERO, auto-clean, 1200 m³/hr', 'Appliances - Chimney', 'accessory', 'pcs', 4, 2, 2, 38000, 52000, 38000, 52000, 52000, NULL, 26.92, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true),
    (p_tenant_id, v_brand_bosch, 'Kitchen Chimney 90cm - Bosch DWB098D50I', 'APP-BSH-CHM-90', 'Bosch Serie 4 wall mounted chimney, 867 m³/hr', 'Appliances - Chimney', 'accessory', 'pcs', 3, 1, 2, 45000, 58000, 45000, 58000, 58000, NULL, 22.41, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true),
    (p_tenant_id, v_brand_kaff, 'Kitchen Chimney 60cm - Kaff Opec BF 60', 'APP-KAF-CHM-60', 'Kaff Opec BF 60cm chimney, 1180 m³/hr, baffle filter', 'Appliances - Chimney', 'accessory', 'pcs', 6, 2, 4, 18000, 26000, 18000, 26000, 26000, NULL, 30.77, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true),
    
    -- Hobs (Built-in cooktops)
    (p_tenant_id, v_brand_faber, 'Built-in Hob 4 Burner - Faber Maxus', 'APP-FAB-HOB-4B', 'Faber Maxus HT604 CRS BR CI, 4 burner glass hob', 'Appliances - Hob', 'accessory', 'pcs', 4, 2, 3, 22000, 32000, 22000, 32000, 32000, NULL, 31.25, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true),
    (p_tenant_id, v_brand_elica, 'Built-in Hob 3 Burner - Elica Flexi', 'APP-ELC-HOB-3B', 'Elica Flexi FB MFC 3B 70 DX, 3 burner with flexi zone', 'Appliances - Hob', 'accessory', 'pcs', 3, 1, 2, 28000, 38000, 28000, 38000, 38000, NULL, 26.32, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true),
    (p_tenant_id, v_brand_bosch, 'Built-in Hob 4 Burner - Bosch PBH6B5B60I', 'APP-BSH-HOB-4B', 'Bosch Serie 2 tempered glass hob, 4 burner', 'Appliances - Hob', 'accessory', 'pcs', 3, 1, 2, 25000, 35000, 25000, 35000, 35000, NULL, 28.57, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true),
    (p_tenant_id, v_brand_kaff, 'Built-in Hob 4 Burner - Kaff NB 604', 'APP-KAF-HOB-4B', 'Kaff NB 604 BG, 4 brass burner glass hob', 'Appliances - Hob', 'accessory', 'pcs', 5, 2, 3, 12000, 18000, 12000, 18000, 18000, NULL, 33.33, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true),
    
    -- Built-in Ovens
    (p_tenant_id, v_brand_bosch, 'Built-in Oven 60cm - Bosch HBF011BR0Z', 'APP-BSH-OVN-60', 'Bosch Serie 2 built-in oven, 66L, 5 heating modes', 'Appliances - Oven', 'accessory', 'pcs', 2, 1, 2, 35000, 48000, 35000, 48000, 48000, NULL, 27.08, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true),
    (p_tenant_id, v_brand_faber, 'Built-in Oven 60cm - Faber FBIO 80L', 'APP-FAB-OVN-60', 'Faber FBIO 80L 6F built-in oven, 80L capacity', 'Appliances - Oven', 'accessory', 'pcs', 2, 1, 2, 42000, 56000, 42000, 56000, 56000, NULL, 25.00, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true),
    
    -- Sinks
    (p_tenant_id, v_brand_kaff, 'Kitchen Sink Double Bowl - Kaff KS 45x20', 'APP-KAF-SNK-DB', 'Kaff stainless steel double bowl sink 45x20 inch', 'Appliances - Sink', 'accessory', 'pcs', 6, 2, 4, 8500, 12500, 8500, 12500, 12500, NULL, 32.00, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true);

    -- =========================================================================
    -- STEP 5: ADD VENDOR PRICING (Same material, different vendors, different prices)
    -- =========================================================================
    
    -- Krishna Ply prices for plywood
    INSERT INTO stock_vendor_materials (tenant_id, vendor_id, material_id, unit_price, min_order_qty, lead_time_days, is_preferred, is_active) VALUES
    (p_tenant_id, v_vendor_krishna_ply, v_mat_ply_bwp_18, 2800, 5, 3, true, true),
    (p_tenant_id, v_vendor_krishna_ply, v_mat_ply_mr_18, 1800, 5, 3, true, true);
    
    -- Sharma Hardware prices for Hettich
    INSERT INTO stock_vendor_materials (tenant_id, vendor_id, material_id, unit_price, min_order_qty, lead_time_days, is_preferred, is_active) VALUES
    (p_tenant_id, v_vendor_sharma_hardware, v_mat_hinge_sc, 220, 10, 5, true, true),
    (p_tenant_id, v_vendor_sharma_hardware, v_mat_channel_18, 550, 10, 5, true, true);

    RETURN 'Stock data v2 seeded successfully for tenant: ' || p_tenant_id::TEXT || 
           '. Created: 20 brands (incl. appliances), 9 vendors, ~42 materials with full pricing tiers (vendor_cost, company_cost, retail_price, markup_percent, commission_percent).';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HOW TO USE THIS SCRIPT
-- ============================================================================
-- 
-- 1. First run 022_stock_module_schema.sql
-- 2. Then run 024_brands_and_vendor_pricing.sql
-- 3. Then run 026_pricing_and_revenue_heads.sql
-- 4. Run this file to create the seed function
-- 5. Get your tenant_id: SELECT id, company_name FROM tenants;
-- 6. Seed revenue heads first: SELECT seed_revenue_heads('your-tenant-uuid-here');
-- 7. Then seed stock data: SELECT seed_stock_data_v2('your-tenant-uuid-here');
-- 
-- To verify pricing tiers:
-- SELECT 
--   name, 
--   vendor_cost, 
--   company_cost, 
--   retail_price, 
--   markup_percent,
--   CASE WHEN is_commission_item THEN 'Commission' ELSE 'Markup' END as pricing_model,
--   commission_percent
-- FROM stock_materials 
-- WHERE company_id = 'your-tenant-uuid'
-- ORDER BY category;
--
-- To see appliance commissions:
-- SELECT 
--   name,
--   vendor_cost as "You Pay",
--   retail_price as "Customer Pays (MRP)",
--   (retail_price - vendor_cost) as "Your Commission",
--   commission_percent || '%' as "Commission %"
-- FROM stock_materials 
-- WHERE is_commission_item = true AND company_id = 'your-tenant-uuid';
--
-- To calculate revenue breakdown by category:
-- SELECT 
--   rh.name as revenue_head,
--   COUNT(*) as item_count,
--   SUM(m.company_cost - m.vendor_cost) as potential_margin_per_unit
-- FROM stock_materials m
-- JOIN revenue_heads rh ON rh.id = m.revenue_head_id
-- WHERE m.company_id = 'your-tenant-uuid'
-- GROUP BY rh.name
-- ORDER BY potential_margin_per_unit DESC;
-- ============================================================================
