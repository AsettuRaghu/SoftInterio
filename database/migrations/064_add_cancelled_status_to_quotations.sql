-- Migration: Add cancelled status support to quotations
-- Date: 2025-12-14
-- Description: Documents the addition of 'cancelled' status to quotations.
--              The status column is already varchar(30) so no schema change needed.
--              Valid statuses are now: draft, sent, viewed, negotiating, approved, rejected, expired, cancelled

-- Add comment to document valid status values
COMMENT ON COLUMN "public"."quotations"."status" 
IS 'Valid values: draft, sent, viewed, negotiating, approved, rejected, expired, cancelled. Default is draft.';

-- The approved and cancelled statuses are now fully supported
-- - approved: Quotation has been approved by client
-- - cancelled: Quotation has been cancelled by internal team or client

-- No table structure changes needed as status is varchar(30)
-- This migration is for documentation purposes
