# Forgot Password Email Issue - Investigation & Solutions

## Issue Summary

**Problem**: When users click "Forgot Password" on the login page and submit their email, they receive a success message but **no email is actually sent**.

**Impact**: Users who forget their password cannot reset it themselves - they must contact admin to reset via the new admin password reset feature.

## Root Cause Analysis

### Current Implementation

**Flow**:

```
User → ForgotPasswordForm → /api/auth/forgot-password → requestPasswordReset() → Supabase resetPasswordForEmail()
```

**Files Involved**:

1. `/src/modules/auth/components/ForgotPasswordForm.tsx` - Frontend form
2. `/src/app/api/auth/forgot-password/route.ts` - API endpoint
3. `/src/modules/auth/service.ts` - Auth service with `requestPasswordReset()`

**Current Code**:

```typescript
// In auth/service.ts
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
  });

  if (error) throw error;
  return { success: true };
}
```

### Why Emails Aren't Sending

The code is correct, but the **Supabase project is not configured to send emails**. This requires:

✅ **SMTP Configuration**:

- Supabase account has email notifications not enabled
- OR custom SMTP is not configured
- OR email templates are not set up in Supabase

✅ **Possible Issues**:

1. **Email Service Disabled** - Supabase free plan may have limitations
2. **No SMTP Provider** - Need SendGrid, AWS SES, or custom SMTP
3. **Invalid Email Template** - Reset password template not configured
4. **Rate Limiting** - Too many requests from same IP
5. **Firewall/DNS** - Email provider blocking connections

## Investigation Steps

### Step 1: Check Supabase Dashboard

1. Go to your Supabase project: https://app.supabase.com
2. Navigate to: **Settings → Email Templates**
3. Check the following:
   - Is "Password reset" template present?
   - Is it enabled?
   - Does it have valid content?

### Step 2: Check Email Provider Configuration

1. In Supabase dashboard: **Settings → SMTP Settings**
2. Look for:
   - SMTP Host configured?
   - SMTP Port configured?
   - Authentication enabled?
   - Email provider selected? (SendGrid, AWS SES, Custom)

### Step 3: Check Email Logs

1. In Supabase: **Database → Logs** or **Auth → Logs**
2. Filter for "password_reset" or "email"
3. Look for error messages indicating why email failed

### Step 4: Test Manually

Run this in browser console (when logged in):

```javascript
fetch("/api/auth/forgot-password", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "test@example.com" }),
})
  .then((r) => r.json())
  .then(console.log);
```

Check response for errors.

## Solutions

### Solution 1: Enable Supabase Email Service (Recommended)

**If you have a Supabase Pro plan:**

1. Go to Supabase Dashboard
2. Settings → Email Templates
3. Enable "Password reset" template
4. Choose email provider:
   - **Built-in Supabase SMTP** (simple, limited)
   - **SendGrid** (recommended)
   - **AWS SES** (enterprise)
   - **Custom SMTP** (your own server)

**For SendGrid Setup**:

1. Create SendGrid account
2. Generate API key
3. In Supabase: Enter SendGrid API key
4. Test by triggering forgot password

### Solution 2: Use Custom Email Service

If Supabase email isn't working, implement a custom email service:

**Create new file**: `/src/lib/email/password-reset.ts`

```typescript
import { postmark } from "@/lib/email/postmark"; // or sendgrid, nodemailer, etc.

export async function sendPasswordResetEmail(
  email: string,
  resetLink: string,
  name?: string,
) {
  try {
    await postmark.send({
      From: process.env.SENDER_EMAIL,
      To: email,
      Subject: "Reset Your Password",
      HtmlBody: `
        <h2>Reset Your Password</h2>
        <p>Hi ${name || email},</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link expires in 24 hours.</p>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error("Email send failed:", error);
    return { success: false, error: error.message };
  }
}
```

**Update API endpoint**:

```typescript
// /src/app/api/auth/forgot-password/route.ts
import { sendPasswordResetEmail } from "@/lib/email/password-reset";

export async function POST(req: Request) {
  const { email } = await req.json();

  try {
    // Get reset link from Supabase (without sending email)
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
    });

    if (error) throw error;

    // Send with custom service
    await sendPasswordResetEmail(email, resetLink);

    return json({ success: true });
  } catch (error) {
    // Generic response for security
    return json({ success: true });
  }
}
```

### Solution 3: Use Third-Party Service

**Services to Consider**:

| Service        | Pros                 | Cons              | Cost            |
| -------------- | -------------------- | ----------------- | --------------- |
| **SendGrid**   | Reliable, easy setup | API calls         | $19-99/mo       |
| **AWS SES**    | Cheap, scalable      | Complex setup     | ~$0.10 per 1000 |
| **Postmark**   | Great templates      | Limited free tier | $15/mo          |
| **Resend**     | NextJS optimized     | Newer service     | $20/mo          |
| **Nodemailer** | Free, simple         | Requires SMTP     | Free            |

## Quick Fix: Temporary Workaround

Until email is configured, users must:

1. ✅ Click "Forgot Password" on login page
2. ❌ Email won't arrive (known issue)
3. ✅ Contact admin who can:
   - Go to Team Settings
   - Click lock icon on their user
   - Get temporary password
   - Send it to them
   - They log in and change password

This is why the admin password reset feature is critical!

## Implementation Checklist

### To Fix Forgot Password Email:

- [ ] Check Supabase email configuration
- [ ] Enable email templates in Supabase
- [ ] Choose and configure email provider
- [ ] Test with real email address
- [ ] Verify email arrives within 1 minute
- [ ] Test password reset link works
- [ ] Document solution for future reference

### Alternative: Implement Custom Service

- [ ] Choose email service (SendGrid, PostMark, AWS SES)
- [ ] Set up account and get credentials
- [ ] Update `/src/lib/email/password-reset.ts`
- [ ] Update `/src/app/api/auth/forgot-password/route.ts`
- [ ] Add environment variables for service keys
- [ ] Test end-to-end
- [ ] Update documentation

## Environment Variables Needed

For custom email service, add to `.env.local`:

```bash
# Email Service Configuration
EMAIL_SERVICE=sendgrid  # or postmark, aws-ses, nodemailer
SENDGRID_API_KEY=sg_...
SENDER_EMAIL=noreply@yourcompany.com
SENDER_NAME="Your Company"

# For Postmark
POSTMARK_API_TOKEN=...

# For AWS SES
AWS_SES_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# For Nodemailer
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
```

## Testing the Fix

Once configured:

1. **Test 1**: Go to login page
2. **Test 2**: Click "Forgot Password"
3. **Test 3**: Enter test email address
4. **Test 4**: Check email inbox (and spam folder)
5. **Test 5**: Click reset link
6. **Test 6**: Set new password
7. **Test 7**: Log in with new password

Expected time: Email should arrive within 1-2 minutes

## Related Features

✅ **Just Implemented**: [Admin Password Reset](./ADMIN_PASSWORD_RESET_IMPLEMENTATION.md)

- Admins can reset team member passwords
- Generates temporary password
- Shows credentials in modal
- Email integration for sharing

⏳ **Pending**: Forgot Password Email Fix

- Enable Supabase email OR
- Implement custom email service

## Files That Would Change

- `/src/app/api/auth/forgot-password/route.ts` - Add custom email service call
- `/src/lib/email/password-reset.ts` - Create new service (if using custom)
- `.env.local` - Add email service credentials
- `/src/lib/email/index.ts` - Register email service (if not exists)

## Quick Reference: What to Check First

```bash
# SSH into your Supabase instance and check:
1. Email service status: Supabase Dashboard > Settings > Email
2. Template status: Supabase Dashboard > Settings > Email Templates
3. SMTP configuration: Supabase Dashboard > Settings > SMTP Settings
4. Auth logs: Supabase Dashboard > Auth > Logs
5. Error patterns: Search for "password_reset" or "email" failures
```

## Support & Resources

- Supabase Email Docs: https://supabase.com/docs/guides/auth/password-reset
- SendGrid Integration: https://sendgrid.com
- Email Template Best Practices: https://supabase.com/docs/guides/auth/auth-email-templates
- Common Email Issues: https://github.com/supabase/supabase/discussions

---

**Last Updated**: [Current Date]
**Status**: 🔴 Issue Identified, Awaiting Configuration
