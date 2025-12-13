-- =====================================================
-- Migration: 032_leads_drop_deprecated_constraints.sql
-- Description: Remove NOT NULL constraints from deprecated columns
-- This allows new leads to be created without these old fields
-- =====================================================

-- Remove NOT NULL constraints from deprecated columns
ALTER TABLE leads ALTER COLUMN client_name_deprecated DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN phone_deprecated DROP NOT NULL;

-- The other deprecated columns were already nullable, but let's ensure they are
ALTER TABLE leads ALTER COLUMN email_deprecated DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN property_name_deprecated DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN flat_number_deprecated DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN property_address_deprecated DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN property_city_deprecated DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN property_pincode_deprecated DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN carpet_area_sqft_deprecated DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN property_category_deprecated DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN property_type_deprecated DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN property_subtype_deprecated DROP NOT NULL;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- The deprecated columns are now nullable, allowing new leads to be created
-- using only client_id and property_id references.
