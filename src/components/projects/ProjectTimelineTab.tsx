"use client";

import React, { useState, useEffect } from "react";
import {
  CalendarIcon,
  MapPinIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

// Define simplified types locally to avoid dependency issues
interface Activity {
  id: string;
  activity_type: string;
  title: string;
  description?: string;
  created_at: string;
  created_user?: { name: string };
  meeting_scheduled_at?: string;
  meeting_location?: string;
  meeting_completed?: boolean;
  meeting_notes?: string;
  attendees?: any[];
  meeting_type?: string;
}

interface ProjectTimelineTabProps {
  projectId: string;
  leadId?: string;
}

export default function ProjectTimelineTab({
  projectId,
  leadId,
}: ProjectTimelineTabProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActivities();
  }, [projectId, leadId]);

  const fetchActivities = async () => {
    try {
      setLoading(true);

      // Fetch both project activities and lead activities (if linked)
      const requests = [fetch(`/api/projects/${projectId}/activities`)];

      if (leadId) {
        requests.push(fetch(`/api/sales/leads/${leadId}/activities`));
      }

      const responses = await Promise.all(requests);

      let allActivities: Activity[] = [];

      // Process project activities
      if (responses[0].ok) {
        const projectData = await responses[0].json();
        allActivities = [...(projectData.activities || [])];
      }

      // Process lead activities if available
      if (leadId && responses[1]?.ok) {
        const leadData = await responses[1].json();
        allActivities = [...allActivities, ...(leadData.activities || [])];
      }

      // Sort all activities by created_at descending
      allActivities.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setActivities(allActivities);
    } catch (err) {
      console.error("Error fetching activities:", err);
      setError("Failed to load timeline");
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-16 bg-slate-200 rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        No activities yet. Activities will appear here when notes are added,
        status changes, etc.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="flex gap-4 p-4 bg-slate-50 rounded-lg"
        >
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              activity.activity_type.includes("meeting")
                ? "bg-blue-100 text-blue-600"
                : activity.activity_type === "note_added"
                ? "bg-amber-100 text-amber-600"
                : activity.activity_type.includes("task")
                ? "bg-green-100 text-green-600"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {activity.activity_type.includes("meeting") ? (
              <CalendarIcon className="w-4 h-4" />
            ) : activity.activity_type === "note_added" ? (
              <ChatBubbleLeftRightIcon className="w-4 h-4" />
            ) : activity.activity_type.includes("task") ? (
              <CheckCircleIcon className="w-4 h-4" />
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900">
              {activity.title}
            </p>
            {activity.description && (
              <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                {activity.description}
              </p>
            )}
            {activity.meeting_scheduled_at && (
              <p className="text-xs text-slate-500 mt-1">
                <CalendarIcon className="w-3 h-3 inline mr-1" />
                Scheduled: {formatDateTime(activity.meeting_scheduled_at)}
                {activity.meeting_location && ` • ${activity.meeting_location}`}
              </p>
            )}
            <p className="text-xs text-slate-400 mt-1.5">
              {formatDateTime(activity.created_at)}
              {activity.created_user && <> by {activity.created_user.name}</>}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
