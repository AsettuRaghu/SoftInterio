// Shared types for quotation builder components
// Re-export core types from main types file
export type {
  Unit,
  SpaceType,
  ComponentType,
  QuotationCostItemCategory,
  QuotationCostItem,
  CostItemCategory,
  CostItem,
} from "@/types/quotations";

// ============================================================================
// MEASUREMENT UTILITIES (UI-specific)
// ============================================================================

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

// ============================================================================
// BUILDER-SPECIFIC TYPES (UI State)
// ============================================================================

// Import needed types for builder interfaces
import type { QuotationCostItemCategory, QuotationCostItem, SpaceType, ComponentType, Unit } from "@/types/quotations";

export interface LineItem {
  id: string;
  costItemId: string;
  costItemName: string;
  categoryName: string;
  categoryColor: string;
  unitCode: string;
  rate: number;
  defaultRate: number;
  companyCost: number;
  vendorCost: number;
  length?: number | null;
  width?: number | null;
  measurementUnit?: MeasurementUnit;
  quantity?: number;
  amount?: number;
  notes?: string;
}

export interface BuilderComponent {
  id: string;
  componentTypeId: string;
  name: string;
  customName?: string;
  description?: string;
  lineItems: LineItem[];
  expanded: boolean;
}

export interface BuilderSpace {
  id: string;
  spaceTypeId: string;
  templateSpaceId?: string;
  name: string;
  defaultName: string;
  components: BuilderComponent[];
  expanded: boolean;
}

export interface MasterData {
  units: Unit[];
  space_types: SpaceType[];
  component_types: ComponentType[];
  quotation_cost_item_categories: QuotationCostItemCategory[];
  quotation_cost_items: QuotationCostItem[];
  // Legacy aliases for backward compatibility
  cost_item_categories?: QuotationCostItemCategory[];
  cost_items?: QuotationCostItem[];
  items_by_category?: Record<string, QuotationCostItem[]>;
}

// ============================================================================
// UI UTILITY CONSTANTS
// ============================================================================

export const UNIT_MEASUREMENT_INFO: Record<
  string,
  { type: string; label: string; color: string }
> = {
  sqft: { type: "area", label: "L×W", color: "bg-blue-100 text-blue-700" },
  rft: { type: "length", label: "Length", color: "bg-green-100 text-green-700" },
  nos: { type: "quantity", label: "Qty", color: "bg-purple-100 text-purple-700" },
  set: { type: "quantity", label: "Qty", color: "bg-purple-100 text-purple-700" },
  lot: { type: "fixed", label: "Fixed", color: "bg-gray-100 text-gray-700" },
  lumpsum: { type: "fixed", label: "Fixed", color: "bg-gray-100 text-gray-700" },
  kg: { type: "quantity", label: "Qty", color: "bg-purple-100 text-purple-700" },
  ltr: { type: "quantity", label: "Qty", color: "bg-purple-100 text-purple-700" },
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
