-- ============================================================================
-- Migration: Add specifications column to stock_materials
-- Description: Adds a JSONB column to store material specifications like
--              dimensions, weight, color, finish, grade, etc.
-- ============================================================================

-- Add specifications column
ALTER TABLE stock_materials
ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN stock_materials.specifications IS 'JSONB column storing material specifications like dimensions, weight, color, finish, grade, material composition, etc.';

-- Create index for JSONB queries (GIN index for flexible queries)
CREATE INDEX IF NOT EXISTS idx_stock_materials_specifications 
ON stock_materials USING GIN (specifications);

-- Example specifications structure:
-- {
--   "dimensions": {
--     "length": 2440,
--     "width": 1220,
--     "thickness": 18,
--     "unit": "mm"
--   },
--   "weight": {
--     "value": 35,
--     "unit": "kg"
--   },
--   "color": "Natural Oak",
--   "finish": "Matte",
--   "grade": "E1",
--   "material": "Engineered Wood",
--   "density": "650 kg/m³",
--   "custom_fields": [
--     { "label": "Fire Rating", "value": "Class B" },
--     { "label": "Moisture Content", "value": "8-12%" }
--   ]
-- }
