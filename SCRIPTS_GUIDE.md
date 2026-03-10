# Database Scripts - Simple Guide

## You Only Need These 3 Scripts

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

That's it! Just these 3 scripts. No confusion.
