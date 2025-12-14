-- Complete Diagnostic Script for Project Overview Issue
-- Run this to see the complete state of your data

\echo '=== STEP 1: Check Projects Table Structure ==='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'projects'
  AND column_name IN ('id', 'project_number', 'client_id', 'property_id', 'converted_from_lead_id')
ORDER BY ordinal_position;

\echo ''
\echo '=== STEP 2: Check Recent Projects ==='
SELECT 
  p.id,
  p.project_number,
  p.name,
  p.client_id,
  p.property_id,
  p.converted_from_lead_id,
  p.created_at,
  CASE 
    WHEN p.client_id IS NOT NULL THEN '✓ Has Client ID'
    ELSE '✗ Missing Client ID'
  END as client_status,
  CASE 
    WHEN p.property_id IS NOT NULL THEN '✓ Has Property ID'
    ELSE '✗ Missing Property ID'
  END as property_status
FROM projects p
WHERE p.is_active = true
ORDER BY p.created_at DESC
LIMIT 10;

\echo ''
\echo '=== STEP 3: Check if Client Records Exist ==='
SELECT 
  p.project_number,
  p.client_id,
  c.id as actual_client_id,
  c.name as client_name,
  c.email,
  c.phone,
  CASE 
    WHEN c.id IS NOT NULL THEN '✓ Client Record Found'
    WHEN p.client_id IS NOT NULL THEN '✗ Client ID Set But Record Missing'
    ELSE '✗ No Client ID'
  END as status
FROM projects p
LEFT JOIN clients c ON p.client_id = c.id
WHERE p.is_active = true
ORDER BY p.created_at DESC
LIMIT 10;

\echo ''
\echo '=== STEP 4: Check if Property Records Exist ==='
SELECT 
  p.project_number,
  p.property_id,
  pr.id as actual_property_id,
  pr.property_name,
  pr.unit_number,
  pr.property_type,
  pr.city,
  CASE 
    WHEN pr.id IS NOT NULL THEN '✓ Property Record Found'
    WHEN p.property_id IS NOT NULL THEN '✗ Property ID Set But Record Missing'
    ELSE '✗ No Property ID'
  END as status
FROM projects p
LEFT JOIN properties pr ON p.property_id = pr.id
WHERE p.is_active = true
ORDER BY p.created_at DESC
LIMIT 10;

\echo ''
\echo '=== STEP 5: Check Lead to Project Conversion ==='
SELECT 
  l.lead_number,
  l.stage,
  l.client_id as lead_client_id,
  l.property_id as lead_property_id,
  l.project_id as lead_project_ref,
  p.project_number,
  p.client_id as project_client_id,
  p.property_id as project_property_id,
  CASE 
    WHEN p.client_id = l.client_id THEN '✓ Client ID Match'
    WHEN p.client_id IS NULL THEN '✗ Project Missing Client ID'
    WHEN l.client_id IS NULL THEN '✗ Lead Missing Client ID'
    ELSE '! Client ID Mismatch'
  END as client_status,
  CASE 
    WHEN p.property_id = l.property_id THEN '✓ Property ID Match'
    WHEN p.property_id IS NULL THEN '✗ Project Missing Property ID'
    WHEN l.property_id IS NULL THEN '○ Lead Has No Property (OK for consultation)'
    ELSE '! Property ID Mismatch'
  END as property_status
FROM leads l
LEFT JOIN projects p ON l.project_id = p.id
WHERE l.stage = 'won'
ORDER BY l.won_at DESC
LIMIT 10;

\echo ''
\echo '=== STEP 6: Summary Statistics ==='
SELECT 
  'Total Active Projects' as metric,
  COUNT(*)::text as value
FROM projects
WHERE is_active = true
UNION ALL
SELECT 
  'Projects with Client ID' as metric,
  COUNT(*)::text as value
FROM projects
WHERE is_active = true AND client_id IS NOT NULL
UNION ALL
SELECT 
  'Projects with Property ID' as metric,
  COUNT(*)::text as value
FROM projects
WHERE is_active = true AND property_id IS NOT NULL
UNION ALL
SELECT 
  'Projects Missing Client ID' as metric,
  COUNT(*)::text as value
FROM projects
WHERE is_active = true AND client_id IS NULL
UNION ALL
SELECT 
  'Projects Missing Property ID' as metric,
  COUNT(*)::text as value
FROM projects
WHERE is_active = true AND property_id IS NULL;

\echo ''
\echo '=== STEP 7: Check Foreign Key Constraints ==='
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'projects'
  AND kcu.column_name IN ('client_id', 'property_id')
ORDER BY tc.constraint_name;

\echo ''
\echo '=== Diagnostic Complete ==='
\echo 'Review the output above to identify any issues.'
\echo ''
