-- Migration: 012_add_additional_roles.sql
-- Description: Add additional system roles for interior design companies
-- Date: 2025-11-28
-- Note: Adds Senior Designer, Designer, Sales, and Procurement roles

-- =====================================================
-- 0. CLEANUP: Remove any existing roles with these slugs (from failed runs)
-- =====================================================
DELETE FROM role_permissions WHERE role_id IN (
    SELECT id FROM roles WHERE slug IN ('senior-designer', 'designer', 'sales', 'procurement') AND tenant_id IS NULL
);
DELETE FROM roles WHERE slug IN ('senior-designer', 'designer', 'sales', 'procurement') AND tenant_id IS NULL;

-- =====================================================
-- 1. ADD NEW SYSTEM ROLES
-- =====================================================

-- Senior Designer Role (Level 2 - same as Manager)
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (
    uuid_generate_v4(), 
    NULL, 
    'Senior Designer', 
    'senior-designer', 
    'Senior designer who can manage projects, mentor juniors, and approve quotations.', 
    true, 
    false, 
    2
);

-- Designer Role (Level 3 - same as Staff)
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (
    uuid_generate_v4(), 
    NULL, 
    'Designer', 
    'designer', 
    'Designer who works on assigned projects, creates designs, and collaborates with the team.', 
    true, 
    false, 
    3
);

-- Sales Role (Level 3 - same as Staff)
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (
    uuid_generate_v4(), 
    NULL, 
    'Sales', 
    'sales', 
    'Sales representative who manages leads, clients, and creates initial proposals.', 
    true, 
    false, 
    3
);

-- Procurement Role (Level 3 - same as Staff)
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (
    uuid_generate_v4(), 
    NULL, 
    'Procurement', 
    'procurement', 
    'Procurement specialist who manages vendors, purchase orders, and stock.', 
    true, 
    false, 
    3
);

-- =====================================================
-- 2. ASSIGN PERMISSIONS TO NEW ROLES
-- =====================================================

-- =====================================================
-- 2.1 SENIOR DESIGNER PERMISSIONS
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'senior-designer' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN (
    -- Dashboard
    'dashboard.view',
    -- Sales - view only (for context)
    'sales.view',
    -- Projects - full access + view all
    'projects.view', 'projects.view_all', 'projects.create', 'projects.update', 'projects.archive', 'projects.assign',
    -- Quotations - full access including approve
    'quotations.view', 'quotations.create', 'quotations.update', 'quotations.approve', 'quotations.send',
    -- Stock - view only
    'stock.view',
    'procurement.view',
    'vendors.view',
    -- Finance - view only
    'finance.view',
    -- Tasks - full access + view all
    'tasks.view', 'tasks.view_all', 'tasks.create', 'tasks.update', 'tasks.delete', 'tasks.assign',
    -- Calendar - full access
    'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete',
    -- Documents - full access
    'documents.view', 'documents.upload', 'documents.update', 'documents.delete', 'documents.share',
    -- Library - full access
    'library.view', 'library.upload', 'library.update', 'library.delete',
    -- Reports - view and export
    'reports.view', 'reports.export',
    -- Settings - limited
    'settings.profile',
    'settings.company.view',
    'settings.team.view'
);

-- =====================================================
-- 2.2 DESIGNER PERMISSIONS
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'designer' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN (
    -- Dashboard
    'dashboard.view',
    -- Projects - view and update (assigned only)
    'projects.view', 'projects.update',
    -- Quotations - view and create
    'quotations.view', 'quotations.create', 'quotations.update',
    -- Stock - view only
    'stock.view',
    'vendors.view',
    -- Tasks - own tasks
    'tasks.view', 'tasks.create', 'tasks.update',
    -- Calendar - full access for own events
    'calendar.view', 'calendar.create', 'calendar.update',
    -- Documents - view and upload
    'documents.view', 'documents.upload', 'documents.update',
    -- Library - view and upload
    'library.view', 'library.upload',
    -- Reports - view only
    'reports.view',
    -- Settings - profile only
    'settings.profile',
    'settings.company.view',
    'settings.team.view'
);

-- =====================================================
-- 2.3 SALES PERMISSIONS
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'sales' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN (
    -- Dashboard
    'dashboard.view',
    -- Sales - full access
    'sales.view', 'sales.create', 'sales.update', 'sales.delete', 'sales.convert', 'sales.assign',
    -- Projects - view only (for context)
    'projects.view',
    -- Quotations - create and update (no approve)
    'quotations.view', 'quotations.create', 'quotations.update', 'quotations.send',
    -- Finance - view only (for client billing context)
    'finance.view',
    -- Tasks - own tasks
    'tasks.view', 'tasks.create', 'tasks.update',
    -- Calendar - full access
    'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete',
    -- Documents - view and upload
    'documents.view', 'documents.upload',
    -- Reports - view sales reports
    'reports.view',
    -- Settings - profile only
    'settings.profile',
    'settings.company.view',
    'settings.team.view'
);

-- =====================================================
-- 2.4 PROCUREMENT PERMISSIONS
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'procurement' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN (
    -- Dashboard
    'dashboard.view',
    -- Projects - view only (for project requirements)
    'projects.view',
    -- Stock & Procurement - full access
    'stock.view', 'stock.create', 'stock.update', 'stock.delete', 'stock.adjust',
    'procurement.view', 'procurement.create', 'procurement.update', 'procurement.delete',
    'vendors.view', 'vendors.create', 'vendors.update', 'vendors.delete',
    -- Finance - view only
    'finance.view',
    -- Tasks - own tasks
    'tasks.view', 'tasks.create', 'tasks.update',
    -- Calendar - full access
    'calendar.view', 'calendar.create', 'calendar.update',
    -- Documents - view and upload
    'documents.view', 'documents.upload',
    -- Reports - view
    'reports.view',
    -- Settings - profile only
    'settings.profile',
    'settings.company.view',
    'settings.team.view'
);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- 
-- Summary: Added 4 new system roles
-- 1. Senior Designer (Level 2) - Project management, quotation approval, team mentoring
-- 2. Designer (Level 3) - Assigned projects, designs, library access
-- 3. Sales (Level 3) - Full CRM access, proposals, client management
-- 4. Procurement (Level 3) - Full stock/vendor/PO management
--
-- Total System Roles: 10
-- Level 0: Owner
-- Level 1: Admin
-- Level 2: Manager, Finance, Senior Designer
-- Level 3: Staff, Designer, Sales, Procurement
-- Level 4: Limited
--
