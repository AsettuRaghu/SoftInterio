"use client";

import React, { useState, useEffect } from "react";
import { 
  CalendarIcon, 
  MapPinIcon, 
  ChatBubbleLeftRightIcon,
  CheckCircleIcon
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

export default function ProjectTimelineTab({ projectId, leadId }: ProjectTimelineTabProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (leadId) {
      fetchActivities();
    } else {
      setLoading(false);
    }
  }, [leadId]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      // Fetch lead activities
      const response = await fetch(`/api/sales/leads/${leadId}/activities`);
      if (!response.ok) throw new Error("Failed to fetch timeline");
      const data = await response.json();
      setActivities(data.activities || []);
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
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  if (!leadId) {
    return (
      <div className="text-center py-12 text-slate-500">
        No lead history linked to this project.
      </div>
    );
  }

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
        No activities found in lead history.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h3 className="text-lg font-medium text-slate-900 mb-4">Lead History & Timeline</h3>
      
      <div className="relative border-l-2 border-slate-200 ml-4 space-y-8 pl-8 pb-4">
        {activities.map((activity) => (
          <div key={activity.id} className="relative">
            {/* Timeline simplified marker */}
            <div className={`absolute -left-[41px] top-0 w-5 h-5 rounded-full border-2 border-white 
              ${activity.activity_type.includes('meeting') ? 'bg-blue-500' : 
                activity.activity_type === 'stage_changed' ? 'bg-green-500' : 'bg-slate-400'}`} 
            />
            
            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
               <div className="flex justify-between items-start mb-2">
                 <div>
                   <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-1
                     ${activity.activity_type.includes('meeting') ? 'bg-blue-100 text-blue-700' : 
                       activity.activity_type === 'stage_changed' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                     {activity.activity_type.replace('_', ' ')}
                   </span>
                   <h4 className="font-semibold text-slate-900">{activity.title}</h4>
                 </div>
                 <span className="text-xs text-slate-500 whitespace-nowrap">
                   {formatDateTime(activity.created_at)}
                 </span>
               </div>
               
               {activity.description && (
                 <p className="text-sm text-slate-600 mb-3 whitespace-pre-line">{activity.description}</p>
               )}

               {/* Meeting Details */}
               {(activity.activity_type.includes('meeting') || activity.meeting_scheduled_at) && (
                 <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                   {activity.meeting_scheduled_at && (
                     <div className="flex items-center gap-2 text-slate-600">
                       <CalendarIcon className="w-4 h-4 text-slate-400" />
                       <span>Scheduled: {formatDateTime(activity.meeting_scheduled_at)}</span>
                     </div>
                   )}
                   {activity.meeting_location && (
                     <div className="flex items-center gap-2 text-slate-600">
                       <MapPinIcon className="w-4 h-4 text-slate-400" />
                       <span>{activity.meeting_location}</span>
                     </div>
                   )}
                   {activity.meeting_completed && (
                      <div className="flex items-center gap-2 text-green-600 md:col-span-2">
                        <CheckCircleIcon className="w-4 h-4" />
                        <span className="font-medium">Meeting Completed</span>
                      </div>
                   )}
                   {activity.meeting_notes && (
                     <div className="md:col-span-2 bg-slate-50 p-3 rounded text-slate-700">
                       <div className="flex items-center gap-2 font-medium mb-1 text-xs text-slate-500">
                         <ChatBubbleLeftRightIcon className="w-3 h-3" />
                         MEETING NOTES
                       </div>
                       {activity.meeting_notes}
                     </div>
                   )}
                 </div>
               )}
               
               {activity.created_user && (
                 <div className="mt-2 text-xs text-slate-400 text-right">
                   by {activity.created_user.name}
                 </div>
               )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
