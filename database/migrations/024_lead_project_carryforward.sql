-- Migration: Add project_id to lead_notes and lead_documents
-- Purpose: Enable carry-forward of notes and documents when a lead becomes a project

-- ============================================================================
-- 1. ADD project_id COLUMN TO lead_notes
-- ============================================================================

-- Add project_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lead_notes' AND column_name = 'project_id'
    ) THEN
        ALTER TABLE lead_notes ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
        
        -- Add index for project lookups
        CREATE INDEX IF NOT EXISTS idx_lead_notes_project_id ON lead_notes(project_id);
        
        RAISE NOTICE 'Added project_id column to lead_notes';
    ELSE
        RAISE NOTICE 'project_id column already exists in lead_notes';
    END IF;
END $$;

-- ============================================================================
-- 2. ADD project_id COLUMN TO lead_documents
-- ============================================================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lead_documents' AND column_name = 'project_id'
    ) THEN
        ALTER TABLE lead_documents ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
        
        -- Add index for project lookups
        CREATE INDEX IF NOT EXISTS idx_lead_documents_project_id ON lead_documents(project_id);
        
        RAISE NOTICE 'Added project_id column to lead_documents';
    ELSE
        RAISE NOTICE 'project_id column already exists in lead_documents';
    END IF;
END $$;

-- ============================================================================
-- 3. FUNCTION: Carry forward data when lead is won
-- ============================================================================

-- This function is called when a lead transitions to "won" stage
-- It links the existing notes, documents, and quotations to the new project
CREATE OR REPLACE FUNCTION carry_forward_lead_data_to_project(
    p_lead_id UUID,
    p_project_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_notes_count INTEGER := 0;
    v_documents_count INTEGER := 0;
    v_quotations_count INTEGER := 0;
    v_result JSONB;
BEGIN
    -- 1. Link notes to project (not copy - they retain lead_id as well)
    UPDATE lead_notes 
    SET project_id = p_project_id
    WHERE lead_id = p_lead_id
    AND project_id IS NULL;
    
    GET DIAGNOSTICS v_notes_count = ROW_COUNT;
    
    -- 2. Link documents to project
    UPDATE lead_documents 
    SET project_id = p_project_id
    WHERE lead_id = p_lead_id
    AND project_id IS NULL;
    
    GET DIAGNOSTICS v_documents_count = ROW_COUNT;
    
    -- 3. Link quotations to project (quotations table already has project_id)
    UPDATE quotations 
    SET project_id = p_project_id
    WHERE lead_id = p_lead_id
    AND project_id IS NULL;
    
    GET DIAGNOSTICS v_quotations_count = ROW_COUNT;
    
    -- Build result summary
    v_result := jsonb_build_object(
        'success', true,
        'lead_id', p_lead_id,
        'project_id', p_project_id,
        'carried_forward', jsonb_build_object(
            'notes', v_notes_count,
            'documents', v_documents_count,
            'quotations', v_quotations_count
        )
    );
    
    RETURN v_result;
END;
$$;

-- ============================================================================
-- 4. TRIGGER: Auto-carry forward on lead won (optional - can also call manually)
-- ============================================================================

-- This trigger automatically carries forward data when a lead is marked as won
-- and a project_id is set on the lead record
CREATE OR REPLACE FUNCTION trigger_carry_forward_on_lead_won()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only trigger when:
    -- 1. Stage changes to 'won'
    -- 2. project_id is set (lead is linked to a project)
    IF NEW.stage = 'won' 
       AND OLD.stage != 'won'
       AND NEW.project_id IS NOT NULL
    THEN
        PERFORM carry_forward_lead_data_to_project(NEW.id, NEW.project_id);
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger (only if leads table has project_id column)
DO $$
BEGIN
    -- Check if leads table has project_id column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'project_id'
    ) THEN
        -- Drop existing trigger if any
        DROP TRIGGER IF EXISTS trg_carry_forward_on_lead_won ON leads;
        
        -- Create new trigger
        CREATE TRIGGER trg_carry_forward_on_lead_won
            AFTER UPDATE ON leads
            FOR EACH ROW
            EXECUTE FUNCTION trigger_carry_forward_on_lead_won();
            
        RAISE NOTICE 'Created auto-carry-forward trigger on leads table';
    ELSE
        RAISE NOTICE 'leads table does not have project_id column - trigger not created';
        RAISE NOTICE 'You can manually call carry_forward_lead_data_to_project() when creating the project';
    END IF;
END $$;

-- ============================================================================
-- 5. VIEWS: Combined views for project notes/documents including lead data
-- ============================================================================

-- View: All notes for a project (including inherited from lead)
CREATE OR REPLACE VIEW project_notes_combined AS
SELECT 
    n.id,
    n.lead_id,
    n.project_id,
    n.content,
    n.is_pinned,
    n.created_by,
    n.created_at,
    n.updated_at,
    CASE 
        WHEN n.project_id IS NOT NULL AND n.lead_id IS NOT NULL THEN 'carried_forward'
        WHEN n.project_id IS NOT NULL THEN 'project_native'
        ELSE 'lead_only'
    END as source_type,
    u.name as created_by_name,
    u.avatar_url as created_by_avatar
FROM lead_notes n
LEFT JOIN users u ON n.created_by = u.id
WHERE n.project_id IS NOT NULL;

-- View: All documents for a project (including inherited from lead)
CREATE OR REPLACE VIEW project_documents_combined AS
SELECT 
    d.id,
    d.lead_id,
    d.project_id,
    d.file_name,
    d.file_type,
    d.file_size_bytes,
    d.file_url,
    d.storage_path,
    d.document_type,
    d.description,
    d.uploaded_by,
    d.created_at,
    CASE 
        WHEN d.project_id IS NOT NULL AND d.lead_id IS NOT NULL THEN 'carried_forward'
        WHEN d.project_id IS NOT NULL THEN 'project_native'
        ELSE 'lead_only'
    END as source_type,
    u.name as uploaded_by_name,
    u.avatar_url as uploaded_by_avatar
FROM lead_documents d
LEFT JOIN users u ON d.uploaded_by = u.id
WHERE d.project_id IS NOT NULL;

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permission on the carry forward function
GRANT EXECUTE ON FUNCTION carry_forward_lead_data_to_project(UUID, UUID) TO authenticated;

-- Grant select on views
GRANT SELECT ON project_notes_combined TO authenticated;
GRANT SELECT ON project_documents_combined TO authenticated;

-- ============================================================================
-- 7. COMMENTS / DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN lead_notes.project_id IS 'Reference to project when lead is converted to project. Notes are linked (not copied) to maintain single source of truth.';
COMMENT ON COLUMN lead_documents.project_id IS 'Reference to project when lead is converted to project. Documents are linked (not copied) to maintain single source of truth.';
COMMENT ON FUNCTION carry_forward_lead_data_to_project IS 'Links existing lead notes, documents, and quotations to a project when a lead is won. Call this when creating a project from a won lead.';
COMMENT ON VIEW project_notes_combined IS 'Combined view of all project notes including those carried forward from leads. Use source_type column to distinguish origin.';
COMMENT ON VIEW project_documents_combined IS 'Combined view of all project documents including those carried forward from leads. Use source_type column to distinguish origin.';
