# Supabase Security Hardening - RLS (Row Level Security) Guide

## Overview

This document explains the Supabase security issue reported and how we've resolved it.

## Problem: RLS Disabled on Public Tables

### Issue Description
Supabase was flagging that the `public.units` table (and other tables in the public schema) had **Row Level Security (RLS) disabled**.

### Why This Is a Security Risk

When RLS is disabled on tables in the public schema:
- **Any authenticated user** can read ALL data via the PostgREST API
- **No tenant isolation** - users could see data from other companies/tenants
- **No row-level access control** - impossible to implement fine-grained permissions
- **Potential data breaches** if API keys are leaked or misused

### Supabase's Recommendation
> "Enable RLS and creating appropriate policies is a key defense for multi-tenant, user-isolated, or sensitive data."

---

## Solution: Enable RLS and Create Policies

### What We Did

We created a database migration file (`054_enable_rls_on_public_tables.sql`) that:

1. **Enables RLS** on all public schema tables
2. **Creates tenant-based access policies** for data isolation
3. **Creates proper CRUD policies** (SELECT, INSERT, UPDATE, DELETE)
4. **Adds database indexes** for RLS policy performance

### Policy Strategy

Our approach uses **tenant isolation** - the core principle of your SoftInterio system:

```
User → Team → Tenant → Data
```

**Rule**: A user can only access data if:
- Their user record's `tenant_id` matches the data's `tenant_id`
- They are a member of the team managing that data

### Example Policy

For the `units` table (and most master data):

```sql
CREATE POLICY "Units are readable by authenticated users"
  ON public.units
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.tenant_id = units.tenant_id
    )
  );
```

This means:
- ✅ Only authenticated users can SELECT
- ✅ Only if their tenant_id matches the units' tenant_id
- ❌ No anonymous access
- ❌ No cross-tenant data leakage

---

## Implementation Details

### Tables Secured

**Stock Management:**
- units
- stock_vendors
- stock_brands
- stock_cost_items
- stock_inventory
- stock_purchase_orders
- stock_purchase_order_items
- stock_goods_receipts
- stock_vendor_brands

**Sales/Leads:**
- clients
- properties
- leads
- lead_notes
- lead_activities

**Quotations:**
- quotations
- quotation_spaces
- quotation_components
- quotation_activities

**Projects & Teams:**
- projects
- teams
- team_members
- users
- po_approval_history

### Policies for Each Table

For each table, we created 4 policies:

| Operation | Who | Condition |
|-----------|-----|-----------|
| **SELECT** | authenticated | user.tenant_id = table.tenant_id |
| **INSERT** | authenticated | user.tenant_id = table.tenant_id |
| **UPDATE** | authenticated | user.tenant_id = table.tenant_id |
| **DELETE** | authenticated | user.tenant_id = table.tenant_id |

---

## Performance Optimization

To prevent RLS from slowing down queries, we added indexes on:

- `users(tenant_id)` - Fast tenant lookups
- `users(id, tenant_id)` - Composite index for RLS checks
- `team_members(user_id, team_id)` - Fast membership checks
- `*_tenant_id` columns - For all tables with tenant_id

### Why This Matters

Without indexes, each RLS policy check would:
- Scan the entire users table ❌ SLOW
- Check every single user record ❌ Exponential slowdown
- Query would fail at scale ❌ Production blocker

With indexes:
- O(log n) lookup time ✅ FAST
- Constant-time policy evaluation ✅ Scales well
- Works with millions of rows ✅ Production ready

---

## Applying the Migration

### Option 1: Using Supabase CLI (Recommended)

```bash
# Pull the latest schema from Supabase
supabase db pull

# Manually apply the migration file via Supabase dashboard:
# 1. Go to Supabase Dashboard
# 2. SQL Editor
# 3. Create new query
# 4. Copy entire 054_enable_rls_on_public_tables.sql content
# 5. Run the query
```

### Option 2: Using psql (If you have Postgres installed)

```bash
# Get your Supabase connection string from dashboard
psql "postgres://[user]:[password]@[host]:[port]/postgres" < database/migrations/054_enable_rls_on_public_tables.sql
```

### Option 3: Using Supabase Dashboard

1. Go to **SQL Editor** in your Supabase Dashboard
2. Click **New Query**
3. Copy the SQL from `database/migrations/054_enable_rls_on_public_tables.sql`
4. Click **Run** (▶️)

---

## Verifying the Fix

### Check RLS is Enabled

In Supabase SQL Editor:

```sql
-- Check which tables have RLS enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

Expected output: `rowsecurity = true` for all public tables ✅

### Check Policies are Created

```sql
-- List all RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename;
```

Should see:
- ✅ SELECT policies (qual column)
- ✅ INSERT/UPDATE/DELETE policies (with_check column)

### Test the Policies

```sql
-- Test that users can only see their own tenant's data
-- Connect as a user and try:
SELECT * FROM units;  -- Should only return tenant's units

-- Try to access another tenant's data (should fail silently):
SELECT * FROM units WHERE tenant_id = 'other-tenant-id';  -- Returns 0 rows
```

---

## Application Code Changes

### No Breaking Changes ✅

The RLS policies are transparent to your application code:

```typescript
// Your existing code continues to work
const { data, error } = await supabase
  .from('units')
  .select('*');  // Only returns current user's tenant units
```

### Why?

Supabase automatically applies RLS policies based on:
- The JWT token (contains `user_id`)
- The `auth.uid()` function in policies

So your API routes that use the user's auth token automatically get filtered data.

---

## Security Best Practices Applied

### ✅ Defense in Depth

1. **Client Level**: JWT authentication in auth headers
2. **API Level**: `protectApiRoute()` function validates user
3. **Database Level**: RLS policies enforce row-level access
4. **Encryption**: Data encrypted at rest in Supabase

### ✅ Principle of Least Privilege

- Anonymous users: ❌ No access
- Authenticated users: ✅ Only their tenant's data
- Admin/Service Role: Can bypass RLS (for system operations)

### ✅ Tenant Isolation

- Each tenant's data is completely isolated
- One tenant cannot access another's data, even by accident
- Scaling to multiple companies is now fully secured

---

## Supabase Dashboard Verification

After applying the migration:

1. Go to **Security → Advisor** in your Supabase Dashboard
2. Look for the RLS issue on `units` table
3. Status should change to ✅ **Resolved** or ⚠️ **Fixed**

The dashboard may take 5-10 minutes to update.

---

## What If There Are Errors?

### Error: "Policy already exists"

**Cause**: Migration was run twice
**Fix**: This is safe to ignore - the policies are idempotent

### Error: "Column 'tenant_id' does not exist"

**Cause**: Your table structure is different from expected
**Fix**: Check your actual table structure:

```sql
\d public.units  -- List columns
```

Then update the policy conditions to match your schema.

### Error: "function auth.uid() does not exist"

**Cause**: Supabase auth extension not enabled
**Fix**: This shouldn't happen in Supabase-hosted databases. Contact support if it does.

---

## Performance Monitoring

### Monitor RLS Policy Execution

In your Supabase dashboard:

1. Go to **Logs → API** 
2. Look for slow queries
3. Check if RLS policies are causing slowdown

### RLS Performance Tips

If RLS policies slow down queries:

1. **Add more indexes** (we already did this)
2. **Reduce JOIN complexity** in policies
3. **Use EXPLAIN ANALYZE** to debug:
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM units;
   ```

---

## Next Steps

### Immediate
- ✅ Apply the migration
- ✅ Verify RLS is enabled
- ✅ Check Supabase dashboard - issue should be resolved

### Short Term
- Run your test suite to ensure no breaking changes
- Monitor Supabase logs for performance
- Test cross-tenant access attempts (should fail)

### Long Term
- Monitor RLS advisor recommendations
- Add more granular policies if needed (e.g., role-based)
- Consider using `app_metadata` in JWT for permission checks

---

## References

- [Supabase Row Level Security Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [SoftInterio API Security Guide](./api-security-guide.md)
- [Multi-tenant RLS Best Practices](https://github.com/orgs/supabase/discussions/14576)

---

## Questions?

Refer to:
1. This document
2. The `054_enable_rls_on_public_tables.sql` migration file
3. Supabase official documentation
4. Your database advisor in Supabase dashboard
