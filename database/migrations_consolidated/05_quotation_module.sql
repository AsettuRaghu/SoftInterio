-- =====================================================
-- SoftInterio Quotation Module
-- =====================================================
-- Module: Quotation Management
-- Description: Complete quotation system with 4-level hierarchy,
--              templates, materials, and line items
-- Target: Supabase (PostgreSQL with auth integration)
-- 
-- Run Order: 5 (After sales module)
-- =====================================================

-- =====================================================
-- SECTION 1: UNITS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS units (
    code VARCHAR(20) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    calculation_type VARCHAR(20) NOT NULL,
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

-- =====================================================
-- SECTION 2: SPACE TYPES (Level 1 definitions)
-- =====================================================

CREATE TABLE IF NOT EXISTS space_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, slug)
);

ALTER TABLE space_types ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_space_types_tenant ON space_types(tenant_id, is_active);

-- =====================================================
-- SECTION 3: COMPONENT TYPES (Level 2 definitions)
-- =====================================================

CREATE TABLE IF NOT EXISTS component_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    default_width DECIMAL(10,2),
    default_height DECIMAL(10,2),
    default_depth DECIMAL(10,2),
    applicable_space_types UUID[],
    config_schema JSONB,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, slug)
);

ALTER TABLE component_types ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_component_types_tenant ON component_types(tenant_id, is_active);

-- =====================================================
-- SECTION 4: COMPONENT VARIANTS (Level 3 types)
-- =====================================================

CREATE TABLE IF NOT EXISTS component_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    component_type_id UUID NOT NULL REFERENCES component_types(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    cost_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    default_width DECIMAL(10,2),
    default_height DECIMAL(10,2),
    default_depth DECIMAL(10,2),
    base_rate_per_sqft DECIMAL(12,2),
    quality_tier VARCHAR(20) DEFAULT 'standard',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, component_type_id, slug)
);

ALTER TABLE component_variants ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_component_variants_tenant ON component_variants(tenant_id, is_active);
CREATE INDEX idx_component_variants_component ON component_variants(component_type_id);

-- =====================================================
-- SECTION 5: COST ITEM CATEGORIES
-- =====================================================

CREATE TABLE IF NOT EXISTS cost_item_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(20),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, slug)
);

ALTER TABLE cost_item_categories ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_cost_item_categories_tenant ON cost_item_categories(tenant_id, is_active);

-- =====================================================
-- SECTION 6: COST ITEMS (Materials, Labour, Services)
-- =====================================================

CREATE TABLE IF NOT EXISTS cost_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES cost_item_categories(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    description TEXT,
    unit_code VARCHAR(20) NOT NULL REFERENCES units(code),
    default_rate DECIMAL(12,2) NOT NULL DEFAULT 0,
    specifications JSONB,
    quality_tier VARCHAR(20) DEFAULT 'standard',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, slug)
);

ALTER TABLE cost_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_cost_items_tenant ON cost_items(tenant_id, is_active);
CREATE INDEX idx_cost_items_category ON cost_items(category_id);
CREATE INDEX idx_cost_items_unit ON cost_items(unit_code);

-- =====================================================
-- SECTION 7: MATERIAL CATEGORIES (Legacy)
-- =====================================================

CREATE TABLE IF NOT EXISTS material_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    applicable_component_types UUID[],
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, slug)
);

ALTER TABLE material_categories ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SECTION 8: MATERIALS (Legacy)
-- =====================================================

CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES material_categories(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    specifications JSONB,
    unit VARCHAR(20) NOT NULL DEFAULT 'sqft',
    base_rate DECIMAL(12,2) NOT NULL DEFAULT 0,
    labour_rate DECIMAL(12,2) DEFAULT 0,
    wastage_percent DECIMAL(5,2) DEFAULT 0,
    alternatives UUID[],
    quality_tier VARCHAR(20) DEFAULT 'standard',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_materials_tenant ON materials(tenant_id, is_active);
CREATE INDEX idx_materials_category ON materials(category_id);

-- =====================================================
-- SECTION 9: COST ATTRIBUTE TYPES
-- =====================================================

CREATE TABLE IF NOT EXISTS cost_attribute_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    data_type VARCHAR(20) NOT NULL DEFAULT 'number',
    unit VARCHAR(20),
    is_calculated BOOLEAN DEFAULT false,
    calculation_formula TEXT,
    applicable_categories UUID[],
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, slug)
);

ALTER TABLE cost_attribute_types ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SECTION 10: QUOTATION TEMPLATES
-- =====================================================

CREATE TABLE IF NOT EXISTS quotation_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    property_type VARCHAR(50),
    quality_tier VARCHAR(20) DEFAULT 'standard',
    base_price DECIMAL(14,2),
    template_data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quotation_templates ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_quotation_templates_tenant ON quotation_templates(tenant_id, is_active);

-- =====================================================
-- SECTION 11: SPACE TEMPLATES
-- =====================================================

CREATE TABLE IF NOT EXISTS space_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    space_type_id UUID REFERENCES space_types(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    quality_tier VARCHAR(20) DEFAULT 'standard',
    base_price DECIMAL(14,2),
    template_data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE space_templates ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_space_templates_tenant ON space_templates(tenant_id, is_active);

-- =====================================================
-- SECTION 12: COMPONENT TEMPLATES
-- =====================================================

CREATE TABLE IF NOT EXISTS component_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    component_type_id UUID REFERENCES component_types(id) ON DELETE SET NULL,
    variant_type_id UUID REFERENCES component_variants(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    default_width DECIMAL(10,2),
    default_height DECIMAL(10,2),
    default_depth DECIMAL(10,2),
    quality_tier VARCHAR(20) DEFAULT 'standard',
    base_price DECIMAL(14,2),
    template_data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE component_templates ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_component_templates_tenant ON component_templates(tenant_id, is_active);

-- =====================================================
-- SECTION 13: TEMPLATE LINE ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS template_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES quotation_templates(id) ON DELETE CASCADE,
    space_type_id UUID REFERENCES space_types(id) ON DELETE SET NULL,
    component_type_id UUID REFERENCES component_types(id) ON DELETE SET NULL,
    component_variant_id UUID REFERENCES component_variants(id) ON DELETE SET NULL,
    cost_item_id UUID NOT NULL REFERENCES cost_items(id) ON DELETE CASCADE,
    group_name VARCHAR(100),
    rate DECIMAL(12,2),
    display_order INTEGER DEFAULT 0,
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE template_line_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_template_line_items_template ON template_line_items(template_id);

-- =====================================================
-- SECTION 14: TEMPLATE SPACES
-- =====================================================

CREATE TABLE IF NOT EXISTS template_spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES quotation_templates(id) ON DELETE CASCADE,
    space_type_id UUID NOT NULL REFERENCES space_types(id) ON DELETE CASCADE,
    default_name VARCHAR(100),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE template_spaces ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_template_spaces_template ON template_spaces(template_id);

-- =====================================================
-- SECTION 15: QUOTATIONS (Main Table)
-- =====================================================

CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Identification
    quotation_number VARCHAR(50) NOT NULL,
    version INTEGER DEFAULT 1,
    parent_quotation_id UUID REFERENCES quotations(id),
    
    -- Linked entities
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    client_id UUID REFERENCES users(id) ON DELETE SET NULL,
    project_id UUID,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Client details (snapshot)
    client_name VARCHAR(200),
    client_email VARCHAR(200),
    client_phone VARCHAR(20),
    
    -- Property details
    property_name VARCHAR(200),
    property_address TEXT,
    property_type VARCHAR(50),
    carpet_area DECIMAL(10,2),
    
    -- Quotation title and description
    title VARCHAR(300),
    description TEXT,
    
    -- Status workflow
    status VARCHAR(30) DEFAULT 'draft',
    
    -- Validity
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    
    -- Pricing summary
    subtotal DECIMAL(14,2) DEFAULT 0,
    discount_type VARCHAR(20),
    discount_value DECIMAL(12,2) DEFAULT 0,
    discount_amount DECIMAL(14,2) DEFAULT 0,
    taxable_amount DECIMAL(14,2) DEFAULT 0,
    tax_percent DECIMAL(5,2) DEFAULT 18,
    tax_amount DECIMAL(14,2) DEFAULT 0,
    overhead_percent DECIMAL(5,2) DEFAULT 0,
    overhead_amount DECIMAL(14,2) DEFAULT 0,
    grand_total DECIMAL(14,2) DEFAULT 0,
    
    -- Payment terms
    payment_terms JSONB,
    
    -- Terms and conditions
    terms_and_conditions TEXT,
    notes TEXT,
    
    -- Presentation settings
    presentation_level VARCHAR(30) DEFAULT 'space_component',
    hide_dimensions BOOLEAN DEFAULT true,
    
    -- Tracking
    auto_created BOOLEAN DEFAULT false,
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

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_quotations_tenant ON quotations(tenant_id);
CREATE INDEX idx_quotations_lead ON quotations(lead_id);
CREATE INDEX idx_quotations_status ON quotations(tenant_id, status);
CREATE INDEX idx_quotations_number ON quotations(tenant_id, quotation_number);
CREATE INDEX idx_quotations_created ON quotations(tenant_id, created_at DESC);
CREATE INDEX idx_quotations_assigned ON quotations(assigned_to);

-- =====================================================
-- SECTION 16: QUOTATION SPACES (Level 1)
-- =====================================================

CREATE TABLE IF NOT EXISTS quotation_spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    space_type_id UUID REFERENCES space_types(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    length DECIMAL(10,2),
    width DECIMAL(10,2),
    area DECIMAL(10,2),
    display_order INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    subtotal DECIMAL(14,2) DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quotation_spaces ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_quotation_spaces_quotation ON quotation_spaces(quotation_id);
CREATE INDEX idx_quotation_spaces_order ON quotation_spaces(quotation_id, display_order);

-- =====================================================
-- SECTION 17: QUOTATION COMPONENTS (Level 2)
-- =====================================================

CREATE TABLE IF NOT EXISTS quotation_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    space_id UUID NOT NULL REFERENCES quotation_spaces(id) ON DELETE CASCADE,
    component_type_id UUID REFERENCES component_types(id) ON DELETE SET NULL,
    component_variant_id UUID REFERENCES component_variants(id) ON DELETE SET NULL,
    variant_type_id UUID REFERENCES component_variants(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    width DECIMAL(10,2),
    height DECIMAL(10,2),
    depth DECIMAL(10,2),
    length DECIMAL(10,2),
    area DECIMAL(10,2),
    configuration JSONB,
    display_order INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    subtotal DECIMAL(14,2) DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quotation_components ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_quotation_components_space ON quotation_components(space_id);
CREATE INDEX idx_quotation_components_quotation ON quotation_components(quotation_id);
CREATE INDEX idx_quotation_components_order ON quotation_components(space_id, display_order);

-- =====================================================
-- SECTION 18: QUOTATION MATERIALS (Level 3 - Legacy)
-- =====================================================

CREATE TABLE IF NOT EXISTS quotation_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    component_id UUID NOT NULL REFERENCES quotation_components(id) ON DELETE CASCADE,
    material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
    category_id UUID REFERENCES material_categories(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    category_name VARCHAR(100),
    specifications JSONB,
    display_order INTEGER DEFAULT 0,
    subtotal DECIMAL(14,2) DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quotation_materials ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_quotation_materials_component ON quotation_materials(component_id);
CREATE INDEX idx_quotation_materials_quotation ON quotation_materials(quotation_id);

-- =====================================================
-- SECTION 19: QUOTATION COST ATTRIBUTES (Level 4 - Legacy)
-- =====================================================

CREATE TABLE IF NOT EXISTS quotation_cost_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    material_id UUID REFERENCES quotation_materials(id) ON DELETE CASCADE,
    component_id UUID REFERENCES quotation_components(id) ON DELETE CASCADE,
    attribute_type_id UUID REFERENCES cost_attribute_types(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    quantity DECIMAL(12,4) NOT NULL DEFAULT 0,
    unit VARCHAR(20),
    rate DECIMAL(12,2) NOT NULL DEFAULT 0,
    amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    is_auto_calculated BOOLEAN DEFAULT false,
    calculation_source TEXT,
    display_order INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quotation_cost_attributes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_quotation_cost_attrs_material ON quotation_cost_attributes(material_id);
CREATE INDEX idx_quotation_cost_attrs_component ON quotation_cost_attributes(component_id);
CREATE INDEX idx_quotation_cost_attrs_quotation ON quotation_cost_attributes(quotation_id);

-- =====================================================
-- SECTION 20: QUOTATION LINE ITEMS (V2)
-- =====================================================

CREATE TABLE IF NOT EXISTS quotation_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    quotation_space_id UUID REFERENCES quotation_spaces(id) ON DELETE CASCADE,
    quotation_component_id UUID REFERENCES quotation_components(id) ON DELETE CASCADE,
    cost_item_id UUID REFERENCES cost_items(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    group_name VARCHAR(100),
    length DECIMAL(10,2),
    width DECIMAL(10,2),
    quantity DECIMAL(10,2),
    unit_code VARCHAR(20) NOT NULL REFERENCES units(code),
    rate DECIMAL(12,2) NOT NULL DEFAULT 0,
    amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quotation_line_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_quotation_line_items_quotation ON quotation_line_items(quotation_id);
CREATE INDEX idx_quotation_line_items_space ON quotation_line_items(quotation_space_id);
CREATE INDEX idx_quotation_line_items_component ON quotation_line_items(quotation_component_id);

-- =====================================================
-- SECTION 21: QUOTATION SNAPSHOTS
-- =====================================================

CREATE TABLE IF NOT EXISTS quotation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    snapshot_data JSONB NOT NULL,
    change_summary TEXT,
    changed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quotation_snapshots ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SECTION 22: QUOTATION CHANGES
-- =====================================================

CREATE TABLE IF NOT EXISTS quotation_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    change_type VARCHAR(20) NOT NULL,
    field_name VARCHAR(100),
    old_value JSONB,
    new_value JSONB,
    changed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quotation_changes ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SECTION 23: HELPER FUNCTIONS
-- =====================================================

-- Generate quotation number
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

-- Auto-create quotation for lead
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
BEGIN
    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found: %', p_lead_id;
    END IF;
    
    v_tenant_id := v_lead.tenant_id;
    v_quotation_number := generate_quotation_number(v_tenant_id);
    
    INSERT INTO quotations (
        tenant_id, quotation_number, version, lead_id,
        client_name, client_email, client_phone,
        property_name, property_address, property_type, carpet_area,
        title, status, auto_created,
        created_by, updated_by
    ) VALUES (
        v_tenant_id, v_quotation_number, 1, p_lead_id,
        v_lead.client_name, v_lead.email, v_lead.phone,
        v_lead.property_name, v_lead.property_address, v_lead.property_type::text, v_lead.carpet_area_sqft,
        'Quotation for ' || v_lead.client_name, 'draft', true,
        COALESCE(p_user_id, v_lead.assigned_to, v_lead.created_by),
        COALESCE(p_user_id, v_lead.assigned_to, v_lead.created_by)
    )
    RETURNING id INTO v_quotation_id;
    
    RETURN v_quotation_id;
END;
$$ LANGUAGE plpgsql;

-- Duplicate quotation
CREATE OR REPLACE FUNCTION duplicate_quotation(p_quotation_id UUID, p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_new_quotation_id UUID;
    v_new_version INTEGER;
    v_old_version INTEGER;
BEGIN
    SELECT version INTO v_old_version FROM quotations WHERE id = p_quotation_id;
    v_new_version := COALESCE(v_old_version, 0) + 1;
    
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
    
    -- Copy components
    INSERT INTO quotation_components (
        quotation_id, space_id, component_type_id, component_variant_id,
        name, description, length, width, area, subtotal, sort_order
    )
    SELECT 
        v_new_quotation_id, ns.id, oc.component_type_id, oc.component_variant_id,
        oc.name, oc.description, oc.length, oc.width, oc.area, oc.subtotal, oc.sort_order
    FROM quotation_components oc
    JOIN quotation_spaces os ON os.id = oc.space_id
    JOIN quotation_spaces ns ON ns.quotation_id = v_new_quotation_id AND ns.sort_order = os.sort_order
    WHERE oc.quotation_id = p_quotation_id;
    
    -- Copy line items
    INSERT INTO quotation_line_items (
        quotation_id, quotation_space_id, quotation_component_id,
        cost_item_id, name, group_name,
        length, width, quantity, unit_code, rate, amount,
        display_order, notes, metadata
    )
    SELECT 
        v_new_quotation_id, ns.id,
        CASE WHEN oli.quotation_component_id IS NULL THEN NULL ELSE nc.id END,
        oli.cost_item_id, oli.name, oli.group_name,
        oli.length, oli.width, oli.quantity, oli.unit_code, oli.rate, oli.amount,
        oli.display_order, oli.notes, oli.metadata
    FROM quotation_line_items oli
    LEFT JOIN quotation_spaces os ON os.id = oli.quotation_space_id
    LEFT JOIN quotation_spaces ns ON ns.quotation_id = v_new_quotation_id AND ns.sort_order = os.sort_order
    LEFT JOIN quotation_components oc ON oc.id = oli.quotation_component_id
    LEFT JOIN quotation_components nc ON nc.space_id = ns.id AND nc.sort_order = oc.sort_order
    WHERE oli.quotation_id = p_quotation_id;
    
    RETURN v_new_quotation_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SECTION 24: CALCULATION TRIGGERS
-- =====================================================

-- Calculate line item amount
CREATE OR REPLACE FUNCTION calculate_line_item_amount()
RETURNS TRIGGER AS $$
DECLARE
    v_calc_type VARCHAR(20);
BEGIN
    SELECT calculation_type INTO v_calc_type FROM units WHERE code = NEW.unit_code;
    
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

-- Recalculate component subtotal
CREATE OR REPLACE FUNCTION calculate_component_subtotal()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE quotation_components
    SET subtotal = (
        SELECT COALESCE(SUM(amount), 0)
        FROM quotation_line_items
        WHERE quotation_component_id = COALESCE(NEW.quotation_component_id, OLD.quotation_component_id)
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.quotation_component_id, OLD.quotation_component_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_component_subtotal ON quotation_line_items;
CREATE TRIGGER trg_recalc_component_subtotal
AFTER INSERT OR UPDATE OR DELETE ON quotation_line_items
FOR EACH ROW EXECUTE FUNCTION calculate_component_subtotal();

-- Recalculate space subtotal
CREATE OR REPLACE FUNCTION calculate_space_subtotal()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE quotation_spaces
    SET subtotal = (
        SELECT COALESCE(SUM(amount), 0)
        FROM quotation_line_items
        WHERE quotation_space_id = COALESCE(NEW.quotation_space_id, OLD.quotation_space_id)
          AND quotation_component_id IS NULL
    ) + (
        SELECT COALESCE(SUM(subtotal), 0)
        FROM quotation_components
        WHERE space_id = COALESCE(NEW.quotation_space_id, OLD.quotation_space_id)
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.quotation_space_id, OLD.quotation_space_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_space_subtotal ON quotation_line_items;
CREATE TRIGGER trg_recalc_space_subtotal
AFTER INSERT OR UPDATE OR DELETE ON quotation_line_items
FOR EACH ROW EXECUTE FUNCTION calculate_space_subtotal();

-- Recalculate quotation totals
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
    
    SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal
    FROM quotation_spaces
    WHERE quotation_id = v_quotation_id;
    
    SELECT 
        CASE 
            WHEN discount_type = 'percentage' THEN v_subtotal * (discount_value / 100)
            WHEN discount_type = 'fixed' THEN discount_value
            ELSE 0
        END
    INTO v_discount_amount
    FROM quotations WHERE id = v_quotation_id;
    
    v_taxable_amount := v_subtotal - COALESCE(v_discount_amount, 0);
    
    SELECT v_taxable_amount * (COALESCE(overhead_percent, 0) / 100)
    INTO v_overhead_amount
    FROM quotations WHERE id = v_quotation_id;
    
    v_taxable_amount := v_taxable_amount + COALESCE(v_overhead_amount, 0);
    
    SELECT v_taxable_amount * (COALESCE(tax_percent, 18) / 100)
    INTO v_tax_amount
    FROM quotations WHERE id = v_quotation_id;
    
    v_grand_total := v_taxable_amount + COALESCE(v_tax_amount, 0);
    
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

DROP TRIGGER IF EXISTS trg_recalc_quotation_totals ON quotation_spaces;
CREATE TRIGGER trg_recalc_quotation_totals
AFTER INSERT OR UPDATE OR DELETE ON quotation_spaces
FOR EACH ROW EXECUTE FUNCTION calculate_quotation_totals();

-- =====================================================
-- SECTION 25: RLS POLICIES
-- =====================================================

-- Space types
CREATE POLICY space_types_tenant_isolation ON space_types
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Component types
CREATE POLICY component_types_tenant_isolation ON component_types
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Component variants
CREATE POLICY component_variants_tenant_isolation ON component_variants
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Cost item categories
CREATE POLICY cost_item_categories_tenant_isolation ON cost_item_categories
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Cost items
CREATE POLICY cost_items_tenant_isolation ON cost_items
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Materials
CREATE POLICY materials_tenant_isolation ON materials
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Material categories
CREATE POLICY material_categories_tenant_isolation ON material_categories
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Cost attribute types
CREATE POLICY cost_attribute_types_tenant_isolation ON cost_attribute_types
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Templates
CREATE POLICY quotation_templates_tenant_isolation ON quotation_templates
    FOR ALL USING (tenant_id = get_user_tenant_id());

CREATE POLICY space_templates_tenant_isolation ON space_templates
    FOR ALL USING (tenant_id = get_user_tenant_id());

CREATE POLICY component_templates_tenant_isolation ON component_templates
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Template line items
CREATE POLICY template_line_items_tenant_isolation ON template_line_items
    FOR ALL USING (template_id IN (SELECT id FROM quotation_templates WHERE tenant_id = get_user_tenant_id()));

-- Template spaces
CREATE POLICY template_spaces_tenant_isolation ON template_spaces
    FOR ALL USING (template_id IN (SELECT id FROM quotation_templates WHERE tenant_id = get_user_tenant_id()));

-- Quotations
CREATE POLICY quotations_tenant_isolation ON quotations
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Quotation spaces
CREATE POLICY quotation_spaces_tenant_isolation ON quotation_spaces
    FOR ALL USING (quotation_id IN (SELECT id FROM quotations WHERE tenant_id = get_user_tenant_id()));

-- Quotation components
CREATE POLICY quotation_components_tenant_isolation ON quotation_components
    FOR ALL USING (quotation_id IN (SELECT id FROM quotations WHERE tenant_id = get_user_tenant_id()));

-- Quotation materials
CREATE POLICY quotation_materials_tenant_isolation ON quotation_materials
    FOR ALL USING (quotation_id IN (SELECT id FROM quotations WHERE tenant_id = get_user_tenant_id()));

-- Quotation cost attributes
CREATE POLICY quotation_cost_attributes_tenant_isolation ON quotation_cost_attributes
    FOR ALL USING (quotation_id IN (SELECT id FROM quotations WHERE tenant_id = get_user_tenant_id()));

-- Quotation line items
CREATE POLICY quotation_line_items_tenant_isolation ON quotation_line_items
    FOR ALL USING (quotation_id IN (SELECT id FROM quotations WHERE tenant_id = get_user_tenant_id()));

-- Quotation snapshots
CREATE POLICY quotation_snapshots_tenant_isolation ON quotation_snapshots
    FOR ALL USING (quotation_id IN (SELECT id FROM quotations WHERE tenant_id = get_user_tenant_id()));

-- Quotation changes
CREATE POLICY quotation_changes_tenant_isolation ON quotation_changes
    FOR ALL USING (quotation_id IN (SELECT id FROM quotations WHERE tenant_id = get_user_tenant_id()));

-- =====================================================
-- SECTION 26: VIEW FOR QUOTATIONS WITH LEAD DATA
-- =====================================================

CREATE OR REPLACE VIEW quotations_with_lead AS
SELECT 
    q.id, q.tenant_id, q.quotation_number, q.version, q.parent_quotation_id,
    q.lead_id, q.project_id,
    l.client_name, l.email AS client_email, l.phone AS client_phone,
    l.property_name, l.property_address, l.property_type, l.carpet_area_sqft AS carpet_area,
    l.property_city, l.flat_number, l.lead_number, l.stage AS lead_stage,
    l.budget_range, l.estimated_value, l.service_type, l.project_scope,
    q.title, q.description, q.status, q.valid_from, q.valid_until,
    q.subtotal, q.discount_type, q.discount_value, q.discount_amount,
    q.taxable_amount, q.tax_percent, q.tax_amount, q.overhead_percent, q.overhead_amount,
    q.grand_total, q.payment_terms, q.terms_and_conditions, q.notes,
    q.sent_at, q.viewed_at, q.approved_at, q.rejected_at, q.rejection_reason,
    q.auto_created, q.created_by, q.updated_by, q.created_at, q.updated_at
FROM quotations q
JOIN leads l ON l.id = q.lead_id;

COMMENT ON VIEW quotations_with_lead IS 'Quotations with client/property data from linked lead';

-- =====================================================
-- QUOTATION MODULE COMPLETE
-- =====================================================

COMMENT ON TABLE quotations IS 'Main quotation header with client and pricing details';
COMMENT ON TABLE quotation_spaces IS 'Level 1: Spaces/Rooms in the quotation';
COMMENT ON TABLE quotation_components IS 'Level 2: Components/Work items within each space';
COMMENT ON TABLE quotation_materials IS 'Level 3: Materials and specifications (legacy)';
COMMENT ON TABLE quotation_cost_attributes IS 'Level 4: Detailed cost breakdown (legacy)';
COMMENT ON TABLE quotation_line_items IS 'V2: Simplified line items with direct pricing';
COMMENT ON TABLE cost_items IS 'Master list of anything with a price - materials, hardware, labour, services';
