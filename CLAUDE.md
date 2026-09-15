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

**There is one lead permission namespace.** `sales.leads.*` was deleted on
2026-09-09 (migration `20260909130000`) and its 12 keys folded into `leads.*`,
which is what the code has always enforced.

It was not a harmless duplicate. Manager held `sales.leads.view` and no
`leads.*` at all, and because the navigation and the middleware's route table
*did* read `sales.leads.view`, a Manager was shown the Leads menu, allowed onto
`/dashboard/sales/leads`, and then refused by `leadAccess()`. The menu worked
and the page was broken — worse to diagnose than a clean denial. Owner and
Admin already held all 18 `leads.*` keys and Sales held a coherent own-scoped
set, so only Manager actually changed.

**190 of 253 permissions are referenced nowhere in `src/`.** `npm run
perms:check` lists them by module; it is a fair map of how much of the
permission model is still unenforced.

`role_permissions` is read-only in the app (no route writes it), so nothing can
silently drop a grant.

### Who may change which role

`team.roles.manage` says you may edit roles. It does not say you may edit your
own — and without that distinction the permission is equivalent to granting
yourself anything. Admin holds **252 of 254** permissions (missing only
`tasks.templates.manage_protected` and `settings.billing.manage`), so an Admin
editing the Admin role becomes an Owner in all but name.

`src/lib/auth/role-guard.ts`, four rules:

1. **The Owner role is untouchable**, by anyone — also enforced by trigger.
2. **The Admin role may only be changed by an Owner.** Covers a tenant's own
   copy of Admin too; it is the same role wearing the same name.
3. **Nobody edits a role they hold.** Rule 2's reason, generalised — otherwise
   delegating role management to a custom role hands its holders the same
   escalation.
4. **You cannot grant a permission you do not hold.** Rules 2 and 3 stop you
   editing your own role; this closes the way around them, which is to create a
   role with everything in it and assign it to yourself. Checked against
   *effective* permissions, so a per-user grant counts.

**These are application rules, not database ones**, and that is the important
difference from the Owner lock. They depend on who is asking, and every write
here goes through the admin client where `auth.uid()` is null, so no trigger
can see the caller. **Any new route that writes roles must call these — the
database will not catch it.**

A new role is created empty for the same reason: filling it goes through the
editor, where rule 4 applies.

The roles screen mirrors rules 2 and 3 to explain why a role is read-only.
That duplication can drift; the API is what enforces them, so a mismatch shows
the wrong explanation rather than allowing anything.

### The Owner role is locked, in the database

Owner holds **every** permission, always, and no code path may change that.
Enforced by triggers rather than by application checks, because "locked at all
times" should not depend on every future caller remembering to ask first — and
because the admin client bypasses RLS, so an application-level rule would not
have stopped a stray server-side write.

- `trg_grant_new_permission_to_owner` — every new row in `permissions` is
  granted to Owner automatically. Owner held 254/254 only because the migration
  that added `team.roles.manage` granted it by hand; the next person to forget
  that step would have left Owner quietly short of "all permissions".
- `trg_owner_permissions_locked` — Owner's grants cannot be updated, deleted,
  or inserted as a revoke. An **insert that grants** is the one allowed write,
  which is how a new permission arrives.
- `trg_owner_role_locked` — the Owner role cannot be renamed, re-slugged,
  moved to a tenant, or deleted.

Scoped to the shipped Owner role (`tenant_id IS NULL AND slug = 'owner'`). A
tenant who creates their own role called "Owner" has made an ordinary custom
role and may edit it.

**The lock initially broke deleting a permission.** `role_permissions` cascades
from `permissions`, so removing a permission tried to delete Owner's grant and
the lock refused the whole statement — a migration like
`20260909130000`, which retired 12 keys, would have failed. A transaction-local
flag set by `trg_mark_permission_deletion` distinguishes *removing a permission
from Owner* (refused) from *removing the permission itself* (allowed, and it
takes Owner's row with it). Found by the lock's own test, which could not clean
up its probe row.

Application layer matches, so nobody meets a raw `check_violation`: the roles
API answers 409 `owner_locked`, the per-user overlay refuses anyone **holding
the Owner role** — otherwise an Admin could reach the same end one permission
at a time — and the Roles screen renders Owner read-only for everybody.

Deliberate maintenance still has a way through:
`ALTER TABLE role_permissions DISABLE TRIGGER trg_owner_permissions_locked;`

### A shipped role is a proposal; the first edit takes a copy

All 21 seeded roles are global — `tenant_id` NULL, `is_system_role` true — and
shared by every business on the platform. Editing "Sales" in place would edit
it for all of them, so `ensureTenantOwnedRole()` copies it to the tenant on the
first change and edits the copy. Same bargain as protected playbooks, and the
same reason: we propose the practice, they decide how they work.

The copy has to carry three things or it is not the same role: the definition,
**every grant including revokes** (`granted` is tri-state — copying only the
true rows turns an explicit revoke into "not stated"), and **the tenant's own
members**, moved onto it. That last one is silent when missed: the tenant edits
a role nobody holds while everyone carries on under the shipped one. The
reassignment is filtered by tenant, so other businesses never move.

`PUT /api/team/roles/[id]/permissions` may therefore write a **different role
id than you asked for** — callers must follow `data.roleId` afterwards. The
Roles page does this and re-selects the copy.

Owner is the one role that cannot be forked: `is_super_admin` and the
ownership-transfer flow both key off it.

Settings → Roles (`team.permissions.view` to look, `team.roles.manage` to
change — a new permission, Owner and Admin) shows one entry per role: the
tenant's copy where it exists, otherwise the shipped one. Showing both invites
editing the wrong one. `GET /api/team/roles` is deliberately not reused for
this screen — it filters by what the caller may *assign*, which is a different
question from what a role can do.

A role with people in it refuses deletion with a 409 and the count; they have
to be moved first, because `user_roles` cascades.

### Permissions resolve in one place, roles then user

`src/lib/auth/permissions.ts` is the only thing that decides what a person may
do. `mergePermissions()` applies two layers and the user layer always wins:

- **roles** — held when a role grants it and none revokes it. `granted` is
  tri-state, and only an explicit `false` revokes; `NULL` reads as held.
- **user** — a row in `user_permissions` decides that one key outright, in
  either direction, whatever the person's roles say.

There were four copies of this and **they disagreed**. The API guard read
`granted !== false`; the middleware and the client hook required
`granted === true`, so a NULL row vanished from the UI while the server counted
it as held; and `getCurrentSession()` ignored `granted` altogether and handed
back permissions a role had explicitly **revoked**. All 1307 role grants are
currently `true`, so nothing live exercised the difference — three of the four
were one row away from disagreeing about the same person. All four now call the
shared resolver.

The client hook also used to return early with zero permissions for a user with
no roles, which would have hidden every individually granted capability.

**Granting one capability to one person is `user_permissions`, not a new role.**
`PUT /api/team/members/[id]/permissions` takes `{ key, granted }`; DELETE with
`?key=` clears the override and hands the decision back to their roles —
deliberately different from revoking, which is an active "no". Gated on
`team.permissions.manage` (Owner, Admin). Managed from Settings → Team, the key
icon on a member's row.

Note the sibling roles route still gates on `roles.hierarchy_level`, which
contradicts the flat model everything else follows. It is worth reconciling;
do not copy it into anything new.

### The anon key is public, so RLS is the only wall

`NEXT_PUBLIC_SUPABASE_ANON_KEY` ships inside the browser bundle. That is what it
is for, and it is safe only to the extent that row level security is right. Two
policies were not.

`tenants` had a policy *named* "Users can view own tenant" whose condition was
`USING (true)`, so the anon key returned every tenant on the platform — company
names, registration and GST numbers, emails, phone numbers, postal addresses,
subscription status. `subscription_payments` never had RLS enabled at all and
exposed amounts, gateway references and error messages. Both were found by
probing with the anon key while checking whether it was safe to publish to
Vercel, and both are fixed (`20260909100000`, `20260909120000`).

A policy's name is not its condition. Before adding a table, probe it:

    anon.from(t).select("*")   // must return [] for anything tenant-owned

Still public **on purpose**, because they describe the product and not any
customer: `permissions`, `role_permissions`, `subscription_plans`,
`subscription_plan_features`, `units`, `project_phase_categories`, and the
`project_*_template` tables plus `roles` — the last two return only their
shared defaults (`tenant_id IS NULL` / `is_system_role`), never a tenant's own.

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

### A lead has one approved quotation
Enforced by a partial unique index, and by the status route superseding
whatever was approved before — so the constraint is never the thing a user
meets; they get a sentence saying which quotation was replaced.

The old one becomes **`superseded`**, not cancelled. Nobody withdrew it and it
may have been the right price at the time; it is simply not the agreed one any
more, and that difference is what someone needs when they ask a year later why
a quotation was dropped. `superseded` is deliberately **not** in the status
route's `validStatuses` — it is a consequence of approving something else, not
a state anyone picks — and a superseded quotation is locked from editing, like
an approved or rejected one, because it records what was once offered.

**Baseline copies are excluded.** Converting a lead copies its quotation onto
the project as a frozen baseline, and that copy is approved too — it carries
`baseline_quotation_id`, which a lead's own quotation never does. Counting it
would make the rule unsatisfiable for every converted lead.

**Approving needs `quotations.approve`** (Admin, Owner, Manager, Sales Manager,
Finance Manager, Project Manager, Senior Designer). It is the moment a price
becomes the agreed price and was open to anyone signed in.

The action lives on the quotation page, offering only the next sensible move —
draft → *Mark as sent*, sent/viewed/negotiating → *Approve*. It used to exist
only as a menu on the list, which meant deciding about a price from a row
without the price in front of you.

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

### A PostgREST embed names a foreign key, and it must exist

`users!task_completion_requirements_satisfied_by_fkey(...)` failed with
"Could not find a relationship", because `satisfied_by` was a bare uuid column
with no constraint. The route returned an error, `TaskRequirements` rendered
nothing, and **every completion gate a playbook step can carry — confirm a
meeting, tick a checklist, get a sign-off — was invisible and unsatisfiable**.
A step arrived blocked with nothing on the page able to unblock it, and it read
as "the Complete button is missing".

It never worked. Not a regression — the panel had never rendered for anyone.

Auditing all 30 `users!<constraint>` embeds in the codebase found exactly one
other: `project_notes_created_by_fkey`, used by the calendar. Both constraints
now exist, `ON DELETE SET NULL` — somebody leaving must not delete the record
of a sign-off, or their note.

**When adding an embed, check the constraint exists.** A wrong name is not a
compile error and not a runtime crash; it is an empty panel.

### The Linked column names the project, for subtasks too

`/api/tasks` builds `related_name` twice — once for top-level tasks and again
for subtasks — and the subtask pass resolved **leads only**. Every subtask of a
playbook phase therefore came back with an empty name and the list fell back to
the literal word "Project", beside a parent naming the real one.

Both passes now prefer the project's own `name` ("Dileepnath Raju - Modular
Project") over `project_number • client`, which is a record number and a client
and not what anybody calls the work.

### Transitions stamp the actual dates; start_date stays the plan

`task_transition` set status and the hold/skip fields and **never touched
`started_at` or `completed_at`**. So pressing Start recorded nothing about when
work began and Complete recorded nothing about when it ended — which is why the
Plan tab's actual columns read "–" however many times the buttons were used.
The columns all existed; nothing wrote them.

- **`started_at`** moves every time work restarts; **`first_started_at`** keeps
  when somebody first picked it up, which is what planned-versus-actual needs.
- **`completed_at`** is cleared on the way back out of completed, so a reopened
  task stops claiming an end date; `first_completed_at` keeps the original.
- **`completion_count`** counts how many times it was called done. A step
  completed three times is a process problem worth being able to see.

**Completing something never started stamps both dates the same.** Marking a
step done straight from `todo` is normal — the work happened, nobody pressed
Start — and it used to leave `started_at` NULL against a set `completed_at`, so
the Plan tab showed a step that finished without beginning and any duration from
the pair was meaningless. A zero-length record is the honest reading of
"completed without tracking", and it beats a blank. It never overwrites a start
that was actually recorded.

**`start_date` is never touched by a transition.** That is the plan, derived
from the playbook's hours; `started_at` is what happened. Overwriting one with
the other loses the ability to tell that something ran late.

`task_work_sessions.duration_seconds` — **not** `duration_minutes`. Recomputing
`actual_hours` from the wrong column silently yields zero, which is how logged
hours get erased.

### The Plan tab's actions: no prompt where there is no reason to give

A reason is asked for only where it explains a departure: **hold** (why it
paused) and **skip** where the playbook requires one. Start, Complete and Resume
act immediately — every status change used to open a modal demanding notes, so
starting a step took two clicks and an invented sentence, and the timestamps
already record it.

The buttons stay **disabled until the gates arrive**. They used to render
enabled and switch off a second later, which reads as the screen changing its
mind.

**Status picks the button; the gate only enables it.** The first slot carries
exactly one of Start / Pause / Resume, chosen from the row's own status — the
same thing the compact task controls do, so a row behaves identically wherever
it appears.

Letting the **gate** choose the button showed the wrong one. A row's status
updates optimistically the moment somebody acts, while the gate only catches up
when the parent's refetch resolves; in between, a step put on hold rendered a
disabled Start — which reads as no button at all — next to an enabled Complete.
Status is always current and the gate can lag, so status decides the slot and
the gate only ever disables and explains. Start is the one action that can be
refused outright, and it is the one that consults the gate.

**The plan table scrolls sideways** (`overflow-x-auto` with `min-w-[1080px]` on
each grid row) rather than `overflow-hidden`. Starting a step fills the
actual-dates column, the flexible columns grew, and the Edit button was pushed
past the right edge with no way to reach it.

The step row's action cell needs **`stopPropagation`** — the row itself opens
the task, so without it pressing Complete also navigated away. The phase row's
cell always had it; the step row's did not.

**A finished task never shows a play triangle — it shows a slate u-turn.** The
compact controls (tasks list, project Tasks tab, table rows, edit modal) draw a
single Reopen button on a completed or cancelled row: the same u-turn as the
task page, in slate rather than the blue of an action you are expected to take.

Two wrong answers preceded it, and both are worth remembering. Changing the
icon while leaving it blue and in the play position still read as "not begun".
Removing the button entirely then took away the only way to undo a mistaken
completion from a list. The affordance has to exist and has to look like going
back, not starting.

`SubPhaseDetailPanel` already gated Start behind `not_started`, and the Plan
tab's `QuickActions` already showed text for a settled row, so the compact
controls were the only place offering it.

### Switching tabs re-reads that tab's data

The project page loads everything **once on mount**, keyed on the project id.
Switching tabs fetched nothing, and the Plan tab and the Tasks tab are two views
of the same task rows — so completing a step on one left the other showing what
it had when the page opened. A phase finished minutes earlier still read "In
Progress".

Opening the Plan tab now calls `refreshPlan()`, and opening the Tasks tab calls
`refreshTasks()`. Both are silent: they touch no loading flag, so the table is
simply right when you look at it. Deliberately **not** `fetchCounts`, which
blanks the page and refetches every tab's data.

### A finished task is read-only until it is reopened

`isEditable` is a property of the **table** — `allowEdit && !readOnly` — and said
nothing about the row. So every field on a completed task stayed editable
inline: its title, status, priority, assignee, dates and notes could all be
changed while it read as done.

`TaskRow` now derives `rowEditable = isEditable && !isSettled`, where settled is
completed, cancelled or skipped. Twenty-two guards inside the row use it.

**One deliberate exception:** the timer column keeps the table-level
`isEditable`, because on a settled row that control *is* the Reopen button.
Gating it on the row being editable would lock a completed task shut with no way
back. The edit modal is the other way in.

This lands on the Plan tab for free, which is the point of it being the same
table.

### The Plan tab IS the tasks table

`PlanTab` is `TaskTableReusable` scoped to the playbook run — 105 lines, not a
second table. A phase is a task and a step is its subtask, so there was never a
second thing to render.

It replaced `ManagementTab`, which was 1,287 lines carrying its own
`StatusBadge`, its own start/pause/complete buttons, its own notes prompt and
its own hand-drawn assignee and date cells, beside a tasks module that already
had every one of them. **Every Plan tab bug reported over a fortnight came from
that split** — a start button on a completed row, Pause not appearing, a prompt
demanding notes to begin a step, stale statuses, a refresh that blanked the
page. Each was fixed once in the tasks module and stayed broken here.

What the plan genuinely adds is three opt-in props on the shared table, not a
reason to own a copy of it:

- **`showPlanColumns`** — expected against logged hours, and progress.
- **`preserveOrder`** — render `externalTasks` as given. The plan's order is the
  playbook's (phase, then its steps, then the next phase) and is not derivable
  from any column; the table's default sort is `created_at`, which is the order
  the copy happened to insert rows, so phases came out scattered among their own
  steps.
- **`initialPageSize`** — a plan is read whole; paging it into 25s cuts a phase
  off from its steps.

**The table renders `externalTasks` as top-level rows.** Handing it every task
in a run put the steps beside their phases as siblings. It wants parents only,
each carrying its children on `subtasks` with `subtask_count` — `PlanTab` builds
that from the ordered phase list the plan API already returns.

All three props default to the old behaviour, so the project and lead Tasks tabs
are untouched.

`ManagementTab` survives **only** for projects still on the older native phase
engine, whose rows really are not tasks. When that engine goes, so does it.

Editing anything on the project page — a plan row or a task row — opens the one
`EditTaskModal` the page owns. The Tasks tab's Edit button previously called an
`onTaskClick` nobody had passed, so it did nothing at all.

**Before adding a control to a project screen, look in `components/tasks`
first.** That is where this went wrong, repeatedly.

### The Plan tab refreshes the plan, not the page

`onRefresh` on ManagementTab was `fetchProject`, which calls `setLoading(true)`
— the **page-level** flag. So the refresh icon above the plan table, and any
phase action, replaced the whole project detail page with a skeleton and
refetched every tab's data. Sub-step actions never called it, which is why only
phases and that button behaved this way.

It is now `refreshPlan`: the project row (native phases live on it) and the
playbook with its gates, in parallel, touching no loading flag. The table simply
changes. The refresh icon spins while it works rather than looking inert.

A disabled action is styled as a disabled **button** — `text-slate-300` on a
white row read as nothing there. And the reason is now **printed on the row**,
under the name, in amber, whenever a row that is under way cannot be completed.
It was only ever a tooltip, so "Complete is missing" was really "Complete is
disabled because a meeting has not been confirmed" with nothing on screen
saying so.

On a phase the reason is a **link to that stage's task page**, because that is
the only place a requirement can actually be satisfied — clicking a phase row
merely expands it, so there was no route from seeing the problem to fixing it.

Remember that a `meeting` step gates on a manual "Confirm the meeting took
place" requirement. A phase whose every sub-step is complete can still be
uncompletable for that reason alone, and it looks like a bug until the row says
so.

**A phase completes when its steps do**, and takes both dates. Verified on an
isolated playbook: blocked at two open steps, blocked at one, allowed at none,
accepted, and stamped with a start and an end.

### The Plan tab only offers what the server will accept

`project_plan_gates(project_id)` answers, for every task in the active run,
which transitions `task_transition` would accept and why not — in one round
trip, because asking per task is 33 on one project. `GET
/api/projects/[id]/plan-gates` exposes it, and the Plan tab draws its buttons
from it.

It is a **view of `can_start_task` and `can_complete_task`**, the same functions
the transition consults, never a second copy of the rules. A screen that
disagrees with the server about what is allowed is worse than one offering
nothing.

Before this the actions were drawn unconditionally: Start appeared on a step
whose predecessor had not finished, the transition refused it, and the tooltip
read "Start". A blocked action is now **disabled with the reason as its
tooltip** rather than hidden — hiding it answers "can I start this?" with
silence.

**A phase has actions too**, because a phase is a task. It previously had only
Edit, which became untenable once steps could wait for their phase to start:
nothing could ever be opened. `onPhaseQuickAction` routes a playbook phase to
`PATCH /api/tasks/[id]` and a native phase to `PATCH
/api/projects/[id]/phases/[phaseId]` — and that route wants
**`status_change_notes`**, not `notes`, when the status moves.

**The page fetches the gates alongside the plan**, in one `Promise.all`, and
passes them down. ManagementTab used to fetch them itself on mount — after the
plan had already loaded and rendered — so the action column sat empty for about
a second and then filled in. In series that was ~940ms; together it is ~540ms
and the tab paints once with its buttons already correct.

They refresh through `fetchPlaybook()`, which every action path already calls,
so starting one step re-asks and unblocks the next. A project with no active run
gets no gates and falls back to status-only behaviour, so the older phase engine
still renders.

`can_start_task`'s reason names **which part** it waits for — "Waiting for 2D
Designs to start" against "Waiting for Layout Drawings to finish". It used to
say "not finished" for every blocker, which is misleading for an `after_start`
link and suggests a wait that will never end.

### Who sees where the plan came from

The Plan tab's provenance banner — "Drawn from the playbook X (v5) … Stop
following this playbook" — and the drift banner beside it are shown only to
holders of **`tasks.edit`** (Owner, Admin, Manager, Designer). They are the
controls for changing how the business works, not information a site supervisor
needs, and showing them to everybody invited a click the server would refuse.

`tasks.edit` is chosen because it is what `PATCH /api/playbooks/runs/[runId]`
already requires to stop a run, so the UI shows exactly what the server will
allow. It is also the same four roles that may author a playbook at all.

`POST /api/projects/[id]/playbook/sync` was gated on project write only, which
disagreed with both. Bringing steps into a live plan is the same act as stopping
it, so it now requires `tasks.edit` too.

**Project Manager holds neither** — it has `projects.edit` but not
`tasks.edit` — so a project manager sees the plan and cannot stop its playbook.
That may want reconciling with the grants; it is not a code decision.

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

### One plan at a time, and who may change one
`POST /api/playbooks/[id]/run` refuses to start a second run while one is
active on the same entity. Nothing stopped it before, and the Plan tab shows
only the most recently started run — so the other kept its tasks, invisible on
the tab where the work happens. Stopping the current playbook is the deliberate
act that makes room for another.

Every playbook route is gated: `tasks.templates.view` to read,
`.create` / `.edit` / `.delete` to author, and starting or stopping a run on
`tasks.create` / `tasks.edit`, because that creates and cancels real work
rather than editing a template. They were all session-only until 2026-09-08.

Cross-tenant access is held by RLS — `procedure_definitions`,
`procedure_runs` and `procedure_step_definitions` all scope on
`get_user_tenant_id()`, and **no playbook route uses the admin client**, so
that protection actually applies. Keep it that way.

### A revision is one transaction, in the database

`revise_playbook(definition_id, user_id)` copies a version into a new draft
inside a single transaction. The route calls it and does nothing else.

It used to be four statements from the application — the draft, the parents,
the children, the dependencies — and **between any two of them the draft was
visible half made**. The editor renders whatever it finds: hydration nests
children under `parent_step_id` and silently drops any child whose parent is
missing, so a draft caught mid-copy looks like a complete, shorter playbook.
Saving from that screen then calls `replaceSteps`, which rewrites the draft to
match what the editor can see — and the steps that never copied are gone.

This happened **twice** to the Modular Design Template, each time leaving a v5
with 8 phases and none of v4's 24 child steps.

Application-level rollback could not close that window, which is worth
remembering before reaching for one again: the request can be abandoned between
statements — a navigation, a dev-server recompile, a dropped connection — and
then no rollback code runs at all. Only a transaction is atomic.

It is also **twelve times faster**: 32 sequential inserts at ~195ms each took
6.6 seconds, against 550ms for the function. That mattered, because the
lifecycle buttons had no pending state, so a six-second revise looked like a
dead button and people clicked away mid-copy. Those buttons now disable and say
what they are doing.

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

### Going live makes it THE version, everywhere

Decided 2026-09-09, replacing the opposite rule. A run used to pin the version
it started under and stay there, so committing v5 changed nothing for a project
already on v4 — several versions live at once, which was most of what made this
confusing to work with.

`commit_playbook_version()` now puts the draft into service **and moves every
running plan onto it**, in one transaction. Existing work is matched by
`step_key`, which is stable across revisions — that is what the column is for.

- **still there** — the task is repointed and takes the new title and hours.
  Status, logged hours, comments and attachments are untouched: those belong to
  the work, not the playbook.
- **newly added** — a task is created, as `start_procedure_run` would.
- **removed** — the task is cancelled **only if its status is still `todo`**.
  A step somebody has started, parked or finished is left exactly as it is;
  deleting recorded work to tidy up a playbook would be the worse bug.

The route reports what it did ("Version 5 is live. 1 running project moved onto
it, 3 step(s) added") because it changed live projects, and silently reshaping
somebody's plan is not acceptable.

`task_status` is `todo | in_progress | on_hold | blocked | completed | skipped |
cancelled`. It does **not** have `not_started` — that is phase vocabulary, and
borrowing it broke the first version of this function outright.

### The version list shows what is live and what is being written

The playbook list filters to committed, draft and retired. Superseded versions
still exist and are still what older plans followed, but they are not a
decision anybody makes from that screen, and showing five chips made the page
read as five things to think about when there are only ever two.

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

**A step can wait on named steps, and says which part it waits for.**
`procedure_step_dependencies` holds `hard` (blocks) and `soft` (advisory) links,
plus **`wait_type`**:

- **`after_finish`** — the predecessor must be completed, skipped or cancelled.
  Finish-to-start, and what every link meant before 2026-09-13.
- **`after_start`** — the predecessor must merely have begun. Start-to-start.

Both are needed, and reading every link as the first kind **deadlocked a whole
playbook**. Eleven of the Modular Design Template's 34 dependencies pointed a
step at its own phase, expecting "once the phase is under way". But
`task_transition` refuses to complete a parent while a subtask is open, and the
dependency refused to start the subtask until the parent completed — neither
could ever move, and none of the eight phases could be started.

**A step can never wait for the phase it belongs to.** It is already inside it,
so the link cannot mean anything, and the pair always deadlocks. Refused by
`trg_reject_circular_step_dependency`, dropped from the editor's options, and
skipped by the save so a stale payload cannot fail the whole thing. Self-links
are refused the same way. Deeper cycles are **not** detected.

`task_blocking_predecessors` checks named links **before** `enforce_order`, so
a named dependency holds whether or not the playbook enforces order.

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

### The sales report's date range covers the summary and nothing else

`/api/sales/leads/analytics` scopes only the five headline figures - intake,
revenue, win rate, average deal - to `from`/`to`. The funnel needs the whole
history to be a funnel, the source, owner and service tables would turn to
noise on a fortnight's leads, and what needs chasing is a question about today.
That was always true and the page did not say so, so a reader assumed the whole
report moved when they changed the range.

The section headings now state what each band is computed over. If the segment
tables are ever made range-scoped, the headings have to change with them.

The range also has an empty case worth keeping: this tenant's leads all arrived
in one month, so the ninety-day default lands on zero intake and zero closed.
The page says so and offers All time rather than showing a page of zeroes that
reads as a broken report.

### Two figures a lead carries and the report never used

`service_type` was collected on every lead and aggregated nowhere; it is now
the "What we sell" table, and on real data it says modular closes at 50% against
turnkey's 29% - a different decision from the source table's "where to
advertise". `trend` was computed by the API and never rendered at all.

Pipeline ageing is new: open leads by the stage they are in **now**, with how
long they have been there, measured from `stage_changed_at` and falling back to
creation for a lead that never moved - which is itself the finding. It is what
surfaced a proposal sitting untouched for 246 days.

### A colleague's name comes from `tenant_directory`, not `users`

The only SELECT policies on `users` are `id = auth.uid()` - stated twice, as
"Users can read own record" and "Users can see their own profile", which is the
tell that nobody designed it. Through the session client a person can read
exactly one user row: their own.

So every surface naming a colleague was wrong, and wrong **silently**, because
each one had a friendly fallback that hid the cause:

- the sales report's By owner table put 14 of 15 leads under **"Unassigned"** -
  `userName[id] || "Unassigned"` cannot tell "nobody owns this" from "I may not
  see who does";
- the leads CSV export did the same, in a file people keep;
- lead and task history showed **"Unknown user"** for a colleague's action;
- a project's manager card rendered **blank**, because that lookup ends in
  `.single()`, which returns null rather than erroring;
- the project-manager picker offered **only the person using it**, so nobody
  else could be made a project manager.

`tenant_directory` (migration `20260914120000`) is a view over `users` carrying
`id, tenant_id, name, email, avatar_url, status` and scoped by
`get_user_tenant_id()`. It is `security_invoker = false` deliberately: it runs as
its owner so the own-row policy does not apply, which makes the WHERE clause the
only wall. Verified under a real session - two colleagues visible, the other
tenant's user not, `phone` absent.

It is a **directory, not a widening of `users`**: no `phone`, no
`last_login_at`, no `email_verified_at`, no `is_super_admin`. Within one
business a colleague's name and work email are not secrets; their phone number
and login history are not the app's to hand out. Do not add a column without
deciding it is directory data.

`anon` is refused outright, and because `auth.uid()` is null for the service
role the predicate yields **zero rows** there too - so this view cannot be used
with the admin client, which is the right constraint. Name a person through the
session client and this view.

**The leads list only ever looked correct because it uses the admin client**,
which bypasses RLS. That is the habit to break: reaching for the admin client to
get around a policy also throws away the tenant wall.

### A report answers to the same access rule as its list

`/api/sales/leads/analytics` and `/api/sales/leads/export` now call
`leadAccess()` and, for a `view_own` holder, narrow `allLeads` before anything
is computed - the funnel, segments, velocity and attention lists all derive from
it - plus the three sets that hang off leads by id, so a funnel is never built
from stage history belonging to leads the caller cannot open. The response
carries `scope`, and the page says "Your 15 leads" rather than "All 15 leads on
record".

**Nothing changes for anyone today**, and that is the reason it was worth doing:
the three roles holding `leads.reports` / `leads.export` (Owner, Admin, Sales
Manager) all hold `leads.view` as well, so the report was one grant away from
showing a whole business's pipeline - and a spreadsheet of it - to somebody
entitled only to their own leads, with nothing in the code to object.

The projects report already did this via `projectAccess`. Copy that shape.

### The app has its own dialogs; nothing in it should call the browser's

`window.alert` / `window.confirm` / `window.prompt` render as bare OS modals
with the app's URL at the top, which reads as a browser security warning rather
than part of the product, and they block the main thread so nothing behind them
repaints. Two components already exist and are what to reach for:

- **`useConfirm()`** (`components/ui/ConfirmDialog`) for a question - returns a
  promise, so `if (!confirm(...))` becomes `if (!(await confirm({...})))`.
- **`Toast`** (`components/ui/Toast`) for the outcome. No provider and no
  queue: hold the message in the calling component's state and render it.

The quotations module had eighteen native calls and was converted on
2026-09-14. Changing a quotation's status was the worst of it, because the
*question* already used the app's dialog while the *answer* came back as an
`alert()` - so one action looked like two different products.

Three things worth keeping from that conversion:

- **A toast cannot survive a reload.** The status change ended in
  `window.location.reload()`, which was fine after a blocking `alert()` and
  destroys a toast. Refetch instead - here `fetchQuotation()` already reloads
  everything the page holds.
- **A toast cannot survive its own component unmounting.** `QuotationBuilder`
  approves and then exits, so its supersede message had nowhere to live.
  `onExit` now takes an optional notice and the page behind shows it. Widening
  that signature immediately caught `onClick={onExit}`, which would have passed
  a MouseEvent as the message - wrap it as `onClick={() => onExit()}`.
- **Form validation is not a popup.** "Please select a lead" belongs under the
  field, not in an OS modal over the form the person is already looking at.

Approving still asks for no confirmation, on either path. It supersedes another
quotation silently, so one is arguable - but it belongs on both the detail page
and the builder or not at all.

### A quotation has one rendering, and `readOnly` decides if you may change it

The summary page (`/dashboard/quotations/[id]`) used to hand-write its own
space / component / line-item tree - 533 lines walking the same rows the
builder walks - so one quotation had two renderings of the same payload from
the same endpoint. They had already drifted: different dimension handling,
different treatment of a line that follows its component's size, and a
different idea of which rate the client actually pays.

The document is now `SpaceCard` on both pages. `readOnly` threads
`SpaceCard -> ComponentCard -> LineItemRow` and does two things: fields stop
accepting input, and the controls that would change the figures are **not
drawn at all**. A greyed-out delete button on a document nobody may change is
noise offering nothing. It defaults to false, so the builder is untouched.

`src/lib/quotations/to-builder-spaces.ts` is the one mapping from the API's
rows to `BuilderSpace[]`, shared by both. The builder did this inline through
`any`, which was hiding that a line whose cost item has left the catalogue
hands `undefined` to `LineItem.costItemId`, declared non-optional.

Two things to know when passing `readOnly`:

- **`ComponentCard` gates the whole width/height row on `onUpdateDimensions`
  existing.** Omit it and a component's size vanishes from the document rather
  than merely being uneditable, so pass a no-op.
- The mutation callbacks are required props because the builder always has
  them. On a document they are no-ops, and nothing that would call them is
  rendered.

The two pages keep their separate jobs. The builder is the editor; the summary
carries status, versions, Share and the meta, which is why it was not simply
replaced by a locked builder. They now share the rendering, not the role.

### A small change refreshes a small thing

Ticking a follow-up done on a lead's Notes tab took about a second and a half
and looked like nothing was happening. Two separate faults, and both are worth
recognising elsewhere.

**The refresh was out of all proportion to the change.** `patchNote` called
`onRefresh()`, which on a lead is `fetchNotes` - and `fetchNotes` refetches the
*entire lead* from `GET /api/sales/leads/[id]`: thirteen queries across six
sequential round trips, covering quotations, documents, calendar events, tasks
and their subtasks, none of which a follow-up tick can affect. Measured at
~1.27s server-to-Supabase, on top of the PATCH and the browser hop.

`PATCH /api/sales/leads/notes/[noteId]` already returned the updated note, so
the row is now updated from that and nothing is refetched. **Merge it, do not
replace it** - that response's `.select()` carries no `created_user`, so
swapping the note in blanks the author column.

**The button lied about being busy.** `onRefresh()` was not awaited while
`setBusy(null)` sat in a `finally`, so the control re-enabled the instant the
PATCH returned, with the row still showing the old value, for the whole second
the refresh was still in flight. Any `finally` that clears a pending flag must
await everything the action actually kicked off.

The project page's `refetchNotes` was already scoped to
`/api/projects/[id]/notes`, one query - which is why this was only ever slow on
leads. It keeps the fallback path, which is now correctly awaited.

`fetchNotes` still reads the whole lead, deliberately: it also refreshes the
timeline, and note create/edit/delete do write timeline entries. Only the hot
path - ticking or dating a follow-up - was moved off it.

### Only two lead tabs hit the network, and both did it expensively

Overview, Quotations, Tasks, Notes and Timeline all render from what the lead
page already loaded in its one GET. **Spaces and Calendar are the only tabs
that fetch when opened**, which is the whole reason they were the only two that
felt slow.

**Every API route costs ~650ms before it reads a row.** `protectApiRoute` calls
`supabase.auth.getUser()`, which is a round trip to the Auth server (~370ms
measured), then looks the user up again through the admin client (~280ms).
Baseline round-trip to this Supabase project is ~170ms, so latency - not query
time - is what these screens are made of. **The lever that matters is fewer
round trips per screen**, not faster SQL.

- **Spaces fired four requests**, and three were tenant-wide catalogue lists -
  space types, component types, quality tiers - refetched every single time the
  tab was opened. They now go through `fetchConfigOnce`
  (`lib/quotations/config-cache`), which caches the *promise* for five minutes
  so simultaneous mounts share one request, evicts failures, and is dropped by
  `invalidateQuotationConfig()` from the config screen that edits them.
- **The fourth request still ran on every open**, because switching tabs
  unmounts the tab. `SpacesTab` now keeps a module-level `scopeCache` per
  property: cached rows paint immediately and the fetch runs behind them, so
  nothing is stale for longer than one round trip. It needs no invalidation
  because the tab already treats `items` as the authority - every add, edit and
  delete updates it directly rather than refetching - so the cache just mirrors
  it, guarded on the first load having completed so the empty initial state
  cannot overwrite a good cache.
- **Calendar re-selected the user the guard had already resolved**, and awaited
  a `user_roles` query whose only use is filtering the merged list at the very
  end. The first is gone (`guard.user` carries `tenantId` and `isSuperAdmin`);
  the second is started early and awaited where it is needed.

Still there, and worth knowing before the calendar grows:

- **An N+1 on standalone events.** Each linked event gets its own lead or
  project lookup. It costs one extra query today because only one event is
  linked, so it is a scaling problem rather than a current one.
- **Its three source queries still run in sequence** (lead activities, note
  follow-ups, due tasks) though nothing makes them dependent.

**`projects.project_name` does not exist - the column is `name`.** The calendar
selected it in two places, neither checked the error, so a project-linked event
silently lost its name. Fixed, and verified against the schema.

### The server says why; do not throw that away

Marking a calendar event complete on a lead popped `Failed to complete task` in
a browser alert. The task in question had two open subtasks, and
`task_transition` had said exactly that - the route answers **409 with the real
reason** in `error`:

    "2 subtasks still open. Complete or cancel them first."

The calendar did `if (!response.ok) throw new Error("Failed to complete task")`,
which replaces a sentence telling you what to do next with one saying only that
something went wrong. **Read `json.error` on a failed response.** Every task
status change goes through the transition RPC, so a refusal always carries a
reason worth showing - an unsatisfied completion requirement, a blocking
predecessor, open subtasks.

### An action refreshes what it changed, never the page

`onRefresh={fetchLead}` on the lead's Calendar tab meant completing one event
replaced the whole detail page with a skeleton and refetched every tab -
thirteen queries over six round trips. Reassigning a lead did the same, because
`handleAssigneeChange` also ended in `fetchLead()`.

`fetchLead` now takes `{ quiet: true }`, which skips the page-level loading
flag. It still refetches everything, deliberately: the assignee, client and
property are rendered from **embeds**, so they cannot be reconstructed in the
client from a PATCH response. What changes is that the person keeps looking at
their data while it happens. The mount call stays loud - there is nothing to
look at yet.

The Calendar tab passes `fetchActivities`, not `fetchLead`: the calendar owns
its own rows and the only thing the page needs is the timeline, since completing
a meeting writes an activity.

`leads.assigned_to` is the column. `assigned_user_id` is what the PATCH body
calls it and does not exist on the table.

Audited across the whole lead detail page after this: no browser dialogs
reachable from any tab, and one path that can blank the page - first load.

### The project module follows the lead module's patterns

Everything learned on leads was applied to projects on 2026-09-15. The four
rules, and what they cost here:

- **No browser dialogs.** Fourteen were left: a `window.prompt` for the reason a
  playbook is stopped, another in `PlaybooksPanel`, a `prompt`-then-`alert` pair
  in `SubPhaseDetailPanel` that could only tell somebody off for an empty answer
  *after* closing the box they typed it in, and eleven `alert()`s in that same
  panel - several carrying the server's own refusal, which is the last thing
  that belongs in an unstyled OS box.
- **`usePrompt()`** (`components/ui/PromptDialog`) is new and is the third of
  the set, beside `useConfirm` and `Toast`. Promise-based like `useConfirm`:
  resolves the trimmed string, or `null` when cancelled. It enforces `required`
  itself, so there is no second rejection to write. Deliberately not folded into
  `ConfirmDialog` - a dialog that sometimes has an input and sometimes does not
  is worse than two components.
- **An action refreshes what it changed.** `fetchProject` now takes
  `{ quiet: true }`, and nine post-action call sites use it. Only the mount call
  still blanks the page, which is correct - there is nothing to look at yet.
- **Read `json.error` on a failure.** Applies to every phase route too; they
  answer with `error` or `reason` and both are now shown.

### Which playbook drives a project is decided on the Plan tab

`PlaybooksPanel` moved off the project's Tasks tab. Two projects looked like
different products with nothing explaining why: one has an active run so its
Plan tab is the task table with a Stop control, the other has six native phases
and got `ManagementTab` with no playbook controls at all - and the panel that
starts one was on a different tab.

It now sits on the Plan tab and only when there is no active run, so stopping a
playbook makes it reappear and "stop this and use a different one" is one flow
in one place. This does **not** unify the two engines; a native-phase project
still renders `ManagementTab` and genuinely looks different. What changed is
that the difference is legible and actionable.

### Revising a quotation is not lead-specific

`useReviseQuotation` (`lib/quotations/use-revise-quotation`) is shared by the
lead and project pages. Both tabs already rendered the same
`QuotationTableReusable`, which has accepted `onReviseQuotation` all along - the
project page simply passed nothing, so the button never rendered. A price is
renegotiated during delivery as much as before it.

### Payments is not on the project page

Removed 2026-09-15. A project's delivery team works there, and what the client
has paid is not theirs to see; a permission gate still put the tab in front of
them while they were looking at delivery. `PaymentsTab` and
`/api/projects/[id]/payment-milestones` are kept for a finance module.

Still visible and deliberately not part of that change: `contract_value` on the
Overview tab, and prices on the Quotations tab. Both are commercial rather than
payment records.

### Project reports carry no money at all, and share the sales report's furniture

`GET /api/projects/reports` answers delivery questions only. It does not gather
financial figures and **does not even select `contract_value` or `actual_cost`** -
a figure never fetched cannot be leaked by a later change to the response shape.
This replaced a per-role gate on 2026-09-15: money on a project report is a
finance-module question, and a report must not become the way to read figures the
product has decided not to show. `projectAccess` still decides scope, so a
`view_own` holder gets a report about their own projects.

The delivery band is first and widest because that is who opens the page: open,
overdue, unowned and undated tasks, late work gathered by project with the worst
delay named, and who is carrying what. Assignee names come from
`tenant_directory` - `users` would have named one person.

**`components/reports` is the shared furniture of both report pages** -
`Section`, `Panel`, `Metric`, `StatBar`, `Pill`, `rankTint`, `ageTint`, `money`,
`humanise`, `Icon`/`ICONS`. The two pages were built weeks apart and had drifted
into looking like different products: one with coloured metric chips and bar
rows, the other with plain boxes of numbers. Both import from here now, so
styling one restyles both.

Colour means the same thing on each: **blue** is work in play, **emerald**
finished or won, **amber** slipping, **red** wrong, **violet**/**slate** neutral
counts. Keep that, or the shared components stop being worth sharing.

It also owns the **page shell and the date filter**: both reports are
`PageLayout` + `PageHeader` with breadcrumbs and a basePath, and both put
`RangePresets` in the first `Section`'s `action` slot. `Preset`, `PRESETS`,
`PERIOD_LABEL`, `rangeFor` and `rangeNote` are shared too, so "30 days / 90 days
/ Year to date / All time" means the same window on both.

**The range covers the summary band and nothing else**, on both reports. What
started, finished and got done is a question about a period; what is late or
unowned is a question about today. Each band's heading says which it is, and if
that ever changes the headings have to change with it. Both default to 90 days -
an all-time default flatters a young portfolio and hides whether anything is
moving now - and both say so plainly when the period is empty rather than showing
a row of zeroes.

What belongs in that file is anything whose job is to make a figure legible.
What does not is anything that knows what the figure means - a funnel step and an
overdue project are both `StatBar`.

**Exports go through `components/reports` too** - `downloadCsv` and
`DownloadRow`. Both reports put an Export link in the `PageHeader` and a Download
band last, offering server CSVs for the record sets and client-side CSVs for the
aggregate tables. The aggregates come from what is on screen rather than being
recomputed: the number someone downloads has to be the number they were looking
at, and two implementations of the same figure eventually disagree.

`GET /api/projects/export` takes `report=projects|open|overdue|tasks|overdue-tasks`
and follows two rules harder than the page does, **because a spreadsheet leaves
the building**: it selects no financial columns at all, and it applies the same
`projectAccess` scope - the task reports are narrowed to the caller's own
projects, not to the tenant.

It is gated on **`projects.export`** (Admin, Owner, Project Manager) while the
page needs only `projects.reports`. Design Manager holds the second and not the
first, so they read the report and see no download links; the route refuses them
regardless, because hiding a link is not a control.

Both export routes write a leading `\uFEFF`. Excel reads a UTF-8 CSV as Latin-1
without it and turns every rupee sign and accented name into mojibake.

One piece of remaining drift, deliberately left: the sales report still draws its
funnel, loss reasons, pipeline-by-stage and month-by-month with inline bar markup
rather than `StatBar`. The track classes are identical so they look the same, and
two of the four have shapes `StatBar` does not express (a conversion percentage
inline, two right-hand columns). Migrating half of them would be worse than
either, so if this is done it should be all four plus whatever `StatBar` needs to
carry them.

Lead conversion was dropped from the project report. Sales Reports answers it,
and two pages disagreeing about a win rate is worse than one answering it.

### The project edit dialog is the only way to change a project

Four things were wrong with it at once, found on 2026-09-15 because the project
manager could not be set.

- **`project_manager_id` and `priority` were displayed on the Overview tab and
  editable nowhere.** The PATCH route has accepted both all along -
  `EDITABLE_PROJECT_FIELDS` lists them - so this was purely a missing control.
  It is why both projects on this tenant read "No project manager".
- **`name` and `status` were collected and then dropped.** The dialog's own
  comment says they were moved into it "so one dialog covers the whole record",
  and `handleSaveModal` left them out of the payload, so editing either did
  nothing at all.
- **It ended in `window.location.reload()`** - a full page load to show a changed
  field, throwing away the tab and scroll position. It goes through the page's
  `updateProject`, which PATCHes and refetches quietly.
- **`actual_start_date` was on the table and absent from the `Project` type**, so
  nothing could read it and a project that had started showed no start date.

**Who may be project manager: anyone on the team.** Not only holders of the
Project Manager role. `/api/settings/team/project-managers` filters by that role
and returns one person of three here - an Owner running their own projects could
not be named, which is wrong in a small practice and contradicts the flat
permission model. The dialog uses the team list the page already loads.

### Service and source belong to the lead, and the project shows them read-only

`projects` has no `service_type` and no `lead_source`; they live on the lead, and
`GET /api/projects/[id]` has been returning them on `lead` all along while the
Overview tab showed neither - the first thing anybody asks about a project they
did not sell. `ServiceTypeLabels` was imported into that tab and never used,
which was the tell.

They are read-only there on purpose: the lead owns them, and two editable copies
of "what we sold" is how the two records start disagreeing.

### Extended property details came off the project dialog

Built-up area, super built-up area, bedrooms, bathrooms, balconies, floor,
total floors, facing, furnishing status and parking - 161 lines of form that
**nothing on the project page displayed**. Removed 2026-09-15 along with the ten
form fields and their entries in the PATCH payload. The columns remain on
`properties` for the property module.

### A project edit writes to the timeline

Editing a project left no trace at all - the Timeline tab showed tasks,
documents and meetings while a change of manager, dates or status passed in
silence. `PATCH /api/projects/[id]` now logs two entries through
`logProjectActivity`:

- **`project_updated`** — "Changed: status, project manager, expected end." It is
  scanned, so it lists fields rather than values. The previous values come from
  the pre-update select, which reads the diffable columns for this reason.
- **`note_added`** — carries the note text itself, when the note changed. Two
  entries rather than one because they are read differently: folding a note into
  a field list buries the only part with something to say.

`project_updated` and `note_added` are both real members of
`project_activity_type_enum`, **verified against the live enum**. An invalid value
fails the insert and `logProjectActivity` swallows it, which is exactly how
quotation revisions never reached a lead timeline.

**Notes and Description are required on the edit dialog** because of this: the
note is the line somebody reads later to find out why the dates moved. The cost
is real - a one-field correction needs a sentence with it - and the answer to
that is the timeline being visibly useful, not dropping the rule. The field says
where it ends up, since a required field with no stated purpose reads as an
obstacle.

Eighteen fields are required in total: the twelve a won lead already had to
carry, plus status, category, manager, priority, description and notes.

**Saving has to look like saving.** `EditProjectDetailsModal` has always rendered
"Saving..." and disabled its button off `isSaving` - and `OverviewTab` passed
`isSaving={false}` as a **literal**, so the flag never moved. Pressing Save
Changes looked exactly like pressing nothing for the second the PATCH and refetch
took. The lead page had this right all along: `useLeadDetail` holds the flag and
sets it around the save.

The flag is cleared in a `finally` and the rejection is **not** caught in
`OverviewTab` - the dialog is awaiting that promise and turns a rejection into its
own error line, so swallowing it there would close the dialog on a failed save.

Confirmation is raised on the page, not in the dialog: the dialog has closed by
then, and a save nobody sees confirmed is a save nobody trusts. The page's
`notice` carries its own variant so a success is not painted red.

The Edit button in the page header switches to the Overview tab before opening
the dialog, because the dialog is rendered inside that tab - so closing it always
lands on the overview, looking at what was just changed.

### The Category control was blank because the GET never returned it

`properties.category` was absent from both property selects in
`GET /api/projects/[id]` while the edit dialog read `property.category` to
populate its Category control. So the value saved correctly, came back
`undefined`, showed nothing selected on reopen - and the next save submitted `""`
and cleared what had just been set. A round-trip bug, invisible from either end
alone.

**When adding a field to that dialog, check all three legs**: the payload in
`OverviewTab`, the route's allowlist or column mapping, and the GET's select.
Missing any one of them fails quietly. Verified after this change that all 21
fields the dialog sends are handled - nine on `projects` through
`EDITABLE_PROJECT_FIELDS`, three on `clients`, nine on `properties`.

Warnings from the route are shown, not swallowed: a save can succeed on the
project and fail on its linked property, and silence there is how "property edits
never save" survived.

### Service Type is one field with two names, now called Service Type

`projects.project_category` **is** the lead's `service_type`. The won transition
maps it - `modular` stays modular, everything else becomes `turnkey` - and the
enums are the same list, `project_category_enum` merely adding `hybrid`. The
labels were already identical for all six shared values.

Two names for one thing meant nobody could tell whether the lead's Service Type
had carried over, so the project now calls it **Service Type** everywhere. The
read-only "Service" row that had been added to the Overview tab from the lead is
gone with it: that was the same fact displayed twice under two names on one
screen.

`lead_source` stays read-only from the lead, because there genuinely is no column
for it on `projects`.

### A won lead must name a project manager

Required in `StageTransitionModal` and refused by the transition route, because
the project created from that lead requires one - allowing the conversion to skip
it only defers the problem to whoever opens the project next, and it is why both
projects on this tenant had none.

**Where the check sits matters.** It belongs with the other `missingFields`
pre-conditions, which run before anything is written. The first attempt put it
beside the project creation further down, and by that point the lead has already
been updated to `won` - so refusing there would have left a won lead with no
project and no way to notice.

Skipped when no project is being created: a tenant with
`auto_create_project_on_won` off, or an explicit `skip_project_creation`, has
nothing for a manager to manage.

The picker offers the whole team rather than holders of the Project Manager role,
for the same reason the project's own dialog does - the role-filtered endpoint
returns one person of three here.

### City is required from `qualified` onwards

On the lead modal, in the transition route, and on the project dialog. The project
made from a lead requires a city and the conversion has nowhere else to get one,
so a lead qualified without one produces a project that cannot be saved.

Deliberately not in `newFields`: a lead arriving from a form or a phone call
legitimately has a name and a number and nothing else.

### Three quotations on one converted lead is correct

`LD-202512-001` / `PRJ_20251219_0001` carries `QT-2025-0004 v1` (cancelled),
`QT-2025-0004 v2` (approved - the agreed price) and `PRJ_20251219_2158 v1`. The
third is the **frozen baseline copy** taken at handover; it uses the project's
number prefix because it belongs to the project rather than the pipeline, and it
is approved because it records what was agreed.

Two known oddities, neither harmful:

- **That copy's `baseline_quotation_id` points at itself**, not at
  `QT-2025-0004 v2`. It still marks the row as a baseline, which is what excludes
  it from the one-approved-quotation-per-lead index, but the copy cannot be traced
  to its source.
- **Quotation numbering has four formats in use** - `QT-####-####`,
  `QT-######-####`, `QT-########-###` and the `PRJ_########_####` baseline. The
  scheme has changed more than once and old rows kept their original numbers.

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
- **A plain PostgREST select stops at 1000 rows and says nothing.** `.limit()`
  does not raise that cap. It matters most where figures are computed in
  TypeScript from a whole set: a truncated fetch does not fail, it reports a
  smaller pipeline and a better win rate than the tenant has. The lead
  analytics endpoint pages every unbounded fetch through `pageAll`; its stage
  history is 71 rows for 15 leads, so roughly 200 leads would have reached the
  cap silently.
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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
