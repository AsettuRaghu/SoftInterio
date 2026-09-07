"use client";

import NotesTableReusable from "@/components/notes/NotesTableReusable";
import type { ProjectNote } from "@/types/projects";
import { ProjectNoteCategoryLabels } from "@/types/projects";

interface NotesTabProps {
  projectId: string;
  notes: ProjectNote[];
  projectClosed?: boolean;
  onAddNoteClick?: () => void;
  onEditNote?: (note: ProjectNote) => void;
  onDeleteNote?: (note: ProjectNote) => void;
  onCountChange?: (count: number) => void;
  onRefresh?: () => void;
}

export default function NotesTab({
  projectId,
  notes,
  projectClosed = false,
  onAddNoteClick,
  onEditNote,
  onDeleteNote,
  onCountChange,
  onRefresh,
}: NotesTabProps) {
  return (
    <NotesTableReusable
      notes={notes || []}
      // The shared component owns creation and follow-up editing, so leads
      // and projects behave identically rather than each wiring its own flow.
      // allowCreate plus createEndpoint are what render the button;
      // onCreateNote is an optional hook for the page, not a requirement.
      createEndpoint={`/api/projects/${projectId}/notes`}
      updateEndpoint={`/api/projects/${projectId}/notes`}
      showNoteTitle
      noteCategories={Object.entries(ProjectNoteCategoryLabels).map(
        ([value, label]) => ({ value, label })
      )}
      onRefresh={onRefresh}
      allowCreate={!projectClosed}
      allowEdit={!projectClosed}
      allowDelete={false}
      showFilters={true}
      readOnly={projectClosed}
      onCreateNote={onAddNoteClick}
      onEditNote={onEditNote}
      onDeleteNote={onDeleteNote}
    />
  );
}
