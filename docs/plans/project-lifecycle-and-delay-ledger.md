# Project lifecycle, kick-off, baselines and the delay ledger

Status: **draft for review** · 2026-09-15 · builds on the retirement of the
native phase engine (migration `20260915120000`)

This is the design behind "connect the stages of a project to its status, and
know where the delay came from and at what juncture." It is a plan, not a
build; nothing here exists yet unless marked *(exists)*.

---

## 1. The model in one paragraph

A **playbook** defines a project's stages, the gates between them, and which
steps are **milestones** that move the project's **status**. Marking a lead
won creates a `new` project with no plan. **Kick-off** is where the project
manager reviews the handover, chooses the playbook, sets the plan, declares
the client's dependencies and confirms — that starts the run, records
**baseline v1**, and moves the project to `in_progress`. From then on every
task carries three timelines (baseline, current plan, actual); waiting and
overrun accrue to an **attribution** at a **juncture** for a **cause**, in one
**ledger**; and the ledger is what a status report and, later, the client
portal are generated from.

## 2. Status and stage are different questions

| | Status *(exists)* | Stage *(exists)* |
|---|---|---|
| Answers | Is the project alive? | Where is the work? |
| Values | `new` `in_progress` `on_hold` `completed` `cancelled` | Whatever the playbook's top-level steps are |
| Owner | The project manager, through a gated transition | Derived from tasks, never stored |
| Can be plural | No | Yes (`allow_parallel`) |

They connect through **milestones**, not through a shared list. A playbook
step can be flagged as a milestone with a status meaning:

| Milestone role | Effect when the step completes |
|---|---|
| `kickoff` | proposes `new → in_progress` (in practice the kick-off wizard does this) |
| `handover` | proposes `in_progress → completed` |
| `client_facing` | no status effect; appears on the client's timeline |

The system **proposes**; the PM **confirms with a note**. Nothing flips
silently. This is how an interiors execution company and an architect
practice get different lifecycles from the same code: their playbooks declare
different stages and different milestones.

## 3. Gated transitions

Same shape as the lead's `won` transition *(exists)*: pre-conditions first, a
409 with the list of what is missing, and only then the write.

| Transition | Refused unless |
|---|---|
| `new → in_progress` (Kick-off) | handover reviewed · playbook chosen and run started · every stage has an owner · baseline v1 recorded · client dependencies listed with expected dates |
| `in_progress → on_hold` | reason · attribution · expected resume date |
| `on_hold → in_progress` | (records days held against the attribution) |
| `in_progress → completed` | no open steps *(exists: `closing.ts`)* · handover milestone complete · no open asks |
| `→ cancelled` | reason; open steps cancelled *(exists: run cancel)* |

`project_plan_gates()` *(exists)* already answers "what would the server
accept on every row" in one round trip; the kick-off check is the same idea
at project level.

## 4. Kick-off

A wizard on a `new` project, opened from the Plan tab where the playbook
picker already sits:

1. **Handover pack** — client, property, approved quotation, Spaces, sales
   notes, the dates sales committed to. PM ticks *reviewed*. This is the
   sales→delivery hand-off as a recorded event.
2. **Playbook** — suggested by service type (`auto_start_project_category`
   *(exists)*), chosen by the PM. Auto-start stops being automatic for
   projects: it becomes the default selection.
3. **Plan** — start date; stage dates derived from playbook hours, editable;
   owner per stage (`assign_to_user` / `assign_to_role` *(exist)* as
   defaults).
4. **Dependencies** — the client-owned and vendor-owned steps the playbook
   declares, each given an expected date; plus any ad-hoc ones.
5. **Confirm** — run starts, baseline v1 snapshot, status `in_progress`,
   timeline entry `project_kicked_off` with the note.

Sales' dates are kept as *committed at sale* on the project and shown beside
the baseline. A gap between the two is the first finding the page surfaces.

## 5. Three timelines

| Timeline | Where | Moves when |
|---|---|---|
| **Committed at sale** | `projects.expected_start_date/expected_end_date` *(exist)* | never after kick-off |
| **Baseline vN** | new `plan_baselines` + `plan_baseline_tasks` | only by re-baselining, with reason + attribution |
| **Current plan** | `tasks.start_date/due_date` *(exist)* | freely, by the PM |
| **Actual** | `tasks.first_started_at/started_at/completed_at` *(exist)* | by `task_transition` |

"Frozen" means recorded and versioned, not immovable. Re-baselining is a
governed act like revising a quotation: the old baseline is kept, the delta
is a ledger entry, and the PM records that the client was informed. The
Timelines column *(exists)* projects against the baseline instead of the
moving plan.

## 6. Delay: who, where, why

**Two ways delay arrives:**

- **Waiting** — a task is blocked on someone. Days accrue to that someone
  until released.
- **Overrun** — a task took longer than its baseline with nobody blocking it.
  Days accrue to the assignee's team.

**Every ledger entry carries three coordinates:**

| Coordinate | Values |
|---|---|
| **who** (attribution) | `client` · `vendor` · `internal_design` · `internal_production_site` · `third_party` |
| **where** (juncture) | the stage and step it landed on, and the date |
| **why** (cause) | tenant-configurable list under each bucket (client → site not ready · design change · approval pending · payment pending; vendor → lead time · quality rejection; …) plus free text |

**Client-owned steps.** A playbook step gets an `owner_type`
(`internal` default · `client` · `vendor`). A client-owned step ("Site handed
over", "Client approves 3D") is a gate on what follows *(exists: dependencies)*,
its lateness accrues to the client automatically, and the set of them is the
"What we need from you" list. For now the PM confirms them; when the portal
exists the client does.

**How a client-owned step is satisfied** is a field, not a rule:
`satisfied_by` = `manual` (PM ticks) today, with `payment_received`,
`document_signed`, `portal_action` reserved. `task_completion_requirements`
*(exists)* already works this way — an upload requirement is satisfied by a
trigger, not a tick — so a payment gate later is the same shape and finance
plugs in without touching the plan.

**Change requests** during delivery: a quotation revision *(exists)* plus a
ledger entry for the days it adds, attributed to the client. Recorded at the
moment of revision.

## 7. Data model sketch

New objects in **bold**; changed objects in *italics*; everything else exists.

### Playbook side

*`procedure_step_definitions`* — add:

| column | type | meaning |
|---|---|---|
| `owner_type` | enum `internal` `client` `vendor` (default `internal`) | who this step waits on |
| `milestone_role` | enum `kickoff` `handover` `client_facing`, nullable | status meaning, if any |
| `satisfied_by` | enum `manual` `payment_received` `document_signed` `portal_action` (default `manual`) | how a non-internal step closes |
| `default_cause_code` | text, nullable | preset cause for delay on this step |

Carried across versions by `step_key` *(exists)* like everything else.

### Project side

**`plan_baselines`**

| column | type |
|---|---|
| `id` | uuid |
| `project_id` | uuid → projects |
| `run_id` | uuid → procedure_runs |
| `version` | int (1 at kick-off) |
| `reason` | text (required from v2) |
| `attribution` | enum (required from v2) |
| `cause_code` | text |
| `client_informed_at` | timestamptz, nullable |
| `set_by`, `set_at` | uuid, timestamptz |

**`plan_baseline_tasks`** — one row per task per baseline: `baseline_id`,
`task_id`, `start_date`, `due_date`, `estimated_hours`.

**`project_dependencies`** — the "waiting on" register. One row per
client/vendor/third-party ask, whether it came from a playbook step or was
added by hand:

| column | type |
|---|---|
| `id`, `project_id` | |
| `task_id` | uuid → tasks, nullable (null for an ad-hoc ask) |
| `owner_type` | enum |
| `counterpart` | text (which client contact / which vendor) |
| `description` | text |
| `expected_by` | date |
| `raised_at`, `resolved_at` | timestamptz |
| `cause_code` | text |

*`tasks`* — extend the hold that already exists:

| column | type | note |
|---|---|---|
| `hold_attribution` | enum, nullable | who we are waiting on |
| `hold_cause_code` | text, nullable | |
| `hold_expected_until` | date, nullable | |
| `hold_counterpart` | text, nullable | |

`hold_reason` *(exists)* stays as the free text. `task_status_history`
*(exists)* already records every transition, so **waiting days are derived**
from history + these columns rather than stored.

**`delay_causes`** — tenant-configurable list: `tenant_id` (null = shipped
default), `attribution`, `code`, `label`, `is_active`. Same bargain as
playbooks: we propose, they edit.

*`projects`* — add `committed_start_date`, `committed_end_date` (copied from
`expected_*` at kick-off so the sales promise survives edits), `kicked_off_at`,
`kicked_off_by`, `hold_attribution`, `hold_expected_until`.

### The ledger

**`project_delay_ledger`** is a **view**, not a table, derived from the
above — a second copy of these facts is exactly the kind of thing that went
stale before:

| column | source |
|---|---|
| `project_id`, `run_id` | |
| `kind` | `baseline_set` · `rebaselined` · `waiting` · `overrun` · `change_request` · `project_hold` |
| `attribution`, `cause_code` | from the row that produced it |
| `stage_task_id`, `step_task_id` | the juncture |
| `days` | computed: held span, or actual end − baseline due |
| `from_at`, `to_at` | |
| `reference` | the baseline / dependency / history row |

Materialise it later if it gets slow; it will not on this data for a long
time.

### Timeline events

`project_activity_type_enum` *(exists)* gains: `project_kicked_off`,
`baseline_set`, `rebaselined`, `dependency_raised`, `dependency_resolved`,
`status_report_issued`. Each is written where the act happens, the way
`project_updated` and `note_added` are.

## 8. What the PM sees

- **Plan tab** *(exists)*: baseline columns beside planned/actual; a blocked
  row says who and until when, in amber, on the row.
- **Header stage strip** *(exists)*: the "Waiting on client: site possession,
  expected 20 Oct" line when the project is held.
- **Asks panel** (new, on the Plan tab): the open `project_dependencies`,
  grouped by owner, with expected dates.
- **Delay panel** (new, Overview tab): "41 days behind baseline v1 — client 26
  (site possession 18, design changes 8) · vendor 9 · internal 6", from the
  ledger view.
- **Status report** (new): generated from the ledger — milestones, on
  track/slipped/waiting-on, revised dates, open asks. Saved to the timeline,
  exportable through the existing PDF pipeline. This is what the client
  portal renders live when it exists.
- **Project reports** *(exists)*: a Delay band — attribution × stage across
  the portfolio; which vendors, which client behaviours, which internal
  teams.

## 9. Sequencing

1. **Playbook fields** — `owner_type`, `milestone_role`, `satisfied_by`,
   `default_cause_code`; editor controls; carried by `step_key`.
2. **Kick-off** — wizard, gated transition, `committed_*` copy, baseline v1,
   timeline entry. Auto-start becomes the default selection rather than an
   automatic run.
3. **Holds with attribution** — the four `tasks.hold_*` columns, the prompt on
   Hold *(exists: `usePrompt`)* extended with attribution/cause/expected date;
   `delay_causes` seeded and editable.
4. **Dependencies register + Asks panel.**
5. **Re-baselining** and the baseline columns on the Plan tab.
6. **Ledger view, Delay panel, Delay band on reports.**
7. **Status report** generation and PDF.
8. Client portal (out of scope here; the ledger and asks are what it reads).

Each step is shippable on its own and useful on its own.

## 10. Open questions for review

1. **Kick-off wizard vs. a checklist on the Plan tab.** A wizard is five
   screens; a checklist is one screen with five sections and a Confirm at the
   bottom. Recommendation: the checklist — it is re-openable and reads as
   the state of the hand-off rather than a ceremony.
2. **Who may kick off.** `projects.edit`/`update` (the project's write
   permission) or `tasks.edit` (the playbook permission)? Kick-off starts a
   run, which today needs `tasks.create`. Recommendation: project write +
   `tasks.create`, checked together.
3. **Attribution of a client-owned step that is late but never formally
   blocked** — accrue automatically from `expected_by`, or only when the PM
   marks it? Recommendation: automatically; that is the point of declaring
   it client-owned.
4. **Overrun attribution** — to the assignee's *role* or to a fixed
   `internal_*` bucket per stage? Recommendation: bucket per stage, chosen
   in the playbook (`default_cause_code` on the stage), because a designer
   installing on site is still a site-stage overrun.
5. **Re-baseline approval** — PM alone, or PM + a second person? Start with
   PM alone and `client_informed_at`; add approval when there is a portal to
   collect it.
6. **The stored `projects.hold_*`** — or derive the project hold from "every
   active task is held on the same attribution"? Recommendation: stored,
   because a project hold is a decision, not an inference.
