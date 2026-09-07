-- Migration: add 'blocked' to task_status
-- Created: 2026-09-03
--
-- Must be its own migration: Postgres will not allow a new enum value to be
-- USED in the same transaction that adds it, and the next migration
-- references 'blocked' inside a view definition.
--
-- 'blocked' is deliberately distinct from 'on_hold':
--   on_hold = we chose to park this   (counts against us)
--   blocked = waiting on someone else (counts against them)
-- Keeping them apart is the whole reason hold analytics are worth anything.

ALTER TYPE "public"."task_status" ADD VALUE IF NOT EXISTS 'blocked' AFTER 'on_hold';
