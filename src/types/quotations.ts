/**
 * Quotation Module Types V2
 * Flexible Hierarchical Costing Structure:
 * Space (optional) > Component (optional) > Variant (optional) > Cost Item (required)
 */

// ============================================================================
// ENUMS
// ============================================================================

export type QuotationStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "negotiating"
  | "approved"
  | "rejected"
  | "expired";

export type QualityTier = "budget" | "standard" | "premium" | "luxury";

export type DiscountType = "percentage" | "fixed";

export type PropertyType =
  | "1bhk"
  | "2bhk"
  | "3bhk"
  | "4bhk"
  | "villa"
  | "penthouse"
  | "commercial"
  | "retail"
  | "office";

export type CalculationType = "area" | "length" | "quantity" | "fixed";

export type PresentationLevel =
  | "space_only"
  | "space_component"
  | "space_component_type"
  | "full_detail";

// ============================================================================
// UNIT TYPE
// ============================================================================

/**
 * Unit of measurement
 */
export interface Unit {
  code: string; // "sqft", "nos", "rft", "job"
  name: string; // "Square Feet", "Numbers"
  calculation_type: CalculationType;
  description?: string;
  display_order: number;
  is_active: boolean;
}

// ============================================================================
// MASTER DATA / LIBRARY TYPES
// ============================================================================

/**
 * Space Type (Generic - user names instances in quotation)
 * Examples: Bedroom, Kitchen, Bathroom, Balcony
 */
export interface SpaceType {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  display_order: number;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Component Type (What gets built)
 * Examples: Wardrobe, TV Unit, Modular Kitchen, False Ceiling
 */
export interface ComponentType {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  default_width?: number;
  default_height?: number;
  default_depth?: number;
  applicable_space_types?: string[];
  config_schema?: Record<string, unknown>;
  display_order: number;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  variants?: ComponentVariant[];
}

/**
 * Component Variant (Optional - Types/Variants of components)
 * Examples: Sliding, Openable, L-Shape, U-Shape
 */
export interface ComponentVariant {
  id: string;
  tenant_id: string;
  component_type_id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  display_order: number;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  component_type?: ComponentType;
}

/**
 * Cost Item Category
 * Examples: Material, Hardware, Finish, Labour, Service
 */
export interface CostItemCategory {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  display_order: number;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Cost Item (Anything with a price)
 * Examples: HDHMR PreLam, German Hinges, PU Finish, Carpentry Labour
 */
export interface CostItem {
  id: string;
  tenant_id: string;
  category_id?: string;
  name: string;
  slug: string;
  description?: string;
  unit_code: string; // "sqft", "nos", "job"
  default_rate: number;
  specifications?: Record<string, unknown>;
  quality_tier: QualityTier;
  display_order: number;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  category?: CostItemCategory;
  unit?: Unit;
}

// ============================================================================
// LEGACY TYPES (for backward compatibility)
// ============================================================================

/** @deprecated Use CostItemCategory instead */
export type MaterialCategory = CostItemCategory;

/** @deprecated Use CostItem instead */
export interface Material {
  id: string;
  tenant_id: string;
  category_id?: string;
  name: string;
  code?: string;
  description?: string;
  specifications?: Record<string, unknown>;
  unit: string;
  base_rate: number;
  labour_rate: number;
  wastage_percent: number;
  alternatives?: string[];
  quality_tier: QualityTier;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: MaterialCategory;
}

/** @deprecated Use ComponentVariant instead */
export interface CostAttributeType {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description?: string;
  data_type: string;
  unit?: string;
  is_calculated: boolean;
  calculation_formula?: string;
  applicable_categories?: string[];
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

/**
 * Quotation Template
 */
export interface QuotationTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  property_type?: PropertyType;
  quality_tier: QualityTier;
  base_price?: number;
  template_data: Record<string, unknown>; // Legacy JSONB field
  is_active: boolean;
  is_featured: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined data (V2)
  spaces?: TemplateSpace[];
  line_items?: TemplateLineItem[];
}

/**
 * Template Space (Pre-defined space instance in template)
 */
export interface TemplateSpace {
  id: string;
  template_id: string;
  space_type_id: string;
  default_name?: string; // "Master Bedroom", "Bedroom 2", or NULL for space_type name
  display_order: number;
  created_at: string;
  updated_at: string;
  // Joined data
  space_type?: SpaceType;
}

/**
 * Template Line Item (Cost item with optional hierarchy context)
 */
export interface TemplateLineItem {
  id: string;
  template_id: string;
  space_type_id?: string; // Optional - for organization
  component_type_id?: string; // Optional - for organization
  component_variant_id?: string; // Optional - for organization
  cost_item_id: string; // Required - the actual cost item
  group_name?: string; // "Carcass", "Shutter", "Hardware" (for display grouping)
  rate?: number; // Override cost_item default_rate, NULL = use default
  display_order: number;
  notes?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Joined data
  space_type?: SpaceType;
  component_type?: ComponentType;
  component_variant?: ComponentVariant;
  cost_item?: CostItem;
}

// ============================================================================
// QUOTATION TYPES (Main Data)
// ============================================================================

/**
 * Payment Term
 */
export interface PaymentTerm {
  milestone: string;
  percent: number;
  description?: string;
}

/**
 * Quotation (Main Header)
 */
export interface Quotation {
  id: string;
  tenant_id: string;
  quotation_number: string;
  version: number;
  parent_quotation_id?: string;

  // Linked entities
  lead_id?: string;
  client_id?: string;
  project_id?: string;

  // Client details (snapshot)
  client_name?: string;
  client_email?: string;
  client_phone?: string;

  // Property details
  property_name?: string;
  property_address?: string;
  property_type?: PropertyType;
  carpet_area?: number;
  flat_number?: string;

  // Lead details (from quotations_with_lead view)
  lead_number?: string;
  lead_stage?: string;

  // Quotation details
  title?: string;
  description?: string;
  status: QuotationStatus;

  // Presentation
  presentation_level: PresentationLevel;
  hide_dimensions: boolean;

  // Validity
  valid_from?: string;
  valid_until?: string;

  // Pricing
  subtotal: number;
  discount_type?: DiscountType;
  discount_value: number;
  discount_amount: number;
  taxable_amount: number;
  tax_percent: number;
  tax_amount: number;
  overhead_percent: number;
  overhead_amount: number;
  grand_total: number;

  // Terms
  payment_terms?: PaymentTerm[];
  terms_and_conditions?: string;
  notes?: string;

  // Tracking
  sent_at?: string;
  viewed_at?: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_reason?: string;

  // Metadata
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;

  // Joined data
  spaces?: QuotationSpace[];
  line_items?: QuotationLineItem[];
  lead?: { id: string; lead_number: string; client_name: string };
  created_user?: { id: string; name: string };
}

/**
 * Quotation Space (Named instance of a space type)
 */
export interface QuotationSpace {
  id: string;
  quotation_id: string;
  space_type_id?: string;
  name: string; // Custom name: "Master Bedroom", "Kids Bedroom"
  description?: string;
  display_order: number;
  subtotal: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;

  // Joined data
  space_type?: SpaceType;
  components?: QuotationComponent[];
  line_items?: QuotationLineItem[]; // Direct line items under space
}

/**
 * Quotation Component (Instance of a component in a space)
 */
export interface QuotationComponent {
  id: string;
  quotation_id: string;
  space_id: string;
  component_type_id?: string;
  component_variant_id?: string; // New in V2
  name: string;
  description?: string;
  width?: number;
  height?: number;
  depth?: number;
  configuration?: Record<string, unknown>;
  display_order: number;
  subtotal: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;

  // Joined data
  component_type?: ComponentType;
  component_variant?: ComponentVariant;
  line_items?: QuotationLineItem[]; // Line items under this component
  // Legacy
  materials?: QuotationMaterial[];
}

/**
 * Quotation Line Item (V2 - Simplified single table for all cost items)
 */
export interface QuotationLineItem {
  id: string;
  quotation_id: string;
  quotation_space_id?: string;
  quotation_component_id?: string;
  cost_item_id?: string;

  // Display
  name: string;
  group_name?: string; // "Carcass", "Shutter", "Hardware"

  // Measurements (based on unit type)
  length?: number; // For area or length calculations
  width?: number; // For area calculations
  quantity?: number; // For quantity-based items

  // Pricing
  unit_code: string; // "sqft", "nos", "job"
  rate: number;
  amount: number; // Calculated: (L×W) or Qty × Rate

  display_order: number;
  notes?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;

  // Joined data
  cost_item?: CostItem;
  unit?: Unit;
}

// ============================================================================
// LEGACY QUOTATION TYPES (for backward compatibility)
// ============================================================================

/** @deprecated Use QuotationLineItem instead */
export interface QuotationMaterial {
  id: string;
  quotation_id: string;
  component_id: string;
  material_id?: string;
  category_id?: string;
  name: string;
  category_name?: string;
  specifications?: Record<string, unknown>;
  display_order: number;
  subtotal: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  material?: Material;
  category?: MaterialCategory;
  cost_attributes?: QuotationCostAttribute[];
}

/** @deprecated Use QuotationLineItem instead */
export interface QuotationCostAttribute {
  id: string;
  quotation_id: string;
  material_id: string;
  attribute_type_id?: string;
  name: string;
  quantity: number;
  unit?: string;
  rate: number;
  amount: number;
  is_auto_calculated: boolean;
  calculation_source?: string;
  display_order: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  attribute_type?: CostAttributeType;
}

// ============================================================================
// VERSION HISTORY TYPES
// ============================================================================

export interface QuotationSnapshot {
  id: string;
  quotation_id: string;
  version: number;
  snapshot_data: Quotation;
  change_summary?: string;
  changed_by?: string;
  created_at: string;
}

export interface QuotationChange {
  id: string;
  quotation_id: string;
  entity_type:
    | "space"
    | "component"
    | "material"
    | "cost_attribute"
    | "line_item";
  entity_id: string;
  change_type: "create" | "update" | "delete";
  field_name?: string;
  old_value?: unknown;
  new_value?: unknown;
  changed_by?: string;
  created_at: string;
}

// ============================================================================
// TEMPLATE DATA TYPES (for JSONB compatibility)
// ============================================================================

export interface QuotationTemplateData {
  spaces: SpaceTemplateData[];
  discount_type?: DiscountType;
  discount_value?: number;
  tax_percent?: number;
  overhead_percent?: number;
  payment_terms?: PaymentTerm[];
  terms_and_conditions?: string;
}

export interface SpaceTemplateData {
  space_type_id?: string;
  name: string;
  description?: string;
  components: ComponentTemplateData[];
}

export interface ComponentTemplateData {
  component_type_id?: string;
  component_variant_id?: string;
  name: string;
  description?: string;
  width?: number;
  height?: number;
  depth?: number;
  configuration?: Record<string, unknown>;
  line_items: LineItemTemplateData[];
  // Legacy
  materials?: MaterialTemplateData[];
}

export interface LineItemTemplateData {
  cost_item_id?: string;
  name: string;
  group_name?: string;
  unit_code: string;
  rate?: number;
}

/** @deprecated Use LineItemTemplateData instead */
export interface MaterialTemplateData {
  material_id?: string;
  category_id?: string;
  name: string;
  category_name?: string;
  specifications?: Record<string, unknown>;
  cost_attributes: CostAttributeTemplateData[];
}

/** @deprecated Use LineItemTemplateData instead */
export interface CostAttributeTemplateData {
  attribute_type_id?: string;
  name: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  is_auto_calculated?: boolean;
  calculation_source?: string;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

/**
 * Quotation Builder State
 */
export interface QuotationBuilderState {
  quotation: Quotation | null;
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  errors: Record<string, string>;
  expandedSpaces: Set<string>;
  expandedComponents: Set<string>;
  selectedItem: {
    type: "space" | "component" | "line_item" | null;
    id: string | null;
  };
}

/**
 * Form data for creating/editing quotation
 */
export interface QuotationFormData {
  lead_id?: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  property_name?: string;
  property_address?: string;
  property_type?: PropertyType;
  carpet_area?: number;
  title?: string;
  description?: string;
  valid_until?: string;
  discount_type?: DiscountType;
  discount_value?: number;
  tax_percent?: number;
  overhead_percent?: number;
  payment_terms?: PaymentTerm[];
  terms_and_conditions?: string;
  notes?: string;
  presentation_level?: PresentationLevel;
  hide_dimensions?: boolean;
}

export interface SpaceFormData {
  space_type_id?: string;
  name: string; // Custom name for the space instance
  description?: string;
}

export interface ComponentFormData {
  component_type_id?: string;
  component_variant_id?: string;
  name: string;
  description?: string;
  width?: number;
  height?: number;
  depth?: number;
  configuration?: Record<string, unknown>;
}

export interface LineItemFormData {
  cost_item_id?: string;
  name: string;
  group_name?: string;
  length?: number;
  width?: number;
  quantity?: number;
  unit_code: string;
  rate: number;
}

/** @deprecated Use LineItemFormData instead */
export interface MaterialFormData {
  material_id?: string;
  category_id?: string;
  name: string;
  category_name?: string;
  specifications?: Record<string, unknown>;
}

/** @deprecated Use LineItemFormData instead */
export interface CostAttributeFormData {
  attribute_type_id?: string;
  name: string;
  quantity: number;
  unit?: string;
  rate: number;
  is_auto_calculated?: boolean;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface CreateQuotationRequest {
  lead_id?: string;
  template_id?: string;
  form_data: QuotationFormData;
}

export interface CreateQuotationResponse {
  success: boolean;
  quotation?: Quotation;
  error?: string;
}

export interface UpdateQuotationRequest {
  form_data: Partial<QuotationFormData>;
}

export interface QuotationListFilters {
  status?: QuotationStatus | QuotationStatus[];
  lead_id?: string;
  client_name?: string;
  date_from?: string;
  date_to?: string;
  min_amount?: number;
  max_amount?: number;
  search?: string;
}

export interface QuotationListResponse {
  success: boolean;
  quotations: Quotation[];
  total: number;
  page: number;
  limit: number;
}

// Master Data API Types
export interface MasterDataResponse {
  success: boolean;
  data: {
    units: Unit[];
    space_types: SpaceType[];
    component_types: ComponentType[];
    component_variants: ComponentVariant[];
    cost_item_categories: CostItemCategory[];
    cost_items: CostItem[];
  };
}

// ============================================================================
// LABELS AND DISPLAY HELPERS
// ============================================================================

export const QuotationStatusLabels: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  negotiating: "Negotiating",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
};

export const QuotationStatusColors: Record<
  QuotationStatus,
  { bg: string; text: string; dot: string }
> = {
  draft: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    dot: "bg-slate-500",
  },
  sent: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  viewed: {
    bg: "bg-cyan-100",
    text: "text-cyan-700",
    dot: "bg-cyan-500",
  },
  negotiating: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  approved: {
    bg: "bg-green-100",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  rejected: {
    bg: "bg-red-100",
    text: "text-red-700",
    dot: "bg-red-500",
  },
  expired: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    dot: "bg-gray-500",
  },
};

export const QualityTierLabels: Record<QualityTier, string> = {
  budget: "Budget",
  standard: "Standard",
  premium: "Premium",
  luxury: "Luxury",
};

export const PropertyTypeLabels: Record<PropertyType, string> = {
  "1bhk": "1 BHK",
  "2bhk": "2 BHK",
  "3bhk": "3 BHK",
  "4bhk": "4 BHK",
  villa: "Villa",
  penthouse: "Penthouse",
  commercial: "Commercial",
  retail: "Retail",
  office: "Office",
};

export const PresentationLevelLabels: Record<PresentationLevel, string> = {
  space_only: "Space Level Only",
  space_component: "Space + Component",
  space_component_type: "Space + Component + Type",
  full_detail: "Full Detail (Internal)",
};

export const CalculationTypeLabels: Record<CalculationType, string> = {
  area: "Area (L × W)",
  length: "Length",
  quantity: "Quantity",
  fixed: "Fixed/Lump Sum",
};
