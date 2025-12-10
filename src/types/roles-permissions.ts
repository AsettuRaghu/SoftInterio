/**
 * Roles and Permissions Type Definitions
 * These types match the database schema and provide type safety for RBAC
 */

// =====================================================
// ROLE SLUGS
// =====================================================

export type RoleSlug =
  | 'owner'
  | 'admin'
  | 'sales_manager'
  | 'sales'
  | 'design_manager'
  | 'design'
  | 'stock_manager'
  | 'stock'
  | 'procurement_manager'
  | 'procurement'
  | 'finance_manager'
  | 'finance'
  | 'project_manager'
  | 'project'
  | 'site_supervisor_manager'
  | 'site_supervisor'
  | 'staff'
  | 'limited';

// Human-readable role names
export const ROLE_NAMES: Record<RoleSlug, string> = {
  owner: 'Owner',
  admin: 'Admin',
  sales_manager: 'Sales Manager',
  sales: 'Sales',
  design_manager: 'Design Manager',
  design: 'Design',
  stock_manager: 'Stock Manager',
  stock: 'Stock',
  procurement_manager: 'Procurement Manager',
  procurement: 'Procurement',
  finance_manager: 'Finance Manager',
  finance: 'Finance',
  project_manager: 'Project Manager',
  project: 'Project',
  site_supervisor_manager: 'Site Supervisor Manager',
  site_supervisor: 'Site Supervisor',
  staff: 'Staff',
  limited: 'Limited',
};

// Role hierarchy levels (lower = more privileged)
export const ROLE_HIERARCHY: Record<RoleSlug, number> = {
  owner: 0,
  admin: 1,
  sales_manager: 2,
  design_manager: 2,
  stock_manager: 2,
  procurement_manager: 2,
  finance_manager: 2,
  project_manager: 2,
  site_supervisor_manager: 2,
  sales: 4,
  design: 4,
  stock: 4,
  procurement: 4,
  finance: 4,
  project: 4,
  site_supervisor: 4,
  staff: 4,
  limited: 5,
};

// =====================================================
// PERMISSION KEYS
// =====================================================

export type PermissionModule =
  | 'dashboard'
  | 'leads'
  | 'clients'
  | 'projects'
  | 'quotations'
  | 'design'
  | 'inventory'
  | 'procurement'
  | 'finance'
  | 'site'
  | 'tasks'
  | 'calendar'
  | 'documents'
  | 'reports'
  | 'team'
  | 'settings'
  | 'library';

// All permission keys
export type PermissionKey =
  // Dashboard
  | 'dashboard.view'
  | 'dashboard.analytics'
  // Leads
  | 'leads.view'
  | 'leads.view_own'
  | 'leads.view_team'
  | 'leads.create'
  | 'leads.edit'
  | 'leads.edit_own'
  | 'leads.delete'
  | 'leads.assign'
  | 'leads.reassign'
  | 'leads.export'
  | 'leads.import'
  | 'leads.stage_change'
  | 'leads.convert'
  | 'leads.activities.view'
  | 'leads.activities.create'
  | 'leads.notes.view'
  | 'leads.notes.create'
  | 'leads.reports'
  // Clients
  | 'clients.view'
  | 'clients.create'
  | 'clients.edit'
  | 'clients.delete'
  | 'clients.export'
  // Projects
  | 'projects.view'
  | 'projects.view_own'
  | 'projects.view_team'
  | 'projects.create'
  | 'projects.edit'
  | 'projects.edit_own'
  | 'projects.delete'
  | 'projects.assign'
  | 'projects.status_change'
  | 'projects.milestones.manage'
  | 'projects.timeline.view'
  | 'projects.timeline.edit'
  | 'projects.export'
  | 'projects.reports'
  // Quotations
  | 'quotations.view'
  | 'quotations.view_own'
  | 'quotations.create'
  | 'quotations.edit'
  | 'quotations.edit_own'
  | 'quotations.delete'
  | 'quotations.approve'
  | 'quotations.send'
  | 'quotations.revise'
  | 'quotations.discount'
  | 'quotations.discount_unlimited'
  | 'quotations.export'
  | 'quotations.templates.view'
  | 'quotations.templates.manage'
  // Design
  | 'design.view'
  | 'design.view_own'
  | 'design.create'
  | 'design.edit'
  | 'design.delete'
  | 'design.approve'
  | 'design.assign'
  | 'design.library.view'
  | 'design.library.manage'
  // Inventory
  | 'inventory.view'
  | 'inventory.create'
  | 'inventory.edit'
  | 'inventory.delete'
  | 'inventory.adjust'
  | 'inventory.transfer'
  | 'inventory.export'
  | 'inventory.reports'
  | 'inventory.locations.manage'
  | 'inventory.low_stock.view'
  // Procurement
  | 'procurement.view'
  | 'procurement.create'
  | 'procurement.edit'
  | 'procurement.delete'
  | 'procurement.approve'
  | 'procurement.approve_high_value'
  | 'procurement.receive'
  | 'procurement.vendors.view'
  | 'procurement.vendors.manage'
  | 'procurement.reports'
  // Finance
  | 'finance.view'
  | 'finance.invoices.view'
  | 'finance.invoices.create'
  | 'finance.invoices.edit'
  | 'finance.invoices.delete'
  | 'finance.invoices.send'
  | 'finance.payments.view'
  | 'finance.payments.record'
  | 'finance.payments.approve'
  | 'finance.expenses.view'
  | 'finance.expenses.create'
  | 'finance.expenses.approve'
  | 'finance.reports'
  | 'finance.reports.detailed'
  | 'finance.export'
  // Site
  | 'site.view'
  | 'site.checkin'
  | 'site.updates.create'
  | 'site.updates.view'
  | 'site.issues.create'
  | 'site.issues.resolve'
  | 'site.photos.upload'
  | 'site.assign'
  | 'site.reports'
  | 'site.schedule.view'
  | 'site.schedule.manage'
  // Tasks
  | 'tasks.view'
  | 'tasks.view_own'
  | 'tasks.view_team'
  | 'tasks.create'
  | 'tasks.edit'
  | 'tasks.edit_own'
  | 'tasks.delete'
  | 'tasks.assign'
  | 'tasks.complete'
  // Calendar
  | 'calendar.view'
  | 'calendar.view_team'
  | 'calendar.events.create'
  | 'calendar.events.edit'
  | 'calendar.events.delete'
  // Documents
  | 'documents.view'
  | 'documents.upload'
  | 'documents.edit'
  | 'documents.delete'
  | 'documents.download'
  | 'documents.share'
  // Reports
  | 'reports.view'
  | 'reports.sales'
  | 'reports.projects'
  | 'reports.finance'
  | 'reports.inventory'
  | 'reports.team'
  | 'reports.custom'
  | 'reports.export'
  // Team
  | 'team.view'
  | 'team.view_limited'
  | 'team.invite'
  | 'team.edit'
  | 'team.deactivate'
  | 'team.roles.assign'
  | 'team.permissions.view'
  | 'team.permissions.manage'
  // Settings
  | 'settings.view'
  | 'settings.company.edit'
  | 'settings.billing.view'
  | 'settings.billing.manage'
  | 'settings.integrations.view'
  | 'settings.integrations.manage'
  | 'settings.notifications.manage'
  | 'settings.templates.manage'
  | 'settings.audit_log.view'
  // Library
  | 'library.view'
  | 'library.create'
  | 'library.edit'
  | 'library.delete'
  | 'library.pricing.view'
  | 'library.pricing.edit';

// =====================================================
// PERMISSION GROUPS (for UI organization)
// =====================================================

export interface PermissionGroup {
  module: PermissionModule;
  label: string;
  permissions: {
    key: PermissionKey;
    label: string;
    description: string;
  }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    module: 'dashboard',
    label: 'Dashboard',
    permissions: [
      { key: 'dashboard.view', label: 'View Dashboard', description: 'Access the main dashboard' },
      { key: 'dashboard.analytics', label: 'View Analytics', description: 'View analytics and charts' },
    ],
  },
  {
    module: 'leads',
    label: 'Leads / Sales',
    permissions: [
      { key: 'leads.view', label: 'View All Leads', description: 'View all leads in the system' },
      { key: 'leads.view_own', label: 'View Own Leads', description: 'View only assigned leads' },
      { key: 'leads.view_team', label: 'View Team Leads', description: 'View team members\' leads' },
      { key: 'leads.create', label: 'Create Leads', description: 'Create new leads' },
      { key: 'leads.edit', label: 'Edit All Leads', description: 'Edit any lead' },
      { key: 'leads.edit_own', label: 'Edit Own Leads', description: 'Edit only assigned leads' },
      { key: 'leads.delete', label: 'Delete Leads', description: 'Delete leads' },
      { key: 'leads.assign', label: 'Assign Leads', description: 'Assign leads to team members' },
      { key: 'leads.reassign', label: 'Reassign Leads', description: 'Reassign leads between members' },
      { key: 'leads.export', label: 'Export Leads', description: 'Export leads data' },
      { key: 'leads.import', label: 'Import Leads', description: 'Import leads data' },
      { key: 'leads.stage_change', label: 'Change Stage', description: 'Change lead stages' },
      { key: 'leads.convert', label: 'Convert to Project', description: 'Convert leads to projects' },
      { key: 'leads.activities.view', label: 'View Activities', description: 'View lead activities' },
      { key: 'leads.activities.create', label: 'Create Activities', description: 'Log lead activities' },
      { key: 'leads.notes.view', label: 'View Notes', description: 'View lead notes' },
      { key: 'leads.notes.create', label: 'Create Notes', description: 'Add lead notes' },
      { key: 'leads.reports', label: 'View Reports', description: 'View sales reports' },
    ],
  },
  {
    module: 'clients',
    label: 'Clients',
    permissions: [
      { key: 'clients.view', label: 'View Clients', description: 'View client information' },
      { key: 'clients.create', label: 'Create Clients', description: 'Create new clients' },
      { key: 'clients.edit', label: 'Edit Clients', description: 'Edit client information' },
      { key: 'clients.delete', label: 'Delete Clients', description: 'Delete clients' },
      { key: 'clients.export', label: 'Export Clients', description: 'Export client data' },
    ],
  },
  {
    module: 'projects',
    label: 'Projects',
    permissions: [
      { key: 'projects.view', label: 'View All Projects', description: 'View all projects' },
      { key: 'projects.view_own', label: 'View Own Projects', description: 'View assigned projects only' },
      { key: 'projects.view_team', label: 'View Team Projects', description: 'View team projects' },
      { key: 'projects.create', label: 'Create Projects', description: 'Create new projects' },
      { key: 'projects.edit', label: 'Edit All Projects', description: 'Edit any project' },
      { key: 'projects.edit_own', label: 'Edit Own Projects', description: 'Edit assigned projects only' },
      { key: 'projects.delete', label: 'Delete Projects', description: 'Delete projects' },
      { key: 'projects.assign', label: 'Assign Team', description: 'Assign team members to projects' },
      { key: 'projects.status_change', label: 'Change Status', description: 'Change project status' },
      { key: 'projects.milestones.manage', label: 'Manage Milestones', description: 'Manage project milestones' },
      { key: 'projects.timeline.view', label: 'View Timeline', description: 'View project timeline' },
      { key: 'projects.timeline.edit', label: 'Edit Timeline', description: 'Edit project timeline' },
      { key: 'projects.export', label: 'Export Projects', description: 'Export project data' },
      { key: 'projects.reports', label: 'View Reports', description: 'View project reports' },
    ],
  },
  {
    module: 'quotations',
    label: 'Quotations',
    permissions: [
      { key: 'quotations.view', label: 'View All Quotations', description: 'View all quotations' },
      { key: 'quotations.view_own', label: 'View Own Quotations', description: 'View own quotations only' },
      { key: 'quotations.create', label: 'Create Quotations', description: 'Create new quotations' },
      { key: 'quotations.edit', label: 'Edit All Quotations', description: 'Edit any quotation' },
      { key: 'quotations.edit_own', label: 'Edit Own Quotations', description: 'Edit own quotations only' },
      { key: 'quotations.delete', label: 'Delete Quotations', description: 'Delete quotations' },
      { key: 'quotations.approve', label: 'Approve Quotations', description: 'Approve quotations' },
      { key: 'quotations.send', label: 'Send Quotations', description: 'Send quotations to clients' },
      { key: 'quotations.revise', label: 'Revise Quotations', description: 'Create revisions' },
      { key: 'quotations.discount', label: 'Apply Discounts', description: 'Apply discounts (limited)' },
      { key: 'quotations.discount_unlimited', label: 'Unlimited Discounts', description: 'Apply any discount amount' },
      { key: 'quotations.export', label: 'Export Quotations', description: 'Export quotation data' },
      { key: 'quotations.templates.view', label: 'View Templates', description: 'View quotation templates' },
      { key: 'quotations.templates.manage', label: 'Manage Templates', description: 'Create/edit templates' },
    ],
  },
  {
    module: 'design',
    label: 'Design',
    permissions: [
      { key: 'design.view', label: 'View All Designs', description: 'View all design files' },
      { key: 'design.view_own', label: 'View Own Designs', description: 'View own design files only' },
      { key: 'design.create', label: 'Create Designs', description: 'Upload design files' },
      { key: 'design.edit', label: 'Edit Designs', description: 'Edit design files' },
      { key: 'design.delete', label: 'Delete Designs', description: 'Delete design files' },
      { key: 'design.approve', label: 'Approve Designs', description: 'Approve design files' },
      { key: 'design.assign', label: 'Assign Design Tasks', description: 'Assign design work' },
      { key: 'design.library.view', label: 'View Design Library', description: 'View design library' },
      { key: 'design.library.manage', label: 'Manage Design Library', description: 'Manage design library' },
    ],
  },
  {
    module: 'inventory',
    label: 'Inventory / Stock',
    permissions: [
      { key: 'inventory.view', label: 'View Inventory', description: 'View inventory items' },
      { key: 'inventory.create', label: 'Add Items', description: 'Add inventory items' },
      { key: 'inventory.edit', label: 'Edit Items', description: 'Edit inventory items' },
      { key: 'inventory.delete', label: 'Delete Items', description: 'Delete inventory items' },
      { key: 'inventory.adjust', label: 'Adjust Quantities', description: 'Adjust stock quantities' },
      { key: 'inventory.transfer', label: 'Transfer Stock', description: 'Transfer between locations' },
      { key: 'inventory.export', label: 'Export Inventory', description: 'Export inventory data' },
      { key: 'inventory.reports', label: 'View Reports', description: 'View inventory reports' },
      { key: 'inventory.locations.manage', label: 'Manage Locations', description: 'Manage storage locations' },
      { key: 'inventory.low_stock.view', label: 'View Low Stock', description: 'View low stock alerts' },
    ],
  },
  {
    module: 'procurement',
    label: 'Procurement',
    permissions: [
      { key: 'procurement.view', label: 'View Purchase Orders', description: 'View purchase orders' },
      { key: 'procurement.create', label: 'Create POs', description: 'Create purchase orders' },
      { key: 'procurement.edit', label: 'Edit POs', description: 'Edit purchase orders' },
      { key: 'procurement.delete', label: 'Delete POs', description: 'Delete purchase orders' },
      { key: 'procurement.approve', label: 'Approve POs', description: 'Approve purchase orders' },
      { key: 'procurement.approve_high_value', label: 'Approve High Value', description: 'Approve high-value POs' },
      { key: 'procurement.receive', label: 'Receive Goods', description: 'Receive goods against PO' },
      { key: 'procurement.vendors.view', label: 'View Vendors', description: 'View vendor list' },
      { key: 'procurement.vendors.manage', label: 'Manage Vendors', description: 'Add/edit vendors' },
      { key: 'procurement.reports', label: 'View Reports', description: 'View procurement reports' },
    ],
  },
  {
    module: 'finance',
    label: 'Finance',
    permissions: [
      { key: 'finance.view', label: 'View Finance', description: 'View finance dashboard' },
      { key: 'finance.invoices.view', label: 'View Invoices', description: 'View invoices' },
      { key: 'finance.invoices.create', label: 'Create Invoices', description: 'Create invoices' },
      { key: 'finance.invoices.edit', label: 'Edit Invoices', description: 'Edit invoices' },
      { key: 'finance.invoices.delete', label: 'Delete Invoices', description: 'Delete invoices' },
      { key: 'finance.invoices.send', label: 'Send Invoices', description: 'Send invoices to clients' },
      { key: 'finance.payments.view', label: 'View Payments', description: 'View payment records' },
      { key: 'finance.payments.record', label: 'Record Payments', description: 'Record payments' },
      { key: 'finance.payments.approve', label: 'Approve Payments', description: 'Approve payment requests' },
      { key: 'finance.expenses.view', label: 'View Expenses', description: 'View expenses' },
      { key: 'finance.expenses.create', label: 'Create Expenses', description: 'Create expense entries' },
      { key: 'finance.expenses.approve', label: 'Approve Expenses', description: 'Approve expenses' },
      { key: 'finance.reports', label: 'View Reports', description: 'View financial reports' },
      { key: 'finance.reports.detailed', label: 'Detailed Reports', description: 'View detailed reports' },
      { key: 'finance.export', label: 'Export Finance Data', description: 'Export financial data' },
    ],
  },
  {
    module: 'site',
    label: 'Site Supervision',
    permissions: [
      { key: 'site.view', label: 'View Sites', description: 'View site information' },
      { key: 'site.checkin', label: 'Check In', description: 'Check in at site' },
      { key: 'site.updates.create', label: 'Create Updates', description: 'Post site updates' },
      { key: 'site.updates.view', label: 'View Updates', description: 'View site updates' },
      { key: 'site.issues.create', label: 'Report Issues', description: 'Report site issues' },
      { key: 'site.issues.resolve', label: 'Resolve Issues', description: 'Mark issues resolved' },
      { key: 'site.photos.upload', label: 'Upload Photos', description: 'Upload site photos' },
      { key: 'site.assign', label: 'Assign Supervisors', description: 'Assign site supervisors' },
      { key: 'site.reports', label: 'View Reports', description: 'View site reports' },
      { key: 'site.schedule.view', label: 'View Schedule', description: 'View site schedules' },
      { key: 'site.schedule.manage', label: 'Manage Schedule', description: 'Manage site schedules' },
    ],
  },
  {
    module: 'tasks',
    label: 'Tasks',
    permissions: [
      { key: 'tasks.view', label: 'View All Tasks', description: 'View all tasks' },
      { key: 'tasks.view_own', label: 'View Own Tasks', description: 'View assigned tasks only' },
      { key: 'tasks.view_team', label: 'View Team Tasks', description: 'View team tasks' },
      { key: 'tasks.create', label: 'Create Tasks', description: 'Create new tasks' },
      { key: 'tasks.edit', label: 'Edit All Tasks', description: 'Edit any task' },
      { key: 'tasks.edit_own', label: 'Edit Own Tasks', description: 'Edit assigned tasks only' },
      { key: 'tasks.delete', label: 'Delete Tasks', description: 'Delete tasks' },
      { key: 'tasks.assign', label: 'Assign Tasks', description: 'Assign tasks to members' },
      { key: 'tasks.complete', label: 'Complete Tasks', description: 'Mark tasks complete' },
    ],
  },
  {
    module: 'calendar',
    label: 'Calendar',
    permissions: [
      { key: 'calendar.view', label: 'View Calendar', description: 'View calendar' },
      { key: 'calendar.view_team', label: 'View Team Calendar', description: 'View team calendar' },
      { key: 'calendar.events.create', label: 'Create Events', description: 'Create calendar events' },
      { key: 'calendar.events.edit', label: 'Edit Events', description: 'Edit calendar events' },
      { key: 'calendar.events.delete', label: 'Delete Events', description: 'Delete calendar events' },
    ],
  },
  {
    module: 'documents',
    label: 'Documents',
    permissions: [
      { key: 'documents.view', label: 'View Documents', description: 'View documents' },
      { key: 'documents.upload', label: 'Upload Documents', description: 'Upload documents' },
      { key: 'documents.edit', label: 'Edit Metadata', description: 'Edit document metadata' },
      { key: 'documents.delete', label: 'Delete Documents', description: 'Delete documents' },
      { key: 'documents.download', label: 'Download Documents', description: 'Download documents' },
      { key: 'documents.share', label: 'Share Documents', description: 'Share documents' },
    ],
  },
  {
    module: 'reports',
    label: 'Reports',
    permissions: [
      { key: 'reports.view', label: 'View Reports', description: 'Access reports section' },
      { key: 'reports.sales', label: 'Sales Reports', description: 'View sales reports' },
      { key: 'reports.projects', label: 'Project Reports', description: 'View project reports' },
      { key: 'reports.finance', label: 'Finance Reports', description: 'View finance reports' },
      { key: 'reports.inventory', label: 'Inventory Reports', description: 'View inventory reports' },
      { key: 'reports.team', label: 'Team Reports', description: 'View team performance' },
      { key: 'reports.custom', label: 'Custom Reports', description: 'Create custom reports' },
      { key: 'reports.export', label: 'Export Reports', description: 'Export report data' },
    ],
  },
  {
    module: 'team',
    label: 'Team Management',
    permissions: [
      { key: 'team.view', label: 'View Team', description: 'View team members' },
      { key: 'team.view_limited', label: 'View Limited', description: 'View basic team info' },
      { key: 'team.invite', label: 'Invite Members', description: 'Invite new team members' },
      { key: 'team.edit', label: 'Edit Members', description: 'Edit team member details' },
      { key: 'team.deactivate', label: 'Deactivate Members', description: 'Deactivate team members' },
      { key: 'team.roles.assign', label: 'Assign Roles', description: 'Assign roles to members' },
      { key: 'team.permissions.view', label: 'View Permissions', description: 'View role permissions' },
      { key: 'team.permissions.manage', label: 'Manage Permissions', description: 'Customize permissions' },
    ],
  },
  {
    module: 'settings',
    label: 'Settings',
    permissions: [
      { key: 'settings.view', label: 'View Settings', description: 'View settings page' },
      { key: 'settings.company.edit', label: 'Edit Company', description: 'Edit company settings' },
      { key: 'settings.billing.view', label: 'View Billing', description: 'View billing info' },
      { key: 'settings.billing.manage', label: 'Manage Billing', description: 'Manage subscription' },
      { key: 'settings.integrations.view', label: 'View Integrations', description: 'View integrations' },
      { key: 'settings.integrations.manage', label: 'Manage Integrations', description: 'Configure integrations' },
      { key: 'settings.notifications.manage', label: 'Notification Settings', description: 'Configure notifications' },
      { key: 'settings.templates.manage', label: 'Manage Templates', description: 'Manage email templates' },
      { key: 'settings.audit_log.view', label: 'View Audit Log', description: 'View audit logs' },
    ],
  },
  {
    module: 'library',
    label: 'Library',
    permissions: [
      { key: 'library.view', label: 'View Library', description: 'View library items' },
      { key: 'library.create', label: 'Create Items', description: 'Add library items' },
      { key: 'library.edit', label: 'Edit Items', description: 'Edit library items' },
      { key: 'library.delete', label: 'Delete Items', description: 'Delete library items' },
      { key: 'library.pricing.view', label: 'View Pricing', description: 'View item pricing' },
      { key: 'library.pricing.edit', label: 'Edit Pricing', description: 'Edit item pricing' },
    ],
  },
];

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Check if a role is a manager role
 */
export function isManagerRole(roleSlug: RoleSlug): boolean {
  return roleSlug.endsWith('_manager') || roleSlug === 'owner' || roleSlug === 'admin';
}

/**
 * Check if a role has higher or equal privilege than another
 */
export function hasHigherOrEqualPrivilege(userRole: RoleSlug, requiredRole: RoleSlug): boolean {
  return ROLE_HIERARCHY[userRole] <= ROLE_HIERARCHY[requiredRole];
}

/**
 * Get the department from a role slug
 */
export function getRoleDepartment(roleSlug: RoleSlug): string | null {
  const departmentMap: Record<string, string> = {
    sales: 'Sales',
    sales_manager: 'Sales',
    design: 'Design',
    design_manager: 'Design',
    stock: 'Stock',
    stock_manager: 'Stock',
    procurement: 'Procurement',
    procurement_manager: 'Procurement',
    finance: 'Finance',
    finance_manager: 'Finance',
    project: 'Project',
    project_manager: 'Project',
    site_supervisor: 'Site',
    site_supervisor_manager: 'Site',
  };
  return departmentMap[roleSlug] || null;
}

/**
 * Get roles that can be assigned by a given role
 * (Users can only assign roles lower in hierarchy)
 */
export function getAssignableRoles(userRole: RoleSlug): RoleSlug[] {
  const userLevel = ROLE_HIERARCHY[userRole];
  return (Object.entries(ROLE_HIERARCHY) as [RoleSlug, number][])
    .filter(([_, level]) => level > userLevel)
    .map(([slug]) => slug);
}
