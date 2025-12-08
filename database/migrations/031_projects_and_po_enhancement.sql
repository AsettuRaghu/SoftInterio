-- =====================================================
-- Migration: 031_projects_and_po_enhancement.sql
-- Description: 
--   1. Create Projects table (basic structure)
--   2. Enhanced PO status workflow with approval
--   3. Payment tracking separate from order status
--   4. Line-item level project tracking
--   5. Approval configuration
-- Date: 2024-12-06
-- =====================================================

-- ============================================================================
-- SECTION 1: PROJECTS TABLE (Basic Structure)
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Project Identification
    project_number VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Client Info (can be linked to leads/clients later)
    client_name VARCHAR(255),
    client_email VARCHAR(255),
    client_phone VARCHAR(50),
    
    -- Location
    site_address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(20),
    
    -- Project Details
    project_type VARCHAR(50) DEFAULT 'residential' 
        CHECK (project_type IN ('residential', 'commercial', 'hospitality', 'retail', 'office', 'other')),
    status VARCHAR(30) DEFAULT 'planning'
        CHECK (status IN ('planning', 'design', 'procurement', 'execution', 'finishing', 'handover', 'completed', 'on_hold', 'cancelled')),
    
    -- Dates
    start_date DATE,
    expected_end_date DATE,
    actual_end_date DATE,
    
    -- Budget & Financials
    quoted_amount DECIMAL(14,2) DEFAULT 0,
    budget_amount DECIMAL(14,2) DEFAULT 0,
    actual_cost DECIMAL(14,2) DEFAULT 0,
    
    -- Team
    project_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    lead_id UUID, -- Can reference leads table if exists
    quotation_id UUID, -- Can reference quotations table if exists
    
    -- Metadata
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, project_number)
);

-- Indexes for Projects
CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(project_manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(tenant_id, is_active);

-- RLS for Projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view projects in their tenant" ON projects
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
    
CREATE POLICY "Users can manage projects in their tenant" ON projects
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_projects_updated_at();

-- Function to generate project number
CREATE OR REPLACE FUNCTION generate_project_number(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_count INTEGER;
    v_year TEXT;
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YY');
    SELECT COUNT(*) + 1 INTO v_count 
    FROM projects 
    WHERE tenant_id = p_tenant_id 
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
    
    RETURN 'PRJ-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE projects IS 'Interior design projects for tracking scope, budget and execution';

-- ============================================================================
-- SECTION 2: PO STATUS ENHANCEMENT
-- ============================================================================

-- Step 1: Drop existing status constraint FIRST
ALTER TABLE stock_purchase_orders DROP CONSTRAINT IF EXISTS stock_purchase_orders_status_check;

-- Step 2: MIGRATE EXISTING DATA BEFORE adding new constraint
-- Update existing POs with old statuses to new ones
UPDATE stock_purchase_orders SET status = 'draft' WHERE status NOT IN (
    'draft', 'pending_approval', 'approved', 'sent_to_vendor', 'acknowledged', 
    'dispatched', 'partially_received', 'fully_received', 'cancelled'
) AND status IS NOT NULL;

-- Map specific old statuses to new ones
UPDATE stock_purchase_orders SET status = 'sent_to_vendor' WHERE status IN ('sent', 'order_placed');
UPDATE stock_purchase_orders SET status = 'dispatched' WHERE status = 'order_dispatched';
UPDATE stock_purchase_orders SET status = 'fully_received' WHERE status IN ('received', 'order_received');
UPDATE stock_purchase_orders SET status = 'fully_received' WHERE status IN ('closed', 'order_closed');

-- Step 3: NOW add new status constraint with complete workflow
ALTER TABLE stock_purchase_orders ADD CONSTRAINT stock_purchase_orders_status_check 
    CHECK (status IN (
        'draft',              -- Being created, fully editable
        'pending_approval',   -- Submitted for approval, locked
        'approved',           -- Approved, edit sends back to draft
        'sent_to_vendor',     -- Sent to vendor, only cancel allowed
        'acknowledged',       -- Vendor acknowledged (optional)
        'dispatched',         -- Vendor dispatched goods
        'partially_received', -- Some items received
        'fully_received',     -- All items received
        'cancelled'           -- Cancelled at any stage
    ));

-- Add payment status column
ALTER TABLE stock_purchase_orders 
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'pending';

-- Add payment status constraint
ALTER TABLE stock_purchase_orders DROP CONSTRAINT IF EXISTS stock_purchase_orders_payment_status_check;
ALTER TABLE stock_purchase_orders ADD CONSTRAINT stock_purchase_orders_payment_status_check 
    CHECK (payment_status IN (
        'not_applicable',  -- Internal/sample orders
        'pending',         -- No payment made
        'advance_paid',    -- Advance payment made
        'partially_paid',  -- Partial payment made
        'fully_paid',      -- Full payment made
        'overdue'          -- Payment overdue
    ));

-- Add payment tracking columns
ALTER TABLE stock_purchase_orders 
    ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(14,2) DEFAULT 0;

ALTER TABLE stock_purchase_orders 
    ADD COLUMN IF NOT EXISTS payment_due_date DATE;

-- Add status timestamp columns
ALTER TABLE stock_purchase_orders 
    ADD COLUMN IF NOT EXISTS submitted_for_approval_at TIMESTAMPTZ;

ALTER TABLE stock_purchase_orders 
    ADD COLUMN IF NOT EXISTS sent_to_vendor_at TIMESTAMPTZ;

ALTER TABLE stock_purchase_orders 
    ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

ALTER TABLE stock_purchase_orders 
    ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;

ALTER TABLE stock_purchase_orders 
    ADD COLUMN IF NOT EXISTS fully_received_at TIMESTAMPTZ;

ALTER TABLE stock_purchase_orders 
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE stock_purchase_orders 
    ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id);

ALTER TABLE stock_purchase_orders 
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Add approval-related columns
ALTER TABLE stock_purchase_orders 
    ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT true;

ALTER TABLE stock_purchase_orders 
    ADD COLUMN IF NOT EXISTS approval_level INTEGER DEFAULT 1;

ALTER TABLE stock_purchase_orders 
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ============================================================================
-- SECTION 3: PO LINE ITEMS - PROJECT TRACKING
-- ============================================================================

-- Add project reference to PO items
ALTER TABLE stock_purchase_order_items 
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Add cost allocation type
ALTER TABLE stock_purchase_order_items 
    ADD COLUMN IF NOT EXISTS cost_type VARCHAR(20) DEFAULT 'project';

ALTER TABLE stock_purchase_order_items DROP CONSTRAINT IF EXISTS stock_po_items_cost_type_check;
ALTER TABLE stock_purchase_order_items ADD CONSTRAINT stock_po_items_cost_type_check 
    CHECK (cost_type IN ('project', 'stock', 'overhead'));

-- Add cost code for non-project items (NP = Non-Project)
ALTER TABLE stock_purchase_order_items 
    ADD COLUMN IF NOT EXISTS cost_code VARCHAR(50);

-- Index for project lookups
CREATE INDEX IF NOT EXISTS idx_po_items_project ON stock_purchase_order_items(project_id);
CREATE INDEX IF NOT EXISTS idx_po_items_cost_type ON stock_purchase_order_items(cost_type);

-- ============================================================================
-- SECTION 4: STOCK MOVEMENTS - PROJECT TRACKING
-- ============================================================================

ALTER TABLE stock_movements 
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_project ON stock_movements(project_id);

-- ============================================================================
-- SECTION 5: APPROVAL CONFIGURATION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS approval_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    config_type VARCHAR(50) NOT NULL DEFAULT 'purchase_order',
    
    -- Approval Settings
    is_approval_required BOOLEAN DEFAULT true,
    
    -- Amount Thresholds (in INR)
    auto_approve_limit DECIMAL(14,2) DEFAULT 0,       -- Below: auto-approve
    level1_limit DECIMAL(14,2) DEFAULT 50000,         -- Below: L1 can approve
    level2_limit DECIMAL(14,2) DEFAULT 200000,        -- Below: L2 can approve
    -- Above level2_limit: needs level3 (owner/admin)
    
    -- Role mappings (can be role names or specific user IDs)
    level1_role VARCHAR(50) DEFAULT 'manager',
    level2_role VARCHAR(50) DEFAULT 'director',
    level3_role VARCHAR(50) DEFAULT 'owner',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, config_type)
);

-- RLS for approval_configs
ALTER TABLE approval_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approval configs in their tenant" ON approval_configs
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
    
CREATE POLICY "Admins can manage approval configs" ON approval_configs
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- SECTION 6: PO APPROVAL HISTORY (AUDIT TRAIL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS po_approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES stock_purchase_orders(id) ON DELETE CASCADE,
    
    -- Action Details
    action VARCHAR(30) NOT NULL CHECK (action IN (
        'created',
        'submitted',
        'approved', 
        'rejected',
        'returned_to_draft',
        'sent_to_vendor',
        'acknowledged',
        'dispatched',
        'partially_received',
        'fully_received',
        'cancelled',
        'edited',
        'payment_recorded'
    )),
    
    -- Status Change
    from_status VARCHAR(30),
    to_status VARCHAR(30),
    
    -- Actor
    performed_by UUID REFERENCES users(id),
    
    -- Additional Info
    comments TEXT,
    metadata JSONB, -- For storing additional data like payment amount, etc.
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_approval_history_po ON po_approval_history(po_id);
CREATE INDEX IF NOT EXISTS idx_po_approval_history_action ON po_approval_history(action);
CREATE INDEX IF NOT EXISTS idx_po_approval_history_date ON po_approval_history(created_at);

-- RLS for po_approval_history
ALTER TABLE po_approval_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view PO history in their tenant" ON po_approval_history
    FOR SELECT USING (po_id IN (
        SELECT id FROM stock_purchase_orders 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

CREATE POLICY "Users can add PO history in their tenant" ON po_approval_history
    FOR INSERT WITH CHECK (po_id IN (
        SELECT id FROM stock_purchase_orders 
        WHERE tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    ));

-- ============================================================================
-- SECTION 7: PO PAYMENTS TABLE (Detailed Payment Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS po_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    po_id UUID NOT NULL REFERENCES stock_purchase_orders(id) ON DELETE CASCADE,
    
    -- Payment Details
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(14,2) NOT NULL,
    payment_type VARCHAR(30) DEFAULT 'regular' 
        CHECK (payment_type IN ('advance', 'regular', 'final', 'adjustment')),
    payment_method VARCHAR(30)
        CHECK (payment_method IN ('bank_transfer', 'cheque', 'cash', 'upi', 'card', 'other')),
    
    -- Reference
    reference_number VARCHAR(100),
    bank_reference VARCHAR(100),
    
    -- Notes
    notes TEXT,
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_payments_po ON po_payments(po_id);
CREATE INDEX IF NOT EXISTS idx_po_payments_date ON po_payments(payment_date);

-- RLS for po_payments
ALTER TABLE po_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view PO payments in their tenant" ON po_payments
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can manage PO payments in their tenant" ON po_payments
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- SECTION 8: PROJECT COSTS VIEW (For Reporting)
-- ============================================================================

CREATE OR REPLACE VIEW project_material_costs AS
SELECT 
    p.id AS project_id,
    p.project_number,
    p.name AS project_name,
    p.tenant_id,
    poi.id AS po_item_id,
    po.po_number,
    po.status AS po_status,
    po.payment_status,
    m.name AS material_name,
    m.sku,
    poi.quantity,
    poi.unit_price,
    poi.total_amount,
    poi.received_quantity,
    poi.cost_type,
    po.order_date,
    po.vendor_id,
    v.name AS vendor_name
FROM projects p
JOIN stock_purchase_order_items poi ON poi.project_id = p.id
JOIN stock_purchase_orders po ON po.id = poi.po_id
JOIN stock_materials m ON m.id = poi.material_id
LEFT JOIN stock_vendors v ON v.id = po.vendor_id
WHERE poi.cost_type = 'project';

-- ============================================================================
-- SECTION 9: HELPER FUNCTION - Get PO Approval Level Required
-- ============================================================================

CREATE OR REPLACE FUNCTION get_po_approval_level(
    p_tenant_id UUID,
    p_amount DECIMAL
) RETURNS TABLE (
    requires_approval BOOLEAN,
    approval_level INTEGER,
    approver_role VARCHAR
) AS $$
DECLARE
    v_config approval_configs%ROWTYPE;
BEGIN
    -- Get tenant's approval config
    SELECT * INTO v_config 
    FROM approval_configs 
    WHERE tenant_id = p_tenant_id 
    AND config_type = 'purchase_order';
    
    -- If no config, default behavior
    IF NOT FOUND THEN
        RETURN QUERY SELECT true, 1, 'manager'::VARCHAR;
        RETURN;
    END IF;
    
    -- Check if approval is required at all
    IF NOT v_config.is_approval_required THEN
        RETURN QUERY SELECT false, 0, NULL::VARCHAR;
        RETURN;
    END IF;
    
    -- Auto-approve if below threshold
    IF p_amount <= v_config.auto_approve_limit THEN
        RETURN QUERY SELECT false, 0, NULL::VARCHAR;
        RETURN;
    END IF;
    
    -- Level 1
    IF p_amount <= v_config.level1_limit THEN
        RETURN QUERY SELECT true, 1, v_config.level1_role;
        RETURN;
    END IF;
    
    -- Level 2
    IF p_amount <= v_config.level2_limit THEN
        RETURN QUERY SELECT true, 2, v_config.level2_role;
        RETURN;
    END IF;
    
    -- Level 3 (highest)
    RETURN QUERY SELECT true, 3, v_config.level3_role;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 10: UPDATE PO PAYMENT STATUS TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_po_payment_status()
RETURNS TRIGGER AS $$
DECLARE
    v_total_paid DECIMAL(14,2);
    v_total_amount DECIMAL(14,2);
BEGIN
    -- Calculate total paid
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM po_payments
    WHERE po_id = NEW.po_id;
    
    -- Get PO total
    SELECT total_amount INTO v_total_amount
    FROM stock_purchase_orders
    WHERE id = NEW.po_id;
    
    -- Update PO payment status and amount_paid
    UPDATE stock_purchase_orders
    SET 
        amount_paid = v_total_paid,
        payment_status = CASE
            WHEN v_total_paid >= v_total_amount THEN 'fully_paid'
            WHEN v_total_paid > 0 THEN 'partially_paid'
            ELSE 'pending'
        END,
        updated_at = NOW()
    WHERE id = NEW.po_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_po_payment_status_trigger ON po_payments;
CREATE TRIGGER update_po_payment_status_trigger
    AFTER INSERT OR UPDATE OR DELETE ON po_payments
    FOR EACH ROW EXECUTE FUNCTION update_po_payment_status();

-- ============================================================================
-- SECTION 11: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_po_status ON stock_purchase_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_po_payment_status ON stock_purchase_orders(tenant_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_po_pending_approval ON stock_purchase_orders(tenant_id, status) 
    WHERE status = 'pending_approval';
CREATE INDEX IF NOT EXISTS idx_po_requires_approval ON stock_purchase_orders(tenant_id, requires_approval);

-- ============================================================================
-- SECTION 12: SET DEFAULTS FOR NEW COLUMNS
-- ============================================================================

-- Note: Status migration is done in SECTION 2 before constraint is added

-- Set payment_status for existing records
UPDATE stock_purchase_orders 
SET payment_status = 'pending' 
WHERE payment_status IS NULL;

-- Set default cost_type for existing PO items
UPDATE stock_purchase_order_items 
SET cost_type = 'stock' 
WHERE cost_type IS NULL;

-- ============================================================================
-- SECTION 13: COMMENTS
-- ============================================================================

COMMENT ON TABLE projects IS 'Interior design projects - tracks scope, budget, timeline and execution';
COMMENT ON TABLE approval_configs IS 'Configurable approval thresholds and roles per tenant';
COMMENT ON TABLE po_approval_history IS 'Audit trail for all PO status changes and approvals';
COMMENT ON TABLE po_payments IS 'Payment records against purchase orders';

COMMENT ON COLUMN stock_purchase_orders.status IS 'Order status: draft → pending_approval → approved → sent_to_vendor → dispatched → partially_received → fully_received';
COMMENT ON COLUMN stock_purchase_orders.payment_status IS 'Payment status: pending → advance_paid → partially_paid → fully_paid (independent of order status)';
COMMENT ON COLUMN stock_purchase_order_items.project_id IS 'Project this material is allocated to (NULL for stock/overhead)';
COMMENT ON COLUMN stock_purchase_order_items.cost_type IS 'project = project cost, stock = inventory, overhead = non-project expense';
COMMENT ON COLUMN stock_purchase_order_items.cost_code IS 'Code for non-project items (e.g., NP for Non-Project)';

-- ============================================================================
-- SECTION 14: DEFAULT APPROVAL CONFIG (INSERT IF NOT EXISTS)
-- ============================================================================

-- This will be inserted per-tenant when they first use the system
-- For now, just ensure the table is ready

-- Sample insert for testing (commented out - run manually if needed):
-- INSERT INTO approval_configs (tenant_id, config_type, is_approval_required, auto_approve_limit, level1_limit, level2_limit)
-- SELECT id, 'purchase_order', true, 5000, 50000, 200000
-- FROM tenants
-- WHERE NOT EXISTS (SELECT 1 FROM approval_configs WHERE tenant_id = tenants.id AND config_type = 'purchase_order');
