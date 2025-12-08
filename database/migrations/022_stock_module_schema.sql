-- =====================================================
-- Stock Module Schema & Seed Data
-- =====================================================
-- Creates stock management tables and populates with
-- realistic interior design materials and vendors
-- =====================================================

-- ============================================================================
-- SECTION 0: DROP EXISTING OBJECTS (for clean re-run)
-- This also cleans up objects from the old 09_stock_management_module.sql
-- ============================================================================

-- Drop tables from OLD schema FIRST (09_stock_management_module.sql)
-- This includes the 'vendors' table that conflicts with the view
DROP TABLE IF EXISTS grn_items CASCADE;
DROP TABLE IF EXISTS grn CASCADE;
DROP TABLE IF EXISTS goods_receipt_notes CASCADE;
DROP TABLE IF EXISTS goods_receipt_note_items CASCADE;
DROP TABLE IF EXISTS po_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS material_requirement_items CASCADE;
DROP TABLE IF EXISTS material_requirements CASCADE;
DROP TABLE IF EXISTS stock_levels CASCADE;
DROP TABLE IF EXISTS stock_locations CASCADE;
DROP TABLE IF EXISTS vendor_items CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;

-- Now drop tables from NEW schema (reverse dependency order)
DROP TABLE IF EXISTS stock_goods_receipt_items CASCADE;
DROP TABLE IF EXISTS stock_goods_receipts CASCADE;
DROP TABLE IF EXISTS stock_purchase_order_items CASCADE;
DROP TABLE IF EXISTS stock_purchase_orders CASCADE;
DROP TABLE IF EXISTS stock_material_requisition_items CASCADE;
DROP TABLE IF EXISTS stock_material_requisitions CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS stock_materials CASCADE;
DROP TABLE IF EXISTS stock_vendors CASCADE;

-- Drop old ENUM types (from 09_stock_management_module.sql)
DROP TYPE IF EXISTS stock_item_type CASCADE;
DROP TYPE IF EXISTS po_status CASCADE;
DROP TYPE IF EXISTS grn_status CASCADE;
DROP TYPE IF EXISTS stock_movement_type CASCADE;
DROP TYPE IF EXISTS stock_location_type CASCADE;
DROP TYPE IF EXISTS material_requirement_status CASCADE;
DROP TYPE IF EXISTS mr_item_status CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS generate_po_number(UUID) CASCADE;
DROP FUNCTION IF EXISTS generate_mr_number(UUID) CASCADE;
DROP FUNCTION IF EXISTS generate_grn_number(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_stock_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_stock_level_on_movement() CASCADE;
DROP FUNCTION IF EXISTS generate_vendor_code(UUID) CASCADE;

-- ============================================================================
-- SECTION 1: CREATE STOCK TABLES
-- ============================================================================

-- 1.1 Stock Vendors Table
CREATE TABLE stock_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    alternate_phone VARCHAR(50),
    website VARCHAR(255),
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(20),
    country VARCHAR(100) DEFAULT 'India',
    gst_number VARCHAR(20),
    pan_number VARCHAR(20),
    payment_terms VARCHAR(100),
    credit_days INTEGER DEFAULT 30,
    credit_limit DECIMAL(14,2) DEFAULT 0,
    category_ids UUID[],
    bank_name VARCHAR(255),
    bank_account_number VARCHAR(50),
    bank_ifsc VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, code)
);

-- Create index for faster lookups
CREATE INDEX idx_stock_vendors_tenant ON stock_vendors(tenant_id);
CREATE INDEX idx_stock_vendors_active ON stock_vendors(tenant_id, is_active);
CREATE INDEX idx_stock_vendors_city ON stock_vendors(city);

-- 1.2 Stock Materials Table
CREATE TABLE stock_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    item_type VARCHAR(50) DEFAULT 'raw_material' CHECK (item_type IN ('raw_material', 'hardware', 'consumable', 'finished_good', 'accessory')),
    unit_of_measure VARCHAR(50) DEFAULT 'pcs',
    current_quantity DECIMAL(12,2) DEFAULT 0,
    minimum_quantity DECIMAL(12,2) DEFAULT 0,
    reorder_quantity DECIMAL(12,2) DEFAULT 0,
    unit_cost DECIMAL(12,2) DEFAULT 0,
    selling_price DECIMAL(12,2),
    preferred_vendor_id UUID REFERENCES stock_vendors(id) ON DELETE SET NULL,
    storage_location VARCHAR(255),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(company_id, sku)
);

-- Create indexes
CREATE INDEX idx_stock_materials_company ON stock_materials(company_id);
CREATE INDEX idx_stock_materials_category ON stock_materials(company_id, category);
CREATE INDEX idx_stock_materials_type ON stock_materials(company_id, item_type);
CREATE INDEX idx_stock_materials_vendor ON stock_materials(preferred_vendor_id);

-- 1.3 Material Requisitions Table
CREATE TABLE stock_material_requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    mr_number VARCHAR(50) NOT NULL,
    project_id UUID,
    requested_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    required_date DATE,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'partially_approved', 'rejected', 'fulfilled', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, mr_number)
);

CREATE INDEX idx_stock_mr_tenant ON stock_material_requisitions(tenant_id);
CREATE INDEX idx_stock_mr_status ON stock_material_requisitions(tenant_id, status);

-- 1.4 Material Requisition Items Table
CREATE TABLE stock_material_requisition_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mr_id UUID NOT NULL REFERENCES stock_material_requisitions(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES stock_materials(id) ON DELETE CASCADE,
    quantity_requested DECIMAL(12,2) NOT NULL,
    quantity_approved DECIMAL(12,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_mr_items_mr ON stock_material_requisition_items(mr_id);

-- 1.5 Purchase Orders Table
CREATE TABLE stock_purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    po_number VARCHAR(50) NOT NULL,
    vendor_id UUID NOT NULL REFERENCES stock_vendors(id),
    mr_id UUID REFERENCES stock_material_requisitions(id),
    order_date DATE DEFAULT CURRENT_DATE,
    expected_delivery DATE,
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'sent', 'partially_received', 'received', 'closed', 'cancelled')),
    subtotal DECIMAL(14,2) DEFAULT 0,
    tax_amount DECIMAL(14,2) DEFAULT 0,
    discount_amount DECIMAL(14,2) DEFAULT 0,
    total_amount DECIMAL(14,2) DEFAULT 0,
    shipping_address TEXT,
    billing_address TEXT,
    payment_terms VARCHAR(100),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, po_number)
);

CREATE INDEX idx_stock_po_tenant ON stock_purchase_orders(tenant_id);
CREATE INDEX idx_stock_po_vendor ON stock_purchase_orders(vendor_id);
CREATE INDEX idx_stock_po_status ON stock_purchase_orders(tenant_id, status);

-- 1.6 Purchase Order Items Table
CREATE TABLE stock_purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES stock_purchase_orders(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES stock_materials(id),
    quantity DECIMAL(12,2) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    tax_percent DECIMAL(5,2) DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    total_amount DECIMAL(14,2) NOT NULL,
    received_quantity DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_po_items_po ON stock_purchase_order_items(po_id);

-- 1.7 Goods Receipt Notes Table
CREATE TABLE stock_goods_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    grn_number VARCHAR(50) NOT NULL,
    po_id UUID NOT NULL REFERENCES stock_purchase_orders(id),
    received_date DATE DEFAULT CURRENT_DATE,
    received_by UUID REFERENCES users(id),
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_inspection', 'completed', 'partial')),
    delivery_note_number VARCHAR(100),
    vehicle_number VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, grn_number)
);

CREATE INDEX idx_stock_grn_tenant ON stock_goods_receipts(tenant_id);
CREATE INDEX idx_stock_grn_po ON stock_goods_receipts(po_id);

-- 1.8 Goods Receipt Items Table
CREATE TABLE stock_goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id UUID NOT NULL REFERENCES stock_goods_receipts(id) ON DELETE CASCADE,
    po_item_id UUID NOT NULL REFERENCES stock_purchase_order_items(id),
    quantity_received DECIMAL(12,2) NOT NULL,
    quantity_accepted DECIMAL(12,2) NOT NULL,
    quantity_rejected DECIMAL(12,2) DEFAULT 0,
    rejection_reason TEXT,
    storage_location VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_grn_items_grn ON stock_goods_receipt_items(grn_id);

-- 1.9 Stock Movements Table (for tracking inventory changes)
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES stock_materials(id),
    movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN ('purchase_receipt', 'purchase_return', 'issue_to_project', 'return_from_project', 'transfer', 'adjustment_in', 'adjustment_out', 'opening_stock')),
    quantity DECIMAL(12,2) NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    from_location VARCHAR(255),
    to_location VARCHAR(255),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_material ON stock_movements(material_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(tenant_id, movement_type);

-- ============================================================================
-- SECTION 2: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all stock tables
ALTER TABLE stock_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_material_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_material_requisition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stock_vendors
CREATE POLICY "Users can view vendors in their tenant" ON stock_vendors
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
    
CREATE POLICY "Users can insert vendors in their tenant" ON stock_vendors
    FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
    
CREATE POLICY "Users can update vendors in their tenant" ON stock_vendors
    FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
    
CREATE POLICY "Users can delete vendors in their tenant" ON stock_vendors
    FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- RLS Policies for stock_materials (uses company_id instead of tenant_id)
CREATE POLICY "Users can view materials in their company" ON stock_materials
    FOR SELECT USING (company_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
    
CREATE POLICY "Users can insert materials in their company" ON stock_materials
    FOR INSERT WITH CHECK (company_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
    
CREATE POLICY "Users can update materials in their company" ON stock_materials
    FOR UPDATE USING (company_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
    
CREATE POLICY "Users can delete materials in their company" ON stock_materials
    FOR DELETE USING (company_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- RLS Policies for requisitions
CREATE POLICY "Users can view requisitions in their tenant" ON stock_material_requisitions
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
    
CREATE POLICY "Users can manage requisitions in their tenant" ON stock_material_requisitions
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- RLS Policies for requisition items (inherit from parent)
CREATE POLICY "Users can view MR items" ON stock_material_requisition_items
    FOR SELECT USING (mr_id IN (
        SELECT id FROM stock_material_requisitions 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));
    
CREATE POLICY "Users can manage MR items" ON stock_material_requisition_items
    FOR ALL USING (mr_id IN (
        SELECT id FROM stock_material_requisitions 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

-- RLS Policies for purchase orders
CREATE POLICY "Users can view POs in their tenant" ON stock_purchase_orders
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
    
CREATE POLICY "Users can manage POs in their tenant" ON stock_purchase_orders
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- RLS Policies for PO items
CREATE POLICY "Users can view PO items" ON stock_purchase_order_items
    FOR SELECT USING (po_id IN (
        SELECT id FROM stock_purchase_orders 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));
    
CREATE POLICY "Users can manage PO items" ON stock_purchase_order_items
    FOR ALL USING (po_id IN (
        SELECT id FROM stock_purchase_orders 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

-- RLS Policies for goods receipts
CREATE POLICY "Users can view GRNs in their tenant" ON stock_goods_receipts
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
    
CREATE POLICY "Users can manage GRNs in their tenant" ON stock_goods_receipts
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- RLS Policies for GRN items
CREATE POLICY "Users can view GRN items" ON stock_goods_receipt_items
    FOR SELECT USING (grn_id IN (
        SELECT id FROM stock_goods_receipts 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));
    
CREATE POLICY "Users can manage GRN items" ON stock_goods_receipt_items
    FOR ALL USING (grn_id IN (
        SELECT id FROM stock_goods_receipts 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

-- RLS Policies for stock movements
CREATE POLICY "Users can view movements in their tenant" ON stock_movements
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
    
CREATE POLICY "Users can manage movements in their tenant" ON stock_movements
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- SECTION 3: TRIGGERS FOR updated_at
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_stock_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_stock_vendors_updated_at ON stock_vendors;
CREATE TRIGGER update_stock_vendors_updated_at
    BEFORE UPDATE ON stock_vendors
    FOR EACH ROW EXECUTE FUNCTION update_stock_updated_at();

DROP TRIGGER IF EXISTS update_stock_materials_updated_at ON stock_materials;
CREATE TRIGGER update_stock_materials_updated_at
    BEFORE UPDATE ON stock_materials
    FOR EACH ROW EXECUTE FUNCTION update_stock_updated_at();

DROP TRIGGER IF EXISTS update_stock_mr_updated_at ON stock_material_requisitions;
CREATE TRIGGER update_stock_mr_updated_at
    BEFORE UPDATE ON stock_material_requisitions
    FOR EACH ROW EXECUTE FUNCTION update_stock_updated_at();

DROP TRIGGER IF EXISTS update_stock_po_updated_at ON stock_purchase_orders;
CREATE TRIGGER update_stock_po_updated_at
    BEFORE UPDATE ON stock_purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_stock_updated_at();

DROP TRIGGER IF EXISTS update_stock_grn_updated_at ON stock_goods_receipts;
CREATE TRIGGER update_stock_grn_updated_at
    BEFORE UPDATE ON stock_goods_receipts
    FOR EACH ROW EXECUTE FUNCTION update_stock_updated_at();

-- ============================================================================
-- SECTION 4: ALSO CREATE THE 'vendors' TABLE (used by some APIs)
-- ============================================================================

-- Some APIs reference 'vendors' table directly (alias/view approach)
CREATE OR REPLACE VIEW vendors AS
SELECT * FROM stock_vendors;

-- ============================================================================
-- SECTION 5: HELPER FUNCTIONS
-- ============================================================================

-- Function to generate next PO number
CREATE OR REPLACE FUNCTION generate_po_number(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_count INTEGER;
    v_year TEXT;
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YY');
    SELECT COUNT(*) + 1 INTO v_count 
    FROM stock_purchase_orders 
    WHERE tenant_id = p_tenant_id 
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
    
    RETURN 'PO-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to generate next MR number
CREATE OR REPLACE FUNCTION generate_mr_number(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_count INTEGER;
    v_year TEXT;
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YY');
    SELECT COUNT(*) + 1 INTO v_count 
    FROM stock_material_requisitions 
    WHERE tenant_id = p_tenant_id 
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
    
    RETURN 'MR-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to generate next GRN number
CREATE OR REPLACE FUNCTION generate_grn_number(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_count INTEGER;
    v_year TEXT;
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YY');
    SELECT COUNT(*) + 1 INTO v_count 
    FROM stock_goods_receipts 
    WHERE tenant_id = p_tenant_id 
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
    
    RETURN 'GRN-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE stock_vendors IS 'Suppliers and vendors for stock materials';
COMMENT ON TABLE stock_materials IS 'Inventory items tracked for stock management';
COMMENT ON TABLE stock_material_requisitions IS 'Material requirement requests from projects';
COMMENT ON TABLE stock_purchase_orders IS 'Purchase orders sent to vendors';
COMMENT ON TABLE stock_goods_receipts IS 'Goods receipt notes for received materials';
COMMENT ON TABLE stock_movements IS 'Track all inventory movements';
