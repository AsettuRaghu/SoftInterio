"use client";

/**
 * One icon per kind of thing that can happen to a lead.
 *
 * The leads list has two columns that answer "what is going on with this lead"
 * - Follow-up for what is owed next, Last Activity for what just happened - and
 * both were text only. A seller scanning forty rows cannot tell a booked site
 * visit from a note reminder from an overdue task without reading each line, and
 * the point of a list is not to read each line.
 *
 * One map, shared by both columns, so a task is drawn the same way whether it
 * is coming up or just got done. Grouped by family rather than one icon per
 * enum member: twenty-four activity types drawn twenty-four ways would be a
 * legend, not a signal.
 *
 * Colour is the family's, not a status: red and amber for "overdue" and "today"
 * are the date's job and stay on the date.
 */

import type { ComponentType, SVGProps } from "react";
import {
  CalendarDaysIcon,
  ChatBubbleLeftEllipsisIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  ArrowPathIcon,
  UserIcon,
  BellAlertIcon,
  ClipboardDocumentCheckIcon,
  CurrencyRupeeIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export interface ActivityIcon {
  Icon: IconComponent;
  /** Tailwind text colour for the glyph. */
  tone: string;
  /** What to say on hover, when the row's own text does not already say it. */
  name: string;
}

const ICONS = {
  calendar: { Icon: CalendarDaysIcon, tone: "text-blue-500", name: "Meeting" },
  siteVisit: { Icon: MapPinIcon, tone: "text-blue-500", name: "Site visit" },
  followUp: { Icon: BellAlertIcon, tone: "text-violet-500", name: "Follow-up" },
  task: { Icon: ClipboardDocumentCheckIcon, tone: "text-slate-500", name: "Task" },
  taskDone: { Icon: CheckCircleIcon, tone: "text-emerald-500", name: "Task completed" },
  note: { Icon: ChatBubbleLeftEllipsisIcon, tone: "text-amber-500", name: "Note" },
  call: { Icon: PhoneIcon, tone: "text-teal-500", name: "Call" },
  email: { Icon: EnvelopeIcon, tone: "text-teal-500", name: "Email" },
  quotation: { Icon: CurrencyRupeeIcon, tone: "text-emerald-600", name: "Quotation" },
  document: { Icon: DocumentTextIcon, tone: "text-slate-500", name: "Document" },
  stage: { Icon: ArrowPathIcon, tone: "text-indigo-500", name: "Stage change" },
  person: { Icon: UserIcon, tone: "text-slate-500", name: "Assignment" },
  lead: { Icon: SparklesIcon, tone: "text-slate-400", name: "Lead" },
} as const satisfies Record<string, ActivityIcon>;

/**
 * The icon for an entry in `upcoming_items` - what the API says is owed next.
 * `kind` is one of follow_up | task | calendar.
 */
export function iconForUpcoming(kind: string): ActivityIcon {
  switch (kind) {
    case "calendar":
      return ICONS.calendar;
    case "task":
      return ICONS.task;
    case "follow_up":
    default:
      return ICONS.followUp;
  }
}

/**
 * The icon for a `lead_activities.activity_type` - what just happened.
 *
 * Families, in the order they are checked: meetings and visits (booked or
 * held), tasks, notes, calls, email, quotations, documents, stage and
 * assignment changes, and the lead itself. Anything the enum grows to include
 * that matches none of these falls to the note icon, which is the honest
 * default for "somebody recorded something".
 */
export function iconForActivity(type: string | null | undefined): ActivityIcon {
  const t = type || "";
  if (t === "site_visit") return ICONS.siteVisit;
  if (t.includes("meeting")) return ICONS.calendar;
  if (t === "task_completed") return ICONS.taskDone;
  if (t.startsWith("task_")) return ICONS.task;
  if (t.startsWith("note_")) return ICONS.note;
  if (t.startsWith("call_")) return ICONS.call;
  if (t.startsWith("email_")) return ICONS.email;
  if (t.startsWith("quotation_")) return ICONS.quotation;
  if (t === "document_uploaded") return ICONS.document;
  if (t === "stage_changed") return ICONS.stage;
  if (t === "assignment_changed") return ICONS.person;
  if (t.startsWith("lead_")) return ICONS.lead;
  return ICONS.note;
}

/** The glyph itself, sized for a table row. */
export function ActivityGlyph({
  icon,
  className = "",
}: {
  icon: ActivityIcon;
  className?: string;
}) {
  const { Icon, tone, name } = icon;
  return (
    <Icon
      className={`w-3.5 h-3.5 shrink-0 ${tone} ${className}`}
      aria-label={name}
    />
  );
}
