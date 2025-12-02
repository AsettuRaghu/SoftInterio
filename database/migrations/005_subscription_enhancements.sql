-- =====================================================
-- SoftInterio Subscription Enhancements Migration
-- =====================================================
-- Description: Adds new subscription management features
-- This is an INCREMENTAL migration - safe to run on existing data
-- 
-- Run this AFTER the base schema is in place
-- =====================================================

-- =====================================================
-- 1. CREATE SYSTEM_CONFIG TABLE (if not exists)
-- =====================================================

CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT
);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);

COMMENT ON TABLE system_config IS 'System-wide configuration. Changes only affect new signups.';

-- =====================================================
-- 2. ADD NEW COLUMNS TO TENANT_SUBSCRIPTIONS
-- =====================================================

-- Add trial_days_granted column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_subscriptions' 
                   AND column_name = 'trial_days_granted') THEN
        ALTER TABLE tenant_subscriptions ADD COLUMN trial_days_granted INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add subscription_start_date column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_subscriptions' 
                   AND column_name = 'subscription_start_date') THEN
        ALTER TABLE tenant_subscriptions ADD COLUMN subscription_start_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add subscription_end_date column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_subscriptions' 
                   AND column_name = 'subscription_end_date') THEN
        ALTER TABLE tenant_subscriptions ADD COLUMN subscription_end_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add grace_period_days column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_subscriptions' 
                   AND column_name = 'grace_period_days') THEN
        ALTER TABLE tenant_subscriptions ADD COLUMN grace_period_days INTEGER DEFAULT 7;
    END IF;
END $$;

-- Add grace_period_end column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_subscriptions' 
                   AND column_name = 'grace_period_end') THEN
        ALTER TABLE tenant_subscriptions ADD COLUMN grace_period_end TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add auto_renew column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_subscriptions' 
                   AND column_name = 'auto_renew') THEN
        ALTER TABLE tenant_subscriptions ADD COLUMN auto_renew BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- Add next_billing_date column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_subscriptions' 
                   AND column_name = 'next_billing_date') THEN
        ALTER TABLE tenant_subscriptions ADD COLUMN next_billing_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add last_payment_date column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_subscriptions' 
                   AND column_name = 'last_payment_date') THEN
        ALTER TABLE tenant_subscriptions ADD COLUMN last_payment_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add last_payment_amount column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_subscriptions' 
                   AND column_name = 'last_payment_amount') THEN
        ALTER TABLE tenant_subscriptions ADD COLUMN last_payment_amount DECIMAL(10,2);
    END IF;
END $$;

-- Add cancellation_effective_date column
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tenant_subscriptions' 
                   AND column_name = 'cancellation_effective_date') THEN
        ALTER TABLE tenant_subscriptions ADD COLUMN cancellation_effective_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- =====================================================
-- 3. ADD NEW INDEXES (if not exist)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_trial_end ON tenant_subscriptions(trial_end_date);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_sub_end ON tenant_subscriptions(subscription_end_date);

-- =====================================================
-- 4. CREATE TENANT_USAGE TABLE (if not exists)
-- =====================================================

CREATE TABLE IF NOT EXISTS tenant_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    current_users INTEGER NOT NULL DEFAULT 0,
    current_projects INTEGER NOT NULL DEFAULT 0,
    active_projects INTEGER NOT NULL DEFAULT 0,
    storage_used_bytes BIGINT NOT NULL DEFAULT 0,
    documents_count INTEGER NOT NULL DEFAULT 0,
    clients_count INTEGER NOT NULL DEFAULT 0,
    quotations_this_month INTEGER NOT NULL DEFAULT 0,
    invoices_this_month INTEGER NOT NULL DEFAULT 0,
    last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tenant_usage ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tenant_usage_tenant_id ON tenant_usage(tenant_id);

-- =====================================================
-- 5. INSERT SYSTEM CONFIG (if not exists)
-- =====================================================

-- Trial Configuration
INSERT INTO system_config (config_key, config_value, description, updated_by)
VALUES (
    'trial_settings',
    '{
        "enabled": true,
        "trial_days": 30,
        "default_plan_slug": "signature",
        "require_payment_method": false,
        "auto_expire": true,
        "grace_period_days": 7
    }'::jsonb,
    'Trial period settings. Changes only affect NEW signups.',
    'system'
)
ON CONFLICT (config_key) DO NOTHING;

-- Billing Configuration
INSERT INTO system_config (config_key, config_value, description, updated_by)
VALUES (
    'billing_settings',
    '{
        "enabled_cycles": ["yearly"],
        "default_cycle": "yearly",
        "allow_monthly": false,
        "currency": "INR",
        "tax_rate": 18,
        "tax_name": "GST",
        "warning_days_threshold": 30,
        "payment_gateway": "razorpay"
    }'::jsonb,
    'Billing configuration.',
    'system'
)
ON CONFLICT (config_key) DO NOTHING;

-- Subscription Limits Configuration
INSERT INTO system_config (config_key, config_value, description, updated_by)
VALUES (
    'subscription_limits',
    '{
        "enforce_user_limits": true,
        "enforce_project_limits": true,
        "enforce_storage_limits": true,
        "overage_allowed": false,
        "overage_notification_threshold": 80
    }'::jsonb,
    'How subscription limits are enforced.',
    'system'
)
ON CONFLICT (config_key) DO NOTHING;

-- Feature Flags
INSERT INTO system_config (config_key, config_value, description, updated_by)
VALUES (
    'feature_flags',
    '{
        "payments_enabled": false,
        "invoicing_enabled": true,
        "multi_currency": false,
        "white_label": false,
        "api_access": false
    }'::jsonb,
    'Feature flags for enabling/disabling major features.',
    'system'
)
ON CONFLICT (config_key) DO NOTHING;

-- =====================================================
-- 6. CREATE/REPLACE HELPER FUNCTIONS
-- =====================================================

-- Initialize tenant subscription function
CREATE OR REPLACE FUNCTION initialize_tenant_subscription(p_tenant_id UUID)
RETURNS UUID AS $$
DECLARE
    v_trial_config JSONB;
    v_billing_config JSONB;
    v_trial_enabled BOOLEAN;
    v_trial_days INTEGER;
    v_default_plan_slug TEXT;
    v_grace_period_days INTEGER;
    v_default_cycle TEXT;
    v_plan_id UUID;
    v_subscription_id UUID;
    v_now TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP;
    v_trial_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get trial settings from system_config
    SELECT config_value INTO v_trial_config
    FROM system_config WHERE config_key = 'trial_settings';
    
    -- Get billing settings
    SELECT config_value INTO v_billing_config
    FROM system_config WHERE config_key = 'billing_settings';
    
    -- Extract values with defaults
    v_trial_enabled := COALESCE((v_trial_config->>'enabled')::BOOLEAN, true);
    v_trial_days := COALESCE((v_trial_config->>'trial_days')::INTEGER, 30);
    v_default_plan_slug := COALESCE(v_trial_config->>'default_plan_slug', 'signature');
    v_grace_period_days := COALESCE((v_trial_config->>'grace_period_days')::INTEGER, 7);
    v_default_cycle := COALESCE(v_billing_config->>'default_cycle', 'yearly');
    
    -- Get the default plan ID
    SELECT id INTO v_plan_id
    FROM subscription_plans
    WHERE slug = v_default_plan_slug AND is_active = true
    LIMIT 1;
    
    -- Fallback to any active plan if default not found
    IF v_plan_id IS NULL THEN
        SELECT id INTO v_plan_id
        FROM subscription_plans
        WHERE is_active = true
        ORDER BY display_order
        LIMIT 1;
    END IF;
    
    -- Calculate dates based on trial settings
    IF v_trial_enabled AND v_trial_days > 0 THEN
        v_trial_end := v_now + (v_trial_days || ' days')::INTERVAL;
        
        INSERT INTO tenant_subscriptions (
            tenant_id, plan_id, status, billing_cycle,
            is_trial, trial_days_granted, trial_start_date, trial_end_date,
            current_period_start, current_period_end,
            grace_period_days, auto_renew
        ) VALUES (
            p_tenant_id, v_plan_id, 'trial', v_default_cycle::billing_cycle_enum,
            true, v_trial_days, v_now, v_trial_end,
            v_now, v_trial_end,
            v_grace_period_days, true
        )
        RETURNING id INTO v_subscription_id;
    ELSE
        INSERT INTO tenant_subscriptions (
            tenant_id, plan_id, status, billing_cycle,
            is_trial, trial_days_granted,
            subscription_start_date, subscription_end_date,
            current_period_start, current_period_end,
            grace_period_days, auto_renew
        ) VALUES (
            p_tenant_id, v_plan_id, 'active', v_default_cycle::billing_cycle_enum,
            false, 0,
            v_now, v_now + INTERVAL '1 year',
            v_now, v_now + INTERVAL '1 year',
            v_grace_period_days, true
        )
        RETURNING id INTO v_subscription_id;
    END IF;
    
    -- Initialize tenant_usage
    INSERT INTO tenant_usage (tenant_id, current_users, current_projects, storage_used_bytes)
    VALUES (p_tenant_id, 1, 0, 0)
    ON CONFLICT (tenant_id) DO NOTHING;
    
    -- Update tenant's subscription_plan_id
    UPDATE tenants SET subscription_plan_id = v_plan_id WHERE id = p_tenant_id;
    
    RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get subscription status function
CREATE OR REPLACE FUNCTION get_subscription_status(p_tenant_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
    v_now TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP;
    v_warning_days INTEGER;
    v_billing_config JSONB;
BEGIN
    SELECT config_value INTO v_billing_config
    FROM system_config WHERE config_key = 'billing_settings';
    
    v_warning_days := COALESCE((v_billing_config->>'warning_days_threshold')::INTEGER, 30);
    
    SELECT json_build_object(
        'subscription_id', ts.id,
        'status', ts.status,
        'billing_cycle', ts.billing_cycle,
        'is_trial', ts.is_trial,
        'trial_days_granted', ts.trial_days_granted,
        'trial_start_date', ts.trial_start_date,
        'trial_end_date', ts.trial_end_date,
        'trial_days_remaining', 
            CASE WHEN ts.is_trial AND ts.trial_end_date IS NOT NULL 
                THEN GREATEST(0, EXTRACT(DAY FROM ts.trial_end_date - v_now)::INTEGER)
                ELSE NULL 
            END,
        'subscription_start_date', ts.subscription_start_date,
        'subscription_end_date', ts.subscription_end_date,
        'subscription_days_remaining',
            CASE WHEN ts.subscription_end_date IS NOT NULL 
                THEN GREATEST(0, EXTRACT(DAY FROM ts.subscription_end_date - v_now)::INTEGER)
                ELSE NULL 
            END,
        'grace_period_days', ts.grace_period_days,
        'show_trial_warning',
            CASE WHEN ts.is_trial AND ts.trial_end_date IS NOT NULL 
                THEN EXTRACT(DAY FROM ts.trial_end_date - v_now) <= v_warning_days
                ELSE false 
            END,
        'show_subscription_warning',
            CASE WHEN NOT ts.is_trial AND ts.subscription_end_date IS NOT NULL 
                THEN EXTRACT(DAY FROM ts.subscription_end_date - v_now) <= v_warning_days
                ELSE false 
            END,
        'show_pay_button',
            CASE 
                WHEN ts.is_trial AND ts.trial_end_date IS NOT NULL 
                    AND EXTRACT(DAY FROM ts.trial_end_date - v_now) <= v_warning_days THEN true
                WHEN NOT ts.is_trial AND ts.subscription_end_date IS NOT NULL 
                    AND EXTRACT(DAY FROM ts.subscription_end_date - v_now) <= v_warning_days THEN true
                WHEN ts.status IN ('expired', 'past_due') THEN true
                ELSE false 
            END,
        'plan', json_build_object(
            'id', sp.id,
            'name', sp.name,
            'slug', sp.slug,
            'price_yearly', sp.price_yearly
        ),
        'auto_renew', ts.auto_renew
    ) INTO result
    FROM tenant_subscriptions ts
    LEFT JOIN subscription_plans sp ON sp.id = ts.plan_id
    WHERE ts.tenant_id = p_tenant_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. INITIALIZE EXISTING TENANTS
-- =====================================================
-- Create subscriptions for tenants that don't have one

DO $$
DECLARE
    v_tenant RECORD;
    v_plan_id UUID;
    v_now TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP;
    v_trial_end TIMESTAMP WITH TIME ZONE;
    v_count INTEGER := 0;
BEGIN
    -- Get default plan
    SELECT id INTO v_plan_id
    FROM subscription_plans
    WHERE slug = 'signature' AND is_active = true
    LIMIT 1;
    
    IF v_plan_id IS NULL THEN
        SELECT id INTO v_plan_id
        FROM subscription_plans
        WHERE is_active = true
        ORDER BY display_order
        LIMIT 1;
    END IF;
    
    IF v_plan_id IS NULL THEN
        RAISE NOTICE 'No active subscription plans found. Skipping tenant initialization.';
        RETURN;
    END IF;
    
    v_trial_end := v_now + INTERVAL '30 days';
    
    FOR v_tenant IN 
        SELECT t.id, t.company_name
        FROM tenants t
        WHERE NOT EXISTS (
            SELECT 1 FROM tenant_subscriptions ts WHERE ts.tenant_id = t.id
        )
    LOOP
        INSERT INTO tenant_subscriptions (
            tenant_id, plan_id, status, billing_cycle,
            is_trial, trial_days_granted, trial_start_date, trial_end_date,
            current_period_start, current_period_end,
            grace_period_days, auto_renew
        ) VALUES (
            v_tenant.id, v_plan_id, 'trial', 'yearly',
            true, 30, v_now, v_trial_end,
            v_now, v_trial_end,
            7, true
        );
        
        UPDATE tenants SET subscription_plan_id = v_plan_id WHERE id = v_tenant.id;
        
        INSERT INTO tenant_usage (tenant_id, current_users, current_projects, storage_used_bytes)
        VALUES (
            v_tenant.id,
            (SELECT COUNT(*) FROM users WHERE tenant_id = v_tenant.id AND status = 'active'),
            0, 0
        )
        ON CONFLICT (tenant_id) DO UPDATE SET
            current_users = (SELECT COUNT(*) FROM users WHERE tenant_id = v_tenant.id AND status = 'active'),
            updated_at = CURRENT_TIMESTAMP;
        
        v_count := v_count + 1;
        RAISE NOTICE 'Initialized subscription for: %', v_tenant.company_name;
    END LOOP;
    
    RAISE NOTICE 'Initialized % tenant subscriptions', v_count;
END $$;

-- =====================================================
-- 8. ADD RLS POLICIES FOR NEW TABLES
-- =====================================================

-- System config - no user access (admin only via service role)
DROP POLICY IF EXISTS system_config_select ON system_config;

-- Tenant usage policies
DROP POLICY IF EXISTS tenant_usage_select ON tenant_usage;
CREATE POLICY tenant_usage_select ON tenant_usage
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_super_admin = true)
    );

DROP POLICY IF EXISTS tenant_usage_update ON tenant_usage;
CREATE POLICY tenant_usage_update ON tenant_usage
    FOR UPDATE USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- 
-- Summary:
-- - Added system_config table with trial/billing settings
-- - Added new columns to tenant_subscriptions for enhanced tracking
-- - Created tenant_usage table
-- - Added helper functions for subscription management
-- - Initialized existing tenants with trial subscriptions
-- =====================================================
