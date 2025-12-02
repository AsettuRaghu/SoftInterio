-- =====================================================
-- SoftInterio Helper Scripts
-- =====================================================
-- Description: One-off scripts and utilities
-- These are NOT run as part of the initial migration
-- Run only when needed
-- =====================================================

-- =====================================================
-- SCRIPT 1: Assign Owner Role to a User
-- =====================================================
-- Use this to assign the owner role to the first user of a tenant
-- Change the email address before running

DO $$
DECLARE
    v_user_id UUID;
    v_owner_role_id UUID;
    v_tenant_id UUID;
    v_user_email VARCHAR := 'your-email@example.com';  -- <-- CHANGE THIS
BEGIN
    -- Get user by email
    SELECT id, tenant_id INTO v_user_id, v_tenant_id
    FROM users
    WHERE email = v_user_email
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User not found. Please check the email address: %', v_user_email;
        RETURN;
    END IF;

    RAISE NOTICE 'Found user: % (tenant: %)', v_user_id, v_tenant_id;

    -- Get the system owner role
    SELECT id INTO v_owner_role_id
    FROM roles
    WHERE slug = 'owner' AND is_system_role = true
    LIMIT 1;

    IF v_owner_role_id IS NULL THEN
        RAISE NOTICE 'Owner role not found. Please run 003_seed_data.sql first.';
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
    INSERT INTO user_roles (user_id, role_id, assigned_by_user_id)
    VALUES (v_user_id, v_owner_role_id, v_user_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    RAISE NOTICE 'Owner role assigned successfully to user %', v_user_id;
END $$;

-- Verify the assignment (change email)
-- SELECT 
--     u.email,
--     u.name,
--     r.name as role_name,
--     r.slug as role_slug,
--     r.hierarchy_level
-- FROM user_roles ur
-- JOIN users u ON u.id = ur.user_id
-- JOIN roles r ON r.id = ur.role_id
-- WHERE u.email = 'your-email@example.com';

-- =====================================================
-- SCRIPT 2: Fix Users with Verified Email but Wrong Status
-- =====================================================
-- Run this if users have verified their email but status is still pending

UPDATE public.users u
SET 
    status = 'active',
    email_verified_at = au.email_confirmed_at,
    updated_at = NOW()
FROM auth.users au
WHERE u.id = au.id
  AND au.email_confirmed_at IS NOT NULL
  AND u.status = 'pending_verification';

-- =====================================================
-- SCRIPT 3: Initialize Usage for Existing Tenants
-- =====================================================
-- Run this after creating the tenant_usage table if you have existing tenants

INSERT INTO tenant_usage (tenant_id, current_users)
SELECT t.id, (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND u.status = 'active')
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM tenant_usage tu WHERE tu.tenant_id = t.id)
ON CONFLICT (tenant_id) DO NOTHING;

-- =====================================================
-- SCRIPT 4: List All Users and Their Roles
-- =====================================================
-- Useful for debugging role assignments

-- SELECT 
--     t.company_name as tenant,
--     u.email,
--     u.name,
--     u.status,
--     STRING_AGG(r.name, ', ' ORDER BY r.hierarchy_level) as roles
-- FROM users u
-- JOIN tenants t ON t.id = u.tenant_id
-- LEFT JOIN user_roles ur ON ur.user_id = u.id
-- LEFT JOIN roles r ON r.id = ur.role_id
-- GROUP BY t.company_name, u.email, u.name, u.status
-- ORDER BY t.company_name, u.email;

-- =====================================================
-- SCRIPT 5: List All Permissions for a Role
-- =====================================================
-- Check what permissions a specific role has

-- SELECT 
--     r.name as role_name,
--     p.module,
--     p.key as permission,
--     p.description
-- FROM roles r
-- JOIN role_permissions rp ON rp.role_id = r.id
-- JOIN permissions p ON p.id = rp.permission_id
-- WHERE r.slug = 'owner'  -- Change to desired role
-- AND rp.granted = true
-- ORDER BY p.module, p.key;

-- =====================================================
-- SCRIPT 6: Get User's Effective Permissions
-- =====================================================
-- Check all permissions a specific user has

-- SELECT DISTINCT
--     p.module,
--     p.key as permission
-- FROM users u
-- JOIN user_roles ur ON ur.user_id = u.id
-- JOIN role_permissions rp ON rp.role_id = ur.role_id
-- JOIN permissions p ON p.id = rp.permission_id
-- WHERE u.email = 'your-email@example.com'  -- Change to desired email
-- AND rp.granted = true
-- ORDER BY p.module, p.key;

-- =====================================================
-- SCRIPT 7: Initialize Subscription for Existing Tenants
-- =====================================================
-- Run this to create subscriptions for tenants that don't have one
-- Uses current system_config settings

DO $$
DECLARE
    v_tenant RECORD;
    v_trial_config JSONB;
    v_billing_config JSONB;
    v_trial_enabled BOOLEAN;
    v_trial_days INTEGER;
    v_default_plan_slug TEXT;
    v_grace_period_days INTEGER;
    v_default_cycle TEXT;
    v_plan_id UUID;
    v_now TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP;
    v_trial_end TIMESTAMP WITH TIME ZONE;
    v_count INTEGER := 0;
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
    
    IF v_plan_id IS NULL THEN
        SELECT id INTO v_plan_id
        FROM subscription_plans
        WHERE is_active = true
        ORDER BY display_order
        LIMIT 1;
    END IF;
    
    IF v_plan_id IS NULL THEN
        RAISE NOTICE 'No active subscription plans found. Please run 003_seed_data.sql first.';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Using plan: % with % day trial', v_default_plan_slug, v_trial_days;
    
    -- Loop through tenants without subscriptions
    FOR v_tenant IN 
        SELECT t.id, t.company_name, t.created_at
        FROM tenants t
        WHERE NOT EXISTS (
            SELECT 1 FROM tenant_subscriptions ts WHERE ts.tenant_id = t.id
        )
    LOOP
        -- Calculate trial end based on tenant creation date (retroactive)
        -- For existing tenants, we'll give them a fresh trial from now
        v_trial_end := v_now + (v_trial_days || ' days')::INTERVAL;
        
        INSERT INTO tenant_subscriptions (
            tenant_id, plan_id, status, billing_cycle,
            is_trial, trial_days_granted, trial_start_date, trial_end_date,
            subscription_start_date, subscription_end_date,
            current_period_start, current_period_end,
            grace_period_days, auto_renew
        ) VALUES (
            v_tenant.id, v_plan_id, 'trial', v_default_cycle::billing_cycle_enum,
            true, v_trial_days, v_now, v_trial_end,
            NULL, NULL,
            v_now, v_trial_end,
            v_grace_period_days, true
        );
        
        -- Update tenant's subscription_plan_id
        UPDATE tenants SET subscription_plan_id = v_plan_id WHERE id = v_tenant.id;
        
        -- Initialize usage
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
        RAISE NOTICE 'Created subscription for tenant: % (ID: %)', v_tenant.company_name, v_tenant.id;
    END LOOP;
    
    RAISE NOTICE 'Initialized subscriptions for % tenants', v_count;
END $$;

-- =====================================================
-- SCRIPT 8: View Current System Config
-- =====================================================
-- Check the current system configuration

-- SELECT 
--     config_key,
--     jsonb_pretty(config_value) as config,
--     description,
--     updated_at,
--     updated_by
-- FROM system_config
-- ORDER BY config_key;

-- =====================================================
-- SCRIPT 9: Update Trial Days (for new signups only)
-- =====================================================
-- This ONLY affects NEW signups, not existing tenants

-- UPDATE system_config
-- SET 
--     config_value = jsonb_set(config_value, '{trial_days}', '14'),
--     updated_at = NOW(),
--     updated_by = 'admin@example.com'
-- WHERE config_key = 'trial_settings';

-- =====================================================
-- SCRIPT 10: Disable Trial for New Signups
-- =====================================================
-- New accounts will need to pay immediately

-- UPDATE system_config
-- SET 
--     config_value = jsonb_set(config_value, '{enabled}', 'false'),
--     updated_at = NOW(),
--     updated_by = 'admin@example.com'
-- WHERE config_key = 'trial_settings';

-- =====================================================
-- SCRIPT 11: View All Tenant Subscriptions
-- =====================================================
-- Check subscription status for all tenants

-- SELECT 
--     t.company_name,
--     ts.status,
--     ts.is_trial,
--     ts.trial_days_granted,
--     ts.trial_start_date,
--     ts.trial_end_date,
--     ts.subscription_start_date,
--     ts.subscription_end_date,
--     sp.name as plan_name,
--     ts.billing_cycle
-- FROM tenants t
-- LEFT JOIN tenant_subscriptions ts ON ts.tenant_id = t.id
-- LEFT JOIN subscription_plans sp ON sp.id = ts.plan_id
-- ORDER BY t.company_name;

-- =====================================================
-- HELPER SCRIPTS COMPLETE
-- =====================================================
