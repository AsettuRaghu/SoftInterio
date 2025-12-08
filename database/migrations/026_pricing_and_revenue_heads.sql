-- =====================================================
-- Pricing Tiers & Revenue Classification
-- =====================================================
-- Implements:
-- 1. Multi-tier pricing (Vendor Cost → Company Cost → Retail/MRP)
-- 2. Revenue heads for tracking different income streams
-- 3. Commission tracking for appliances/referrals
-- =====================================================

-- ============================================================================
-- SECTION 0: DROP EXISTING OBJECTS (for clean re-run)
-- ============================================================================

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS commission_items CASCADE;
DROP TABLE IF EXISTS pricing_rules CASCADE;
DROP TABLE IF EXISTS revenue_heads CASCADE;

-- Drop indexes
DROP INDEX IF EXISTS idx_revenue_heads_tenant;
DROP INDEX IF EXISTS idx_revenue_heads_category;
DROP INDEX IF EXISTS idx_pricing_rules_tenant;
DROP INDEX IF EXISTS idx_pricing_rules_category;
DROP INDEX IF EXISTS idx_commission_items_tenant;
DROP INDEX IF EXISTS idx_commission_items_quotation;
DROP INDEX IF EXISTS idx_commission_items_status;

-- Drop functions (will be recreated)
DROP FUNCTION IF EXISTS calculate_company_cost(DECIMAL, DECIMAL, DECIMAL);
DROP FUNCTION IF EXISTS calculate_commission(DECIMAL, DECIMAL);
DROP FUNCTION IF EXISTS get_material_markup(UUID, UUID);
DROP FUNCTION IF EXISTS seed_revenue_heads(UUID);
DROP FUNCTION IF EXISTS seed_pricing_rules(UUID);

-- ============================================================================
-- SECTION 1: REVENUE HEADS (Categories of income)
-- ============================================================================

CREATE TABLE revenue_heads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Classification
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'design_fee',           -- Design consultation fees
        'material_margin',      -- Margin on materials (ply, hardware, etc.)
        'execution_margin',     -- Margin on labor/execution
        'appliance_commission', -- Commission on appliances sold
        'lighting_commission',  -- Commission on lighting products
        'referral_commission',  -- Referral fees from partners
        'service_charge',       -- Service/handling charges
        'other'                 -- Other revenue
    )),
    
    -- Accounting
    gl_account_code VARCHAR(50),  -- General Ledger account code (for accounting software integration)
    tax_applicable BOOLEAN DEFAULT true,
    default_tax_rate DECIMAL(5,2) DEFAULT 18.00,  -- GST rate
    
    -- Display
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_revenue_heads_tenant ON revenue_heads(tenant_id);
CREATE INDEX idx_revenue_heads_category ON revenue_heads(tenant_id, category);

-- ============================================================================
-- SECTION 2: ADD PRICING COLUMNS TO MATERIALS
-- ============================================================================

-- Add new pricing columns to stock_materials
ALTER TABLE stock_materials 
ADD COLUMN IF NOT EXISTS vendor_cost DECIMAL(12,2),           -- What you pay to vendor
ADD COLUMN IF NOT EXISTS company_cost DECIMAL(12,2),          -- Internal rate for quotations (with markup)
ADD COLUMN IF NOT EXISTS retail_price DECIMAL(12,2),          -- MRP / Market price
ADD COLUMN IF NOT EXISTS markup_percent DECIMAL(5,2),         -- Markup % over vendor cost
ADD COLUMN IF NOT EXISTS markup_amount DECIMAL(12,2),         -- Fixed markup amount (alternative to %)
ADD COLUMN IF NOT EXISTS revenue_head_id UUID REFERENCES revenue_heads(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_commission_item BOOLEAN DEFAULT false,  -- True for appliances/lighting where you earn commission
ADD COLUMN IF NOT EXISTS commission_percent DECIMAL(5,2);     -- Commission % for appliances

-- Migrate existing data: vendor_cost = unit_cost, company_cost = selling_price
UPDATE stock_materials 
SET vendor_cost = unit_cost,
    company_cost = COALESCE(selling_price, unit_cost * 1.15),  -- Default 15% markup if no selling price
    retail_price = selling_price
WHERE vendor_cost IS NULL;

COMMENT ON COLUMN stock_materials.vendor_cost IS 'Cost price from vendor/dealer';
COMMENT ON COLUMN stock_materials.company_cost IS 'Internal cost used in quotations (includes markup)';
COMMENT ON COLUMN stock_materials.retail_price IS 'MRP or market reference price';
COMMENT ON COLUMN stock_materials.markup_percent IS 'Percentage markup over vendor cost';
COMMENT ON COLUMN stock_materials.is_commission_item IS 'True for items where revenue is commission-based (appliances, lighting)';

-- ============================================================================
-- SECTION 3: PRICING RULES TABLE (For automatic markup calculation)
-- ============================================================================

CREATE TABLE pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Rule matching criteria (any of these can be used)
    category_pattern VARCHAR(100),    -- Match by category (e.g., 'Plywood%', 'Hardware%')
    brand_id UUID REFERENCES stock_brands(id) ON DELETE CASCADE,
    item_type VARCHAR(50),            -- Match by item_type
    
    -- Markup configuration
    markup_type VARCHAR(20) NOT NULL CHECK (markup_type IN ('percentage', 'fixed', 'tiered')),
    markup_value DECIMAL(12,2),       -- Percentage or fixed amount
    
    -- Tiered pricing (for volume-based markup)
    tier_ranges JSONB,  -- [{"min": 0, "max": 10000, "markup": 20}, {"min": 10001, "max": 50000, "markup": 15}]
    
    -- Revenue classification
    revenue_head_id UUID REFERENCES revenue_heads(id) ON DELETE SET NULL,
    
    -- Priority (higher = checked first)
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pricing_rules_tenant ON pricing_rules(tenant_id);
CREATE INDEX idx_pricing_rules_category ON pricing_rules(category_pattern);

-- ============================================================================
-- SECTION 4: COMMISSION TRACKING TABLE (For appliances/referrals)
-- ============================================================================

CREATE TABLE commission_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Link to quotation/project
    quotation_id UUID,  -- REFERENCES quotations(id) - add FK after quotations table exists
    project_id UUID,    -- REFERENCES projects(id) - add FK after projects table exists
    
    -- Item details
    material_id UUID REFERENCES stock_materials(id) ON DELETE SET NULL,
    item_name VARCHAR(255) NOT NULL,
    brand_id UUID REFERENCES stock_brands(id) ON DELETE SET NULL,
    vendor_id UUID REFERENCES stock_vendors(id) ON DELETE SET NULL,
    
    -- Pricing
    quantity DECIMAL(12,2) DEFAULT 1,
    unit VARCHAR(50) DEFAULT 'pcs',
    vendor_cost DECIMAL(12,2) NOT NULL,      -- What you pay
    selling_price DECIMAL(12,2) NOT NULL,    -- What customer pays (usually MRP)
    commission_amount DECIMAL(12,2) NOT NULL, -- Your commission = selling_price - vendor_cost
    commission_percent DECIMAL(5,2),
    
    -- Revenue classification
    revenue_head_id UUID REFERENCES revenue_heads(id) ON DELETE SET NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sold', 'delivered', 'paid', 'cancelled')),
    sale_date DATE,
    payment_received_date DATE,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_commission_items_tenant ON commission_items(tenant_id);
CREATE INDEX idx_commission_items_quotation ON commission_items(quotation_id);
CREATE INDEX idx_commission_items_status ON commission_items(status);

-- ============================================================================
-- SECTION 5: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE revenue_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_items ENABLE ROW LEVEL SECURITY;

-- Revenue heads policies
CREATE POLICY "Users can view revenue heads in their tenant" ON revenue_heads
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can manage revenue heads in their tenant" ON revenue_heads
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Pricing rules policies
CREATE POLICY "Users can view pricing rules in their tenant" ON pricing_rules
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can manage pricing rules in their tenant" ON pricing_rules
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Commission items policies
CREATE POLICY "Users can view commission items in their tenant" ON commission_items
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can manage commission items in their tenant" ON commission_items
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- SECTION 6: HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate company cost from vendor cost using markup
CREATE OR REPLACE FUNCTION calculate_company_cost(
    p_vendor_cost DECIMAL,
    p_markup_percent DECIMAL DEFAULT NULL,
    p_markup_amount DECIMAL DEFAULT NULL
) RETURNS DECIMAL AS $$
BEGIN
    IF p_markup_percent IS NOT NULL THEN
        RETURN p_vendor_cost * (1 + p_markup_percent / 100);
    ELSIF p_markup_amount IS NOT NULL THEN
        RETURN p_vendor_cost + p_markup_amount;
    ELSE
        -- Default 15% markup
        RETURN p_vendor_cost * 1.15;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate commission
CREATE OR REPLACE FUNCTION calculate_commission(
    p_selling_price DECIMAL,
    p_vendor_cost DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
    RETURN p_selling_price - p_vendor_cost;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get applicable markup for a material
CREATE OR REPLACE FUNCTION get_material_markup(
    p_tenant_id UUID,
    p_material_id UUID
) RETURNS TABLE(
    markup_type VARCHAR,
    markup_value DECIMAL,
    revenue_head_id UUID,
    revenue_head_name VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    WITH material_info AS (
        SELECT m.category, m.item_type, m.brand_id
        FROM stock_materials m
        WHERE m.id = p_material_id
    )
    SELECT 
        pr.markup_type,
        pr.markup_value,
        pr.revenue_head_id,
        rh.name as revenue_head_name
    FROM pricing_rules pr
    LEFT JOIN revenue_heads rh ON rh.id = pr.revenue_head_id
    CROSS JOIN material_info mi
    WHERE pr.tenant_id = p_tenant_id
      AND pr.is_active = true
      AND (
          pr.category_pattern IS NULL 
          OR mi.category ILIKE pr.category_pattern
      )
      AND (
          pr.item_type IS NULL 
          OR mi.item_type = pr.item_type
      )
      AND (
          pr.brand_id IS NULL 
          OR mi.brand_id = pr.brand_id
      )
    ORDER BY pr.priority DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 7: SEED DEFAULT REVENUE HEADS
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_revenue_heads(p_tenant_id UUID)
RETURNS TEXT AS $$
BEGIN
    -- Delete existing for this tenant
    DELETE FROM revenue_heads WHERE tenant_id = p_tenant_id;
    
    INSERT INTO revenue_heads (tenant_id, code, name, description, category, gl_account_code, display_order) VALUES
    -- Design Fees
    (p_tenant_id, 'REV-DESIGN', 'Design Consultation Fee', 'Revenue from design consultation and planning services', 'design_fee', '4001', 1),
    (p_tenant_id, 'REV-3D', '3D Visualization Fee', 'Revenue from 3D renders and visualization', 'design_fee', '4002', 2),
    
    -- Material Margins
    (p_tenant_id, 'REV-MAT-PLY', 'Material Margin - Plywood & MDF', 'Margin on plywood, MDF, block board sales', 'material_margin', '4101', 10),
    (p_tenant_id, 'REV-MAT-HW', 'Material Margin - Hardware', 'Margin on hinges, channels, fittings', 'material_margin', '4102', 11),
    (p_tenant_id, 'REV-MAT-LAM', 'Material Margin - Laminates', 'Margin on laminates, veneers, acrylic', 'material_margin', '4103', 12),
    (p_tenant_id, 'REV-MAT-PAINT', 'Material Margin - Paints & Finishes', 'Margin on paints, PU, stains', 'material_margin', '4104', 13),
    (p_tenant_id, 'REV-MAT-GLASS', 'Material Margin - Glass & Mirror', 'Margin on glass, mirror, toughened glass', 'material_margin', '4105', 14),
    (p_tenant_id, 'REV-MAT-STONE', 'Material Margin - Stone & Quartz', 'Margin on quartz, granite, marble', 'material_margin', '4106', 15),
    (p_tenant_id, 'REV-MAT-OTHER', 'Material Margin - Other', 'Margin on other materials', 'material_margin', '4199', 19),
    
    -- Execution/Labor
    (p_tenant_id, 'REV-EXEC', 'Execution Margin', 'Margin on carpentry and installation labor', 'execution_margin', '4201', 20),
    (p_tenant_id, 'REV-SITE', 'Site Supervision', 'Site supervision and project management fees', 'execution_margin', '4202', 21),
    
    -- Commissions (Appliances, Lighting)
    (p_tenant_id, 'REV-COMM-APP', 'Appliance Commission', 'Commission on kitchen appliances (chimney, hob, oven, etc.)', 'appliance_commission', '4301', 30),
    (p_tenant_id, 'REV-COMM-LIGHT', 'Lighting Commission', 'Commission on lighting products (fixtures, LEDs, etc.)', 'lighting_commission', '4302', 31),
    (p_tenant_id, 'REV-COMM-SANITARY', 'Sanitary Commission', 'Commission on sanitary ware and bathroom fittings', 'appliance_commission', '4303', 32),
    (p_tenant_id, 'REV-COMM-ELEC', 'Electrical Commission', 'Commission on electrical items (fans, switches, etc.)', 'appliance_commission', '4304', 33),
    
    -- Referral/Partner
    (p_tenant_id, 'REV-REF', 'Referral Commission', 'Commission from partner referrals (AC, false ceiling, etc.)', 'referral_commission', '4401', 40),
    
    -- Service Charges
    (p_tenant_id, 'REV-SVC-HANDLING', 'Handling Charges', 'Material handling and logistics charges', 'service_charge', '4501', 50),
    (p_tenant_id, 'REV-SVC-WARRANTY', 'Extended Warranty', 'Extended warranty service fees', 'service_charge', '4502', 51);
    
    RETURN 'Seeded ' || (SELECT COUNT(*) FROM revenue_heads WHERE tenant_id = p_tenant_id) || ' revenue heads for tenant.';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 8: SEED DEFAULT PRICING RULES
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_pricing_rules(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_rev_ply UUID;
    v_rev_hw UUID;
    v_rev_lam UUID;
    v_rev_paint UUID;
    v_rev_glass UUID;
    v_rev_app UUID;
    v_rev_light UUID;
BEGIN
    -- Get revenue head IDs
    SELECT id INTO v_rev_ply FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-PLY';
    SELECT id INTO v_rev_hw FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-HW';
    SELECT id INTO v_rev_lam FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-LAM';
    SELECT id INTO v_rev_paint FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-PAINT';
    SELECT id INTO v_rev_glass FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-GLASS';
    SELECT id INTO v_rev_app FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-COMM-APP';
    SELECT id INTO v_rev_light FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-COMM-LIGHT';
    
    -- Delete existing rules for this tenant
    DELETE FROM pricing_rules WHERE tenant_id = p_tenant_id;
    
    INSERT INTO pricing_rules (tenant_id, name, description, category_pattern, item_type, markup_type, markup_value, revenue_head_id, priority) VALUES
    -- Material categories with standard markup
    (p_tenant_id, 'Plywood Markup', '18% markup on all plywood products', 'Plywood%', NULL, 'percentage', 18.00, v_rev_ply, 100),
    (p_tenant_id, 'MDF Markup', '15% markup on MDF boards', 'MDF%', NULL, 'percentage', 15.00, v_rev_ply, 99),
    (p_tenant_id, 'Hardware - Premium', '25% markup on premium hardware (Hettich, Hafele)', 'Hardware%', 'hardware', 'percentage', 25.00, v_rev_hw, 98),
    (p_tenant_id, 'Laminates Markup', '20% markup on laminates', 'Laminate%', NULL, 'percentage', 20.00, v_rev_lam, 97),
    (p_tenant_id, 'Paints Markup', '15% markup on paints and finishes', 'Paint%', NULL, 'percentage', 15.00, v_rev_paint, 96),
    (p_tenant_id, 'Glass Markup', '22% markup on glass and mirror', 'Glass%', NULL, 'percentage', 22.00, v_rev_glass, 95),
    
    -- Commission items (appliances, lighting) - these typically use MRP
    (p_tenant_id, 'Appliance Commission', 'Sell at MRP, track dealer margin as commission', 'Appliance%', NULL, 'percentage', 0.00, v_rev_app, 90),
    (p_tenant_id, 'Lighting Commission', 'Sell at MRP, track dealer margin as commission', 'Lighting%', NULL, 'percentage', 0.00, v_rev_light, 89),
    
    -- Default fallback
    (p_tenant_id, 'Default Markup', 'Default 15% markup for uncategorized items', '%', NULL, 'percentage', 15.00, NULL, 1);
    
    RETURN 'Seeded ' || (SELECT COUNT(*) FROM pricing_rules WHERE tenant_id = p_tenant_id) || ' pricing rules for tenant.';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================
-- 
-- 1. Run this migration in Supabase SQL Editor
-- 
-- 2. Seed revenue heads and pricing rules:
--    SELECT seed_revenue_heads('your-tenant-uuid');
--    SELECT seed_pricing_rules('your-tenant-uuid');
-- 
-- 3. View revenue heads:
--    SELECT code, name, category FROM revenue_heads ORDER BY display_order;
-- 
-- 4. View pricing rules:
--    SELECT name, category_pattern, markup_type, markup_value 
--    FROM pricing_rules ORDER BY priority DESC;
-- 
-- 5. Example: Calculate company cost for a material
--    SELECT 
--      m.name,
--      m.vendor_cost,
--      calculate_company_cost(m.vendor_cost, pr.markup_value) as company_cost,
--      pr.name as pricing_rule
--    FROM stock_materials m
--    JOIN pricing_rules pr ON m.category ILIKE pr.category_pattern
--    WHERE m.company_id = 'your-tenant-uuid'
--    ORDER BY pr.priority DESC;
--
-- ============================================================================
-- REVENUE TRACKING EXAMPLE
-- ============================================================================
--
-- When you create a quotation line item:
--
-- For MATERIALS (Plywood, Hardware):
--   revenue_per_unit = company_cost - vendor_cost
--   total_revenue = revenue_per_unit × quantity
--   revenue_head = 'REV-MAT-PLY' or 'REV-MAT-HW'
--
-- For APPLIANCES (Chimney at ₹45,000 MRP, you pay ₹38,000):
--   selling_price = 45000 (MRP)
--   vendor_cost = 38000 (your cost)
--   commission = 7000 (your earning)
--   revenue_head = 'REV-COMM-APP'
--
-- This allows you to generate reports like:
--   - Total material margin this month
--   - Total appliance commission this month
--   - Revenue breakdown by category
--
-- ============================================================================
