-- =====================================================
-- Stock Module Permission Fix
-- Run this to ensure Owner role has all stock permissions
-- =====================================================

-- Rename old stock.dashboard permission to stock.overview if it exists
UPDATE permissions SET key = 'stock.overview', description = 'View stock overview' 
WHERE key = 'stock.dashboard';

-- First ensure all stock permissions exist
INSERT INTO permissions (key, description, module) VALUES
    -- Stock Management
    ('stock.overview', 'View stock overview', 'stock'),
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

-- Grant ALL stock permissions to Owner
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT r.id, p.id, true
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Owner' AND p.module = 'stock'
ON CONFLICT (role_id, permission_id) DO UPDATE SET granted = true;

-- Grant ALL stock permissions to Admin
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT r.id, p.id, true
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Admin' AND p.module = 'stock'
ON CONFLICT (role_id, permission_id) DO UPDATE SET granted = true;

-- Verify the permissions were added
SELECT r.name as role_name, p.key as permission_key, rp.granted
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE r.name IN ('Owner', 'Admin') AND p.module = 'stock'
ORDER BY r.name, p.key;
