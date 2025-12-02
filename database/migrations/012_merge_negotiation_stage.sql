-- =====================================================
-- SoftInterio Stage Merge Migration
-- =====================================================
-- Description: Merge 'negotiation' stage into 'proposal_discussion'
-- Rename proposal_discussion to 'Proposal & Negotiation'
-- =====================================================

-- Step 1: Update all leads currently in 'negotiation' stage to 'proposal_discussion'
UPDATE leads 
SET stage = 'proposal_discussion', 
    stage_changed_at = CURRENT_TIMESTAMP
WHERE stage = 'negotiation';

-- Step 2: Update lead_stage_history to reflect the change
-- Update any 'negotiation' references to 'proposal_discussion'
UPDATE lead_stage_history 
SET from_stage = 'proposal_discussion' 
WHERE from_stage = 'negotiation';

UPDATE lead_stage_history 
SET to_stage = 'proposal_discussion' 
WHERE to_stage = 'negotiation';

-- Step 3: Create new enum without 'negotiation'
-- Note: In PostgreSQL, you cannot directly remove values from an enum
-- The display name change is handled in the application layer
-- The 'negotiation' value will remain in the enum but won't be used

-- IMPORTANT: Run this comment if you want to fully remove the enum value (requires table recreation)
-- This is complex in PostgreSQL and may require:
-- 1. Creating a new enum type
-- 2. Altering the column to use the new type
-- 3. Dropping the old type
-- For now, the application layer will simply not use 'negotiation'

-- Add a comment to document this
COMMENT ON TYPE lead_stage_enum IS 'Lead stages. Note: negotiation is deprecated, use proposal_discussion instead (renamed to Proposal & Negotiation in UI)';
