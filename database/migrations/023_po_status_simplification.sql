-- Migration: 023_po_status_simplification.sql
-- Description: Simplify PO status workflow and add separate payment_status tracking
-- Date: 2025-01-XX
-- 
-- Changes:
-- 1. Update status column CHECK constraint to new values
-- 2. Add payment_status column for separate payment tracking
-- 3. Add timestamp columns for status transitions
-- 4. Migrate existing data to new status values

-- ============================================================================
-- Step 1: Add new columns
-- ============================================================================

-- Add payment_status column
ALTER TABLE stock_purchase_orders 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending' 
CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue'));

-- Add timestamp columns for new status workflow
ALTER TABLE stock_purchase_orders 
ADD COLUMN IF NOT EXISTS order_placed_at TIMESTAMPTZ;

ALTER TABLE stock_purchase_orders 
ADD COLUMN IF NOT EXISTS order_dispatched_at TIMESTAMPTZ;

ALTER TABLE stock_purchase_orders 
ADD COLUMN IF NOT EXISTS order_received_at TIMESTAMPTZ;

ALTER TABLE stock_purchase_orders 
ADD COLUMN IF NOT EXISTS order_closed_at TIMESTAMPTZ;

-- ============================================================================
-- Step 2: Migrate existing status values to new ones
-- ============================================================================

-- Map old statuses to new statuses:
-- draft -> draft (no change)
-- pending_approval -> draft (approval removed, back to draft)
-- approved -> order_placed (ready to send = placed)
-- sent -> order_placed (sent to vendor = placed)
-- partially_received -> order_dispatched (in transit)
-- received -> order_received 
-- closed -> order_closed
-- cancelled -> cancelled (no change)

UPDATE stock_purchase_orders SET status = 'draft' WHERE status = 'pending_approval';
UPDATE stock_purchase_orders SET status = 'order_placed', order_placed_at = COALESCE(sent_at, approved_at, NOW()) WHERE status IN ('approved', 'sent');
UPDATE stock_purchase_orders SET status = 'order_dispatched', order_dispatched_at = NOW() WHERE status = 'partially_received';
UPDATE stock_purchase_orders SET status = 'order_received', order_received_at = NOW() WHERE status = 'received';
UPDATE stock_purchase_orders SET status = 'order_closed', order_closed_at = NOW() WHERE status = 'closed';

-- ============================================================================
-- Step 3: Drop and recreate status CHECK constraint
-- ============================================================================

-- Drop existing constraint
ALTER TABLE stock_purchase_orders DROP CONSTRAINT IF EXISTS stock_purchase_orders_status_check;

-- Create new constraint with simplified status values
ALTER TABLE stock_purchase_orders ADD CONSTRAINT stock_purchase_orders_status_check 
CHECK (status IN ('draft', 'order_placed', 'order_dispatched', 'order_received', 'order_closed', 'cancelled'));

-- ============================================================================
-- Step 4: Create index for payment_status
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_stock_po_payment_status ON stock_purchase_orders(tenant_id, payment_status);

-- ============================================================================
-- Step 5: Add comments
-- ============================================================================

COMMENT ON COLUMN stock_purchase_orders.status IS 'Order status: draft, order_placed, order_dispatched, order_received, order_closed, cancelled';
COMMENT ON COLUMN stock_purchase_orders.payment_status IS 'Payment status: pending, partial, paid, overdue (independent of order status)';
COMMENT ON COLUMN stock_purchase_orders.order_placed_at IS 'Timestamp when order was placed with vendor';
COMMENT ON COLUMN stock_purchase_orders.order_dispatched_at IS 'Timestamp when vendor dispatched the order';
COMMENT ON COLUMN stock_purchase_orders.order_received_at IS 'Timestamp when order was received at warehouse';
COMMENT ON COLUMN stock_purchase_orders.order_closed_at IS 'Timestamp when PO was fully closed';
