-- =====================================================
-- Brands & Vendor Pricing Schema
-- =====================================================
-- Adds proper Brand management and multi-vendor pricing
-- 
-- Industry standard model:
-- - Brands: Manufacturers (Century, Hettich, Greenlam, etc.)
-- - Vendors: Local dealers/distributors who sell to you
-- - A material belongs to a Brand
-- - Multiple Vendors can supply the same material at different prices
-- =====================================================

-- ============================================================================
-- SECTION 0: DROP EXISTING OBJECTS (for clean re-run)
-- ============================================================================

DROP VIEW IF EXISTS stock_material_best_prices CASCADE;
DROP TABLE IF EXISTS stock_vendor_brands CASCADE;
DROP TABLE IF EXISTS stock_vendor_materials CASCADE;
DROP TABLE IF EXISTS stock_brands CASCADE;

-- Drop indexes if they exist (will be recreated)
DROP INDEX IF EXISTS idx_stock_brands_tenant;
DROP INDEX IF EXISTS idx_stock_brands_active;
DROP INDEX IF EXISTS idx_stock_materials_brand;
DROP INDEX IF EXISTS idx_stock_vendor_materials_vendor;
DROP INDEX IF EXISTS idx_stock_vendor_materials_material;
DROP INDEX IF EXISTS idx_stock_vendor_materials_preferred;
DROP INDEX IF EXISTS idx_stock_vendor_brands_vendor;
DROP INDEX IF EXISTS idx_stock_vendor_brands_brand;

-- ============================================================================
-- SECTION 1: CREATE BRANDS TABLE
-- ============================================================================

CREATE TABLE stock_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    logo_url TEXT,
    website VARCHAR(255),
    country VARCHAR(100) DEFAULT 'India',
    description TEXT,
    -- Categories this brand deals in (for filtering)
    categories TEXT[],  -- ['Plywood', 'MDF', 'Laminates']
    quality_tier VARCHAR(20) DEFAULT 'standard' CHECK (quality_tier IN ('budget', 'standard', 'premium', 'luxury')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_stock_brands_tenant ON stock_brands(tenant_id);
CREATE INDEX idx_stock_brands_active ON stock_brands(tenant_id, is_active);

-- ============================================================================
-- SECTION 2: ADD brand_id TO MATERIALS
-- ============================================================================

-- Add brand_id column to stock_materials (IF NOT EXISTS handles re-runs)
ALTER TABLE stock_materials 
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES stock_brands(id) ON DELETE SET NULL;

-- Create index for brand lookups
CREATE INDEX IF NOT EXISTS idx_stock_materials_brand ON stock_materials(brand_id);

-- ============================================================================
-- SECTION 3: VENDOR-MATERIAL PRICING TABLE (Many-to-Many with pricing)
-- ============================================================================

-- This table allows multiple vendors to supply the same material at different prices
CREATE TABLE stock_vendor_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES stock_vendors(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES stock_materials(id) ON DELETE CASCADE,
    
    -- Vendor-specific details
    vendor_sku VARCHAR(100),           -- Vendor's own SKU/code for this item
    vendor_item_name VARCHAR(255),     -- Vendor's name for this item (if different)
    
    -- Pricing
    unit_price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    price_valid_from DATE,
    price_valid_to DATE,
    
    -- Ordering details
    min_order_qty DECIMAL(12,2) DEFAULT 1,
    lead_time_days INTEGER DEFAULT 7,
    
    -- Status
    is_preferred BOOLEAN DEFAULT false,  -- Is this the preferred vendor for this material?
    is_active BOOLEAN DEFAULT true,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Each vendor can have only one active price per material
    UNIQUE(vendor_id, material_id)
);

CREATE INDEX idx_stock_vendor_materials_vendor ON stock_vendor_materials(vendor_id);
CREATE INDEX idx_stock_vendor_materials_material ON stock_vendor_materials(material_id);
CREATE INDEX idx_stock_vendor_materials_preferred ON stock_vendor_materials(material_id, is_preferred) WHERE is_preferred = true;

-- ============================================================================
-- SECTION 4: VENDOR-BRAND RELATIONSHIP (Which brands does a vendor supply?)
-- ============================================================================

CREATE TABLE stock_vendor_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES stock_vendors(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES stock_brands(id) ON DELETE CASCADE,
    
    is_authorized_dealer BOOLEAN DEFAULT false,  -- Is this vendor an authorized dealer?
    discount_percent DECIMAL(5,2) DEFAULT 0,     -- Standard discount from this vendor for this brand
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(vendor_id, brand_id)
);

CREATE INDEX idx_stock_vendor_brands_vendor ON stock_vendor_brands(vendor_id);
CREATE INDEX idx_stock_vendor_brands_brand ON stock_vendor_brands(brand_id);

-- ============================================================================
-- SECTION 5: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE stock_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_vendor_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_vendor_brands ENABLE ROW LEVEL SECURITY;

-- RLS for brands
CREATE POLICY "Users can view brands in their tenant" ON stock_brands
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
    
CREATE POLICY "Users can manage brands in their tenant" ON stock_brands
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- RLS for vendor materials
CREATE POLICY "Users can view vendor materials in their tenant" ON stock_vendor_materials
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
    
CREATE POLICY "Users can manage vendor materials in their tenant" ON stock_vendor_materials
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- RLS for vendor brands
CREATE POLICY "Users can view vendor brands in their tenant" ON stock_vendor_brands
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
    
CREATE POLICY "Users can manage vendor brands in their tenant" ON stock_vendor_brands
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- SECTION 6: TRIGGERS
-- ============================================================================

-- Update timestamp trigger for brands
DROP TRIGGER IF EXISTS update_stock_brands_updated_at ON stock_brands;
CREATE TRIGGER update_stock_brands_updated_at
    BEFORE UPDATE ON stock_brands
    FOR EACH ROW EXECUTE FUNCTION update_stock_updated_at();

-- Update timestamp trigger for vendor materials
DROP TRIGGER IF EXISTS update_stock_vendor_materials_updated_at ON stock_vendor_materials;
CREATE TRIGGER update_stock_vendor_materials_updated_at
    BEFORE UPDATE ON stock_vendor_materials
    FOR EACH ROW EXECUTE FUNCTION update_stock_updated_at();

-- ============================================================================
-- SECTION 7: HELPER VIEW - Get best price for each material
-- ============================================================================

CREATE OR REPLACE VIEW stock_material_best_prices AS
SELECT DISTINCT ON (material_id)
    material_id,
    vendor_id,
    unit_price as best_price,
    lead_time_days,
    min_order_qty
FROM stock_vendor_materials
WHERE is_active = true
ORDER BY material_id, unit_price ASC;

-- ============================================================================
-- SECTION 8: COMMENTS
-- ============================================================================

COMMENT ON TABLE stock_brands IS 'Master list of manufacturers/brands (Century, Hettich, etc.)';
COMMENT ON TABLE stock_vendor_materials IS 'Pricing from each vendor for materials they supply';
COMMENT ON TABLE stock_vendor_brands IS 'Which brands each vendor is authorized to supply';
COMMENT ON COLUMN stock_vendor_materials.is_preferred IS 'True if this vendor is the default/preferred supplier for this material';
COMMENT ON COLUMN stock_vendor_brands.is_authorized_dealer IS 'True if vendor is an official authorized dealer for this brand';
