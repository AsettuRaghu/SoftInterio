-- Migration: 002_seed_initial_data.sql
-- Description: Seed initial system data for roles and permissions (authentication & user management only)
-- Date: 2025-11-23

-- =====================================================
-- 1. SEED SYSTEM PERMISSIONS
-- =====================================================

-- User Management Permissions
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('users.view', 'users', 'View users in tenant', true),
('users.create', 'users', 'Create new users', true),
('users.update', 'users', 'Update user details', true),
('users.delete', 'users', 'Delete users', true),
('users.invite', 'users', 'Invite users to tenant', true),
('users.manage_roles', 'users', 'Assign and manage user roles', true);

-- Role Management Permissions
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('roles.view', 'roles', 'View roles', true),
('roles.create', 'roles', 'Create custom roles', true),
('roles.update', 'roles', 'Update role details', true),
('roles.delete', 'roles', 'Delete custom roles', true);

-- Settings Permissions
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('settings.view', 'settings', 'View tenant settings', true),
('settings.update', 'settings', 'Update tenant settings', true),
('settings.billing', 'settings', 'Manage billing and subscription', true);

-- =====================================================
-- 2. SEED SYSTEM ROLES
-- =====================================================

-- Super Admin Role (Global - no tenant_id)
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES 
(uuid_generate_v4(), NULL, 'Super Admin', 'super-admin', 'Full system access - first user of tenant', true, false, 0);

-- Admin Role (Global - no tenant_id)
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES 
(uuid_generate_v4(), NULL, 'Admin', 'admin', 'Administrative access to manage users and settings', true, false, 10);

-- Project Manager Role (Global - no tenant_id)
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES 
(uuid_generate_v4(), NULL, 'Project Manager', 'project-manager', 'Manage projects, BOQ, and quotations', true, false, 20);

-- Designer Role (Global - no tenant_id)
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES 
(uuid_generate_v4(), NULL, 'Designer', 'designer', 'Create and manage designs', true, false, 30);

-- Member Role (Global - no tenant_id)
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES 
(uuid_generate_v4(), NULL, 'Member', 'member', 'Basic access to view and collaborate', true, true, 50);

-- =====================================================
-- 3. ASSIGN PERMISSIONS TO ROLES
-- =====================================================

-- Super Admin gets ALL permissions
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'super-admin' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p;

-- Admin gets most permissions (except billing)
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'admin' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key NOT IN ('settings.billing'); -- Admin can't manage billing

-- Project Manager permissions (users and settings only for now)
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'project-manager' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN (
    'users.view',
    'settings.view'
);

-- Designer permissions (view only for now)
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'designer' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN (
    'users.view',
    'settings.view'
);

-- Member permissions (basic view access)
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'member' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN (
    'users.view',
    'settings.view'
);

-- =====================================================
-- SEED COMPLETE
-- =====================================================
-- Note: Subscription plans and other module-specific data will be added later
