-- Migration: Rename priority to lead_score and update values
-- From: low, medium, high, urgent
-- To: cold, warm, hot, on_hold

-- Step 1: Add new lead_score column
ALTER TABLE leads ADD COLUMN lead_score character varying(20) DEFAULT 'warm'::character varying;

-- Step 2: Migrate existing data from priority to lead_score
-- Mapping: low -> cold, medium -> warm, high -> hot, urgent -> hot
UPDATE leads SET lead_score = CASE 
    WHEN priority = 'low' THEN 'cold'
    WHEN priority = 'medium' THEN 'warm'
    WHEN priority = 'high' THEN 'hot'
    WHEN priority = 'urgent' THEN 'hot'
    ELSE 'warm'
END;

-- Step 3: Also update lead_tasks table if it has priority field (maps to similar values)
-- Note: lead_tasks priority is separate concept, keeping as is

-- Step 4: Add comment for the new column
COMMENT ON COLUMN leads.lead_score IS 'Lead score indicating engagement level: cold, warm, hot, on_hold';

-- Step 5: Create index for lead_score queries
CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads(lead_score);

-- Step 6: Drop old priority column (optional - can be done later after verifying migration)
-- Uncomment the line below after verifying the migration worked correctly
-- ALTER TABLE leads DROP COLUMN priority;

-- Note: For now, keeping both columns. The application will use lead_score.
-- In a future migration, we can drop the priority column once verified.
