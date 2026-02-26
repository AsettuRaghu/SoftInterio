# Automated Email Setup for Password Reset

## What Changed

The "Send Email" button now **automatically sends the email** instead of opening the email client.

## How It Works

1. Click "Reset Password" on a team member
2. Get the temporary password modal
3. Click "Send Email to [Member Name]"
4. Email is automatically sent to the member
5. Success message shows when email is sent

## Setup Required

To enable automated email sending, you need to add your email service API key to your environment variables.

### Option 1: Using Resend (Recommended for Next.js)

1. Sign up at [Resend.com](https://resend.com)
2. Get your API key
3. Add to `.env.local`:

```
RESEND_API_KEY=your_api_key_here
EMAIL_FROM=noreply@yourcompany.com
```

### Option 2: Using SendGrid

Currently configured for Resend. To use SendGrid instead, you can:

1. Update the API endpoint in `/src/app/api/email/send-password-reset/route.ts`
2. Replace the Resend fetch with SendGrid's API call
3. Add `SENDGRID_API_KEY` to `.env.local`

### Option 3: Using AWS SES

Similar to SendGrid - requires updating the API endpoint.

## What If Email Service Isn't Configured?

If you don't have an email service configured:

- ✅ Password reset still works
- ✅ You'll get a message that email service isn't configured
- ✅ You can still copy and share credentials manually
- ✅ The "Copy Credentials" button still works

## Testing

1. Go to Team Settings
2. Click Edit on a team member
3. Click "Reset Password"
4. In the modal, click "Send Email to [Member Name]"
5. Watch for success/error messages

## Email Content

The email includes:

- Member name
- Email address
- Temporary password
- Instructions to change password on first login
- Warning about password security
- Professional HTML formatting

## Troubleshooting

| Issue                          | Solution                                           |
| ------------------------------ | -------------------------------------------------- |
| "Email service not configured" | Add `RESEND_API_KEY` to `.env.local`               |
| Email sending fails            | Check API key is correct and service has quota     |
| Email never arrives            | Check spam folder, verify email address is correct |
| Want different email service   | Update the API endpoint code                       |

## Files Modified

- `/src/components/team/PasswordResetModal.tsx` - Added email sending UI
- `/src/app/api/email/send-password-reset/route.ts` - New API endpoint

## Environment Variables

Add these to `.env.local`:

```bash
# Resend Email Service
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=noreply@yourcompany.com

# OR SendGrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx

# OR AWS SES
AWS_SES_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
```

---

**Status**: Ready for configuration
**Next Step**: Add email service API key to `.env.local`
