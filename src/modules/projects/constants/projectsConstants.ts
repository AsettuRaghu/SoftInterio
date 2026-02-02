import type {
  ProjectStatus,
  ProjectPriority,
  ProjectPhaseName,
  ProjectPaymentStatus,
  ProjectCategory,
  ProjectType,
  ProjectPhaseStatus,
  ProjectSubPhaseStatus,
  ProjectPropertyType,
} from "@/types/projects";
import type { FilterOption } from "@/components/ui/AppTable";

// Project Status Colors & Labels (Overall Project Status)
export const PROJECT_STATUS_COLORS: Record<
  ProjectStatus,
  { bg: string; text: string; dot: string }
> = {
  new: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  in_progress: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    dot: "bg-purple-500",
  },
  on_hold: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  cancelled: {
    bg: "bg-red-100",
    text: "text-red-700",
    dot: "bg-red-500",
  },
  completed: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
};

// Project Status Options for filters/dropdowns (Overall Project Status)
export const PROJECT_STATUS_OPTIONS: FilterOption[] = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
];

// Active project statuses (ongoing/active projects)
export const ACTIVE_STATUSES: ProjectStatus[] = ["new", "in_progress"];

// Project Priority Colors & Labels
export const PROJECT_PRIORITY_COLORS: Record<
  ProjectPriority,
  { bg: string; text: string; dot: string; border: string }
> = {
  Low: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500", border: "border-green-300" },
  Medium: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500", border: "border-blue-300" },
  High: { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500", border: "border-orange-300" },
  Urgent: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500", border: "border-red-300" },
};

// Project Priority Options for filters/dropdowns
export const PROJECT_PRIORITY_OPTIONS: FilterOption[] = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
  { value: "Urgent", label: "Urgent" },
];

// Project Phase Colors & Labels (Current Workflow Phase)
export const PROJECT_PHASE_COLORS: Record<
  ProjectPhaseName,
  { bg: string; text: string; dot: string }
> = {
  "Project Kickoff": { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  "Design": {
    bg: "bg-purple-100",
    text: "text-purple-700",
    dot: "bg-purple-500",
  },
  "Procurement": {
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  "Site Work": {
    bg: "bg-orange-100",
    text: "text-orange-700",
    dot: "bg-orange-500",
  },
  "Installation": {
    bg: "bg-cyan-100",
    text: "text-cyan-700",
    dot: "bg-cyan-500",
  },
  "Handover": {
    bg: "bg-green-100",
    text: "text-green-700",
    dot: "bg-green-500",
  },
};

// Project Phase Options for filters/dropdowns (Current Workflow Phase)
export const PROJECT_PHASE_OPTIONS: FilterOption[] = [
  { value: "Project Kickoff", label: "Project Kickoff" },
  { value: "Design", label: "Design" },
  { value: "Procurement", label: "Procurement" },
  { value: "Site Work", label: "Site Work" },
  { value: "Installation", label: "Installation" },
  { value: "Handover", label: "Handover" },
];

// Payment Status Colors & Labels
export const PAYMENT_STATUS_COLORS: Record<
  ProjectPaymentStatus,
  { bg: string; text: string; dot: string }
> = {
  not_started: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-500" },
  pending: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  partial: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  due: { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
  overdue: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
  paid: { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  waived: { bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500" },
  disputed: { bg: "bg-pink-100", text: "text-pink-700", dot: "bg-pink-500" },
};

// Payment Status Options for filters/dropdowns
export const PAYMENT_STATUS_OPTIONS: FilterOption[] = [
  { value: "not_started", label: "Not Started" },
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial" },
  { value: "due", label: "Due" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "waived", label: "Waived" },
  { value: "disputed", label: "Disputed" },
];


// Project Category Colors & Labels
export const PROJECT_CATEGORY_COLORS: Record<ProjectCategory, string> = {
  turnkey: "bg-blue-100 text-blue-700",
  modular: "bg-purple-100 text-purple-700",
  renovation: "bg-amber-100 text-amber-700",
  consultation: "bg-green-100 text-green-700",
  commercial_fitout: "bg-orange-100 text-orange-700",
  hybrid: "bg-pink-100 text-pink-700",
  other: "bg-slate-100 text-slate-700",
};

export const PROJECT_CATEGORY_OPTIONS: FilterOption[] = [
  { value: "turnkey", label: "Turnkey (Full Interior)" },
  { value: "modular", label: "Modular (Kitchen/Wardrobe)" },
  { value: "renovation", label: "Renovation" },
  { value: "consultation", label: "Consultation Only" },
  { value: "commercial_fitout", label: "Commercial Fit-out" },
  { value: "hybrid", label: "Hybrid (Turnkey + Modular)" },
  { value: "other", label: "Other" },
];

// Project Type Options
export const PROJECT_TYPE_OPTIONS: FilterOption[] = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "hospitality", label: "Hospitality" },
  { value: "retail", label: "Retail" },
  { value: "office", label: "Office" },
  { value: "villa", label: "Villa" },
  { value: "apartment", label: "Apartment" },
  { value: "other", label: "Other" },
];

// Property Type Options
export const PROPERTY_TYPE_OPTIONS = [
  { value: "apartment_gated", label: "Apartment - Gated Community" },
  { value: "apartment_non_gated", label: "Apartment - Non Gated" },
  { value: "villa_gated", label: "Villa - Gated Community" },
  { value: "villa_non_gated", label: "Villa - Non Gated" },
  { value: "independent_house", label: "Independent House" },
  { value: "commercial_office", label: "Commercial - Office" },
  { value: "commercial_retail", label: "Commercial - Retail" },
  { value: "commercial_restaurant", label: "Commercial - Restaurant/Cafe" },
  { value: "commercial_other", label: "Commercial - Other" },
  { value: "unknown", label: "Unknown" },
];

// Phase Status Colors
export const PHASE_STATUS_COLORS: Record<ProjectPhaseStatus, string> = {
  not_started: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  on_hold: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  blocked: "bg-orange-100 text-orange-700",
};

// Sub Phase Status Colors
export const SUB_PHASE_STATUS_COLORS: Record<ProjectSubPhaseStatus, string> =
  {
    not_started: "bg-slate-100 text-slate-700",
    in_progress: "bg-blue-100 text-blue-700",
    on_hold: "bg-amber-100 text-amber-700",
    completed: "bg-green-100 text-green-700",
    skipped: "bg-slate-200 text-slate-600",
  };

// Standard 6 Project Phases Configuration
export const STANDARD_PHASES = [
  {
    name: "Project Kickoff",
    display_order: 1,
    estimated_duration_days: 7,
    description:
      "Initial setup, team alignment, and site survey",
  },
  {
    name: "Design",
    display_order: 2,
    estimated_duration_days: 23,
    description:
      "Design development, client reviews, and CAD drafts",
  },
  {
    name: "Procurement",
    display_order: 3,
    estimated_duration_days: 30,
    description:
      "Material sourcing, approvals, and purchasing",
  },
  {
    name: "Site Work",
    display_order: 4,
    estimated_duration_days: 30,
    description:
      "Construction, structural changes, and installations",
  },
  {
    name: "Installation",
    display_order: 5,
    estimated_duration_days: 0, // Variable
    description:
      "Furnishings, finishes, and final installations",
  },
  {
    name: "Handover",
    display_order: 6,
    estimated_duration_days: 5,
    description:
      "Final walkthrough, snag list, and client acceptance",
  },
];

// Team member interface for dropdowns
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
}

// Tabs configuration
export type ProjectDetailTabType =
  | "overview"
  | "management"
  | "notes"
  | "documents"
  | "tasks"
  | "rooms"
  | "quotations"
  | "calendar"
  | "timeline";

export const PROJECT_DETAIL_TABS: Array<{
  id: ProjectDetailTabType;
  label: string;
  icon: string;
}> = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "management", label: "Management", icon: "settings" },
  { id: "tasks", label: "Tasks", icon: "clipboard" },
  { id: "rooms", label: "Rooms", icon: "square" },
  { id: "notes", label: "Notes", icon: "message" },
  { id: "documents", label: "Documents", icon: "file" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "quotations", label: "Quotations", icon: "file-text" },
  { id: "timeline", label: "Timeline", icon: "trending-up" },
];
