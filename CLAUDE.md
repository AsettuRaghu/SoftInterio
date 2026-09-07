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
- **Never `next build` in this directory** while `npm run dev` is running; it
  corrupts the dev server's `.next`. Build from a hardlinked copy.

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

- `sendEmail()` is stubbed and returns success without sending
- Vercel deployment unfinished — `NEXT_PUBLIC_*` vars are needed at build time
- Cover page is wired but dormant; needs an uploaded image
- Terms are rendered live from the clause library, not snapshotted onto the
  quotation — that belongs with an approve-then-send flow
