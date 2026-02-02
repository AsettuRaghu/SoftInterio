"use client";

import TimelineTableReusable from "@/components/timeline/TimelineTableReusable";

interface TimelineEvent {
  id: string;
  activity_type: string;
  title: string;
  description?: string | null;
  created_at: string;
  created_user?: { name: string; id: string; avatar_url?: string | null };
  meeting_scheduled_at?: string | null;
  meeting_location?: string | null;
  meeting_completed?: boolean;
  meeting_notes?: string | null;
  attendees?: any[];
  meeting_type?: string;
}

interface TimelineTabProps {
  projectId: string;
  activities: TimelineEvent[];
  projectClosed?: boolean;
  onRefresh?: () => void;
  onCountChange?: (count: number) => void;
}

const ActivityTypeLabels: Record<string, string> = {
  call_made: "Call Made",
  call_received: "Call Received",
  call_missed: "Call Missed",
  email_sent: "Email Sent",
  email_received: "Email Received",
  meeting_scheduled: "Meeting Scheduled",
  meeting_completed: "Meeting Completed",
  client_meeting: "Client Meeting",
  internal_meeting: "Internal Meeting",
  site_visit: "Site Visit",
  quotation_sent: "Quotation Sent",
  quotation_revised: "Quotation Revised",
  quotation_approved: "Quotation Approved",
  project_created: "Project Created",
  status_changed: "Status Changed",
  task_created: "Task Created",
  task_completed: "Task Completed",
  document_uploaded: "Document Uploaded",
  note_added: "Note Added",
};

export default function TimelineTab({
  projectId,
  activities,
  projectClosed = false,
  onRefresh,
  onCountChange,
}: TimelineTabProps) {
  // Filter activities to include only timeline-relevant items
  const timelineActivities = (activities || []).filter(
    (activity) =>
      activity.activity_type !== "internal_log" &&
      activity.activity_type !== "system_event"
  );

  return (
    <TimelineTableReusable
      activities={timelineActivities}
      activityTypeLabels={ActivityTypeLabels}
      showFilters={true}
      readOnly={projectClosed}
      onRefresh={onRefresh}
    />
  );
}
