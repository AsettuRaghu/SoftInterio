// =====================================================
// Project Module Types
// =====================================================

// =====================================================
// ENUMS (Aligned with Leads Module)
// =====================================================

// Project Category - aligned with leads.service_type
export type ProjectCategory =
  | "turnkey"
  | "modular"
  | "renovation"
  | "consultation"
  | "commercial_fitout"
  | "hybrid"
  | "other";

// Property Type - aligned with database property_type_v2 enum
export type ProjectPropertyType =
  | "apartment"
  | "villa"
  | "independent_house"
  | "penthouse"
  | "duplex"
  | "row_house"
  | "farmhouse"
  | "office"
  | "retail_shop"
  | "showroom"
  | "restaurant_cafe"
  | "clinic_hospital"
  | "hotel"
  | "warehouse"
  | "co_working"
  | "other";

export type PaymentMilestoneStatus =
  | "pending"
  | "due"
  | "overdue"
  | "paid"
  | "waived";

export type ProjectPaymentStatus =
  | "not_started"
  | "pending"
  | "partial"
  | "due"
  | "overdue"
  | "paid"
  | "waived"
  | "disputed";

export type ProgressMode = "auto" | "manual";

export type ProjectType =
  | "residential"
  | "commercial"
  | "hospitality"
  | "retail"
  | "office"
  | "villa"
  | "apartment"
  | "other";

export type ProjectStatus =
  | "new"
  | "in_progress"
  | "on_hold"
  | "cancelled"
  | "completed";

export type ProjectPriority = "Low" | "Medium" | "High" | "Urgent";

// =====================================================
// DISPLAY LABELS
// =====================================================

// Project Category Labels - aligned with leads.service_type labels
export const ProjectCategoryLabels: Record<ProjectCategory, string> = {
  turnkey: "Turnkey (Full Interior)",
  modular: "Modular (Kitchen/Wardrobe)",
  renovation: "Renovation",
  consultation: "Consultation Only",
  commercial_fitout: "Commercial Fit-out",
  hybrid: "Hybrid (Turnkey + Modular)",
  other: "Other",
};

// Property Type Labels - aligned with database property_type_v2 enum
export const ProjectPropertyTypeLabels: Record<ProjectPropertyType, string> = {
  apartment: "Apartment",
  villa: "Villa",
  independent_house: "Independent House",
  penthouse: "Penthouse",
  duplex: "Duplex",
  row_house: "Row House",
  farmhouse: "Farmhouse",
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

export const ProjectPriorityLabels: Record<ProjectPriority, string> = {
  Low: "Low",
  Medium: "Medium",
  High: "High",
  Urgent: "Urgent",
};

export const PaymentMilestoneStatusLabels: Record<
  PaymentMilestoneStatus,
  string
> = {
  pending: "Pending",
  due: "Due",
  overdue: "Overdue",
  paid: "Paid",
  waived: "Waived",
};

export const ProjectTypeLabels: Record<ProjectType, string> = {
  residential: "Residential",
  commercial: "Commercial",
  hospitality: "Hospitality",
  retail: "Retail",
  office: "Office",
  villa: "Villa",
  apartment: "Apartment",
  other: "Other",
};

export const ProjectStatusLabels: Record<ProjectStatus, string> = {
  new: "New",
  in_progress: "In Progress",
  on_hold: "On Hold",
  cancelled: "Cancelled",
  completed: "Completed",
};

export const ProjectPaymentStatusLabels: Record<ProjectPaymentStatus, string> = {
  not_started: "Not Started",
  pending: "Pending",
  partial: "Partial",
  due: "Due",
  overdue: "Overdue",
  paid: "Paid",
  waived: "Waived",
  disputed: "Disputed",
};

// Status colors for UI
export const PaymentStatusColors: Record<PaymentMilestoneStatus, string> = {
  pending: "gray",
  due: "yellow",
  overdue: "red",
  paid: "green",
  waived: "gray",
};

// =====================================================
// PHASE CATEGORY
// =====================================================

// =====================================================
// PHASE TEMPLATES
// =====================================================

// =====================================================
// PROJECT
// =====================================================

export interface Project {
  id: string;
  tenant_id: string;
  project_number: string;
  name: string;
  description?: string;

  // Client Info
  client_name?: string;
  client_email?: string;
  client_phone?: string;

  // Property Info (from lead or manual entry)
  /** The property this project is for. Its Spaces live on the property, so
   *  the same scope the seller captured on the lead is reachable here. */
  property_id?: string | null;
  property_name?: string;
  flat_number?: string;
  carpet_area_sqft?: number;

  // Extended Property Details (Joined from properties table)
  block_tower?: string;
  built_up_area?: number;
  super_built_up_area?: number;
  bedrooms?: number;
  bathrooms?: number;
  balconies?: number;
  floor_number?: number;
  total_floors?: number;
  facing?: string;
  furnishing_status?: string;
  age_of_property?: number;
  parking_slots?: number;
  has_lift?: boolean;
  has_gym?: boolean;
  has_power_backup?: boolean;
  has_security?: boolean;
  amenities?: string[]; // JSONB in DB, array here

  // Project Details
  project_type: ProjectType; // Kept for TS compatibility temporarily, effectively unused
  property_type?: ProjectPropertyType; // NEW: Type of property (aligned with leads)
  project_category: ProjectCategory; // Service category (aligned with leads.service_type)
  status: ProjectStatus;
  priority?: ProjectPriority;
  /** Name of the stage the project is on, derived from its playbook. */
  current_phase?: string;

  // Dates
  expected_start_date?: string;
  expected_end_date?: string;
  /** On the table all along; this type never declared it, so nothing could
   * read it and the project overview showed no actual start date. */
  actual_start_date?: string;
  actual_end_date?: string;
  /** What Sales promised the client; copied from expected_* at kick-off and never moved. */
  committed_start_date?: string | null;
  committed_end_date?: string | null;
  handover_reviewed_at?: string | null;
  /** Set by kick_off_project(). A project with this set is past `new`. */
  kicked_off_at?: string | null;
  kicked_off_by?: string | null;
  /** The latest agreed plan's span, from plan_baselines. */
  agreed_plan?: { version: number; set_at: string; start: string | null; end: string | null } | null;

  // Progress & Cost
  overall_progress: number;
  /** The agreed value of the work, carried from the lead's won_amount. */
  contract_value?: number;
  /** Money spent. Not the same thing as contract_value. */
  actual_cost?: number;
  won_amount?: number; // From linked lead

  // References
  project_manager_id?: string;
  lead_id?: string;
  quotation_id?: string;


  // Lead tracking

  // Metadata
  notes?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;

  // Relations (populated by joins)
  client?: {
    name: string;
    email: string;
    phone: string;
  };
  property?: {
    property_name: string;
    unit_number: string;
    /**
     * Note: this nested type declares a good deal that `properties` does not
     * actually have - block_tower, built_up_area, bedrooms, facing and the rest.
     * That fiction is why sending those columns in an UPDATE went unnoticed for
     * so long: TypeScript was happy and PostgREST refused the statement. Only
     * `category` was genuinely missing, and it is added here.
     */
    category?: string;
    block_tower: string;
    property_type: string;
    property_subtype: string;
    address_line1: string;
    city: string;
    pincode: string;
    carpet_area: number;
    built_up_area: number;
    super_built_up_area: number;
    bedrooms: number;
    bathrooms: number;
    balconies: number;
    floor_number: string;
    total_floors: number;
    facing: string;
    furnishing_status: string;
    age_of_property: string;
    parking_slots: string;
    has_lift: boolean;
    has_gym: boolean;
    has_power_backup: boolean;
    has_security: boolean;
  };
  project_manager?: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
  };
  sales_rep?: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
  };
  assigned_by_user?: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
  };
  payment_milestones?: ProjectPaymentMilestone[];

  // Lead data (if converted from lead)
  lead?: ProjectLeadData;
}

// Lead data attached to project
export interface ProjectLeadData {
  id: string;
  lead_number?: string;
  
  // Contact info (original lead values)
  client_name?: string;
  email?: string;
  phone?: string;
  
  // Source info
  lead_source?: string;

  // Assignment info
  assigned_to?: string;
  assigned_by?: string;
  assigned_user?: {
      id: string;
      name: string;
      email: string;
      avatar_url?: string;
  };
  created_by_user?: {
      id: string;
      name: string;
      email: string;
      avatar_url?: string;
  };

  // Status
  stage: string;

  // Property Reference
  property_id?: string;
  carpet_area_sqft?: number;

  // Service & scope
  service_type?: string;
  project_scope?: string;
  special_requirements?: string;
  budget_range?: string;

  // Financials
  won_amount?: number;

  // Dates
  contract_signed_date?: string;
  expected_project_start?: string;
  target_start_date?: string;
  target_end_date?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
  won_at?: string;

  // Calculated
  lead_duration_days?: number;
  activity_count?: number;
}


/**
 * Timeline labels for project activities.
 *
 * Lives here, next to the other label maps, because the lead side reads
 * LeadActivityTypeLabels from @/types/leads and the project tab was carrying
 * its own copy inline - so the two timelines could drift in wording.
 */
export const ProjectActivityTypeLabels: Record<string, string> = {
  call_made: "Call Made",
  call_received: "Call Received",
  call_missed: "Call Missed",
  email_sent: "Email Sent",
  email_received: "Email Received",
  meeting_scheduled: "Meeting Scheduled",
  meeting_completed: "Meeting Completed",
  client_meeting: "Client Meeting",
  internal_meeting: "Internal Meeting",
  site_visit: "Site Visit",
  quotation_sent: "Quotation Sent",
  quotation_revised: "Quotation Revised",
  quotation_approved: "Quotation Approved",
  project_created: "Project Created",
  status_changed: "Status Changed",
  task_created: "Task Created",
  task_completed: "Task Completed",
  document_uploaded: "Document Uploaded",
  note_added: "Note Added",
};

// =====================================================
// PROJECT PHASE
// =====================================================

// =====================================================
// PAYMENT MILESTONES
// =====================================================

export interface ProjectPaymentMilestoneTemplate {
  id: string;
  tenant_id: string | null;
  name: string;
  description?: string;
  percentage?: number;
  trigger_condition: "on_start" | "on_completion";
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ProjectPaymentMilestone {
  id: string;
  project_id: string;
  milestone_template_id?: string;
  name: string;
  description?: string;
  percentage?: number;
  amount?: number;
  trigger_condition: "on_start" | "on_completion";
  status: PaymentMilestoneStatus;
  due_date?: string;
  paid_at?: string;
  paid_amount?: number;
  payment_reference?: string;
  payment_method?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

export interface CreateProjectRequest {
  name: string;
  description?: string;
  // Client Reference
  client_id?: string;
  project_type: ProjectType;
  project_category: ProjectCategory;
  expected_start_date?: string;
  expected_end_date?: string;
  project_manager_id?: string;
  lead_id?: string;
  quotation_id?: string;
  converted_from_lead_id?: string;
  notes?: string;
}

export interface UpdateProjectRequest extends Partial<CreateProjectRequest> {
  status?: ProjectStatus;
  actual_end_date?: string;
  actual_cost?: number;
  is_active?: boolean;
}

export interface AddPaymentMilestoneRequest {
  name: string;
  description?: string;
  percentage?: number;
  amount?: number;
  trigger_condition?: "on_start" | "on_completion";
  due_date?: string;
}

export interface RecordPaymentRequest {
  paid_amount: number;
  payment_reference?: string;
  payment_method?: string;
  notes?: string;
}

// =====================================================
// LIST & FILTER TYPES
// =====================================================

export interface ProjectListFilters {
  search?: string;
  status?: ProjectStatus | ProjectStatus[];
  project_type?: ProjectType | ProjectType[];
  project_category?: ProjectCategory | ProjectCategory[];
  project_manager_id?: string;
  start_date_from?: string;
  start_date_to?: string;
  is_active?: boolean;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
  page: number;
  limit: number;
}

export interface ProjectSummary {
  id: string;
  project_number: string;
  name: string;
  client_name?: string;
  service_type?: string;
  property_name?: string;
  property_type?: string;
  /** residential / commercial - the property's category, from properties.category. */
  property_category?: string;
  carpet_area?: number;
  city?: string;
  project_type: ProjectType;
  project_category: ProjectCategory;
  status: ProjectStatus;
  priority?: ProjectPriority;
  /** Name of the stage the project is on, derived from its playbook. */
  current_phase?: string;
  payment_status?: ProjectPaymentStatus;
  overall_progress: number;
  expected_start_date?: string;
  expected_end_date?: string;
  actual_end_date?: string;
  created_at?: string;
  updated_at?: string;
  contract_value: number | null;
  project_manager?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  phase_summary?: {
    total: number;
    completed: number;
    in_progress: number;
  };
  /**
   * Where the work has got to, derived by the list API from the playbook's
   * top-level steps. Distinct from `status`, which is where the record is.
   */
  stage_summary?: {
    /** Every stage under way - a playbook can run several in parallel. */
    active: Array<{ name: string; progress: number }>;
    /** The next not-started stage, only when nothing is active. */
    next: string | null;
    done: number;
    total: number;
    source: "playbook" | "none";
    /** Per-stage progress, for the hover on the bar. */
    breakdown: Array<{
      name: string;
      status: "not_started" | "in_progress" | "completed" | "skipped" | "cancelled";
      progress: number;
    }>;
  } | null;
  /** The same enrichment the leads list carries, drawn by the same cells. */
  last_activity_at?: string | null;
  last_activity_type?: string | null;
  last_activity_detail?: string | null;
  recent_activities?: Array<{ type?: string | null; detail?: string | null; at: string }>;
  next_follow_up_at?: string | null;
  upcoming_items?: Array<{ kind: "follow_up" | "task" | "calendar" | string; label: string; at: string }>;
}

// =====================================================
// DASHBOARD TYPES
// =====================================================

export interface ProjectDashboardStats {
  total_projects: number;
  active_projects: number;
  projects_by_status: Record<ProjectStatus, number>;
  projects_by_category: Record<ProjectCategory, number>;
  pending_payments: number;
  total_contract_value: number;
  total_actual_cost: number;
}

// =====================================================
// FORM OPTIONS
// =====================================================

export const PROJECT_TYPE_OPTIONS = Object.entries(ProjectTypeLabels).map(
  ([value, label]) => ({
    value: value as ProjectType,
    label,
  })
);

export const PROJECT_CATEGORY_OPTIONS = Object.entries(
  ProjectCategoryLabels
).map(([value, label]) => ({
  value: value as ProjectCategory,
  label,
}));

export const PROJECT_STATUS_OPTIONS = Object.entries(ProjectStatusLabels).map(
  ([value, label]) => ({
    value: value as ProjectStatus,
    label,
  })
);

// =====================================================
// PROJECT ROOMS (FROM QUOTATION SPACES)
// =====================================================

export interface ProjectRoom {
  project_id: string;
  project_number: string;
  project_name: string;
  quotation_id: string;
  quotation_number: string;
  room_id: string;
  room_name: string;
  room_description?: string;
  space_type?: string;
  space_icon?: string;
  display_order: number;
  room_total: number;
  room_metadata?: Record<string, unknown>;
  component_count: number;
}

// =====================================================
// PROJECT NOTES
// =====================================================

export type ProjectNoteCategory =
  | "general"
  | "meeting"
  | "decision"
  | "issue"
  | "followup"
  | "client_communication";

export const ProjectNoteCategoryLabels: Record<ProjectNoteCategory, string> = {
  general: "General",
  meeting: "Meeting Notes",
  decision: "Decision",
  issue: "Issue",
  followup: "Follow-up",
  client_communication: "Client Communication",
};

export interface ProjectNote {
  id: string;
  project_id: string;
  title?: string;
  content: string;
  category: ProjectNoteCategory;
  is_pinned: boolean;
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;

  // Relations
  created_by_user?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}

export interface CreateProjectNoteRequest {
  title?: string;
  content: string;
  category?: ProjectNoteCategory;
  is_pinned?: boolean;
}

export interface UpdateProjectNoteRequest {
  title?: string;
  content?: string;
  category?: ProjectNoteCategory;
  is_pinned?: boolean;
}

// =====================================================
// PROJECT TASK
// =====================================================

export interface ProjectTask {
  task_id: string;
  task_number: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  start_date?: string;
  due_date?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  parent_task_id?: string;
  subtask_count: number;
  completed_subtask_count: number;
  created_at: string;
}

// =====================================================
// TAB VISIBILITY TYPES
// =====================================================

export type ProjectDetailTab =
  | "project-mgmt"
  // Replaced "rooms", which showed quotation_spaces - what was priced. A
  // project needs what is to be built, which is the property's Spaces.
  | "spaces"
  | "overview"
  | "documents"
  | "tasks"
  | "timeline"
  | "notes"
  | "quotations"
  | "procurement"
  | "calendar"
  | "payments";

export interface TabConfig {
  key: ProjectDetailTab;
  label: string;
  badge?: number;
  requiredRole?: string[]; // Role-based visibility
  showIf?: (project: Project) => boolean; // Conditional visibility
}
