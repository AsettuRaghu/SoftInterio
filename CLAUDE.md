# SoftInterio — working notes

Multi-tenant interior-design ERP. Next.js 16 / React 19 / TypeScript / Tailwind v4 / Supabase.

The long-term shape: a won lead carries into a project, then into project
management, then into a client-facing portal with controlled access. Built for
more than one vertical — interior designers today, architects later — so
nothing should hard-code "rooms and wardrobes" as the only possible scope.

## Decisions that are easy to undo by accident

These were argued about and settled. Each one has a reason that is not obvious
from the code alone, so please read before "fixing" them.

### Spaces and quotations stay independent
The Spaces tab on a lead (`property_scope_items`) is copied **once** into a
quotation and the two then diverge. Deliberately absent, and not to be added
back without revisiting: no `scope_item_id` on quotation rows, no "scope
changed, review the quotation" prompt, no deactivation tier. A quotation is a
commercial document; it must not mutate because someone edited a room list.

### Quotations are auto-created by a database trigger
`trg_lead_stage_change` calls `create_quotation_for_lead()` when a lead reaches
`proposal_discussion` — **inside the UPDATE**, before any application code
runs. Searching the TypeScript for quotation creation finds nothing. Anything
that should shape a new quotation has to fill the shell afterwards; see the
`proposal_discussion` block in the lead transition route.

The same function writes the timeline entry for it. Quotation events reach a
timeline through `src/lib/quotations/log-activity.ts`, which picks the lead or
project table for you — three events are recorded: created, revised, and status
changed. Editing a quotation is deliberately not logged; the builder saves
often and one entry per save would bury everything else.

### One family per cost item category, four tiers
Categories that carry a Basic/Standard/Premium/Luxury ladder hold exactly one
family, because Reprice moves a whole category up or down a grade. Hardware was
split into Hinges and Handles for this reason. Labour, Service and Accessories
are untiered on purpose — grade is not their axis, and "upgrade Accessories"
would otherwise swap an organiser basket for a corner carousel.

Rates must stay monotonic across a ladder. Before the reshape, Hardware's
premium item was cheaper than its standard one, so "upgrade to Premium" lowered
the quote.

### quality_tier is text, not an enum
Each tenant's catalogue defines what it sells. The `QualityTier` TypeScript
union describes the seeded ladder, not a database rule. A CHECK constraint here
was removed once already for this reason.

### The printed document is assembled, not typed
The Material column comes from the cost items' catalogue descriptions, ordered
by category and de-duplicated — not from a hand-written component description.
It therefore cannot describe a material the quotation no longer uses. This is
also why templates do **not** need a `template_components` table: templates
carry cost items, cost items carry the descriptions.

### Tax belongs to the quotation, terms belong to the format
A quotation owns its tax: set `tax_percent` to zero and there is no GST row and
nothing to add. A print format briefly had a `show_tax` flag as well, which is
two switches for one outcome and how a document ends up disagreeing with the
record behind it. It was removed.

Terms are the opposite case. A format names the clause it prints
(`terms_clause_id`), so a client document and an internal one can carry
different terms; null falls back to the tenant default. Only one clause prints
- rendering every active clause put V1 and V2 of the same terms back to back.

### A project's Spaces are the lead's Spaces
Scope lives on `property_scope_items`, which hangs off the property, and a
project shares its lead's `property_id`. So the project's Spaces tab renders the
same component against the same rows — nothing is copied at handover and the
two never diverge.

This replaced a Rooms tab that read `quotation_spaces`: a read-only view of what
was *priced*, which the linked quotation already shows. A project needs what is
to be *built*.

### Winning a lead requires it to be clear
Open tasks or unhandled follow-ups refuse a `won` transition with a 409 and the
list. Lost and disqualified cancel that work instead, with the reason recorded.
Tasks are deliberately not carried into the project — a project starts with a
clean slate rather than a sales backlog. Note tasks link to a lead through
`related_type`/`related_id`, not a `lead_id` column.

### Permissions are flat, and view_own means assigned to you
No hierarchy, no reporting lines: a person can do what their granted
permissions say, nothing inherited. `leads.view` is every lead in the tenant;
`leads.view_own` is leads whose `assigned_to` is the caller — not leads they
created, since leads arrive from forms and imports with a system creator.

**RLS does not enforce this.** The policy on `leads` checks tenant membership
and nothing else, and the list route uses the admin client, which bypasses RLS
entirely. Scoping happens in `src/lib/leads/access.ts` and in the route, or it
happens nowhere.

`role_permissions.granted` is tri-state — a row can exist to *revoke*. The API
guard ignored it until 2026-09-07, so a revoke honoured by the settings UI was
ignored by the API.

### Projects use a different, incoherent permission vocabulary
Do not copy the leads reading across. On leads, `leads.view` (4 roles) is
cleanly "every lead" and does not overlap `leads.view_own` except on Admin and
Owner. On projects the seed is contradictory:

- `projects.view` is granted to 15 of 21 roles, including Limited and Sales,
  which *also* hold `projects.view_own` — granting "all" and "only mine" at once.
- `projects.view_all` exists too (5 roles). `leads.view_all` does not exist.
- Seven roles hold `projects.view` and neither `view_all` nor `view_own`.
  One of them is Project Manager, which also holds create, edit and delete.
  A role that may delete a project but open none is unconsidered seed data.
- `projects.edit` (4 roles) and `projects.update` (6 roles) are near-disjoint
  and mean the same act.

So `src/lib/projects/access.ts` treats `view` OR `view_all` as read-all, and
`edit` OR `update` as write-all. That is deliberately the permissive reading:
it follows the stated rule — granted the permission to view, then you can view
— and locks nobody out. Tightening it means fixing the grants first.

A project is "yours" if you manage it **or created it**. Both, because
`project_manager_id` is null on every project that exists, so manager-only
ownership would show a `view_own` holder an empty list. This differs from leads
on purpose.

### `roles-permissions.ts` is generated — never edit it
`src/types/roles-permissions.ts` is written by
`node scripts/generate-permission-types.js` from the `permissions` and `roles`
tables. Run it whenever a permission or role changes; `npm run perms:check`
fails when it is stale.

It was hand-written until 2026-09-07 and had drifted to 159 of 265 permissions
and 18 of 21 roles, so 106 granted permissions could not be named in
TypeScript. Its runtime exports — `PERMISSION_GROUPS`, `ROLE_HIERARCHY`,
`isManagerRole`, `hasHigherOrEqualPrivilege`, `getAssignableRoles` — had zero
consumers and are gone. Nothing expressing a hierarchy is generated, even
though `roles.hierarchy_level` still exists in the schema.

`requiredPermissions`, `navigationConfig`, `route-permissions.ts` and
`PermissionGate` are all typed as `PermissionKey`, so a mistyped permission is
now a compile error instead of a silent denial. Typing them found two live
bugs: the nav asked for `projects.reports.view` (the real key is
`projects.reports`), which hid that menu from everyone, and
`/dashboard/settings/roles` was guarded by `settings.roles.view` — neither the
route nor the permission exists.

**There are two lead permission namespaces.** The code enforces `leads.*`;
`sales.leads.*` (20 keys) is granted to roles and read nowhere. **Manager holds
`sales.leads.view` but neither `leads.view` nor `leads.view_own`, so a Manager
is denied leads entirely.** No current user is affected — every real account
also holds Admin or Owner — but the grants need reconciling before anyone is
given Manager alone.

**202 of 265 permissions are referenced nowhere in `src/`.** `npm run
perms:check` lists them by module; it is a fair map of how much of the
permission model is still unenforced.

`role_permissions` is read-only in the app (no route writes it), so nothing can
silently drop a grant.

### Every project sub-route must prove lineage
`requireProjectAccess()` in `src/lib/projects/guard.ts` resolves the project in
the caller's tenant and checks read/write. `requirePhaseLineage()` then proves
the phase, sub-phase and checklist ids in the URL actually belong to it.

Both are needed. The child tables carry no `tenant_id` — they are up to three
joins from one — so pairing a project id you may open with a sub-phase id you
may not would otherwise have read and written another business's data. The
checklist route in particular never mentioned the project at all.

### Projects come from won leads unless a tenant opts out
`tenant_settings.allow_direct_project_create` is false by default, so the New
Project button does not appear and `POST /api/projects` answers 403. The normal
route is a won lead, which carries the client, property, quotation and scope
across; a blank form starts with none of that.

It is a tenant setting rather than a `subscription_plan_features` row because
it is a workflow choice each business makes, not something sold by tier — and
because that table is read only to draw plan cards and enforces nothing.

Every tenant-level switch is a column on `tenant_settings` and is edited on
**Settings → Config** (`/dashboard/settings/config`, gated on
`settings.company.update`). Add one by appending to the `FLAGS` array on that
page — the load, save, dirty check and rendering are all driven from it. Only
list a flag once something reads it: `require_quotation_for_project` is on the
same table, read nowhere, and so is deliberately not offered.

The flag is checked in the handler, not only in the UI. Hiding a button is not
a control. The New Project button appears **only on the projects list page**
and only when the flag is on; a dead quick-action in `DashboardOverview` (an
unused component) was removed so no other surface offers it.

`POST /api/projects` had never worked: it inserted `client_name`,
`site_address`, `quoted_amount`, `budget_amount` and six other fields that are
not columns on `projects`, so every request died with PGRST204. It now creates
the `clients` and `properties` rows and stores `client_id`/`property_id`,
mirroring `POST /api/sales/leads` — a new client each time rather than matching
on email, the property optional, both rolled back by hand if the project insert
fails. The form also sent `start_date` while the handler read
`expected_start_date`, so the start date was silently dropped.

**Quoted and budget amounts are deliberately not stored on a project.** There
is no column for either, and `actual_cost` is not one — the Overview tab shows
that as money spent, while the list aliases it to `quoted_amount` for a total.
A project's value comes from its quotation, which is where the app already
models it. Both inputs were removed from the create form rather than given a
misleading home.

### The lead -> project handover, and what it does not carry
`create_project_from_lead` carries the client and property by id (which is why
Spaces are shared), the latest quotation, the target dates, the documents (a
copy) and the lead's notes (re-pointed by `project_id`). The transition route
writes the first project activity.

It now also carries `won_amount` into **`projects.contract_value`** and calls
`initialize_project_phases`. Before 2026-09-07 it did neither: `actual_cost`
was hardcoded to 0 so every project read as worth nothing (the list aliased
`actual_cost` to "quoted_amount"), and `p_initialize_phases` only ever *looked
up* a phase, so a converted project had none and the Project Mgmt tab — the
default tab — opened empty.

`contract_value` is the agreed value, frozen at handover. `actual_cost` is
money spent. They are different columns on purpose; showing one under both
labels is what hid the problem.

`description` is still NULL after conversion. The obvious sources would be the
lead's scope and special requirements and **neither column exists** — that
detail lives on the property and the quotation.

### Project detail follows the lead detail page
The lead detail page is the reference for this module. Its tab bar is plain —
`px-4 py-3 text-sm font-medium border-b-2`, active `border-blue-600
text-blue-600`, **no icons and no count badges** — and the project page matches
it exactly, plus `whitespace-nowrap` and `overflow-x-auto` because it carries
eleven tabs rather than eight.

Order mirrors leads: overview, spaces, quotations, tasks, notes, documents,
calendar, timeline. **Project Mgmt sits third**, beside Overview and Spaces,
because it is the working view rather than another record of correspondence.
Procurement and Payments have no lead counterpart and come last. Overview is
the tab a project opens on, as a lead does.

Page-level primary buttons are `buttonVariants()` at the default size, which is
the `px-4 py-2` the lead page uses; `sm` is for in-card actions. Card radius is
the app-wide `rounded-lg` — see below.

Tabs are not hidden when a project has no lead — a directly created project
still has quotations, a calendar and a timeline.

There is one loading flag, because `fetchCounts` is one `Promise.all`. It
previously had six that could never disagree, one of which was never read.

Editing goes through `EditProjectDetailsModal` on the Overview tab, opened by
the header button. A second `EditProjectModal` existed whose opener was never
called, and the header button set a flag nothing read — **so for a while no
project could be edited at all.** Keep one dialog.

Primary buttons come from `buttonVariants` in `@/components/ui/Button`; cards
are `rounded-lg`, which is the app-wide majority.

### Charges are ordinary line items
Delivery, cleanup and site protection are cost items in a category marked
`is_charge`. A space made up entirely of such items *prints* below the room
totals instead of as a numbered room. The arithmetic is untouched — the builder
and the PDF always agree — only the presentation differs.

### Dates are validated only when they change
Leads legitimately carry target dates that have since passed. Re-validating
untouched values would block edits to unrelated fields on any older lead. See
`src/lib/dates/lead-dates.ts`. Direction is per field: targets must not be in
the past; a contract signature must not be in the **future**.

### One radius for resting surfaces, another for floating ones
Every card and panel is **`rounded-lg`** — all 211 of them, across every module.
Buttons, inputs and badges are `rounded-lg` too, so a card matches the controls
inside it.

Popovers, dropdowns, date pickers and dialogs stay **`rounded-xl`** (10 of
them, all carrying `shadow-xl`). A surface that floats above the page reads as
a different kind of thing, and the larger radius is what says so.

This was settled on 2026-09-07 after the split had reached 101 `rounded-lg`
cards against 98 `rounded-xl` — near even, and drifting per module: sales and
projects had gone one way, quotations, stock, settings and tasks the other.
When adding a card, copy a neighbour rather than inventing a radius.

Note the border colour is still not uniform: 17 cards use `border-gray-200`
where the rest use `border-slate-200`. Untouched here.

### Playbooks are the workflow engine; phases are a view
**The UI says Playbook; the database says procedure.** The tables, the enum
and the RPC keep their original names — `procedure_definitions`,
`procedure_step_definitions`, `procedure_runs`, `procedure_run_id`,
`procedure_step_id`, `start_procedure_run`. Everything above storage — routes,
components, types, copy — says Playbook. Renaming the schema would have bought
nothing and risked a migration, but do not "fix" the mismatch by half.

Authoring lives at **Settings → Playbooks** (`/dashboard/settings/playbooks`),
not under Tasks: a playbook drives a whole delivery and can target a project,
lead, quotation or client, so it belongs under none of them. **Running** one
stays in context, on the entity's own Tasks tab via `PlaybooksPanel`. It is
gated on `tasks.templates.view` (Admin, Owner, Manager, Designer) rather than
Config's `settings.company.update` (Admin, Owner) on purpose — a design manager
should be able to write down how their team works without being an
administrator.

SoftInterio grew two engines for one idea. `project_sub_phase_templates` and
`procedure_step_definitions` share eleven columns and their `action_type` enums
are identical. The procedure engine is the one to keep and the one already in
use: it nests (`parent_step_id`), versions (`version`/`is_current`), targets a
vertical (`tenant_type`, which already knows `architect`), attaches to anything
(`related_type`/`related_id`), and executes as ordinary tasks rather than a
second thing to assign and track.

`src/lib/projects/playbook-adapter.ts` maps a run's parent tasks to phases and
its child tasks to sub-phases, and the project Plan tab draws the 25-step
"Modular Design Template" through it without one phase-template row. That is
the evidence the tree is a view. The Plan tab prefers a playbook where one
exists and falls back to native phases.

**A Plan node is a phase row or a task, and the difference decides where an
edit goes.** The page keeps a `playbookNodeIds` set; anything in it is a task,
so its edits go to `PATCH /api/tasks/[id]` rather than the phase routes.
`PhaseEditModal` and `SubPhaseEditModal` take an `onSaveOverride` for this.
Sending a task id to a phase route answers **"Not found"** — that is what the
404 means, not a missing project.

Statuses and dates translate through `toTaskStatus` /
`phaseEditToTaskUpdate` in the adapter: `not_started` is `todo`, planned start
is `start_date`, planned end is `due_date`, and a status note becomes
`hold_reason`, which `task_transition` records. Keep the mapping there rather
than inline, **and keep it symmetric** — writing `start_date` without reading
it back made a saved planned start look as though saving had erased it.

`start_date` is the plan and `started_at` is what happened; they are different
columns and the tree shows them in different columns too.

**Clicking a playbook step opens the task page**, not the sub-phase panel. The
panel reads phase rows, and a step is a task; the task page already has the
status gates, subtasks, comments and attachments, so there is nothing to
reimplement.

**Do not build new workflow features on phase templates.** Still to port before
the phase engine can go: phase dependencies, progress rollup, planned-vs-actual
at phase level, and the payment milestone's `linked_phase_id`.

A protected playbook is one SoftInterio ships; it cannot be edited in place,
because that would change the process under every business using it. `Copy`
takes an unprotected, inactive, version-1 copy owned by the tenant. That is the
mechanism behind "we propose the practice, you decide how you work".

### What an action type actually does
Only two of the eight change behaviour. `start_procedure_run` writes rows into
`task_completion_requirements`, and the task cannot complete until they are
satisfied:

- **upload** — one requirement per entry in `required_upload_types`, or a
  single "Attach at least one file" when none are named. A trigger satisfies it
  when a matching file is attached.
- **approval** — one requirement naming `approval_role`, satisfied by
  `sign_off_requirement`.
- **checklist** — one requirement per entry in `checklist_items`, each ticked
  off through `sign_off_requirement`. A checklist step with no items gates
  nothing, which is the honest outcome.
- **meeting** — asks for confirmation that the meeting took place, typed
  `manual` because that is what sign-off accepts. It does **not** book
  anything; booking is the calendar's job.
- **form** — a requirement **only if `form_schema` is set**, and nothing can
  set it, so a form step still behaves as manual.
- **assignment, handover** — write no requirement. Neither has an obvious gate
  and inventing one would be worse than an honest label.

Do not describe these as gates in the UI until they are one.

### Progress and hours come from the playbook
`calculate_project_progress` answers from the **active playbook run** first and
falls back to phases. That order matters: a converted project can have both —
`PRJ_20251219_0001` has four phase rows and a live run — and the Plan tab
prefers the run, so reading phases first would have put two different numbers
for the same project on one screen.

A phase trigger cannot fire for a project with no phase rows, so
`trg_project_progress_from_task` recalculates from the tasks a run creates. It
has no `WHEN` clause — one cannot reference `NEW` and `OLD` across insert and
delete — and the function returns early for the tasks that belong to no run,
which is most of them.

Progress is **derived, never stored by hand**. A step is settled when it is
completed, skipped or cancelled, which is the same rule the tree draws with.

The Plan tab shows **hours logged against hours expected**, amber once over. A
phase sums its own and its steps'. This is the pair the hours change was for:
it is where a process quietly costs more than anyone planned.

### A playbook step is written in hours
One number: how long the step should take. It is what `tasks.actual_hours` —
derived from work sessions — gets compared against, which is the only way a
team sees where time actually goes.

The due date is derived at eight hours to a working day, rounded up, never less
than one. `duration_days` is legacy and still wins where it is set, but the
editor clears it on save so the number on screen is the number that applies.

Asking for both days and hours was the mistake: they are genuinely different
things, so people chose one, and the one that matters for improvement is hours.

### The playbook's assignment decisions hold at run time
`PATCH /api/tasks/[id]` refuses to move an assignee away from what the playbook
fixed. A step naming `assign_to_user` cannot be reassigned; a step naming only
`assign_to_role` can go to anyone holding that role and nobody else; a step
naming neither is free, which is most of them. **`tasks.edit_all`** (Admin,
Manager, Owner) overrides all of it.

The refusals carry `reason: "assignee_fixed_by_playbook"` or
`"assignee_role_fixed_by_playbook"`. The Plan tab does not yet grey the field
out, so the server is the only thing enforcing this — a caller finds out by
being refused, with a message that says why.

### Drift between a plan and its playbook
A run pins its version, so a plan under way is never rewritten. Saying nothing
about that left people wondering why an edit had no effect, so the Plan tab
reports which version it follows and how many steps it would gain.

`procedure_step_definitions.step_key` is what makes that answerable. Editing a
playbook marks every step `is_current = false` and inserts fresh rows, so
nothing connected v3's "Layout Drawings" to v1's — they were unrelated rows
sharing a title. The key is carried across revisions by the editor, so a step
keeps its identity while its rules change.

`POST /api/projects/[id]/playbook/sync` is **additive and nothing else**. It
creates tasks for steps the plan is missing and leaves every existing step
exactly as it is, whatever the playbook now says about it. Rewriting the rules
of work already begun is what the pinning exists to prevent; a sync that
quietly did it would be worse than no sync.

`create_step_requirements(task_id, step_id)` holds the gates a step puts on its
task, and **both** `start_procedure_run` and the sync call it. It was inline in
the run function; a second copy would have drifted the moment either changed,
and a step that gates on a run but not on a sync is the kind of inconsistency
nobody notices until it matters. It is not idempotent — call it once per new
task.

### Saving a playbook is batched
`replaceSteps` inserted one step at a time inside a two-pass loop, then one
dependency at a time — about **forty-five sequential round trips** for a
24-step playbook, which is long enough for someone to start doing something
else mid-save.

It is now one insert per pass plus one for the dependencies: five round trips.
Parents still go before children because a child needs its parent's id, and
inserted rows are matched back on `display_order`, which is unique within a
definition, rather than trusting the order they come back in.

The editor covers itself while a save is in flight. A save rebuilds every step
from what was submitted, so an edit made while the request was in the air would
be written over by the reply and look as though it was never typed.

### Saving a draft is not a version
Only **revise** makes a version, and **commit** puts it into service. A save is
a save.

The PATCH used to do `version = version + 1` whenever the steps changed — right
when a version was a number on one row, wrong once a version became a row. A
draft edited over four days reached **v8 while v4 to v7 never existed**. Writing
a playbook takes a team days of drafting and none of it is a version of
anything.

For the same reason `replaceSteps` **deletes** a draft's old steps instead of
superseding them. Superseding protects a running plan's rules, and a draft
cannot be run — keeping them left 96 unreachable rows behind those four days.
A committed version still supersedes, because plans depend on it.

### Hold references by identity, not position
Twice now the editor has lost configuration by holding a reference as an array
index. `parent_index` needed remapping every time rows were dropped or moved;
`depends_on` held indexes too, and **nothing remapped it on reorder at all** —
so setting "waits for" and then dragging anything retargeted the dependency at
whatever took that position.

`depends_on` now holds `uid`s, and positions are worked out once, at save.
Dependency hydration also matched rows to editor positions **by title**, and
this playbook has "Internal Review" four times and "Client Confirmation" three
— so every one resolved to the first. Match by identity.

The rule: inside the editor, refer to a step by `uid`. Convert to an index only
in the payload, and only at the moment of sending.

### Editing steps: uid, renest, and why nesting is one level
A draft step carries a client-side `uid`. Not the database id — a step being
written has none — and not the array index, which changes the moment anything
moves. Collapsing and dragging both key off it.

`renest()` re-derives every child's parent from where it now sits: nesting is
one level deep, so a child belongs to the nearest top-level step above it.
That means dragging a child under a different phase needs no special case — it
lands somewhere else and belongs to whatever it landed under.

Dragging a phase takes its steps with it; moving a phase and stranding its work
is never what anyone meant. **Only the handle is `draggable`** — a draggable
row hijacks selecting text inside its own inputs.

### A version of a playbook is a row, not a number
`procedure_definitions` holds one row per version, tied by `root_id`. This
replaced a single row carrying a `version` number, which had a real flaw:
revising flipped that row to draft, and since only a committed playbook can be
run, **revising took the process out of service** until the editing finished.

Now v3 stays committed and adoptable while v4 is drafted beside it.

- **draft** — being written; cannot be run. One per family at a time.
- **committed** — in service. Steps frozen; wording still editable.
- **superseded** — a later version took over. **Read-only**: a plan may still
  be following it, and `PRJ_20251219_0001` follows v1 today.
- **retired** — no new plans; running ones untouched.

Revising copies the committed version's steps and dependencies into the new
draft, so a revision starts from what is in service rather than a blank page.
Committing supersedes the outgoing version **first**, because the auto-start
index allows one committed row per category — and the new version inherits how
the old one was adopted.

The list groups by `root_id` and shows one entry per playbook: the committed
version represents it, else the open draft, else the newest. Every version is a
chip you can open.

### The lifecycle in detail
`procedure_definitions.status` replaced `is_active` doing two jobs badly —
"inactive" could not distinguish never-finished from taken-out-of-service.

- **draft** — being written. Steps may change. **Cannot be run**;
  `start_procedure_run` refuses, and auto-start only picks up committed ones.
- **committed** — in service. **The contract is frozen**: steps, gates, order,
  dependencies and hours. Wording is not — the name, description and a step's
  instructions stay editable, because forcing a new version to fix a typo is
  how a process stops being maintained. The API already drew this line:
  `stepsChanged` bumps the version, other edits do not.
- **retired** — no new plan adopts it. Plans already running are untouched.

`POST /api/playbooks/[id]/lifecycle` takes `commit`, `revise` or `retire`.
Revising returns a committed playbook to draft at the next version. Committing
with no steps is refused. A protected playbook cannot move at all — copy it.

**Nothing here touches a running plan.** A run pins its version at the start
and resolves its tasks through `procedure_step_id`, which keeps pointing at the
step rows it began under — which is why old step versions are kept with
`is_current = false` rather than deleted.

### Configure the playbook, not the run
`start_procedure_run` already does more than the builder used to let you say.
It resolves an assignee, carries `priority` and `estimated_hours` onto the
task, computes each due date from `duration_days`, and honours `allow_parallel`
when scheduling. The point of a playbook is that all of that is decided once:
adopt it, start it, and the work arrives owned, dated and prioritised.

**A step names a person** through `assign_to_user`, which wins over
`assign_to_role`. The role branch only resolves when exactly one active user
holds it — a deliberate refusal to guess, which also means a role alone leaves
steps unowned on any team with two designers. `assign_to_user` is
`ON DELETE SET NULL`: someone leaving must not delete a step from every
playbook that named them.

`is_active` is a draft switch — an inactive playbook cannot be started.

**A playbook can start itself.** `auto_start` plus
`auto_start_project_category` mean a won lead becoming a project picks up its
delivery process without anyone applying a template. Both project-creation
paths call `autoStartProjectPlaybook`. A playbook naming a category beats one
taking any; a partial unique index stops two claiming the same category, and
the helper refuses to start a second run of the same playbook on one project.
It fails quietly on purpose — a project without its playbook is a click to
fix, a conversion that rolled back is not.

**Authoring is a page, not a modal** —
`/dashboard/settings/playbooks/[id]`, with `new` for a new one.
`PlaybookEditor` is the form; the page owns navigation.

**A step can wait on named steps.** `procedure_step_dependencies` holds
`hard` (blocks) and `soft` (recorded, advisory) links, and
`task_blocking_predecessors` checks them **before** `enforce_order` — a named
dependency holds whether or not the playbook enforces order, which is how "3D
waits on layout sign-off while the ceiling quote runs alongside" gets said.

The editor works in **indexes**, because a step being written has no id yet;
the API resolves them after every step exists. Dropping an untitled row shifts
those indexes, so `cleaned` remaps both `parent_index` and `depends_on` — it
did not before, and a blank row in the middle would silently re-parent
everything below it.

Still not expressible: **`form_schema`**, so a `form` step is no different from
a manual one.

### Deleting a task, and why a playbook step cannot be
Three rules, all in `DELETE /api/tasks/[id]`. Before 2026-09-08 there were
none: the handler asked only for a session, so any signed-in user could
hard-delete any task, and `parent_task_id` cascades.

1. **You deleted what you made, or you hold `tasks.delete`.** Ownership alone
   would strand every task whose creator has left, so the permission is the way
   back in — eleven manager-shaped roles hold it.
2. **A playbook step is never deleted.** It records a governed process, and
   removing one quietly rewrites what the team agreed to do. Answered 409 with
   `reason: "playbook_step"`.
3. **A parent takes its children with it**, so the count must be acknowledged
   with `?cascade=true`. Answered 409 with `reason: "has_subtasks"` and a
   `childCount`; both delete call sites re-ask and retry.

The sanctioned ways out of a playbook step are **skip** (needs a reason, gated
by `can_skip`) and **cancelling the run**, which transitions open steps to
cancelled and leaves settled ones alone — history survives either way.

New steps in the builder are therefore **skippable by default**. A step nobody
can skip and nobody can delete has no honest way out, and people answer that by
marking work complete that never happened. Non-skippable is a deliberate choice
for things like customer sign-off, not the accident of a default — which is why
16 of the first 25 seeded steps are non-skippable.

## Traps that have already cost time

- **`QuotationPDF.tsx` must not be a client component.** Marking it
  `"use client"` makes route handlers import a client-reference proxy, and
  react-pdf dies with `Cannot read properties of null (reading 'props')`. PDF
  generation was broken app-wide by exactly this.
- **`{value && <X/>}` with a numeric value renders `0`**, which react-pdf
  rejects outside a `<Text>`. A zero discount is the normal case.
- **`wrap={false}` in react-pdf silently drops** any section taller than a
  page — it does not truncate. Only fixed-height blocks should use it.
- **The line item → cost item column is `quotation_cost_item_id`**, not
  `cost_item_id`. The wrong name fails the query, and an unchecked error
  printed documents with every price at zero.
- **`quotations.project_id` carries no foreign key** (only
  `linked_to_project_id` does), so PostgREST cannot embed the project. Fetch it
  separately.
- **`routePermissions` lives in `src/config/route-permissions.ts` only.** It was
  copied into `src/lib/supabase/middleware.ts` "to work with Edge Runtime" and
  the two drifted: the config file was read by nothing, so the quotation
  config, print library, terms library and Settings → Config were ungated,
  while the middleware still guarded `/dashboard/settings/roles` — a page that
  does not exist — behind `settings.roles.view`, a permission that does not
  exist. The module is types and a literal array, so Edge imports it fine.
- **Never `next build` in this directory** while `npm run dev` is running; it
  corrupts the dev server's `.next`. Build from a hardlinked copy.

## Migrations

`supabase/migrations/` holds **one file**: the baseline schema, dumped from the
live database on 2026-09-07 and already marked applied in the remote ledger.

It exists because there was no foundation before it. Every migration this
project had was a delta on a schema built in the Supabase dashboard — not one
core table was created by a migration, so a fresh replay died on the first
`ALTER`, and roughly ten months of schema evolution existed nowhere in the
repository. The baseline carries 124 tables, 323 RLS policies, 135 functions,
50 types, 364 indexes and the `trg_lead_stage_change` trigger, none of which
had been in version control.

The 43 deltas it supersedes are in `supabase/migrations_archive/`, kept for the
reasoning in their comments. **Do not re-run them.** Replaying an old
`CREATE OR REPLACE FUNCTION` on top of the baseline would overwrite a current
definition with an older one — a real risk here, where functions were often
edited in the dashboard.

**Migrations can now be applied from the CLI.** The project is linked and the
ledger matches, so `supabase db push` applies anything new — no more pasting
SQL into the dashboard. Applying by hand is what caused the drift being cleaned
up here: it does not write to the ledger, so seven migrations looked unapplied
when they were live.

    supabase db push                 # apply pending migrations
    supabase migration list          # local vs remote ledger
    supabase db dump -f supabase/migrations/20260101000000_baseline_schema.sql

`db dump` and `db diff` need Docker running; `push`, `list` and `repair` do not.

## Layout worth knowing

- `src/lib/dates/lead-dates.ts` — date rules shared by routes and modals
- `src/lib/quotations/scope-to-quotation.ts` — the one-time Spaces copy, used by
  both the create-quotation API and the lead transition
- `src/components/quotations/QuotationBuilder.tsx` — the quotation editor;
  reading and editing share one route, and the quotation's state decides which
  you get
- `src/components/quotations/QuotationPDF.tsx` — the printed document, driven by
  a print format's `itemise_to` and `price_at`
- `scripts/` — see `SCRIPTS_GUIDE.md`; the seed scripts are all idempotent and
  support `--dry`

## Still open

- **No email is sent anywhere.** The stub service was dead code and was
  deleted; there is no send path at all. `api/team/members/[id]/reset-password`
  still takes a `sendEmail` flag in its body that controls nothing
- Vercel deployment unfinished — `NEXT_PUBLIC_*` vars are needed at build time
- Cover page is wired but dormant; needs an uploaded image
- Terms are rendered live from the clause library, not snapshotted onto the
  quotation — that belongs with an approve-then-send flow
