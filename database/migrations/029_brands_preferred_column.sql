-- =====================================================
-- Migration: Add is_preferred to stock_brands + Permissions
-- =====================================================
-- Purpose: 
-- 1. Allow companies to mark brands as "preferred"
-- 2. Add brands permissions for menu access
-- =====================================================

-- Add is_preferred column to stock_brands
ALTER TABLE stock_brands 
ADD COLUMN IF NOT EXISTS is_preferred BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN stock_brands.is_preferred IS 'True if this brand is a preferred/priority brand for the company';

-- Create index for faster filtering of preferred brands
CREATE INDEX IF NOT EXISTS idx_stock_brands_preferred ON stock_brands(tenant_id, is_preferred) WHERE is_preferred = true;

-- =====================================================
-- SECTION 2: ADD BRANDS PERMISSIONS
-- =====================================================

-- Insert brands permissions
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('brands.view', 'stock', 'View brands list', true),
('brands.create', 'stock', 'Create new brands', true),
('brands.update', 'stock', 'Update brand details', true),
('brands.delete', 'stock', 'Delete brands', true)
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- SECTION 3: ASSIGN PERMISSIONS TO ROLES
-- =====================================================

-- Grant brands.view to roles that have vendors.view
-- This includes: owner, admin, procurement, inventory_manager, etc.
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p.id
FROM role_permissions rp
JOIN permissions vp ON rp.permission_id = vp.id AND vp.key = 'vendors.view'
CROSS JOIN permissions p WHERE p.key = 'brands.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant brands.create to roles that have vendors.create
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p.id
FROM role_permissions rp
JOIN permissions vp ON rp.permission_id = vp.id AND vp.key = 'vendors.create'
CROSS JOIN permissions p WHERE p.key = 'brands.create'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant brands.update to roles that have vendors.update or vendors.edit
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p.id
FROM role_permissions rp
JOIN permissions vp ON rp.permission_id = vp.id AND vp.key IN ('vendors.update', 'vendors.edit')
CROSS JOIN permissions p WHERE p.key = 'brands.update'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant brands.delete to roles that have vendors.delete
INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p.id
FROM role_permissions rp
JOIN permissions vp ON rp.permission_id = vp.id AND vp.key = 'vendors.delete'
CROSS JOIN permissions p WHERE p.key = 'brands.delete'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =====================================================
-- DONE: Brands permissions now mirror vendors permissions
-- Owner, Admin, Procurement roles will have access
-- =====================================================
