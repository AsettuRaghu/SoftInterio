-- Diagnostic queries to check project, client, and property data

-- Query 1: Check a specific project's references
SELECT 
  p.id as project_id,
  p.project_number,
  p.name as project_name,
  p.client_id,
  p.property_id,
  p.converted_from_lead_id,
  p.lead_id,
  -- Check if client exists
  CASE WHEN c.id IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as client_status,
  c.name as client_name,
  c.email as client_email,
  c.phone as client_phone,
  -- Check if property exists
  CASE WHEN pr.id IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as property_status,
  pr.property_name,
  pr.unit_number,
  pr.property_type,
  pr.city
FROM projects p
LEFT JOIN clients c ON p.client_id = c.id
LEFT JOIN properties pr ON p.property_id = pr.id
WHERE p.is_active = true
ORDER BY p.created_at DESC
LIMIT 5;

-- Query 2: Check lead-to-project relationship
SELECT 
  l.id as lead_id,
  l.lead_number,
  l.client_id as lead_client_id,
  l.property_id as lead_property_id,
  l.project_id as lead_project_ref,
  p.id as project_id,
  p.project_number,
  p.client_id as project_client_id,
  p.property_id as project_property_id,
  -- Verification
  CASE 
    WHEN p.client_id = l.client_id THEN 'MATCH'
    WHEN p.client_id IS NULL AND l.client_id IS NOT NULL THEN 'MISSING IN PROJECT'
    WHEN p.client_id IS NOT NULL AND l.client_id IS NULL THEN 'MISSING IN LEAD'
    ELSE 'MISMATCH'
  END as client_id_status,
  CASE 
    WHEN p.property_id = l.property_id THEN 'MATCH'
    WHEN p.property_id IS NULL AND l.property_id IS NOT NULL THEN 'MISSING IN PROJECT'
    WHEN p.property_id IS NOT NULL AND l.property_id IS NULL THEN 'MISSING IN LEAD'
    ELSE 'MISMATCH'
  END as property_id_status
FROM leads l
LEFT JOIN projects p ON l.project_id = p.id
WHERE l.stage = 'won' AND l.project_id IS NOT NULL
ORDER BY l.won_at DESC
LIMIT 5;

-- Query 3: Check for orphaned projects (no client or property)
SELECT 
  COUNT(*) as total_projects,
  COUNT(client_id) as projects_with_client,
  COUNT(property_id) as projects_with_property,
  COUNT(*) - COUNT(client_id) as projects_without_client,
  COUNT(*) - COUNT(property_id) as projects_without_property
FROM projects
WHERE is_active = true;

-- Query 4: Sample client data
SELECT 
  id,
  name,
  email,
  phone,
  tenant_id,
  created_at
FROM clients
ORDER BY created_at DESC
LIMIT 3;

-- Query 5: Sample property data
SELECT 
  id,
  property_name,
  unit_number,
  property_type,
  city,
  tenant_id,
  created_at
FROM properties
ORDER BY created_at DESC
LIMIT 3;
