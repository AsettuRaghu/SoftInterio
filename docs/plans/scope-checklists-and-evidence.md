# Scope, checklists and evidence

Status: **built** · 2026-09-16 · v2, the simple model

v1 proposed checklist templates, "done" and "check" lists, a verify
permission and a site log. It was rejected as too many concepts for one idea.
This is what was agreed and built instead.

## Three lists, one question each

| | Answers | Same for every project? |
|---|---|---|
| **Playbook** | *How* do we do a project of this kind? Stages, steps, hours, who. | Yes — written once in Settings |
| **Scope** | *What* are we building on *this* project, and who supplies each part? | No — per project, on the Spaces tab |
| **Checklist** | *What must be true* before a step counts as done? | Part of the step — its ticks |

The playbook is a list of **work**, the scope a list of **things**, and a
checklist a list of **proofs** inside one piece of work. A checklist is never
a thing on its own.

```
Playbook
└── Stage          "2D Design"
    └── Step       "Site measurement"          ← has an owner, dates, hours, a clock
        └── Ticks  ☐ Measure all walls          ← no owner, no dates: ticked or not
               ☐ Photograph each wall  📷
```

**Rule of thumb:** if it needs its own person, its own time or its own date,
it is a step. If it is just something that must be true before the step is
done, it is a tick. So a tick can never be owed by the client or a vendor —
that is a step marked *Done by: client / vendor*, which the "waiting on" list
already tracks. A quality check is the *next step*, assigned to someone
else, with its own ticks; a failed check is a reopen with a name on it.

## What was added

Three small things, on top of what already existed.

1. **Done by** on every scope row (Spaces tab): *Us / Client / Vendor / Not
   in scope*, on spaces and on components inside them. Vendor rows name the
   vendor.
2. **A proper tick editor** on a checklist step in the playbook editor — one
   line per tick, with a **📷 photo** flag. A photo line is ticked by
   attaching the photo, not by hand; deleting the last photo unticks it.
3. **Once per space** on a checklist step — its ticks repeat for every
   space in the project's scope: "Photograph each wall" becomes one line per
   room, each knowing its room.

Every photo lands on the project's Documents tab (it always did) and is now
tagged with its **stage**, **step**, **space** and **playbook**, so "kitchen
measurement photos" is a filter.

## What this gives you

- **Trackable** — every step has a status and a clock; every tick has a name
  and a time; every photo has a stage, a step and a space.
- **Accountable** — every step has an owner; every delay has an owner and a
  reason; a client- or vendor-owned step is a "waiting on" entry; scope rows
  say who does them.
- **Measurable** — hours planned vs actual per step; days agreed vs actual per
  stage; delay days per owner; reopens per step; photos per space.

## Not built, on purpose

- Checklist templates shared across playbooks — copy the lines; revisit if
  the same ten lines appear in many steps.
- A separate "check list" ticked by a verifier — it is the next step.
- A daily **site log** for progress photos — Milestone 2, with the phone view.
- Client/vendor scope rows raised as asks automatically — a button if wanted.
