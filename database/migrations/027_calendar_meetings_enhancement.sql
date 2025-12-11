-- Migration: Enhance meeting/calendar functionality
-- Description: Add new meeting types, attendees, and prepare for unified calendar

-- Step 0: Drop dependent views first
DROP VIEW IF EXISTS v_project_lead_activities;
DROP VIEW IF EXISTS calendar_events;
DROP VIEW IF EXISTS leads_with_project_status;

-- Step 1: Update lead_activity_type_enum to include more meeting types
-- We need to add: client_meeting, internal_meeting

-- Create new enum type with additional values
CREATE TYPE lead_activity_type_enum_new AS ENUM (
    'call_made',
    'call_received',
    'call_missed',
    'email_sent',
    'email_received',
    'meeting_scheduled',
    'meeting_completed',
    'client_meeting',
    'internal_meeting',
    'site_visit',
    'quotation_sent',
    'quotation_revised',
    'note_added',
    'stage_changed',
    'assignment_changed',
    'document_uploaded',
    'other'
);

-- Alter column to use new enum
ALTER TABLE lead_activities 
ALTER COLUMN activity_type TYPE lead_activity_type_enum_new 
USING activity_type::text::lead_activity_type_enum_new;

ALTER TABLE leads
ALTER COLUMN last_activity_type TYPE lead_activity_type_enum_new
USING last_activity_type::text::lead_activity_type_enum_new;

-- Drop old enum and rename new
DROP TYPE lead_activity_type_enum;
ALTER TYPE lead_activity_type_enum_new RENAME TO lead_activity_type_enum;

-- Step 2: Add attendees column to lead_activities
-- Stores array of attendees (team member UUIDs or external emails)
ALTER TABLE lead_activities 
ADD COLUMN IF NOT EXISTS attendees JSONB DEFAULT '[]'::jsonb;

-- Step 3: Add meeting_type column to differentiate meeting categories
ALTER TABLE lead_activities
ADD COLUMN IF NOT EXISTS meeting_type VARCHAR(50);

-- Step 4: Add tenant_id to lead_activities for easier calendar queries
-- This allows fetching all meetings for a tenant without joining through leads
ALTER TABLE lead_activities
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Backfill tenant_id from leads
UPDATE lead_activities la
SET tenant_id = l.tenant_id
FROM leads l
WHERE la.lead_id = l.id AND la.tenant_id IS NULL;

-- Step 5: Add link to lead_notes when meeting creates a note
ALTER TABLE lead_activities
ADD COLUMN IF NOT EXISTS linked_note_id UUID REFERENCES lead_notes(id);

-- Step 6: Create index for calendar queries
CREATE INDEX IF NOT EXISTS idx_lead_activities_meeting_scheduled_at 
ON lead_activities(meeting_scheduled_at) 
WHERE meeting_scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_activities_tenant_meeting 
ON lead_activities(tenant_id, meeting_scheduled_at) 
WHERE meeting_scheduled_at IS NOT NULL;

-- Step 7: Create a unified calendar events view
CREATE OR REPLACE VIEW calendar_events AS
SELECT 
    la.id,
    la.tenant_id,
    la.lead_id,
    NULL::uuid as project_id,
    la.activity_type,
    la.meeting_type,
    la.title,
    la.description,
    la.meeting_scheduled_at as event_date,
    la.meeting_location as location,
    la.meeting_completed as is_completed,
    la.meeting_notes as notes,
    la.attendees,
    la.created_by,
    la.created_at,
    'lead' as source_type,
    l.client_name as related_name,
    l.lead_number as related_number
FROM lead_activities la
JOIN leads l ON l.id = la.lead_id
WHERE la.meeting_scheduled_at IS NOT NULL
    AND la.activity_type IN ('meeting_scheduled', 'client_meeting', 'internal_meeting', 'site_visit');

-- Step 8: Recreate v_project_lead_activities view that was dropped
CREATE OR REPLACE VIEW v_project_lead_activities AS
SELECT 
    p.id AS project_id,
    p.project_number,
    la.id AS activity_id,
    la.activity_type,
    la.title,
    la.description,
    la.meeting_notes,
    la.created_at,
    u.name AS created_by_name,
    u.avatar_url AS created_by_avatar
FROM projects p
JOIN leads l ON p.converted_from_lead_id = l.id
JOIN lead_activities la ON la.lead_id = l.id
LEFT JOIN users u ON la.created_by = u.id
ORDER BY la.created_at DESC;

COMMENT ON VIEW v_project_lead_activities IS 'View of all lead activities for projects created from leads';

-- Step 9: Recreate leads_with_project_status view
CREATE OR REPLACE VIEW leads_with_project_status AS
SELECT 
    l.id,
    l.tenant_id,
    l.lead_number,
    l.client_name,
    l.phone,
    l.email,
    l.property_type,
    l.service_type,
    l.lead_source,
    l.lead_source_detail,
    l.target_start_date,
    l.target_end_date,
    l.property_name,
    l.flat_number,
    l.property_address,
    l.property_city,
    l.property_pincode,
    l.carpet_area_sqft,
    l.budget_range,
    l.estimated_value,
    l.project_scope,
    l.special_requirements,
    l.stage,
    l.stage_changed_at,
    l.disqualification_reason,
    l.disqualification_notes,
    l.lost_reason,
    l.lost_to_competitor,
    l.lost_notes,
    l.won_amount,
    l.won_at,
    l.contract_signed_date,
    l.expected_project_start,
    l.assigned_to,
    l.assigned_at,
    l.assigned_by,
    l.created_by,
    l.requires_approval,
    l.approval_status,
    l.approval_requested_at,
    l.approval_requested_by,
    l.approved_at,
    l.approved_by,
    l.approval_notes,
    l.priority,
    l.last_activity_at,
    l.last_activity_type,
    l.next_followup_date,
    l.next_followup_notes,
    l.created_at,
    l.updated_at,
    l.payment_terms,
    l.token_amount,
    l.token_received_date,
    l.handover_notes,
    l.handover_completed,
    l.handover_completed_at,
    l.project_id,
    p.id AS linked_project_id,
    p.project_number,
    p.status AS project_status,
    p.overall_progress AS project_progress,
    CASE
        WHEN p.id IS NOT NULL THEN true
        ELSE false
    END AS has_project
FROM leads l
LEFT JOIN projects p ON l.project_id = p.id;

-- Add comments
COMMENT ON COLUMN lead_activities.attendees IS 'JSON array of attendees: [{type: "team", id: uuid, name: string} or {type: "external", email: string, name: string}]';
COMMENT ON COLUMN lead_activities.meeting_type IS 'Sub-type for meetings: client_meeting, internal_meeting, site_visit, other';
COMMENT ON COLUMN lead_activities.linked_note_id IS 'Reference to lead_notes if meeting notes were saved as a note';
COMMENT ON VIEW calendar_events IS 'Unified view of all calendar events from leads, projects, etc.';

