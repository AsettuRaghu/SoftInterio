-- Migration: 004_rbac_enhancements.sql
-- Description: Enhanced RBAC with ownership transfer, updated permissions, and refined role hierarchy
-- Date: 2025-11-27
-- Version: 2.0 - Comprehensive module permissions based on architecture alignment
-- Note: Run AFTER 001, 003 migrations. Designed for Supabase.
--
-- MODULES COVERED:
-- Dashboard, Sales, Projects, Quotations, Stock & Procurement, Finance,
-- Tasks, Calendar, Documents, Library, Reports, Settings

-- =====================================================
-- 1. CREATE OWNERSHIP TRANSFERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS ownership_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
    token VARCHAR(500) NOT NULL UNIQUE,
    reason TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_pending_transfer UNIQUE(tenant_id, status)
);

-- Enable RLS
ALTER TABLE ownership_transfers ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ownership_transfers_tenant_id ON ownership_transfers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ownership_transfers_from_user ON ownership_transfers(from_user_id);
CREATE INDEX IF NOT EXISTS idx_ownership_transfers_to_user ON ownership_transfers(to_user_id);
CREATE INDEX IF NOT EXISTS idx_ownership_transfers_status ON ownership_transfers(status);
CREATE INDEX IF NOT EXISTS idx_ownership_transfers_token ON ownership_transfers(token);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_ownership_transfers_updated_at ON ownership_transfers;
CREATE TRIGGER update_ownership_transfers_updated_at BEFORE UPDATE ON ownership_transfers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for ownership_transfers
DROP POLICY IF EXISTS "Users can view their own ownership transfers" ON ownership_transfers;
CREATE POLICY "Users can view their own ownership transfers"
    ON ownership_transfers FOR SELECT
    USING (
        from_user_id = auth.uid() OR to_user_id = auth.uid()
    );

DROP POLICY IF EXISTS "Owner can create ownership transfer" ON ownership_transfers;
CREATE POLICY "Owner can create ownership transfer"
    ON ownership_transfers FOR INSERT
    WITH CHECK (
        from_user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid() 
            AND r.slug = 'owner'
            AND (r.tenant_id IS NULL OR r.tenant_id = tenant_id)
        )
    );

DROP POLICY IF EXISTS "Involved users can update ownership transfer" ON ownership_transfers;
CREATE POLICY "Involved users can update ownership transfer"
    ON ownership_transfers FOR UPDATE
    USING (
        from_user_id = auth.uid() OR to_user_id = auth.uid()
    );

-- =====================================================
-- 2. UPDATE SYSTEM ROLES WITH CORRECT HIERARCHY
-- =====================================================

-- First, delete existing role_permissions and roles to recreate them properly
-- (This is safe for fresh installs or early development)

-- Note: If you have existing data, you may want to UPDATE instead of DELETE+INSERT

-- Remove old role permissions
DELETE FROM role_permissions 
WHERE role_id IN (
    SELECT id FROM roles WHERE tenant_id IS NULL AND is_system_role = true
);

-- Remove old system roles
DELETE FROM roles WHERE tenant_id IS NULL AND is_system_role = true;

-- Insert new system roles with correct hierarchy
-- Level 0: Owner (Supreme authority)
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (
    uuid_generate_v4(), 
    NULL, 
    'Owner', 
    'owner', 
    'Company owner with full control. Can transfer ownership. Cannot be removed.', 
    true, 
    false, 
    0
);

-- Level 1: Admin (Can manage most things except billing and owner)
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (
    uuid_generate_v4(), 
    NULL, 
    'Admin', 
    'admin', 
    'Administrative access to manage users, roles, and settings. Cannot manage billing or owner.', 
    true, 
    false, 
    1
);

-- Level 2: Manager (Project/Team management)
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (
    uuid_generate_v4(), 
    NULL, 
    'Manager', 
    'manager', 
    'Manage projects, teams, and day-to-day operations. Read-only access to settings.', 
    true, 
    false, 
    2
);

-- Level 3: Staff (Regular employee)
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (
    uuid_generate_v4(), 
    NULL, 
    'Staff', 
    'staff', 
    'Regular staff access. Can work on assigned projects and tasks.', 
    true, 
    true, -- Default role for new invitations
    3
);

-- Level 4: Limited (View-only or specific module access)
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (
    uuid_generate_v4(), 
    NULL, 
    'Limited', 
    'limited', 
    'Restricted access. View-only permissions or specific module access.', 
    true, 
    false, 
    4
);

-- =====================================================
-- 3. CLEAR AND INSERT ALL PERMISSIONS
-- =====================================================

-- Clear existing permissions (safe for development)
DELETE FROM permissions;

-- =====================================================
-- 3.1 DASHBOARD PERMISSIONS
-- =====================================================
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('dashboard.view', 'dashboard', 'View dashboard and overview', true);

-- =====================================================
-- 3.2 SALES (CRM) PERMISSIONS
-- =====================================================
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('sales.view', 'sales', 'View leads, pipeline, and contacts', true),
('sales.create', 'sales', 'Create leads and contacts', true),
('sales.update', 'sales', 'Update leads and contacts', true),
('sales.delete', 'sales', 'Delete leads and contacts', true),
('sales.convert', 'sales', 'Convert lead to project', true),
('sales.assign', 'sales', 'Assign leads to team members', true);

-- =====================================================
-- 3.3 PROJECTS PERMISSIONS
-- =====================================================
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('projects.view', 'projects', 'View projects list and details', true),
('projects.view_all', 'projects', 'View all projects (not just assigned)', true),
('projects.create', 'projects', 'Create new projects', true),
('projects.update', 'projects', 'Update project details', true),
('projects.delete', 'projects', 'Delete projects', true),
('projects.archive', 'projects', 'Archive projects', true),
('projects.assign', 'projects', 'Assign team members to projects', true);

-- =====================================================
-- 3.4 QUOTATIONS PERMISSIONS
-- =====================================================
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('quotations.view', 'quotations', 'View quotations', true),
('quotations.create', 'quotations', 'Create new quotations', true),
('quotations.update', 'quotations', 'Update quotations', true),
('quotations.delete', 'quotations', 'Delete quotations', true),
('quotations.approve', 'quotations', 'Approve/reject quotations', true),
('quotations.send', 'quotations', 'Send quotations to clients', true);

-- =====================================================
-- 3.5 STOCK & PROCUREMENT PERMISSIONS (Combined module)
-- =====================================================
-- Inventory sub-permissions
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('stock.view', 'stock', 'View inventory and stock levels', true),
('stock.create', 'stock', 'Add new inventory items', true),
('stock.update', 'stock', 'Update inventory details', true),
('stock.delete', 'stock', 'Delete inventory items', true),
('stock.adjust', 'stock', 'Adjust stock quantities', true);

-- Procurement sub-permissions
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('procurement.view', 'stock', 'View purchase orders and requests', true),
('procurement.create', 'stock', 'Create purchase orders', true),
('procurement.update', 'stock', 'Update purchase orders', true),
('procurement.delete', 'stock', 'Delete purchase orders', true),
('procurement.approve', 'stock', 'Approve purchase orders', true);

-- Vendors sub-permissions (part of Stock module)
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('vendors.view', 'stock', 'View vendors list', true),
('vendors.create', 'stock', 'Create new vendors', true),
('vendors.update', 'stock', 'Update vendor details', true),
('vendors.delete', 'stock', 'Delete vendors', true);

-- =====================================================
-- 3.6 FINANCE PERMISSIONS
-- =====================================================
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('finance.view', 'finance', 'View financial data, invoices, payments', true),
('finance.create', 'finance', 'Create invoices, payments, expenses', true),
('finance.update', 'finance', 'Update financial records', true),
('finance.delete', 'finance', 'Delete financial records', true),
('finance.approve', 'finance', 'Approve payments and expenses', true),
('finance.export', 'finance', 'Export financial data', true);

-- =====================================================
-- 3.7 TASKS PERMISSIONS
-- =====================================================
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('tasks.view', 'tasks', 'View tasks', true),
('tasks.view_all', 'tasks', 'View all tasks (not just assigned)', true),
('tasks.create', 'tasks', 'Create new tasks', true),
('tasks.update', 'tasks', 'Update tasks', true),
('tasks.delete', 'tasks', 'Delete tasks', true),
('tasks.assign', 'tasks', 'Assign tasks to team members', true);

-- =====================================================
-- 3.8 CALENDAR PERMISSIONS
-- =====================================================
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('calendar.view', 'calendar', 'View calendar and events', true),
('calendar.create', 'calendar', 'Create calendar events', true),
('calendar.update', 'calendar', 'Update calendar events', true),
('calendar.delete', 'calendar', 'Delete calendar events', true);

-- =====================================================
-- 3.9 DOCUMENTS PERMISSIONS
-- =====================================================
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('documents.view', 'documents', 'View documents', true),
('documents.upload', 'documents', 'Upload documents', true),
('documents.update', 'documents', 'Update document details', true),
('documents.delete', 'documents', 'Delete documents', true),
('documents.share', 'documents', 'Share documents externally', true);

-- =====================================================
-- 3.10 LIBRARY PERMISSIONS
-- =====================================================
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('library.view', 'library', 'View resource library', true),
('library.upload', 'library', 'Upload to library', true),
('library.update', 'library', 'Update library items', true),
('library.delete', 'library', 'Delete library items', true);

-- =====================================================
-- 3.11 REPORTS PERMISSIONS
-- =====================================================
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('reports.view', 'reports', 'View reports', true),
('reports.create', 'reports', 'Create custom reports', true),
('reports.export', 'reports', 'Export reports', true);

-- =====================================================
-- 3.12 SETTINGS PERMISSIONS
-- =====================================================
-- My Profile (everyone has access to their own profile)
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('settings.profile', 'settings', 'Manage own profile', true);

-- Company Settings
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('settings.company.view', 'settings', 'View company settings', true),
('settings.company.update', 'settings', 'Update company settings', true);

-- Team Management
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('settings.team.view', 'settings', 'View team members', true),
('settings.team.invite', 'settings', 'Invite new team members', true),
('settings.team.update', 'settings', 'Update team member details', true),
('settings.team.remove', 'settings', 'Remove team members', true);

-- Roles & Permissions
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('settings.roles.view', 'settings', 'View roles', true),
('settings.roles.create', 'settings', 'Create custom roles', true),
('settings.roles.update', 'settings', 'Update roles and permissions', true),
('settings.roles.delete', 'settings', 'Delete custom roles', true);

-- Workflows (Approval configurations)
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('settings.workflows.view', 'settings', 'View workflow configurations', true),
('settings.workflows.update', 'settings', 'Manage approval workflows', true);

-- Preferences (Lead-to-Project auto-convert, etc.)
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('settings.preferences.view', 'settings', 'View preferences', true),
('settings.preferences.update', 'settings', 'Update preferences', true);

-- Billing & Subscription (Owner only)
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('settings.billing', 'settings', 'Manage billing and subscription', true);

-- Integrations
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('settings.integrations.view', 'settings', 'View integrations', true),
('settings.integrations.update', 'settings', 'Manage integrations', true);

-- =====================================================
-- 3.13 OWNERSHIP PERMISSIONS (Owner only)
-- =====================================================
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('ownership.transfer', 'ownership', 'Transfer company ownership', true);

-- =====================================================
-- 4. ASSIGN PERMISSIONS TO ROLES
-- =====================================================

-- =====================================================
-- 4.1 OWNER - ALL PERMISSIONS
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'owner' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p;

-- =====================================================
-- 4.2 ADMIN - All except billing and ownership
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'admin' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key NOT IN ('settings.billing', 'ownership.transfer');

-- =====================================================
-- 4.3 MANAGER - Operational focus, team management
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'manager' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN (
    -- Dashboard
    'dashboard.view',
    -- Sales - full access
    'sales.view', 'sales.create', 'sales.update', 'sales.convert', 'sales.assign',
    -- Projects - full access + view all
    'projects.view', 'projects.view_all', 'projects.create', 'projects.update', 'projects.archive', 'projects.assign',
    -- Quotations - full access
    'quotations.view', 'quotations.create', 'quotations.update', 'quotations.approve', 'quotations.send',
    -- Stock & Procurement - view, adjust, procurement
    'stock.view', 'stock.adjust',
    'procurement.view', 'procurement.create', 'procurement.update',
    'vendors.view',
    -- Finance - view only (can see for invoicing context)
    'finance.view',
    -- Tasks - full access + view all
    'tasks.view', 'tasks.view_all', 'tasks.create', 'tasks.update', 'tasks.delete', 'tasks.assign',
    -- Calendar - full access
    'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete',
    -- Documents - full access
    'documents.view', 'documents.upload', 'documents.update', 'documents.share',
    -- Library - view and upload
    'library.view', 'library.upload',
    -- Reports - view and export
    'reports.view', 'reports.export',
    -- Settings - limited
    'settings.profile',
    'settings.company.view',
    'settings.team.view', 'settings.team.invite', 'settings.team.update',
    'settings.roles.view',
    'settings.workflows.view',
    'settings.preferences.view'
);

-- =====================================================
-- 4.4 STAFF - Day-to-day work, own data only
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'staff' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN (
    -- Dashboard
    'dashboard.view',
    -- Sales - view and create (assigned leads)
    'sales.view', 'sales.create', 'sales.update',
    -- Projects - view and update (assigned only, no view_all)
    'projects.view', 'projects.update',
    -- Quotations - view, create, update
    'quotations.view', 'quotations.create', 'quotations.update',
    -- Stock - view only
    'stock.view',
    'procurement.view',
    'vendors.view',
    -- Finance - view only
    'finance.view',
    -- Tasks - view, create, update (own tasks, no view_all)
    'tasks.view', 'tasks.create', 'tasks.update',
    -- Calendar - full access for own events
    'calendar.view', 'calendar.create', 'calendar.update',
    -- Documents - view and upload
    'documents.view', 'documents.upload',
    -- Library - view only
    'library.view',
    -- Reports - view only
    'reports.view',
    -- Settings - profile only
    'settings.profile',
    'settings.company.view',
    'settings.team.view'
);

-- =====================================================
-- 4.5 LIMITED - Minimal view access
-- =====================================================
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'limited' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN (
    -- Dashboard
    'dashboard.view',
    -- Projects - view only (assigned)
    'projects.view',
    -- Tasks - view only (assigned)
    'tasks.view',
    -- Calendar - view only
    'calendar.view',
    -- Documents - view only
    'documents.view',
    -- Library - view only
    'library.view',
    -- Settings - profile only
    'settings.profile',
    'settings.team.view'
);

-- =====================================================
-- 4.6 SPECIAL ROLE: FINANCE (Custom role example)
-- This shows how to create a department-specific role
-- Finance can view all but only edit financial data
-- =====================================================
-- Note: This is inserted as a system role for reference
-- Tenants can create similar custom roles

INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (
    uuid_generate_v4(), 
    NULL, 
    'Finance', 
    'finance', 
    'Finance department. Can view all projects/sales for context, but only manage financial records.', 
    true, 
    false, 
    2 -- Same level as Manager
);

INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'finance' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN (
    -- Dashboard
    'dashboard.view',
    -- Sales - view only (for context)
    'sales.view',
    -- Projects - view all (for invoicing context)
    'projects.view', 'projects.view_all',
    -- Quotations - view only
    'quotations.view',
    -- Stock & Procurement - view only
    'stock.view',
    'procurement.view',
    'vendors.view',
    -- Finance - FULL ACCESS
    'finance.view', 'finance.create', 'finance.update', 'finance.delete', 'finance.approve', 'finance.export',
    -- Tasks - own tasks only
    'tasks.view', 'tasks.create', 'tasks.update',
    -- Calendar
    'calendar.view', 'calendar.create', 'calendar.update',
    -- Documents - view only
    'documents.view',
    -- Reports - view and export
    'reports.view', 'reports.export',
    -- Settings - profile
    'settings.profile',
    'settings.company.view',
    'settings.team.view'
);

-- =====================================================
-- 5. ADD HELPER FUNCTIONS FOR RBAC
-- =====================================================

-- Function to check if user is owner
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid() 
        AND r.slug = 'owner'
        AND (r.tenant_id IS NULL OR r.tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin or higher
CREATE OR REPLACE FUNCTION is_admin_or_higher()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid() 
        AND r.hierarchy_level <= 1 -- Owner (0) or Admin (1)
        AND (r.tenant_id IS NULL OR r.tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's highest role hierarchy level (lower = more permissions)
CREATE OR REPLACE FUNCTION get_user_hierarchy_level()
RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE(
        (SELECT MIN(r.hierarchy_level) 
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = auth.uid()
         AND (r.tenant_id IS NULL OR r.tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()))
        ),
        999 -- No role = no access
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all permissions for current user
CREATE OR REPLACE FUNCTION get_user_permissions()
RETURNS TABLE(permission_key TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT p.key::TEXT
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
    AND rp.granted = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Improved has_permission function with caching consideration
CREATE OR REPLACE FUNCTION has_permission(permission_key TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = auth.uid() 
        AND p.key = permission_key 
        AND rp.granted = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. UPDATE RLS POLICIES FOR ROLES MANAGEMENT
-- =====================================================

-- Drop existing policies on roles if they exist
DROP POLICY IF EXISTS "Users can view tenant roles" ON roles;
DROP POLICY IF EXISTS "Users can view accessible roles" ON roles;
DROP POLICY IF EXISTS "Admins can manage tenant roles" ON roles;
DROP POLICY IF EXISTS "Admins can update tenant roles" ON roles;
DROP POLICY IF EXISTS "Admins can delete tenant roles" ON roles;

-- Updated policy: Users can view system roles and their tenant's custom roles
CREATE POLICY "Users can view accessible roles"
    ON roles FOR SELECT
    USING (
        tenant_id IS NULL -- System roles
        OR tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()) -- Tenant roles
    );

-- Only admin or higher can manage custom roles
CREATE POLICY "Admins can manage tenant roles"
    ON roles FOR INSERT
    WITH CHECK (
        is_admin_or_higher()
        AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Admins can update tenant roles"
    ON roles FOR UPDATE
    USING (
        is_admin_or_higher()
        AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
        AND is_system_role = false -- Cannot modify system roles
    );

CREATE POLICY "Admins can delete tenant roles"
    ON roles FOR DELETE
    USING (
        is_admin_or_higher()
        AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
        AND is_system_role = false -- Cannot delete system roles
    );

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- 
-- Summary of changes:
-- 1. Created ownership_transfers table for ownership transfer feature
-- 2. System roles with hierarchy:
--    - Owner (0): Supreme authority, billing, ownership transfer
--    - Admin (1): Full access except billing/ownership
--    - Manager (2): Operational focus, team management
--    - Finance (2): Read-all, write-finance only
--    - Staff (3): Day-to-day work, own data only
--    - Limited (4): View-only access
--
-- 3. Comprehensive permissions for all modules (70+ permissions):
--    - Dashboard: view
--    - Sales: view, create, update, delete, convert, assign
--    - Projects: view, view_all, create, update, delete, archive, assign
--    - Quotations: view, create, update, delete, approve, send
--    - Stock: view, create, update, delete, adjust
--    - Procurement: view, create, update, delete, approve
--    - Vendors: view, create, update, delete
--    - Finance: view, create, update, delete, approve, export
--    - Tasks: view, view_all, create, update, delete, assign
--    - Calendar: view, create, update, delete
--    - Documents: view, upload, update, delete, share
--    - Library: view, upload, update, delete
--    - Reports: view, create, export
--    - Settings: profile, company.*, team.*, roles.*, workflows.*, preferences.*, billing, integrations.*
--    - Ownership: transfer
--
-- 4. Key access patterns:
--    - Staff sees only assigned projects/tasks (no view_all)
--    - Managers see all projects/tasks (has view_all)
--    - Finance can view everything but only edit finance module
--    - Billing is Owner-only
--
-- 5. Helper functions: is_owner(), is_admin_or_higher(), get_user_hierarchy_level(), get_user_permissions()
--
-- 6. Updated RLS policies for role management
--
-- MENU STRUCTURE:
-- Dashboard | Sales | Projects | Quotations | Stock & Procurement | Finance | Tasks | Calendar | Documents | Library | Reports | Settings
--
-- Next steps:
-- - Run this migration in Supabase SQL Editor
-- - Ensure your signup flow assigns 'owner' role to first user
-- - Implement frontend permission checks using has_permission()
-- - Build sidebar menu filtering based on permissions
--

