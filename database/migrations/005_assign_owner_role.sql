-- Migration: 005_assign_owner_role.sql
-- Description: Assigns the Owner role to the first user (tenant owner)
-- Date: 2025-11-28
-- 
-- PURPOSE: When a user signs up as a tenant owner, they need the "owner" role
-- to have full access to the system. This script can be run manually or
-- integrated into the signup flow.

-- =====================================================
-- OPTION 1: Assign owner role to a specific user by email
-- =====================================================
-- Replace 'your-email@example.com' with your actual email

DO $$
DECLARE
    v_user_id UUID;
    v_owner_role_id UUID;
    v_tenant_id UUID;
BEGIN
    -- Get user by email (change this to your email)
    SELECT id, tenant_id INTO v_user_id, v_tenant_id
    FROM users
    WHERE email = 'kv.raghuvarma@gmail.com'  -- <-- CHANGE THIS TO YOUR EMAIL
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User not found. Please check the email address.';
        RETURN;
    END IF;

    RAISE NOTICE 'Found user: %', v_user_id;

    -- Get the system owner role
    SELECT id INTO v_owner_role_id
    FROM roles
    WHERE slug = 'owner' AND is_system_role = true
    LIMIT 1;

    IF v_owner_role_id IS NULL THEN
        RAISE NOTICE 'Owner role not found. Please run migration 004 first.';
        RETURN;
    END IF;

    RAISE NOTICE 'Found owner role: %', v_owner_role_id;

    -- Check if user already has owner role
    IF EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = v_user_id AND role_id = v_owner_role_id
    ) THEN
        RAISE NOTICE 'User already has owner role.';
        RETURN;
    END IF;

    -- Assign owner role to user
    INSERT INTO user_roles (user_id, role_id, assigned_by)
    VALUES (v_user_id, v_owner_role_id, v_user_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    RAISE NOTICE 'Owner role assigned successfully to user %', v_user_id;

    -- Verify the assignment
    RAISE NOTICE 'User now has the following roles:';
END $$;

-- Verify the assignment
SELECT 
    u.email,
    u.full_name,
    r.name as role_name,
    r.slug as role_slug,
    r.hierarchy_level
FROM user_roles ur
JOIN users u ON u.id = ur.user_id
JOIN roles r ON r.id = ur.role_id
WHERE u.email = 'kv.raghuvarma@gmail.com';  -- <-- CHANGE THIS TO YOUR EMAIL

-- Also verify permissions are accessible
SELECT 
    p.key as permission,
    p.name as permission_name
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
JOIN users u ON u.id = ur.user_id
WHERE u.email = 'kv.raghuvarma@gmail.com'  -- <-- CHANGE THIS TO YOUR EMAIL
  AND rp.granted = true
ORDER BY p.key;
