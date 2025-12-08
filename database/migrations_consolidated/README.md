# SoftInterio Database Migrations (Consolidated)

## Overview

This folder contains consolidated SQL migration files for the SoftInterio ERP system. The original 20+ migration files have been merged into 8 module-wise files for better organization and maintainability.

## Migration Files

Run these files **in order** against your Supabase PostgreSQL database:

| Order | File                             | Description                                                                   |
| ----- | -------------------------------- | ----------------------------------------------------------------------------- |
| 1     | `01_core_schema.sql`             | Core infrastructure: tenants, users, roles, permissions, sessions, audit logs |
| 2     | `02_core_rls_policies.sql`       | Row Level Security policies for all core tables                               |
| 3     | `03_subscription_module.sql`     | Billing & subscription management, plans, usage tracking                      |
| 4     | `04_sales_module.sql`            | CRM/Lead management, notifications, handover workflows                        |
| 5     | `05_quotation_module.sql`        | Quotation system with 4-level hierarchy, templates, line items                |
| 6     | `06_tasks_module.sql`            | Task management with templates, comments, attachments                         |
| 7     | `07_seed_data.sql`               | Initial data: roles, permissions, subscription plans, master data             |
| 8     | `08_helper_scripts.sql`          | Utility scripts (run as needed, not during migration)                         |
| 9     | `09_stock_management_module.sql` | Stock/Inventory, Vendors, PO, GRN, Material Requirements                      |

## Execution Order

```bash
# Run via Supabase SQL Editor or psql in this order:
1. 01_core_schema.sql
2. 02_core_rls_policies.sql
3. 03_subscription_module.sql
4. 04_sales_module.sql
5. 05_quotation_module.sql
6. 06_tasks_module.sql
7. 07_seed_data.sql
# 08_helper_scripts.sql - Run specific scripts as needed
```

## Module Summary

### Core Module (01-02)

- **Tenants**: Multi-tenant company accounts
- **Users**: User accounts linked to auth.users
- **Roles**: System and custom roles with hierarchy
- **Permissions**: Fine-grained access control
- **Sessions & Tokens**: Auth management
- **Audit Logs**: Activity tracking

### Subscription Module (03)

- Subscription plans with pricing
- Tenant subscriptions with trial support
- Usage tracking and limits
- Payment methods and invoices

### Sales Module (04)

- Lead management with stages
- Lead activities and notes
- Notifications system
- Lead handover workflows
- CRM permissions

### Quotation Module (05)

- 4-level hierarchy: Space > Component > Material > Cost Attribute
- V2 simplified: Space > Component > Line Item
- Templates for reusable configurations
- Auto-calculation triggers
- Quotation snapshots and versioning

### Tasks Module (06)

- Hierarchical tasks with subtasks
- Task templates with protected categories
- Comments and attachments
- Tags and time tracking
- Activity logging

### Stock Management Module (09)

- **Connection to Quotations**: Uses `cost_items` as material master (is_stockable flag)
- **Vendors**: Supplier directory with pricing
- **Stock Locations**: Warehouse, Factory, Site tracking
- **Material Requirements**: What's needed per project
- **Purchase Orders**: Full PO workflow with approval
- **Goods Receipts**: GRN with auto stock update
- **Stock Issues**: Issue materials to projects
- **Stock Movements**: Complete audit trail
- **Adjustments**: Physical count reconciliation

## Key Functions

| Function                                | Purpose                         |
| --------------------------------------- | ------------------------------- |
| `get_user_tenant_id()`                  | Get current user's tenant ID    |
| `has_permission(key)`                   | Check if user has permission    |
| `is_admin_or_higher()`                  | Check admin access              |
| `generate_lead_number(tenant_id)`       | Auto-generate lead numbers      |
| `generate_quotation_number(tenant_id)`  | Auto-generate quotation numbers |
| `generate_task_number(tenant_id)`       | Auto-generate task numbers      |
| `create_quotation_for_lead(lead_id)`    | Auto-create quotation from lead |
| `duplicate_quotation(id, user_id)`      | Clone quotation with all data   |
| `create_tasks_from_template(...)`       | Bulk create tasks from template |
| `seed_quotation_master_data(tenant_id)` | Seed quotation master data      |

## RLS (Row Level Security)

All tables have RLS enabled with tenant isolation:

- Users can only access data within their tenant
- Policies use `get_user_tenant_id()` for isolation
- Child tables inherit access through parent joins

## Notes

1. **Prerequisites**: Requires Supabase project with auth enabled
2. **Extensions**: Uses `uuid-ossp` for UUID generation
3. **Enums**: Various enums for status types (lead_stage_enum, task_status, etc.)
4. **Triggers**: Auto-update timestamps, auto-generate numbers, cascade calculations

## Original Files Reference

The original migration files (001-020) are preserved in the parent `migrations/` folder for reference. This consolidated structure replaces them for new deployments.
