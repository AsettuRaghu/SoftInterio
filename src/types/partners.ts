/**
 * A partner is an outside party as this business sees it, and its contacts are
 * the people at it. See `docs/plans/partners.md`.
 */

export interface PartnerContact {
  id: string;
  name: string;
  /** What they are to the customer, in the seller's own words: "Wife", "Father", "their architect". */
  designation: string | null;
  phone: string | null;
  email: string | null;
  /** The owner of the relationship - who we ring. Exactly one per partner. */
  is_primary: boolean;
  /** This person signs off. Not the same fact as is_primary, and any number may hold it. */
  is_decision_maker?: boolean;
  notes: string | null;
  created_at?: string;
}

/** As much of a partner as a lead or project needs to name its customer's people. */
export interface PartnerSummary {
  id: string;
  name: string;
  contacts?: PartnerContact[];
}
