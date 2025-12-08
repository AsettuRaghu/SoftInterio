-- =====================================================
-- SoftInterio Seed Data
-- =====================================================
-- Module: Initial Data Seeding
-- Description: System config, roles, permissions, 
--              subscription plans, and quotation master data
-- Target: Supabase (PostgreSQL with auth integration)
-- 
-- Run Order: 7 (After all modules)
-- =====================================================

-- =====================================================
-- SECTION 1: SYSTEM CONFIGURATION
-- =====================================================

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
    'Trial period settings. enabled: whether new signups get trial. trial_days: number of days.',
    'system'
) ON CONFLICT (config_key) DO NOTHING;

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
    'Billing configuration. enabled_cycles: which billing cycles are offered.',
    'system'
) ON CONFLICT (config_key) DO NOTHING;

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
    'How subscription limits are enforced.',
    'system'
) ON CONFLICT (config_key) DO NOTHING;

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
) ON CONFLICT (config_key) DO NOTHING;

-- =====================================================
-- SECTION 2: SYSTEM ROLES
-- =====================================================
-- Hierarchy: Owner(0) > Admin(1) > Manager/Senior Designer/Finance(2) > Staff/Designer/Sales/Procurement(3) > Limited(4)

INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level) VALUES
(uuid_generate_v4(), NULL, 'Owner', 'owner', 'Company owner with full control. Can transfer ownership. Cannot be removed.', true, false, 0),
(uuid_generate_v4(), NULL, 'Admin', 'admin', 'Administrative access to manage users, roles, and settings. Cannot manage billing or owner.', true, false, 1),
(uuid_generate_v4(), NULL, 'Manager', 'manager', 'Manage projects, teams, and day-to-day operations. Read-only access to settings.', true, false, 2),
(uuid_generate_v4(), NULL, 'Senior Designer', 'senior-designer', 'Senior designer who can manage projects, mentor juniors, and approve quotations.', true, false, 2),
(uuid_generate_v4(), NULL, 'Finance', 'finance', 'Finance department. Can view all projects/sales for context, but only manage financial records.', true, false, 2),
(uuid_generate_v4(), NULL, 'Staff', 'staff', 'Regular staff access. Can work on assigned projects and tasks.', true, true, 3),
(uuid_generate_v4(), NULL, 'Designer', 'designer', 'Designer who works on assigned projects, creates designs, and collaborates with the team.', true, false, 3),
(uuid_generate_v4(), NULL, 'Sales', 'sales', 'Sales representative who manages leads, clients, and creates initial proposals.', true, false, 3),
(uuid_generate_v4(), NULL, 'Sales Rep', 'sales-rep', 'Alias for Sales role', true, false, 3),
(uuid_generate_v4(), NULL, 'Procurement', 'procurement', 'Procurement specialist who manages vendors, purchase orders, and stock.', true, false, 3),
(uuid_generate_v4(), NULL, 'Limited', 'limited', 'Restricted access. View-only permissions or specific module access.', true, false, 4)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SECTION 3: PERMISSIONS
-- =====================================================

INSERT INTO permissions (key, module, description, is_system_permission) VALUES
-- Dashboard
('dashboard.view', 'dashboard', 'View dashboard and overview', true),

-- Sales (CRM)
('sales.view', 'sales', 'View leads, pipeline, and contacts', true),
('sales.create', 'sales', 'Create leads and contacts', true),
('sales.update', 'sales', 'Update leads and contacts', true),
('sales.delete', 'sales', 'Delete leads and contacts', true),
('sales.convert', 'sales', 'Convert lead to project', true),
('sales.assign', 'sales', 'Assign leads to team members', true),

-- Projects
('projects.view', 'projects', 'View projects list and details', true),
('projects.view_all', 'projects', 'View all projects (not just assigned)', true),
('projects.create', 'projects', 'Create new projects', true),
('projects.update', 'projects', 'Update project details', true),
('projects.delete', 'projects', 'Delete projects', true),
('projects.archive', 'projects', 'Archive projects', true),
('projects.assign', 'projects', 'Assign team members to projects', true),

-- Quotations
('quotations.view', 'quotations', 'View quotations', true),
('quotations.create', 'quotations', 'Create new quotations', true),
('quotations.update', 'quotations', 'Update quotations', true),
('quotations.delete', 'quotations', 'Delete quotations', true),
('quotations.approve', 'quotations', 'Approve/reject quotations', true),
('quotations.send', 'quotations', 'Send quotations to clients', true),

-- Stock & Inventory
('stock.view', 'stock', 'View inventory and stock levels', true),
('stock.create', 'stock', 'Add new inventory items', true),
('stock.update', 'stock', 'Update inventory details', true),
('stock.delete', 'stock', 'Delete inventory items', true),
('stock.adjust', 'stock', 'Adjust stock quantities', true),

-- Procurement
('procurement.view', 'stock', 'View purchase orders and requests', true),
('procurement.create', 'stock', 'Create purchase orders', true),
('procurement.update', 'stock', 'Update purchase orders', true),
('procurement.delete', 'stock', 'Delete purchase orders', true),
('procurement.approve', 'stock', 'Approve purchase orders', true),

-- Vendors
('vendors.view', 'stock', 'View vendors list', true),
('vendors.create', 'stock', 'Create new vendors', true),
('vendors.update', 'stock', 'Update vendor details', true),
('vendors.delete', 'stock', 'Delete vendors', true),

-- Finance
('finance.view', 'finance', 'View financial data, invoices, payments', true),
('finance.create', 'finance', 'Create invoices, payments, expenses', true),
('finance.update', 'finance', 'Update financial records', true),
('finance.delete', 'finance', 'Delete financial records', true),
('finance.approve', 'finance', 'Approve payments and expenses', true),
('finance.export', 'finance', 'Export financial data', true),

-- Tasks
('tasks.view', 'tasks', 'View tasks', true),
('tasks.view_all', 'tasks', 'View all tasks (not just assigned)', true),
('tasks.create', 'tasks', 'Create new tasks', true),
('tasks.update', 'tasks', 'Update tasks', true),
('tasks.delete', 'tasks', 'Delete tasks', true),
('tasks.assign', 'tasks', 'Assign tasks to team members', true),

-- Calendar
('calendar.view', 'calendar', 'View calendar and events', true),
('calendar.create', 'calendar', 'Create calendar events', true),
('calendar.update', 'calendar', 'Update calendar events', true),
('calendar.delete', 'calendar', 'Delete calendar events', true),

-- Documents
('documents.view', 'documents', 'View documents', true),
('documents.upload', 'documents', 'Upload documents', true),
('documents.update', 'documents', 'Update document details', true),
('documents.delete', 'documents', 'Delete documents', true),
('documents.share', 'documents', 'Share documents externally', true),

-- Library
('library.view', 'library', 'View resource library', true),
('library.upload', 'library', 'Upload to library', true),
('library.update', 'library', 'Update library items', true),
('library.delete', 'library', 'Delete library items', true),

-- Reports
('reports.view', 'reports', 'View reports', true),
('reports.create', 'reports', 'Create custom reports', true),
('reports.export', 'reports', 'Export reports', true),

-- Settings
('settings.profile', 'settings', 'Manage own profile', true),
('settings.company.view', 'settings', 'View company settings', true),
('settings.company.update', 'settings', 'Update company settings', true),
('settings.team.view', 'settings', 'View team members', true),
('settings.team.invite', 'settings', 'Invite new team members', true),
('settings.team.update', 'settings', 'Update team member details', true),
('settings.team.remove', 'settings', 'Remove team members', true),
('settings.billing', 'settings', 'Manage billing and subscription', true),

-- Ownership
('ownership.transfer', 'ownership', 'Transfer company ownership', true)
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- SECTION 4: ROLE PERMISSIONS ASSIGNMENTS
-- =====================================================

-- Owner: ALL permissions
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT (SELECT id FROM roles WHERE slug = 'owner' AND tenant_id IS NULL), p.id, true
FROM permissions p
ON CONFLICT DO NOTHING;

-- Admin: All except ownership
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT (SELECT id FROM roles WHERE slug = 'admin' AND tenant_id IS NULL), p.id, true
FROM permissions p WHERE p.key NOT IN ('ownership.transfer')
ON CONFLICT DO NOTHING;

-- Manager: Operational focus
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT (SELECT id FROM roles WHERE slug = 'manager' AND tenant_id IS NULL), p.id, true
FROM permissions p WHERE p.key IN (
    'dashboard.view',
    'sales.view', 'sales.create', 'sales.update', 'sales.convert', 'sales.assign',
    'projects.view', 'projects.view_all', 'projects.create', 'projects.update', 'projects.archive', 'projects.assign',
    'quotations.view', 'quotations.create', 'quotations.update', 'quotations.approve', 'quotations.send',
    'stock.view', 'stock.adjust', 'procurement.view', 'procurement.create', 'procurement.update', 'vendors.view',
    'finance.view',
    'tasks.view', 'tasks.view_all', 'tasks.create', 'tasks.update', 'tasks.delete', 'tasks.assign',
    'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete',
    'documents.view', 'documents.upload', 'documents.update', 'documents.share',
    'library.view', 'library.upload', 'reports.view', 'reports.export', 'settings.profile'
)
ON CONFLICT DO NOTHING;

-- Senior Designer
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT (SELECT id FROM roles WHERE slug = 'senior-designer' AND tenant_id IS NULL), p.id, true
FROM permissions p WHERE p.key IN (
    'dashboard.view', 'sales.view',
    'projects.view', 'projects.view_all', 'projects.create', 'projects.update', 'projects.archive', 'projects.assign',
    'quotations.view', 'quotations.create', 'quotations.update', 'quotations.approve', 'quotations.send',
    'stock.view', 'procurement.view', 'vendors.view', 'finance.view',
    'tasks.view', 'tasks.view_all', 'tasks.create', 'tasks.update', 'tasks.delete', 'tasks.assign',
    'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete',
    'documents.view', 'documents.upload', 'documents.update', 'documents.delete', 'documents.share',
    'library.view', 'library.upload', 'library.update', 'library.delete',
    'reports.view', 'reports.export', 'settings.profile'
)
ON CONFLICT DO NOTHING;

-- Finance
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT (SELECT id FROM roles WHERE slug = 'finance' AND tenant_id IS NULL), p.id, true
FROM permissions p WHERE p.key IN (
    'dashboard.view', 'sales.view', 'projects.view', 'projects.view_all', 'quotations.view',
    'stock.view', 'procurement.view', 'vendors.view',
    'finance.view', 'finance.create', 'finance.update', 'finance.delete', 'finance.approve', 'finance.export',
    'tasks.view', 'tasks.create', 'tasks.update',
    'calendar.view', 'calendar.create', 'calendar.update',
    'documents.view', 'reports.view', 'reports.export',
    'settings.profile', 'settings.billing'
)
ON CONFLICT DO NOTHING;

-- Staff
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT (SELECT id FROM roles WHERE slug = 'staff' AND tenant_id IS NULL), p.id, true
FROM permissions p WHERE p.key IN (
    'dashboard.view',
    'sales.view', 'sales.create', 'sales.update',
    'projects.view', 'projects.update',
    'quotations.view', 'quotations.create', 'quotations.update',
    'stock.view', 'procurement.view', 'vendors.view', 'finance.view',
    'tasks.view', 'tasks.create', 'tasks.update',
    'calendar.view', 'calendar.create', 'calendar.update',
    'documents.view', 'documents.upload', 'library.view', 'reports.view',
    'settings.profile'
)
ON CONFLICT DO NOTHING;

-- Designer
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT (SELECT id FROM roles WHERE slug = 'designer' AND tenant_id IS NULL), p.id, true
FROM permissions p WHERE p.key IN (
    'dashboard.view', 'projects.view', 'projects.update',
    'quotations.view', 'quotations.create', 'quotations.update',
    'stock.view', 'vendors.view',
    'tasks.view', 'tasks.create', 'tasks.update',
    'calendar.view', 'calendar.create', 'calendar.update',
    'documents.view', 'documents.upload', 'documents.update',
    'library.view', 'library.upload', 'reports.view',
    'settings.profile'
)
ON CONFLICT DO NOTHING;

-- Sales
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT (SELECT id FROM roles WHERE slug = 'sales' AND tenant_id IS NULL), p.id, true
FROM permissions p WHERE p.key IN (
    'dashboard.view',
    'sales.view', 'sales.create', 'sales.update', 'sales.delete', 'sales.convert', 'sales.assign',
    'projects.view', 'quotations.view', 'quotations.create', 'quotations.update', 'quotations.send',
    'finance.view', 'tasks.view', 'tasks.create', 'tasks.update',
    'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete',
    'documents.view', 'documents.upload', 'reports.view', 'settings.profile'
)
ON CONFLICT DO NOTHING;

-- Sales Rep (alias)
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT (SELECT id FROM roles WHERE slug = 'sales-rep' AND tenant_id IS NULL), p.id, true
FROM permissions p WHERE p.key IN (
    'dashboard.view',
    'sales.view', 'sales.create', 'sales.update', 'sales.delete', 'sales.convert', 'sales.assign',
    'projects.view', 'quotations.view', 'quotations.create', 'quotations.update', 'quotations.send',
    'finance.view', 'tasks.view', 'tasks.create', 'tasks.update',
    'calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete',
    'documents.view', 'documents.upload', 'reports.view', 'settings.profile'
)
ON CONFLICT DO NOTHING;

-- Procurement
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT (SELECT id FROM roles WHERE slug = 'procurement' AND tenant_id IS NULL), p.id, true
FROM permissions p WHERE p.key IN (
    'dashboard.view', 'projects.view',
    'stock.view', 'stock.create', 'stock.update', 'stock.delete', 'stock.adjust',
    'procurement.view', 'procurement.create', 'procurement.update', 'procurement.delete',
    'vendors.view', 'vendors.create', 'vendors.update', 'vendors.delete',
    'finance.view', 'tasks.view', 'tasks.create', 'tasks.update',
    'calendar.view', 'calendar.create', 'calendar.update',
    'documents.view', 'documents.upload', 'library.view', 'reports.view',
    'settings.profile'
)
ON CONFLICT DO NOTHING;

-- Limited
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT (SELECT id FROM roles WHERE slug = 'limited' AND tenant_id IS NULL), p.id, true
FROM permissions p WHERE p.key IN (
    'dashboard.view', 'projects.view', 'tasks.view', 'calendar.view',
    'documents.view', 'library.view', 'settings.profile'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SECTION 5: SUBSCRIPTION PLANS
-- =====================================================

INSERT INTO subscription_plans (id, name, slug, tenant_type, description, price_monthly, price_yearly, max_users, max_projects, max_storage_gb, is_active, is_featured, display_order) VALUES
(uuid_generate_v4(), 'Classic', 'classic', 'interiors', 'Perfect for solo designers & small studios', 10000, 120000, 5, 50, 25, true, false, 1),
(uuid_generate_v4(), 'Signature', 'signature', 'interiors', 'For studios that need advanced workflow and team features', 20000, 240000, 15, 200, 100, true, true, 2),
(uuid_generate_v4(), 'Masterpiece', 'masterpiece', 'interiors', 'For large studios needing enterprise-level features', 50000, 600000, -1, -1, 500, true, false, 3)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SECTION 6: SUBSCRIPTION PLAN FEATURES
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

    IF classic_plan_id IS NOT NULL THEN
        INSERT INTO subscription_plan_features (plan_id, feature_key, feature_name, included, limit_value) VALUES
        (classic_plan_id, 'projects', 'Project Management', true, 50),
        (classic_plan_id, 'clients', 'Client Portal', true, NULL),
        (classic_plan_id, 'storage', 'Document Storage', true, 25),
        (classic_plan_id, 'reports', 'Basic Reporting', true, NULL),
        (classic_plan_id, 'support', 'Email Support', true, NULL)
        ON CONFLICT DO NOTHING;
    END IF;

    IF signature_plan_id IS NOT NULL THEN
        INSERT INTO subscription_plan_features (plan_id, feature_key, feature_name, included, limit_value) VALUES
        (signature_plan_id, 'projects', 'Project Management', true, 200),
        (signature_plan_id, 'clients', 'Client Portal', true, NULL),
        (signature_plan_id, 'storage', 'Document Storage', true, 100),
        (signature_plan_id, 'team', 'Advanced Team Management', true, NULL),
        (signature_plan_id, 'financial', 'Financial Reporting', true, NULL),
        (signature_plan_id, 'vendor', 'Vendor Management', true, NULL),
        (signature_plan_id, 'dashboards', 'Custom Dashboards', true, NULL),
        (signature_plan_id, 'support', 'Priority Support', true, NULL)
        ON CONFLICT DO NOTHING;
    END IF;

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
        (masterpiece_plan_id, 'support', 'Dedicated Account Manager', true, NULL)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- =====================================================
-- SECTION 7: QUOTATION MASTER DATA SEEDING FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION seed_quotation_master_data(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_space_master_bedroom UUID;
    v_space_bedroom UUID;
    v_space_living_room UUID;
    v_space_kitchen UUID;
    v_space_dining UUID;
    v_space_bathroom UUID;
    v_space_foyer UUID;
    v_space_balcony UUID;
    v_space_pooja UUID;
    v_space_study UUID;
    
    v_comp_wardrobe UUID;
    v_comp_tv_unit UUID;
    v_comp_false_ceiling UUID;
    v_comp_modular_kitchen UUID;
    v_comp_vanity UUID;
    v_comp_shoe_rack UUID;
    v_comp_crockery UUID;
    v_comp_study_table UUID;
    v_comp_bed UUID;
    v_comp_console UUID;
BEGIN
    -- Delete existing system data
    DELETE FROM component_variants WHERE tenant_id = p_tenant_id AND is_system = true;
    DELETE FROM cost_attribute_types WHERE tenant_id = p_tenant_id;
    DELETE FROM component_types WHERE tenant_id = p_tenant_id AND is_system = true;
    DELETE FROM space_types WHERE tenant_id = p_tenant_id AND is_system = true;
    
    -- SPACE TYPES
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Master Bedroom', 'master-bedroom', 'Primary bedroom with attached bathroom', 'bed-double', 1, true, true),
        (gen_random_uuid(), p_tenant_id, 'Bedroom', 'bedroom', 'Secondary bedroom', 'bed', 2, true, true),
        (gen_random_uuid(), p_tenant_id, 'Living Room', 'living-room', 'Main living area', 'sofa', 3, true, true),
        (gen_random_uuid(), p_tenant_id, 'Kitchen', 'kitchen', 'Cooking and food preparation area', 'utensils', 4, true, true),
        (gen_random_uuid(), p_tenant_id, 'Dining', 'dining', 'Dining area', 'utensils-crossed', 5, true, true),
        (gen_random_uuid(), p_tenant_id, 'Bathroom', 'bathroom', 'Bathroom/Toilet area', 'bath', 6, true, true),
        (gen_random_uuid(), p_tenant_id, 'Foyer', 'foyer', 'Entrance/Foyer area', 'door-open', 7, true, true),
        (gen_random_uuid(), p_tenant_id, 'Balcony', 'balcony', 'Balcony or terrace area', 'sun', 8, true, true),
        (gen_random_uuid(), p_tenant_id, 'Pooja Room', 'pooja-room', 'Prayer/Worship room', 'flame', 9, true, true),
        (gen_random_uuid(), p_tenant_id, 'Study', 'study', 'Study or home office', 'book-open', 10, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    
    -- Get space type IDs
    SELECT id INTO v_space_master_bedroom FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'master-bedroom';
    SELECT id INTO v_space_bedroom FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'bedroom';
    SELECT id INTO v_space_living_room FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'living-room';
    SELECT id INTO v_space_kitchen FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'kitchen';
    
    -- COMPONENT TYPES
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Wardrobe', 'wardrobe', 'Storage wardrobe with shutters', 'rectangle-vertical', 8, 8, 2, 1, true, true),
        (gen_random_uuid(), p_tenant_id, 'TV Unit', 'tv-unit', 'Entertainment unit for TV and accessories', 'tv', 8, 8, 1.5, 2, true, true),
        (gen_random_uuid(), p_tenant_id, 'False Ceiling', 'false-ceiling', 'Decorative ceiling work', 'layers', NULL, NULL, NULL, 3, true, true),
        (gen_random_uuid(), p_tenant_id, 'Modular Kitchen', 'modular-kitchen', 'Complete modular kitchen setup', 'utensils', NULL, NULL, 2, 4, true, true),
        (gen_random_uuid(), p_tenant_id, 'Vanity', 'vanity', 'Bathroom vanity with mirror and storage', 'square', 4, 3, 1.5, 5, true, true),
        (gen_random_uuid(), p_tenant_id, 'Shoe Rack', 'shoe-rack', 'Footwear storage unit', 'footprints', 4, 6, 1, 6, true, true),
        (gen_random_uuid(), p_tenant_id, 'Crockery Unit', 'crockery-unit', 'Display and storage for crockery', 'wine', 6, 8, 1.5, 7, true, true),
        (gen_random_uuid(), p_tenant_id, 'Study Table', 'study-table', 'Desk for study or work', 'laptop', 5, 3, 2, 8, true, true),
        (gen_random_uuid(), p_tenant_id, 'Bed', 'bed', 'Bed with headboard and storage', 'bed', 6, 4, 7, 9, true, true),
        (gen_random_uuid(), p_tenant_id, 'Console', 'console', 'Decorative console table', 'gallery-horizontal-end', 4, 3, 1, 10, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    
    -- Get component type IDs
    SELECT id INTO v_comp_wardrobe FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'wardrobe';
    SELECT id INTO v_comp_tv_unit FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'tv-unit';
    SELECT id INTO v_comp_false_ceiling FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'false-ceiling';
    SELECT id INTO v_comp_modular_kitchen FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'modular-kitchen';
    SELECT id INTO v_comp_vanity FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'vanity';
    SELECT id INTO v_comp_shoe_rack FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'shoe-rack';
    SELECT id INTO v_comp_crockery FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'crockery-unit';
    SELECT id INTO v_comp_study_table FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'study-table';
    SELECT id INTO v_comp_bed FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'bed';
    SELECT id INTO v_comp_console FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'console';
    
    -- COST ATTRIBUTE TYPES
    INSERT INTO cost_attribute_types (tenant_id, name, slug, description, data_type, unit, display_order, is_active)
    VALUES 
        (p_tenant_id, 'Area', 'area', 'Area measurement (L x W)', 'area', 'sqft', 1, true),
        (p_tenant_id, 'Quantity', 'quantity', 'Number of units', 'count', 'nos', 2, true),
        (p_tenant_id, 'Labour', 'labour', 'Labour cost', 'number', 'nos', 3, true),
        (p_tenant_id, 'Hardware', 'hardware', 'Hardware items count', 'count', 'nos', 4, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    
    -- COMPONENT VARIANTS
    
    -- Wardrobe Variants
    INSERT INTO component_variants (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_wardrobe, 'Ceiling Sliding', 'ceiling-sliding', 'Floor to ceiling wardrobe with sliding shutters', '{"attributes":["carcass_area","shutter_area","sliding_mechanism","labour"]}'::jsonb, 1, true, true),
        (p_tenant_id, v_comp_wardrobe, 'Openable', 'openable', 'Wardrobe with hinged openable shutters', '{"attributes":["carcass_area","shutter_area","hinges","labour"]}'::jsonb, 2, true, true),
        (p_tenant_id, v_comp_wardrobe, 'Openable With Loft', 'openable-with-loft', 'Wardrobe with openable shutters and top loft storage', '{"attributes":["carcass_area","shutter_area","loft_area","hinges","labour"]}'::jsonb, 3, true, true),
        (p_tenant_id, v_comp_wardrobe, 'Sliding With Loft', 'sliding-with-loft', 'Sliding wardrobe with top loft storage', '{"attributes":["carcass_area","shutter_area","loft_area","sliding_mechanism","labour"]}'::jsonb, 4, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    -- Kitchen Variants
    INSERT INTO component_variants (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_modular_kitchen, 'L-Shape', 'l-shape', 'L-shaped modular kitchen layout', '{"attributes":["base_cabinets","wall_cabinets","countertop","tall_unit","hardware","labour"]}'::jsonb, 1, true, true),
        (p_tenant_id, v_comp_modular_kitchen, 'U-Shape', 'u-shape', 'U-shaped modular kitchen layout', '{"attributes":["base_cabinets","wall_cabinets","countertop","tall_unit","hardware","labour"]}'::jsonb, 2, true, true),
        (p_tenant_id, v_comp_modular_kitchen, 'Parallel', 'parallel', 'Parallel/Galley modular kitchen layout', '{"attributes":["base_cabinets","wall_cabinets","countertop","hardware","labour"]}'::jsonb, 3, true, true),
        (p_tenant_id, v_comp_modular_kitchen, 'Straight', 'straight', 'Single wall straight kitchen layout', '{"attributes":["base_cabinets","wall_cabinets","countertop","hardware","labour"]}'::jsonb, 4, true, true),
        (p_tenant_id, v_comp_modular_kitchen, 'Island', 'island', 'Kitchen with central island', '{"attributes":["base_cabinets","wall_cabinets","island","countertop","tall_unit","hardware","labour"]}'::jsonb, 5, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    -- False Ceiling Variants
    INSERT INTO component_variants (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_false_ceiling, 'Plain', 'plain', 'Simple plain false ceiling', '{"attributes":["ceiling_area","labour"]}'::jsonb, 1, true, true),
        (p_tenant_id, v_comp_false_ceiling, 'Peripheral Cove', 'peripheral-cove', 'False ceiling with peripheral cove lighting', '{"attributes":["ceiling_area","cove_rft","labour"]}'::jsonb, 2, true, true),
        (p_tenant_id, v_comp_false_ceiling, 'Designer', 'designer', 'Custom designer false ceiling', '{"attributes":["ceiling_area","cove_rft","profile_rft","labour"]}'::jsonb, 3, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    -- TV Unit Variants
    INSERT INTO component_variants (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_tv_unit, 'Wall Mounted', 'wall-mounted', 'Wall mounted TV unit', '{"attributes":["carcass_area","shutter_area","hinges","labour"]}'::jsonb, 1, true, true),
        (p_tenant_id, v_comp_tv_unit, 'Floor Standing', 'floor-standing', 'Floor standing TV unit with storage', '{"attributes":["carcass_area","shutter_area","drawers","hinges","labour"]}'::jsonb, 2, true, true),
        (p_tenant_id, v_comp_tv_unit, 'Full Wall', 'full-wall', 'Full wall entertainment unit', '{"attributes":["carcass_area","shutter_area","back_panel_area","drawers","hinges","labour"]}'::jsonb, 3, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    -- Vanity Variants
    INSERT INTO component_variants (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_vanity, 'Wall Hung', 'wall-hung', 'Wall hung vanity unit', '{"attributes":["carcass_area","shutter_area","countertop","mirror","hardware","labour"]}'::jsonb, 1, true, true),
        (p_tenant_id, v_comp_vanity, 'Floor Standing', 'floor-standing', 'Floor standing vanity unit', '{"attributes":["carcass_area","shutter_area","countertop","mirror","hardware","labour"]}'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    -- Bed Variants
    INSERT INTO component_variants (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_bed, 'Platform Bed', 'platform', 'Platform bed with headboard', '{"attributes":["platform_area","headboard_area","labour"]}'::jsonb, 1, true, true),
        (p_tenant_id, v_comp_bed, 'Storage Bed', 'storage', 'Bed with under-storage', '{"attributes":["platform_area","headboard_area","storage_carcass","hydraulic","labour"]}'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    RAISE NOTICE 'Seed data created successfully for tenant %', p_tenant_id;
END;
$$;

COMMENT ON FUNCTION seed_quotation_master_data(UUID) IS 
    'Seeds quotation module master data (space types, component types, variants) for a tenant.';

-- =====================================================
-- SEED DATA COMPLETE
-- =====================================================
-- 
-- Summary:
-- - System Configuration for trials and billing
-- - 11 System Roles with hierarchies
-- - 70+ Permissions across 13 modules
-- - 3 Subscription Plans: Classic, Signature, Masterpiece
-- - Plan features for each plan
-- - Quotation master data seeding function
-- =====================================================
