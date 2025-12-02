# Database Migrations

This directory contains SQL migration files for the SoftInterio ERP system.

## ⚠️ IMPORTANT: Migration Order

Run migrations in this exact order in Supabase SQL Editor:

1. `001_schema.sql` - Database schema (tables, indexes, triggers, functions)
2. `002_rls_policies.sql` - Row Level Security policies
3. `003_seed_data.sql` - Initial data (roles, permissions, subscription plans)

**Note:** `004_helper_scripts.sql` contains utility scripts that are run only when needed.

---

## Migration Files

### 001_schema.sql

Complete database schema including:

- **23 Tables**: tenants, users, roles, permissions, subscriptions, billing, etc.
- **Indexes**: Optimized for common queries
- **Triggers**: Auto-update timestamps, user count tracking, invoice numbering
- **Functions**: Permission checks, usage tracking, tenant utilities

### 002_rls_policies.sql

Row Level Security policies for all tables:

- Tenant isolation (users can only see their own tenant's data)
- Role-based access control
- Owner/Admin special privileges
- Public access for subscription plans

### 003_seed_data.sql

Initial data for the system:

**10 System Roles** (hierarchy level in parentheses):

- Owner (0) - Supreme authority, billing, ownership transfer
- Admin (1) - Full access except billing/ownership
- Manager (2) - Operational focus, team management
- Senior Designer (2) - Project management, quotation approval
- Finance (2) - Read-all, write-finance only
- Staff (3) - Day-to-day work (default for invites)
- Designer (3) - Design focus, library access
- Sales (3) - Full CRM access
- Procurement (3) - Stock/vendor management
- Limited (4) - View-only access

**70+ Permissions** across modules:

- Dashboard, Sales, Projects, Quotations
- Stock & Procurement, Finance
- Tasks, Calendar, Documents, Library
- Reports, Settings, Ownership

**3 Subscription Plans**:

- Classic (₹10,000/month) - Solo designers
- Signature (₹20,000/month) - Teams, featured
- Masterpiece (₹50,000/month) - Enterprise

### 004_helper_scripts.sql

Utility scripts (run manually when needed):

- Assign owner role to a user
- Fix users with wrong status
- Initialize usage for existing tenants
- Debug queries for roles and permissions
- Reset subscription to trial

---

## 🚀 Quick Start with Supabase

### Step 1: Set Up Supabase Project

1. Go to https://app.supabase.com
2. Create a new project (or use existing)
3. Wait for database to be provisioned

### Step 2: Get Your Credentials

1. Go to **Settings** → **API**
2. Copy to your `.env.local`:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

### Step 3: Run Migrations

1. Open Supabase Dashboard → **SQL Editor**
2. Run each migration in order:

```
001_schema.sql        → Create tables and functions
002_rls_policies.sql  → Create RLS policies
003_seed_data.sql     → Seed roles, permissions, plans
```

### Step 4: Verify Installation

```sql
-- Check tables
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public';
-- Expected: 23+

-- Check roles
SELECT name, hierarchy_level FROM roles
WHERE tenant_id IS NULL
ORDER BY hierarchy_level;
-- Expected: 10 roles

-- Check permissions
SELECT module, COUNT(*) as count
FROM permissions
GROUP BY module
ORDER BY module;
-- Expected: 70+ permissions across 13 modules

-- Check subscription plans
SELECT name, price_monthly, max_users
FROM subscription_plans
WHERE tenant_type = 'interiors';
-- Expected: 3 plans
```

---

## Database Schema Overview

### Core Tables

| Table              | Description                             |
| ------------------ | --------------------------------------- |
| `tenants`          | Multi-tenant companies                  |
| `users`            | User accounts (linked to Supabase Auth) |
| `roles`            | Role definitions (system and custom)    |
| `permissions`      | Granular permission definitions         |
| `role_permissions` | Role-to-permission assignments          |
| `user_roles`       | User-to-role assignments                |

### Authentication

| Table                       | Description                  |
| --------------------------- | ---------------------------- |
| `user_sessions`             | Active user sessions         |
| `password_reset_tokens`     | Password reset functionality |
| `email_verification_tokens` | Email verification           |
| `user_invitations`          | User invitation workflow     |
| `ownership_transfers`       | Company ownership transfer   |

### Subscription & Billing

| Table                          | Description           |
| ------------------------------ | --------------------- |
| `subscription_plans`           | Available plans       |
| `subscription_plan_features`   | Features per plan     |
| `tenant_subscriptions`         | Active subscriptions  |
| `subscription_addons`          | Additional features   |
| `subscription_invoices`        | Invoice history       |
| `tenant_payment_methods`       | Saved payment methods |
| `subscription_change_requests` | Plan change audit     |

### Usage & Settings

| Table                  | Description                 |
| ---------------------- | --------------------------- |
| `tenant_usage`         | Current usage metrics       |
| `tenant_usage_history` | Historical usage snapshots  |
| `tenant_settings`      | Tenant preferences          |
| `activity_logs`        | User activity tracking      |
| `audit_logs`           | Critical operation auditing |

---

## Key Functions

| Function                           | Description                   |
| ---------------------------------- | ----------------------------- |
| `get_user_tenant_id()`             | Get current user's tenant ID  |
| `is_owner()`                       | Check if user is owner        |
| `is_admin_or_higher()`             | Check admin+ access           |
| `has_permission(key)`              | Check specific permission     |
| `get_user_permissions()`           | Get all user permissions      |
| `get_user_hierarchy_level()`       | Get user's highest role level |
| `update_tenant_usage(id)`          | Recalculate tenant usage      |
| `get_tenant_usage_with_limits(id)` | Get usage with plan limits    |

---

## Permission Modules

| Module       | Permissions                                             | Controls             |
| ------------ | ------------------------------------------------------- | -------------------- |
| `dashboard`  | view                                                    | Dashboard visibility |
| `sales`      | view, create, update, delete, convert, assign           | CRM features         |
| `projects`   | view, view_all, create, update, delete, archive, assign | Projects             |
| `quotations` | view, create, update, delete, approve, send             | Quotations           |
| `stock`      | view, create, update, delete, adjust                    | Inventory            |
| `finance`    | view, create, update, delete, approve, export           | Finance              |
| `tasks`      | view, view_all, create, update, delete, assign          | Tasks                |
| `calendar`   | view, create, update, delete                            | Calendar             |
| `documents`  | view, upload, update, delete, share                     | Documents            |
| `library`    | view, upload, update, delete                            | Resource library     |
| `reports`    | view, create, export                                    | Reports              |
| `settings`   | profile, company._, team._, roles.\*, billing, etc.     | Settings             |
| `ownership`  | transfer                                                | Ownership transfer   |

---

## Default Roles & Permissions

### Owner (Level 0) ⭐

- First user who creates the company/tenant
- **Supreme authority** - full access to everything
- Can manage billing and subscription
- Can transfer ownership to another user
- Cannot be removed or demoted

### Admin (Level 1)

- Can manage users and roles
- Can manage most tenant settings
- **Cannot** manage billing (Owner only)
- **Cannot** modify or remove Owner
- **Cannot** transfer ownership

### Manager (Level 2)

- Manage projects, quotations, tasks
- View and manage clients
- Can invite and manage staff
- View reports and finance
- Cannot manage roles or settings

### Staff (Level 3) - Default for Invites

- Day-to-day work access
- View/update assigned projects
- Create quotations and tasks
- View clients and calendar
- Cannot manage team or settings

### Limited (Level 4)

- View-only access to basic features
- Dashboard, projects, calendar, tasks
- No create/update/delete permissions
- For external collaborators or reviewers

---

## Subscription Plans (Interiors Type)

### Classic (₹10,000/month or ₹1,20,000/year)

- 5 users, 50 projects
- 25 GB storage
- Project & client management
- Basic reporting
- Email support

### Signature (₹20,000/month or ₹2,40,000/year) ⭐ Featured

- 15 users, 200 projects
- 100 GB storage
- Advanced team management
- Financial reporting
- Vendor management
- Custom dashboards
- Priority support

### Masterpiece (₹50,000/month or ₹6,00,000/year)

- Unlimited users and projects
- 500 GB storage
- Staff management
- Sales & marketing tools
- Advanced analytics
- White-label options
- Dedicated account manager

---

## Notes

1. All tables use UUIDs as primary keys for better scalability
2. Timestamps use `TIMESTAMP WITH TIME ZONE` for proper timezone handling
3. Automatic `updated_at` triggers are configured
4. Proper indexes are created for query performance
5. Foreign keys use appropriate `ON DELETE` actions
6. Unique constraints prevent duplicate data
7. Enums provide type safety at database level
8. RLS ensures tenant data isolation
