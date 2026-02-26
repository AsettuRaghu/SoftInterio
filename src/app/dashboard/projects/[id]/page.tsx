"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ClockIcon,
  PauseIcon,
  XMarkIcon,
  CurrencyRupeeIcon,
  DocumentTextIcon,
  PlusIcon,
  LinkIcon,
  InformationCircleIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
  ShoppingCartIcon,
} from "@heroicons/react/24/outline";
import {
  Project,
  ProjectPhase,
  ProjectSubPhase,
  ProjectNote,
  ProjectDetailTab,
  ProjectCategoryLabels,
  ProjectStatusLabels,
  PaymentMilestoneStatusLabels,
} from "@/types/projects";
import {
  PageLayout,
  PageHeader,
  PageContent,
  StatusBadge,
} from "@/components/ui/PageLayout";
import {
  SubPhaseDetailPanel,
  ManagementTab,
  TasksTab,
  RoomsTab,
  NotesTab,
  OverviewTab,
  DocumentsTab,
  CalendarTab,
  TimelineTab,
  QuotationsTab,
  PhaseEditModal,
  SubPhaseEditModal,
  EditProjectModal,
  type EditProjectFormData,
} from "@/modules/projects/components";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { formatCurrency as formatCurrencyUtil } from "@/modules/projects/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

type TabKey = ProjectDetailTab;

// Status workflow for visual stepper
const STATUS_WORKFLOW = ["new", "in_progress", "completed"];

export default function ProjectDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useCurrentUser();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabKey>("project-mgmt");
  const [selectedSubPhase, setSelectedSubPhase] = useState<{
    phaseId: string;
    subPhaseId: string;
  } | null>(null);
  const [showSubPhasePanel, setShowSubPhasePanel] = useState(false);
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);

  // Phase/Sub-phase editing state
  const [editingPhase, setEditingPhase] = useState<ProjectPhase | null>(null);
  const [showPhaseEditModal, setShowPhaseEditModal] = useState(false);
  const [editingSubPhase, setEditingSubPhase] = useState<{
    subPhase: ProjectSubPhase;
    phaseId: string;
    phaseName: string;
  } | null>(null);
  const [showSubPhaseEditModal, setShowSubPhaseEditModal] = useState(false);

  // Project editing state
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editProjectForm, setEditProjectForm] = useState<EditProjectFormData>({
    name: "",
    description: "",
    status: "",
    project_category: "",
    expected_start_date: "",
    expected_end_date: "",
    actual_start_date: "",
    actual_end_date: "",
    notes: "",
  });
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [projectValidationError, setProjectValidationError] = useState<
    string | null
  >(null);

  // Tab counts and data
  const [documentsCount, setDocumentsCount] = useState(0);
  const [documents, setDocuments] = useState<any[]>([]);
  const [tasksCount, setTasksCount] = useState(0);
  const [tasks, setTasks] = useState<any[]>([]);
  const [notesCount, setNotesCount] = useState(0);
  const [notes, setNotes] = useState<any[]>([]);
  const [calendarCount, setCalendarCount] = useState(0);
  const [activities, setActivities] = useState<any[]>([]);
  const [quotationsCount, setQuotationsCount] = useState(0);
  const [quotations, setQuotations] = useState<any[]>([]);

  // Tab loading states
  const [tabsLoading, setTabsLoading] = useState(true);
  const [documentLoading, setDocumentLoading] = useState(true);
  const [taskLoading, setTaskLoading] = useState(true);
  const [noteLoading, setNoteLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [quotationLoading, setQuotationLoading] = useState(true);

  // Check user role
  const isFinanceUser =
    user?.roles?.includes("finance") ||
    user?.roles?.includes("admin") ||
    user?.roles?.includes("owner");

  useEffect(() => {
    fetchProject();
    fetchCounts();
  }, [id]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${id}`);
      if (!response.ok) throw new Error("Failed to fetch project");
      const data = await response.json();
      setProject(data.project);

      const inProgressPhases =
        data.project.phases
          ?.filter((p: ProjectPhase) => p.status === "in_progress")
          .map((p: ProjectPhase) => p.id) || [];
      setExpandedPhases(new Set(inProgressPhases));
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchCounts = useCallback(async () => {
    try {
      setTabsLoading(true);
      setDocumentLoading(true);
      setTaskLoading(true);
      setNoteLoading(true);
      setCalendarLoading(true);
      setQuotationLoading(true);

      // First fetch project to get quotation_id (the linked lead quotation)
      const projectRes = await fetch(`/api/projects/${id}`);
      let quotationId = null;
      if (projectRes.ok) {
        const projectData = await projectRes.json();
        quotationId = projectData.project?.quotation_id;
      }

      // Build quotations fetch promises
      const quotationsPromises = [fetch(`/api/quotations?project_id=${id}`)];
      // Only fetch the specific linked lead quotation if it exists
      if (quotationId) {
        quotationsPromises.push(fetch(`/api/quotations/${quotationId}`));
      }

      // Fetch counts in parallel
      const [
        documentsRes,
        tasksRes,
        notesRes,
        activitiesRes,
        ...quotationsResults
      ] = await Promise.all([
        fetch(`/api/documents?linked_type=project&linked_id=${id}`),
        fetch(`/api/tasks?related_type=project&related_id=${id}`),
        fetch(`/api/projects/${id}/notes`),
        fetch(`/api/projects/${id}/activities`),
        ...quotationsPromises,
      ]);

      if (documentsRes.ok) {
        const data = await documentsRes.json();
        setDocuments(data.documents || []);
        setDocumentsCount(data.documents?.length || 0);
      }
      setDocumentLoading(false);

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        const tasksList = data.tasks || [];
        setTasks(tasksList);
        setTasksCount(tasksList.length);
      }
      setTaskLoading(false);

      if (notesRes.ok) {
        const data = await notesRes.json();
        const notesList = data.notes || [];
        setNotes(notesList);
        setNotesCount(notesList.length);
      }
      setNoteLoading(false);

      if (activitiesRes.ok) {
        const data = await activitiesRes.json();
        const activitiesList = data.activities || [];
        setActivities(activitiesList);
        setCalendarCount(
          activitiesList.filter(
            (a: any) =>
              a.activity_type === "meeting_scheduled" ||
              a.activity_type === "client_meeting" ||
              a.activity_type === "internal_meeting" ||
              a.activity_type === "site_visit" ||
              (a.meeting_scheduled_at && a.meeting_scheduled_at !== null),
          ).length,
        );
      }
      setCalendarLoading(false);

      // Count quotations: project quotations + linked lead quotation (if exists and not duplicate)
      let totalQuotations = 0;
      let allQuotations: any[] = [];
      let projectQuotationsData = null;

      const projectQuotationsRes = quotationsResults[0];
      if (projectQuotationsRes.ok) {
        projectQuotationsData = await projectQuotationsRes.json();
        allQuotations =
          projectQuotationsData.quotations?.map((q: any) => ({
            ...q,
            _source: "project",
          })) || [];
        totalQuotations = allQuotations.length;
      }

      // Add the linked lead quotation if it exists and is not already in project quotations
      if (quotationId && quotationsResults[1] && quotationsResults[1].ok) {
        const leadQuotData = await quotationsResults[1].json();
        const leadQuot = leadQuotData.quotation || leadQuotData;
        const leadQuotId = leadQuot.id;
        // Check if this quotation is not already in the list
        if (!allQuotations.find((q) => q.id === leadQuotId)) {
          allQuotations.push({
            ...leadQuot,
            _source: "lead",
          });
          totalQuotations += 1;
        }
      }

      // Sort by created_at descending
      allQuotations.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      setQuotations(allQuotations);
      setQuotationsCount(totalQuotations);
      setQuotationLoading(false);
      setTabsLoading(false);
    } catch (err) {
      console.error("Error fetching counts:", err);
      setTabsLoading(false);
      setDocumentLoading(false);
      setTaskLoading(false);
      setNoteLoading(false);
      setCalendarLoading(false);
      setQuotationLoading(false);
    }
  }, [id]);

  const updateProject = async (updates: Partial<Project>) => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update project");
      }
      await fetchProject();
    } catch (err) {
      console.error("Error updating project:", err);
      throw err;
    }
  };

  // Handle quick action (start/complete/etc.)
  const handleQuickAction = async (
    subPhaseId: string,
    phaseId: string,
    action: "start" | "hold" | "resume" | "complete" | "cancel",
    notes: string,
  ) => {
    try {
      const statusMap: Record<string, string> = {
        start: "in_progress",
        hold: "on_hold",
        resume: "in_progress",
        complete: "completed",
        cancel: "skipped", // or cancelled
      };

      const newStatus = statusMap[action];
      if (!newStatus) return null;

      const response = await fetch(
        `/api/projects/${id}/phases/${phaseId}/sub-phases/${subPhaseId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus, notes }),
        },
      );

      if (!response.ok) throw new Error("Failed to update status");

      const updatedSubPhase = await response.json();
      fetchProject(); // Refresh full state to be sure
      return updatedSubPhase;
    } catch (err) {
      console.error("Quick action failed:", err);
      return null;
    }
  };

  // Handler for sub-phase click
  const handleSubPhaseClick = (phaseId: string, subPhaseId: string) => {
    setSelectedSubPhase({ phaseId, subPhaseId });
    setShowSubPhasePanel(true);
  };

  // Handler to initialize phases (moved to Mgmt Tab or handled within)
  const initializePhases = async (force: boolean = false) => {
    try {
      const response = await fetch(`/api/projects/${id}/initialize-phases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      if (!response.ok) throw new Error("Failed");
      await fetchProject();
    } catch (err) {
      console.error(err);
      alert("Failed to initialize phases");
    }
  };

  const togglePhaseExpanded = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(phaseId)) newSet.delete(phaseId);
      else newSet.add(phaseId);
      return newSet;
    });
  };

  const updatePhaseStatus = async (phaseId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/projects/${id}/phases/${phaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) throw new Error("Failed");
      fetchProject();
    } catch (err) {
      console.error(err);
    }
  };

  const updateSubPhaseStatus = async (
    pId: string,
    spId: string,
    status: string,
  ) => {
    try {
      const response = await fetch(
        `/api/projects/${id}/phases/${pId}/sub-phases/${spId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!response.ok) throw new Error("Failed");
      fetchProject();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleChecklistItem = async (
    pId: string,
    spId: string,
    itemId: string,
    val: boolean,
  ) => {
    try {
      const response = await fetch(
        `/api/projects/${id}/phases/${pId}/sub-phases/${spId}/checklist/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_completed: !val }),
        },
      );
      if (!response.ok) throw new Error("Failed");
      fetchProject();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditPhase = (phase: ProjectPhase) => {
    setEditingPhase(phase);
    setShowPhaseEditModal(true);
  };

  const handleEditSubPhase = (subPhase: ProjectSubPhase, phaseId: string) => {
    const parentPhase = project?.phases?.find((p) => p.id === phaseId);
    setEditingSubPhase({
      subPhase,
      phaseId,
      phaseName: parentPhase?.name || "",
    });
    setShowSubPhaseEditModal(true);
  };

  const handleEditProject = () => {
    if (project) {
      setEditProjectForm({
        name: project.name || "",
        description: project.description || "",
        status: project.status || "",
        project_category: project.project_category || "",
        expected_start_date: project.expected_start_date?.split("T")[0] || "",
        expected_end_date: project.expected_end_date?.split("T")[0] || "",
        actual_start_date:
          (project as any).actual_start_date?.split("T")[0] || "",
        actual_end_date: project.actual_end_date?.split("T")[0] || "",
        notes: project.notes || "",
      });
      setShowEditProjectModal(true);
    }
  };

  const handleSaveProjectEdit = async () => {
    try {
      setProjectValidationError(null);

      if (!editProjectForm.name.trim()) {
        setProjectValidationError("Project name is required");
        return;
      }

      setIsSavingProject(true);

      const response = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editProjectForm.name.trim(),
          description: editProjectForm.description.trim() || null,
          status: editProjectForm.status || null,
          project_category: editProjectForm.project_category || null,
          expected_start_date: editProjectForm.expected_start_date || null,
          expected_end_date: editProjectForm.expected_end_date || null,
          actual_start_date: editProjectForm.actual_start_date || null,
          actual_end_date: editProjectForm.actual_end_date || null,
          notes: editProjectForm.notes.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update project");
      }

      await fetchProject();
      setShowEditProjectModal(false);
    } catch (err) {
      console.error("Error saving project edit:", err);
      setProjectValidationError(
        err instanceof Error ? err.message : "Failed to update project",
      );
    } finally {
      setIsSavingProject(false);
    }
  };

  if (loading) {
    return (
      <PageLayout isLoading loadingText="Loading project details...">
        <></>
      </PageLayout>
    );
  }

  if (error || !project) {
    return (
      <PageLayout>
        <PageHeader
          title="Project Not Found"
          subtitle={error || "The requested project could not be found"}
          breadcrumbs={[{ label: "Projects", href: "/dashboard/projects" }]}
          basePath={{ label: "Dashboard", href: "/dashboard" }}
        />
        <PageContent>
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-slate-500">Project not found.</p>
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  const tabs: {
    key: TabKey;
    label: string;
    icon?: React.ReactNode;
    badge?: number;
  }[] = [
    {
      key: "project-mgmt",
      label: "Project Mgmt",
      icon: <Cog6ToothIcon className="w-4 h-4" />,
    },
    { key: "rooms", label: "Rooms", icon: <CubeIcon className="w-4 h-4" /> },
    {
      key: "overview",
      label: "Overview",
      icon: <InformationCircleIcon className="w-4 h-4" />,
    },
    ...(project.lead
      ? [
          {
            key: "quotations" as TabKey,
            label: `Quotations${
              quotationsCount > 0 ? ` (${quotationsCount})` : ""
            }`,
            icon: <DocumentTextIcon className="w-4 h-4" />,
          },
        ]
      : []),
    {
      key: "tasks",
      label: `Tasks${tasksCount > 0 ? ` (${tasksCount})` : ""}`,
      icon: <ClipboardDocumentListIcon className="w-4 h-4" />,
    },
    {
      key: "notes",
      label: `Notes${notesCount > 0 ? ` (${notesCount})` : ""}`,
      icon: <ChatBubbleLeftRightIcon className="w-4 h-4" />,
    },
    {
      key: "documents",
      label: `Documents${documentsCount > 0 ? ` (${documentsCount})` : ""}`,
      icon: <DocumentTextIcon className="w-4 h-4" />,
    },
    ...(project.lead
      ? [
          {
            key: "calendar" as TabKey,
            label: `Calendar${calendarCount > 0 ? ` (${calendarCount})` : ""}`,
            icon: <CalendarDaysIcon className="w-4 h-4" />,
          },
          {
            key: "lead-history" as TabKey,
            label: "Timeline",
            icon: <ClockIcon className="w-4 h-4" />,
          },
        ]
      : []),
    {
      key: "procurement",
      label: "Procurement",
      icon: <ShoppingCartIcon className="w-4 h-4" />,
    },
    ...(isFinanceUser
      ? [
          {
            key: "payments" as TabKey,
            label: "Payments",
            icon: <CurrencyRupeeIcon className="w-4 h-4" />,
            badge: project.payment_milestones?.length,
          },
        ]
      : []),
  ];

  return (
    <PageLayout>
      <PageHeader
        title={project.name}
        subtitle={`${project.project_number} • ${
          ProjectCategoryLabels[project.project_category]
        } • ${project.client_name || "Unknown Client"} • ${
          project.property_name || "Unknown Property"
        }`}
        breadcrumbs={[
          { label: "Projects", href: "/dashboard/projects" },
          { label: project.project_number },
        ]}
        basePath={{ label: "Dashboard", href: "/dashboard" }}
        icon={<BuildingOffice2Icon className="w-5 h-5 text-white" />}
        iconBgClass="from-blue-500 to-blue-600"
        stats={
          <div className="flex items-center gap-4">
            {/* Progress Stepper (Simplified) */}
            <div className="flex items-center gap-1">
              {STATUS_WORKFLOW.map((step, index) => {
                const currentIndex = STATUS_WORKFLOW.indexOf(
                  project.status || "new",
                );
                const isCompleted = index < currentIndex;
                const isCurrent = index === currentIndex;
                // Skip if project is cancelled/on_hold for visual clarity, or handle specifically
                return (
                  <div
                    key={step}
                    className={`w-2 h-2 rounded-full ${
                      isCompleted
                        ? "bg-green-500"
                        : isCurrent
                          ? "bg-blue-600"
                          : "bg-slate-200"
                    }`}
                    title={step}
                  />
                );
              })}
            </div>

            {/* Status Badge */}
            <span
              className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                project.status === "completed"
                  ? "bg-green-100 text-green-700"
                  : project.status === "in_progress"
                    ? "bg-blue-100 text-blue-700"
                    : project.status === "on_hold"
                      ? "bg-amber-100 text-amber-700"
                      : project.status === "cancelled"
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-700"
              }`}
            >
              {ProjectStatusLabels[project.status] || project.status}
            </span>

            {/* Progress % */}
            <span className="text-sm font-medium text-slate-700">
              {project.overall_progress}%
            </span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditDetailsModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Edit
            </button>
          </div>
        }
      />

      <PageContent noPadding>
        {/* Tabs Navigation */}
        <div className="bg-white border-b border-slate-200">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${
                  activeTab === tab.key
                    ? "border-blue-600 text-blue-600 bg-blue-50/50"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.badge ? (
                  <span className="bg-slate-100 text-slate-600 text-xs px-1.5 py-0.5 rounded-full">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === "project-mgmt" && (
            <ManagementTab
              projectId={project.id}
              phases={project.phases || []}
              onInitializePhases={initializePhases}
              onRefresh={fetchProject}
              onEditPhase={handleEditPhase}
              onEditSubPhase={handleEditSubPhase}
              onSubPhaseClick={handleSubPhaseClick}
              onQuickAction={handleQuickAction}
            />
          )}

          {activeTab === "rooms" && <RoomsTab projectId={project.id} />}

          {activeTab === "overview" && (
            <OverviewTab project={project} onUpdate={updateProject} />
          )}

          {activeTab === "tasks" && taskLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-200 rounded" />
              ))}
            </div>
          ) : activeTab === "tasks" ? (
            <TasksTab
              projectId={project.id}
              tasks={tasks}
              projectClosed={project.status === "completed"}
              teamMembers={undefined}
              onCountChange={(count) => setTasksCount(count)}
              onRefresh={fetchCounts}
            />
          ) : null}

          {activeTab === "documents" && documentLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-200 rounded" />
              ))}
            </div>
          ) : activeTab === "documents" ? (
            <DocumentsTab
              projectId={project.id}
              documents={documents}
              projectClosed={project.status === "completed"}
              onCountChange={(count) => setDocumentsCount(count)}
              onRefresh={fetchCounts}
            />
          ) : null}

          {activeTab === "notes" && noteLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-200 rounded" />
              ))}
            </div>
          ) : activeTab === "notes" ? (
            <NotesTab
              projectId={project.id}
              notes={notes}
              projectClosed={project.status === "completed"}
              onCountChange={(count) => setNotesCount(count)}
            />
          ) : null}

          {activeTab === "lead-history" && calendarLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-200 rounded" />
              ))}
            </div>
          ) : activeTab === "lead-history" ? (
            <TimelineTab
              projectId={project.id}
              activities={activities}
              projectClosed={project.status === "completed"}
              onRefresh={fetchCounts}
              onCountChange={(count) => setCalendarCount(count)}
            />
          ) : null}

          {activeTab === "calendar" && calendarLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-200 rounded" />
              ))}
            </div>
          ) : activeTab === "calendar" ? (
            <CalendarTab
              projectId={project.id}
              activities={activities}
              projectClosed={project.status === "completed"}
              onCountChange={(count) => setCalendarCount(count)}
              onRefresh={fetchCounts}
            />
          ) : null}

          {activeTab === "quotations" && quotationLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-200 rounded" />
              ))}
            </div>
          ) : activeTab === "quotations" ? (
            <QuotationsTab
              quotations={quotations}
              onCountChange={(count) => setQuotationsCount(count)}
              onViewQuotation={(quotation) => {
                // Navigate to quotation view page
                router.push(`/dashboard/quotations/${quotation.id}`);
              }}
            />
          ) : null}

          {activeTab === "payments" && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-500 uppercase font-bold">
                    Total Due
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {formatCurrencyUtil(project.lead?.won_amount)}
                  </p>
                </div>
                {/* Add other summary cards as needed */}
              </div>
              {/* Milestones list would go here */}
              <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500">
                Payment Milestones Implementation
              </div>
            </div>
          )}
        </div>

        {/* Sub-phase Detail Panel */}
        <SubPhaseDetailPanel
          isOpen={showSubPhasePanel}
          onClose={() => setShowSubPhasePanel(false)}
          subPhaseId={selectedSubPhase?.subPhaseId || ""}
          phaseId={selectedSubPhase?.phaseId || ""}
          projectId={project.id}
          onUpdate={fetchProject}
        />

        {/* Phase Edit Modal */}
        {editingPhase && (
          <PhaseEditModal
            isOpen={showPhaseEditModal}
            onClose={() => setShowPhaseEditModal(false)}
            phase={editingPhase}
            projectId={project.id}
            onSave={() => {
              fetchProject();
              setShowPhaseEditModal(false);
            }}
          />
        )}

        {/* Sub-Phase Edit Modal */}
        {editingSubPhase && (
          <SubPhaseEditModal
            isOpen={showSubPhaseEditModal}
            onClose={() => setShowSubPhaseEditModal(false)}
            subPhase={editingSubPhase.subPhase}
            phaseId={editingSubPhase.phaseId}
            phaseName={editingSubPhase.phaseName}
            projectId={project.id}
            onSave={() => {
              fetchProject();
              setShowSubPhaseEditModal(false);
            }}
          />
        )}

        {/* Edit Project Modal */}
        {showEditProjectModal && project && (
          <EditProjectModal
            project={project}
            editForm={editProjectForm}
            setEditForm={setEditProjectForm}
            onClose={() => {
              setShowEditProjectModal(false);
              setProjectValidationError(null);
            }}
            onSave={handleSaveProjectEdit}
            isSaving={isSavingProject}
            validationError={projectValidationError}
          />
        )}
      </PageContent>
    </PageLayout>
  );
}
