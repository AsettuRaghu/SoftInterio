-- Expand the lead and project activity enums so every user action can be
-- recorded on the timeline.
--
-- Until now only creation events were logged: adding a note, uploading a
-- document, creating a task. Editing a note, resolving a follow-up, changing a
-- lead's owner or budget - all left no trace, so the timeline could not answer
-- "who changed this, and when".
--
-- Postgres allows ALTER TYPE ... ADD VALUE inside a transaction as long as the
-- new value is not USED in that same transaction. This migration only adds
-- them; application code starts writing them afterwards.
--
-- IF NOT EXISTS makes this re-runnable and tolerant of the two enums having
-- drifted apart (they were defined separately and are not identical).

-- Leads -----------------------------------------------------------------

ALTER TYPE lead_activity_type_enum ADD VALUE IF NOT EXISTS 'lead_created';
ALTER TYPE lead_activity_type_enum ADD VALUE IF NOT EXISTS 'lead_updated';
ALTER TYPE lead_activity_type_enum ADD VALUE IF NOT EXISTS 'note_updated';
ALTER TYPE lead_activity_type_enum ADD VALUE IF NOT EXISTS 'note_deleted';
ALTER TYPE lead_activity_type_enum ADD VALUE IF NOT EXISTS 'document_deleted';
ALTER TYPE lead_activity_type_enum ADD VALUE IF NOT EXISTS 'follow_up_scheduled';
ALTER TYPE lead_activity_type_enum ADD VALUE IF NOT EXISTS 'follow_up_completed';
ALTER TYPE lead_activity_type_enum ADD VALUE IF NOT EXISTS 'follow_up_cancelled';
-- task_assigned has been in the TypeScript LeadActivityType union all along but
-- was never added to the enum, so any code path writing it would have failed.
ALTER TYPE lead_activity_type_enum ADD VALUE IF NOT EXISTS 'task_assigned';

-- Projects --------------------------------------------------------------

ALTER TYPE project_activity_type_enum ADD VALUE IF NOT EXISTS 'project_updated';
ALTER TYPE project_activity_type_enum ADD VALUE IF NOT EXISTS 'note_updated';
ALTER TYPE project_activity_type_enum ADD VALUE IF NOT EXISTS 'note_deleted';
ALTER TYPE project_activity_type_enum ADD VALUE IF NOT EXISTS 'document_deleted';
ALTER TYPE project_activity_type_enum ADD VALUE IF NOT EXISTS 'follow_up_scheduled';
ALTER TYPE project_activity_type_enum ADD VALUE IF NOT EXISTS 'follow_up_completed';
ALTER TYPE project_activity_type_enum ADD VALUE IF NOT EXISTS 'follow_up_cancelled';
ALTER TYPE project_activity_type_enum ADD VALUE IF NOT EXISTS 'assignment_changed';
ALTER TYPE project_activity_type_enum ADD VALUE IF NOT EXISTS 'stage_changed';
