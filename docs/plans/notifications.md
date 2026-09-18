# Notifications

In-app only, for now. Written 2026-09-18 with the base version.

## The rule

A person is told about something **they own or were just given**. Never
"a lead was updated" to everyone who may view leads; never a notice per
overdue step (the dashboard and the plan already show those in red). The
actor is never told about their own action. A role is not an audience.

## Three different things, one bell

| | Produced by | Status |
|---|---|---|
| **Events** — something just happened that concerns you | the route that made the change | **built** |
| **Reminders** — something is about to be due | a scheduled job every ~15 min, idempotent by `dedupe_key` | next |
| **Ambient** — holidays, birthdays | the same job, once the data exists (`holidays` table, opt-in date of birth) | later |

## Events, and who hears them

| Kind | When | Who | Reads |
|---|---|---|---|
| `task_assigned` | task created for, or reassigned to, someone else | the assignee | "Raghu assigned you 'Site measurement'" |
| `task_completed` | a task is completed | its creator, if not the doer | "Priya completed 'Site measurement'" |
| `task_reopened` | a settled task comes back | its assignee, if not the doer | "Raghu reopened 'Site measurement'" |
| `lead_assigned` | lead created for, or reassigned to, someone else | the assignee | "Raghu assigned you Amulya" |
| `quotation_approved` | the client approves in the portal | the lead's owner or the project's PM, else the quotation's maker | "QT-2026-0007 v2 was approved by the client" |
| `lead_converted` | a lead is won and a project made | the project manager named on it | "Raghu won LD-0012 - Amulya · Modular is yours to kick off" |
| `project_assigned` | project manager changed | the new PM | "Raghu made you project manager of …" |
| `project_held` | project put on hold | the PM, if not the actor | "Raghu put … on hold - 'client travelling'" |
| `project_resumed` | project resumes | the PM, if not the actor | "Raghu resumed …" |

Producers: `api/tasks` (POST), `api/tasks/[id]` (PATCH), `api/tasks/[id]/transition`,
`api/sales/leads` (POST), `api/sales/leads/[id]` (PATCH), `api/sales/leads/[id]/transition`,
`api/projects/[id]` (PATCH), `api/projects/[id]/status`, `api/quotations/client/[token]/approve`.

Not produced, deliberately: playbook steps assigned by `start_procedure_run`
(a plan starting would fan out thirty notices; the PM knows), overdue steps,
comments/mentions (no such module yet), team member joined.

## How it is built

- **Storage**: the baseline's `notifications` / `notification_preferences`.
  `type` is text (`lib/notifications/kinds.ts` is the list). `dedupe_key`
  is unique per person so a producer that runs twice writes once.
- **Writing**: `notify()` in `lib/notifications/notify.ts` - removes the
  actor, honours a preference row that says no, swallows failures. The
  routes call it after their write succeeds.
- **Delivery**: Supabase Realtime on the table, filtered to the signed-in
  person; RLS (own rows) applies to the stream. `NotificationsProvider`
  holds the one subscription per tab.
- **Surfaces**: the bell (`NotificationDropdown`) with count and Today /
  Earlier; the slider (`NotificationSlider`, bottom-right, at most three,
  eight seconds, only for rows that arrive live); `/dashboard/notifications`
  for history; Settings → Notifications for per-kind switches.

## Next

1. **Reminders**: a scheduled function that writes `follow_up_due`,
   `meeting_soon`, `step_due_tomorrow`, `quotation_expiring` with a
   `dedupe_key` of `<kind>:<entity>:<date>`.
2. **Holidays**: `holidays` table under Settings; also what the scheduler
   needs for working days.
3. **Birthdays**: opt-in date of birth on the profile, never in
   `tenant_directory`.
4. Email / push: separate module; the preference columns exist and are
   not offered until a send path does.
