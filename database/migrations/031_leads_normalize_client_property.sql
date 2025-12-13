-- =====================================================
-- Migration: 031_leads_normalize_client_property.sql
-- Description: Normalize leads table to use client_id and property_id
-- Removes duplicate client/property fields from leads table
-- =====================================================

-- =====================================================
-- STEP 1: MIGRATE EXISTING LEADS DATA TO CLIENTS TABLE
-- =====================================================

-- Create clients for existing leads that don't have a client_id
INSERT INTO clients (
    tenant_id,
    client_type,
    status,
    name,
    phone,
    email,
    created_by,
    created_at
)
SELECT DISTINCT ON (l.tenant_id, l.phone)
    l.tenant_id,
    'individual'::client_type,
    'active'::client_status,
    l.client_name,
    l.phone,
    NULLIF(l.email, ''),
    l.created_by,
    l.created_at
FROM leads l
WHERE l.client_id IS NULL
  AND l.client_name IS NOT NULL
  AND l.phone IS NOT NULL
ON CONFLICT DO NOTHING;

-- Update leads to link to the newly created clients
UPDATE leads l
SET client_id = c.id
FROM clients c
WHERE l.client_id IS NULL
  AND l.tenant_id = c.tenant_id
  AND l.phone = c.phone;

-- =====================================================
-- STEP 2: MIGRATE EXISTING LEADS DATA TO PROPERTIES TABLE
-- =====================================================

-- Create properties for existing leads that don't have a property_id
INSERT INTO properties (
    tenant_id,
    property_name,
    unit_number,
    category,
    property_type,
    property_subtype,
    carpet_area,
    address_line1,
    city,
    pincode,
    created_by,
    created_at
)
SELECT 
    l.tenant_id,
    COALESCE(l.property_name, 'Property for Lead ' || l.lead_number),
    l.flat_number,
    COALESCE(l.property_category, 'residential')::property_category,
    COALESCE(l.property_type::text, 'apartment')::property_type_v2,
    COALESCE(l.property_subtype, 'gated_community')::property_subtype,
    l.carpet_area_sqft,
    l.property_address,
    COALESCE(l.property_city, 'Unknown'),
    l.property_pincode,
    l.created_by,
    l.created_at
FROM leads l
WHERE l.property_id IS NULL
  AND (l.property_name IS NOT NULL OR l.flat_number IS NOT NULL OR l.property_address IS NOT NULL);

-- Update leads to link to the newly created properties
-- Match by tenant, property_name and flat_number
UPDATE leads l
SET property_id = p.id
FROM properties p
WHERE l.property_id IS NULL
  AND l.tenant_id = p.tenant_id
  AND (
    (l.property_name IS NOT NULL AND l.property_name = p.property_name AND COALESCE(l.flat_number, '') = COALESCE(p.unit_number, ''))
    OR (l.flat_number IS NOT NULL AND l.flat_number = p.unit_number AND l.property_name IS NULL)
  );

-- =====================================================
-- STEP 3: BACKUP COLUMNS BEFORE REMOVAL (RENAME)
-- =====================================================

-- Rename client-related columns (backup)
ALTER TABLE leads RENAME COLUMN client_name TO client_name_deprecated;
ALTER TABLE leads RENAME COLUMN phone TO phone_deprecated;
ALTER TABLE leads RENAME COLUMN email TO email_deprecated;

-- Rename property-related columns (backup)
ALTER TABLE leads RENAME COLUMN property_name TO property_name_deprecated;
ALTER TABLE leads RENAME COLUMN flat_number TO flat_number_deprecated;
ALTER TABLE leads RENAME COLUMN property_address TO property_address_deprecated;
ALTER TABLE leads RENAME COLUMN property_city TO property_city_deprecated;
ALTER TABLE leads RENAME COLUMN property_pincode TO property_pincode_deprecated;
ALTER TABLE leads RENAME COLUMN carpet_area_sqft TO carpet_area_sqft_deprecated;
ALTER TABLE leads RENAME COLUMN property_category TO property_category_deprecated;
ALTER TABLE leads RENAME COLUMN property_type TO property_type_deprecated;
ALTER TABLE leads RENAME COLUMN property_subtype TO property_subtype_deprecated;

-- =====================================================
-- STEP 4: ADD CONSTRAINTS
-- =====================================================

-- Make client_id required for new leads (existing ones should be migrated)
-- Note: We'll enforce this at the application level for now
-- ALTER TABLE leads ALTER COLUMN client_id SET NOT NULL;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON COLUMN leads.client_name_deprecated IS 'Deprecated: Use client_id -> clients.name instead';
COMMENT ON COLUMN leads.phone_deprecated IS 'Deprecated: Use client_id -> clients.phone instead';
COMMENT ON COLUMN leads.email_deprecated IS 'Deprecated: Use client_id -> clients.email instead';
COMMENT ON COLUMN leads.property_name_deprecated IS 'Deprecated: Use property_id -> properties.property_name instead';
COMMENT ON COLUMN leads.flat_number_deprecated IS 'Deprecated: Use property_id -> properties.unit_number instead';
COMMENT ON COLUMN leads.property_address_deprecated IS 'Deprecated: Use property_id -> properties.address_line1 instead';
COMMENT ON COLUMN leads.property_city_deprecated IS 'Deprecated: Use property_id -> properties.city instead';
COMMENT ON COLUMN leads.property_pincode_deprecated IS 'Deprecated: Use property_id -> properties.pincode instead';
COMMENT ON COLUMN leads.carpet_area_sqft_deprecated IS 'Deprecated: Use property_id -> properties.carpet_area instead';
COMMENT ON COLUMN leads.property_category_deprecated IS 'Deprecated: Use property_id -> properties.category instead';
COMMENT ON COLUMN leads.property_type_deprecated IS 'Deprecated: Use property_id -> properties.property_type instead';
COMMENT ON COLUMN leads.property_subtype_deprecated IS 'Deprecated: Use property_id -> properties.property_subtype instead';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- After verifying the migration is successful, you can drop the deprecated columns:
--
-- ALTER TABLE leads DROP COLUMN IF EXISTS client_name_deprecated;
-- ALTER TABLE leads DROP COLUMN IF EXISTS phone_deprecated;
-- ALTER TABLE leads DROP COLUMN IF EXISTS email_deprecated;
-- ALTER TABLE leads DROP COLUMN IF EXISTS property_name_deprecated;
-- ALTER TABLE leads DROP COLUMN IF EXISTS flat_number_deprecated;
-- ALTER TABLE leads DROP COLUMN IF EXISTS property_address_deprecated;
-- ALTER TABLE leads DROP COLUMN IF EXISTS property_city_deprecated;
-- ALTER TABLE leads DROP COLUMN IF EXISTS property_pincode_deprecated;
-- ALTER TABLE leads DROP COLUMN IF EXISTS carpet_area_sqft_deprecated;
-- ALTER TABLE leads DROP COLUMN IF EXISTS property_category_deprecated;
-- ALTER TABLE leads DROP COLUMN IF EXISTS property_type_deprecated;
-- ALTER TABLE leads DROP COLUMN IF EXISTS property_subtype_deprecated;
