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

// Property Type - aligned with leads.property_type
export type ProjectPropertyType =
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

export type ProjectPhaseStatus =
  | "not_started"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled"
  | "blocked";

export type ProjectSubPhaseStatus =
  | "not_started"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "skipped";

export type PhaseDependencyType = "hard" | "soft";

export type PaymentMilestoneStatus =
  | "pending"
  | "due"
  | "overdue"
  | "paid"
  | "waived";

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
  | "planning"
  | "design"
  | "procurement"
  | "execution"
  | "finishing"
  | "handover"
  | "completed"
  | "on_hold"
  | "cancelled";

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

// Property Type Labels - aligned with leads.property_type labels
export const ProjectPropertyTypeLabels: Record<ProjectPropertyType, string> = {
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

export const ProjectPhaseStatusLabels: Record<ProjectPhaseStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
  blocked: "Blocked",
};

export const ProjectSubPhaseStatusLabels: Record<
  ProjectSubPhaseStatus,
  string
> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  skipped: "Skipped",
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
  planning: "Planning",
  design: "Design",
  procurement: "Procurement",
  execution: "Execution",
  finishing: "Finishing",
  handover: "Handover",
  completed: "Completed",
  on_hold: "On Hold",
  cancelled: "Cancelled",
};

// Status colors for UI
export const PhaseStatusColors: Record<ProjectPhaseStatus, string> = {
  not_started: "gray",
  in_progress: "blue",
  on_hold: "yellow",
  completed: "green",
  cancelled: "red",
  blocked: "orange",
};

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

export interface ProjectPhaseCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  display_order: number;
  icon?: string;
  color?: string;
  is_active: boolean;
  created_at: string;
}

// =====================================================
// PHASE TEMPLATES
// =====================================================

export interface ProjectPhaseTemplate {
  id: string;
  tenant_id: string | null;
  category_id: string;
  name: string;
  code: string;
  description?: string;
  applicable_to: string[];
  default_enabled: boolean;
  display_order: number;
  estimated_duration_hours?: number; // Duration in hours (allows finer granularity)
  is_system_template: boolean;
  created_at: string;
  updated_at: string;
  // Relations
  category?: ProjectPhaseCategory;
  sub_phase_templates?: ProjectSubPhaseTemplate[];
}

export interface ProjectSubPhaseTemplate {
  id: string;
  tenant_id: string | null;
  phase_template_id: string;
  name: string;
  description?: string;
  display_order: number;
  is_required: boolean;
  estimated_duration_hours?: number; // Duration in hours (allows finer granularity)
  created_at: string;
}

export interface ProjectPhaseDependencyTemplate {
  id: string;
  tenant_id: string | null;
  phase_template_id: string;
  depends_on_phase_template_id: string;
  dependency_type: PhaseDependencyType;
  created_at: string;
}

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

  // Dates
  start_date?: string;
  expected_end_date?: string;
  actual_end_date?: string;

  // Progress
  overall_progress: number;

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
  phases?: ProjectPhase[];
  payment_milestones?: ProjectPaymentMilestone[];

  // Lead data (if converted from lead)
  lead?: ProjectLeadData;
  lead_activities?: ProjectLeadActivity[];
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
  lead_source_detail?: string;

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
  estimated_value?: number;
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

// Lead activity for history
export interface ProjectLeadActivity {
  id: string;
  activity_type: string;
  title: string;
  description?: string;
  created_at: string;
  created_by?: string;
  creator?: {
    id: string;
    name: string;
  };
}

// =====================================================
// PROJECT PHASE
// =====================================================

export interface ProjectPhase {
  id: string;
  project_id: string;
  phase_template_id?: string;
  name: string;
  category_code?: string;
  status: ProjectPhaseStatus;
  progress_percentage: number;
  progress_mode: ProgressMode;
  assigned_to?: string;
  display_order: number;

  // Planning & Scheduling
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  estimated_duration_hours?: number; // Estimated duration in hours (allows for quick phases)

  notes?: string;
  created_at: string;
  updated_at: string;

  // Flexibility flags (PM control)
  is_enabled: boolean;
  can_remove: boolean;
  is_custom: boolean;

  // Relations
  assigned_user?: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
  };
  sub_phases?: ProjectSubPhase[];
  dependencies?: ProjectPhaseDependency[];
  blocking_dependencies?: string[]; // Names of blocking phases
}

export interface ProjectSubPhase {
  id: string;
  project_phase_id: string;
  sub_phase_template_id?: string;
  name: string;
  status: ProjectSubPhaseStatus;
  progress_percentage: number;
  progress_mode: ProgressMode;
  assigned_to?: string;
  display_order: number;

  // Planning & Scheduling (NEW: Full date support)
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  estimated_duration_hours?: number; // Duration in hours (allows for quick sub-phases)
  due_date?: string;

  completed_at?: string;
  completed_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;

  // Flexibility flags (PM control)
  is_enabled: boolean;
  can_remove: boolean;
  is_custom: boolean;
  task_template_id?: string;

  // Relations
  assigned_user?: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
  };
  checklist_items?: ProjectChecklistItem[];
}

export interface ProjectChecklistItem {
  id: string;
  project_sub_phase_id: string;
  name: string;
  is_completed: boolean;
  display_order: number;
  completed_at?: string;
  completed_by?: string;
  notes?: string;
  created_at: string;

  // Relations
  completed_by_user?: {
    id: string;
    name: string;
  };
}

export interface ProjectPhaseDependency {
  id: string;
  project_phase_id: string;
  depends_on_phase_id: string;
  dependency_type: PhaseDependencyType;
  created_at: string;

  // Relations
  depends_on_phase?: {
    id: string;
    name: string;
    status: ProjectPhaseStatus;
  };
}

// =====================================================
// PAYMENT MILESTONES
// =====================================================

export interface ProjectPaymentMilestoneTemplate {
  id: string;
  tenant_id: string | null;
  name: string;
  description?: string;
  percentage?: number;
  trigger_phase_template_id?: string;
  trigger_condition: "on_start" | "on_completion";
  display_order: number;
  is_active: boolean;
  created_at: string;

  // Relations
  trigger_phase_template?: ProjectPhaseTemplate;
}

export interface ProjectPaymentMilestone {
  id: string;
  project_id: string;
  milestone_template_id?: string;
  name: string;
  description?: string;
  percentage?: number;
  amount?: number;
  linked_phase_id?: string;
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

  // Relations
  linked_phase?: {
    id: string;
    name: string;
    status: ProjectPhaseStatus;
  };
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
  start_date?: string;
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

export interface UpdatePhaseRequest {
  status?: ProjectPhaseStatus;
  progress_percentage?: number;
  progress_mode?: ProgressMode;
  assigned_to?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  notes?: string;
}

export interface UpdateSubPhaseRequest {
  status?: ProjectSubPhaseStatus;
  progress_percentage?: number;
  progress_mode?: ProgressMode;
  assigned_to?: string;
  due_date?: string;
  notes?: string;
}

export interface AddChecklistItemRequest {
  name: string;
  display_order?: number;
}

export interface UpdateChecklistItemRequest {
  name?: string;
  is_completed?: boolean;
  notes?: string;
}

export interface AddPaymentMilestoneRequest {
  name: string;
  description?: string;
  percentage?: number;
  amount?: number;
  linked_phase_id?: string;
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
  project_type: ProjectType;
  project_category: ProjectCategory;
  status: ProjectStatus;
  overall_progress: number;
  start_date?: string;
  expected_end_date?: string;
  quoted_amount: number;
  created_at?: string;
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
}

// =====================================================
// DASHBOARD TYPES
// =====================================================

export interface ProjectDashboardStats {
  total_projects: number;
  active_projects: number;
  projects_by_status: Record<ProjectStatus, number>;
  projects_by_category: Record<ProjectCategory, number>;
  overdue_phases: number;
  pending_payments: number;
  total_quoted_amount: number;
  total_actual_cost: number;
}

export interface PhaseProgressSummary {
  phase_id: string;
  phase_name: string;
  category_code: string;
  status: ProjectPhaseStatus;
  progress_percentage: number;
  sub_phase_count: number;
  completed_sub_phases: number;
  blocking_dependencies?: string[];
  assigned_to_name?: string;
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

export const PHASE_STATUS_OPTIONS = Object.entries(
  ProjectPhaseStatusLabels
).map(([value, label]) => ({
  value: value as ProjectPhaseStatus,
  label,
}));

export const SUB_PHASE_STATUS_OPTIONS = Object.entries(
  ProjectSubPhaseStatusLabels
).map(([value, label]) => ({
  value: value as ProjectSubPhaseStatus,
  label,
}));

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
  phase_id?: string;
  sub_phase_id?: string;
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
  phase?: {
    id: string;
    name: string;
  };
  sub_phase?: {
    id: string;
    name: string;
  };
}

export interface CreateProjectNoteRequest {
  title?: string;
  content: string;
  phase_id?: string;
  sub_phase_id?: string;
  category?: ProjectNoteCategory;
  is_pinned?: boolean;
}

export interface UpdateProjectNoteRequest {
  title?: string;
  content?: string;
  phase_id?: string;
  sub_phase_id?: string;
  category?: ProjectNoteCategory;
  is_pinned?: boolean;
}

// =====================================================
// PROJECT TASK (Enhanced with phase linking)
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
  project_phase_id?: string;
  phase_name?: string;
  project_sub_phase_id?: string;
  sub_phase_name?: string;
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
  | "rooms"
  | "overview"
  | "documents"
  | "tasks"
  | "timeline"
  | "leads"
  | "notes"
  | "quotations"
  | "procurement"
  | "lead-history"
  | "calendar"
  | "payments";

export interface TabConfig {
  key: ProjectDetailTab;
  label: string;
  badge?: number;
  requiredRole?: string[]; // Role-based visibility
  showIf?: (project: Project) => boolean; // Conditional visibility
}
