-- ============================================================================
-- QUOTATION-LEAD INTEGRATION
-- Links quotations tightly to leads, enforces stage flow, auto-creates quotations
-- ============================================================================

-- ============================================================================
-- SECTION 1: MODIFY QUOTATIONS TABLE
-- Remove duplicate fields that exist in leads, make lead_id required
-- ============================================================================

-- Step 1: Drop existing constraints if any
ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_lead_id_fkey;

-- Step 2: Make lead_id NOT NULL (quotations must have a lead)
-- First, delete any orphan quotations without leads (if any exist from sample data)
DELETE FROM quotations WHERE lead_id IS NULL;

-- Now make lead_id required
ALTER TABLE quotations 
    ALTER COLUMN lead_id SET NOT NULL;

-- Re-add foreign key with proper cascade
ALTER TABLE quotations 
    ADD CONSTRAINT quotations_lead_id_fkey 
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

-- Step 3: Add auto_created flag to track system-generated quotations
ALTER TABLE quotations 
    ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT false;

-- Step 4: Add comments for clarity
COMMENT ON COLUMN quotations.lead_id IS 'Required - every quotation must be linked to a lead';
COMMENT ON COLUMN quotations.auto_created IS 'True if quotation was auto-created when lead moved to proposal_discussion stage';
COMMENT ON COLUMN quotations.client_name IS 'DEPRECATED - Use leads.client_name instead. Kept for backward compatibility.';
COMMENT ON COLUMN quotations.client_email IS 'DEPRECATED - Use leads.email instead. Kept for backward compatibility.';
COMMENT ON COLUMN quotations.client_phone IS 'DEPRECATED - Use leads.phone instead. Kept for backward compatibility.';
COMMENT ON COLUMN quotations.property_name IS 'DEPRECATED - Use leads.property_name instead. Kept for backward compatibility.';
COMMENT ON COLUMN quotations.property_address IS 'DEPRECATED - Use leads.property_address instead. Kept for backward compatibility.';
COMMENT ON COLUMN quotations.property_type IS 'DEPRECATED - Use leads.property_type instead. Kept for backward compatibility.';
COMMENT ON COLUMN quotations.carpet_area IS 'DEPRECATED - Use leads.carpet_area_sqft instead. Kept for backward compatibility.';

-- ============================================================================
-- SECTION 2: CREATE VIEW FOR QUOTATIONS WITH LEAD DATA
-- This view joins quotations with leads to provide complete data
-- ============================================================================

CREATE OR REPLACE VIEW quotations_with_lead AS
SELECT 
    q.id,
    q.tenant_id,
    q.quotation_number,
    q.version,
    q.parent_quotation_id,
    q.lead_id,
    q.project_id,
    
    -- Client details from lead (not quotation)
    l.client_name,
    l.email AS client_email,
    l.phone AS client_phone,
    
    -- Property details from lead (not quotation)
    l.property_name,
    l.property_address,
    l.property_type,
    l.carpet_area_sqft AS carpet_area,
    l.property_city,
    l.flat_number,
    
    -- Lead info
    l.lead_number,
    l.stage AS lead_stage,
    l.budget_range,
    l.estimated_value,
    l.service_type,
    l.project_scope,
    
    -- Quotation-specific fields
    q.title,
    q.description,
    q.status,
    q.valid_from,
    q.valid_until,
    q.subtotal,
    q.discount_type,
    q.discount_value,
    q.discount_amount,
    q.taxable_amount,
    q.tax_percent,
    q.tax_amount,
    q.overhead_percent,
    q.overhead_amount,
    q.grand_total,
    q.payment_terms,
    q.terms_and_conditions,
    q.notes,
    q.sent_at,
    q.viewed_at,
    q.approved_at,
    q.rejected_at,
    q.rejection_reason,
    q.auto_created,
    q.created_by,
    q.updated_by,
    q.created_at,
    q.updated_at
FROM quotations q
JOIN leads l ON l.id = q.lead_id;

COMMENT ON VIEW quotations_with_lead IS 'Quotations with client/property data pulled from linked lead';

-- ============================================================================
-- SECTION 3: FUNCTION TO AUTO-CREATE QUOTATION
-- Called when lead moves to proposal_discussion stage
-- ============================================================================

CREATE OR REPLACE FUNCTION create_quotation_for_lead(
    p_lead_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
    v_quotation_id UUID;
    v_quotation_number VARCHAR(50);
    v_lead RECORD;
BEGIN
    -- Get lead details
    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found: %', p_lead_id;
    END IF;
    
    v_tenant_id := v_lead.tenant_id;
    
    -- Generate quotation number
    v_quotation_number := generate_quotation_number(v_tenant_id);
    
    -- Create the quotation
    INSERT INTO quotations (
        tenant_id,
        quotation_number,
        version,
        lead_id,
        -- Snapshot fields (deprecated but kept for compatibility)
        client_name,
        client_email,
        client_phone,
        property_name,
        property_address,
        property_type,
        carpet_area,
        -- Quotation fields
        title,
        status,
        valid_from,
        valid_until,
        auto_created,
        created_by,
        updated_by
    ) VALUES (
        v_tenant_id,
        v_quotation_number,
        1,  -- First version
        p_lead_id,
        -- Snapshot from lead (for backward compatibility)
        v_lead.client_name,
        v_lead.email,
        v_lead.phone,
        v_lead.property_name,
        v_lead.property_address,
        v_lead.property_type::VARCHAR,
        v_lead.carpet_area_sqft,
        -- Default title
        COALESCE(v_lead.service_type::VARCHAR, 'Interior') || ' - ' || v_lead.client_name,
        'draft',
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '30 days',
        true,  -- auto_created
        COALESCE(p_user_id, v_lead.assigned_to, v_lead.created_by),
        COALESCE(p_user_id, v_lead.assigned_to, v_lead.created_by)
    )
    RETURNING id INTO v_quotation_id;
    
    -- Log activity on lead
    INSERT INTO lead_activities (
        lead_id,
        activity_type,
        title,
        description,
        created_by
    ) VALUES (
        p_lead_id,
        'quotation_sent',  -- Using existing type, or could add 'quotation_created'
        'Quotation Created',
        'Auto-created quotation ' || v_quotation_number || ' when lead moved to Proposal Discussion stage',
        COALESCE(p_user_id, v_lead.assigned_to, v_lead.created_by)
    );
    
    RETURN v_quotation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_quotation_for_lead IS 'Creates a new quotation for a lead. Called automatically when lead moves to proposal_discussion stage.';

-- ============================================================================
-- SECTION 4: TRIGGER FOR AUTO-QUOTATION ON STAGE CHANGE
-- ============================================================================

CREATE OR REPLACE FUNCTION on_lead_stage_change()
RETURNS TRIGGER AS $$
DECLARE
    v_quotation_id UUID;
    v_existing_count INTEGER;
BEGIN
    -- Only trigger on stage change
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
        
        -- When moving TO proposal_discussion, auto-create quotation
        IF NEW.stage = 'proposal_discussion' THEN
            -- Check if lead already has a quotation (don't create duplicate)
            SELECT COUNT(*) INTO v_existing_count
            FROM quotations
            WHERE lead_id = NEW.id;
            
            -- Only create if no quotation exists
            IF v_existing_count = 0 THEN
                v_quotation_id := create_quotation_for_lead(NEW.id, NULL);
                
                -- We could also create a notification here
                -- INSERT INTO notifications (...) VALUES (...);
            END IF;
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_lead_stage_change ON leads;

-- Create the trigger
CREATE TRIGGER trg_lead_stage_change
    AFTER UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION on_lead_stage_change();

COMMENT ON TRIGGER trg_lead_stage_change ON leads IS 'Auto-creates quotation when lead moves to proposal_discussion stage';

-- ============================================================================
-- SECTION 5: FUNCTION TO CREATE QUOTATION REVISION
-- Creates a new version of an existing quotation
-- ============================================================================

CREATE OR REPLACE FUNCTION create_quotation_revision(
    p_quotation_id UUID,
    p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_new_quotation_id UUID;
    v_current_version INTEGER;
    v_quotation RECORD;
BEGIN
    -- Get current quotation
    SELECT * INTO v_quotation FROM quotations WHERE id = p_quotation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quotation not found: %', p_quotation_id;
    END IF;
    
    -- Get max version for this quotation number
    SELECT COALESCE(MAX(version), 0) INTO v_current_version
    FROM quotations
    WHERE tenant_id = v_quotation.tenant_id
    AND quotation_number = v_quotation.quotation_number;
    
    -- Use the duplicate_quotation function (already exists)
    v_new_quotation_id := duplicate_quotation(p_quotation_id, p_user_id);
    
    -- Update to mark as revision (not auto-created)
    UPDATE quotations
    SET auto_created = false
    WHERE id = v_new_quotation_id;
    
    RETURN v_new_quotation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_quotation_revision IS 'Creates a new version/revision of an existing quotation';

-- ============================================================================
-- SECTION 6: INDEX FOR PERFORMANCE
-- ============================================================================

-- Index for finding quotations by lead
CREATE INDEX IF NOT EXISTS idx_quotations_lead ON quotations(lead_id);

-- Index for finding latest version of a quotation
CREATE INDEX IF NOT EXISTS idx_quotations_number_version ON quotations(tenant_id, quotation_number, version DESC);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- Changes made:
-- 1. Made lead_id required on quotations table
-- 2. Added auto_created flag to quotations
-- 3. Created quotations_with_lead view for reading complete data
-- 4. Created create_quotation_for_lead function
-- 5. Created trigger to auto-create quotation on stage change
-- 6. Created create_quotation_revision function
--
-- Note: The deprecated client/property fields are kept for backward 
-- compatibility but should not be used. Always pull from lead via the view.
-- ============================================================================
