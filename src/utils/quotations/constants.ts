/**
 * Quotations Module Constants
 * Shared constants used across quotations pages and components
 */

import type { QuotationStatus } from "@/types/quotations";

/**
 * Quotation Status Options for filtering and UI display
 */
export const QUOTATION_STATUS_OPTIONS: Array<{
  value: QuotationStatus;
  label: string;
  color: string;
}> = [
  { value: "draft", label: "Draft", color: "#94a3b8" },
  { value: "sent", label: "Sent", color: "#3b82f6" },
  { value: "negotiating", label: "Negotiating", color: "#f59e0b" },
  { value: "approved", label: "Approved", color: "#22c55e" },
  { value: "rejected", label: "Rejected", color: "#ef4444" },
  { value: "cancelled", label: "Cancelled", color: "#f97316" },
  { value: "expired", label: "Expired", color: "#6b7280" },
  { value: "linked_to_project", label: "Linked to Project", color: "#8b5cf6" },
  { value: "project_baseline", label: "Project Baseline", color: "#06b6d4" },
];

/**
 * Active quotation statuses (can be modified)
 */
export const ACTIVE_QUOTATION_STATUSES: QuotationStatus[] = ["draft", "sent"];

/**
 * Default tax percentage (GST)
 */
export const DEFAULT_TAX_PERCENT = 18;

/**
 * Category colors for cost item categories
 */
export const CATEGORY_COLORS: Record<string, string> = {
  carcass: "bg-amber-100 text-amber-700",
  shutter: "bg-blue-100 text-blue-700",
  hardware: "bg-purple-100 text-purple-700",
  finish: "bg-pink-100 text-pink-700",
  labour: "bg-green-100 text-green-700",
  accessories: "bg-indigo-100 text-indigo-700",
  countertop: "bg-teal-100 text-teal-700",
  appliances: "bg-orange-100 text-orange-700",
  default: "bg-slate-100 text-slate-600",
};

/**
 * Quality tier colors for templates
 */
export const QUALITY_TIER_COLORS: Record<string, string> = {
  luxury: "bg-purple-100 text-purple-700",
  premium: "bg-blue-100 text-blue-700",
  standard: "bg-green-100 text-green-700",
  budget: "bg-slate-100 text-slate-700",
};

/**
 * Auto-save timing configuration (in milliseconds)
 */
export const AUTO_SAVE_CONFIG = {
  DELAY: 3000, // 3 seconds after last change
  CHECK_INTERVAL: 1000, // Check every second
} as const;

/**
 * Default modal dimensions and styling
 */
export const MODAL_CONFIG = {
  OVERLAY_CLASS: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50",
  CONTAINER_CLASS: "bg-white rounded-xl w-full max-w-2xl p-6 max-h-[85vh] flex flex-col",
  SMALL_CONTAINER_CLASS: "bg-white rounded-xl w-full max-w-md p-6",
} as const;
