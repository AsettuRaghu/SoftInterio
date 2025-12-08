-- =====================================================
-- SoftInterio Stock Management Module
-- =====================================================
-- Module: Stock Management
-- Description: Inventory tracking, procurement, and 
--              material management for interior projects
-- Target: Supabase (PostgreSQL with auth integration)
-- 
-- Run Order: 9 (After seed data)
-- 
-- Dependencies:
--   - 01_core_schema.sql (tenants, users, roles)
--   - 05_quotation_module.sql (cost_items, cost_item_categories, units)
-- =====================================================

-- =====================================================
-- SECTION 1: ENUMS
-- =====================================================

-- Stock item types
CREATE TYPE stock_item_type AS ENUM (
    'raw_material',      -- Plywood, laminates, etc.
    'hardware',          -- Hinges, channels, handles
    'consumable',        -- Screws, adhesives, edge bands
    'finished_good',     -- Ready products
    'accessory'          -- Baskets, organizers
);

-- Purchase order status
CREATE TYPE po_status AS ENUM (
    'draft',
    'pending_approval',
    'approved',
    'sent',
    'partially_received',
    'received',
    'closed',
    'cancelled'
);

-- Goods receipt status
CREATE TYPE grn_status AS ENUM (
    'draft',
    'confirmed',
    'cancelled'
);

-- Stock movement types
CREATE TYPE stock_movement_type AS ENUM (
    'purchase_receipt',   -- GRN - stock in from vendor
    'purchase_return',    -- Return to vendor
    'issue_to_project',   -- Stock out to project/factory/site
    'return_from_project',-- Return from project
    'transfer',           -- Between locations
    'adjustment_in',      -- Manual adjustment (found)
    'adjustment_out',     -- Manual adjustment (lost/damaged)
    'opening_stock'       -- Initial stock entry
);

-- Stock location types
CREATE TYPE stock_location_type AS ENUM (
    'warehouse',          -- Company warehouse/godown
    'factory',            -- Third-party factory
    'site',               -- Project site
    'transit'             -- In transit
);

-- Material requirement status
CREATE TYPE material_requirement_status AS ENUM (
    'draft',
    'confirmed',
    'partially_ordered',
    'ordered',
    'partially_received',
    'received',
    'closed',
    'cancelled'
);

-- Material requirement item status
CREATE TYPE mr_item_status AS ENUM (
    'pending',
    'ordered',
    'partially_received',
    'received',
    'issued',
    'cancelled'
);

-- =====================================================
-- SECTION 2: EXTEND COST ITEMS FOR STOCK
-- =====================================================

-- Add stock-related columns to cost_items
-- (Only if columns don't exist)
DO $$
BEGIN
    -- Add is_stockable flag
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'cost_items' AND column_name = 'is_stockable') THEN
        ALTER TABLE cost_items ADD COLUMN is_stockable BOOLEAN DEFAULT false;
    END IF;
    
    -- Add stock item type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'cost_items' AND column_name = 'stock_type') THEN
        ALTER TABLE cost_items ADD COLUMN stock_type stock_item_type;
    END IF;
    
    -- Add reorder level
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'cost_items' AND column_name = 'reorder_level') THEN
        ALTER TABLE cost_items ADD COLUMN reorder_level DECIMAL(12,4) DEFAULT 0;
    END IF;
    
    -- Add minimum order quantity
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'cost_items' AND column_name = 'min_order_qty') THEN
        ALTER TABLE cost_items ADD COLUMN min_order_qty DECIMAL(12,4) DEFAULT 1;
    END IF;
    
    -- Add lead time (days)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'cost_items' AND column_name = 'lead_time_days') THEN
        ALTER TABLE cost_items ADD COLUMN lead_time_days INTEGER DEFAULT 0;
    END IF;
    
    -- Add default vendor
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'cost_items' AND column_name = 'default_vendor_id') THEN
        ALTER TABLE cost_items ADD COLUMN default_vendor_id UUID;
    END IF;
END $$;

-- =====================================================
-- SECTION 3: VENDORS
-- =====================================================

CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Basic info
    code VARCHAR(20),
    name VARCHAR(200) NOT NULL,
    display_name VARCHAR(200),
    
    -- Contact
    contact_person VARCHAR(100),
    email VARCHAR(200),
    phone VARCHAR(20),
    alternate_phone VARCHAR(20),
    website VARCHAR(200),
    
    -- Address
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    country VARCHAR(100) DEFAULT 'India',
    
    -- Business details
    gst_number VARCHAR(20),
    pan_number VARCHAR(20),
    
    -- Payment terms
    payment_terms TEXT,
    credit_days INTEGER DEFAULT 0,
    credit_limit DECIMAL(14,2),
    
    -- Categories supplied (references cost_item_categories)
    category_ids UUID[],
    
    -- Banking (for payments)
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(30),
    bank_ifsc VARCHAR(20),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    
    -- Audit
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, code)
);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_vendors_tenant ON vendors(tenant_id, is_active);
CREATE INDEX idx_vendors_name ON vendors(tenant_id, name);
CREATE INDEX idx_vendors_code ON vendors(tenant_id, code);

-- Add foreign key from cost_items to vendors
ALTER TABLE cost_items 
    ADD CONSTRAINT fk_cost_items_vendor 
    FOREIGN KEY (default_vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;

-- =====================================================
-- SECTION 4: VENDOR ITEMS (Price List)
-- =====================================================

CREATE TABLE IF NOT EXISTS vendor_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    cost_item_id UUID NOT NULL REFERENCES cost_items(id) ON DELETE CASCADE,
    
    -- Vendor's item details
    vendor_sku VARCHAR(50),
    vendor_item_name VARCHAR(200),
    
    -- Pricing
    unit_price DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    price_valid_from DATE,
    price_valid_to DATE,
    min_order_qty DECIMAL(12,4) DEFAULT 1,
    
    -- Lead time
    lead_time_days INTEGER DEFAULT 0,
    
    -- Status
    is_preferred BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, vendor_id, cost_item_id)
);

ALTER TABLE vendor_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_vendor_items_vendor ON vendor_items(vendor_id);
CREATE INDEX idx_vendor_items_item ON vendor_items(cost_item_id);

-- =====================================================
-- SECTION 5: STOCK LOCATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS stock_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Basic info
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    location_type stock_location_type NOT NULL,
    
    -- For factory/site types, link to project
    project_id UUID,
    
    -- Address
    address TEXT,
    city VARCHAR(100),
    contact_person VARCHAR(100),
    contact_phone VARCHAR(20),
    
    -- Settings
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, code)
);

ALTER TABLE stock_locations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_stock_locations_tenant ON stock_locations(tenant_id, is_active);
CREATE INDEX idx_stock_locations_type ON stock_locations(tenant_id, location_type);

-- =====================================================
-- SECTION 6: STOCK LEVELS
-- =====================================================

CREATE TABLE IF NOT EXISTS stock_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cost_item_id UUID NOT NULL REFERENCES cost_items(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES stock_locations(id) ON DELETE CASCADE,
    
    -- Quantities
    quantity DECIMAL(14,4) NOT NULL DEFAULT 0,
    reserved_qty DECIMAL(14,4) NOT NULL DEFAULT 0,  -- Reserved for projects
    available_qty DECIMAL(14,4) GENERATED ALWAYS AS (quantity - reserved_qty) STORED,
    
    -- Valuation
    avg_cost DECIMAL(12,2) DEFAULT 0,
    total_value DECIMAL(14,2) GENERATED ALWAYS AS (quantity * avg_cost) STORED,
    
    -- Last activity
    last_receipt_date TIMESTAMPTZ,
    last_issue_date TIMESTAMPTZ,
    
    -- Audit
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, cost_item_id, location_id)
);

ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_stock_levels_item ON stock_levels(cost_item_id);
CREATE INDEX idx_stock_levels_location ON stock_levels(location_id);
CREATE INDEX idx_stock_levels_tenant ON stock_levels(tenant_id);

-- =====================================================
-- SECTION 7: MATERIAL REQUIREMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS material_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Identification
    mr_number VARCHAR(30) NOT NULL,
    
    -- Link to project/quotation
    project_id UUID,
    quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    
    -- Details
    title VARCHAR(200),
    description TEXT,
    source VARCHAR(50),  -- 'factory', 'design', 'manual'
    
    -- Dates
    required_date DATE,
    
    -- Status
    status material_requirement_status DEFAULT 'draft',
    
    -- Totals (calculated)
    total_items INTEGER DEFAULT 0,
    total_value DECIMAL(14,2) DEFAULT 0,
    
    -- Audit
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, mr_number)
);

ALTER TABLE material_requirements ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_material_requirements_tenant ON material_requirements(tenant_id);
CREATE INDEX idx_material_requirements_project ON material_requirements(project_id);
CREATE INDEX idx_material_requirements_quotation ON material_requirements(quotation_id);
CREATE INDEX idx_material_requirements_status ON material_requirements(tenant_id, status);

-- =====================================================
-- SECTION 8: MATERIAL REQUIREMENT ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS material_requirement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mr_id UUID NOT NULL REFERENCES material_requirements(id) ON DELETE CASCADE,
    cost_item_id UUID NOT NULL REFERENCES cost_items(id) ON DELETE CASCADE,
    
    -- From quotation (if applicable)
    quotation_line_item_id UUID REFERENCES quotation_line_items(id) ON DELETE SET NULL,
    
    -- Quantities
    required_qty DECIMAL(12,4) NOT NULL,
    unit_code VARCHAR(20) NOT NULL REFERENCES units(code),
    
    -- Stock check (calculated/cached)
    available_qty DECIMAL(12,4) DEFAULT 0,
    to_order_qty DECIMAL(12,4) DEFAULT 0,
    
    -- Order tracking
    ordered_qty DECIMAL(12,4) DEFAULT 0,
    received_qty DECIMAL(12,4) DEFAULT 0,
    issued_qty DECIMAL(12,4) DEFAULT 0,
    
    -- Pricing
    estimated_rate DECIMAL(12,2),
    estimated_amount DECIMAL(14,2),
    
    -- Status
    status mr_item_status DEFAULT 'pending',
    
    -- Notes
    notes TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE material_requirement_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_mr_items_mr ON material_requirement_items(mr_id);
CREATE INDEX idx_mr_items_item ON material_requirement_items(cost_item_id);

-- =====================================================
-- SECTION 9: PURCHASE ORDERS
-- =====================================================

CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Identification
    po_number VARCHAR(30) NOT NULL,
    
    -- Vendor
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    
    -- Type
    po_type VARCHAR(20) DEFAULT 'project',  -- 'project' or 'stock'
    
    -- Link to project (for project POs)
    project_id UUID,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    material_requirement_id UUID REFERENCES material_requirements(id) ON DELETE SET NULL,
    
    -- Dates
    po_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date DATE,
    
    -- Delivery
    delivery_location_id UUID REFERENCES stock_locations(id),
    delivery_address TEXT,
    
    -- Status & Approval
    status po_status DEFAULT 'draft',
    requires_approval BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Terms
    payment_terms TEXT,
    notes TEXT,
    terms_and_conditions TEXT,
    
    -- Amounts
    subtotal DECIMAL(14,2) DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(14,2) DEFAULT 0,
    tax_percent DECIMAL(5,2) DEFAULT 18,
    tax_amount DECIMAL(14,2) DEFAULT 0,
    other_charges DECIMAL(14,2) DEFAULT 0,
    grand_total DECIMAL(14,2) DEFAULT 0,
    
    -- Received tracking
    received_amount DECIMAL(14,2) DEFAULT 0,
    
    -- Audit
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancelled_reason TEXT,
    
    UNIQUE(tenant_id, po_number)
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_purchase_orders_tenant ON purchase_orders(tenant_id);
CREATE INDEX idx_purchase_orders_vendor ON purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(tenant_id, status);
CREATE INDEX idx_purchase_orders_project ON purchase_orders(project_id);
CREATE INDEX idx_purchase_orders_date ON purchase_orders(tenant_id, po_date DESC);

-- =====================================================
-- SECTION 10: PURCHASE ORDER ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    cost_item_id UUID NOT NULL REFERENCES cost_items(id) ON DELETE RESTRICT,
    
    -- Link to MR item (if from material requirement)
    mr_item_id UUID REFERENCES material_requirement_items(id) ON DELETE SET NULL,
    
    -- Description (can override item name)
    description TEXT,
    
    -- Quantity
    quantity DECIMAL(12,4) NOT NULL,
    unit_code VARCHAR(20) NOT NULL REFERENCES units(code),
    
    -- Pricing
    unit_price DECIMAL(12,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    tax_percent DECIMAL(5,2) DEFAULT 18,
    amount DECIMAL(14,2) NOT NULL,
    
    -- Received tracking
    received_qty DECIMAL(12,4) DEFAULT 0,
    pending_qty DECIMAL(12,4) GENERATED ALWAYS AS (quantity - received_qty) STORED,
    
    -- Display order
    display_order INTEGER DEFAULT 0,
    notes TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_po_items_po ON purchase_order_items(po_id);
CREATE INDEX idx_po_items_item ON purchase_order_items(cost_item_id);

-- =====================================================
-- SECTION 11: GOODS RECEIPTS (GRN)
-- =====================================================

CREATE TABLE IF NOT EXISTS goods_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Identification
    grn_number VARCHAR(30) NOT NULL,
    
    -- Reference
    po_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    
    -- Receipt details
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    location_id UUID NOT NULL REFERENCES stock_locations(id),
    
    -- Vendor documents
    vendor_invoice_number VARCHAR(50),
    vendor_invoice_date DATE,
    vendor_challan_number VARCHAR(50),
    
    -- Status
    status grn_status DEFAULT 'draft',
    
    -- Amounts (from vendor invoice)
    subtotal DECIMAL(14,2) DEFAULT 0,
    tax_amount DECIMAL(14,2) DEFAULT 0,
    other_charges DECIMAL(14,2) DEFAULT 0,
    grand_total DECIMAL(14,2) DEFAULT 0,
    
    -- Notes
    notes TEXT,
    
    -- Audit
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    confirmed_by UUID REFERENCES users(id),
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, grn_number)
);

ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_goods_receipts_tenant ON goods_receipts(tenant_id);
CREATE INDEX idx_goods_receipts_po ON goods_receipts(po_id);
CREATE INDEX idx_goods_receipts_vendor ON goods_receipts(vendor_id);
CREATE INDEX idx_goods_receipts_date ON goods_receipts(tenant_id, receipt_date DESC);

-- =====================================================
-- SECTION 12: GOODS RECEIPT ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    po_item_id UUID REFERENCES purchase_order_items(id) ON DELETE SET NULL,
    cost_item_id UUID NOT NULL REFERENCES cost_items(id) ON DELETE RESTRICT,
    
    -- Quantities
    ordered_qty DECIMAL(12,4),           -- From PO
    received_qty DECIMAL(12,4) NOT NULL, -- Actually received
    accepted_qty DECIMAL(12,4) NOT NULL, -- Accepted after QC
    rejected_qty DECIMAL(12,4) DEFAULT 0,
    unit_code VARCHAR(20) NOT NULL REFERENCES units(code),
    
    -- Pricing
    unit_price DECIMAL(12,2) NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    
    -- Quality check
    rejection_reason TEXT,
    
    -- Batch/Lot (optional, for future)
    batch_number VARCHAR(50),
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_grn_items_grn ON goods_receipt_items(grn_id);
CREATE INDEX idx_grn_items_po_item ON goods_receipt_items(po_item_id);

-- =====================================================
-- SECTION 13: STOCK ISSUES
-- =====================================================

CREATE TABLE IF NOT EXISTS stock_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Identification
    issue_number VARCHAR(30) NOT NULL,
    
    -- Reference
    project_id UUID,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    material_requirement_id UUID REFERENCES material_requirements(id) ON DELETE SET NULL,
    
    -- Locations
    from_location_id UUID NOT NULL REFERENCES stock_locations(id),
    to_location_id UUID REFERENCES stock_locations(id),  -- For transfers
    
    -- Issue details
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    issue_type VARCHAR(20) NOT NULL,  -- 'project', 'transfer', 'return'
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft',  -- 'draft', 'confirmed', 'cancelled'
    
    -- Notes
    purpose TEXT,
    notes TEXT,
    
    -- Audit
    created_by UUID REFERENCES users(id),
    confirmed_by UUID REFERENCES users(id),
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, issue_number)
);

ALTER TABLE stock_issues ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_stock_issues_tenant ON stock_issues(tenant_id);
CREATE INDEX idx_stock_issues_project ON stock_issues(project_id);
CREATE INDEX idx_stock_issues_date ON stock_issues(tenant_id, issue_date DESC);

-- =====================================================
-- SECTION 14: STOCK ISSUE ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS stock_issue_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES stock_issues(id) ON DELETE CASCADE,
    cost_item_id UUID NOT NULL REFERENCES cost_items(id) ON DELETE RESTRICT,
    mr_item_id UUID REFERENCES material_requirement_items(id) ON DELETE SET NULL,
    
    -- Quantity
    quantity DECIMAL(12,4) NOT NULL,
    unit_code VARCHAR(20) NOT NULL REFERENCES units(code),
    
    -- Valuation (at time of issue)
    unit_cost DECIMAL(12,2) NOT NULL,
    total_cost DECIMAL(14,2) NOT NULL,
    
    -- Notes
    notes TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stock_issue_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_issue_items_issue ON stock_issue_items(issue_id);
CREATE INDEX idx_issue_items_item ON stock_issue_items(cost_item_id);

-- =====================================================
-- SECTION 15: STOCK MOVEMENTS (Audit Trail)
-- =====================================================

CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Item & Location
    cost_item_id UUID NOT NULL REFERENCES cost_items(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES stock_locations(id) ON DELETE CASCADE,
    
    -- Movement details
    movement_type stock_movement_type NOT NULL,
    movement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Quantity (positive = in, negative = out)
    quantity DECIMAL(14,4) NOT NULL,
    unit_code VARCHAR(20) NOT NULL REFERENCES units(code),
    
    -- Valuation
    unit_cost DECIMAL(12,2),
    total_cost DECIMAL(14,2),
    
    -- Running balance (after this movement)
    balance_qty DECIMAL(14,4) NOT NULL,
    balance_value DECIMAL(14,2),
    
    -- References
    reference_type VARCHAR(30),  -- 'grn', 'issue', 'adjustment', 'transfer'
    reference_id UUID,
    reference_number VARCHAR(50),
    
    -- Project link
    project_id UUID,
    
    -- Notes
    notes TEXT,
    
    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_stock_movements_tenant ON stock_movements(tenant_id);
CREATE INDEX idx_stock_movements_item ON stock_movements(cost_item_id);
CREATE INDEX idx_stock_movements_location ON stock_movements(location_id);
CREATE INDEX idx_stock_movements_date ON stock_movements(tenant_id, movement_date DESC);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX idx_stock_movements_project ON stock_movements(project_id);

-- =====================================================
-- SECTION 16: STOCK ADJUSTMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS stock_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Identification
    adjustment_number VARCHAR(30) NOT NULL,
    
    -- Details
    adjustment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    location_id UUID NOT NULL REFERENCES stock_locations(id),
    reason VARCHAR(50) NOT NULL,  -- 'physical_count', 'damage', 'expiry', 'other'
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft',  -- 'draft', 'confirmed', 'cancelled'
    
    -- Notes
    notes TEXT,
    
    -- Audit
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, adjustment_number)
);

ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_stock_adjustments_tenant ON stock_adjustments(tenant_id);
CREATE INDEX idx_stock_adjustments_date ON stock_adjustments(tenant_id, adjustment_date DESC);

-- =====================================================
-- SECTION 17: STOCK ADJUSTMENT ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS stock_adjustment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_id UUID NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
    cost_item_id UUID NOT NULL REFERENCES cost_items(id) ON DELETE RESTRICT,
    
    -- Quantities
    system_qty DECIMAL(12,4) NOT NULL,   -- What system shows
    actual_qty DECIMAL(12,4) NOT NULL,   -- What's physically there
    variance_qty DECIMAL(12,4) GENERATED ALWAYS AS (actual_qty - system_qty) STORED,
    unit_code VARCHAR(20) NOT NULL REFERENCES units(code),
    
    -- Valuation
    unit_cost DECIMAL(12,2),
    variance_value DECIMAL(14,2),
    
    -- Notes
    notes TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stock_adjustment_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_adjustment_items_adjustment ON stock_adjustment_items(adjustment_id);

-- =====================================================
-- SECTION 18: TENANT STOCK SETTINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS tenant_stock_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    
    -- PO Settings
    po_requires_approval BOOLEAN DEFAULT false,
    po_approval_threshold DECIMAL(14,2) DEFAULT 0,  -- Above this amount needs approval
    po_number_prefix VARCHAR(10) DEFAULT 'PO',
    po_auto_number BOOLEAN DEFAULT true,
    
    -- GRN Settings
    grn_number_prefix VARCHAR(10) DEFAULT 'GRN',
    grn_auto_number BOOLEAN DEFAULT true,
    allow_over_receipt BOOLEAN DEFAULT false,       -- Receive more than ordered
    over_receipt_tolerance DECIMAL(5,2) DEFAULT 0,  -- % tolerance
    
    -- Issue Settings
    issue_number_prefix VARCHAR(10) DEFAULT 'ISS',
    issue_auto_number BOOLEAN DEFAULT true,
    
    -- MR Settings
    mr_number_prefix VARCHAR(10) DEFAULT 'MR',
    mr_auto_number BOOLEAN DEFAULT true,
    
    -- Stock Settings
    allow_negative_stock BOOLEAN DEFAULT false,
    stock_valuation_method VARCHAR(20) DEFAULT 'avg_cost',  -- 'avg_cost', 'fifo', 'lifo'
    
    -- Defaults
    default_warehouse_id UUID REFERENCES stock_locations(id),
    default_tax_percent DECIMAL(5,2) DEFAULT 18,
    
    -- Audit
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tenant_stock_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SECTION 19: NUMBER GENERATION FUNCTIONS
-- =====================================================

-- Generate PO number
CREATE OR REPLACE FUNCTION generate_po_number(p_tenant_id UUID)
RETURNS VARCHAR(30) AS $$
DECLARE
    v_prefix VARCHAR(10);
    v_year VARCHAR(4);
    v_count INTEGER;
    v_number VARCHAR(30);
BEGIN
    SELECT COALESCE(po_number_prefix, 'PO') INTO v_prefix
    FROM tenant_stock_settings WHERE tenant_id = p_tenant_id;
    
    v_prefix := COALESCE(v_prefix, 'PO');
    v_year := TO_CHAR(CURRENT_DATE, 'YY');
    
    SELECT COUNT(*) + 1 INTO v_count
    FROM purchase_orders
    WHERE tenant_id = p_tenant_id
    AND po_number LIKE v_prefix || '-' || v_year || '-%';
    
    v_number := v_prefix || '-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
    
    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Generate GRN number
CREATE OR REPLACE FUNCTION generate_grn_number(p_tenant_id UUID)
RETURNS VARCHAR(30) AS $$
DECLARE
    v_prefix VARCHAR(10);
    v_year VARCHAR(4);
    v_count INTEGER;
    v_number VARCHAR(30);
BEGIN
    SELECT COALESCE(grn_number_prefix, 'GRN') INTO v_prefix
    FROM tenant_stock_settings WHERE tenant_id = p_tenant_id;
    
    v_prefix := COALESCE(v_prefix, 'GRN');
    v_year := TO_CHAR(CURRENT_DATE, 'YY');
    
    SELECT COUNT(*) + 1 INTO v_count
    FROM goods_receipts
    WHERE tenant_id = p_tenant_id
    AND grn_number LIKE v_prefix || '-' || v_year || '-%';
    
    v_number := v_prefix || '-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
    
    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Generate Issue number
CREATE OR REPLACE FUNCTION generate_issue_number(p_tenant_id UUID)
RETURNS VARCHAR(30) AS $$
DECLARE
    v_prefix VARCHAR(10);
    v_year VARCHAR(4);
    v_count INTEGER;
    v_number VARCHAR(30);
BEGIN
    SELECT COALESCE(issue_number_prefix, 'ISS') INTO v_prefix
    FROM tenant_stock_settings WHERE tenant_id = p_tenant_id;
    
    v_prefix := COALESCE(v_prefix, 'ISS');
    v_year := TO_CHAR(CURRENT_DATE, 'YY');
    
    SELECT COUNT(*) + 1 INTO v_count
    FROM stock_issues
    WHERE tenant_id = p_tenant_id
    AND issue_number LIKE v_prefix || '-' || v_year || '-%';
    
    v_number := v_prefix || '-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
    
    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Generate MR number
CREATE OR REPLACE FUNCTION generate_mr_number(p_tenant_id UUID)
RETURNS VARCHAR(30) AS $$
DECLARE
    v_prefix VARCHAR(10);
    v_year VARCHAR(4);
    v_count INTEGER;
    v_number VARCHAR(30);
BEGIN
    SELECT COALESCE(mr_number_prefix, 'MR') INTO v_prefix
    FROM tenant_stock_settings WHERE tenant_id = p_tenant_id;
    
    v_prefix := COALESCE(v_prefix, 'MR');
    v_year := TO_CHAR(CURRENT_DATE, 'YY');
    
    SELECT COUNT(*) + 1 INTO v_count
    FROM material_requirements
    WHERE tenant_id = p_tenant_id
    AND mr_number LIKE v_prefix || '-' || v_year || '-%';
    
    v_number := v_prefix || '-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
    
    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SECTION 20: AUTO-NUMBER TRIGGERS
-- =====================================================

-- PO auto-number
CREATE OR REPLACE FUNCTION trigger_set_po_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
        NEW.po_number := generate_po_number(NEW.tenant_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_po_number
    BEFORE INSERT ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_po_number();

-- GRN auto-number
CREATE OR REPLACE FUNCTION trigger_set_grn_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.grn_number IS NULL OR NEW.grn_number = '' THEN
        NEW.grn_number := generate_grn_number(NEW.tenant_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_grn_number
    BEFORE INSERT ON goods_receipts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_grn_number();

-- Issue auto-number
CREATE OR REPLACE FUNCTION trigger_set_issue_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.issue_number IS NULL OR NEW.issue_number = '' THEN
        NEW.issue_number := generate_issue_number(NEW.tenant_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_issue_number
    BEFORE INSERT ON stock_issues
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_issue_number();

-- MR auto-number
CREATE OR REPLACE FUNCTION trigger_set_mr_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.mr_number IS NULL OR NEW.mr_number = '' THEN
        NEW.mr_number := generate_mr_number(NEW.tenant_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_mr_number
    BEFORE INSERT ON material_requirements
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_mr_number();

-- =====================================================
-- SECTION 21: STOCK CALCULATION TRIGGERS
-- =====================================================

-- Calculate PO totals
CREATE OR REPLACE FUNCTION calculate_po_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_subtotal DECIMAL(14,2);
    v_discount DECIMAL(14,2);
    v_tax DECIMAL(14,2);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_subtotal
    FROM purchase_order_items
    WHERE po_id = COALESCE(NEW.po_id, OLD.po_id);
    
    UPDATE purchase_orders
    SET 
        subtotal = v_subtotal,
        discount_amount = v_subtotal * (discount_percent / 100),
        tax_amount = (v_subtotal - (v_subtotal * discount_percent / 100)) * (tax_percent / 100),
        grand_total = (v_subtotal - (v_subtotal * discount_percent / 100)) * (1 + tax_percent / 100) + other_charges,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.po_id, OLD.po_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calc_po_totals
AFTER INSERT OR UPDATE OR DELETE ON purchase_order_items
FOR EACH ROW EXECUTE FUNCTION calculate_po_totals();

-- Update stock on GRN confirmation
CREATE OR REPLACE FUNCTION update_stock_on_grn()
RETURNS TRIGGER AS $$
DECLARE
    v_item RECORD;
    v_current_qty DECIMAL(14,4);
    v_current_value DECIMAL(14,2);
    v_new_qty DECIMAL(14,4);
    v_new_avg_cost DECIMAL(12,2);
    v_location_id UUID;
    v_tenant_id UUID;
BEGIN
    IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
        v_location_id := NEW.location_id;
        v_tenant_id := NEW.tenant_id;
        
        FOR v_item IN 
            SELECT cost_item_id, accepted_qty, unit_price, unit_code
            FROM goods_receipt_items WHERE grn_id = NEW.id
        LOOP
            -- Get current stock
            SELECT COALESCE(quantity, 0), COALESCE(avg_cost, 0)
            INTO v_current_qty, v_current_value
            FROM stock_levels
            WHERE cost_item_id = v_item.cost_item_id 
            AND location_id = v_location_id;
            
            IF NOT FOUND THEN
                v_current_qty := 0;
                v_current_value := 0;
            END IF;
            
            v_new_qty := v_current_qty + v_item.accepted_qty;
            
            -- Calculate new average cost
            IF v_new_qty > 0 THEN
                v_new_avg_cost := ((v_current_qty * v_current_value) + (v_item.accepted_qty * v_item.unit_price)) / v_new_qty;
            ELSE
                v_new_avg_cost := v_item.unit_price;
            END IF;
            
            -- Upsert stock level
            INSERT INTO stock_levels (tenant_id, cost_item_id, location_id, quantity, avg_cost, last_receipt_date)
            VALUES (v_tenant_id, v_item.cost_item_id, v_location_id, v_item.accepted_qty, v_new_avg_cost, NOW())
            ON CONFLICT (tenant_id, cost_item_id, location_id)
            DO UPDATE SET
                quantity = stock_levels.quantity + v_item.accepted_qty,
                avg_cost = v_new_avg_cost,
                last_receipt_date = NOW(),
                updated_at = NOW();
            
            -- Create stock movement
            INSERT INTO stock_movements (
                tenant_id, cost_item_id, location_id, movement_type, quantity, unit_code,
                unit_cost, total_cost, balance_qty, balance_value,
                reference_type, reference_id, reference_number, created_by
            ) VALUES (
                v_tenant_id, v_item.cost_item_id, v_location_id, 'purchase_receipt', 
                v_item.accepted_qty, v_item.unit_code,
                v_item.unit_price, v_item.accepted_qty * v_item.unit_price,
                v_new_qty, v_new_qty * v_new_avg_cost,
                'grn', NEW.id, NEW.grn_number, NEW.confirmed_by
            );
            
            -- Update PO item received qty
            IF v_item.cost_item_id IS NOT NULL THEN
                UPDATE purchase_order_items
                SET received_qty = received_qty + v_item.accepted_qty, updated_at = NOW()
                WHERE id = (SELECT po_item_id FROM goods_receipt_items WHERE grn_id = NEW.id AND cost_item_id = v_item.cost_item_id LIMIT 1);
            END IF;
        END LOOP;
        
        -- Update PO status if applicable
        IF NEW.po_id IS NOT NULL THEN
            PERFORM update_po_status(NEW.po_id);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_stock_on_grn
AFTER UPDATE ON goods_receipts
FOR EACH ROW EXECUTE FUNCTION update_stock_on_grn();

-- Update PO status based on receipts
CREATE OR REPLACE FUNCTION update_po_status(p_po_id UUID)
RETURNS void AS $$
DECLARE
    v_total_qty DECIMAL(14,4);
    v_received_qty DECIMAL(14,4);
    v_new_status po_status;
BEGIN
    SELECT COALESCE(SUM(quantity), 0), COALESCE(SUM(received_qty), 0)
    INTO v_total_qty, v_received_qty
    FROM purchase_order_items
    WHERE po_id = p_po_id;
    
    IF v_received_qty = 0 THEN
        v_new_status := 'sent';
    ELSIF v_received_qty < v_total_qty THEN
        v_new_status := 'partially_received';
    ELSE
        v_new_status := 'received';
    END IF;
    
    UPDATE purchase_orders
    SET status = v_new_status, updated_at = NOW()
    WHERE id = p_po_id AND status IN ('sent', 'partially_received');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SECTION 22: RLS POLICIES
-- =====================================================

-- Vendors
CREATE POLICY vendors_tenant_isolation ON vendors
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Vendor Items
CREATE POLICY vendor_items_tenant_isolation ON vendor_items
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Stock Locations
CREATE POLICY stock_locations_tenant_isolation ON stock_locations
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Stock Levels
CREATE POLICY stock_levels_tenant_isolation ON stock_levels
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Material Requirements
CREATE POLICY material_requirements_tenant_isolation ON material_requirements
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Material Requirement Items
CREATE POLICY mr_items_tenant_isolation ON material_requirement_items
    FOR ALL USING (mr_id IN (SELECT id FROM material_requirements WHERE tenant_id = get_user_tenant_id()));

-- Purchase Orders
CREATE POLICY purchase_orders_tenant_isolation ON purchase_orders
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Purchase Order Items
CREATE POLICY po_items_tenant_isolation ON purchase_order_items
    FOR ALL USING (po_id IN (SELECT id FROM purchase_orders WHERE tenant_id = get_user_tenant_id()));

-- Goods Receipts
CREATE POLICY goods_receipts_tenant_isolation ON goods_receipts
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Goods Receipt Items
CREATE POLICY grn_items_tenant_isolation ON goods_receipt_items
    FOR ALL USING (grn_id IN (SELECT id FROM goods_receipts WHERE tenant_id = get_user_tenant_id()));

-- Stock Issues
CREATE POLICY stock_issues_tenant_isolation ON stock_issues
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Stock Issue Items
CREATE POLICY issue_items_tenant_isolation ON stock_issue_items
    FOR ALL USING (issue_id IN (SELECT id FROM stock_issues WHERE tenant_id = get_user_tenant_id()));

-- Stock Movements
CREATE POLICY stock_movements_tenant_isolation ON stock_movements
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Stock Adjustments
CREATE POLICY stock_adjustments_tenant_isolation ON stock_adjustments
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Stock Adjustment Items
CREATE POLICY adjustment_items_tenant_isolation ON stock_adjustment_items
    FOR ALL USING (adjustment_id IN (SELECT id FROM stock_adjustments WHERE tenant_id = get_user_tenant_id()));

-- Tenant Stock Settings
CREATE POLICY tenant_stock_settings_tenant_isolation ON tenant_stock_settings
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- =====================================================
-- SECTION 23: PERMISSIONS
-- =====================================================

INSERT INTO permissions (key, description, module) VALUES
    -- Stock Management
    ('stock.dashboard', 'View stock dashboard', 'stock'),
    ('stock.view', 'View stock levels', 'stock'),
    ('stock.adjust', 'Make stock adjustments', 'stock'),
    ('stock.transfer', 'Transfer stock between locations', 'stock'),
    ('stock.reports', 'View stock reports', 'stock'),
    
    -- Materials
    ('materials.view', 'View material catalog', 'stock'),
    ('materials.create', 'Add new materials', 'stock'),
    ('materials.edit', 'Edit materials', 'stock'),
    ('materials.delete', 'Delete materials', 'stock'),
    
    -- Vendors
    ('vendors.view', 'View vendors', 'stock'),
    ('vendors.create', 'Add new vendors', 'stock'),
    ('vendors.edit', 'Edit vendors', 'stock'),
    ('vendors.delete', 'Delete vendors', 'stock'),
    
    -- Material Requirements
    ('mr.view', 'View material requirements', 'stock'),
    ('mr.create', 'Create material requirements', 'stock'),
    ('mr.edit', 'Edit material requirements', 'stock'),
    ('mr.delete', 'Delete material requirements', 'stock'),
    
    -- Purchase Orders
    ('po.view', 'View purchase orders', 'stock'),
    ('po.create', 'Create purchase orders', 'stock'),
    ('po.edit', 'Edit purchase orders', 'stock'),
    ('po.delete', 'Delete purchase orders', 'stock'),
    ('po.approve', 'Approve purchase orders', 'stock'),
    ('po.send', 'Send PO to vendor', 'stock'),
    
    -- Goods Receipt
    ('grn.view', 'View goods receipts', 'stock'),
    ('grn.create', 'Create goods receipts', 'stock'),
    ('grn.confirm', 'Confirm goods receipts', 'stock'),
    
    -- Stock Issues
    ('issue.view', 'View stock issues', 'stock'),
    ('issue.create', 'Create stock issues', 'stock'),
    ('issue.confirm', 'Confirm stock issues', 'stock'),
    
    -- Settings
    ('stock.settings', 'Manage stock settings', 'stock')
ON CONFLICT (key) DO NOTHING;

-- Grant to Owner
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Owner' AND p.module = 'stock'
ON CONFLICT DO NOTHING;

-- Grant to Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Admin' AND p.module = 'stock'
ON CONFLICT DO NOTHING;

-- Grant to Procurement
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Procurement' AND p.key IN (
    'stock.dashboard', 'stock.view', 'stock.adjust', 'stock.transfer', 'stock.reports',
    'materials.view', 'materials.create', 'materials.edit',
    'vendors.view', 'vendors.create', 'vendors.edit',
    'mr.view', 'mr.create', 'mr.edit',
    'po.view', 'po.create', 'po.edit', 'po.send',
    'grn.view', 'grn.create', 'grn.confirm',
    'issue.view', 'issue.create', 'issue.confirm'
)
ON CONFLICT DO NOTHING;

-- Grant to Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Manager' AND p.key IN (
    'stock.dashboard', 'stock.view', 'stock.reports',
    'materials.view', 'vendors.view',
    'mr.view', 'mr.create', 'mr.edit',
    'po.view', 'po.create', 'po.approve',
    'grn.view', 'issue.view'
)
ON CONFLICT DO NOTHING;

-- Grant to Designer (limited view)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Designer' AND p.key IN (
    'stock.view', 'materials.view', 'mr.view'
)
ON CONFLICT DO NOTHING;

-- Grant to Finance (approve POs)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Finance' AND p.key IN (
    'stock.dashboard', 'stock.view', 'stock.reports',
    'materials.view', 'vendors.view',
    'po.view', 'po.approve',
    'grn.view'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SECTION 24: USEFUL VIEWS
-- =====================================================

-- Stock summary by item
CREATE OR REPLACE VIEW stock_summary AS
SELECT 
    ci.id AS cost_item_id,
    ci.tenant_id,
    ci.name AS item_name,
    ci.slug,
    cic.name AS category_name,
    ci.unit_code,
    ci.default_rate,
    ci.reorder_level,
    COALESCE(SUM(sl.quantity), 0) AS total_qty,
    COALESCE(SUM(sl.reserved_qty), 0) AS reserved_qty,
    COALESCE(SUM(sl.available_qty), 0) AS available_qty,
    COALESCE(SUM(sl.total_value), 0) AS total_value,
    CASE 
        WHEN COALESCE(SUM(sl.quantity), 0) <= 0 THEN 'out_of_stock'
        WHEN COALESCE(SUM(sl.quantity), 0) <= ci.reorder_level THEN 'low_stock'
        ELSE 'in_stock'
    END AS stock_status
FROM cost_items ci
LEFT JOIN cost_item_categories cic ON cic.id = ci.category_id
LEFT JOIN stock_levels sl ON sl.cost_item_id = ci.id
WHERE ci.is_stockable = true
GROUP BY ci.id, ci.tenant_id, ci.name, ci.slug, cic.name, ci.unit_code, ci.default_rate, ci.reorder_level;

-- Project material status
CREATE OR REPLACE VIEW project_material_status AS
SELECT 
    mr.project_id,
    mr.tenant_id,
    mr.quotation_id,
    mr.id AS mr_id,
    mr.mr_number,
    mri.cost_item_id,
    ci.name AS item_name,
    mri.required_qty,
    mri.ordered_qty,
    mri.received_qty,
    mri.issued_qty,
    mri.unit_code,
    mri.status AS item_status,
    CASE 
        WHEN mri.issued_qty >= mri.required_qty THEN 'complete'
        WHEN mri.received_qty > 0 THEN 'partially_received'
        WHEN mri.ordered_qty > 0 THEN 'ordered'
        ELSE 'pending'
    END AS procurement_status
FROM material_requirements mr
JOIN material_requirement_items mri ON mri.mr_id = mr.id
JOIN cost_items ci ON ci.id = mri.cost_item_id
WHERE mr.status != 'cancelled';

-- Pending PO approvals
CREATE OR REPLACE VIEW pending_po_approvals AS
SELECT 
    po.*,
    v.name AS vendor_name,
    u.name AS created_by_name
FROM purchase_orders po
JOIN vendors v ON v.id = po.vendor_id
LEFT JOIN users u ON u.id = po.created_by
WHERE po.status = 'pending_approval';

-- =====================================================
-- SECTION 25: COMMENTS
-- =====================================================

COMMENT ON TABLE vendors IS 'Supplier/Vendor directory';
COMMENT ON TABLE vendor_items IS 'Vendor-specific pricing for items';
COMMENT ON TABLE stock_locations IS 'Physical locations where stock is stored (warehouse, factory, site)';
COMMENT ON TABLE stock_levels IS 'Current stock quantity per item per location';
COMMENT ON TABLE material_requirements IS 'Material needs for a project from factory/design';
COMMENT ON TABLE purchase_orders IS 'Purchase orders to vendors';
COMMENT ON TABLE goods_receipts IS 'Goods Receipt Notes - receiving stock from vendors';
COMMENT ON TABLE stock_issues IS 'Stock issues to projects/locations';
COMMENT ON TABLE stock_movements IS 'Audit trail of all stock movements';
COMMENT ON TABLE stock_adjustments IS 'Manual stock adjustments (physical count, damage, etc.)';
COMMENT ON TABLE tenant_stock_settings IS 'Per-tenant configuration for stock module';

-- =====================================================
-- STOCK MANAGEMENT MODULE COMPLETE
-- =====================================================
