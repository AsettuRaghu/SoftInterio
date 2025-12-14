-- Migration: Add missing foreign key constraints for project metadata relationships
-- This ensures all project metadata (client, property, lead) are properly linked via foreign keys
-- Note: This migration is superseded by 058 which renames the column to lead_id
-- Keeping this for reference, but 058 should be run instead

-- DEPRECATED: This adds FK for converted_from_lead_id, but migration 058 renames it to lead_id
-- If you haven't run this yet, skip it and run migration 058 instead

DO $$
BEGIN
    RAISE NOTICE 'Migration 057 is deprecated. Please run migration 058 instead, which renames converted_from_lead_id to lead_id';
    RAISE NOTICE 'Skipping this migration...';
END $$;

-- (Old code commented out - replaced by migration 058)
