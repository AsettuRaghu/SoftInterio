-- =====================================================
-- Migration: 030_clients_table.sql
-- Description: Create clients table for centralized client management
-- Clients can be linked to multiple leads and projects
-- =====================================================

-- =====================================================
-- ENUM TYPES
-- =====================================================

-- Client Type
DO $$ BEGIN
    CREATE TYPE client_type AS ENUM (
        'individual',
        'company',
        'partnership',
        'huf',
        'trust',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Client Status
DO $$ BEGIN
    CREATE TYPE client_status AS ENUM (
        'active',
        'inactive',
        'blacklisted'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- CLIENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Client Type
    client_type client_type NOT NULL DEFAULT 'individual',
    status client_status NOT NULL DEFAULT 'active',
    
    -- Primary Contact (for individual) / Company Details (for company)
    name VARCHAR(255) NOT NULL,                    -- Full name or Company name
    display_name VARCHAR(255),                     -- How to address them
    
    -- Contact Information
    phone VARCHAR(20) NOT NULL,
    phone_secondary VARCHAR(20),
    email VARCHAR(255),
    email_secondary VARCHAR(255),
    
    -- For Company clients
    company_name VARCHAR(255),
    gst_number VARCHAR(20),
    pan_number VARCHAR(15),
    
    -- Contact Person (for companies)
    contact_person_name VARCHAR(255),
    contact_person_phone VARCHAR(20),
    contact_person_email VARCHAR(255),
    contact_person_designation VARCHAR(100),
    
    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    landmark VARCHAR(255),
    locality VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    country VARCHAR(100) DEFAULT 'India',
    
    -- Additional Information
    date_of_birth DATE,
    anniversary_date DATE,
    occupation VARCHAR(100),
    company_industry VARCHAR(100),                 -- For company clients
    
    -- Referral Information
    referred_by_client_id UUID REFERENCES clients(id),
    referral_source VARCHAR(100),                  -- architect, friend, social_media, etc.
    referral_notes TEXT,
    
    -- Preferences & Notes
    preferred_contact_method VARCHAR(50),          -- phone, email, whatsapp
    preferred_contact_time VARCHAR(100),           -- morning, afternoon, evening
    communication_language VARCHAR(50) DEFAULT 'English',
    notes TEXT,
    internal_notes TEXT,                           -- Notes visible only to team
    
    -- Tags for categorization
    tags JSONB DEFAULT '[]',
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(client_type);
CREATE INDEX IF NOT EXISTS idx_clients_city ON clients(city);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);

-- =====================================================
-- ADD CLIENT_ID TO LEADS TABLE
-- =====================================================

-- Add client_id column to leads (nullable for existing leads)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_client ON leads(client_id);

-- =====================================================
-- TRIGGER: Update updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_clients_updated_at ON clients;
CREATE TRIGGER trigger_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_clients_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view clients in their tenant
CREATE POLICY "clients_select_policy" ON clients
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
    );

-- Policy: Users can insert clients in their tenant
CREATE POLICY "clients_insert_policy" ON clients
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
    );

-- Policy: Users can update clients in their tenant
CREATE POLICY "clients_update_policy" ON clients
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
    );

-- Policy: Only admins/owners can delete clients
CREATE POLICY "clients_delete_policy" ON clients
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.hierarchy_level <= 20  -- Admin or higher
        )
    );

-- =====================================================
-- HELPER VIEW: Clients with stats
-- =====================================================

CREATE OR REPLACE VIEW client_details AS
SELECT 
    c.*,
    -- Lead count
    (SELECT COUNT(*) FROM leads l WHERE l.client_id = c.id) AS lead_count,
    -- Won lead count
    (SELECT COUNT(*) FROM leads l WHERE l.client_id = c.id AND l.stage = 'won') AS won_lead_count,
    -- Total value from won leads
    (SELECT COALESCE(SUM(l.won_amount), 0) FROM leads l WHERE l.client_id = c.id AND l.stage = 'won') AS total_business_value,
    -- Referrer name
    referrer.name AS referred_by_name,
    -- Creator details
    creator.raw_user_meta_data->>'full_name' AS created_by_name
FROM clients c
LEFT JOIN clients referrer ON c.referred_by_client_id = referrer.id
LEFT JOIN auth.users creator ON c.created_by = creator.id;

-- Grant access to the view
GRANT SELECT ON client_details TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE clients IS 'Central client registry for all modules (leads, projects, quotations)';
COMMENT ON COLUMN clients.name IS 'Full name for individuals, Company name for businesses';
COMMENT ON COLUMN clients.display_name IS 'Preferred name for addressing the client';
COMMENT ON COLUMN clients.referred_by_client_id IS 'Self-referential FK for tracking referrals';
COMMENT ON COLUMN clients.tags IS 'JSON array of tags for categorization';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
