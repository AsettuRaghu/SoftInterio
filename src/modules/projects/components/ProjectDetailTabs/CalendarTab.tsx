"use client";

import { CalendarTableReusable } from "@/components/calendar";

interface CalendarEvent {
  id: string;
  activity_type: string;
  meeting_type?: string;
  title: string;
  description?: string | null;
  created_at: string;
  created_user?: { name: string; id: string; avatar_url?: string | null };
  meeting_scheduled_at?: string | null;
  meeting_location?: string | null;
  meeting_completed?: boolean;
  meeting_notes?: string | null;
  attendees?: any[];
}

interface CalendarTabProps {
  projectId: string;
  activities: CalendarEvent[];
  projectClosed?: boolean;
  onAddEventClick?: () => void;
  onEditEvent?: (event: any) => void;
  onRefresh?: () => void;
  onCountChange?: (count: number) => void;
}

export default function CalendarTab({
  projectId,
  activities,
  projectClosed = false,
  onAddEventClick,
  onEditEvent,
  onRefresh,
  onCountChange,
}: CalendarTabProps) {
  // Same reasoning as the lead tab: filtering activities here would show only
  // lead_activities, hiding standalone events and note follow-ups that
  // /api/calendar already returns. Let the component fetch the full union.
  return (
    <CalendarTableReusable
      linkedType="project"
      linkedId={projectId}
      showHeader={false}
      compact={true}
      readOnly={projectClosed}
      allowCreate={!projectClosed}
      allowEdit={!projectClosed}
      allowDelete={false}
      showFilters={true}
      onCreateEvent={onAddEventClick}
      onEditEvent={onEditEvent}
      onRefresh={onRefresh}
    />
  );
}
