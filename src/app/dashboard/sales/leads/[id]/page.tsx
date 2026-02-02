"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  Lead,
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
} from "@/types/leads";
import {
  PageLayout,
  PageHeader,
  PageContent,
  StatusBadge,
} from "@/components/ui/PageLayout";
import { UserGroupIcon } from "@heroicons/react/24/outline";
import { MeetingCard } from "@/modules/sales/components";
import { AddNoteModal, EditNoteModal } from "@/modules/sales/components";
import { EditLeadModal, type EditFormData } from "@/modules/sales/components";
import { StageTransitionModal } from "@/modules/sales/components";
import { MeetingModal } from "@/modules/sales/components";
import {
  useLeadDetail,
  type TaskWithUser,
} from "@/modules/sales/hooks/useLeadDetail";
import {
  isLeadClosed,
  LEAD_DETAIL_TABS,
} from "@/modules/sales/constants/leadDetailConstants";
import {
  OverviewTab,
  TimelineTab,
  CalendarTab,
  TasksTab,
  DocumentsTab,
  NotesTab,
  QuotationsTab,
} from "@/modules/sales/components/LeadDetailTabs";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getInitials,
} from "@/modules/sales/utils/formatters";

export default function LeadDetailPage() {
  const router = useRouter();

  // Use the lead detail hook
  const {
    lead,
    activities,
    notes,
    stageHistory,
    tasks,
    documents,
    familyMembers,
    quotations,
    teamMembers,
    previewDocument,
    isLoading,
    isLoadingDocuments,
    error,
    isSaving,
    revisingId,
    setPreviewDocument,
    setActivities,
    setNotes,
    setTasks,
    fetchLead,
    fetchTasks,
    fetchNotes,
    fetchActivities,
    refetchDocumentsForTab,
    handleSaveEdit,
    updateLeadFromStageTransition,
    handleRevise,
    handleDocumentDelete,
    handleAssigneeChange,
  } = useLeadDetail();

  // Local UI state
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "timeline"
    | "calendar"
    | "tasks"
    | "documents"
    | "notes"
    | "quotations"
  >("overview");
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
  const [editingNote, setEditingNote] = useState<LeadNote | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState<EditFormData>({
    client_name: "",
    phone: "",
    email: "",
    property_name: "",
    unit_number: "",
    property_category: "",
    property_type: "",
    property_subtype: "",
    carpet_area: "",
    property_address: "",
    property_city: "",
    property_pincode: "",
    service_type: "",
    lead_source: "",
    budget_range: "",
    target_start_date: "",
    target_end_date: "",
    priority: "",
    assigned_to: "",
  });

  // Handle submit with error handling
  const handleSubmitEdit = async () => {
    try {
      await handleSaveEdit(editForm);
      setShowEditModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update lead");
    }
  };

  // Handle revision with event object
  const handleReviseQuotation = async (
    quotationId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await handleRevise(quotationId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create revision");
    }
  };

  // Handle assignee change
  const handleAssigneeChangeWithError = async (userId: string | null) => {
    try {
      await handleAssigneeChange(userId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update assignee");
    }
  };

  // Fetch documents when tab changes
  useEffect(() => {
    if (activeTab === "documents") {
      refetchDocumentsForTab();
    }
  }, [activeTab, refetchDocumentsForTab]);

  // Populate edit form when modal opens and lead data is available
  useEffect(() => {
    if (showEditModal && lead) {
      setEditForm({
        client_name: lead.client?.name || "",
        phone: lead.client?.phone || "",
        email: lead.client?.email || "",
        property_name: lead.property?.property_name || "",
        unit_number: lead.property?.unit_number || "",
        property_category: lead.property?.category || "",
        property_type: lead.property?.property_type || "",
        property_subtype: lead.property?.property_subtype || "",
        carpet_area: lead.property?.carpet_area?.toString() || "",
        property_address: lead.property?.address_line1 || "",
        property_city: lead.property?.city || "",
        property_pincode: lead.property?.pincode || "",
        service_type: lead.service_type || "",
        lead_source: lead.lead_source || "",
        budget_range: lead.budget_range || "",
        target_start_date: lead.target_start_date || "",
        target_end_date: lead.target_end_date || "",
        priority: lead.priority || "",
        assigned_to: lead.assigned_to || "",
      });
    }
  }, [showEditModal, lead]);

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
  const leadClosed = isLeadClosed(lead.stage);

  return (
    <PageLayout>
      <PageHeader
        title={lead.client?.name || "Unknown Client"}
        subtitle={`${lead.client?.phone || ""}${
          lead.client?.phone && lead.client?.email ? " • " : ""
        }${lead.client?.email || ""}`}
        breadcrumbs={[
          { label: "Leads", href: "/dashboard/sales/leads" },
          { label: lead.lead_number || "—", href: "#" },
        ]}
        basePath={{ label: "Sales", href: "/dashboard/sales" }}
        icon={<UserGroupIcon className="w-5 h-5 text-white" />}
        iconBgClass="from-blue-500 to-blue-600"
        stats={
          <div className="flex items-center gap-4">
            {/* Stage Progress - Show active progression stages only */}
            <div className="flex items-center gap-1">
              {(
                [
                  "new",
                  "qualified",
                  "requirement_discussion",
                  "proposal_discussion",
                ] as const
              ).map((stage) => {
                const stageIndex = [
                  "new",
                  "qualified",
                  "requirement_discussion",
                  "proposal_discussion",
                ].indexOf(stage);
                const currentIndex = [
                  "new",
                  "qualified",
                  "requirement_discussion",
                  "proposal_discussion",
                ].indexOf(lead.stage);
                const isActive = stage === lead.stage;
                const isPassed =
                  stageIndex <= currentIndex &&
                  !["won", "lost", "disqualified"].includes(lead.stage);

                return (
                  <div key={stage} className="flex items-center">
                    <div
                      className={`h-2 w-8 rounded-full transition-colors ${
                        isActive
                          ? "bg-blue-600"
                          : isPassed
                          ? "bg-blue-300"
                          : "bg-slate-200"
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Stage Badge */}
            <div
              className={`px-3 py-1 rounded-full text-xs font-medium ${stageColors.bg} ${stageColors.text}`}
            >
              {LeadStageLabels[lead.stage]}
            </div>

            {/* Priority */}
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
              {lead.priority
                ? lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1)
                : "Normal"}
            </div>
          </div>
        }
        actions={
          !leadClosed && (
            <div className="flex gap-3">
              <button
                onClick={() => setShowEditModal(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
              >
                Edit Lead
              </button>
              <button
                onClick={() => setShowStageModal(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
              >
                Change Stage
              </button>
            </div>
          )
        }
      />

      <PageContent>
        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-6 -mx-6 px-6">
          {LEAD_DETAIL_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <OverviewTab
            lead={lead}
            activities={activities}
            leadClosed={leadClosed}
            onEditClick={() => setShowEditModal(true)}
            onAddMeetingClick={() => {
              setEditingMeeting(null);
              setShowMeetingModal(true);
            }}
            formatDateTime={formatDateTime}
          />
        )}

        {/* Timeline Tab */}
        {activeTab === "timeline" && (
          <TimelineTab
            activities={activities}
            stageHistory={stageHistory}
            formatDateTime={formatDateTime}
          />
        )}

        {/* Calendar Tab */}
        {activeTab === "calendar" && lead && (
          <CalendarTab
            activities={activities as any}
            leadId={lead.id}
            leadClosed={leadClosed}
            onAddEventClick={() => setShowMeetingModal(true)}
            onEditEvent={(event) => {
              // Find the activity and set it for editing
              const activity = activities.find((a) => a.id === event.id);
              if (activity) {
                setEditingMeeting(activity);
                setShowMeetingModal(true);
              }
            }}
            onRefresh={fetchLead}
          />
        )}

        {/* Tasks Tab */}
        {activeTab === "tasks" && lead && (
          <TasksTab
            tasks={tasks}
            leadId={lead.id}
            leadClosed={leadClosed}
            teamMembers={teamMembers}
            onEditTask={(task) => setEditingTask(task)}
            onAddTaskClick={() => setShowTaskModal(true)}
            onRefresh={fetchTasks}
          />
        )}

        {/* Documents Tab */}
        {activeTab === "documents" && lead && (
          <DocumentsTab
            documents={documents}
            isLoadingDocuments={isLoadingDocuments}
            leadId={lead.id}
            leadClosed={leadClosed}
            onPreviewDocument={setPreviewDocument}
            onDeleteDocument={handleDocumentDelete}
            onAddDocumentClick={() => setShowDocumentModal(true)}
            onRefresh={refetchDocumentsForTab}
          />
        )}

        {/* Notes Tab */}
        {activeTab === "notes" && (
          <NotesTab
            notes={notes}
            leadClosed={leadClosed}
            onAddNoteClick={() => setShowNoteModal(true)}
            onEditNote={(note) => setEditingNote(note)}
            formatDateTime={formatDateTime}
          />
        )}

        {/* Quotations Tab */}
        {activeTab === "quotations" && lead && (
          <QuotationsTab
            quotations={quotations}
            leadStage={lead.stage}
            leadClosed={leadClosed}
            onNavigateToQuotations={() => {
              // Navigate to quotations list page which will open the create modal
              router.push(
                `/dashboard/quotations?create=true&lead_id=${lead.id}`
              );
            }}
            onViewQuotation={(quotation) => {
              // Navigate to quotation view page
              router.push(`/dashboard/quotations/${quotation.id}`);
            }}
            onReviseQuotation={handleReviseQuotation}
            revisingId={revisingId}
          />
        )}

        {/* Modals */}
        {showEditModal && lead && (
          <EditLeadModal
            lead={lead}
            onClose={() => setShowEditModal(false)}
            editForm={editForm}
            setEditForm={setEditForm}
            isSaving={isSaving}
            onSave={handleSubmitEdit}
            validationError={null}
          />
        )}

        {showStageModal && lead && (
          <StageTransitionModal
            lead={lead}
            quotations={quotations}
            onClose={() => setShowStageModal(false)}
            onSuccess={() => {
              setShowStageModal(false);
              updateLeadFromStageTransition();
            }}
          />
        )}

        {showNoteModal && (
          <AddNoteModal
            onClose={() => setShowNoteModal(false)}
            onSuccess={() => {
              setShowNoteModal(false);
              fetchNotes();
            }}
            leadId={lead?.id}
          />
        )}

        {editingNote && (
          <EditNoteModal
            note={editingNote}
            onClose={() => setEditingNote(null)}
            onSuccess={() => {
              setEditingNote(null);
              fetchNotes();
            }}
          />
        )}

        {showMeetingModal && lead && (
          <MeetingModal
            leadId={lead.id}
            meeting={editingMeeting}
            onClose={() => {
              setShowMeetingModal(false);
              setEditingMeeting(null);
            }}
            onSuccess={() => {
              setShowMeetingModal(false);
              setEditingMeeting(null);
              fetchActivities();
            }}
            teamMembers={teamMembers}
          />
        )}

        {showDocumentModal && lead && (
          <AddDocumentModal
            isOpen={true}
            onClose={() => setShowDocumentModal(false)}
            onSuccess={() => {
              setShowDocumentModal(false);
              refetchDocumentsForTab();
            }}
            linkedType="lead"
            linkedId={lead.id}
          />
        )}

        {previewDocument && (
          <DocumentPreviewModal
            document={previewDocument}
            isOpen={!!previewDocument}
            onClose={() => setPreviewDocument(null)}
          />
        )}

        <CreateTaskModal
          isOpen={showTaskModal}
          onClose={() => setShowTaskModal(false)}
          onSuccess={() => {
            setShowTaskModal(false);
            fetchTasks();
          }}
          defaultLinkedEntity={{
            type: "lead",
            id: lead?.id || "",
            name:
              lead?.lead_number && lead?.client?.name
                ? `${lead.lead_number} • ${lead.client.name}`
                : lead?.client?.name || "This Lead",
          }}
        />

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
              related_name:
                lead?.lead_number && lead?.client?.name
                  ? `${lead.lead_number} • ${lead.client.name}`
                  : lead?.client?.name || "This Lead",
            }}
            isOpen={!!editingTask}
            onClose={() => setEditingTask(null)}
            onUpdate={() => {
              setEditingTask(null);
              fetchTasks();
            }}
          />
        )}
      </PageContent>
    </PageLayout>
  );
}
