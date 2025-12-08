-- =====================================================
-- Migration: Cleanup Vendor Sorting Columns
-- =====================================================
-- Purpose: Remove unnecessary computed columns that were added
-- for sorting. We'll use the standard 'name' column instead.
-- =====================================================

-- Drop the index first
DROP INDEX IF EXISTS idx_stock_vendors_name_lower;
DROP INDEX IF EXISTS idx_stock_vendors_effective_name;

-- Drop the computed columns
ALTER TABLE stock_vendors DROP COLUMN IF EXISTS name_lower;
ALTER TABLE stock_vendors DROP COLUMN IF EXISTS effective_name;

-- =====================================================
-- Sorting will now use the standard 'name' column
-- =====================================================
