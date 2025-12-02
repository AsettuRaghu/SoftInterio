-- ============================================================================
-- QUOTATION MODULE DATABASE SCHEMA
-- Supports 4-level hierarchical costing structure with templates
-- ============================================================================

-- ============================================================================
-- SECTION 1: MASTER DATA / LIBRARY TABLES
-- These tables store reusable definitions that can be used across quotations
-- ============================================================================

-- 1.1 Space Types (Level 1 definitions)
-- Predefined room/space types that can be used in quotations
CREATE TABLE IF NOT EXISTS space_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,                    -- "Master Bedroom", "Living Room", "Kitchen"
    slug VARCHAR(100) NOT NULL,                    -- "master-bedroom", "living-room"
    description TEXT,
    icon VARCHAR(50),                              -- Icon identifier for UI
    display_order INTEGER DEFAULT 0,
    
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,               -- System-defined vs tenant-created
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, slug)
);

-- 1.2 Component Types (Level 2 definitions)
-- Types of components that can be added to spaces
CREATE TABLE IF NOT EXISTS component_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,                    -- "Wardrobe", "TV Unit", "False Ceiling"
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    
    -- Default dimensions and configuration
    default_width DECIMAL(10,2),                   -- Default width in feet
    default_height DECIMAL(10,2),                  -- Default height in feet
    default_depth DECIMAL(10,2),                   -- Default depth in feet
    
    -- Applicable space types (null = all spaces)
    applicable_space_types UUID[],                 -- Array of space_type IDs
    
    -- Configuration schema (JSON Schema for component-specific fields)
    config_schema JSONB,                           -- {"shutter_count": "number", "type": ["sliding", "hinged"]}
    
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, slug)
);

-- 1.3 Material Categories (Level 3 grouping)
-- Categories for organizing materials
CREATE TABLE IF NOT EXISTS material_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,                    -- "Carcass", "Shutter", "Hardware", "Finish"
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Which component types this category applies to
    applicable_component_types UUID[],             -- Array of component_type IDs
    
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, slug)
);

-- 1.4 Materials (Level 3 definitions)
-- Master list of materials with their specifications and rates
CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES material_categories(id) ON DELETE SET NULL,
    
    name VARCHAR(200) NOT NULL,                    -- "18mm BWP Plywood"
    code VARCHAR(50),                              -- Internal code like "PLY-BWP-18"
    description TEXT,
    
    -- Specifications
    specifications JSONB,                          -- {"thickness": "18mm", "grade": "BWP", "brand": "Century"}
    
    -- Default pricing (Level 4)
    unit VARCHAR(20) NOT NULL DEFAULT 'sqft',      -- "sqft", "rft", "unit", "set"
    base_rate DECIMAL(12,2) NOT NULL DEFAULT 0,    -- Base rate per unit
    
    -- Rate modifiers
    labour_rate DECIMAL(12,2) DEFAULT 0,           -- Labour cost per unit
    wastage_percent DECIMAL(5,2) DEFAULT 0,        -- Wastage percentage
    
    -- Alternative materials (for quick swapping)
    alternatives UUID[],                           -- Array of material IDs that can substitute
    
    -- Quality tier for filtering
    quality_tier VARCHAR(20) DEFAULT 'standard',   -- "budget", "standard", "premium", "luxury"
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.5 Cost Attribute Types (Level 4 definitions)
-- Types of cost attributes that can be added to materials
CREATE TABLE IF NOT EXISTS cost_attribute_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,                    -- "Area", "Quantity", "Labour", "Hardware Count"
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Data type and validation
    data_type VARCHAR(20) NOT NULL DEFAULT 'number', -- "number", "area", "length", "count"
    unit VARCHAR(20),                              -- "sqft", "rft", "nos", "hours"
    
    -- Calculation settings
    is_calculated BOOLEAN DEFAULT false,           -- Auto-calculated from other values
    calculation_formula TEXT,                      -- Formula for auto-calculation
    
    -- Applicable to which material categories
    applicable_categories UUID[],
    
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, slug)
);

-- ============================================================================
-- SECTION 2: TEMPLATE TABLES
-- Templates for quick quotation creation
-- ============================================================================

-- 2.1 Quotation Templates (Full quotation templates)
CREATE TABLE IF NOT EXISTS quotation_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(200) NOT NULL,                    -- "3BHK Complete (Premium)"
    description TEXT,
    
    -- Template metadata
    property_type VARCHAR(50),                     -- "3bhk", "2bhk", "villa", "commercial"
    quality_tier VARCHAR(20) DEFAULT 'standard',   -- Overall quality tier
    
    -- Pricing metadata (for display, not calculation)
    base_price DECIMAL(14,2),                      -- Approximate starting price
    
    -- Template content (stored as JSONB for flexibility)
    template_data JSONB NOT NULL,                  -- Full template structure
    
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,             -- Show prominently in UI
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 Space Templates
CREATE TABLE IF NOT EXISTS space_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    space_type_id UUID REFERENCES space_types(id) ON DELETE SET NULL,
    
    name VARCHAR(200) NOT NULL,                    -- "Master Bedroom - Luxury"
    description TEXT,
    
    quality_tier VARCHAR(20) DEFAULT 'standard',
    base_price DECIMAL(14,2),
    
    -- Template content
    template_data JSONB NOT NULL,                  -- Components with materials
    
    is_active BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 Component Templates
CREATE TABLE IF NOT EXISTS component_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    component_type_id UUID REFERENCES component_types(id) ON DELETE SET NULL,
    
    name VARCHAR(200) NOT NULL,                    -- "8ft Sliding Wardrobe - Premium"
    description TEXT,
    
    -- Default dimensions
    default_width DECIMAL(10,2),
    default_height DECIMAL(10,2),
    default_depth DECIMAL(10,2),
    
    quality_tier VARCHAR(20) DEFAULT 'standard',
    base_price DECIMAL(14,2),
    
    -- Template content
    template_data JSONB NOT NULL,                  -- Materials with cost attributes
    
    is_active BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.4 Material Presets (Pre-configured material combinations)
CREATE TABLE IF NOT EXISTS material_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name VARCHAR(200) NOT NULL,                    -- "Premium Wardrobe Package"
    description TEXT,
    
    -- Applicable to which component types
    applicable_component_types UUID[],
    
    quality_tier VARCHAR(20) DEFAULT 'standard',
    price_modifier DECIMAL(5,2) DEFAULT 1.0,       -- Multiplier vs standard (1.2 = 20% more)
    
    -- Preset content
    materials JSONB NOT NULL,                      -- List of material configurations
    
    is_active BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 3: QUOTATION TABLES
-- Actual quotation data with 4-level hierarchy
-- ============================================================================

-- 3.1 Quotations (Main quotation header)
CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Quotation identification
    quotation_number VARCHAR(50) NOT NULL,         -- "QT-2024-0001"
    version INTEGER DEFAULT 1,                     -- Version number
    parent_quotation_id UUID REFERENCES quotations(id), -- Previous version reference
    
    -- Linked entities
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    client_id UUID REFERENCES users(id) ON DELETE SET NULL,
    project_id UUID,                               -- Will be FK to projects table when created
    
    -- Client details (snapshot at time of creation)
    client_name VARCHAR(200),
    client_email VARCHAR(200),
    client_phone VARCHAR(20),
    
    -- Property details
    property_name VARCHAR(200),
    property_address TEXT,
    property_type VARCHAR(50),                     -- "3bhk", "2bhk", etc.
    carpet_area DECIMAL(10,2),
    
    -- Quotation title and description
    title VARCHAR(300),                            -- "Complete Interior Work - 3BHK"
    description TEXT,
    
    -- Status workflow
    status VARCHAR(30) DEFAULT 'draft',            -- draft, sent, viewed, negotiating, approved, rejected, expired
    
    -- Validity
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    
    -- Pricing summary (calculated from line items)
    subtotal DECIMAL(14,2) DEFAULT 0,              -- Sum of all items
    discount_type VARCHAR(20),                     -- "percentage", "fixed"
    discount_value DECIMAL(12,2) DEFAULT 0,
    discount_amount DECIMAL(14,2) DEFAULT 0,       -- Calculated discount
    taxable_amount DECIMAL(14,2) DEFAULT 0,        -- After discount
    tax_percent DECIMAL(5,2) DEFAULT 18,           -- GST percentage
    tax_amount DECIMAL(14,2) DEFAULT 0,
    overhead_percent DECIMAL(5,2) DEFAULT 0,       -- Overhead/markup percentage
    overhead_amount DECIMAL(14,2) DEFAULT 0,
    grand_total DECIMAL(14,2) DEFAULT 0,           -- Final amount
    
    -- Payment terms
    payment_terms JSONB,                           -- [{"milestone": "Booking", "percent": 40}, ...]
    
    -- Terms and conditions
    terms_and_conditions TEXT,
    notes TEXT,                                    -- Internal notes
    
    -- Tracking
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, quotation_number, version)
);

-- 3.2 Quotation Spaces (Level 1)
CREATE TABLE IF NOT EXISTS quotation_spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    space_type_id UUID REFERENCES space_types(id) ON DELETE SET NULL,
    
    -- Space details
    name VARCHAR(100) NOT NULL,                    -- "Master Bedroom" (can be customized)
    description TEXT,
    
    -- Ordering
    display_order INTEGER DEFAULT 0,
    
    -- Calculated totals
    subtotal DECIMAL(14,2) DEFAULT 0,
    
    -- Metadata
    metadata JSONB,                                -- Any additional space-specific data
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.3 Quotation Components (Level 2)
CREATE TABLE IF NOT EXISTS quotation_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    space_id UUID NOT NULL REFERENCES quotation_spaces(id) ON DELETE CASCADE,
    component_type_id UUID REFERENCES component_types(id) ON DELETE SET NULL,
    
    -- Component details
    name VARCHAR(200) NOT NULL,                    -- "Wardrobe"
    description TEXT,
    
    -- Dimensions
    width DECIMAL(10,2),                           -- Width in feet
    height DECIMAL(10,2),                          -- Height in feet
    depth DECIMAL(10,2),                           -- Depth in feet
    
    -- Component-specific configuration
    configuration JSONB,                           -- {"type": "sliding", "shutter_count": 4}
    
    -- Ordering
    display_order INTEGER DEFAULT 0,
    
    -- Calculated totals
    subtotal DECIMAL(14,2) DEFAULT 0,
    
    -- Metadata
    metadata JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.4 Quotation Materials (Level 3)
CREATE TABLE IF NOT EXISTS quotation_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES quotation_components(id) ON DELETE CASCADE,
    material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
    category_id UUID REFERENCES material_categories(id) ON DELETE SET NULL,
    
    -- Material details (snapshot from master or custom)
    name VARCHAR(200) NOT NULL,                    -- "18mm BWP Plywood"
    category_name VARCHAR(100),                    -- "Carcass"
    specifications JSONB,
    
    -- Ordering
    display_order INTEGER DEFAULT 0,
    
    -- Calculated totals
    subtotal DECIMAL(14,2) DEFAULT 0,
    
    -- Metadata
    metadata JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.5 Quotation Cost Attributes (Level 4)
CREATE TABLE IF NOT EXISTS quotation_cost_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES quotation_materials(id) ON DELETE CASCADE,
    attribute_type_id UUID REFERENCES cost_attribute_types(id) ON DELETE SET NULL,
    
    -- Attribute details
    name VARCHAR(100) NOT NULL,                    -- "Area", "Quantity", "Labour"
    
    -- Values
    quantity DECIMAL(12,4) NOT NULL DEFAULT 0,     -- The quantity/measurement
    unit VARCHAR(20),                              -- "sqft", "rft", "nos"
    rate DECIMAL(12,2) NOT NULL DEFAULT 0,         -- Rate per unit
    amount DECIMAL(14,2) NOT NULL DEFAULT 0,       -- Calculated: quantity × rate
    
    -- Calculation metadata
    is_auto_calculated BOOLEAN DEFAULT false,
    calculation_source TEXT,                       -- How was this calculated
    
    -- Ordering
    display_order INTEGER DEFAULT 0,
    
    -- Metadata
    metadata JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 4: VERSION HISTORY
-- For tracking changes and enabling comparisons
-- ============================================================================

-- 4.1 Quotation Snapshots (Full state at a point in time)
CREATE TABLE IF NOT EXISTS quotation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    
    version INTEGER NOT NULL,
    snapshot_data JSONB NOT NULL,                  -- Complete quotation state as JSON
    
    change_summary TEXT,                           -- Brief description of changes
    changed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4.2 Quotation Change Log (Granular change tracking)
CREATE TABLE IF NOT EXISTS quotation_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    
    entity_type VARCHAR(50) NOT NULL,              -- "space", "component", "material", "cost_attribute"
    entity_id UUID NOT NULL,
    
    change_type VARCHAR(20) NOT NULL,              -- "create", "update", "delete"
    field_name VARCHAR(100),
    old_value JSONB,
    new_value JSONB,
    
    changed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 5: INDEXES
-- ============================================================================

-- Quotations
CREATE INDEX idx_quotations_tenant ON quotations(tenant_id);
CREATE INDEX idx_quotations_lead ON quotations(lead_id);
CREATE INDEX idx_quotations_status ON quotations(tenant_id, status);
CREATE INDEX idx_quotations_number ON quotations(tenant_id, quotation_number);
CREATE INDEX idx_quotations_created ON quotations(tenant_id, created_at DESC);

-- Quotation Spaces
CREATE INDEX idx_quotation_spaces_quotation ON quotation_spaces(quotation_id);
CREATE INDEX idx_quotation_spaces_order ON quotation_spaces(quotation_id, display_order);

-- Quotation Components
CREATE INDEX idx_quotation_components_space ON quotation_components(space_id);
CREATE INDEX idx_quotation_components_quotation ON quotation_components(quotation_id);
CREATE INDEX idx_quotation_components_order ON quotation_components(space_id, display_order);

-- Quotation Materials
CREATE INDEX idx_quotation_materials_component ON quotation_materials(component_id);
CREATE INDEX idx_quotation_materials_quotation ON quotation_materials(quotation_id);

-- Quotation Cost Attributes
CREATE INDEX idx_quotation_cost_attrs_material ON quotation_cost_attributes(material_id);
CREATE INDEX idx_quotation_cost_attrs_quotation ON quotation_cost_attributes(quotation_id);

-- Templates
CREATE INDEX idx_quotation_templates_tenant ON quotation_templates(tenant_id, is_active);
CREATE INDEX idx_space_templates_tenant ON space_templates(tenant_id, is_active);
CREATE INDEX idx_component_templates_tenant ON component_templates(tenant_id, is_active);

-- Master data
CREATE INDEX idx_materials_tenant ON materials(tenant_id, is_active);
CREATE INDEX idx_materials_category ON materials(category_id);
CREATE INDEX idx_space_types_tenant ON space_types(tenant_id, is_active);
CREATE INDEX idx_component_types_tenant ON component_types(tenant_id, is_active);

-- ============================================================================
-- SECTION 6: TRIGGERS FOR AUTO-CALCULATIONS
-- ============================================================================

-- Function to recalculate material subtotal from cost attributes
CREATE OR REPLACE FUNCTION calculate_material_subtotal()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE quotation_materials
    SET subtotal = (
        SELECT COALESCE(SUM(amount), 0)
        FROM quotation_cost_attributes
        WHERE material_id = COALESCE(NEW.material_id, OLD.material_id)
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.material_id, OLD.material_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_material_subtotal
AFTER INSERT OR UPDATE OR DELETE ON quotation_cost_attributes
FOR EACH ROW EXECUTE FUNCTION calculate_material_subtotal();

-- Function to recalculate component subtotal from materials
CREATE OR REPLACE FUNCTION calculate_component_subtotal()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE quotation_components
    SET subtotal = (
        SELECT COALESCE(SUM(subtotal), 0)
        FROM quotation_materials
        WHERE component_id = COALESCE(NEW.component_id, OLD.component_id)
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.component_id, OLD.component_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_component_subtotal
AFTER INSERT OR UPDATE OR DELETE ON quotation_materials
FOR EACH ROW EXECUTE FUNCTION calculate_component_subtotal();

-- Function to recalculate space subtotal from components
CREATE OR REPLACE FUNCTION calculate_space_subtotal()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE quotation_spaces
    SET subtotal = (
        SELECT COALESCE(SUM(subtotal), 0)
        FROM quotation_components
        WHERE space_id = COALESCE(NEW.space_id, OLD.space_id)
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.space_id, OLD.space_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_space_subtotal
AFTER INSERT OR UPDATE OR DELETE ON quotation_components
FOR EACH ROW EXECUTE FUNCTION calculate_space_subtotal();

-- Function to recalculate quotation totals from spaces
CREATE OR REPLACE FUNCTION calculate_quotation_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_subtotal DECIMAL(14,2);
    v_discount_amount DECIMAL(14,2);
    v_taxable_amount DECIMAL(14,2);
    v_overhead_amount DECIMAL(14,2);
    v_tax_amount DECIMAL(14,2);
    v_grand_total DECIMAL(14,2);
    v_quotation_id UUID;
BEGIN
    v_quotation_id := COALESCE(NEW.quotation_id, OLD.quotation_id);
    
    -- Get subtotal from spaces
    SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal
    FROM quotation_spaces
    WHERE quotation_id = v_quotation_id;
    
    -- Calculate discount
    SELECT 
        CASE 
            WHEN discount_type = 'percentage' THEN v_subtotal * (discount_value / 100)
            WHEN discount_type = 'fixed' THEN discount_value
            ELSE 0
        END
    INTO v_discount_amount
    FROM quotations WHERE id = v_quotation_id;
    
    v_taxable_amount := v_subtotal - COALESCE(v_discount_amount, 0);
    
    -- Calculate overhead
    SELECT v_taxable_amount * (COALESCE(overhead_percent, 0) / 100)
    INTO v_overhead_amount
    FROM quotations WHERE id = v_quotation_id;
    
    v_taxable_amount := v_taxable_amount + COALESCE(v_overhead_amount, 0);
    
    -- Calculate tax
    SELECT v_taxable_amount * (COALESCE(tax_percent, 18) / 100)
    INTO v_tax_amount
    FROM quotations WHERE id = v_quotation_id;
    
    v_grand_total := v_taxable_amount + COALESCE(v_tax_amount, 0);
    
    -- Update quotation
    UPDATE quotations
    SET 
        subtotal = v_subtotal,
        discount_amount = COALESCE(v_discount_amount, 0),
        taxable_amount = v_taxable_amount,
        overhead_amount = COALESCE(v_overhead_amount, 0),
        tax_amount = COALESCE(v_tax_amount, 0),
        grand_total = v_grand_total,
        updated_at = NOW()
    WHERE id = v_quotation_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_quotation_totals
AFTER INSERT OR UPDATE OR DELETE ON quotation_spaces
FOR EACH ROW EXECUTE FUNCTION calculate_quotation_totals();

-- ============================================================================
-- SECTION 7: HELPER FUNCTIONS
-- ============================================================================

-- Function to generate quotation number
CREATE OR REPLACE FUNCTION generate_quotation_number(p_tenant_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_year VARCHAR(4);
    v_count INTEGER;
    v_number VARCHAR(50);
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    SELECT COUNT(*) + 1 INTO v_count
    FROM quotations
    WHERE tenant_id = p_tenant_id
    AND quotation_number LIKE 'QT-' || v_year || '-%';
    
    v_number := 'QT-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
    
    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Function to duplicate a quotation (for creating new version)
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
    
    -- Create new quotation header
    INSERT INTO quotations (
        tenant_id, quotation_number, version, parent_quotation_id,
        lead_id, client_id, project_id,
        client_name, client_email, client_phone,
        property_name, property_address, property_type, carpet_area,
        title, description, status,
        valid_from, valid_until,
        discount_type, discount_value, tax_percent, overhead_percent,
        payment_terms, terms_and_conditions, notes,
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
        p_user_id, p_user_id
    FROM quotations WHERE id = p_quotation_id
    RETURNING id INTO v_new_quotation_id;
    
    -- Copy spaces
    INSERT INTO quotation_spaces (quotation_id, space_type_id, name, description, display_order, metadata)
    SELECT v_new_quotation_id, space_type_id, name, description, display_order, metadata
    FROM quotation_spaces WHERE quotation_id = p_quotation_id;
    
    -- Copy components (need to map old space IDs to new)
    INSERT INTO quotation_components (
        quotation_id, space_id, component_type_id,
        name, description, width, height, depth, configuration, display_order, metadata
    )
    SELECT 
        v_new_quotation_id, 
        ns.id,
        oc.component_type_id,
        oc.name, oc.description, oc.width, oc.height, oc.depth, oc.configuration, oc.display_order, oc.metadata
    FROM quotation_components oc
    JOIN quotation_spaces os ON os.id = oc.space_id
    JOIN quotation_spaces ns ON ns.quotation_id = v_new_quotation_id 
        AND ns.display_order = os.display_order
    WHERE oc.quotation_id = p_quotation_id;
    
    -- Copy materials (need to map old component IDs to new)
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
    
    -- Copy cost attributes (need to map old material IDs to new)
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

-- ============================================================================
-- SECTION 8: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_cost_attributes ENABLE ROW LEVEL SECURITY;

-- RLS policies for quotations
CREATE POLICY quotations_tenant_isolation ON quotations
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- RLS policies for quotation_spaces
CREATE POLICY quotation_spaces_tenant_isolation ON quotation_spaces
    FOR ALL USING (
        quotation_id IN (SELECT id FROM quotations WHERE tenant_id = get_user_tenant_id())
    );

-- RLS policies for quotation_components
CREATE POLICY quotation_components_tenant_isolation ON quotation_components
    FOR ALL USING (
        quotation_id IN (SELECT id FROM quotations WHERE tenant_id = get_user_tenant_id())
    );

-- RLS policies for quotation_materials
CREATE POLICY quotation_materials_tenant_isolation ON quotation_materials
    FOR ALL USING (
        quotation_id IN (SELECT id FROM quotations WHERE tenant_id = get_user_tenant_id())
    );

-- RLS policies for quotation_cost_attributes
CREATE POLICY quotation_cost_attributes_tenant_isolation ON quotation_cost_attributes
    FOR ALL USING (
        quotation_id IN (SELECT id FROM quotations WHERE tenant_id = get_user_tenant_id())
    );

-- ============================================================================
-- SECTION 9: SEED DEFAULT DATA
-- ============================================================================

-- This would be run per-tenant during onboarding

-- Example: Insert default space types
-- INSERT INTO space_types (tenant_id, name, slug, icon, display_order, is_system) VALUES
-- ('{tenant_id}', 'Master Bedroom', 'master-bedroom', 'bed-double', 1, true),
-- ('{tenant_id}', 'Bedroom', 'bedroom', 'bed', 2, true),
-- ('{tenant_id}', 'Living Room', 'living-room', 'sofa', 3, true),
-- ('{tenant_id}', 'Kitchen', 'kitchen', 'utensils', 4, true),
-- ('{tenant_id}', 'Dining Room', 'dining-room', 'utensils-crossed', 5, true),
-- ('{tenant_id}', 'Bathroom', 'bathroom', 'bath', 6, true),
-- ('{tenant_id}', 'Balcony', 'balcony', 'sun', 7, true),
-- ('{tenant_id}', 'Study Room', 'study-room', 'book-open', 8, true),
-- ('{tenant_id}', 'Pooja Room', 'pooja-room', 'flame', 9, true),
-- ('{tenant_id}', 'Foyer', 'foyer', 'door-open', 10, true);

-- Example: Insert default component types
-- INSERT INTO component_types (tenant_id, name, slug, icon, display_order, is_system) VALUES
-- ('{tenant_id}', 'Wardrobe', 'wardrobe', 'archive', 1, true),
-- ('{tenant_id}', 'TV Unit', 'tv-unit', 'tv', 2, true),
-- ('{tenant_id}', 'Study Table', 'study-table', 'book', 3, true),
-- ('{tenant_id}', 'False Ceiling', 'false-ceiling', 'square', 4, true),
-- ('{tenant_id}', 'Wall Paneling', 'wall-paneling', 'layout', 5, true),
-- ('{tenant_id}', 'Modular Kitchen', 'modular-kitchen', 'utensils', 6, true),
-- ('{tenant_id}', 'Shoe Rack', 'shoe-rack', 'footprints', 7, true),
-- ('{tenant_id}', 'Crockery Unit', 'crockery-unit', 'wine', 8, true),
-- ('{tenant_id}', 'Bed', 'bed', 'bed', 9, true),
-- ('{tenant_id}', 'Dressing Table', 'dressing-table', 'mirror', 10, true);

COMMENT ON TABLE quotations IS 'Main quotation header with client and pricing details';
COMMENT ON TABLE quotation_spaces IS 'Level 1: Spaces/Rooms in the quotation';
COMMENT ON TABLE quotation_components IS 'Level 2: Components/Work items within each space';
COMMENT ON TABLE quotation_materials IS 'Level 3: Materials and specifications for each component';
COMMENT ON TABLE quotation_cost_attributes IS 'Level 4: Detailed cost breakdown for each material';
