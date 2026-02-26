# Password Reset - Integrated into Edit Member Dialog

## Changes Made

### 1. API Endpoint Fix

**File**: `/src/app/api/team/members/[id]/reset-password/route.ts`

**Issue Fixed**: `SyntaxError: Unexpected end of JSON input` when request body is empty

**Change**: Updated request body parsing to handle empty bodies

```typescript
// Before: Direct destructuring that failed on empty body
const { password: providedPassword, sendEmail = true } = await request.json();

// After: Safe parsing with try-catch
let providedPassword: string | undefined;
let sendEmail = true;

try {
  const body = await request.json();
  providedPassword = body.password;
  sendEmail = body.sendEmail !== false;
} catch (e) {
  // Empty body is fine, will generate password
}
```

### 2. Team Page Updates

**File**: `/src/app/dashboard/settings/team/page.tsx`

**Changes**:

- Simplified `handleResetPassword()` to only take `memberId` (no longer needs confirmation dialog)
- Removed separate lock icon button from table row
- Added `onResetPassword={handleResetPassword}` to EditMemberModal props

**Before**: Separate reset button → confirmation dialog → password modal
**After**: Edit button → edit modal with integrated reset password option → password modal

### 3. Edit Member Modal Update

**File**: `/src/components/team/EditMemberModal.tsx`

**Changes**:

- Added `onResetPassword?: (memberId: string) => void` to props
- Added new "Password Management" section with "Reset Password" button
- Section only shows for active members when `onResetPassword` callback is provided
- Button closes modal and triggers password reset, showing the generated password

**New UI Section** (appears in edit modal for active members):

```
┌─ Password Management ──────────────────────────┐
│                                                │
│  Reset Password                                │
│  Generate temporary password for this user     │
│                              [Reset Password]  │
│                                                │
└────────────────────────────────────────────────┘
```

## User Experience Flow

### Old Flow (Separate Button)

1. Member list with separate reset password button
2. Click reset button
3. Confirmation dialog
4. Password modal with new credentials

### New Flow (Integrated)

1. Member list with single edit button
2. Click edit button → Opens Edit Member dialog
3. See "Password Management" section
4. Click "Reset Password" button in dialog
5. Dialog closes and password modal appears
6. Copy/share credentials

## Benefits

✅ **Simpler UI**: Only one button instead of two
✅ **Better UX**: All member management in one dialog
✅ **Cleaner**: Less visual clutter in member table
✅ **Logical grouping**: Password reset grouped with role management and status controls
✅ **Fixed API error**: Request body parsing now handles empty bodies correctly

## Testing the New Feature

1. **Go to**: Dashboard → Settings → Team
2. **Click**: Edit button (pencil icon) on any active member
3. **Look for**: "Password Management" section in the dialog
4. **Click**: "Reset Password" button
5. **See**: Modal appears with temporary password
6. **Actions**: Copy, email, or share credentials

## Files Modified

1. ✅ `/src/app/api/team/members/[id]/reset-password/route.ts` - Fixed body parsing
2. ✅ `/src/app/dashboard/settings/team/page.tsx` - Simplified handler, removed button, added prop
3. ✅ `/src/components/team/EditMemberModal.tsx` - Added password reset section

## Verification

- ✅ TypeScript - No errors
- ✅ No runtime errors
- ✅ All imports working
- ✅ Props properly passed
- ✅ Callback handling correct

---

**Status**: Ready for testing
**Date**: February 4, 2026
