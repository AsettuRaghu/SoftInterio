/**
 * Subscription Status Utility Functions
 * Handles all subscription state calculations and validations
 */

export type SubscriptionState = 
  | 'on-trial-no-payment'      // Trial active, no payment made
  | 'on-trial-with-payment'    // Trial active, payment made (subscription starts after trial)
  | 'active-subscription'       // Subscription active (after trial ended and payment was made)
  | 'expiring-soon'             // Subscription expiring in < 15 days
  | 'expired-no-payment'        // Trial ended, no payment made, account inactive
  | 'expired-subscription'      // Subscription period ended, account inactive

export interface SubscriptionStatus {
  state: SubscriptionState
  isActive: boolean                    // Can user access the platform
  canPayNow: boolean                   // Show "Pay Now" button
  showPayNowButton: boolean           // Display the button
  payNowButtonLabel: string           // "Pay Now" or "Renew"
  showTrialDates: boolean             // Show trial period dates
  showSubscriptionDates: boolean      // Show subscription period dates
  daysUntilExpiry: number | null      // Days remaining (null if no expiry)
  expiryWarningDays: number           // Days threshold for warning (15)
  accessBlockedMessage: string | null // Block access message if inactive
}

export interface TenantSubscriptionData {
  id: string
  status: string
  is_trial: boolean
  trial_start_date: string | null
  trial_end_date: string | null
  subscription_start_date: string | null
  subscription_end_date: string | null
  current_period_start: string
  current_period_end: string
  last_payment_date: string | null
  grace_period_days: number
  grace_period_end: string | null
}

const EXPIRY_WARNING_DAYS = 15
const SUPPORT_EMAIL = 'support@softinterio.com'
const SUPPORT_PHONE = '+1-800-SUPPORT'

/**
 * Calculate days between two dates
 */
function daysBetween(startDate: Date, endDate: Date): number {
  const diffTime = endDate.getTime() - startDate.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Main function to determine subscription state
 */
export function getSubscriptionStatus(
  subscription: TenantSubscriptionData | null,
  now: Date = new Date()
): SubscriptionStatus {
  // No subscription record - treat as expired
  if (!subscription) {
    return {
      state: 'expired-no-payment',
      isActive: false,
      canPayNow: false,
      showPayNowButton: false,
      payNowButtonLabel: 'Pay Now',
      showTrialDates: false,
      showSubscriptionDates: false,
      daysUntilExpiry: null,
      expiryWarningDays: EXPIRY_WARNING_DAYS,
      accessBlockedMessage: `Your account is inactive. Please contact support at ${SUPPORT_EMAIL} or ${SUPPORT_PHONE} to reactivate.`,
    }
  }

  const trialEnd = subscription.trial_end_date ? new Date(subscription.trial_end_date) : null
  const subscriptionEnd = subscription.subscription_end_date ? new Date(subscription.subscription_end_date) : null
  const lastPaymentDate = subscription.last_payment_date ? new Date(subscription.last_payment_date) : null

  // SCENARIO 1: On Trial, No Payment Made
  if (subscription.is_trial && trialEnd && now < trialEnd && !lastPaymentDate) {
    return {
      state: 'on-trial-no-payment',
      isActive: true,
      canPayNow: true,
      showPayNowButton: true,
      payNowButtonLabel: 'Pay Now',
      showTrialDates: true,
      showSubscriptionDates: false,
      daysUntilExpiry: daysBetween(now, trialEnd),
      expiryWarningDays: EXPIRY_WARNING_DAYS,
      accessBlockedMessage: null,
    }
  }

  // SCENARIO 2: On Trial, With Payment Made (subscription will start after trial)
  if (subscription.is_trial && trialEnd && now < trialEnd && lastPaymentDate) {
    return {
      state: 'on-trial-with-payment',
      isActive: true,
      canPayNow: false,
      showPayNowButton: false,
      payNowButtonLabel: 'Pay Now',
      showTrialDates: false,
      showSubscriptionDates: true,
      daysUntilExpiry: daysBetween(now, subscriptionEnd || trialEnd),
      expiryWarningDays: EXPIRY_WARNING_DAYS,
      accessBlockedMessage: null,
    }
  }

  // SCENARIO 3: Trial Ended, No Payment Made
  if (subscription.is_trial && trialEnd && now >= trialEnd && !lastPaymentDate) {
    return {
      state: 'expired-no-payment',
      isActive: false,
      canPayNow: false,
      showPayNowButton: false,
      payNowButtonLabel: 'Pay Now',
      showTrialDates: false,
      showSubscriptionDates: false,
      daysUntilExpiry: null,
      expiryWarningDays: EXPIRY_WARNING_DAYS,
      accessBlockedMessage: `Your trial has ended. Please contact support at ${SUPPORT_EMAIL} or ${SUPPORT_PHONE} to upgrade your account.`,
    }
  }

  // SCENARIO 4: Subscription Active (not on trial, and either has payment OR database status = active, and subscription end in future)
  // This handles newly created subscriptions that don't have last_payment_date set yet but have status='active'
  if (!subscription.is_trial && subscriptionEnd && (lastPaymentDate || subscription.status === 'active') && now < subscriptionEnd) {
    const daysUntilEnd = daysBetween(now, subscriptionEnd)
    
    // SCENARIO 4a: Expiring Soon (< 15 days)
    if (daysUntilEnd <= EXPIRY_WARNING_DAYS) {
      return {
        state: 'expiring-soon',
        isActive: true,
        canPayNow: true,
        showPayNowButton: true,
        payNowButtonLabel: 'Renew',
        showTrialDates: false,
        showSubscriptionDates: true,
        daysUntilExpiry: daysUntilEnd,
        expiryWarningDays: EXPIRY_WARNING_DAYS,
        accessBlockedMessage: null,
      }
    }
    
    // SCENARIO 4b: Active Subscription (> 15 days)
    return {
      state: 'active-subscription',
      isActive: true,
      canPayNow: false,
      showPayNowButton: false,
      payNowButtonLabel: 'Renew',
      showTrialDates: false,
      showSubscriptionDates: true,
      daysUntilExpiry: daysUntilEnd,
      expiryWarningDays: EXPIRY_WARNING_DAYS,
      accessBlockedMessage: null,
    }
  }

  // SCENARIO 5: Subscription Expired
  if (subscriptionEnd && now >= subscriptionEnd) {
    return {
      state: 'expired-subscription',
      isActive: false,
      canPayNow: false,
      showPayNowButton: false,
      payNowButtonLabel: 'Renew',
      showTrialDates: false,
      showSubscriptionDates: false,
      daysUntilExpiry: null,
      expiryWarningDays: EXPIRY_WARNING_DAYS,
      accessBlockedMessage: `Your subscription has expired. Please contact support at ${SUPPORT_EMAIL} or ${SUPPORT_PHONE} to renew.`,
    }
  }

  // Fallback: Unknown state, treat as inactive
  return {
    state: 'expired-no-payment',
    isActive: false,
    canPayNow: false,
    showPayNowButton: false,
    payNowButtonLabel: 'Pay Now',
    showTrialDates: false,
    showSubscriptionDates: false,
    daysUntilExpiry: null,
    expiryWarningDays: EXPIRY_WARNING_DAYS,
    accessBlockedMessage: `Your account is inactive. Please contact support at ${SUPPORT_EMAIL} or ${SUPPORT_PHONE} to reactivate.`,
  }
}

/**
 * Check if a user has access to the platform (for middleware)
 */
export function hasAccessToplatform(
  subscription: TenantSubscriptionData | null,
  now: Date = new Date()
): boolean {
  const status = getSubscriptionStatus(subscription, now)
  return status.isActive
}

/**
 * Get the access blocked message (if account is inactive)
 */
export function getAccessBlockedMessage(
  subscription: TenantSubscriptionData | null,
  now: Date = new Date()
): string | null {
  const status = getSubscriptionStatus(subscription, now)
  return status.accessBlockedMessage
}

/**
 * Format subscription state for display
 */
export function formatSubscriptionState(state: SubscriptionState): string {
  const labels: Record<SubscriptionState, string> = {
    'on-trial-no-payment': 'Trial (No Payment)',
    'on-trial-with-payment': 'Trial (Payment Made)',
    'active-subscription': 'Active',
    'expiring-soon': 'Expiring Soon',
    'expired-no-payment': 'Inactive (Trial Ended)',
    'expired-subscription': 'Inactive (Expired)',
  }
  return labels[state] || 'Unknown'
}
