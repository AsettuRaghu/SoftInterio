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

export type OwnershipType =
  | "owned"
  | "rented"
  | "leased"
  | "family_owned"
  | "under_construction"
  | "other";

export type PropertyStatus =
  | "under_construction"
  | "ready_to_move"
  | "occupied"
  | "vacant"
  | "renovation_in_progress";

export type FacingDirection =
  | "north"
  | "south"
  | "east"
  | "west"
  | "north_east"
  | "north_west"
  | "south_east"
  | "south_west";

export type AreaUnit = "sqft" | "sqm" | "sqyd";

export type FurnishingStatus = "unfurnished" | "semi_furnished" | "fully_furnished";

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

export const OwnershipTypeLabels: Record<OwnershipType, string> = {
  owned: "Self Owned",
  rented: "Rented",
  leased: "Leased",
  family_owned: "Family Owned",
  under_construction: "Under Construction",
  other: "Other",
};

export const PropertyStatusLabels: Record<PropertyStatus, string> = {
  under_construction: "Under Construction",
  ready_to_move: "Ready to Move",
  occupied: "Occupied",
  vacant: "Vacant",
  renovation_in_progress: "Renovation in Progress",
};

export const FacingDirectionLabels: Record<FacingDirection, string> = {
  north: "North",
  south: "South",
  east: "East",
  west: "West",
  north_east: "North-East",
  north_west: "North-West",
  south_east: "South-East",
  south_west: "South-West",
};

export const AreaUnitLabels: Record<AreaUnit, string> = {
  sqft: "Sq. Ft.",
  sqm: "Sq. M.",
  sqyd: "Sq. Yd.",
};

export const FurnishingStatusLabels: Record<FurnishingStatus, string> = {
  unfurnished: "Unfurnished",
  semi_furnished: "Semi-Furnished",
  fully_furnished: "Fully Furnished",
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
  block_tower: string | null;

  // Property Classification
  category: PropertyCategory;
  property_type: PropertyTypeV2;
  property_subtype: PropertySubtype | null;
  ownership: OwnershipType | null;
  status: PropertyStatus | null;

  // Area Details
  carpet_area: number | null;
  built_up_area: number | null;
  super_built_up_area: number | null;
  area_unit: AreaUnit;
  plot_area: number | null;

  // Room Configuration
  bedrooms: number;
  bathrooms: number;
  balconies: number;
  kitchens: number;
  living_rooms: number;
  dining_rooms: number;
  study_rooms: number;
  servant_rooms: number;
  pooja_rooms: number;
  store_rooms: number;

  // Floor Details
  floor_number: number | null;
  total_floors: number | null;

  // Property Features
  facing: FacingDirection | null;
  furnishing_status: FurnishingStatus | null;
  age_of_property: number | null;

  // Address
  address_line1: string | null;
  address_line2: string | null;
  landmark: string | null;
  locality: string | null;
  city: string;
  state: string | null;
  pincode: string | null;
  country: string;

  // Geo Location
  latitude: number | null;
  longitude: number | null;

  // Additional Details
  parking_slots: number;
  has_lift: boolean;
  has_power_backup: boolean;
  has_security: boolean;
  has_gym: boolean;
  has_swimming_pool: boolean;
  has_clubhouse: boolean;
  amenities: string[];

  // Notes
  description: string | null;
  internal_notes: string | null;

  // Metadata
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Property with computed fields (from view)
// =====================================================

export interface PropertyDetails extends Property {
  formatted_address: string;
  bhk_label: string | null;
  total_rooms: number;
  created_by_name: string | null;
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
  block_tower?: string;

  // Optional - Classification
  category?: PropertyCategory;
  property_type?: PropertyTypeV2;
  property_subtype?: PropertySubtype;
  ownership?: OwnershipType;
  status?: PropertyStatus;

  // Optional - Area
  carpet_area?: number;
  built_up_area?: number;
  super_built_up_area?: number;
  area_unit?: AreaUnit;
  plot_area?: number;

  // Optional - Rooms
  bedrooms?: number;
  bathrooms?: number;
  balconies?: number;
  kitchens?: number;
  living_rooms?: number;
  dining_rooms?: number;
  study_rooms?: number;
  servant_rooms?: number;
  pooja_rooms?: number;
  store_rooms?: number;

  // Optional - Floor
  floor_number?: number;
  total_floors?: number;

  // Optional - Features
  facing?: FacingDirection;
  furnishing_status?: FurnishingStatus;
  age_of_property?: number;

  // Optional - Address
  address_line1?: string;
  address_line2?: string;
  landmark?: string;
  locality?: string;
  state?: string;
  pincode?: string;
  country?: string;

  // Optional - Location
  latitude?: number;
  longitude?: number;

  // Optional - Amenities
  parking_slots?: number;
  has_lift?: boolean;
  has_power_backup?: boolean;
  has_security?: boolean;
  has_gym?: boolean;
  has_swimming_pool?: boolean;
  has_clubhouse?: boolean;
  amenities?: string[];

  // Optional - Notes
  description?: string;
  internal_notes?: string;
}

export type UpdatePropertyInput = Partial<CreatePropertyInput>;

// =====================================================
// Utility Functions
// =====================================================

/**
 * Format BHK label for a property
 */
export function formatBHKLabel(property: Property): string {
  if (property.category === "commercial") {
    return PropertyTypeLabelsV2[property.property_type];
  }
  if (property.bedrooms === 0) {
    return "Studio";
  }
  return `${property.bedrooms} BHK`;
}

/**
 * Format area with unit
 */
export function formatArea(area: number | null, unit: AreaUnit = "sqft"): string {
  if (!area) return "-";
  return `${area.toLocaleString()} ${AreaUnitLabels[unit]}`;
}

/**
 * Get full formatted address
 */
export function formatPropertyAddress(property: Property): string {
  const parts = [
    property.unit_number,
    property.block_tower,
    property.property_name,
    property.address_line1,
    property.locality,
    property.city,
    property.state,
    property.pincode,
  ].filter(Boolean);

  return parts.join(", ");
}

/**
 * Calculate total room count
 */
export function getTotalRooms(property: Property): number {
  return (
    property.bedrooms +
    property.bathrooms +
    property.living_rooms +
    property.dining_rooms +
    property.kitchens +
    property.study_rooms +
    property.servant_rooms +
    property.pooja_rooms +
    property.store_rooms
  );
}
