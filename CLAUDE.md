# SoftInterio — working notes

Multi-tenant interior-design ERP. Next.js 16 / React 19 / TypeScript / Tailwind v4 / Supabase.

The long-term shape: a won lead carries into a project, then into project
management, then into a client-facing portal with controlled access. Built for
more than one vertical — interior designers today, architects later — so
nothing should hard-code "rooms and wardrobes" as the only possible scope.

## Decisions that are easy to undo by accident

These were argued about and settled. Each one has a reason that is not obvious
from the code alone, so please read before "fixing" them.

### Scope and quotations stay independent - the quotation pulls, on demand
The Scope tab (`property_scope_items`) is read into a quotation when the
quotation is created and whenever somebody presses **Bring in from scope**
on a draft; the two never sync. Revisited 2026-09-18 with the user and
sharpened rather than reversed: a quotation is a commercial document and
must not mutate because someone edited a room list, so nothing ever changes
or removes a quotation line - `copyScopeToQuotation` **adds only what is
missing**, and rows whose Done-by is client, vendor or excluded are never
brought in. Every quotation on a lead or project starts this way (the
create dialog no longer asks); a revision copies the priced version and the
button adds what the scope gained since.

"Already there" is judged by `metadata.scope_item_id` on `quotation_spaces`
and `quotation_components` - a provenance pointer written at copy time,
round-tripped by the builder's save and the PATCH, and read by nothing but
that function - and, for rows older than the pointer, by type and name. It
is deliberately not a foreign key. `metadata.measurement_status` rides
along so the builder can mark a space "rough size" until the scope row is
confirmed on site. Still absent, still on purpose: no "scope changed, review
the quotation" prompt, no deactivation tier.

### The scope tells the quotation it has moved - and the quotation tells back

Built 2026-09-21, the second direction added 2026-09-22 after the first
real quotation.

`lib/quotations/scope-drift.ts` reads, for one quotation, how far the
scope has moved: **additions** (a dry run of `copyScopeToQuotation`),
**resized** components, **dropped** lines (no longer chosen), **not_ours**,
**not_in_scope** - lines priced here that the Scope Sheet does not list,
which is the quotation being *ahead* of the scope - and the last history
stamp. `POST /api/quotations/[id]/to-scope` ("Add to the scope") writes
those back as chosen items; like the pull the other way it only ever adds.

**A line carries its provenance through the builder.** `metadata.
scope_item_id` and `auto` are mapped onto the `LineItem` and written back
on save - the save used to build a fresh metadata object, so opening the
builder once wiped every line's link to the Scope Sheet and a quotation
read as full of items "not in the scope" that the scope had produced.
An item the offer marks `auto` is never a builder addition, even though
no scope row names it.

### A measurement nobody typed is shown, and stops the stage

Built 2026-09-22 after the first real quotation carried nine unmeasured
components and eight lines priced at nothing.

**Only a chosen item answers a question.** Both `unaskedByComponent` and the
options route counted any `choice_status` as answered, and a second preference
is not an answer - a question holding only one produced no line. Found
reviewing LD-202609-005 before it moved (2026-09-24): a 75 sqft TV unit was
about to be quoted with one line of four - no hinges, no handles - while the
sheet read "nothing left to ask". Second preferences went the same day (see
below); the filter stays, because a counted row with no choice is not an
answer either.

`lib/scope/measured.ts` `missingMeasures(row, rule)` is the one answer to
"what has this component not been measured for": the rule's fields that
have no value on the row, where width / height / length come from the
row's own size columns and a field with a **default** counts as filled.
Read in three places - the Scope tab's row (an amber "2 not measured"
button that opens the Scope Sheet), the Scope Sheet's Measurements (amber
label and box per blank, and "not measured" on the closed component), and
`scopeReadiness`, which now refuses **proposal_discussion** until every
component of ours whose type has a rule is measured.

**A rule field can carry a `default`, and it may be a formula**
(`CostingField.default`, the Default column on the component's page):
a **number** in the row's own unit (a base unit 850 high, 600 deep; `0`
meaning "none unless somebody says") or a **formula** over the fields
above it, in feet, like a quantity - `ceil(width / 2)` is one door per
two feet of width, which is what the trade fits.

**A derived number can be overruled, and says so.** `quantify` reads an
override from `measures` under `over:<quantity>` (`OVERRIDE_PREFIX`, a key no
field can carry because a field key is an identifier), so it rides along with
the measurements through `splitMeasures`, the PATCH and the jsonb column with
no second store - and because the sheet, the builder's totals and
`copyScopeToQuotation` all read `quantify`, every one of them honours it for
free. The rule is still evaluated: `ruled` carries what it said and
`overridden` which keys were changed, so the Scope Sheet shows the number in
amber with **rule says 30** beside it, one press to put it back. A tall pair
of doors takes six hinges whatever the formula says (2026-09-23).

Two behaviours worth keeping: an override equal to the rule's own answer is
**not** stored, or it would sit in amber for ever; and an override **carries
into whatever builds on it** - overruling hinges per door moves the hinge
total, and the total is not itself marked, because nobody typed it. Only what
a person changed is shown as changed.

**A default may invent a number, but only where the trade agrees.** Shelves
now default to `ceil(height / 1.5)` - a shelf every eighteen inches, six on a
2700 mm wardrobe (`20260923270000`) - because "most customers do ask for
internals with a standard shelf height of 1-1.5 feet", so quoting every
wardrobe with none is as wrong as inventing them. Exposed ends, blind corners
and the loft height stay 0: those are nothing until somebody sees the room.
The test is whether the trade would answer the same way without asking the
customer.

**A field with a default is not shown.** The Scope Sheet asks for the size
and anything the rule cannot work out for itself; everything else is one
line - "Taking depth 600 mm · shutters 8 · exposed sides 0 · *adjust*" -
which opens the boxes only when somebody wants to change them, and opens
itself when a value has been typed before. Pre-filling them was not enough:
"I still see a lot of text boxes ... I thought you removed them"
(2026-09-23).

**A field with a default is also never counted as missing.** That is the whole point:
after `20260923090000` every seeded rule defaults everything a trade
constant or the size can answer, and a wardrobe asks for nothing beyond
the width and height the Scope list already holds. Eight fields are still
asked for across all 28 types, all of them areas nobody can derive - a
paintable area, a ceiling area, the floor to protect. Before it, twenty-one
components on one lead read "not measured".

So a default must be a value the trade agrees on, not a guess, and **0
where the honest answer is "only if somebody says so"** - exposed sides,
blind corners, shelves and a wardrobe's loft height are all 0, because
defaulting them to 1 invents money. The hints say how the awkward ones are
counted: exposed sides are "ends you can see from the room - a run between
two walls is 0, one open end 1, an island 2", blind corners "right-angle
turns in this run - an L-shaped kitchen has 1, a U-shaped one 2".

### One answer per question. The second preference is gone

Retired 2026-09-24 (`20260924140000`), four days after it was built, and the
reason is the product's own aim: "I want to build a tool that is simple to
understand and reduce as much confusion as possible ... most users would be in
the unorganised sector and they might hate the complexity". A chip with three
states - tap for ①, tap again and it slides to ②, tap again to clear - is a
concept a seller has to be taught, and most of the people this is for will
never be taught anything.

It bought exactly one thing: **Option 2**, a second quotation priced from the
alternatives. **Duplicate + Reprice does that better** - on a document that
exists and has been checked, by whoever is pricing, and Reprice swaps any item
for any other in its category rather than only a tier, so it covers the by-kind
cases the grade ladder cannot.

**Duplicate had no button until now.** `POST /api/quotations/[id]/duplicate`
has copied a quotation's whole tree to a fresh draft under a new number since
before the baseline and nothing in `src/` called it, so the replacement for
Option 2 was unreachable while being named as the reason Option 2 could go. It
is now in the builder's header and in the summary page's actions - both, for
the reason Option 2 taught: a draft opens straight into the builder and never
shows the summary. **Duplicate is not Revise**, and the difference is the
point: a revision is another version of the same price and supersedes it when
approved; a duplicate is a second offer standing beside it, with its own
number.

So the tap is now what anyone would expect: **choose, choose again, or clear**.
What did not change is the rule that made it safe to remove - one answer per
question, kept by the same `trg_scope_choice_alternatives`; only the demotion
went, and an answer that is replaced is deleted rather than kept. 86 second
preferences were removed, a CHECK pins `choice_status` to `p1` or null, and
`quotations.scope_preference` is **kept as history** so the one Option 2 ever
built still explains itself with its **Alternative** chip. Nothing sets `p2`
any more.

Four days of scaffolding went with it: the ②/① glyphs and the cycle in
`ScopeItemPanel`, the Option 2 button and its `scope-drift` read in the
builder and on the summary page, the `preference` option on
`copyScopeToQuotation`, `second_preferences` on the drift read, and the
"record as the alternative" tick on Apply grade. **Do not rebuild any of it
without a real case asking** - and if a second document is wanted, that case
is Duplicate + Reprice.

### "Add to Scope Sheet" now works, and had never worked once

The reverse direction - a line priced in the builder that the Scope Sheet does
not list - was reported correctly and could not be acted on. Three faults in a
row, found 2026-09-24 when a Study Table added to a quotation showed up in the
notice with no way to put it on the sheet:

1. **The button was hidden in the case that actually happens.** It rendered only
   when `not_in_scope` held a line whose **component** already had a scope row -
   and adding a whole component in the builder creates no scope row, so the
   notice listed the lines and offered nothing. It now shows whenever anything
   priced here is off the sheet.
2. **`to-scope` filtered those lines out**, for the same reason, and answered
   "nothing could be matched to a room on the sheet".
3. **And the insert could never have succeeded anyway.**
   `onConflict: "parent_id,cost_item_id"` names
   `property_scope_items_one_choice`, which is a **partial** index
   (`WHERE cost_item_id IS NOT NULL`) - and PostgREST cannot infer a partial
   index, so every call came back "there is no unique or exclusion constraint
   matching the ON CONFLICT specification". **The same trap as
   `notifications.dedupe_key`**, written up in this file and then walked into
   again. It reads the existing pairs and filters now, which also lets the reply
   distinguish "added" from "already there".

**It creates the component too.** Where the SPACE is on the sheet, the missing
component is created under it from the quotation's own name, type, size **and
`metadata.measures`** - the measures matter, or the row reports itself as
"resized" the instant it exists, which is a silly thing to be told - and the
quotation component gets `metadata.scope_item_id` written back, the same
provenance pointer the pull the other way uses. Where the space is missing too
there is nowhere to put it, and the reply says so: *"The room itself is not on the
Scope Sheet yet (…). Add the room there first."*

`component_ids` in the body narrows it to named components. Nothing sends it yet -
the notice sweeps everything, and reports what it did - but it exists so an
offer attached to one component does not have to add the rest.

**The Scope tab still shows nothing about drift, on purpose.** Asked for on
2026-09-24 and argued down: a line added in the builder is *normal*, not an
error - the builder is the editor - so an alert there would be on most of the
time, which is how the two false alarms above earned their reputation. The
divergence is surfaced where it is created and where it can be fixed, on the
quotation, which is also the screen that has to be defensible.

### A read that swallows its error can report the opposite of the truth

`scopeDrift` destructures `data` alone from six reads. When one of them named a
column that does not exist - `quotation_components.measurement_unit`, which lives
in `metadata` - the spaces came back null, the loop never ran, and the notice
**confidently reported no drift at all**. For a thing whose entire job is to
report a difference, that is the worst available failure: a quotation with
nothing to say and a quotation that could not be read looked identical.

The spaces read now throws on error. It is the third instance of this shape in
two days - `lead_family_members` (a table that never existed), the `users!` embed
whose constraint was missing, and this - so the rule is worth stating plainly:
**where a silent empty result is indistinguishable from a real answer, check the
error.**

### The customer summary is the scope as a page, and it carries no price

`/scope-summary/[propertyId]?lead=|project=` (2026-09-21, "Customer
summary" on the Scope tab, opens in a new tab, prints or saves as PDF from
the browser). Outside `/dashboard` so it has no app chrome; still behind
sign-in and `leads.view`. `GET /api/properties/[id]/scope/summary` shapes
it: room by room, size, the pictures they liked (starred first, uploaded
references and pinned library entries, up to four), the components with
their chosen finishes by category and tier word, what the client is
bringing, and the thread entries marked as decisions. **No prices, no notes
that are not decisions, no excluded rows.**
It stores nothing - the document a seller sends the evening after the
showroom visit so the customer sees the conversation was heard. The
customer is read from the lead or project (properties carry no client).

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

### Scope is the tab; a space is a row in it

Renamed from "Spaces" on 2026-09-18 (`docs/plans/scope.md` is the plan and
the decisions). **Scope** is what we are doing for this customer: the brief
(floor plan, services wanted, the first conversation's notes - one
`property_scope_brief` row per property) above the rows, and the rows are
still spaces and components in `property_scope_items`. `ScopeTab` takes the
lead or project it is viewed from, because the floor plan is an ordinary
Document (category `floor_plan`) filed on that entity.

**Presets** (`scope_presets`, Settings → Catalogue → Presets - a tab of
the Catalogue page since 2026-09-22, `PresetEditor` for the dialog; the old
`/catalogue/presets` address forwards to `?tab=presets`) replaced the
quick starts that were hard-coded by slug. A preset is spaces × counts,
each optionally naming its components (null = whatever declares it belongs
in that space type - the add dialog's own default). Curated, never saved
from a lead. The empty scope shows them as cards that open the add dialog
filled in; the dialog's chips offer them too. Five were seeded per tenant
from the old quick starts.

**A preset says which homes it is for** (`20260923220000`). It used to be
found by NAME - `presetMatches()` stripped the spaces and looked for "3bhk"
inside it - so the link between the Configuration dropdown and the preset
was a convention nobody was told about, and renaming "3 BHK" to "3 Bedroom
Flat" silently stopped qualification laying a scope down. `configurations`
(text[], the dropdown's own values) and `property_types` (optional, which is
how a Villa beats the plain 4 BHK) are now chosen in the preset editor and
shown as chips on the Presets tab. `pickPreset()` takes a preset naming this
property type first, then one naming the configuration, then - **only for a
preset that declares neither** - the old name match, so a tenant who never
opens the editor keeps working; ties go to the lower `display_order`. Eight
tests cover it. The shipped presets were backfilled from their names, so
nothing changed on the day. Of the seven configurations, **studio**,
**5bhk_plus** and **other** matched nothing and laid down an empty scope in
silence; Studio and 5+ BHK were seeded (`20260923210000`, per tenant, only
where absent) and `other` matches nothing on purpose. Neither outcome is
shrugged at any more - `applyPresetForConfiguration` returns a `reason`
(`applied` / `scope_not_empty` / `no_preset`). For `no_preset` the
transition writes a timeline entry and the stage dialog says where to add
one; for `scope_not_empty` the dialog names what was left alone - "already
has 8 spaces, so the 3 BHK preset was not laid down - your scope is
untouched" - which is the only way the guarantee is visible. **A scope built
before qualifying is never recreated**, and there is no route to a preset
once any row exists: the empty-state cards and the add dialog's chips both
render on `items.length === 0` only, and the transition counts rows first.
From Requirement discussion on, removal is guarded too - the last space, and
the last component of a space of ours, cannot be deleted.

**What lands in each room has two levers.** A preset row's
`component_type_ids` wins where it is set; where it is null the room takes
**every active component type declaring that space**
(`component_types.applicable_space_types`, the "Belongs in these spaces"
control). The five shipped presets left it null everywhere, so a 3 BHK
bedroom arrived with all eight components that declare Bedroom - both
wardrobe kinds at once - while a Balcony arrived empty because nothing
declares it. The tenant chose per-space lists on 2026-09-23 and a bedroom is
now a wardrobe and a dressing table. Keep the two levers distinct: the
preset is "what we usually quote in this kind of home", the declaration is
"where this component can go at all", and the add dialog reads the second.

**Qualifying a lead needs the configuration and the floor plan**, and lays
the scope down (2026-09-18, third round). `properties.configuration`
(studio · 1bhk … 5bhk_plus · other) is a property fact the lead form never
held - its "subtype" is gated/non-gated. Both are ordinary lead-form
fields (`components/leads/ConfigurationAndPlanFields`): optional on the
create form, starred from Qualified on the edit dialog, asked by the stage
dialog when moving to `qualified` - the plan uploads right there - and the
transition route refuses without them, and on success
`applyPresetForConfiguration` lays the matching preset onto an **empty**
scope so Requirement discussion opens on rooms. The tab is the spaces
list with a Saved indicator in the header (everything saves as you go) -
no sections: each row's own thread is the conversation, and the lead's
Notes tab is for anything not about a particular space; the floor plan and configuration are edited on the lead's edit
dialog, not here. Moving to `proposal_discussion` needs every space of
ours to have a rough size **and at least one component**
(`lib/scope/readiness.ts`, `SCOPE_NOT_READY` - shown only when the move is
tried, not as a standing strip). From Requirement discussion on, the DELETE
route refuses to remove the last space or the last component of a space
of ours - mark the space client/excluded instead. A lead past New cannot be
unassigned (edit dialog and PATCH). There is no brief any more: services wanted are what
the spaces contain, finishes live on the space or component, budget and
timeline are the lead's.

**The scope is the quotation's tree: Space → Component → Cost item**
(2026-09-18, decided with the user). A cost item is a third kind of row in
`property_scope_items` - `cost_item_id` set, hanging off its component,
`choice_status` `p1` when it is the answer, one row per item per component -
holding WHICH items, never a rate, a quantity or a total; the quotation
holds how much. The options a component offers are the cost items the
tenant's quotation templates list for its component type
(`…/scope/[itemId]/options`), grouped by cost category - nothing new to
configure. `copyScopeToQuotation` turns **chosen** items (that the client
does not keep) into line items under the matched component, sized from it at
the catalogue's rate (the builder's own arithmetic, from
`components/quotations/types`). The tier shows on each option as a word so the seller can steer to the
budget. Done-by per item (`scope_owner` on the row) is shown on a project
only - it is decided there, kept from the sale. An item priced per piece (nos/set…) and not
quantified by a costing rule takes a count on the sheet (`choice_quantity`,
the "× n" stepper) - two wooden drawers, one tandem box are three rows with
their own counts - and the copy makes a line of that many. The list row
shows the component's name and nothing else - a chip of chosen items was
tried and read as clutter (2026-09-19) - and never lists cost-item rows
themselves; the Scope Sheet is where choices are seen. The finish chips
and the "preferred finish" ordering in the builder went with this; a finish
is now one option category among the others.

### A grade answers every graded question at once

Built 2026-09-23, step one of "blanket first, refine later". **Apply a
grade** on the Scope header (the whole property) or in a Scope Sheet (that
room) answers every graded question at that tier -
Budget · Standard · Premium · Luxury, or whatever words the tenant's ladder
uses, since `quality_tier` is text. **It needs no configuration at all**: the
tiers are already on the cost items.

`lib/scope/grade.ts` `gradeChoices()` plans it and
`POST /api/properties/[id]/scope/apply-grade` writes it. On this tenant's
biggest scope - 42 components - Standard answers **104 questions and leaves
76**, because a grade can only answer a *graded family*.

**What it cannot answer is the point, and is reported.** A wardrobe's shutter
finish is laminate or acrylic or veneer - chosen by kind, not grade - and at
600 to 1,600 a square foot it is the most expensive line on the component.
Across the catalogue a grade answers 61 of 99 questions. So the result says
"12 answered · 3 already answered, left alone · 5 still to ask - those are
chosen by kind, not by grade", and a seller cannot walk away thinking the
room is finished.

Three rules it keeps:

- **It fills only what is unanswered.** A blanket is a starting point, not a
  correction, which is what makes it safe to press twice - the same rule as
  `copyScopeToQuotation`, which only ever adds. `replace: true` exists for
  the deliberate case and nothing sends it yet.
- **A lone yes/no is never set.** One optional item in its category is a
  question, not a ladder, and pressing Standard must not quietly add the
  lighting nobody asked for.
- **The one-answer-per-question trigger does the rest**, so a grade applied
  over an existing answer replaces it rather than leaving two standing.

### A package is what the business sells as one thing

Step two, built the same day. `scope_packages` + `scope_package_items`
(`20260924090000`): one row per answer - *in a Wardrobe - Openable, choose
Carcass - Standard* - with `quantity` null for an answer to a question and a
number for an accessory given as standard. Settings → Catalogue →
**Packages**, one editor page per package asking exactly the questions the
Scope Sheet asks, through `shapeOptions`, so the two cannot disagree about
what is a question, what is counted and what prices itself.

**Seeded from a tier on creation**, which is the difference between ten
minutes and an afternoon: the grade answers every graded family (68 answers
across this catalogue) and the tenant hand-picks only the by-kind ones. On a
probe, "Standard" plus three hand-picks - a laminate finish, a hanging rod, two
tandem drawers - took a wardrobe to **zero questions left**, and 115 answers
across a 42-component home against the grade's 104.

**A grade and a package write through one path.**
`lib/scope/apply-choices.ts` holds what happens (which components are in
range, what is already answered, what is written, what could not be
answered); `grade.ts` works its list out from `quality_tier` and
`package.ts` reads it from the table. So the two rules live once: only what
is unanswered changes, and what could not be answered is reported. A package
entry the component type no longer offers is dropped rather than written - a
menu is pruned far more often than a package is revisited.

**`scope_presets.package_id` closes the loop.** Qualifying a lead lays the
rooms down *and* answers them, so Requirement discussion opens on a scope to
review rather than one to fill in - which was the whole point. It fails
quietly, like the playbook auto-start: a scope without its answers is a
button to press, a qualification that rolled back is not. The stage dialog
says "12 spaces from the 3 BHK preset, with 47 questions already answered".

No rates anywhere in a package. It says WHICH items; the price stays on the
item, or a package quietly becomes a second price list.

**A grade is not a package, and the first one made proved it.** A tenant's
first attempt was named "My Budget" and held 68 **Premium** answers - the
seed-from-a-grade shortcut and nothing else, so it did exactly what the
Apply-a-grade button already does for free. The gap is the money:

    a wardrobe 3600 x 2400, 93 sqft of front
      graded part   Budget 74,850 · Standard 97,350 · Premium 1,30,350 · Luxury 1,71,600
      the finish    Laminate 55,800 ... Veneer 1,48,800

**The finish is about half the wardrobe and no grade touches it**, because a
finish is a kind and not a level. Four packages were seeded
(`20260924100000`) that each answer three things - the graded families at
their level, the by-kind questions that carry the money (finish, countertop),
and the accessories given as standard - and each takes a wardrobe to **zero
questions still to ask**: Budget 1,31,850 · Standard 1,65,400 · Premium
2,49,400 · Luxury 3,37,201. Every preset answers with **Standard** unless the
tenant says otherwise.

Either blanket could briefly be laid down as a second preference, so one
customer could be shown two levels at once. That went with the second
preference itself on 2026-09-24 - **two levels are now two documents**,
made with Duplicate + Reprice on the quotation. See "One answer per
question" above.

**"Start again" empties the scope**, because picking the wrong preset used to
mean deleting rooms one at a time and the row delete correctly refuses to
remove the last space. `POST /api/properties/[id]/scope/clear` is **refused
once a quotation exists** (`quotation_exists`) - not by stage: a quotation is
built from the scope and then frozen, so emptying the scope underneath one
leaves a priced document whose every line reads "not in the scope". After a
price has been given, changing what is built is a variation. Documents filed
against a room are left alone - the pictures a customer sent are theirs, not
the room list's.

**A package cannot record a "no", and that shapes what belongs in one.**
There is no way to say *decline this question*, so profile lighting below
Premium, panelling below Luxury, appliances and the specialised pull-outs are
deliberately left unanswered and show as still-to-ask. Under-selling by
default is a conversation; over-selling by default is a quotation nobody can
defend. If declining ever needs to be expressible, that is a real feature and
not a workaround.

**The Scope Sheet asks questions, not for data** (2026-09-23: "let us just
have sort of questionnaire thing so that the seller can collect as much
information as possible"). Same model, nothing new stored - the options
ARE the answers:

- **A decision reads as a question**: "Which carcass?" with the items as
  answers and **Not needed** as one of them, so declining is recorded
  rather than left blank. **The wording is the category's**
  (`quotation_cost_item_categories.question`, a field on the Categories
  tab; blank falls back to "Which <name>?"), because "Which shutters by
  finish?" is a column heading, not a question.
- **Two categories can answer one question.** A category naming a
  `decision` is merged with the others naming it: handles and profiles are
  both **"How do the doors open?"**, so choosing a profile demotes the
  handle and the seller is asked the question once instead of answering
  two unrelated ones or neither. The decision beats the category in
  `shapeOptions`'s group key and in `scope_item_group_key`, so the sheet,
  the copy and the trigger agree.
- **One question per DECISION, not per category.** A category can hold two
  - a kitchen's shutter finishes and its exposed side finish are both
  "Shutters by Finish" but are priced per different quantities, and
  grouping by category put the exposed side among the finishes to choose
  between.
- **A lone optional item is yes or no**: "Wardrobe Sensor Light? No · Yes",
  the count appearing only after Yes.
- **A count with a handful of sensible answers is a question too**: "Any
  blind corners? None · One (L-shaped) · Two (U-shaped)", "Any exposed
  ends? None · One end · Both ends" - the seller never types a number
  whose meaning they have to work out. Other counts stay boxes behind
  "Taking …".

So a wardrobe asks: its size, exposed ends, which carcass, which finish,
which hinges, which handles, lighting yes/no, and a row of internals to
add. Nothing else.

**A decline is an answer, and an unasked question stops the stage**
(2026-09-23). The sheet is a questionnaire, so "we asked, they said no" and
"nobody has asked yet" must be different things - and they were the same
blank. "Not needed" and "No" only cleared the picks, so a wardrobe nobody
had discussed read exactly like one whose customer wanted no lighting, and
the quotation came out a line short with nothing on any screen saying so.

`property_scope_items.declined_decisions` (text[], on the component row)
stores the question declined, keyed `group_key ?? cost_item_id` - the same
key the sheet groups by, so a decision two categories share is declined
once. Text, not a foreign key, for the reason `hold_reason_code` is:
retiring a category must not erase the record that somebody was asked.
**Not needed** is now offered whether or not anything is picked, so it can
be the first tap, and it fills in when it is the answer; answering
afterwards lifts the decline in the same request.

**`lib/scope/questions.ts` is the one rule** - a question is a group of
options that are neither counted nor automatic, plus the lone counted item
a category holds on its own, which the sheet draws as "Sensor light? No ·
Yes". Counted accessories are an "Add:" row, not a question; an automatic
item states itself. `lib/scope/unasked.ts` runs it over a whole property in
one read, and the Scope list's amber **"2 to ask"**, the Scope Sheet's
header, the unanswered question in amber, and `scopeReadiness` all count
through it - so the row, the sheet and the refusal can never disagree.
Proposal discussion now refuses with "Finish the walkthrough - 7 questions
still to ask on …" beside the measurement gate. On this tenant a wardrobe
asks 5, a kitchen base unit 7, a TV unit 8.

**Each space opens out as a Scope Sheet** (`ScopeItemPanel`, the
speech-bubble on the row, or **Walkthrough** from the header with ←/→).
No tabs - a tabbed version with the same four headings at two depths was
tried and read as noise (2026-09-18). The room has its pictures (Documents
with `linked_type = scope_item`, parent-linked to the lead or project so
they sit in its Documents tab, named `Client_Lead_Space_RefN`; library
entries pinned via `scope_item_library_pins`) and a thread; each component
inside it has its options (above), for a client/vendor row what is arriving and by when
(`supplied_detail`, `supplied_expected_by` - never priced), its pictures and
its thread. Threads (`scope_item_comments`) fold behind their counts; an
entry can be a decision, and "make a task" creates one on the lead or
project and keeps `task_id` - that is where rework lives. **The change log
is a trigger** (`trg_property_scope_items_history` →
`property_scope_item_history`, `changed_by = auth.uid()`) and is kept but
not shown; the "reason" field it once had is gone.

Settled with the user, not to be reopened casually: no price on a scope
row; the quotation **pulls** from the scope on demand and only adds what is
missing (rows owned by client/vendor/excluded are never brought in); after
kick-off anyone with project edit may change the scope and every change is
logged; nothing here is customer-facing.

### A customer is several people, and the seller records them

Built 2026-09-24. `partner_contacts` has held name, designation, phone, email,
`is_primary` and notes since Partners was built, and this tenant had **30
partners with exactly 30 contacts** - nobody had ever added a second person.
The reason was a permission: those routes are gated on `partners.edit`, which is
Owner and Admin alone by decision, while the person who actually talks to the
family is **Sales, who holds no `partners.*` key at all**. The only screen was
Settings-adjacent, and nobody working a lead goes there.

**Contacts are now reached through the lead**, on the Client Details block of
its Overview tab, gated on access to the **lead**: `lib/leads/partner-guard.ts`
`requireLeadPartner()` resolves lead -> client -> partner and applies
`canWriteLead`. That is the rule `requireProjectAccess` already follows - access
to the parent proves the right to the child - and it is **narrower** than
`partners.edit`, not wider: it grants nothing about the relationship book as a
whole. Lineage is checked rather than assumed; the `.eq("partner_id", ...)` on
the contact lookup is what stops a caller pairing a lead id they hold with a
contact id they do not.

**`partner_contacts` is the home, not a per-lead table**, because the customer
outlives the lead: the same family reappears on the project, on the next flat,
and eventually on a portal, where people have to hang off the party and not off a
sales record. `/api/partners/match` already searched contact phones for this
reason ("the couple who share a home give either number").

**Two facts, not one.** `is_primary` is who we ring - exactly one, held by a
partial unique index, and that contact cannot be removed (the button is disabled
with the reason rather than hidden). `is_decision_maker` is who signs off, and
any number may hold it. In a family sale they are different people, and which of
the three to get into the room is what closes the deal. Deliberately **one
boolean and no permissions model**: who may approve what is a question for a
portal that does not exist, and inventing the gate now would be the second
preference again.

**`lead_family_members` never existed.** Not in the baseline, not in the
database - and `GET /api/sales/leads/[id]` queried it on every page load,
destructured only `data`, and so swallowed the error and served a permanently
empty list through the hook to nothing at all. A wasted round trip on a page
that already costs six, plus a type, hook state and a response field for a table
nobody created. Retired; `is_decision_maker` is the one idea carried across from
its type. The contacts ride in on the client embed instead
(`client -> partner -> contacts`, two levels, verified), so the page **gained
the people and lost a query**.

Two things found on the way and fixed here: the lead GET re-selected `users` for
a `tenant_id` the guard already held - the fourth instance of that trap - and
the response now carries **`canEdit`**, so the block draws the controls the
server would actually accept rather than offering a `leads.edit_own` holder an
action on somebody else's lead.

There are **two `Client` interfaces**, in `types/leads.ts` and `types/clients.ts`,
and both describe columns `clients` does not have - `contact_person_name/phone/
email/designation`, `company_name`, `gst_number`, `address_line2`, `landmark`,
`locality`. The lead uses the one in `types/leads.ts`. Left alone, but note that
`contact_person_*` quartet: it is a **third** place this codebase tried to record
a second person at a customer, which is the argument for there being one home.

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
the caller's tenant and checks read/write. Every route under
`/api/projects/[id]/...` goes through it.

The lesson that produced it still applies to any child id in a URL: a child
table with no `tenant_id` of its own has to be proved to hang off the project,
or pairing a project id you may open with a child id you may not reads and
writes another business's data. The native phase routes did exactly that until
`requirePhaseLineage()` was added; both went with the engine on 2026-09-15.

### Projects come from won leads unless a tenant opts out
`tenant_settings.allow_direct_project_create` is false by default, so the New
Project button does not appear and `POST /api/projects` answers 403. The normal
route is a won lead, which carries the client, property, quotation and scope
across; a blank form starts with none of that.

It is a tenant setting rather than a `subscription_plan_features` row because
it is a workflow choice each business makes, not something sold by tier — and
because that table is read only to draw plan cards and enforces nothing.

**The unit a business measures in is a tenant default**
(`tenant_settings.default_measurement_unit`, mm / cm / inch / ft, Settings →
Config → Measurement; 2026-09-18). Every new scope row (bulk add, preset on
qualification) and every new quotation component and line item starts on
it - `getDefaultMeasurementUnit()` server side, `useDefaultMeasurementUnit()`
in the builder, cached with the config and dropped when Config saves. Any row
can still be changed. Stored rows keep their own unit; the `|| "mm"`
fallbacks on read are for rows older than units being stored at all.

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

It now also carries `won_amount` into **`projects.contract_value`**. Before
2026-09-07 it did not: `actual_cost` was hardcoded to 0 so every project read
as worth nothing (the list aliased `actual_cost` to "quoted_amount").

**It creates no plan.** A project arrives with no stages; the playbook is
chosen at kick-off, or auto-started by category by the application after the
RPC returns (`autoStartProjectPlaybook`). It used to call
`initialize_project_phases` here — see "The native phase engine is gone".

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

### One approved version per quotation number - on leads and projects alike

Decided 2026-09-17, replacing "one approved quotation per lead". A lead or a
project can carry **several quotations for different things** - the kitchen,
the false ceiling the client added later, the accessories - each its own
number, each with its own versions. Approving `QT-0004 v3` supersedes the
approved `QT-0004 v2` and nothing else; `QT-0011` on the same lead is
independent. Enforced by `quotations_one_approved_per_number` (unique on
`tenant_id, quotation_number` where approved) and done by the status route
and the client portal's approve, so the constraint is never what a user
meets - they get a sentence naming the version replaced.

The old one becomes **`superseded`**, not withdrawn: it may have been the
right price at the time; it is simply not the agreed one any more.
`superseded` is system-only, never picked.

**A new quotation always gets a new number.** `getQuotationNumberAndVersion`
used to reuse the lead's or project's existing number and bump the version,
so a second quotation for the same project came out as v3 of the first and
approving it superseded the first. A new *version* comes only from Revise.
Same split as playbooks: save is a save, revise is a version.

**Six statuses**: draft · sent · approved · rejected · cancelled (shown
"Withdrawn") · superseded, with a CHECK on the column. `viewed`,
`negotiating` and `expired` were facts, not statuses - client views are
counted in `client_view_count` (a view stamps `viewed_at` and leaves the
status at `sent`), validity is read from `valid_until`, and nothing ever
set expired automatically. `linked_to_project` / `project_baseline` died
with the handover copy.

**A lead is won on all its approved quotations.** No picker, no typed
amount: the transition route reads every approved quotation on the lead,
`won_amount` (and so the project's `contract_value`) is their sum, all of
them are attached to the project and locked, and `projects.quotation_id`
points at the largest. The value a project carries after that - the sum of
its approved quotations across numbers, never the superseded ones - is
agreed but **not yet derived live**; `contract_value` is still the figure
frozen at handover. Standalone quotations count nowhere.

**Approving needs `quotations.approve`** (Admin, Owner, Manager, Sales
Manager, Finance Manager, Project Manager, Senior Designer). A draft can be
approved without first being marked sent - a price is often agreed on a
call before anything is formally issued.

**A standalone quotation is addressed to a customer typed in the dialog** -
name required, phone/email/address optional - and `POST /api/quotations`
creates the `clients` row and links it, as a directly created project does.
A quotation holds only `client_id`; there was nowhere else for a name.

### Partners: one identity above the records that already hold outside parties

Built 2026-09-17; the plain-language plan is `docs/plans/partners.md` - read
it first. A **partner** is an outside party as this business sees it (a
person or an organisation), wearing one or more **types** (customer,
architect, interior_factory, distributor, producer, contractor - shipped
with `tenant_id NULL`; a business adds its own), with **contacts** (exactly
one primary - the owner of the relationship, enforced by a partial unique
index).

It sits **above** `clients` and `stock_vendors`, which both gained a
`partner_id` and were backfilled (16 customers, 10 distributors). Neither
was changed otherwise: leads, projects, quotations and purchase orders
point at them exactly as before. A partner wearing the customer hat has a
`clients` row (made on demand); the vendor hat's procurement settings
(payment terms, credit, materials, brands) still live on Stock → Vendors
until phase 2 folds them into the partner page.

**Phone is the identity within a business**; email is a second hint; a
name alone is never enough. `lib/partners/identity.ts` normalises both.
Enforced at creation time, not by a unique index - `GET /api/partners/match`
answers "do we know this person?", `KnownPartnerHint` shows it under the
phone field on the new-lead form and the standalone-quotation dialog, and
the lead, quotation and direct-project routes accept `partner_id` to reuse
the person (creating their `clients` row if they have none). Every one of
those routes creates a partner + primary contact when it creates a new
customer, so nothing bypasses the identity. The test data has fifteen
customers on `1234567890`, kept as fifteen partners deliberately.

`platform_identity_id` is the party's own account on SoftInterio - the
customer's portal, a factory that is itself a tenant. **Empty today, read by
nothing.** A partner record is a business's view of a party, never the
source of truth for the party's identity; the ecosystem (portal, ratings,
add-on services) hangs off the platform side later. Do not put anything the
party owns onto `partners`.

Gated on **`partners.view/create/edit/delete`** (`20260917120000`) - held by
Owner and Admin only, by decision; eight roles hold the old `clients.*`
keys and would otherwise have seen the whole relationship book. A business
grants it further per user or on its own role copy. The one exception is
`GET /api/partners/match` ("do we know this person?"), which anyone with
`leads.create` or `quotations.create` may ask, because the new-lead form and
the standalone-quotation dialog depend on it. Menu **Partners** with one
entry per *enabled* type (`lib/partners/enabled-types.ts` - customer and architect
today; the rest wait for their integrations) at
`/dashboard/partners/t/<code>`. The old `/dashboard/clients` page, the
`/api/clients` routes and `ClientSelector` were retired with it. A partner
with records against it cannot be deleted - mark it inactive. The list and
the detail page show whether the party is **on SoftInterio** (their
`platform_identity_id` is set) - "Subscriber" or "Not yet"; nobody is yet.

### The Design Library references pictures; it is not a second file store

Built 2026-09-17 (`20260917130000`, reworked `20260918090000`), replacing a
hard-coded mock. An entry has a **kind** - what the picture IS: `our_work`,
`drawing`, `material`, `product`, `process`, `inspiration` - and **links** -
what it is ABOUT: the catalogue (space type, component type, cost category,
cost item, quality tier), the project, and for a process picture the
playbook stage by `step_key`. The facet rail is the catalogue's vocabulary;
the kind labels exist so someone else's work is never shown as ours;
`visible_to_customer` is what the customer portal will read. **Collections**
are named sets, optionally tied to a lead - the shortlist for a
conversation.

Pictures reach it three ways, all landing in the same shape: one entry with
several pictures (`POST /api/library/entries`), **a batch** - up to forty
files, one entry each, sharing the links set on the batch, titles from file
names (`/api/library/batch`) - and **from a project** - its photos ticked
inside the library (`/api/library/project-photos` + `promote` with
`document_ids`). Selection mode on the grid then tags many at once
(`PATCH /api/library/bulk`; blank means leave as is, tags are added or
removed). `GET /api/library/catalogue` is the one read for the vocabulary,
without prices.

**"Quotation Config" is now Settings → Catalogue** (2026-09-18): space
types, component types, categories and cost items are the business's
vocabulary for what it builds and sells - the quotation, the Spaces tab and
the library all read it. The old route forwards.

Images are `library_entry_images` rows pointing at storage. A picture
uploaded in the library is the library's to delete; a photo **promoted from
a project's Documents tab** (the swatch button on an image row,
`POST /api/library/promote`) keeps `document_id` and remains the project's
file - removing the entry leaves the document alone, deleting the document
takes the image with it. `lib/library/shape.ts` is the one place rows
become what the page renders, signed URLs included.

The page is full-viewport like Calendar and Documents: a facet rail (kind,
space, style, tags, collections), a masonry image grid, a lightbox with the
entry's details and its collections. **Customer view** hides internal-only
entries, notes, source links and every tool - the mode to switch on before
turning the screen to a customer. Gated on the `library.*` keys that
already existed (view: nearly everyone; create/edit: Owner, Admin, Design
Manager, Stock Manager; delete: Owner, Admin, Senior Designer).

### Calendar and Documents fill the viewport, and have no page header

Both use `h-[calc(100vh-88px)]` - the 64px header the shell's `pt-16`
clears, plus its `p-3` above and below - and let only their own inner
areas scroll (2026-09-17: "we do not need the header section here"). The
shell was `pt-20` over `p-3` over `PageLayout`'s own `p-4` until
2026-09-22 - 44px above and 28px beside every page ("larger gap ... reduce
that gap"); now the shell's `p-3` is the only gap and `PageLayout` adds
none. The calendar's month is six equal rows
of that height; its week columns and side panels scroll on their own. The
documents page's facet rail carries the title and count. Change the shell's
padding and this constant has to follow.

### The dashboard composes the modules' own scoped APIs, and nothing else

`components/dashboard/Dashboard.tsx` (2026-09-18) reads `/api/tasks`,
`/api/calendar`, `/api/sales/leads`, `/api/projects` and `/api/quotations`
- each of which already applies the caller's permissions and scope - and
draws from what they answer. It adds **no data path of its own**: a block
whose permission the caller lacks is not requested, and one whose API
refuses is not drawn. That is the whole privacy argument, and it is why a
"dashboard API" that joins across modules must not be written - it would be
a second copy of every access rule, one grant away from disagreeing.

What it shows, in the order a person asks: a momentum strip (today's ring
of done-over-due, a seven-day streak of finishing something, this week's
wins), a **focus list** worst-first across overdue steps, follow-ups due,
today's meetings, steps due today and quotations whose validity is ending -
with mark-done inline through `task_transition` - then today's schedule,
quotations needing a hand (approvals only to `quotations.approve` holders),
leads going cold, projects under way with agreed-vs-now, and the pipeline.
"Mine" for tasks means assigned to the caller, whatever the list's scope.
The task list returns every row in scope and nests subtasks under parents
too, so rows are de-duplicated by id before counting.

### Every list page is built the same way - do not ask, copy

The leads and projects pages are the reference, and a new list page copies
them without being told to (settled 2026-09-17, after Partners was first
built with its own header and filter row):

- **Header**: `PageHeader` with `title`, `subtitle`, `breadcrumbs`,
  `basePath`, an `icon` (heroicon, `w-5 h-5 text-white`) on
  `iconBgClass="from-blue-500 to-blue-600"`, and one primary action - a
  blue `px-4 py-2 rounded-lg` button with a `PlusIcon`.
- **Body**: `PageContent noPadding`; an error state with "Try Again";
  otherwise the filter bar then the table.
- **Filter bar**: one line - `ListFilterBar` (search input taking the width)
  with `MultiSelectFilter`s ("Status: Active ▾", check-marked options, an
  "All" row). Both live in `components/ui/ListFilterBar`; the leads and
  projects bars predate it and still carry their own copies.
- **Table**: `AppTable` with `className="table-fixed"`, `showToolbar={false}`,
  percentage widths on every column, `onRowClick` to the detail page, an
  `emptyState` with icon/title/description. Cells from
  `components/ui/list-cells` (below).
- **Detail page**: the same `PageHeader` with icon, the record's name as
  title, the facts as subtitle, breadcrumbs back through the list; the tab
  bar of the lead and project pages (`px-4 py-3 text-sm font-medium
  border-b-2`, active `border-blue-600 text-blue-600`).

### The Overview card has one home now

`components/ui/DetailCard.tsx` - `DetailCard`, `DetailFields`, `DetailField`.
The lead's Overview and the project's Overview are built from the same eight
classes (a white `rounded-lg` card, a tinted gradient strip, a 20px icon badge,
a bold title) and a grid of "Label : value" facts, written out by hand in both.
The partner page was the third to need it and had instead grown plain bordered
boxes with a `<dl>`, which is why it read as a different product
(2026-09-24).

`tone` is the strip colour and **carries no meaning** - it tells one card from
the next down a long page, and the lead and project read blue, purple, green in
that order. Severity belongs on a `StatusPill`, never on the furniture.

**The lead and project Overviews still hold their own copies**, deliberately:
they are long and working, and rewriting them in the change that introduced the
component would have risked two screens to tidy a third. Migrate them when one
of them is next touched.

### The Partners detail page follows the lead page, finally

Partners was the module that prompted "every list page is built the same way -
do not ask, copy". The list was converted then; the **detail** page was not, and
was brought across on 2026-09-24. What was wrong, each of it a rule stated
elsewhere in this file:

- **The tab lived in `useState`**, so a reload or a shared link always landed on
  Overview. `useUrlTab` now, like the lead, project and Catalogue pages. A tab in
  the URL that this partner does not have (`?tab=orders` on a customer) falls
  back rather than rendering an empty page.
- **The tabs carried count badges**, which the lead and project tab bars
  deliberately do not: a number beside a label makes the reader count things
  before they have decided which tab they want.
- **The read-only status pills sat in the header's `actions` slot**, among the
  buttons, so what the record IS read as something you could press. They are in
  `stats` now - the slot the lead uses for its stage and priority, behind a
  divider beside the title.
- **The related records were a hand-rolled list of clickable `<li>`s.** They are
  `AppTable` now, `table-fixed` with percentage widths, `onRowClick` and an
  `emptyState`, each inside a `DetailCard` with `bodyClassName="p-0"` so the card
  supplies the heading and the table sits flush.
- **A quotation's status keeps `QuotationStatusColors`**, not `StatusPill`:
  every quotation list in the app renders it from that map, so the pill would
  have been the inconsistency.

**The Contacts tab is `CustomerContacts`** - the same component the lead's
Overview carries, pointed at `/api/partners/:id/contacts` instead of the
lead-scoped route. Two gates, one block: a customer's people should not look or
behave differently depending on which screen you reached them from. It replaced
a bespoke list and a bespoke `ContactModal`, and the reason that mattered
immediately is that the bespoke one **could not set `is_decision_maker` at
all** - the field existed, the lead could edit it, and the partner page silently
could not. That is how two editors of one thing always end.

`basePath` and `className` are the two props that make it portable: the default
frame draws its own top rule for sitting at the foot of the lead's Client
Details card, and a caller giving it a card of its own passes just the padding.
It also follows a changed `contacts` prop (fingerprinted by id), because the
partner page refetches after its own edits and the two would otherwise disagree.

Still there and deliberately untouched: the **"On SoftInterio" column** on the
list, which reads "Not yet" on every row because no partner is linked yet. It is
a documented decision (see Partners above) rather than an oversight, but it is
the first thing to reconsider if that page is ever short of room.

### A dropdown with more than a handful of entries is a `SearchSelect`

`components/ui/SearchSelect` (2026-09-22): a single-choice dropdown you
can type into - options sorted A→Z unless `sort={false}`, a search box
that takes focus, ↑ ↓ Enter Esc, a tick on the chosen row, an optional
`emptyLabel` row for "all / none", and `hint` as a searched second line.
The native `<select>` cannot be searched and lists options in the order
given; a category filter with 25 entries was where that stopped being
fine. Used for the Catalogue's filters and category field, the preset
editor's space picker, the lead and stage dialogs' assignee and project
manager, the project dialog's manager, and the Design Library's space /
component / category / cost item facets. A native `<select>` is still
right for five fixed values (priority, status, unit) and for lists whose
order means something (pipeline stages). Convert others as they are met.

**`multiple` makes the same component a checklist** (2026-09-23): `value`
is an array, the menu stays open as rows are ticked - three categories
should not cost three trips back to the button - the `emptyLabel` row
clears the lot, and the button reads "Electrical +2". The props are a
discriminated union on `multiple`, so a single-choice call site is
unchanged and mixing the two is a compile error. The Catalogue's Items
tab filters by several categories this way; `MultiSelectFilter` in
`ListFilterBar` is the older, unsearchable answer that the leads and
projects bars still use.

### A detail page's tab is in the address

`hooks/useUrlTab` (2026-09-23): `?tab=documents`, written with
`replaceState` and read once on mount. Every detail page held its tab in
state alone, so the address never moved off the record's URL - pressing
refresh on a lead's Documents tab reopened Overview, and a link sent to a
colleague landed them on Overview too. The Catalogue had solved it for
itself; the hook is that solution shared by the lead page, the project page
and the Catalogue, which now all read one implementation.

Three decisions inside it, each with a reason: the URL is read in an
**effect**, not in the initial state, because `window` does not exist during
the server render and a first paint that disagrees with the markup is a
hydration error; it is **`replaceState`, not push**, because switching tabs
is looking around a record rather than navigating, and pushing would make
Back walk every tab you glanced at - it also avoids Next's router, which
would refetch the route on every tab click; and the URL is read **only on
mount**, because afterwards the hook is what writes it and re-reading would
fight the tab just pressed. An unknown or not-rendered tab (`?tab=payments`
on a project) falls back rather than showing nothing.

The project page's tab list was hoisted to `PROJECT_TABS` so the bar and the
URL validate against one array.

### Every list is built from the same cells

`components/ui/list-cells` - `Headline` (name in bold, then one or two
quieter lines: what it is, then where or what about; chips beside the name
for a fact that changes what the row is), `StatusPill`, `Chip`,
`UpdatedCell` (the leads list's `LastActivityCell` with `urgency={false}`,
because silence means nothing for a template). The quotations list, the
templates, terms and print libraries all use them (2026-09-17); the leads
and projects lists are where the shape was settled. `LastActivityCell`'s
staleness colouring is right for a lead or a project and wrong for a
quotation, which is expected to sit once sent - pass `urgency={false}`.

### Costing rules are the tenant's, not the platform's

Built 2026-09-19. How a component is measured and how each cost line
follows from that measurement are configured per component type under
Settings → Catalogue → Components → the calculator icon
(`/settings/catalogue/components/[id]/costing`), in the tenant's own words:

- **fields** - what is measured ("counter run", "blind corner", "drawer
  count"); a length is typed in the row's unit and is **in feet inside a
  formula**, so two lengths multiplied give square feet;
- **quantities** - what is costed against, each a formula over the fields
  and over quantities above it (`lib/costing/formula.ts`: numbers, names,
  `+ − × ÷ ( )`, max/min/round/ceil/floor - nothing else), evaluated live
  on the screen against a sample measurement;
- **priced per** - which quantity each cost item the templates put on that
  type follows (`quotation_template_line_items.quantity_key`).

Stored on `component_types.config_schema` (`lib/costing/component-costing.ts`
reads, validates and quantifies). The Scope sheet asks the fields
(`property_scope_items.measures`); the builder asks them on the component
(`metadata.measures`) and a rule-priced line (`metadata.quantity_key`) shows
its derived quantity instead of inputs; `deriveQuantities()` attaches rule
and quantities at render, for totals and on save - never as state.
`copyScopeToQuotation` prices a chosen item per its quantity when the type
has a rule and the template names one, else on the one face as before. A
type with no rule behaves exactly as before. A sample Kitchen and Wardrobe
rule was seeded where such types existed; the tenant edits or replaces it.

**What the first walk through the wardrobe sample settled** (2026-09-19):

- **A size is typed once.** A rule's `width`, `height` and `length` fields
  ARE the row's size columns (`mergeMeasures` / `splitMeasures` in
  `lib/costing/component-costing`); `measures` holds only the rule's other
  fields. The Scope list asks width × height on a component (length × width
  on a space, its floor); the Scope Sheet's Measurements show the same two
  numbers pre-filled plus the rest. The builder does the same: a rule's
  width/height fields write the component's own size, so a line priced on
  the one face and a rule-priced line read one number.
- **The Quality column is gone from the list.** An option carries its tier
  as a word; a second tier on the component row answered nothing.
  `quality_tier` stays on the row, read by nothing.
- **What a component offers is a table on the type**:
  `component_type_offers` (`20260920090000`) - one row per item a
  component type offers on the Scope Sheet, with `quantity_key`, what that
  item is priced per on it. Edited on the component's own page (Settings →
  Catalogue → Components → calculator, "What it offers on the room
  sheet": add / remove, a plain word for how each behaves from
  `shapeOptions`, priced-per). Read by the options route, the quotation
  copy, the builder's priced-per lookup and the alternatives trigger -
  nowhere else. **It went through three wrong homes in two days**: every
  template naming the type (older templates leaked items onto a pruned
  menu), then templates flagged `is_options_menu` (a template that is not
  a template, whose editor showed it blank because that editor is built
  from spaces), then those hidden from the template screens. The user
  asked "is this the way we should handle this?" and it was not: the offer
  is a property of the component type, like its rule, so it lives beside
  it. `quotation_template_line_items.quantity_key` and the flag are gone;
  templates are templates again.
- **One answer per question, kept by a trigger.** Within a category, items
  priced per the same quantity (two carcass grades, both per front area) are
  ways of pricing one thing: `group_key` on the option, "one of these" under
  the category name, and `trg_scope_choice_alternatives`
  (`scope_item_group_key()`) deletes whatever else answered that question when
  a new answer lands. It was first written in the options route and two taps a
  second apart - two concurrent requests - left two answers standing; a
  read-then-write rule belongs in the database. The route also treats a
  duplicate-key insert (the same race) as the update it meant. Counted
  items are independent - a wardrobe has drawers AND a tray. Until
  2026-09-24 the displaced answer was demoted to a second preference rather
  than deleted; see "One answer per question" above.
- **An option is one of three things**, decided in `lib/scope/options`
  (shared by the options route and the quotation copy, so a tap and a line
  never disagree) - settled on the second walk-through, 2026-09-19, after
  the three-state tap cycle and a repaint after every tap read as "jibbery":
  - *exclusive* - several answers to one decision (four carcass grades, all
    per front area): chips that behave like a radio. **Tap to choose - what
    was chosen before makes way - and tap it again to clear.** Nothing to
    learn, and **one answer per decision, full stop**. Splitting a
    decision across the doors - two glass, four leather, each taking its
    share of the front area - was built on 2026-09-23 and removed the same
    day: "the shutter split concept is looking complex, let us keep it
    simple and make the tenant adopt without that complexity". A rare case
    must not shape the everyday screen; a component with two finishes is
    two components, or a line added in the builder. Do not rebuild it
    without a real case asking.
  - *counted* - per piece and not quantified by the rule (a tray, a
    pull-out): a list with a × n stepper and a ✕; "+ Tray" chips to add - a
    tray is not an answer to a question.
  - *auto* - **marked so on the offer** (`component_type_offers.auto`, the
    Automatic checkbox on the component page; Shelf per `shelves`,
    Exposed Side Finish per `exposed_side_sqft`): shows as "✓ Shelf ·
    follows Shelves", nothing to tap, priced from the measurement, skipped
    at quantity 0. Until 2026-09-22 it was *inferred* from being the only
    item following a quantity - which made Under-cabinet Light automatic
    on every wall unit because it was the only lighting item and followed
    the width, never zero. Lighting is the customer's choice. Rule: auto
    only for a quantity that can be 0 (a count, a typed area); an optional
    extra that follows the size is a tap. An item alone in its group and
    not auto is *optional* - tap to include, tap again to leave out.
  **A count is asked as its own question**, with its own wording - "Any
  blind corners? None · One (L-shaped) · Two (U-shaped)". Drawing it inside
  whatever is priced per it was tried for half an hour on 2026-09-23 to hide
  the drawer duplicate, and went when the duplicate did.

  **A type that cannot say how many of something it needs must not offer it**
  (`20260923260000`). Four types offered the Handles ladder with no quantity
  to price it per, so the sheet drew "+ Handles - Basic × n" chips instead of
  asking which handles. A loft's handles follow its doors like every other
  shuttered unit; the three tables have neither doors nor a drawer count and
  their handles come fitted to the drawer, so the offer went.

  **A count carries its own question and answers**, on the rule field
  (`CostingField.question` / `.choices`, edited under the field on the
  component's page). They were a map in `ScopeItemPanel` keyed by field NAME
  until 2026-09-24, so the three seeded counts asked properly and a tenant's
  own `niches` field got a bare number box with no way to fix it - the
  opposite of the rules being theirs. Backfilled onto 21 component types from
  what the code said, then the map was deleted. **No choices means a number
  box**, which is what every other count already showed.

  **An offer says HOW it is asked** - `component_type_offers.ask_as`, one of
  `one_of | count | auto`, chosen on the component's page and read by
  `shapeOptions` (`20260924120000`). It was inferred from a per-piece unit
  plus a missing priced-per, which nobody could guess from that dropdown, and
  which **could not express a per-piece family at all**: four drawer grades,
  all `nos`, all wanting to be one question, came out as four steppers - the
  reason the Drawer Systems ladder had to be retired rather than fixed. Null
  still falls back to the inference, and the backfill was verified faithful:
  all 572 offers shape identically to before. `auto` stays as a column
  because other code selects it, and the costing route keeps it in step with
  `ask_as` rather than letting the two disagree. Automatic still requires a
  quantity - something to be automatic *from* - or it would price at nothing
  for ever, invisibly.

  Every tap changes the screen at once and nothing repaints afterwards: the
  one-answer rule is applied locally (mirroring the trigger), the save goes
  out behind it, only a failure re-reads, and the list behind the sheet is
  told once the tapping has paused (900 ms), not per tap.
- **A drawer is one counted row, named by its kind** - "Tandem Box Drawer
  × 3" says the quality AND the number, and that is the whole model
  (`20260923250000`). The graded **Drawer Systems** ladder is retired: it
  asked the same sentence a second way, which the user saw the moment it was
  drawn - "how is that different from the answer we give for how many?".
  Deactivated rather than deleted, because 26 quotation lines name Standard
  and 92 name Premium and the printed Material column reads an item's live
  description.

  This settles a duplicate approached from both ends in three days: on
  2026-09-22 the ladder sat beside the by-type drawers and was left as
  "arguably two real axes"; on the 23rd a `drawers` count was added to the
  rule so the ladder could be priced per it, which only moved the duplicate;
  the same afternoon both went. **It is one axis, and the half to keep is the
  one a seller can point at while the customer is looking.** The detour is
  worth remembering as a shape: machinery was being added to the sheet to
  paper over a duplicate in the catalogue, and deleting the duplicate deleted
  the machinery with it.

  So *Internals are counted accessories, never a preference* (2026-09-21)
  stands, and is the settled reading. Every drawer type - wooden, tandem box,
  trouser pull-out - is added and counted like a tray; there is no drawers
  blank. `Shelves: 5` stays a count in Measurements and Shelf prices itself
  from it, which is automatic, not a choice. An internal mirror is per door
  (`nos`), because a sqft item with no rule quantity is priced on the whole
  front.

### The screen says Item; the database says cost item

Renamed in the words only on 2026-09-23, the same bargain as Playbook /
procedure: 27 visible strings changed, the schema untouched
(`quotation_cost_items`, `quotation_cost_item_categories`, `cost_item_id`
on offers, scope rows, line items, the library and five stock tables -
761 identifiers and 34 columns that buy nothing by moving). Settings ->
Catalogue now reads **Spaces · Components · Item Categories · Items ·
Presets** - the categories tab keeps "Item" because "Categories"
alone does not say what it categorises.

**The old name was wrong about the row's main number.** `default_rate` is
what the *customer pays*; the costs on the same row - `company_cost`,
`vendor_cost` - are stand-ins until procurement keeps a real vendor list.
So the table was named after its least important and least reliable
field, and "Cost Items" read as a list of what things cost us.

**What one is, in a sentence: one thing you sell, in one unit, at one
rate.** It wears three hats and they are the same row - an **answer** on
the Scope Sheet ("Which carcass?" -> BWP Ply), a **line** on the quotation
with a quantity and a snapshotted rate, and a **description** in the
printed document's Material column.

Three things it is deliberately **not**, each settled against a real
proposal:

- **not a product.** No brand, no model, no MRP. Hob and Chimney stay
  generic. Brands already have a home - `stock_materials` carries
  `brand_id` and a `cost_item_id` pointing back here, seeded with Faber,
  Elica, Bosch and Kaff at real prices - and wiring it to the quotation
  belongs with procurement. Brand is **not a tier**: the seeded data has
  Faber's hob under Bosch's and Faber's chimney over it, so a ladder would
  make "upgrade the appliances" fit a worse one.
- **not a package.** Never "modular kitchen @ 1800/sqft"; that is a print
  format question (`itemise_to`), and granularity is what makes a take-off
  and vendor negotiation possible later.
- **not a cost**, despite the name it carried for nine months.

**An item is an answer, not a thing in a warehouse** (2026-09-23, the audit
of all 110). Three kinds of row are legitimate: a **decision** the customer
makes, an **automatic** one that follows the measurement with nothing to tap
(`component_type_offers.auto`), and a priced line that is **not the
customer's business at all** - labour, delivery - which is simply offered on
no component. Anything else is a part of something already priced, and the
audit found fourteen: a tandem runner inside a Tandem Box Drawer, end caps
that come with the profile, a toe board on every base unit, a sink cut-out
that is a fabrication step; Roller Set + Sliding Track + Soft-close Damper
made the seller assemble a sliding system from three taps and became one
graded family (3000/4500/6500/9500 a door, against the ~4450 the parts came
to); and three more second answers to a live question - Cove Light was
Profile Lighting - Standard to the rupee on the same ceiling, Under-cabinet
Light the same ladder on the same counter run, and the graded Shutters
family duplicates the Shutters by Finish set every menu actually uses.
**Appliances keep their rows and lose their offers**: products with brands,
billed on their own quotation. 110 active became 100.

**Deleted where nothing used the row, deactivated where a quotation line
points at it.** The printed document reads its Material column from the
item's *live* description, so deleting a quoted item silently rewrites a
document already sent. `20260923190000` raises rather than guesses if
anything on the delete list has gained history since.

Still duplicated and deliberately left: the graded **Drawer Systems** ladder
(nos, 11 types) sits beside the by-type drawers in Internals (Wooden, Tandem
Box, pull-outs), so a wardrobe asks for drawers twice. Grade-of-runner and
kind-of-drawer are arguably two real axes, unlike the cases above - decide it
before the next catalogue pass. **Dado & Backsplash** is empty while the
kitchen base unit's rule derives `dado_sqft`, so a backsplash cannot be
priced at all.

**A size never goes in the name.** The test: is the difference a number
the measurement already knows, or a decision the customer makes? Length,
area and count are measured - they belong in the `unit_code` and the
costing rule. "LED Light Strip - 3ft" (nos, 900) and "- 6ft" (nos, 1500)
were the same product sold twice and did not agree with each other -
300 a foot against 250 - while a 7ft run had no honest answer at all, and
both sat on the Kitchen Base Unit's offers *beside* the Profile Lighting
ladder (rft, 150/220/320/450 per `counter_rft`), so that one component
offered six ways to buy one strip of light. Retired `20260923180000`,
which refuses if any quotation line or scope row still uses them.
"Organizer Basket - Large / Small" and "Hob - 4 burner" are decisions
nobody derives from a plan, and stay. Those five were the only names of
112 carrying a size.

**A thing the business does not sell is simply not offered** - remove it
from the component type's offers, or mark the scope row Done by: Client.
Billing appliances separately needs no flag either: a lead already carries
several quotations, each with its own number, each approved on its own,
and winning sums them (2026-09-23 - a `bill_group` on the category was
proposed and declined as complexity ahead of a real case).

### A cost item is one thing with one selling rate; its costs are stand-ins

Decided 2026-09-22 from a brainstorm on where the cost item is used and
what it will carry. **The vocabulary** - use these words and no others:

- **rate** - what we sell it at. `quotation_cost_items.default_rate`.
- **vendor price** - what a vendor charges, on a date, at a quantity. A
  *list* (vendor, price, unit with a conversion to the selling unit, MOQ,
  valid from), not a column. `vendor_cost` is its one-number stand-in
  until procurement keeps the list.
- **landed cost** - vendor price × unit conversion + wastage + labour.
  Derived when the list exists; `company_cost` is the typed stand-in.
- **margin** - (rate − landed cost) / landed cost. Computed, never typed.

Two rules that already hold and must keep holding: **a quotation line
snapshots rate and cost at copy time** (`scope-to-quotation` writes
`rate`, `company_cost`, `vendor_cost` onto the line), so "margin on this
quote" and "margin now that costs moved" are both answerable; and **cost
and margin reach only holders of `cost_items.pricing`**
(`lib/quotations/cost-visibility.ts`, stripped server-side).

**There is one cost item table.** `cost_items` was renamed
`quotation_cost_items` before the baseline and every stock table points at
the new name; what survived under the old one was code that could never
run - Stock → Cost items and its API (deleted 2026-09-22), the stock
overview's counts (re-pointed), and two functions (a PO trigger attached
to nothing, a seed superseded by `seed_tenant_catalogue`; dropped,
`20260922130000`). Do not add another numeric column to the item row when
a need appears - each new number wants *from whom* and *since when*,
which is a row in a list. Later, each with its module: vendor price lists
(procurement), HSN and GST rate per item (invoicing), rate cards per tier
or segment and price history (when a second card is wanted), brand
variants (when the library or procurement needs them by make).

### The seeded rates are market rates, and every priced-per agrees on units

Audited 2026-09-22 after the first quotation came out at ₹62 lakh for a
3 BHK, roughly three times the market.

**Units.** A rate is in the item's own unit and must be multiplied by a
quantity in that same unit. Twenty-six offers were not: a countertop at
₹250 per **sqft** was multiplied by the counter's **running feet**, and a
per-piece cut-out by feet as well. `counter_sqft` (run × depth) and
`dado_sqft` (run × its own height, 600 mm by default) were added and the
per-piece items went back to counted (`20260922180000`). **The check to
run when adding an offer**: the cost item's `unit_code` and the
quantity's `unit_code` must match; anything else silently prices the
wrong number.

**Rates** (`20260922190000`). The December seed priced each *part* as
though it were the whole job - a carcass at ₹2,000/sqft and a shutter at
₹2,500/sqft together exceed what a finished kitchen sells for, and a
hinge at ₹1,000 is four times a fitted soft-close hinge. Now, per square
foot of front elevation, supply and fit: carcass 750 / 950 / 1,250 /
1,600; graded shutters 550 / 750 / 1,200 / 1,700; by finish laminate 600,
membrane 650, acrylic 1,150, PU 1,350, lacquered glass 1,450, veneer
1,600; hinges 150 / 250 / 400 / 650 each. A standard run is then about
₹1,700/sqft of front before hardware and a premium one ₹2,400, against a
market of ₹1,600-2,600 and ₹2,500-3,500 all in. Still starting rates -
the point is that a tenant who never edits them quotes in the right order
of magnitude. **Ladders must climb**; the migration reports any that do
not, and *Profiles* was made untiered because two of its five items had
picked up "standard" from the create form's default, which would have let
Reprice swap one profile for another.

**A quotation keeps the rates it was made with** - they are snapshotted on
the line. Changing the catalogue never moves a quotation that exists; a
new one, or a revision, picks the new rates up.

### The seeded catalogue is complete enough to quote a whole home

`20260919110000_catalogue_completion.sql` (2026-09-19) took the shipped
catalogue from 11 categories / 43 cost items / 19 component types / 6
templates to **24 / 99 / 29 / 39**, so that a kitchen or a full-home
quotation does not run into a thing the catalogue cannot name. The plain
account of what and why is the Scope to Quotation Handbook artifact
(https://claude.ai/artifact/SrSeVHrrGKzPEms8xK9urf, "What was added").

- **New categories are untiered on purpose** - Countertop, Dado, Shutters
  by Finish, Appliances, Sliding Systems, Profiles, Internals, Glass &
  Mirror, False Ceiling, Painting, Electrical, Civil & Plumbing, Soft
  Furnishings. Reprice needs one family per graded category (see above),
  and these are chosen by kind, not by grade. The graded Shutters and
  Drawer Systems ladders stay beside the by-kind sets; a menu should carry
  one or the other, never both.
- **Every new cost item's description says "Starting rate - edit."** They
  are placeholders for the tenant's finance to replace, not prices.
- **One "<Component> - Options Menu" template per component type.** The
  Scope Sheet's options are the distinct cost items across the active
  templates for the type, so a type absent from every template offers
  nothing to pick. These templates exist to make every component pickable
  on day one; a business prunes them like any template.
- **Internals are per-piece items with a count**, not fields on a rule:
  Shelf (nos), Shelf - per area (sqft), Hanging Rod (rft), and drawers by
  type (Wooden, Tandem Box, Trouser Pull-out, Wicker Basket, Cutlery Tray,
  Bottle Pull-out, Plate Rack, Pantry Pull-out). The rule of thumb in the
  handbook: derivable from the measurement -> costing rule; decided with
  the customer -> a counted option.
- **Blind corners are counted, and the corner solution is a decision**
  (`20260922150000`). A `corners` count on the kitchen base and wall unit
  rules; Magic Corner, Blind Corner Pull-out, Corner Drawer and Corner
  Carousel (moved from Accessories to Internals) are alternatives priced
  per corner - "one of these", because a run has one kind of corner
  solution; Corner Filler Panel is automatic per corner, which is the
  honest use of auto (a corner always needs one, and the count can be 0).
  Before this a corner was a hint on the run field and one carousel on the
  base unit, and the wall unit had nothing - a wall run turns as often.
- **The kitchen components are measured as themselves** (`20260922100000`).
  The sample kitchen rule of the 19th was a whole-kitchen rule (counter
  run, base height, wall height, tall units) pasted onto every type named
  "kitchen", so a Base Unit asked for the wall unit's height and none of
  them had `width`/`height` for the Scope list's size to bind to. Each unit
  now has its own rule - run (width), height, depth, shutters, exposed
  sides → front area, counter length, hinges, exposed side - and its offers
  follow it. A business that quotes a kitchen as one thing would make a
  *Kitchen* component type with a whole-kitchen rule, not four unit types
  wearing one.
- **Home General is the space for whole-home work** (`20260922110000`):
  Painting (paintable area), Electrical Work (wiring run; points and
  boards counted), Civil & Plumbing Work (plumbing run, demolition area),
  False Ceiling (ceiling area, cove length; also on Full Ceiling), Curtains
  & Blinds (width × height) and the new **Site Services** (delivery and
  clean-up as fixed charges; floor and wall protection per area) declare
  it, each with a rule of its own so a whole-home job is never priced on a
  "face" it does not have. Whole-home rules use `number` fields typed as
  areas rather than `width × height`, which is the honest measurement for a
  paint job. The duplicate Cove Light under Lighting was retired for the
  one under False Ceiling.
- **Every active component type has a rule** (`20260922120000`). The
  thirteen that had none priced everything on the component's face. Four
  shapes cover them - *cabinet* (pooja, shoe rack, TV, crockery, bar:
  width × height, depth, shutters, exposed sides → front area, hinges by
  door height, handles, exposed side, strip length), *shelving*
  (bookshelf, no doors), *counter* (utility, vanity, breakfast counter:
  the cabinet plus counter length), *table* (study, console, dressing:
  front and top area) and *bed* (headboard area, storage base area). A new
  component type still starts with no rule and behaves as before; give it
  one on its page.
- **A wardrobe's two height offers are the same rule with different
  numbers**: wardrobe + loft is `height 7, loft_height 2.5`; floor to
  ceiling is `height 9.5, loft_height 0`. The separate `loft` component
  type (with its own sample rule) is for a loft sold on its own.
- **Exposed sides are a field, a quantity and one item**
  (`20260919120000`): the seeded Kitchen, Wardrobe and Loft rules ask
  `depth` and `exposed_sides` (kitchen also `wall_exposed_sides`) and derive
  `exposed_side_sqft`; *Exposed Side Finish* (sqft, in Shutters by Finish)
  sits on those Options Menus priced per it. A visible end of a run is
  finished to match the shutters and is the classic forgotten line. The
  same shape - a count the seller sees on the plan, an area the rule works
  out, a per-area item - is how fillers and skirting would be added.
- **Two wardrobe rules are the worked samples** (`20260919130000`):
  Wardrobe - Openable and Wardrobe With Loft - Openable carry the whole
  calculation - front area, hinges by door height (`max(2, ceil(height /
  2))` per door; wardrobe and loft hinges apart, summed), handles, shelves
  and drawers as counts, exposed sides - and their Options Menus hold only
  what that prices (carcass, shutter by finish, hinges, handles, shelf,
  drawers by type, exposed side, installation). Accessories and the graded
  Shutters / Drawer Systems ladders are off those two menus so a menu never
  offers two ways to price one thing. The per-sqft "all in" model the
  market quotes in is a print-format question (`itemise_to`), not a
  catalogue one: the record stays itemised so material spend can be
  compared across projects later (a take-off is parked, not planned).

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

### The native phase engine is gone

Retired on 2026-09-15 (migration `20260915120000`). SoftInterio had grown two
engines for one idea: `project_phases` and sixteen satellite tables (sub-phases,
checklists, approvals, comments, attachments, dependencies, status logs,
templates, categories, groups), twenty-one functions, a view and six enum
types — a phase tree copied from templates at handover, beside the playbook
engine that versions, nests, gates, carries hours and executes as tasks. Every
product idea from here on (baselines, delay attribution, milestones that drive
status) was designed on tasks and would otherwise have been built twice.

What went with it in the code: the thirteen `/api/projects/[id]/phases/**`
routes and `/initialize-phases`, `ManagementTab`, `PhaseEditModal`,
`SubPhaseEditModal`, `SubPhaseDetailPanel`, `phaseHelpers`,
`playbook-adapter` (replaced by the much smaller `plan-tree.ts`),
`requirePhaseLineage`, `deriveStagesFromPhases`, the phase fallbacks in
`closing.ts`, `auto-start.ts`, the list and stages routes, the `phases`
checkbox on the create form, and every phase type and constant. Nothing in
`src/` selects a phase table now.

What went in the database: the tables, functions, view, enums, the RLS
policies on them, `projects.current_phase_id`,
`project_payment_milestones.linked_phase_id` and
`project_payment_milestone_templates.trigger_phase_template_id`.
`create_project_from_lead` lost its `p_initialize_phases` parameter — a
**signature change**, so it was dropped and recreated, and the transition
route no longer passes it. `calculate_project_progress` lost its phase branch.

**It was safe because nothing had been recorded on them**, verified before
writing the migration and guarded inside it: the one project carrying native
phases (PRJ-25-0002) had 6 phases and 18 sub-phases all `not_started`, and
every record-keeping table was empty. The migration refuses if that is not
true. That project now has no plan and shows the playbook picker, which is
what the kick-off flow wants anyway.

Two finance seams were kept deliberately, because payments are parked rather
than abandoned: `project_payment_milestones_view` was recreated without its
phase columns (dropped and created — `CREATE OR REPLACE VIEW` cannot remove a
column), and the mapping the five global milestone templates carried
("Booking Advance → Kickoff, on start" and so on) is written into the
migration's header so a finance module can re-express it against playbook
steps. `PaymentsTab` and the milestone routes are untouched.

The word "phase" survives in a few variable names on the projects list
(`current_phase`, `selectedPhases`) where it means the derived *stage*. Naming
only; nothing reads a phase table.

### A project starts with kick-off, and only kick-off

Built 2026-09-15, steps 1-2 of `docs/plans/project-lifecycle-and-delay-ledger.md`
(the plain-language plan; read it before touching any of this).

**No playbook starts itself any more.** A won lead - or a direct create -
produces a `new` project with no plan. `suggestProjectPlaybook()`
(`lib/playbooks/auto-start.ts`) still reads `auto_start` /
`auto_start_project_category`, but only to pre-select a playbook on the
checklist; the project manager chooses. Auto-starting at conversion meant a
plan nobody had looked at, which is the opposite of what a kick-off is for.

**The Plan tab of a `new` project is the kick-off checklist**
(`components/projects/KickoffChecklist`): handover reviewed → playbook chosen
→ every stage has an owner and dates → every open "waiting on" entry has an
expected date → a note → Confirm. `GET /api/projects/[id]/kickoff` assembles
that state and says what is `missing`; `POST` hands it to
**`kick_off_project()`**, which checks everything again and, in one
transaction, records **baseline v1** (`plan_baselines` +
`plan_baseline_tasks`), copies the dates Sales promised into
`committed_start_date/end_date`, sets `expected_*` to the agreed plan's span,
moves the status to `in_progress`, stamps `kicked_off_at/by`, and writes
`project_kicked_off` and `plan_agreed` to the timeline. It refuses with a
`missing[]` list otherwise and writes nothing.

**`new → in_progress` by hand is refused** (409 `kickoff_required`) in `PATCH
/api/projects/[id]`. The edit dialog's status dropdown will show that
sentence; that is intended.

Who may confirm: project write **and** `tasks.create`, because a plan is
tasks. No new permission.

**A step marked client/vendor is a "waiting on" entry the moment its task
exists.** `procedure_step_definitions.owner_type` (`internal` default,
`client`, `vendor`) and `milestone_role` (`kickoff`, `handover`,
`client_facing`) are set per step in the playbook editor. A trigger on
`tasks` insert raises a `project_dependencies` row for every client/vendor
step, and another settles it when the step settles - so `start_procedure_run`,
sync and commit all get it for free. Ad-hoc asks ("society NOC") go through
`/api/projects/[id]/dependencies`. An entry tied to a step cannot be deleted
here; skip or cancel the step. `milestone_role` is stored and edited but
**not yet read** - status proposals from milestones are a later step of the
plan.

`text[] || 'literal'` in plpgsql parses the literal as an array and fails
with "malformed array literal". Use `array_append`. This cost one repair of
`20260915141000`.

### A project's status changes through one function, from the header

Built 2026-09-16. After kick-off every status move goes through
`project_transition()` (`POST /api/projects/[id]/status`), which holds the
rules, the cascades and the timeline entry in one transaction. `PATCH
/api/projects/[id]` **refuses any status change** (409
`status_is_a_transition`), and the edit dialog shows status read-only. The
header carries `ProjectStatusAction`: exactly the moves the status allows,
each with a small dialog, and always a note.

| from → to | needs | cascades |
|---|---|---|
| new → in_progress | kick-off only (`kick_off_project`) | |
| in_progress → on_hold | who, why (from `delay_reasons`), until | running steps go on hold on the same hold |
| on_hold → in_progress | note | days held logged against the owner; steps resume one by one |
| in_progress → completed | no open steps · the `handover` milestone step complete · no open asks | the run completes |
| new / in_progress / on_hold → cancelled | reason | run cancelled, open stages cancelled (their steps with them) |
| completed / cancelled → in_progress | note | the run comes back |

Nothing goes back to `new`. `projects.hold_owner/hold_reason_code/
hold_expected_until/held_at/completed_at/cancelled_at` carry the state;
`project_held/resumed/completed/cancelled/reopened` are the timeline entries.
This is the first place `milestone_role` is **read**: a playbook's `handover`
step gates completion.

### A hold says who we are waiting on, and the current plan moves with it

Step 3 of the lifecycle plan, 2026-09-15.

**Putting a plan step on hold asks three things**: who we are waiting on
(`hold_owner`: client / vendor / internal / third_party), why
(`hold_reason_code`, from `delay_reasons`), and until when
(`hold_expected_until`), plus who exactly (`hold_counterpart`) and the free
text that was always there. `task_transition` takes them as parameters and
writes them **in the same UPDATE as the status**, so the row
`trg_tasks_status_change` writes to `task_status_history` carries them - that
history row is the durable record of the hold, and a second UPDATE would have
been too late for it. They are cleared from the task when the hold lifts; the
history keeps them.

**Every entry point that can hold a plan step asks.** `TaskStatusControls`
asks in the full variant as before and now in the compact row variant too,
*for plan steps only* (`procedure_run_id` set) - an ad-hoc task keeps its
one-click pause. The inline status badge on the table and the status dropdown
in `EditTaskModal` **decline** a hold on a plan step with a sentence pointing at
the pause button, because neither has room to ask. Do not add a fourth way
that skips it.

The dialog opens pre-filled from the step: a client/vendor step is waiting on
them by definition, and `default_delay_reason` ("Usual delay" in the editor,
offered only on client/vendor steps) supplies the reason. Task responses embed
`playbook_step:procedure_step_definitions!tasks_procedure_step_id_fkey(owner_type,
default_delay_reason)` for this.

`delay_reasons` is seeded with sixteen shipped rows (`tenant_id NULL`) across
the four owners; a tenant's own rows sit beside them and RLS returns both.
`GET /api/delay-reasons` is the only route so far - **there is no editing
screen yet**; add one under Settings when it is asked for.

**The plan schedules itself.** `reschedule_run(run)` lays out the
not-yet-started part of a plan from three things, and the two statement-level
triggers on `tasks` (`trg_reschedule_after_insert/_update`, transition tables,
so a run start or a commit schedules once) call it after anything about the
run changes:

- **the playbook's rules** — hours (8h = 1 day, rounded up), "waits for X to
  finish / to start", the previous sibling unless marked Parallel, the
  previous stage unless marked Parallel;
- **reality** — a completed step is its actual dates; a step in progress or
  on hold ends no earlier than today or its "expected until"; a stage under
  way ends when its last step does (its old due date is *not* a floor);
- **the project manager** — `tasks.dates_pinned`, set by `PATCH
  /api/tasks/[id]` when a person changes a plan step's date, is treated as
  fixed.

Finishing early pulls the plan forward; late or held pushes it back. **A
started step's dates are the real ones** (2026-09-16): its `start_date`
becomes the day it began, its due that day plus its duration (no earlier than
today), and a finished step shows the days it actually ran between. This
replaced the earlier "a transition never rewrites `start_date`" rule, which
predates the baseline - `plan_baselines` is where the plan is kept now, and it
is never touched. Pinned dates are left alone. Calendar days, not working
days. The run's own dating in `start_procedure_run` is overwritten by the
insert trigger immediately.

Five things it got wrong on its first real plans, all fixed the same day:
the project's planned start anchors **only the first stage** (as a floor for
every stage it held 3D back to the sales date after 2D had finished);
**skipped and cancelled steps take no time** (NULL dates, ignored by every
MAX);
a step's floor is its **own stage's** start, not the project's planned start;
the implicit previous-sibling rule **yields to an explicit link the other
way** (Reworks "waits for Client Approval" typed above Approval chased its
own tail for 80 passes — eight months); and the running-stage correction has
to sit **inside** the fixed-point loop or the stages after it are computed
from the stale end. It raises a WARNING if it ever fails to settle.

It replaced step 3's one-way `shift_dependent_steps` trigger, which is gone.

A dry run against live data without writing it: a throwaway migration whose
`DO` block does the work and ends in `RAISE EXCEPTION` with the results in the
message. `db push` prints the message, the transaction rolls back, nothing
reaches the ledger. Delete the file afterwards. Cheaper than any harness and
it uses the real rows.

### Playbooks are the workflow engine
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

**A playbook is the only way a project is planned.** A stage is a top-level
step of the run; a step is a child task of that stage. `src/lib/projects/
plan-tree.ts` nests a run's tasks in the playbook's order for the Plan tab,
and that is all the shaping there is — every node is a task, every edit goes
to `PATCH /api/tasks/[id]`, and clicking a step opens the task page.

`start_date` is the plan and `started_at` is what happened; they are different
columns and the table shows them in different columns too.

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
`calculate_project_progress` answers from the **active playbook run** — settled
steps over all steps — and is zero for a project without one. It used to fall
back to native phases; that branch went with the engine.

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

### Every task list orders the same way

`lib/tasks/order.ts` `defaultTaskOrder()` is the one default: plan steps
first, grouped by project, in the playbook's own order (`plan_order`, the
step's `display_order`, which the tasks API puts on every row); ad-hoc tasks
after, newest first. The Tasks page, `TaskTableReusable`'s default column and
the project Tasks tab all use it. There are **two table implementations** -
`src/app/dashboard/tasks/page.tsx` has its own, older than the shared one -
and each sorting its own way is how the same steps read forwards on one screen
and backwards on another (2026-09-16). Change the order in the helper, not in
a table.

### Who sees which tasks

`GET /api/tasks` without a lead/project filter is scoped by permission
(2026-09-16). `tasks.view` is granted to nearly every role and labelled "view
all", so it is read as the basic right to use the module; the real split is
**`tasks.view_all`** (Admin, Owner, Manager, Senior Designer) - every task -
against **`tasks.view_team`** (the seven manager roles) - your own tasks plus
every task on the **projects you manage and the leads assigned to you** -
against everyone else, who sees tasks **assigned to them or created by them**.

"Team" is defined by responsibility, not by people (decided 2026-09-16,
option A): there is no team table and no reporting line, and adding one would
reintroduce the hierarchy the model refuses. A Finance Manager owns no project
or lead and so sees their own, until the finance module has entities of its
own. Option B - a department on each role, so a manager also sees the tasks of
people in their department - was discussed and parked; it composes with A.

The response carries `scope` (`all` / `team` / `own` / `entity`) and the Tasks
page says which it is showing. A list scoped to a project or lead is the
entity's own view, gated by that entity's access - a plan stays whole for
anyone who may open the project.

### The task rules, in one place

`docs/testing/task-rules.md` is the list - 30 rows, each with how to try it
and what should happen - and is kept current when a rule changes. The rules
live in three layers and a change goes in all of them:

- **`task_transition`** (database) - the transition matrix, owner required to
  go in progress or to complete, predecessors and requirements, skip rules,
  starting a step starts its stage, a stage on hold takes its running steps,
  a stage cancelled takes its open steps, skipped/cancelled reopenable.
- **`PATCH /api/tasks/[id]`** - a finished task is not edited except to
  reopen it (title, priority, dates, hours, assignee frozen; description and
  tags not), due on or after start, hours not negative, a running task is not
  unassigned, a playbook-fixed assignee stays.
- **the row** - the same answers before the round trip, so a button is
  disabled with the reason rather than refused after: no owner (Start and
  Complete), the plan gates, settled rows read-only, unassigning a running
  task declined with the server's sentence.

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

`ManagementTab` survived for a while for projects still on the older native
phase engine. That engine and the tab are gone (2026-09-15).

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

It is now `refreshPlan`: the project row (progress and the header's stage
strip come from it) and the playbook, in parallel, touching no loading flag.
The table simply changes. The refresh icon spins while it works rather than
looking inert.

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

### `TaskRow` is called, never rendered as an element

Both task tables define their row as a function inside the table component,
closing over its state. Written as `<TaskRow task={t} />` that function is a
**new component type on every render**, and React answers a changed type by
unmounting the old row and mounting a fresh one - so every row's DOM was
replaced on every render. Found 2026-09-17 after two days of "flicker"
reports that were all this: chips blinking as their nodes were swapped, the
timer controls losing their optimistic and clock state (the "timer acting
weird", the "flash on click"), a hovered tooltip orphaned without its
mouseleave and reappearing under the cursor, focus lost from the button just
pressed. The Tasks page had even worked around one symptom by inlining the
subtask input "to prevent focus loss".

Rows are now `{TaskRow({ task })}` - a render function whose output is an
ordinary keyed child of the table. **It must hold no hooks of its own**; a
hook inside would then belong to the table and vary in count with the rows.
Before writing a component inside another component, ask whether it will be
rendered as an element; if so, hoist it or call it.

### A plan action paints twice: the row, then the page - never in between

After Start / Pause / Complete / a dropdown change / a date or assignee edit
on a plan row (2026-09-17):

1. **The row takes the server's answer at once.** The transition and PATCH
   routes return the task from `tasks_with_timing`, with the dates the
   scheduler moved and the stamps the transition wrote; the table merges it
   into the row and **pins** every settled field (`PINNED_AFTER_TRANSITION`:
   status, dates, stamps, hold, hours) in `recentLocal`, so no sync read a
   moment earlier can move them back.
2. **The page re-reads everything in one batch.** `refreshPlan` awaits the
   project, the playbook, the task list and the plan gates together and sets
   all of them in one tick, which React renders once. It used to be three
   functions setting state as each answer arrived: the acted-on row was
   rebuilt from fresh stages and a stale task list for a beat (its dates and
   early/late chips flashed back, then forward), and the gates arrived a beat
   after the rows so the buttons changed twice. Gates are now page state
   passed to `PlanTab`; the Tasks tab refreshes through the same batch.

The timer buttons do not dim during the round trip - a second click is
ignored while one is in flight - because the row already shows the target
state and a 700 ms dim on every click read as a blink.

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

**A stage has actions too**, because a stage is a task. It previously had only
Edit, which became untenable once steps could wait for their stage to start:
nothing could ever be opened.

`PlanTab` fetches `/plan-gates` whenever its tasks change and hands the map to
`TaskTableReusable` as `gates`. A Start or Complete the server would refuse is
**disabled with the reason as its tooltip** - nothing is printed on the row. A
refusal that still reaches the server comes back as a toast (`onError`).

**Plan rows carry no inline messages.** Decided 2026-09-16 after gate reasons,
hold owners, "needs: …" and a "pinned" chip had all been tried on the row:
"clean and simple, like the tasks list". Anything a row needs to say lives in
a tooltip or in the ⋯ menu (Open task page · Waiting on… · Let the plan set
the dates · Skip · Reopen).

**The Timer cell is two small round buttons and a clock**, on the plan and
the tasks list alike (2026-09-16, the user's spec): the one that moves the
clock - Start, Pause or Resume, whichever applies, blue when starting and
amber when running or paused - and Complete. They react the instant they are
pressed: `TaskStatusControls` shows the target state and tells the table
(`onOptimistic`) so the status badge moves with it; the server's answer
confirms it or the previous status comes back with a toast. The clock is
`h:mm:ss` by the second. The Actions cell is **Edit only**. Plan step names
are the playbook's and are not renamed inline. The status dropdown always
takes effect; a plan step held from it carries the owner and usual reason
the playbook knows, like Pause does. Skip, "who are we waiting on" for an
internal step, and unpinning dates are not on the row - the task page and the
edit modal have the full-size controls.

`Modal` portals to `<body>` and stops clicks propagating. It used to render in
place, so a dialog opened from a table cell did not show and its clicks fell
through to the row. And `task_transition` has **one signature** - adding
parameters with CREATE OR REPLACE created a second overload and made every
four-argument call ambiguous; that is why stopping a playbook would have
failed to cancel its steps.

**A date the PM changes on a plan row is pinned** (`tasks.dates_pinned`, set by
the task PATCH on a real change) and everything after it re-lays around it;
⋯ → "Let the plan set the dates" unpins. A "waiting on" entry backed by a step
follows the step's planned due date until somebody sets its date by hand
(`project_dependencies.expected_by_set_by_hand`).

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

**Decided 2026-09-16: one playbook per project, full stop.** A tenant keeps
as many playbooks as it has kinds of project and the PM picks one at kick-off;
two never run on one project at once (everything - stage strip, progress,
baseline, delay log, handover milestone - rests on there being one plan); and
"a playbook that follows another" (snag & warranty after handover) is not
built until a real case asks for it. Parallel work is *Parallel* stages inside
the one playbook, not a second run.

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

**It copies `wait_type`.** It did not from 2026-09-13 (when `wait_type` was
added) to 2026-09-15: every "wait for X to start" link came back as "to
finish" in the draft, a step waiting for its own stage to finish is exactly
what `trg_reject_circular_step_dependency` refuses, and so no playbook with
such a link could be revised at all - the route reported "Could not open a
revision". When adding a column to `procedure_step_definitions` or
`procedure_step_dependencies`, **add it to `revise_playbook`'s column lists**;
the function enumerates them and silently drops anything it does not name.

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
it, 3 step(s) added, 12 tick(s) set on steps not yet started") because it
changed live projects, and silently reshaping somebody's plan is not
acceptable.

**Ticks follow the same rule as removal** (`20260917090000`): a repointed
step still `todo` has its requirements replaced from the new step; a step
under way, held or finished keeps the ticks it was given. Until then commit
never touched requirements at all — a checklist added in v10 reached no
project already on v9, and a step *new* in a version arrived with **no gates**
because commit inserted the task without calling `create_step_requirements`.

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

**A link is `must` (hard) or `should` (soft)**, exposed in the editor since
2026-09-16 as a second dropdown on the chip. Both place the step in the
schedule; only `must` makes the gate refuse Start. `should` is how "one stage
after another, but we often overlap to save time" is said: the plan is laid
out in order, the PM may start the next stage early, and the scheduler
re-lays around what actually happened. New stage-level links default to
`should`, step-level to `must`. Modular Design Template v9 has its stage
chain as `should` except Handover.

**The scheduler follows a step's own links and nothing else** when it has
any (a link to its own stage does not count). The built-in
previous-sibling / previous-stage order only fills in for steps with no
links. "3D Design waits for 2D Designs *to start*" therefore overlaps them,
as written; the v8 stage links said that in several places and were not
what was meant.

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

### One viewer for pictures and files

`components/ui/MediaViewer` (2026-09-18) is how anything uploaded is looked
at: a full-screen viewer over a dark backdrop, ← → through the set with a
counter and a filmstrip, the name and where it came from, Open / Download,
images inline, PDFs in a frame, anything else as a card. Give it the whole
set and the index, never one item at a time - a room's references, a
Documents list. `DocumentPreviewModal` is now a thin wrapper over it that
takes the list it was opened from. Do not open a file in a new tab as the
primary action; the new-tab link is inside the viewer for those who want it.

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

### What each button in the quotation module is for

Counted on 2026-09-24 after "there are tons of buttons at the top": **fourteen
across two pages, four of them the same action twice.** The builder had
Duplicate, Print, Approve, Summary, Template, Reprice, Revise, Save; the summary
had Approve, Edit, Revise, Duplicate, PDF, Share. Approve, Revise, Duplicate and
Print/PDF each existed in both places, the last under two different names.

Three of them were not what their label said, and the diagnosis matters more
than the tidying:

- **"Summary" was `onExit()`** - the close-the-editor button, named after the
  page it happens to land on. It says **Done** now, and pairs with the summary's
  **Edit**.
- **"Save" was a redirect.** The document autosaves three seconds after every
  change and the bar underneath says "Saving… / Saved", so the button's only
  unique behaviour was `redirectAfterSave = true` - which meant the two controls
  that left the editor were called "Save" and "Summary". It is kept, because
  pressing it is how people check their work is safe, but it now only saves, and
  reads **Saved** and disables itself when there is nothing to save.
- **"Revise" in the editor was a footgun**, and it had already cost data. Revise
  forks a document that has gone out; the builder only ever shows a **draft**,
  because only a draft is editable - so revising created v+1 and stranded the
  draft you were in, under the same number, both editable, with nothing saying
  which was live. `QT-20251216-001` reached **ten versions** (v1-v8 all
  cancelled) and three numbers still held more than one live draft.
  `POST /api/quotations/[id]/revision` now refuses a draft with
  `draft_is_already_editable`, and neither page offers it on one.

**Share was missing from the builder entirely**, which was the real gap behind
the complaint. A draft opens straight into the builder and Share sat only on the
summary, so sending a quotation to a customer meant pressing a button called
"Summary" first. It is the builder's **primary action** now: it flushes any
unsaved work, marks the draft sent and mints the link, which is the whole of
"I have finished this, send it". An incomplete draft is refused by the status
route with the sentence it already had ("12 lines still need a measurement,
quantity or rate"), and the dialog shows it.

**Duplicate came off the builder.** Adding it to both pages three days earlier
was over-applying the rule that an action a draft needs must not live only on the
summary - Duplicate means "a second offer beside a finished one", so it belongs
where the finished one is read.

So the builder is **Reprice · Print · Save · Approve · Share** - five, each a
different verb: change the price, check the document, keep the work, agree it,
send it. **Template** and **Done** went the same day on the instruction "keep the
quotation page very simple and less confusing, I do not want to overload with
features": Done existed only to reach the summary page, and Template asks at the
wrong moment - what a quotation starts from is settled once in the create dialog,
and applying a second template over a priced document is not a thing anyone asked
for. Template survives where it is actually useful: in the **empty state**,
beside "Add Space" and "Bring in from scope", and per space and per component.

**For a draft it is now one page.** The summary is only rendered for a quotation
that cannot be edited, nothing produces `?view=1` any more, and there is no
button out of the editor except the breadcrumb back to the list. That was the
ask, and the boundary is worth knowing rather than assuming: an approved or sent
quotation still opens as the record.

**The summary page was NOT removed**, and the earlier decision is narrower than
it reads: an *editable* quotation opens straight into the builder, so a draft
never **shows** the summary - the page still exists for anything sent, approved
or rejected. The reason to keep it is not Share (that moved) but four things the
builder has nowhere to put: **Version History, Activity, Statistics and the
validity date.** Those are the record, not the document.

**The bigger simplification is still on the table and deliberately not taken.**
The two pages already share the document rendering (`SpaceCard` with `readOnly`),
so the difference between them is chrome: one page, editable when the status
allows, with the record in a collapsible rail, would delete Edit, Done and all
four duplicated buttons - six controls removed by removing a concept rather than
hiding anything, with the action row varying by status instead (draft: Print ·
Template · Reprice · Share · Approve; approved: Print · Duplicate · Revise).
It is real work on the module's two largest files and was not worth bundling into
a tidy-up. Do it when one of them next needs a substantial change.

Two open questions, asked and not yet answered: whether **Template** still earns
its place now that every quotation on a lead starts from the scope (its remaining
use is a standalone quotation with no lead), and whether **Approve** belongs in
the editor at all - it is there only because a draft never showed the summary,
which the merge above would make moot.

### Two false alarms, both from asking a rule-priced line the wrong question

Found 2026-09-24 while the user was testing, and both had the same effect: the
app reported a problem with a document that was entirely correct.

**"45 lines still need a measurement, quantity or rate" blocked sending**, and
then "2 lines still need details" nagged on every save. Both were the same test
written twice and wrong twice, which is why it now lives once, in
**`lib/quotations/line-completeness.ts`**, with a test file naming each
regression:

1. The builder's amber strip demanded a length and width for every area line, so
   43 rule-priced lines read as "need size" (2026-09-22).
2. The send guard had the identical bug: 45 of QT-20260924-001's 97 lines were
   called incomplete and **every one had a quantity, a rate and an amount**,
   with zero lines genuinely missing a rate.
3. Both then read a derived quantity of **0** as a missing measurement - which
   it is not, and which is what kept appearing "every time without any change".

The third is the one worth understanding. `corners` on the kitchen rules is a
field with `default: 0`, because blind corners are exactly the case this file
describes as **0 where the honest answer is "only if somebody says so"**. So a
Blind Corner Pull-out priced per `corners` on a kitchen with no corners derives
0: the rule ran, and the answer is *none needed*. So the distinction that matters
is **"the rule cannot price this"** against **"the rule priced it at nothing"** -
and `deriveQuantities` collapses both to 0 (`values[key] ?? 0`), so only the
rule's own list of quantities can tell them apart.

That is why `lineShortfall(item, ruleQuantities)` takes the rule as a parameter.
The builder passes `comp.costing`'s quantity keys and gets the precise answer; the
**server deliberately passes nothing**, because it does not load component types
and guessing from the stored number is what refused to send 45 correct lines - so
without the rule a ruled line is judged on its rate alone. Refusing to send a
correct quotation is the worse of the two errors.

The message names the lines and where they are when it does fire, because
"2 lines still need a measurement" on a 97-line quotation is true, blocking and
useless. **A zero-amount line still prints**, though - nothing filters it out of
the PDF - so an item chosen on the Scope Sheet whose rule derives nothing is worth
deleting from the document rather than leaving at ₹0.

**"1 item no longer chosen" was the drift notice reading a deleted row id.**
`metadata.scope_item_id` points at the `property_scope_items` ROW a line came
from, and that row does not survive being re-chosen: one answer per question is
kept by **deleting** whatever else answered it, so clearing a carcass and picking
the same one again produces a new row with a new id. Every line pointing at the
old id then read as dropped while the Scope Sheet said exactly what it always had.
QT-20260924-001's Master Bedroom wardrobe reported "Carcass - Standard no longer
chosen" against a scope that had chosen Carcass - Standard throughout, on a row
created an hour after the quotation.

**Retiring the second preference is what exposed it.** Until 2026-09-24 a
displaced answer was demoted to `p2`, so the row survived with its id. Deleting
it instead is right, and the lesson generalises: **nothing may depend on a scope
row's identity outliving a change of mind.** `scopeDrift` now treats the id as a
hint and the cost item as the answer - a line is dropped only when the scope no
longer chooses that item on that component, so a real swap still reports. The
same set was already being computed one branch away for `not_in_scope`.

### The Scope Sheet is the name; "room sheet" was the old one

Renamed on 2026-09-24 at the user's request. The tab is **Scope**, so the panel
inside it is the **Scope Sheet** - one name for one thing, and one that says
where to find it. It was called the "room sheet" in 75 places across the code,
its comments, this file and `docs/plans/scope.md`, and all of them moved
together: a term renamed in the UI and left in the comments is how the next
person ends up unsure whether they are two different things.

**The applied migrations were deliberately not rewritten.** Twenty-two of their
SQL comments still say "room sheet", and they are the record of what was true
when each was written - editing an applied migration changes the history without
changing the database.

Nothing in storage carried the old word, which is why a clean rename was possible
here and is not for Playbook / procedure: there the tables, the enum and the RPC
are named `procedure_*` and only the words above storage say Playbook. The rule
is the same in both cases - **do not fix a mismatch by half.**

On the create dialog the option reads **"Based on Scope Sheet (recommended)"**
rather than "The Scope Sheet", and the templates read "Based on template: …",
because a dropdown is read collapsed: the chosen value has to say what it means
without the label above it.

### What a quotation starts from is asked once, and honestly

Creating from the scope has been the default since 2026-09-18
(`fromScope: !selectedTemplateId`) - and the empty option on the create dialog
read **"Start from scratch"**, which is the one thing it does not do. So "we do
not see any option to create the quotation from the current scope" (2026-09-24)
was true of the label and false of the behaviour, which is worse than a missing
feature: the person picks a template to avoid the blank document they were
promised, and loses the Scope Sheet they had just filled in.

The control is now "What should it start from?", with **"The Scope Sheet
(recommended)"** as the default and the templates beneath it. On a standalone
quotation there is no property and so no scope, and "Start from scratch" is then
the honest word. Choosing a template says so in amber, because it replaces the
Scope Sheet rather than adding to it.

### One line, one arithmetic

`lib/quotations/line-amount.ts` `lineAmount()` is the only place a line's
money is worked out - the builder's totals, the space and component cards,
the sidebar, the row and Reprice all call it. **Five copies existed and
four ignored `quantityKey`**, so every line priced per a costing rule
counted as zero in a component total, a space total and the sidebar: the
first real quotation read ₹52 lakh in the header and ~₹14 lakh down the
side, the same document disagreeing with itself (2026-09-22). `lineSqft()`
is the same for area.

A rule-priced line needs `deriveQuantities` to have run over its space, or
its derived quantity is missing and it is worth **zero** - deliberately,
because falling back to the stored amount would hide that the rule had not
been applied. The builder passes `viewSpaces` everywhere for this reason,
and the quotation summary page derives too (it rendered the cards from raw
rows until the same day).

### Every way a line gets into a quotation must price it the same

Reviewed 2026-09-24 for conflicts between the quotation module's own features
- templates, cost-item bundles, add component, add item - and the scope copy.
One real conflict, and it was silent:

**A template's lines carried no `quantityKey`.** `addCostItem` looks up what
an item is priced per on that component type and sets it; `copyScopeToQuotation`
does the same; `convertTemplateToSpaces` did not, and did not set
`followsComponent` either. So on any type with a costing rule the same
catalogue item was priced two entirely different ways depending on how it
arrived: a carcass applied from a template had no size and priced at **nothing**,
and hinges arrived as `quantity: 1` - one hinge against the twenty-four the
rule derives. The conversion now takes the priced-per maps, fetched by
`pricedPerForTemplate` for the types the template mentions, because the
conversion is synchronous and the lookup is not.

**A bundle is resolved against its HOST, not its origin.** A cost-item bundle
drops into an existing component that may be a different type from the one it
was saved on - a wardrobe bundle into a crockery unit - so what each item is
priced per is looked up on the target. Carrying the template's key over would
name a quantity the host's rule does not have, and every such line would
derive nothing and price at nothing.

Nothing else conflicts: templates and the scope copy both add only, both use
the catalogue's current rate rather than a stored one, and `metadata.
scope_item_id` is written by the builder's save and by the copy alike, so a
line added by hand is correctly reported as "not in the scope" and a line
brought in from it is not.

### The amber "still need details" strip counts a rule-priced line correctly

`incompleteByComponent` demanded a length and a width for every area line -
but a rule-priced line has neither, by design: its quantity comes from the
component's rule and `deriveQuantities` attaches it at render rather than
storing it. So a quotation built entirely from the scope reported **43 lines
needing a size** that were all correctly priced, on components whose sizes
were typed. It now reads the derived spaces rather than state, and judges a
line with a `quantityKey` by its derived quantity (2026-09-24).

### Expanding a room is not a change to the quotation

The auto-save compares `JSON.stringify` of the whole document, and `expanded`
lives on a space and on a component - so opening a room marked the quotation
unsaved and started a save, which is what "just clicking around makes it try
to save" was. `documentFingerprint()` strips it: expansion is how somebody is
reading the document, not what it says, and it is never sent to the server nor
read back from it. Anything else added to a space or component that is
presentation rather than content belongs in that strip.

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

**But an editable quotation opens straight into the builder**, so for a draft
the summary is never seen - which means **an action only on the summary page
is unreachable exactly when it is wanted**. `Option 2` was one: it needed the
scope's second preferences, which only exist while a quotation is still being
negotiated, and it sat on the page a draft skips (2026-09-24). It was put on
both, and retired the same day with the second preference - the lesson is the
one worth keeping. Before adding an action to the summary page, ask whether it
applies to a draft; if it does, it belongs in the builder's header too.

### The one public path, and what a handler behind it owes

Built 2026-09-24, and it had never worked: `/quotation/[token]`, its
`client_access_token` column, the share route, approve, reject, the PDF and
`QuotationClientView` all existed since before the baseline, and the middleware
redirected every unauthenticated request that was not `/auth/*` or `/` to
sign-in - so a customer opening the link landed on a login page they could never
pass, and nobody outside the business had ever seen the page.

**`lib/auth/public-paths.ts` is the allowlist, and it is the whole wall.** Exact
prefixes, never a pattern: a prefix matches by equality or by the prefix plus
`/`, so `/quotation/abc` is public and `/quotationsecret` is not. Three tests
pin that boundary, because a regex is how `/quotations` ends up public for
sharing six characters with something that is. Adding a path here is a decision
about the product, not a refactor.

**A handler behind it must use the admin client, and then owes every check RLS
was making.** Probed: `anon` gets zero rows on `quotations`,
`quotation_spaces`, `quotation_components`, `quotation_line_items`,
`tenant_quotation_settings`, `clients` and `properties` - so the session client
sees nothing and 404s, which is exactly what the page did. Bypassing RLS makes
the handler the only wall.

`lib/quotations/client-link.ts` `resolveClientLink()` is that wall, in one place
for all four surfaces, because they had already drifted apart:

- **Status.** Readable is `sent`, `approved`, `rejected`; answerable is `sent`
  alone. The page let **any** status through - and a **draft with a live token
  valid for another eleven days** existed on this tenant, so opening the public
  path would have published a price nobody had agreed to show. `superseded` is
  refused with its own sentence, because a bookmarked v1 showing a price that is
  no longer the agreed one is worse than an error.
- **Expiry**, on every surface rather than three of four.
- **A rate limit**, keyed on the token for an answer (10/min) and for a read
  (60/min) - `public_rate_hit()` in the database, not in memory, because a
  per-instance counter on serverless resets whenever a new instance takes the
  request and so counts almost nothing. Fixed window, one row, one statement.
- **No cost column anywhere.** `company_cost`, `vendor_cost` and
  `margin_amount` are on `quotation_line_items`; verified against the rendered
  page that none of the 18 lines' internal figures appears in it.

**Not single use**, which is what this was sized as. A customer opens their
quotation more than once and forwards it to their spouse; a link that dies on
first read would be a broken feature, not a safe one. The controls that fit a
bearer token are the ones above plus revocation, and revocation is the answer to
a link that reached the wrong person - there is no per-person link and no way to
know who opened one.

**Two of those four routes could never have run.** Reject wrote
`status: "negotiating"`, retired on 2026-09-17 as "a fact, not a status", and
the CHECK on the column refuses it - verified against the live constraint. It
now writes `rejected` with the reason, stamps `rejected_at`, and **tells the
seller**: nobody is signed in when a customer answers, so
`quotation_rejected` beside `quotation_approved` is the only way it is heard.
And `/api/quotations/[id]/share` gated its GET and DELETE on **a session with no
permission at all**, so anybody signed in to the tenant could read out a live
customer link for any quotation; it also refuses to share anything but a `sent`
or `approved` document.

**Sharing promotes a draft, and that has to happen BEFORE the link exists.**
`ShareQuotationModal` created the link on open and marked the quotation sent
afterwards - so the moment the share route started refusing a draft, the dialog
became a dead end on exactly the documents people share from. The promotion is
now the first thing the effect does; pressing Share is the deliberate act, and
the note under the buttons has always said so. Two consequences worth knowing: a
draft on a **closed lead** cannot be promoted (the status route refuses a won
lead's quotations), so Share reports that instead of a link - which is correct
and was already true; and the effect is keyed on the quotation **id** with a ref
guard, because it depended on the whole object and any re-render that handed it a
fresh identity **issued a new token**, silently invalidating the link the person
was copying.

**The customer sees the server's sentence.** Both handlers in
`QuotationClientView` checked `response.ok` and did nothing when it was false,
so pressing Approve on an expired link stopped the spinner and changed nothing -
and they press it again. On the one screen a customer ever sees, that is the
least forgivable place to throw a reason away.

Verified end to end against the running app, unauthenticated: a `sent` token
renders the document, a draft reads "Link not active", an expired one "Link
expired", a superseded one "Replaced by a newer version", a bogus one 404s,
`/quotationsecret` still redirects to sign-in, approve supersedes the previously
approved version and refuses the second attempt, the 11th answer in a minute is
429, and the PDF is a real PDF for `sent` and a refusal otherwise.

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

### The calendar is what someone booked for a date

Meetings (`calendar_events`, `lead_activities` / `project_activities` with
`meeting_scheduled_at`), site visits, events, and the follow-up reminders set
on notes. **Not task due dates.** They were derived into it for a while
(typed `task_due`); once every playbook step carried a scheduled due date a
project's Calendar tab was 36 deadlines with the meetings lost among them,
and on 2026-09-16 they came out entirely. A due date is a deadline that falls
out of the plan, and its home is the Plan tab and the Tasks list, where
overdue is already red. The `task_due` type is still known to the calendar's
filters and labels, harmlessly; nothing produces it.

### A file attached to a task is a document, and it is tagged with where it came from

**`task_attachments` is a deprecated, empty table.** A file uploaded on a
task has been a `documents` row since before the baseline — `linked_type =
'task'`, `linked_id` = the task, `parent_linked_*` = its lead or project —
and the project's Documents tab has always read those through
`parent_linked_*`. A migration on 2026-09-16 mirrored `task_attachments` into
`documents` without checking this; it could never fire and was dropped the
same day (`20260916190000`). Before wiring a trigger to a table, check
something writes to it.

What was actually missing was the **tags**. `trg_documents_tag_task` (BEFORE
INSERT on `documents`, task rows only) adds `step: <title>`, `stage: <parent
title>`, `playbook` where the task is in a run, and `space: <name>` where the
file is attached to a per-space tick. The Documents table searches tags, so
"kitchen measurement photos" is a filter. Existing task files were tagged by
the same function.

### A checklist is the ticks inside a step - not a third thing

Decided 2026-09-16 after a proposal with checklist templates, done/check
kinds and a verify permission was rejected as too many concepts. The model:
a **playbook** is the list of work, a **scope** is the list of things, and a
**checklist** is the list of proofs inside one step. A tick has no owner, no
dates and no status - if something needs its own person or its own time it
is a step, and a step owed by the client or a vendor is a `client`/`vendor`
step, which the "waiting on" list already handles. Quality checks are the
*next step*, assigned to someone else, with their own ticks; a failed check
is a reopen with a name on it.

Two flags were added to what already existed (`20260916190000`):

- **`checklist_lines`** on a step, `[{label, needs_photo}]`, edited as a
  proper line list in the playbook editor (the comma box is gone).
  `checklist_items` stays as the plain labels, derived by the API, so nothing
  reading it breaks. **`revise_playbook` enumerates both new columns.**
- **`per_space`** on a step: `create_step_requirements` repeats every line
  once per top-level, non-excluded space of the project's scope, labelled
  "Photograph each wall — Kitchen" and carrying `scope_item_id`. A project
  with no spaces listed gets the plain lines.

**A needs-photo line is ticked by the photo.** `sign_off_requirement`
refuses it by hand; `POST /api/tasks/[id]/attachments` takes
`requirement_id` (must be this task's; an image where the line wants one),
the document carries it, and `trg_satisfy_upload_requirement` ticks that one
line when the row lands. Deleting the last photo on a line unticks it
(`trg_documents_untick_on_delete`). `TaskRequirements` shows a camera button
instead of Confirm on such lines and links the photos.

A batch insert through PostgREST sends an explicit NULL for a column any row
in the batch names — the `step_key` trap again, met here on `scope_owner`.
Name a defaulted column on every row of a batch or on none.

### The Delays panel reads the holds; it never guesses

`GET /api/projects/[id]/delays` (2026-09-17) is the first slice of the
Milestone-2 delay summary. It pairs every `task_status_history` row that put a
plan step on hold (with `hold_owner`) with the next status change of that
task, and counts **calendar days between the two dates** - today while open.
Totals per owner come twice: `totals` (so far) and `expected_totals` (open
holds run to their `hold_expected_until`), because on the day a hold is
recorded "7 days on the client" is the expected figure, not yet the elapsed
one. Beside them, the agreed end (latest baseline) against the current
`expected_end_date`.

**A step that ran long with no hold is not in the list.** That is the
deliberate reading: a delay nobody pressed Pause for has no owner, and the
panel says so ("no hold recorded - the plan moved without anyone being
named") rather than inferring one. The row's one-click Pause records owner
and reason but not "until"; a held task therefore offers **"Set until
when…"** beside its hold line (task page and edit modal), which opens the
same dialog filled from the hold in effect - `PATCH /api/tasks/[id]` writes
the change to the task and to the running history row, and the scheduler
re-lays the plan around the date. Until that existed the details dialog was
unreachable.

### A button must not disable itself because of the click that opened it

Deleting a scope row took two clicks, and only after editing something on it
(2026-09-23). The sequence: **mousedown** on the trash button blurs the field
you were in, the blur fires the row's PATCH, `patchItem` sets `savingId`, and
the delete button's `disabled={savingId === item.id}` turns it off between
mousedown and mouseup - **a disabled button fires no click at all**. The
second press worked because the save had finished by then.

`savingId` existed for that one guard and nothing else, so it is gone; the
Saved indicator already reports the save. Delete during an in-flight PATCH is
safe on its own terms - the DELETE supersedes it - and the one real hazard,
the PATCH's failure path restoring a row that has just been deleted, is
closed by a `removed` ref: ids go in before the DELETE is sent, come back out
if it is refused, and `patchItem` stays silent for a row that is in it rather
than reporting a failure caused by the delete itself.

The general rule, worth applying anywhere a control both saves and acts:
**never let a control's own gesture disable it.** Blur, focus and hover all
fire before click, so any state they set is applied before the click is
delivered.

### Scope rows say who does them

`property_scope_items.scope_owner` — `us` (default), `client`, `vendor`
(with `scope_vendor_name`), `excluded` — on spaces and components alike,
edited in the **Done by** column of the Spaces tab. It is the one addition
the scope list needed: a kitchen is ours and its counter top is the client's.
`excluded` rows are skipped by per-space ticks and are named so that "that
was never in scope" has an answer. Client/vendor rows are **not** raised as
"waiting on" asks automatically — one ask per client-supplied item would
drown the list; that is a button for later if wanted.

### The projects list shows the agreed end against the current one

After kick-off the Timelines cell reads "Agreed 10 Dec → now 22 Dec (+12d)":
the agreed end is the latest `plan_baselines` version's end, the current end is
`expected_end_date`, which the scheduler moves as the plan moves. Before
kick-off the cell keeps its planned-dates reading, because there is no agreed
plan to compare against. The list route resolves the baseline in one query for
the page rather than per project.

### Delay reasons are configured, not hard-coded

Settings → Delay reasons (`/dashboard/settings/delay-reasons`, gated on
`settings.company.update` like Config) lists what a hold can say, grouped by
owner. Shipped defaults (`tenant_id` NULL) are read-only and shared by every
business; a tenant adds its own beside them, may hide one, and may remove only
its own. A hidden reason stays on the holds that used it - `hold_reason_code`
is a string, not a foreign key, on purpose. `GET /api/delay-reasons` answers
active rows for the hold dialogs and `?all=1` for the settings page; the
client hook caches the list and `invalidateDelayReasons()` drops it after an
edit. New codes are `<owner>_<slug>` so the unique default codes never collide
with a tenant's.

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

`PlaybooksPanel` moved off the project's Tasks tab. The panel that starts a
playbook was on a different tab from the one where the plan appears, so a
project with no plan showed nothing that said a playbook was even an option.

It now sits on the Plan tab and only when there is no active run, so stopping a
playbook makes it reappear and "stop this and use a different one" is one flow
in one place. A project with no run shows this panel (to `tasks.edit` holders)
or a "no plan has been set" note (to everyone else) — there is nothing else it
could show, because a playbook is the only plan there is.

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

**The lead's Overview tab had the same third-leg gap** (2026-09-23):
`configuration` is on the create form, starred on the edit dialog, asked by
the qualify transition and selected by the GET - and drawn by nothing, so a
reader could set it and never see it again. Added, with five more the record
carried and no tab showed: **in this stage since** (`stage_changed_at`),
**next follow-up** and **last activity** (both on the leads list but nowhere
on the lead), **won on**, and **why it ended** - `lost_reason`/`lost_notes`
and `disqualification_reason`/`disqualification_notes`, written by those
transitions and read nowhere, shown only when set. Every other lead column
is plumbing or in the header. The client's `city`/`address_line1`/`pincode`
are selected by the GET and **deliberately still not shown**: no form writes
them, so they would be three permanently empty rows.

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

### Handover attaches the quotation; it does not copy it

Changed 2026-09-15 (migration `20260915090000`). Marking a lead won used to run
`copy_quotation_to_project()`, duplicating the quotation and its whole tree -
header, spaces, components, every line item - under a fresh
`PRJ_<date>_<random>` number, then pointing the project at the duplicate. Two
facts made that pointless:

1. **An approved quotation cannot be edited.** `PATCH /api/quotations/[id]`
   refuses `sent`, `approved`, `rejected` and `superseded` and tells you to
   revise; a revision inserts a new row. The copy froze what status already
   froze.
2. **The original was already attached.** `lock_quotation_for_project()` sets
   `linked_to_project_id`, and the approved quotation carried `project_id` too.
   The association the copy existed to create was already there.

The transition now sets `project_id` on the approved quotation (the project's
Quotations tab queries `?project_id=`, so `linked_to_project_id` alone is not
enough) and points `projects.quotation_id` at it.

`copy_quotation_to_project()` is **kept and commented as no longer called**, not
dropped - removing it in the same change that stops calling it would remove the
way back. Do not call it from new code.

`quotations_one_approved_per_lead` lost its `AND baseline_quotation_id IS NULL`
exemption, which existed only so a handover copy could sit approved beside its
source. Verified after the change: approving a second quotation on one lead is
refused by the index.

`baseline_quotation_id` stays on the schema. It is a **chain-root pointer** -
"references the first version (V1/baseline) of this quotation" - which is why a
baseline points at **itself**; that was never a defect. It is the right shape for
delivery variations when those exist, and costs nothing left null.

The one historical copy, `PRJ_20251219_2158 v1`, was first superseded and then
**deleted** (`20260915100000`). Keeping it was the wrong call for a reason that is
not about correctness: a third quotation on the project, numbered from another
module, is a question every reader has to answer before they can trust the screen.

It was safe to delete because it carried nothing unique - verified first, not
assumed: same `grand_total`, `subtotal` and `tax_amount` as `QT-2025-0004 v2`, the
same 5 spaces / 6 components / 17 line items, and every line's
quantity/rate/amount identical.

**That migration guards rather than guesses.** It refuses with an exception if
anything still references the copy, if no approved quotation remains on the lead,
or if the copy and the original are not equivalent - so a database in a different
state gets an error instead of a silent deletion. Children are deleted explicitly
rather than trusting `ON DELETE CASCADE`, because whether each table carries one
is not a thing to discover by deleting a parent.

**No quotation in the database has `baseline_quotation_id` set any more.** The two
filters in `quotations/[id]/status` that skip baselines are therefore pure no-ops
now; they are kept because the column stays and the day variations arrive they are
correct again.

**Quotation numbering has four historical formats** - `QT-####-####`,
`QT-######-####`, `QT-########-###` and the one `PRJ_########_####` baseline. The
scheme changed twice and old rows keep their numbers; renumbering history would
break every reference in somebody's inbox. New quotations are `QT-` only.

### A lead's meetings live in two tables

"Add event" on a lead's Calendar tab writes a **`lead_activities`** row with
`meeting_scheduled_at` set - not a `calendar_events` row. `calendar_events` holds
standalone entries and anything created from the global calendar. The calendar
itself merges both sources when it draws, which is why the split was invisible
from the screen.

It was not invisible from the leads list. `upcoming_items` first read
`calendar_events` alone, so a stale test event from February showed as "216d
late" while the meeting booked that morning from the lead's own tab did not
appear at all. The list now reads both, each as `kind: "calendar"`, and shows
open meetings **whatever their date** - the same rule follow-ups and tasks
already followed. A meeting booked and never marked done is owed: it either
happened and wants closing, or did not and wants rebooking.

**Anything that asks "what meetings does this lead have" must read both tables**
or it will answer for half of them.

### The projects list mirrors the leads list, column for column

Project (name, with client · service type · property · property type beneath),
Stage, Status, Priority, Assigned To, Progress, Last Activity, Follow-up. A
seller and a project manager walk past a list asking the same three things -
what is it, where has it got to, what is owed next - and the two lists used to
answer them differently.

**A project can be on more than one stage at once.** A playbook can run stages
in parallel (`allow_parallel`), so "which stage is this on" honestly has two
answers - Procurement and 3D Design together is the normal shape of a fit-out.
`stage_summary.active` carries every in-progress stage; `currentIndex` picks one
and would have hidden the other. When nothing is active, `next` names the first
not-started stage so a project between stages says where it is going rather than
showing a dash. `breakdown` carries every stage's progress for the hover on the
bar - a plain `title` attribute, deliberately, so the feature costs the page
nothing.

Stage and Progress are **one column**, because they are one fact seen two ways.
The **client is the headline** of the first column, with the project name and
its facts beneath: a project is known by who it is for, and the generated name
repeats the client anyway. The project number is not shown - it is searchable and
on the detail page.

The filter bar is one line: search, Status, Stage. Priority and Property Type
came off as dropdowns because the search finds them, and four dropdowns under a
search box made a second toolbar out of what should be one. Completed and
cancelled projects are hidden by default, which the Status filter already did.

**Timelines projects the end date from progress to date.** `projectTimeline()`
in `ProjectsTable` extrapolates a straight line: 30% done in 60 days means ~200
in all, so it ends around start + 200. Crude, and the hover says so, but it is
the arithmetic anyone does in their head and it is right far more often than the
planned end once the work is under way. Green within plan, amber up to 14 days
over, red beyond; the planned dates sit beneath as the reference.

It refuses to guess where guessing would mislead, and each refusal is a finding
in its own right: no recorded start with the planned start still ahead says
"Starts 1 Oct" - and flags **"9% done with no start recorded"** in amber when
work is being logged against a project the record says has not begun, which is
PRJ_20251219_0001 today. Nothing done yet has no pace, so it says how far past
the planned end the project is - PRJ-25-0002 reads "167d past planned end".
**Nothing wrote `projects.actual_start_date` until 2026-09-15.** Not the status
change, not a task starting, not the edit dialog. The old phase engine had its
own `actual_start_date` and a function that stamped it, which is where the
assumption that "something sets this" came from. So every project carried
planned dates and no actual ones, and the Timelines column had nothing to
project from.

Now (`20260915110000`): **a project starts when its first task does.**
`trg_project_actual_start_from_task` carries `tasks.first_started_at` up to the
project the first time it is set, and never overwrites a date already there.
`PATCH /api/projects/[id]` stamps today when the status is moved to
`in_progress` by hand, for a project with no tasks yet. The backfill
set `PRJ_20251219_0001` to 2026-09-03 - its first task's start, four weeks before
the planned 1 Oct - and its Timelines went from "Starts 1 Oct · 9% done with no
start recorded" to "Ends ~14 Jan · 17d ahead of plan".

**Stage is derived, not read.** `GET /api/projects` runs the same derivation as
`GET /api/projects/[id]/stages` - a stage is a top-level playbook step - but
batched across the page: one query for every active run, one for their tasks,
one for step order. The `current_phase_id` column it used to read was a second
copy of a fact the tasks already hold, and it was the copy that went stale; the
column is gone. `current_phase` on the list response is still the derived
stage name, for the Stage filter that reads it.

**Last Activity and Follow-up are the leads list's own cells.**
`components/leads/activity-cells` holds `LastActivityCell` and `FollowUpCell`,
extracted from `LeadsTable` where they had been refined three times, and both
lists render them. They draw from `components/leads/activity-icons`. The label
map is a parameter because lead and project activity types are different enums
that happen to overlap.

The list API enriches each project the way the leads list does: the last three
`project_activities`, and the next three of project-note follow-ups, open tasks
and booked meetings. Meetings are read from **both** `calendar_events` and
`project_activities.meeting_scheduled_at`, for the reason the leads list reads
both of its tables.

**Assigned To comes from `tenant_directory`**, not the
`project_manager:users!project_manager_id` embed - that embed resolves for the
caller and returns null for every colleague, so the column would have read
"Unassigned" on any project managed by someone else.

### Notifications are written by the route that made the change

Built 2026-09-18, in-app only; `docs/plans/notifications.md` has the event
table. The baseline's `notifications` / `notification_preferences` tables
are reused; `type` became text (`lib/notifications/kinds.ts` is the list)
and the one producer that existed - a trigger telling every Owner / Admin /
Manager / Sales Manager about a won lead, an audience chosen by role slug -
is gone.

**One rule**: a person is told about something they own or were just given,
by the route that gave it to them, through `notify()`
(`lib/notifications/notify.ts`). The route already decided that person may
know, so nothing here widens access - and there is no "notify a role". The
actor is never told; a preference row saying no is honoured; a failure to
write a notice never fails the change it describes. The client portal's
approve is the one producer on the admin client (no session).

**Delivery is Supabase Realtime** on the table, filtered to the signed-in
person and scoped by the same own-rows RLS; `NotificationsProvider` in the
dashboard shell holds the one subscription per tab, and the bell, the
bottom-right slider and `/dashboard/notifications` all read from it. The
slider shows only rows that arrive while the tab is open. Names come from
`tenant_directory`; the old `users` embed returned null for every colleague.

`dedupe_key` is unique per person and always present (random when the
caller has none), so the reminder job that comes next can write
`<kind>:<entity>:<date>` and never nag twice. A partial unique index was
tried first; PostgREST's `on_conflict` cannot infer one.

### Functions run next to the database, and a session is verified locally

The Supabase project is in Mumbai (`ap-south-1`); Vercel's default function
region is Washington (`iad1`). `vercel.json` pins functions to `bom1`,
because every one of the several round trips a request makes was crossing
two oceans (2026-09-17: "every request through the Vercel site is slow").

`lib/auth/verify-session.ts` `getVerifiedUser()` is what the API guard and
the middleware call instead of `supabase.auth.getUser()`, which was a trip
to the Auth server on every API call and every navigation before a single
row was read. It verifies the token against the project's JWKS, cached per
server instance for ten minutes. **It is only faster once the project has
migrated to asymmetric JWT signing keys** (Supabase → Project Settings → JWT
Keys); with the legacy shared secret the key set is empty and supabase-js
falls back to the Auth server, so the change is safe either way. The other
eighteen `getUser()` calls (client hooks, settings pages, a few routes) are
not on the hot path and were left alone.

## Tests

`npm test` runs vitest over `src/**/*.test.ts` - the pure pieces that turn a
customer's measurement into a price, none of which touch the database:
the formula evaluator (`lib/costing/formula`), the costing rule
(`quantify`, `validateCosting`, `mergeMeasures`), the option shapes
(`lib/scope/options`), **when a quotation line is incomplete**
(`lib/quotations/line-completeness` - the one test that has now caught the same
class of bug three times) and the **public path allowlist**
(`lib/auth/public-paths`, where the test that matters is the one proving
`/quotationsecret` is not public). Added 2026-09-21; the first run found that
`validateCosting` refused a quantity sharing a field's key, which every
seeded rule does (`shelves: shelves`), so the wardrobe calculator could not
have been saved as seeded. When a rule about pricing changes, change its
test in the same commit; a wrong hinge formula ships straight to a
customer's number.

## A new tenant starts with the starter catalogue

`seed_tenant_catalogue(target, source)` (`20260921090000`, service role
only) copies a tenant's space types, component types with their rules and
applicable spaces, categories, cost items (rates as starting values; vendor
links and purchase history left behind), offers and presets into a tenant
that has none, remapping every id, and refuses a tenant that already has
component types. `createTenant()` calls it at signup with
`STARTER_CATALOGUE_TENANT_ID` - today the dev tenant; a tenant kept as the
platform's starter is the right owner of that id. **Before this, signup
made a tenant with no catalogue at all**: a blank Scope tab, a blank
quotation, nothing to pick on the lead form - and the seed script only ever
ran against tenants that already had items. Verified by seeding a
throwaway tenant (694 offers, 29 types, remaps checked) and deleting it.
Shipped rows with `tenant_id NULL`, as roles and playbooks do it, would be
the fuller answer; it needs six tables' RLS and copy-on-edit and was not
worth it before a second subscriber exists.

## Traps that have already cost time

- **supabase-js fires `SIGNED_IN` when an idle tab comes back**, the same
  event as a real login. `useUserPermissions` treated it as one - wiped
  every permission, emptied and refilled the sidebar, re-rendered every
  gated block - and `useCurrentUser` flipped to loading on any refetch, so
  everything showing the user blinked too: "the page refreshes whenever I
  come back to the tab" (2026-09-22). Now a `SIGNED_IN` for the **same user
  id** is a quiet background refetch, like `TOKEN_REFRESHED`; only a
  different person resets. A refetch behind a user already on screen never
  sets loading. The Tasks page's own visibility refetch is quiet for the
  same reason. Any new hook listening to auth events must follow this.

- **Do not re-select `users` for the tenant; the guard already has it.**
  `POST /api/quotations` read `users` through the session client for a
  `tenant_id` that `guard.user.tenantId` was already holding, and answered
  **"Failed to get user tenant"** with a 500 when it came back empty - on the
  way to creating a second quotation, with nothing the person could do about
  it (2026-09-24). `users` is the one table whose only SELECT policy is
  `id = auth.uid()`, so it is the worst table to ask a redundant question of.
  The calendar carried the same read and lost it for the same reason. Three
  more remain in `quotations/[id]` and `quotations/[id]/revision`.
- **A control that appears seconds after the page settles reads as a bug.**
  The since-retired Option 2 button was drawn from a `scope-drift` read; done
  in its own effect it arrived two seconds late. That first read happens
  inside the load, before `isLoading` clears, and the standing effect only
  refreshes after a save - the same reasoning as the Plan tab's buttons waiting for
  their gates rather than appearing and then changing their minds.
- **A new API route directory can leave the dev server 404ing.** Turbopack did
  not register `src/app/api/scope-packages/` until a file inside it changed:
  `curl` gave 404 while the sibling `scope-presets` gave a clean 401, and
  `touch`ing the route file fixed it. Nothing is wrong with the code and the
  production build has it. **Before debugging a route that "does not work",
  curl it** - a 404 beside a 401 on its neighbour is the whole diagnosis, and
  a restart is the fix.
- **A `const` read inside an arrow function is not checked for use-before-
  declaration.** `CHOICES` sat in the Scope Sheet's render block six lines
  *below* the three `costing.fields.filter((f) => CHOICES[f.key])` calls that
  read it. TypeScript says nothing - the reads are inside arrow functions, so
  it cannot know when they run - and `tsc`, eslint and the tests were all
  clean while **every expansion of a component with a costing rule** threw
  `Cannot access 'CHOICES' before initialization` at runtime. It is module
  level now. A fixed lookup table has no reason to be rebuilt per render, and
  putting one at module level is what makes the ordering impossible to get
  wrong.
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
- **`/api/settings/quotation-cost-items` pages at 50, and the Catalogue
  screen read one page.** Invisible at 43 items; at 105 whole categories
  vanished, in an order set by category UUID, and "where is Installation
  Labour coming from?" was the symptom. The screen reads every page now.
  Before drawing a whole set from a paged API, read its `pagination`.
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
