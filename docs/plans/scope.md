# Scope (was Spaces)

Brainstormed and decided 2026-09-18. The plain-language plan for the module
that runs from the showroom conversation to the last site visit.

## Words

**Scope** is the tab, the menu and the concept: what we are doing for this
customer. A row inside it is still a **space** (Kitchen) or a **component**
(tall unit). `property_scope_items` is unchanged as the store - it hangs
off the property so a lead and its project share one set of rows.

## Decisions

1. **Scope says what; the quotation says how much.** No price ever lives
   on a scope row.
2. **The quotation pulls from the scope on demand and never syncs.** Every
   new quotation and every revision starts pre-filled from the scope. A
   draft has a "Bring in from scope" action that **adds only what is
   missing** - it never changes or removes a line the seller already has.
   A row whose `scope_owner` is `client`, `vendor` or `excluded` is **not
   brought in at all**: it is not ours to price. (Re-affirms "Spaces and
   quotations stay independent" in CLAUDE.md.)
3. **Presets are curated.** "2BHK modular", "Kitchen only" live under
   Settings → Catalogue beside space and component types, gated like the
   catalogue. A seller may not save one from a lead. Components arrive
   with the catalogue's default sizes.
4. **After kick-off the scope stays editable to anyone with project edit;
   every change is logged**, and the project manager is notified. A formal
   approval gate waits for variations to exist.
5. **No customer interaction.** The scope, its references and its
   discussion are the tenant team's. A read-only view for a customer to
   follow discussion points may come later; nothing is designed
   customer-facing now, and there is no "internal" toggle to maintain.

## The journey, and what each stage needs

### 1. Enquiry - a usable scope in five minutes
- **Presets** lay down spaces and their usual components in one click.
- **Floor plan first**: the builder's plan or CAD uploaded as the scope's
  cover, one click away while sizes are entered.
- **Services wanted**: a checklist drawn from the catalogue's cost
  categories (modular, carpentry, false ceiling, painting, electrical…),
  so "asked for" can later be read against "quoted".

### 2. Requirement gathering - the sales-cycle memory
- **Preferences** on the scope and per space: style (library styles),
  finishes (catalogue vocabulary), budget band, open to carpentry,
  timeline notes.
- **References** per space: uploads stored as Documents tagged
  `space: <name>`, promotable to the Design Library; library entries
  pinnable to a space.
- **Discussion** per space and component, each entry a note or a
  **decision**.

### 3. Measurement → quotation - no re-entry
- Builder opens pre-filled from scope; "Bring in from scope" adds what is
  missing (decision 2).
- Measurement status (`rough` / measured) shows on the quotation line.

### 4. Project - the working register and the change repo
- **Client-supplied detail** on a row: make/model, size, who procures,
  expected by. Ours / theirs / vendor / excluded on one list.
- **Walkthrough mode**: space by space with drawings, references,
  decisions and the thread, for sitting with the customer.
- **Change log** on every row after kick-off: who, when, what, why.
  Drawings are re-uploaded as new documents on the space, each with the
  decision that caused it - the repo is the log plus the decisions, not a
  CAD versioning system.
- A comment marked "needs rework" can spawn a task on the right step.

## Not doing
- Prices on scope. Live scope↔quotation sync. File versioning. A customer
  editing anything.

## Build order
1. Rename · presets · services wanted · floor plan first.
2. Quotation starts from scope every time · "Bring in from scope".
3. Preferences · references · discussion with decisions.
4. Client-supplied detail · walkthrough · change log · rework → task.
