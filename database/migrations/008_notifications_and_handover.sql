-- =====================================================
-- SoftInterio Notifications & Lead Handover Schema
-- =====================================================
-- Description: Notifications system and enhanced lead handover fields
-- Target: Supabase (PostgreSQL with auth integration)
-- =====================================================

-- =====================================================
-- 1. NOTIFICATIONS TABLE
-- =====================================================
-- In-app notification system for real-time updates

DROP TYPE IF EXISTS notification_type_enum CASCADE;
CREATE TYPE notification_type_enum AS ENUM (
    -- Lead notifications
    'lead_assigned',
    'lead_won',
    'lead_lost',
    'lead_stage_changed',
    'lead_note_added',
    'lead_task_assigned',
    'lead_task_due',
    'lead_task_overdue',
    
    -- Project notifications (future)
    'project_created',
    'project_assigned',
    'project_milestone',
    'project_completed',
    
    -- Team notifications
    'team_member_added',
    'team_member_removed',
    
    -- System notifications
    'system_announcement',
    'subscription_warning',
    'subscription_expired',
    
    -- General
    'mention',
    'comment',
    'reminder',
    'other'
);

DROP TYPE IF EXISTS notification_priority_enum CASCADE;
CREATE TYPE notification_priority_enum AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Recipient
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification content
    type notification_type_enum NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority notification_priority_enum NOT NULL DEFAULT 'normal',
    
    -- Related entity (optional - for deep linking)
    entity_type VARCHAR(50), -- 'lead', 'project', 'task', etc.
    entity_id UUID,
    
    -- Action URL (optional - for deep linking)
    action_url TEXT,
    
    -- Metadata (flexible additional data)
    metadata JSONB DEFAULT '{}',
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Sender (optional - who triggered this notification)
    triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE -- Optional: auto-expire old notifications
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Indexes for efficient queries
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_tenant_created ON notifications(tenant_id, created_at DESC);
CREATE INDEX idx_notifications_entity ON notifications(entity_type, entity_id);
CREATE INDEX idx_notifications_type ON notifications(type);

-- RLS Policies
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
    ON notifications FOR INSERT
    WITH CHECK (tenant_id = get_user_tenant_id());

-- =====================================================
-- 2. NOTIFICATION PREFERENCES TABLE
-- =====================================================
-- User preferences for which notifications they want

CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification type preferences
    notification_type notification_type_enum NOT NULL,
    
    -- Channels
    in_app BOOLEAN DEFAULT TRUE,
    email BOOLEAN DEFAULT FALSE,
    push BOOLEAN DEFAULT FALSE, -- Future: mobile push
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_user_notification_pref UNIQUE(user_id, notification_type)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id);

-- RLS Policies
CREATE POLICY "Users can view own preferences"
    ON notification_preferences FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can manage own preferences"
    ON notification_preferences FOR ALL
    USING (user_id = auth.uid());

-- =====================================================
-- 3. ADD SALES MANAGER ROLE
-- =====================================================
-- Level 2: Sales Manager (between Manager and Sales Rep)

INSERT INTO roles (id, tenant_id, name, slug, description, is_system_role, is_default, hierarchy_level)
VALUES (uuid_generate_v4(), NULL, 'Sales Manager', 'sales-manager', 
    'Sales manager who can oversee sales team, move leads to Won, and view sales reports.', 
    true, false, 2);

-- =====================================================
-- 4. ADD SALES MANAGER PERMISSIONS
-- =====================================================

-- Add new permission for converting leads to Won/Project
INSERT INTO permissions (key, module, description, is_system_permission) VALUES
('sales.convert_to_won', 'sales', 'Move leads to Won status (create project)', true),
('sales.view_all', 'sales', 'View all sales leads (not just assigned)', true),
('sales.reports', 'sales', 'View sales reports and analytics', true)
ON CONFLICT (key) DO NOTHING;

-- Grant sales.convert_to_won to sales-manager, manager, admin, and owner
-- This is done via role_permissions table, typically set up in the app or admin panel

-- =====================================================
-- 5. ENHANCE LEADS TABLE FOR HANDOVER
-- =====================================================
-- Add handover-specific fields if they don't exist

-- Payment Terms (for handover)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'payment_terms') THEN
        ALTER TABLE leads ADD COLUMN payment_terms TEXT;
    END IF;
END $$;

-- Token/Advance Amount
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'token_amount') THEN
        ALTER TABLE leads ADD COLUMN token_amount DECIMAL(12,2);
    END IF;
END $$;

-- Token Received Date
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'token_received_date') THEN
        ALTER TABLE leads ADD COLUMN token_received_date DATE;
    END IF;
END $$;

-- Handover Notes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'handover_notes') THEN
        ALTER TABLE leads ADD COLUMN handover_notes TEXT;
    END IF;
END $$;

-- Handover Completed Flag
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'handover_completed') THEN
        ALTER TABLE leads ADD COLUMN handover_completed BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Handover Completed At
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'handover_completed_at') THEN
        ALTER TABLE leads ADD COLUMN handover_completed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- =====================================================
-- 6. HELPER FUNCTION: CREATE NOTIFICATION
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
    -- Check if user wants this type of notification
    SELECT COALESCE(in_app, true) INTO v_in_app_enabled
    FROM notification_preferences
    WHERE user_id = p_user_id AND notification_type = p_type;
    
    -- Default to enabled if no preference set
    IF v_in_app_enabled IS NULL THEN
        v_in_app_enabled := true;
    END IF;
    
    -- Only create if in-app is enabled
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

-- =====================================================
-- 7. HELPER FUNCTION: NOTIFY ON LEAD WON
-- =====================================================

CREATE OR REPLACE FUNCTION notify_lead_won()
RETURNS TRIGGER AS $$
DECLARE
    v_user_record RECORD;
    v_lead_client_name VARCHAR(255);
    v_won_amount DECIMAL(12,2);
    v_triggered_by UUID;
BEGIN
    -- Only trigger when stage changes to 'won'
    IF NEW.stage = 'won' AND (OLD.stage IS NULL OR OLD.stage != 'won') THEN
        v_lead_client_name := NEW.client_name;
        v_won_amount := NEW.won_amount;
        v_triggered_by := auth.uid();
        
        -- Notify all users with sales-manager, manager, admin, or owner roles in this tenant
        FOR v_user_record IN 
            SELECT DISTINCT u.id, u.tenant_id
            FROM users u
            JOIN user_roles ur ON ur.user_id = u.id
            JOIN roles r ON r.id = ur.role_id
            WHERE u.tenant_id = NEW.tenant_id
            AND u.status = 'active'
            AND r.slug IN ('owner', 'admin', 'manager', 'sales-manager')
            AND u.id != v_triggered_by -- Don't notify the person who did the action
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

-- Create trigger for lead won notifications
DROP TRIGGER IF EXISTS trigger_notify_lead_won ON leads;
CREATE TRIGGER trigger_notify_lead_won
    AFTER UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION notify_lead_won();

-- =====================================================
-- 8. HELPER FUNCTION: CHECK IF USER CAN MOVE TO WON
-- =====================================================

CREATE OR REPLACE FUNCTION can_move_lead_to_won(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Check if user has any role that allows moving to Won
    RETURN EXISTS (
        SELECT 1 
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = v_user_id
        AND r.slug IN ('owner', 'admin', 'manager', 'sales-manager')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. HELPER FUNCTION: GET UNREAD NOTIFICATION COUNT
-- =====================================================

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

-- =====================================================
-- 10. HELPER FUNCTION: MARK NOTIFICATIONS AS READ
-- =====================================================

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

-- =====================================================
-- 11. CLEANUP OLD NOTIFICATIONS (OPTIONAL CRON JOB)
-- =====================================================

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
-- TRIGGER: Auto-update updated_at for notification_preferences
-- =====================================================

CREATE TRIGGER update_notification_preferences_updated_at 
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMPLETE
-- =====================================================
