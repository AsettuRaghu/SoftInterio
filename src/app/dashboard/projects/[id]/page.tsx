"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  BuildingOffice2Icon,
  UserCircleIcon,
  CalendarDaysIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  PauseIcon,
  PlayIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LockClosedIcon,
  CurrencyRupeeIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  EllipsisVerticalIcon,
  ExclamationTriangleIcon,
  CreditCardIcon,
  PlusIcon,
  SparklesIcon,
  LinkIcon,
  InformationCircleIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
  ShoppingCartIcon,
} from "@heroicons/react/24/outline";
import {
  CheckCircleIcon as CheckCircleSolid,
  ClockIcon as ClockSolid,
} from "@heroicons/react/24/solid";
import {
  Project,
  ProjectPhase,
  ProjectSubPhase,
  ProjectPaymentMilestone,
  ProjectLeadData,
  ProjectLeadActivity,
  ProjectStatusLabels,
  ProjectCategoryLabels,
  ProjectPhaseStatusLabels,
  PaymentMilestoneStatusLabels,
  PhaseStatusColors,
  PaymentStatusColors,
  ProjectTypeLabels,
  ProjectNote,
  ProjectDetailTab,
} from "@/types/projects";
import {
  LeadStageLabels,
  LeadSourceLabels,
  PropertyTypeLabels,
  ServiceTypeLabels,
} from "@/types/leads";
import SubPhaseDetailPanel from "@/components/projects/SubPhaseDetailPanel";
import ProjectMgmtTab from "@/components/projects/ProjectMgmtTab";
import ProjectTasksTab from "@/components/projects/ProjectTasksTab";
import ProjectRoomsTab from "@/components/projects/ProjectRoomsTab";
import ProjectNotesTab from "@/components/projects/ProjectNotesTab";
import ProjectOverviewTab from "@/components/projects/ProjectOverviewTab";
import PhaseEditModal from "@/components/projects/PhaseEditModal";
import SubPhaseEditModal from "@/components/projects/SubPhaseEditModal";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface PageProps {
  params: Promise<{ id: string }>;
}

// New tab structure per user requirements
type TabKey = ProjectDetailTab;

// Status icon component
const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case "completed":
      return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
    case "in_progress":
      return <ClockIcon className="w-5 h-5 text-blue-600" />;
    case "blocked":
      return <LockClosedIcon className="w-5 h-5 text-orange-600" />;
    case "on_hold":
      return <PauseIcon className="w-5 h-5 text-yellow-600" />;
    case "cancelled":
      return <XMarkIcon className="w-5 h-5 text-red-600" />;
    default:
      return <div className="w-5 h-5 rounded-full border-2 border-slate-300" />;
  }
};

// Format currency
const formatCurrency = (amount: number | undefined) => {
  if (!amount) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

// Format date
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// Format relative time
const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(dateString);
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

// Project Status Stepper
function ProjectStatusStepper({ status }: { status: string }) {
  if (status === "cancelled" || status === "on_hold") {
    return (
      <span
        className={`px-3 py-1 text-sm font-medium rounded-full ${
          status === "cancelled"
            ? "bg-red-100 text-red-700"
            : "bg-yellow-100 text-yellow-700"
        }`}
      >
        {ProjectStatusLabels[status as keyof typeof ProjectStatusLabels]}
      </span>
    );
  }

  const currentIndex = STATUS_WORKFLOW.indexOf(status);

  return (
    <div className="flex items-center gap-1">
      {STATUS_WORKFLOW.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full ${
                  isCompleted
                    ? "bg-green-500"
                    : isCurrent
                    ? "bg-blue-500"
                    : "bg-slate-200"
                }`}
              />
              <span
                className={`text-[10px] mt-1 ${
                  isCurrent ? "text-blue-600 font-medium" : "text-slate-400"
                }`}
              >
                {ProjectStatusLabels[step as keyof typeof ProjectStatusLabels]}
              </span>
            </div>
            {index < STATUS_WORKFLOW.length - 1 && (
              <div
                className={`w-6 h-0.5 mb-4 ${
                  isCompleted ? "bg-green-500" : "bg-slate-200"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function ProjectDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, isLoading: userLoading } = useCurrentUser();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabKey>("project-mgmt");
  const [initializingPhases, setInitializingPhases] = useState(false);
  const [selectedSubPhase, setSelectedSubPhase] = useState<{
    phaseId: string;
    subPhaseId: string;
  } | null>(null);
  const [showSubPhasePanel, setShowSubPhasePanel] = useState(false);
  const [showCreateNoteModal, setShowCreateNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState<ProjectNote | null>(null);

  // Phase/Sub-phase editing state
  const [editingPhase, setEditingPhase] = useState<ProjectPhase | null>(null);
  const [showPhaseEditModal, setShowPhaseEditModal] = useState(false);
  const [editingSubPhase, setEditingSubPhase] = useState<{
    subPhase: ProjectSubPhase;
    phaseId: string;
    phaseName: string;
  } | null>(null);
  const [showSubPhaseEditModal, setShowSubPhaseEditModal] = useState(false);

  // Check if user is Finance team (for Payments tab visibility)
  const isFinanceUser =
    user?.role === "finance" ||
    user?.role === "admin" ||
    user?.role === "owner";

  // Handler for sub-phase click
  const handleSubPhaseClick = (phaseId: string, subPhaseId: string) => {
    setSelectedSubPhase({ phaseId, subPhaseId });
    setShowSubPhasePanel(true);
  };

  // Handler for phase edit click
  const handleEditPhase = (phase: ProjectPhase) => {
    setEditingPhase(phase);
    setShowPhaseEditModal(true);
  };

  // Handler for sub-phase edit click
  const handleEditSubPhase = (subPhase: ProjectSubPhase, phaseId: string) => {
    const parentPhase = project?.phases?.find((p) => p.id === phaseId);
    setEditingSubPhase({
      subPhase,
      phaseId,
      phaseName: parentPhase?.name || "",
    });
    setShowSubPhaseEditModal(true);
  };

  // Handler for quick actions (inline status change buttons)
  const handleQuickAction = async (
    subPhaseId: string,
    phaseId: string,
    action: "start" | "hold" | "resume" | "complete" | "cancel",
    notes: string
  ): Promise<ProjectSubPhase | null> => {
    // Map action to status
    const statusMap: Record<string, string> = {
      start: "in_progress",
      hold: "on_hold",
      resume: "in_progress",
      complete: "completed",
      cancel: "skipped",
    };
    const newStatus = statusMap[action];

    try {
      const response = await fetch(
        `/api/projects/${id}/phases/${phaseId}/sub-phases/${subPhaseId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: newStatus,
            status_change_notes: notes, // For logging to status_logs table
            // Auto-set actual dates based on action
            ...(action === "start" && {
              actual_start_date: new Date().toISOString().split("T")[0],
            }),
            ...(action === "complete" && {
              actual_end_date: new Date().toISOString().split("T")[0],
            }),
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update sub-phase");
      }

      const data = await response.json();
      return data.sub_phase || null;
    } catch (err) {
      console.error("Error updating sub-phase:", err);
      throw err;
    }
  };

  useEffect(() => {
    fetchProject();
  }, [id]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${id}`);
      if (!response.ok) throw new Error("Failed to fetch project");
      const data = await response.json();
      setProject(data.project);

      // Auto-expand in-progress phases
      const inProgressPhases =
        data.project.phases
          ?.filter((p: ProjectPhase) => p.status === "in_progress")
          .map((p: ProjectPhase) => p.id) || [];
      setExpandedPhases(new Set(inProgressPhases));

      // If project has lead data, show lead-history tab link
      if (data.project.lead) {
        // Keep phases as default but show that lead tab has content
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Handler to update project details
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

      // Refresh project data
      await fetchProject();
    } catch (err) {
      console.error("Error updating project:", err);
      throw err;
    }
  };

  const initializePhases = async (force: boolean = false) => {
    try {
      setInitializingPhases(true);
      const response = await fetch(`/api/projects/${id}/initialize-phases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to initialize phases");
        return;
      }

      // Refresh project data to get the new phases
      await fetchProject();
    } catch (err) {
      console.error("Error initializing phases:", err);
      alert("Failed to initialize phases");
    } finally {
      setInitializingPhases(false);
    }
  };

  const togglePhaseExpanded = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(phaseId)) {
        newSet.delete(phaseId);
      } else {
        newSet.add(phaseId);
      }
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

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to update phase");
        return;
      }

      fetchProject();
    } catch (err) {
      console.error("Error updating phase:", err);
    }
  };

  const updateSubPhaseStatus = async (
    phaseId: string,
    subPhaseId: string,
    newStatus: string
  ) => {
    try {
      const response = await fetch(
        `/api/projects/${id}/phases/${phaseId}/sub-phases/${subPhaseId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) throw new Error("Failed to update sub-phase");
      fetchProject();
    } catch (err) {
      console.error("Error updating sub-phase:", err);
    }
  };

  const toggleChecklistItem = async (
    phaseId: string,
    subPhaseId: string,
    itemId: string,
    currentValue: boolean
  ) => {
    try {
      const response = await fetch(
        `/api/projects/${id}/phases/${phaseId}/sub-phases/${subPhaseId}/checklist/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_completed: !currentValue }),
        }
      );

      if (!response.ok) throw new Error("Failed to update checklist item");
      fetchProject();
    } catch (err) {
      console.error("Error updating checklist item:", err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4 animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-slate-200 rounded w-1/4"></div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-6 animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-full mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-red-800 mb-2">
          {error || "Project not found"}
        </h2>
        <Link
          href="/dashboard/projects"
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          ← Back to Projects
        </Link>
      </div>
    );
  }

  const tabs: {
    key: TabKey;
    label: string;
    badge?: number;
    icon?: React.ReactNode;
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
      label: "Documents",
      icon: <DocumentTextIcon className="w-4 h-4" />,
    },
    {
      key: "notes",
      label: "Notes",
      icon: <ChatBubbleLeftRightIcon className="w-4 h-4" />,
    },
    {
      key: "tasks",
      label: "Tasks",
      icon: <ClipboardDocumentListIcon className="w-4 h-4" />,
    },
    {
      key: "procurement",
      label: "Procurement",
      icon: <ShoppingCartIcon className="w-4 h-4" />,
    },
    // Payments tab only visible to Finance team
    ...(isFinanceUser
      ? [
          {
            key: "payments" as TabKey,
            label: "Payments",
            badge: project.payment_milestones?.length,
            icon: <CurrencyRupeeIcon className="w-4 h-4" />,
          },
        ]
      : []),
    // Leads tab (Lead History) - only if project came from a lead
    ...(project.lead
      ? [
          {
            key: "leads" as TabKey,
            label: "Lead History",
            icon: <SparklesIcon className="w-4 h-4" />,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      {/* Header with Progress */}
      <div className="bg-white rounded-lg border border-slate-200">
        {/* Main Header */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/projects"
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5 text-slate-600" />
              </Link>
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                  <Link href="/dashboard" className="hover:text-slate-700">
                    Dashboard
                  </Link>
                  <span>/</span>
                  <Link
                    href="/dashboard/projects"
                    className="hover:text-slate-700"
                  >
                    Projects
                  </Link>
                  <span>/</span>
                  <span className="text-slate-700 font-mono">
                    {project.project_number}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <h1 className="text-lg font-semibold text-slate-900">
                    {project.name}
                  </h1>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      project.project_category === "turnkey"
                        ? "bg-indigo-100 text-indigo-700"
                        : project.project_category === "modular"
                        ? "bg-teal-100 text-teal-700"
                        : "bg-violet-100 text-violet-700"
                    }`}
                  >
                    {ProjectCategoryLabels[project.project_category]}
                  </span>
                  {project.lead && (
                    <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                      <LinkIcon className="w-3 h-3" />
                      From Lead
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
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
                {project.status === "in_progress"
                  ? "In Progress"
                  : project.status === "on_hold"
                  ? "On Hold"
                  : project.status?.charAt(0).toUpperCase() +
                    project.status?.slice(1)}
              </span>
              {/* Progress % with color coding */}
              <span
                className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                  (project.overall_progress || 0) === 100
                    ? "bg-green-100 text-green-700"
                    : (project.overall_progress || 0) >= 75
                    ? "bg-emerald-100 text-emerald-700"
                    : (project.overall_progress || 0) >= 50
                    ? "bg-blue-100 text-blue-700"
                    : (project.overall_progress || 0) >= 25
                    ? "bg-amber-100 text-amber-700"
                    : "bg-orange-100 text-orange-700"
                }`}
              >
                {project.overall_progress || 0}% Complete
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="border-b border-slate-200 overflow-x-auto">
          <nav className="flex gap-0 px-4 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4">
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <ProjectOverviewTab
              project={project}
              onUpdate={updateProject}
              isFinanceUser={isFinanceUser}
            />
          )}

          {/* PAYMENTS TAB */}
          {activeTab === "payments" && (
            <div className="space-y-4">
              {/* Payment Summary */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Total Due</p>
                  <p className="text-lg font-bold text-slate-900">
                    {formatCurrency(project.quoted_amount)}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Paid</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrency(
                      project.payment_milestones
                        ?.filter((m) => m.status === "paid")
                        .reduce((sum, m) => sum + (m.paid_amount || 0), 0)
                    )}
                  </p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Pending</p>
                  <p className="text-lg font-bold text-yellow-600">
                    {formatCurrency(
                      project.payment_milestones
                        ?.filter(
                          (m) => m.status === "due" || m.status === "pending"
                        )
                        .reduce((sum, m) => sum + (m.amount || 0), 0)
                    )}
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Overdue</p>
                  <p className="text-lg font-bold text-red-600">
                    {formatCurrency(
                      project.payment_milestones
                        ?.filter((m) => m.status === "overdue")
                        .reduce((sum, m) => sum + (m.amount || 0), 0)
                    )}
                  </p>
                </div>
              </div>

              {/* Milestones List */}
              <div className="border border-slate-200 rounded-lg">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-medium text-slate-900">
                    Payment Milestones
                  </h3>
                  <button className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                    <PlusIcon className="w-4 h-4" />
                    Add Milestone
                  </button>
                </div>

                {project.payment_milestones &&
                project.payment_milestones.length > 0 ? (
                  <div className="divide-y divide-slate-200">
                    {project.payment_milestones.map((milestone) => (
                      <div key={milestone.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-slate-900">
                                {milestone.name}
                              </h4>
                              <span
                                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  milestone.status === "paid"
                                    ? "bg-green-100 text-green-700"
                                    : milestone.status === "overdue"
                                    ? "bg-red-100 text-red-700"
                                    : milestone.status === "due"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {PaymentMilestoneStatusLabels[milestone.status]}
                              </span>
                            </div>
                            {milestone.linked_phase && (
                              <p className="text-sm text-slate-500">
                                Linked to: {milestone.linked_phase.name}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-slate-900">
                              {formatCurrency(milestone.amount)}
                            </p>
                            {milestone.percentage && (
                              <p className="text-xs text-slate-500">
                                {milestone.percentage}% of total
                              </p>
                            )}
                          </div>
                        </div>
                        {milestone.status === "due" && (
                          <button className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                            <CreditCardIcon className="w-4 h-4" />
                            Record Payment
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <CreditCardIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">
                      No payment milestones
                    </p>
                    <p className="text-slate-500 text-sm mt-1">
                      Add payment milestones to track project payments
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LEADS TAB (Lead History) */}
          {activeTab === "leads" && project.lead && (
            <div className="space-y-6">
              {/* Lead Summary */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <SparklesIcon className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-medium text-amber-900">
                      Converted from Lead
                    </h3>
                    <p className="text-sm text-amber-700 mt-1">
                      This project was created from lead{" "}
                      <span className="font-mono font-medium">
                        {project.lead.lead_number}
                      </span>{" "}
                      on {formatDate(project.created_at)}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/sales/leads/${project.lead.id}`}
                    className="text-sm text-amber-700 hover:text-amber-900 underline"
                  >
                    View Lead →
                  </Link>
                </div>
              </div>

              {/* Lead Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Lead Info */}
                <div className="space-y-4">
                  <h3 className="font-medium text-slate-900 flex items-center gap-2">
                    <DocumentTextIcon className="w-4 h-4" />
                    Lead Information
                  </h3>
                  <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">
                        Lead Number
                      </span>
                      <span className="text-sm font-mono text-slate-900">
                        {project.lead.lead_number}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">
                        Final Stage
                      </span>
                      <span className="text-sm font-medium text-green-600">
                        {LeadStageLabels[
                          project.lead.stage as keyof typeof LeadStageLabels
                        ] || project.lead.stage}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Won Amount</span>
                      <span className="text-sm font-medium text-slate-900">
                        {formatCurrency(project.lead.won_amount)}
                      </span>
                    </div>
                    {project.lead.contract_signed_date && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">
                          Contract Signed
                        </span>
                        <span className="text-sm text-slate-900">
                          {formatDate(project.lead.contract_signed_date)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">
                        Lead Source
                      </span>
                      <span className="text-sm text-slate-900">
                        {LeadSourceLabels[
                          project.lead
                            .lead_source as keyof typeof LeadSourceLabels
                        ] ||
                          project.lead.lead_source ||
                          "-"}
                      </span>
                    </div>
                    {project.lead.lead_source_detail && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">
                          Source Details
                        </span>
                        <span className="text-sm text-slate-900">
                          {project.lead.lead_source_detail}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Property Info */}
                <div className="space-y-4">
                  <h3 className="font-medium text-slate-900 flex items-center gap-2">
                    <BuildingOffice2Icon className="w-4 h-4" />
                    Property Details
                  </h3>
                  <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                    {project.lead.property_name && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">
                          Property Name
                        </span>
                        <span className="text-sm text-slate-900">
                          {project.lead.property_name}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">
                        Property Type
                      </span>
                      <span className="text-sm text-slate-900">
                        {PropertyTypeLabels[
                          project.lead
                            .property_type as keyof typeof PropertyTypeLabels
                        ] || project.lead.property_type}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">
                        Service Type
                      </span>
                      <span className="text-sm text-slate-900">
                        {ServiceTypeLabels[
                          project.lead
                            .service_type as keyof typeof ServiceTypeLabels
                        ] || project.lead.service_type}
                      </span>
                    </div>
                    {project.lead.carpet_area_sqft && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-500">
                          Carpet Area
                        </span>
                        <span className="text-sm text-slate-900">
                          {project.lead.carpet_area_sqft} sq.ft
                        </span>
                      </div>
                    )}
                    {project.lead.property_address && (
                      <div>
                        <span className="text-sm text-slate-500">Address</span>
                        <p className="text-sm text-slate-900 mt-1">
                          {project.lead.property_address}
                          {project.lead.property_city &&
                            `, ${project.lead.property_city}`}
                          {project.lead.property_pincode &&
                            ` - ${project.lead.property_pincode}`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Lead Activity Timeline */}
              {project.lead_activities &&
                project.lead_activities.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-medium text-slate-900 flex items-center gap-2">
                      <ClockIcon className="w-4 h-4" />
                      Lead Activity History
                    </h3>
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
                      {project.lead_activities.map((activity, index) => (
                        <div key={activity.id} className="p-4 flex gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              activity.activity_type === "stage_change"
                                ? "bg-blue-100 text-blue-600"
                                : activity.activity_type === "call"
                                ? "bg-green-100 text-green-600"
                                : activity.activity_type === "meeting"
                                ? "bg-purple-100 text-purple-600"
                                : activity.activity_type === "email"
                                ? "bg-orange-100 text-orange-600"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {activity.activity_type === "stage_change" ? (
                              <ArrowPathIcon className="w-4 h-4" />
                            ) : activity.activity_type === "call" ? (
                              <PhoneIcon className="w-4 h-4" />
                            ) : activity.activity_type === "meeting" ? (
                              <UserCircleIcon className="w-4 h-4" />
                            ) : activity.activity_type === "email" ? (
                              <EnvelopeIcon className="w-4 h-4" />
                            ) : (
                              <DocumentTextIcon className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900">
                              {activity.title}
                            </p>
                            {activity.description && (
                              <p className="text-sm text-slate-600 mt-0.5">
                                {activity.description}
                              </p>
                            )}
                            <p className="text-xs text-slate-500 mt-1">
                              {activity.creator?.name || "System"} •{" "}
                              {formatRelativeTime(activity.created_at)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* PROCUREMENT TAB */}
          {activeTab === "procurement" && (
            <div className="text-center py-12">
              <ShoppingCartIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">Procurement</p>
              <p className="text-slate-500 text-sm mt-1">
                Procurement tracking feature coming soon
              </p>
            </div>
          )}

          {/* DOCUMENTS TAB */}
          {activeTab === "documents" && (
            <div className="text-center py-12">
              <DocumentTextIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">No documents yet</p>
              <p className="text-slate-500 text-sm mt-1">
                Documents feature coming soon
              </p>
            </div>
          )}

          {/* NOTES TAB */}
          {activeTab === "notes" && (
            <ProjectNotesTab
              projectId={id}
              phases={(project.phases || []).filter((p) => p.is_enabled)}
              onCreateNote={() => setShowCreateNoteModal(true)}
              onEditNote={(note) => setEditingNote(note)}
            />
          )}

          {/* TASKS TAB */}
          {activeTab === "tasks" && (
            <ProjectTasksTab
              projectId={id}
              projectNumber={project.project_number}
              phases={(project.phases || []).filter((p) => p.is_enabled)}
            />
          )}

          {/* ROOMS TAB */}
          {activeTab === "rooms" && <ProjectRoomsTab projectId={id} />}

          {/* PROJECT MGMT TAB */}
          {activeTab === "project-mgmt" && (
            <ProjectMgmtTab
              projectId={id}
              projectCategory={project.project_category}
              phases={project.phases || []}
              initializingPhases={initializingPhases}
              onInitializePhases={() => initializePhases(false)}
              onResetPhases={() => {
                if (
                  confirm(
                    "This will delete all existing phases and re-create them from templates. Continue?"
                  )
                ) {
                  initializePhases(true);
                }
              }}
              onRefresh={fetchProject}
              onEditPhase={handleEditPhase}
              onEditSubPhase={handleEditSubPhase}
              onQuickAction={handleQuickAction}
            />
          )}
        </div>
      </div>

      {/* Sub-Phase Detail Panel */}
      {selectedSubPhase && (
        <SubPhaseDetailPanel
          isOpen={showSubPhasePanel}
          onClose={() => {
            setShowSubPhasePanel(false);
            setSelectedSubPhase(null);
          }}
          projectId={id}
          phaseId={selectedSubPhase.phaseId}
          subPhaseId={selectedSubPhase.subPhaseId}
          onUpdate={() => {
            // Refresh project data
            fetchProject();
          }}
        />
      )}

      {/* Phase Edit Modal */}
      <PhaseEditModal
        isOpen={showPhaseEditModal}
        phase={editingPhase}
        projectId={id}
        onClose={() => {
          setShowPhaseEditModal(false);
          setEditingPhase(null);
        }}
        onSave={() => {
          fetchProject();
        }}
      />

      {/* Sub-Phase Edit Modal */}
      {editingSubPhase && (
        <SubPhaseEditModal
          isOpen={showSubPhaseEditModal}
          subPhase={editingSubPhase.subPhase}
          phaseId={editingSubPhase.phaseId}
          phaseName={editingSubPhase.phaseName}
          projectId={id}
          onClose={() => {
            setShowSubPhaseEditModal(false);
            setEditingSubPhase(null);
          }}
          onSave={() => {
            fetchProject();
          }}
        />
      )}
    </div>
  );
}

// Phase Card Component
interface PhaseCardProps {
  phase: ProjectPhase;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (status: string) => void;
  onSubPhaseStatusChange: (subPhaseId: string, status: string) => void;
  onChecklistToggle: (
    subPhaseId: string,
    itemId: string,
    value: boolean
  ) => void;
  onSubPhaseClick?: (subPhaseId: string) => void;
}

function PhaseCard({
  phase,
  expanded,
  onToggle,
  onStatusChange,
  onSubPhaseStatusChange,
  onChecklistToggle,
  onSubPhaseClick,
}: PhaseCardProps) {
  const isBlocked =
    phase.blocking_dependencies && phase.blocking_dependencies.length > 0;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="p-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {expanded ? (
              <ChevronDownIcon className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-slate-400" />
            )}
            <StatusIcon status={isBlocked ? "blocked" : phase.status} />
            <div>
              <h3 className="font-medium text-slate-900 text-sm">
                {phase.name}
              </h3>
              <p className="text-xs text-slate-500">
                {phase.category_code && (
                  <span className="capitalize">
                    {phase.category_code.toLowerCase()}
                  </span>
                )}
                {phase.assigned_user && ` • ${phase.assigned_user.name}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Progress */}
            <div className="flex items-center gap-2">
              <div className="w-20 bg-slate-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${
                    phase.status === "completed"
                      ? "bg-green-500"
                      : "bg-blue-500"
                  }`}
                  style={{ width: `${phase.progress_percentage}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-600 w-8">
                {phase.progress_percentage}%
              </span>
            </div>

            {/* Status Badge */}
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                isBlocked
                  ? "bg-orange-100 text-orange-700"
                  : phase.status === "completed"
                  ? "bg-green-100 text-green-700"
                  : phase.status === "in_progress"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {isBlocked ? "Blocked" : ProjectPhaseStatusLabels[phase.status]}
            </span>
          </div>
        </div>

        {/* Blocking Warning */}
        {isBlocked && (
          <div className="mt-2 ml-7 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800">
            <LockClosedIcon className="w-3 h-3 inline mr-1" />
            Waiting for: {phase.blocking_dependencies?.join(", ")}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-slate-200">
          {/* Quick Actions */}
          <div className="px-3 py-2 bg-slate-50 flex items-center gap-2">
            <span className="text-xs text-slate-500 mr-2">Actions:</span>
            {phase.status === "not_started" && !isBlocked && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange("in_progress");
                }}
                className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
              >
                <PlayIcon className="w-3 h-3" />
                Start
              </button>
            )}
            {phase.status === "in_progress" && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange("completed");
                  }}
                  className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                >
                  <CheckCircleIcon className="w-3 h-3" />
                  Complete
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange("on_hold");
                  }}
                  className="flex items-center gap-1 px-2 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
                >
                  <PauseIcon className="w-3 h-3" />
                  Hold
                </button>
              </>
            )}
            {phase.status === "on_hold" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange("in_progress");
                }}
                className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
              >
                <ArrowPathIcon className="w-3 h-3" />
                Resume
              </button>
            )}
          </div>

          {/* Sub-phases */}
          {phase.sub_phases && phase.sub_phases.length > 0 && (
            <div className="p-3 space-y-2">
              {phase.sub_phases.map((subPhase) => (
                <SubPhaseCard
                  key={subPhase.id}
                  subPhase={subPhase}
                  onStatusChange={(status) =>
                    onSubPhaseStatusChange(subPhase.id, status)
                  }
                  onChecklistToggle={(itemId, value) =>
                    onChecklistToggle(subPhase.id, itemId, value)
                  }
                  onClick={() => onSubPhaseClick?.(subPhase.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Sub-phase Card Component
interface SubPhaseCardProps {
  subPhase: ProjectSubPhase;
  onStatusChange: (status: string) => void;
  onChecklistToggle: (itemId: string, value: boolean) => void;
  onClick?: () => void;
}

function SubPhaseCard({
  subPhase,
  onStatusChange,
  onChecklistToggle,
  onClick,
}: SubPhaseCardProps) {
  const [showChecklist, setShowChecklist] = useState(false);

  return (
    <div
      className="border border-slate-100 rounded p-2 bg-white cursor-pointer hover:bg-slate-50 hover:border-slate-200 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon status={subPhase.status} />
          <span className="text-sm text-slate-900">{subPhase.name}</span>
          {subPhase.checklist_items && subPhase.checklist_items.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowChecklist(!showChecklist);
              }}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              ({subPhase.checklist_items.filter((i) => i.is_completed).length}/
              {subPhase.checklist_items.length})
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-12 bg-slate-200 rounded-full h-1">
            <div
              className="h-1 rounded-full bg-blue-500"
              style={{ width: `${subPhase.progress_percentage}%` }}
            />
          </div>
          {subPhase.status === "not_started" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange("in_progress");
              }}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Start
            </button>
          )}
          {subPhase.status === "in_progress" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange("completed");
              }}
              className="text-xs text-green-600 hover:text-green-800"
            >
              Done
            </button>
          )}
        </div>
      </div>

      {/* Checklist */}
      {showChecklist && subPhase.checklist_items && (
        <div
          className="mt-2 pl-6 space-y-1"
          onClick={(e) => e.stopPropagation()}
        >
          {subPhase.checklist_items.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={item.is_completed}
                onChange={() => onChecklistToggle(item.id, item.is_completed)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span
                className={`text-xs ${
                  item.is_completed
                    ? "text-slate-400 line-through"
                    : "text-slate-700"
                }`}
              >
                {item.name}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
