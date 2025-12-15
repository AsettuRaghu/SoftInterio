/**
 * Quotations Module Utility Functions
 * Helper functions for formatting, validation, and common operations
 */

import { CATEGORY_COLORS, QUALITY_TIER_COLORS } from "./constants";

/**
 * Get category color based on category slug
 * Falls back to default color if not found
 */
export function getCategoryColor(categorySlug?: string): string {
  if (!categorySlug) return CATEGORY_COLORS.default;
  return (
    CATEGORY_COLORS[categorySlug.toLowerCase()] || CATEGORY_COLORS.default
  );
}

/**
 * Get quality tier color based on tier name
 * Falls back to default if not found
 */
export function getQualityTierColor(qualityTier?: string): string {
  if (!qualityTier) return QUALITY_TIER_COLORS.budget;
  return QUALITY_TIER_COLORS[qualityTier.toLowerCase()] || QUALITY_TIER_COLORS.budget;
}

/**
 * Format currency value for Indian Rupees
 * Removes decimal places and adds commas
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date to readable format
 * Example: "15 Dec 2025"
 */
export function formatDate(dateString?: string | null): string {
  if (!dateString) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(dateString));
  } catch {
    return "—";
  }
}

/**
 * Format date time with time component
 * Example: "15 Dec 2025, 2:30 PM"
 */
export function formatDateTime(dateString?: string | null): string {
  if (!dateString) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(dateString));
  } catch {
    return "—";
  }
}

/**
 * Validate quotation number format
 * Typically "QT-2025-001"
 */
export function isValidQuotationNumber(quotationNumber: string): boolean {
  return quotationNumber.trim().length > 0;
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate date is in future
 */
export function isFutureDate(dateString: string): boolean {
  try {
    return new Date(dateString) > new Date();
  } catch {
    return false;
  }
}

/**
 * Calculate days until quotation expires
 */
export function daysUntilExpiry(validUntilDate?: string | null): number | null {
  if (!validUntilDate) return null;
  try {
    const expiryDate = new Date(validUntilDate);
    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch {
    return null;
  }
}

/**
 * Check if quotation is expired
 */
export function isQuotationExpired(validUntilDate?: string | null): boolean {
  const days = daysUntilExpiry(validUntilDate);
  return days !== null && days < 0;
}

/**
 * Check if quotation is expiring soon (within 7 days)
 */
export function isExpiringsSoon(validUntilDate?: string | null): boolean {
  const days = daysUntilExpiry(validUntilDate);
  return days !== null && days >= 0 && days <= 7;
}

/**
 * Generate quotation status badge CSS classes
 */
export function getStatusBadgeClasses(status: string): {
  container: string;
  text: string;
  dot: string;
} {
  const statusClasses: Record<
    string,
    { container: string; text: string; dot: string }
  > = {
    draft: {
      container: "bg-slate-100",
      text: "text-slate-700",
      dot: "bg-slate-500",
    },
    sent: {
      container: "bg-blue-100",
      text: "text-blue-700",
      dot: "bg-blue-500",
    },
    viewed: {
      container: "bg-cyan-100",
      text: "text-cyan-700",
      dot: "bg-cyan-500",
    },
    negotiating: {
      container: "bg-amber-100",
      text: "text-amber-700",
      dot: "bg-amber-500",
    },
    approved: {
      container: "bg-green-100",
      text: "text-green-700",
      dot: "bg-green-500",
    },
    rejected: {
      container: "bg-red-100",
      text: "text-red-700",
      dot: "bg-red-500",
    },
    cancelled: {
      container: "bg-orange-100",
      text: "text-orange-700",
      dot: "bg-orange-500",
    },
    expired: {
      container: "bg-gray-100",
      text: "text-gray-700",
      dot: "bg-gray-500",
    },
  };

  return (
    statusClasses[status] || statusClasses.draft
  );
}

/**
 * Round number to 2 decimal places
 */
export function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calculate percentage of a value
 */
export function calculatePercentage(value: number, percentage: number): number {
  return roundTo2Decimals((value * percentage) / 100);
}

/**
 * Remove special characters from string (keep only alphanumeric and spaces)
 */
export function sanitizeString(str: string): string {
  return str.replace(/[^a-zA-Z0-9\s]/g, "");
}

/**
 * Truncate string to specified length and add ellipsis
 */
export function truncateString(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.substring(0, length) + "...";
}
