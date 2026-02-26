# Billing & Subscription Implementation Roadmap

## Quick Start Overview

To implement a complete subscription system, follow these phases in order:

---

## Phase 1: Trial Period Auto-Grant (2-3 hours)

### Step 1.1: Update `createTenant()` in `src/lib/auth/service.ts`

**Current State**: Accepts `selected_plan` but doesn't use it

**Changes**:
1. Find the plan by slug/ID
2. Create `tenant_subscriptions` record with:
   - `status = 'trial'`
   - `is_trial = true`
   - `trial_days_granted = 30`
   - `trial_start_date = NOW()`
   - `trial_end_date = NOW() + 30 days`
   - `current_period_start = NOW()`
   - `current_period_end = NOW() + 30 days`
   - `plan_id = selected_plan_id`

**Code Template**:
```typescript
export async function createTenant(data: CreateTenantInput) {
  // ... existing tenant creation code ...

  // New: Create trial subscription
  if (data.selected_plan) {
    // Find plan by slug
    const { data: plan } = await adminClient
      .from("subscription_plans")
      .select("id")
      .eq("slug", data.selected_plan)
      .eq("is_active", true)
      .single();

    if (plan) {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const { error: subError } = await adminClient
        .from("tenant_subscriptions")
        .insert({
          tenant_id: tenant.id,
          plan_id: plan.id,
          status: "trial",
          is_trial: true,
          trial_days_granted: 30,
          trial_start_date: now.toISOString(),
          trial_end_date: trialEnd.toISOString(),
          current_period_start: now.toISOString(),
          current_period_end: trialEnd.toISOString(),
          billing_cycle: "monthly",
          auto_renew: false, // Trial doesn't auto-renew
        });

      if (subError) {
        console.error("[TENANT CREATION] Failed to create trial subscription:", subError);
        // Don't fail the tenant creation if subscription setup fails
      }
    }
  }

  return tenant;
}
```

**Testing**:
- Create new account
- Verify `tenant_subscriptions` record exists
- Verify `is_trial=true` and dates are 30 days apart

---

## Phase 2: Subscription Status Check in Middleware (3-4 hours)

### Step 2.1: Add Subscription Check to Middleware

**File**: `src/lib/supabase/middleware.ts`

**Current Check** (line ~188):
```typescript
if (userData?.status === "disabled" || userData?.status === "deleted") {
  // Sign out
}
```

**Required Addition**:
```typescript
// NEW: Check subscription status
const { data: subscription } = await supabase
  .from("tenant_subscriptions")
  .select("status, is_trial, trial_end_date, current_period_end")
  .eq("tenant_id", userData.tenant_id)
  .maybeSingle();

if (subscription) {
  const now = new Date();
  
  // Trial expired?
  if (subscription.is_trial) {
    const trialEnd = new Date(subscription.trial_end_date);
    if (now > trialEnd) {
      // Trial expired without active plan
      console.log("[MIDDLEWARE] Trial expired for user:", user.id);
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/auth/signin";
      url.searchParams.set("error", "trial_expired");
      return NextResponse.redirect(url);
    }
  }
  
  // Active subscription expired?
  if (subscription.status === "expired" || subscription.status === "cancelled") {
    // Check grace period
    // ... grace period logic ...
  }
}
```

**Testing**:
- Sign up, wait for trial to expire (or manually set date)
- Try to access dashboard
- Should be redirected to signin with error message
- Should see "Your trial period has ended. Please upgrade to continue."

---

## Phase 3: Usage Limit Enforcement (4-5 hours)

### Step 3.1: Create Usage Validation Service

**New File**: `src/lib/billing/usage.ts`

```typescript
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface UsageCheckResult {
  canAdd: boolean;
  current: number;
  limit: number;
  message?: string;
}

/**
 * Check if tenant can add a new user
 */
export async function canAddUser(tenantId: string): Promise<UsageCheckResult> {
  const adminClient = createAdminClient();

  // Get current subscription and plan
  const { data: sub } = await adminClient
    .from("tenant_subscriptions")
    .select("*, plan:subscription_plans(*)")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!sub?.plan) {
    return { canAdd: false, current: 0, limit: 0, message: "No active plan" };
  }

  // Get current usage
  const { data: usage } = await adminClient
    .from("tenant_usage")
    .select("current_users")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const currentUsers = usage?.current_users || 0;
  const limit = sub.plan.max_users;

  if (limit === -1) {
    return { canAdd: true, current: currentUsers, limit: -1 }; // Unlimited
  }

  return {
    canAdd: currentUsers < limit,
    current: currentUsers,
    limit,
    message: currentUsers >= limit 
      ? `You've reached the user limit (${limit}). Upgrade your plan to add more users.`
      : undefined,
  };
}

/**
 * Check if tenant can add a new project
 */
export async function canAddProject(tenantId: string): Promise<UsageCheckResult> {
  // Similar implementation for projects
}

/**
 * Check if tenant can upload a document
 */
export async function canUploadDocument(
  tenantId: string,
  fileSizeBytes: number
): Promise<UsageCheckResult> {
  // Similar implementation for storage
  // Check: current_storage + fileSize <= limit
}
```

### Step 3.2: Add Pre-flight Checks to API Routes

**Example: `/api/team/invite` route**

```typescript
import { canAddUser } from "@/lib/billing/usage";

export async function POST(request: NextRequest) {
  // ... existing auth checks ...

  // NEW: Check if can add users
  const usageCheck = await canAddUser(user.tenantId);
  if (!usageCheck.canAdd) {
    return NextResponse.json(
      {
        success: false,
        error: usageCheck.message,
        upsellRequired: true,
        usage: {
          current: usageCheck.current,
          limit: usageCheck.limit,
        },
      },
      { status: 403 }
    );
  }

  // ... continue with invitation ...
}
```

**Testing**:
- Create account with free plan (e.g., max 1 user)
- Invite 1 user (should work)
- Try to invite 2nd user (should fail with upgrade message)

---

## Phase 4: Payment Integration (2-3 days)

### Step 4.1: Choose Payment Provider

**Recommended**:
- **Primary**: Razorpay (India, best local support)
- **Secondary**: Stripe (International fallback)

### Step 4.2: Create Payment Service

**New File**: `src/lib/billing/payment.ts`

```typescript
interface PaymentGateway {
  createPaymentOrder(amount: number, planId: string): Promise<{
    orderId: string;
    clientSecret?: string; // For Stripe
  }>;
  verifyPayment(orderId: string, paymentId: string): Promise<boolean>;
}

// Razorpay implementation
class RazorpayGateway implements PaymentGateway {
  // Implementation
}

// Stripe implementation
class StripeGateway implements PaymentGateway {
  // Implementation
}

// Factory
export function getPaymentGateway(): PaymentGateway {
  const provider = process.env.PAYMENT_PROVIDER || "razorpay";
  if (provider === "stripe") {
    return new StripeGateway();
  }
  return new RazorpayGateway();
}
```

### Step 4.3: Create Payment API Endpoint

**New File**: `src/app/api/billing/payment/route.ts`

```typescript
export async function POST(request: NextRequest) {
  // 1. Validate request & user
  // 2. Get plan details and calculate amount
  // 3. Create payment order via gateway
  // 4. Return payment details to frontend
  // 5. Store pending payment in DB
}

export async function PUT(request: NextRequest) {
  // 1. Receive payment verification from client
  // 2. Verify with payment gateway
  // 3. On success:
  //    - Update tenant_subscriptions (status='active')
  //    - Create subscription_invoices record
  //    - Mark payment as completed
  // 4. On failure:
  //    - Retry logic, grace period, etc.
}
```

### Step 4.4: Create Webhook Handlers

**New File**: `src/app/api/billing/webhook/razorpay/route.ts`

```typescript
export async function POST(request: NextRequest) {
  // 1. Verify webhook signature
  // 2. Parse payment event
  // 3. Update subscription based on event:
  //    - payment.authorized → activate subscription
  //    - payment.failed → trigger retry logic
  //    - subscription.charged → extend period, create invoice
}
```

### Step 4.5: Update Signup Flow

Modify `POST /api/auth/signup`:

```typescript
// After trial subscription is created:
return NextResponse.json({
  success: true,
  message: "Account created! You have 30 days free trial.",
  data: {
    tenant,
    user,
    subscription: {
      trialDaysRemaining: 30,
      requiresPaymentMethod: true, // To prevent service disruption
    },
  },
}, { status: 201 });
```

**Testing**:
- Create account
- Go to billing settings
- Add payment method (test card: 4111 1111 1111 1111)
- Verify payment is processed
- Verify subscription status changes to 'active'

---

## Phase 5: Upgrade/Downgrade Improvements (2-3 days)

### Step 5.1: Implement Proration

**File**: `src/lib/billing/proration.ts`

```typescript
export interface ProratedAmount {
  originalCycleCost: number;
  originalCycleDaysRemaining: number;
  newCycleCost: number;
  creditForRemainingDays: number;
  chargeForNewPlan: number;
  proratedAmount: number; // negative = credit, positive = charge
}

export function calculateProration(
  currentPlan: { priceMonthly: number },
  newPlan: { priceMonthly: number },
  currentPeriodEnd: Date
): ProratedAmount {
  const now = new Date();
  const currentCycleLength = 30; // days (simplified)
  const daysRemaining = Math.ceil(
    (currentPeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  );

  const dailyOldRate = currentPlan.priceMonthly / currentCycleLength;
  const creditForRemainingDays = dailyOldRate * daysRemaining;

  const dailyNewRate = newPlan.priceMonthly / currentCycleLength;
  const chargeForNewPlan = dailyNewRate * daysRemaining;

  const proratedAmount = chargeForNewPlan - creditForRemainingDays;

  return {
    originalCycleCost: currentPlan.priceMonthly,
    originalCycleDaysRemaining: daysRemaining,
    newCycleCost: newPlan.priceMonthly,
    creditForRemainingDays,
    chargeForNewPlan,
    proratedAmount,
  };
}
```

### Step 5.2: Update Change Plan Endpoint

```typescript
// POST /api/billing/change-plan
const proration = calculateProration(currentPlan, newPlan, periodEnd);

if (changeType === "upgrade" && proration.proratedAmount > 0) {
  // Charge the difference
  const order = await gateway.createPaymentOrder(
    proration.proratedAmount,
    newPlan.id
  );
  // Return to frontend with payment required
}

if (changeType === "downgrade") {
  // Offer immediate downgrade with credit, or wait till period end
}
```

---

## Phase 6: Email Notifications (2-3 hours)

**Triggers**:
- Trial created: "Welcome! You have 30 days free trial"
- Trial 7 days remaining: "Your trial ends in 7 days. Choose a plan to continue"
- Trial 1 day remaining: "URGENT: Your trial ends tomorrow"
- Trial expired: "Your trial has ended. Upgrade to continue using SoftInterio"
- Upgrade successful: "Plan upgraded successfully. You now have access to..."
- Payment failed: "Payment failed. Please update your payment method"

---

## Implementation Order

```
Week 1:
  - Phase 1: Trial auto-grant (2-3h)
  - Phase 2: Subscription middleware check (3-4h)
  - Phase 3: Usage enforcement (4-5h)

Week 2:
  - Phase 4: Payment gateway integration (2-3d)
  - Phase 5: Upgrade/downgrade proration (2-3d)
  - Phase 6: Email notifications (2-3h)

Week 3:
  - Integration testing
  - Grace period & retry logic
  - Admin dashboard for billing
  - Documentation
```

---

## Key Files to Create/Modify

### Create (New Files):
1. `src/lib/billing/service.ts` - Main billing functions
2. `src/lib/billing/usage.ts` - Usage validation
3. `src/lib/billing/payment.ts` - Payment processing
4. `src/lib/billing/proration.ts` - Proration calculation
5. `src/app/api/billing/payment/route.ts` - Payment API
6. `src/app/api/billing/webhook/razorpay/route.ts` - Webhooks
7. `src/app/api/billing/webhook/stripe/route.ts` - Webhooks

### Modify (Existing Files):
1. `src/lib/auth/service.ts` - Add trial creation
2. `src/lib/supabase/middleware.ts` - Add subscription check
3. `src/app/api/auth/signup/route.ts` - Update logging
4. `src/app/api/billing/change-plan/route.ts` - Add payment + proration
5. `src/app/dashboard/settings/billing/page.tsx` - Add payment section
6. `database/schema.sql` - Add payment tables

---

## Database Changes Needed

```sql
-- Add to tenant_subscriptions:
ALTER TABLE tenant_subscriptions ADD COLUMN payment_method_id VARCHAR(255);
ALTER TABLE tenant_subscriptions ADD COLUMN payment_status VARCHAR(50);
ALTER TABLE tenant_subscriptions ADD COLUMN features_locked JSONB;

-- Create subscription_payments table:
CREATE TABLE subscription_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  subscription_id UUID NOT NULL REFERENCES tenant_subscriptions(id),
  invoice_id UUID REFERENCES subscription_invoices(id),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  status VARCHAR(50) DEFAULT 'pending', -- pending, success, failed
  payment_method VARCHAR(20), -- razorpay, stripe
  external_id VARCHAR(255), -- payment gateway ID
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create subscription_emails table (for tracking notifications):
CREATE TABLE subscription_email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  email_type VARCHAR(100),
  sent_at TIMESTAMP DEFAULT NOW()
);
```

---

## Success Criteria

- [x] All new users get 30-day trial
- [x] Trial countdown displayed on dashboard
- [x] Users cannot access after trial without active plan
- [x] Cannot add users/projects/storage if limit reached
- [x] Payment gateway processes transactions
- [x] Invoices automatically generated
- [x] Plan upgrades work with proration
- [x] Plan downgrades blocked or immediate
- [x] Email notifications sent at key lifecycle points
- [x] All tests passing

This roadmap should be executed sequentially for a solid, production-ready billing system.
