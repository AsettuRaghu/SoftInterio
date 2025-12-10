# API Route Security Guide

This document outlines the security patterns and requirements for all API routes in the SoftInterio ERP system.

## Overview

All API routes that handle authenticated requests MUST use the `protectApiRoute()` function from `@/lib/auth/api-guard`. This provides:

- ✅ Authentication verification
- ✅ User status checks (disabled/deleted accounts)
- ✅ Tenant membership validation
- ✅ Consistent error responses

## Required Pattern

Every protected API route handler MUST start with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

export async function GET(request: NextRequest) {
  try {
    // REQUIRED: Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    // Your handler logic here...
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

## What `protectApiRoute()` Checks

1. **Authentication**: Verifies user is logged in via Supabase
2. **User Status**: Checks user is not disabled or deleted
3. **Tenant Membership**: Validates user belongs to a tenant
4. **Returns**: User object with `id`, `email`, etc.

## Public Routes (Excluded from Protection)

Some routes are intentionally public and don't require `protectApiRoute()`:

- `auth/signin` - User sign in
- `auth/signup` - User registration
- `auth/signout` - User sign out
- `auth/forgot-password` - Password reset request
- `auth/reset-password` - Password reset completion
- `auth/validate-invite` - Team invitation validation
- `auth/complete-invite` - Team invitation completion
- `auth/accept-invite` - Team invitation acceptance
- `billing/plans` - Public plan information
- `debug/*` - Development debugging endpoints

If you need to add a new public route, add it to the `EXCLUDED_ROUTES` array in `scripts/audit-api-security.js`.

## Security Audit

### Running the Audit

```bash
# Check all routes
npm run security:audit

# Quick check (fails on issues)
npm run security:check
```

### CI/CD Enforcement

The security audit runs automatically on:

- Every push to `main` or `develop`
- Every pull request to `main` or `develop`

If any routes are missing protection, the CI build will fail.

### Audit Output

The audit categorizes routes as:

- ✅ **Protected**: Has `protectApiRoute()` - Good!
- ⚪ **Excluded**: Public route in exclusion list
- ❌ **NO AUTH**: Missing authentication entirely
- ⚠️ **PARTIAL**: Uses basic `auth.getUser()` but not full protection
- 🚨 **CRITICAL**: Uses `adminClient` without any protection

## Using `adminClient` Safely

Some operations require elevated privileges (bypassing RLS). When using `adminClient`:

1. **Always** call `protectApiRoute()` first
2. Verify the target resource belongs to the user's tenant
3. Check user permissions for the operation

```typescript
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  // 1. FIRST: Authenticate and validate user
  const guard = await protectApiRoute(request);
  if (!guard.success) {
    return createErrorResponse(guard.error!, guard.statusCode!);
  }

  const { user } = guard;
  const supabase = await createClient();

  // 2. SECOND: Verify user has permission & get tenant context
  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id, role_id")
    .eq("id", user.id)
    .single();

  // 3. THIRD: Only then use adminClient for elevated operations
  const adminClient = createAdminClient();
  // ... perform operation with tenant_id validation
}
```

## Rate Limiting

The API guard includes built-in rate limiting:

- **Auth endpoints**: 10 requests per 15 minutes
- **API endpoints**: 100 requests per minute
- **Password reset**: 3 requests per hour

## Adding New Routes

When creating a new API route:

1. Start with the required security pattern above
2. Run `npm run security:audit` to verify
3. If it's a public route, add to `EXCLUDED_ROUTES`
4. Run audit again to confirm it passes

## Questions?

If you're unsure whether a route needs protection, default to **YES** - protect it. It's easier to remove protection later than to fix a security breach.
