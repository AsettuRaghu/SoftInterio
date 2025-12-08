-- =====================================================
-- Migration: 031b_fix_po_status.sql
-- Description: Fix PO status constraint violation
-- Run this if 031 failed partway through
-- Date: 2024-12-06
-- =====================================================

-- Step 1: Drop the constraint if it exists
ALTER TABLE stock_purchase_orders DROP CONSTRAINT IF EXISTS stock_purchase_orders_status_check;

-- Step 2: See what status values exist (for debugging)
-- SELECT DISTINCT status FROM stock_purchase_orders;

-- Step 3: Migrate ALL existing statuses to valid new values
UPDATE stock_purchase_orders SET status = 'sent_to_vendor' WHERE status IN ('sent', 'order_placed');
UPDATE stock_purchase_orders SET status = 'dispatched' WHERE status = 'order_dispatched';
UPDATE stock_purchase_orders SET status = 'fully_received' WHERE status IN ('received', 'order_received', 'closed', 'order_closed');

-- Catch-all: anything else becomes draft
UPDATE stock_purchase_orders SET status = 'draft' WHERE status NOT IN (
    'draft', 'pending_approval', 'approved', 'sent_to_vendor', 'acknowledged', 
    'dispatched', 'partially_received', 'fully_received', 'cancelled'
);

-- Step 4: NOW add the constraint
ALTER TABLE stock_purchase_orders ADD CONSTRAINT stock_purchase_orders_status_check 
    CHECK (status IN (
        'draft',
        'pending_approval',
        'approved',
        'sent_to_vendor',
        'acknowledged',
        'dispatched',
        'partially_received',
        'fully_received',
        'cancelled'
    ));

-- Verify
-- SELECT DISTINCT status FROM stock_purchase_orders;
