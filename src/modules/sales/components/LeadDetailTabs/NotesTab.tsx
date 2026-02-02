"use client";

import NotesTableReusable from "@/components/notes/NotesTableReusable";
import { LeadNote } from "@/types/leads";

interface NotesTabProps {
  notes: LeadNote[];
  leadClosed: boolean;
  onAddNoteClick: () => void;
  onEditNote?: (note: LeadNote) => void;
  onDeleteNote?: (note: LeadNote) => void;
  onTogglePin?: (noteId: string, isPinned: boolean) => void;
  formatDateTime: (date: string) => string;
}

export default function NotesTab({
  notes,
  leadClosed,
  onAddNoteClick,
  onEditNote,
  onDeleteNote,
  onTogglePin,
  formatDateTime,
}: NotesTabProps) {
  return (
    <NotesTableReusable
      notes={notes}
      allowCreate={!leadClosed}
      allowEdit={!leadClosed}
      allowDelete={false}
      allowPin={true}
      showFilters={true}
      readOnly={leadClosed}
      onCreateNote={onAddNoteClick}
      onEditNote={onEditNote}
      onDeleteNote={onDeleteNote}
      onTogglePin={onTogglePin}
    />
  );
}
