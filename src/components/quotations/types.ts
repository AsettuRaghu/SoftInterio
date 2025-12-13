// Shared types for quotation builder components

export interface Unit {
  id: string;
  code: string;
  name: string;
  calculation_type: string;
}

export interface CostItemCategory {
  id: string;
  name: string;
  slug: string;
  color?: string;
}

export interface CostItem {
  id: string;
  name: string;
  slug: string;
  category_id?: string;
  unit_code: string;
  default_rate: number;
  quality_tier?: string;
  category?: CostItemCategory;
}

export interface ComponentType {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface ComponentVariant {
  id: string;
  name: string;
  slug: string;
  component_type_id: string;
}

export interface SpaceType {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

// Measurement unit options for dimension input
export type MeasurementUnit = "mm" | "cm" | "inch" | "ft";

export const MEASUREMENT_UNITS: Array<{
  value: MeasurementUnit;
  label: string;
  toFeet: number;
}> = [
  { value: "mm", label: "mm", toFeet: 0.00328084 },
  { value: "cm", label: "cm", toFeet: 0.0328084 },
  { value: "inch", label: "inch", toFeet: 0.0833333 },
  { value: "ft", label: "ft", toFeet: 1 },
];

// Convert from any unit to feet
export const convertToFeet = (value: number, unit: MeasurementUnit): number => {
  const unitInfo = MEASUREMENT_UNITS.find((u) => u.value === unit);
  return value * (unitInfo?.toFeet || 1);
};

// Calculate sqft from length and width (using the same unit for both)
export const calculateSqft = (
  length: number | null | undefined,
  width: number | null | undefined,
  unit: MeasurementUnit = "ft"
): number => {
  const lengthInFeet = convertToFeet(length || 0, unit);
  const widthInFeet = convertToFeet(width || 0, unit);
  return lengthInFeet * widthInFeet;
};

// Builder-specific types
export interface LineItem {
  id: string;
  costItemId: string;
  costItemName: string;
  categoryName: string;
  categoryColor: string;
  unitCode: string;
  rate: number;
  defaultRate: number;
  groupName: string;
  // Quotation-specific fields (not in templates)
  length?: number | null;
  width?: number | null;
  measurementUnit?: MeasurementUnit; // Single unit for both L and W
  quantity?: number;
  amount?: number;
  notes?: string;
}

export interface BuilderComponent {
  id: string;
  componentTypeId: string;
  variantId?: string;
  name: string;
  customName?: string; // User-editable name (like "TV Unit" instead of just "Wardrobe")
  variantName?: string;
  description?: string;
  lineItems: LineItem[];
  expanded: boolean;
}

export interface BuilderSpace {
  id: string;
  spaceTypeId: string;
  name: string;
  defaultName: string;
  components: BuilderComponent[];
  expanded: boolean;
}

export interface MasterData {
  units: Unit[];
  space_types: SpaceType[];
  component_types: ComponentType[];
  component_variants: ComponentVariant[];
  cost_item_categories: CostItemCategory[];
  cost_items: CostItem[];
  variants_by_component?: Record<string, ComponentVariant[]>;
  items_by_category?: Record<string, CostItem[]>;
}

// Utility constants
export const GROUP_NAMES = [
  "Carcass",
  "Shutter",
  "Hardware",
  "Finish",
  "Labour",
  "Accessories",
  "Other",
];

export const UNIT_MEASUREMENT_INFO: Record<
  string,
  { type: string; label: string; color: string }
> = {
  sqft: { type: "area", label: "L×W", color: "bg-blue-100 text-blue-700" },
  rft: {
    type: "length",
    label: "Length",
    color: "bg-green-100 text-green-700",
  },
  nos: {
    type: "quantity",
    label: "Qty",
    color: "bg-purple-100 text-purple-700",
  },
  set: {
    type: "quantity",
    label: "Qty",
    color: "bg-purple-100 text-purple-700",
  },
  lot: { type: "fixed", label: "Fixed", color: "bg-gray-100 text-gray-700" },
  lumpsum: {
    type: "fixed",
    label: "Fixed",
    color: "bg-gray-100 text-gray-700",
  },
  kg: {
    type: "quantity",
    label: "Qty",
    color: "bg-purple-100 text-purple-700",
  },
  ltr: {
    type: "quantity",
    label: "Qty",
    color: "bg-purple-100 text-purple-700",
  },
};

export const getMeasurementInfo = (unitCode: string) => {
  return (
    UNIT_MEASUREMENT_INFO[unitCode?.toLowerCase()] || {
      type: "quantity",
      label: "Qty",
      color: "bg-gray-100 text-gray-600",
    }
  );
};

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};
