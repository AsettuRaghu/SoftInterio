# SoftInterio - Interior Design ERP System

## Complete Project Documentation

---

## 1. Project Overview

**SoftInterio** is a modern, multi-tenant ERP system built specifically for interior design companies using:

- **Frontend**: Next.js 16 with TypeScript
- **Styling**: Tailwind CSS v4
- **Backend**: Supabase PostgreSQL with Row Level Security (RLS)
- **Architecture**: Modular design with tenant isolation

---

## 2. Database Architecture

### 2.1 Multi-Tenant Design

- Every table has a `tenant_id` column for isolation
- Users belong to a single tenant
- RLS policies enforce tenant boundaries at the database level
- No tenant data leaks possible - database enforces separation

### 2.2 Active Tables with RLS Enabled (31 tables)

#### Stock Management (6)

- `stock_vendors` - Vendor master data
- `stock_brands` - Brand master data
- `stock_vendor_brands` - Vendor-brand relationships
- `stock_purchase_orders` - Purchase orders
- `stock_purchase_order_items` - PO line items (uses `po_id` column)
- `stock_goods_receipts` - Goods received notes

#### Sales & Leads (5)

- `clients` - Client master data
- `properties` - Property/site information
- `leads` - Sales leads
- `lead_notes` - Notes on leads
- `lead_activities` - Activity log for leads

#### Quotations (8)

- `quotations` - Main quotation document
- `quotation_spaces` - Spaces within quotation
- `quotation_components` - Components in spaces
- `quotation_activities` - Activity log
- `quotation_templates` - Quotation templates
- `template_spaces` - Template space definitions
- `quotation_template_line_items` - Template line items
- `quotation_line_items` - Actual line items

#### Projects (3)

- `projects` - Project master
- `project_activities` - Activity log
- `project_phase_activity_log` - Phase tracking

#### Tasks (4)

- `tasks` - Task items
- `task_activities` - Activity log
- `task_tag_assignments` - Task tags
- `task_template_items` - Task templates

#### Calendar (1)

- `calendar_events` - Calendar events

#### Users (1)

- `users` - User profiles (with RLS)

#### Reference Tables (non-tenant, no RLS)

- `units` - System-wide measurement units (sqft, rft, nos)

### 2.3 Empty/Unused Tables (Safe to drop)

- `component_templates` - Future feature (no dependencies)
- `lead_won_requests` - Unused
- `material_presets` - Unused
- `quotation_changes` - Future audit log (no dependencies)
- `quotation_snapshots` - Future versioning (no dependencies)
- `space_templates` - Unused (no dependencies)

### 2.4 Tables with Dependencies (Keep these)

- `materials` - Referenced by `quotation_materials`
- `material_categories` - Referenced by `materials` and `quotation_materials`
- `quotation_materials` - Has FKs to above tables (unused in app code)

---

## 3. Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── api/                     # API routes for backend logic
│   │   ├── auth/               # Authentication endpoints
│   │   ├── stock/              # Stock management endpoints
│   │   ├── quotations/         # Quotation management
│   │   ├── projects/           # Project management
│   │   ├── tasks/              # Task management
│   │   ├── sales/leads/        # Sales & leads
│   │   └── team/               # Team management
│   └── dashboard/              # Main dashboard pages
│
├── modules/                     # Business logic modules
│   ├── auth/                   # Authentication module
│   └── dashboard/              # Dashboard module
│
├── components/                 # Reusable components
│   ├── ui/                    # Base UI components
│   ├── layout/                # Layout components
│   ├── stock/                 # Stock management components
│   ├── quotations/            # Quotation components
│   ├── projects/              # Project components
│   └── tasks/                 # Task components
│
├── hooks/                      # Custom React hooks
│   ├── useCurrentUser.ts
│   ├── useUserPermissions.ts
│   ├── useFormValidation.ts
│   └── useSubscriptionStatus.ts
│
├── lib/                        # Utility libraries
│   ├── auth/                  # Auth utilities
│   ├── supabase/              # Supabase client setup
│   ├── email/                 # Email utilities
│   ├── logger/                # Logging utilities
│   └── errors/                # Error handling
│
├── types/                      # TypeScript type definitions
│   ├── database.types.ts      # Auto-generated from Supabase
│   ├── quotations.ts
│   ├── projects.ts
│   ├── stock.ts
│   └── other domain types
│
└── utils/                      # Utility functions
    └── cn.ts                  # Class name utilities
```

---

## 4. Key Features

### Stock Management

- Purchase order creation and tracking
- Vendor & brand management
- Goods receipt management
- Purchase order items with material tracking

### Sales & Leads

- Lead creation and management
- Property/site information tracking
- Lead notes and activity history
- Client master data

### Quotations

- Create quotations from templates or scratch
- Add spaces and components to quotations
- Generate PDF quotations
- Version control (snapshots planned)
- Audit trail (quotation_changes planned)

### Projects

- Project creation and tracking
- Project phases
- Activity logging
- Integration with quotations

### Tasks

- Task creation and assignment
- Task templating
- Activity logging
- Tag-based organization

### Team Management

- User invitations
- Role-based access control
- Tenant membership

---

## 5. RLS (Row Level Security) Implementation

### 5.1 RLS Status

✅ **31 tables have RLS enabled** (migrations 054 & 055)

### 5.2 RLS Formula

```sql
-- All policies follow this pattern:
EXISTS (
  SELECT 1 FROM public.users
  WHERE users.id = auth.uid()
  AND users.tenant_id = table_name.tenant_id
)
```

This ensures:

- Users can only see data from their tenant
- Database enforces isolation, not application code
- No SQL injection can break tenant boundaries

### 5.3 Performance Optimization

- 24 indexes on `tenant_id` and foreign key columns
- Fast RLS policy evaluation
- Efficient tenant filtering

### 5.4 Applied Migrations

- **Migration 054**: 27 tables with RLS + 24 indexes
- **Migration 055**: 4 tenant reference tables with RLS

---

## 6. Authentication & Authorization

### Auth Flow

1. User logs in with email/password
2. Supabase Auth creates JWT token
3. JWT contains user ID
4. `auth.uid()` function used in RLS policies
5. RLS policies filter data by tenant

### Authorization Patterns

- Role-based access (future enhancement)
- Team membership checks
- Permission system in place

---

## 7. API Patterns

### Standard Query Pattern

```typescript
const { data, error } = await supabase
  .from("table_name")
  .select("*")
  .eq("tenant_id", user.tenant_id); // Always included
```

### CRUD Operations

- **SELECT**: Controlled by RLS policies
- **INSERT**: Must have matching tenant_id
- **UPDATE**: RLS prevents cross-tenant updates
- **DELETE**: RLS prevents cross-tenant deletes

---

## 8. Deployment & Environment

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm run start
```

### Type Checking

```bash
npx tsc --noEmit
```

### Framework Versions

- Next.js: 16
- TypeScript: Latest
- Tailwind CSS: 4
- React: 19+ (via Next.js)

---

## 9. Database Schema Notes

### Foreign Key Relationships

- `stock_purchase_order_items.po_id` → `stock_purchase_orders.id`
- `lead_notes.lead_id` → `leads.id`
- `quotation_spaces.quotation_id` → `quotations.id`
- `quotation_components.quotation_id` → `quotations.id`
- `materials.category_id` → `material_categories.id`
- `quotation_materials.material_id` → `materials.id`
- And many more...

### Critical Columns

- `tenant_id` - Present on all tables for multi-tenancy
- `id` - UUID primary key on all tables
- `created_at` - Timestamp for audit trail
- `updated_at` - Timestamp for tracking changes

---

## 10. Known Issues & Limitations

### Connection Pool

- Supabase Cloud has connection limits
- CLI dumps may timeout during high traffic
- Use Dashboard backup feature instead

### Empty Tables

- Several empty tables exist (listed in section 2.3)
- Safe to drop if needed
- No dependencies on most of them

### Future Enhancements

- Quotation versioning (quotation_snapshots)
- Change audit log (quotation_changes)
- Component templates library

---

## 11. Maintenance & Operations

### Regular Tasks

1. Monitor connection pool usage
2. Review RLS policies for correctness
3. Check indexing on frequently filtered columns
4. Verify tenant isolation in logs

### Backup Strategy

1. Use Supabase automated backups
2. Download schema periodically
3. Test restore procedures

### Scaling Considerations

1. RLS adds minimal query overhead (<5%)
2. Indexes prevent N+1 queries
3. Connection pooling handles concurrent users

---

## 12. Security Best Practices

✅ **Implemented**

- Row Level Security on all active tables
- Tenant isolation at database level
- Authentication via Supabase Auth
- HTTPS enforced

⏳ **Recommended**

- API rate limiting
- Input validation on all endpoints
- SQL injection prevention (handled by Supabase)
- Regular security audits

---

## 13. Quick Reference

### Start Development

```bash
npm run dev
```

### Check Types

```bash
npx tsc --noEmit
```

### Database Backups

- Supabase Dashboard → Settings → Backups

### RLS Verification

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity DESC;
```

---

## 14. Support & Documentation Links

- **Supabase Docs**: https://supabase.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **TypeScript Docs**: https://www.typescriptlang.org/docs
- **Tailwind CSS**: https://tailwindcss.com/docs

---

## Version History

| Date       | Version | Changes                            |
| ---------- | ------- | ---------------------------------- |
| 2025-12-15 | 1.0     | Initial consolidated documentation |
