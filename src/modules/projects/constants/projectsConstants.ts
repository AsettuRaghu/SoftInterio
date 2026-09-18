import type {
  ProjectStatus,
  ProjectPriority,
  ProjectPaymentStatus,
  ProjectCategory,
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

// Team member interface for dropdowns
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
}

// Tab keys live in @/types/projects. A ProjectDetailTabType and a second
// PROJECT_DETAIL_TABS used to sit here, still listing a Rooms tab that no
// longer exists; nothing imported either.
