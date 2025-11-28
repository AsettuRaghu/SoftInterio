# Database Migrations

This directory contains SQL migration files for the SoftInterio ERP system.

## ⚠️ IMPORTANT: Migration Order

Run migrations in this exact order in Supabase SQL Editor:

1. `001_create_core_tables_supabase.sql` - Core tables with RLS
2. `003_seed_subscription_plans.sql` - Subscription plans (run BEFORE 002)
3. `004_rbac_enhancements.sql` - RBAC with all permissions ⭐ NEW

**Note:** Migration `002_seed_initial_data.sql` is now **DEPRECATED** - use `004_rbac_enhancements.sql` instead, which includes updated roles and comprehensive permissions.

---

## Migration Files

### 001_create_core_tables_supabase.sql ⭐ (Use this for Supabase)

**Supabase-optimized version** with Row Level Security (RLS) policies and auth integration.

Creates the foundational database structure including:

- Tenants and multi-tenant architecture
- Users (integrated with Supabase Auth)
- Roles and permissions system (base tables)
- Subscription management
- Activity and audit logging
- **RLS policies for data isolation**
- **Helper functions for permissions**

### 001_create_core_tables.sql (Generic PostgreSQL)

Standard PostgreSQL version without Supabase-specific features. Use this if running on your own PostgreSQL instance.

### 002_seed_initial_data.sql ⚠️ DEPRECATED

**DO NOT USE** - This is superseded by `004_rbac_enhancements.sql`.

### 003_seed_subscription_plans.sql

Seeds subscription plans for interior design companies:

- Classic Plan (₹10,000/month)
- Signature Plan (₹20,000/month) - Featured
- Masterpiece Plan (₹50,000/month)

### 004_rbac_enhancements.sql ⭐ NEW

Enhanced RBAC system with:

- **Ownership Transfers Table** - For transferring company ownership
- **Updated System Roles** with correct hierarchy:
  - Owner (Level 0) - Supreme authority, can transfer ownership
  - Admin (Level 1) - Full management except billing/ownership
  - Manager (Level 2) - Operations and project management
  - Staff (Level 3) - Day-to-day work (Default for invites)
  - Limited (Level 4) - View-only/restricted access
- **Comprehensive Permissions** for all modules:
  - Dashboard, Projects, Clients, Quotations
  - Inventory, Calendar, Tasks, Finance
  - Reports, Team, Roles, Settings, Ownership
- **Helper Functions**:
  - `is_owner()` - Check if user is owner
  - `is_admin_or_higher()` - Check admin+ access
  - `get_user_hierarchy_level()` - Get user's highest role level
  - `get_user_permissions()` - Get all user permissions
  - `has_permission(key)` - Check specific permission

## 🚀 Quick Start with Supabase

### Step 1: Set Up Supabase Project

1. Go to https://app.supabase.com
2. Create a new project (or use existing)
3. Wait for database to be provisioned

### Step 2: Get Your Credentials

1. Go to **Settings** → **API**
2. Copy the following to your `.env.local` file:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

### Step 3: Run Migrations in Supabase

1. Open your Supabase project
2. Go to **SQL Editor** (left sidebar)
3. Run migrations in this order:

**Migration 1: Core Tables**

```
Copy contents of 001_create_core_tables_supabase.sql → Run
```

**Migration 2: Subscription Plans**

```
Copy contents of 003_seed_subscription_plans.sql → Run
```

**Migration 3: RBAC Enhancements**

```
Copy contents of 004_rbac_enhancements.sql → Run
```

### Step 4: Verify Installation

Run this query in SQL Editor to verify:

```sql
-- Check tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check roles were seeded (NEW hierarchy)
SELECT name, slug, hierarchy_level, is_default FROM roles WHERE tenant_id IS NULL ORDER BY hierarchy_level;

-- Check permissions were seeded (ALL modules)
SELECT module, COUNT(*) as permission_count
FROM permissions
GROUP BY module
ORDER BY module;

-- Check ownership_transfers table exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ownership_transfers';
```

You should see:

- 16+ tables created (including `ownership_transfers`)
- 5 roles: Owner(0), Admin(1), Manager(2), Staff(3), Limited(4)
- 47 permissions across 13 modules

## Running Migrations (Alternative Methods)

### Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push

## Database Schema Overview

### Core Tables

- `tenants` - Multi-tenant companies (Interior, Architect, Client, Vendor, Factory)
- `users` - User accounts with tenant association
- `roles` - Role definitions (system and custom)
- `permissions` - Granular permission definitions
- `user_roles` - User-to-role assignments

### Authentication

- `user_sessions` - Active user sessions
- `password_reset_tokens` - Password reset functionality
- `email_verification_tokens` - Email verification
- `user_invitations` - User invitation workflow

### Subscription

- `subscription_plans` - Available subscription plans
- `subscription_plan_features` - Features included in plans
- `tenant_subscriptions` - Active tenant subscriptions
- `subscription_addons` - Additional purchased features

### Configuration

- `tenant_settings` - Tenant-specific settings
- `activity_logs` - User activity tracking
- `audit_logs` - Critical operation auditing

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

## Permission Modules

The RBAC system includes permissions for the following modules:

| Module | Permissions | Controls |
|--------|-------------|----------|
| `dashboard` | view | Dashboard visibility |
| `projects` | view, create, update, delete, archive | Projects menu & features |
| `clients` | view, create, update, delete | Clients menu & features |
| `quotations` | view, create, update, delete, approve, send | Quotations menu & features |
| `inventory` | view, create, update, delete, adjust | Inventory menu & features |
| `calendar` | view, create, update, delete | Calendar menu & features |
| `tasks` | view, create, update, delete, assign | Tasks menu & features |
| `finance` | view, create, update, delete, export | Finance menu & features |
| `reports` | view, create, export | Reports menu & features |
| `team` | view, invite, update, remove, roles | Team management in settings |
| `roles` | view, create, update, delete | Roles management in settings |
| `settings` | view, update, billing, integrations | Settings menu & features |
| `ownership` | transfer | Ownership transfer (Owner only) |

## Notes

1. All tables use UUIDs as primary keys for better scalability
2. Timestamps use `TIMESTAMP WITH TIME ZONE` for proper timezone handling
3. Automatic `updated_at` triggers are configured
4. Proper indexes are created for query performance
5. Foreign keys use appropriate `ON DELETE` actions
6. Unique constraints prevent duplicate data
7. Enums provide type safety at database level

## Next Steps

After running migrations:

1. ✅ Set up Supabase connection (done)
2. ✅ Configure environment variables (done)
3. ✅ Build API endpoints for authentication (done)
4. 🔄 Implement role-based access control (use `has_permission()`)
5. 🔄 Set up subscription management logic
6. 🔄 Build Settings UI for team/role management
```
