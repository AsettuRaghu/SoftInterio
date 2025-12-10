// ============================================================================
// Stock Management Types
// ============================================================================

// Project type for PO line item linking
export interface Project {
  id: string;
  project_number: string;
  name: string;
  client_name?: string;
  status: string;
  is_active: boolean;
}

// Enums matching database types
export type StockItemType =
  | "raw_material"
  | "hardware"
  | "consumable"
  | "finished_good"
  | "accessory";

// PO Status - Order lifecycle (independent of payment)
export type POStatus =
  | "draft" // Being created, fully editable
  | "pending_approval" // Submitted for approval, locked
  | "approved" // Approved, edit sends back to draft
  | "rejected" // Rejected, terminal state, not editable
  | "sent_to_vendor" // Sent to vendor, only cancel allowed
  | "acknowledged" // Vendor acknowledged (optional)
  | "dispatched" // Vendor dispatched goods
  | "partially_received" // Some items received
  | "fully_received" // All items received
  | "closed" // Fully received AND fully paid
  | "cancelled"; // Cancelled at any stage

// Payment Status - Payment lifecycle (independent of order status)
export type POPaymentStatus =
  | "not_applicable" // Internal/sample orders
  | "pending" // No payment made
  | "advance_paid" // Advance payment made
  | "partially_paid" // Partial payment made
  | "fully_paid" // Full payment made
  | "overdue"; // Payment overdue

// Cost allocation type for PO line items
export type POCostType = "project" | "stock" | "overhead";

export type GRNStatus = "draft" | "confirmed" | "cancelled";

export type StockMovementType =
  | "purchase_receipt"
  | "purchase_return"
  | "issue_to_project"
  | "return_from_project"
  | "transfer"
  | "adjustment_in"
  | "adjustment_out"
  | "opening_stock";

export type StockLocationType = "warehouse" | "factory" | "site" | "transit";

export type MaterialRequirementStatus =
  | "draft"
  | "confirmed"
  | "partially_ordered"
  | "ordered"
  | "partially_received"
  | "received"
  | "closed"
  | "cancelled";

export type MRItemStatus =
  | "pending"
  | "ordered"
  | "partially_received"
  | "received"
  | "issued"
  | "cancelled";

// Display helpers
export const StockItemTypeLabels: Record<StockItemType, string> = {
  raw_material: "Raw Material",
  hardware: "Hardware",
  consumable: "Consumable",
  finished_good: "Finished Good",
  accessory: "Accessory",
};

export const StockItemTypeColors: Record<
  StockItemType,
  { bg: string; text: string }
> = {
  raw_material: { bg: "bg-amber-100", text: "text-amber-700" },
  hardware: { bg: "bg-slate-100", text: "text-slate-700" },
  consumable: { bg: "bg-blue-100", text: "text-blue-700" },
  finished_good: { bg: "bg-green-100", text: "text-green-700" },
  accessory: { bg: "bg-purple-100", text: "text-purple-700" },
};

export const POStatusLabels: Record<POStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  sent_to_vendor: "Sent to Vendor",
  acknowledged: "Acknowledged",
  dispatched: "Dispatched",
  partially_received: "Partially Received",
  fully_received: "Fully Received",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const POPaymentStatusLabels: Record<POPaymentStatus, string> = {
  not_applicable: "N/A",
  pending: "Payment Pending",
  advance_paid: "Advance Paid",
  partially_paid: "Partially Paid",
  fully_paid: "Fully Paid",
  overdue: "Overdue",
};

export const POCostTypeLabels: Record<POCostType, string> = {
  project: "Project",
  stock: "Stock",
  overhead: "Overhead",
};

export const POStatusColors: Record<
  POStatus,
  { bg: string; text: string; dot: string }
> = {
  draft: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-500" },
  pending_approval: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    dot: "bg-yellow-500",
  },
  approved: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  rejected: {
    bg: "bg-red-100",
    text: "text-red-700",
    dot: "bg-red-500",
  },
  sent_to_vendor: {
    bg: "bg-indigo-100",
    text: "text-indigo-700",
    dot: "bg-indigo-500",
  },
  acknowledged: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    dot: "bg-purple-500",
  },
  dispatched: {
    bg: "bg-cyan-100",
    text: "text-cyan-700",
    dot: "bg-cyan-500",
  },
  partially_received: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    dot: "bg-orange-500",
  },
  fully_received: {
    bg: "bg-green-100",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  closed: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    dot: "bg-emerald-600",
  },
  cancelled: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
};

export const POPaymentStatusColors: Record<
  POPaymentStatus,
  { bg: string; text: string; dot: string }
> = {
  not_applicable: {
    bg: "bg-slate-100",
    text: "text-slate-500",
    dot: "bg-slate-400",
  },
  pending: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    dot: "bg-yellow-500",
  },
  advance_paid: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  partially_paid: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    dot: "bg-orange-500",
  },
  fully_paid: {
    bg: "bg-green-100",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  overdue: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
};

export const POCostTypeColors: Record<
  POCostType,
  { bg: string; text: string }
> = {
  project: { bg: "bg-blue-100", text: "text-blue-700" },
  stock: { bg: "bg-amber-100", text: "text-amber-700" },
  overhead: { bg: "bg-slate-100", text: "text-slate-700" },
};

export const GRNStatusLabels: Record<GRNStatus, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

export const GRNStatusColors: Record<
  GRNStatus,
  { bg: string; text: string; dot: string }
> = {
  draft: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-500" },
  confirmed: {
    bg: "bg-green-100",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  cancelled: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
};

export const StockLocationTypeLabels: Record<StockLocationType, string> = {
  warehouse: "Warehouse",
  factory: "Factory",
  site: "Site",
  transit: "In Transit",
};

export const StockLocationTypeColors: Record<
  StockLocationType,
  { bg: string; text: string }
> = {
  warehouse: { bg: "bg-blue-100", text: "text-blue-700" },
  factory: { bg: "bg-amber-100", text: "text-amber-700" },
  site: { bg: "bg-green-100", text: "text-green-700" },
  transit: { bg: "bg-purple-100", text: "text-purple-700" },
};

export const MRStatusLabels: Record<MaterialRequirementStatus, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  partially_ordered: "Partially Ordered",
  ordered: "Ordered",
  partially_received: "Partially Received",
  received: "Received",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const MRStatusColors: Record<
  MaterialRequirementStatus,
  { bg: string; text: string; dot: string }
> = {
  draft: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-500" },
  confirmed: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  partially_ordered: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    dot: "bg-yellow-500",
  },
  ordered: {
    bg: "bg-indigo-100",
    text: "text-indigo-700",
    dot: "bg-indigo-500",
  },
  partially_received: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    dot: "bg-orange-500",
  },
  received: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  closed: { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" },
  cancelled: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
};

export const MRItemStatusLabels: Record<MRItemStatus, string> = {
  pending: "Pending",
  ordered: "Ordered",
  partially_received: "Partially Received",
  received: "Received",
  issued: "Issued",
  cancelled: "Cancelled",
};

// ============================================================================
// Interfaces
// ============================================================================

export interface Vendor {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  display_name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  alternate_phone?: string;
  website?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  gst_number?: string;
  pan_number?: string;
  payment_terms?: string;
  credit_days?: number;
  credit_limit?: number;
  category_ids?: string[];
  bank_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  is_active: boolean;
  is_preferred: boolean;
  rating?: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface VendorItem {
  id: string;
  tenant_id: string;
  vendor_id: string;
  cost_item_id: string;
  vendor_sku?: string;
  vendor_item_name?: string;
  unit_price: number;
  currency: string;
  price_valid_from?: string;
  price_valid_to?: string;
  min_order_qty: number;
  lead_time_days: number;
  is_preferred: boolean;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  cost_item?: StockableItem;
  vendor?: Vendor;
}

// Brand quality tiers
export type BrandQualityTier = "budget" | "standard" | "premium" | "luxury";

export const BrandQualityTierLabels: Record<BrandQualityTier, string> = {
  budget: "Budget",
  standard: "Standard",
  premium: "Premium",
  luxury: "Luxury",
};

export const BrandQualityTierColors: Record<
  BrandQualityTier,
  { bg: string; text: string }
> = {
  budget: { bg: "bg-slate-100", text: "text-slate-700" },
  standard: { bg: "bg-blue-100", text: "text-blue-700" },
  premium: { bg: "bg-purple-100", text: "text-purple-700" },
  luxury: { bg: "bg-amber-100", text: "text-amber-700" },
};

export interface Brand {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  display_name?: string;
  logo_url?: string;
  website?: string;
  country?: string;
  description?: string;
  categories?: string[];
  quality_tier: BrandQualityTier;
  is_active: boolean;
  is_preferred: boolean;
  created_at: string;
  updated_at: string;
}

export interface VendorBrand {
  id: string;
  tenant_id: string;
  vendor_id: string;
  brand_id: string;
  is_authorized_dealer: boolean;
  discount_percent: number;
  notes?: string;
  created_at: string;
  // Joined fields
  vendor?: Vendor;
  brand?: Brand;
}

export interface CreateVendorBrandInput {
  vendor_id: string;
  brand_id: string;
  is_authorized_dealer?: boolean;
  discount_percent?: number;
  notes?: string;
}

export interface UpdateVendorBrandInput {
  is_authorized_dealer?: boolean;
  discount_percent?: number;
  notes?: string;
}

export interface StockLocation {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  location_type: StockLocationType;
  project_id?: string;
  address?: string;
  city?: string;
  contact_person?: string;
  contact_phone?: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockLevel {
  id: string;
  tenant_id: string;
  cost_item_id: string;
  location_id: string;
  quantity: number;
  reserved_qty: number;
  available_qty: number;
  avg_cost: number;
  total_value: number;
  last_receipt_date?: string;
  last_issue_date?: string;
  updated_at: string;
  // Joined fields
  cost_item?: StockableItem;
  location?: StockLocation;
}

// ============================================================================
// Material (Stock Item) Interfaces
// ============================================================================

// Specifications structure for materials
export interface MaterialSpecifications {
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    thickness?: number;
    unit?: string;
  };
  weight?: {
    value?: number;
    unit?: string;
  };
  color?: string;
  finish?: string;
  grade?: string;
  material?: string;
  density?: string;
  custom_fields?: Array<{
    label: string;
    value: string;
  }>;
}

// Main Material interface
export interface Material {
  id: string;
  company_id: string;
  name: string;
  sku: string;
  description?: string | null;
  category?: string | null;
  item_type: StockItemType;
  unit_of_measure: string;
  current_quantity: number;
  minimum_quantity: number;
  reorder_quantity: number;
  unit_cost: number;
  selling_price?: number | null;
  preferred_vendor_id?: string | null;
  brand_id?: string | null;
  storage_location?: string | null;
  specifications?: MaterialSpecifications | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  preferred_vendor?: {
    id: string;
    name: string;
    code: string;
  } | null;
  brand?: {
    id: string;
    name: string;
    code: string;
    quality_tier: BrandQualityTier;
  } | null;
}

// Input types for Material CRUD
export interface CreateMaterialInput {
  name: string;
  sku: string;
  description?: string;
  category?: string;
  item_type: StockItemType;
  unit_of_measure: string;
  current_quantity?: number;
  minimum_quantity?: number;
  reorder_quantity?: number;
  unit_cost: number;
  selling_price?: number;
  preferred_vendor_id?: string;
  brand_id?: string;
  storage_location?: string;
  specifications?: MaterialSpecifications;
  notes?: string;
}

export interface UpdateMaterialInput {
  name?: string;
  sku?: string;
  description?: string;
  category?: string;
  item_type?: StockItemType;
  unit_of_measure?: string;
  current_quantity?: number;
  minimum_quantity?: number;
  reorder_quantity?: number;
  unit_cost?: number;
  selling_price?: number;
  preferred_vendor_id?: string | null;
  brand_id?: string | null;
  storage_location?: string;
  specifications?: MaterialSpecifications | null;
  notes?: string;
  is_active?: boolean;
}

// Vendor-Material pricing (for multi-vendor sourcing)
export interface VendorMaterial {
  id: string;
  tenant_id: string;
  vendor_id: string;
  material_id: string;
  vendor_sku?: string;
  vendor_item_name?: string;
  unit_price: number;
  currency: string;
  price_valid_from?: string;
  price_valid_to?: string;
  min_order_qty: number;
  lead_time_days: number;
  is_preferred: boolean;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  vendor?: Vendor;
  material?: Material;
}

export interface CreateVendorMaterialInput {
  vendor_id: string;
  material_id: string;
  vendor_sku?: string;
  vendor_item_name?: string;
  unit_price: number;
  currency?: string;
  price_valid_from?: string;
  price_valid_to?: string;
  min_order_qty?: number;
  lead_time_days?: number;
  is_preferred?: boolean;
  notes?: string;
}

export interface UpdateVendorMaterialInput {
  vendor_sku?: string;
  vendor_item_name?: string;
  unit_price?: number;
  currency?: string;
  price_valid_from?: string;
  price_valid_to?: string;
  min_order_qty?: number;
  lead_time_days?: number;
  is_preferred?: boolean;
  is_active?: boolean;
  notes?: string;
}

export interface StockableItem {
  id: string;
  tenant_id: string;
  category_id?: string;
  name: string;
  slug: string;
  description?: string;
  unit_code: string;
  default_rate: number;
  is_stockable: boolean;
  stock_type?: StockItemType;
  reorder_level: number;
  min_order_qty: number;
  lead_time_days: number;
  default_vendor_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  category?: { id: string; name: string };
  default_vendor?: Vendor;
}

export interface MaterialRequirement {
  id: string;
  tenant_id: string;
  mr_number: string;
  project_id?: string;
  quotation_id?: string;
  lead_id?: string;
  title?: string;
  description?: string;
  source?: string;
  required_date?: string;
  status: MaterialRequirementStatus;
  total_items: number;
  total_value: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  items?: MaterialRequirementItem[];
  quotation?: { id: string; quotation_number: string };
  lead?: { id: string; company_name: string };
}

export interface MaterialRequirementItem {
  id: string;
  mr_id: string;
  cost_item_id: string;
  quotation_line_item_id?: string;
  required_qty: number;
  unit_code: string;
  available_qty: number;
  to_order_qty: number;
  ordered_qty: number;
  received_qty: number;
  issued_qty: number;
  estimated_rate?: number;
  estimated_amount?: number;
  status: MRItemStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  cost_item?: StockableItem;
}

// Updated to match stock_purchase_orders table schema
export interface PurchaseOrder {
  id: string;
  tenant_id: string;
  po_number: string;
  vendor_id: string;
  mr_id?: string;
  order_date: string;
  expected_delivery?: string;
  status: POStatus;
  payment_status?: POPaymentStatus;
  amount_paid?: number;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  shipping_address?: string;
  billing_address?: string;
  payment_terms?: string;
  notes?: string;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  sent_at?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  vendor?: Vendor;
  items?: PurchaseOrderItem[];
}

// Updated to match stock_purchase_order_items table schema
export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  material_id: string;
  quantity: number;
  unit_price: number;
  tax_percent: number;
  discount_percent: number;
  total_amount: number;
  received_quantity: number;
  notes?: string;
  created_at: string;
  // Cost allocation fields (from Migration 031)
  project_id?: string;
  cost_type?: POCostType;
  cost_code?: string;
  // Joined fields
  material?: Material;
  project?: Project;
}

export interface GoodsReceipt {
  id: string;
  tenant_id: string;
  grn_number: string;
  po_id?: string;
  vendor_id: string;
  receipt_date: string;
  location_id: string;
  vendor_invoice_number?: string;
  vendor_invoice_date?: string;
  vendor_challan_number?: string;
  status: GRNStatus;
  subtotal: number;
  tax_amount: number;
  other_charges: number;
  grand_total: number;
  notes?: string;
  created_by?: string;
  confirmed_by?: string;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  vendor?: Vendor;
  purchase_order?: PurchaseOrder;
  location?: StockLocation;
  items?: GoodsReceiptItem[];
}

export interface GoodsReceiptItem {
  id: string;
  grn_id: string;
  po_item_id?: string;
  cost_item_id: string;
  ordered_qty?: number;
  received_qty: number;
  accepted_qty: number;
  rejected_qty: number;
  unit_code: string;
  unit_price: number;
  amount: number;
  rejection_reason?: string;
  batch_number?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  cost_item?: StockableItem;
}

export interface StockIssue {
  id: string;
  tenant_id: string;
  issue_number: string;
  project_id?: string;
  lead_id?: string;
  material_requirement_id?: string;
  from_location_id: string;
  to_location_id?: string;
  issue_date: string;
  issue_type: "project" | "transfer" | "return";
  status: "draft" | "confirmed" | "cancelled";
  purpose?: string;
  notes?: string;
  created_by?: string;
  confirmed_by?: string;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  from_location?: StockLocation;
  to_location?: StockLocation;
  items?: StockIssueItem[];
}

export interface StockIssueItem {
  id: string;
  issue_id: string;
  cost_item_id: string;
  mr_item_id?: string;
  quantity: number;
  unit_code: string;
  unit_cost: number;
  total_cost: number;
  notes?: string;
  created_at: string;
  // Joined fields
  cost_item?: StockableItem;
}

export interface StockMovement {
  id: string;
  tenant_id: string;
  cost_item_id: string;
  location_id: string;
  movement_type: StockMovementType;
  movement_date: string;
  quantity: number;
  unit_code: string;
  unit_cost?: number;
  total_cost?: number;
  balance_qty: number;
  balance_value?: number;
  reference_type?: string;
  reference_id?: string;
  reference_number?: string;
  project_id?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  // Joined fields
  cost_item?: StockableItem;
  location?: StockLocation;
}

export interface StockAdjustment {
  id: string;
  tenant_id: string;
  adjustment_number: string;
  adjustment_date: string;
  location_id: string;
  reason: "physical_count" | "damage" | "expiry" | "other";
  status: "draft" | "confirmed" | "cancelled";
  notes?: string;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  location?: StockLocation;
  items?: StockAdjustmentItem[];
}

export interface StockAdjustmentItem {
  id: string;
  adjustment_id: string;
  cost_item_id: string;
  system_qty: number;
  actual_qty: number;
  variance_qty: number;
  unit_code: string;
  unit_cost?: number;
  variance_value?: number;
  notes?: string;
  created_at: string;
  // Joined fields
  cost_item?: StockableItem;
}

export interface TenantStockSettings {
  id: string;
  tenant_id: string;
  po_requires_approval: boolean;
  po_approval_threshold: number;
  po_number_prefix: string;
  po_auto_number: boolean;
  grn_number_prefix: string;
  grn_auto_number: boolean;
  allow_over_receipt: boolean;
  over_receipt_tolerance: number;
  issue_number_prefix: string;
  issue_auto_number: boolean;
  mr_number_prefix: string;
  mr_auto_number: boolean;
  allow_negative_stock: boolean;
  stock_valuation_method: "avg_cost" | "fifo" | "lifo";
  default_warehouse_id?: string;
  default_tax_percent: number;
  updated_by?: string;
  updated_at: string;
}

// ============================================================================
// Summary/Dashboard Types
// ============================================================================

export interface StockSummary {
  cost_item_id: string;
  tenant_id: string;
  item_name: string;
  slug: string;
  category_name?: string;
  unit_code: string;
  default_rate: number;
  reorder_level: number;
  total_qty: number;
  reserved_qty: number;
  available_qty: number;
  total_value: number;
  stock_status: "out_of_stock" | "low_stock" | "in_stock";
}

export interface StockOverviewStats {
  totalItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalValue: number;
  pendingPOs: number;
  pendingApprovals: number;
  recentGRNs: number;
  pendingIssues: number;
}

// ============================================================================
// Input Types (for API calls)
// ============================================================================

export interface CreateVendorInput {
  code?: string;
  name: string;
  display_name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  alternate_phone?: string;
  website?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  gst_number?: string;
  pan_number?: string;
  payment_terms?: string;
  credit_days?: number;
  credit_limit?: number;
  category_ids?: string[];
  bank_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  rating?: number;
  notes?: string;
  is_preferred?: boolean;
}

export interface UpdateVendorInput extends Partial<CreateVendorInput> {
  is_active?: boolean;
  is_preferred?: boolean;
}

export interface CreateBrandInput {
  code?: string;
  name: string;
  display_name?: string;
  logo_url?: string;
  website?: string;
  country?: string;
  description?: string;
  categories?: string[];
  quality_tier?: BrandQualityTier;
  is_preferred?: boolean;
}

export interface UpdateBrandInput extends Partial<CreateBrandInput> {
  is_active?: boolean;
  is_preferred?: boolean;
}

export interface CreatePOInput {
  vendor_id: string;
  po_type?: "project" | "stock";
  project_id?: string;
  lead_id?: string;
  material_requirement_id?: string;
  po_date?: string;
  expected_date?: string;
  delivery_location_id?: string;
  delivery_address?: string;
  payment_terms?: string;
  notes?: string;
  terms_and_conditions?: string;
  discount_percent?: number;
  tax_percent?: number;
  other_charges?: number;
  items: CreatePOItemInput[];
}

export interface CreatePOItemInput {
  cost_item_id: string;
  mr_item_id?: string;
  description?: string;
  quantity: number;
  unit_code: string;
  unit_price: number;
  discount_percent?: number;
  tax_percent?: number;
  notes?: string;
}

export interface CreateGRNInput {
  po_id?: string;
  vendor_id: string;
  receipt_date?: string;
  location_id: string;
  vendor_invoice_number?: string;
  vendor_invoice_date?: string;
  vendor_challan_number?: string;
  notes?: string;
  items: CreateGRNItemInput[];
}

export interface CreateGRNItemInput {
  po_item_id?: string;
  cost_item_id: string;
  ordered_qty?: number;
  received_qty: number;
  accepted_qty: number;
  rejected_qty?: number;
  unit_code: string;
  unit_price: number;
  rejection_reason?: string;
  batch_number?: string;
}

export interface CreateStockIssueInput {
  project_id?: string;
  lead_id?: string;
  material_requirement_id?: string;
  from_location_id: string;
  to_location_id?: string;
  issue_date?: string;
  issue_type: "project" | "transfer" | "return";
  purpose?: string;
  notes?: string;
  items: CreateStockIssueItemInput[];
}

export interface CreateStockIssueItemInput {
  cost_item_id: string;
  mr_item_id?: string;
  quantity: number;
  unit_code: string;
  notes?: string;
}

export interface StockFilters {
  search?: string;
  category_id?: string;
  stock_type?: StockItemType;
  stock_status?: "out_of_stock" | "low_stock" | "in_stock";
  location_id?: string;
  is_active?: boolean;
}

export interface POFilters {
  search?: string;
  status?: POStatus | POStatus[];
  vendor_id?: string;
  project_id?: string;
  date_from?: string;
  date_to?: string;
  requires_approval?: boolean;
}

export interface VendorFilters {
  search?: string;
  is_active?: boolean;
  city?: string;
  category_id?: string;
  min_rating?: number;
}
