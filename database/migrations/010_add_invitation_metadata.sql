-- Migration: 010_add_invitation_metadata.sql
-- Description: Add metadata JSONB column to user_invitations for storing additional data
-- Date: 2025-11-28
-- Note: This enables storing multiple role IDs and other invitation data

-- =====================================================
-- ADD METADATA COLUMN TO USER_INVITATIONS
-- =====================================================

ALTER TABLE user_invitations 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add comment explaining the column
COMMENT ON COLUMN user_invitations.metadata IS 'Stores additional invitation data like role_ids array for multi-role support, first_name, last_name, designation';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- 
-- The metadata column can store:
-- {
--   "first_name": "John",
--   "last_name": "Doe",
--   "designation": "Senior Designer",
--   "role_ids": ["uuid1", "uuid2"]  // For multi-role support
-- }
--
-- This is optional - the invite system works without it,
-- but adding it enables richer invitation data storage.
--
