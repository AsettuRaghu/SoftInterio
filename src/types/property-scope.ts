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

/** Who does this part of the scope. */
export type ScopeOwner = "us" | "client" | "vendor" | "excluded";

export const SCOPE_OWNER_LABELS: Record<ScopeOwner, string> = {
  us: "Us",
  client: "Client",
  vendor: "Vendor",
  excluded: "Not in scope",
};

/** "Us" stays "Us" - the business's full name was tried and is too long for a cell. */
export const scopeOwnerLabel = (owner: ScopeOwner | null | undefined) => SCOPE_OWNER_LABELS[owner ?? "us"];

export interface PropertyScopeItem {
  /** Field values under the component type's costing rule (lib/costing). */
  measures?: Record<string, number> | null;
  /** Questions on this component with neither an answer nor a "not needed" - sent by the scope GET. */
  still_to_ask?: number;
  questions?: number;
  /** Set on a cost-item row under a component: which catalogue item, and
   *  whether it is the customer's first or second preference. Never a price. */
  cost_item_id?: string | null;
  choice_status?: "p1" | "p2" | null;
  /** The finish they want here, when it differs from the brief. */
  preferred_finish?: string | null;
  /** For a client/vendor row: what is arriving from them, and by when. */
  supplied_detail?: string | null;
  supplied_expected_by?: string | null;
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
  /** Who does this part: us by default. */
  scope_owner: ScopeOwner;
  /** Named when a vendor does it. */
  scope_vendor_name: string | null;
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
 * A curated starting point for a scope - "2 BHK", "Kitchen only" - kept
 * under Settings → Catalogue. `component_type_ids` null means "whatever
 * components declare they belong in that space type", which is what the add
 * dialog already defaults to.
 */
export interface ScopePresetItem {
  space_type_id: string;
  count: number;
  component_type_ids: string[] | null;
}

export interface ScopePreset {
  id: string;
  name: string;
  description: string | null;
  items: ScopePresetItem[];
  display_order: number;
  is_active: boolean;
  /** Configuration values this preset answers. Empty falls back to matching the name. */
  configurations?: string[] | null;
  /** Optional narrowing - a preset for villas only, which then beats a plain BHK preset. */
  property_types?: string[] | null;
}

/** What the customer asked for, beside the scope rows. */
export interface ScopeBrief {
  property_id: string;
  /** quotation_cost_item_categories ids. */
  services_wanted: string[];
  brief_notes: string | null;
  /** library_styles codes. */
  style_codes: string[];
  preferred_finishes: string[];
  updated_at: string | null;
}

/** Offered as chips; anything else can be typed. The tenant's catalogue is
 *  the real vocabulary and will replace this list when finishes live there. */
export const COMMON_FINISHES = ["Laminate", "Acrylic", "PU", "Veneer", "Membrane", "Glass", "Leather", "Solid wood"];

/** One entry in a scope row's discussion. */
export interface ScopeComment {
  id: string;
  property_id: string;
  scope_item_id: string | null;
  body: string;
  is_decision: boolean;
  needs_rework: boolean;
  task_id: string | null;
  created_by: string | null;
  author_name: string;
  created_at: string;
  updated_at: string;
}

/** One line of a scope row's change log. */
export interface ScopeHistoryEntry {
  id: string;
  scope_item_id: string;
  item_name: string;
  action: "added" | "changed" | "removed";
  changes: Record<string, { from: unknown; to: unknown }>;
  reason: string | null;
  changed_by: string | null;
  changed_by_name: string;
  changed_at: string;
}
