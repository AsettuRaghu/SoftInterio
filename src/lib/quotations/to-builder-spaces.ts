/**
 * One mapping from the quotation API's rows to what the builder renders.
 *
 * `GET /api/quotations/[id]` returns spaces, components and line items in the
 * database's own shape. The builder turned that into `BuilderSpace[]` inline,
 * and the summary page - reading the identical response from the identical
 * endpoint - built its own tree of markup against the raw rows instead.
 *
 * So one quotation had two renderings and two readings of the same payload,
 * and only one of them knew things like: the measurement unit lives in
 * `metadata.measurement_unit`, the rate on the line is what the client pays
 * while `cost_item.default_rate` is only a suggestion, and a line without
 * `metadata.follows_component` keeps its own dimensions rather than adopting
 * the component's. Every one of those is a way the two could quietly disagree
 * about the same money.
 *
 * Both pages now map here and render `SpaceCard`, which is what makes an
 * approved quotation readable on the screen it was built on.
 */

import type { BuilderSpace, MeasurementUnit } from "@/components/quotations/types";

/** The API's rows, which are the database's shape and not the builder's. */
interface ApiLineItem {
  id: string;
  cost_item_id?: string;
  name?: string;
  unit_code?: string;
  rate?: number;
  length?: number | null;
  width?: number | null;
  measurement_unit?: string;
  quantity?: number;
  amount?: number;
  notes?: string;
  metadata?: { follows_component?: boolean } | null;
  cost_item?: {
    name?: string;
    default_rate?: number;
    company_cost?: number;
    vendor_cost?: number;
    category?: { name?: string; color?: string };
  } | null;
}

interface ApiComponent {
  id: string;
  component_type_id?: string;
  name?: string;
  description?: string;
  width?: number | null;
  height?: number | null;
  metadata?: { measurement_unit?: string } | null;
  component_type?: { name?: string } | null;
  lineItems?: ApiLineItem[];
}

interface ApiSpace {
  id: string;
  space_type_id?: string;
  name?: string;
  space_type?: { name?: string } | null;
  components?: ApiComponent[];
}

export function toBuilderSpaces(spaces: ApiSpace[] | null | undefined): BuilderSpace[] {
  return (spaces || []).map((space, idx) => ({
    id: space.id,
    spaceTypeId: space.space_type_id || "",
    name: space.space_type?.name || "Space",
    defaultName: space.name || `Space ${idx + 1}`,
    expanded: true,
    components: (space.components || []).map((comp, compIdx) => ({
      id: comp.id,
      componentTypeId: comp.component_type_id || "",
      name: comp.component_type?.name || comp.name || `Component ${compIdx + 1}`,
      description: comp.description || "",
      expanded: true,
      width: comp.width ?? null,
      height: comp.height ?? null,
      measurementUnit: (comp.metadata?.measurement_unit ||
        "mm") as MeasurementUnit,
      lineItems: (comp.lineItems || []).map((item) => ({
        id: item.id,
        // LineItem types this as a string. The builder's inline version mapped
        // through `any`, so a line whose cost item has been removed from the
        // catalogue was handing `undefined` to a field declared non-optional.
        costItemId: item.cost_item_id || "",
        costItemName: item.cost_item?.name || item.name || "Cost Item",
        categoryName: item.cost_item?.category?.name || "Other",
        categoryColor: item.cost_item?.category?.color || "#718096",
        unitCode: item.unit_code || "nos",
        // The rate on the line is what the client pays; default_rate on the
        // cost item is only what the catalogue suggests.
        rate: item.rate || 0,
        defaultRate: item.cost_item?.default_rate || 0,
        companyCost: item.cost_item?.company_cost || 0,
        vendorCost: item.cost_item?.vendor_cost || 0,
        length: item.length,
        width: item.width,
        measurementUnit: (item.measurement_unit || "mm") as MeasurementUnit,
        quantity: item.quantity || 1,
        amount: item.amount || 0,
        notes: item.notes || "",
        // Lines that pre-date component sizing carry no flag and keep the
        // dimensions already typed into them.
        followsComponent: item.metadata?.follows_component === true,
      })),
    })),
  }));
}
