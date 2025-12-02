-- =====================================================
-- SoftInterio Leads Module Schema - SAFE VERSION
-- =====================================================
-- This version uses IF NOT EXISTS to avoid errors
-- if objects already exist
-- =====================================================

-- =====================================================
-- ENUMS (Create only if not exists)
-- =====================================================

DO $$ BEGIN
    CREATE TYPE property_type_enum AS ENUM (
        'apartment_gated',
        'apartment_non_gated',
        'villa_gated',
        'villa_non_gated',
        'independent_house',
        'commercial_office',
        'commercial_retail',
        'commercial_restaurant',
        'commercial_other',
        'unknown'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE service_type_enum AS ENUM (
        'turnkey',
        'modular',
        'renovation',
        'consultation',
        'commercial_fitout',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lead_source_enum AS ENUM (
        'architect_referral',
        'client_referral',
        'youtube',
        'instagram',
        'facebook',
        'google_ads',
        'website',
        'walkin',
        'trade_show',
        'justdial',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE budget_range_enum AS ENUM (
        'below_5l',
        '5l_10l',
        '10l_20l',
        '20l_35l',
        '35l_50l',
        '50l_1cr',
        'above_1cr',
        'not_disclosed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lead_stage_enum AS ENUM (
        'new',
        'qualified',
        'disqualified',
        'requirement_discussion',
        'proposal_discussion',
        'negotiation',
        'won',
        'lost'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lead_activity_type_enum AS ENUM (
        'call_made',
        'call_received',
        'call_missed',
        'email_sent',
        'email_received',
        'meeting_scheduled',
        'meeting_completed',
        'site_visit',
        'quotation_sent',
        'quotation_revised',
        'note_added',
        'stage_changed',
        'assignment_changed',
        'document_uploaded',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE disqualification_reason_enum AS ENUM (
        'budget_mismatch',
        'timeline_mismatch',
        'location_not_serviceable',
        'not_serious_buyer',
        'duplicate_lead',
        'invalid_contact',
        'competitor_already_hired',
        'project_cancelled',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lost_reason_enum AS ENUM (
        'price_too_high',
        'chose_competitor',
        'project_cancelled',
        'timeline_not_met',
        'scope_mismatch',
        'no_response',
        'budget_reduced',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 1. LEADS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_number VARCHAR(50) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    property_type property_type_enum NOT NULL,
    service_type service_type_enum,
    lead_source lead_source_enum,
    lead_source_detail VARCHAR(255),
    target_start_date DATE,
    target_end_date DATE,
    property_name VARCHAR(255),
    flat_number VARCHAR(50),
    property_address TEXT,
    property_city VARCHAR(100),
    property_pincode VARCHAR(10),
    carpet_area_sqft DECIMAL(10,2),
    budget_range budget_range_enum,
    estimated_value DECIMAL(12,2),
    project_scope TEXT,
    special_requirements TEXT,
    stage lead_stage_enum NOT NULL DEFAULT 'new',
    stage_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    disqualification_reason disqualification_reason_enum,
    disqualification_notes TEXT,
    lost_reason lost_reason_enum,
    lost_to_competitor VARCHAR(255),
    lost_notes TEXT,
    won_amount DECIMAL(12,2),
    won_at TIMESTAMP WITH TIME ZONE,
    contract_signed_date DATE,
    expected_project_start DATE,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    requires_approval BOOLEAN DEFAULT FALSE,
    approval_status VARCHAR(20) DEFAULT NULL,
    approval_requested_at TIMESTAMP WITH TIME ZONE,
    approval_requested_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id),
    approval_notes TEXT,
    priority VARCHAR(20) DEFAULT 'medium',
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity_type lead_activity_type_enum,
    next_followup_date DATE,
    next_followup_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_lead_number_per_tenant UNIQUE(tenant_id, lead_number)
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Make email nullable if it wasn't already
ALTER TABLE leads ALTER COLUMN email DROP NOT NULL;

-- Indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_by ON leads(created_by);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_last_activity ON leads(tenant_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(tenant_id, email);

-- =====================================================
-- 2. LEAD FAMILY MEMBERS
-- =====================================================

CREATE TABLE IF NOT EXISTS lead_family_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    relation VARCHAR(50),
    phone VARCHAR(20),
    email VARCHAR(255),
    is_decision_maker BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE lead_family_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lead_family_members_lead_id ON lead_family_members(lead_id);

-- =====================================================
-- 3. LEAD STAGE HISTORY
-- =====================================================

CREATE TABLE IF NOT EXISTS lead_stage_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    from_stage lead_stage_enum,
    to_stage lead_stage_enum NOT NULL,
    changed_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    change_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE lead_stage_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lead_stage_history_lead_id ON lead_stage_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_stage_history_created ON lead_stage_history(created_at DESC);

-- =====================================================
-- 4. LEAD ACTIVITIES
-- =====================================================

CREATE TABLE IF NOT EXISTS lead_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    activity_type lead_activity_type_enum NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    call_duration_seconds INTEGER,
    call_outcome VARCHAR(50),
    meeting_scheduled_at TIMESTAMP WITH TIME ZONE,
    meeting_location VARCHAR(255),
    meeting_completed BOOLEAN DEFAULT FALSE,
    meeting_notes TEXT,
    email_subject VARCHAR(255),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_created ON lead_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_activities_type ON lead_activities(activity_type);

-- =====================================================
-- 5. LEAD NOTES
-- =====================================================

CREATE TABLE IF NOT EXISTS lead_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id);

-- =====================================================
-- 6. LEAD DOCUMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS lead_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size_bytes BIGINT,
    file_url TEXT NOT NULL,
    storage_path TEXT,
    document_type VARCHAR(50),
    description TEXT,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE lead_documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lead_documents_lead_id ON lead_documents(lead_id);

-- =====================================================
-- 7. LEAD TASKS
-- =====================================================

CREATE TABLE IF NOT EXISTS lead_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE,
    due_time TIME,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'pending',
    completed_at TIMESTAMP WITH TIME ZONE,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE lead_tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lead_tasks_lead_id ON lead_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_assigned_to ON lead_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_due_date ON lead_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_status ON lead_tasks(status);

-- =====================================================
-- 8. TENANT LEAD SETTINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS tenant_lead_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    lead_number_prefix VARCHAR(10) DEFAULT 'LD',
    lead_number_next INTEGER DEFAULT 1,
    require_won_approval BOOLEAN DEFAULT FALSE,
    won_approval_roles UUID[],
    default_assignment VARCHAR(20) DEFAULT 'creator',
    stage_colors JSONB DEFAULT '{
        "new": "#8B5CF6",
        "qualified": "#3B82F6",
        "disqualified": "#6B7280",
        "requirement_discussion": "#06B6D4",
        "proposal_discussion": "#F59E0B",
        "negotiation": "#F97316",
        "won": "#10B981",
        "lost": "#EF4444"
    }',
    auto_followup_days INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tenant_lead_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- TRIGGERS (DROP AND RECREATE)
-- =====================================================

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lead_notes_updated_at ON lead_notes;
CREATE TRIGGER update_lead_notes_updated_at BEFORE UPDATE ON lead_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lead_tasks_updated_at ON lead_tasks;
CREATE TRIGGER update_lead_tasks_updated_at BEFORE UPDATE ON lead_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_lead_settings_updated_at ON tenant_lead_settings;
CREATE TRIGGER update_tenant_lead_settings_updated_at BEFORE UPDATE ON tenant_lead_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCTIONS (CREATE OR REPLACE)
-- =====================================================

CREATE OR REPLACE FUNCTION generate_lead_number(p_tenant_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_prefix VARCHAR(10);
    v_next_num INTEGER;
    v_lead_number VARCHAR(50);
BEGIN
    INSERT INTO tenant_lead_settings (tenant_id)
    VALUES (p_tenant_id)
    ON CONFLICT (tenant_id) DO NOTHING;
    
    UPDATE tenant_lead_settings
    SET lead_number_next = lead_number_next + 1
    WHERE tenant_id = p_tenant_id
    RETURNING lead_number_prefix, lead_number_next - 1 INTO v_prefix, v_next_num;
    
    v_lead_number := v_prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(v_next_num::TEXT, 5, '0');
    
    RETURN v_lead_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_set_lead_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lead_number IS NULL OR NEW.lead_number = '' THEN
        NEW.lead_number := generate_lead_number(NEW.tenant_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_lead_number ON leads;
CREATE TRIGGER set_lead_number
    BEFORE INSERT ON leads
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_lead_number();

CREATE OR REPLACE FUNCTION trigger_record_stage_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
        INSERT INTO lead_stage_history (lead_id, from_stage, to_stage, changed_by)
        VALUES (NEW.id, OLD.stage, NEW.stage, COALESCE(auth.uid(), NEW.assigned_to, NEW.created_by));
        
        NEW.stage_changed_at := CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS record_stage_change ON leads;
CREATE TRIGGER record_stage_change
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION trigger_record_stage_change();

CREATE OR REPLACE FUNCTION trigger_update_lead_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE leads
    SET 
        last_activity_at = CURRENT_TIMESTAMP,
        last_activity_type = NEW.activity_type
    WHERE id = NEW.lead_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_lead_last_activity ON lead_activities;
CREATE TRIGGER update_lead_last_activity
    AFTER INSERT ON lead_activities
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_lead_last_activity();

-- =====================================================
-- RLS POLICIES (DROP AND RECREATE)
-- =====================================================

DROP POLICY IF EXISTS leads_tenant_isolation ON leads;
CREATE POLICY leads_tenant_isolation ON leads
    FOR ALL USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS lead_family_members_access ON lead_family_members;
CREATE POLICY lead_family_members_access ON lead_family_members
    FOR ALL USING (
        EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_family_members.lead_id AND leads.tenant_id = get_user_tenant_id())
    );

DROP POLICY IF EXISTS lead_stage_history_access ON lead_stage_history;
CREATE POLICY lead_stage_history_access ON lead_stage_history
    FOR ALL USING (
        EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_stage_history.lead_id AND leads.tenant_id = get_user_tenant_id())
    );

DROP POLICY IF EXISTS lead_activities_access ON lead_activities;
CREATE POLICY lead_activities_access ON lead_activities
    FOR ALL USING (
        EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_activities.lead_id AND leads.tenant_id = get_user_tenant_id())
    );

DROP POLICY IF EXISTS lead_notes_access ON lead_notes;
CREATE POLICY lead_notes_access ON lead_notes
    FOR ALL USING (
        EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_notes.lead_id AND leads.tenant_id = get_user_tenant_id())
    );

DROP POLICY IF EXISTS lead_documents_access ON lead_documents;
CREATE POLICY lead_documents_access ON lead_documents
    FOR ALL USING (
        EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_documents.lead_id AND leads.tenant_id = get_user_tenant_id())
    );

DROP POLICY IF EXISTS lead_tasks_access ON lead_tasks;
CREATE POLICY lead_tasks_access ON lead_tasks
    FOR ALL USING (
        EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_tasks.lead_id AND leads.tenant_id = get_user_tenant_id())
    );

DROP POLICY IF EXISTS tenant_lead_settings_access ON tenant_lead_settings;
CREATE POLICY tenant_lead_settings_access ON tenant_lead_settings
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION get_lead_statistics(p_tenant_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total', COUNT(*),
        'new', COUNT(*) FILTER (WHERE stage = 'new'),
        'qualified', COUNT(*) FILTER (WHERE stage = 'qualified'),
        'disqualified', COUNT(*) FILTER (WHERE stage = 'disqualified'),
        'requirement_discussion', COUNT(*) FILTER (WHERE stage = 'requirement_discussion'),
        'proposal_discussion', COUNT(*) FILTER (WHERE stage = 'proposal_discussion'),
        'negotiation', COUNT(*) FILTER (WHERE stage = 'negotiation'),
        'won', COUNT(*) FILTER (WHERE stage = 'won'),
        'lost', COUNT(*) FILTER (WHERE stage = 'lost'),
        'pipeline_value', COALESCE(SUM(estimated_value) FILTER (WHERE stage NOT IN ('won', 'lost', 'disqualified')), 0),
        'won_value', COALESCE(SUM(won_amount) FILTER (WHERE stage = 'won'), 0),
        'this_month_new', COUNT(*) FILTER (WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)),
        'this_month_won', COUNT(*) FILTER (WHERE stage = 'won' AND DATE_TRUNC('month', won_at) = DATE_TRUNC('month', CURRENT_DATE)),
        'needs_followup', COUNT(*) FILTER (WHERE 
            stage NOT IN ('won', 'lost', 'disqualified') 
            AND last_activity_at < CURRENT_TIMESTAMP - INTERVAL '3 days'
        )
    ) INTO result
    FROM leads
    WHERE tenant_id = p_tenant_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_valid_stage_transition(
    p_from_stage lead_stage_enum,
    p_to_stage lead_stage_enum
) RETURNS BOOLEAN AS $$
BEGIN
    IF p_from_stage IN ('won', 'lost', 'disqualified') THEN
        RETURN FALSE;
    END IF;
    
    IF p_to_stage = 'disqualified' THEN
        RETURN p_from_stage = 'new';
    END IF;
    
    RETURN CASE 
        WHEN p_from_stage = 'new' AND p_to_stage IN ('qualified', 'disqualified') THEN TRUE
        WHEN p_from_stage = 'qualified' AND p_to_stage IN ('requirement_discussion', 'lost') THEN TRUE
        WHEN p_from_stage = 'requirement_discussion' AND p_to_stage IN ('proposal_discussion', 'lost') THEN TRUE
        WHEN p_from_stage = 'proposal_discussion' AND p_to_stage IN ('negotiation', 'lost') THEN TRUE
        WHEN p_from_stage = 'negotiation' AND p_to_stage IN ('won', 'lost') THEN TRUE
        ELSE FALSE
    END;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ADD PERMISSIONS FOR LEADS MODULE
-- =====================================================

INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('sales.view', 'sales', 'View sales dashboard', true),
('sales.leads.view', 'sales', 'View leads list', true),
('sales.leads.view_own', 'sales', 'View only own leads', true),
('sales.leads.view_all', 'sales', 'View all leads', true),
('sales.leads.create', 'sales', 'Create new leads', true),
('sales.leads.edit_own', 'sales', 'Edit own leads', true),
('sales.leads.edit_all', 'sales', 'Edit any lead', true),
('sales.leads.delete', 'sales', 'Delete leads', true),
('sales.leads.assign', 'sales', 'Assign leads to others', true),
('sales.leads.disqualify', 'sales', 'Disqualify leads', true),
('sales.leads.mark_won', 'sales', 'Mark leads as won', true),
('sales.leads.approve_won', 'sales', 'Approve won leads', true),
('sales.leads.export', 'sales', 'Export leads data', true),
('sales.reports.view', 'sales', 'View sales reports', true),
('sales.settings.manage', 'sales', 'Manage sales settings', true)
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- GRANT PERMISSIONS TO ROLES
-- =====================================================

-- Owner: Grant all new sales permissions
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    r.id,
    p.id,
    true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'owner' 
  AND r.tenant_id IS NULL
  AND p.key LIKE 'sales.%'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Admin: Grant all new sales permissions
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    r.id,
    p.id,
    true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'admin' 
  AND r.tenant_id IS NULL
  AND p.key LIKE 'sales.%'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager: Grant sales view and management permissions
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    r.id,
    p.id,
    true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'manager' 
  AND r.tenant_id IS NULL
  AND p.key IN (
    'sales.view',
    'sales.leads.view',
    'sales.leads.view_all',
    'sales.leads.create',
    'sales.leads.edit_all',
    'sales.leads.assign',
    'sales.leads.disqualify',
    'sales.leads.mark_won',
    'sales.reports.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Sales role: Grant sales permissions
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT 
    r.id,
    p.id,
    true
FROM roles r
CROSS JOIN permissions p
WHERE r.slug = 'sales' 
  AND r.tenant_id IS NULL
  AND p.key IN (
    'sales.view',
    'sales.leads.view',
    'sales.leads.view_all',
    'sales.leads.create',
    'sales.leads.edit_all',
    'sales.leads.assign',
    'sales.leads.disqualify',
    'sales.leads.mark_won',
    'sales.leads.export',
    'sales.reports.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =====================================================
-- DONE - SAFE MIGRATION COMPLETE
-- =====================================================

-- Add table comments
COMMENT ON TABLE leads IS 'Main leads/opportunities table for sales pipeline';
COMMENT ON TABLE lead_family_members IS 'Additional contacts/family members for a lead';
COMMENT ON TABLE lead_stage_history IS 'Audit trail of all stage changes';
COMMENT ON TABLE lead_activities IS 'Activity timeline for leads';
COMMENT ON TABLE lead_notes IS 'Notes/comments on leads';
COMMENT ON TABLE lead_documents IS 'Documents attached to leads';
COMMENT ON TABLE lead_tasks IS 'Tasks associated with leads';
COMMENT ON TABLE tenant_lead_settings IS 'Per-tenant configuration for leads module';

SELECT 'Leads module migration completed successfully!' as status;
