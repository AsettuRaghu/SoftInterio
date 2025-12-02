-- =====================================================
-- Multi-Tenant User Support Migration
-- =====================================================
-- Description: Enables users to belong to multiple tenants
-- This is essential for ERP systems where consultants, designers, etc.
-- may work with multiple companies.
--
-- Changes:
-- 1. Creates tenant_users table (user-tenant memberships)
-- 2. Migrates existing user-tenant relationships
-- 3. Updates RLS policies
-- 4. Modifies users table (removes tenant_id dependency for auth)
-- =====================================================

-- =====================================================
-- 1. CREATE TENANT_USERS TABLE
-- =====================================================
-- This is the junction table for user-tenant memberships
-- A user can belong to multiple tenants with different roles

CREATE TABLE IF NOT EXISTS tenant_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Membership status
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Tracking
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    removed_at TIMESTAMP WITH TIME ZONE,
    removed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Each user can only have one membership per tenant
    CONSTRAINT unique_user_tenant UNIQUE(user_id, tenant_id)
);

ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_user_id ON tenant_users(user_id);
CREATE INDEX idx_tenant_users_is_active ON tenant_users(is_active);
CREATE INDEX idx_tenant_users_tenant_active ON tenant_users(tenant_id, is_active);

-- =====================================================
-- 2. MIGRATE EXISTING DATA
-- =====================================================
-- Copy existing user-tenant relationships to tenant_users

INSERT INTO tenant_users (tenant_id, user_id, is_active, joined_at, created_at, updated_at)
SELECT 
    u.tenant_id,
    u.id,
    CASE 
        WHEN u.status = 'disabled' THEN false
        WHEN u.status = 'deleted' THEN false
        ELSE true
    END,
    u.created_at,  -- Use user creation date as join date
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM users u
WHERE u.tenant_id IS NOT NULL
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- =====================================================
-- 3. ADD PRIMARY_TENANT_ID TO USERS (for default selection)
-- =====================================================
-- This stores the user's preferred/default tenant for login

ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

-- Set primary_tenant_id to current tenant_id for existing users
UPDATE users SET primary_tenant_id = tenant_id WHERE primary_tenant_id IS NULL;

-- =====================================================
-- 4. CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to check if user has active membership in a tenant
CREATE OR REPLACE FUNCTION user_has_tenant_access(p_user_id UUID, p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM tenant_users 
        WHERE user_id = p_user_id 
        AND tenant_id = p_tenant_id 
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's active tenant IDs
CREATE OR REPLACE FUNCTION get_user_tenant_ids(p_user_id UUID)
RETURNS SETOF UUID AS $$
BEGIN
    RETURN QUERY 
    SELECT tenant_id FROM tenant_users 
    WHERE user_id = p_user_id 
    AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's active tenants with details
CREATE OR REPLACE FUNCTION get_user_tenants(p_user_id UUID)
RETURNS TABLE (
    tenant_id UUID,
    company_name VARCHAR(255),
    logo_url TEXT,
    role_name VARCHAR(255),
    is_owner BOOLEAN
) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        t.id,
        t.company_name,
        t.logo_url,
        r.name,
        u.is_super_admin
    FROM tenant_users tu
    JOIN tenants t ON tu.tenant_id = t.id
    JOIN users u ON tu.user_id = u.id AND u.tenant_id = tu.tenant_id
    LEFT JOIN user_roles ur ON ur.user_id = tu.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    WHERE tu.user_id = p_user_id 
    AND tu.is_active = true
    AND t.status NOT IN ('closed', 'suspended');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. RLS POLICIES FOR TENANT_USERS
-- =====================================================

-- Users can view their own memberships
DROP POLICY IF EXISTS "Users can view own memberships" ON tenant_users;
CREATE POLICY "Users can view own memberships"
    ON tenant_users FOR SELECT
    USING (user_id = auth.uid());

-- Users can view memberships of tenants they belong to
DROP POLICY IF EXISTS "Users can view tenant memberships" ON tenant_users;
CREATE POLICY "Users can view tenant memberships"
    ON tenant_users FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Service role can do everything
DROP POLICY IF EXISTS "Service role full access to tenant_users" ON tenant_users;
CREATE POLICY "Service role full access to tenant_users"
    ON tenant_users FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- 6. UPDATE TRIGGER FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_tenant_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tenant_users_updated_at ON tenant_users;
CREATE TRIGGER trigger_tenant_users_updated_at
    BEFORE UPDATE ON tenant_users
    FOR EACH ROW
    EXECUTE FUNCTION update_tenant_users_updated_at();

-- =====================================================
-- MIGRATION NOTES
-- =====================================================
-- 
-- IMPORTANT: The users.tenant_id column is KEPT for backwards compatibility
-- and to track which tenant the user is currently viewing.
-- 
-- Going forward:
-- - users.tenant_id = Currently active tenant (set on login/switch)
-- - tenant_users = All tenant memberships for a user
-- - primary_tenant_id = User's preferred default tenant
--
-- Application code changes required:
-- 1. Signup: Create tenant_users record along with user
-- 2. Invite: Check tenant_users for existing membership
-- 3. Remove: Set tenant_users.is_active = false (not users.status)
-- 4. Login: Check tenant_users for active memberships
-- 5. Dashboard: Filter by tenant_users.is_active
-- =====================================================
