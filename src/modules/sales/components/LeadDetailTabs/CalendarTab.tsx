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
  // Deliberately NOT passing externalEvents.
  //
  // This used to filter the lead's activities client-side, which meant the tab
  // only ever saw lead_activities. /api/calendar is a union of meetings,
  // standalone events AND note follow-ups, so filtering here silently hid the
  // follow-ups a user had just created. Letting the component fetch keeps this
  // tab identical to the main calendar.
  return (
    <CalendarTableReusable
      linkedType="lead"
      linkedId={leadId}
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
