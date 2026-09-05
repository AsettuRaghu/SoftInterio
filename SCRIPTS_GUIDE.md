# Database Scripts - Simple Guide

## Health checks (read-only, safe to run any time)

```bash
npm run security:audit   # every API route is behind protectApiRoute
npm run security:views   # no database view leaks rows to unauthenticated callers
npm run db:orphans       # tenants left behind with no users
```

All three exit non-zero on failure, so they work in CI.

`db:orphans` reports only. Add `--delete` to actually remove them:

```bash
node scripts/find-orphan-tenants.js --delete
```

Orphans were created by a signup bug (the tenant was created before the user
and never cleaned up when user creation failed). Signup now rolls back
properly, so this should stay at zero - it is a cleanup for existing rows and
a canary if the rollback ever regresses.

---

## Manual admin scripts

### 1. `find-tenant.js` - Find what tenant an email belongs to

Use this FIRST to find the tenant ID you need.

```bash
node scripts/find-tenant.js user@example.com
```

**Output shows:**

- User details (name, email, status)
- Tenant details (ID, name)
- Ready-to-copy commands for the next step

---

### 2. `delete-tenant-complete.js` - DELETE ENTIRE TENANT

Completely removes tenant and all users. **PERMANENT!**

When to use:

- Testing cleanup
- Clearing test accounts
- Starting fresh after failed signup

```bash
node scripts/delete-tenant-complete.js <tenant-id>
```

Example:

```bash
node scripts/delete-tenant-complete.js 12345678-1234-1234-1234-123456789012
```

**What it deletes:**

- ✅ Tenant
- ✅ All users in tenant
- ✅ All auth users
- ✅ All subscriptions
- ✅ All invitations
- ✅ All roles

**After deletion:**

- Email is free to use for signup
- Email is free to use for invite

---

### 3. `deactivate-user.js` - REMOVE USER FROM TENANT

Removes user from a tenant (like deactivating). Auth user stays intact.

When to use:

- User quit the company
- User should no longer have access
- User will be re-invited later

```bash
node scripts/deactivate-user.js <email> <tenant-id>
```

Example:

```bash
node scripts/deactivate-user.js user@example.com 12345678-1234-1234-1234-123456789012
```

**What it removes:**

- ✅ User record from tenant
- ✅ User roles
- ✅ User invitations
- ✅ Tenant membership

**What it KEEPS:**

- ✅ Auth user intact (user can be re-invited)

**After deactivation:**

- Email CANNOT be used for new signup (auth user still exists)
- Email CAN be re-invited to this or any tenant

---

## Quick Workflow Examples

### Example 1: Clean up test signup

```bash
# 1. Find the tenant
node scripts/find-tenant.js test@example.com

# 2. Delete the entire tenant (from output)
node scripts/delete-tenant-complete.js <tenant-id>

# Now you can signup again with test@example.com
```

### Example 2: Remove user from company

```bash
# 1. Find which tenant they belong to
node scripts/find-tenant.js employee@company.com

# 2. Deactivate them (from output)
node scripts/deactivate-user.js employee@company.com <tenant-id>

# User no longer has access
# But can be re-invited later
```

---

## Common Issues

**Q: "Script not found"**

- Make sure you're in the project root: `/Users/raghuvarma/Projects/softinterio`
- Check filename spelling

**Q: "Error: Cannot find module '@supabase/supabase-js'"**

- Run: `npm install`

**Q: "Tenant not found"**

- Double-check the tenant ID is correct
- Use `find-tenant.js` to verify it exists

**Q: "User not found"**

- User might not exist in that tenant
- Use `find-tenant.js` first to check

---

## seed-quotation-catalogue.js

Reshapes the quotation catalogue into a Basic / Standard / Premium / Luxury
ladder so the Scenarios modal can move a whole category up or down a grade.

```bash
node scripts/seed-quotation-catalogue.js --dry   # show what would change
node scripts/seed-quotation-catalogue.js         # apply
```

Runs for every tenant that already has a catalogue. Safe to re-run: rows are
matched by slug, then by the legacy name they replace, and updated **in place**
so template and quotation references keep resolving. Anything the catalogue no
longer covers is deactivated rather than deleted - `goods_receipt_items`
references cost items with `ON DELETE RESTRICT`.

Categories where grade is not a real axis - Labour, Service, Accessories - are
seeded without tiers on purpose, which is what keeps them out of tier swaps.

---

## seed-quotation-settings.js

Fills `tenant_quotation_settings` — the letterhead and bank block on every
quotation PDF — from the tenant's own company record. Without a row here the
PDF prints anonymous.

```bash
node scripts/seed-quotation-settings.js --dry
node scripts/seed-quotation-settings.js
```

Only fills blanks on an existing row, so hand-edited settings survive. Bank
details are a clearly-fake placeholder until the real account is supplied.

---

## seed-print-formats.js

Seeds the ladder of print formats — room totals, components, cost categories,
every cost item, plus the Client and Internal BOQ layouts.

```bash
node scripts/seed-print-formats.js --dry
node scripts/seed-print-formats.js
```

Matched by name, and takes over the older format it replaces, so a format
already used for a print keeps its id. Re-run after applying migration
`20260906090000` to backfill `show_tax`.

---

That's it. Run `--dry` first on anything that writes.
