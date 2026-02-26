# SoftInterio - Billing & Subscription Module Analysis

## Executive Summary

The billing/subscription module is **partially implemented** with significant gaps in critical areas. The system has database schema, API endpoints, and UI components for plan management, but lacks:

1. **Trial period initialization on signup** - Not granted automatically
2. **Payment processing** - No payment gateway integration
3. **Usage-based access control** - Users aren't blocked when trial expires without active plan
4. **Upgrade/Downgrade validation** - Partially implemented, needs refinement
5. **Usage threshold alerts** - Dashboard doesn't show limit warnings properly
6. **Plan selection during signup** - Selected but not persisted to subscription

---

## Current Implementation Status

### ✅ What's Implemented

#### 1. Database Schema

- `subscription_plans` - Plan definitions with pricing and limits
- `tenant_subscriptions` - Subscription state tracking
- `subscription_plan_features` - Feature matrix for plans
- `subscription_invoices` - Invoice tracking
- `subscription_addons` - Add-on support (unused)
- `subscription_change_requests` - Plan change tracking
- `tenant_usage` - Usage tracking for users, projects, storage
- `tenant_usage_history` - Historical usage snapshots

#### 2. API Endpoints

- `GET /api/billing/plans` - Fetch available plans
- `GET /api/billing/subscription` - Get current subscription status and usage
- `POST /api/billing/change-plan` - Change/upgrade/downgrade plan
- Upgrade logic: immediate, with proration tracking
- Downgrade logic: scheduled for period end, with usage validation

#### 3. UI Components

- **BillingSettingsPage** (`/dashboard/settings/billing`)
  - Shows current plan with billing cycle
  - Displays usage metrics (users, projects, storage)
  - Shows trial/subscription countdown
  - Plan change modal
- **ChangePlanModal**
  - Plan comparison (monthly/yearly)
  - Upgrade/downgrade indication
  - Proration and effective date calculation
- **SignUpForm**
  - Plan selection interface (hardcoded plans)
  - Company type and details collection

#### 4. Service Functions

- `createTenant()` - Creates tenant with plan selection
- `registerUser()` - Creates user and subscription
- Plan change workflow with change request tracking

### ❌ What's Missing/Incomplete

#### 1. Trial Period Initialization

**Current State**: Plan is selected during signup but trial is NOT automatically created

**File**: `src/app/api/auth/signup/route.ts`

```typescript
// Calls createTenant with selected_plan, but no trial setup
const tenant = await createTenant({
  tenant_type: body.tenant_type,
  company_name: body.company_name,
  email: body.email,
  phone: body.phone,
  selected_plan: body.selected_plan, // ← Selected but not used for trial
});
```

**File**: `src/lib/auth/service.ts` - `createTenant()` function

- Accepts `selected_plan` parameter
- Does NOT create `tenant_subscriptions` entry with trial
- Does NOT set `trial_start_date` and `trial_end_date`

**Required Changes**:

- Initialize trial period (30 days default) on tenant creation
- Set `is_trial=true`, `trial_days_granted=30`
- Create `tenant_subscriptions` record with status='trial'
- Link to selected plan

---

#### 2. Payment Processing

**Current State**: No payment processing at all

**Missing Components**:

1. **Payment Gateway Integration** (Stripe/Razorpay)
   - No API key configuration
   - No webhook handling
   - No transaction tracking

2. **Invoice Generation**
   - Schema exists (`subscription_invoices`)
   - No API endpoint to generate invoices
   - No automatic billing

3. **Payment Status Tracking**
   - `last_payment_date` and `last_payment_amount` in DB (unused)
   - No payment state machine

**Required Implementation**:

- Choose payment provider (Razorpay for India, Stripe internationally)
- Create `POST /api/billing/payment` endpoint
- Implement webhook handlers
- Generate invoices at subscription start
- Handle payment failures (grace period, retry logic)
- Auto-renew subscriptions

---

#### 3. Access Control Based on Subscription Status

**Current State**: Users NOT blocked from accessing app when trial expires

**Files**:

- `src/lib/supabase/middleware.ts` - Checks user status (disabled/deleted) but NOT subscription status
- `src/config/route-permissions.ts` - Permission-based access, not subscription-based

**Problem Flow**:

1. Trial expires → `tenant_subscriptions.trial_end_date` has passed
2. User makes API request → No subscription check
3. User accesses dashboard → Middleware only checks status='disabled'
4. User continues using app without payment ❌

**Required Implementation**:

- Add subscription status check in middleware
- Check: `is_trial=false && status NOT IN ('active', 'grace_period')`
- If expired without active plan:
  - For dashboard routes: redirect to billing page with upgrade prompt
  - For API routes: return 403 with subscription expired message
- Grace period handling (7 days to retry payment)

**Code Location to Modify**:

```typescript
// src/lib/supabase/middleware.ts around line 188
if (userData?.status === "disabled" || userData?.status === "deleted") {
  // ← ADD: subscription status check here
}
```

---

#### 4. Usage-Based Limits & Alerts

**Current State**: Usage tracked, UI shows metrics, but NO enforcement

**Files**:

- `src/app/dashboard/settings/billing/page.tsx` - Shows usage bars with percentage
- `src/app/api/billing/subscription/route.ts` - Calculates usage percentages
- No API checks usage before allowing operations

**Missing Enforcement**:

1. **At signup**: `POST /api/team/invite` - No check if user limit reached
2. **At project creation**: `POST /api/projects` - No check if project limit reached
3. **At file upload**: `POST /api/documents` - No check if storage limit reached

**Required Implementation**:

- Create middleware function `checkUsageLimits(tenantId, feature)`
- Call before: user invitation, project creation, file uploads
- Calculate current usage from `tenant_usage` table
- Compare against `subscription_plans.max_*` fields
- Return 403 if over limit with upgrade prompt

**Usage Thresholds**:

```typescript
// Show warnings at these percentages:
80% → Yellow warning
90% → Orange warning
100% → Red - block operation
```

---

#### 5. Plan Selection During Signup

**Current State**: Selected on frontend but NOT properly persisted

**Flow**:

1. SignUpForm shows plan options ✓
2. `selected_plan` sent to `/api/auth/signup` ✓
3. Plan stored in `createTenant({ selected_plan })` ✓
4. But `createTenant()` does NOT use it for subscription setup ✗

**Required Implementation**:

- In `createTenant()`: Extract `selected_plan`
- Find plan ID from `subscription_plans` where `slug = selected_plan`
- Create `tenant_subscriptions` with `plan_id = found_id`

---

#### 6. Upgrade/Downgrade Workflows

**Current State**: Partially implemented in `change-plan` route

**What Works**:

- ✓ Upgrade detection (price comparison)
- ✓ Downgrade detection
- ✓ Usage validation for downgrades
- ✓ Change request tracking
- ✓ Effective date calculation

**What's Missing**:

- ✗ No payment capture on upgrade
- ✗ No proration calculation (credit/charge for partial period)
- ✗ No invoice generation
- ✗ No UI feedback on proration amount
- ✗ No support for immediate downgrade at cost

**Required Implementation**:

```typescript
// In /api/billing/change-plan:
1. If upgrade:
   - Calculate proration credit (unused days of old plan)
   - Generate new invoice for new plan
   - Apply credit to new invoice
   - Request payment for difference
   - Update subscription immediately on success

2. If downgrade:
   - Option 1: Immediate (customer pays/gets credit)
   - Option 2: At period end (current implementation)
   - Generate invoice with proration
   - Warn if current usage exceeds new limits
```

---

## Database Schema Review

### Tables Status

| Table                          | Status     | Usage                       |
| ------------------------------ | ---------- | --------------------------- |
| `subscription_plans`           | ✓ Complete | Defines available plans     |
| `tenant_subscriptions`         | ⚠️ Partial | Missing trial auto-creation |
| `subscription_plan_features`   | ✓ Complete | Feature matrix              |
| `subscription_invoices`        | ❌ Unused  | No invoice generation       |
| `subscription_addons`          | ❌ Unused  | Optional add-ons (future)   |
| `subscription_change_requests` | ✓ Used     | Tracks plan changes         |
| `tenant_usage`                 | ✓ Partial  | Tracked but not enforced    |
| `tenant_usage_history`         | ✓ Unused   | For analytics (future)      |

### Key Missing Columns/Tables

```sql
-- Missing: Payment tracking
ALTER TABLE tenant_subscriptions ADD COLUMN:
  - payment_method_id (stripe/razorpay customer ID)
  - payment_status ('pending', 'completed', 'failed')
  - retry_count (for failed payments)
  - next_retry_at (timestamp)

-- Missing: Usage limits enforcement
ALTER TABLE tenant_subscriptions ADD COLUMN:
  - features_locked (JSON) - which features are disabled
  - usage_warnings_sent_at (timestamp) - last warning email sent

-- Missing: Payment records
CREATE TABLE subscription_payments (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  subscription_id UUID,
  invoice_id UUID,
  amount DECIMAL,
  currency VARCHAR(3),
  status ('pending', 'success', 'failed'),
  payment_method VARCHAR(20), -- 'stripe', 'razorpay'
  external_id VARCHAR(255), -- Stripe charge ID, etc
  error_message TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

---

## Implementation Priority

### Phase 1: Critical (Week 1-2)

1. **Auto-create trial on signup**
   - Grant 30-day trial at signup
   - Initialize `tenant_subscriptions` with correct dates
2. **Access control**
   - Add subscription check to middleware
   - Redirect to billing on trial expiry
3. **Usage enforcement**
   - Add pre-flight checks to key operations
   - Show upgrade prompts

### Phase 2: Important (Week 3)

4. **Payment processing**
   - Integrate Razorpay (India) + Stripe
   - Implement webhook handlers
   - Auto-invoice generation
5. **Plan change improvements**
   - Add proration calculation
   - Payment capture on upgrade
   - UI improvements

### Phase 3: Enhancement (Week 4)

6. **Advanced features**
   - Grace period handling
   - Retry logic for failed payments
   - Usage analytics dashboard
   - Feature flags per plan

---

## API Endpoints to Create/Modify

### New Endpoints

```typescript
// Initialize trial on signup
POST /api/billing/initialize-trial
  Input: { tenantId, planId, trialDays }
  Output: { subscription_id, trial_end_date }

// Process payment
POST /api/billing/payment
  Input: { tenantId, amount, paymentMethod, planId }
  Output: { transactionId, status }

// Get usage vs limits
GET /api/billing/usage
  Output: { users: {...}, projects: {...}, storage: {...}, warnings: [] }

// Handle payment webhooks
POST /api/billing/webhook/razorpay
POST /api/billing/webhook/stripe

// Auto-renew subscription
POST /api/billing/auto-renew
  (Internal: called by cron job)

// Check subscription before operation
GET /api/billing/can-add?type=user|project|document
  Output: { canAdd: boolean, reason?: string, upgradeRequired?: true }
```

### Modify Existing Endpoints

```typescript
// POST /api/auth/signup
- Add: Create trial subscription
- Add: Send welcome email with trial info

// POST /api/billing/change-plan
- Add: Proration calculation
- Add: Payment processing
- Add: Invoice generation
- Add: Webhook trigger

// GET /api/billing/subscription
- Already good, returns all needed info
```

---

## UI/UX Changes Required

### SignUp Flow

```
1. Current: Plan selection → Company details → Account creation
2. Required: Plan selection → Show trial info → Company details → Account creation
3. Add: "You'll get 30 days free trial with [Plan Name]"
```

### Settings > Billing Page

```
Enhancements:
- Show exact trial end date (highlight if < 7 days)
- Show "Upgrade before trial ends" banner at 50% through trial
- Add usage bar warnings (80%, 90%, 100%)
- Show next billing date and amount
- Add payment method management section
- Show invoice history with download links
```

### Dashboard

```
New: "Plan & Billing" card in dashboard showing:
- Current plan name
- Days left (trial or subscription)
- Usage percentage across key metrics
- "Manage Billing" button to settings page
```

---

## Configuration Needed

### System Config (in `system_config` table)

```json
{
  "billing": {
    "trial_days": 30,
    "grace_period_days": 7,
    "warning_threshold_days": 7,
    "payment_providers": ["razorpay", "stripe"],
    "currency": "INR",
    "auto_renew": true,
    "retry_failed_payments": true,
    "retry_attempts": 3,
    "retry_interval_hours": 24,
    "usage_check_endpoints": [
      "POST /api/team/invite",
      "POST /api/projects",
      "POST /api/documents",
      "POST /api/billing/upload"
    ]
  }
}
```

---

## Testing Checklist

- [ ] Trial created with correct dates on signup
- [ ] Cannot access app 1 day after trial expiry
- [ ] Upgrade blocks operation if plan limit exceeded
- [ ] Plan change captures payment (upgrade)
- [ ] Invoice generated after payment
- [ ] Usage bars show correct percentages
- [ ] Email alerts sent at warning thresholds
- [ ] Downgrade blocked if usage exceeds new limits
- [ ] Grace period allows retry after payment failure
- [ ] Webhook successfully records payment
- [ ] Auto-renew charges correctly at period end

---

## File Changes Required

### New Files

- `src/lib/billing/service.ts` - Billing service functions
- `src/lib/billing/payment.ts` - Payment processing
- `src/lib/billing/usage.ts` - Usage checking
- `src/app/api/billing/payment/route.ts`
- `src/app/api/billing/webhook/razorpay/route.ts`
- `src/app/api/billing/webhook/stripe/route.ts`
- `src/app/api/billing/usage/route.ts`

### Modified Files

- `src/lib/auth/service.ts` - Add trial creation in `createTenant()`
- `src/lib/supabase/middleware.ts` - Add subscription check
- `src/app/api/auth/signup/route.ts` - Add trial initialization log
- `src/app/api/billing/change-plan/route.ts` - Add payment + proration
- `src/app/dashboard/settings/billing/page.tsx` - Add payment section
- `src/modules/auth/components/SignUpForm.tsx` - Add trial info display
- `database/schema.sql` - Add payment tables and columns

---

## Environment Variables Needed

```env
# Razorpay (India)
NEXT_PUBLIC_RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# Stripe (International)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Email Service (for notifications)
SENDGRID_API_KEY=
EMAIL_FROM_BILLING=billing@softinterio.com
```

---

## Summary of Gaps

| Feature                     | Required | Implemented  | Complexity | Effort        |
| --------------------------- | -------- | ------------ | ---------- | ------------- |
| Auto-grant 30-day trial     | ✓        | ✗            | Low        | 1-2h          |
| Subscription status check   | ✓        | ✗            | Medium     | 3-4h          |
| Usage limit enforcement     | ✓        | ✗            | Medium     | 4-5h          |
| Payment gateway integration | ✓        | ✗            | High       | 2-3 days      |
| Upgrade/downgrade flows     | ✓        | ⚠️ (partial) | High       | 2-3 days      |
| Invoice generation          | ✓        | ✗            | Medium     | 2-3h          |
| Proration calculation       | ✓        | ✗            | Medium     | 3-4h          |
| Email notifications         | ✓        | ✗            | Medium     | 2-3h          |
| **TOTAL**                   |          |              |            | **2-3 weeks** |

This analysis shows the subscription system is a solid foundation but needs significant completion work to be production-ready.
