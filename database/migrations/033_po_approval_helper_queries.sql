-- =====================================================
-- SQL Helper Scripts: Roles, Permissions & PO Approval
-- Date: 2024-12-06
-- =====================================================

-- ============================================================================
-- SECTION 0: UNDERSTAND THE PERMISSION SYSTEM
-- ============================================================================
/*
The permission system works as follows:

1. USERS TABLE - has basic user info and a legacy 'role' column (for simple apps)
2. ROLES TABLE - defines roles like 'owner', 'admin', 'manager', 'staff', 'sales', etc.
3. USER_ROLES TABLE - links users to roles (many-to-many)
4. PERMISSIONS TABLE - defines granular permissions like 'stock.view', 'po.create', etc.
5. ROLE_PERMISSIONS TABLE - links roles to permissions (what each role can do)

FLOW: User -> user_roles -> roles -> role_permissions -> permissions

Menu visibility is controlled by permissions, NOT by the legacy 'role' column in users table.
*/

-- ============================================================================
-- SECTION 1: DIAGNOSE USER PERMISSIONS
-- ============================================================================

-- 1A. View COMPLETE permission breakdown for ALL users in your tenant
SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.role as legacy_role, -- This is NOT used for menu visibility
    STRING_AGG(DISTINCT r.name, ', ') as assigned_roles,
    STRING_AGG(DISTINCT r.slug, ', ') as role_slugs,
    COUNT(DISTINCT p.key) as permission_count
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
LEFT JOIN role_permissions rp ON rp.role_id = r.id AND rp.granted = true
LEFT JOIN permissions p ON p.id = rp.permission_id
WHERE u.tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
GROUP BY u.id, u.email, u.full_name, u.role
ORDER BY u.full_name;

-- 1B. View SPECIFIC user's roles and ALL their permissions (replace email)
SELECT 
    u.email,
    u.full_name,
    u.role as legacy_role,
    r.name as role_name,
    r.slug as role_slug,
    r.hierarchy_level,
    p.key as permission_key,
    p.name as permission_name
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
LEFT JOIN role_permissions rp ON rp.role_id = r.id AND rp.granted = true
LEFT JOIN permissions p ON p.id = rp.permission_id
WHERE u.email = 'raghu@asettu.com'  -- Change this email
ORDER BY r.hierarchy_level, p.key;

-- 1C. Check who has Stock/Procurement menu access (stock.view permission)
SELECT 
    u.email,
    u.full_name,
    r.name as role_name,
    p.key as permission
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
JOIN role_permissions rp ON rp.role_id = r.id AND rp.granted = true
JOIN permissions p ON p.id = rp.permission_id
WHERE u.tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  AND p.key IN ('stock.view', 'stock.overview', 'materials.view', 'po.view', 'vendors.view')
ORDER BY u.email, p.key;

-- ============================================================================
-- SECTION 2: VIEW ALL ROLES AND THEIR STOCK-RELATED PERMISSIONS
-- ============================================================================

-- 2A. List all roles with their stock/procurement permissions
SELECT 
    r.name as role_name,
    r.slug,
    r.hierarchy_level,
    STRING_AGG(p.key, ', ' ORDER BY p.key) FILTER (WHERE p.key LIKE 'stock%' OR p.key LIKE 'po%' OR p.key LIKE 'materials%' OR p.key LIKE 'vendors%' OR p.key LIKE 'grn%' OR p.key LIKE 'mr%' OR p.key LIKE 'brands%') as stock_permissions
FROM roles r
LEFT JOIN role_permissions rp ON rp.role_id = r.id AND rp.granted = true
LEFT JOIN permissions p ON p.id = rp.permission_id
WHERE r.tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
   OR r.tenant_id IS NULL  -- System roles
GROUP BY r.id, r.name, r.slug, r.hierarchy_level
ORDER BY r.hierarchy_level;

-- 2B. List ALL available stock/procurement permissions
SELECT key, name, description 
FROM permissions 
WHERE key LIKE 'stock%' 
   OR key LIKE 'po%' 
   OR key LIKE 'materials%' 
   OR key LIKE 'vendors%'
   OR key LIKE 'grn%'
   OR key LIKE 'mr%'
   OR key LIKE 'brands%'
ORDER BY key;

-- ============================================================================
-- SECTION 3: REMOVE STOCK ACCESS FROM A USER
-- ============================================================================

-- 3A. Find the role(s) giving stock access to a specific user
SELECT 
    u.email,
    r.id as role_id,
    r.name as role_name,
    r.slug,
    p.key as permission_key
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
JOIN role_permissions rp ON rp.role_id = r.id AND rp.granted = true
JOIN permissions p ON p.id = rp.permission_id
WHERE u.email = 'raghu@asettu.com'  -- Change this
  AND (p.key LIKE 'stock%' OR p.key LIKE 'po%' OR p.key LIKE 'materials%' OR p.key LIKE 'vendors%');

-- 3B. OPTION 1: Remove user from a specific role entirely
-- First, find the role_id from query 3A, then:
DELETE FROM user_roles 
WHERE user_id = (SELECT id FROM users WHERE email = 'raghu@asettu.com')
  AND role_id = 'ROLE_ID_HERE';  -- Replace with actual role_id from 3A

-- 3C. OPTION 2: Remove specific permission from a role (affects ALL users with that role)
-- This removes 'stock.view' permission from the 'sales' role
UPDATE role_permissions 
SET granted = false
WHERE role_id = (SELECT id FROM roles WHERE slug = 'sales' AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()))
  AND permission_id = (SELECT id FROM permissions WHERE key = 'stock.view');

-- Or DELETE the permission entirely:
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE slug = 'sales' AND tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()))
  AND permission_id = (SELECT id FROM permissions WHERE key = 'stock.view');

-- ============================================================================
-- SECTION 4: LIST ALL ROLES ASSIGNED TO A USER
-- ============================================================================

-- 4A. View all roles for a specific user
SELECT 
    r.id as role_id,
    r.name,
    r.slug,
    r.hierarchy_level,
    ur.created_at as assigned_on
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = (SELECT id FROM users WHERE email = 'raghu@asettu.com')
ORDER BY r.hierarchy_level;

-- 4B. Compare roles between two users
SELECT 
    'kv.raghuvarma@gmail.com' as user_email,
    r.name as role_name,
    r.slug
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = (SELECT id FROM users WHERE email = 'kv.raghuvarma@gmail.com')

UNION ALL

SELECT 
    'raghu@asettu.com' as user_email,
    r.name as role_name,
    r.slug
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = (SELECT id FROM users WHERE email = 'raghu@asettu.com')

ORDER BY user_email, role_name;

-- ============================================================================
-- SECTION 5: PENDING APPROVAL POs (Dashboard Query)
-- ============================================================================

-- 5A. View all POs pending approval for your tenant
SELECT 
    po.po_number,
    po.status,
    po.total_amount,
    v.name as vendor_name,
    creator.full_name as created_by,
    creator.email as creator_email,
    po.created_at,
    po.submitted_for_approval_at
FROM stock_purchase_orders po
JOIN stock_vendors v ON v.id = po.vendor_id
LEFT JOIN users creator ON creator.id = po.created_by
WHERE po.tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  AND po.status = 'pending_approval'
ORDER BY po.created_at DESC;

-- 5B. View PO approval history
SELECT 
    pah.action,
    pah.from_status,
    pah.to_status,
    pah.comments,
    u.full_name as performed_by,
    pah.created_at
FROM po_approval_history pah
JOIN users u ON u.id = pah.performed_by
JOIN stock_purchase_orders po ON po.id = pah.po_id
WHERE po.tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
ORDER BY pah.created_at DESC
LIMIT 50;

-- ============================================================================
-- SECTION 6: QUICK REFERENCE - ROLE HIERARCHY
-- ============================================================================
/*
ROLE HIERARCHY FOR PO APPROVAL:

1. OWNER (highest)
   - Can approve any PO regardless of amount
   - Can self-approve their own POs
   - Full system access

2. ADMIN
   - Can approve any PO regardless of amount  
   - Can self-approve their own POs
   - Full system access

3. DIRECTOR
   - Can approve POs up to level2_limit (default: ₹2,00,000)
   - Cannot self-approve
   - Wide system access

4. MANAGER
   - Can approve POs up to level1_limit (default: ₹50,000)
   - Cannot self-approve
   - Department-level access

5. PO_APPROVER (special role)
   - Can approve POs (follows amount limits)
   - Cannot self-approve
   - Limited to PO approval only

6. OTHER ROLES (user, member, etc.)
   - Cannot approve POs
   - Can create/submit POs for approval
*/

-- ============================================================================
-- SECTION 7: GRANT YOURSELF APPROVAL PERMISSION (QUICK FIX)
-- ============================================================================

-- If you need to quickly grant yourself approval permission:
-- Replace the email with your own email

-- Option A: Make yourself a po_approver (minimal additional permissions)
UPDATE users 
SET role = 'po_approver'
WHERE email = 'your.email@example.com';

-- Option B: Make yourself a manager (more permissions)
UPDATE users 
SET role = 'manager'
WHERE email = 'your.email@example.com';

-- Option C: Make yourself an admin (full permissions)
UPDATE users 
SET role = 'admin'
WHERE email = 'your.email@example.com';

-- ============================================================================
-- SECTION 8: GET ALL PERMISSIONS FOR A SPECIFIC USER ID
-- ============================================================================

-- 8A. Get all permissions for a user by their UUID
-- Replace 'USER_UUID_HERE' with the actual user ID
SELECT DISTINCT
    u.id as user_id,
    u.email,
    u.full_name,
    r.name as role_name,
    r.slug as role_slug,
    p.name as permission_name,
    p.description as permission_description
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
WHERE u.id = 'USER_UUID_HERE'  -- Replace with actual UUID
ORDER BY r.name, p.name;

-- 8B. Get permissions for a user by email (easier to use)
-- Replace 'user@example.com' with the actual email
SELECT DISTINCT
    u.id as user_id,
    u.email,
    u.full_name,
    r.name as role_name,
    r.slug as role_slug,
    p.name as permission_name,
    p.description as permission_description
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
WHERE u.email = 'user@example.com'  -- Replace with actual email
ORDER BY r.name, p.name;

-- 8C. Get ONLY the permission names for a user (simplified list)
SELECT DISTINCT p.name as permission
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN role_permissions rp ON rp.role_id = ur.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE u.email = 'raghu@asettu.com'  -- Replace with actual email
ORDER BY p.name;

-- 8D. Check if a specific user has a specific permission
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN 'YES - User has this permission'
        ELSE 'NO - User does NOT have this permission'
    END as has_permission
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN role_permissions rp ON rp.role_id = ur.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE u.email = 'raghu@asettu.com'  -- Replace with email
  AND p.name = 'stock.view';        -- Replace with permission to check

-- 8E. Summary: Count of permissions per role for a user
SELECT 
    r.name as role_name,
    r.slug as role_slug,
    COUNT(DISTINCT p.id) as permission_count
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
JOIN role_permissions rp ON rp.role_id = r.id
JOIN permissions p ON p.id = rp.permission_id
WHERE u.email = 'raghu@asettu.com'  -- Replace with email
GROUP BY r.id, r.name, r.slug
ORDER BY permission_count DESC;

-- ============================================================================
-- SECTION 9: DIAGNOSE TENANT ASSOCIATION ISSUE
-- ============================================================================

-- 9A. Check if users have tenant_id set
SELECT 
    id,
    email,
    full_name,
    tenant_id,
    CASE 
        WHEN tenant_id IS NULL THEN '❌ NO TENANT'
        ELSE '✅ HAS TENANT'
    END as tenant_status,
    created_at
FROM users
WHERE email IN ('kv.raghuvarma@gmail.com', 'raghu@asettu.com')
ORDER BY email;

-- 9B. Check tenant details
SELECT 
    t.id,
    t.company_name,
    t.status,
    t.created_at,
    COUNT(DISTINCT u.id) as user_count
FROM tenants t
LEFT JOIN users u ON u.tenant_id = t.id
GROUP BY t.id, t.company_name, t.status, t.created_at
ORDER BY t.created_at DESC;

-- 9C. Find users without tenant_id
SELECT 
    id,
    email,
    full_name,
    created_at
FROM users
WHERE tenant_id IS NULL
ORDER BY created_at DESC;

-- 9D. Fix missing tenant_id (if needed)
-- First, find the tenant ID you want to assign
SELECT id, company_name FROM tenants LIMIT 5;

-- Then assign users to that tenant
-- UPDATE users 
-- SET tenant_id = 'YOUR_TENANT_ID_HERE'
-- WHERE email IN ('kv.raghuvarma@gmail.com', 'raghu@asettu.com');

-- 9E. Verify the fix
SELECT 
    u.email,
    u.tenant_id,
    t.company_name
FROM users u
LEFT JOIN tenants t ON t.id = u.tenant_id
WHERE u.email IN ('kv.raghuvarma@gmail.com', 'raghu@asettu.com');
