/**
 * Property scope: the rooms and areas a client wants work in.
 *
 * Captured on the lead's Spaces tab, stored against the property rather than
 * the lead, so the project sees the same rows without anything being copied at
 * conversion.
 *
 * DECISION (2026-09-05): spaces and quotations stay independent.
 *
 * Generating a quotation from these rows is a one-time copy, like applying a
 * template. Afterwards neither side constrains the other - a space need not
 * appear in any quotation, a quotation may contain components that were never
 * listed here, and editing either never touches the other.
 *
 * So, deliberately absent and not to be added back without revisiting this:
 *   - no scope_item_id on quotation_spaces / quotation_components
 *   - no "scope changed, review the quotation" prompt
 *   - no is_active / deactivation on scope items
 *
 * The reasoning: a quotation is the negotiated artefact and this is the sketch
 * from the first conversation. Reconciling them would emit a steady drip of
 * "these have diverged" warnings that are almost always correct divergence,
 * which only teaches people to ignore warnings.
 *
 * Consequence: deleting a space is always safe. Nothing outside this tab
 * references it, and its components cascade through parent_id.
 *
 * Still open: project execution may want a genuine link, since a site task
 * ("install wardrobe in Master Bedroom") wants the room rather than a copied
 * name. Decide that when the client portal is designed.
 */

export type MeasurementSource = "discussion" | "client_cad" | "site_survey";
export type MeasurementStatus = "rough" | "confirmed";
export type ScopeMeasurementUnit = "mm" | "cm" | "inch" | "ft" | "m";

export const MEASUREMENT_SOURCE_LABELS: Record<MeasurementSource, string> = {
  discussion: "From discussion",
  client_cad: "Client drawing",
  site_survey: "Site survey",
};

export const MEASUREMENT_STATUS_LABELS: Record<MeasurementStatus, string> = {
  rough: "Rough",
  confirmed: "Confirmed",
};

/**
 * Free text on purpose.
 *
 * The tiers that exist are whatever the cost item catalogue uses - standard,
 * premium, basic, classic, signature, complex today - and that has to stay in
 * step for pricing to pick the right item later. A union here was a guess that
 * offered "luxury", which nothing carries, and omitted three that are in use.
 */
export type QualityTier = string;

/** Title-cases a tier for display without assuming which ones exist. */
export function formatQualityTier(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export interface PropertyScopeItem {
  id: string;
  tenant_id: string;
  property_id: string;
  parent_id: string | null;
  space_type_id: string | null;
  /** Set when this row is a component inside a space. Never both. */
  component_type_id: string | null;
  quality_tier: QualityTier | null;
  name: string;
  display_order: number;
  length: number | null;
  width: number | null;
  height: number | null;
  measurement_unit: ScopeMeasurementUnit;
  measurement_source: MeasurementSource;
  measurement_status: MeasurementStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;

  // Joined
  space_type?: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    is_container: boolean;
  } | null;
  component_type?: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
  } | null;
}

/** One line of the bulk add grid: a space type and how many of them. */
/** Labels for the quick-start chips, in the order they should appear. */
export const SCOPE_QUICK_START_LABELS: { key: string; label: string }[] = [
  { key: "1bhk", label: "1 BHK" },
  { key: "2bhk", label: "2 BHK" },
  { key: "3bhk", label: "3 BHK" },
  { key: "4bhk", label: "4 BHK" },
  { key: "villa", label: "Villa" },
];

/**
 * One line of the bulk add grid.
 *
 * Carries a space type or a component type, never both - the same distinction
 * the table enforces. A component entry must name the space it goes into.
 */
export interface ScopeBulkEntry {
  space_type_id?: string;
  component_type_id?: string;
  count: number;
  parent_id?: string | null;
}

/**
 * Starting room sets, chosen by the seller rather than derived.
 *
 * There is deliberately no lookup from properties.property_type: that column
 * holds apartment / villa / independent_house and carries no bedroom count.
 * BHK exists only on quotation_templates.property_type, which is a different
 * meaning of the same column name. Rather than guess, the modal offers these
 * as one-click starting points - the seller knows the configuration from the
 * conversation even when nothing has recorded it.
 *
 * Matched on space type slug, so a tenant missing one simply gets fewer
 * suggestions rather than an error.
 */
export const SCOPE_QUICK_STARTS: Record<
  string,
  Record<string, number>
> = {
  "1bhk": { bedroom: 1, "living-room": 1, kitchen: 1, bathroom: 1, balcony: 1 },
  "2bhk": { bedroom: 2, "living-room": 1, kitchen: 1, bathroom: 2, balcony: 1 },
  "3bhk": {
    bedroom: 3,
    "living-room": 1,
    dining: 1,
    kitchen: 1,
    bathroom: 3,
    balcony: 2,
    "pooja-room": 1,
  },
  "4bhk": {
    bedroom: 4,
    "living-room": 1,
    dining: 1,
    kitchen: 1,
    bathroom: 4,
    balcony: 2,
    "pooja-room": 1,
    utility: 1,
  },
  villa: {
    bedroom: 4,
    "living-room": 1,
    dining: 1,
    kitchen: 1,
    bathroom: 4,
    balcony: 2,
    "pooja-room": 1,
    utility: 1,
    foyer: 1,
  },
};
