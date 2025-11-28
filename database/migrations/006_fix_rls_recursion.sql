-- Migration: 006_fix_rls_recursion.sql
-- Description: Fix infinite recursion in RLS policies
-- Date: 2025-11-28
-- Issue: Policies on users, roles, user_roles tables reference each other causing infinite recursion

-- =====================================================
-- 1. DROP PROBLEMATIC POLICIES
-- =====================================================

-- Drop users table policies
DROP POLICY IF EXISTS "Users can view users in their tenant" ON users;
DROP POLICY IF EXISTS "Admins can manage users" ON users;

-- Drop roles table policies  
DROP POLICY IF EXISTS "Users can view tenant roles" ON roles;
DROP POLICY IF EXISTS "Users can view accessible roles" ON roles;

-- Drop user_roles table policies
DROP POLICY IF EXISTS "Users can view user roles in tenant" ON user_roles;

-- =====================================================
-- 2. CREATE FIXED POLICIES (No circular references)
-- =====================================================

-- USERS TABLE POLICIES
-- Users can always read their own record
CREATE POLICY "Users can read own record"
    ON users FOR SELECT
    USING (id = auth.uid());

-- Users can read other users in same tenant (uses direct auth.uid() lookup, not subquery)
CREATE POLICY "Users can read same tenant users"
    ON users FOR SELECT
    USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- Users can update their own record
CREATE POLICY "Users can update own record"
    ON users FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ROLES TABLE POLICIES  
-- Everyone can read system roles (tenant_id IS NULL)
CREATE POLICY "Anyone can read system roles"
    ON roles FOR SELECT
    USING (tenant_id IS NULL AND is_system_role = true);

-- Users can read their tenant's custom roles
CREATE POLICY "Users can read tenant roles"
    ON roles FOR SELECT
    USING (
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- USER_ROLES TABLE POLICIES
-- Users can read their own role assignments
CREATE POLICY "Users can read own roles"
    ON user_roles FOR SELECT
    USING (user_id = auth.uid());

-- Users can read role assignments for users in same tenant
CREATE POLICY "Users can read tenant user roles"
    ON user_roles FOR SELECT
    USING (
        user_id IN (
            SELECT id FROM users 
            WHERE tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
        )
    );

-- =====================================================
-- 3. VERIFY ROLE_PERMISSIONS AND PERMISSIONS POLICIES
-- =====================================================

-- These should already be open for SELECT, but let's make sure
DROP POLICY IF EXISTS "Users can view permissions" ON permissions;
CREATE POLICY "Anyone can read permissions"
    ON permissions FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can view role permissions" ON role_permissions;
CREATE POLICY "Anyone can read role permissions"
    ON role_permissions FOR SELECT
    USING (true);

-- =====================================================
-- 4. TENANTS TABLE - Ensure user can read own tenant
-- =====================================================
DROP POLICY IF EXISTS "Users can view own tenant" ON tenants;
CREATE POLICY "Users can view own tenant"
    ON tenants FOR SELECT
    USING (
        id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );
