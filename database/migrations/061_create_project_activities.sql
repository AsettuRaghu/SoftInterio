-- Create project_activities table for project-specific meetings and activities
-- This is separate from lead_activities (which tracks lead nurturing activities)

-- Create project_activity_type_enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE public.project_activity_type_enum AS ENUM (
        'meeting_scheduled',
        'meeting_completed',
        'task_created',
        'task_completed',
        'milestone_reached',
        'site_visit',
        'client_meeting',
        'internal_meeting',
        'design_review',
        'procurement',
        'installation',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create project_activities table
CREATE TABLE IF NOT EXISTS public.project_activities (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    activity_type public.project_activity_type_enum NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Meeting specific fields
    meeting_scheduled_at TIMESTAMPTZ,
    meeting_location VARCHAR(255),
    meeting_completed BOOLEAN DEFAULT false,
    meeting_notes TEXT,
    meeting_type VARCHAR(50), -- client_meeting, internal_meeting, site_visit, design_review, etc.
    attendees JSONB DEFAULT '[]'::jsonb,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Optional link to project notes (no FK constraint since table may not exist)
    linked_note_id UUID
);

-- Add table comment
COMMENT ON TABLE public.project_activities IS 'Activity timeline for projects - tracks meetings, milestones, and project events';

-- Add column comments
COMMENT ON COLUMN public.project_activities.attendees IS 'JSON array of attendees: [{type: "team", id: uuid, name: string} or {type: "external", email: string, name: string}]';
COMMENT ON COLUMN public.project_activities.meeting_type IS 'Sub-type for meetings: client_meeting, internal_meeting, site_visit, design_review, installation, other';
COMMENT ON COLUMN public.project_activities.linked_note_id IS 'Reference to project_notes if meeting notes were saved as a note (no FK constraint)';

-- Create indexes
CREATE INDEX idx_project_activities_project_id ON public.project_activities(project_id);
CREATE INDEX idx_project_activities_tenant_id ON public.project_activities(tenant_id);
CREATE INDEX idx_project_activities_created_at ON public.project_activities(created_at DESC);
CREATE INDEX idx_project_activities_activity_type ON public.project_activities(activity_type);
CREATE INDEX idx_project_activities_meeting_scheduled ON public.project_activities(meeting_scheduled_at) WHERE meeting_scheduled_at IS NOT NULL;

-- Enable RLS
ALTER TABLE public.project_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view activities for projects in their tenant
CREATE POLICY project_activities_select_policy ON public.project_activities
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
    );

-- Users can insert activities for projects in their tenant
CREATE POLICY project_activities_insert_policy ON public.project_activities
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
        AND created_by = auth.uid()
    );

-- Users can update activities they created in their tenant
CREATE POLICY project_activities_update_policy ON public.project_activities
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
    );

-- Users can delete activities they created in their tenant
CREATE POLICY project_activities_delete_policy ON public.project_activities
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.users WHERE id = auth.uid()
        )
        AND created_by = auth.uid()
    );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_project_activities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_activities_updated_at_trigger
    BEFORE UPDATE ON public.project_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_project_activities_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_activities TO authenticated;
