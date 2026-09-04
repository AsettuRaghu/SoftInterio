-- Migration: allow documents to link to a task
-- Created: 2026-09-03
--
-- Its own migration because Postgres will not let a new enum value be USED in
-- the transaction that adds it, and the next migration inserts rows with it.
--
-- documents is described in its own comment as "Unified document storage for
-- all modules". Tasks were the one exception - there was no way to link a
-- document to a task, which is why task_attachments existed as a parallel
-- table. This closes that gap.

ALTER TYPE "public"."document_linked_type" ADD VALUE IF NOT EXISTS 'task';
