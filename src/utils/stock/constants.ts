/**
 * Stock Module Constants
 * Shared constants used across stock and procurement pages
 */

import type { POCostType, POStatus, GRNStatus, MaterialRequirementStatus } from "@/types/stock";

/**
 * Purchase Order status options
 */
export const PO_STATUS_OPTIONS: Array<{ value: POStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "sent_to_vendor", label: "Sent to Vendor" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "dispatched", label: "Dispatched" },
  { value: "partially_received", label: "Partially Received" },
  { value: "fully_received", label: "Fully Received" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

/**
 * Material Request status options
 */
export const MR_STATUS_OPTIONS: Array<{ value: MaterialRequirementStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "confirmed", label: "Confirmed" },
  { value: "partially_ordered", label: "Partially Ordered" },
  { value: "ordered", label: "Ordered" },
  { value: "partially_received", label: "Partially Received" },
  { value: "received", label: "Received" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

/**
 * GRN status options
 */
export const GRN_STATUS_OPTIONS: Array<{ value: GRNStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
];

/**
 * PO cost type options
 */
export const PO_COST_TYPE_OPTIONS: Array<{
  value: POCostType;
  label: string;
}> = [
  { value: "project", label: "Project" },
  { value: "stock", label: "Stock" },
  { value: "overhead", label: "Overhead" },
];

/**
 * Quality tier options for materials and cost items
 */
export const QUALITY_TIER_OPTIONS: Array<{
  value: string;
  label: string;
}> = [
  { value: "economy", label: "Economy" },
  { value: "standard", label: "Standard" },
  { value: "premium", label: "Premium" },
  { value: "luxury", label: "Luxury" },
];

/**
 * Unit code options for materials and cost items
 */
export const UNIT_CODE_OPTIONS: Array<{
  value: string;
  label: string;
}> = [
  { value: "sqft", label: "Square Feet (sqft)" },
  { value: "rft", label: "Running Feet (rft)" },
  { value: "nos", label: "Number (nos)" },
  { value: "set", label: "Set" },
  { value: "lot", label: "Lot" },
  { value: "lumpsum", label: "Lump Sum" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "ltr", label: "Liter (ltr)" },
];

/**
 * Priority options for purchase orders and material requests
 */
export const PRIORITY_OPTIONS: Array<{
  value: string;
  label: string;
  color: string;
}> = [
  { value: "low", label: "Low", color: "bg-blue-100 text-blue-700" },
  { value: "medium", label: "Medium", color: "bg-yellow-100 text-yellow-700" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-700" },
  {
    value: "urgent",
    label: "Urgent",
    color: "bg-red-100 text-red-700",
  },
];

/**
 * Material item type options
 */
export const MATERIAL_ITEM_TYPE_OPTIONS: Array<{
  value: string;
  label: string;
}> = [
  { value: "materials", label: "Materials" },
  { value: "finishes", label: "Finishes" },
  { value: "accessories", label: "Accessories" },
];

/**
 * Stock status labels
 */
export const STOCK_STATUS_LABELS: Record<string, string> = {
  in_stock: "In Stock",
  low_stock: "Low Stock",
  out_of_stock: "Out of Stock",
  discontinued: "Discontinued",
};

/**
 * Modal configuration
 */
export const MODAL_CONFIG = {
  OVERLAY_CLASS:
    "fixed inset-0 z-50 flex items-center justify-center bg-black/50",
  LARGE_CONTAINER_CLASS:
    "relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4",
  MEDIUM_CONTAINER_CLASS:
    "relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4",
  SMALL_CONTAINER_CLASS:
    "relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto m-4",
} as const;
