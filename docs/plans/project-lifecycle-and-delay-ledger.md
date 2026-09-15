# How a project runs, and where the time goes

Status: **draft for review** · 2026-09-15 · v2, rewritten in plain language

This is the plan for how a project moves from "just won" to "handed over",
how the playbook drives that, and how we always know **who caused a delay,
at which stage, and why** — so the project manager can show it to the client
instead of absorbing it.

Nothing here is built yet. The parts that already exist are marked *(exists)*.

---

## 1. Six words we will use, and what they mean

| Word | Plain meaning |
|---|---|
| **Stage** | A big chunk of the work — Design, Procurement, Installation. The playbook decides what the stages are. |
| **Status** | Whether the project is alive: New, In Progress, On Hold, Completed, Cancelled. |
| **Kick-off** | The moment the project manager takes the project from Sales, plans it, and starts it. |
| **Agreed plan** | The dates everyone signed up to at kick-off. Kept forever, even after the dates move. |
| **Delay owner** | Who a delay is counted against: the **client**, a **vendor**, **us**, or **someone else** (society, weather, government). |
| **Delay log** | The list of every delay — how many days, who owns it, at which stage, and why. |

That's the whole vocabulary. Everything below uses only these.

## 2. The idea in one paragraph

A lead is won → a **New** project appears with no plan. The project manager
does the **kick-off**: reviews what Sales handed over, picks the playbook,
sets the dates, lists what the client must do (hand over the site, approve
the design), and confirms. That creates the **agreed plan** and the project
becomes **In Progress**. From then on, every time something waits on
someone or takes longer than planned, the days go into the **delay log**
against a **delay owner**. At the end — or any time in between — the log
says: *"We are 41 days behind the agreed plan: 26 are the client's (site
handover 18, design changes 8), 9 are the vendor's, 6 are ours."* That is
the sentence the project manager sends to the client.

## 3. Status and stage are two different things

- **Stage** answers *where is the work?* — it comes from the playbook, and a
  project can be on two stages at once (Procurement and 3D Design together
  is normal).
- **Status** answers *is the project alive?* — five values, never more.

They connect through **milestones**. In the playbook, a step can be marked
as a milestone that means something for status:

| Milestone | What it does |
|---|---|
| "Kick-off done" | project becomes In Progress |
| "Handover signed" | project becomes Completed |
| "Show to client" | no status change; it appears on the client's timeline |

The system **suggests** the status change; the project manager **confirms
it with a note**. Nothing changes by itself. Because the milestones live in
the playbook, an interiors company and an architect firm get different
lifecycles without any code change — they just write different playbooks.

**Undo in order.**  ✅ decided — A milestone never changes the status by
itself, and reopening a step never changes it back. If the project is already
Completed, reopening the handover step is refused: reopen the *project* first
(a status change with a note, on the timeline), then the step. If the PM never
confirmed, reopening the step simply withdraws the suggestion. Kick-off is a
recorded event, not derived from a step, so reopening a "Kick-off done" step
changes nothing.

## 4. Changing the status has rules

Like marking a lead as Won *(exists)*: the system checks first, tells you
what is missing, and only then changes anything.

| From → To | Allowed only when |
|---|---|
| New → In Progress | the kick-off checklist is complete |
| In Progress → On Hold | you say why, who owns the wait, and when you expect to resume |
| On Hold → In Progress | (the days on hold are logged against that owner) |
| In Progress → Completed | no open steps *(exists)*, the handover milestone is done, nothing still owed by the client |
| → Cancelled | you say why; open work is cancelled *(exists)* |

## 5. Kick-off is a checklist, not a wizard  ✅ decided

One screen on the Plan tab, five sections, one Confirm button. It stays
re-openable so it also reads as "the state of the hand-off".

1. **Handover from Sales** — client, property, approved quotation, spaces,
   sales notes, and the dates Sales promised. Tick *reviewed*.
2. **Playbook** — suggested from the service type, chosen by the PM.
3. **Dates and owners** — start date; stage dates worked out from the
   playbook's hours (editable); who owns each stage.
4. **What the client must do** — site handover, design approval, and so on,
   each with an expected date. These come from the playbook (steps marked
   "the client does this") plus anything extra.
5. **Confirm** — the plan starts, the agreed plan is saved, status becomes
   In Progress, and the timeline records "Kicked off" with the PM's note.

The dates Sales promised are kept and shown next to the agreed plan. If the
PM's plan is already three weeks later than what Sales promised, the page
says so — that is a sales finding, not a delivery one.

## 6. Three sets of dates

| | What it is | When it moves |
|---|---|---|
| **Promised at sale** | what Sales told the client | never, after kick-off |
| **Agreed plan** | what the PM committed to at kick-off | only when a new plan is agreed — with a reason, a delay owner, and a note that the client was told |
| **Current plan** | the step dates as they stand today | **automatically**, when a step finishes late or is put on hold — everything that waits on it moves by the same number of days |
| **Actual** | what really happened *(exists)* | as work starts and finishes |

"Agreeing a new plan" is a deliberate act, like revising a quotation. The
old plan is kept, and the difference between old and new goes into the delay
log against its owner. **PM, Admin or Owner** can agree a new plan  ✅ decided.

## 7. How a delay gets logged — the simple rules

There are only two ways a delay happens:

1. **Waiting on someone.** A step is put on hold because we are waiting —
   for the client to hand over the site, for a vendor to deliver. The PM
   picks **who** we are waiting on, **why** (from a short list), and **until
   when**. Every day on hold is counted against that owner until it's
   released.
2. **Took longer than planned.** Nobody was blocking it; the work simply
   overran. Those days are counted against **us**, at the stage it happened
   in. We don't blame a person — "Design ran 4 days over" is enough to
   improve the process.  ✅ decided (stage-level, not person-level)

Two things make this nearly automatic:

- **Steps the client must do** are marked as such in the playbook ("Client
  approves 3D", "Site handed over"). If the client is late on one, the days
  count against the client automatically from the expected date — the PM
  doesn't have to do anything.  ✅ decided
- **The "why" list** is short and editable per business — for the client:
  site not ready · design change · approval pending · payment pending; for a
  vendor: lead time · quality rejection; and so on.

A design change after sign-off is a quotation revision *(exists)* **plus** a
delay-log entry for the days it adds, owned by the client.

For now the PM ticks off what the client has done. When the client portal
exists, the client does it themselves — and sees the same "what we are
waiting on you for" list.

## 8. What the project manager sees

- **Plan tab** *(exists)*: agreed dates next to actual dates; a step on hold
  says *who* and *until when*, right on the row.
- **"Waiting on the client" panel**: everything the client still owes, with
  dates. This becomes the client's own list when the portal exists.
- **Delay summary** on the Overview tab: *"41 days behind — client 26,
  vendor 9, us 6"*, with the breakdown by stage and reason.
- **Status report**: one click generates it from the delay log — milestones,
  what's on track, what's slipped and whose fault, what we're waiting on,
  new dates. Saved to the timeline, downloadable as PDF.
- **Reports page** *(exists)*: across all projects — which vendors, which
  client behaviours, which stages cost the most time.

## 9. Order of work

Each step is useful on its own.

1. ✅ built — Playbook gains two settings per step: *who does this* (us /
   client / vendor) and *milestone*. The *default reason for delay* joins
   with step 3, when the reason list exists.
2. ✅ built — Kick-off checklist, the New → In Progress rule, the agreed
   plan (v1), the sales-promised dates kept, and the "waiting on" list
   raised automatically from client/vendor steps.
3. ✅ built — Hold with owner + reason + expected date; the reason list
   (shipped defaults; an editing screen is still to come); the current plan
   shifts automatically for everything that waits on a late or held step
   (the agreed plan does not move); "Usual delay" on client/vendor steps in
   the playbook.
4. "Waiting on the client" panel.
5. Agreeing a new plan.
6. Delay summary on the project, delay band on Reports.
7. Status report + PDF.
8. Client portal (separate plan; it reads the delay log and the waiting list).

## 10. Still to decide

**a. Who can press Kick-off?**  ✅ decided — **anyone who may edit the
project** (today Owner, Admin, Manager and Project Manager). Kick-off also
creates the plan's tasks, so those roles must be allowed to create tasks;
checked together. No new permission.

**b. Payment gates.**  Parked, by your decision. The design leaves the hook:
a step the client must do can later be completed automatically "when the
payment is received" instead of by the PM ticking it.

---

## Appendix — for the developers

Plain-language terms above map to these names in code. New objects in
**bold**; changed ones in *italics*.

| Plain term | In code |
|---|---|
| Stage | top-level task of the playbook run *(exists)* |
| Delay owner | `delay_owner` enum: `client` · `vendor` · `internal` · `third_party` |
| Reason | `delay_reason_code` → **`delay_reasons`** (tenant-editable list) |
| Agreed plan | **`plan_baselines`** + **`plan_baseline_tasks`** |
| What the client must do | **`project_dependencies`** |
| Delay log | **`project_delay_log`** — a *view* derived from the rows below, never a stored copy |

*`procedure_step_definitions`* — add `owner_type` (`internal` default ·
`client` · `vendor`), `milestone_role` (`kickoff` · `handover` ·
`client_facing`, nullable), `satisfied_by` (`manual` default;
`payment_received` · `document_signed` · `portal_action` reserved),
`default_delay_reason`. All carried across versions by `step_key` *(exists)*.

**`plan_baselines`**: `project_id`, `run_id`, `version`, `reason`,
`delay_owner`, `delay_reason_code`, `client_informed_at`, `approved_by`
(must hold project write and be PM / Admin / Owner), `set_by`, `set_at`.
**`plan_baseline_tasks`**: `baseline_id`, `task_id`, `start_date`,
`due_date`, `estimated_hours`.

**`project_dependencies`**: `project_id`, `task_id` (nullable for an ad-hoc
ask), `owner_type`, `counterpart`, `description`, `expected_by`,
`raised_at`, `resolved_at`, `delay_reason_code`.

*`tasks`* — add `hold_owner`, `hold_reason_code`, `hold_expected_until`,
`hold_counterpart`. `hold_reason` *(exists)* stays as free text.
`task_status_history` *(exists)* already records every transition, so
waiting days are **derived** from history, not stored.

*`projects`* — add `committed_start_date`, `committed_end_date` (copied
from `expected_*` at kick-off), `kicked_off_at`, `kicked_off_by`,
`hold_owner`, `hold_expected_until`.

**`project_delay_log`** (view): `project_id`, `kind` (`waiting` · `overrun`
· `replanned` · `change_request` · `project_hold`), `delay_owner`,
`delay_reason_code`, `stage_task_id`, `step_task_id`, `days`, `from_at`,
`to_at`, `reference_id`.

`project_activity_type_enum` gains `project_kicked_off`, `plan_agreed`,
`plan_replanned`, `dependency_raised`, `dependency_resolved`,
`status_report_issued`.

Kick-off permission: `projects.edit` OR `projects.update` (the existing
permissive reading in `src/lib/projects/access.ts`) **and** `tasks.create`,
checked together in the transition route before any write, exactly as
`missingFields` works on the lead transition.
