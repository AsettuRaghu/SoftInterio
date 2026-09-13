"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  BuildingOffice2Icon,
  PauseIcon,
  XMarkIcon,
  PlusIcon,
  LinkIcon,
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
  NotesTab,
  OverviewTab,
  DocumentsTab,
  CalendarTab,
  TimelineTab,
  QuotationsTab,
  PhaseEditModal,
  SubPhaseEditModal,
} from "@/modules/projects/components";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { phaseEditToTaskUpdate } from "@/lib/projects/playbook-adapter";
import { formatCurrency as formatCurrencyUtil } from "@/modules/projects/utils";
import { SpacesTab } from "@/components/property/SpacesTab";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { PaymentsTab } from "@/components/projects/PaymentsTab";
import { ProcurementTab } from "@/components/projects/ProcurementTab";
import { StageStrip } from "@/components/projects/StageStrip";

interface PageProps {
  params: Promise<{ id: string }>;
}

type TabKey = ProjectDetailTab;

export default function ProjectDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useCurrentUser();
  const { hasAnyPermission } = useUserPermissions();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
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

  // Tab counts and data
  const [documentsCount, setDocumentsCount] = useState(0);
  const [documents, setDocuments] = useState<any[]>([]);
  const [tasksCount, setTasksCount] = useState(0);
  const [tasks, setTasks] = useState<any[]>([]);
  const [notesCount, setNotesCount] = useState(0);
  const [notes, setNotes] = useState<any[]>([]);
  // Targeted refetch for the notes composer - reloading the whole project
  // page after saving a note would be needlessly heavy.
  const refetchNotes = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/projects/${id}/notes`);
    if (res.ok) {
      const data = await res.json();
      const list = data.notes || [];
      setNotes(list);
      setNotesCount(list.length);
    }
  }, [id]);
  const [calendarCount, setCalendarCount] = useState(0);
  const [activities, setActivities] = useState<any[]>([]);
  // The lead page loads these from the same endpoint and hands them to its
  // Tasks tab. The project page passed teamMembers={undefined}, so assigning a
  // project task had no one to choose from.
  // A playbook run rendered as a phase tree. This is the convergence proof:
  // if the tree can draw a playbook, it is a view rather than a second engine.
  const [playbook, setPlaybook] = useState<{
    runId: string;
    name: string;
    version: number;
    stepCount: number;
    startedAt: string | null;
  } | null>(null);
  const [playbookPhases, setPlaybookPhases] = useState<any[]>([]);
  // Set when the playbook has moved on since this plan adopted it.
  const [playbookDrift, setPlaybookDrift] = useState<{
    currentVersion: number;
    newSteps: number;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [teamMembers, setTeamMembers] = useState<
    { id: string; name: string; email: string; avatar_url?: string }[]
  >([]);
  const [quotationsCount, setQuotationsCount] = useState(0);
  const [quotations, setQuotations] = useState<any[]>([]);

  // One flag, because there is one fetch. There used to be six - tabDataLoading,
  // tabDataLoading, tabDataLoading, tabDataLoading, tabDataLoading and
  // tabDataLoading - all set and cleared together by fetchCounts, so they
  // could never disagree. tabDataLoading was never read at all, and the Timeline
  // tab keyed off tabDataLoading, which was harmless only by accident.
  const [tabDataLoading, setTabDataLoading] = useState(true);

  // Payments is gated on a permission, not on a hardcoded list of role names.
  // The old check was roles.includes("finance"|"admin"|"owner"), which the flat
  // permission model does not use and which quietly excluded Finance Manager -
  // its slug is finance_manager, so it never matched "finance".
  /**
   * Who sees where the plan came from, and who may stop it.
   *
   * The provenance banner and the stop control are not information a site
   * supervisor needs - they are the controls for changing how the business
   * works, and showing them to everybody invited a click that the server would
   * refuse anyway. tasks.edit is what PATCH /api/playbooks/runs/[runId]
   * actually requires to stop a run, and it happens to be the same four roles
   * that may author a playbook at all: Owner, Admin, Manager, Designer.
   */
  const canManagePlaybook = hasAnyPermission(["tasks.edit"]);

  const canSeePayments = hasAnyPermission([
    "finance.payments.view",
    "projects.milestones.manage",
  ]);

  useEffect(() => {
    fetchProject();
    fetchCounts();
    void fetchTeamMembers();
    void fetchPlaybook();
  }, [id]);

  /**
   * Every id in the rendered playbook, phases and steps alike.
   *
   * The Plan tab draws phases and playbook steps with the same component, so
   * before saving an edit it has to know which one it is looking at: a phase
   * id belongs to the phase routes, a playbook id is a task.
   */
  const playbookNodeIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const phase of playbookPhases) {
      ids.add(phase.id);
      for (const step of phase.sub_phases ?? []) ids.add(step.id);
    }
    return ids;
  }, [playbookPhases]);

  const savePlaybookNode = async (
    nodeId: string,
    edit: Parameters<typeof phaseEditToTaskUpdate>[0],
  ) => {
    const res = await fetch(`/api/tasks/${nodeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(phaseEditToTaskUpdate(edit)),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Could not update this step");
    }
    await fetchPlaybook();
    return res.json();
  };

  /**
   * Take in the steps the playbook has gained. Additive only - nothing already
   * under way is touched, which is the point of the version being pinned.
   */
  /**
   * Stop the playbook this plan is following.
   *
   * Settled steps keep the outcome they earned; open ones are cancelled, so
   * the record of what was done survives. The control lives here because this
   * is where the playbook is worked - it existed only inside an expanded run
   * on the Tasks tab, which nobody would find.
   */
  const stopPlaybook = async () => {
    const reason = window.prompt(
      "Why is this playbook being stopped? Finished steps keep their outcome; anything still open is cancelled.",
    );
    if (reason === null) return;
    if (!playbook?.runId) return;

    const res = await fetch(`/api/playbooks/runs/${playbook.runId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled", reason }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error || "Could not stop the playbook");
      return;
    }
    await fetchPlaybook();
    await fetchCounts();
    await fetchProject();
  };

  const syncPlaybook = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/projects/${id}/playbook/sync`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchPlaybook();
        await fetchCounts();
      }
    } finally {
      setSyncing(false);
    }
  };

  const fetchPlaybook = async () => {
    try {
      const res = await fetch(`/api/projects/${id}/playbook`);
      if (!res.ok) return;
      const data = await res.json();
      setPlaybook(data.playbook);
      setPlaybookPhases(data.phases || []);
      setPlaybookDrift(data.drift ?? null);
    } catch {
      // The native phases still render; the playbook is additive.
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const res = await fetch("/api/team/members");
      const data = await res.json();
      // Shape is { success, data } - the same read as useLeadDetail.
      if (res.ok && data.success && data.data) {
        setTeamMembers(
          data.data.map((m: any) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            avatar_url: m.avatar_url,
          })),
        );
      }
    } catch {
      // A missing team list only costs the assignee dropdown its options.
    }
  };

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
      setTabDataLoading(true);

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

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        const tasksList = data.tasks || [];
        setTasks(tasksList);
        setTasksCount(tasksList.length);
      }

      if (notesRes.ok) {
        const data = await notesRes.json();
        const notesList = data.notes || [];
        setNotes(notesList);
        setNotesCount(notesList.length);
      }

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
      setTabDataLoading(false);
    } catch (err) {
      console.error("Error fetching counts:", err);
      setTabDataLoading(false);
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

      // A playbook step is a task. Sending it to the sub-phase route was the
      // "Not found" - that route resolves phase rows, and a task id is not one.
      if (playbookNodeIds.has(subPhaseId)) {
        return await savePlaybookNode(subPhaseId, {
          status: newStatus,
          notes,
        });
      }

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

  /**
   * Starting, completing, holding or skipping a PHASE.
   *
   * A playbook phase is a task, so it goes to the task route like a step does;
   * a native phase goes to the phase route. Without this the row that decides
   * when a stage begins had no action at all, which mattered once steps could
   * wait for their phase to start - nothing could ever be opened.
   */
  const handlePhaseQuickAction = async (
    phaseId: string,
    action: "start" | "hold" | "resume" | "complete" | "cancel",
    notes: string,
  ) => {
    const statusMap: Record<string, string> = {
      start: "in_progress",
      hold: "on_hold",
      resume: "in_progress",
      complete: "completed",
      cancel: "skipped",
    };
    const newStatus = statusMap[action];
    if (!newStatus) return null;

    try {
      if (playbookNodeIds.has(phaseId)) {
        return await savePlaybookNode(phaseId, { status: newStatus, notes });
      }

      // The phase route wants status_change_notes when the status moves, not
      // notes - sending only the latter is accepted and then rejected for a
      // missing reason.
      const response = await fetch(`/api/projects/${id}/phases/${phaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          status_change_notes: notes,
          notes,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update the phase");
      }

      const updated = await response.json();
      fetchProject();
      return updated;
    } catch (err) {
      console.error("Phase action failed:", err);
      return null;
    }
  };

  // Handler for sub-phase click
  const handleSubPhaseClick = (phaseId: string, subPhaseId: string) => {
    // A playbook step is a task, so its detail view is the task page - which
    // already has the status gates, subtasks, comments and attachments. The
    // sub-phase panel reads phase rows and answered "Failed to fetch sub-phase
    // details" when handed a task id.
    if (playbookNodeIds.has(subPhaseId)) {
      router.push(`/dashboard/tasks/${subPhaseId}`);
      return;
    }
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

  // handleEditProject and handleSaveProjectEdit lived here, driving a second
  // edit dialog. handleEditProject was never called from anywhere, so that
  // dialog could not be opened at all; the header button set a flag nothing
  // read. Editing now goes through EditProjectDetailsModal on the Overview
  // tab, which is the one that was actually reachable.

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

  /**
   * Tab order and styling follow the lead detail page, so moving between a
   * lead and the project it became does not change the furniture.
   *
   * Leads run overview -> spaces -> quotations -> tasks -> notes -> documents
   * -> calendar -> timeline. Project Mgmt sits third, beside Overview and
   * Spaces, because it is the working view of the project rather than another
   * record of correspondence. Procurement and Payments have no counterpart on
   * a lead and follow at the end.
   *
   * No icons and no count badges: the lead tab bar has neither, and the two
   * sitting side by side is what made them look like different products.
   */
  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "spaces", label: "Spaces" },
    { key: "project-mgmt", label: "Plan" },
    { key: "quotations", label: "Quotations" },
    { key: "tasks", label: "Tasks" },
    { key: "notes", label: "Notes" },
    { key: "documents", label: "Documents" },
    { key: "calendar", label: "Calendar" },
    { key: "timeline", label: "Timeline" },
    { key: "procurement", label: "Procurement" },
    ...(canSeePayments
      ? [{ key: "payments" as TabKey, label: "Payments" }]
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
            {/* Where the work has got to, from the project's own playbook.
                The three status dots this replaced tracked the record, not the
                work - "in progress" covered first drawing to last snag. */}
            <StageStrip
              projectId={project.id}
              onStageClick={() => setActiveTab("project-mgmt")}
            />

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
              onClick={() => {
                // The dialog lives on the Overview tab, so move there before
                // opening it - otherwise it appears over an unrelated tab.
                setActiveTab("overview");
                setShowEditDetailsModal(true);
              }}
              className={cn(buttonVariants())}
            >
              Edit
            </button>
          </div>
        }
      />

      <PageContent>
        {/* Same markup as the lead detail page. */}
        <div className="flex border-b border-slate-200 mb-6 -mx-6 px-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div>
          {activeTab === "project-mgmt" && (
            <>
              {playbookDrift && canManagePlaybook && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-amber-900">
                      This plan follows version {playbook?.version}. The
                      playbook is now on version {playbookDrift.currentVersion}.
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {playbookDrift.newSteps > 0
                        ? `${playbookDrift.newSteps} step${
                            playbookDrift.newSteps === 1 ? " has" : "s have"
                          } been added since. Bringing them in adds them here and changes nothing already under way.`
                        : "No steps were added — only the rules changed, and work already begun keeps the rules it started with."}
                    </p>
                  </div>
                  {playbookDrift.newSteps > 0 && (
                    <button
                      type="button"
                      onClick={() => void syncPlaybook()}
                      disabled={syncing}
                      className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-300 bg-white text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                    >
                      {syncing
                        ? "Bringing in…"
                        : `Bring in ${playbookDrift.newSteps} step${
                            playbookDrift.newSteps === 1 ? "" : "s"
                          }`}
                    </button>
                  )}
                </div>
              )}

              {playbook && canManagePlaybook && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                  <p className="text-sm font-medium text-blue-900">
                    Drawn from the playbook &ldquo;{playbook.name}&rdquo; (v
                    {playbook.version})
                  </p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    {playbookPhases.length} phases and {playbook.stepCount}{" "}
                    steps. Started{" "}
                    {playbook.startedAt
                      ? new Date(playbook.startedAt).toLocaleDateString()
                      : "—"}
                    .
                  </p>
                  <button
                    type="button"
                    onClick={() => void stopPlaybook()}
                    className="mt-2 text-xs text-red-600 hover:underline"
                  >
                    Stop following this playbook
                  </button>
                </div>
              )}
              <ManagementTab
                projectId={project.id}
                phases={
                  playbookPhases.length > 0
                    ? playbookPhases
                    : project.phases || []
                }
                onInitializePhases={initializePhases}
                onRefresh={fetchProject}
                onEditPhase={handleEditPhase}
                onEditSubPhase={handleEditSubPhase}
                onSubPhaseClick={handleSubPhaseClick}
                onQuickAction={handleQuickAction}
                onPhaseQuickAction={handlePhaseQuickAction}
              />
            </>
          )}

          {/* The same Spaces the seller captured on the lead. They hang off
              the property, which the project shares, so scope is continuous
              from sale to site rather than restarting here.

              Replaces a Rooms tab that read quotation_spaces - a read-only view
              of what was priced, which the linked quotation already shows. What
              a project needs is what is to be built. */}
          {activeTab === "spaces" && (
            <SpacesTab propertyId={project.property_id || null} />
          )}

          {activeTab === "overview" && (
            <OverviewTab
              project={project}
              onUpdate={updateProject}
              isModalOpen={showEditDetailsModal}
              onModalClose={() => setShowEditDetailsModal(false)}
            />
          )}

          {activeTab === "tasks" && tabDataLoading ? (
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
              teamMembers={teamMembers}
              onCountChange={(count) => setTasksCount(count)}
              onRefresh={fetchCounts}
            />
          ) : null}

          {activeTab === "documents" && tabDataLoading ? (
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

          {activeTab === "notes" && tabDataLoading ? (
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
              onRefresh={refetchNotes}
            />
          ) : null}

          {activeTab === "timeline" && tabDataLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-200 rounded" />
              ))}
            </div>
          ) : activeTab === "timeline" ? (
            <TimelineTab
              projectId={project.id}
              activities={activities}
              projectClosed={project.status === "completed"}
              onRefresh={fetchCounts}
              onCountChange={(count) => setCalendarCount(count)}
            />
          ) : null}

          {activeTab === "calendar" && tabDataLoading ? (
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

          {activeTab === "quotations" && tabDataLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-200 rounded" />
              ))}
            </div>
          ) : activeTab === "quotations" ? (
            <QuotationsTab
              quotations={quotations}
              projectClosed={project.status === "completed"}
              onCountChange={(count) => setQuotationsCount(count)}
              onViewQuotation={(quotation) => {
                // Navigate to quotation view page
                router.push(`/dashboard/quotations/${quotation.id}`);
              }}
            />
          ) : null}

          {activeTab === "procurement" && (
            <ProcurementTab projectId={project.id} />
          )}

          {activeTab === "payments" && (
            <PaymentsTab
              projectId={project.id}
              contractValue={
                project.contract_value != null
                  ? Number(project.contract_value)
                  : null
              }
              projectClosed={project.status === "completed"}
            />
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
            onSaveOverride={
              editingPhase && playbookNodeIds.has(editingPhase.id)
                ? (updates) =>
                    savePlaybookNode(editingPhase.id, updates).then(() => {})
                : undefined
            }
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
            onSaveOverride={
              editingSubPhase.subPhase &&
              playbookNodeIds.has(editingSubPhase.subPhase.id)
                ? (updates) =>
                    savePlaybookNode(
                      editingSubPhase.subPhase!.id,
                      updates,
                    ).then(() => {})
                : undefined
            }
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
