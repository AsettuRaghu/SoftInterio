-- ============================================================================
-- QUOTATION MODULE SCHEMA V2
-- Migration: 015_quotation_schema_v2.sql
-- 
-- Restructures the quotation module with:
-- - Flexible hierarchy: Space > Component > Type > Cost Item (all optional except cost item)
-- - Generic space types with custom naming per quotation
-- - Centralized cost items (anything with a price)
-- - Simple unit-based calculations
-- ============================================================================

-- ============================================================================
-- SECTION 1: UNITS TABLE (New)
-- Defines measurement units and their calculation types
-- ============================================================================

CREATE TABLE IF NOT EXISTS units (
    code VARCHAR(20) PRIMARY KEY,                  -- "sqft", "nos", "rft", "job"
    name VARCHAR(50) NOT NULL,                     -- "Square Feet", "Numbers", "Running Feet"
    calculation_type VARCHAR(20) NOT NULL,         -- "area", "length", "quantity", "fixed"
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default units
INSERT INTO units (code, name, calculation_type, description, display_order) VALUES
    ('sqft', 'Square Feet', 'area', 'Area calculation (Length × Width)', 1),
    ('sqm', 'Square Meters', 'area', 'Area calculation in metric (Length × Width)', 2),
    ('rft', 'Running Feet', 'length', 'Linear measurement', 3),
    ('rm', 'Running Meters', 'length', 'Linear measurement in metric', 4),
    ('nos', 'Numbers', 'quantity', 'Count/Quantity', 5),
    ('set', 'Set', 'quantity', 'Set of items', 6),
    ('kg', 'Kilograms', 'quantity', 'Weight measurement', 7),
    ('ltr', 'Liters', 'quantity', 'Volume measurement', 8),
    ('job', 'Lump Sum', 'fixed', 'Fixed price for a job', 9),
    ('lot', 'Lot', 'fixed', 'Fixed price for a lot', 10)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- SECTION 2: COST ITEM CATEGORIES (New)
-- Categories for organizing cost items
-- ============================================================================

CREATE TABLE IF NOT EXISTS cost_item_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,                    -- "Material", "Hardware", "Finish", "Labour", "Service"
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(20),                             -- For UI display
    
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, slug)
);

-- ============================================================================
-- SECTION 3: COST ITEMS (Replaces materials + cost_attribute_types)
-- Anything that has a price - materials, labour, services, hardware
-- ============================================================================

CREATE TABLE IF NOT EXISTS cost_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES cost_item_categories(id) ON DELETE SET NULL,
    
    name VARCHAR(200) NOT NULL,                    -- "HDHMR PreLam", "German Hinges", "Carpentry Labour"
    slug VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Pricing
    unit_code VARCHAR(20) NOT NULL REFERENCES units(code), -- "sqft", "nos", "job"
    default_rate DECIMAL(12,2) NOT NULL DEFAULT 0,         -- Default rate per unit
    
    -- Specifications (optional, for display)
    specifications JSONB,                          -- {"brand": "Hettich", "thickness": "18mm"}
    
    -- Quality tier for filtering
    quality_tier VARCHAR(20) DEFAULT 'standard',   -- "budget", "standard", "premium", "luxury"
    
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, slug)
);

-- ============================================================================
-- SECTION 4: COMPONENT TYPES (Variants - Optional level)
-- Variants of components (e.g., Sliding, Openable for Wardrobe)
-- ============================================================================

-- Note: component_types table already exists from 009, but we need to add relationship
-- We'll rename the concept: component_types remains as components
-- We add a new table for "types" (variants) of components

CREATE TABLE IF NOT EXISTS component_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    component_type_id UUID NOT NULL REFERENCES component_types(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,                    -- "Sliding", "Openable", "L-Shape"
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, component_type_id, slug)
);

-- ============================================================================
-- SECTION 5: TEMPLATE STRUCTURE (Redesigned)
-- ============================================================================

-- 5.1 Template Line Items (Replaces complex template_data JSONB)
-- Each line item represents a cost item with optional hierarchy context
CREATE TABLE IF NOT EXISTS template_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES quotation_templates(id) ON DELETE CASCADE,
    
    -- Flexible hierarchy (all optional except cost_item)
    space_type_id UUID REFERENCES space_types(id) ON DELETE SET NULL,
    component_type_id UUID REFERENCES component_types(id) ON DELETE SET NULL,
    component_variant_id UUID REFERENCES component_variants(id) ON DELETE SET NULL,
    cost_item_id UUID NOT NULL REFERENCES cost_items(id) ON DELETE CASCADE,
    
    -- Grouping label (for display, e.g., "Carcass", "Shutter", "Hardware")
    group_name VARCHAR(100),
    
    -- Rate (can override cost_item default)
    rate DECIMAL(12,2),                            -- NULL means use cost_item default_rate
    
    -- Ordering
    display_order INTEGER DEFAULT 0,
    
    -- Metadata
    notes TEXT,
    metadata JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5.2 Template Spaces (Pre-defined space instances in template)
-- Allows templates to have multiple instances of same space type
CREATE TABLE IF NOT EXISTS template_spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES quotation_templates(id) ON DELETE CASCADE,
    space_type_id UUID NOT NULL REFERENCES space_types(id) ON DELETE CASCADE,
    
    -- Default name (can be customized in quotation)
    default_name VARCHAR(100),                     -- "Master Bedroom", "Bedroom 2", NULL = use space_type name
    
    display_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 6: QUOTATION STRUCTURE UPDATES
-- ============================================================================

-- 6.1 Add presentation_level to quotations for controlling customer view
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS presentation_level VARCHAR(30) DEFAULT 'space_component';
-- Options: 'space_only', 'space_component', 'space_component_type', 'full_detail'

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS hide_dimensions BOOLEAN DEFAULT true;
-- Hide L×W details from customer

-- 6.2 Update quotation_spaces to support custom naming from generic space types
-- Already has 'name' field which can be customized

-- 6.3 Add variant reference to quotation_components
ALTER TABLE quotation_components ADD COLUMN IF NOT EXISTS component_variant_id UUID REFERENCES component_variants(id) ON DELETE SET NULL;

-- 6.4 Create new quotation_line_items table (simpler than material + cost_attributes)
CREATE TABLE IF NOT EXISTS quotation_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    
    -- Flexible hierarchy (all optional, for organization)
    quotation_space_id UUID REFERENCES quotation_spaces(id) ON DELETE CASCADE,
    quotation_component_id UUID REFERENCES quotation_components(id) ON DELETE CASCADE,
    
    -- The actual cost item
    cost_item_id UUID REFERENCES cost_items(id) ON DELETE SET NULL,
    
    -- Line item details (can be customized from cost_item defaults)
    name VARCHAR(200) NOT NULL,                    -- Display name
    group_name VARCHAR(100),                       -- "Carcass", "Shutter", "Hardware" (for grouping)
    
    -- Measurement inputs (based on unit type)
    length DECIMAL(10,2),                          -- For area or length calculations
    width DECIMAL(10,2),                           -- For area calculations
    quantity DECIMAL(10,2),                        -- For quantity-based items
    
    -- Pricing
    unit_code VARCHAR(20) NOT NULL REFERENCES units(code),
    rate DECIMAL(12,2) NOT NULL DEFAULT 0,
    amount DECIMAL(14,2) NOT NULL DEFAULT 0,       -- Calculated: (L×W) or Qty × Rate
    
    -- Ordering
    display_order INTEGER DEFAULT 0,
    
    -- Metadata
    notes TEXT,
    metadata JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 7: INDEXES
-- ============================================================================

-- Units
CREATE INDEX IF NOT EXISTS idx_units_active ON units(is_active, display_order);

-- Cost Item Categories
CREATE INDEX IF NOT EXISTS idx_cost_item_categories_tenant ON cost_item_categories(tenant_id, is_active);

-- Cost Items
CREATE INDEX IF NOT EXISTS idx_cost_items_tenant ON cost_items(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_cost_items_category ON cost_items(category_id);
CREATE INDEX IF NOT EXISTS idx_cost_items_unit ON cost_items(unit_code);

-- Component Variants
CREATE INDEX IF NOT EXISTS idx_component_variants_tenant ON component_variants(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_component_variants_component ON component_variants(component_type_id);

-- Template Line Items
CREATE INDEX IF NOT EXISTS idx_template_line_items_template ON template_line_items(template_id);
CREATE INDEX IF NOT EXISTS idx_template_line_items_space ON template_line_items(space_type_id);
CREATE INDEX IF NOT EXISTS idx_template_line_items_component ON template_line_items(component_type_id);

-- Template Spaces
CREATE INDEX IF NOT EXISTS idx_template_spaces_template ON template_spaces(template_id);

-- Quotation Line Items
CREATE INDEX IF NOT EXISTS idx_quotation_line_items_quotation ON quotation_line_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_line_items_space ON quotation_line_items(quotation_space_id);
CREATE INDEX IF NOT EXISTS idx_quotation_line_items_component ON quotation_line_items(quotation_component_id);

-- ============================================================================
-- SECTION 8: RLS POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE cost_item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE component_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_line_items ENABLE ROW LEVEL SECURITY;

-- Cost Item Categories policies
DROP POLICY IF EXISTS "Users can view cost item categories of their tenant" ON cost_item_categories;
CREATE POLICY "Users can view cost item categories of their tenant"
    ON cost_item_categories FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert cost item categories for their tenant" ON cost_item_categories;
CREATE POLICY "Users can insert cost item categories for their tenant"
    ON cost_item_categories FOR INSERT
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update cost item categories of their tenant" ON cost_item_categories;
CREATE POLICY "Users can update cost item categories of their tenant"
    ON cost_item_categories FOR UPDATE
    USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete cost item categories of their tenant" ON cost_item_categories;
CREATE POLICY "Users can delete cost item categories of their tenant"
    ON cost_item_categories FOR DELETE
    USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Cost Items policies
DROP POLICY IF EXISTS "Users can view cost items of their tenant" ON cost_items;
CREATE POLICY "Users can view cost items of their tenant"
    ON cost_items FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert cost items for their tenant" ON cost_items;
CREATE POLICY "Users can insert cost items for their tenant"
    ON cost_items FOR INSERT
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update cost items of their tenant" ON cost_items;
CREATE POLICY "Users can update cost items of their tenant"
    ON cost_items FOR UPDATE
    USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete cost items of their tenant" ON cost_items;
CREATE POLICY "Users can delete cost items of their tenant"
    ON cost_items FOR DELETE
    USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Component Variants policies
DROP POLICY IF EXISTS "Users can view component variants of their tenant" ON component_variants;
CREATE POLICY "Users can view component variants of their tenant"
    ON component_variants FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert component variants for their tenant" ON component_variants;
CREATE POLICY "Users can insert component variants for their tenant"
    ON component_variants FOR INSERT
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update component variants of their tenant" ON component_variants;
CREATE POLICY "Users can update component variants of their tenant"
    ON component_variants FOR UPDATE
    USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete component variants of their tenant" ON component_variants;
CREATE POLICY "Users can delete component variants of their tenant"
    ON component_variants FOR DELETE
    USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Template Line Items policies
DROP POLICY IF EXISTS "Users can view template line items of their tenant" ON template_line_items;
CREATE POLICY "Users can view template line items of their tenant"
    ON template_line_items FOR SELECT
    USING (template_id IN (
        SELECT id FROM quotation_templates 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can insert template line items for their tenant" ON template_line_items;
CREATE POLICY "Users can insert template line items for their tenant"
    ON template_line_items FOR INSERT
    WITH CHECK (template_id IN (
        SELECT id FROM quotation_templates 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can update template line items of their tenant" ON template_line_items;
CREATE POLICY "Users can update template line items of their tenant"
    ON template_line_items FOR UPDATE
    USING (template_id IN (
        SELECT id FROM quotation_templates 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can delete template line items of their tenant" ON template_line_items;
CREATE POLICY "Users can delete template line items of their tenant"
    ON template_line_items FOR DELETE
    USING (template_id IN (
        SELECT id FROM quotation_templates 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

-- Template Spaces policies
DROP POLICY IF EXISTS "Users can view template spaces of their tenant" ON template_spaces;
CREATE POLICY "Users can view template spaces of their tenant"
    ON template_spaces FOR SELECT
    USING (template_id IN (
        SELECT id FROM quotation_templates 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can insert template spaces for their tenant" ON template_spaces;
CREATE POLICY "Users can insert template spaces for their tenant"
    ON template_spaces FOR INSERT
    WITH CHECK (template_id IN (
        SELECT id FROM quotation_templates 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can update template spaces of their tenant" ON template_spaces;
CREATE POLICY "Users can update template spaces of their tenant"
    ON template_spaces FOR UPDATE
    USING (template_id IN (
        SELECT id FROM quotation_templates 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can delete template spaces of their tenant" ON template_spaces;
CREATE POLICY "Users can delete template spaces of their tenant"
    ON template_spaces FOR DELETE
    USING (template_id IN (
        SELECT id FROM quotation_templates 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

-- Quotation Line Items policies
DROP POLICY IF EXISTS "Users can view quotation line items of their tenant" ON quotation_line_items;
CREATE POLICY "Users can view quotation line items of their tenant"
    ON quotation_line_items FOR SELECT
    USING (quotation_id IN (
        SELECT id FROM quotations 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can insert quotation line items for their tenant" ON quotation_line_items;
CREATE POLICY "Users can insert quotation line items for their tenant"
    ON quotation_line_items FOR INSERT
    WITH CHECK (quotation_id IN (
        SELECT id FROM quotations 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can update quotation line items of their tenant" ON quotation_line_items;
CREATE POLICY "Users can update quotation line items of their tenant"
    ON quotation_line_items FOR UPDATE
    USING (quotation_id IN (
        SELECT id FROM quotations 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can delete quotation line items of their tenant" ON quotation_line_items;
CREATE POLICY "Users can delete quotation line items of their tenant"
    ON quotation_line_items FOR DELETE
    USING (quotation_id IN (
        SELECT id FROM quotations 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

-- ============================================================================
-- SECTION 9: TRIGGERS FOR AUTO-CALCULATIONS
-- ============================================================================

-- Function to calculate line item amount based on unit type
CREATE OR REPLACE FUNCTION calculate_line_item_amount()
RETURNS TRIGGER AS $$
DECLARE
    v_calc_type VARCHAR(20);
BEGIN
    -- Get calculation type from unit
    SELECT calculation_type INTO v_calc_type FROM units WHERE code = NEW.unit_code;
    
    -- Calculate amount based on calculation type
    CASE v_calc_type
        WHEN 'area' THEN
            NEW.amount := COALESCE(NEW.length, 0) * COALESCE(NEW.width, 0) * NEW.rate;
        WHEN 'length' THEN
            NEW.amount := COALESCE(NEW.length, 0) * NEW.rate;
        WHEN 'quantity' THEN
            NEW.amount := COALESCE(NEW.quantity, 0) * NEW.rate;
        WHEN 'fixed' THEN
            NEW.amount := NEW.rate;
        ELSE
            NEW.amount := COALESCE(NEW.quantity, 1) * NEW.rate;
    END CASE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calc_line_item_amount ON quotation_line_items;
CREATE TRIGGER trg_calc_line_item_amount
BEFORE INSERT OR UPDATE ON quotation_line_items
FOR EACH ROW EXECUTE FUNCTION calculate_line_item_amount();

-- Function to recalculate component subtotal from line items
CREATE OR REPLACE FUNCTION calculate_component_subtotal_v2()
RETURNS TRIGGER AS $$
BEGIN
    -- Update component subtotal
    IF NEW.quotation_component_id IS NOT NULL OR (TG_OP = 'DELETE' AND OLD.quotation_component_id IS NOT NULL) THEN
        UPDATE quotation_components
        SET subtotal = (
            SELECT COALESCE(SUM(amount), 0)
            FROM quotation_line_items
            WHERE quotation_component_id = COALESCE(NEW.quotation_component_id, OLD.quotation_component_id)
        ),
        updated_at = NOW()
        WHERE id = COALESCE(NEW.quotation_component_id, OLD.quotation_component_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_component_subtotal_v2 ON quotation_line_items;
CREATE TRIGGER trg_recalc_component_subtotal_v2
AFTER INSERT OR UPDATE OR DELETE ON quotation_line_items
FOR EACH ROW EXECUTE FUNCTION calculate_component_subtotal_v2();

-- Function to recalculate space subtotal from line items + components
CREATE OR REPLACE FUNCTION calculate_space_subtotal_v2()
RETURNS TRIGGER AS $$
BEGIN
    -- Update space subtotal from direct line items + component subtotals
    IF NEW.quotation_space_id IS NOT NULL OR (TG_OP = 'DELETE' AND OLD.quotation_space_id IS NOT NULL) THEN
        UPDATE quotation_spaces
        SET subtotal = (
            -- Line items directly under space (no component)
            SELECT COALESCE(SUM(amount), 0)
            FROM quotation_line_items
            WHERE quotation_space_id = COALESCE(NEW.quotation_space_id, OLD.quotation_space_id)
              AND quotation_component_id IS NULL
        ) + (
            -- Component subtotals
            SELECT COALESCE(SUM(subtotal), 0)
            FROM quotation_components
            WHERE space_id = COALESCE(NEW.quotation_space_id, OLD.quotation_space_id)
        ),
        updated_at = NOW()
        WHERE id = COALESCE(NEW.quotation_space_id, OLD.quotation_space_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_space_subtotal_v2 ON quotation_line_items;
CREATE TRIGGER trg_recalc_space_subtotal_v2
AFTER INSERT OR UPDATE OR DELETE ON quotation_line_items
FOR EACH ROW EXECUTE FUNCTION calculate_space_subtotal_v2();

-- ============================================================================
-- SECTION 10: COMMENTS
-- ============================================================================

COMMENT ON TABLE units IS 'Measurement units with calculation type (area, length, quantity, fixed)';
COMMENT ON TABLE cost_item_categories IS 'Categories for organizing cost items (Material, Hardware, Labour, etc.)';
COMMENT ON TABLE cost_items IS 'Anything with a price - materials, hardware, labour, services';
COMMENT ON TABLE component_variants IS 'Variants/types of components (e.g., Sliding, Openable for Wardrobe)';
COMMENT ON TABLE template_line_items IS 'Cost items in a template with optional hierarchy context';
COMMENT ON TABLE template_spaces IS 'Pre-defined space instances in a template';
COMMENT ON TABLE quotation_line_items IS 'Actual line items in a quotation with measurements and pricing';

COMMENT ON COLUMN quotations.presentation_level IS 'Controls what level of detail to show customer: space_only, space_component, space_component_type, full_detail';
COMMENT ON COLUMN quotations.hide_dimensions IS 'Hide length/width details from customer view';
COMMENT ON COLUMN quotation_line_items.group_name IS 'Grouping label for display (e.g., Carcass, Shutter, Hardware)';

-- ============================================================================
-- SECTION 11: UPDATED DUPLICATE QUOTATION FUNCTION
-- Replaces the function from 009 to support V2 line items
-- ============================================================================

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
    
    -- Copy spaces
    INSERT INTO quotation_spaces (quotation_id, space_type_id, name, description, sort_order, length, width, area, subtotal)
    SELECT v_new_quotation_id, space_type_id, name, description, sort_order, length, width, area, subtotal
    FROM quotation_spaces WHERE quotation_id = p_quotation_id;
    
    -- Copy components (need to map old space IDs to new)
    INSERT INTO quotation_components (
        quotation_id, space_id, component_type_id, component_variant_id,
        name, description, length, width, area, subtotal, sort_order
    )
    SELECT 
        v_new_quotation_id, 
        ns.id,
        oc.component_type_id,
        oc.component_variant_id,
        oc.name, oc.description, oc.length, oc.width, oc.area, oc.subtotal, oc.sort_order
    FROM quotation_components oc
    JOIN quotation_spaces os ON os.id = oc.space_id
    JOIN quotation_spaces ns ON ns.quotation_id = v_new_quotation_id 
        AND ns.sort_order = os.sort_order
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
        AND ns.sort_order = os.sort_order
    WHERE oli.quotation_id = p_quotation_id
      AND oli.quotation_component_id IS NULL;
    
    -- Then, insert line items with component (need to map component IDs)
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
        AND ns.sort_order = os.sort_order
    JOIN quotation_components nc ON nc.space_id = ns.id 
        AND nc.sort_order = oc.sort_order
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
        AND ns.sort_order = os.sort_order
    JOIN quotation_components nc ON nc.space_id = ns.id 
        AND nc.sort_order = oc.sort_order
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
        AND ns.sort_order = os.sort_order
    JOIN quotation_components nc ON nc.space_id = ns.id 
        AND nc.sort_order = oc.sort_order
    JOIN quotation_materials nm ON nm.component_id = nc.id 
        AND nm.display_order = om.display_order
    WHERE oca.quotation_id = p_quotation_id;
    
    RETURN v_new_quotation_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION duplicate_quotation IS 'Creates a copy/revision of a quotation including all V2 line items and backward-compatible materials';
