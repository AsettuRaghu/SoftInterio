// ============================================================================
// Procedures
//
// A Procedure is a predefined, ordered set of steps with completion gates,
// attached to a lead / project / quotation / client. It supersedes task
// templates, which could spawn tasks but enforce nothing.
//
// Every step IS a task, so steps inherit assignment, comments, attachments,
// timing and notifications rather than reimplementing them.
// ============================================================================

import type { TaskRelatedType, TaskStatus } from "./tasks";

export type ProcedureActionType =
  | "manual" // just mark it done
  | "upload" // evidence required
  | "checklist" // every item ticked
  | "form" // structured values captured
  | "approval" // someone else signs off
  | "assignment" // handed to a person or role
  | "meeting" // a scheduled event happened
  | "handover"; // responsibility passes between teams

export type ProcedureRunStatus = "active" | "completed" | "cancelled";

export const ProcedureActionLabels: Record<ProcedureActionType, string> = {
  manual: "Manual",
  upload: "Upload required",
  checklist: "Checklist",
  form: "Form",
  approval: "Approval",
  assignment: "Assignment",
  meeting: "Meeting",
  handover: "Handover",
};

/** Colour by what the step demands, so a run reads at a glance. */
export const ProcedureActionColors: Record<
  ProcedureActionType,
  { bg: string; text: string; border: string }
> = {
  manual: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
  upload: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
  checklist: { bg: "bg-teal-50", text: "text-teal-600", border: "border-teal-200" },
  form: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-200" },
  approval: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200" },
  assignment: { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-200" },
  meeting: { bg: "bg-pink-50", text: "text-pink-600", border: "border-pink-200" },
  handover: { bg: "bg-green-50", text: "text-green-600", border: "border-green-200" },
};

export interface ProcedureDefinition {
  id: string;
  tenant_id: string;
  tenant_type?: string | null;
  name: string;
  description?: string | null;
  version: number;
  applies_to: TaskRelatedType;
  is_active: boolean;
  is_protected: boolean;
  /** When true a step cannot start until its predecessors are settled. */
  enforce_order: boolean;
  created_at: string;
  updated_at: string;
  /** Convenience count from the list endpoint. */
  step_count?: number;
}

export interface ProcedureStepDefinition {
  id: string;
  definition_id: string;
  parent_step_id?: string | null;
  title: string;
  description?: string | null;
  instructions?: string | null;
  display_order: number;
  action_type: ProcedureActionType;
  form_schema?: Record<string, unknown> | null;
  required_upload_types?: string[] | null;
  approval_role?: string | null;
  assign_to_role?: string | null;
  /** How long the step takes; dates are derived from it. */
  duration_days?: number | null;
  /** @deprecated meant days after the run started - use duration_days. */
  relative_due_days?: number | null;
  estimated_hours?: number | null;
  is_required: boolean;
  can_skip: boolean;
  skip_requires_reason: boolean;
  allow_parallel: boolean;
}

export interface ProcedureRun {
  id: string;
  tenant_id: string;
  definition_id: string;
  /** Pinned at start: editing the definition cannot rewrite a live run. */
  definition_version: number;
  definition_name: string;
  related_type: TaskRelatedType;
  related_id: string;
  status: ProcedureRunStatus;
  started_by?: string | null;
  started_at: string;
  completed_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  // Rollups from the API
  total_steps?: number;
  settled_steps?: number;
  completed_steps?: number;
  skipped_steps?: number;
  progress_percent?: number;
}

export interface TaskCompletionRequirement {
  id: string;
  task_id: string;
  requirement_type: string;
  requirement_key: string;
  requirement_label?: string | null;
  is_required: boolean;
  is_satisfied: boolean;
  satisfied_at?: string | null;
  satisfied_by?: string | null;
}

/** A step task, joined with its definition and gates. */
export interface ProcedureRunStep {
  id: string;
  task_number: string;
  title: string;
  status: TaskStatus;
  parent_task_id?: string | null;
  assigned_to?: string | null;
  assigned_user?: { id: string; name: string; avatar_url?: string | null } | null;
  due_date?: string | null;
  hold_reason?: string | null;
  skip_reason?: string | null;
  action_type: ProcedureActionType;
  instructions?: string | null;
  can_skip: boolean;
  display_order: number;
  requirements: TaskCompletionRequirement[];
  unmet_requirements: number;
}
