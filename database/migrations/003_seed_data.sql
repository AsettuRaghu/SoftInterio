-- =====================================================
-- SoftInterio Seed Data
-- =====================================================
-- Description: Initial data for system config, roles, permissions, and subscription plans
-- Target: Supabase (PostgreSQL with auth integration)
-- 
-- Run this AFTER 001_schema.sql and 002_rls_policies.sql
-- =====================================================

-- =====================================================
-- 0. SYSTEM CONFIGURATION
-- =====================================================
-- These settings control system behavior for NEW signups
-- Existing accounts are NOT affected when these change
-- Update these directly in the database to change behavior

-- Trial Configuration
INSERT INTO system_config (config_key, config_value, description, updated_by)
VALUES (
    'trial_settings',
    '{
        "enabled": true,
        "trial_days": 30,
        "default_plan_slug": "signature",
        "require_payment_method": false,
        "auto_expire": true,
        "grace_period_days": 7
    }'::jsonb,
    'Trial period settings. Changes only affect NEW signups. enabled: whether new signups get trial. trial_days: number of days. default_plan_slug: which plan during trial.',
    'system'
);

-- Billing Configuration
INSERT INTO system_config (config_key, config_value, description, updated_by)
VALUES (
    'billing_settings',
    '{
        "enabled_cycles": ["yearly"],
        "default_cycle": "yearly",
        "allow_monthly": false,
        "currency": "INR",
        "tax_rate": 18,
        "tax_name": "GST",
        "warning_days_threshold": 30,
        "payment_gateway": "razorpay"
    }'::jsonb,
    'Billing configuration. enabled_cycles: which billing cycles are offered. warning_days_threshold: when to show renewal warning.',
    'system'
);

-- Subscription Limits Configuration
INSERT INTO system_config (config_key, config_value, description, updated_by)
VALUES (
    'subscription_limits',
    '{
        "enforce_user_limits": true,
        "enforce_project_limits": true,
        "enforce_storage_limits": true,
        "overage_allowed": false,
        "overage_notification_threshold": 80
    }'::jsonb,
    'How subscription limits are enforced. overage_notification_threshold: percentage at which to warn users.',
    'system'
);

-- Feature Flags
INSERT INTO system_config (config_key, config_value, description, updated_by)
VALUES (
    'feature_flags',
    '{
        "payments_enabled": false,
        "invoicing_enabled": true,
        "multi_currency": false,
        "white_label": false,
        "api_access": false
    }'::jsonb,
    'Feature flags for enabling/disabling major features.',
    'system'
);

-- =====================================================
-- 1. SYSTEM ROLES
-- =====================================================
-- Hierarchy: Owner(0) > Admin(1) > Manager/Senior Designer/Finance(2) > Staff/Designer/Sales/Procurement(3) > Limited(4)

-- Level 0: Owner (Supreme authority)
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (uuid_generate_v4(), NULL, 'Owner', 'owner', 
    'Company owner with full control. Can transfer ownership. Cannot be removed.', 
    true, false, 0);

-- Level 1: Admin
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (uuid_generate_v4(), NULL, 'Admin', 'admin', 
    'Administrative access to manage users, roles, and settings. Cannot manage billing or owner.', 
    true, false, 1);

-- Level 2: Manager
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (uuid_generate_v4(), NULL, 'Manager', 'manager', 
    'Manage projects, teams, and day-to-day operations. Read-only access to settings.', 
    true, false, 2);

-- Level 2: Senior Designer
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (uuid_generate_v4(), NULL, 'Senior Designer', 'senior-designer', 
    'Senior designer who can manage projects, mentor juniors, and approve quotations.', 
    true, false, 2);

-- Level 2: Finance
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (uuid_generate_v4(), NULL, 'Finance', 'finance', 
    'Finance department. Can view all projects/sales for context, but only manage financial records.', 
    true, false, 2);

-- Level 3: Staff (Default for invites)
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (uuid_generate_v4(), NULL, 'Staff', 'staff', 
    'Regular staff access. Can work on assigned projects and tasks.', 
    true, true, 3);

-- Level 3: Designer
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (uuid_generate_v4(), NULL, 'Designer', 'designer', 
    'Designer who works on assigned projects, creates designs, and collaborates with the team.', 
    true, false, 3);

-- Level 3: Sales
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (uuid_generate_v4(), NULL, 'Sales', 'sales', 
    'Sales representative who manages leads, clients, and creates initial proposals.', 
    true, false, 3);

-- Level 3: Procurement
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (uuid_generate_v4(), NULL, 'Procurement', 'procurement', 
    'Procurement specialist who manages vendors, purchase orders, and stock.', 
    true, false, 3);

-- Level 4: Limited
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (uuid_generate_v4(), NULL, 'Limited', 'limited', 
    'Restricted access. View-only permissions or specific module access.', 
    true, false, 4);

-- =====================================================
-- 2. PERMISSIONS
-- =====================================================

-- Dashboard
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('dashboard.view', 'dashboard', 'View dashboard and overview', true);

-- Sales (CRM)
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('sales.view', 'sales', 'View leads, pipeline, and contacts', true),
('sales.create', 'sales', 'Create leads and contacts', true),
('sales.update', 'sales', 'Update leads and contacts', true),
('sales.delete', 'sales', 'Delete leads and contacts', true),
('sales.convert', 'sales', 'Convert lead to project', true),
('sales.assign', 'sales', 'Assign leads to team members', true);

-- Projects
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('projects.view', 'projects', 'View projects list and details', true),
('projects.view_all', 'projects', 'View all projects (not just assigned)', true),
('projects.create', 'projects', 'Create new projects', true),
('projects.update', 'projects', 'Update project details', true),
('projects.delete', 'projects', 'Delete projects', true),
('projects.archive', 'projects', 'Archive projects', true),
('projects.assign', 'projects', 'Assign team members to projects', true);

-- Quotations
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('quotations.view', 'quotations', 'View quotations', true),
('quotations.create', 'quotations', 'Create new quotations', true),
('quotations.update', 'quotations', 'Update quotations', true),
('quotations.delete', 'quotations', 'Delete quotations', true),
('quotations.approve', 'quotations', 'Approve/reject quotations', true),
('quotations.send', 'quotations', 'Send quotations to clients', true);

-- Stock & Inventory
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('stock.view', 'stock', 'View inventory and stock levels', true),
('stock.create', 'stock', 'Add new inventory items', true),
('stock.update', 'stock', 'Update inventory details', true),
('stock.delete', 'stock', 'Delete inventory items', true),
('stock.adjust', 'stock', 'Adjust stock quantities', true);

-- Procurement
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('procurement.view', 'stock', 'View purchase orders and requests', true),
('procurement.create', 'stock', 'Create purchase orders', true),
('procurement.update', 'stock', 'Update purchase orders', true),
('procurement.delete', 'stock', 'Delete purchase orders', true),
('procurement.approve', 'stock', 'Approve purchase orders', true);

-- Vendors
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('vendors.view', 'stock', 'View vendors list', true),
('vendors.create', 'stock', 'Create new vendors', true),
('vendors.update', 'stock', 'Update vendor details', true),
('vendors.delete', 'stock', 'Delete vendors', true);

-- Finance
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('finance.view', 'finance', 'View financial data, invoices, payments', true),
('finance.create', 'finance', 'Create invoices, payments, expenses', true),
('finance.update', 'finance', 'Update financial records', true),
('finance.delete', 'finance', 'Delete financial records', true),
('finance.approve', 'finance', 'Approve payments and expenses', true),
('finance.export', 'finance', 'Export financial data', true);

-- Tasks
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('tasks.view', 'tasks', 'View tasks', true),
('tasks.view_all', 'tasks', 'View all tasks (not just assigned)', true),
('tasks.create', 'tasks', 'Create new tasks', true),
('tasks.update', 'tasks', 'Update tasks', true),
('tasks.delete', 'tasks', 'Delete tasks', true),
('tasks.assign', 'tasks', 'Assign tasks to team members', true);

-- Calendar
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('calendar.view', 'calendar', 'View calendar and events', true),
('calendar.create', 'calendar', 'Create calendar events', true),
('calendar.update', 'calendar', 'Update calendar events', true),
('calendar.delete', 'calendar', 'Delete calendar events', true);

-- Documents
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('documents.view', 'documents', 'View documents', true),
('documents.upload', 'documents', 'Upload documents', true),
('documents.update', 'documents', 'Update document details', true),
('documents.delete', 'documents', 'Delete documents', true),
('documents.share', 'documents', 'Share documents externally', true);

-- Library
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('library.view', 'library', 'View resource library', true),
('library.upload', 'library', 'Upload to library', true),
('library.update', 'library', 'Update library items', true),
('library.delete', 'library', 'Delete library items', true);

-- Reports
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('reports.view', 'reports', 'View reports', true),
('reports.create', 'reports', 'Create custom reports', true),
('reports.export', 'reports', 'Export reports', true);

-- Settings - Profile
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('settings.profile', 'settings', 'Manage own profile', true);

-- Settings - Company
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('settings.company.view', 'settings', 'View company settings', true),
('settings.company.update', 'settings', 'Update company settings', true);

-- Settings - Team
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('settings.team.view', 'settings', 'View team members', true),
('settings.team.invite', 'settings', 'Invite new team members', true),
('settings.team.update', 'settings', 'Update team member details', true),
('settings.team.remove', 'settings', 'Remove team members', true);

-- Settings - Billing
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('settings.billing', 'settings', 'Manage billing and subscription', true);

-- Ownership
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('ownership.transfer', 'ownership', 'Transfer company ownership', true);

-- =====================================================
-- 3. ROLE PERMISSIONS ASSIGNMENTS
-- =====================================================

-- Owner: ALL permissions
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'owner' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p;

-- Admin: All except ownership (includes billing)
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'admin' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key NOT IN ('ownership.transfer');

-- Manager: Operational focus (Settings: Profile only)
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'manager' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN (
    'dashboard.view',
    'sales.view', 'sales.create', 'sales.update', 'sales.convert', 'sales.assign',
    'projects.view', 'projects.view_all', 'projects.create', 'projects.update', 'projects.archive', 'projects.assign',
    'quotations.view', 'quotations.create', 'quotations.update', 'quotations.approve', 'quotations.send',
    'stock.view', 'stock.adjust', 'procurement.view', 'procurement.create', 'procurement.update', 'vendors.view',
    'finance.view',
    'tasks.view', 'tasks.view_all', 'tasks.create', 'tasks.update', 'tasks.delete', 'tasks.assign',
    'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete',
    'documents.view', 'documents.upload', 'documents.update', 'documents.share',
    'library.view', 'library.upload',
    'reports.view', 'reports.export',
    'settings.profile'
);

-- Senior Designer: Project management + quotation approval (Settings: Profile only)
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'senior-designer' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN (
    'dashboard.view',
    'sales.view',
    'projects.view', 'projects.view_all', 'projects.create', 'projects.update', 'projects.archive', 'projects.assign',
    'quotations.view', 'quotations.create', 'quotations.update', 'quotations.approve', 'quotations.send',
    'stock.view', 'procurement.view', 'vendors.view',
    'finance.view',
    'tasks.view', 'tasks.view_all', 'tasks.create', 'tasks.update', 'tasks.delete', 'tasks.assign',
    'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete',
    'documents.view', 'documents.upload', 'documents.update', 'documents.delete', 'documents.share',
    'library.view', 'library.upload', 'library.update', 'library.delete',
    'reports.view', 'reports.export',
    'settings.profile'
);

-- Finance: Read-all, write-finance (Settings: Profile + Billing)
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'finance' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN (
    'dashboard.view',
    'sales.view',
    'projects.view', 'projects.view_all',
    'quotations.view',
    'stock.view', 'procurement.view', 'vendors.view',
    'finance.view', 'finance.create', 'finance.update', 'finance.delete', 'finance.approve', 'finance.export',
    'tasks.view', 'tasks.create', 'tasks.update',
    'calendar.view', 'calendar.create', 'calendar.update',
    'documents.view',
    'reports.view', 'reports.export',
    'settings.profile', 'settings.billing'
);

-- Staff: Day-to-day work (Settings: Profile only)
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'staff' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN (
    'dashboard.view',
    'sales.view', 'sales.create', 'sales.update',
    'projects.view', 'projects.update',
    'quotations.view', 'quotations.create', 'quotations.update',
    'stock.view', 'procurement.view', 'vendors.view',
    'finance.view',
    'tasks.view', 'tasks.create', 'tasks.update',
    'calendar.view', 'calendar.create', 'calendar.update',
    'documents.view', 'documents.upload',
    'library.view',
    'reports.view',
    'settings.profile'
);

-- Designer: Design focus (Settings: Profile only)
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'designer' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN (
    'dashboard.view',
    'projects.view', 'projects.update',
    'quotations.view', 'quotations.create', 'quotations.update',
    'stock.view', 'vendors.view',
    'tasks.view', 'tasks.create', 'tasks.update',
    'calendar.view', 'calendar.create', 'calendar.update',
    'documents.view', 'documents.upload', 'documents.update',
    'library.view', 'library.upload',
    'reports.view',
    'settings.profile'
);

-- Sales: Full CRM access (Settings: Profile only)
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'sales' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN (
    'dashboard.view',
    'sales.view', 'sales.create', 'sales.update', 'sales.delete', 'sales.convert', 'sales.assign',
    'projects.view',
    'quotations.view', 'quotations.create', 'quotations.update', 'quotations.send',
    'finance.view',
    'tasks.view', 'tasks.create', 'tasks.update',
    'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete',
    'documents.view', 'documents.upload',
    'reports.view',
    'settings.profile'
);

-- Procurement: Stock/vendor focus (Settings: Profile only)
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'procurement' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN (
    'dashboard.view',
    'projects.view',
    'stock.view', 'stock.create', 'stock.update', 'stock.delete', 'stock.adjust',
    'procurement.view', 'procurement.create', 'procurement.update', 'procurement.delete',
    'vendors.view', 'vendors.create', 'vendors.update', 'vendors.delete',
    'finance.view',
    'tasks.view', 'tasks.create', 'tasks.update',
    'calendar.view', 'calendar.create', 'calendar.update',
    'documents.view', 'documents.upload',
    'library.view',
    'reports.view',
    'settings.profile'
);

-- Limited: View-only (Settings: Profile only)
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    (SELECT id FROM roles WHERE slug = 'limited' AND tenant_id IS NULL),
    p.id,
    true
FROM permissions p
WHERE p.key IN (
    'dashboard.view',
    'projects.view',
    'tasks.view',
    'calendar.view',
    'documents.view',
    'library.view',
    'settings.profile'
);

-- =====================================================
-- 4. SUBSCRIPTION PLANS
-- =====================================================

-- Classic Plan
INSERT INTO subscription_plans (
    id, name, slug, tenant_type, description,
    price_monthly, price_yearly,
    max_users, max_projects, max_storage_gb,
    is_active, is_featured, display_order
) VALUES (
    uuid_generate_v4(),
    'Classic',
    'classic',
    'interiors',
    'Perfect for solo designers & small studios',
    10000, 120000,
    5, 50, 25,
    true, false, 1
);

-- Signature Plan (Most Popular)
INSERT INTO subscription_plans (
    id, name, slug, tenant_type, description,
    price_monthly, price_yearly,
    max_users, max_projects, max_storage_gb,
    is_active, is_featured, display_order
) VALUES (
    uuid_generate_v4(),
    'Signature',
    'signature',
    'interiors',
    'For studios that need advanced workflow and team features',
    20000, 240000,
    15, 200, 100,
    true, true, 2
);

-- Masterpiece Plan
INSERT INTO subscription_plans (
    id, name, slug, tenant_type, description,
    price_monthly, price_yearly,
    max_users, max_projects, max_storage_gb,
    is_active, is_featured, display_order
) VALUES (
    uuid_generate_v4(),
    'Masterpiece',
    'masterpiece',
    'interiors',
    'For large studios needing enterprise-level features',
    50000, 600000,
    -1, -1, 500,
    true, false, 3
);

-- =====================================================
-- 5. SUBSCRIPTION PLAN FEATURES
-- =====================================================

DO $$
DECLARE
    classic_plan_id UUID;
    signature_plan_id UUID;
    masterpiece_plan_id UUID;
BEGIN
    SELECT id INTO classic_plan_id FROM subscription_plans WHERE slug = 'classic' AND tenant_type = 'interiors';
    SELECT id INTO signature_plan_id FROM subscription_plans WHERE slug = 'signature' AND tenant_type = 'interiors';
    SELECT id INTO masterpiece_plan_id FROM subscription_plans WHERE slug = 'masterpiece' AND tenant_type = 'interiors';

    -- Classic Plan Features
    IF classic_plan_id IS NOT NULL THEN
        INSERT INTO subscription_plan_features (plan_id, feature_key, feature_name, included, limit_value) VALUES
        (classic_plan_id, 'projects', 'Project Management', true, 50),
        (classic_plan_id, 'clients', 'Client Portal', true, NULL),
        (classic_plan_id, 'storage', 'Document Storage', true, 25),
        (classic_plan_id, 'reports', 'Basic Reporting', true, NULL),
        (classic_plan_id, 'support', 'Email Support', true, NULL);
    END IF;

    -- Signature Plan Features
    IF signature_plan_id IS NOT NULL THEN
        INSERT INTO subscription_plan_features (plan_id, feature_key, feature_name, included, limit_value) VALUES
        (signature_plan_id, 'projects', 'Project Management', true, 200),
        (signature_plan_id, 'clients', 'Client Portal', true, NULL),
        (signature_plan_id, 'storage', 'Document Storage', true, 100),
        (signature_plan_id, 'team', 'Advanced Team Management', true, NULL),
        (signature_plan_id, 'financial', 'Financial Reporting', true, NULL),
        (signature_plan_id, 'vendor', 'Vendor Management', true, NULL),
        (signature_plan_id, 'dashboards', 'Custom Dashboards', true, NULL),
        (signature_plan_id, 'support', 'Priority Support', true, NULL);
    END IF;

    -- Masterpiece Plan Features
    IF masterpiece_plan_id IS NOT NULL THEN
        INSERT INTO subscription_plan_features (plan_id, feature_key, feature_name, included, limit_value) VALUES
        (masterpiece_plan_id, 'projects', 'Unlimited Projects', true, NULL),
        (masterpiece_plan_id, 'clients', 'Client Portal', true, NULL),
        (masterpiece_plan_id, 'storage', 'Document Storage', true, 500),
        (masterpiece_plan_id, 'team', 'Advanced Team Management', true, NULL),
        (masterpiece_plan_id, 'financial', 'Financial Reporting', true, NULL),
        (masterpiece_plan_id, 'vendor', 'Vendor Management', true, NULL),
        (masterpiece_plan_id, 'dashboards', 'Custom Dashboards', true, NULL),
        (masterpiece_plan_id, 'staff', 'Staff Management', true, NULL),
        (masterpiece_plan_id, 'marketing', 'Sales & Marketing Tools', true, NULL),
        (masterpiece_plan_id, 'analytics', 'Advanced Analytics', true, NULL),
        (masterpiece_plan_id, 'whitelabel', 'White-label Options', true, NULL),
        (masterpiece_plan_id, 'support', 'Dedicated Account Manager', true, NULL);
    END IF;
END $$;

-- =====================================================
-- SEED DATA COMPLETE
-- =====================================================
-- 
-- Summary:
-- - 10 System Roles: Owner, Admin, Manager, Senior Designer, Finance, Staff, Designer, Sales, Procurement, Limited
-- - 70+ Permissions across 13 modules
-- - 3 Subscription Plans: Classic, Signature, Masterpiece
-- - Plan features for each plan
-- =====================================================
