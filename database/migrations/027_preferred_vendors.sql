-- =====================================================
-- Migration: Add Preferred Vendor Flag
-- =====================================================
-- Purpose: Allow companies to mark vendors as "preferred"
-- so teams know which vendors to prioritize for orders
-- =====================================================

-- Add is_preferred column to stock_vendors
ALTER TABLE stock_vendors 
ADD COLUMN IF NOT EXISTS is_preferred BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN stock_vendors.is_preferred IS 'True if this vendor is a preferred/priority vendor for the company';

-- Create index for faster filtering of preferred vendors
CREATE INDEX IF NOT EXISTS idx_stock_vendors_preferred ON stock_vendors(tenant_id, is_preferred) WHERE is_preferred = true;

-- =====================================================
-- Success message
-- =====================================================
-- Run this migration with:
-- psql -d your_database -f 027_preferred_vendors.sql
-- 
-- Or via Supabase SQL Editor
-- =====================================================
