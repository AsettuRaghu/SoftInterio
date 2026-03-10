/**
 * Activity Logger Service
 * Logs all subscription and system events to both console and activity_logs table
 */

import { createClient } from "@/lib/supabase/server";

export type ActivityAction =
  | "subscription.created"
  | "subscription.trial_started"
  | "subscription.payment_initiated"
  | "subscription.payment_completed"
  | "subscription.payment_failed"
  | "subscription.activated"
  | "subscription.renewed"
  | "subscription.expiring_soon"
  | "subscription.expired"
  | "subscription.cancelled"
  | "subscription.status_changed"
  | "access.granted"
  | "access.denied"
  | "access.blocked_trial_expired"
  | "access.blocked_subscription_expired"
  | "access.blocked_inactive"
  | "user.login_attempted"
  | "user.login_success"
  | "user.login_failed"
  | "user.logout"
  | "plan.changed"
  | "invoice.created"
  | "invoice.paid"
  | "invoice.failed";

export interface ActivityLogData {
  tenantId: string;
  userId?: string;
  action: ActivityAction;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log activity to both console and activity_logs table
 */
export async function logActivity(data: ActivityLogData): Promise<void> {
  const timestamp = new Date().toISOString();
  const logLevel = getLogLevel(data.action);

  // Console logging with color coding
  const consoleMessage = `[${logLevel}] ${timestamp} | ${data.action} | Tenant: ${data.tenantId}${data.userId ? ` | User: ${data.userId}` : ""}`;
  const consoleData = {
    action: data.action,
    description: data.description,
    tenantId: data.tenantId,
    userId: data.userId,
    metadata: data.metadata,
  };

  switch (logLevel) {
    case "ERROR":
      console.error(consoleMessage, consoleData);
      break;
    case "WARNING":
      console.warn(consoleMessage, consoleData);
      break;
    case "INFO":
      console.log(consoleMessage, consoleData);
      break;
    default:
      console.log(consoleMessage, consoleData);
  }

  // Log to database
  try {
    const supabase = await createClient();

    await supabase.from("activity_logs").insert({
      tenant_id: data.tenantId,
      user_id: data.userId || null,
      action: data.action,
      description: data.description,
      ip_address: data.ipAddress || null,
      user_agent: data.userAgent || null,
      metadata: data.metadata || {},
      created_at: timestamp,
    });
  } catch (error) {
    console.error(
      `[ERROR] Failed to log activity to database: ${data.action}`,
      error
    );
  }
}

/**
 * Determine log level based on action type
 */
function getLogLevel(
  action: ActivityAction
): "INFO" | "WARNING" | "ERROR" {
  if (
    action.includes("failed") ||
    action.includes("blocked") ||
    action.includes("denied")
  ) {
    return "ERROR";
  }
  if (
    action.includes("expiring") ||
    action.includes("expired") ||
    action.includes("cancelled")
  ) {
    return "WARNING";
  }
  return "INFO";
}

/**
 * Subscription-specific logging
 */
export const subscriptionLogger = {
  trialStarted: async (tenantId: string, userId: string, trialDays: number) => {
    await logActivity({
      tenantId,
      userId,
      action: "subscription.trial_started",
      description: `Trial period started for ${trialDays} days`,
      metadata: { trialDays },
    });
  },

  paymentInitiated: async (
    tenantId: string,
    userId: string,
    planId: string,
    amount: number
  ) => {
    await logActivity({
      tenantId,
      userId,
      action: "subscription.payment_initiated",
      description: `Payment initiated for ₹${amount} on plan ${planId}`,
      metadata: { planId, amount, currency: "INR" },
    });
  },

  paymentCompleted: async (
    tenantId: string,
    userId: string,
    planId: string,
    amount: number,
    paymentId: string
  ) => {
    await logActivity({
      tenantId,
      userId,
      action: "subscription.payment_completed",
      description: `Payment completed: ₹${amount} from Razorpay (${paymentId})`,
      metadata: { planId, amount, paymentId, currency: "INR" },
    });
  },

  paymentFailed: async (
    tenantId: string,
    userId: string | undefined,
    error: string
  ) => {
    await logActivity({
      tenantId,
      userId,
      action: "subscription.payment_failed",
      description: `Payment failed: ${error}`,
      metadata: { errorMessage: error },
    });
  },

  subscriptionActivated: async (
    tenantId: string,
    userId: string,
    planId: string,
    startDate: string,
    endDate: string
  ) => {
    await logActivity({
      tenantId,
      userId,
      action: "subscription.activated",
      description: `Subscription activated: ${startDate} to ${endDate}`,
      metadata: { planId, startDate, endDate },
    });
  },

  statusChanged: async (
    tenantId: string,
    oldStatus: string,
    newStatus: string,
    reason?: string
  ) => {
    await logActivity({
      tenantId,
      action: "subscription.status_changed",
      description: `Subscription status changed: ${oldStatus} → ${newStatus}${reason ? ` (${reason})` : ""}`,
      metadata: { oldStatus, newStatus, reason },
    });
  },

  expiringIn15Days: async (tenantId: string, userId: string, daysRemaining: number) => {
    await logActivity({
      tenantId,
      userId,
      action: "subscription.expiring_soon",
      description: `Subscription expiring in ${daysRemaining} days - renewal required`,
      metadata: { daysRemaining },
    });
  },

  expired: async (tenantId: string, expiryDate: string) => {
    await logActivity({
      tenantId,
      action: "subscription.expired",
      description: `Subscription expired on ${expiryDate}`,
      metadata: { expiryDate },
    });
  },
};

/**
 * Access control logging
 */
export const accessLogger = {
  loginAttempted: async (email: string, ipAddress?: string) => {
    await logActivity({
      tenantId: "system",
      action: "user.login_attempted",
      description: `Login attempt for ${email}`,
      metadata: { email },
      ipAddress,
    });
  },

  loginSuccess: async (
    tenantId: string,
    userId: string,
    email: string,
    ipAddress?: string
  ) => {
    await logActivity({
      tenantId,
      userId,
      action: "user.login_success",
      description: `User logged in: ${email}`,
      metadata: { email },
      ipAddress,
    });
  },

  loginFailed: async (email: string, reason: string, ipAddress?: string) => {
    await logActivity({
      tenantId: "system",
      action: "user.login_failed",
      description: `Login failed for ${email}: ${reason}`,
      metadata: { email, reason },
      ipAddress,
    });
  },

  accessGranted: async (tenantId: string, userId: string, subscriptionState: string) => {
    await logActivity({
      tenantId,
      userId,
      action: "access.granted",
      description: `Access granted (${subscriptionState})`,
      metadata: { subscriptionState },
    });
  },

  accessDenied: async (
    tenantId: string,
    userId: string,
    reason: string,
    subscriptionState: string
  ) => {
    await logActivity({
      tenantId,
      userId,
      action: "access.denied",
      description: `Access denied: ${reason}`,
      metadata: { reason, subscriptionState },
    });
  },

  blockedTrialExpired: async (tenantId: string, userId: string) => {
    await logActivity({
      tenantId,
      userId,
      action: "access.blocked_trial_expired",
      description: "Access blocked - trial period expired without payment",
      metadata: {},
    });
  },

  blockedSubscriptionExpired: async (tenantId: string, userId: string) => {
    await logActivity({
      tenantId,
      userId,
      action: "access.blocked_subscription_expired",
      description: "Access blocked - subscription period expired",
      metadata: {},
    });
  },

  blockedInactiveAccount: async (tenantId: string, userId: string) => {
    await logActivity({
      tenantId,
      userId,
      action: "access.blocked_inactive",
      description: "Access blocked - account is inactive",
      metadata: {},
    });
  },

  logout: async (tenantId: string, userId: string) => {
    await logActivity({
      tenantId,
      userId,
      action: "user.logout",
      description: "User logged out",
      metadata: {},
    });
  },
};

/**
 * Plan change logging
 */
export const planLogger = {
  planChanged: async (
    tenantId: string,
    userId: string,
    oldPlanId: string,
    newPlanId: string
  ) => {
    await logActivity({
      tenantId,
      userId,
      action: "plan.changed",
      description: `Subscription plan changed from ${oldPlanId} to ${newPlanId}`,
      metadata: { oldPlanId, newPlanId },
    });
  },
};

/**
 * Invoice logging
 */
export const invoiceLogger = {
  invoiceCreated: async (
    tenantId: string,
    invoiceNumber: string,
    amount: number
  ) => {
    await logActivity({
      tenantId,
      action: "invoice.created",
      description: `Invoice created: ${invoiceNumber} for ₹${amount}`,
      metadata: { invoiceNumber, amount, currency: "INR" },
    });
  },

  invoicePaid: async (
    tenantId: string,
    invoiceNumber: string,
    amount: number
  ) => {
    await logActivity({
      tenantId,
      action: "invoice.paid",
      description: `Invoice paid: ${invoiceNumber} for ₹${amount}`,
      metadata: { invoiceNumber, amount, currency: "INR" },
    });
  },

  invoiceFailed: async (
    tenantId: string,
    invoiceNumber: string,
    error: string
  ) => {
    await logActivity({
      tenantId,
      action: "invoice.failed",
      description: `Invoice payment failed: ${invoiceNumber} - ${error}`,
      metadata: { invoiceNumber, error },
    });
  },
};
