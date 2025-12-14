"use client";

import React, { useState, useEffect, useCallback } from "react";

interface Activity {
  id: string;
  activity_type: string;
  meeting_type?: string;
  title: string;
  description?: string;
  created_at: string;
  created_user?: { name: string };
  meeting_scheduled_at?: string;
  meeting_location?: string;
  meeting_completed?: boolean;
  meeting_notes?: string;
  attendees?: any[];
}

interface ProjectCalendarTabProps {
  projectId: string;
  leadId?: string; // Optional now since we don't use it
  onCountChange?: (count: number) => void;
}

export default function ProjectCalendarTab({
  projectId,
  leadId,
  onCountChange,
}: ProjectCalendarTabProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Activity | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const fetchActivities = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/projects/${projectId}/activities`);
      if (response.ok) {
        const data = await response.json();
        const meetings = (data.activities || []).filter(
          (a: any) =>
            a.activity_type === "meeting_scheduled" ||
            a.activity_type === "meeting_completed" ||
            a.activity_type === "site_visit" ||
            a.activity_type === "client_meeting" ||
            a.activity_type === "internal_meeting"
        );
        setActivities(meetings);
        onCountChange?.(meetings.length);
      }
    } catch (err) {
      console.error("Failed to fetch activities:", err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, onCountChange]);

  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch("/api/team/members");
      const data = await response.json();
      if (response.ok && data.success && data.data) {
        setTeamMembers(
          data.data.map((m: any) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            avatar_url: m.avatar_url,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch team members:", err);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
    fetchTeamMembers();
  }, [fetchActivities, fetchTeamMembers]);

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleCompleteMeeting = async (meetingId: string) => {
    try {
      await fetch(
        `/api/projects/${projectId}/activities?activityId=${meetingId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            meeting_completed: true,
          }),
        }
      );
      fetchActivities();
    } catch (err) {
      console.error("Error completing meeting:", err);
    }
  };

  // Separate into upcoming and past
  const now = new Date();
  const upcoming = activities
    .filter(
      (m) =>
        m.meeting_scheduled_at &&
        new Date(m.meeting_scheduled_at) >= now &&
        !m.meeting_completed
    )
    .sort(
      (a, b) =>
        new Date(a.meeting_scheduled_at!).getTime() -
        new Date(b.meeting_scheduled_at!).getTime()
    );
  const past = activities
    .filter(
      (m) =>
        !m.meeting_scheduled_at ||
        new Date(m.meeting_scheduled_at) < now ||
        m.meeting_completed
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-slate-900">
            Meetings & Site Visits
          </h3>
          <button
            onClick={() => {
              setEditingMeeting(null);
              setShowMeetingModal(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Schedule Meeting
          </button>
        </div>

        {activities.length === 0 ? (
          <div className="text-center py-8">
            <svg
              className="w-12 h-12 text-slate-300 mx-auto mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm font-medium text-slate-700 mb-1">
              No meetings scheduled yet
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Schedule a meeting or site visit with the customer to track your
              interactions.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Upcoming Meetings */}
            {upcoming.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  Upcoming ({upcoming.length})
                </h4>
                <div className="space-y-2">
                  {upcoming.map((meeting) => (
                    <div
                      key={meeting.id}
                      className="p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-slate-900">
                            {meeting.title}
                          </p>
                          {meeting.description && (
                            <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">
                              {meeting.description}
                            </p>
                          )}
                          {meeting.meeting_location && (
                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                              <svg
                                className="w-3 h-3 shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                              {meeting.meeting_location}
                            </p>
                          )}
                          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                            {formatDateTime(
                              meeting.meeting_scheduled_at || null
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingMeeting(meeting);
                              setShowMeetingModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
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
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleCompleteMeeting(meeting.id)}
                            className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded"
                            title="Mark as completed"
                          >
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
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Past Meetings */}
            {past.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-slate-400 rounded-full"></span>
                  Past ({past.length})
                </h4>
                <div className="space-y-3">
                  {past.map((meeting) => (
                    <div
                      key={meeting.id}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-lg opacity-75 group hover:opacity-100 transition-opacity"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-700">
                            {meeting.title}
                          </p>
                          {meeting.description && (
                            <p className="text-xs text-slate-600 mt-1">
                              {meeting.description}
                            </p>
                          )}
                          {meeting.meeting_location && (
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                              {meeting.meeting_location}
                            </p>
                          )}
                          <p className="text-xs text-slate-500 mt-2">
                            {formatDateTime(
                              meeting.meeting_scheduled_at || meeting.created_at
                            )}
                          </p>
                          {meeting.meeting_completed &&
                            meeting.meeting_notes && (
                              <div className="mt-2 p-2 bg-white rounded border border-slate-200">
                                <p className="text-xs text-slate-600">
                                  {meeting.meeting_notes}
                                </p>
                              </div>
                            )}
                        </div>
                        <button
                          onClick={() => {
                            setEditingMeeting(meeting);
                            setShowMeetingModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit"
                        >
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
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Meeting Modal */}
      {showMeetingModal && (
        <MeetingModal
          projectId={projectId}
          meeting={editingMeeting}
          onClose={() => {
            setShowMeetingModal(false);
            setEditingMeeting(null);
          }}
          onSuccess={() => {
            setShowMeetingModal(false);
            setEditingMeeting(null);
            fetchActivities();
          }}
          teamMembers={teamMembers}
        />
      )}
    </>
  );
}

// Meeting Modal Component
function MeetingModal({
  projectId,
  meeting,
  onClose,
  onSuccess,
  teamMembers = [],
}: {
  projectId: string;
  meeting: Activity | null;
  onClose: () => void;
  onSuccess: () => void;
  teamMembers?: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
  }[];
}) {
  const isEditing = !!meeting;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAttendeeDropdown, setShowAttendeeDropdown] = useState(false);
  const [externalEmail, setExternalEmail] = useState("");

  const [formData, setFormData] = useState({
    meeting_type: meeting?.meeting_type || "client_meeting",
    title: meeting?.title || "",
    description: meeting?.description || "",
    meeting_scheduled_at: meeting?.meeting_scheduled_at
      ? new Date(meeting.meeting_scheduled_at).toISOString().slice(0, 16)
      : "",
    meeting_location: meeting?.meeting_location || "",
    meeting_completed: meeting?.meeting_completed || false,
    meeting_notes: meeting?.meeting_notes || "",
    attendees: meeting?.attendees || [],
    save_notes_to_lead: false,
  });

  const addTeamAttendee = (member: {
    id: string;
    name: string;
    email: string;
  }) => {
    const exists = formData.attendees.some(
      (a: any) => a.type === "team" && a.id === member.id
    );
    if (!exists) {
      setFormData({
        ...formData,
        attendees: [
          ...formData.attendees,
          { type: "team", id: member.id, name: member.name },
        ],
      });
    }
    setShowAttendeeDropdown(false);
  };

  const addExternalAttendee = () => {
    if (!externalEmail.trim() || !externalEmail.includes("@")) return;
    const exists = formData.attendees.some(
      (a: any) => a.type === "external" && a.email === externalEmail
    );
    if (!exists) {
      setFormData({
        ...formData,
        attendees: [
          ...formData.attendees,
          {
            type: "external",
            email: externalEmail.trim(),
            name: externalEmail.trim(),
          },
        ],
      });
    }
    setExternalEmail("");
    setShowAttendeeDropdown(false);
  };

  const removeAttendee = (index: number) => {
    setFormData({
      ...formData,
      attendees: formData.attendees.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    if (!formData.meeting_scheduled_at) {
      setError("Date and time are required");
      return;
    }

    try {
      setIsSubmitting(true);

      const activityType = [
        "client_meeting",
        "internal_meeting",
        "site_visit",
      ].includes(formData.meeting_type)
        ? formData.meeting_type
        : "meeting_scheduled";

      const payload = {
        activity_type: activityType,
        meeting_type: formData.meeting_type,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        meeting_scheduled_at: formData.meeting_scheduled_at
          ? new Date(formData.meeting_scheduled_at).toISOString()
          : null,
        meeting_location: formData.meeting_location.trim() || null,
        meeting_completed: formData.meeting_completed,
        meeting_notes: formData.meeting_notes.trim() || null,
        attendees: formData.attendees,
        save_notes_to_project: formData.save_notes_to_lead, // Changed field name
      };

      const url = isEditing
        ? `/api/projects/${projectId}/activities?activityId=${meeting.id}`
        : `/api/projects/${projectId}/activities`;

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save meeting");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            {isEditing ? "Edit Meeting" : "Schedule Meeting"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 max-h-[70vh] overflow-y-auto"
        >
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Meeting Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.meeting_type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  meeting_type: e.target.value as any,
                })
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="client_meeting">Client Meeting</option>
              <option value="internal_meeting">Internal Meeting</option>
              <option value="site_visit">Site Visit</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder={
                formData.meeting_type === "site_visit"
                  ? "e.g., Initial site inspection"
                  : formData.meeting_type === "internal_meeting"
                  ? "e.g., Design team review"
                  : "e.g., Design consultation"
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Date & Time */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Date & Time <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={formData.meeting_scheduled_at}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  meeting_scheduled_at: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Location
            </label>
            <input
              type="text"
              value={formData.meeting_location}
              onChange={(e) =>
                setFormData({ ...formData, meeting_location: e.target.value })
              }
              placeholder="e.g., Client's property, Office, or Video call link"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              placeholder="Add any additional details about the meeting"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Attendees */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Attendees
            </label>

            {/* Selected Attendees */}
            {formData.attendees.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.attendees.map((attendee: any, index: number) => (
                  <span
                    key={index}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      attendee.type === "team"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    {attendee.name || attendee.email}
                    <button
                      type="button"
                      onClick={() => removeAttendee(index)}
                      className="hover:text-red-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add Attendee Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAttendeeDropdown(!showAttendeeDropdown)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-left text-sm text-slate-500 hover:border-blue-300"
              >
                + Add attendee
              </button>

              {showAttendeeDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  <div className="p-2 border-b border-slate-200">
                    <input
                      type="email"
                      value={externalEmail}
                      onChange={(e) => setExternalEmail(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addExternalAttendee();
                        }
                      }}
                      placeholder="External email..."
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded"
                    />
                  </div>
                  {teamMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => addTeamAttendee(member)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-2"
                    >
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium">
                        {member.name.charAt(0)}
                      </span>
                      {member.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Notes (if completed) */}
          {formData.meeting_completed && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Meeting Notes
              </label>
              <textarea
                value={formData.meeting_notes}
                onChange={(e) =>
                  setFormData({ ...formData, meeting_notes: e.target.value })
                }
                rows={3}
                placeholder="Add notes about what was discussed..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
            >
              {isSubmitting
                ? "Saving..."
                : isEditing
                ? "Update Meeting"
                : "Schedule Meeting"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
