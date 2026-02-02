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
  activities: CalendarEvent[];
  leadId: string;
  leadClosed: boolean;
  onAddEventClick?: () => void;
  onEditEvent?: (event: any) => void;
  onRefresh?: () => void;
}

export default function CalendarTab({
  activities,
  leadId,
  leadClosed,
  onAddEventClick,
  onEditEvent,
  onRefresh,
}: CalendarTabProps) {
  // Filter activities to only include meeting/calendar events
  const calendarEvents = activities.filter(
    (activity) =>
      activity.activity_type === "meeting_scheduled" ||
      activity.activity_type === "client_meeting" ||
      activity.activity_type === "internal_meeting" ||
      activity.activity_type === "site_visit" ||
      (activity.meeting_scheduled_at && activity.meeting_scheduled_at !== null)
  );

  return (
    <CalendarTableReusable
      linkedType="lead"
      linkedId={leadId}
      externalEvents={calendarEvents}
      showHeader={false}
      compact={true}
      readOnly={leadClosed}
      allowCreate={!leadClosed}
      allowEdit={!leadClosed}
      allowDelete={false}
      showFilters={true}
      onCreateEvent={onAddEventClick}
      onEditEvent={onEditEvent}
      onRefresh={onRefresh}
    />
  );
}
