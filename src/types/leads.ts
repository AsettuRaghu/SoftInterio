// =====================================================
// Lead Module Types
// =====================================================

// Enums matching database
export type PropertyType =
  | "apartment_gated"
  | "apartment_non_gated"
  | "villa_gated"
  | "villa_non_gated"
  | "independent_house"
  | "commercial_office"
  | "commercial_retail"
  | "commercial_restaurant"
  | "commercial_other"
  | "unknown";

export type ServiceType =
  | "turnkey"
  | "modular"
  | "renovation"
  | "consultation"
  | "commercial_fitout"
  | "other";

export type LeadSource =
  | "architect_referral"
  | "client_referral"
  | "youtube"
  | "instagram"
  | "facebook"
  | "google_ads"
  | "website"
  | "walkin"
  | "trade_show"
  | "justdial"
  | "other";

export type BudgetRange =
  | "below_5l"
  | "5l_10l"
  | "10l_20l"
  | "20l_35l"
  | "35l_50l"
  | "50l_1cr"
  | "above_1cr"
  | "not_disclosed";

export type LeadStage =
  | "new"
  | "qualified"
  | "disqualified"
  | "requirement_discussion"
  | "proposal_discussion"
  | "won"
  | "lost";

export type LeadActivityType =
  | "call_made"
  | "call_received"
  | "call_missed"
  | "email_sent"
  | "email_received"
  | "meeting_scheduled"
  | "meeting_completed"
  | "site_visit"
  | "quotation_sent"
  | "quotation_revised"
  | "note_added"
  | "stage_changed"
  | "assignment_changed"
  | "document_uploaded"
  | "other";

export type DisqualificationReason =
  | "budget_mismatch"
  | "timeline_mismatch"
  | "location_not_serviceable"
  | "not_serious_buyer"
  | "duplicate_lead"
  | "invalid_contact"
  | "competitor_already_hired"
  | "project_cancelled"
  | "other";

export type LostReason =
  | "price_too_high"
  | "chose_competitor"
  | "project_cancelled"
  | "timeline_not_met"
  | "scope_mismatch"
  | "no_response"
  | "budget_reduced"
  | "other";

// Display labels for enums
export const PropertyTypeLabels: Record<PropertyType, string> = {
  apartment_gated: "Apartment - Gated Community",
  apartment_non_gated: "Apartment - Non Gated",
  villa_gated: "Villa - Gated Community",
  villa_non_gated: "Villa - Non Gated",
  independent_house: "Independent House",
  commercial_office: "Commercial - Office",
  commercial_retail: "Commercial - Retail",
  commercial_restaurant: "Commercial - Restaurant/Cafe",
  commercial_other: "Commercial - Other",
  unknown: "Unknown",
};

export const ServiceTypeLabels: Record<ServiceType, string> = {
  turnkey: "Turnkey (Full Interior)",
  modular: "Modular (Kitchen/Wardrobe)",
  renovation: "Renovation",
  consultation: "Consultation Only",
  commercial_fitout: "Commercial Fit-out",
  other: "Other",
};

export const LeadSourceLabels: Record<LeadSource, string> = {
  architect_referral: "Architect Referral",
  client_referral: "Client Referral",
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  google_ads: "Google Ads",
  website: "Website Inquiry",
  walkin: "Walk-in",
  trade_show: "Trade Show/Exhibition",
  justdial: "JustDial/Sulekha",
  other: "Other",
};

export const BudgetRangeLabels: Record<BudgetRange, string> = {
  below_5l: "Below ₹5 Lakhs",
  "5l_10l": "₹5-10 Lakhs",
  "10l_20l": "₹10-20 Lakhs",
  "20l_35l": "₹20-35 Lakhs",
  "35l_50l": "₹35-50 Lakhs",
  "50l_1cr": "₹50 Lakhs - 1 Crore",
  above_1cr: "Above 1 Crore",
  not_disclosed: "Not Disclosed",
};

export const LeadStageLabels: Record<LeadStage, string> = {
  new: "New",
  qualified: "Qualified",
  disqualified: "Disqualified",
  requirement_discussion: "Requirement Discussion",
  proposal_discussion: "Proposal & Negotiation",
  won: "Won",
  lost: "Lost",
};

export const LeadStageColors: Record<
  LeadStage,
  { bg: string; text: string; dot: string }
> = {
  new: { bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500" },
  qualified: { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500" },
  disqualified: {
    bg: "bg-gray-100",
    text: "text-gray-800",
    dot: "bg-gray-500",
  },
  requirement_discussion: {
    bg: "bg-cyan-100",
    text: "text-cyan-800",
    dot: "bg-cyan-500",
  },
  proposal_discussion: {
    bg: "bg-orange-100",
    text: "text-orange-800",
    dot: "bg-orange-500",
  },
  won: { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" },
  lost: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
};

export const DisqualificationReasonLabels: Record<
  DisqualificationReason,
  string
> = {
  budget_mismatch: "Budget Mismatch",
  timeline_mismatch: "Timeline Mismatch",
  location_not_serviceable: "Location Not Serviceable",
  not_serious_buyer: "Not a Serious Buyer",
  duplicate_lead: "Duplicate Lead",
  invalid_contact: "Invalid Contact Info",
  competitor_already_hired: "Competitor Already Hired",
  project_cancelled: "Project Cancelled",
  other: "Other",
};

export const LostReasonLabels: Record<LostReason, string> = {
  price_too_high: "Price Too High",
  chose_competitor: "Chose Competitor",
  project_cancelled: "Project Cancelled",
  timeline_not_met: "Timeline Not Met",
  scope_mismatch: "Scope Mismatch",
  no_response: "No Response",
  budget_reduced: "Budget Reduced",
  other: "Other",
};

export const LeadActivityTypeLabels: Record<LeadActivityType, string> = {
  call_made: "Outgoing Call",
  call_received: "Incoming Call",
  call_missed: "Missed Call",
  email_sent: "Email Sent",
  email_received: "Email Received",
  meeting_scheduled: "Meeting Scheduled",
  meeting_completed: "Meeting Completed",
  site_visit: "Site Visit",
  quotation_sent: "Quotation Sent",
  quotation_revised: "Quotation Revised",
  note_added: "Note Added",
  stage_changed: "Stage Changed",
  assignment_changed: "Assignment Changed",
  document_uploaded: "Document Uploaded",
  other: "Other",
};

// Main Lead interface
export interface Lead {
  id: string;
  tenant_id: string;
  lead_number: string;

  // Primary Contact
  client_name: string;
  phone: string;
  email: string;
  property_type: PropertyType;

  // Service & Source
  service_type: ServiceType | null;
  lead_source: LeadSource | null;
  lead_source_detail: string | null;

  // Timeline
  target_start_date: string | null; // ISO date
  target_end_date: string | null;

  // Property Details
  property_name: string | null;
  flat_number: string | null;
  property_address: string | null;
  property_city: string | null;
  property_pincode: string | null;
  carpet_area_sqft: number | null;

  // Budget
  budget_range: BudgetRange | null;
  estimated_value: number | null;

  // Scope
  project_scope: string | null;
  special_requirements: string | null;

  // Stage & Status
  stage: LeadStage;
  stage_changed_at: string;

  // Disqualification/Lost
  disqualification_reason: DisqualificationReason | null;
  disqualification_notes: string | null;
  lost_reason: LostReason | null;
  lost_to_competitor: string | null;
  lost_notes: string | null;

  // Won Details
  won_amount: number | null;
  won_at: string | null;
  contract_signed_date: string | null;
  expected_project_start: string | null;

  // Handover Details (for Won stage)
  payment_terms: string | null;
  token_amount: number | null;
  token_received_date: string | null;
  handover_notes: string | null;
  handover_completed: boolean;
  handover_completed_at: string | null;

  // Assignment
  assigned_to: string | null;
  assigned_at: string | null;
  assigned_by: string | null;
  created_by: string;

  // Approval
  requires_approval: boolean;
  approval_status: "pending" | "approved" | "rejected" | null;
  approval_requested_at: string | null;
  approval_requested_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  approval_notes: string | null;

  // Priority
  priority: "low" | "medium" | "high" | "urgent";

  // Activity Tracking
  last_activity_at: string;
  last_activity_type: LeadActivityType | null;
  next_followup_date: string | null;
  next_followup_notes: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Joined data (optional)
  assigned_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  created_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

// Lead creation input (only mandatory fields)
export interface CreateLeadInput {
  client_name: string;
  phone: string;
  email: string;
  property_type: PropertyType;

  // Optional fields
  service_type?: ServiceType;
  lead_source?: LeadSource;
  lead_source_detail?: string;
  target_start_date?: string;
  target_end_date?: string;
  property_name?: string;
  flat_number?: string;
  property_address?: string;
  property_city?: string;
  property_pincode?: string;
  carpet_area_sqft?: number;
  budget_range?: BudgetRange;
  estimated_value?: number;
  project_scope?: string;
  special_requirements?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  notes?: string;
}

// Lead update input
export interface UpdateLeadInput
  extends Partial<
    Omit<
      Lead,
      | "id"
      | "tenant_id"
      | "lead_number"
      | "created_at"
      | "updated_at"
      | "created_by"
    >
  > {}

// Stage transition input
export interface StageTransitionInput {
  lead_id: string;
  to_stage: LeadStage;

  // For Qualified transition
  assigned_to?: string;
  service_type?: ServiceType;
  lead_source?: LeadSource;
  target_start_date?: string;
  target_end_date?: string;

  // For Requirement Discussion
  budget_range?: BudgetRange;
  project_scope?: string;
  property_name?: string;
  property_type?: PropertyType;
  flat_number?: string;
  carpet_area_sqft?: number;
  property_address?: string;
  property_city?: string;

  // For Disqualified
  disqualification_reason?: DisqualificationReason;
  disqualification_notes?: string;

  // For Lost
  lost_reason?: LostReason;
  lost_to_competitor?: string;
  lost_notes?: string;

  // For Won
  won_amount?: number;
  contract_signed_date?: string;
  expected_project_start?: string;
  won_notes?: string;
  skip_project_creation?: boolean;

  // General
  change_reason?: string;
}

// Family Member
export interface LeadFamilyMember {
  id: string;
  lead_id: string;
  name: string;
  relation: string | null;
  phone: string | null;
  email: string | null;
  is_decision_maker: boolean;
  notes: string | null;
  created_at: string;
}

// Stage History
export interface LeadStageHistory {
  id: string;
  lead_id: string;
  from_stage: LeadStage | null;
  to_stage: LeadStage;
  changed_by: string;
  change_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;

  // Joined
  changed_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

// Activity
export interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: LeadActivityType;
  title: string;
  description: string | null;

  // Call details
  call_duration_seconds: number | null;
  call_outcome: string | null;

  // Meeting details
  meeting_scheduled_at: string | null;
  meeting_location: string | null;
  meeting_completed: boolean;
  meeting_notes: string | null;

  // Email details
  email_subject: string | null;

  created_by: string;
  created_at: string;

  // Joined
  created_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

// Note
export interface LeadNote {
  id: string;
  lead_id: string;
  content: string;
  is_pinned: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;

  // Joined
  created_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

// Document
export interface LeadDocument {
  id: string;
  lead_id: string;
  file_name: string;
  file_type: string | null;
  file_size_bytes: number | null;
  file_url: string;
  storage_path: string | null;
  document_type: string | null;
  description: string | null;
  uploaded_by: string;
  created_at: string;

  // Joined
  uploaded_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

// Task
export interface LeadTask {
  id: string;
  lead_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  completed_at: string | null;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;

  // Joined
  assigned_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  created_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

// Lead Statistics
export interface LeadStatistics {
  total: number;
  new: number;
  qualified: number;
  disqualified: number;
  requirement_discussion: number;
  proposal_discussion: number;
  won: number;
  lost: number;
  pipeline_value: number;
  won_value: number;
  this_month_new: number;
  this_month_won: number;
  needs_followup: number;
}

// Tenant Lead Settings
export interface TenantLeadSettings {
  id: string;
  tenant_id: string;
  lead_number_prefix: string;
  lead_number_next: number;
  require_won_approval: boolean;
  won_approval_roles: string[];
  default_assignment: "creator" | "round_robin" | "manager";
  stage_colors: Record<LeadStage, string>;
  auto_followup_days: number;
  created_at: string;
  updated_at: string;
}

// Valid stage transitions
// NOTE: Once a lead moves to proposal_discussion, it CANNOT go back to earlier stages
// because a quotation is auto-created at that stage.
export const ValidStageTransitions: Record<LeadStage, LeadStage[]> = {
  new: ["qualified", "disqualified"],
  qualified: ["requirement_discussion", "disqualified"],
  requirement_discussion: ["proposal_discussion", "lost"], // Forward only - proposal or lost
  proposal_discussion: ["won", "lost"], // Can move to won or lost
  disqualified: [], // Terminal
  won: [], // Terminal
  lost: ["new", "qualified"], // Can be reopened to early stages only
};

// Required fields per stage transition
export interface StageRequiredFields {
  fields: string[];
  labels: string[];
}

export const StageTransitionRequirements: Record<string, StageRequiredFields> =
  {
    "new->qualified": {
      fields: [
        "property_type",
        "service_type",
        "property_name",
        "target_start_date",
        "target_end_date",
      ],
      labels: [
        "Property Type",
        "Service Type",
        "Property Name",
        "Target Start Date",
        "Target End Date",
      ],
    },
    "new->disqualified": {
      fields: ["disqualification_reason"],
      labels: ["Disqualification Reason"],
    },
    "qualified->requirement_discussion": {
      fields: ["carpet_area_sqft", "flat_number", "budget_range"],
      labels: ["Carpet Area (sq.ft)", "Flat/Unit Number", "Budget Range"],
    },
    "qualified->disqualified": {
      fields: ["disqualification_reason"],
      labels: ["Disqualification Reason"],
    },
    "requirement_discussion->proposal_discussion": {
      fields: ["change_reason"], // Notes are mandatory
      labels: ["Notes"],
    },
    "requirement_discussion->lost": {
      fields: ["lost_reason", "lost_notes"],
      labels: ["Lost Reason", "Notes"],
    },
    "proposal_discussion->won": {
      fields: [
        "won_amount",
        "contract_signed_date",
        "expected_project_start",
        "change_reason",
      ],
      labels: [
        "Won Amount",
        "Contract Signed Date",
        "Expected Project Start",
        "Notes",
      ],
    },
    "proposal_discussion->lost": {
      fields: ["lost_reason", "lost_notes"],
      labels: ["Lost Reason", "Notes"],
    },
  };

// Check if stage transition is valid
export function isValidStageTransition(
  fromStage: LeadStage,
  toStage: LeadStage
): boolean {
  return ValidStageTransitions[fromStage]?.includes(toStage) ?? false;
}

// Get required fields for a stage transition
export function getRequiredFieldsForTransition(
  fromStage: LeadStage,
  toStage: LeadStage
): StageRequiredFields {
  const key = `${fromStage}->${toStage}`;
  return StageTransitionRequirements[key] || { fields: [], labels: [] };
}
