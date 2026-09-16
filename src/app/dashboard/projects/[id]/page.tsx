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
  ProjectNote,
  ProjectDetailTab,
  ProjectCategoryLabels,
  ProjectStatusLabels,
} from "@/types/projects";
import {
  PageLayout,
  PageHeader,
  PageContent,
  StatusBadge,
} from "@/components/ui/PageLayout";
import {
  TasksTab,
  NotesTab,
  OverviewTab,
  DocumentsTab,
  CalendarTab,
  TimelineTab,
  QuotationsTab,
} from "@/modules/projects/components";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { formatCurrency as formatCurrencyUtil } from "@/modules/projects/utils";
import { SpacesTab } from "@/components/property/SpacesTab";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { ProcurementTab } from "@/components/projects/ProcurementTab";
import { StageStrip } from "@/components/projects/StageStrip";
import { PlanTab } from "@/modules/projects/components/ProjectDetailTabs/PlanTab";
import { useReviseQuotation } from "@/lib/quotations/use-revise-quotation";
import { Toast } from "@/components/ui/Toast";
import { usePrompt } from "@/components/ui/PromptDialog";
import { PlaybooksPanel } from "@/components/playbooks";
import { KickoffChecklist } from "@/components/projects/KickoffChecklist";
import { WaitingOnPanel } from "@/components/projects/WaitingOnPanel";
import { ProjectStatusAction } from "@/components/projects/ProjectStatusAction";
import { EditTaskModal } from "@/components/tasks";

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
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);

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
  // The active playbook run, and its steps shaped as a stage tree for the
  // Plan tab (a top-level step is a stage, its children are the steps).
  const [playbook, setPlaybook] = useState<{
    runId: string;
    name: string;
    version: number;
    stepCount: number;
    startedAt: string | null;
  } | null>(null);
  const [playbookStages, setPlaybookStages] = useState<
    { id: string; steps?: { id: string }[] }[]
  >([]);
  // Set when the playbook has moved on since this plan adopted it.
  const [playbookDrift, setPlaybookDrift] = useState<{
    currentVersion: number;
    newSteps: number;
  } | null>(null);
  /**
   * One task editor for the whole page.
   *
   * A playbook phase and step are tasks, so editing one opens the same modal as
   * editing any other task. This also revives the Edit button on the Tasks tab,
   * which called an onTaskClick nobody had passed and therefore did nothing.
   */
  const [editingTask, setEditingTask] = useState<any | null>(null);
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

  // Same handler the lead page uses - see lib/quotations/use-revise-quotation.
  const { revise, revisingId } = useReviseQuotation();
  const { prompt, promptDialog } = usePrompt();
  const [notice, setNotice] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

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
  // Kick-off is "edit the project" - the server also checks tasks.create,
  // because confirming makes the plan's tasks real work.
  const canEditProject = hasAnyPermission(["projects.edit", "projects.update"]);
  const awaitingKickoff = project?.status === "new" && !project?.kicked_off_at;

  /**
   * How far the kick-off checklist has got, for the header button and the
   * Overview banner - the two places that tell a new project's PM that
   * kick-off exists at all. The checklist itself is on the Plan tab.
   */
  const [kickoffReady, setKickoffReady] = useState<{ ready: number; of: number } | null>(null);
  const fetchKickoffReady = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/kickoff`);
      const json = await res.json();
      if (!res.ok || !json.data) return;
      const missing = new Set<string>(json.data.missing ?? []);
      const sections = [
        !missing.has("handover_review"),
        !missing.has("playbook"),
        !missing.has("playbook") && !missing.has("stage_owners") && !missing.has("stage_dates"),
        !missing.has("ask_dates"),
      ];
      setKickoffReady({ ready: sections.filter(Boolean).length, of: sections.length });
    } catch {
      /* the button still reads "Kick off" */
    }
  }, [id]);


  /*
   * Payments has been taken off the project page deliberately.
   *
   * A project's delivery team works here, and what a client has paid is not
   * theirs to see - a permission gate still put the tab in front of anyone
   * holding finance.payments.view while they were looking at delivery. It
   * belongs in a finance module of its own, so `PaymentsTab` and
   * /api/projects/[id]/payment-milestones are left in place for that to pick
   * up rather than deleted.
   */

  useEffect(() => {
    fetchProject();
    fetchCounts();
    void fetchTeamMembers();
    void fetchPlaybook();
  }, [id]);


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
    if (!playbook?.runId) return;

    const reason = await prompt({
      title: "Stop following this playbook?",
      message:
        "Finished steps keep their outcome; anything still open is cancelled. Say why, so the record explains itself later.",
      placeholder: "The client changed the scope…",
      confirmLabel: "Stop the playbook",
      required: true,
      multiline: true,
    });
    if (reason === null) return;

    const res = await fetch(`/api/playbooks/runs/${playbook.runId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled", reason }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setNotice({
        message: data.error || "Could not stop the playbook",
        variant: "error",
      });
      return;
    }
    // Quietly: this changes the plan, not the page. fetchProject used to blank
    // the whole screen and refetch every tab to reflect it.
    await Promise.all([fetchPlaybook(), fetchCounts(), fetchProject({ quiet: true })]);
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

  /**
   * Refresh the plan, and nothing else.
   *
   * The Plan tab's refresh - the icon above the table, and a step action -
   * used to call fetchProject, which sets the PAGE-level loading state: the
   * whole project detail page was replaced by a skeleton and every tab's data
   * was refetched. That is what "the page gets refreshed" was.
   *
   * This re-reads the project row (progress and the stage strip in the header
   * come from it) and the playbook, and touches no loading flag, so the table
   * simply changes.
   */
  const [planVersion, setPlanVersion] = useState(0);
  useEffect(() => {
    if (awaitingKickoff) void fetchKickoffReady();
  }, [awaitingKickoff, fetchKickoffReady, planVersion]);
  const refreshPlan = useCallback(async () => {
    setPlanVersion((v) => v + 1);
    try {
      const [projectRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetchPlaybook(),
      ]);
      if (projectRes.ok) {
        const data = await projectRes.json();
        if (data.project) setProject(data.project);
      }
    } catch {
      // A failed refresh leaves what is on screen, which is the last thing
      // known to be true. Better than emptying the tab.
    }
  }, [id]);

  /**
   * The plan is re-read every time you open the tab.
   *
   * Everything above loads once, on mount, keyed on the project id - switching
   * tabs fetches nothing. So completing a step on the Tasks tab (or anywhere
   * else) left the Plan tab showing whatever it had when the page opened: a
   * stage that was finished minutes ago still reading "In Progress".
   *
   * refreshPlan touches no loading flag, so this is silent - the table is
   * simply right when you look at it. Deliberately only the plan: the other
   * tabs share fetchCounts, which blanks the page.
   */
  useEffect(() => {
    if (activeTab !== "project-mgmt") return;
    void refreshPlan();
  }, [activeTab, refreshPlan]);

  /**
   * The same for the Tasks tab, in the other direction.
   *
   * The Plan tab and the Tasks tab are two views of the same task rows, so
   * whichever you left is stale the moment you act on the other. This reads
   * only the task list - not fetchCounts, which blanks the page - so it is
   * silent.
   */
  const refreshTasks = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/tasks?related_type=project&related_id=${id}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      const list = data.tasks || [];
      setTasks(list);
      // The tab badge is set by fetchCounts; keep it in step or it drifts from
      // the list beneath it.
      setTasksCount(list.length);
    } catch {
      // Leave what is on screen rather than emptying the tab.
    }
  }, [id]);

  useEffect(() => {
    if (activeTab !== "tasks") return;
    void refreshTasks();
  }, [activeTab, refreshTasks]);

  const fetchPlaybook = async () => {
    try {
      const res = await fetch(`/api/projects/${id}/playbook`);
      if (!res.ok) return;
      const data = await res.json();
      setPlaybook(data.playbook);
      setPlaybookStages(data.stages || []);
      setPlaybookDrift(data.drift ?? null);
    } catch {
      // Leave the plan as it was rather than emptying the tab.
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

  /**
   * Load the project.
   *
   * `quiet` skips the page-level loading flag. That flag replaces the whole
   * detail page with a skeleton, which is right on first load and wrong after an
   * action - stopping a playbook or completing a step blew the page away and
   * refetched every tab to show one change. Same fix as the lead page.
   */
  const fetchProject = async (options?: { quiet?: boolean }) => {
    try {
      if (!options?.quiet) setLoading(true);
      const response = await fetch(`/api/projects/${id}`);
      if (!response.ok) throw new Error("Failed to fetch project");
      const data = await response.json();
      setProject(data.project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      if (!options?.quiet) setLoading(false);
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

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to update project");
      }
      /*
       * A save can succeed on the project and still fail on its linked property
       * or client - the route says so in `warnings` rather than swallowing it,
       * which is how "property edits never save" went unnoticed for so long.
       * Silence here would put it straight back.
       */
      if (Array.isArray(data.warnings) && data.warnings.length) {
        setNotice({ message: data.warnings.join(" "), variant: "error" });
      }
      await fetchProject({ quiet: true });
    } catch (err) {
      // The dialog awaiting this turns the rejection into its own error line;
      // logging it here as well put an intended refusal ("kick off from the
      // Plan tab") into the dev overlay as a Console Error.
      throw err;
    }
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
   * record of correspondence. Procurement has no counterpart on a lead and
   * follows at the end; Payments used to sit beside it and has been removed -
   * see the note on canSeePayments above.
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
            {/* The next thing to do, like the lead page's stage button. A new
                project's next thing is kick-off, and nothing else on the page
                said so - the checklist sat on the Plan tab waiting to be
                found. Hold / complete / reopen take this slot as they arrive. */}
            {awaitingKickoff && (
              <button
                onClick={() => {
                  setActiveTab("project-mgmt");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={cn(buttonVariants(), "bg-emerald-600 hover:bg-emerald-700 gap-2")}
              >
                Kick off
                {kickoffReady && (
                  <span className="rounded bg-white/20 px-1.5 py-0.5 text-[11px] font-medium tabular-nums">
                    {kickoffReady.ready} of {kickoffReady.of} ready
                  </span>
                )}
              </button>
            )}
            {!awaitingKickoff && (
              <ProjectStatusAction
                projectId={project.id}
                status={project.status}
                canEdit={canEditProject}
                onChanged={(message) => {
                  setNotice({ message, variant: "success" });
                  void fetchProject({ quiet: true });
                  void fetchCounts();
                }}
              />
            )}
            <button
              onClick={() => {
                // The dialog lives on the Overview tab, so move there before
                // opening it - otherwise it appears over an unrelated tab.
                setActiveTab("overview");
                setShowEditDetailsModal(true);
              }}
              className={cn(buttonVariants({ variant: "outline" }))}
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
              {/* A new project has no plan until its project manager makes
                  one. The checklist is the whole Plan tab until Confirm;
                  the stages appear beneath it as soon as a playbook is
                  chosen, so the dates being set are the ones on screen. */}
              {awaitingKickoff && (
                <div className="mb-4">
                  <KickoffChecklist
                    projectId={project.id}
                    teamMembers={teamMembers}
                    canEdit={canEditProject}
                    onChanged={() => {
                      void refreshPlan();
                      void refreshTasks();
                    }}
                    onKickedOff={(message) => {
                      setNotice({ message, variant: "success" });
                      // Status, dates and the timeline all changed; the
                      // page refetches quietly rather than blanking.
                      void fetchProject({ quiet: true });
                      void fetchCounts();
                    }}
                    onError={(message) => setNotice({ message, variant: "error" })}
                  />
                </div>
              )}

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
                /* One line. This was a three-line card carrying the playbook
                   name, a count, a start date and a link, above a plan that is
                   the actual content of the tab. */
                <div className="mb-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span className="truncate">
                    <span className="text-slate-400">Playbook</span>{" "}
                    <span className="font-medium text-slate-700">
                      {playbook.name}
                    </span>
                    <span className="text-slate-400"> v{playbook.version}</span>
                    <span className="text-slate-300"> · </span>
                    {playbookStages.length} stages, {playbook.stepCount} steps
                    {playbook.startedAt && (
                      <>
                        <span className="text-slate-300"> · </span>
                        since {new Date(playbook.startedAt).toLocaleDateString()}
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => void stopPlaybook()}
                    className="shrink-0 text-slate-400 hover:text-red-600 hover:underline"
                    title="Stop following this playbook. Open steps are cancelled; finished work is kept."
                  >
                    Stop
                  </button>
                </div>
              )}

              {/*
                * No playbook: say so, and offer one here.
                *
                * A playbook is the only way a project is planned, so a project
                * without a run has no plan at all - and the place to choose one
                * is the tab where the plan will appear. The panel shows only
                * when there is no active run: stopping a playbook above makes
                * it reappear, so "stop this and use a different one" is one
                * flow in one place.
                */}
              {!playbook && canManagePlaybook && !awaitingKickoff && (
                <div className="mb-3 rounded-lg border border-slate-200 bg-white p-4">
                  <p className="mb-3 text-xs text-slate-500">
                    This project has no plan yet. Choose the playbook it
                    should follow; its steps become the project's tasks.
                  </p>
                  <PlaybooksPanel
                    relatedType="project"
                    relatedId={project.id}
                    readOnly={project.status === "completed"}
                    onRunChange={() => {
                      void refreshPlan();
                      void refreshTasks();
                    }}
                  />
                </div>
              )}

              {/* What the project waits on someone else for. After kick-off
                  this is the working list; the checklist showed it before. */}
              {playbook && !awaitingKickoff && (
                <WaitingOnPanel
                  projectId={project.id}
                  canEdit={canEditProject && project.status !== "completed"}
                  refreshKey={planVersion}
                  onChanged={() => void fetchCounts()}
                  onError={(message) => setNotice({ message, variant: "error" })}
                />
              )}

              {/* A plan IS the tasks table, scoped to the run. */}
              {playbook ? (
                <PlanTab
                  projectId={project.id}
                  tasks={tasks}
                  runId={playbook.runId ?? null}
                  orderedStages={playbookStages}
                  projectClosed={project.status === "completed"}
                  teamMembers={teamMembers}
                  onRefresh={() => {
                    void refreshPlan();
                    void refreshTasks();
                  }}
                  onTaskClick={(task) => setEditingTask(task)}
                />
              ) : !canManagePlaybook && !awaitingKickoff ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
                  No plan has been set for this project yet.
                </div>
              ) : null}
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

          {activeTab === "overview" && awaitingKickoff && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[16rem]">
                <p className="text-sm font-semibold text-emerald-900">This project has not been kicked off</p>
                <p className="text-xs text-emerald-800">
                  Review the handover from Sales, choose the playbook, set owners and dates, and confirm.
                  That is what moves it to In Progress
                  {kickoffReady ? ` — ${kickoffReady.ready} of ${kickoffReady.of} parts are ready.` : "."}
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveTab("project-mgmt");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={cn(buttonVariants({ size: "sm" }), "bg-emerald-600 hover:bg-emerald-700")}
              >
                Open the kick-off checklist
              </button>
            </div>
          )}

          {activeTab === "overview" && (
            <OverviewTab
              project={project}
              onUpdate={updateProject}
              // The page already loads these for the task assignee dropdown;
              // the edit dialog needs them to offer a project manager.
              teamMembers={teamMembers}
              onSaved={(message) => setNotice({ message, variant: "success" })}
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
              onEditTask={(task) => setEditingTask(task)}
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
              onReviseQuotation={(quotationId, e) => {
                e.stopPropagation();
                e.preventDefault();
                void revise(quotationId).catch((err) =>
                  setNotice({
                    message:
                      err instanceof Error
                        ? err.message
                        : "Failed to create revision",
                    variant: "error",
                  })
                );
              }}
              revisingId={revisingId}
            />
          ) : null}

          {activeTab === "procurement" && (
            <ProcurementTab projectId={project.id} />
          )}
        </div>

        <EditTaskModal
          task={editingTask}
          isOpen={!!editingTask}
          onClose={() => setEditingTask(null)}
          onUpdate={() => {
            setEditingTask(null);
            void refreshTasks();
            void refreshPlan();
          }}
        />

        {promptDialog}
        <Toast
          message={notice?.message ?? null}
          variant={notice?.variant ?? "error"}
          onDismiss={() => setNotice(null)}
        />
      </PageContent>
    </PageLayout>
  );
}
