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
  // Filter activities to only include meeting/calendar events
  const calendarEvents = (activities || []).filter(
    (activity) =>
      activity.activity_type === "meeting_scheduled" ||
      activity.activity_type === "client_meeting" ||
      activity.activity_type === "internal_meeting" ||
      activity.activity_type === "site_visit" ||
      (activity.meeting_scheduled_at && activity.meeting_scheduled_at !== null)
  );

  return (
    <CalendarTableReusable
      linkedType="project"
      linkedId={projectId}
      externalEvents={calendarEvents}
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
