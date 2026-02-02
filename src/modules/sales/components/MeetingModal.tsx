"use client";

import React, { useState } from "react";
import type { LeadActivity } from "@/types/leads";

interface Attendee {
  type: "team" | "external";
  id?: string;
  email?: string;
  name: string;
}

interface MeetingFormData {
  meeting_type: string;
  title: string;
  description: string;
  meeting_scheduled_at: string;
  meeting_location: string;
  meeting_completed: boolean;
  meeting_notes: string;
  attendees: Attendee[];
  save_notes_to_lead: boolean;
}

export function MeetingModal({
  leadId,
  meeting,
  onClose,
  onSuccess,
  teamMembers = [],
  clientEmail,
}: {
  leadId: string;
  meeting: LeadActivity | null;
  onClose: () => void;
  onSuccess: () => void;
  teamMembers?: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
  }[];
  clientEmail?: string;
}) {
  const isEditing = !!meeting;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAttendeeDropdown, setShowAttendeeDropdown] = useState(false);
  const [externalEmail, setExternalEmail] = useState("");

  const [formData, setFormData] = useState<MeetingFormData>({
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
      (a) => a.type === "team" && a.id === member.id
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
      (a) => a.type === "external" && a.email === externalEmail
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

      // Use meeting_type as activity_type directly for new meeting types
      // client_meeting, internal_meeting, site_visit are valid activity types
      // For "other", we use meeting_scheduled as the activity type
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
        save_notes_to_lead: formData.save_notes_to_lead,
      };

      const url = isEditing
        ? `/api/sales/leads/${leadId}/activities?activityId=${meeting.id}`
        : `/api/sales/leads/${leadId}/activities`;

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

          {/* Attendees */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Attendees
            </label>

            {/* Selected Attendees */}
            {formData.attendees.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.attendees.map((attendee, index) => (
                  <span
                    key={index}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      attendee.type === "team"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    {attendee.type === "team" ? (
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
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    ) : (
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
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                    {attendee.name}
                    <button
                      type="button"
                      onClick={() => removeAttendee(index)}
                      className="hover:bg-white/50 rounded-full p-0.5"
                    >
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-left text-sm text-slate-500 hover:border-slate-300 focus:ring-2 focus:ring-blue-500"
              >
                + Add attendee
              </button>

              {showAttendeeDropdown && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg">
                  {/* Client Email Option */}
                  {clientEmail && (
                    <>
                      <div className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-50">
                        Client
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const exists = formData.attendees.some(
                            (a) =>
                              a.type === "external" && a.email === clientEmail
                          );
                          if (!exists) {
                            setFormData({
                              ...formData,
                              attendees: [
                                ...formData.attendees,
                                {
                                  type: "external",
                                  email: clientEmail,
                                  name: clientEmail,
                                },
                              ],
                            });
                          }
                          setShowAttendeeDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                      >
                        <svg
                          className="w-4 h-4 text-purple-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        {clientEmail}
                      </button>
                    </>
                  )}

                  {/* Team Members */}
                  {teamMembers.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-50">
                        Team Members
                      </div>
                      <div className="max-h-32 overflow-y-auto">
                        {teamMembers.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => addTeamAttendee(member)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                          >
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium">
                              {member.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)}
                            </div>
                            {member.name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {/* External Email */}
                  <div className="px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 border-t">
                    Add External Email
                  </div>
                  <div className="p-2 flex gap-2">
                    <input
                      type="email"
                      value={externalEmail}
                      onChange={(e) => setExternalEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addExternalAttendee();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={addExternalAttendee}
                      className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Brief agenda or purpose of the meeting..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Meeting Completed (only for editing) */}
          {isEditing && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="meeting_completed"
                checked={formData.meeting_completed}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    meeting_completed: e.target.checked,
                  })
                }
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="meeting_completed"
                className="text-sm text-slate-700"
              >
                Mark as completed
              </label>
            </div>
          )}

          {/* Meeting Notes (only when completed) */}
          {(isEditing || formData.meeting_completed) && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                Meeting Notes
              </label>
              <textarea
                rows={3}
                value={formData.meeting_notes}
                onChange={(e) =>
                  setFormData({ ...formData, meeting_notes: e.target.value })
                }
                placeholder="Summary of what was discussed..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
              {/* Option to save notes to lead notes tab */}
              {formData.meeting_notes && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="save_notes_to_lead"
                    checked={formData.save_notes_to_lead}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        save_notes_to_lead: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <label
                    htmlFor="save_notes_to_lead"
                    className="text-sm text-slate-600"
                  >
                    Also save to Lead Notes
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                "Update Meeting"
              ) : (
                "Schedule Meeting"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
