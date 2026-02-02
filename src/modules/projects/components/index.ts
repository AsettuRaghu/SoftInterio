// Export all project module components

// Detail Tab Components
export {
  OverviewTab,
  ManagementTab,
  NotesTab,
  DocumentsTab,
  TasksTab,
  RoomsTab,
  QuotationsTab,
  CalendarTab,
  TimelineTab,
} from "./ProjectDetailTabs";

// Table and Filter Components
export { default as ProjectsFilterBar } from "./ProjectsFilterBar";
export { default as ProjectsTable } from "./ProjectsTable";

// Modal and Panel Components
export { default as PhaseEditModal } from "./PhaseEditModal";
export { default as SubPhaseEditModal } from "./SubPhaseEditModal";
export { default as SubPhaseDetailPanel } from "./SubPhaseDetailPanel";
export { EditProjectModal, type EditProjectFormData } from "./EditProjectModal";
