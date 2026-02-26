# Admin Password Reset - Quick Testing Guide

## How to Test the Feature

### Prerequisites

- You must be logged in as an Owner or Admin
- You must have at least one active team member to reset password for
- Development server must be running

### Step-by-Step Testing

#### Test 1: Verify Reset Button Visibility

1. Navigate to **Dashboard → Settings → Team**
2. Look at the team members list
3. **Verify**: Each active team member has a lock icon button next to the Edit button
4. **Verify**: Inactive/invited members do NOT show the lock icon
5. **Expected**: Lock icon appears in orange hover state

#### Test 2: Reset Password Flow

1. Click the **lock icon** next to an active team member
2. **Verify**: Confirmation modal appears with message:
   - "Are you sure you want to reset [Member Name]'s password?"
   - "A temporary password will be generated that they can use to log in."
3. Click **"Reset Password"** button
4. **Verify**: Modal closes and new modal appears showing:
   - Member name and email
   - Temporary password (copy button)
   - Email copy button
   - "Send Email" button (blue, with envelope icon)
   - "Copy Credentials" button (gray)
   - "Done" button

#### Test 3: Copy Functions

1. In the password reset modal:
2. Click **copy icon next to email**
   - **Verify**: Icon shows checkmark briefly
   - **Verify**: Email can be pasted somewhere (Cmd+V)
3. Click **copy icon next to password**
   - **Verify**: Icon shows checkmark briefly
   - **Verify**: Password can be pasted (Cmd+V)
4. Click **"Copy Credentials"**
   - **Verify**: Button text changes to "✓ Copied to clipboard"
   - **Verify**: Both email and password copied together

#### Test 4: Email Integration

1. In the password reset modal:
2. Click **"Send Email to [Member Name]"** button
3. **Verify**: Email client opens with:
   - To: [member email]
   - Subject: "Your Temporary Password"
   - Body includes email and temporary password
4. Review the email content and verify it's formatted properly

#### Test 5: Actual Login Test (Optional but Recommended)

1. Copy the temporary password from the modal
2. Log out (or use incognito window)
3. Go to login page
4. Enter member's email
5. Enter the temporary password
6. **Verify**: Login successful
7. **Verify**: User can access dashboard
8. Go to Settings → Profile → Change Password
9. **Verify**: User can change to a new password
10. Log out and log back in with new password to verify it works

#### Test 6: Permission Checks

1. Log in as a regular Member (not Admin/Owner)
2. Navigate to Team Settings
3. **Verify**: No lock icon appears for any members
4. **Verify**: If you try to access API directly, it returns 403 Forbidden

#### Test 7: Self-Protection Check (if you're an admin/owner)

1. Try to find your own user in the team list
2. **Verify**: Your own lock icon button should be disabled or missing
   - Note: Current implementation hides button only if proper permissions fail
   - The API endpoint prevents resetting own password with an error

### Expected Behavior Summary

✅ **Shows Up When**:

- User is logged in as Owner or Admin
- Team member is in "active" status
- Not resetting own password

✅ **Doesn't Show When**:

- User is a regular Member (no permissions)
- Team member is inactive/invited
- User is trying to reset own password

✅ **Modal Features**:

- Clear, prominent display of temporary password
- Easy copy-to-clipboard for both email and password
- Email integration for direct sharing
- Warning message about changing password

✅ **Security**:

- Password is 12+ characters with special characters
- Only shown once in modal
- Email link pre-fills credentials securely
- API validates all permissions server-side

### Troubleshooting

| Issue                      | Solution                                     |
| -------------------------- | -------------------------------------------- |
| Lock icon not showing      | Verify you're logged in as Admin/Owner       |
| Click does nothing         | Check browser console for errors             |
| Modal not appearing        | Verify JavaScript is enabled                 |
| Password copy doesn't work | Try copying manually from the field          |
| Email link doesn't work    | Manually create email with credentials shown |
| API returns error          | Check user permissions and member status     |

### Files to Review

- **Backend Logic**: `/src/app/api/team/members/[id]/reset-password/route.ts`
- **Frontend Handler**: `/src/app/dashboard/settings/team/page.tsx` (search for `handleResetPassword`)
- **Modal Component**: `/src/components/team/PasswordResetModal.tsx`
- **Type Definitions**: Check `TeamMember` interface in team/page.tsx

### Next Steps After Testing

If all tests pass:

1. ✅ Feature is ready for production
2. Consider adding email templates for auto-sending (requires email service)
3. Consider adding force-password-change on next login (future enhancement)
4. Document feature in user manual

If issues found:

1. Check browser DevTools console for errors
2. Check terminal output for API errors
3. Verify Supabase Auth is accessible
4. Check user permissions hierarchy
