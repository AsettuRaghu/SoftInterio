-- =====================================================
-- SoftInterio Quotation Templates Permissions
-- =====================================================
-- Description: Add permissions for quotation templates management
-- Target: Supabase (PostgreSQL with auth integration)
-- 
-- Run this AFTER 009_quotation_module.sql
-- =====================================================

-- =====================================================
-- 1. ADD QUOTATION TEMPLATE PERMISSIONS
-- =====================================================

-- Insert template-specific permissions (only if they don't exist)
INSERT INTO permissions (key, module, description, is_system_permission)
SELECT 'quotations.templates.view', 'quotations', 'View quotation templates', true
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE key = 'quotations.templates.view');

INSERT INTO permissions (key, module, description, is_system_permission)
SELECT 'quotations.templates.create', 'quotations', 'Create quotation templates', true
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE key = 'quotations.templates.create');

INSERT INTO permissions (key, module, description, is_system_permission)
SELECT 'quotations.templates.update', 'quotations', 'Update quotation templates', true
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE key = 'quotations.templates.update');

INSERT INTO permissions (key, module, description, is_system_permission)
SELECT 'quotations.templates.delete', 'quotations', 'Delete quotation templates', true
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE key = 'quotations.templates.delete');

-- =====================================================
-- 2. ASSIGN TEMPLATE PERMISSIONS TO ROLES
-- =====================================================

-- Owner: Full template access
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'owner' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key LIKE 'quotations.templates.%'
ON CONFLICT DO NOTHING;

-- Admin: Full template access
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'admin' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key LIKE 'quotations.templates.%'
ON CONFLICT DO NOTHING;

-- Manager: Full template access
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'manager' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key LIKE 'quotations.templates.%'
ON CONFLICT DO NOTHING;

-- Senior Designer: Full template access
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'senior-designer' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key LIKE 'quotations.templates.%'
ON CONFLICT DO NOTHING;

-- Finance: View templates only
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'finance' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key = 'quotations.templates.view'
ON CONFLICT DO NOTHING;

-- Staff: View and create templates
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'staff' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN ('quotations.templates.view', 'quotations.templates.create', 'quotations.templates.update')
ON CONFLICT DO NOTHING;

-- Designer: View and create templates
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'designer' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN ('quotations.templates.view', 'quotations.templates.create', 'quotations.templates.update')
ON CONFLICT DO NOTHING;

-- Sales: View and create templates
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'sales' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN ('quotations.templates.view', 'quotations.templates.create', 'quotations.templates.update')
ON CONFLICT DO NOTHING;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- 
-- Added permissions:
-- - quotations.templates.view: View quotation templates
-- - quotations.templates.create: Create quotation templates
-- - quotations.templates.update: Update quotation templates
-- - quotations.templates.delete: Delete quotation templates
--
-- Role assignments:
-- - Owner, Admin, Manager, Senior Designer: Full access
-- - Finance: View only
-- - Staff, Designer, Sales: View, create, update
-- =====================================================
