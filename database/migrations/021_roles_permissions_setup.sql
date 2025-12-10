-- =====================================================
-- ROLES AND PERMISSIONS SETUP
-- =====================================================
-- This migration sets up a comprehensive role-based access control (RBAC) system
-- for the interior design ERP platform.
--
-- HIERARCHY LEVELS (lower = more privileged):
-- 0 = Owner (full access)
-- 1 = Admin (almost full access, can manage users)
-- 2 = Department Managers (manage their department + team)
-- 3 = Senior Staff (full department access)
-- 4 = Regular Staff (limited department access)
-- 5 = Limited (view only / restricted access)
-- =====================================================

-- =====================================================
-- SAFE MODE: This migration is NON-DESTRUCTIVE
-- It only ADDS new roles/permissions without deleting existing ones
-- Existing user role assignments are preserved
-- =====================================================

-- UNCOMMENT BELOW ONLY IF YOU WANT A CLEAN SLATE (will remove existing permissions!)
-- DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system_role = true);
-- DELETE FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE is_system_role = true AND slug NOT IN ('owner', 'admin'));
-- DELETE FROM roles WHERE is_system_role = true AND slug NOT IN ('owner', 'admin');
-- DELETE FROM permissions WHERE is_system_permission = true;

-- =====================================================
-- PERMISSIONS
-- =====================================================
-- Naming convention: module.action (e.g., leads.view, leads.create)
-- Actions: view, create, edit, delete, manage, export, assign, approve
-- =====================================================

-- Insert permissions only if they don't exist (using ON CONFLICT)
INSERT INTO permissions (id, key, module, description, is_system_permission) VALUES
-- DASHBOARD
(gen_random_uuid(), 'dashboard.view', 'dashboard', 'View dashboard', true),
(gen_random_uuid(), 'dashboard.analytics', 'dashboard', 'View analytics and reports on dashboard', true),

-- LEADS / SALES
(gen_random_uuid(), 'leads.view', 'leads', 'View leads', true),
(gen_random_uuid(), 'leads.view_own', 'leads', 'View only own assigned leads', true),
(gen_random_uuid(), 'leads.view_team', 'leads', 'View team leads', true),
(gen_random_uuid(), 'leads.create', 'leads', 'Create new leads', true),
(gen_random_uuid(), 'leads.edit', 'leads', 'Edit leads', true),
(gen_random_uuid(), 'leads.edit_own', 'leads', 'Edit only own assigned leads', true),
(gen_random_uuid(), 'leads.delete', 'leads', 'Delete leads', true),
(gen_random_uuid(), 'leads.assign', 'leads', 'Assign leads to team members', true),
(gen_random_uuid(), 'leads.reassign', 'leads', 'Reassign leads between team members', true),
(gen_random_uuid(), 'leads.export', 'leads', 'Export leads data', true),
(gen_random_uuid(), 'leads.import', 'leads', 'Import leads data', true),
(gen_random_uuid(), 'leads.stage_change', 'leads', 'Change lead stages', true),
(gen_random_uuid(), 'leads.convert', 'leads', 'Convert leads to projects', true),
(gen_random_uuid(), 'leads.activities.view', 'leads', 'View lead activities', true),
(gen_random_uuid(), 'leads.activities.create', 'leads', 'Create lead activities', true),
(gen_random_uuid(), 'leads.notes.view', 'leads', 'View lead notes', true),
(gen_random_uuid(), 'leads.notes.create', 'leads', 'Create lead notes', true),
(gen_random_uuid(), 'leads.reports', 'leads', 'View sales reports', true),

-- CLIENTS
(gen_random_uuid(), 'clients.view', 'clients', 'View clients', true),
(gen_random_uuid(), 'clients.create', 'clients', 'Create new clients', true),
(gen_random_uuid(), 'clients.edit', 'clients', 'Edit clients', true),
(gen_random_uuid(), 'clients.delete', 'clients', 'Delete clients', true),
(gen_random_uuid(), 'clients.export', 'clients', 'Export clients data', true),

-- PROJECTS
(gen_random_uuid(), 'projects.view', 'projects', 'View all projects', true),
(gen_random_uuid(), 'projects.view_own', 'projects', 'View only assigned projects', true),
(gen_random_uuid(), 'projects.view_team', 'projects', 'View team projects', true),
(gen_random_uuid(), 'projects.create', 'projects', 'Create new projects', true),
(gen_random_uuid(), 'projects.edit', 'projects', 'Edit projects', true),
(gen_random_uuid(), 'projects.edit_own', 'projects', 'Edit only assigned projects', true),
(gen_random_uuid(), 'projects.delete', 'projects', 'Delete projects', true),
(gen_random_uuid(), 'projects.assign', 'projects', 'Assign team members to projects', true),
(gen_random_uuid(), 'projects.status_change', 'projects', 'Change project status', true),
(gen_random_uuid(), 'projects.milestones.manage', 'projects', 'Manage project milestones', true),
(gen_random_uuid(), 'projects.timeline.view', 'projects', 'View project timeline', true),
(gen_random_uuid(), 'projects.timeline.edit', 'projects', 'Edit project timeline', true),
(gen_random_uuid(), 'projects.export', 'projects', 'Export projects data', true),
(gen_random_uuid(), 'projects.reports', 'projects', 'View project reports', true),

-- QUOTATIONS
(gen_random_uuid(), 'quotations.view', 'quotations', 'View all quotations', true),
(gen_random_uuid(), 'quotations.view_own', 'quotations', 'View only own quotations', true),
(gen_random_uuid(), 'quotations.create', 'quotations', 'Create new quotations', true),
(gen_random_uuid(), 'quotations.edit', 'quotations', 'Edit quotations', true),
(gen_random_uuid(), 'quotations.edit_own', 'quotations', 'Edit only own quotations', true),
(gen_random_uuid(), 'quotations.delete', 'quotations', 'Delete quotations', true),
(gen_random_uuid(), 'quotations.approve', 'quotations', 'Approve quotations', true),
(gen_random_uuid(), 'quotations.send', 'quotations', 'Send quotations to clients', true),
(gen_random_uuid(), 'quotations.revise', 'quotations', 'Create quotation revisions', true),
(gen_random_uuid(), 'quotations.discount', 'quotations', 'Apply discounts to quotations', true),
(gen_random_uuid(), 'quotations.discount_unlimited', 'quotations', 'Apply unlimited discounts', true),
(gen_random_uuid(), 'quotations.export', 'quotations', 'Export quotations', true),
(gen_random_uuid(), 'quotations.templates.view', 'quotations', 'View quotation templates', true),
(gen_random_uuid(), 'quotations.templates.manage', 'quotations', 'Manage quotation templates', true),

-- DESIGN
(gen_random_uuid(), 'design.view', 'design', 'View design files and documents', true),
(gen_random_uuid(), 'design.view_own', 'design', 'View only own design files', true),
(gen_random_uuid(), 'design.create', 'design', 'Create/upload design files', true),
(gen_random_uuid(), 'design.edit', 'design', 'Edit design files', true),
(gen_random_uuid(), 'design.delete', 'design', 'Delete design files', true),
(gen_random_uuid(), 'design.approve', 'design', 'Approve design files', true),
(gen_random_uuid(), 'design.assign', 'design', 'Assign design tasks', true),
(gen_random_uuid(), 'design.library.view', 'design', 'View design library', true),
(gen_random_uuid(), 'design.library.manage', 'design', 'Manage design library', true),

-- INVENTORY / STOCK
(gen_random_uuid(), 'inventory.view', 'inventory', 'View inventory', true),
(gen_random_uuid(), 'inventory.create', 'inventory', 'Add inventory items', true),
(gen_random_uuid(), 'inventory.edit', 'inventory', 'Edit inventory items', true),
(gen_random_uuid(), 'inventory.delete', 'inventory', 'Delete inventory items', true),
(gen_random_uuid(), 'inventory.adjust', 'inventory', 'Adjust inventory quantities', true),
(gen_random_uuid(), 'inventory.transfer', 'inventory', 'Transfer inventory between locations', true),
(gen_random_uuid(), 'inventory.export', 'inventory', 'Export inventory data', true),
(gen_random_uuid(), 'inventory.reports', 'inventory', 'View inventory reports', true),
(gen_random_uuid(), 'inventory.locations.manage', 'inventory', 'Manage inventory locations', true),
(gen_random_uuid(), 'inventory.low_stock.view', 'inventory', 'View low stock alerts', true),

-- PROCUREMENT / PURCHASE ORDERS
(gen_random_uuid(), 'procurement.view', 'procurement', 'View purchase orders', true),
(gen_random_uuid(), 'procurement.create', 'procurement', 'Create purchase orders', true),
(gen_random_uuid(), 'procurement.edit', 'procurement', 'Edit purchase orders', true),
(gen_random_uuid(), 'procurement.delete', 'procurement', 'Delete purchase orders', true),
(gen_random_uuid(), 'procurement.approve', 'procurement', 'Approve purchase orders', true),
(gen_random_uuid(), 'procurement.approve_high_value', 'procurement', 'Approve high-value purchase orders', true),
(gen_random_uuid(), 'procurement.receive', 'procurement', 'Receive goods against PO', true),
(gen_random_uuid(), 'procurement.vendors.view', 'procurement', 'View vendors', true),
(gen_random_uuid(), 'procurement.vendors.manage', 'procurement', 'Manage vendors', true),
(gen_random_uuid(), 'procurement.reports', 'procurement', 'View procurement reports', true),

-- FINANCE
(gen_random_uuid(), 'finance.view', 'finance', 'View finance dashboard', true),
(gen_random_uuid(), 'finance.invoices.view', 'finance', 'View invoices', true),
(gen_random_uuid(), 'finance.invoices.create', 'finance', 'Create invoices', true),
(gen_random_uuid(), 'finance.invoices.edit', 'finance', 'Edit invoices', true),
(gen_random_uuid(), 'finance.invoices.delete', 'finance', 'Delete invoices', true),
(gen_random_uuid(), 'finance.invoices.send', 'finance', 'Send invoices to clients', true),
(gen_random_uuid(), 'finance.payments.view', 'finance', 'View payments', true),
(gen_random_uuid(), 'finance.payments.record', 'finance', 'Record payments', true),
(gen_random_uuid(), 'finance.payments.approve', 'finance', 'Approve payment requests', true),
(gen_random_uuid(), 'finance.expenses.view', 'finance', 'View expenses', true),
(gen_random_uuid(), 'finance.expenses.create', 'finance', 'Create expense entries', true),
(gen_random_uuid(), 'finance.expenses.approve', 'finance', 'Approve expenses', true),
(gen_random_uuid(), 'finance.reports', 'finance', 'View financial reports', true),
(gen_random_uuid(), 'finance.reports.detailed', 'finance', 'View detailed financial reports', true),
(gen_random_uuid(), 'finance.export', 'finance', 'Export financial data', true),

-- SITE SUPERVISION
(gen_random_uuid(), 'site.view', 'site', 'View site information', true),
(gen_random_uuid(), 'site.checkin', 'site', 'Check in at site', true),
(gen_random_uuid(), 'site.updates.create', 'site', 'Create site updates', true),
(gen_random_uuid(), 'site.updates.view', 'site', 'View site updates', true),
(gen_random_uuid(), 'site.issues.create', 'site', 'Report site issues', true),
(gen_random_uuid(), 'site.issues.resolve', 'site', 'Resolve site issues', true),
(gen_random_uuid(), 'site.photos.upload', 'site', 'Upload site photos', true),
(gen_random_uuid(), 'site.assign', 'site', 'Assign site supervisors', true),
(gen_random_uuid(), 'site.reports', 'site', 'View site reports', true),
(gen_random_uuid(), 'site.schedule.view', 'site', 'View site schedules', true),
(gen_random_uuid(), 'site.schedule.manage', 'site', 'Manage site schedules', true),

-- TASKS
(gen_random_uuid(), 'tasks.view', 'tasks', 'View all tasks', true),
(gen_random_uuid(), 'tasks.view_own', 'tasks', 'View only own tasks', true),
(gen_random_uuid(), 'tasks.view_team', 'tasks', 'View team tasks', true),
(gen_random_uuid(), 'tasks.create', 'tasks', 'Create tasks', true),
(gen_random_uuid(), 'tasks.edit', 'tasks', 'Edit tasks', true),
(gen_random_uuid(), 'tasks.edit_own', 'tasks', 'Edit only own tasks', true),
(gen_random_uuid(), 'tasks.delete', 'tasks', 'Delete tasks', true),
(gen_random_uuid(), 'tasks.assign', 'tasks', 'Assign tasks to team members', true),
(gen_random_uuid(), 'tasks.complete', 'tasks', 'Mark tasks as complete', true),

-- CALENDAR
(gen_random_uuid(), 'calendar.view', 'calendar', 'View calendar', true),
(gen_random_uuid(), 'calendar.view_team', 'calendar', 'View team calendar', true),
(gen_random_uuid(), 'calendar.events.create', 'calendar', 'Create calendar events', true),
(gen_random_uuid(), 'calendar.events.edit', 'calendar', 'Edit calendar events', true),
(gen_random_uuid(), 'calendar.events.delete', 'calendar', 'Delete calendar events', true),

-- DOCUMENTS
(gen_random_uuid(), 'documents.view', 'documents', 'View documents', true),
(gen_random_uuid(), 'documents.upload', 'documents', 'Upload documents', true),
(gen_random_uuid(), 'documents.edit', 'documents', 'Edit document metadata', true),
(gen_random_uuid(), 'documents.delete', 'documents', 'Delete documents', true),
(gen_random_uuid(), 'documents.download', 'documents', 'Download documents', true),
(gen_random_uuid(), 'documents.share', 'documents', 'Share documents', true),

-- REPORTS
(gen_random_uuid(), 'reports.view', 'reports', 'View reports', true),
(gen_random_uuid(), 'reports.sales', 'reports', 'View sales reports', true),
(gen_random_uuid(), 'reports.projects', 'reports', 'View project reports', true),
(gen_random_uuid(), 'reports.finance', 'reports', 'View finance reports', true),
(gen_random_uuid(), 'reports.inventory', 'reports', 'View inventory reports', true),
(gen_random_uuid(), 'reports.team', 'reports', 'View team performance reports', true),
(gen_random_uuid(), 'reports.custom', 'reports', 'Create custom reports', true),
(gen_random_uuid(), 'reports.export', 'reports', 'Export reports', true),

-- TEAM MANAGEMENT
(gen_random_uuid(), 'team.view', 'team', 'View team members', true),
(gen_random_uuid(), 'team.view_limited', 'team', 'View limited team info', true),
(gen_random_uuid(), 'team.invite', 'team', 'Invite team members', true),
(gen_random_uuid(), 'team.edit', 'team', 'Edit team member details', true),
(gen_random_uuid(), 'team.deactivate', 'team', 'Deactivate team members', true),
(gen_random_uuid(), 'team.roles.assign', 'team', 'Assign roles to team members', true),
(gen_random_uuid(), 'team.permissions.view', 'team', 'View permissions', true),
(gen_random_uuid(), 'team.permissions.manage', 'team', 'Manage custom permissions', true),

-- SETTINGS
(gen_random_uuid(), 'settings.view', 'settings', 'View settings', true),
(gen_random_uuid(), 'settings.company.edit', 'settings', 'Edit company settings', true),
(gen_random_uuid(), 'settings.billing.view', 'settings', 'View billing information', true),
(gen_random_uuid(), 'settings.billing.manage', 'settings', 'Manage billing and subscription', true),
(gen_random_uuid(), 'settings.integrations.view', 'settings', 'View integrations', true),
(gen_random_uuid(), 'settings.integrations.manage', 'settings', 'Manage integrations', true),
(gen_random_uuid(), 'settings.notifications.manage', 'settings', 'Manage notification settings', true),
(gen_random_uuid(), 'settings.templates.manage', 'settings', 'Manage email/document templates', true),
(gen_random_uuid(), 'settings.audit_log.view', 'settings', 'View audit logs', true),

-- LIBRARY (Components, Materials, etc.)
(gen_random_uuid(), 'library.view', 'library', 'View library items', true),
(gen_random_uuid(), 'library.create', 'library', 'Create library items', true),
(gen_random_uuid(), 'library.edit', 'library', 'Edit library items', true),
(gen_random_uuid(), 'library.delete', 'library', 'Delete library items', true),
(gen_random_uuid(), 'library.pricing.view', 'library', 'View pricing in library', true),
(gen_random_uuid(), 'library.pricing.edit', 'library', 'Edit pricing in library', true)
ON CONFLICT (key) DO UPDATE SET 
  description = EXCLUDED.description,
  module = EXCLUDED.module;

-- =====================================================
-- ROLES
-- =====================================================

-- Keep existing Owner and Admin roles, update them
UPDATE roles SET 
    description = 'Full system access. Can manage all aspects of the organization.',
    hierarchy_level = 0
WHERE slug = 'owner' AND is_system_role = true;

UPDATE roles SET 
    description = 'Administrative access. Can manage users, settings, and most operations.',
    hierarchy_level = 1
WHERE slug = 'admin' AND is_system_role = true;

-- Insert new roles (only if they don't exist)
INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
SELECT gen_random_uuid(), NULL, 'Sales Manager', 'sales_manager', 
    'Manages the sales team. Full access to leads, quotations, and sales reports.', 
    true, false, 2
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'sales_manager' AND is_system_role = true);

INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
SELECT gen_random_uuid(), NULL, 'Sales', 'sales', 
    'Sales team member. Can manage assigned leads and create quotations.', 
    true, false, 4
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'sales' AND is_system_role = true);

INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
SELECT gen_random_uuid(), NULL, 'Design Manager', 'design_manager', 
    'Manages the design team. Full access to design files, projects, and team assignments.', 
    true, false, 2
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'design_manager' AND is_system_role = true);

INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
SELECT gen_random_uuid(), NULL, 'Design', 'design', 
    'Design team member. Can create and manage design files for assigned projects.', 
    true, false, 4
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'design' AND is_system_role = true);

INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
SELECT gen_random_uuid(), NULL, 'Stock Manager', 'stock_manager', 
    'Manages inventory and stock. Full access to inventory, adjustments, and transfers.', 
    true, false, 2
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'stock_manager' AND is_system_role = true);

INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
SELECT gen_random_uuid(), NULL, 'Stock', 'stock', 
    'Stock team member. Can view inventory and perform basic stock operations.', 
    true, false, 4
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'stock' AND is_system_role = true);

INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
SELECT gen_random_uuid(), NULL, 'Procurement Manager', 'procurement_manager', 
    'Manages procurement. Full access to purchase orders, vendors, and approvals.', 
    true, false, 2
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'procurement_manager' AND is_system_role = true);

INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
SELECT gen_random_uuid(), NULL, 'Procurement', 'procurement', 
    'Procurement team member. Can create purchase orders and manage vendors.', 
    true, false, 4
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'procurement' AND is_system_role = true);

INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
SELECT gen_random_uuid(), NULL, 'Finance Manager', 'finance_manager', 
    'Manages finance. Full access to invoices, payments, expenses, and financial reports.', 
    true, false, 2
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'finance_manager' AND is_system_role = true);

INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
SELECT gen_random_uuid(), NULL, 'Finance', 'finance', 
    'Finance team member. Can manage invoices and record payments.', 
    true, false, 4
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'finance' AND is_system_role = true);

INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
SELECT gen_random_uuid(), NULL, 'Project Manager', 'project_manager', 
    'Manages projects. Full access to project details, timelines, and team assignments.', 
    true, false, 2
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'project_manager' AND is_system_role = true);

INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
SELECT gen_random_uuid(), NULL, 'Project', 'project', 
    'Project team member. Can view and update assigned project details.', 
    true, false, 4
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'project' AND is_system_role = true);

INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
SELECT gen_random_uuid(), NULL, 'Site Supervisor Manager', 'site_supervisor_manager', 
    'Manages site supervisors. Full access to site operations and team assignments.', 
    true, false, 2
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'site_supervisor_manager' AND is_system_role = true);

INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
SELECT gen_random_uuid(), NULL, 'Site Supervisor', 'site_supervisor', 
    'Site supervisor. Can check in, report updates, and manage on-site activities.', 
    true, false, 4
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'site_supervisor' AND is_system_role = true);

INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
SELECT gen_random_uuid(), NULL, 'Staff', 'staff', 
    'General staff member. Basic access to common features.', 
    true, true, 4
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'staff' AND is_system_role = true);

INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
SELECT gen_random_uuid(), NULL, 'Limited', 'limited', 
    'Limited access user. View-only access to permitted areas.', 
    true, false, 5
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE slug = 'limited' AND is_system_role = true);

-- =====================================================
-- ROLE-PERMISSION MAPPINGS
-- =====================================================

-- Helper function to assign permissions to a role
-- We'll use direct inserts with subqueries

-- OWNER - Full access to everything
INSERT INTO role_permissions (id, role_id, permission_id, granted)
SELECT gen_random_uuid(), r.id, p.id, true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'owner' AND r.is_system_role = true AND p.is_system_permission = true
ON CONFLICT DO NOTHING;

-- ADMIN - Almost full access (except billing management reserved for owner)
INSERT INTO role_permissions (id, role_id, permission_id, granted)
SELECT gen_random_uuid(), r.id, p.id, true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'admin' AND r.is_system_role = true 
  AND p.is_system_permission = true
  AND p.key NOT IN ('settings.billing.manage')
ON CONFLICT DO NOTHING;

-- SALES MANAGER
INSERT INTO role_permissions (id, role_id, permission_id, granted)
SELECT gen_random_uuid(), r.id, p.id, true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'sales_manager' AND r.is_system_role = true 
  AND p.is_system_permission = true
  AND p.key IN (
    'dashboard.view', 'dashboard.analytics',
    'leads.view', 'leads.view_team', 'leads.create', 'leads.edit', 'leads.delete',
    'leads.assign', 'leads.reassign', 'leads.export', 'leads.import',
    'leads.stage_change', 'leads.convert',
    'leads.activities.view', 'leads.activities.create',
    'leads.notes.view', 'leads.notes.create', 'leads.reports',
    'clients.view', 'clients.create', 'clients.edit', 'clients.export',
    'quotations.view', 'quotations.create', 'quotations.edit', 'quotations.delete',
    'quotations.approve', 'quotations.send', 'quotations.revise',
    'quotations.discount', 'quotations.discount_unlimited', 'quotations.export',
    'quotations.templates.view', 'quotations.templates.manage',
    'projects.view', 'projects.view_team',
    'tasks.view', 'tasks.view_team', 'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign', 'tasks.complete',
    'calendar.view', 'calendar.view_team', 'calendar.events.create', 'calendar.events.edit', 'calendar.events.delete',
    'documents.view', 'documents.upload', 'documents.download', 'documents.share',
    'reports.view', 'reports.sales', 'reports.export',
    'team.view', 'team.view_limited',
    'library.view', 'library.pricing.view'
  )
ON CONFLICT DO NOTHING;

-- SALES
INSERT INTO role_permissions (id, role_id, permission_id, granted)
SELECT gen_random_uuid(), r.id, p.id, true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'sales' AND r.is_system_role = true 
  AND p.is_system_permission = true
  AND p.key IN (
    'dashboard.view',
    'leads.view_own', 'leads.create', 'leads.edit_own',
    'leads.stage_change',
    'leads.activities.view', 'leads.activities.create',
    'leads.notes.view', 'leads.notes.create',
    'clients.view', 'clients.create', 'clients.edit',
    'quotations.view_own', 'quotations.create', 'quotations.edit_own',
    'quotations.send', 'quotations.revise', 'quotations.discount',
    'quotations.templates.view',
    'projects.view_own',
    'tasks.view_own', 'tasks.create', 'tasks.edit_own', 'tasks.complete',
    'calendar.view', 'calendar.events.create', 'calendar.events.edit',
    'documents.view', 'documents.upload', 'documents.download',
    'team.view_limited',
    'library.view', 'library.pricing.view'
  )
ON CONFLICT DO NOTHING;

-- DESIGN MANAGER
INSERT INTO role_permissions (id, role_id, permission_id, granted)
SELECT gen_random_uuid(), r.id, p.id, true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'design_manager' AND r.is_system_role = true 
  AND p.is_system_permission = true
  AND p.key IN (
    'dashboard.view', 'dashboard.analytics',
    'design.view', 'design.create', 'design.edit', 'design.delete',
    'design.approve', 'design.assign',
    'design.library.view', 'design.library.manage',
    'projects.view', 'projects.view_team', 'projects.edit', 'projects.assign',
    'projects.status_change', 'projects.milestones.manage',
    'projects.timeline.view', 'projects.timeline.edit', 'projects.reports',
    'quotations.view', 'quotations.templates.view',
    'tasks.view', 'tasks.view_team', 'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign', 'tasks.complete',
    'calendar.view', 'calendar.view_team', 'calendar.events.create', 'calendar.events.edit', 'calendar.events.delete',
    'documents.view', 'documents.upload', 'documents.edit', 'documents.delete', 'documents.download', 'documents.share',
    'reports.view', 'reports.projects', 'reports.team', 'reports.export',
    'team.view', 'team.view_limited',
    'library.view', 'library.create', 'library.edit', 'library.pricing.view'
  )
ON CONFLICT DO NOTHING;

-- DESIGN
INSERT INTO role_permissions (id, role_id, permission_id, granted)
SELECT gen_random_uuid(), r.id, p.id, true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'design' AND r.is_system_role = true 
  AND p.is_system_permission = true
  AND p.key IN (
    'dashboard.view',
    'design.view_own', 'design.create', 'design.edit',
    'design.library.view',
    'projects.view_own', 'projects.edit_own',
    'projects.timeline.view',
    'quotations.view_own', 'quotations.templates.view',
    'tasks.view_own', 'tasks.create', 'tasks.edit_own', 'tasks.complete',
    'calendar.view', 'calendar.events.create', 'calendar.events.edit',
    'documents.view', 'documents.upload', 'documents.download',
    'team.view_limited',
    'library.view'
  )
ON CONFLICT DO NOTHING;

-- STOCK MANAGER
INSERT INTO role_permissions (id, role_id, permission_id, granted)
SELECT gen_random_uuid(), r.id, p.id, true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'stock_manager' AND r.is_system_role = true 
  AND p.is_system_permission = true
  AND p.key IN (
    'dashboard.view', 'dashboard.analytics',
    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete',
    'inventory.adjust', 'inventory.transfer', 'inventory.export', 'inventory.reports',
    'inventory.locations.manage', 'inventory.low_stock.view',
    'procurement.view', 'procurement.receive',
    'tasks.view', 'tasks.view_team', 'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign', 'tasks.complete',
    'calendar.view', 'calendar.view_team', 'calendar.events.create', 'calendar.events.edit',
    'documents.view', 'documents.upload', 'documents.download',
    'reports.view', 'reports.inventory', 'reports.export',
    'team.view', 'team.view_limited',
    'library.view', 'library.create', 'library.edit', 'library.pricing.view', 'library.pricing.edit'
  )
ON CONFLICT DO NOTHING;

-- STOCK
INSERT INTO role_permissions (id, role_id, permission_id, granted)
SELECT gen_random_uuid(), r.id, p.id, true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'stock' AND r.is_system_role = true 
  AND p.is_system_permission = true
  AND p.key IN (
    'dashboard.view',
    'inventory.view', 'inventory.create', 'inventory.edit',
    'inventory.adjust', 'inventory.low_stock.view',
    'procurement.view', 'procurement.receive',
    'tasks.view_own', 'tasks.create', 'tasks.edit_own', 'tasks.complete',
    'calendar.view', 'calendar.events.create',
    'documents.view', 'documents.upload', 'documents.download',
    'team.view_limited',
    'library.view', 'library.pricing.view'
  )
ON CONFLICT DO NOTHING;

-- PROCUREMENT MANAGER
INSERT INTO role_permissions (id, role_id, permission_id, granted)
SELECT gen_random_uuid(), r.id, p.id, true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'procurement_manager' AND r.is_system_role = true 
  AND p.is_system_permission = true
  AND p.key IN (
    'dashboard.view', 'dashboard.analytics',
    'procurement.view', 'procurement.create', 'procurement.edit', 'procurement.delete',
    'procurement.approve', 'procurement.approve_high_value', 'procurement.receive',
    'procurement.vendors.view', 'procurement.vendors.manage', 'procurement.reports',
    'inventory.view', 'inventory.low_stock.view',
    'finance.view', 'finance.payments.view',
    'tasks.view', 'tasks.view_team', 'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign', 'tasks.complete',
    'calendar.view', 'calendar.view_team', 'calendar.events.create', 'calendar.events.edit',
    'documents.view', 'documents.upload', 'documents.download', 'documents.share',
    'reports.view', 'reports.inventory', 'reports.export',
    'team.view', 'team.view_limited',
    'library.view', 'library.pricing.view', 'library.pricing.edit'
  )
ON CONFLICT DO NOTHING;

-- PROCUREMENT
INSERT INTO role_permissions (id, role_id, permission_id, granted)
SELECT gen_random_uuid(), r.id, p.id, true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'procurement' AND r.is_system_role = true 
  AND p.is_system_permission = true
  AND p.key IN (
    'dashboard.view',
    'procurement.view', 'procurement.create', 'procurement.edit',
    'procurement.receive',
    'procurement.vendors.view', 'procurement.vendors.manage',
    'inventory.view', 'inventory.low_stock.view',
    'tasks.view_own', 'tasks.create', 'tasks.edit_own', 'tasks.complete',
    'calendar.view', 'calendar.events.create',
    'documents.view', 'documents.upload', 'documents.download',
    'team.view_limited',
    'library.view', 'library.pricing.view'
  )
ON CONFLICT DO NOTHING;

-- FINANCE MANAGER
INSERT INTO role_permissions (id, role_id, permission_id, granted)
SELECT gen_random_uuid(), r.id, p.id, true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'finance_manager' AND r.is_system_role = true 
  AND p.is_system_permission = true
  AND p.key IN (
    'dashboard.view', 'dashboard.analytics',
    'finance.view',
    'finance.invoices.view', 'finance.invoices.create', 'finance.invoices.edit', 'finance.invoices.delete', 'finance.invoices.send',
    'finance.payments.view', 'finance.payments.record', 'finance.payments.approve',
    'finance.expenses.view', 'finance.expenses.create', 'finance.expenses.approve',
    'finance.reports', 'finance.reports.detailed', 'finance.export',
    'quotations.view', 'quotations.approve',
    'procurement.view', 'procurement.approve',
    'projects.view',
    'clients.view', 'clients.export',
    'tasks.view', 'tasks.view_team', 'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign', 'tasks.complete',
    'calendar.view', 'calendar.view_team', 'calendar.events.create', 'calendar.events.edit',
    'documents.view', 'documents.upload', 'documents.download', 'documents.share',
    'reports.view', 'reports.finance', 'reports.sales', 'reports.projects', 'reports.export',
    'team.view', 'team.view_limited',
    'settings.billing.view'
  )
ON CONFLICT DO NOTHING;

-- FINANCE
INSERT INTO role_permissions (id, role_id, permission_id, granted)
SELECT gen_random_uuid(), r.id, p.id, true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'finance' AND r.is_system_role = true 
  AND p.is_system_permission = true
  AND p.key IN (
    'dashboard.view',
    'finance.view',
    'finance.invoices.view', 'finance.invoices.create', 'finance.invoices.edit', 'finance.invoices.send',
    'finance.payments.view', 'finance.payments.record',
    'finance.expenses.view', 'finance.expenses.create',
    'finance.reports',
    'quotations.view',
    'projects.view',
    'clients.view',
    'tasks.view_own', 'tasks.create', 'tasks.edit_own', 'tasks.complete',
    'calendar.view', 'calendar.events.create',
    'documents.view', 'documents.upload', 'documents.download',
    'team.view_limited'
  )
ON CONFLICT DO NOTHING;

-- PROJECT MANAGER
INSERT INTO role_permissions (id, role_id, permission_id, granted)
SELECT gen_random_uuid(), r.id, p.id, true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'project_manager' AND r.is_system_role = true 
  AND p.is_system_permission = true
  AND p.key IN (
    'dashboard.view', 'dashboard.analytics',
    'projects.view', 'projects.view_team', 'projects.create', 'projects.edit', 'projects.delete',
    'projects.assign', 'projects.status_change', 'projects.milestones.manage',
    'projects.timeline.view', 'projects.timeline.edit', 'projects.export', 'projects.reports',
    'leads.view', 'leads.convert',
    'quotations.view', 'quotations.approve',
    'design.view', 'design.approve', 'design.assign',
    'site.view', 'site.assign', 'site.updates.view', 'site.reports',
    'site.schedule.view', 'site.schedule.manage',
    'inventory.view',
    'procurement.view',
    'finance.view', 'finance.invoices.view',
    'clients.view', 'clients.edit',
    'tasks.view', 'tasks.view_team', 'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign', 'tasks.complete',
    'calendar.view', 'calendar.view_team', 'calendar.events.create', 'calendar.events.edit', 'calendar.events.delete',
    'documents.view', 'documents.upload', 'documents.edit', 'documents.delete', 'documents.download', 'documents.share',
    'reports.view', 'reports.projects', 'reports.team', 'reports.export',
    'team.view', 'team.view_limited',
    'library.view', 'library.pricing.view'
  )
ON CONFLICT DO NOTHING;

-- PROJECT
INSERT INTO role_permissions (id, role_id, permission_id, granted)
SELECT gen_random_uuid(), r.id, p.id, true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'project' AND r.is_system_role = true 
  AND p.is_system_permission = true
  AND p.key IN (
    'dashboard.view',
    'projects.view_own', 'projects.edit_own',
    'projects.timeline.view',
    'design.view_own',
    'site.view', 'site.updates.view', 'site.schedule.view',
    'quotations.view_own',
    'clients.view',
    'tasks.view_own', 'tasks.create', 'tasks.edit_own', 'tasks.complete',
    'calendar.view', 'calendar.events.create', 'calendar.events.edit',
    'documents.view', 'documents.upload', 'documents.download',
    'team.view_limited',
    'library.view'
  )
ON CONFLICT DO NOTHING;

-- SITE SUPERVISOR MANAGER
INSERT INTO role_permissions (id, role_id, permission_id, granted)
SELECT gen_random_uuid(), r.id, p.id, true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'site_supervisor_manager' AND r.is_system_role = true 
  AND p.is_system_permission = true
  AND p.key IN (
    'dashboard.view', 'dashboard.analytics',
    'site.view', 'site.checkin', 'site.updates.create', 'site.updates.view',
    'site.issues.create', 'site.issues.resolve', 'site.photos.upload',
    'site.assign', 'site.reports', 'site.schedule.view', 'site.schedule.manage',
    'projects.view', 'projects.view_team', 'projects.timeline.view',
    'inventory.view', 'inventory.low_stock.view',
    'tasks.view', 'tasks.view_team', 'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign', 'tasks.complete',
    'calendar.view', 'calendar.view_team', 'calendar.events.create', 'calendar.events.edit',
    'documents.view', 'documents.upload', 'documents.download', 'documents.share',
    'reports.view', 'reports.projects', 'reports.team',
    'team.view', 'team.view_limited'
  )
ON CONFLICT DO NOTHING;

-- SITE SUPERVISOR
INSERT INTO role_permissions (id, role_id, permission_id, granted)
SELECT gen_random_uuid(), r.id, p.id, true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'site_supervisor' AND r.is_system_role = true 
  AND p.is_system_permission = true
  AND p.key IN (
    'dashboard.view',
    'site.view', 'site.checkin', 'site.updates.create', 'site.updates.view',
    'site.issues.create', 'site.photos.upload', 'site.schedule.view',
    'projects.view_own', 'projects.timeline.view',
    'inventory.view',
    'tasks.view_own', 'tasks.create', 'tasks.edit_own', 'tasks.complete',
    'calendar.view', 'calendar.events.create',
    'documents.view', 'documents.upload', 'documents.download',
    'team.view_limited'
  )
ON CONFLICT DO NOTHING;

-- STAFF (General staff with basic access)
INSERT INTO role_permissions (id, role_id, permission_id, granted)
SELECT gen_random_uuid(), r.id, p.id, true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'staff' AND r.is_system_role = true 
  AND p.is_system_permission = true
  AND p.key IN (
    'dashboard.view',
    'projects.view_own',
    'tasks.view_own', 'tasks.create', 'tasks.edit_own', 'tasks.complete',
    'calendar.view', 'calendar.events.create', 'calendar.events.edit',
    'documents.view', 'documents.upload', 'documents.download',
    'team.view_limited'
  )
ON CONFLICT DO NOTHING;

-- LIMITED (View-only access)
INSERT INTO role_permissions (id, role_id, permission_id, granted)
SELECT gen_random_uuid(), r.id, p.id, true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'limited' AND r.is_system_role = true 
  AND p.is_system_permission = true
  AND p.key IN (
    'dashboard.view',
    'projects.view_own',
    'tasks.view_own',
    'calendar.view',
    'documents.view', 'documents.download',
    'team.view_limited'
  )
ON CONFLICT DO NOTHING;

-- =====================================================
-- SUMMARY OF ROLES AND HIERARCHY
-- =====================================================
-- Level 0: Owner (Full access)
-- Level 1: Admin (Almost full access)
-- Level 2: Managers (Sales Manager, Design Manager, Stock Manager, 
--          Procurement Manager, Finance Manager, Project Manager, 
--          Site Supervisor Manager)
-- Level 4: Regular Staff (Sales, Design, Stock, Procurement, Finance, 
--          Project, Site Supervisor, Staff)
-- Level 5: Limited (View-only)
-- =====================================================
