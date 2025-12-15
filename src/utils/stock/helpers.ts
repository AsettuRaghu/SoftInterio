/**
 * Stock Module Helper Functions
 * Utility functions for formatting, validation, and calculations
 */

import type { POStatus, GRNStatus, MaterialRequirementStatus } from "@/types/stock";

/**
 * Format currency values with Indian rupee formatting
 */
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(num)) return "₹0";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format date to readable format
 */
export function formatDate(date: string | Date | null): string {
  if (!date) return "-";

  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(dateObj);
}

/**
 * Get CSS classes for PO status badge
 */
export function getPoStatusBadgeClasses(status: POStatus): string {
  const statusClasses: Record<POStatus, string> = {
    draft: "bg-gray-100 text-gray-700",
    pending_approval: "bg-yellow-100 text-yellow-700",
    approved: "bg-blue-100 text-blue-700",
    rejected: "bg-red-100 text-red-700",
    sent_to_vendor: "bg-indigo-100 text-indigo-700",
    acknowledged: "bg-purple-100 text-purple-700",
    dispatched: "bg-orange-100 text-orange-700",
    partially_received: "bg-amber-100 text-amber-700",
    fully_received: "bg-green-100 text-green-700",
    closed: "bg-teal-100 text-teal-700",
    cancelled: "bg-red-100 text-red-700",
  };

  return statusClasses[status] || "bg-gray-100 text-gray-700";
}

/**
 * Get CSS classes for MR status badge
 */
export function getMrStatusBadgeClasses(status: MaterialRequirementStatus): string {
  const statusClasses: Record<MaterialRequirementStatus, string> = {
    draft: "bg-gray-100 text-gray-700",
    confirmed: "bg-blue-100 text-blue-700",
    partially_ordered: "bg-amber-100 text-amber-700",
    ordered: "bg-indigo-100 text-indigo-700",
    partially_received: "bg-yellow-100 text-yellow-700",
    received: "bg-green-100 text-green-700",
    closed: "bg-teal-100 text-teal-700",
    cancelled: "bg-red-100 text-red-700",
  };

  return statusClasses[status] || "bg-gray-100 text-gray-700";
}

/**
 * Get CSS classes for GRN status badge
 */
export function getGrnStatusBadgeClasses(status: GRNStatus): string {
  const statusClasses: Record<GRNStatus, string> = {
    draft: "bg-gray-100 text-gray-700",
    confirmed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
  };

  return statusClasses[status] || "bg-gray-100 text-gray-700";
}

/**
 * Get CSS classes for stock status badge
 */
export function getStockStatusBadgeClasses(status: string): string {
  const statusClasses: Record<string, string> = {
    in_stock: "bg-green-100 text-green-700",
    low_stock: "bg-yellow-100 text-yellow-700",
    out_of_stock: "bg-red-100 text-red-700",
    discontinued: "bg-gray-100 text-gray-700",
  };

  return statusClasses[status] || "bg-gray-100 text-gray-700";
}

/**
 * Get CSS classes for priority badge
 */
export function getPriorityBadgeClasses(priority: string): string {
  const priorityClasses: Record<string, string> = {
    low: "bg-blue-100 text-blue-700",
    medium: "bg-yellow-100 text-yellow-700",
    high: "bg-orange-100 text-orange-700",
    urgent: "bg-red-100 text-red-700",
  };

  return priorityClasses[priority] || "bg-gray-100 text-gray-700";
}

/**
 * Calculate margin percentage between cost and selling price
 */
export function calculateMargin(cost: number, sellingPrice: number): number {
  if (cost === 0) return 0;

  const margin = ((sellingPrice - cost) / sellingPrice) * 100;

  return Math.round(margin * 100) / 100;
}

/**
 * Check if a purchase order is ready for procurement
 */
export function isProcurementReady(poData: {
  status: POStatus;
  items: any[];
}): boolean {
  return (
    poData.status === "approved" &&
    poData.items &&
    poData.items.length > 0 &&
    poData.items.every((item) => item.quantity && item.costPerUnit)
  );
}

/**
 * Check if stock needs reorder
 */
export function needsReorder(
  currentStock: number,
  minimumStock: number
): boolean {
  return currentStock <= minimumStock;
}

/**
 * Format stock display with unit
 */
export function formatStockDisplay(
  quantity: number,
  unit: string = "sqft"
): string {
  const unitLabel =
    unit === "sqft"
      ? "sqft"
      : unit === "rft"
        ? "rft"
        : unit === "nos"
          ? "nos"
          : unit;

  return `${quantity} ${unitLabel}`;
}

/**
 * Get unit label from unit code
 */
export function getUnitLabel(unitCode: string): string {
  const unitLabels: Record<string, string> = {
    sqft: "Square Feet (sqft)",
    rft: "Running Feet (rft)",
    nos: "Number (nos)",
    set: "Set",
    lot: "Lot",
    lumpsum: "Lump Sum",
    kg: "Kilogram (kg)",
    ltr: "Liter (ltr)",
  };

  return unitLabels[unitCode] || unitCode;
}

/**
 * Validate cost item form data
 */
export function validateCostItemForm(data: {
  name?: string;
  category?: string;
  unitCode?: string;
  costPerUnit?: number;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!data.name?.trim()) {
    errors.name = "Name is required";
  }

  if (!data.category?.trim()) {
    errors.category = "Category is required";
  }

  if (!data.unitCode) {
    errors.unitCode = "Unit code is required";
  }

  if (!data.costPerUnit || data.costPerUnit <= 0) {
    errors.costPerUnit = "Cost per unit must be greater than 0";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate PO form data
 */
export function validatePoForm(data: {
  vendorId?: string;
  referenceNumber?: string;
  items?: any[];
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!data.vendorId?.trim()) {
    errors.vendorId = "Vendor is required";
  }

  if (!data.referenceNumber?.trim()) {
    errors.referenceNumber = "Reference number is required";
  }

  if (!data.items || data.items.length === 0) {
    errors.items = "At least one item is required";
  } else {
    const invalidItems = data.items.filter(
      (item) => !item.costItemId || !item.quantity || !item.costPerUnit
    );
    if (invalidItems.length > 0) {
      errors.items = "All items must have cost item, quantity, and cost";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Calculate total PO value
 */
export function calculatePoTotal(
  items: Array<{ quantity: number; costPerUnit: number }>
): number {
  if (!items || items.length === 0) return 0;

  return items.reduce((total, item) => {
    const itemTotal = (item.quantity || 0) * (item.costPerUnit || 0);
    return total + itemTotal;
  }, 0);
}

/**
 * Get status label for display
 */
export function getStatusLabel(
  status: string,
  type: "po" | "mr" | "grn" = "po"
): string {
  const labels: Record<string, Record<string, string>> = {
    po: {
      draft: "Draft",
      confirmed: "Confirmed",
      partially_received: "Partially Received",
      received: "Received",
      cancelled: "Cancelled",
    },
    mr: {
      pending: "Pending",
      approved: "Approved",
      cancelled: "Cancelled",
    },
    grn: {
      pending: "Pending",
      accepted: "Accepted",
      rejected: "Rejected",
      partial_acceptance: "Partial Acceptance",
    },
  };

  return labels[type]?.[status] || status;
}

/**
 * Check if PO can be edited
 */
export function canEditPo(status: POStatus): boolean {
  return status === "draft" || status === "approved";
}

/**
 * Check if PO can be cancelled
 */
export function canCancelPo(status: POStatus): boolean {
  return status !== "cancelled" && status !== "fully_received" && status !== "closed";
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

/**
 * Days since date
 */
export function daysSinceDate(date: string | Date | null): number | null {
  if (!date) return null;

  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays >= 0 ? diffDays : null;
}

/**
 * Format days since to readable format
 */
export function formatDaysSince(days: number | null): string {
  if (days === null) return "-";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}
