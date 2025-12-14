-- Quick diagnostic: Check if lead_id column exists and has data

-- 1. Check if column was renamed
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'projects' 
  AND column_name IN ('lead_id', 'converted_from_lead_id')
ORDER BY column_name;
-- Expected: Only 'lead_id' should appear, not 'converted_from_lead_id'

-- 2. Check this specific project (replace the ID with your actual project ID from the URL)
SELECT 
  id,
  project_number,
  name,
  lead_id,
  client_id,
  property_id,
  created_at
FROM projects
WHERE project_number = 'PRJ-20241214-0001'  -- Update this with your actual project number
OR name LIKE '%Amulya%';  -- Or search by client name

-- 3. If project has no lead_id, check if there's a matching lead
SELECT 
  l.id as lead_id,
  l.lead_number,
  l.project_id,
  l.stage,
  c.name as client_name,
  c.email as client_email
FROM leads l
LEFT JOIN clients c ON l.client_id = c.id
WHERE c.name LIKE '%Amulya%'
  OR c.email LIKE '%amulya%'
ORDER BY l.created_at DESC
LIMIT 5;

-- 4. Check if there are any projects that should have lead_id populated
SELECT 
  p.id,
  p.project_number,
  p.name,
  p.lead_id,
  l.id as actual_lead_id,
  l.lead_number,
  l.project_id as lead_points_to_project
FROM projects p
LEFT JOIN leads l ON l.project_id = p.id
WHERE p.client_id IN (SELECT id FROM clients WHERE name LIKE '%Amulya%')
ORDER BY p.created_at DESC;
