-- Migration: 007_fix_user_status_and_update.sql
-- Description: Fix user status update on email verification and ensure UPDATE policy works
-- Date: 2025-11-28

-- =====================================================
-- 1. CREATE TRIGGER TO UPDATE USER STATUS ON EMAIL VERIFICATION
-- =====================================================

-- Function to sync user email verification status from auth.users to public.users
CREATE OR REPLACE FUNCTION sync_user_email_verification()
RETURNS TRIGGER AS $$
BEGIN
    -- When auth.users email_confirmed_at is set (email verified)
    IF NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at != NEW.email_confirmed_at) THEN
        UPDATE public.users
        SET 
            email_verified_at = NEW.email_confirmed_at,
            status = 'active',
            updated_at = NOW()
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_email_verified ON auth.users;
CREATE TRIGGER on_auth_user_email_verified
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_email_verification();

-- =====================================================
-- 2. FIX EXISTING USERS WHO HAVE VERIFIED EMAIL BUT STATUS IS STILL pending_verification
-- =====================================================

-- Update users who have verified their email in auth.users but status is still pending
UPDATE public.users u
SET 
    status = 'active',
    email_verified_at = au.email_confirmed_at,
    updated_at = NOW()
FROM auth.users au
WHERE u.id = au.id
  AND au.email_confirmed_at IS NOT NULL
  AND u.status = 'pending_verification';

-- =====================================================
-- 3. ENSURE UPDATE POLICY EXISTS AND IS CORRECT
-- =====================================================

-- Drop and recreate the update policy to ensure it's working
DROP POLICY IF EXISTS "Users can update own record" ON users;

-- Create a more permissive update policy
CREATE POLICY "Users can update own record"
    ON users FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- =====================================================
-- 4. VERIFY RLS IS ENABLED
-- =====================================================

-- Ensure RLS is enabled on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. ADD POLICY FOR SERVICE ROLE TO BYPASS RLS (for admin operations)
-- =====================================================

-- Policy for service role (used by admin client) - already should exist but let's ensure
DROP POLICY IF EXISTS "Service role has full access to users" ON users;
-- Note: Service role automatically bypasses RLS, so this isn't strictly needed

-- =====================================================
-- VERIFICATION QUERIES (run these manually to check)
-- =====================================================
-- Check if policy exists:
-- SELECT * FROM pg_policies WHERE tablename = 'users';
--
-- Check user status after running:
-- SELECT id, email, status, email_verified_at FROM public.users;
--
-- Check auth.users email_confirmed_at:
-- SELECT id, email, email_confirmed_at FROM auth.users;
