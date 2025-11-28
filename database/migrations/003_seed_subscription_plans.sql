-- Migration: 003_seed_subscription_plans.sql
-- Description: Seed subscription plans for interior design companies
-- Date: 2025-11-24

-- =====================================================
-- SEED SUBSCRIPTION PLANS FOR INTERIORS
-- =====================================================

-- Classic Plan
INSERT INTO subscription_plans (
    id, name, slug, tenant_type, description,
    price_monthly, price_yearly,
    max_users, max_projects, max_storage_gb,
    is_active, is_featured, display_order
) VALUES (
    uuid_generate_v4(),
    'Classic',
    'classic',
    'interiors',
    'Perfect for solo designers & small studios',
    10000, 120000,
    5, 50, 25,
    true, false, 1
) ON CONFLICT DO NOTHING;

-- Signature Plan (Most Popular)
INSERT INTO subscription_plans (
    id, name, slug, tenant_type, description,
    price_monthly, price_yearly,
    max_users, max_projects, max_storage_gb,
    is_active, is_featured, display_order
) VALUES (
    uuid_generate_v4(),
    'Signature',
    'signature',
    'interiors',
    'For studios that need advanced workflow and team features',
    20000, 240000,
    15, 200, 100,
    true, true, 2
) ON CONFLICT DO NOTHING;

-- Masterpiece Plan
INSERT INTO subscription_plans (
    id, name, slug, tenant_type, description,
    price_monthly, price_yearly,
    max_users, max_projects, max_storage_gb,
    is_active, is_featured, display_order
) VALUES (
    uuid_generate_v4(),
    'Masterpiece',
    'masterpiece',
    'interiors',
    'For large studios needing enterprise-level features',
    50000, 600000,
    -1, -1, 500, -- -1 means unlimited
    true, false, 3
) ON CONFLICT DO NOTHING;

-- =====================================================
-- SEED PLAN FEATURES
-- =====================================================

DO $$
DECLARE
    classic_plan_id UUID;
    signature_plan_id UUID;
    masterpiece_plan_id UUID;
BEGIN
    -- Get plan IDs
    SELECT id INTO classic_plan_id FROM subscription_plans WHERE slug = 'classic' AND tenant_type = 'interiors';
    SELECT id INTO signature_plan_id FROM subscription_plans WHERE slug = 'signature' AND tenant_type = 'interiors';
    SELECT id INTO masterpiece_plan_id FROM subscription_plans WHERE slug = 'masterpiece' AND tenant_type = 'interiors';

    -- Classic Plan Features
    IF classic_plan_id IS NOT NULL THEN
        INSERT INTO subscription_plan_features (plan_id, feature_key, feature_name, included, limit_value) VALUES
        (classic_plan_id, 'projects', 'Project Management', true, 50),
        (classic_plan_id, 'clients', 'Client Portal', true, NULL),
        (classic_plan_id, 'storage', 'Document Storage', true, 25),
        (classic_plan_id, 'reports', 'Basic Reporting', true, NULL),
        (classic_plan_id, 'support', 'Email Support', true, NULL)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Signature Plan Features
    IF signature_plan_id IS NOT NULL THEN
        INSERT INTO subscription_plan_features (plan_id, feature_key, feature_name, included, limit_value) VALUES
        (signature_plan_id, 'projects', 'Project Management', true, 200),
        (signature_plan_id, 'clients', 'Client Portal', true, NULL),
        (signature_plan_id, 'storage', 'Document Storage', true, 100),
        (signature_plan_id, 'team', 'Advanced Team Management', true, NULL),
        (signature_plan_id, 'financial', 'Financial Reporting', true, NULL),
        (signature_plan_id, 'vendor', 'Vendor Management', true, NULL),
        (signature_plan_id, 'dashboards', 'Custom Dashboards', true, NULL),
        (signature_plan_id, 'support', 'Priority Support', true, NULL)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Masterpiece Plan Features
    IF masterpiece_plan_id IS NOT NULL THEN
        INSERT INTO subscription_plan_features (plan_id, feature_key, feature_name, included, limit_value) VALUES
        (masterpiece_plan_id, 'projects', 'Unlimited Projects', true, NULL),
        (masterpiece_plan_id, 'clients', 'Client Portal', true, NULL),
        (masterpiece_plan_id, 'storage', 'Document Storage', true, 500),
        (masterpiece_plan_id, 'team', 'Advanced Team Management', true, NULL),
        (masterpiece_plan_id, 'financial', 'Financial Reporting', true, NULL),
        (masterpiece_plan_id, 'vendor', 'Vendor Management', true, NULL),
        (masterpiece_plan_id, 'dashboards', 'Custom Dashboards', true, NULL),
        (masterpiece_plan_id, 'staff', 'Staff Management', true, NULL),
        (masterpiece_plan_id, 'marketing', 'Sales & Marketing Tools', true, NULL),
        (masterpiece_plan_id, 'analytics', 'Advanced Analytics', true, NULL),
        (masterpiece_plan_id, 'whitelabel', 'White-label Options', true, NULL),
        (masterpiece_plan_id, 'support', 'Dedicated Account Manager', true, NULL)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- =====================================================
-- SEED COMPLETE
-- =====================================================
