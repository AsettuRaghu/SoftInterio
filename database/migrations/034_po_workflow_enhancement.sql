-- Migration: 034 - PO Workflow Enhancement
-- Description: Add rejected/closed status support and related columns
-- Date: 2024-12-07

-- ============================================================================
-- 1. Update PO status enum to include rejected and closed
-- ============================================================================

-- First, drop the constraint if it exists
ALTER TABLE stock_purchase_orders 
DROP CONSTRAINT IF EXISTS stock_purchase_orders_status_check;

-- Add new status check constraint with all statuses
ALTER TABLE stock_purchase_orders 
ADD CONSTRAINT stock_purchase_orders_status_check 
CHECK (status IN (
    'draft',
    'pending_approval',
    'approved',
    'rejected',
    'sent_to_vendor',
    'acknowledged',
    'dispatched',
    'partially_received',
    'fully_received',
    'closed',
    'cancelled'
));

-- ============================================================================
-- 2. Add new columns for rejection and closure tracking
-- ============================================================================

-- Add rejection tracking columns
ALTER TABLE stock_purchase_orders 
ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add closure tracking columns
ALTER TABLE stock_purchase_orders 
ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- ============================================================================
-- 3. Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_stock_po_rejected_by ON stock_purchase_orders(rejected_by);
CREATE INDEX IF NOT EXISTS idx_stock_po_closed_by ON stock_purchase_orders(closed_by);
CREATE INDEX IF NOT EXISTS idx_stock_po_status_payment ON stock_purchase_orders(status, payment_status);

-- ============================================================================
-- 4. Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN stock_purchase_orders.rejected_by IS 'User who rejected the PO';
COMMENT ON COLUMN stock_purchase_orders.rejected_at IS 'Timestamp when PO was rejected';
COMMENT ON COLUMN stock_purchase_orders.rejection_reason IS 'Reason for PO rejection';
COMMENT ON COLUMN stock_purchase_orders.closed_by IS 'User who closed the PO after full receipt and payment';
COMMENT ON COLUMN stock_purchase_orders.closed_at IS 'Timestamp when PO was closed';

-- ============================================================================
-- 5. Update approval history to track rejection
-- ============================================================================

-- Update the action check constraint if it exists
ALTER TABLE po_approval_history 
DROP CONSTRAINT IF EXISTS po_approval_history_action_check;

ALTER TABLE po_approval_history 
ADD CONSTRAINT po_approval_history_action_check 
CHECK (action IN (
    'submitted',
    'approved',
    'rejected',
    'cancelled',
    'sent_to_vendor',
    'acknowledged',
    'dispatched',
    'partially_received',
    'fully_received',
    'closed',
    'draft'
));

-- ============================================================================
-- Summary of PO Workflow Changes:
-- 
-- NEW STATUSES:
-- - rejected: Terminal state when PO is rejected by approver
-- - closed: Terminal state when PO is fully received AND fully paid
--
-- WORKFLOW:
-- Draft → Pending Approval → Approved/Rejected
--                              ↓
--                         Sent to Vendor → Dispatched → Partially/Fully Received → Closed
--
-- RULES:
-- 1. Only Draft status allows full editing
-- 2. Approved status allows editing but reverts to Draft
-- 3. Pending Approval can be Approved OR Rejected
-- 4. Rejected is a terminal state (cannot transition out)
-- 5. Closed requires: status = fully_received AND payment_status = fully_paid
-- 6. Goods receipt is handled within PO detail page (no separate GRN menu)
-- ============================================================================
