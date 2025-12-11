-- Migration: Add lead scoring system with activity-based scoring
-- This creates the foundation for dynamic lead score calculations

-- Step 1: Add scoring-related columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS activity_score integer DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS engagement_level character varying(20) DEFAULT 'low';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS days_since_last_activity integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS total_activities integer DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score_updated_at timestamp with time zone;

-- Add comments
COMMENT ON COLUMN leads.activity_score IS 'Calculated score based on lead activities (0-100)';
COMMENT ON COLUMN leads.engagement_level IS 'Derived from activity_score: low, medium, high';
COMMENT ON COLUMN leads.days_since_last_activity IS 'Days since last activity, used for cold lead detection';
COMMENT ON COLUMN leads.total_activities IS 'Total count of activities for this lead';
COMMENT ON COLUMN leads.score_updated_at IS 'When the score was last calculated';

-- Step 2: Create scoring function
-- Activity weights for scoring:
-- - call_made/call_received: 10 points
-- - meeting_scheduled: 15 points
-- - meeting_completed: 25 points (high engagement indicator)
-- - site_visit: 30 points (very high engagement)
-- - quotation_sent: 20 points
-- - email_sent/received: 5 points
-- - document_uploaded: 5 points
-- Base decay: -5 points per week of inactivity

CREATE OR REPLACE FUNCTION calculate_lead_score(p_lead_id uuid)
RETURNS TABLE(
    activity_score integer,
    engagement_level character varying,
    days_since_last_activity integer,
    total_activities integer,
    suggested_lead_score character varying
) AS $$
DECLARE
    v_base_score integer := 0;
    v_decay_score integer := 0;
    v_recency_bonus integer := 0;
    v_final_score integer := 0;
    v_days_inactive integer := 0;
    v_total_acts integer := 0;
    v_engagement character varying(20);
    v_suggested_score character varying(20);
    v_last_activity timestamp with time zone;
BEGIN
    -- Calculate activity-based score
    SELECT 
        COALESCE(SUM(
            CASE activity_type
                WHEN 'site_visit' THEN 30
                WHEN 'meeting_completed' THEN 25
                WHEN 'quotation_sent' THEN 20
                WHEN 'quotation_revised' THEN 15
                WHEN 'meeting_scheduled' THEN 15
                WHEN 'call_made' THEN 10
                WHEN 'call_received' THEN 10
                WHEN 'call_missed' THEN -5
                WHEN 'email_sent' THEN 5
                WHEN 'email_received' THEN 8
                WHEN 'document_uploaded' THEN 5
                WHEN 'note_added' THEN 2
                ELSE 0
            END
        ), 0),
        COUNT(*),
        MAX(created_at)
    INTO v_base_score, v_total_acts, v_last_activity
    FROM lead_activities
    WHERE lead_id = p_lead_id
    AND created_at > NOW() - INTERVAL '90 days'; -- Only count recent activities
    
    -- Calculate days since last activity
    IF v_last_activity IS NOT NULL THEN
        v_days_inactive := EXTRACT(DAY FROM (NOW() - v_last_activity))::integer;
    ELSE
        -- Check lead creation date if no activities
        SELECT EXTRACT(DAY FROM (NOW() - created_at))::integer
        INTO v_days_inactive
        FROM leads WHERE id = p_lead_id;
    END IF;
    
    -- Apply decay for inactivity (lose 5 points per week of inactivity)
    v_decay_score := (v_days_inactive / 7) * 5;
    
    -- Recency bonus (activity in last 3 days)
    IF v_days_inactive <= 3 THEN
        v_recency_bonus := 20;
    ELSIF v_days_inactive <= 7 THEN
        v_recency_bonus := 10;
    END IF;
    
    -- Calculate final score (capped between 0 and 100)
    v_final_score := GREATEST(0, LEAST(100, v_base_score - v_decay_score + v_recency_bonus));
    
    -- Determine engagement level
    IF v_final_score >= 60 THEN
        v_engagement := 'high';
    ELSIF v_final_score >= 30 THEN
        v_engagement := 'medium';
    ELSE
        v_engagement := 'low';
    END IF;
    
    -- Suggest lead_score based on calculated metrics
    IF v_days_inactive > 30 AND v_final_score < 20 THEN
        v_suggested_score := 'cold';
    ELSIF v_final_score >= 60 OR (v_days_inactive <= 7 AND v_total_acts >= 3) THEN
        v_suggested_score := 'hot';
    ELSIF v_final_score >= 30 OR v_total_acts >= 2 THEN
        v_suggested_score := 'warm';
    ELSE
        v_suggested_score := 'cold';
    END IF;
    
    RETURN QUERY SELECT 
        v_final_score,
        v_engagement,
        v_days_inactive,
        v_total_acts,
        v_suggested_score;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create function to update lead scores (can be called periodically or on activity)
CREATE OR REPLACE FUNCTION update_lead_scores()
RETURNS void AS $$
DECLARE
    r RECORD;
    score_data RECORD;
BEGIN
    -- Update all active leads
    FOR r IN 
        SELECT id FROM leads 
        WHERE stage NOT IN ('won', 'lost', 'disqualified')
    LOOP
        SELECT * INTO score_data FROM calculate_lead_score(r.id);
        
        UPDATE leads SET
            activity_score = score_data.activity_score,
            engagement_level = score_data.engagement_level,
            days_since_last_activity = score_data.days_since_last_activity,
            total_activities = score_data.total_activities,
            score_updated_at = NOW()
        WHERE id = r.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to update score when activity is added
CREATE OR REPLACE FUNCTION trigger_update_lead_score()
RETURNS TRIGGER AS $$
DECLARE
    score_data RECORD;
BEGIN
    -- Calculate new score for the lead
    SELECT * INTO score_data FROM calculate_lead_score(NEW.lead_id);
    
    -- Update the lead's score
    UPDATE leads SET
        activity_score = score_data.activity_score,
        engagement_level = score_data.engagement_level,
        days_since_last_activity = score_data.days_since_last_activity,
        total_activities = score_data.total_activities,
        score_updated_at = NOW(),
        last_activity_at = NOW(),
        last_activity_type = NEW.activity_type
    WHERE id = NEW.lead_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on lead_activities
DROP TRIGGER IF EXISTS update_lead_score_on_activity ON lead_activities;
CREATE TRIGGER update_lead_score_on_activity
    AFTER INSERT ON lead_activities
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_lead_score();

-- Step 5: Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_leads_activity_score ON leads(activity_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_engagement_level ON leads(engagement_level);
CREATE INDEX IF NOT EXISTS idx_leads_days_inactive ON leads(days_since_last_activity);

-- Step 6: Initial score calculation for existing leads
-- Run this after migration
SELECT update_lead_scores();
