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
import SubPhaseDetailPanel from "@/components/projects/SubPhaseDetailPanel";
import ProjectMgmtTab from "@/components/projects/ProjectMgmtTab";
import ProjectTasksTab from "@/components/projects/ProjectTasksTab";
import ProjectRoomsTab from "@/components/projects/ProjectRoomsTab";
import ProjectNotesTab from "@/components/projects/ProjectNotesTab";
import ProjectOverviewTab from "@/components/projects/ProjectOverviewTab";
import ProjectDocumentsTab from "@/components/projects/ProjectDocumentsTab";
import ProjectCalendarTab from "@/components/projects/ProjectCalendarTab";
import PhaseEditModal from "@/components/projects/PhaseEditModal";
import SubPhaseEditModal from "@/components/projects/SubPhaseEditModal";
import ProjectTimelineTab from "@/components/projects/ProjectTimelineTab";
import ProjectQuotationsTab from "@/components/projects/ProjectQuotationsTab";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface PageProps {
  params: Promise<{ id: string }>;
}

type TabKey = ProjectDetailTab;

// Format currency
const formatCurrency = (amount: number | undefined) => {
  if (!amount) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

// Status workflow for visual stepper
const STATUS_WORKFLOW = [
  "planning",
  "design",
  "procurement",
  "execution",
  "finishing",
  "handover",
  "completed",
];

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

  // Phase/Sub-phase editing state
  const [editingPhase, setEditingPhase] = useState<ProjectPhase | null>(null);
  const [showPhaseEditModal, setShowPhaseEditModal] = useState(false);
  const [editingSubPhase, setEditingSubPhase] = useState<{
    subPhase: ProjectSubPhase;
    phaseId: string;
    phaseName: string;
  } | null>(null);
  const [showSubPhaseEditModal, setShowSubPhaseEditModal] = useState(false);

  // Tab counts
  const [documentsCount, setDocumentsCount] = useState(0);
  const [tasksCount, setTasksCount] = useState(0);
  const [notesCount, setNotesCount] = useState(0);
  const [calendarCount, setCalendarCount] = useState(0);
  const [quotationsCount, setQuotationsCount] = useState(0);

  // Check user role
  const isFinanceUser =
    user?.roles.includes("finance") ||
    user?.roles.includes("admin") ||
    user?.roles.includes("owner");

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
      const [documentsRes, tasksRes, notesRes, ...quotationsResults] =
        await Promise.all([
          fetch(`/api/documents?linked_type=project&linked_id=${id}`),
          fetch(`/api/tasks?project_id=${id}`),
          fetch(`/api/projects/${id}/notes`),
          ...quotationsPromises,
        ]);

      if (documentsRes.ok) {
        const data = await documentsRes.json();
        setDocumentsCount(data.documents?.length || 0);
      }

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasksCount(data.tasks?.length || 0);
      }

      if (notesRes.ok) {
        const data = await notesRes.json();
        setNotesCount(data.notes?.length || 0);
      }

      // Count quotations: project quotations + linked lead quotation (if exists and not duplicate)
      let totalQuotations = 0;
      let projectQuotationsData = null;

      const projectQuotationsRes = quotationsResults[0];
      if (projectQuotationsRes.ok) {
        projectQuotationsData = await projectQuotationsRes.json();
        totalQuotations = projectQuotationsData.quotations?.length || 0;
      }

      // Add 1 for the linked lead quotation if it exists and is not already in project quotations
      if (quotationId && quotationsResults[1] && quotationsResults[1].ok) {
        const leadQuotData = await quotationsResults[1].json();
        const leadQuotId = leadQuotData.quotation?.id || leadQuotData.id;
        // Check if this quotation is not already counted in project quotations
        if (projectQuotationsData) {
          const alreadyCounted = projectQuotationsData.quotations?.some(
            (q: any) => q.id === leadQuotId
          );
          if (!alreadyCounted) {
            totalQuotations += 1;
          }
        } else {
          // If no project quotations data, just add the lead quotation
          totalQuotations += 1;
        }
      }

      setQuotationsCount(totalQuotations);
    } catch (err) {
      console.error("Error fetching counts:", err);
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
    notes: string
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
        }
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
    status: string
  ) => {
    try {
      const response = await fetch(
        `/api/projects/${id}/phases/${pId}/sub-phases/${spId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
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
    val: boolean
  ) => {
    try {
      const response = await fetch(
        `/api/projects/${id}/phases/${pId}/sub-phases/${spId}/checklist/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_completed: !val }),
        }
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
    {
      key: "documents",
      label: `Documents${documentsCount > 0 ? ` (${documentsCount})` : ""}`,
      icon: <DocumentTextIcon className="w-4 h-4" />,
    },
    {
      key: "notes",
      label: `Notes${notesCount > 0 ? ` (${notesCount})` : ""}`,
      icon: <ChatBubbleLeftRightIcon className="w-4 h-4" />,
    },
    {
      key: "tasks",
      label: `Tasks${tasksCount > 0 ? ` (${tasksCount})` : ""}`,
      icon: <ClipboardDocumentListIcon className="w-4 h-4" />,
    },
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
    ...(project.lead
      ? [
          {
            key: "lead-history" as TabKey,
            label: "Timeline",
            icon: <ClockIcon className="w-4 h-4" />,
          },
          {
            key: "calendar" as TabKey,
            label: `Calendar${calendarCount > 0 ? ` (${calendarCount})` : ""}`,
            icon: <CalendarDaysIcon className="w-4 h-4" />,
          },
          {
            key: "quotations" as TabKey,
            label: `Quotations${
              quotationsCount > 0 ? ` (${quotationsCount})` : ""
            }`,
            icon: <DocumentTextIcon className="w-4 h-4" />,
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
        } • ${project.client_name || "Unknown Client"}`}
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
                  project.status || "planning"
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
                  : project.status === "execution"
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
            {/* Add global actions here if needed */}
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
            <ProjectMgmtTab
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

          {activeTab === "rooms" && <ProjectRoomsTab projectId={project.id} />}

          {activeTab === "overview" && (
            <ProjectOverviewTab
              project={project}
              onUpdate={updateProject}
              isFinanceUser={isFinanceUser}
            />
          )}

          {activeTab === "tasks" && (
            <ProjectTasksTab
              projectId={project.id}
              phases={project.phases || []}
              onCountChange={(count) => setTasksCount(count)}
            />
          )}

          {activeTab === "documents" && (
            <ProjectDocumentsTab
              projectId={project.id}
              leadId={project.lead?.id}
              onCountChange={(count) => setDocumentsCount(count)}
            />
          )}

          {activeTab === "notes" && (
            <ProjectNotesTab
              projectId={project.id}
              phases={project.phases || []}
              onCountChange={(count) => setNotesCount(count)}
            />
          )}

          {activeTab === "lead-history" && project.lead && (
            <ProjectTimelineTab
              projectId={project.id}
              leadId={project.lead.id}
            />
          )}

          {activeTab === "calendar" && project.lead && (
            <ProjectCalendarTab
              projectId={project.id}
              leadId={project.lead.id}
              onCountChange={(count) => setCalendarCount(count)}
            />
          )}

          {activeTab === "quotations" && (
            <ProjectQuotationsTab
              leadId={project.lead?.id || ""}
              projectId={project.id}
              onCountChange={(count) => setQuotationsCount(count)}
            />
          )}

          {activeTab === "payments" && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-500 uppercase font-bold">
                    Total Due
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {formatCurrency(project.lead?.estimated_value)}
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
      </PageContent>
    </PageLayout>
  );
}
