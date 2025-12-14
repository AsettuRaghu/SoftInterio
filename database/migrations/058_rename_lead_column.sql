-- Migration: Rename projects.converted_from_lead_id to projects.lead_id
-- This makes the column name consistent with client_id, property_id, and project_manager_id

-- Step 1: Rename the column
ALTER TABLE projects 
RENAME COLUMN converted_from_lead_id TO lead_id;

-- Step 2: Update the index name for consistency
DROP INDEX IF EXISTS idx_projects_converted_from_lead;
DROP INDEX IF EXISTS idx_projects_converted_from_lead_id;

CREATE INDEX idx_projects_lead_id 
ON projects(lead_id) 
WHERE lead_id IS NOT NULL;

-- Step 3: Drop the old FK constraint (if it exists from migration 057)
ALTER TABLE projects 
DROP CONSTRAINT IF EXISTS projects_converted_from_lead_id_fkey;

-- Step 4: Add the new FK constraint with the proper name
ALTER TABLE projects
ADD CONSTRAINT projects_lead_id_fkey
FOREIGN KEY (lead_id)
REFERENCES leads(id)
ON DELETE SET NULL;

-- Step 5: Update comments
COMMENT ON COLUMN projects.lead_id 
IS 'Foreign key to the lead that was converted into this project. Links project back to its sales origin.';

COMMENT ON CONSTRAINT projects_lead_id_fkey ON projects 
IS 'Links project to the lead it was converted from, enabling proper relationship queries';

COMMENT ON TABLE projects 
IS 'Interior design projects with proper FK relationships: client_id→clients, property_id→properties, lead_id→leads, project_manager_id→users';

-- Step 6: Verify all foreign keys
DO $$
DECLARE
    v_client_fk_exists BOOLEAN;
    v_property_fk_exists BOOLEAN;
    v_lead_fk_exists BOOLEAN;
    v_manager_fk_exists BOOLEAN;
BEGIN
    -- Check all FK constraints
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'projects_client_id_fkey' 
        AND table_name = 'projects'
    ) INTO v_client_fk_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'projects_property_id_fkey' 
        AND table_name = 'projects'
    ) INTO v_property_fk_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'projects_lead_id_fkey' 
        AND table_name = 'projects'
    ) INTO v_lead_fk_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'projects_project_manager_id_fkey' 
        AND table_name = 'projects'
    ) INTO v_manager_fk_exists;
    
    -- Report results
    RAISE NOTICE '=== Project Foreign Key Constraints (After Rename) ===';
    RAISE NOTICE 'client_id → clients: %', CASE WHEN v_client_fk_exists THEN '✓ EXISTS' ELSE '✗ MISSING' END;
    RAISE NOTICE 'property_id → properties: %', CASE WHEN v_property_fk_exists THEN '✓ EXISTS' ELSE '✗ MISSING' END;
    RAISE NOTICE 'lead_id → leads: %', CASE WHEN v_lead_fk_exists THEN '✓ EXISTS' ELSE '✗ MISSING' END;
    RAISE NOTICE 'project_manager_id → users: %', CASE WHEN v_manager_fk_exists THEN '✓ EXISTS' ELSE '✗ MISSING' END;
    RAISE NOTICE '====================================================';
    
    IF v_client_fk_exists AND v_property_fk_exists AND v_lead_fk_exists AND v_manager_fk_exists THEN
        RAISE NOTICE 'SUCCESS: All project metadata foreign keys properly configured with consistent naming!';
    ELSE
        RAISE WARNING 'Some foreign key constraints are missing. Please review the output above.';
    END IF;
END $$;
