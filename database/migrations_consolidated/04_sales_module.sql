-- =====================================================
-- SoftInterio Sales Module (CRM/Leads)
-- =====================================================
-- Module: Sales & Lead Management
-- Description: Complete sales pipeline with leads, activities,
--              notifications, tasks, and handover functionality
-- Target: Supabase (PostgreSQL with auth integration)
-- 
-- Run Order: 4 (After subscription module)
-- =====================================================

-- =====================================================
-- SECTION 1: ENUMS
-- =====================================================

-- Property Types
DROP TYPE IF EXISTS property_type_enum CASCADE;
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

-- Service Types
DROP TYPE IF EXISTS service_type_enum CASCADE;
CREATE TYPE service_type_enum AS ENUM (
    'turnkey',
    'modular',
    'renovation',
    'consultation',
    'commercial_fitout',
    'other'
);

-- Lead Sources
DROP TYPE IF EXISTS lead_source_enum CASCADE;
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

-- Budget Ranges
DROP TYPE IF EXISTS budget_range_enum CASCADE;
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

-- Lead Stage (Pipeline stages)
-- Note: 'negotiation' is deprecated, use 'proposal_discussion' instead
DROP TYPE IF EXISTS lead_stage_enum CASCADE;
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

COMMENT ON TYPE lead_stage_enum IS 'Lead stages. Note: negotiation is deprecated, use proposal_discussion instead (renamed to Proposal & Negotiation in UI)';

-- Activity Types
DROP TYPE IF EXISTS lead_activity_type_enum CASCADE;
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

-- Disqualification Reasons
DROP TYPE IF EXISTS disqualification_reason_enum CASCADE;
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

-- Lost Reasons
DROP TYPE IF EXISTS lost_reason_enum CASCADE;
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

-- Notification Types
DROP TYPE IF EXISTS notification_type_enum CASCADE;
CREATE TYPE notification_type_enum AS ENUM (
    'lead_assigned',
    'lead_won',
    'lead_lost',
    'lead_stage_changed',
    'lead_note_added',
    'lead_task_assigned',
    'lead_task_due',
    'lead_task_overdue',
    'project_created',
    'project_assigned',
    'project_milestone',
    'project_completed',
    'team_member_added',
    'team_member_removed',
    'system_announcement',
    'subscription_warning',
    'subscription_expired',
    'mention',
    'comment',
    'reminder',
    'other'
);

-- Notification Priority
DROP TYPE IF EXISTS notification_priority_enum CASCADE;
CREATE TYPE notification_priority_enum AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);

-- =====================================================
-- SECTION 2: LEADS TABLE
-- =====================================================

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Lead Number (auto-generated per tenant)
    lead_number VARCHAR(50) NOT NULL,
    
    -- Primary Contact Info (Mandatory on creation)
    client_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    property_type property_type_enum NOT NULL,
    
    -- Service & Source (Mandatory on Qualified)
    service_type service_type_enum,
    lead_source lead_source_enum,
    lead_source_detail VARCHAR(255),
    
    -- Timeline (Mandatory on Qualified)
    target_start_date DATE,
    target_end_date DATE,
    
    -- Property Details (Optional)
    property_name VARCHAR(255),
    flat_number VARCHAR(50),
    property_address TEXT,
    property_city VARCHAR(100),
    property_pincode VARCHAR(10),
    carpet_area_sqft DECIMAL(10,2),
    
    -- Budget (Mandatory on Requirement Discussion)
    budget_range budget_range_enum,
    estimated_value DECIMAL(12,2),
    
    -- Project Scope (Mandatory on Requirement Discussion)
    project_scope TEXT,
    special_requirements TEXT,
    
    -- Stage & Status
    stage lead_stage_enum NOT NULL DEFAULT 'new',
    stage_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Disqualification/Lost
    disqualification_reason disqualification_reason_enum,
    disqualification_notes TEXT,
    lost_reason lost_reason_enum,
    lost_to_competitor VARCHAR(255),
    lost_notes TEXT,
    
    -- Won Details
    won_amount DECIMAL(12,2),
    won_at TIMESTAMP WITH TIME ZONE,
    contract_signed_date DATE,
    expected_project_start DATE,
    
    -- Assignment
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    
    -- Approval (for Won stage if configured)
    requires_approval BOOLEAN DEFAULT FALSE,
    approval_status VARCHAR(20) DEFAULT NULL,
    approval_requested_at TIMESTAMP WITH TIME ZONE,
    approval_requested_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id),
    approval_notes TEXT,
    
    -- Priority & Urgency
    priority VARCHAR(20) DEFAULT 'medium',
    
    -- Last Activity Tracking
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity_type lead_activity_type_enum,
    next_followup_date DATE,
    next_followup_notes TEXT,
    
    -- Handover Fields
    payment_terms TEXT,
    token_amount DECIMAL(12,2),
    token_received_date DATE,
    handover_notes TEXT,
    handover_completed BOOLEAN DEFAULT FALSE,
    handover_completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_lead_number_per_tenant UNIQUE(tenant_id, lead_number)
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX idx_leads_stage ON leads(tenant_id, stage);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_created_by ON leads(created_by);
CREATE INDEX idx_leads_created_at ON leads(tenant_id, created_at DESC);
CREATE INDEX idx_leads_last_activity ON leads(tenant_id, last_activity_at DESC);
CREATE INDEX idx_leads_phone ON leads(tenant_id, phone);
CREATE INDEX idx_leads_email ON leads(tenant_id, email);

-- =====================================================
-- SECTION 3: LEAD FAMILY MEMBERS
-- =====================================================

CREATE TABLE lead_family_members (
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

CREATE INDEX idx_lead_family_members_lead_id ON lead_family_members(lead_id);

-- =====================================================
-- SECTION 4: LEAD STAGE HISTORY
-- =====================================================

CREATE TABLE lead_stage_history (
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

CREATE INDEX idx_lead_stage_history_lead_id ON lead_stage_history(lead_id);
CREATE INDEX idx_lead_stage_history_created ON lead_stage_history(created_at DESC);

-- =====================================================
-- SECTION 5: LEAD ACTIVITIES
-- =====================================================

CREATE TABLE lead_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    activity_type lead_activity_type_enum NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- For calls
    call_duration_seconds INTEGER,
    call_outcome VARCHAR(50),
    
    -- For meetings
    meeting_scheduled_at TIMESTAMP WITH TIME ZONE,
    meeting_location VARCHAR(255),
    meeting_completed BOOLEAN DEFAULT FALSE,
    meeting_notes TEXT,
    
    -- For emails
    email_subject VARCHAR(255),
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX idx_lead_activities_created ON lead_activities(created_at DESC);
CREATE INDEX idx_lead_activities_type ON lead_activities(activity_type);

-- =====================================================
-- SECTION 6: LEAD NOTES
-- =====================================================

CREATE TABLE lead_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_lead_notes_lead_id ON lead_notes(lead_id);

-- =====================================================
-- SECTION 7: LEAD DOCUMENTS
-- =====================================================

CREATE TABLE lead_documents (
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

CREATE INDEX idx_lead_documents_lead_id ON lead_documents(lead_id);

-- =====================================================
-- SECTION 8: LEAD TASKS
-- =====================================================

CREATE TABLE lead_tasks (
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

CREATE INDEX idx_lead_tasks_lead_id ON lead_tasks(lead_id);
CREATE INDEX idx_lead_tasks_assigned_to ON lead_tasks(assigned_to);
CREATE INDEX idx_lead_tasks_due_date ON lead_tasks(due_date);
CREATE INDEX idx_lead_tasks_status ON lead_tasks(status);

-- =====================================================
-- SECTION 9: TENANT LEAD SETTINGS
-- =====================================================

CREATE TABLE tenant_lead_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Lead Number Format
    lead_number_prefix VARCHAR(10) DEFAULT 'LD',
    lead_number_next INTEGER DEFAULT 1,
    
    -- Approval Settings
    require_won_approval BOOLEAN DEFAULT FALSE,
    won_approval_roles UUID[],
    
    -- Default Assignment
    default_assignment VARCHAR(20) DEFAULT 'creator',
    
    -- Stage Colors (for UI)
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
    
    -- Other Settings
    auto_followup_days INTEGER DEFAULT 3,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tenant_lead_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SECTION 10: NOTIFICATIONS TABLE
-- =====================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type_enum NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority notification_priority_enum NOT NULL DEFAULT 'normal',
    entity_type VARCHAR(50),
    entity_id UUID,
    action_url TEXT,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_tenant_created ON notifications(tenant_id, created_at DESC);
CREATE INDEX idx_notifications_entity ON notifications(entity_type, entity_id);
CREATE INDEX idx_notifications_type ON notifications(type);

-- =====================================================
-- SECTION 11: NOTIFICATION PREFERENCES
-- =====================================================

CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type notification_type_enum NOT NULL,
    in_app BOOLEAN DEFAULT TRUE,
    email BOOLEAN DEFAULT FALSE,
    push BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_user_notification_pref UNIQUE(user_id, notification_type)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id);

-- =====================================================
-- SECTION 12: TRIGGERS
-- =====================================================

-- Auto-update updated_at
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_notes_updated_at BEFORE UPDATE ON lead_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_tasks_updated_at BEFORE UPDATE ON lead_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_lead_settings_updated_at BEFORE UPDATE ON tenant_lead_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SECTION 13: LEAD NUMBER GENERATION
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

-- Auto-generate lead number trigger
CREATE OR REPLACE FUNCTION trigger_set_lead_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lead_number IS NULL OR NEW.lead_number = '' THEN
        NEW.lead_number := generate_lead_number(NEW.tenant_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_lead_number
    BEFORE INSERT ON leads
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_lead_number();

-- =====================================================
-- SECTION 14: STAGE CHANGE TRIGGER
-- =====================================================

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

CREATE TRIGGER record_stage_change
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION trigger_record_stage_change();

-- =====================================================
-- SECTION 15: LAST ACTIVITY TRIGGER
-- =====================================================

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

CREATE TRIGGER update_lead_last_activity
    AFTER INSERT ON lead_activities
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_lead_last_activity();

-- =====================================================
-- SECTION 16: NOTIFICATION FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION create_notification(
    p_tenant_id UUID,
    p_user_id UUID,
    p_type notification_type_enum,
    p_title VARCHAR(255),
    p_message TEXT,
    p_entity_type VARCHAR(50) DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_action_url TEXT DEFAULT NULL,
    p_triggered_by UUID DEFAULT NULL,
    p_priority notification_priority_enum DEFAULT 'normal',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
    v_in_app_enabled BOOLEAN;
BEGIN
    SELECT COALESCE(in_app, true) INTO v_in_app_enabled
    FROM notification_preferences
    WHERE user_id = p_user_id AND notification_type = p_type;
    
    IF v_in_app_enabled IS NULL THEN
        v_in_app_enabled := true;
    END IF;
    
    IF v_in_app_enabled THEN
        INSERT INTO notifications (
            tenant_id, user_id, type, title, message,
            entity_type, entity_id, action_url,
            triggered_by, priority, metadata
        ) VALUES (
            p_tenant_id, p_user_id, p_type, p_title, p_message,
            p_entity_type, p_entity_id, p_action_url,
            p_triggered_by, p_priority, p_metadata
        )
        RETURNING id INTO v_notification_id;
    END IF;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify on lead won
CREATE OR REPLACE FUNCTION notify_lead_won()
RETURNS TRIGGER AS $$
DECLARE
    v_user_record RECORD;
    v_lead_client_name VARCHAR(255);
    v_won_amount DECIMAL(12,2);
    v_triggered_by UUID;
BEGIN
    IF NEW.stage = 'won' AND (OLD.stage IS NULL OR OLD.stage != 'won') THEN
        v_lead_client_name := NEW.client_name;
        v_won_amount := NEW.won_amount;
        v_triggered_by := auth.uid();
        
        FOR v_user_record IN 
            SELECT DISTINCT u.id, u.tenant_id
            FROM users u
            JOIN user_roles ur ON ur.user_id = u.id
            JOIN roles r ON r.id = ur.role_id
            WHERE u.tenant_id = NEW.tenant_id
            AND u.status = 'active'
            AND r.slug IN ('owner', 'admin', 'manager', 'sales-manager')
            AND u.id != v_triggered_by
        LOOP
            PERFORM create_notification(
                v_user_record.tenant_id,
                v_user_record.id,
                'lead_won'::notification_type_enum,
                'Lead Won! 🎉',
                'Lead "' || v_lead_client_name || '" has been marked as Won' || 
                    CASE WHEN v_won_amount IS NOT NULL 
                         THEN ' for ₹' || TO_CHAR(v_won_amount, 'FM99,99,99,999') 
                         ELSE '' 
                    END,
                'lead',
                NEW.id,
                '/dashboard/sales/leads/' || NEW.id,
                v_triggered_by,
                'high'::notification_priority_enum,
                jsonb_build_object(
                    'lead_number', NEW.lead_number,
                    'client_name', v_lead_client_name,
                    'won_amount', v_won_amount
                )
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_lead_won ON leads;
CREATE TRIGGER trigger_notify_lead_won
    AFTER UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION notify_lead_won();

-- =====================================================
-- SECTION 17: HELPER FUNCTIONS
-- =====================================================

-- Check if user can move lead to won
CREATE OR REPLACE FUNCTION can_move_lead_to_won(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    RETURN EXISTS (
        SELECT 1 
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = v_user_id
        AND r.slug IN ('owner', 'admin', 'manager', 'sales-manager')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM notifications
        WHERE user_id = v_user_id
        AND is_read = FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(
    p_notification_ids UUID[] DEFAULT NULL,
    p_mark_all BOOLEAN DEFAULT FALSE
)
RETURNS INTEGER AS $$
DECLARE
    v_user_id UUID;
    v_count INTEGER;
BEGIN
    v_user_id := auth.uid();
    
    IF p_mark_all THEN
        UPDATE notifications
        SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
        WHERE user_id = v_user_id AND is_read = FALSE;
    ELSE
        UPDATE notifications
        SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
        WHERE user_id = v_user_id 
        AND id = ANY(p_notification_ids)
        AND is_read = FALSE;
    END IF;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get lead statistics for dashboard
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

-- Check if stage transition is valid
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
        WHEN p_from_stage = 'proposal_discussion' AND p_to_stage IN ('negotiation', 'won', 'lost') THEN TRUE
        WHEN p_from_stage = 'negotiation' AND p_to_stage IN ('won', 'lost') THEN TRUE
        ELSE FALSE
    END;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old notifications
CREATE OR REPLACE FUNCTION cleanup_old_notifications(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM notifications
    WHERE created_at < CURRENT_TIMESTAMP - (days_to_keep || ' days')::INTERVAL
    AND is_read = TRUE;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SECTION 18: RLS POLICIES
-- =====================================================

-- Leads
CREATE POLICY leads_tenant_isolation ON leads
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Lead family members
CREATE POLICY lead_family_members_access ON lead_family_members
    FOR ALL USING (
        EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_family_members.lead_id AND leads.tenant_id = get_user_tenant_id())
    );

-- Lead stage history
CREATE POLICY lead_stage_history_access ON lead_stage_history
    FOR ALL USING (
        EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_stage_history.lead_id AND leads.tenant_id = get_user_tenant_id())
    );

-- Lead activities
CREATE POLICY lead_activities_access ON lead_activities
    FOR ALL USING (
        EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_activities.lead_id AND leads.tenant_id = get_user_tenant_id())
    );

-- Lead notes
CREATE POLICY lead_notes_access ON lead_notes
    FOR ALL USING (
        EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_notes.lead_id AND leads.tenant_id = get_user_tenant_id())
    );

-- Lead documents
CREATE POLICY lead_documents_access ON lead_documents
    FOR ALL USING (
        EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_documents.lead_id AND leads.tenant_id = get_user_tenant_id())
    );

-- Lead tasks
CREATE POLICY lead_tasks_access ON lead_tasks
    FOR ALL USING (
        EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_tasks.lead_id AND leads.tenant_id = get_user_tenant_id())
    );

-- Tenant lead settings
CREATE POLICY tenant_lead_settings_access ON tenant_lead_settings
    FOR ALL USING (tenant_id = get_user_tenant_id());

-- Notifications
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON notifications
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

-- Notification preferences
CREATE POLICY "Users can view own preferences" ON notification_preferences
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own preferences" ON notification_preferences
    FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- SALES MODULE COMPLETE
-- =====================================================

COMMENT ON TABLE leads IS 'Main leads/opportunities table for sales pipeline';
COMMENT ON TABLE lead_family_members IS 'Additional contacts/family members for a lead';
COMMENT ON TABLE lead_stage_history IS 'Audit trail of all stage changes';
COMMENT ON TABLE lead_activities IS 'Activity timeline for leads';
COMMENT ON TABLE lead_notes IS 'Notes/comments on leads';
COMMENT ON TABLE lead_documents IS 'Documents attached to leads';
COMMENT ON TABLE lead_tasks IS 'Tasks associated with leads';
COMMENT ON TABLE tenant_lead_settings IS 'Per-tenant configuration for leads module';
COMMENT ON TABLE notifications IS 'In-app notification system';
COMMENT ON TABLE notification_preferences IS 'User preferences for notification channels';
