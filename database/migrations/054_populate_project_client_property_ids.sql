-- Migration: Populate client_id and property_id for existing projects
-- This script ensures all projects converted from leads have proper client_id and property_id references

-- Step 1: Update projects that were converted from leads but missing client_id
UPDATE projects p
SET client_id = l.client_id,
    updated_at = NOW()
FROM leads l
WHERE p.converted_from_lead_id = l.id
  AND p.client_id IS NULL
  AND l.client_id IS NOT NULL;

-- Step 2: Update projects that were converted from leads but missing property_id
UPDATE projects p
SET property_id = l.property_id,
    updated_at = NOW()
FROM leads l
WHERE p.converted_from_lead_id = l.id
  AND p.property_id IS NULL
  AND l.property_id IS NOT NULL;

-- Step 3: Report on projects still missing client or property references
DO $$
DECLARE
    v_missing_client INTEGER;
    v_missing_property INTEGER;
    v_total_projects INTEGER;
BEGIN
    -- Count projects missing client_id
    SELECT COUNT(*) INTO v_missing_client
    FROM projects
    WHERE client_id IS NULL AND is_active = true;
    
    -- Count projects missing property_id
    SELECT COUNT(*) INTO v_missing_property
    FROM projects
    WHERE property_id IS NULL AND is_active = true;
    
    -- Count total active projects
    SELECT COUNT(*) INTO v_total_projects
    FROM projects
    WHERE is_active = true;
    
    -- Log results
    RAISE NOTICE '=== Project Client/Property Reference Check ===';
    RAISE NOTICE 'Total Active Projects: %', v_total_projects;
    RAISE NOTICE 'Projects Missing Client Reference: %', v_missing_client;
    RAISE NOTICE 'Projects Missing Property Reference: %', v_missing_property;
    
    IF v_missing_client > 0 THEN
        RAISE NOTICE 'WARNING: Some projects are missing client references. These projects may need manual linking.';
    END IF;
    
    IF v_missing_property > 0 THEN
        RAISE NOTICE 'INFO: Some projects are missing property references. This may be expected for consultation-only projects.';
    END IF;
END $$;

-- Step 4: Add comment
COMMENT ON TABLE projects IS 'Interior design projects - All projects should have client_id set. property_id is optional for consultation-only projects.';
