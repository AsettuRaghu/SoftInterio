"use client";

import NotesTableReusable from "@/components/notes/NotesTableReusable";
import type { ProjectNote } from "@/types/projects";

interface NotesTabProps {
  projectId: string;
  notes: ProjectNote[];
  projectClosed?: boolean;
  onAddNoteClick?: () => void;
  onEditNote?: (note: ProjectNote) => void;
  onDeleteNote?: (note: ProjectNote) => void;
  onTogglePin?: (noteId: string, isPinned: boolean) => void;
  onCountChange?: (count: number) => void;
}

export default function NotesTab({
  projectId,
  notes,
  projectClosed = false,
  onAddNoteClick,
  onEditNote,
  onDeleteNote,
  onTogglePin,
  onCountChange,
}: NotesTabProps) {
  return (
    <NotesTableReusable
      notes={notes || []}
      allowCreate={!projectClosed}
      allowEdit={!projectClosed}
      allowDelete={false}
      allowPin={true}
      showFilters={true}
      readOnly={projectClosed}
      onCreateNote={onAddNoteClick}
      onEditNote={onEditNote}
      onDeleteNote={onDeleteNote}
      onTogglePin={onTogglePin}
    />
  );
}
