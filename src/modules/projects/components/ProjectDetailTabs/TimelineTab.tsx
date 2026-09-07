"use client";

import TimelineTableReusable from "@/components/timeline/TimelineTableReusable";
import { ProjectActivityTypeLabels } from "@/types/projects";

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
      activityTypeLabels={ProjectActivityTypeLabels}
      showFilters={true}
      readOnly={projectClosed}
      onRefresh={onRefresh}
    />
  );
}
