import { LeadActivity } from "@/types/leads";

export function MeetingCard({
  meeting,
  onEdit,
  onComplete,
  isPast = false,
  formatDateTime,
}: {
  meeting: LeadActivity;
  onEdit: () => void;
  onComplete?: () => void;
  isPast?: boolean;
  formatDateTime: (date: string) => string;
}) {
  const typeLabel =
    meeting.activity_type === "site_visit"
      ? "Site Visit"
      : meeting.activity_type === "meeting_completed"
      ? "Meeting Completed"
      : "Meeting";

  const typeIcon =
    meeting.activity_type === "site_visit" ? (
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
          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
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
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    );

  return (
    <div
      className={`p-4 rounded-lg border transition-all ${
        isPast || meeting.meeting_completed
          ? "bg-slate-50 border-slate-200"
          : "bg-white border-blue-200 shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              isPast || meeting.meeting_completed
                ? "bg-slate-100 text-slate-500"
                : meeting.activity_type === "site_visit"
                ? "bg-purple-100 text-purple-600"
                : "bg-blue-100 text-blue-600"
            }`}
          >
            {typeIcon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {meeting.title}
              </p>
              {meeting.meeting_completed && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                  Completed
                </span>
              )}
              {meeting.meeting_type && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                  {meeting.meeting_type === "client_meeting"
                    ? "Client"
                    : meeting.meeting_type === "internal_meeting"
                    ? "Internal"
                    : meeting.meeting_type === "site_visit"
                    ? "Site Visit"
                    : "Other"}
                </span>
              )}
            </div>
            {/* Date, Time & Location on same line */}
            <div className="flex items-center gap-3 text-sm text-slate-600 flex-wrap">
              {meeting.meeting_scheduled_at && (
                <span className="flex items-center gap-1">
                  <svg
                    className="w-3.5 h-3.5 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {formatDateTime(meeting.meeting_scheduled_at)}
                </span>
              )}
              {meeting.meeting_location && (
                <span className="flex items-center gap-1">
                  <svg
                    className="w-3.5 h-3.5 text-slate-400"
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
                </span>
              )}
            </div>
            {/* Attendees */}
            {meeting.attendees && meeting.attendees.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <svg
                  className="w-3.5 h-3.5 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <div className="flex flex-wrap gap-1">
                  {meeting.attendees.map((attendee: any, idx: number) => (
                    <span
                      key={idx}
                      className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        attendee.type === "team"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {attendee.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {meeting.description && (
              <p className="text-xs text-slate-500 mt-2">
                {meeting.description}
              </p>
            )}
            {meeting.meeting_notes && (
              <div className="mt-2 p-2 bg-slate-100 rounded text-xs text-slate-600">
                <strong>Notes:</strong> {meeting.meeting_notes}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-2">
              {typeLabel} • Created {formatDateTime(meeting.created_at)}
              {meeting.created_user && ` by ${meeting.created_user.name}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isPast && !meeting.meeting_completed && onComplete && (
            <button
              onClick={onComplete}
              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit meeting"
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
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
