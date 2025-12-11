-- ============================================================================
-- Migration: Standalone Calendar Events
-- Description: Creates a calendar_events table for events that may or may not
--              be linked to a lead or project
-- ============================================================================

-- First, drop any existing view with this name (if it exists)
DROP VIEW IF EXISTS calendar_events CASCADE;

-- Create calendar_events table
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Event details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) NOT NULL DEFAULT 'other', -- client_meeting, internal_meeting, site_visit, follow_up, reminder, other
    
    -- Schedule
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE,
    is_all_day BOOLEAN DEFAULT FALSE,
    
    -- Location
    location VARCHAR(500),
    
    -- Status
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES users(id),
    
    -- Notes
    notes TEXT,
    
    -- Optional link to lead or project
    linked_type VARCHAR(20), -- 'lead', 'project', or NULL for standalone
    linked_id UUID, -- References leads.id or projects.id based on linked_type
    
    -- Attendees (JSONB array)
    -- Format: [{ type: 'team' | 'client', id?: string, email?: string, name: string }]
    attendees JSONB DEFAULT '[]'::jsonb,
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant ON calendar_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_scheduled ON calendar_events(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON calendar_events(created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_events_linked ON calendar_events(linked_type, linked_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type);

-- Enable RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view events in their tenant
CREATE POLICY "Users can view calendar events in their tenant"
    ON calendar_events FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
    );

-- Users can create events in their tenant
CREATE POLICY "Users can create calendar events in their tenant"
    ON calendar_events FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
    );

-- Users can update events they created or are admin/owner
CREATE POLICY "Users can update calendar events"
    ON calendar_events FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
        AND (
            created_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid()
                AND r.hierarchy_level <= 1
            )
        )
    );

-- Users can delete events they created or are admin/owner
CREATE POLICY "Users can delete calendar events"
    ON calendar_events FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
        AND (
            created_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = auth.uid()
                AND r.hierarchy_level <= 1
            )
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calendar_events_updated_at ON calendar_events;
CREATE TRIGGER trigger_calendar_events_updated_at
    BEFORE UPDATE ON calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_events_updated_at();

-- Comment
COMMENT ON TABLE calendar_events IS 'Standalone calendar events that can optionally link to leads or projects';
