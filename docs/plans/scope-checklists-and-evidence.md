# Scope, checklists and evidence

Status: **proposal for discussion** · 2026-09-16 · v1, plain language

Three things came up together at the end of the project-module review, and
they are one idea seen from three sides:

- **Scope list** — what is being done on this project, and *who* is doing
  each part: us, the client, or a vendor.
- **Checklists** — the things a person ticks off. Two kinds: the one the
  person *doing* the work ticks ("done"), and the one somebody *checking*
  the work ticks ("checked").
- **Evidence** — the photos and files the work is supposed to leave behind:
  site measurement photos, daily progress photos, the signed handover sheet.

Nothing here is built. What already exists is marked *(exists)*.

---

## 1. The idea in one paragraph

The **scope list** says what the project contains and who owns each part.
The **playbook** says what steps get it done. Some steps carry a **done
list** the worker ticks and a **check list** a verifier ticks. Any line on
either list can demand a **photo**. Every photo lands in the project's
Documents tab, tagged with the stage, the step and the space it belongs to,
so "show me the site measurement photos for the kitchen" is a filter, not a
search through phones. Nothing is typed twice, and nothing is specific to
interiors — a space is whatever the tenant calls a space, and a checklist is
whatever they write.

## 2. Scope list

### What exists
The Spaces tab *(exists)* is already a scope list: spaces, the components in
each, sizes, and a quality tier. It lives on the property, is shared with the
lead, and the quotation is copied from it once.

### What is missing
Two things:

1. **Who owns each part.** A kitchen is ours; its granite top is supplied by
   the client; the false ceiling is done by an outside contractor. Today the
   tab cannot say this.
2. **Work that is not a space.** Site clearance, civil work, electrical
   rewiring, a lift permission from the society. These are in scope (or
   deliberately out of it) and have no room to hang off.

### Proposal
- Add **Done by** to every scope row — *Us / Client / Vendor / Not in
  scope* — on both a space and a component inside it. Vendor rows name the
  vendor. (One column, `scope_owner`, plus an optional vendor name.)
- Allow **"Other work"** rows that are neither a space nor a component
  (`site clearance`, `civil work`). The table already permits a row with
  neither type set; the tab needs a section for them.
- Group the tab by owner when asked: **Our scope · Client's scope · Vendor
  scope · Excluded**. That grouping is the document the client signs, and
  the reason a later "that was never in scope" argument is short.
- **Client and vendor rows feed "Waiting on others."** A client-supplied
  granite top has an expected date; that is an ask, and it belongs in the
  same list the kick-off already builds. Not automatic at first — a button
  on the row: *Add to waiting on*.

What this deliberately does **not** do: touch the quotation. The quotation
is the priced copy and stays independent, as decided.

## 3. Checklists

### What exists
A playbook step of type **checklist** *(exists)* carries a list of lines;
starting the run turns each line into a completion requirement the step
cannot finish without. Anyone who may edit the task can tick them. There is
one list per step and no idea of *who* should be ticking.

### What is missing
- **Two lists, two people.** A site supervisor ticks "wardrobe carcass
  fixed, level checked, edges banded". Somebody else — the designer, the
  PM, a QA person — then ticks "carcass plumb, gaps under 2 mm, no visible
  screws". The first says *I did it*; the second says *I checked it*. One
  list cannot carry both meanings.
- **Reuse.** The same carpentry QA list applies to every wardrobe on every
  project; today it would be retyped into every playbook step.
- **Evidence per line.** "Photograph each wall" should not be tickable
  without a photo.
- **A phone.** This is the screen the site team actually needs: a list of
  ticks with a camera button on each.

### Proposal

**Checklist templates in Settings** (tenant-owned, beside Playbooks and
Delay reasons). A template has a name and lines. Each line has:

| Field | Meaning |
|---|---|
| Label | "Level checked" |
| Kind | **Done** (the worker ticks) or **Check** (a verifier ticks) |
| Needs photo | Cannot be ticked without one attached |
| Needs note | Cannot be ticked without a sentence |
| One per space | Repeats once for every space in the project's scope — "Photograph each wall" becomes five lines on a five-room project |

**A playbook step names its lists.** In the playbook editor, beside *Done
by / Milestone / Usual delay*, a step picks a **done list** and optionally a
**check list** from the templates. At run time the lines become the step's
requirements, exactly as checklist steps work today — the same table, one
new column saying which kind each line is.

**Who ticks what.**
- Done lines: the step's assignee, or anyone who may edit the task.
- Check lines: anyone holding a new permission **`tasks.verify`**. A step
  may additionally name a role ("checked by: Designer"), which narrows it.
  This follows the flat model — a permission, not a hierarchy.
- The record shows *who* ticked and *when*, on every line. If the same
  person ticked both lists, the step says so in plain words. A tenant
  setting can forbid that outright; the default only shows it.

**What blocks completion.**
- Every **done** line must be ticked before the step can complete. (Today's
  rule, unchanged.)
- A **check** line can **pass, fail** or be marked **n/a**. A fail keeps the
  step open, shows in red on the row with the verifier's note, and is what
  the worker fixes; the verifier then re-checks. The step completes when
  every check line passes or is n/a.
- A step whose check list is empty behaves exactly as it does now.

**Where it shows.**
- The task page grows two lists under Requirements *(exists)*: **Done** and
  **Checked**, each with its ticks, names and times.
- The Plan tab row shows "4/7 done · 2/5 checked" and turns the row's
  Complete off until both are satisfied — the gate already does this; the
  count is new.
- A phone view later: one step, its lines, a camera on each. The data model
  is the same; this is why the model should be right first.

## 4. Evidence

### What exists *(since today)*
A file attached to a step is mirrored into the project's Documents tab —
same file, category **photo** for images and **reference** otherwise, tagged
`step: Site Measurement`, `stage: 2D Design` and `playbook`. Deleting the
attachment removes it from Documents. This is live for every project.

### What is missing
- **Photos per space.** "Site measurement photos for the kitchen" needs a
  `space:` tag. A checklist line marked *one per space* knows its space and
  tags the photo with it; that covers measurement, snagging and handover
  photos without any new upload screen.
- **Daily progress photos.** These are not a step. They are a **site log**:
  a dated entry per project with photos and a line of text, posted by
  whoever is on site. Shown on the Timeline as "Site log · 16 Sep · 4
  photos", and in Documents as photos tagged `site log: 16 Sep`. From a
  phone this is the second screen the site team needs, after the checklist.
- **Expected evidence per scope row.** A client-scope granite top is
  evidenced by a delivery photo; a vendor false ceiling by a completion
  photo. Rather than a new mechanism, the scope row can name the checklist
  template that closes it — so scope, step and evidence are one chain.

### What this gives the PM and the client
Filter Documents by `stage`, `step`, `space` or `site log` and the answer
is a set of dated photos with names on them. When a client says "the
measurement was wrong", the photo from that day, of that wall, ticked by
that person, is a click away. That is the same use the delay log has: not
blame, but a record nobody has to argue about.

## 5. Suggested order

1. **Scope owner** on the Spaces tab + Other-work rows + grouping. Small;
   one column and a section.
2. **Checklist templates** in Settings, and the `kind` / `needs photo` /
   `one per space` fields on requirements. The playbook step picks a
   template.
3. **`tasks.verify`** permission and the check-list gate in
   `can_complete_task`.
4. **Space tag** on evidence from one-per-space lines.
5. **Site log** — entry, photos, Timeline and Documents.
6. Phone view of steps 2 and 5 — later, and separately.

## 6. Decisions needed

| # | Question | Suggested answer |
|---|---|---|
| 1 | Who may tick a check line? | Anyone with `tasks.verify`; a step may narrow it to a role. |
| 2 | May the same person tick both lists? | Yes by default, and the step says so in words; a tenant setting to forbid. |
| 3 | Does a failed check block completion? | Yes — a step with a check list completes only when every line passes or is n/a. |
| 4 | Scope owner on spaces, components, or both? | Both. A kitchen is ours; its counter top is the client's. |
| 5 | Site log now, or Milestone 2? | Milestone 2 unless the site team is about to start using the app from phones. |
| 6 | Should a client-scope row automatically become a "waiting on" ask? | Not automatically; a button on the row. Automatic asks on every client-supplied item would drown the list. |

---

## Appendix — for whoever builds it

- `property_scope_items`: add `scope_owner text check (in us, client, vendor, excluded)` default `us`, `scope_vendor_name text`, and allow rows with neither `space_type_id` nor `component_type_id` to render under "Other work". The `space_xor_component` constraint already permits it.
- New table `checklist_templates (id, tenant_id, name, is_active)` and `checklist_template_lines (template_id, label, kind done|check, needs_photo, needs_note, per_space, display_order)`. RLS by tenant; no shipped defaults at first.
- `procedure_step_definitions`: `done_checklist_id`, `check_checklist_id` (nullable FKs, carried by `revise_playbook` — enumerate them, it copies columns by name). Keep `checklist_items` for the existing inline list; a step may use either, and the editor offers the template first.
- `task_completion_requirements`: add `kind text default 'done'`, `needs_photo bool`, `needs_note bool`, `scope_item_id uuid null`, `verdict text null (pass|fail|na)`, `note text`. `create_step_requirements` expands templates, repeating per-space lines once per top-level scope row.
- `can_complete_task`: unchanged for done lines; for check lines require `verdict in (pass, na)`.
- `sign_off_requirement`: for a `check` line require `tasks.verify` (checked in the route — the function runs as the admin client and cannot see the caller); refuse a tick on a `needs_photo` line with no attachment referencing it (`task_attachments.requirement_id`, new nullable FK). The evidence mirror adds `space: <name>` when `scope_item_id` is set and `check: <label>` for the line.
- `site_log_entries (id, tenant_id, project_id, log_date, note, created_by)` with photos as `task_attachments`-free `documents` rows tagged `site log: <date>`; a `project_activities` row of a new type `site_log` per entry.
- Permission `tasks.verify` seeded to Owner, Admin, Manager, Project Manager, Designer, Senior Designer; regenerate `roles-permissions.ts`.
