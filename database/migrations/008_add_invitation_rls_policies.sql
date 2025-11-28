-- Migration: 008_add_invitation_rls_policies.sql
-- Description: Add RLS policies for user_invitations table
-- Date: 2025-11-28

-- =====================================================
-- 1. USER_INVITATIONS TABLE POLICIES
-- =====================================================

-- Users can read invitations for their tenant
DROP POLICY IF EXISTS "Users can read tenant invitations" ON user_invitations;
CREATE POLICY "Users can read tenant invitations"
    ON user_invitations FOR SELECT
    USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- Users with appropriate role can insert invitations
-- For now, allow any authenticated user in the tenant to create invitations
-- The API will handle permission checking
DROP POLICY IF EXISTS "Users can create invitations" ON user_invitations;
CREATE POLICY "Users can create invitations"
    ON user_invitations FOR INSERT
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- Users can update invitations in their tenant (e.g., cancel, resend)
DROP POLICY IF EXISTS "Users can update tenant invitations" ON user_invitations;
CREATE POLICY "Users can update tenant invitations"
    ON user_invitations FOR UPDATE
    USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- Users can delete invitations in their tenant
DROP POLICY IF EXISTS "Users can delete tenant invitations" ON user_invitations;
CREATE POLICY "Users can delete tenant invitations"
    ON user_invitations FOR DELETE
    USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- =====================================================
-- 2. TENANTS TABLE UPDATE POLICY
-- =====================================================

-- Users can update their own tenant (for company settings)
DROP POLICY IF EXISTS "Users can update own tenant" ON tenants;
CREATE POLICY "Users can update own tenant"
    ON tenants FOR UPDATE
    USING (
        id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
    WITH CHECK (
        id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- =====================================================
-- VERIFICATION QUERIES (run these manually to check)
-- =====================================================
-- Check if policies exist:
-- SELECT * FROM pg_policies WHERE tablename = 'user_invitations';
-- SELECT * FROM pg_policies WHERE tablename = 'tenants';
