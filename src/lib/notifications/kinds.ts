/**
 * Every kind of in-app notification, with the label and group the
 * preferences screen shows and the icon tone the bell uses.
 *
 * The rule for adding one (settled 2026-09-18): a person is told about
 * something they own or were just given - never "a lead was updated" to
 * everyone who may view leads. Overdue work is already red on the dashboard
 * and the plan; a notice per overdue step would be noise.
 *
 * `type` on the table is free text. Add a kind here, produce it from the
 * route that already knows the actor and the audience, and nothing else
 * needs to change.
 */

export const NOTIFICATION_KINDS = {
  task_assigned: {
    label: "A task is assigned to me",
    group: "Tasks",
    tone: "blue",
  },
  task_completed: {
    label: "A task I created is completed",
    group: "Tasks",
    tone: "emerald",
  },
  task_reopened: {
    label: "A task of mine is reopened",
    group: "Tasks",
    tone: "amber",
  },
  lead_assigned: {
    label: "A lead is assigned to me",
    group: "Sales",
    tone: "blue",
  },
  quotation_approved: {
    label: "A client approves a quotation of mine",
    group: "Sales",
    tone: "emerald",
  },
  lead_converted: {
    label: "A won lead becomes my project",
    group: "Projects",
    tone: "violet",
  },
  project_assigned: {
    label: "I am made project manager",
    group: "Projects",
    tone: "blue",
  },
  project_held: {
    label: "My project is put on hold",
    group: "Projects",
    tone: "amber",
  },
  project_resumed: {
    label: "My project resumes",
    group: "Projects",
    tone: "emerald",
  },
  scope_changed: {
    label: "The scope of my project changes after kick-off",
    group: "Projects",
    tone: "amber",
  },
} as const;

export type NotificationKind = keyof typeof NOTIFICATION_KINDS;
export type NotificationTone =
  (typeof NOTIFICATION_KINDS)[NotificationKind]["tone"];

export const NOTIFICATION_KIND_LIST = Object.keys(
  NOTIFICATION_KINDS,
) as NotificationKind[];

export const NOTIFICATION_GROUPS = ["Tasks", "Sales", "Projects"] as const;

export function isNotificationKind(v: unknown): v is NotificationKind {
  return typeof v === "string" && v in NOTIFICATION_KINDS;
}
