# Task rules — test sheet

Every rule a task obeys, with how to try it and what should happen. Each
applies on the **Plan tab** of a project and on the **Tasks** page alike
unless marked *plan only*. Use Dileep (PRJ_20251219_0001) — it is test data.

Where to look: the Timer buttons and Status dropdown on the row; a refusal
arrives as a white toast at the bottom of the screen with the reason.

## A. Who owns the work

| # | Rule | Try | Expect |
|---|---|---|---|
| A1 | Nothing goes in progress without an owner | Set a **To Do** step to *Unassigned*, press ▶ | ▶ is greyed; hover says *Assign someone first*. Pick a name → ▶ live. |
| A2 | Same for Resume | Pause a step, set *Unassigned*, press ▶ | Greyed, same reason. |
| A3 | Same for Reopen | On the task page of a completed task, clear the assignee, press Reopen | Refused: *Assign this task to someone before starting it.* |
| A4 | Complete needs an owner | *Unassigned* To Do step, press ✓ | ✓ greyed; hover says *Assign someone first*. |
| A5 | A running task cannot be unassigned | Start a step, then choose *Unassigned* | Row stays as it was; toast: *This task is in progress – assign it to someone else, or pause it before unassigning.* Reassigning to another person works. |
| A6 | A playbook-fixed assignee cannot be changed *(plan only)* | Mark a step's assignee in the playbook (Owner → person), commit, then change the assignee on the plan | Refused unless you hold `tasks.edit_all` (Admin/Manager/Owner do, so test with a Project Manager). |

## B. Order of work *(plan only)*

| # | Rule | Try | Expect |
|---|---|---|---|
| B1 | Start waits for a *must* predecessor to finish | Press ▶ on "3D Designing and Rendering" while Layout Drawings is open | ▶ greyed; hover: *Waiting for Layout Drawings to finish*. |
| B2 | A *should* link does not block | Press ▶ on the stage "3D Design" while 2D Designs is still running | Allowed (it is a *should* link in v9). |
| B3 | Starting a step starts its stage | Stage "Client Selections" is To Do; press ▶ on "Selection Discussion" (assigned, predecessors done) | Both go In Progress together. If the stage itself cannot start (no owner), the step is refused with *Its stage "Client Selections" cannot start yet: …*. |
| B4 | Pausing a stage pauses its running steps | Start a stage and one of its steps; pause the stage | Step is On Hold too, carrying the same who/why. |
| B5 | Resuming a stage does not resume its steps | Resume the stage from B4 | Stage In Progress; the step stays On Hold until resumed itself. |
| B6 | Cancelling a stage cancels its open steps | Status dropdown on a stage → Cancelled | Every To Do / In Progress / On Hold step under it → Cancelled; completed ones untouched. |

## C. Finishing

| # | Rule | Try | Expect |
|---|---|---|---|
| C1 | Complete waits for open subtasks | ✓ on a stage with an open step | ✓ greyed; hover: *N subtasks still open*. |
| C2 | Complete waits for a requirement | ✓ on "Site Measurement Collection" with no file attached | ✓ greyed; hover: *Attach at least one file*. Attach on the task page → ✓ live. |
| C3 | Completing a never-started task records zero work | ✓ on a To Do step (assigned) | Done 0:00:00; start and end stamped the same. |
| C4 | Done reads green or red | Complete a step under its hours; another over | *Done h:mm:ss* green / red; due-date chip *Nd early* / *on time* / *Nd late*. |
| C5 | Reopening a step reopens its completed stage | Complete every step and the stage; reopen one step from its task page | Stage goes back to In Progress. |
| C6 | Skipped and cancelled can be reopened | Task page of a skipped/cancelled task → Reopen | Back to In Progress (owner required, A3). |
| C7 | Skip only where the playbook allows *(plan only)* | Task page → Skip on a non-skippable step; then on a skippable one without a reason | Refused: *This step cannot be skipped* / *A reason is required*. |

## D. Editing

| # | Rule | Try | Expect |
|---|---|---|---|
| D1 | A finished task is not edited | On a completed row, change priority / assignee / date (edit modal, since the row is read-only) | Refused: *This task is completed. Reopen it to change its priority.* Description and tags still save. |
| D2 | Due cannot be before start | Set due earlier than start | Refused: *The due date cannot be before the start date.* |
| D3 | Hours cannot be negative | Enter −4 hours | Refused. |
| D4 | Plan step names are not renamed inline *(plan only)* | Click a step's name on the plan | Nothing (the tasks page still renames inline). |
| D5 | A hand-set date pins the step *(plan only)* | Change a step's due date on the plan | Later steps re-lay around it; the date stays where you put it after any refresh. |
| D6 | Playbook steps cannot be deleted *(plan only)* | Delete from the task page | Refused: *playbook step*. |

## E. The row itself

| # | Rule | Try | Expect |
|---|---|---|---|
| E1 | Buttons and status move together, once | ▶ then ‖ then ▶ then ✓ | Each click: badge and buttons change instantly and **do not flicker** back. |
| E2 | Clock is steady | Start, watch 30 s, pause, resume | One second per second; pause freezes at the shown value; no jumps on resume or after a refresh. |
| E3 | Dropdown drives the buttons | Choose In Progress / On Hold / Completed from the Status dropdown | Timer buttons follow, same rules as the buttons (owner, predecessors, requirements). |
| E4 | Refusals are toasts | Any refused action | White card, bottom-centre, the server's sentence; the row is unchanged. |
| E5 | Client/vendor holds know who *(plan only)* | Pause "Site Clearance Ready" (client) | Instant; no dialog; the hold carries *client · site not ready* (visible on the task page). |

Tick each row as you go; anything that does not match, note the row id and
what you saw.
