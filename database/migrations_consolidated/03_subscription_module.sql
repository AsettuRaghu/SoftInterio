-- =====================================================
-- SoftInterio Subscription & Billing Module
-- =====================================================
-- Module: Subscription Management
-- Description: Subscription plans, tenant subscriptions, usage tracking,
--              invoices, payment methods, and billing functions
-- Target: Supabase (PostgreSQL with auth integration)
-- 
-- Run Order: 3 (After core schema and policies)
-- =====================================================

-- =====================================================
-- SECTION 1: ENUMS
-- =====================================================

DROP TYPE IF EXISTS billing_cycle_enum CASCADE;
DROP TYPE IF EXISTS subscription_status_enum CASCADE;
DROP TYPE IF EXISTS invoice_status_enum CASCADE;
DROP TYPE IF EXISTS plan_change_type_enum CASCADE;
DROP TYPE IF EXISTS plan_change_status_enum CASCADE;

-- Billing Cycle
CREATE TYPE billing_cycle_enum AS ENUM ('monthly', 'yearly');

-- Subscription Status
CREATE TYPE subscription_status_enum AS ENUM ('trial', 'active', 'past_due', 'cancelled', 'expired');

-- Invoice Status
CREATE TYPE invoice_status_enum AS ENUM ('draft', 'pending', 'paid', 'failed', 'refunded', 'cancelled');

-- Plan Change Types
CREATE TYPE plan_change_type_enum AS ENUM ('upgrade', 'downgrade', 'cancel', 'reactivate');
CREATE TYPE plan_change_status_enum AS ENUM ('pending', 'scheduled', 'completed', 'failed', 'cancelled');

-- =====================================================
-- SECTION 2: SUBSCRIPTION PLANS TABLE
-- =====================================================

CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    tenant_type tenant_type_enum NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
    price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0,
    max_users INTEGER NOT NULL DEFAULT 5,
    max_projects INTEGER,
    max_storage_gb DECIMAL(10,2) NOT NULL DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_plan_slug_per_type UNIQUE(tenant_type, slug)
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_subscription_plans_tenant_type ON subscription_plans(tenant_type);
CREATE INDEX idx_subscription_plans_is_active ON subscription_plans(is_active);

-- Add FK for tenants.subscription_plan_id
ALTER TABLE tenants 
    ADD CONSTRAINT fk_tenants_subscription_plan 
    FOREIGN KEY (subscription_plan_id) 
    REFERENCES subscription_plans(id) 
    ON DELETE SET NULL;

-- =====================================================
-- SECTION 3: SUBSCRIPTION PLAN FEATURES TABLE
-- =====================================================

CREATE TABLE subscription_plan_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
    feature_key VARCHAR(100) NOT NULL,
    feature_name VARCHAR(255) NOT NULL,
    included BOOLEAN DEFAULT TRUE,
    limit_value INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_plan_feature UNIQUE(plan_id, feature_key)
);

ALTER TABLE subscription_plan_features ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_plan_features_plan_id ON subscription_plan_features(plan_id);

-- =====================================================
-- SECTION 4: TENANT SUBSCRIPTIONS TABLE
-- =====================================================

CREATE TABLE tenant_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    
    -- Current status
    status subscription_status_enum NOT NULL DEFAULT 'trial',
    billing_cycle billing_cycle_enum NOT NULL DEFAULT 'yearly',
    
    -- Trial information (locked at signup time)
    is_trial BOOLEAN DEFAULT FALSE,
    trial_days_granted INTEGER DEFAULT 0,
    trial_start_date TIMESTAMP WITH TIME ZONE,
    trial_end_date TIMESTAMP WITH TIME ZONE,
    
    -- Subscription period
    subscription_start_date TIMESTAMP WITH TIME ZONE,
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    
    -- Current billing period
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    
    -- Grace period
    grace_period_days INTEGER DEFAULT 7,
    grace_period_end TIMESTAMP WITH TIME ZONE,
    
    -- Payment & Renewal
    auto_renew BOOLEAN DEFAULT TRUE,
    next_billing_date TIMESTAMP WITH TIME ZONE,
    last_payment_date TIMESTAMP WITH TIME ZONE,
    last_payment_amount DECIMAL(10,2),
    
    -- Cancellation
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    cancellation_effective_date TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tenant_subscriptions_tenant_id ON tenant_subscriptions(tenant_id);
CREATE INDEX idx_tenant_subscriptions_status ON tenant_subscriptions(status);
CREATE INDEX idx_tenant_subscriptions_plan_id ON tenant_subscriptions(plan_id);
CREATE INDEX idx_tenant_subscriptions_trial_end ON tenant_subscriptions(trial_end_date);
CREATE INDEX idx_tenant_subscriptions_sub_end ON tenant_subscriptions(subscription_end_date);

COMMENT ON TABLE tenant_subscriptions IS 'Tenant subscription state. Trial terms locked at signup.';
COMMENT ON COLUMN tenant_subscriptions.trial_days_granted IS 'Days of trial granted at signup (from system_config at that time)';
COMMENT ON COLUMN tenant_subscriptions.subscription_start_date IS 'When paid subscription begins (after trial or immediately)';
COMMENT ON COLUMN tenant_subscriptions.grace_period_days IS 'Days after expiry before account suspension';

-- =====================================================
-- SECTION 5: SUBSCRIPTION ADDONS TABLE
-- =====================================================

CREATE TABLE subscription_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    addon_key VARCHAR(100) NOT NULL,
    addon_name VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 1,
    price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE subscription_addons ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_subscription_addons_tenant_id ON subscription_addons(tenant_id);

-- =====================================================
-- SECTION 6: TENANT USAGE TABLE
-- =====================================================

CREATE TABLE tenant_usage (
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

CREATE INDEX idx_tenant_usage_tenant_id ON tenant_usage(tenant_id);

-- =====================================================
-- SECTION 7: TENANT USAGE HISTORY TABLE
-- =====================================================

CREATE TABLE tenant_usage_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    users_count INTEGER NOT NULL DEFAULT 0,
    projects_count INTEGER NOT NULL DEFAULT 0,
    storage_bytes BIGINT NOT NULL DEFAULT 0,
    snapshot_date DATE NOT NULL,
    snapshot_type VARCHAR(20) NOT NULL DEFAULT 'daily',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_tenant_snapshot UNIQUE(tenant_id, snapshot_date, snapshot_type)
);

ALTER TABLE tenant_usage_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tenant_usage_history_tenant ON tenant_usage_history(tenant_id);
CREATE INDEX idx_tenant_usage_history_date ON tenant_usage_history(snapshot_date);

-- =====================================================
-- SECTION 8: SUBSCRIPTION INVOICES TABLE
-- =====================================================

CREATE TABLE subscription_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL,
    description TEXT,
    subtotal INTEGER NOT NULL DEFAULT 0,
    tax_amount INTEGER NOT NULL DEFAULT 0,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    status invoice_status_enum NOT NULL DEFAULT 'pending',
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_method VARCHAR(50),
    payment_provider VARCHAR(50),
    payment_provider_invoice_id VARCHAR(255),
    invoice_pdf_url TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_subscription_invoices_tenant ON subscription_invoices(tenant_id);
CREATE INDEX idx_subscription_invoices_status ON subscription_invoices(status);
CREATE INDEX idx_subscription_invoices_created ON subscription_invoices(created_at DESC);

-- =====================================================
-- SECTION 9: TENANT PAYMENT METHODS TABLE
-- =====================================================

CREATE TABLE tenant_payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_customer_id VARCHAR(255),
    provider_payment_method_id VARCHAR(255),
    card_brand VARCHAR(20),
    card_last_four VARCHAR(4),
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    is_default BOOLEAN DEFAULT FALSE,
    is_valid BOOLEAN DEFAULT TRUE,
    billing_name VARCHAR(255),
    billing_email VARCHAR(255),
    billing_address_line1 TEXT,
    billing_address_line2 TEXT,
    billing_city VARCHAR(100),
    billing_state VARCHAR(100),
    billing_postal_code VARCHAR(20),
    billing_country CHAR(2) DEFAULT 'IN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tenant_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tenant_payment_methods_tenant ON tenant_payment_methods(tenant_id);
CREATE UNIQUE INDEX idx_tenant_payment_methods_default 
    ON tenant_payment_methods(tenant_id) 
    WHERE is_default = TRUE;

-- =====================================================
-- SECTION 10: SUBSCRIPTION CHANGE REQUESTS TABLE
-- =====================================================

CREATE TABLE subscription_change_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    change_type plan_change_type_enum NOT NULL,
    from_plan_id UUID REFERENCES subscription_plans(id),
    to_plan_id UUID REFERENCES subscription_plans(id),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    effective_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    status plan_change_status_enum NOT NULL DEFAULT 'pending',
    proration_amount INTEGER,
    requested_by UUID REFERENCES users(id),
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE subscription_change_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_subscription_change_requests_tenant ON subscription_change_requests(tenant_id);
CREATE INDEX idx_subscription_change_requests_status ON subscription_change_requests(status);

-- =====================================================
-- SECTION 11: TRIGGERS
-- =====================================================

-- Update triggers
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_subscriptions_updated_at BEFORE UPDATE ON tenant_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_addons_updated_at BEFORE UPDATE ON subscription_addons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_usage_updated_at BEFORE UPDATE ON tenant_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_invoices_updated_at BEFORE UPDATE ON subscription_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_payment_methods_updated_at BEFORE UPDATE ON tenant_payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_change_requests_updated_at BEFORE UPDATE ON subscription_change_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Invoice Number Generation
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.invoice_number := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || 
        LPAD(CAST((SELECT COUNT(*) + 1 FROM subscription_invoices 
            WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)) AS TEXT), 5, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_number
    BEFORE INSERT ON subscription_invoices
    FOR EACH ROW
    WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
    EXECUTE FUNCTION generate_invoice_number();

-- User Count Update Trigger
CREATE OR REPLACE FUNCTION trigger_update_user_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM update_tenant_usage(NEW.tenant_id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM update_tenant_usage(OLD.tenant_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_count_trigger ON users;
CREATE TRIGGER update_user_count_trigger
    AFTER INSERT OR UPDATE OF status OR DELETE ON users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_user_count();

-- =====================================================
-- SECTION 12: HELPER FUNCTIONS
-- =====================================================

-- Update tenant usage counts
CREATE OR REPLACE FUNCTION update_tenant_usage(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO tenant_usage (tenant_id, current_users, current_projects, active_projects, last_calculated_at)
    VALUES (
        p_tenant_id,
        (SELECT COUNT(*) FROM users WHERE tenant_id = p_tenant_id AND status = 'active'),
        0,
        0,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (tenant_id) DO UPDATE SET
        current_users = (SELECT COUNT(*) FROM users WHERE tenant_id = p_tenant_id AND status = 'active'),
        last_calculated_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get tenant usage with limits
CREATE OR REPLACE FUNCTION get_tenant_usage_with_limits(p_tenant_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'tenant_id', t.id,
        'plan', json_build_object(
            'id', sp.id,
            'name', sp.name,
            'slug', sp.slug
        ),
        'subscription', json_build_object(
            'status', ts.status,
            'billing_cycle', ts.billing_cycle,
            'is_trial', ts.is_trial,
            'trial_end_date', ts.trial_end_date,
            'current_period_end', ts.current_period_end
        ),
        'limits', json_build_object(
            'max_users', sp.max_users,
            'max_projects', sp.max_projects,
            'max_storage_gb', sp.max_storage_gb
        ),
        'usage', json_build_object(
            'current_users', COALESCE(tu.current_users, 0),
            'current_projects', COALESCE(tu.current_projects, 0),
            'storage_used_gb', ROUND(COALESCE(tu.storage_used_bytes, 0) / 1073741824.0, 2)
        ),
        'percentages', json_build_object(
            'users', CASE WHEN sp.max_users > 0 THEN ROUND((COALESCE(tu.current_users, 0)::NUMERIC / sp.max_users) * 100, 1) ELSE 0 END,
            'projects', CASE WHEN sp.max_projects > 0 THEN ROUND((COALESCE(tu.current_projects, 0)::NUMERIC / sp.max_projects) * 100, 1) ELSE 0 END,
            'storage', CASE WHEN sp.max_storage_gb > 0 THEN ROUND((COALESCE(tu.storage_used_bytes, 0) / 1073741824.0 / sp.max_storage_gb) * 100, 1) ELSE 0 END
        )
    ) INTO result
    FROM tenants t
    LEFT JOIN tenant_subscriptions ts ON ts.tenant_id = t.id
    LEFT JOIN subscription_plans sp ON sp.id = COALESCE(ts.plan_id, t.subscription_plan_id)
    LEFT JOIN tenant_usage tu ON tu.tenant_id = t.id
    WHERE t.id = p_tenant_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Initialize tenant subscription
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
    v_subscription_start TIMESTAMP WITH TIME ZONE;
    v_subscription_end TIMESTAMP WITH TIME ZONE;
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
        -- Trial is enabled
        v_trial_end := v_now + (v_trial_days || ' days')::INTERVAL;
        v_subscription_start := v_trial_end;
        v_subscription_end := NULL;
        
        INSERT INTO tenant_subscriptions (
            tenant_id, plan_id, status, billing_cycle,
            is_trial, trial_days_granted, trial_start_date, trial_end_date,
            subscription_start_date, subscription_end_date,
            current_period_start, current_period_end,
            grace_period_days, auto_renew
        ) VALUES (
            p_tenant_id, v_plan_id, 'trial', v_default_cycle::billing_cycle_enum,
            true, v_trial_days, v_now, v_trial_end,
            NULL, NULL,
            v_now, v_trial_end,
            v_grace_period_days, true
        )
        RETURNING id INTO v_subscription_id;
    ELSE
        -- No trial - immediate subscription (requires payment)
        v_subscription_start := v_now;
        IF v_default_cycle = 'yearly' THEN
            v_subscription_end := v_now + INTERVAL '1 year';
        ELSE
            v_subscription_end := v_now + INTERVAL '1 month';
        END IF;
        
        INSERT INTO tenant_subscriptions (
            tenant_id, plan_id, status, billing_cycle,
            is_trial, trial_days_granted, trial_start_date, trial_end_date,
            subscription_start_date, subscription_end_date,
            current_period_start, current_period_end,
            grace_period_days, auto_renew
        ) VALUES (
            p_tenant_id, v_plan_id, 'active', v_default_cycle::billing_cycle_enum,
            false, 0, NULL, NULL,
            v_subscription_start, v_subscription_end,
            v_subscription_start, v_subscription_end,
            v_grace_period_days, true
        )
        RETURNING id INTO v_subscription_id;
    END IF;
    
    -- Also initialize tenant_usage
    INSERT INTO tenant_usage (tenant_id, current_users, current_projects, storage_used_bytes)
    VALUES (p_tenant_id, 1, 0, 0)
    ON CONFLICT (tenant_id) DO NOTHING;
    
    -- Update tenant's subscription_plan_id
    UPDATE tenants SET subscription_plan_id = v_plan_id WHERE id = p_tenant_id;
    
    RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION initialize_tenant_subscription IS 'Creates subscription for new tenant based on current system_config. Trial terms are locked in at creation time.';

-- Get subscription status
CREATE OR REPLACE FUNCTION get_subscription_status(p_tenant_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
    v_now TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP;
    v_warning_days INTEGER;
    v_billing_config JSONB;
BEGIN
    -- Get warning threshold from config
    SELECT config_value INTO v_billing_config
    FROM system_config WHERE config_key = 'billing_settings';
    
    v_warning_days := COALESCE((v_billing_config->>'warning_days_threshold')::INTEGER, 30);
    
    SELECT json_build_object(
        'subscription_id', ts.id,
        'status', ts.status,
        'billing_cycle', ts.billing_cycle,
        
        -- Trial info
        'is_trial', ts.is_trial,
        'trial_days_granted', ts.trial_days_granted,
        'trial_start_date', ts.trial_start_date,
        'trial_end_date', ts.trial_end_date,
        'trial_days_remaining', 
            CASE WHEN ts.is_trial AND ts.trial_end_date IS NOT NULL 
                THEN GREATEST(0, EXTRACT(DAY FROM ts.trial_end_date - v_now)::INTEGER)
                ELSE NULL 
            END,
        
        -- Subscription info
        'subscription_start_date', ts.subscription_start_date,
        'subscription_end_date', ts.subscription_end_date,
        'subscription_days_remaining',
            CASE WHEN ts.subscription_end_date IS NOT NULL 
                THEN GREATEST(0, EXTRACT(DAY FROM ts.subscription_end_date - v_now)::INTEGER)
                ELSE NULL 
            END,
        
        -- Current period
        'current_period_start', ts.current_period_start,
        'current_period_end', ts.current_period_end,
        
        -- Grace period
        'grace_period_days', ts.grace_period_days,
        'grace_period_end', ts.grace_period_end,
        'is_in_grace_period', 
            CASE WHEN ts.status = 'expired' AND ts.grace_period_end IS NOT NULL 
                THEN v_now < ts.grace_period_end 
                ELSE false 
            END,
        
        -- Warning flags
        'warning_days_threshold', v_warning_days,
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
        
        -- Plan info
        'plan', json_build_object(
            'id', sp.id,
            'name', sp.name,
            'slug', sp.slug,
            'price_monthly', sp.price_monthly,
            'price_yearly', sp.price_yearly
        ),
        
        -- Payment info
        'auto_renew', ts.auto_renew,
        'next_billing_date', ts.next_billing_date,
        'last_payment_date', ts.last_payment_date,
        
        -- Cancellation
        'cancelled_at', ts.cancelled_at,
        'cancellation_effective_date', ts.cancellation_effective_date
    ) INTO result
    FROM tenant_subscriptions ts
    LEFT JOIN subscription_plans sp ON sp.id = ts.plan_id
    WHERE ts.tenant_id = p_tenant_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_subscription_status IS 'Returns comprehensive subscription status including warning flags for UI';

-- =====================================================
-- SECTION 13: RLS POLICIES
-- =====================================================

-- Subscription Plans (public read)
DROP POLICY IF EXISTS "subscription_plans_select" ON subscription_plans;
CREATE POLICY "subscription_plans_select"
    ON subscription_plans FOR SELECT
    USING (is_active = TRUE);

-- Subscription Plan Features (public read)
DROP POLICY IF EXISTS "subscription_plan_features_select" ON subscription_plan_features;
CREATE POLICY "subscription_plan_features_select"
    ON subscription_plan_features FOR SELECT
    USING (TRUE);

-- Tenant Subscriptions
DROP POLICY IF EXISTS "Users can view tenant subscription" ON tenant_subscriptions;
CREATE POLICY "Users can view tenant subscription"
    ON tenant_subscriptions FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Super admins can manage subscription" ON tenant_subscriptions;
CREATE POLICY "Super admins can manage subscription"
    ON tenant_subscriptions FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM users 
            WHERE id = auth.uid() AND is_super_admin = true
        )
    );

-- Subscription Addons
DROP POLICY IF EXISTS "Users can view tenant addons" ON subscription_addons;
CREATE POLICY "Users can view tenant addons"
    ON subscription_addons FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Tenant Usage
DROP POLICY IF EXISTS "tenant_usage_select" ON tenant_usage;
CREATE POLICY "tenant_usage_select"
    ON tenant_usage FOR SELECT
    USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_usage_update" ON tenant_usage;
CREATE POLICY "tenant_usage_update"
    ON tenant_usage FOR UPDATE
    USING (tenant_id = get_user_tenant_id());

-- Tenant Usage History
DROP POLICY IF EXISTS "tenant_usage_history_select" ON tenant_usage_history;
CREATE POLICY "tenant_usage_history_select"
    ON tenant_usage_history FOR SELECT
    USING (tenant_id = get_user_tenant_id());

-- Subscription Invoices
DROP POLICY IF EXISTS "subscription_invoices_select" ON subscription_invoices;
CREATE POLICY "subscription_invoices_select"
    ON subscription_invoices FOR SELECT
    USING (tenant_id = get_user_tenant_id());

-- Payment Methods
DROP POLICY IF EXISTS "tenant_payment_methods_select" ON tenant_payment_methods;
CREATE POLICY "tenant_payment_methods_select"
    ON tenant_payment_methods FOR SELECT
    USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_payment_methods_insert" ON tenant_payment_methods;
CREATE POLICY "tenant_payment_methods_insert"
    ON tenant_payment_methods FOR INSERT
    WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_payment_methods_update" ON tenant_payment_methods;
CREATE POLICY "tenant_payment_methods_update"
    ON tenant_payment_methods FOR UPDATE
    USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_payment_methods_delete" ON tenant_payment_methods;
CREATE POLICY "tenant_payment_methods_delete"
    ON tenant_payment_methods FOR DELETE
    USING (tenant_id = get_user_tenant_id());

-- Subscription Change Requests
DROP POLICY IF EXISTS "subscription_change_requests_select" ON subscription_change_requests;
CREATE POLICY "subscription_change_requests_select"
    ON subscription_change_requests FOR SELECT
    USING (tenant_id = get_user_tenant_id());

-- =====================================================
-- SUBSCRIPTION MODULE COMPLETE
-- =====================================================
