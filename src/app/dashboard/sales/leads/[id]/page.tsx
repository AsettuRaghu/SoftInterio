"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import type {
  Lead,
  LeadStage,
  LeadActivity,
  LeadActivityType,
  LeadNote,
  LeadStageHistory,
  LeadFamilyMember,
  BudgetRange,
  ServiceType,
  LeadSource,
  DisqualificationReason,
  LostReason,
  PropertyType,
  PropertyCategory,
  PropertySubtype,
} from "@/types/leads";
import type { Task, TaskPriority, TaskStatus } from "@/types/tasks";
import type { DocumentWithUrl, Document } from "@/types/documents";
import {
  TaskPriorityColors,
  TaskStatusColors,
  TaskStatusLabels,
  TaskPriorityLabels,
} from "@/types/tasks";
import { CreateTaskModal, EditTaskModal } from "@/components/tasks";
import {
  AddDocumentModal,
  DocumentList,
  DocumentPreviewModal,
} from "@/components/documents";
import {
  LeadStageLabels,
  LeadStageColors,
  PropertyTypeLabels,
  PropertyCategoryLabels,
  PropertySubtypeLabels,
  PropertyTypesByCategory,
  PropertySubtypesByCategory,
  ServiceTypeLabels,
  LeadSourceLabels,
  BudgetRangeLabels,
  LeadActivityTypeLabels,
  DisqualificationReasonLabels,
  LostReasonLabels,
  ValidStageTransitions,
  getRequiredFieldsForTransition,
  LeadScoreLabels,
  LeadScoreColors,
} from "@/types/leads";
import {
  PageLayout,
  PageHeader,
  PageContent,
  StatusBadge,
} from "@/components/ui/PageLayout";
import { UserGroupIcon } from "@heroicons/react/24/outline";
import { MeetingCard } from "./components/MeetingCard";
import { AddNoteModal } from "./components/AddNoteModal";
import { EditLeadModal, type EditFormData } from "./components/EditLeadModal";
import { StageTransitionModal } from "./components/StageTransitionModal";
import { MeetingModal } from "./components/MeetingModal";

// Extended Task type with joined user data
interface TaskWithUser extends Task {
  assigned_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
    email: string;
  };
  created_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
    email: string;
  };
}

type TabType =
  | "overview"
  | "timeline"
  | "calendar"
  | "tasks"
  | "documents"
  | "notes"
  | "quotations";

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const leadId = params.id as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [stageHistory, setStageHistory] = useState<LeadStageHistory[]>([]);
  const [tasks, setTasks] = useState<TaskWithUser[]>([]);
  const [documents, setDocuments] = useState<DocumentWithUrl[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [previewDocument, setPreviewDocument] =
    useState<DocumentWithUrl | null>(null);
  const [familyMembers, setFamilyMembers] = useState<LeadFamilyMember[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [revisingId, setRevisingId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<
    { id: string; name: string; email: string; avatar_url?: string }[]
  >([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Modals
  const [showStageModal, setShowStageModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithUser | null>(null);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<LeadActivity | null>(
    null
  );
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Check if lead is in terminal (closed) stage - won, lost, or disqualified
  const isLeadClosed = lead
    ? ["won", "lost", "disqualified"].includes(lead.stage)
    : false;

  // Edit form state
  const [editForm, setEditForm] = useState({
    // Client data (from linked client record)
    client_name: "",
    phone: "",
    email: "",
    // Property data (from linked property record)
    property_name: "",
    unit_number: "",
    property_category: "",
    property_type: "",
    property_subtype: "",
    carpet_area: "",
    property_address: "",
    property_city: "",
    property_pincode: "",
    // Lead-specific fields
    service_type: "",
    lead_source: "",
    budget_range: "",
    estimated_value: "",
    project_scope: "",
    special_requirements: "",
    lead_score: "",
    target_start_date: "",
    target_end_date: "",
  });

  // Initialize edit form when lead is loaded
  useEffect(() => {
    if (lead) {
      setEditForm({
        // Client data from linked record
        client_name: lead.client?.name || "",
        phone: lead.client?.phone || "",
        email: lead.client?.email || "",
        // Property data from linked record
        property_name: lead.property?.property_name || "",
        unit_number: lead.property?.unit_number || "",
        property_category: lead.property?.category || "",
        property_type: lead.property?.property_type || "",
        property_subtype: lead.property?.property_subtype || "",
        carpet_area: lead.property?.carpet_area?.toString() || "",
        property_address: lead.property?.address_line1 || "",
        property_city: lead.property?.city || "",
        property_pincode: lead.property?.pincode || "",
        // Lead-specific fields
        service_type: lead.service_type || "",
        lead_source: lead.lead_source || "",
        budget_range: lead.budget_range || "",
        estimated_value: lead.estimated_value?.toString() || "",
        project_scope: lead.project_scope || "",
        special_requirements: lead.special_requirements || "",
        lead_score: lead.lead_score || "warm",
        target_start_date: lead.target_start_date || "",
        target_end_date: lead.target_end_date || "",
      });
    }
  }, [lead]);

  // Save edited lead
  const handleSaveEdit = async () => {
    if (!lead) return;

    try {
      setIsSaving(true);
      const response = await fetch(`/api/sales/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Client updates (will update linked client record)
          client_name: editForm.client_name,
          phone: editForm.phone,
          email: editForm.email || null,
          // Property updates (will update linked property record)
          property_name: editForm.property_name || null,
          unit_number: editForm.unit_number || null,
          property_category: editForm.property_category || null,
          property_type: editForm.property_type || null,
          property_subtype: editForm.property_subtype || null,
          carpet_area: editForm.carpet_area
            ? parseFloat(editForm.carpet_area)
            : null,
          property_address: editForm.property_address || null,
          property_city: editForm.property_city || null,
          property_pincode: editForm.property_pincode || null,
          // Lead-specific fields
          service_type: editForm.service_type || null,
          lead_source: editForm.lead_source || null,
          budget_range: editForm.budget_range || null,
          estimated_value: editForm.estimated_value
            ? parseFloat(editForm.estimated_value)
            : null,
          project_scope: editForm.project_scope || null,
          special_requirements: editForm.special_requirements || null,
          lead_score: editForm.lead_score || null,
          target_start_date: editForm.target_start_date || null,
          target_end_date: editForm.target_end_date || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update lead");
      }

      await fetchLead();
      setShowEditModal(false);
    } catch (err) {
      console.error("Error updating lead:", err);
      alert(err instanceof Error ? err.message : "Failed to update lead");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle creating a quotation revision
  const handleRevise = async (quotationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (revisingId) return; // Prevent double-clicks

    try {
      setRevisingId(quotationId);
      const response = await fetch(`/api/quotations/${quotationId}/revision`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create revision");
      }

      const data = await response.json();
      // Navigate to the new revision
      router.push(`/dashboard/quotations/${data.id}/edit`);
    } catch (err) {
      console.error("Error creating revision:", err);
      alert(err instanceof Error ? err.message : "Failed to create revision");
    } finally {
      setRevisingId(null);
    }
  };

  // Fetch lead data
  const fetchLead = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/sales/leads/${leadId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Lead not found");
        }
        throw new Error("Failed to fetch lead");
      }

      const data = await response.json();
      setLead(data.lead);
      setActivities(data.activities || []);
      setNotes(data.notes || []);
      setStageHistory(data.stageHistory || []);
      setTasks(data.tasks || []);
      setDocuments(data.documents || []);
      setFamilyMembers(data.familyMembers || []);
      setQuotations(data.quotations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  // Fetch team members for attendees dropdown
  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch("/api/team/members");
      const data = await response.json();
      if (response.ok && data.success && data.data) {
        setTeamMembers(
          data.data.map((m: any) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            avatar_url: m.avatar_url,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch team members:", err);
    }
  }, []);

  // Fetch documents from unified documents API
  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoadingDocuments(true);
      const response = await fetch(
        `/api/documents?linked_type=lead&linked_id=${leadId}`
      );
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [leadId]);

  // Handle document delete
  const handleDocumentDelete = useCallback(async (doc: Document) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      } else {
        throw new Error("Failed to delete document");
      }
    } catch (err) {
      console.error("Error deleting document:", err);
      alert("Failed to delete document");
    }
  }, []);

  useEffect(() => {
    fetchLead();
    fetchTeamMembers();
  }, [fetchLead, fetchTeamMembers]);

  // Fetch documents when tab changes to documents
  useEffect(() => {
    if (activeTab === "documents" && leadId) {
      fetchDocuments();
    }
  }, [activeTab, leadId, fetchDocuments]);

  // Open stage modal if query param is present
  useEffect(() => {
    if (searchParams.get("openStageModal") === "true" && lead && !isLoading) {
      setShowStageModal(true);
      // Clear the query param from URL without navigation
      router.replace(`/dashboard/sales/leads/${leadId}`, { scroll: false });
    }
  }, [searchParams, lead, isLoading, leadId, router]);

  // Format helpers
  const formatCurrency = (amount: number | null) => {
    if (!amount) return "—";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Loading state
  if (isLoading) {
    return (
      <PageLayout isLoading loadingText="Loading lead details...">
        <></>
      </PageLayout>
    );
  }

  // Error state
  if (error || !lead) {
    return (
      <PageLayout>
        <PageHeader
          title="Lead Not Found"
          subtitle={error || "The requested lead could not be found"}
          breadcrumbs={[{ label: "Leads" }]}
          basePath={{ label: "Sales", href: "/dashboard/sales" }}
          icon={<UserGroupIcon className="w-5 h-5 text-white" />}
          iconBgClass="from-slate-400 to-slate-500"
        />
        <PageContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg
              className="w-16 h-16 text-slate-300 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-lg font-medium text-slate-900 mb-2">
              {error || "Lead not found"}
            </p>
            <Link
              href="/dashboard/sales/leads"
              className="text-blue-600 hover:underline"
            >
              ← Back to Leads
            </Link>
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  const stageColors = LeadStageColors[lead.stage];
  const possibleTransitions = ValidStageTransitions[lead.stage] || [];
  const isTerminalStage = possibleTransitions.length === 0;

  return (
    <PageLayout>
      <PageHeader
        title={lead.client?.name || "Unknown Client"}
        subtitle={`${lead.lead_number} • ${lead.client?.phone || ""}${
          lead.client?.email ? ` • ${lead.client.email}` : ""
        }`}
        breadcrumbs={[
          { label: "Leads", href: "/dashboard/sales/leads" },
          { label: lead.lead_number },
        ]}
        basePath={{ label: "Sales", href: "/dashboard/sales" }}
        icon={<UserGroupIcon className="w-5 h-5 text-white" />}
        iconBgClass="from-blue-500 to-blue-600"
        stats={
          <div className="flex items-center gap-4">
            {/* Stage Progress Indicator */}
            <div className="flex items-center gap-1">
              {(
                [
                  "new",
                  "qualified",
                  "requirement_discussion",
                  "proposal_discussion",
                  "won",
                ] as LeadStage[]
              ).map((stage, index, arr) => {
                const isActive = stage === lead.stage;
                const isPast = arr.indexOf(lead.stage) > index;
                const isLostOrDisqualified =
                  lead.stage === "lost" || lead.stage === "disqualified";

                return (
                  <React.Fragment key={stage}>
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isLostOrDisqualified
                          ? "bg-red-400"
                          : isActive
                          ? "bg-blue-600"
                          : isPast
                          ? "bg-green-500"
                          : "bg-slate-300"
                      }`}
                      title={LeadStageLabels[stage]}
                    />
                    {index < arr.length - 1 && (
                      <div
                        className={`w-4 h-0.5 ${
                          isPast ? "bg-green-500" : "bg-slate-200"
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <StatusBadge status={lead.stage} />
            {/* Lead Score Badge */}
            {lead.lead_score && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${
                  LeadScoreColors[lead.lead_score]?.bg || "bg-slate-100"
                } ${
                  LeadScoreColors[lead.lead_score]?.text || "text-slate-700"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    LeadScoreColors[lead.lead_score]?.dot || "bg-slate-500"
                  }`}
                />
                {LeadScoreLabels[lead.lead_score] || lead.lead_score}
              </span>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            {!isTerminalStage && (
              <>
                <button
                  onClick={() => setShowNoteModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Note
                </button>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => setShowStageModal(true)}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Change Stage
                </button>
              </>
            )}
          </div>
        }
      />

      <PageContent noPadding>
        <div className="space-y-4 p-4">
          {/* Lost/Disqualified Notice */}
          {(lead.stage === "lost" || lead.stage === "disqualified") && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                <strong>
                  {lead.stage === "lost" ? "Lost" : "Disqualified"}:
                </strong>{" "}
                {lead.stage === "lost"
                  ? LostReasonLabels[lead.lost_reason!]
                  : DisqualificationReasonLabels[lead.disqualification_reason!]}
                {(lead.lost_notes || lead.disqualification_notes) &&
                  ` - ${lead.lost_notes || lead.disqualification_notes}`}
              </p>
            </div>
          )}

          {/* Tabs */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="border-b border-slate-200">
              <nav className="flex">
                {(
                  [
                    { id: "overview", label: "Overview" },
                    { id: "timeline", label: "Timeline" },
                    {
                      id: "calendar",
                      label: `Calendar (${
                        activities.filter(
                          (a) =>
                            a.activity_type === "meeting_scheduled" ||
                            a.activity_type === "meeting_completed" ||
                            a.activity_type === "site_visit" ||
                            a.activity_type === "client_meeting" ||
                            a.activity_type === "internal_meeting"
                        ).length
                      })`,
                    },
                    { id: "tasks", label: `Tasks (${tasks.length})` },
                    {
                      id: "documents",
                      label: `Documents (${documents.length})`,
                    },
                    { id: "notes", label: `Notes (${notes.length})` },
                    {
                      id: "quotations",
                      label: `Quotations (${quotations.length})`,
                    },
                  ] as { id: TabType; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-5 py-3 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-5">
              {/* Overview Tab */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Main Content Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Client & Contact Info */}
                    <div className="space-y-5">
                      {/* Client Information Card */}
                      <div className="bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                              </svg>
                            </span>
                            Client Details
                          </h3>
                          {isLeadClosed && (
                            <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-md">
                              Read Only
                            </span>
                          )}
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-100">
                            <div className="w-12 h-12 rounded-full bg-linear-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center text-lg font-bold">
                              {getInitials(lead.client?.name || "?")}
                            </div>
                            <div>
                              <p className="text-base font-semibold text-slate-900">
                                {lead.client?.name || "Unknown"}
                              </p>
                              <p className="text-sm text-slate-500">
                                Lead #{lead.lead_number}
                              </p>
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <div className="flex items-center gap-3 p-2.5 bg-white rounded-lg border border-slate-100">
                              <svg
                                className="w-5 h-5 text-slate-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                />
                              </svg>
                              <span className="text-sm font-medium text-slate-700">
                                {lead.client?.phone || "—"}
                              </span>
                            </div>
                            <a
                              href={
                                lead.client?.email
                                  ? `mailto:${lead.client.email}`
                                  : undefined
                              }
                              className={`flex items-center gap-3 p-2.5 bg-white rounded-lg border border-slate-100 ${
                                lead.client?.email
                                  ? "hover:bg-blue-50 hover:border-blue-200"
                                  : ""
                              }`}
                            >
                              <svg
                                className="w-5 h-5 text-slate-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                              </svg>
                              <span className="text-sm font-medium text-slate-700 truncate">
                                {lead.client?.email || "—"}
                              </span>
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Lead Attributes Card */}
                      <div className="bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                                />
                              </svg>
                            </span>
                            Lead Attributes
                          </h3>
                          {isLeadClosed && (
                            <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-md">
                              Read Only
                            </span>
                          )}
                        </div>
                        <dl className="space-y-3">
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <dt className="text-sm text-slate-500">
                              Service Type
                            </dt>
                            <dd className="text-sm font-semibold text-slate-900">
                              {lead.service_type
                                ? ServiceTypeLabels[lead.service_type]
                                : "—"}
                            </dd>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <dt className="text-sm text-slate-500">
                              Lead Source
                            </dt>
                            <dd className="text-sm font-semibold text-slate-900">
                              {lead.lead_source
                                ? LeadSourceLabels[lead.lead_source]
                                : "—"}
                            </dd>
                          </div>
                          {lead.lead_source_detail && (
                            <div className="flex justify-between items-center py-2 border-b border-slate-100">
                              <dt className="text-sm text-slate-500">
                                Source Detail
                              </dt>
                              <dd className="text-sm font-semibold text-slate-900">
                                {lead.lead_source_detail}
                              </dd>
                            </div>
                          )}
                          <div className="flex justify-between items-center py-2">
                            <dt className="text-sm text-slate-500">
                              Lead Score
                            </dt>
                            <dd>
                              <span
                                className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                  LeadScoreColors[lead.lead_score]?.bg ||
                                  "bg-slate-100"
                                } ${
                                  LeadScoreColors[lead.lead_score]?.text ||
                                  "text-slate-700"
                                }`}
                              >
                                {LeadScoreLabels[lead.lead_score] ||
                                  lead.lead_score ||
                                  "Warm"}
                              </span>
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>

                    {/* Middle Column - Property & Assignment */}
                    <div className="space-y-5">
                      {/* Property Information Card */}
                      <div className="bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                />
                              </svg>
                            </span>
                            Property Details
                          </h3>
                          {isLeadClosed && (
                            <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-md">
                              Read Only
                            </span>
                          )}
                        </div>
                        <dl className="space-y-3">
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <dt className="text-sm text-slate-500">Category</dt>
                            <dd className="text-sm font-semibold text-slate-900">
                              {lead.property?.category
                                ? PropertyCategoryLabels[lead.property.category]
                                : "—"}
                            </dd>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <dt className="text-sm text-slate-500">
                              Property Type
                            </dt>
                            <dd className="text-sm font-semibold text-slate-900">
                              {lead.property?.property_type
                                ? PropertyTypeLabels[
                                    lead.property.property_type
                                  ]
                                : "—"}
                            </dd>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <dt className="text-sm text-slate-500">
                              Community Type
                            </dt>
                            <dd className="text-sm font-semibold text-slate-900">
                              {lead.property?.property_subtype
                                ? PropertySubtypeLabels[
                                    lead.property.property_subtype
                                  ]
                                : "—"}
                            </dd>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <dt className="text-sm text-slate-500">
                              Property Name
                            </dt>
                            <dd className="text-sm font-semibold text-slate-900">
                              {lead.property?.property_name || "—"}
                            </dd>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <dt className="text-sm text-slate-500">
                              Flat/Unit
                            </dt>
                            <dd className="text-sm font-semibold text-slate-900">
                              {lead.property?.unit_number || "—"}
                            </dd>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <dt className="text-sm text-slate-500">
                              Carpet Area
                            </dt>
                            <dd className="text-sm font-semibold text-slate-900">
                              {lead.property?.carpet_area
                                ? `${lead.property.carpet_area.toLocaleString()} sq.ft`
                                : "—"}
                            </dd>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <dt className="text-sm text-slate-500">City</dt>
                            <dd className="text-sm font-semibold text-slate-900">
                              {lead.property?.city || "—"}
                            </dd>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <dt className="text-sm text-slate-500">Pincode</dt>
                            <dd className="text-sm font-semibold text-slate-900">
                              {lead.property?.pincode || "—"}
                            </dd>
                          </div>
                          {lead.property?.address_line1 && (
                            <div className="pt-2">
                              <dt className="text-sm text-slate-500 mb-1">
                                Full Address
                              </dt>
                              <dd className="text-sm font-medium text-slate-700 bg-slate-50 rounded-lg p-2">
                                {lead.property?.address_line1}
                              </dd>
                            </div>
                          )}
                        </dl>
                      </div>

                      {/* Assignment Card */}
                      <div className="bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-5">
                        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                          <span className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                              />
                            </svg>
                          </span>
                          Assignment
                        </h3>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                            <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center text-sm font-bold">
                              {lead.assigned_user
                                ? getInitials(lead.assigned_user.name)
                                : "?"}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {lead.assigned_user?.name || "Unassigned"}
                              </p>
                              <p className="text-xs text-blue-600">
                                Assigned To
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="w-10 h-10 rounded-full bg-linear-to-br from-slate-400 to-slate-600 text-white flex items-center justify-center text-sm font-bold">
                              {lead.created_user
                                ? getInitials(lead.created_user.name)
                                : "?"}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {lead.created_user?.name || "Unknown"}
                              </p>
                              <p className="text-xs text-slate-500">
                                Created By
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Budget & Timeline */}
                    <div className="space-y-5">
                      {/* Budget & Value Card */}
                      <div className="bg-linear-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                            </span>
                            Budget & Value
                          </h3>
                          {isLeadClosed && (
                            <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-md">
                              Read Only
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white rounded-lg p-3 border border-emerald-100">
                            <p className="text-xs text-slate-500 mb-0.5">
                              Est. Value
                            </p>
                            <p className="text-lg font-bold text-emerald-700">
                              {formatCurrency(lead.estimated_value)}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-emerald-100">
                            <p className="text-xs text-slate-500 mb-0.5">
                              Budget
                            </p>
                            <p className="text-sm font-semibold text-slate-900">
                              {lead.budget_range
                                ? BudgetRangeLabels[lead.budget_range]
                                : "—"}
                            </p>
                          </div>
                          {lead.won_amount && (
                            <div className="col-span-2 bg-green-100 rounded-lg p-3 border border-green-200">
                              <p className="text-xs text-green-700 mb-0.5">
                                Won Amount
                              </p>
                              <p className="text-lg font-bold text-green-800">
                                {formatCurrency(lead.won_amount)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Timeline Card */}
                      <div className="bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                            </span>
                            Timeline
                          </h3>
                          {isLeadClosed && (
                            <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-md">
                              Read Only
                            </span>
                          )}
                        </div>
                        <dl className="space-y-3">
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <dt className="text-sm text-slate-500">Created</dt>
                            <dd className="text-sm font-semibold text-slate-900">
                              {formatDateTime(lead.created_at)}
                            </dd>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <dt className="text-sm text-slate-500">
                              Last Updated
                            </dt>
                            <dd className="text-sm font-semibold text-slate-900">
                              {formatDateTime(lead.updated_at)}
                            </dd>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <dt className="text-sm text-slate-500">
                              Last Activity
                            </dt>
                            <dd className="text-sm font-semibold text-slate-900">
                              {formatDateTime(lead.last_activity_at)}
                            </dd>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <dt className="text-sm text-slate-500">
                              Stage Changed
                            </dt>
                            <dd className="text-sm font-semibold text-slate-900">
                              {formatDateTime(lead.stage_changed_at)}
                            </dd>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <dt className="text-sm text-slate-500">
                              Target Start
                            </dt>
                            <dd className="text-sm font-semibold text-slate-900">
                              {formatDate(lead.target_start_date)}
                            </dd>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <dt className="text-sm text-slate-500">
                              Target End
                            </dt>
                            <dd className="text-sm font-semibold text-slate-900">
                              {formatDate(lead.target_end_date)}
                            </dd>
                          </div>
                          {lead.next_followup_date && (
                            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 mt-2">
                              <p className="text-xs text-amber-600 font-medium">
                                Next Follow-up
                              </p>
                              <p className="text-sm font-bold text-amber-800">
                                {formatDate(lead.next_followup_date)}
                              </p>
                              {lead.next_followup_notes && (
                                <p className="text-xs text-amber-700 mt-1">
                                  {lead.next_followup_notes}
                                </p>
                              )}
                            </div>
                          )}
                        </dl>
                      </div>
                    </div>
                  </div>

                  {/* Project Scope & Special Requirements - Full Width */}
                  {(lead.project_scope || lead.special_requirements) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {lead.project_scope && (
                        <div className="bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-5">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                              <span className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                  />
                                </svg>
                              </span>
                              Project Scope
                            </h3>
                          </div>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">
                            {lead.project_scope}
                          </p>
                        </div>
                      )}
                      {lead.special_requirements && (
                        <div className="bg-linear-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-5">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                              <span className="w-8 h-8 rounded-lg bg-pink-100 text-pink-700 flex items-center justify-center">
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                  />
                                </svg>
                              </span>
                              Special Requirements
                            </h3>
                          </div>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">
                            {lead.special_requirements}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Timeline Tab */}
              {activeTab === "timeline" && (
                <div className="space-y-3">
                  {activities.length === 0 && stageHistory.length === 0 ? (
                    <div className="text-center py-8 text-sm text-slate-500">
                      No activity recorded yet
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[
                        ...activities.map((a) => ({
                          ...a,
                          type: "activity" as const,
                        })),
                        ...stageHistory.map((s) => ({
                          ...s,
                          type: "stage" as const,
                        })),
                      ]
                        .sort(
                          (a, b) =>
                            new Date(b.created_at).getTime() -
                            new Date(a.created_at).getTime()
                        )
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex gap-4 p-4 bg-slate-50 rounded-lg"
                          >
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                                item.type === "stage"
                                  ? "bg-purple-100 text-purple-600"
                                  : "bg-blue-100 text-blue-600"
                              }`}
                            >
                              {item.type === "stage" ? (
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900">
                                {item.type === "stage"
                                  ? `Stage changed to ${
                                      LeadStageLabels[
                                        (item as LeadStageHistory).to_stage
                                      ]
                                    }`
                                  : (item as LeadActivity).title}
                              </p>
                              {item.type === "activity" &&
                                (item as LeadActivity).description && (
                                  <p className="text-xs text-slate-600 mt-1">
                                    {(item as LeadActivity).description}
                                  </p>
                                )}
                              <p className="text-xs text-slate-400 mt-1.5">
                                {formatDateTime(item.created_at)}
                                {item.type === "stage" &&
                                  (item as LeadStageHistory).changed_user && (
                                    <>
                                      {" "}
                                      by{" "}
                                      {
                                        (item as LeadStageHistory).changed_user
                                          ?.name
                                      }
                                    </>
                                  )}
                                {item.type === "activity" &&
                                  (item as LeadActivity).created_user && (
                                    <>
                                      {" "}
                                      by{" "}
                                      {
                                        (item as LeadActivity).created_user
                                          ?.name
                                      }
                                    </>
                                  )}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Calendar Tab */}
              {activeTab === "calendar" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-bold text-slate-900">
                      Meetings & Site Visits
                    </h3>
                    {!isLeadClosed && (
                      <button
                        onClick={() => {
                          setEditingMeeting(null);
                          setShowMeetingModal(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                        Schedule Meeting
                      </button>
                    )}
                  </div>

                  {(() => {
                    const meetings = activities.filter(
                      (a) =>
                        a.activity_type === "meeting_scheduled" ||
                        a.activity_type === "meeting_completed" ||
                        a.activity_type === "site_visit" ||
                        a.activity_type === "client_meeting" ||
                        a.activity_type === "internal_meeting"
                    );

                    // Separate into upcoming and past
                    const now = new Date();
                    const upcoming = meetings
                      .filter(
                        (m) =>
                          m.meeting_scheduled_at &&
                          new Date(m.meeting_scheduled_at) >= now &&
                          !m.meeting_completed
                      )
                      .sort(
                        (a, b) =>
                          new Date(a.meeting_scheduled_at!).getTime() -
                          new Date(b.meeting_scheduled_at!).getTime()
                      );
                    const past = meetings
                      .filter(
                        (m) =>
                          !m.meeting_scheduled_at ||
                          new Date(m.meeting_scheduled_at) < now ||
                          m.meeting_completed
                      )
                      .sort(
                        (a, b) =>
                          new Date(b.created_at).getTime() -
                          new Date(a.created_at).getTime()
                      );

                    if (meetings.length === 0) {
                      return (
                        <div className="text-center py-12">
                          <svg
                            className="w-16 h-16 text-slate-300 mx-auto mb-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <p className="text-base font-medium text-slate-700 mb-2">
                            No meetings scheduled yet
                          </p>
                          <p className="text-sm text-slate-500 max-w-sm mx-auto">
                            Schedule a meeting or site visit with the customer
                            to track your interactions.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-6">
                        {/* Upcoming Meetings */}
                        {upcoming.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                              Upcoming ({upcoming.length})
                            </h4>
                            <div className="space-y-3">
                              {upcoming.map((meeting) => (
                                <MeetingCard
                                  key={meeting.id}
                                  meeting={meeting}
                                  onEdit={() => {
                                    setEditingMeeting(meeting);
                                    setShowMeetingModal(true);
                                  }}
                                  onComplete={async () => {
                                    try {
                                      await fetch(
                                        `/api/sales/leads/${leadId}/activities?activityId=${meeting.id}`,
                                        {
                                          method: "PATCH",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            meeting_completed: true,
                                          }),
                                        }
                                      );
                                      fetchLead();
                                    } catch (err) {
                                      console.error(
                                        "Error completing meeting:",
                                        err
                                      );
                                    }
                                  }}
                                  formatDateTime={formatDateTime}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Past Meetings */}
                        {past.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                              <span className="w-2 h-2 bg-slate-400 rounded-full"></span>
                              Past ({past.length})
                            </h4>
                            <div className="space-y-3">
                              {past.map((meeting) => (
                                <MeetingCard
                                  key={meeting.id}
                                  meeting={meeting}
                                  onEdit={() => {
                                    setEditingMeeting(meeting);
                                    setShowMeetingModal(true);
                                  }}
                                  isPast
                                  formatDateTime={formatDateTime}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Notes Tab */}
              {activeTab === "notes" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-bold text-slate-900">
                      Notes
                    </h3>
                    {!isLeadClosed && (
                      <button
                        onClick={() => setShowNoteModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        + Add Note
                      </button>
                    )}
                  </div>
                  {notes.length === 0 ? (
                    <div className="text-center py-8 text-sm text-slate-500">
                      No notes yet
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notes.map((note) => (
                        <div
                          key={note.id}
                          className="p-4 bg-slate-50 rounded-lg"
                        >
                          {note.is_pinned && (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 mb-2">
                              <svg
                                className="w-3 h-3"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z" />
                              </svg>
                              Pinned
                            </span>
                          )}
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">
                            {note.content}
                          </p>
                          <p className="text-xs text-slate-400 mt-2">
                            {formatDateTime(note.created_at)} by{" "}
                            {note.created_user?.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tasks Tab */}
              {activeTab === "tasks" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-bold text-slate-900">
                      Tasks
                    </h3>
                    {!isLeadClosed && (
                      <button
                        onClick={() => setShowTaskModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                        Add Task
                      </button>
                    )}
                  </div>
                  {tasks.length === 0 ? (
                    <div className="text-center py-12">
                      <svg
                        className="w-16 h-16 text-slate-300 mx-auto mb-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        />
                      </svg>
                      <p className="text-base font-medium text-slate-700 mb-2">
                        No tasks yet
                      </p>
                      <p className="text-sm text-slate-500 mb-4">
                        Create tasks to track work for this lead
                      </p>
                      <button
                        onClick={() => setShowTaskModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        Create First Task
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tasks.map((task) => {
                        const priorityColor = task.priority
                          ? TaskPriorityColors[task.priority as TaskPriority]
                          : null;
                        const statusColor =
                          TaskStatusColors[task.status as TaskStatus];
                        const isOverdue =
                          task.due_date &&
                          new Date(task.due_date) < new Date() &&
                          task.status !== "completed" &&
                          task.status !== "cancelled";

                        return (
                          <div
                            key={task.id}
                            onClick={() => setEditingTask(task)}
                            className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group"
                          >
                            {/* Status indicator */}
                            <div
                              className={`w-2 h-2 rounded-full ${
                                statusColor?.dot || "bg-slate-400"
                              }`}
                            />

                            {/* Task content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p
                                  className={`text-sm font-medium ${
                                    task.status === "completed"
                                      ? "text-slate-400 line-through"
                                      : "text-slate-900"
                                  }`}
                                >
                                  {task.title}
                                </p>
                                {task.task_number && (
                                  <span className="text-xs text-slate-400">
                                    #{task.task_number}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                {/* Status badge */}
                                <span
                                  className={`px-2 py-0.5 text-xs font-medium rounded ${statusColor?.bg} ${statusColor?.text}`}
                                >
                                  {TaskStatusLabels[task.status as TaskStatus]}
                                </span>

                                {/* Due date */}
                                {task.due_date && (
                                  <span
                                    className={`text-xs ${
                                      isOverdue
                                        ? "text-red-600 font-medium"
                                        : "text-slate-500"
                                    }`}
                                  >
                                    {isOverdue && "⚠️ "}Due:{" "}
                                    {formatDate(task.due_date)}
                                  </span>
                                )}

                                {/* Assignee */}
                                {task.assigned_user && (
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                    {task.assigned_user.avatar_url ? (
                                      <img
                                        src={task.assigned_user.avatar_url}
                                        alt=""
                                        className="w-4 h-4 rounded-full"
                                      />
                                    ) : (
                                      <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-medium text-slate-600">
                                        {task.assigned_user.name?.charAt(0) ||
                                          "?"}
                                      </span>
                                    )}
                                    {task.assigned_user.name}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Priority badge */}
                            {task.priority && priorityColor && (
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded ${priorityColor.bg} ${priorityColor.text}`}
                              >
                                {
                                  TaskPriorityLabels[
                                    task.priority as TaskPriority
                                  ]
                                }
                              </span>
                            )}

                            {/* Edit hint on hover */}
                            <svg
                              className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Documents Tab */}
              {activeTab === "documents" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-bold text-slate-900">
                      Documents
                    </h3>
                    {!isLeadClosed && (
                      <button
                        onClick={() => setShowDocumentModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                        Add Document
                      </button>
                    )}
                  </div>

                  {/* Document List */}
                  <DocumentList
                    documents={documents}
                    onDelete={handleDocumentDelete}
                    onPreview={(doc) => setPreviewDocument(doc)}
                    isLoading={isLoadingDocuments}
                    emptyMessage="No documents uploaded yet. Click 'Add Document' to upload your first document."
                    viewMode="list"
                    showCategory
                    showUploader
                  />
                </div>
              )}

              {/* Document Modals */}
              <AddDocumentModal
                isOpen={showDocumentModal}
                onClose={() => setShowDocumentModal(false)}
                onSuccess={() => {
                  fetchDocuments();
                }}
                linkedType="lead"
                linkedId={leadId}
              />
              <DocumentPreviewModal
                document={previewDocument}
                isOpen={!!previewDocument}
                onClose={() => setPreviewDocument(null)}
              />

              {/* Quotations Tab */}
              {activeTab === "quotations" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-bold text-slate-900">
                      Quotations
                    </h3>
                  </div>

                  {/* Info message - only show when no quotations exist */}
                  {quotations.length === 0 && (
                    <p className="text-sm text-slate-500 italic">
                      Quotations are created automatically when this lead moves
                      to the Proposal & Negotiation stage.
                    </p>
                  )}

                  {quotations.length === 0 ? (
                    <div className="text-center py-12">
                      <svg
                        className="w-16 h-16 text-slate-300 mx-auto mb-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p className="text-base font-medium text-slate-700 mb-2">
                        No quotations yet
                      </p>
                      <p className="text-sm text-slate-500 max-w-sm mx-auto">
                        {lead.stage === "new" ||
                        lead.stage === "qualified" ||
                        lead.stage === "requirement_discussion"
                          ? "Move this lead to Proposal & Negotiation stage to auto-create the first quotation."
                          : "A quotation will be created when the lead moves to Proposal & Negotiation."}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                                Quote #
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                                Version
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                                Amount
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                                Status
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                                Valid Until
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                                Created
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                                Assigned To
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {quotations.map((quote) => (
                              <tr
                                key={quote.id}
                                className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                                onClick={() =>
                                  router.push(
                                    `/dashboard/quotations/${quote.id}`
                                  )
                                }
                              >
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
                                    {quote.quotation_number ||
                                      `#${quote.id.slice(0, 8)}`}
                                  </p>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                                    v{quote.version || 1}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div>
                                    <p className="font-semibold text-sm text-slate-900">
                                      {formatCurrency(
                                        quote.grand_total || quote.total_amount
                                      )}
                                    </p>
                                    {quote.discount_amount &&
                                      quote.discount_amount > 0 && (
                                        <p className="text-xs text-green-600">
                                          -
                                          {formatCurrency(
                                            quote.discount_amount
                                          )}{" "}
                                          off
                                        </p>
                                      )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                      quote.status === "approved"
                                        ? "bg-green-100 text-green-700"
                                        : quote.status === "sent"
                                        ? "bg-blue-100 text-blue-700"
                                        : quote.status === "rejected"
                                        ? "bg-red-100 text-red-700"
                                        : quote.status === "expired"
                                        ? "bg-orange-100 text-orange-700"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {quote.status?.charAt(0).toUpperCase() +
                                      quote.status?.slice(1) || "Draft"}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-sm text-slate-600">
                                    {formatDate(quote.valid_until)}
                                  </p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-sm text-slate-600">
                                    {formatDate(quote.created_at)}
                                  </p>
                                </td>
                                <td className="px-4 py-3">
                                  {quote.assigned_to_name ? (
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium shrink-0">
                                        {quote.assigned_to_name?.[0]?.toUpperCase()}
                                      </div>
                                      <span className="text-sm text-slate-700 truncate">
                                        {quote.assigned_to_name}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-slate-400 italic">
                                      —
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1">
                                    <Link
                                      href={`/dashboard/quotations/${quote.id}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                      title="View quotation"
                                    >
                                      <svg
                                        className="w-3.5 h-3.5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                        />
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                        />
                                      </svg>
                                      View
                                    </Link>
                                    {!isLeadClosed && (
                                      <>
                                        <Link
                                          href={`/dashboard/quotations/${quote.id}/edit`}
                                          onClick={(e) => e.stopPropagation()}
                                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                          title="Edit quotation"
                                        >
                                          <svg
                                            className="w-3.5 h-3.5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                            />
                                          </svg>
                                          Edit
                                        </Link>
                                        <button
                                          onClick={(e) =>
                                            handleRevise(quote.id, e)
                                          }
                                          disabled={revisingId === quote.id}
                                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 rounded transition-colors disabled:opacity-50"
                                          title="Create new revision"
                                        >
                                          {revisingId === quote.id ? (
                                            <div className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                                          ) : (
                                            <svg
                                              className="w-3.5 h-3.5"
                                              fill="none"
                                              viewBox="0 0 24 24"
                                              stroke="currentColor"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                              />
                                            </svg>
                                          )}
                                          Revise
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stage Transition Modal */}
          {showStageModal && (
            <StageTransitionModal
              lead={lead}
              quotations={quotations}
              onClose={() => setShowStageModal(false)}
              onSuccess={() => {
                setShowStageModal(false);
                fetchLead();
              }}
            />
          )}

          {/* Add Note Modal */}
          {showNoteModal && (
            <AddNoteModal
              leadId={lead.id}
              onClose={() => setShowNoteModal(false)}
              onSuccess={() => {
                setShowNoteModal(false);
                fetchLead();
              }}
            />
          )}

          {/* Edit Lead Modal */}
          {showEditModal && (
            <EditLeadModal
              lead={lead}
              editForm={editForm}
              setEditForm={setEditForm}
              onClose={() => setShowEditModal(false)}
              onSave={handleSaveEdit}
              isSaving={isSaving}
              validationError={null}
            />
          )}

          {/* Meeting Modal */}
          {showMeetingModal && (
            <MeetingModal
              leadId={lead.id}
              meeting={editingMeeting}
              teamMembers={teamMembers}
              clientEmail={lead.client?.email || undefined}
              onClose={() => {
                setShowMeetingModal(false);
                setEditingMeeting(null);
              }}
              onSuccess={() => {
                setShowMeetingModal(false);
                setEditingMeeting(null);
                fetchLead();
              }}
            />
          )}

          {/* Create Task Modal */}
          <CreateTaskModal
            isOpen={showTaskModal}
            onClose={() => setShowTaskModal(false)}
            onSuccess={() => {
              setShowTaskModal(false);
              fetchLead();
            }}
            defaultLinkedEntity={{
              type: "lead",
              id: lead.id,
              name: lead.client?.name || "This Lead",
            }}
          />

          {/* Edit Task Modal */}
          {editingTask && (
            <EditTaskModal
              task={{
                id: editingTask.id,
                task_number: editingTask.task_number,
                title: editingTask.title,
                description: editingTask.description,
                priority: editingTask.priority,
                status: editingTask.status,
                start_date: editingTask.start_date,
                due_date: editingTask.due_date,
                assigned_to: editingTask.assigned_to,
                assigned_to_name: editingTask.assigned_user?.name,
                assigned_to_email: editingTask.assigned_user?.email,
                assigned_to_avatar:
                  editingTask.assigned_user?.avatar_url || undefined,
                created_by: editingTask.created_by,
                created_by_name: editingTask.created_user?.name,
                related_type: editingTask.related_type,
                related_id: editingTask.related_id,
                related_name: lead.client?.name || "This Lead",
              }}
              isOpen={true}
              onClose={() => setEditingTask(null)}
              onUpdate={() => {
                setEditingTask(null);
                fetchLead();
              }}
            />
          )}
        </div>
      </PageContent>
    </PageLayout>
  );
}
