/**
 * Leads Module Utility Functions
 * Helper functions for formatting, validation, and common operations
 */

import type { LeadStage } from "@/types/leads";
import { LEAD_STAGE_COLORS, TERMINAL_LEAD_STAGES } from "./constants";

/**
 * Get stage color classes based on lead stage
 */
export function getStageColor(stage: LeadStage): {
  bg: string;
  text: string;
  dot: string;
} {
  return LEAD_STAGE_COLORS[stage] || LEAD_STAGE_COLORS.new;
}

/**
 * Check if lead is in terminal stage (won, lost, or disqualified)
 */
export function isLeadClosed(stage: LeadStage): boolean {
  return TERMINAL_LEAD_STAGES.includes(stage);
}

/**
 * Format phone number to readable format
 * Example: "+91 98765 43210"
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return "—";
  // Remove non-digits
  const digits = phone.replace(/\D/g, "");
  // Format Indian phone number
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone;
}

/**
 * Format currency in Indian Rupees
 * Example: "₹10,00,000"
 */
export function formatIndianCurrency(amount: number | undefined): string {
  if (!amount) return "—";
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
 * Calculate days since date
 * Returns positive number if date is in past
 */
export function daysSinceDate(dateString?: string | null): number | null {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = today.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch {
    return null;
  }
}

/**
 * Format days since date to readable text
 * Example: "3 days ago", "Today", "Yesterday"
 */
export function formatDaysSince(dateString?: string | null): string {
  const days = daysSinceDate(dateString);
  if (days === null) return "—";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (basic check for 10+ digits)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10;
}

/**
 * Validate lead creation form
 */
export function validateLeadForm(data: {
  client_name?: string;
  phone?: string;
  email?: string;
}): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!data.client_name?.trim()) {
    errors.client_name = "Client name is required";
  }

  if (!data.phone?.trim()) {
    errors.phone = "Phone number is required";
  } else if (!isValidPhoneNumber(data.phone)) {
    errors.phone = "Phone number must be at least 10 digits";
  }

  if (data.email && !isValidEmail(data.email)) {
    errors.email = "Invalid email format";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Get status badge classes for lead display
 */
export function getLeadStatusBadgeClasses(stage: LeadStage): string {
  const colors = getStageColor(stage);
  return `${colors.bg} ${colors.text}`;
}

/**
 * Calculate lead days in pipeline
 */
export function calculateDaysInPipeline(createdAt?: string | null): number | null {
  return daysSinceDate(createdAt);
}

/**
 * Check if lead needs urgent follow-up (created > 7 days ago without stage change)
 */
export function needsUrgentFollowUp(
  createdAt?: string | null,
  updatedAt?: string | null
): boolean {
  const daysSinceCreation = daysSinceDate(createdAt);
  const daysSinceUpdate = daysSinceDate(updatedAt);

  if (daysSinceCreation === null) return false;

  // Need followup if created > 7 days ago and no recent updates
  if (daysSinceCreation > 7) {
    if (daysSinceUpdate === null) return true;
    return daysSinceUpdate > 3; // No activity in 3 days
  }

  return false;
}

/**
 * Truncate string to specified length
 */
export function truncateString(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.substring(0, length) + "...";
}

/**
 * Generate lead summary from lead data
 */
export function generateLeadSummary(lead: {
  client_name?: string;
  property_name?: string;
  stage: LeadStage;
}): string {
  const parts = [lead.client_name, lead.property_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" - ") : "Unknown Lead";
}
