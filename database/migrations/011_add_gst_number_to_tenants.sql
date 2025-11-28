-- Migration: 011_add_gst_number_to_tenants.sql
-- Description: Add GST number column to tenants table for company settings
-- Date: 2025-11-28

-- =====================================================
-- ADD GST NUMBER TO TENANTS TABLE
-- =====================================================

-- Add gst_number column to tenants table
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS gst_number VARCHAR(20);

-- Create index for GST number lookups
CREATE INDEX IF NOT EXISTS idx_tenants_gst_number ON tenants(gst_number);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
