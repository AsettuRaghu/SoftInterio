// =====================================================
// Lead Module Types
// =====================================================

// Enums matching database

// Property Category (residential vs commercial)
export type PropertyCategory = "residential" | "commercial";

// Property Type (aligned with property_type_v2 in properties table)
export type PropertyType =
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

// Property Subtype (community type)
export type PropertySubtype =
  | "gated_community"
  | "non_gated"
  | "standalone"
  | "mall"
  | "commercial_complex"
  | "it_park"
  | "industrial_area"
  | "other";

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
  | "below_10l"
  | "around_10l"
  | "around_20l"
  | "around_30l"
  | "around_40l"
  | "around_50l"
  | "above_50l"
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
  | "client_meeting"
  | "internal_meeting"
  | "site_visit"
  | "quotation_sent"
  | "quotation_revised"
  | "note_added"
  | "stage_changed"
  | "assignment_changed"
  | "document_uploaded"
  | "other";

export type MeetingType = "client_meeting" | "internal_meeting" | "site_visit" | "other";

export interface MeetingAttendee {
  type: "team" | "external";
  id?: string; // For team members
  email?: string; // For external attendees
  name: string;
}

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

// Lead Score (replaces priority)
export type LeadScore = "cold" | "warm" | "hot" | "on_hold";

// Display labels for enums
export const PropertyCategoryLabels: Record<PropertyCategory, string> = {
  residential: "Residential",
  commercial: "Commercial",
};

export const PropertyTypeLabels: Record<PropertyType, string> = {
  // Residential
  apartment: "Apartment",
  villa: "Villa",
  independent_house: "Independent House",
  penthouse: "Penthouse",
  duplex: "Duplex",
  row_house: "Row House",
  farmhouse: "Farmhouse",
  // Commercial
  office: "Office",
  retail_shop: "Retail Shop",
  showroom: "Showroom",
  restaurant_cafe: "Restaurant/Cafe",
  clinic_hospital: "Clinic/Hospital",
  hotel: "Hotel",
  warehouse: "Warehouse",
  co_working: "Co-working Space",
  other: "Other",
};

// Property types grouped by category for form dropdowns
export const PropertyTypesByCategory: Record<PropertyCategory, PropertyType[]> = {
  residential: ["apartment", "villa", "independent_house", "penthouse", "duplex", "row_house", "farmhouse"],
  commercial: ["office", "retail_shop", "showroom", "restaurant_cafe", "clinic_hospital", "hotel", "warehouse", "co_working", "other"],
};

export const PropertySubtypeLabels: Record<PropertySubtype, string> = {
  gated_community: "Gated Community",
  non_gated: "Non-Gated",
  standalone: "Standalone",
  mall: "Mall",
  commercial_complex: "Commercial Complex",
  it_park: "IT Park",
  industrial_area: "Industrial Area",
  other: "Other",
};

// Property subtypes by category for form dropdowns
export const PropertySubtypesByCategory: Record<PropertyCategory, PropertySubtype[]> = {
  residential: ["gated_community", "non_gated", "standalone", "other"],
  commercial: ["standalone", "mall", "commercial_complex", "it_park", "industrial_area", "other"],
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
  below_10l: "Below ₹10 Lakhs",
  around_10l: "~₹10 Lakhs",
  around_20l: "~₹20 Lakhs",
  around_30l: "~₹30 Lakhs",
  around_40l: "~₹40 Lakhs",
  around_50l: "~₹50 Lakhs",
  above_50l: "₹50+ Lakhs",
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

export const LeadScoreLabels: Record<LeadScore, string> = {
  cold: "Cold",
  warm: "Warm",
  hot: "Hot",
  on_hold: "On Hold",
};

export const LeadScoreColors: Record<
  LeadScore,
  { bg: string; text: string; dot: string }
> = {
  cold: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-500" },
  warm: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  hot: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
  on_hold: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
};

export const LeadActivityTypeLabels: Record<LeadActivityType, string> = {
  call_made: "Outgoing Call",
  call_received: "Incoming Call",
  call_missed: "Missed Call",
  email_sent: "Email Sent",
  email_received: "Email Received",
  meeting_scheduled: "Meeting Scheduled",
  meeting_completed: "Meeting Completed",
  client_meeting: "Client Meeting",
  internal_meeting: "Internal Meeting",
  site_visit: "Site Visit",
  quotation_sent: "Quotation Sent",
  quotation_revised: "Quotation Revised",
  note_added: "Note Added",
  stage_changed: "Stage Changed",
  assignment_changed: "Assignment Changed",
  document_uploaded: "Document Uploaded",
  other: "Other",
};

export const MeetingTypeLabels: Record<MeetingType, string> = {
  client_meeting: "Client Meeting",
  internal_meeting: "Internal Meeting",
  site_visit: "Site Visit",
  other: "Other",
};

// Client interface (from clients table)
export interface Client {
  id: string;
  tenant_id: string;
  client_type: "individual" | "company" | "partnership" | "huf" | "trust" | "other";
  status: "active" | "inactive" | "blacklisted";
  name: string;
  display_name: string | null;
  phone: string;
  phone_secondary: string | null;
  email: string | null;
  email_secondary: string | null;
  company_name: string | null;
  gst_number: string | null;
  pan_number: string | null;
  contact_person_name: string | null;
  contact_person_phone: string | null;
  contact_person_email: string | null;
  contact_person_designation: string | null;
  address_line1: string | null;
  address_line2: string | null;
  landmark: string | null;
  locality: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string;
  date_of_birth: string | null;
  anniversary_date: string | null;
  occupation: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Property interface (from properties table)
export interface Property {
  id: string;
  tenant_id: string;
  property_name: string | null;
  unit_number: string | null;
  block_tower: string | null;
  category: PropertyCategory;
  property_type: PropertyType;
  property_subtype: PropertySubtype | null;
  ownership: string | null;
  status: string | null;
  carpet_area: number | null;
  built_up_area: number | null;
  super_built_up_area: number | null;
  area_unit: string;
  bedrooms: number;
  bathrooms: number;
  floor_number: number | null;
  total_floors: number | null;
  facing: string | null;
  address_line1: string | null;
  address_line2: string | null;
  landmark: string | null;
  locality: string | null;
  city: string;
  state: string | null;
  pincode: string | null;
  country: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// Main Lead interface (normalized - uses client_id and property_id)
export interface Lead {
  id: string;
  tenant_id: string;
  lead_number: string;

  client_id: string;
  
  // Linked Property (FK to properties table) - optional
  property_id: string | null;

  // Service & Source
  service_type: ServiceType | null;
  lead_source: LeadSource | null;
  lead_source_detail: string | null;

  // Timeline
  target_start_date: string | null; // ISO date
  target_end_date: string | null;

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
  // Handover Details (MOVED TO SEPARATE TABLE/PROCESS)
  // payment_terms, token_amount, token_received_date, handover_notes, handover_completed... removed


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

  // Lead Score (formerly priority)
  lead_score: LeadScore;
  // Keep priority for backward compatibility during migration
  priority?: "low" | "medium" | "high" | "urgent";

  // Activity Tracking
  last_activity_at: string;
  last_activity_type: LeadActivityType | null;
  next_followup_date: string | null;
  next_followup_notes: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Joined data (from foreign keys)
  client?: Client;
  property?: Property | null;
  assigned_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
    email?: string;
  };
  created_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

// Lead creation input - client and property data are provided inline
// API will create client/property records automatically
export interface CreateLeadInput {
  // Client Details (will create a new client record)
  client_name: string;
  phone: string;
  email?: string;

  // Property Details (will create a new property record)
  property_name?: string;
  unit_number?: string;
  property_category?: PropertyCategory;
  property_type?: PropertyType;
  property_subtype?: PropertySubtype;
  carpet_area?: number;
  property_address?: string;
  property_city?: string;
  property_pincode?: string;

  // Lead-specific fields
  service_type?: ServiceType;
  lead_source?: LeadSource;
  lead_source_detail?: string;
  target_start_date?: string;
  target_end_date?: string;
  budget_range?: BudgetRange;
  estimated_value?: number;
  project_scope?: string;
  special_requirements?: string;
  lead_score?: LeadScore;
  notes?: string;
}

// Lead update input - updates to client/property are passed inline
// API will update the linked client/property records
export interface UpdateLeadInput {
  // Client updates (will update linked client record)
  client_name?: string;
  phone?: string;
  email?: string;

  // Property updates (will update linked property record)
  property_name?: string;
  unit_number?: string;
  property_category?: PropertyCategory;
  property_type?: PropertyType;
  property_subtype?: PropertySubtype;
  carpet_area?: number;
  property_address?: string;
  property_city?: string;
  property_pincode?: string;

  // Lead-specific field updates
  service_type?: ServiceType | null;
  lead_source?: LeadSource | null;
  lead_source_detail?: string | null;
  target_start_date?: string | null;
  target_end_date?: string | null;
  budget_range?: BudgetRange | null;
  estimated_value?: number | null;
  project_scope?: string | null;
  special_requirements?: string | null;
  lead_score?: LeadScore;
  assigned_to?: string | null;
  next_followup_date?: string | null;
  next_followup_notes?: string | null;
}

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

  // For Requirement Discussion (updates property)
  budget_range?: BudgetRange;
  project_scope?: string;
  property_name?: string;
  unit_number?: string;
  property_category?: PropertyCategory;
  property_type?: PropertyType;
  property_subtype?: PropertySubtype;
  carpet_area?: number;
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
  selected_quotation_id?: string;

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
  tenant_id?: string;
  activity_type: LeadActivityType;
  title: string;
  description: string | null;

  // Call details
  call_duration_seconds: number | null;
  call_outcome: string | null;

  // Meeting details
  meeting_type: MeetingType | null;
  meeting_scheduled_at: string | null;
  meeting_location: string | null;
  meeting_completed: boolean;
  meeting_notes: string | null;
  attendees: MeetingAttendee[];
  linked_note_id: string | null;

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
// NOTE: Once qualified, a lead cannot be disqualified - only new leads can be disqualified
export const ValidStageTransitions: Record<LeadStage, LeadStage[]> = {
  new: ["qualified", "disqualified"],
  qualified: ["requirement_discussion", "lost"], // Can move forward or mark as lost
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
