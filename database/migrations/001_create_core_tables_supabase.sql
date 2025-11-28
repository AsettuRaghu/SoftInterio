-- Migration: 001_create_core_tables_supabase.sql
-- Description: Create core authentication and tenant management tables (Supabase optimized)
-- Date: 2025-11-23
-- Note: This version includes Supabase Row Level Security (RLS) policies

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. TENANT & ACCOUNT STRUCTURE
-- =====================================================

-- Tenant Types Enum
CREATE TYPE tenant_type_enum AS ENUM ('client', 'architect', 'interiors', 'vendor', 'factory');

-- Tenant Status Enum
CREATE TYPE tenant_status_enum AS ENUM ('active', 'suspended', 'trial', 'expired', 'closed');

-- Tenants Table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_type tenant_type_enum NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    company_registration_number VARCHAR(100),
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

-- Enable RLS on tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Indexes for tenants
CREATE INDEX idx_tenants_tenant_type ON tenants(tenant_type);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_email ON tenants(email);

-- =====================================================
-- 2. USERS & AUTHENTICATION
-- =====================================================

-- User Status Enum
CREATE TYPE user_status_enum AS ENUM ('active', 'invited', 'pending_verification', 'disabled', 'deleted');

-- Users Table (linked to Supabase Auth)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- Link to Supabase auth
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

-- Enable RLS on users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Indexes for users
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_tenant_status ON users(tenant_id, status);

-- Add FK constraint for tenants.created_by_user_id
ALTER TABLE tenants 
    ADD CONSTRAINT fk_tenants_created_by_user 
    FOREIGN KEY (created_by_user_id) 
    REFERENCES users(id) 
    ON DELETE SET NULL;

-- User Sessions Table (optional - Supabase manages sessions, but keep for audit)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(500),
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on user_sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Password Reset Tokens Table (Supabase handles this, keep for reference)
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_password_reset_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_token ON password_reset_tokens(token);

-- Email Verification Tokens Table
CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_email_verification_user_id ON email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_token ON email_verification_tokens(token);

-- =====================================================
-- 3. USER INVITATIONS
-- =====================================================

CREATE TYPE invitation_status_enum AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

CREATE TABLE user_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    invited_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID,
    token VARCHAR(500) NOT NULL UNIQUE,
    status invitation_status_enum NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_pending_invitation UNIQUE(tenant_id, email, status)
);

-- Enable RLS
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_user_invitations_tenant_id ON user_invitations(tenant_id);
CREATE INDEX idx_user_invitations_email ON user_invitations(email);
CREATE INDEX idx_user_invitations_status ON user_invitations(status);
CREATE INDEX idx_user_invitations_token ON user_invitations(token);

-- =====================================================
-- 4. ROLES & PERMISSIONS
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

-- Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_roles_tenant_id ON roles(tenant_id);
CREATE INDEX idx_roles_slug ON roles(slug);
CREATE INDEX idx_roles_is_system ON roles(is_system_role);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) NOT NULL UNIQUE,
    module VARCHAR(50) NOT NULL,
    description TEXT,
    is_system_permission BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_permissions_module ON permissions(module);
CREATE INDEX idx_permissions_key ON permissions(key);

CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_role_permission UNIQUE(role_id, permission_id)
);

-- Enable RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);

CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assigned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT unique_user_role UNIQUE(user_id, role_id)
);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

ALTER TABLE user_invitations 
    ADD CONSTRAINT fk_user_invitations_role 
    FOREIGN KEY (role_id) 
    REFERENCES roles(id) 
    ON DELETE SET NULL;

-- =====================================================
-- 5. SUBSCRIPTION SYSTEM
-- =====================================================

CREATE TYPE billing_cycle_enum AS ENUM ('monthly', 'yearly');
CREATE TYPE subscription_status_enum AS ENUM ('trial', 'active', 'past_due', 'cancelled', 'expired');

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

-- Public read access for subscription plans
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_subscription_plans_tenant_type ON subscription_plans(tenant_type);
CREATE INDEX idx_subscription_plans_is_active ON subscription_plans(is_active);

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

-- Public read access
ALTER TABLE subscription_plan_features ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_plan_features_plan_id ON subscription_plan_features(plan_id);

CREATE TABLE tenant_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    status subscription_status_enum NOT NULL DEFAULT 'trial',
    billing_cycle billing_cycle_enum NOT NULL DEFAULT 'monthly',
    is_trial BOOLEAN DEFAULT FALSE,
    trial_start_date TIMESTAMP WITH TIME ZONE,
    trial_end_date TIMESTAMP WITH TIME ZONE,
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tenant_subscriptions_tenant_id ON tenant_subscriptions(tenant_id);
CREATE INDEX idx_tenant_subscriptions_status ON tenant_subscriptions(status);
CREATE INDEX idx_tenant_subscriptions_plan_id ON tenant_subscriptions(plan_id);

ALTER TABLE tenants 
    ADD CONSTRAINT fk_tenants_subscription_plan 
    FOREIGN KEY (subscription_plan_id) 
    REFERENCES subscription_plans(id) 
    ON DELETE SET NULL;

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

-- Enable RLS
ALTER TABLE subscription_addons ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_subscription_addons_tenant_id ON subscription_addons(tenant_id);

-- =====================================================
-- 6. TENANT SETTINGS
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

-- Enable RLS
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tenant_settings_tenant_id ON tenant_settings(tenant_id);

-- =====================================================
-- 7. ACTIVITY & AUDIT LOGS
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

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_activity_logs_tenant_id_created ON activity_logs(tenant_id, created_at DESC);
CREATE INDEX idx_activity_logs_user_id_created ON activity_logs(user_id, created_at DESC);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);

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

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =====================================================
-- 8. TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- =====================================================
-- 9. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Allow users to read subscription plans (public)
CREATE POLICY "Subscription plans are viewable by everyone"
    ON subscription_plans FOR SELECT
    USING (is_active = true);

CREATE POLICY "Plan features are viewable by everyone"
    ON subscription_plan_features FOR SELECT
    USING (true);

-- Users can only see their own tenant's data
CREATE POLICY "Users can view own tenant"
    ON tenants FOR SELECT
    USING (id IN (
        SELECT tenant_id FROM users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can view users in their tenant"
    ON users FOR SELECT
    USING (tenant_id IN (
        SELECT tenant_id FROM users WHERE id = auth.uid()
    ));

-- Super admins and admins can modify users in their tenant
CREATE POLICY "Admins can manage users"
    ON users FOR ALL
    USING (
        tenant_id IN (
            SELECT u.tenant_id FROM users u
            INNER JOIN user_roles ur ON ur.user_id = u.id
            INNER JOIN roles r ON r.id = ur.role_id
            WHERE u.id = auth.uid() 
            AND (u.is_super_admin = true OR r.slug IN ('admin', 'super-admin'))
        )
    );

-- Users can view roles in their tenant
CREATE POLICY "Users can view tenant roles"
    ON roles FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
        OR tenant_id IS NULL -- system roles
    );

-- Users can view their own permissions
CREATE POLICY "Users can view permissions"
    ON permissions FOR SELECT
    USING (true);

-- Users can view role permissions
CREATE POLICY "Users can view role permissions"
    ON role_permissions FOR SELECT
    USING (true);

-- Users can view user roles in their tenant
CREATE POLICY "Users can view user roles in tenant"
    ON user_roles FOR SELECT
    USING (
        user_id IN (
            SELECT id FROM users WHERE tenant_id IN (
                SELECT tenant_id FROM users WHERE id = auth.uid()
            )
        )
    );

-- Users can view their tenant subscription
CREATE POLICY "Users can view tenant subscription"
    ON tenant_subscriptions FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
    );

-- Super admins can manage subscription
CREATE POLICY "Super admins can manage subscription"
    ON tenant_subscriptions FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM users 
            WHERE id = auth.uid() AND is_super_admin = true
        )
    );

-- Users can view tenant settings
CREATE POLICY "Users can view tenant settings"
    ON tenant_settings FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
    );

-- Admins can manage tenant settings
CREATE POLICY "Admins can manage tenant settings"
    ON tenant_settings FOR ALL
    USING (
        tenant_id IN (
            SELECT u.tenant_id FROM users u
            INNER JOIN user_roles ur ON ur.user_id = u.id
            INNER JOIN roles r ON r.id = ur.role_id
            WHERE u.id = auth.uid() 
            AND (u.is_super_admin = true OR r.slug IN ('admin', 'super-admin'))
        )
    );

-- Users can view activity logs in their tenant
CREATE POLICY "Users can view activity logs"
    ON activity_logs FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
    );

-- System can insert activity logs
CREATE POLICY "System can insert activity logs"
    ON activity_logs FOR INSERT
    WITH CHECK (true);

-- Admins can view audit logs
CREATE POLICY "Admins can view audit logs"
    ON audit_logs FOR SELECT
    USING (
        tenant_id IN (
            SELECT u.tenant_id FROM users u
            INNER JOIN user_roles ur ON ur.user_id = u.id
            INNER JOIN roles r ON r.id = ur.role_id
            WHERE u.id = auth.uid() 
            AND (u.is_super_admin = true OR r.slug IN ('admin', 'super-admin'))
        )
    );

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- 10. HELPER FUNCTIONS FOR SUPABASE
-- =====================================================

-- Function to get current user's tenant_id
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT tenant_id FROM users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (SELECT is_super_admin FROM users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION has_permission(permission_key TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users u
        INNER JOIN user_roles ur ON ur.user_id = u.id
        INNER JOIN role_permissions rp ON rp.role_id = ur.role_id
        INNER JOIN permissions p ON p.id = rp.permission_id
        WHERE u.id = auth.uid() 
        AND p.key = permission_key 
        AND rp.granted = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
