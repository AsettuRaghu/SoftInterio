-- Migration: 009_add_designer_procurement_roles.sql
-- Description: Add Designer and Procurement system roles with appropriate permissions
-- Date: 2025-11-28
-- Note: Run AFTER 004_rbac_enhancements.sql
--
-- NEW ROLES:
-- - Designer (level 2): Design team members with library, documents, projects access
-- - Procurement (level 3): Purchasing team with vendors, stock, purchase orders focus

-- =====================================================
-- 1. INSERT DESIGNER ROLE (Level 2 - Same as Manager)
-- =====================================================

INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (
    uuid_generate_v4(), 
    NULL, 
    'Designer', 
    'designer', 
    'Design team member. Access to projects, library, documents, and design-related tasks.', 
    true, 
    false, 
    2
) ON CONFLICT DO NOTHING;

-- =====================================================
-- 2. INSERT PROCUREMENT ROLE (Level 3 - Same as Staff)
-- =====================================================

INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (
    uuid_generate_v4(), 
    NULL, 
    'Procurement', 
    'procurement', 
    'Procurement team member. Manage vendors, stock, and purchase orders.', 
    true, 
    false, 
    3
) ON CONFLICT DO NOTHING;

-- =====================================================
-- 3. ASSIGN PERMISSIONS TO DESIGNER ROLE
-- Designer focus: Projects, Library, Documents, Tasks, Calendar
-- Can view quotations and finance for context, but not edit
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
    
    -- Sales - view only (to see client requirements)
    'sales.view',
    
    -- Projects - full access to assigned, view all
    'projects.view',
    'projects.view_all',
    'projects.create',
    'projects.update',
    
    -- Quotations - view and create (designers often create BOQ)
    'quotations.view',
    'quotations.create',
    'quotations.update',
    
    -- Stock - view only (to check material availability)
    'stock.view',
    'vendors.view',
    
    -- Finance - view only
    'finance.view',
    
    -- Tasks - full access to own tasks
    'tasks.view',
    'tasks.create',
    'tasks.update',
    'tasks.delete',
    
    -- Calendar - full access
    'calendar.view',
    'calendar.create',
    'calendar.update',
    'calendar.delete',
    
    -- Documents - full access (design files, presentations)
    'documents.view',
    'documents.upload',
    'documents.update',
    'documents.delete',
    'documents.share',
    
    -- Library - full access (materials, textures, references)
    'library.view',
    'library.upload',
    'library.update',
    'library.delete',
    
    -- Reports - view only
    'reports.view',
    
    -- Settings - profile and view team
    'settings.profile',
    'settings.company.view',
    'settings.team.view'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 4. ASSIGN PERMISSIONS TO PROCUREMENT ROLE
-- Procurement focus: Vendors, Stock, Purchase Orders
-- Can view projects and quotations for context
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
    
    -- Sales - view only
    'sales.view',
    
    -- Projects - view only (to understand material needs)
    'projects.view',
    
    -- Quotations - view only (to see BOQ for ordering)
    'quotations.view',
    
    -- Stock & Inventory - FULL ACCESS
    'stock.view',
    'stock.create',
    'stock.update',
    'stock.delete',
    'stock.adjust',
    
    -- Procurement - FULL ACCESS
    'procurement.view',
    'procurement.create',
    'procurement.update',
    'procurement.delete',
    'procurement.approve',
    
    -- Vendors - FULL ACCESS
    'vendors.view',
    'vendors.create',
    'vendors.update',
    'vendors.delete',
    
    -- Finance - view only (to see payment status)
    'finance.view',
    
    -- Tasks - own tasks only
    'tasks.view',
    'tasks.create',
    'tasks.update',
    
    -- Calendar
    'calendar.view',
    'calendar.create',
    'calendar.update',
    
    -- Documents - view and upload (invoices, delivery notes)
    'documents.view',
    'documents.upload',
    
    -- Library - view only
    'library.view',
    
    -- Reports - view and export (for inventory reports)
    'reports.view',
    'reports.export',
    
    -- Settings - profile and view team
    'settings.profile',
    'settings.company.view',
    'settings.team.view'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 5. UPDATE ROLE HIERARCHY SUMMARY
-- =====================================================
-- 
-- Level 0: Owner
--   - Full system access including billing and ownership transfer
--   - Cannot be assigned via invite (auto-assigned on signup)
--
-- Level 1: Admin
--   - Full access except billing and ownership
--   - Can manage users, roles, settings
--
-- Level 2: Manager, Designer, Finance
--   - Manager: Operational focus, team management, all projects
--   - Designer: Design focus, library, documents, projects
--   - Finance: Financial focus, read-all, write-finance
--
-- Level 3: Staff, Procurement
--   - Staff: General employee, own assigned work
--   - Procurement: Vendor/stock focus, purchase orders
--
-- Level 4: Limited
--   - View-only access, external contractors
--
-- =====================================================

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- 
-- To apply this migration:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Paste this migration
-- 3. Run the SQL
--
-- After running, the following roles will be available for assignment:
-- - Admin
-- - Manager
-- - Designer (NEW)
-- - Finance
-- - Procurement (NEW)
-- - Staff (default)
-- - Limited
--
-- Note: Owner role is not assignable via invite (hierarchy level 0)
--
