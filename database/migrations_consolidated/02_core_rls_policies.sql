-- =====================================================
-- SoftInterio Core RLS Policies
-- =====================================================
-- Module: Core (User Management, Tenants, Roles, Permissions)
-- Description: Row Level Security policies for all core tables
-- Target: Supabase (PostgreSQL with auth integration)
-- 
-- Run Order: 2 (After 01_core_schema.sql)
-- =====================================================

-- =====================================================
-- SECTION 1: TENANTS TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own tenant" ON tenants;
CREATE POLICY "Users can view own tenant"
    ON tenants FOR SELECT
    USING (id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own tenant" ON tenants;
CREATE POLICY "Users can update own tenant"
    ON tenants FOR UPDATE
    USING (id = (SELECT tenant_id FROM users WHERE id = auth.uid()))
    WITH CHECK (id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- =====================================================
-- SECTION 2: USERS TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can read own record" ON users;
CREATE POLICY "Users can read own record"
    ON users FOR SELECT
    USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can read same tenant users" ON users;
CREATE POLICY "Users can read same tenant users"
    ON users FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own record" ON users;
CREATE POLICY "Users can update own record"
    ON users FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- =====================================================
-- SECTION 3: TENANT_USERS TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own memberships" ON tenant_users;
CREATE POLICY "Users can view own memberships"
    ON tenant_users FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view tenant memberships" ON tenant_users;
CREATE POLICY "Users can view tenant memberships"
    ON tenant_users FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM tenant_users 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

DROP POLICY IF EXISTS "Service role full access to tenant_users" ON tenant_users;
CREATE POLICY "Service role full access to tenant_users"
    ON tenant_users FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- SECTION 4: ROLES TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Anyone can read system roles" ON roles;
CREATE POLICY "Anyone can read system roles"
    ON roles FOR SELECT
    USING (tenant_id IS NULL AND is_system_role = true);

DROP POLICY IF EXISTS "Users can read tenant roles" ON roles;
CREATE POLICY "Users can read tenant roles"
    ON roles FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage tenant roles" ON roles;
CREATE POLICY "Admins can manage tenant roles"
    ON roles FOR INSERT
    WITH CHECK (
        is_admin_or_higher()
        AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Admins can update tenant roles" ON roles;
CREATE POLICY "Admins can update tenant roles"
    ON roles FOR UPDATE
    USING (
        is_admin_or_higher()
        AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
        AND is_system_role = false
    );

DROP POLICY IF EXISTS "Admins can delete tenant roles" ON roles;
CREATE POLICY "Admins can delete tenant roles"
    ON roles FOR DELETE
    USING (
        is_admin_or_higher()
        AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
        AND is_system_role = false
    );

-- =====================================================
-- SECTION 5: PERMISSIONS TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Anyone can read permissions" ON permissions;
CREATE POLICY "Anyone can read permissions"
    ON permissions FOR SELECT
    USING (true);

-- =====================================================
-- SECTION 6: ROLE PERMISSIONS TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Anyone can read role permissions" ON role_permissions;
CREATE POLICY "Anyone can read role permissions"
    ON role_permissions FOR SELECT
    USING (true);

-- =====================================================
-- SECTION 7: USER ROLES TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can read own roles" ON user_roles;
CREATE POLICY "Users can read own roles"
    ON user_roles FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read tenant user roles" ON user_roles;
CREATE POLICY "Users can read tenant user roles"
    ON user_roles FOR SELECT
    USING (
        user_id IN (
            SELECT id FROM users 
            WHERE tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
        )
    );

-- =====================================================
-- SECTION 8: USER INVITATIONS TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can read tenant invitations" ON user_invitations;
CREATE POLICY "Users can read tenant invitations"
    ON user_invitations FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can create invitations" ON user_invitations;
CREATE POLICY "Users can create invitations"
    ON user_invitations FOR INSERT
    WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update tenant invitations" ON user_invitations;
CREATE POLICY "Users can update tenant invitations"
    ON user_invitations FOR UPDATE
    USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete tenant invitations" ON user_invitations;
CREATE POLICY "Users can delete tenant invitations"
    ON user_invitations FOR DELETE
    USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- =====================================================
-- SECTION 9: TENANT SETTINGS TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view tenant settings" ON tenant_settings;
CREATE POLICY "Users can view tenant settings"
    ON tenant_settings FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage tenant settings" ON tenant_settings;
CREATE POLICY "Admins can manage tenant settings"
    ON tenant_settings FOR ALL
    USING (
        tenant_id IN (
            SELECT u.tenant_id FROM users u
            INNER JOIN user_roles ur ON ur.user_id = u.id
            INNER JOIN roles r ON r.id = ur.role_id
            WHERE u.id = auth.uid() 
            AND (u.is_super_admin = true OR r.slug IN ('admin', 'owner'))
        )
    );

-- =====================================================
-- SECTION 10: ACTIVITY LOGS TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view activity logs" ON activity_logs;
CREATE POLICY "Users can view activity logs"
    ON activity_logs FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "System can insert activity logs" ON activity_logs;
CREATE POLICY "System can insert activity logs"
    ON activity_logs FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- SECTION 11: AUDIT LOGS TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
CREATE POLICY "Admins can view audit logs"
    ON audit_logs FOR SELECT
    USING (
        tenant_id IN (
            SELECT u.tenant_id FROM users u
            INNER JOIN user_roles ur ON ur.user_id = u.id
            INNER JOIN roles r ON r.id = ur.role_id
            WHERE u.id = auth.uid() 
            AND (u.is_super_admin = true OR r.slug IN ('admin', 'owner'))
        )
    );

DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
CREATE POLICY "System can insert audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- SECTION 12: OWNERSHIP TRANSFERS TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own ownership transfers" ON ownership_transfers;
CREATE POLICY "Users can view their own ownership transfers"
    ON ownership_transfers FOR SELECT
    USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

DROP POLICY IF EXISTS "Owner can create ownership transfer" ON ownership_transfers;
CREATE POLICY "Owner can create ownership transfer"
    ON ownership_transfers FOR INSERT
    WITH CHECK (
        from_user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid() 
            AND r.slug = 'owner'
            AND (r.tenant_id IS NULL OR r.tenant_id = tenant_id)
        )
    );

DROP POLICY IF EXISTS "Involved users can update ownership transfer" ON ownership_transfers;
CREATE POLICY "Involved users can update ownership transfer"
    ON ownership_transfers FOR UPDATE
    USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- =====================================================
-- CORE RLS POLICIES COMPLETE
-- =====================================================
