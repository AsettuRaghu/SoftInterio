-- =====================================================
-- SoftInterio Database Schema
-- =====================================================
-- Description: Complete database schema for SoftInterio ERP
-- Includes: Tables, indexes, triggers, functions
-- Target: Supabase (PostgreSQL with auth integration)
-- 
-- Run this FIRST before other migrations
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================
-- Drop existing types if they exist (for re-running migrations)
DROP TYPE IF EXISTS plan_change_status_enum CASCADE;
DROP TYPE IF EXISTS plan_change_type_enum CASCADE;
DROP TYPE IF EXISTS invoice_status_enum CASCADE;
DROP TYPE IF EXISTS subscription_status_enum CASCADE;
DROP TYPE IF EXISTS billing_cycle_enum CASCADE;
DROP TYPE IF EXISTS invitation_status_enum CASCADE;
DROP TYPE IF EXISTS user_status_enum CASCADE;
DROP TYPE IF EXISTS tenant_status_enum CASCADE;
DROP TYPE IF EXISTS tenant_type_enum CASCADE;

-- Tenant Types
CREATE TYPE tenant_type_enum AS ENUM ('client', 'architect', 'interiors', 'vendor', 'factory');

-- Tenant Status
CREATE TYPE tenant_status_enum AS ENUM ('active', 'suspended', 'trial', 'expired', 'closed');

-- User Status
CREATE TYPE user_status_enum AS ENUM ('active', 'invited', 'pending_verification', 'disabled', 'deleted');

-- Invitation Status
CREATE TYPE invitation_status_enum AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

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
-- 1. TENANTS TABLE
-- =====================================================

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_type tenant_type_enum NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    company_registration_number VARCHAR(100),
    gst_number VARCHAR(20),
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    country_code CHAR(2),
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    logo_url TEXT,
    subscription_plan_id UUID,
    status tenant_status_enum NOT NULL DEFAULT 'trial',
    onboarding_completed BOOLEAN DEFAULT FALSE,
    onboarding_step INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id UUID
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tenants_tenant_type ON tenants(tenant_type);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_email ON tenants(email);
CREATE INDEX idx_tenants_gst_number ON tenants(gst_number);

-- =====================================================
-- 2. USERS TABLE
-- =====================================================

CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar_url TEXT,
    status user_status_enum NOT NULL DEFAULT 'pending_verification',
    is_super_admin BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT unique_email_per_tenant UNIQUE(tenant_id, email)
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_tenant_status ON users(tenant_id, status);

-- Add FK for tenants.created_by_user_id
ALTER TABLE tenants 
    ADD CONSTRAINT fk_tenants_created_by_user 
    FOREIGN KEY (created_by_user_id) 
    REFERENCES users(id) 
    ON DELETE SET NULL;

-- =====================================================
-- 3. USER SESSIONS TABLE
-- =====================================================

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(500),
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- =====================================================
-- 4. PASSWORD RESET TOKENS TABLE
-- =====================================================

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_password_reset_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_token ON password_reset_tokens(token);

-- =====================================================
-- 5. EMAIL VERIFICATION TOKENS TABLE
-- =====================================================

CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_email_verification_user_id ON email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_token ON email_verification_tokens(token);

-- =====================================================
-- 6. ROLES TABLE
-- =====================================================

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    hierarchy_level INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_role_slug_per_tenant UNIQUE(tenant_id, slug)
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_roles_tenant_id ON roles(tenant_id);
CREATE INDEX idx_roles_slug ON roles(slug);
CREATE INDEX idx_roles_is_system ON roles(is_system_role);

-- =====================================================
-- 7. PERMISSIONS TABLE
-- =====================================================

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) NOT NULL UNIQUE,
    module VARCHAR(50) NOT NULL,
    description TEXT,
    is_system_permission BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_permissions_module ON permissions(module);
CREATE INDEX idx_permissions_key ON permissions(key);

-- =====================================================
-- 8. ROLE PERMISSIONS TABLE
-- =====================================================

CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_role_permission UNIQUE(role_id, permission_id)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);

-- =====================================================
-- 9. USER ROLES TABLE
-- =====================================================

CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assigned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT unique_user_role UNIQUE(user_id, role_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- =====================================================
-- 10. USER INVITATIONS TABLE
-- =====================================================

CREATE TABLE user_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    invited_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    token VARCHAR(500) NOT NULL UNIQUE,
    status invitation_status_enum NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_pending_invitation UNIQUE(tenant_id, email, status)
);

ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_user_invitations_tenant_id ON user_invitations(tenant_id);
CREATE INDEX idx_user_invitations_email ON user_invitations(email);
CREATE INDEX idx_user_invitations_status ON user_invitations(status);
CREATE INDEX idx_user_invitations_token ON user_invitations(token);

-- =====================================================
-- 11. SYSTEM CONFIGURATION TABLE
-- =====================================================
-- Backend-controlled settings that affect system behavior
-- Changes here only affect NEW signups, not existing accounts
-- This table should have exactly ONE row per config_key

CREATE TABLE system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT -- admin email or 'system'
);

-- No RLS - this is admin-only, accessed via service role
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Only allow read via service role (no user policies)
CREATE INDEX idx_system_config_key ON system_config(config_key);

COMMENT ON TABLE system_config IS 'System-wide configuration. Changes only affect new signups.';
COMMENT ON COLUMN system_config.config_value IS 'JSON value for flexible configuration';

-- =====================================================
-- 12. SUBSCRIPTION PLANS TABLE
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
-- 12. SUBSCRIPTION PLAN FEATURES TABLE
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
-- 14. TENANT SUBSCRIPTIONS TABLE
-- =====================================================
-- Stores the subscription state for each tenant
-- Trial terms are "locked in" at signup time based on system_config
-- This ensures config changes don't affect existing accounts

CREATE TABLE tenant_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    
    -- Current status
    status subscription_status_enum NOT NULL DEFAULT 'trial',
    billing_cycle billing_cycle_enum NOT NULL DEFAULT 'yearly',
    
    -- Trial information (locked at signup time)
    is_trial BOOLEAN DEFAULT FALSE,
    trial_days_granted INTEGER DEFAULT 0, -- How many days were granted at signup
    trial_start_date TIMESTAMP WITH TIME ZONE,
    trial_end_date TIMESTAMP WITH TIME ZONE,
    
    -- Subscription period (starts after trial or immediately if no trial)
    subscription_start_date TIMESTAMP WITH TIME ZONE, -- When paid subscription begins
    subscription_end_date TIMESTAMP WITH TIME ZONE,   -- When subscription expires
    
    -- Current billing period (for recurring billing)
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    
    -- Grace period (after expiry, before suspension)
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
    cancellation_effective_date TIMESTAMP WITH TIME ZONE, -- When cancellation takes effect
    
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
-- 14. SUBSCRIPTION ADDONS TABLE
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
-- 15. TENANT SETTINGS TABLE
-- =====================================================

CREATE TABLE tenant_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    timezone VARCHAR(50) DEFAULT 'UTC',
    date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',
    currency CHAR(3) DEFAULT 'INR',
    language CHAR(2) DEFAULT 'en',
    business_hours JSONB,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tenant_settings_tenant_id ON tenant_settings(tenant_id);

-- =====================================================
-- 16. ACTIVITY LOGS TABLE
-- =====================================================

CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_activity_logs_tenant_id_created ON activity_logs(tenant_id, created_at DESC);
CREATE INDEX idx_activity_logs_user_id_created ON activity_logs(user_id, created_at DESC);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);

-- =====================================================
-- 17. AUDIT LOGS TABLE
-- =====================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =====================================================
-- 18. OWNERSHIP TRANSFERS TABLE
-- =====================================================

CREATE TABLE ownership_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
    token VARCHAR(500) NOT NULL UNIQUE,
    reason TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_pending_transfer UNIQUE(tenant_id, status)
);

ALTER TABLE ownership_transfers ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ownership_transfers_tenant_id ON ownership_transfers(tenant_id);
CREATE INDEX idx_ownership_transfers_from_user ON ownership_transfers(from_user_id);
CREATE INDEX idx_ownership_transfers_to_user ON ownership_transfers(to_user_id);
CREATE INDEX idx_ownership_transfers_status ON ownership_transfers(status);
CREATE INDEX idx_ownership_transfers_token ON ownership_transfers(token);

-- =====================================================
-- 19. TENANT USAGE TABLE
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
-- 20. TENANT USAGE HISTORY TABLE
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
-- 21. SUBSCRIPTION INVOICES TABLE
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
-- 22. TENANT PAYMENT METHODS TABLE
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
-- 23. SUBSCRIPTION CHANGE REQUESTS TABLE
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
-- TRIGGERS: Auto-update updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_invitations_updated_at BEFORE UPDATE ON user_invitations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_subscriptions_updated_at BEFORE UPDATE ON tenant_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_addons_updated_at BEFORE UPDATE ON subscription_addons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_settings_updated_at BEFORE UPDATE ON tenant_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ownership_transfers_updated_at BEFORE UPDATE ON ownership_transfers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_usage_updated_at BEFORE UPDATE ON tenant_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_invoices_updated_at BEFORE UPDATE ON subscription_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_payment_methods_updated_at BEFORE UPDATE ON tenant_payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_change_requests_updated_at BEFORE UPDATE ON subscription_change_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TRIGGER: Email Verification Sync
-- =====================================================

CREATE OR REPLACE FUNCTION sync_user_email_verification()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at != NEW.email_confirmed_at) THEN
        UPDATE public.users
        SET 
            email_verified_at = NEW.email_confirmed_at,
            status = 'active',
            updated_at = NOW()
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_email_verified ON auth.users;
CREATE TRIGGER on_auth_user_email_verified
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_email_verification();

-- =====================================================
-- TRIGGER: Invoice Number Generation
-- =====================================================

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

-- =====================================================
-- TRIGGER: Update User Count
-- =====================================================

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
-- HELPER FUNCTIONS
-- =====================================================

-- Get current user's tenant ID
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT tenant_id FROM users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (SELECT is_super_admin FROM users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is owner
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid() 
        AND r.slug = 'owner'
        AND (r.tenant_id IS NULL OR r.tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is admin or higher
CREATE OR REPLACE FUNCTION is_admin_or_higher()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid() 
        AND r.hierarchy_level <= 1
        AND (r.tenant_id IS NULL OR r.tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's highest role hierarchy level
CREATE OR REPLACE FUNCTION get_user_hierarchy_level()
RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE(
        (SELECT MIN(r.hierarchy_level) 
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = auth.uid()
         AND (r.tenant_id IS NULL OR r.tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()))
        ),
        999
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has specific permission
CREATE OR REPLACE FUNCTION has_permission(permission_key TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = auth.uid() 
        AND p.key = permission_key 
        AND rp.granted = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all permissions for current user
CREATE OR REPLACE FUNCTION get_user_permissions()
RETURNS TABLE(permission_key TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT p.key::TEXT
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
    AND rp.granted = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- =====================================================
-- SUBSCRIPTION INITIALIZATION FUNCTION
-- =====================================================
-- Called when a new tenant is created
-- Reads current system_config to determine trial settings
-- Creates subscription record with locked-in trial terms

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
        v_subscription_start := v_trial_end; -- Subscription starts after trial
        v_subscription_end := NULL; -- Not set until payment
        
        INSERT INTO tenant_subscriptions (
            tenant_id, plan_id, status, billing_cycle,
            is_trial, trial_days_granted, trial_start_date, trial_end_date,
            subscription_start_date, subscription_end_date,
            current_period_start, current_period_end,
            grace_period_days, auto_renew
        ) VALUES (
            p_tenant_id, v_plan_id, 'trial', v_default_cycle::billing_cycle_enum,
            true, v_trial_days, v_now, v_trial_end,
            NULL, NULL, -- Subscription dates set after payment
            v_now, v_trial_end, -- Current period is the trial period
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

-- =====================================================
-- GET SUBSCRIPTION STATUS FUNCTION
-- =====================================================
-- Returns comprehensive subscription status for a tenant
-- Used by the frontend to show warnings, Pay buttons, etc.

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
-- SCHEMA COMPLETE
-- =====================================================
