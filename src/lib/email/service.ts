/**
 * Email Service
 *
 * This is a placeholder for email sending functionality.
 * In production, integrate with an email service like:
 * - Resend (recommended for Next.js)
 * - SendGrid
 * - AWS SES
 * - Postmark
 *
 * For now, this logs emails to console in development.
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface InviteEmailData {
  recipientEmail: string;
  recipientName: string;
  inviterName: string;
  companyName: string;
  acceptUrl: string;
  isExistingUser: boolean;
}

/**
 * Send an email (placeholder - logs to console in dev)
 */
export async function sendEmail(
  options: EmailOptions
): Promise<{ success: boolean; error?: string }> {
  console.log("[EMAIL SERVICE] Sending email...");
  console.log("[EMAIL SERVICE] To:", options.to);
  console.log("[EMAIL SERVICE] Subject:", options.subject);
  console.log(
    "[EMAIL SERVICE] HTML preview:",
    options.html.substring(0, 200) + "..."
  );

  // TODO: Integrate with actual email service
  // Example with Resend:
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // const { data, error } = await resend.emails.send({
  //   from: 'SoftInterio <noreply@softinterio.com>',
  //   to: options.to,
  //   subject: options.subject,
  //   html: options.html,
  // });

  return { success: true };
}

/**
 * Generate and send invitation email for existing users
 * (New users get Supabase's built-in invite email)
 */
export async function sendExistingUserInviteEmail(
  data: InviteEmailData
): Promise<{ success: boolean; error?: string }> {
  const subject = `You've been invited to join ${data.companyName} on SoftInterio`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invitation to join ${data.companyName}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">SoftInterio</h1>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1f2937; margin-top: 0;">Hi ${data.recipientName},</h2>
        
        <p style="color: #4b5563;">
          ${data.inviterName} has invited you to join <strong>${data.companyName}</strong> on SoftInterio.
        </p>
        
        <div style="background: #f0f9ff; border: 1px solid #0284c7; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="color: #0369a1; margin: 0;">
            <strong>Good news!</strong> You already have a SoftInterio account. Just sign in with your existing password to join this organization.
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.acceptUrl}" 
             style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Accept Invitation
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          Or copy and paste this link into your browser:
          <br>
          <a href="${data.acceptUrl}" style="color: #3b82f6; word-break: break-all;">${data.acceptUrl}</a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          This invitation will expire in 7 days.
          <br>
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
Hi ${data.recipientName},

${data.inviterName} has invited you to join ${data.companyName} on SoftInterio.

Good news! You already have a SoftInterio account. Just sign in with your existing password to join this organization.

Accept the invitation here: ${data.acceptUrl}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

- The SoftInterio Team
  `;

  console.log("[EMAIL SERVICE] Existing user invitation email:");
  console.log("[EMAIL SERVICE] To:", data.recipientEmail);
  console.log("[EMAIL SERVICE] Accept URL:", data.acceptUrl);

  return sendEmail({
    to: data.recipientEmail,
    subject,
    html,
    text,
  });
}

/**
 * Generate invitation email template for new users
 * (Note: Supabase handles sending for new users via inviteUserByEmail)
 */
export function getNewUserInviteEmailTemplate(data: {
  recipientName: string;
  inviterName: string;
  companyName: string;
}): { subject: string; html: string } {
  const subject = `Welcome to ${data.companyName} on SoftInterio`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to ${data.companyName}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">SoftInterio</h1>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1f2937; margin-top: 0;">Hi ${data.recipientName},</h2>
        
        <p style="color: #4b5563;">
          ${data.inviterName} has invited you to join <strong>${data.companyName}</strong> on SoftInterio.
        </p>
        
        <p style="color: #4b5563;">
          Click the button below to set up your password and get started.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{SETUP_LINK}}" 
             style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Set Up Your Account
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          This invitation will expire in 7 days.
          <br>
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
      </div>
    </body>
    </html>
  `;

  return { subject, html };
}
