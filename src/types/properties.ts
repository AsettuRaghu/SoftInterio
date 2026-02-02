// =====================================================
// Property Module Types
// =====================================================

// Enums matching database
export type PropertyCategory = "residential" | "commercial";

export type PropertyTypeV2 =
  // Residential
  | "apartment"
  | "villa"
  | "independent_house"
  | "penthouse"
  | "duplex"
  | "row_house"
  | "farmhouse"
  // Commercial
  | "office"
  | "retail_shop"
  | "showroom"
  | "restaurant_cafe"
  | "clinic_hospital"
  | "hotel"
  | "warehouse"
  | "co_working"
  | "other";

export type PropertySubtype =
  | "gated_community"
  | "non_gated"
  | "standalone"
  | "mall"
  | "commercial_complex"
  | "it_park"
  | "industrial_area"
  | "other";

// =====================================================
// Display Labels
// =====================================================

export const PropertyCategoryLabels: Record<PropertyCategory, string> = {
  residential: "Residential",
  commercial: "Commercial",
};

export const PropertyTypeLabelsV2: Record<PropertyTypeV2, string> = {
  // Residential
  apartment: "Apartment",
  villa: "Villa",
  independent_house: "Independent House",
  penthouse: "Penthouse",
  duplex: "Duplex",
  row_house: "Row House",
  farmhouse: "Farmhouse",
  // Commercial
  office: "Office Space",
  retail_shop: "Retail Shop",
  showroom: "Showroom",
  restaurant_cafe: "Restaurant / Cafe",
  clinic_hospital: "Clinic / Hospital",
  hotel: "Hotel",
  warehouse: "Warehouse",
  co_working: "Co-working Space",
  other: "Other",
};

export const PropertySubtypeLabels: Record<PropertySubtype, string> = {
  gated_community: "Gated Community",
  non_gated: "Non-Gated",
  standalone: "Standalone Building",
  mall: "Mall",
  commercial_complex: "Commercial Complex",
  it_park: "IT Park",
  industrial_area: "Industrial Area",
  other: "Other",
};

// =====================================================
// Property Type to Category Mapping
// =====================================================

export const PropertyTypeCategory: Record<PropertyTypeV2, PropertyCategory> = {
  apartment: "residential",
  villa: "residential",
  independent_house: "residential",
  penthouse: "residential",
  duplex: "residential",
  row_house: "residential",
  farmhouse: "residential",
  office: "commercial",
  retail_shop: "commercial",
  showroom: "commercial",
  restaurant_cafe: "commercial",
  clinic_hospital: "commercial",
  hotel: "commercial",
  warehouse: "commercial",
  co_working: "commercial",
  other: "commercial",
};

// Get property types by category
export const ResidentialPropertyTypes: PropertyTypeV2[] = [
  "apartment",
  "villa",
  "independent_house",
  "penthouse",
  "duplex",
  "row_house",
  "farmhouse",
];

export const CommercialPropertyTypes: PropertyTypeV2[] = [
  "office",
  "retail_shop",
  "showroom",
  "restaurant_cafe",
  "clinic_hospital",
  "hotel",
  "warehouse",
  "co_working",
  "other",
];

// =====================================================
// Main Property Interface
// =====================================================

export interface Property {
  id: string;
  tenant_id: string;

  // Property Identification
  property_name: string | null;
  unit_number: string | null;

  // Property Classification
  category: PropertyCategory;
  property_type: PropertyTypeV2;
  property_subtype: PropertySubtype | null;

  // Area Details
  carpet_area: number | null;

  // Address
  address_line1: string | null;
  city: string;
  pincode: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
}

// =====================================================
// Property with computed fields (from view)
// =====================================================

export interface PropertyDetails extends Property {
  formatted_address: string;
  bhk_label: string | null;
}

// =====================================================
// Create/Update DTOs
// =====================================================

export interface CreatePropertyInput {
  // Required
  city: string;

  // Optional - Identification
  property_name?: string;
  unit_number?: string;

  // Optional - Classification
  category?: PropertyCategory;
  property_type?: PropertyTypeV2;
  property_subtype?: PropertySubtype;

  // Optional - Area
  carpet_area?: number;

  // Optional - Address
  address_line1?: string;
  pincode?: string;
}

export type UpdatePropertyInput = Partial<CreatePropertyInput>;

// =====================================================
// Utility Functions
// =====================================================

/**
 * Format BHK label for a property
 * Note: Room counts removed in simplification - returns property type for commercial
 */
export function formatBHKLabel(property: Property): string {
  if (property.category === "commercial") {
    return PropertyTypeLabelsV2[property.property_type];
  }
  return PropertyTypeLabelsV2[property.property_type];
}

/**
 * Format area in sqft (unit always sqft - no longer configurable)
 */
export function formatArea(area: number | null): string {
  if (!area) return "-";
  return `${area.toLocaleString()} Sq. Ft.`;
}

/**
 * Get full formatted address
 */
export function formatPropertyAddress(property: Property): string {
  const parts = [
    property.unit_number,
    property.property_name,
    property.address_line1,
    property.city,
    property.pincode,
  ].filter(Boolean);

  return parts.join(", ");
}

/**
 * Calculate total room count
 * @deprecated Removed - property no longer tracks room details
 */
export function getTotalRooms(property: Property): number {
  return 0;
}
