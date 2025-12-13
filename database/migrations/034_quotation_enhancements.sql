-- Migration: Quotation Module Enhancements
-- Purpose: Add fields for PDF generation, client portal, and approval workflow

-- ============================================================================
-- 1. ADD QUOTATION TYPE ENUM AND FIELD
-- ============================================================================

-- Create quotation type enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quotation_type_enum') THEN
        CREATE TYPE quotation_type_enum AS ENUM (
            'sales',           -- Initial quotation during sales cycle
            'revision',        -- Revision of existing (same scope, different pricing)
            'change_order',    -- Scope change during project (future)
            'supplementary'    -- Additional work order (future)
        );
    END IF;
END $$;

-- Add quotation_type column
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS quotation_type quotation_type_enum DEFAULT 'sales';

-- Add baseline tracking for change orders (for future project integration)
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS baseline_quotation_id UUID REFERENCES quotations(id);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS change_reason TEXT;

-- ============================================================================
-- 2. PDF GENERATION SETTINGS
-- ============================================================================

-- Add PDF/presentation settings
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS company_logo_url TEXT;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS header_color VARCHAR(20) DEFAULT '#1e40af'; -- blue-800
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS show_company_details BOOLEAN DEFAULT true;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS show_bank_details BOOLEAN DEFAULT true;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS custom_footer_text TEXT;

-- ============================================================================
-- 3. CLIENT PORTAL FIELDS
-- ============================================================================

-- Add client access token for secure sharing
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS client_access_token VARCHAR(64);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS client_access_expires_at TIMESTAMPTZ;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS client_view_count INTEGER DEFAULT 0;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS last_client_view_at TIMESTAMPTZ;

-- Generate access token function
CREATE OR REPLACE FUNCTION generate_client_access_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$;

-- ============================================================================
-- 4. INTERNAL APPROVAL WORKFLOW
-- ============================================================================

-- Create approval status enum (check if values match, add missing ones)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status_enum') THEN
        CREATE TYPE approval_status_enum AS ENUM (
            'not_required',
            'pending',
            'approved',
            'rejected',
            'skipped'
        );
    ELSE
        -- Add missing values to existing enum if needed
        BEGIN
            ALTER TYPE approval_status_enum ADD VALUE IF NOT EXISTS 'not_required';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER TYPE approval_status_enum ADD VALUE IF NOT EXISTS 'pending';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER TYPE approval_status_enum ADD VALUE IF NOT EXISTS 'approved';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER TYPE approval_status_enum ADD VALUE IF NOT EXISTS 'rejected';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
        BEGIN
            ALTER TYPE approval_status_enum ADD VALUE IF NOT EXISTS 'skipped';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

-- Add internal approval fields (use TEXT if enum doesn't have the value)
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS internal_approval_status TEXT DEFAULT 'not_required';
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS internal_approved_by UUID REFERENCES users(id);
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS internal_approved_at TIMESTAMPTZ;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS internal_approval_notes TEXT;

-- ============================================================================
-- 5. TENANT SETTINGS FOR QUOTATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_quotation_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Numbering
    quotation_number_prefix VARCHAR(10) DEFAULT 'QT',
    quotation_number_next INTEGER DEFAULT 1,
    
    -- PDF Branding
    company_name VARCHAR(255),
    company_address TEXT,
    company_phone VARCHAR(50),
    company_email VARCHAR(255),
    company_website VARCHAR(255),
    company_gstin VARCHAR(20),
    company_logo_url TEXT,
    
    -- Bank Details
    bank_name VARCHAR(255),
    bank_account_name VARCHAR(255),
    bank_account_number VARCHAR(50),
    bank_ifsc_code VARCHAR(20),
    bank_branch VARCHAR(255),
    
    -- Default Settings
    default_validity_days INTEGER DEFAULT 30,
    default_tax_percent DECIMAL(5,2) DEFAULT 18.00,
    default_payment_terms JSONB DEFAULT '[
        {"milestone": "Booking", "percent": 10, "description": "On order confirmation"},
        {"milestone": "Design Approval", "percent": 40, "description": "After design finalization"},
        {"milestone": "Installation Start", "percent": 40, "description": "Before material dispatch"},
        {"milestone": "Handover", "percent": 10, "description": "On completion"}
    ]'::jsonb,
    default_terms_and_conditions TEXT DEFAULT 'Standard terms and conditions apply.',
    
    -- Approval Settings
    require_internal_approval BOOLEAN DEFAULT false,
    approval_threshold_amount DECIMAL(14,2) DEFAULT 0, -- Require approval above this amount
    approver_user_ids UUID[] DEFAULT '{}',
    
    -- Presentation
    default_presentation_level VARCHAR(30) DEFAULT 'space_component',
    default_hide_dimensions BOOLEAN DEFAULT true,
    default_header_color VARCHAR(20) DEFAULT '#1e40af',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE tenant_quotation_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "tenant_quotation_settings_tenant_isolation" ON tenant_quotation_settings;
CREATE POLICY "tenant_quotation_settings_tenant_isolation" ON tenant_quotation_settings
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- 6. QUOTATION ACTIVITIES/HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS quotation_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- 'created', 'updated', 'sent', 'viewed', 'approved', 'rejected', 'revised'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    performed_by UUID REFERENCES users(id),
    performed_at TIMESTAMPTZ DEFAULT now(),
    ip_address INET,
    user_agent TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quotation_activities_quotation ON quotation_activities(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_activities_type ON quotation_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_quotation_activities_date ON quotation_activities(performed_at DESC);

-- Enable RLS
ALTER TABLE quotation_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policy - access via quotation's tenant
DROP POLICY IF EXISTS "quotation_activities_access" ON quotation_activities;
CREATE POLICY "quotation_activities_access" ON quotation_activities
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM quotations q 
            WHERE q.id = quotation_activities.quotation_id 
            AND q.tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
        )
    );

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Function to generate client access link
CREATE OR REPLACE FUNCTION generate_quotation_client_link(p_quotation_id UUID)
RETURNS TABLE(token TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_token TEXT;
    v_expires TIMESTAMPTZ;
BEGIN
    v_token := generate_client_access_token();
    v_expires := now() + INTERVAL '30 days';
    
    UPDATE quotations
    SET 
        client_access_token = v_token,
        client_access_expires_at = v_expires
    WHERE id = p_quotation_id;
    
    RETURN QUERY SELECT v_token, v_expires;
END;
$$;

-- Function to track quotation view
CREATE OR REPLACE FUNCTION track_quotation_view(
    p_token TEXT,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_quotation_id UUID;
BEGIN
    -- Find quotation by token
    SELECT id INTO v_quotation_id
    FROM quotations
    WHERE client_access_token = p_token
    AND (client_access_expires_at IS NULL OR client_access_expires_at > now());
    
    IF v_quotation_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Update view stats
    UPDATE quotations
    SET 
        client_view_count = COALESCE(client_view_count, 0) + 1,
        last_client_view_at = now(),
        viewed_at = COALESCE(viewed_at, now()),
        status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END
    WHERE id = v_quotation_id;
    
    -- Log activity
    INSERT INTO quotation_activities (
        quotation_id,
        activity_type,
        title,
        description,
        ip_address,
        user_agent
    ) VALUES (
        v_quotation_id,
        'viewed',
        'Client Viewed Quotation',
        'Quotation was viewed via client portal link',
        p_ip_address,
        p_user_agent
    );
    
    RETURN v_quotation_id;
END;
$$;

-- ============================================================================
-- 8. ADD INDEXES FOR NEW COLUMNS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_quotations_type ON quotations(quotation_type);
CREATE INDEX IF NOT EXISTS idx_quotations_client_token ON quotations(client_access_token) WHERE client_access_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotations_internal_approval ON quotations(internal_approval_status) WHERE internal_approval_status != 'not_required';

-- ============================================================================
-- 9. COMMENTS
-- ============================================================================

COMMENT ON COLUMN quotations.quotation_type IS 'Type: sales (initial), revision (same scope), change_order (project scope change), supplementary (additional work)';
COMMENT ON COLUMN quotations.client_access_token IS 'Secure token for client portal access';
COMMENT ON COLUMN quotations.internal_approval_status IS 'Internal approval status before sending to client';
COMMENT ON TABLE tenant_quotation_settings IS 'Per-tenant configuration for quotation module including branding, bank details, and defaults';
COMMENT ON TABLE quotation_activities IS 'Activity log for quotation lifecycle events';
