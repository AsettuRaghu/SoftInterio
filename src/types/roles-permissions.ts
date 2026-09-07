/**
 * Roles and permissions - GENERATED FILE, DO NOT EDIT BY HAND.
 *
 * Regenerate with:  node scripts/generate-permission-types.js
 *
 * The database is the source of truth. This file exists so permission keys and
 * role slugs can be named in TypeScript, and so a typo becomes a compile error
 * rather than a silent denial at runtime.
 *
 * There is deliberately nothing here expressing a role hierarchy. The model is
 * flat: a person can do what their granted permissions say, and nothing is
 * inherited. roles.hierarchy_level still exists in the schema and is not used.
 *
 * Generated from 265 permissions and 21 system roles.
 */

// =====================================================
// PERMISSIONS
// =====================================================

export type PermissionModule =
  | 'calendar'
  | 'clients'
  | 'dashboard'
  | 'design'
  | 'documents'
  | 'finance'
  | 'inventory'
  | 'leads'
  | 'library'
  | 'ownership'
  | 'procurement'
  | 'projects'
  | 'quotations'
  | 'reports'
  | 'sales'
  | 'settings'
  | 'site'
  | 'stock'
  | 'tasks'
  | 'team';

export type PermissionKey =
  | 'brands.create'
  | 'brands.delete'
  | 'brands.edit'
  | 'brands.update'
  | 'brands.view'
  | 'calendar.create'
  | 'calendar.delete'
  | 'calendar.events.create'
  | 'calendar.events.delete'
  | 'calendar.events.edit'
  | 'calendar.update'
  | 'calendar.view'
  | 'calendar.view_team'
  | 'clients.create'
  | 'clients.delete'
  | 'clients.edit'
  | 'clients.export'
  | 'clients.view'
  | 'cost_items.create'
  | 'cost_items.delete'
  | 'cost_items.edit'
  | 'cost_items.pricing'
  | 'cost_items.view'
  | 'dashboard.analytics'
  | 'dashboard.view'
  | 'design.approve'
  | 'design.assign'
  | 'design.create'
  | 'design.delete'
  | 'design.edit'
  | 'design.library.manage'
  | 'design.library.view'
  | 'design.view'
  | 'design.view_own'
  | 'documents.delete'
  | 'documents.download'
  | 'documents.edit'
  | 'documents.share'
  | 'documents.update'
  | 'documents.upload'
  | 'documents.view'
  | 'finance.approve'
  | 'finance.create'
  | 'finance.delete'
  | 'finance.expenses.approve'
  | 'finance.expenses.create'
  | 'finance.expenses.view'
  | 'finance.export'
  | 'finance.invoices.create'
  | 'finance.invoices.delete'
  | 'finance.invoices.edit'
  | 'finance.invoices.send'
  | 'finance.invoices.view'
  | 'finance.payments.approve'
  | 'finance.payments.record'
  | 'finance.payments.view'
  | 'finance.reports'
  | 'finance.reports.detailed'
  | 'finance.update'
  | 'finance.view'
  | 'grn.confirm'
  | 'grn.create'
  | 'grn.view'
  | 'inventory.adjust'
  | 'inventory.create'
  | 'inventory.delete'
  | 'inventory.edit'
  | 'inventory.export'
  | 'inventory.locations.manage'
  | 'inventory.low_stock.view'
  | 'inventory.reports'
  | 'inventory.transfer'
  | 'inventory.view'
  | 'issue.confirm'
  | 'issue.create'
  | 'issue.view'
  | 'leads.activities.create'
  | 'leads.activities.view'
  | 'leads.assign'
  | 'leads.convert'
  | 'leads.create'
  | 'leads.delete'
  | 'leads.edit'
  | 'leads.edit_own'
  | 'leads.export'
  | 'leads.import'
  | 'leads.notes.create'
  | 'leads.notes.view'
  | 'leads.reassign'
  | 'leads.reports'
  | 'leads.stage_change'
  | 'leads.view'
  | 'leads.view_own'
  | 'leads.view_team'
  | 'library.create'
  | 'library.delete'
  | 'library.edit'
  | 'library.pricing.edit'
  | 'library.pricing.view'
  | 'library.update'
  | 'library.upload'
  | 'library.view'
  | 'materials.adjust'
  | 'materials.create'
  | 'materials.delete'
  | 'materials.edit'
  | 'materials.view'
  | 'mr.create'
  | 'mr.delete'
  | 'mr.edit'
  | 'mr.view'
  | 'ownership.transfer'
  | 'po.approve'
  | 'po.create'
  | 'po.delete'
  | 'po.edit'
  | 'po.receive'
  | 'po.send'
  | 'po.view'
  | 'procurement.approve'
  | 'procurement.approve_high_value'
  | 'procurement.create'
  | 'procurement.delete'
  | 'procurement.edit'
  | 'procurement.receive'
  | 'procurement.reports'
  | 'procurement.update'
  | 'procurement.vendors.manage'
  | 'procurement.vendors.view'
  | 'procurement.view'
  | 'projects.archive'
  | 'projects.assign'
  | 'projects.create'
  | 'projects.delete'
  | 'projects.edit'
  | 'projects.edit_own'
  | 'projects.export'
  | 'projects.milestones.manage'
  | 'projects.reports'
  | 'projects.status_change'
  | 'projects.timeline.edit'
  | 'projects.timeline.view'
  | 'projects.update'
  | 'projects.view'
  | 'projects.view_all'
  | 'projects.view_own'
  | 'projects.view_team'
  | 'quotations.approve'
  | 'quotations.create'
  | 'quotations.delete'
  | 'quotations.discount'
  | 'quotations.discount_unlimited'
  | 'quotations.edit'
  | 'quotations.edit_own'
  | 'quotations.export'
  | 'quotations.revise'
  | 'quotations.send'
  | 'quotations.templates.create'
  | 'quotations.templates.delete'
  | 'quotations.templates.manage'
  | 'quotations.templates.update'
  | 'quotations.templates.view'
  | 'quotations.update'
  | 'quotations.view'
  | 'quotations.view_own'
  | 'reports.create'
  | 'reports.custom'
  | 'reports.export'
  | 'reports.finance'
  | 'reports.inventory'
  | 'reports.projects'
  | 'reports.sales'
  | 'reports.team'
  | 'reports.view'
  | 'sales.assign'
  | 'sales.convert'
  | 'sales.convert_to_won'
  | 'sales.create'
  | 'sales.delete'
  | 'sales.leads.approve_won'
  | 'sales.leads.assign'
  | 'sales.leads.create'
  | 'sales.leads.delete'
  | 'sales.leads.disqualify'
  | 'sales.leads.edit_all'
  | 'sales.leads.edit_own'
  | 'sales.leads.export'
  | 'sales.leads.mark_won'
  | 'sales.leads.view'
  | 'sales.leads.view_all'
  | 'sales.leads.view_own'
  | 'sales.reports'
  | 'sales.reports.view'
  | 'sales.settings.manage'
  | 'sales.update'
  | 'sales.view'
  | 'sales.view_all'
  | 'settings.audit_log.view'
  | 'settings.billing'
  | 'settings.billing.manage'
  | 'settings.billing.view'
  | 'settings.company.edit'
  | 'settings.company.update'
  | 'settings.company.view'
  | 'settings.integrations.manage'
  | 'settings.integrations.view'
  | 'settings.notifications.manage'
  | 'settings.profile'
  | 'settings.team.invite'
  | 'settings.team.remove'
  | 'settings.team.update'
  | 'settings.team.view'
  | 'settings.templates.manage'
  | 'settings.view'
  | 'site.assign'
  | 'site.checkin'
  | 'site.issues.create'
  | 'site.issues.resolve'
  | 'site.photos.upload'
  | 'site.reports'
  | 'site.schedule.manage'
  | 'site.schedule.view'
  | 'site.updates.create'
  | 'site.updates.view'
  | 'site.view'
  | 'stock.adjust'
  | 'stock.create'
  | 'stock.delete'
  | 'stock.overview'
  | 'stock.reports'
  | 'stock.settings'
  | 'stock.transfer'
  | 'stock.update'
  | 'stock.view'
  | 'tasks.assign'
  | 'tasks.comment'
  | 'tasks.complete'
  | 'tasks.create'
  | 'tasks.delete'
  | 'tasks.edit'
  | 'tasks.edit_all'
  | 'tasks.edit_own'
  | 'tasks.templates.create'
  | 'tasks.templates.delete'
  | 'tasks.templates.edit'
  | 'tasks.templates.manage_protected'
  | 'tasks.templates.view'
  | 'tasks.update'
  | 'tasks.view'
  | 'tasks.view_all'
  | 'tasks.view_own'
  | 'tasks.view_team'
  | 'team.deactivate'
  | 'team.edit'
  | 'team.invite'
  | 'team.permissions.manage'
  | 'team.permissions.view'
  | 'team.roles.assign'
  | 'team.view'
  | 'team.view_limited'
  | 'vendors.create'
  | 'vendors.delete'
  | 'vendors.edit'
  | 'vendors.update'
  | 'vendors.view';

export interface PermissionDefinition {
  key: PermissionKey;
  module: PermissionModule;
  description: string | null;
}

/**
 * Every permission that exists, for building an administration UI. Grouped by
 * module with PERMISSIONS_BY_MODULE below.
 */
export const PERMISSION_CATALOGUE: readonly PermissionDefinition[] = [
  { key: 'brands.create', module: 'stock', description: 'Create new brands' },
  { key: 'brands.delete', module: 'stock', description: 'Delete brands' },
  { key: 'brands.edit', module: 'stock', description: 'Edit brands' },
  { key: 'brands.update', module: 'stock', description: 'Update brand details' },
  { key: 'brands.view', module: 'stock', description: 'View brands list' },
  { key: 'calendar.create', module: 'calendar', description: 'Create calendar events' },
  { key: 'calendar.delete', module: 'calendar', description: 'Delete calendar events' },
  { key: 'calendar.events.create', module: 'calendar', description: 'Create calendar events' },
  { key: 'calendar.events.delete', module: 'calendar', description: 'Delete calendar events' },
  { key: 'calendar.events.edit', module: 'calendar', description: 'Edit calendar events' },
  { key: 'calendar.update', module: 'calendar', description: 'Update calendar events' },
  { key: 'calendar.view', module: 'calendar', description: 'View calendar' },
  { key: 'calendar.view_team', module: 'calendar', description: 'View team calendar' },
  { key: 'clients.create', module: 'clients', description: 'Create new clients' },
  { key: 'clients.delete', module: 'clients', description: 'Delete clients' },
  { key: 'clients.edit', module: 'clients', description: 'Edit clients' },
  { key: 'clients.export', module: 'clients', description: 'Export clients data' },
  { key: 'clients.view', module: 'clients', description: 'View clients' },
  { key: 'cost_items.create', module: 'stock', description: 'Create cost items' },
  { key: 'cost_items.delete', module: 'stock', description: 'Delete cost items' },
  { key: 'cost_items.edit', module: 'stock', description: 'Edit cost items' },
  { key: 'cost_items.pricing', module: 'stock', description: 'Manage cost item pricing (vendor/company/base rates)' },
  { key: 'cost_items.view', module: 'stock', description: 'View cost items catalog' },
  { key: 'dashboard.analytics', module: 'dashboard', description: 'View analytics and reports on dashboard' },
  { key: 'dashboard.view', module: 'dashboard', description: 'View dashboard' },
  { key: 'design.approve', module: 'design', description: 'Approve design files' },
  { key: 'design.assign', module: 'design', description: 'Assign design tasks' },
  { key: 'design.create', module: 'design', description: 'Create/upload design files' },
  { key: 'design.delete', module: 'design', description: 'Delete design files' },
  { key: 'design.edit', module: 'design', description: 'Edit design files' },
  { key: 'design.library.manage', module: 'design', description: 'Manage design library' },
  { key: 'design.library.view', module: 'design', description: 'View design library' },
  { key: 'design.view', module: 'design', description: 'View design files and documents' },
  { key: 'design.view_own', module: 'design', description: 'View only own design files' },
  { key: 'documents.delete', module: 'documents', description: 'Delete documents' },
  { key: 'documents.download', module: 'documents', description: 'Download documents' },
  { key: 'documents.edit', module: 'documents', description: 'Edit document metadata' },
  { key: 'documents.share', module: 'documents', description: 'Share documents' },
  { key: 'documents.update', module: 'documents', description: 'Update document details' },
  { key: 'documents.upload', module: 'documents', description: 'Upload documents' },
  { key: 'documents.view', module: 'documents', description: 'View documents' },
  { key: 'finance.approve', module: 'finance', description: 'Approve payments and expenses' },
  { key: 'finance.create', module: 'finance', description: 'Create invoices, payments, expenses' },
  { key: 'finance.delete', module: 'finance', description: 'Delete financial records' },
  { key: 'finance.expenses.approve', module: 'finance', description: 'Approve expenses' },
  { key: 'finance.expenses.create', module: 'finance', description: 'Create expense entries' },
  { key: 'finance.expenses.view', module: 'finance', description: 'View expenses' },
  { key: 'finance.export', module: 'finance', description: 'Export financial data' },
  { key: 'finance.invoices.create', module: 'finance', description: 'Create invoices' },
  { key: 'finance.invoices.delete', module: 'finance', description: 'Delete invoices' },
  { key: 'finance.invoices.edit', module: 'finance', description: 'Edit invoices' },
  { key: 'finance.invoices.send', module: 'finance', description: 'Send invoices to clients' },
  { key: 'finance.invoices.view', module: 'finance', description: 'View invoices' },
  { key: 'finance.payments.approve', module: 'finance', description: 'Approve payment requests' },
  { key: 'finance.payments.record', module: 'finance', description: 'Record payments' },
  { key: 'finance.payments.view', module: 'finance', description: 'View payments' },
  { key: 'finance.reports', module: 'finance', description: 'View financial reports' },
  { key: 'finance.reports.detailed', module: 'finance', description: 'View detailed financial reports' },
  { key: 'finance.update', module: 'finance', description: 'Update financial records' },
  { key: 'finance.view', module: 'finance', description: 'View finance dashboard' },
  { key: 'grn.confirm', module: 'stock', description: 'Confirm goods receipts' },
  { key: 'grn.create', module: 'stock', description: 'Create goods receipts' },
  { key: 'grn.view', module: 'stock', description: 'View goods receipts' },
  { key: 'inventory.adjust', module: 'inventory', description: 'Adjust inventory quantities' },
  { key: 'inventory.create', module: 'inventory', description: 'Add inventory items' },
  { key: 'inventory.delete', module: 'inventory', description: 'Delete inventory items' },
  { key: 'inventory.edit', module: 'inventory', description: 'Edit inventory items' },
  { key: 'inventory.export', module: 'inventory', description: 'Export inventory data' },
  { key: 'inventory.locations.manage', module: 'inventory', description: 'Manage inventory locations' },
  { key: 'inventory.low_stock.view', module: 'inventory', description: 'View low stock alerts' },
  { key: 'inventory.reports', module: 'inventory', description: 'View inventory reports' },
  { key: 'inventory.transfer', module: 'inventory', description: 'Transfer inventory between locations' },
  { key: 'inventory.view', module: 'inventory', description: 'View inventory' },
  { key: 'issue.confirm', module: 'stock', description: 'Confirm stock issues' },
  { key: 'issue.create', module: 'stock', description: 'Create stock issues' },
  { key: 'issue.view', module: 'stock', description: 'View stock issues' },
  { key: 'leads.activities.create', module: 'leads', description: 'Create lead activities' },
  { key: 'leads.activities.view', module: 'leads', description: 'View lead activities' },
  { key: 'leads.assign', module: 'leads', description: 'Assign leads to team members' },
  { key: 'leads.convert', module: 'leads', description: 'Convert leads to projects' },
  { key: 'leads.create', module: 'leads', description: 'Create new leads' },
  { key: 'leads.delete', module: 'leads', description: 'Delete leads' },
  { key: 'leads.edit', module: 'leads', description: 'Edit leads' },
  { key: 'leads.edit_own', module: 'leads', description: 'Edit only own assigned leads' },
  { key: 'leads.export', module: 'leads', description: 'Export leads data' },
  { key: 'leads.import', module: 'leads', description: 'Import leads data' },
  { key: 'leads.notes.create', module: 'leads', description: 'Create lead notes' },
  { key: 'leads.notes.view', module: 'leads', description: 'View lead notes' },
  { key: 'leads.reassign', module: 'leads', description: 'Reassign leads between team members' },
  { key: 'leads.reports', module: 'leads', description: 'View sales reports' },
  { key: 'leads.stage_change', module: 'leads', description: 'Change lead stages' },
  { key: 'leads.view', module: 'leads', description: 'View leads' },
  { key: 'leads.view_own', module: 'leads', description: 'View only own assigned leads' },
  { key: 'leads.view_team', module: 'leads', description: 'View team leads' },
  { key: 'library.create', module: 'library', description: 'Create library items' },
  { key: 'library.delete', module: 'library', description: 'Delete library items' },
  { key: 'library.edit', module: 'library', description: 'Edit library items' },
  { key: 'library.pricing.edit', module: 'library', description: 'Edit pricing in library' },
  { key: 'library.pricing.view', module: 'library', description: 'View pricing in library' },
  { key: 'library.update', module: 'library', description: 'Update library items' },
  { key: 'library.upload', module: 'library', description: 'Upload to library' },
  { key: 'library.view', module: 'library', description: 'View library items' },
  { key: 'materials.adjust', module: 'stock', description: 'Adjust stock quantities' },
  { key: 'materials.create', module: 'stock', description: 'Add new materials' },
  { key: 'materials.delete', module: 'stock', description: 'Delete materials' },
  { key: 'materials.edit', module: 'stock', description: 'Edit materials' },
  { key: 'materials.view', module: 'stock', description: 'View material catalog' },
  { key: 'mr.create', module: 'stock', description: 'Create material requirements' },
  { key: 'mr.delete', module: 'stock', description: 'Delete material requirements' },
  { key: 'mr.edit', module: 'stock', description: 'Edit material requirements' },
  { key: 'mr.view', module: 'stock', description: 'View material requirements' },
  { key: 'ownership.transfer', module: 'ownership', description: 'Transfer company ownership' },
  { key: 'po.approve', module: 'stock', description: 'Approve purchase orders' },
  { key: 'po.create', module: 'stock', description: 'Create purchase orders' },
  { key: 'po.delete', module: 'stock', description: 'Delete purchase orders' },
  { key: 'po.edit', module: 'stock', description: 'Edit purchase orders' },
  { key: 'po.receive', module: 'stock', description: 'Receive goods (GRN)' },
  { key: 'po.send', module: 'stock', description: 'Send PO to vendor' },
  { key: 'po.view', module: 'stock', description: 'View purchase orders' },
  { key: 'procurement.approve', module: 'procurement', description: 'Approve purchase orders' },
  { key: 'procurement.approve_high_value', module: 'procurement', description: 'Approve high-value purchase orders' },
  { key: 'procurement.create', module: 'procurement', description: 'Create purchase orders' },
  { key: 'procurement.delete', module: 'procurement', description: 'Delete purchase orders' },
  { key: 'procurement.edit', module: 'procurement', description: 'Edit purchase orders' },
  { key: 'procurement.receive', module: 'procurement', description: 'Receive goods against PO' },
  { key: 'procurement.reports', module: 'procurement', description: 'View procurement reports' },
  { key: 'procurement.update', module: 'stock', description: 'Update purchase orders' },
  { key: 'procurement.vendors.manage', module: 'procurement', description: 'Manage vendors' },
  { key: 'procurement.vendors.view', module: 'procurement', description: 'View vendors' },
  { key: 'procurement.view', module: 'procurement', description: 'View purchase orders' },
  { key: 'projects.archive', module: 'projects', description: 'Archive projects' },
  { key: 'projects.assign', module: 'projects', description: 'Assign team members to projects' },
  { key: 'projects.create', module: 'projects', description: 'Create new projects' },
  { key: 'projects.delete', module: 'projects', description: 'Delete projects' },
  { key: 'projects.edit', module: 'projects', description: 'Edit projects' },
  { key: 'projects.edit_own', module: 'projects', description: 'Edit only assigned projects' },
  { key: 'projects.export', module: 'projects', description: 'Export projects data' },
  { key: 'projects.milestones.manage', module: 'projects', description: 'Manage project milestones' },
  { key: 'projects.reports', module: 'projects', description: 'View project reports' },
  { key: 'projects.status_change', module: 'projects', description: 'Change project status' },
  { key: 'projects.timeline.edit', module: 'projects', description: 'Edit project timeline' },
  { key: 'projects.timeline.view', module: 'projects', description: 'View project timeline' },
  { key: 'projects.update', module: 'projects', description: 'Update project details' },
  { key: 'projects.view', module: 'projects', description: 'View all projects' },
  { key: 'projects.view_all', module: 'projects', description: 'View all projects (not just assigned)' },
  { key: 'projects.view_own', module: 'projects', description: 'View only assigned projects' },
  { key: 'projects.view_team', module: 'projects', description: 'View team projects' },
  { key: 'quotations.approve', module: 'quotations', description: 'Approve quotations' },
  { key: 'quotations.create', module: 'quotations', description: 'Create new quotations' },
  { key: 'quotations.delete', module: 'quotations', description: 'Delete quotations' },
  { key: 'quotations.discount', module: 'quotations', description: 'Apply discounts to quotations' },
  { key: 'quotations.discount_unlimited', module: 'quotations', description: 'Apply unlimited discounts' },
  { key: 'quotations.edit', module: 'quotations', description: 'Edit quotations' },
  { key: 'quotations.edit_own', module: 'quotations', description: 'Edit only own quotations' },
  { key: 'quotations.export', module: 'quotations', description: 'Export quotations' },
  { key: 'quotations.revise', module: 'quotations', description: 'Create quotation revisions' },
  { key: 'quotations.send', module: 'quotations', description: 'Send quotations to clients' },
  { key: 'quotations.templates.create', module: 'quotations', description: 'Create quotation templates' },
  { key: 'quotations.templates.delete', module: 'quotations', description: 'Delete quotation templates' },
  { key: 'quotations.templates.manage', module: 'quotations', description: 'Manage quotation templates' },
  { key: 'quotations.templates.update', module: 'quotations', description: 'Update quotation templates' },
  { key: 'quotations.templates.view', module: 'quotations', description: 'View quotation templates' },
  { key: 'quotations.update', module: 'quotations', description: 'Update quotations' },
  { key: 'quotations.view', module: 'quotations', description: 'View all quotations' },
  { key: 'quotations.view_own', module: 'quotations', description: 'View only own quotations' },
  { key: 'reports.create', module: 'reports', description: 'Create custom reports' },
  { key: 'reports.custom', module: 'reports', description: 'Create custom reports' },
  { key: 'reports.export', module: 'reports', description: 'Export reports' },
  { key: 'reports.finance', module: 'reports', description: 'View finance reports' },
  { key: 'reports.inventory', module: 'reports', description: 'View inventory reports' },
  { key: 'reports.projects', module: 'reports', description: 'View project reports' },
  { key: 'reports.sales', module: 'reports', description: 'View sales reports' },
  { key: 'reports.team', module: 'reports', description: 'View team performance reports' },
  { key: 'reports.view', module: 'reports', description: 'View reports' },
  { key: 'sales.assign', module: 'sales', description: 'Assign leads to team members' },
  { key: 'sales.convert', module: 'sales', description: 'Convert lead to project' },
  { key: 'sales.convert_to_won', module: 'sales', description: 'Move leads to Won status (create project)' },
  { key: 'sales.create', module: 'sales', description: 'Create leads and contacts' },
  { key: 'sales.delete', module: 'sales', description: 'Delete leads and contacts' },
  { key: 'sales.leads.approve_won', module: 'sales', description: 'Approve won leads' },
  { key: 'sales.leads.assign', module: 'sales', description: 'Assign leads to others' },
  { key: 'sales.leads.create', module: 'sales', description: 'Create new leads' },
  { key: 'sales.leads.delete', module: 'sales', description: 'Delete leads' },
  { key: 'sales.leads.disqualify', module: 'sales', description: 'Disqualify leads' },
  { key: 'sales.leads.edit_all', module: 'sales', description: 'Edit any lead' },
  { key: 'sales.leads.edit_own', module: 'sales', description: 'Edit own leads' },
  { key: 'sales.leads.export', module: 'sales', description: 'Export leads data' },
  { key: 'sales.leads.mark_won', module: 'sales', description: 'Mark leads as won' },
  { key: 'sales.leads.view', module: 'sales', description: 'View leads list' },
  { key: 'sales.leads.view_all', module: 'sales', description: 'View all leads' },
  { key: 'sales.leads.view_own', module: 'sales', description: 'View only own leads' },
  { key: 'sales.reports', module: 'sales', description: 'View sales reports and analytics' },
  { key: 'sales.reports.view', module: 'sales', description: 'View sales reports' },
  { key: 'sales.settings.manage', module: 'sales', description: 'Manage sales settings' },
  { key: 'sales.update', module: 'sales', description: 'Update leads and contacts' },
  { key: 'sales.view', module: 'sales', description: 'View leads, pipeline, and contacts' },
  { key: 'sales.view_all', module: 'sales', description: 'View all sales leads (not just assigned)' },
  { key: 'settings.audit_log.view', module: 'settings', description: 'View audit logs' },
  { key: 'settings.billing', module: 'settings', description: 'Manage billing and subscription' },
  { key: 'settings.billing.manage', module: 'settings', description: 'Manage billing and subscription' },
  { key: 'settings.billing.view', module: 'settings', description: 'View billing information' },
  { key: 'settings.company.edit', module: 'settings', description: 'Edit company settings' },
  { key: 'settings.company.update', module: 'settings', description: 'Update company settings' },
  { key: 'settings.company.view', module: 'settings', description: 'View company settings' },
  { key: 'settings.integrations.manage', module: 'settings', description: 'Manage integrations' },
  { key: 'settings.integrations.view', module: 'settings', description: 'View integrations' },
  { key: 'settings.notifications.manage', module: 'settings', description: 'Manage notification settings' },
  { key: 'settings.profile', module: 'settings', description: 'Manage own profile' },
  { key: 'settings.team.invite', module: 'settings', description: 'Invite new team members' },
  { key: 'settings.team.remove', module: 'settings', description: 'Remove team members' },
  { key: 'settings.team.update', module: 'settings', description: 'Update team member details' },
  { key: 'settings.team.view', module: 'settings', description: 'View team members' },
  { key: 'settings.templates.manage', module: 'settings', description: 'Manage email/document templates' },
  { key: 'settings.view', module: 'settings', description: 'View settings' },
  { key: 'site.assign', module: 'site', description: 'Assign site supervisors' },
  { key: 'site.checkin', module: 'site', description: 'Check in at site' },
  { key: 'site.issues.create', module: 'site', description: 'Report site issues' },
  { key: 'site.issues.resolve', module: 'site', description: 'Resolve site issues' },
  { key: 'site.photos.upload', module: 'site', description: 'Upload site photos' },
  { key: 'site.reports', module: 'site', description: 'View site reports' },
  { key: 'site.schedule.manage', module: 'site', description: 'Manage site schedules' },
  { key: 'site.schedule.view', module: 'site', description: 'View site schedules' },
  { key: 'site.updates.create', module: 'site', description: 'Create site updates' },
  { key: 'site.updates.view', module: 'site', description: 'View site updates' },
  { key: 'site.view', module: 'site', description: 'View site information' },
  { key: 'stock.adjust', module: 'stock', description: 'Adjust stock quantities' },
  { key: 'stock.create', module: 'stock', description: 'Add new inventory items' },
  { key: 'stock.delete', module: 'stock', description: 'Delete inventory items' },
  { key: 'stock.overview', module: 'stock', description: 'View stock overview' },
  { key: 'stock.reports', module: 'stock', description: 'View stock reports' },
  { key: 'stock.settings', module: 'stock', description: 'Manage stock settings' },
  { key: 'stock.transfer', module: 'stock', description: 'Transfer stock between locations' },
  { key: 'stock.update', module: 'stock', description: 'Update inventory details' },
  { key: 'stock.view', module: 'stock', description: 'View inventory and stock levels' },
  { key: 'tasks.assign', module: 'tasks', description: 'Assign tasks to team members' },
  { key: 'tasks.comment', module: 'tasks', description: 'Add comments to tasks' },
  { key: 'tasks.complete', module: 'tasks', description: 'Mark tasks as complete' },
  { key: 'tasks.create', module: 'tasks', description: 'Create tasks' },
  { key: 'tasks.delete', module: 'tasks', description: 'Delete tasks' },
  { key: 'tasks.edit', module: 'tasks', description: 'Edit tasks' },
  { key: 'tasks.edit_all', module: 'tasks', description: 'Edit any task' },
  { key: 'tasks.edit_own', module: 'tasks', description: 'Edit only own tasks' },
  { key: 'tasks.templates.create', module: 'tasks', description: 'Create task templates' },
  { key: 'tasks.templates.delete', module: 'tasks', description: 'Delete task templates' },
  { key: 'tasks.templates.edit', module: 'tasks', description: 'Edit task templates' },
  { key: 'tasks.templates.manage_protected', module: 'tasks', description: 'Manage protected templates' },
  { key: 'tasks.templates.view', module: 'tasks', description: 'View task templates' },
  { key: 'tasks.update', module: 'tasks', description: 'Update tasks' },
  { key: 'tasks.view', module: 'tasks', description: 'View all tasks' },
  { key: 'tasks.view_all', module: 'tasks', description: 'View all tasks (not just assigned)' },
  { key: 'tasks.view_own', module: 'tasks', description: 'View only own tasks' },
  { key: 'tasks.view_team', module: 'tasks', description: 'View team tasks' },
  { key: 'team.deactivate', module: 'team', description: 'Deactivate team members' },
  { key: 'team.edit', module: 'team', description: 'Edit team member details' },
  { key: 'team.invite', module: 'team', description: 'Invite team members' },
  { key: 'team.permissions.manage', module: 'team', description: 'Manage custom permissions' },
  { key: 'team.permissions.view', module: 'team', description: 'View permissions' },
  { key: 'team.roles.assign', module: 'team', description: 'Assign roles to team members' },
  { key: 'team.view', module: 'team', description: 'View team members' },
  { key: 'team.view_limited', module: 'team', description: 'View limited team info' },
  { key: 'vendors.create', module: 'stock', description: 'Create new vendors' },
  { key: 'vendors.delete', module: 'stock', description: 'Delete vendors' },
  { key: 'vendors.edit', module: 'stock', description: 'Edit vendors' },
  { key: 'vendors.update', module: 'stock', description: 'Update vendor details' },
  { key: 'vendors.view', module: 'stock', description: 'View vendors list' },
];

export const PERMISSIONS_BY_MODULE: Record<
  PermissionModule,
  readonly PermissionDefinition[]
> = PERMISSION_CATALOGUE.reduce(
  (acc, permission) => {
    (acc[permission.module] ||= []).push(permission);
    return acc;
  },
  {} as Record<PermissionModule, PermissionDefinition[]>
);

/** Runtime membership test, for values that only exist as strings. */
const PERMISSION_KEY_SET: ReadonlySet<string> = new Set(
  PERMISSION_CATALOGUE.map((p) => p.key)
);

export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_KEY_SET.has(value);
}

// =====================================================
// ROLES
// =====================================================

export type RoleSlug =
  | 'admin'
  | 'design'
  | 'design_manager'
  | 'designer'
  | 'finance'
  | 'finance_manager'
  | 'limited'
  | 'manager'
  | 'owner'
  | 'procurement'
  | 'procurement_manager'
  | 'project'
  | 'project_manager'
  | 'sales'
  | 'sales_manager'
  | 'senior-designer'
  | 'site_supervisor'
  | 'site_supervisor_manager'
  | 'staff'
  | 'stock'
  | 'stock_manager';

export const ROLE_NAMES: Record<RoleSlug, string> = {
  'admin': 'Admin',
  'design': 'Design',
  'design_manager': 'Design Manager',
  'designer': 'Designer',
  'finance': 'Finance',
  'finance_manager': 'Finance Manager',
  'limited': 'Limited',
  'manager': 'Manager',
  'owner': 'Owner',
  'procurement': 'Procurement',
  'procurement_manager': 'Procurement Manager',
  'project': 'Project',
  'project_manager': 'Project Manager',
  'sales': 'Sales',
  'sales_manager': 'Sales Manager',
  'senior-designer': 'Senior Designer',
  'site_supervisor': 'Site Supervisor',
  'site_supervisor_manager': 'Site Supervisor Manager',
  'staff': 'Staff',
  'stock': 'Stock',
  'stock_manager': 'Stock Manager',
};

export const ROLE_DESCRIPTIONS: Record<RoleSlug, string | null> = {
  'admin': 'Administrative access. Can manage users, settings, and most operations.',
  'design': 'Design team member. Can create and manage design files for assigned projects.',
  'design_manager': 'Manages the design team. Full access to design files, projects, and team assignments.',
  'designer': 'Designer who works on assigned projects, creates designs, and collaborates with the team.',
  'finance': 'Finance department. Can view all projects/sales for context, but only manage financial records.',
  'finance_manager': 'Manages finance. Full access to invoices, payments, expenses, and financial reports.',
  'limited': 'Restricted access. View-only permissions or specific module access.',
  'manager': 'Manage projects, teams, and day-to-day operations. Read-only access to settings.',
  'owner': 'Full system access. Can manage all aspects of the organization.',
  'procurement': 'Procurement specialist who manages vendors, purchase orders, and stock.',
  'procurement_manager': 'Manages procurement. Full access to purchase orders, vendors, and approvals.',
  'project': 'Project team member. Can view and update assigned project details.',
  'project_manager': 'Manages projects. Full access to project details, timelines, and team assignments.',
  'sales': 'Sales representative who manages leads, clients, and creates initial proposals.',
  'sales_manager': 'Manages the sales team. Full access to leads, quotations, and sales reports.',
  'senior-designer': 'Senior designer who can manage projects, mentor juniors, and approve quotations.',
  'site_supervisor': 'Site supervisor. Can check in, report updates, and manage on-site activities.',
  'site_supervisor_manager': 'Manages site supervisors. Full access to site operations and team assignments.',
  'staff': 'Regular staff access. Can work on assigned projects and tasks.',
  'stock': 'Stock team member. Can view inventory and perform basic stock operations.',
  'stock_manager': 'Manages inventory and stock. Full access to inventory, adjustments, and transfers.',
};
