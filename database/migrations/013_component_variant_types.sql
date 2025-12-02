-- ============================================================================
-- COMPONENT VARIANT TYPES (Level 3 - The "Type" in Space > Component > Type > Cost Attributes)
-- Migration: 013_component_variant_types.sql
-- 
-- This migration adds the tertiary level "Type" between Component and Cost Attributes
-- Examples:
--   - Wardrobe -> CeilingSliding, OpenableWithLoft, SlidingWithLoft
--   - Kitchen -> LShape, UShape, Parallel, Island
--   - False Ceiling -> Plain, Designer, Cove
-- ============================================================================

-- 3.1 Component Variant Types (Level 3 definitions)
-- Types/Variants of components that define how cost attributes are structured
CREATE TABLE IF NOT EXISTS component_variant_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    component_type_id UUID NOT NULL REFERENCES component_types(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,                    -- "Ceiling Sliding", "Openable With Loft"
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    
    -- Variant-specific configuration
    -- Defines what cost attributes are applicable and their calculation methods
    cost_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Example:
    -- {
    --   "attributes": [
    --     {"name": "Carcass Area", "type": "area", "unit": "sqft", "calculation": "L x W"},
    --     {"name": "Shutter Area", "type": "area", "unit": "sqft", "calculation": "L x W"},
    --     {"name": "Hinges", "type": "quantity", "unit": "nos", "default_qty": 4},
    --     {"name": "Labour", "type": "quantity", "unit": "nos", "rate_per_sqft": true}
    --   ]
    -- }
    
    -- Default dimensions (can override component_type defaults)
    default_width DECIMAL(10,2),
    default_height DECIMAL(10,2),
    default_depth DECIMAL(10,2),
    
    -- Pricing hints
    base_rate_per_sqft DECIMAL(12,2),              -- Base rate for estimation
    quality_tier VARCHAR(20) DEFAULT 'standard',   -- "budget", "standard", "premium", "luxury"
    
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,               -- System-defined vs tenant-created
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, component_type_id, slug)
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_component_variant_types_tenant 
    ON component_variant_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_component_variant_types_component 
    ON component_variant_types(component_type_id);
CREATE INDEX IF NOT EXISTS idx_component_variant_types_active 
    ON component_variant_types(tenant_id, is_active);

-- Add variant_type_id to quotation_components to link to the Type
ALTER TABLE quotation_components 
ADD COLUMN IF NOT EXISTS variant_type_id UUID REFERENCES component_variant_types(id) ON DELETE SET NULL;

-- Add variant_type_id to component_templates
ALTER TABLE component_templates 
ADD COLUMN IF NOT EXISTS variant_type_id UUID REFERENCES component_variant_types(id) ON DELETE SET NULL;

-- ============================================================================
-- UPDATED COST ATTRIBUTE FLOW
-- ============================================================================
-- 
-- NEW HIERARCHY:
-- 1. Space (quotation_spaces) - Master Bedroom, Living Room, Kitchen
-- 2. Component (quotation_components) - Wardrobe, TV Unit, Modular Kitchen
-- 3. Type (component_variant_types) - CeilingSliding, OpenableWithLoft, LShape
-- 4. Cost Attributes (quotation_cost_attributes) - Area sqft, Quantity nos
--
-- The quotation_materials table becomes optional/deprecated for the new flow.
-- Cost attributes are now directly linked to components via the variant type.
-- ============================================================================

-- Update quotation_cost_attributes to optionally reference component directly
ALTER TABLE quotation_cost_attributes 
ADD COLUMN IF NOT EXISTS component_id UUID REFERENCES quotation_components(id) ON DELETE CASCADE;

-- Create index for the new relationship
CREATE INDEX IF NOT EXISTS idx_quotation_cost_attributes_component 
    ON quotation_cost_attributes(component_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE component_variant_types ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy - users can only see/modify their own tenant's data
DROP POLICY IF EXISTS "Users can view tenant variant types" ON component_variant_types;
CREATE POLICY "Users can view tenant variant types"
    ON component_variant_types FOR SELECT
    USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can create tenant variant types" ON component_variant_types;
CREATE POLICY "Users can create tenant variant types"
    ON component_variant_types FOR INSERT
    WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update tenant variant types" ON component_variant_types;
CREATE POLICY "Users can update tenant variant types"
    ON component_variant_types FOR UPDATE
    USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()))
    WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete tenant variant types" ON component_variant_types;
CREATE POLICY "Users can delete tenant variant types"
    ON component_variant_types FOR DELETE
    USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- HELPER FUNCTION: Get Cost Attributes for a Variant Type
-- ============================================================================

CREATE OR REPLACE FUNCTION get_variant_cost_config(p_variant_type_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_config JSONB;
BEGIN
    SELECT cost_config INTO v_config
    FROM component_variant_types
    WHERE id = p_variant_type_id;
    
    RETURN COALESCE(v_config, '{}'::jsonb);
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE component_variant_types IS 
    'Tertiary level in quotation hierarchy: Space > Component > Type > Cost Attributes. 
     Defines variants like CeilingSliding, OpenableWithLoft for Wardrobe component type.';

COMMENT ON COLUMN component_variant_types.cost_config IS 
    'JSON configuration defining which cost attributes apply to this variant and how they are calculated.
     Example: {"attributes": [{"name": "Area", "type": "area", "unit": "sqft"}, {"name": "Hinges", "type": "quantity", "unit": "nos"}]}';
