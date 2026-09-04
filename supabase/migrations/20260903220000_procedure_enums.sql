-- Migration: enums for the Procedures engine
-- Created: 2026-09-03
--
-- Its own migration: Postgres will not let a new enum value be USED in the
-- transaction that adds it, and the next migration references both of these.
--
-- 'skipped' is a first-class task outcome, not a flavour of cancelled. On site
-- a step often genuinely does not apply - the shutter finish was decided in
-- the showroom, so no sample photo is needed - and "how often is this step
-- skipped?" is a real question about whether a procedure is well designed.
-- Folding that into 'cancelled' would lose it.
ALTER TYPE "public"."task_status" ADD VALUE IF NOT EXISTS 'skipped' AFTER 'completed';

-- A deliberately NEW enum rather than reusing sub_phase_action_type, because
-- two identical copies of that already exist (sub_phase_action_type and
-- sub_phase_action_type_enum, same eight values, both referenced). Picking
-- either would be arbitrary and would carry the confusion forward. When the
-- project sub-phase engine eventually converges onto Procedures, it migrates
-- to this one and both old enums can be dropped.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'procedure_action_type') THEN
        CREATE TYPE "public"."procedure_action_type" AS ENUM (
            'manual',      -- just mark it done
            'upload',      -- evidence required: photos, drawings, documents
            'checklist',   -- every item ticked
            'form',        -- structured values captured (measurements, etc.)
            'approval',    -- someone else signs off
            'assignment',  -- work handed to a person or role
            'meeting',     -- a scheduled event happened
            'handover'     -- responsibility passes between teams
        );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'procedure_run_status') THEN
        CREATE TYPE "public"."procedure_run_status" AS ENUM (
            'active',
            'completed',
            'cancelled'
        );
    END IF;
END $$;
