/**
 * Subscription Validation Helper Queries
 * Use these queries in Supabase SQL Editor to validate subscription data
 */

-- ============================================
-- 1. COMPLETE SUBSCRIPTION OVERVIEW
-- ============================================
-- View all tenants with their subscription details
SELECT 
  t.id as tenant_id,
  t.company_name,
  t.tenant_type,
  t.status as tenant_status,
  t.created_at as tenant_created,
  ts.id as subscription_id,
  ts.status as subscription_status,
  ts.is_trial,
  ts.plan_id,
  sp.name as plan_name,
  sp.slug as plan_slug,
  ts.billing_cycle,
  ts.trial_start_date,
  ts.trial_end_date,
  ts.subscription_start_date,
  ts.subscription_end_date,
  ts.current_period_start,
  ts.current_period_end,
  ts.auto_renew,
  ts.last_payment_date,
  ts.last_payment_amount,
  CASE 
    WHEN ts.is_trial AND ts.trial_end_date > NOW() THEN 'ON_TRIAL'
    WHEN ts.is_trial AND ts.trial_end_date <= NOW() THEN 'TRIAL_EXPIRED'
    WHEN NOT ts.is_trial AND ts.subscription_end_date > NOW() THEN 'ACTIVE'
    WHEN NOT ts.is_trial AND ts.subscription_end_date <= NOW() THEN 'SUBSCRIPTION_EXPIRED'
    ELSE 'UNKNOWN'
  END as calculated_status
FROM tenants t
LEFT JOIN tenant_subscriptions ts ON t.id = ts.tenant_id
LEFT JOIN subscription_plans sp ON ts.plan_id = sp.id
WHERE t.status != 'deleted'
ORDER BY t.created_at DESC;


-- ============================================
-- 2. SUBSCRIPTION DATA VALIDATION ISSUES
-- ============================================
-- Find tenants with potential subscription data issues
WITH subscription_issues AS (
  SELECT 
    t.id as tenant_id,
    t.company_name,
    t.status as tenant_status,
    CASE
      WHEN ts.id IS NULL THEN 'NO_SUBSCRIPTION_RECORD'
      WHEN ts.plan_id IS NULL THEN 'MISSING_PLAN_ID'
      WHEN sp.id IS NULL THEN 'PLAN_NOT_FOUND_IN_DB'
      WHEN ts.is_trial = true AND ts.trial_start_date IS NULL THEN 'TRIAL_NO_START_DATE'
      WHEN ts.is_trial = true AND ts.trial_end_date IS NULL THEN 'TRIAL_NO_END_DATE'
      WHEN ts.is_trial = false AND ts.subscription_start_date IS NULL THEN 'SUBSCRIPTION_NO_START_DATE'
      WHEN ts.is_trial = false AND ts.subscription_end_date IS NULL THEN 'SUBSCRIPTION_NO_END_DATE'
      WHEN ts.status = 'active' AND ts.subscription_end_date <= NOW() THEN 'STATUS_ACTIVE_BUT_EXPIRED'
      WHEN ts.is_trial = false AND ts.last_payment_date IS NULL THEN 'SUBSCRIPTION_NO_PAYMENT_DATE'
    END as issue_type,
    ts.status as subscription_status,
    ts.is_trial,
    sp.name as plan_name
  FROM tenants t
  LEFT JOIN tenant_subscriptions ts ON t.id = ts.tenant_id
  LEFT JOIN subscription_plans sp ON ts.plan_id = sp.id
  WHERE t.status != 'deleted'
)
SELECT * FROM subscription_issues
WHERE issue_type IS NOT NULL
ORDER BY tenant_id;


-- ============================================
-- 3. TENANTS BY SUBSCRIPTION STATE
-- ============================================
-- Count tenants in each subscription state
SELECT 
  CASE 
    WHEN ts.is_trial AND ts.trial_end_date > NOW() THEN 'ON_TRIAL'
    WHEN ts.is_trial AND ts.trial_end_date <= NOW() THEN 'TRIAL_EXPIRED'
    WHEN NOT ts.is_trial AND ts.subscription_end_date > NOW() THEN 'ACTIVE_SUBSCRIPTION'
    WHEN NOT ts.is_trial AND ts.subscription_end_date <= NOW() THEN 'SUBSCRIPTION_EXPIRED'
    WHEN ts.id IS NULL THEN 'NO_SUBSCRIPTION'
    ELSE 'UNKNOWN'
  END as subscription_state,
  COUNT(DISTINCT t.id) as tenant_count,
  COUNT(DISTINCT CASE WHEN t.status = 'active' THEN t.id END) as active_tenants,
  COUNT(DISTINCT CASE WHEN t.status = 'inactive' THEN t.id END) as inactive_tenants
FROM tenants t
LEFT JOIN tenant_subscriptions ts ON t.id = ts.tenant_id
WHERE t.status != 'deleted'
GROUP BY subscription_state
ORDER BY tenant_count DESC;


-- ============================================
-- 4. EXPIRING SOON (15 DAYS)
-- ============================================
-- Find subscriptions expiring within 15 days
SELECT 
  t.id as tenant_id,
  t.company_name,
  sp.name as plan_name,
  ts.subscription_end_date,
  EXTRACT(DAY FROM (ts.subscription_end_date - NOW())) as days_remaining,
  ts.status as current_status,
  ts.last_payment_date,
  ts.last_payment_amount
FROM tenants t
JOIN tenant_subscriptions ts ON t.id = ts.tenant_id
JOIN subscription_plans sp ON ts.plan_id = sp.id
WHERE ts.subscription_end_date BETWEEN NOW() AND NOW() + INTERVAL '15 days'
  AND NOT ts.is_trial
  AND ts.status = 'active'
ORDER BY ts.subscription_end_date ASC;


-- ============================================
-- 5. TRIAL EXPIRING SOON (15 DAYS)
-- ============================================
-- Find trials expiring within 15 days
SELECT 
  t.id as tenant_id,
  t.company_name,
  sp.name as plan_name,
  ts.trial_end_date,
  EXTRACT(DAY FROM (ts.trial_end_date - NOW())) as days_remaining,
  ts.last_payment_date,
  CASE WHEN ts.last_payment_date IS NOT NULL THEN 'PAYMENT_MADE' ELSE 'NO_PAYMENT' END as payment_status
FROM tenants t
JOIN tenant_subscriptions ts ON t.id = ts.tenant_id
JOIN subscription_plans sp ON ts.plan_id = sp.id
WHERE ts.trial_end_date BETWEEN NOW() AND NOW() + INTERVAL '15 days'
  AND ts.is_trial = true
ORDER BY ts.trial_end_date ASC;


-- ============================================
-- 6. PLAN USAGE ANALYSIS
-- ============================================
-- Which plans are most commonly used
SELECT 
  sp.id as plan_id,
  sp.name as plan_name,
  sp.tenant_type,
  sp.price_monthly,
  sp.price_yearly,
  COUNT(ts.id) as active_subscriptions,
  COUNT(CASE WHEN ts.is_trial = true THEN 1 END) as trial_subscriptions,
  COUNT(CASE WHEN ts.is_trial = false THEN 1 END) as paid_subscriptions,
  SUM(CASE WHEN ts.last_payment_amount IS NOT NULL THEN ts.last_payment_amount ELSE 0 END) as total_revenue
FROM subscription_plans sp
LEFT JOIN tenant_subscriptions ts ON sp.id = ts.plan_id
WHERE sp.is_active = true
GROUP BY sp.id, sp.name, sp.tenant_type, sp.price_monthly, sp.price_yearly
ORDER BY active_subscriptions DESC;


-- ============================================
-- 7. MISSING SUBSCRIPTION DATES
-- ============================================
-- Find subscriptions missing critical dates
SELECT 
  t.id as tenant_id,
  t.company_name,
  ts.id as subscription_id,
  ts.is_trial,
  ts.status,
  ts.trial_start_date IS NULL as missing_trial_start,
  ts.trial_end_date IS NULL as missing_trial_end,
  ts.subscription_start_date IS NULL as missing_sub_start,
  ts.subscription_end_date IS NULL as missing_sub_end,
  ts.current_period_start IS NULL as missing_period_start,
  ts.current_period_end IS NULL as missing_period_end,
  ts.created_at
FROM tenants t
JOIN tenant_subscriptions ts ON t.id = ts.tenant_id
WHERE (
  (ts.is_trial = true AND (ts.trial_start_date IS NULL OR ts.trial_end_date IS NULL))
  OR (ts.is_trial = false AND (ts.subscription_start_date IS NULL OR ts.subscription_end_date IS NULL))
  OR ts.current_period_start IS NULL
  OR ts.current_period_end IS NULL
)
ORDER BY ts.created_at DESC;


-- ============================================
-- 8. BILLING CYCLE DISTRIBUTION
-- ============================================
-- Distribution of billing cycles
SELECT 
  ts.billing_cycle,
  COUNT(ts.id) as subscription_count,
  COUNT(CASE WHEN ts.is_trial = true THEN 1 END) as trial_count,
  COUNT(CASE WHEN ts.is_trial = false THEN 1 END) as paid_count,
  ROUND(AVG(CASE WHEN sp.price_monthly IS NOT NULL THEN sp.price_monthly ELSE 0 END), 2) as avg_monthly_price,
  ROUND(AVG(CASE WHEN sp.price_yearly IS NOT NULL THEN sp.price_yearly ELSE 0 END), 2) as avg_yearly_price
FROM tenant_subscriptions ts
LEFT JOIN subscription_plans sp ON ts.plan_id = sp.id
GROUP BY ts.billing_cycle
ORDER BY subscription_count DESC;


-- ============================================
-- 9. PAYMENT HISTORY
-- ============================================
-- Payment records with subscription details
SELECT 
  t.company_name,
  sp.name as plan_name,
  ts.last_payment_date,
  ts.last_payment_amount,
  ts.billing_cycle,
  ts.subscription_end_date,
  EXTRACT(DAY FROM (ts.subscription_end_date - ts.last_payment_date)) as days_between_payment_and_expiry
FROM tenants t
JOIN tenant_subscriptions ts ON t.id = ts.tenant_id
JOIN subscription_plans sp ON ts.plan_id = sp.id
WHERE ts.last_payment_date IS NOT NULL
ORDER BY ts.last_payment_date DESC;


-- ============================================
-- 10. SUBSCRIPTION CHANGE REQUESTS (Pending)
-- ============================================
-- Track plan change requests
SELECT 
  scr.id,
  t.company_name,
  sp_from.name as from_plan,
  sp_to.name as to_plan,
  scr.change_type,
  scr.status,
  scr.requested_at,
  scr.effective_at,
  scr.processed_at,
  CASE 
    WHEN scr.status = 'scheduled' AND scr.effective_at <= NOW() THEN 'OVERDUE'
    WHEN scr.status = 'pending' THEN 'AWAITING_PROCESSING'
    ELSE scr.status
  END as change_status
FROM subscription_change_requests scr
JOIN tenants t ON scr.tenant_id = t.id
LEFT JOIN subscription_plans sp_from ON scr.from_plan_id = sp_from.id
LEFT JOIN subscription_plans sp_to ON scr.to_plan_id = sp_to.id
WHERE scr.status IN ('pending', 'scheduled')
ORDER BY scr.effective_at ASC;


-- ============================================
-- 11. CONSISTENCY CHECK
-- ============================================
-- Validate subscription consistency
SELECT 
  t.id as tenant_id,
  t.company_name,
  t.subscription_plan_id as tenant_plan,
  ts.plan_id as subscription_plan,
  CASE WHEN t.subscription_plan_id != ts.plan_id THEN 'MISMATCH' ELSE 'OK' END as plan_consistency,
  ts.is_trial,
  ts.status as subscription_status,
  CASE 
    WHEN ts.is_trial = true AND ts.trial_end_date > NOW() THEN 'VALID'
    WHEN ts.is_trial = true AND ts.trial_end_date <= NOW() THEN 'EXPIRED'
    WHEN ts.is_trial = false AND ts.subscription_end_date > NOW() THEN 'VALID'
    WHEN ts.is_trial = false AND ts.subscription_end_date <= NOW() THEN 'EXPIRED'
  END as date_validity
FROM tenants t
LEFT JOIN tenant_subscriptions ts ON t.id = ts.tenant_id
WHERE t.status != 'deleted'
  AND (t.subscription_plan_id != ts.plan_id OR ts.id IS NULL)
ORDER BY t.created_at DESC;


-- ============================================
-- 12. TENANT BY COMPANY TYPE
-- ============================================
-- Subscription stats by tenant type
SELECT 
  t.tenant_type,
  COUNT(DISTINCT t.id) as total_tenants,
  COUNT(DISTINCT CASE WHEN ts.is_trial = true THEN t.id END) as on_trial,
  COUNT(DISTINCT CASE WHEN ts.is_trial = false THEN t.id END) as paid,
  COUNT(DISTINCT sp.id) as available_plans,
  STRING_AGG(DISTINCT sp.name, ', ' ORDER BY sp.name) as plan_names
FROM tenants t
LEFT JOIN tenant_subscriptions ts ON t.id = ts.tenant_id
LEFT JOIN subscription_plans sp ON sp.tenant_type = t.tenant_type AND sp.is_active = true
WHERE t.status != 'deleted'
GROUP BY t.tenant_type
ORDER BY total_tenants DESC;
