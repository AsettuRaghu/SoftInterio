"use client";

import NotesTableReusable from "@/components/notes/NotesTableReusable";
import { LeadNote } from "@/types/leads";

interface NotesTabProps {
  leadId: string;
  notes: LeadNote[];
  leadClosed: boolean;
  onAddNoteClick: () => void;
  onEditNote?: (note: LeadNote) => void;
  onDeleteNote?: (note: LeadNote) => void;
  onRefresh?: () => void;
  formatDateTime: (date: string) => string;
}

export default function NotesTab({
  leadId,
  notes,
  leadClosed,
  onAddNoteClick,
  onEditNote,
  onDeleteNote,
  onRefresh,
  formatDateTime,
}: NotesTabProps) {
  return (
    <NotesTableReusable
      notes={notes}
      // The shared component owns creation and follow-up editing, so leads
      // and projects behave identically rather than each wiring its own flow.
      createEndpoint={`/api/sales/leads/${leadId}/notes`}
      updateEndpoint="/api/sales/leads/notes"
      onRefresh={onRefresh}
      allowCreate={!leadClosed}
      allowEdit={!leadClosed}
      allowDelete={false}
      showFilters={true}
      readOnly={leadClosed}
      onCreateNote={onAddNoteClick}
      onEditNote={onEditNote}
      onDeleteNote={onDeleteNote}
    />
  );
}
