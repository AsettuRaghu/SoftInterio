"use client";

import TimelineTableReusable from "@/components/timeline/TimelineTableReusable";
import {
  LeadActivity,
  LeadStageHistory,
  LeadStageLabels,
  LeadActivityTypeLabels,
} from "@/types/leads";

interface TimelineTabProps {
  activities: LeadActivity[];
  stageHistory: LeadStageHistory[];
  formatDateTime: (date: string) => string;
}

export default function TimelineTab({
  activities,
  stageHistory,
  formatDateTime,
}: TimelineTabProps) {
  return (
    <TimelineTableReusable
      activities={activities}
      stageHistory={stageHistory}
      activityTypeLabels={LeadActivityTypeLabels}
      stageLabels={LeadStageLabels}
      showFilters={true}
      readOnly={true}
    />
  );
}
