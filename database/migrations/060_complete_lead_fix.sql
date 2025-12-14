-- Complete fix: Ensure lead_id column exists and is populated

-- STEP 1: Check current state
DO $$
DECLARE
  v_has_old_column BOOLEAN;
  v_has_new_column BOOLEAN;
BEGIN
  -- Check if old column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'converted_from_lead_id'
  ) INTO v_has_old_column;
  
  -- Check if new column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'lead_id'
  ) INTO v_has_new_column;
  
  RAISE NOTICE '=== Current Column State ===';
  RAISE NOTICE 'Has converted_from_lead_id: %', v_has_old_column;
  RAISE NOTICE 'Has lead_id: %', v_has_new_column;
  
  IF v_has_old_column AND NOT v_has_new_column THEN
    RAISE NOTICE 'ACTION NEEDED: Run migration 058 to rename column';
  ELSIF v_has_old_column AND v_has_new_column THEN
    RAISE NOTICE 'WARNING: Both columns exist! Manual intervention needed.';
  ELSIF NOT v_has_old_column AND v_has_new_column THEN
    RAISE NOTICE 'OK: Column already renamed to lead_id';
  ELSE
    RAISE NOTICE 'ERROR: No lead column found at all!';
  END IF;
END $$;

-- STEP 2: Rename column if needed (from migration 058)
DO $$
BEGIN
  -- Check if we need to rename
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'converted_from_lead_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'lead_id'
  ) THEN
    RAISE NOTICE 'Renaming converted_from_lead_id to lead_id...';
    
    -- Rename the column
    ALTER TABLE projects 
    RENAME COLUMN converted_from_lead_id TO lead_id;
    
    -- Update index
    DROP INDEX IF EXISTS idx_projects_converted_from_lead;
    DROP INDEX IF EXISTS idx_projects_converted_from_lead_id;
    CREATE INDEX idx_projects_lead_id 
    ON projects(lead_id) 
    WHERE lead_id IS NOT NULL;
    
    -- Drop old FK if exists
    ALTER TABLE projects 
    DROP CONSTRAINT IF EXISTS projects_converted_from_lead_id_fkey;
    
    -- Add new FK
    ALTER TABLE projects
    ADD CONSTRAINT projects_lead_id_fkey
    FOREIGN KEY (lead_id)
    REFERENCES leads(id)
    ON DELETE SET NULL;
    
    RAISE NOTICE 'Column renamed successfully!';
  ELSE
    RAISE NOTICE 'Column already named lead_id or both columns exist';
  END IF;
END $$;

-- STEP 3: Populate lead_id from leads.project_id relationship
-- Many projects may have been linked via leads.project_id but not projects.lead_id
UPDATE projects p
SET lead_id = l.id
FROM leads l
WHERE l.project_id = p.id
  AND p.lead_id IS NULL
  AND l.id IS NOT NULL;

-- Report results
DO $$
DECLARE
  v_total_projects INTEGER;
  v_projects_with_lead INTEGER;
  v_projects_without_lead INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_projects
  FROM projects WHERE is_active = true;
  
  SELECT COUNT(*) INTO v_projects_with_lead
  FROM projects WHERE is_active = true AND lead_id IS NOT NULL;
  
  SELECT COUNT(*) INTO v_projects_without_lead
  FROM projects WHERE is_active = true AND lead_id IS NULL;
  
  RAISE NOTICE '=== Project Lead Linking Status ===';
  RAISE NOTICE 'Total Active Projects: %', v_total_projects;
  RAISE NOTICE 'Projects With Lead: %', v_projects_with_lead;
  RAISE NOTICE 'Projects Without Lead: %', v_projects_without_lead;
  
  IF v_projects_without_lead > 0 THEN
    RAISE NOTICE 'Some projects still have no lead link. These may have been created manually.';
  END IF;
END $$;

-- STEP 4: Show projects that still need lead linking
SELECT 
  p.project_number,
  p.name as project_name,
  c.name as client_name,
  p.lead_id,
  'No lead linked' as status
FROM projects p
LEFT JOIN clients c ON p.client_id = c.id
WHERE p.is_active = true
  AND p.lead_id IS NULL
ORDER BY p.created_at DESC
LIMIT 10;
