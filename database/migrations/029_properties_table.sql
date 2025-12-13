-- =====================================================
-- Migration: 029_properties_table.sql
-- Description: Create properties table for centralized property management
-- This allows property data to flow through Lead → Project → Quotation
-- =====================================================

-- =====================================================
-- ENUM TYPES
-- =====================================================

-- Property Category (Residential vs Commercial)
DO $$ BEGIN
    CREATE TYPE property_category AS ENUM (
        'residential',
        'commercial'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Property Type (more granular)
DO $$ BEGIN
    CREATE TYPE property_type_v2 AS ENUM (
        -- Residential
        'apartment',
        'villa',
        'independent_house',
        'penthouse',
        'duplex',
        'row_house',
        'farmhouse',
        -- Commercial
        'office',
        'retail_shop',
        'showroom',
        'restaurant_cafe',
        'clinic_hospital',
        'hotel',
        'warehouse',
        'co_working',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Property Sub-type (community type)
DO $$ BEGIN
    CREATE TYPE property_subtype AS ENUM (
        'gated_community',
        'non_gated',
        'standalone',
        'mall',
        'commercial_complex',
        'it_park',
        'industrial_area',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Ownership Type
DO $$ BEGIN
    CREATE TYPE ownership_type AS ENUM (
        'owned',
        'rented',
        'leased',
        'family_owned',
        'under_construction',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Property Status
DO $$ BEGIN
    CREATE TYPE property_status AS ENUM (
        'under_construction',
        'ready_to_move',
        'occupied',
        'vacant',
        'renovation_in_progress'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Facing Direction
DO $$ BEGIN
    CREATE TYPE facing_direction AS ENUM (
        'north',
        'south',
        'east',
        'west',
        'north_east',
        'north_west',
        'south_east',
        'south_west'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Area Unit
DO $$ BEGIN
    CREATE TYPE area_unit AS ENUM (
        'sqft',
        'sqm',
        'sqyd'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- PROPERTIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Property Identification
    property_name VARCHAR(255),                    -- Building/Complex name (e.g., "Prestige Lakeside Habitat")
    unit_number VARCHAR(50),                       -- Flat/Unit number (e.g., "A-1502")
    block_tower VARCHAR(100),                      -- Block/Tower name (e.g., "Tower A", "Block 3")
    
    -- Property Classification
    category property_category NOT NULL DEFAULT 'residential',
    property_type property_type_v2 NOT NULL DEFAULT 'apartment',
    property_subtype property_subtype DEFAULT 'gated_community',
    ownership ownership_type DEFAULT 'owned',
    status property_status DEFAULT 'ready_to_move',
    
    -- Area Details (store in sqft as base, display can convert)
    carpet_area DECIMAL(10, 2),                    -- Actual usable area
    built_up_area DECIMAL(10, 2),                  -- Carpet + walls
    super_built_up_area DECIMAL(10, 2),            -- Built-up + common areas
    area_unit area_unit DEFAULT 'sqft',            -- Unit for display purposes
    plot_area DECIMAL(10, 2),                      -- For villas/independent houses
    
    -- Room Configuration
    bedrooms INTEGER DEFAULT 0,                    -- Number of bedrooms (0 for studio/commercial)
    bathrooms INTEGER DEFAULT 0,
    balconies INTEGER DEFAULT 0,
    kitchens INTEGER DEFAULT 1,
    living_rooms INTEGER DEFAULT 1,
    dining_rooms INTEGER DEFAULT 0,
    study_rooms INTEGER DEFAULT 0,
    servant_rooms INTEGER DEFAULT 0,
    pooja_rooms INTEGER DEFAULT 0,
    store_rooms INTEGER DEFAULT 0,
    
    -- Floor Details
    floor_number INTEGER,                          -- Which floor (0 for ground, -1 for basement)
    total_floors INTEGER,                          -- Total floors in building
    
    -- Property Features
    facing facing_direction,
    furnishing_status VARCHAR(50),                 -- unfurnished, semi-furnished, fully-furnished
    age_of_property INTEGER,                       -- Age in years
    
    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    landmark VARCHAR(255),
    locality VARCHAR(255),                         -- Neighborhood/Area
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    pincode VARCHAR(10),
    country VARCHAR(100) DEFAULT 'India',
    
    -- Geo Location (for future map integration)
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Additional Details
    parking_slots INTEGER DEFAULT 0,               -- Number of parking spaces
    has_lift BOOLEAN DEFAULT false,
    has_power_backup BOOLEAN DEFAULT false,
    has_security BOOLEAN DEFAULT false,
    has_gym BOOLEAN DEFAULT false,
    has_swimming_pool BOOLEAN DEFAULT false,
    has_clubhouse BOOLEAN DEFAULT false,
    amenities JSONB DEFAULT '[]',                  -- Array of additional amenities
    
    -- Notes and Description
    description TEXT,
    internal_notes TEXT,                           -- Notes visible only to team
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_properties_tenant ON properties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_properties_category ON properties(category);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_pincode ON properties(pincode);
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties(created_at DESC);

-- =====================================================
-- ADD PROPERTY_ID TO LEADS TABLE
-- =====================================================

-- Add property_id column to leads (nullable for existing leads)
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_property ON leads(property_id);

-- =====================================================
-- TRIGGER: Update updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_properties_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_properties_updated_at ON properties;
CREATE TRIGGER trigger_properties_updated_at
    BEFORE UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION update_properties_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view properties in their tenant
CREATE POLICY "properties_select_policy" ON properties
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
    );

-- Policy: Users can insert properties in their tenant
CREATE POLICY "properties_insert_policy" ON properties
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM users WHERE id = auth.uid()
        )
    );

-- Policy: Users can update properties in their tenant
CREATE POLICY "properties_update_policy" ON properties
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

-- Policy: Only admins/owners can delete properties
CREATE POLICY "properties_delete_policy" ON properties
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
-- HELPER VIEW: Properties with formatted details
-- =====================================================

CREATE OR REPLACE VIEW property_details AS
SELECT 
    p.*,
    -- Formatted address
    CONCAT_WS(', ',
        NULLIF(p.unit_number, ''),
        NULLIF(p.block_tower, ''),
        NULLIF(p.property_name, ''),
        NULLIF(p.address_line1, ''),
        NULLIF(p.locality, ''),
        p.city
    ) AS formatted_address,
    -- BHK label
    CASE 
        WHEN p.category = 'residential' AND p.bedrooms > 0 
        THEN CONCAT(p.bedrooms, ' BHK')
        WHEN p.category = 'residential' AND p.bedrooms = 0 
        THEN 'Studio'
        ELSE NULL
    END AS bhk_label,
    -- Total rooms count
    COALESCE(p.bedrooms, 0) + 
    COALESCE(p.bathrooms, 0) + 
    COALESCE(p.living_rooms, 0) + 
    COALESCE(p.dining_rooms, 0) + 
    COALESCE(p.kitchens, 0) + 
    COALESCE(p.study_rooms, 0) + 
    COALESCE(p.servant_rooms, 0) + 
    COALESCE(p.pooja_rooms, 0) + 
    COALESCE(p.store_rooms, 0) AS total_rooms,
    -- Creator details
    creator.raw_user_meta_data->>'full_name' AS created_by_name
FROM properties p
LEFT JOIN auth.users creator ON p.created_by = creator.id;

-- Grant access to the view
GRANT SELECT ON property_details TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE properties IS 'Central property registry for all modules (leads, projects, quotations)';
COMMENT ON COLUMN properties.carpet_area IS 'Actual usable floor area in sqft';
COMMENT ON COLUMN properties.built_up_area IS 'Carpet area + wall thickness';
COMMENT ON COLUMN properties.super_built_up_area IS 'Built-up area + proportionate common areas';
COMMENT ON COLUMN properties.unit_number IS 'Flat/Unit/Door number';
COMMENT ON COLUMN properties.block_tower IS 'Building block or tower name';
COMMENT ON COLUMN properties.amenities IS 'JSON array of additional amenities like garden, terrace, etc.';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Next steps:
-- 1. Update Lead creation UI to allow creating/linking properties
-- 2. Update Lead details page to show Property Details section
-- 3. Add property types to frontend type definitions
-- =====================================================
