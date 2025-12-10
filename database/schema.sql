


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."approval_status_enum" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'revision_requested'
);


ALTER TYPE "public"."approval_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."billing_cycle_enum" AS ENUM (
    'monthly',
    'yearly'
);


ALTER TYPE "public"."billing_cycle_enum" OWNER TO "postgres";


CREATE TYPE "public"."budget_range_enum" AS ENUM (
    'below_5l',
    '5l_10l',
    '10l_20l',
    '20l_35l',
    '35l_50l',
    '50l_1cr',
    'above_1cr',
    'not_disclosed'
);


ALTER TYPE "public"."budget_range_enum" OWNER TO "postgres";


CREATE TYPE "public"."disqualification_reason_enum" AS ENUM (
    'budget_mismatch',
    'timeline_mismatch',
    'location_not_serviceable',
    'not_serious_buyer',
    'duplicate_lead',
    'invalid_contact',
    'competitor_already_hired',
    'project_cancelled',
    'other'
);


ALTER TYPE "public"."disqualification_reason_enum" OWNER TO "postgres";


CREATE TYPE "public"."invitation_status_enum" AS ENUM (
    'pending',
    'accepted',
    'expired',
    'cancelled'
);


ALTER TYPE "public"."invitation_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."invoice_status_enum" AS ENUM (
    'draft',
    'pending',
    'paid',
    'failed',
    'refunded',
    'cancelled'
);


ALTER TYPE "public"."invoice_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."lead_activity_type_enum" AS ENUM (
    'call_made',
    'call_received',
    'call_missed',
    'email_sent',
    'email_received',
    'meeting_scheduled',
    'meeting_completed',
    'site_visit',
    'quotation_sent',
    'quotation_revised',
    'note_added',
    'stage_changed',
    'assignment_changed',
    'document_uploaded',
    'other'
);


ALTER TYPE "public"."lead_activity_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."lead_source_enum" AS ENUM (
    'architect_referral',
    'client_referral',
    'youtube',
    'instagram',
    'facebook',
    'google_ads',
    'website',
    'walkin',
    'trade_show',
    'justdial',
    'other'
);


ALTER TYPE "public"."lead_source_enum" OWNER TO "postgres";


CREATE TYPE "public"."lead_stage_enum" AS ENUM (
    'new',
    'qualified',
    'disqualified',
    'requirement_discussion',
    'proposal_discussion',
    'negotiation',
    'won',
    'lost'
);


ALTER TYPE "public"."lead_stage_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."lead_stage_enum" IS 'Lead stages. Note: negotiation is deprecated, use proposal_discussion instead (renamed to Proposal & Negotiation in UI)';



CREATE TYPE "public"."lost_reason_enum" AS ENUM (
    'price_too_high',
    'chose_competitor',
    'project_cancelled',
    'timeline_not_met',
    'scope_mismatch',
    'no_response',
    'budget_reduced',
    'other'
);


ALTER TYPE "public"."lost_reason_enum" OWNER TO "postgres";


CREATE TYPE "public"."notification_priority_enum" AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);


ALTER TYPE "public"."notification_priority_enum" OWNER TO "postgres";


CREATE TYPE "public"."notification_type_enum" AS ENUM (
    'lead_assigned',
    'lead_won',
    'lead_lost',
    'lead_stage_changed',
    'lead_note_added',
    'lead_task_assigned',
    'lead_task_due',
    'lead_task_overdue',
    'project_created',
    'project_assigned',
    'project_milestone',
    'project_completed',
    'team_member_added',
    'team_member_removed',
    'system_announcement',
    'subscription_warning',
    'subscription_expired',
    'mention',
    'comment',
    'reminder',
    'other'
);


ALTER TYPE "public"."notification_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."payment_milestone_status_enum" AS ENUM (
    'pending',
    'due',
    'overdue',
    'paid',
    'waived'
);


ALTER TYPE "public"."payment_milestone_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."phase_comment_type_enum" AS ENUM (
    'note',
    'issue',
    'question',
    'approval_request',
    'approval_response',
    'rejection_reason',
    'skip_reason'
);


ALTER TYPE "public"."phase_comment_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."phase_dependency_type_enum" AS ENUM (
    'hard',
    'soft',
    'parallel_group'
);


ALTER TYPE "public"."phase_dependency_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."plan_change_status_enum" AS ENUM (
    'pending',
    'scheduled',
    'completed',
    'failed',
    'cancelled'
);


ALTER TYPE "public"."plan_change_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."plan_change_type_enum" AS ENUM (
    'upgrade',
    'downgrade',
    'cancel',
    'reactivate'
);


ALTER TYPE "public"."plan_change_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."progress_mode_enum" AS ENUM (
    'auto',
    'manual'
);


ALTER TYPE "public"."progress_mode_enum" OWNER TO "postgres";


CREATE TYPE "public"."project_category_enum" AS ENUM (
    'turnkey',
    'modular',
    'renovation',
    'consultation',
    'commercial_fitout',
    'hybrid',
    'other'
);


ALTER TYPE "public"."project_category_enum" OWNER TO "postgres";


CREATE TYPE "public"."project_phase_status_enum" AS ENUM (
    'not_started',
    'in_progress',
    'on_hold',
    'completed',
    'cancelled',
    'blocked'
);


ALTER TYPE "public"."project_phase_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."project_property_type_enum" AS ENUM (
    'apartment_gated',
    'apartment_non_gated',
    'villa_gated',
    'villa_non_gated',
    'independent_house',
    'commercial_office',
    'commercial_retail',
    'commercial_restaurant',
    'commercial_other',
    'unknown'
);


ALTER TYPE "public"."project_property_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."project_sub_phase_status_enum" AS ENUM (
    'not_started',
    'in_progress',
    'on_hold',
    'completed',
    'skipped'
);


ALTER TYPE "public"."project_sub_phase_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."property_type_enum" AS ENUM (
    'apartment_gated',
    'apartment_non_gated',
    'villa_gated',
    'villa_non_gated',
    'independent_house',
    'commercial_office',
    'commercial_retail',
    'commercial_restaurant',
    'commercial_other',
    'unknown'
);


ALTER TYPE "public"."property_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."service_type_enum" AS ENUM (
    'turnkey',
    'modular',
    'renovation',
    'consultation',
    'commercial_fitout',
    'other'
);


ALTER TYPE "public"."service_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."sub_phase_action_type" AS ENUM (
    'manual',
    'approval',
    'upload',
    'assignment',
    'checklist',
    'form',
    'meeting',
    'handover'
);


ALTER TYPE "public"."sub_phase_action_type" OWNER TO "postgres";


CREATE TYPE "public"."sub_phase_action_type_enum" AS ENUM (
    'manual',
    'approval',
    'upload',
    'assignment',
    'checklist',
    'form',
    'meeting',
    'handover'
);


ALTER TYPE "public"."sub_phase_action_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."subscription_status_enum" AS ENUM (
    'trial',
    'active',
    'past_due',
    'cancelled',
    'expired'
);


ALTER TYPE "public"."subscription_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."task_priority" AS ENUM (
    'critical',
    'high',
    'medium',
    'low'
);


ALTER TYPE "public"."task_priority" OWNER TO "postgres";


CREATE TYPE "public"."task_related_type" AS ENUM (
    'lead',
    'quotation',
    'project',
    'client'
);


ALTER TYPE "public"."task_related_type" OWNER TO "postgres";


CREATE TYPE "public"."task_status" AS ENUM (
    'todo',
    'in_progress',
    'on_hold',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."task_status" OWNER TO "postgres";


CREATE TYPE "public"."task_template_category" AS ENUM (
    'project',
    'carpentry',
    'sales',
    'design',
    'installation',
    'general'
);


ALTER TYPE "public"."task_template_category" OWNER TO "postgres";


CREATE TYPE "public"."tenant_status_enum" AS ENUM (
    'active',
    'suspended',
    'trial',
    'expired',
    'closed'
);


ALTER TYPE "public"."tenant_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."tenant_type_enum" AS ENUM (
    'client',
    'architect',
    'interiors',
    'vendor',
    'factory'
);


ALTER TYPE "public"."tenant_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."user_status_enum" AS ENUM (
    'active',
    'invited',
    'pending_verification',
    'disabled',
    'deleted'
);


ALTER TYPE "public"."user_status_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_commission"("p_selling_price" numeric, "p_vendor_cost" numeric) RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
    RETURN p_selling_price - p_vendor_cost;
END;
$$;


ALTER FUNCTION "public"."calculate_commission"("p_selling_price" numeric, "p_vendor_cost" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_company_cost"("p_vendor_cost" numeric, "p_markup_percent" numeric DEFAULT NULL::numeric, "p_markup_amount" numeric DEFAULT NULL::numeric) RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
    IF p_markup_percent IS NOT NULL THEN
        RETURN p_vendor_cost * (1 + p_markup_percent / 100);
    ELSIF p_markup_amount IS NOT NULL THEN
        RETURN p_vendor_cost + p_markup_amount;
    ELSE
        -- Default 15% markup
        RETURN p_vendor_cost * 1.15;
    END IF;
END;
$$;


ALTER FUNCTION "public"."calculate_company_cost"("p_vendor_cost" numeric, "p_markup_percent" numeric, "p_markup_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_component_subtotal"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE quotation_components
    SET subtotal = (
        SELECT COALESCE(SUM(subtotal), 0)
        FROM quotation_materials
        WHERE component_id = COALESCE(NEW.component_id, OLD.component_id)
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.component_id, OLD.component_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."calculate_component_subtotal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_component_subtotal_v2"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Update component subtotal
    IF NEW.quotation_component_id IS NOT NULL OR (TG_OP = 'DELETE' AND OLD.quotation_component_id IS NOT NULL) THEN
        UPDATE quotation_components
        SET subtotal = (
            SELECT COALESCE(SUM(amount), 0)
            FROM quotation_line_items
            WHERE quotation_component_id = COALESCE(NEW.quotation_component_id, OLD.quotation_component_id)
        ),
        updated_at = NOW()
        WHERE id = COALESCE(NEW.quotation_component_id, OLD.quotation_component_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."calculate_component_subtotal_v2"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_line_item_amount"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_calc_type VARCHAR(20);
BEGIN
    -- Get calculation type from unit
    SELECT calculation_type INTO v_calc_type FROM units WHERE code = NEW.unit_code;
    
    -- Calculate amount based on calculation type
    CASE v_calc_type
        WHEN 'area' THEN
            NEW.amount := COALESCE(NEW.length, 0) * COALESCE(NEW.width, 0) * NEW.rate;
        WHEN 'length' THEN
            NEW.amount := COALESCE(NEW.length, 0) * NEW.rate;
        WHEN 'quantity' THEN
            NEW.amount := COALESCE(NEW.quantity, 0) * NEW.rate;
        WHEN 'fixed' THEN
            NEW.amount := NEW.rate;
        ELSE
            NEW.amount := COALESCE(NEW.quantity, 1) * NEW.rate;
    END CASE;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_line_item_amount"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_material_subtotal"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE quotation_materials
    SET subtotal = (
        SELECT COALESCE(SUM(amount), 0)
        FROM quotation_cost_attributes
        WHERE material_id = COALESCE(NEW.material_id, OLD.material_id)
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.material_id, OLD.material_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."calculate_material_subtotal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_phase_progress"("p_phase_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_total INT;
    v_completed INT;
BEGIN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'completed')
    INTO v_total, v_completed
    FROM project_sub_phases
    WHERE project_phase_id = p_phase_id AND status != 'skipped';
    
    IF v_total = 0 THEN RETURN 0; END IF;
    RETURN ROUND((v_completed::DECIMAL / v_total) * 100);
END;
$$;


ALTER FUNCTION "public"."calculate_phase_progress"("p_phase_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_phase_progress"("p_phase_id" "uuid") IS 'Calculate phase progress from sub-phases';



CREATE OR REPLACE FUNCTION "public"."calculate_po_totals"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_subtotal DECIMAL(14,2);
    v_discount DECIMAL(14,2);
    v_tax DECIMAL(14,2);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_subtotal
    FROM purchase_order_items
    WHERE po_id = COALESCE(NEW.po_id, OLD.po_id);
    
    UPDATE purchase_orders
    SET 
        subtotal = v_subtotal,
        discount_amount = v_subtotal * (discount_percent / 100),
        tax_amount = (v_subtotal - (v_subtotal * discount_percent / 100)) * (tax_percent / 100),
        grand_total = (v_subtotal - (v_subtotal * discount_percent / 100)) * (1 + tax_percent / 100) + other_charges,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.po_id, OLD.po_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."calculate_po_totals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_project_progress"("p_project_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_total INT;
    v_sum INT;
BEGIN
    SELECT COUNT(*), COALESCE(SUM(progress_percentage), 0)
    INTO v_total, v_sum
    FROM project_phases
    WHERE project_id = p_project_id AND status != 'cancelled';
    
    IF v_total = 0 THEN RETURN 0; END IF;
    RETURN ROUND(v_sum::DECIMAL / v_total);
END;
$$;


ALTER FUNCTION "public"."calculate_project_progress"("p_project_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_project_progress"("p_project_id" "uuid") IS 'Calculate overall project progress from phases';



CREATE OR REPLACE FUNCTION "public"."calculate_quotation_totals"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_subtotal DECIMAL(14,2);
    v_discount_amount DECIMAL(14,2);
    v_taxable_amount DECIMAL(14,2);
    v_overhead_amount DECIMAL(14,2);
    v_tax_amount DECIMAL(14,2);
    v_grand_total DECIMAL(14,2);
    v_quotation_id UUID;
BEGIN
    v_quotation_id := COALESCE(NEW.quotation_id, OLD.quotation_id);
    
    -- Get subtotal from spaces
    SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal
    FROM quotation_spaces
    WHERE quotation_id = v_quotation_id;
    
    -- Calculate discount
    SELECT 
        CASE 
            WHEN discount_type = 'percentage' THEN v_subtotal * (discount_value / 100)
            WHEN discount_type = 'fixed' THEN discount_value
            ELSE 0
        END
    INTO v_discount_amount
    FROM quotations WHERE id = v_quotation_id;
    
    v_taxable_amount := v_subtotal - COALESCE(v_discount_amount, 0);
    
    -- Calculate overhead
    SELECT v_taxable_amount * (COALESCE(overhead_percent, 0) / 100)
    INTO v_overhead_amount
    FROM quotations WHERE id = v_quotation_id;
    
    v_taxable_amount := v_taxable_amount + COALESCE(v_overhead_amount, 0);
    
    -- Calculate tax
    SELECT v_taxable_amount * (COALESCE(tax_percent, 18) / 100)
    INTO v_tax_amount
    FROM quotations WHERE id = v_quotation_id;
    
    v_grand_total := v_taxable_amount + COALESCE(v_tax_amount, 0);
    
    -- Update quotation
    UPDATE quotations
    SET 
        subtotal = v_subtotal,
        discount_amount = COALESCE(v_discount_amount, 0),
        taxable_amount = v_taxable_amount,
        overhead_amount = COALESCE(v_overhead_amount, 0),
        tax_amount = COALESCE(v_tax_amount, 0),
        grand_total = v_grand_total,
        updated_at = NOW()
    WHERE id = v_quotation_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."calculate_quotation_totals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_space_subtotal"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE quotation_spaces
    SET subtotal = (
        SELECT COALESCE(SUM(subtotal), 0)
        FROM quotation_components
        WHERE space_id = COALESCE(NEW.space_id, OLD.space_id)
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.space_id, OLD.space_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."calculate_space_subtotal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_space_subtotal_v2"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Update space subtotal from direct line items + component subtotals
    IF NEW.quotation_space_id IS NOT NULL OR (TG_OP = 'DELETE' AND OLD.quotation_space_id IS NOT NULL) THEN
        UPDATE quotation_spaces
        SET subtotal = (
            -- Line items directly under space (no component)
            SELECT COALESCE(SUM(amount), 0)
            FROM quotation_line_items
            WHERE quotation_space_id = COALESCE(NEW.quotation_space_id, OLD.quotation_space_id)
              AND quotation_component_id IS NULL
        ) + (
            -- Component subtotals
            SELECT COALESCE(SUM(subtotal), 0)
            FROM quotation_components
            WHERE space_id = COALESCE(NEW.quotation_space_id, OLD.quotation_space_id)
        ),
        updated_at = NOW()
        WHERE id = COALESCE(NEW.quotation_space_id, OLD.quotation_space_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."calculate_space_subtotal_v2"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_sub_phase_progress"("p_sub_phase_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_total INT;
    v_completed INT;
BEGIN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE is_completed = true)
    INTO v_total, v_completed
    FROM project_checklist_items
    WHERE project_sub_phase_id = p_sub_phase_id;
    
    IF v_total = 0 THEN RETURN 0; END IF;
    RETURN ROUND((v_completed::DECIMAL / v_total) * 100);
END;
$$;


ALTER FUNCTION "public"."calculate_sub_phase_progress"("p_sub_phase_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_sub_phase_progress"("p_sub_phase_id" "uuid") IS 'Calculate sub-phase progress from checklist items';



CREATE OR REPLACE FUNCTION "public"."can_complete_sub_phase"("p_sub_phase_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_sub_phase RECORD;
    v_unmet_requirements TEXT[];
    v_req RECORD;
BEGIN
    -- Get sub-phase details
    SELECT * INTO v_sub_phase
    FROM project_sub_phases
    WHERE id = p_sub_phase_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('can_complete', false, 'reason', 'Sub-phase not found');
    END IF;
    
    -- Must be in progress
    IF v_sub_phase.status != 'in_progress' THEN
        RETURN jsonb_build_object('can_complete', false, 'reason', 'Sub-phase must be in progress');
    END IF;
    
    -- Check completion requirements
    SELECT array_agg(requirement_label)
    INTO v_unmet_requirements
    FROM sub_phase_completion_requirements
    WHERE project_sub_phase_id = p_sub_phase_id
      AND is_required = true
      AND is_satisfied = false;
    
    IF v_unmet_requirements IS NOT NULL AND array_length(v_unmet_requirements, 1) > 0 THEN
        RETURN jsonb_build_object(
            'can_complete', false, 
            'reason', 'Unmet requirements',
            'unmet_requirements', v_unmet_requirements
        );
    END IF;
    
    -- Check if action type specific requirements are met
    IF v_sub_phase.action_type = 'approval' THEN
        -- Check for approved approval
        IF NOT EXISTS (
            SELECT 1 FROM project_phase_approvals
            WHERE project_sub_phase_id = p_sub_phase_id
              AND status = 'approved'
        ) THEN
            RETURN jsonb_build_object('can_complete', false, 'reason', 'Approval required');
        END IF;
    END IF;
    
    IF v_sub_phase.action_type = 'upload' THEN
        -- Check if required uploads exist
        IF NOT EXISTS (
            SELECT 1 FROM project_phase_attachments
            WHERE project_sub_phase_id = p_sub_phase_id
        ) THEN
            RETURN jsonb_build_object('can_complete', false, 'reason', 'File upload required');
        END IF;
    END IF;
    
    IF v_sub_phase.action_type = 'checklist' THEN
        -- Check if all checklist items completed
        IF EXISTS (
            SELECT 1 FROM project_checklist_items
            WHERE project_sub_phase_id = p_sub_phase_id
              AND is_completed = false
        ) THEN
            RETURN jsonb_build_object('can_complete', false, 'reason', 'All checklist items must be completed');
        END IF;
    END IF;
    
    RETURN jsonb_build_object('can_complete', true);
END;
$$;


ALTER FUNCTION "public"."can_complete_sub_phase"("p_sub_phase_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_complete_sub_phase"("p_sub_phase_id" "uuid") IS 'Check if a sub-phase can be completed based on requirements';



CREATE OR REPLACE FUNCTION "public"."can_move_lead_to_won"("p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Check if user has any role that allows moving to Won
    RETURN EXISTS (
        SELECT 1 
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = v_user_id
        AND r.slug IN ('owner', 'admin', 'manager', 'sales-manager')
    );
END;
$$;


ALTER FUNCTION "public"."can_move_lead_to_won"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_phase_start"("p_phase_id" "uuid") RETURNS TABLE("can_start" boolean, "blocking_phases" "text"[])
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_hard_deps TEXT[];
BEGIN
    SELECT ARRAY_AGG(pp.name)
    INTO v_hard_deps
    FROM project_phase_dependencies ppd
    JOIN project_phases pp ON ppd.depends_on_phase_id = pp.id
    WHERE ppd.project_phase_id = p_phase_id
      AND ppd.dependency_type = 'hard'
      AND pp.status != 'completed';
    
    RETURN QUERY SELECT 
        (v_hard_deps IS NULL OR ARRAY_LENGTH(v_hard_deps, 1) IS NULL) as can_start,
        COALESCE(v_hard_deps, '{}') as blocking_phases;
END;
$$;


ALTER FUNCTION "public"."can_phase_start"("p_phase_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_phase_start"("p_phase_id" "uuid") IS 'Check if a phase can start based on hard dependencies';



CREATE OR REPLACE FUNCTION "public"."can_start_phase"("p_phase_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_phase RECORD;
    v_blocking TEXT[];
    v_project RECORD;
BEGIN
    -- Get phase details
    SELECT pp.*, pt.code as phase_code, p.project_category
    INTO v_phase
    FROM project_phases pp
    JOIN project_phase_templates pt ON pp.phase_template_id = pt.id
    JOIN projects p ON pp.project_id = p.id
    WHERE pp.id = p_phase_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('can_start', false, 'reason', 'Phase not found');
    END IF;
    
    -- Already started or completed
    IF v_phase.status != 'not_started' THEN
        RETURN jsonb_build_object('can_start', false, 'reason', 'Phase already started or completed');
    END IF;
    
    -- Check hard dependencies
    SELECT array_agg(pp_dep.name)
    INTO v_blocking
    FROM project_phase_dependencies ppd
    JOIN project_phases pp_dep ON ppd.depends_on_phase_id = pp_dep.id
    WHERE ppd.project_phase_id = p_phase_id
      AND ppd.dependency_type = 'hard'
      AND pp_dep.status NOT IN ('completed');
    
    IF v_blocking IS NOT NULL AND array_length(v_blocking, 1) > 0 THEN
        RETURN jsonb_build_object(
            'can_start', false, 
            'reason', 'Blocked by incomplete phases',
            'blocking_phases', v_blocking
        );
    END IF;
    
    RETURN jsonb_build_object('can_start', true);
END;
$$;


ALTER FUNCTION "public"."can_start_phase"("p_phase_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_start_phase"("p_phase_id" "uuid") IS 'Checks if a phase can be started based on dependencies';



CREATE OR REPLACE FUNCTION "public"."can_start_sub_phase"("p_sub_phase_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_sub_phase RECORD;
    v_phase RECORD;
    v_prev_sub_phase RECORD;
    v_blocking_deps TEXT[];
BEGIN
    -- Get sub-phase details
    SELECT psp.*, pp.status as phase_status, pp.project_id
    INTO v_sub_phase
    FROM project_sub_phases psp
    JOIN project_phases pp ON psp.project_phase_id = pp.id
    WHERE psp.id = p_sub_phase_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('can_start', false, 'reason', 'Sub-phase not found');
    END IF;
    
    -- Check if already started or completed
    IF v_sub_phase.status != 'not_started' THEN
        RETURN jsonb_build_object('can_start', false, 'reason', 'Sub-phase already started or completed');
    END IF;
    
    -- Check if parent phase is blocked
    IF v_sub_phase.phase_status = 'blocked' THEN
        RETURN jsonb_build_object('can_start', false, 'reason', 'Parent phase is blocked');
    END IF;
    
    -- Check if previous sub-phases are completed (unless this one allows parallel)
    SELECT psp.* INTO v_prev_sub_phase
    FROM project_sub_phases psp
    WHERE psp.project_phase_id = v_sub_phase.project_phase_id
      AND psp.display_order < v_sub_phase.display_order
      AND psp.status NOT IN ('completed', 'skipped')
    ORDER BY psp.display_order DESC
    LIMIT 1;
    
    IF FOUND THEN
        -- Check if the current sub-phase allows parallel execution
        -- For now, we allow starting if allow_parallel is true on template
        RETURN jsonb_build_object(
            'can_start', false, 
            'reason', 'Previous sub-phase "' || v_prev_sub_phase.name || '" must be completed first',
            'blocking_sub_phase', v_prev_sub_phase.name
        );
    END IF;
    
    RETURN jsonb_build_object('can_start', true);
END;
$$;


ALTER FUNCTION "public"."can_start_sub_phase"("p_sub_phase_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_start_sub_phase"("p_sub_phase_id" "uuid") IS 'Check if a sub-phase can be started based on workflow rules';



CREATE OR REPLACE FUNCTION "public"."cleanup_old_notifications"("days_to_keep" integer DEFAULT 90) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM notifications
    WHERE created_at < CURRENT_TIMESTAMP - (days_to_keep || ' days')::INTERVAL
    AND is_read = TRUE;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_notifications"("days_to_keep" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_sub_phase"("p_sub_phase_id" "uuid", "p_user_id" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_can_complete JSONB;
    v_project_id UUID;
    v_phase_id UUID;
    v_started_at TIMESTAMPTZ;
BEGIN
    -- Check if can complete
    v_can_complete := can_complete_sub_phase(p_sub_phase_id);
    
    IF NOT (v_can_complete->>'can_complete')::boolean THEN
        RETURN v_can_complete;
    END IF;
    
    -- Get details
    SELECT p.id, pp.id, psp.started_at 
    INTO v_project_id, v_phase_id, v_started_at
    FROM project_sub_phases psp
    JOIN project_phases pp ON psp.project_phase_id = pp.id
    JOIN projects p ON pp.project_id = p.id
    WHERE psp.id = p_sub_phase_id;
    
    -- Update sub-phase
    UPDATE project_sub_phases
    SET status = 'completed'::project_sub_phase_status_enum,
        progress_percentage = 100,
        completed_at = NOW(),
        completed_by = p_user_id,
        actual_duration_hours = EXTRACT(EPOCH FROM (NOW() - COALESCE(v_started_at, NOW()))) / 3600,
        notes = COALESCE(p_notes, notes),
        updated_at = NOW()
    WHERE id = p_sub_phase_id;
    
    -- Log activity
    INSERT INTO project_phase_activity_log (
        project_id, project_sub_phase_id,
        activity_type, description, 
        old_value, new_value,
        performed_by
    ) VALUES (
        v_project_id, p_sub_phase_id,
        'status_change', 'Sub-phase completed',
        jsonb_build_object('status', 'in_progress'),
        jsonb_build_object('status', 'completed'),
        p_user_id
    );
    
    RETURN jsonb_build_object('success', true, 'message', 'Sub-phase completed');
END;
$$;


ALTER FUNCTION "public"."complete_sub_phase"("p_sub_phase_id" "uuid", "p_user_id" "uuid", "p_notes" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."complete_sub_phase"("p_sub_phase_id" "uuid", "p_user_id" "uuid", "p_notes" "text") IS 'Complete a sub-phase with validation and logging';



CREATE OR REPLACE FUNCTION "public"."create_notification"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_type" "public"."notification_type_enum", "p_title" character varying, "p_message" "text", "p_entity_type" character varying DEFAULT NULL::character varying, "p_entity_id" "uuid" DEFAULT NULL::"uuid", "p_action_url" "text" DEFAULT NULL::"text", "p_triggered_by" "uuid" DEFAULT NULL::"uuid", "p_priority" "public"."notification_priority_enum" DEFAULT 'normal'::"public"."notification_priority_enum", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_notification_id UUID;
    v_in_app_enabled BOOLEAN;
BEGIN
    -- Check if user wants this type of notification
    SELECT COALESCE(in_app, true) INTO v_in_app_enabled
    FROM notification_preferences
    WHERE user_id = p_user_id AND notification_type = p_type;
    
    -- Default to enabled if no preference set
    IF v_in_app_enabled IS NULL THEN
        v_in_app_enabled := true;
    END IF;
    
    -- Only create if in-app is enabled
    IF v_in_app_enabled THEN
        INSERT INTO notifications (
            tenant_id, user_id, type, title, message,
            entity_type, entity_id, action_url,
            triggered_by, priority, metadata
        ) VALUES (
            p_tenant_id, p_user_id, p_type, p_title, p_message,
            p_entity_type, p_entity_id, p_action_url,
            p_triggered_by, p_priority, p_metadata
        )
        RETURNING id INTO v_notification_id;
    END IF;
    
    RETURN v_notification_id;
END;
$$;


ALTER FUNCTION "public"."create_notification"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_type" "public"."notification_type_enum", "p_title" character varying, "p_message" "text", "p_entity_type" character varying, "p_entity_id" "uuid", "p_action_url" "text", "p_triggered_by" "uuid", "p_priority" "public"."notification_priority_enum", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_project_from_lead"("p_lead_id" "uuid", "p_created_by" "uuid", "p_project_category" "text" DEFAULT 'turnkey'::"text", "p_initialize_phases" boolean DEFAULT true) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_lead RECORD;
    v_project_id UUID;
    v_project_number TEXT;
    v_property_type project_property_type_enum;
    v_project_category project_category_enum;
    v_project_name TEXT;
BEGIN
    -- Get lead details
    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found: %', p_lead_id;
    END IF;
    
    -- Check if project already exists for this lead
    IF v_lead.project_id IS NOT NULL THEN
        RETURN v_lead.project_id; -- Return existing project
    END IF;
    
    -- Map leads.property_type to projects.property_type (direct mapping now!)
    v_property_type := v_lead.property_type::TEXT::project_property_type_enum;
    
    -- Map leads.service_type to projects.project_category
    v_project_category := CASE 
        WHEN v_lead.service_type::TEXT = 'turnkey' THEN 'turnkey'::project_category_enum
        WHEN v_lead.service_type::TEXT = 'modular' THEN 'modular'::project_category_enum
        WHEN v_lead.service_type::TEXT = 'renovation' THEN 'renovation'::project_category_enum
        WHEN v_lead.service_type::TEXT = 'consultation' THEN 'consultation'::project_category_enum
        WHEN v_lead.service_type::TEXT = 'commercial_fitout' THEN 'commercial_fitout'::project_category_enum
        WHEN v_lead.service_type::TEXT = 'other' THEN 'other'::project_category_enum
        WHEN p_project_category = 'hybrid' THEN 'hybrid'::project_category_enum
        ELSE 'turnkey'::project_category_enum
    END;
    
    -- Generate project number (with fallback)
    BEGIN
        SELECT generate_project_number(v_lead.tenant_id) INTO v_project_number;
    EXCEPTION WHEN OTHERS THEN
        v_project_number := 'PRJ-' || to_char(NOW(), 'YYYYMMDD') || '-' || floor(random() * 10000)::text;
    END;
    
    -- Generate project name
    v_project_name := COALESCE(
        v_lead.property_name, 
        v_lead.client_name || '''s ' || 
        CASE 
            WHEN v_lead.property_type::TEXT LIKE 'apartment%' THEN 'Apartment'
            WHEN v_lead.property_type::TEXT LIKE 'villa%' THEN 'Villa'
            WHEN v_lead.property_type::TEXT = 'independent_house' THEN 'House'
            WHEN v_lead.property_type::TEXT LIKE 'commercial%' THEN 'Commercial'
            ELSE 'Property'
        END || ' Project'
    );
    
    -- Create project with aligned fields
    INSERT INTO projects (
        tenant_id,
        project_number,
        name,
        description,
        -- Client info
        client_name,
        client_email,
        client_phone,
        -- Property info (NEW: aligned with leads)
        property_type,
        property_name,
        flat_number,
        carpet_area_sqft,
        -- Location
        site_address,
        city,
        pincode,
        -- Project classification (NEW: aligned with leads)
        project_category,
        project_type,  -- Keep for backward compatibility
        -- Dates
        start_date,
        expected_end_date,
        -- Financials
        quoted_amount,
        budget_amount,
        budget_range,
        -- Lead tracking (NEW)
        lead_source,
        lead_source_detail,
        sales_rep_id,
        lead_won_date,
        -- References
        converted_from_lead_id,
        lead_id,
        -- Status
        status,
        created_by,
        is_active
    ) VALUES (
        v_lead.tenant_id,
        v_project_number,
        v_project_name,
        v_lead.project_scope,
        -- Client info
        v_lead.client_name,
        v_lead.email,
        v_lead.phone,
        -- Property info
        v_property_type,
        v_lead.property_name,
        v_lead.flat_number,
        v_lead.carpet_area_sqft,
        -- Location
        v_lead.property_address,
        v_lead.property_city,
        v_lead.property_pincode,
        -- Project classification
        v_project_category,
        -- Legacy project_type (backward compatibility)
        CASE 
            WHEN v_lead.property_type::TEXT LIKE 'apartment%' THEN 'apartment'
            WHEN v_lead.property_type::TEXT LIKE 'villa%' THEN 'villa'
            WHEN v_lead.property_type::TEXT = 'independent_house' THEN 'residential'
            WHEN v_lead.property_type::TEXT LIKE 'commercial_office%' THEN 'office'
            WHEN v_lead.property_type::TEXT LIKE 'commercial_retail%' THEN 'retail'
            WHEN v_lead.property_type::TEXT LIKE 'commercial%' THEN 'commercial'
            ELSE 'residential'
        END,
        -- Dates
        COALESCE(v_lead.expected_project_start, v_lead.target_start_date, CURRENT_DATE),
        v_lead.target_end_date,
        -- Financials
        COALESCE(v_lead.won_amount, v_lead.estimated_value, 0),
        COALESCE(v_lead.won_amount, v_lead.estimated_value, 0),
        v_lead.budget_range::TEXT,
        -- Lead tracking
        v_lead.lead_source::TEXT,
        v_lead.lead_source_detail,
        v_lead.assigned_to,
        v_lead.won_at,
        -- References
        p_lead_id,
        p_lead_id,
        -- Status
        'planning',
        p_created_by,
        true
    ) RETURNING id INTO v_project_id;
    
    -- Update lead with project reference
    UPDATE leads 
    SET project_id = v_project_id,
        updated_at = NOW()
    WHERE id = p_lead_id;
    
    -- Initialize phases if requested
    IF p_initialize_phases THEN
        BEGIN
            PERFORM initialize_project_phases(
                v_project_id, 
                v_lead.tenant_id, 
                v_project_category::TEXT
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Phase initialization failed: %', SQLERRM;
        END;
    END IF;
    
    -- Create activity log
    INSERT INTO lead_activities (
        lead_id,
        activity_type,
        title,
        description,
        created_by
    ) VALUES (
        p_lead_id,
        'other',
        'Project Created',
        'Project ' || v_project_number || ' created from this lead',
        p_created_by
    );
    
    RETURN v_project_id;
END;
$$;


ALTER FUNCTION "public"."create_project_from_lead"("p_lead_id" "uuid", "p_created_by" "uuid", "p_project_category" "text", "p_initialize_phases" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_quotation_for_lead"("p_lead_id" "uuid", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_tenant_id UUID;
    v_quotation_id UUID;
    v_quotation_number VARCHAR(50);
    v_lead RECORD;
    v_assignee UUID;
BEGIN
    -- Get lead details
    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found: %', p_lead_id;
    END IF;
    
    v_tenant_id := v_lead.tenant_id;
    
    -- Determine assignee: provided user > lead's assigned user > lead creator
    v_assignee := COALESCE(p_user_id, v_lead.assigned_to, v_lead.created_by);
    
    -- Generate quotation number
    v_quotation_number := generate_quotation_number(v_tenant_id);
    
    -- Create the quotation with assigned_to set to creator
    INSERT INTO quotations (
        tenant_id,
        quotation_number,
        version,
        lead_id,
        client_name,
        client_email,
        client_phone,
        property_name,
        property_address,
        property_type,
        carpet_area,
        title,
        status,
        valid_from,
        valid_until,
        auto_created,
        assigned_to,
        created_by,
        updated_by
    ) VALUES (
        v_tenant_id,
        v_quotation_number,
        1,
        p_lead_id,
        v_lead.client_name,
        v_lead.email,
        v_lead.phone,
        v_lead.property_name,
        v_lead.property_address,
        v_lead.property_type::VARCHAR,
        v_lead.carpet_area_sqft,
        COALESCE(v_lead.service_type::VARCHAR, 'Interior') || ' - ' || v_lead.client_name,
        'draft',
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '30 days',
        true,
        v_assignee,
        v_assignee,
        v_assignee
    )
    RETURNING id INTO v_quotation_id;
    
    INSERT INTO lead_activities (
        lead_id,
        activity_type,
        title,
        description,
        created_by
    ) VALUES (
        p_lead_id,
        'quotation_sent',
        'Quotation Created',
        'Auto-created quotation ' || v_quotation_number || ' when lead moved to Proposal Discussion stage',
        v_assignee
    );
    
    RETURN v_quotation_id;
END;
$$;


ALTER FUNCTION "public"."create_quotation_for_lead"("p_lead_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_quotation_for_lead"("p_lead_id" "uuid", "p_user_id" "uuid") IS 'Creates a new quotation for a lead. Called automatically when lead moves to proposal_discussion stage.';



CREATE OR REPLACE FUNCTION "public"."create_quotation_revision"("p_quotation_id" "uuid", "p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_new_quotation_id UUID;
    v_current_version INTEGER;
    v_quotation RECORD;
BEGIN
    -- Get current quotation
    SELECT * INTO v_quotation FROM quotations WHERE id = p_quotation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quotation not found: %', p_quotation_id;
    END IF;
    
    -- Get max version for this quotation number
    SELECT COALESCE(MAX(version), 0) INTO v_current_version
    FROM quotations
    WHERE tenant_id = v_quotation.tenant_id
    AND quotation_number = v_quotation.quotation_number;
    
    -- Use the duplicate_quotation function (already exists)
    v_new_quotation_id := duplicate_quotation(p_quotation_id, p_user_id);
    
    -- Update to mark as revision (not auto-created)
    UPDATE quotations
    SET auto_created = false
    WHERE id = v_new_quotation_id;
    
    RETURN v_new_quotation_id;
END;
$$;


ALTER FUNCTION "public"."create_quotation_revision"("p_quotation_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_quotation_revision"("p_quotation_id" "uuid", "p_user_id" "uuid") IS 'Creates a new version/revision of an existing quotation';



CREATE OR REPLACE FUNCTION "public"."create_tasks_from_template"("p_template_id" "uuid", "p_tenant_id" "uuid", "p_created_by" "uuid", "p_related_type" "public"."task_related_type" DEFAULT NULL::"public"."task_related_type", "p_related_id" "uuid" DEFAULT NULL::"uuid", "p_start_date" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("task_id" "uuid", "title" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_template RECORD;
    v_item RECORD;
    v_task_id UUID;
    v_parent_task_map JSONB := '{}';
BEGIN
    -- Verify template exists and is active
    SELECT * INTO v_template FROM task_templates WHERE id = p_template_id AND is_active = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found or inactive: %', p_template_id;
    END IF;
    
    -- Create tasks from template items (parent tasks first, then subtasks)
    FOR v_item IN 
        SELECT * FROM task_template_items 
        WHERE template_id = p_template_id 
        ORDER BY parent_item_id NULLS FIRST, sort_order
    LOOP
        INSERT INTO tasks (
            tenant_id,
            parent_task_id,
            template_id,
            template_item_id,
            is_from_template,
            title,
            description,
            priority,
            status,
            start_date,
            due_date,
            estimated_hours,
            assigned_to,
            related_type,
            related_id,
            created_by,
            updated_by
        ) VALUES (
            p_tenant_id,
            (v_parent_task_map->>v_item.parent_item_id::TEXT)::UUID, -- Map template parent to actual parent
            p_template_id,
            v_item.id,
            true,
            v_item.title,
            v_item.description,
            COALESCE(v_item.priority, v_template.default_priority),
            'todo',
            p_start_date,
            CASE WHEN v_item.relative_due_days IS NOT NULL 
                 THEN p_start_date + v_item.relative_due_days 
                 ELSE NULL END,
            v_item.estimated_hours,
            v_item.assign_to_user_id, -- Can enhance to lookup by role
            p_related_type,
            p_related_id,
            p_created_by,
            p_created_by
        )
        RETURNING id INTO v_task_id;
        
        -- Map template item ID to actual task ID (for subtask parent references)
        v_parent_task_map := v_parent_task_map || jsonb_build_object(v_item.id::TEXT, v_task_id::TEXT);
        
        -- Return created task
        task_id := v_task_id;
        title := v_item.title;
        RETURN NEXT;
    END LOOP;
    
    RETURN;
END;
$$;


ALTER FUNCTION "public"."create_tasks_from_template"("p_template_id" "uuid", "p_tenant_id" "uuid", "p_created_by" "uuid", "p_related_type" "public"."task_related_type", "p_related_id" "uuid", "p_start_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."duplicate_quotation"("p_quotation_id" "uuid", "p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_new_quotation_id UUID;
    v_new_version INTEGER;
    v_old_version INTEGER;
BEGIN
    -- Get current version
    SELECT version INTO v_old_version FROM quotations WHERE id = p_quotation_id;
    v_new_version := COALESCE(v_old_version, 0) + 1;
    
    -- Create new quotation header (now includes assigned_to)
    INSERT INTO quotations (
        tenant_id, quotation_number, version, parent_quotation_id,
        lead_id, client_id, project_id,
        client_name, client_email, client_phone,
        property_name, property_address, property_type, carpet_area,
        title, description, status,
        valid_from, valid_until,
        discount_type, discount_value, tax_percent, overhead_percent,
        payment_terms, terms_and_conditions, notes,
        presentation_level, hide_dimensions,
        assigned_to,
        created_by, updated_by
    )
    SELECT 
        tenant_id, quotation_number, v_new_version, id,
        lead_id, client_id, project_id,
        client_name, client_email, client_phone,
        property_name, property_address, property_type, carpet_area,
        title, description, 'draft',
        CURRENT_DATE, valid_until,
        discount_type, discount_value, tax_percent, overhead_percent,
        payment_terms, terms_and_conditions, notes,
        COALESCE(presentation_level, 'space_component'), COALESCE(hide_dimensions, true),
        assigned_to, -- Keep same assignee for revision
        p_user_id, p_user_id
    FROM quotations WHERE id = p_quotation_id
    RETURNING id INTO v_new_quotation_id;
    
    -- Copy spaces
    INSERT INTO quotation_spaces (quotation_id, space_type_id, name, description, display_order, subtotal, metadata)
    SELECT v_new_quotation_id, space_type_id, name, description, display_order, subtotal, metadata
    FROM quotation_spaces WHERE quotation_id = p_quotation_id;
    
    -- Copy components
    INSERT INTO quotation_components (
        quotation_id, space_id, component_type_id, component_variant_id,
        name, description, subtotal, display_order
    )
    SELECT 
        v_new_quotation_id, 
        ns.id,
        oc.component_type_id,
        oc.component_variant_id,
        oc.name, oc.description, oc.subtotal, oc.display_order
    FROM quotation_components oc
    JOIN quotation_spaces os ON os.id = oc.space_id
    JOIN quotation_spaces ns ON ns.quotation_id = v_new_quotation_id 
        AND ns.display_order = os.display_order
    WHERE oc.quotation_id = p_quotation_id;
    
    -- Copy line items with space but no component
    INSERT INTO quotation_line_items (
        quotation_id, quotation_space_id, quotation_component_id,
        cost_item_id, name, group_name,
        length, width, quantity, unit_code, rate, amount,
        measurement_unit, display_order, notes, metadata
    )
    SELECT 
        v_new_quotation_id,
        ns.id,
        NULL,
        oli.cost_item_id, oli.name, oli.group_name,
        oli.length, oli.width, oli.quantity, oli.unit_code, oli.rate, oli.amount,
        oli.measurement_unit, oli.display_order, oli.notes, oli.metadata
    FROM quotation_line_items oli
    JOIN quotation_spaces os ON os.id = oli.quotation_space_id
    JOIN quotation_spaces ns ON ns.quotation_id = v_new_quotation_id 
        AND ns.display_order = os.display_order
    WHERE oli.quotation_id = p_quotation_id
      AND oli.quotation_component_id IS NULL;
    
    -- Copy line items with component
    INSERT INTO quotation_line_items (
        quotation_id, quotation_space_id, quotation_component_id,
        cost_item_id, name, group_name,
        length, width, quantity, unit_code, rate, amount,
        measurement_unit, display_order, notes, metadata
    )
    SELECT 
        v_new_quotation_id,
        ns.id,
        nc.id,
        oli.cost_item_id, oli.name, oli.group_name,
        oli.length, oli.width, oli.quantity, oli.unit_code, oli.rate, oli.amount,
        oli.measurement_unit, oli.display_order, oli.notes, oli.metadata
    FROM quotation_line_items oli
    JOIN quotation_components oc ON oc.id = oli.quotation_component_id
    JOIN quotation_spaces os ON os.id = oc.space_id
    JOIN quotation_spaces ns ON ns.quotation_id = v_new_quotation_id 
        AND ns.display_order = os.display_order
    JOIN quotation_components nc ON nc.space_id = ns.id 
        AND nc.display_order = oc.display_order
    WHERE oli.quotation_id = p_quotation_id
      AND oli.quotation_component_id IS NOT NULL;
    
    -- Copy orphan line items
    INSERT INTO quotation_line_items (
        quotation_id, quotation_space_id, quotation_component_id,
        cost_item_id, name, group_name,
        length, width, quantity, unit_code, rate, amount,
        measurement_unit, display_order, notes, metadata
    )
    SELECT 
        v_new_quotation_id,
        NULL,
        NULL,
        oli.cost_item_id, oli.name, oli.group_name,
        oli.length, oli.width, oli.quantity, oli.unit_code, oli.rate, oli.amount,
        oli.measurement_unit, oli.display_order, oli.notes, oli.metadata
    FROM quotation_line_items oli
    WHERE oli.quotation_id = p_quotation_id
      AND oli.quotation_space_id IS NULL
      AND oli.quotation_component_id IS NULL;
    
    -- Copy materials (backward compatibility)
    INSERT INTO quotation_materials (
        quotation_id, component_id, material_id, category_id,
        name, category_name, specifications, display_order, metadata
    )
    SELECT 
        v_new_quotation_id,
        nc.id,
        om.material_id, om.category_id,
        om.name, om.category_name, om.specifications, om.display_order, om.metadata
    FROM quotation_materials om
    JOIN quotation_components oc ON oc.id = om.component_id
    JOIN quotation_spaces os ON os.id = oc.space_id
    JOIN quotation_spaces ns ON ns.quotation_id = v_new_quotation_id 
        AND ns.display_order = os.display_order
    JOIN quotation_components nc ON nc.space_id = ns.id 
        AND nc.display_order = oc.display_order
    WHERE om.quotation_id = p_quotation_id;
    
    -- Copy cost attributes (backward compatibility)
    INSERT INTO quotation_cost_attributes (
        quotation_id, material_id, attribute_type_id,
        name, quantity, unit, rate, amount, is_auto_calculated, calculation_source, display_order, metadata
    )
    SELECT 
        v_new_quotation_id,
        nm.id,
        oca.attribute_type_id,
        oca.name, oca.quantity, oca.unit, oca.rate, oca.amount, 
        oca.is_auto_calculated, oca.calculation_source, oca.display_order, oca.metadata
    FROM quotation_cost_attributes oca
    JOIN quotation_materials om ON om.id = oca.material_id
    JOIN quotation_components oc ON oc.id = om.component_id
    JOIN quotation_spaces os ON os.id = oc.space_id
    JOIN quotation_spaces ns ON ns.quotation_id = v_new_quotation_id 
        AND ns.display_order = os.display_order
    JOIN quotation_components nc ON nc.space_id = ns.id 
        AND nc.display_order = oc.display_order
    JOIN quotation_materials nm ON nm.component_id = nc.id 
        AND nm.display_order = om.display_order
    WHERE oca.quotation_id = p_quotation_id;
    
    RETURN v_new_quotation_id;
END;
$$;


ALTER FUNCTION "public"."duplicate_quotation"("p_quotation_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."duplicate_quotation"("p_quotation_id" "uuid", "p_user_id" "uuid") IS 'Creates a copy/revision of a quotation including assigned_to field.';



CREATE OR REPLACE FUNCTION "public"."generate_grn_number"("p_tenant_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_count INTEGER;
    v_year TEXT;
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YY');
    SELECT COUNT(*) + 1 INTO v_count 
    FROM stock_goods_receipts 
    WHERE tenant_id = p_tenant_id 
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
    
    RETURN 'GRN-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;


ALTER FUNCTION "public"."generate_grn_number"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invoice_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.invoice_number := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMM') || '-' || 
        LPAD(CAST((SELECT COUNT(*) + 1 FROM subscription_invoices WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)) AS TEXT), 5, '0');
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_invoice_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_issue_number"("p_tenant_id" "uuid") RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_prefix VARCHAR(10);
    v_year VARCHAR(4);
    v_count INTEGER;
    v_number VARCHAR(30);
BEGIN
    SELECT COALESCE(issue_number_prefix, 'ISS') INTO v_prefix
    FROM tenant_stock_settings WHERE tenant_id = p_tenant_id;
    
    v_prefix := COALESCE(v_prefix, 'ISS');
    v_year := TO_CHAR(CURRENT_DATE, 'YY');
    
    SELECT COUNT(*) + 1 INTO v_count
    FROM stock_issues
    WHERE tenant_id = p_tenant_id
    AND issue_number LIKE v_prefix || '-' || v_year || '-%';
    
    v_number := v_prefix || '-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
    
    RETURN v_number;
END;
$$;


ALTER FUNCTION "public"."generate_issue_number"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_lead_number"("p_tenant_id" "uuid") RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_prefix VARCHAR(10);
    v_next_num INTEGER;
    v_lead_number VARCHAR(50);
BEGIN
    INSERT INTO tenant_lead_settings (tenant_id)
    VALUES (p_tenant_id)
    ON CONFLICT (tenant_id) DO NOTHING;
    
    UPDATE tenant_lead_settings
    SET lead_number_next = lead_number_next + 1
    WHERE tenant_id = p_tenant_id
    RETURNING lead_number_prefix, lead_number_next - 1 INTO v_prefix, v_next_num;
    
    v_lead_number := v_prefix || '-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(v_next_num::TEXT, 5, '0');
    
    RETURN v_lead_number;
END;
$$;


ALTER FUNCTION "public"."generate_lead_number"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_mr_number"("p_tenant_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_count INTEGER;
    v_year TEXT;
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YY');
    SELECT COUNT(*) + 1 INTO v_count 
    FROM stock_material_requisitions 
    WHERE tenant_id = p_tenant_id 
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
    
    RETURN 'MR-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;


ALTER FUNCTION "public"."generate_mr_number"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_po_number"("p_tenant_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_count INTEGER;
    v_year TEXT;
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YY');
    SELECT COUNT(*) + 1 INTO v_count 
    FROM stock_purchase_orders 
    WHERE tenant_id = p_tenant_id 
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
    
    RETURN 'PO-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;


ALTER FUNCTION "public"."generate_po_number"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_project_number"("p_tenant_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_count INTEGER;
    v_year TEXT;
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YY');
    SELECT COUNT(*) + 1 INTO v_count 
    FROM projects 
    WHERE tenant_id = p_tenant_id 
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
    
    RETURN 'PRJ-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$;


ALTER FUNCTION "public"."generate_project_number"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_quotation_number"("p_tenant_id" "uuid") RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_year VARCHAR(4);
    v_count INTEGER;
    v_number VARCHAR(50);
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    SELECT COUNT(*) + 1 INTO v_count
    FROM quotations
    WHERE tenant_id = p_tenant_id
    AND quotation_number LIKE 'QT-' || v_year || '-%';
    
    v_number := 'QT-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
    
    RETURN v_number;
END;
$$;


ALTER FUNCTION "public"."generate_quotation_number"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_task_number"("p_tenant_id" "uuid") RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_count INTEGER;
    v_number VARCHAR(20);
BEGIN
    -- Get current count for this tenant
    SELECT COUNT(*) + 1 INTO v_count
    FROM tasks
    WHERE tenant_id = p_tenant_id;
    
    -- Generate number: TSK-0001
    v_number := 'TSK-' || LPAD(v_count::TEXT, 4, '0');
    
    -- Handle duplicates (in case of concurrent inserts)
    WHILE EXISTS (SELECT 1 FROM tasks WHERE tenant_id = p_tenant_id AND task_number = v_number) LOOP
        v_count := v_count + 1;
        v_number := 'TSK-' || LPAD(v_count::TEXT, 4, '0');
    END LOOP;
    
    RETURN v_number;
END;
$$;


ALTER FUNCTION "public"."generate_task_number"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_lead_statistics"("p_tenant_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total', COUNT(*),
        'new', COUNT(*) FILTER (WHERE stage = 'new'),
        'qualified', COUNT(*) FILTER (WHERE stage = 'qualified'),
        'disqualified', COUNT(*) FILTER (WHERE stage = 'disqualified'),
        'requirement_discussion', COUNT(*) FILTER (WHERE stage = 'requirement_discussion'),
        'proposal_discussion', COUNT(*) FILTER (WHERE stage = 'proposal_discussion'),
        'negotiation', COUNT(*) FILTER (WHERE stage = 'negotiation'),
        'won', COUNT(*) FILTER (WHERE stage = 'won'),
        'lost', COUNT(*) FILTER (WHERE stage = 'lost'),
        'pipeline_value', COALESCE(SUM(estimated_value) FILTER (WHERE stage NOT IN ('won', 'lost', 'disqualified')), 0),
        'won_value', COALESCE(SUM(won_amount) FILTER (WHERE stage = 'won'), 0),
        'this_month_new', COUNT(*) FILTER (WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)),
        'this_month_won', COUNT(*) FILTER (WHERE stage = 'won' AND DATE_TRUNC('month', won_at) = DATE_TRUNC('month', CURRENT_DATE)),
        'needs_followup', COUNT(*) FILTER (WHERE 
            stage NOT IN ('won', 'lost', 'disqualified') 
            AND last_activity_at < CURRENT_TIMESTAMP - INTERVAL '3 days'
        )
    ) INTO result
    FROM leads
    WHERE tenant_id = p_tenant_id;
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_lead_statistics"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_material_markup"("p_tenant_id" "uuid", "p_material_id" "uuid") RETURNS TABLE("markup_type" character varying, "markup_value" numeric, "revenue_head_id" "uuid", "revenue_head_name" character varying)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    WITH material_info AS (
        SELECT m.category, m.item_type, m.brand_id
        FROM stock_materials m
        WHERE m.id = p_material_id
    )
    SELECT 
        pr.markup_type,
        pr.markup_value,
        pr.revenue_head_id,
        rh.name as revenue_head_name
    FROM pricing_rules pr
    LEFT JOIN revenue_heads rh ON rh.id = pr.revenue_head_id
    CROSS JOIN material_info mi
    WHERE pr.tenant_id = p_tenant_id
      AND pr.is_active = true
      AND (
          pr.category_pattern IS NULL 
          OR mi.category ILIKE pr.category_pattern
      )
      AND (
          pr.item_type IS NULL 
          OR mi.item_type = pr.item_type
      )
      AND (
          pr.brand_id IS NULL 
          OR mi.brand_id = pr.brand_id
      )
    ORDER BY pr.priority DESC
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_material_markup"("p_tenant_id" "uuid", "p_material_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_po_approval_level"("p_tenant_id" "uuid", "p_amount" numeric) RETURNS TABLE("requires_approval" boolean, "approval_level" integer, "approver_role" character varying)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_config approval_configs%ROWTYPE;
BEGIN
    -- Get tenant's approval config
    SELECT * INTO v_config 
    FROM approval_configs 
    WHERE tenant_id = p_tenant_id 
    AND config_type = 'purchase_order';
    
    -- If no config, default behavior
    IF NOT FOUND THEN
        RETURN QUERY SELECT true, 1, 'manager'::VARCHAR;
        RETURN;
    END IF;
    
    -- Check if approval is required at all
    IF NOT v_config.is_approval_required THEN
        RETURN QUERY SELECT false, 0, NULL::VARCHAR;
        RETURN;
    END IF;
    
    -- Auto-approve if below threshold
    IF p_amount <= v_config.auto_approve_limit THEN
        RETURN QUERY SELECT false, 0, NULL::VARCHAR;
        RETURN;
    END IF;
    
    -- Level 1
    IF p_amount <= v_config.level1_limit THEN
        RETURN QUERY SELECT true, 1, v_config.level1_role;
        RETURN;
    END IF;
    
    -- Level 2
    IF p_amount <= v_config.level2_limit THEN
        RETURN QUERY SELECT true, 2, v_config.level2_role;
        RETURN;
    END IF;
    
    -- Level 3 (highest)
    RETURN QUERY SELECT true, 3, v_config.level3_role;
END;
$$;


ALTER FUNCTION "public"."get_po_approval_level"("p_tenant_id" "uuid", "p_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_project_lead_summary"("p_project_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'lead_id', l.id,
        'lead_number', l.lead_number,
        'lead_source', l.lead_source,
        'lead_source_detail', l.lead_source_detail,
        'sales_rep', json_build_object(
            'id', u.id,
            'name', u.name,
            'email', u.email,
            'avatar_url', u.avatar_url
        ),
        'property_type', l.property_type,
        'service_type', l.service_type,
        'budget_range', l.budget_range,
        'original_scope', l.project_scope,
        'special_requirements', l.special_requirements,
        'timeline', json_build_object(
            'created_at', l.created_at,
            'won_at', l.won_at,
            'contract_signed', l.contract_signed_date,
            'duration_days', EXTRACT(DAY FROM (COALESCE(l.won_at, NOW()) - l.created_at))::INT
        ),
        'financials', json_build_object(
            'budget_range', l.budget_range,
            'estimated_value', l.estimated_value,
            'won_amount', l.won_amount
        ),
        'activity_count', (SELECT COUNT(*) FROM lead_activities WHERE lead_id = l.id)
    )
    INTO v_result
    FROM projects p
    LEFT JOIN leads l ON p.converted_from_lead_id = l.id
    LEFT JOIN users u ON l.assigned_to = u.id
    WHERE p.id = p_project_id;
    
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_project_lead_summary"("p_project_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_project_lead_summary"("p_project_id" "uuid") IS 'Get lead summary for a project (used in Lead History tab)';



CREATE OR REPLACE FUNCTION "public"."get_project_workflow"("p_project_id" "uuid") RETURNS TABLE("phase_id" "uuid", "phase_name" character varying, "phase_code" character varying, "group_name" character varying, "group_order" integer, "status" "public"."project_phase_status_enum", "progress" integer, "can_start" boolean, "blocking_phases" "text"[], "parallel_phases" "text"[])
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    WITH phase_deps AS (
        SELECT 
            ppd.project_phase_id,
            array_agg(pp_dep.name) FILTER (WHERE pp_dep.status NOT IN ('completed', 'cancelled')) as blocking
        FROM project_phase_dependencies ppd
        JOIN project_phases pp_dep ON ppd.depends_on_phase_id = pp_dep.id
        WHERE ppd.dependency_type = 'hard'
        GROUP BY ppd.project_phase_id
    ),
    parallel_info AS (
        SELECT 
            pp1.id as phase_id,
            array_agg(DISTINCT pp2.name) FILTER (WHERE pp2.id != pp1.id) as parallel_names
        FROM project_phases pp1
        JOIN project_phase_templates pt1 ON pp1.phase_template_id = pt1.id
        JOIN project_phase_templates pt2 ON pt1.phase_group_id = pt2.phase_group_id 
            AND pt1.can_run_parallel = true 
            AND pt2.can_run_parallel = true
        JOIN project_phases pp2 ON pp2.phase_template_id = pt2.id AND pp2.project_id = pp1.project_id
        WHERE pp1.project_id = p_project_id
        GROUP BY pp1.id
    )
    SELECT 
        pp.id,
        pp.name,
        pt.code,
        pg.name,
        pg.display_order,
        pp.status,
        pp.progress_percentage,
        COALESCE(pd.blocking IS NULL OR array_length(pd.blocking, 1) = 0, true),
        pd.blocking,
        pi.parallel_names
    FROM project_phases pp
    JOIN project_phase_templates pt ON pp.phase_template_id = pt.id
    LEFT JOIN project_phase_groups pg ON pt.phase_group_id = pg.id
    LEFT JOIN phase_deps pd ON pp.id = pd.project_phase_id
    LEFT JOIN parallel_info pi ON pp.id = pi.phase_id
    WHERE pp.project_id = p_project_id
    ORDER BY COALESCE(pg.display_order, 99), pt.display_order;
END;
$$;


ALTER FUNCTION "public"."get_project_workflow"("p_project_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_project_workflow"("p_project_id" "uuid") IS 'Returns workflow visualization data with dependencies and parallel info';



CREATE OR REPLACE FUNCTION "public"."get_subscription_status"("p_tenant_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
    v_now TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP;
    v_warning_days INTEGER;
    v_billing_config JSONB;
BEGIN
    SELECT config_value INTO v_billing_config
    FROM system_config WHERE config_key = 'billing_settings';
    
    v_warning_days := COALESCE((v_billing_config->>'warning_days_threshold')::INTEGER, 30);
    
    SELECT json_build_object(
        'subscription_id', ts.id,
        'status', ts.status,
        'billing_cycle', ts.billing_cycle,
        'is_trial', ts.is_trial,
        'trial_days_granted', ts.trial_days_granted,
        'trial_start_date', ts.trial_start_date,
        'trial_end_date', ts.trial_end_date,
        'trial_days_remaining', 
            CASE WHEN ts.is_trial AND ts.trial_end_date IS NOT NULL 
                THEN GREATEST(0, EXTRACT(DAY FROM ts.trial_end_date - v_now)::INTEGER)
                ELSE NULL 
            END,
        'subscription_start_date', ts.subscription_start_date,
        'subscription_end_date', ts.subscription_end_date,
        'subscription_days_remaining',
            CASE WHEN ts.subscription_end_date IS NOT NULL 
                THEN GREATEST(0, EXTRACT(DAY FROM ts.subscription_end_date - v_now)::INTEGER)
                ELSE NULL 
            END,
        'grace_period_days', ts.grace_period_days,
        'show_trial_warning',
            CASE WHEN ts.is_trial AND ts.trial_end_date IS NOT NULL 
                THEN EXTRACT(DAY FROM ts.trial_end_date - v_now) <= v_warning_days
                ELSE false 
            END,
        'show_subscription_warning',
            CASE WHEN NOT ts.is_trial AND ts.subscription_end_date IS NOT NULL 
                THEN EXTRACT(DAY FROM ts.subscription_end_date - v_now) <= v_warning_days
                ELSE false 
            END,
        'show_pay_button',
            CASE 
                WHEN ts.is_trial AND ts.trial_end_date IS NOT NULL 
                    AND EXTRACT(DAY FROM ts.trial_end_date - v_now) <= v_warning_days THEN true
                WHEN NOT ts.is_trial AND ts.subscription_end_date IS NOT NULL 
                    AND EXTRACT(DAY FROM ts.subscription_end_date - v_now) <= v_warning_days THEN true
                WHEN ts.status IN ('expired', 'past_due') THEN true
                ELSE false 
            END,
        'plan', json_build_object(
            'id', sp.id,
            'name', sp.name,
            'slug', sp.slug,
            'price_yearly', sp.price_yearly
        ),
        'auto_renew', ts.auto_renew
    ) INTO result
    FROM tenant_subscriptions ts
    LEFT JOIN subscription_plans sp ON sp.id = ts.plan_id
    WHERE ts.tenant_id = p_tenant_id;
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_subscription_status"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tenant_auto_create_project_setting"("p_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_setting BOOLEAN;
BEGIN
    SELECT auto_create_project_on_won 
    INTO v_setting 
    FROM tenant_settings 
    WHERE tenant_id = p_tenant_id;
    
    -- Default to true if setting not found
    RETURN COALESCE(v_setting, true);
END;
$$;


ALTER FUNCTION "public"."get_tenant_auto_create_project_setting"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tenant_usage_with_limits"("p_tenant_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'tenant_id', t.id,
        'plan', json_build_object(
            'id', sp.id,
            'name', sp.name,
            'slug', sp.slug
        ),
        'subscription', json_build_object(
            'status', ts.status,
            'billing_cycle', ts.billing_cycle,
            'is_trial', ts.is_trial,
            'trial_end_date', ts.trial_end_date,
            'current_period_end', ts.current_period_end
        ),
        'limits', json_build_object(
            'max_users', sp.max_users,
            'max_projects', sp.max_projects,
            'max_storage_gb', sp.max_storage_gb
        ),
        'usage', json_build_object(
            'current_users', COALESCE(tu.current_users, 0),
            'current_projects', COALESCE(tu.current_projects, 0),
            'storage_used_gb', ROUND(COALESCE(tu.storage_used_bytes, 0) / 1073741824.0, 2)
        ),
        'percentages', json_build_object(
            'users', CASE WHEN sp.max_users > 0 THEN ROUND((COALESCE(tu.current_users, 0)::NUMERIC / sp.max_users) * 100, 1) ELSE 0 END,
            'projects', CASE WHEN sp.max_projects > 0 THEN ROUND((COALESCE(tu.current_projects, 0)::NUMERIC / sp.max_projects) * 100, 1) ELSE 0 END,
            'storage', CASE WHEN sp.max_storage_gb > 0 THEN ROUND((COALESCE(tu.storage_used_bytes, 0) / 1073741824.0 / sp.max_storage_gb) * 100, 1) ELSE 0 END
        )
    ) INTO result
    FROM tenants t
    LEFT JOIN tenant_subscriptions ts ON ts.tenant_id = t.id
    LEFT JOIN subscription_plans sp ON sp.id = COALESCE(ts.plan_id, t.subscription_plan_id)
    LEFT JOIN tenant_usage tu ON tu.tenant_id = t.id
    WHERE t.id = p_tenant_id;
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_tenant_usage_with_limits"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unread_notification_count"("p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM notifications
        WHERE user_id = v_user_id
        AND is_read = FALSE
    );
END;
$$;


ALTER FUNCTION "public"."get_unread_notification_count"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_hierarchy_level"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN COALESCE(
        (SELECT MIN(r.hierarchy_level) 
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = auth.uid()
         AND (r.tenant_id IS NULL OR r.tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()))
        ),
        999 -- No role = no access
    );
END;
$$;


ALTER FUNCTION "public"."get_user_hierarchy_level"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_permissions"() RETURNS TABLE("permission_key" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT p.key::TEXT
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
    AND rp.granted = true;
END;
$$;


ALTER FUNCTION "public"."get_user_permissions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_tenant_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN (SELECT tenant_id FROM users WHERE id = auth.uid());
END;
$$;


ALTER FUNCTION "public"."get_user_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_tenant_ids"("p_user_id" "uuid") RETURNS SETOF "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY 
    SELECT tenant_id FROM tenant_users 
    WHERE user_id = p_user_id 
    AND is_active = true;
END;
$$;


ALTER FUNCTION "public"."get_user_tenant_ids"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_tenants"("p_user_id" "uuid") RETURNS TABLE("tenant_id" "uuid", "company_name" character varying, "logo_url" "text", "role_name" character varying, "is_owner" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        t.id,
        t.company_name,
        t.logo_url,
        r.name,
        u.is_super_admin
    FROM tenant_users tu
    JOIN tenants t ON tu.tenant_id = t.id
    JOIN users u ON tu.user_id = u.id AND u.tenant_id = tu.tenant_id
    LEFT JOIN user_roles ur ON ur.user_id = tu.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    WHERE tu.user_id = p_user_id 
    AND tu.is_active = true
    AND t.status NOT IN ('closed', 'suspended');
END;
$$;


ALTER FUNCTION "public"."get_user_tenants"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_variant_cost_config"("p_variant_type_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_config JSONB;
BEGIN
    SELECT cost_config INTO v_config
    FROM component_variant_types
    WHERE id = p_variant_type_id;
    
    RETURN COALESCE(v_config, '{}'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_variant_cost_config"("p_variant_type_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_permission"("permission_key" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN role_permissions rp ON rp.role_id = ur.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = auth.uid() 
        AND p.key = permission_key 
        AND rp.granted = true
    );
END;
$$;


ALTER FUNCTION "public"."has_permission"("permission_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_project_phases"("p_project_id" "uuid", "p_tenant_id" "uuid", "p_project_category" "text" DEFAULT 'turnkey'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_template RECORD;
    v_phase_id UUID;
    v_sub_template RECORD;
    v_applicable TEXT[];
BEGIN
    -- Determine which templates apply
    IF p_project_category = 'hybrid' THEN
        v_applicable := ARRAY['both', 'turnkey', 'modular'];
    ELSE
        v_applicable := ARRAY['both', p_project_category];
    END IF;
    
    -- Get phase templates ordered by display_order
    FOR v_template IN 
        SELECT pt.*, pc.code as category_code
        FROM project_phase_templates pt
        JOIN project_phase_categories pc ON pt.category_id = pc.id
        WHERE (pt.tenant_id IS NULL OR pt.tenant_id = p_tenant_id)
        AND pt.default_enabled = true
        AND pt.applicable_to && v_applicable
        ORDER BY pt.display_order
    LOOP
        -- Create project phase
        INSERT INTO project_phases (
            project_id,
            phase_template_id,
            name,
            category_code,
            status,
            progress_percentage,
            progress_mode,
            display_order,
            is_enabled,
            can_remove,
            is_custom,
            estimated_duration_hours
        ) VALUES (
            p_project_id,
            v_template.id,
            v_template.name,
            v_template.category_code,
            'not_started',
            0,
            'auto',
            v_template.display_order,
            true,
            NOT v_template.is_system_template,
            false,
            COALESCE(v_template.estimated_duration_days * 8, v_template.estimated_duration_hours) -- Convert days to hours (8 hours/day)
        ) RETURNING id INTO v_phase_id;
        
        -- Create sub-phases for this phase
        FOR v_sub_template IN
            SELECT * FROM project_sub_phase_templates
            WHERE phase_template_id = v_template.id
            AND (tenant_id IS NULL OR tenant_id = p_tenant_id)
            ORDER BY display_order
        LOOP
            INSERT INTO project_sub_phases (
                project_phase_id,
                sub_phase_template_id,
                name,
                status,
                progress_percentage,
                progress_mode,
                display_order,
                estimated_duration_hours
            ) VALUES (
                v_phase_id,
                v_sub_template.id,
                v_sub_template.name,
                'not_started',
                0,
                'auto',
                v_sub_template.display_order,
                COALESCE(v_sub_template.estimated_duration_days * 8, v_sub_template.estimated_duration_hours) -- Convert days to hours
            );
        END LOOP;
    END LOOP;
    
    -- Update project overall progress
    UPDATE projects 
    SET overall_progress = 0,
        updated_at = NOW()
    WHERE id = p_project_id;
END;
$$;


ALTER FUNCTION "public"."initialize_project_phases"("p_project_id" "uuid", "p_tenant_id" "uuid", "p_project_category" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_project_phases_v2"("p_project_id" "uuid", "p_tenant_id" "uuid", "p_project_category" "text" DEFAULT 'turnkey'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_template RECORD;
    v_phase_id UUID;
    v_sub_template RECORD;
    v_phases_created INT := 0;
    v_sub_phases_created INT := 0;
    v_deps_created INT := 0;
BEGIN
    -- Delete existing phases for this project (cascade deletes sub-phases)
    DELETE FROM project_phases WHERE project_id = p_project_id;
    
    -- Get applicable phase templates
    FOR v_template IN 
        SELECT pt.*, pc.code as category_code
        FROM project_phase_templates pt
        JOIN project_phase_categories pc ON pt.category_id = pc.id
        WHERE (pt.tenant_id = p_tenant_id OR pt.tenant_id IS NULL)
          AND pt.default_enabled = true
          AND (
              'both' = ANY(pt.applicable_to) OR 
              p_project_category = ANY(pt.applicable_to)
          )
        ORDER BY pc.display_order, pt.display_order
    LOOP
        -- Create project phase with explicit enum casts
        INSERT INTO project_phases (
            project_id, 
            phase_template_id, 
            name, 
            category_code,
            display_order,
            status,
            progress_percentage,
            progress_mode
        ) VALUES (
            p_project_id,
            v_template.id,
            v_template.name,
            v_template.category_code,
            v_template.display_order,
            'not_started'::project_phase_status_enum,
            0,
            'auto'::progress_mode_enum
        ) RETURNING id INTO v_phase_id;
        
        v_phases_created := v_phases_created + 1;
        
        -- Create sub-phases from templates
        FOR v_sub_template IN
            SELECT * FROM project_sub_phase_templates
            WHERE phase_template_id = v_template.id
              AND (tenant_id = p_tenant_id OR tenant_id IS NULL)
            ORDER BY display_order
        LOOP
            INSERT INTO project_sub_phases (
                project_phase_id,
                sub_phase_template_id,
                name,
                display_order,
                status,
                progress_percentage,
                progress_mode
            ) VALUES (
                v_phase_id,
                v_sub_template.id,
                v_sub_template.name,
                v_sub_template.display_order,
                'not_started'::project_sub_phase_status_enum,
                0,
                'auto'::progress_mode_enum
            );
            
            v_sub_phases_created := v_sub_phases_created + 1;
        END LOOP;
    END LOOP;
    
    -- Copy phase dependencies from templates
    INSERT INTO project_phase_dependencies (project_phase_id, depends_on_phase_id, dependency_type)
    SELECT 
        pp1.id,
        pp2.id,
        pdt.dependency_type::phase_dependency_type_enum
    FROM project_phase_dependency_templates pdt
    JOIN project_phases pp1 ON pp1.phase_template_id = pdt.phase_template_id AND pp1.project_id = p_project_id
    JOIN project_phases pp2 ON pp2.phase_template_id = pdt.depends_on_phase_template_id AND pp2.project_id = p_project_id
    WHERE pdt.tenant_id = p_tenant_id OR pdt.tenant_id IS NULL;
    
    GET DIAGNOSTICS v_deps_created = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true,
        'phases_created', v_phases_created,
        'sub_phases_created', v_sub_phases_created,
        'dependencies_created', v_deps_created
    );
END;
$$;


ALTER FUNCTION "public"."initialize_project_phases_v2"("p_project_id" "uuid", "p_tenant_id" "uuid", "p_project_category" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."initialize_project_phases_v2"("p_project_id" "uuid", "p_tenant_id" "uuid", "p_project_category" "text") IS 'Initialize project phases from templates (v2 with proper enum handling)';



CREATE OR REPLACE FUNCTION "public"."initialize_tenant_subscription"("p_tenant_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_trial_config JSONB;
    v_billing_config JSONB;
    v_trial_enabled BOOLEAN;
    v_trial_days INTEGER;
    v_default_plan_slug TEXT;
    v_grace_period_days INTEGER;
    v_default_cycle TEXT;
    v_plan_id UUID;
    v_subscription_id UUID;
    v_now TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP;
    v_trial_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get trial settings from system_config
    SELECT config_value INTO v_trial_config
    FROM system_config WHERE config_key = 'trial_settings';
    
    -- Get billing settings
    SELECT config_value INTO v_billing_config
    FROM system_config WHERE config_key = 'billing_settings';
    
    -- Extract values with defaults
    v_trial_enabled := COALESCE((v_trial_config->>'enabled')::BOOLEAN, true);
    v_trial_days := COALESCE((v_trial_config->>'trial_days')::INTEGER, 30);
    v_default_plan_slug := COALESCE(v_trial_config->>'default_plan_slug', 'signature');
    v_grace_period_days := COALESCE((v_trial_config->>'grace_period_days')::INTEGER, 7);
    v_default_cycle := COALESCE(v_billing_config->>'default_cycle', 'yearly');
    
    -- Get the default plan ID
    SELECT id INTO v_plan_id
    FROM subscription_plans
    WHERE slug = v_default_plan_slug AND is_active = true
    LIMIT 1;
    
    -- Fallback to any active plan if default not found
    IF v_plan_id IS NULL THEN
        SELECT id INTO v_plan_id
        FROM subscription_plans
        WHERE is_active = true
        ORDER BY display_order
        LIMIT 1;
    END IF;
    
    -- Calculate dates based on trial settings
    IF v_trial_enabled AND v_trial_days > 0 THEN
        v_trial_end := v_now + (v_trial_days || ' days')::INTERVAL;
        
        INSERT INTO tenant_subscriptions (
            tenant_id, plan_id, status, billing_cycle,
            is_trial, trial_days_granted, trial_start_date, trial_end_date,
            current_period_start, current_period_end,
            grace_period_days, auto_renew
        ) VALUES (
            p_tenant_id, v_plan_id, 'trial', v_default_cycle::billing_cycle_enum,
            true, v_trial_days, v_now, v_trial_end,
            v_now, v_trial_end,
            v_grace_period_days, true
        )
        RETURNING id INTO v_subscription_id;
    ELSE
        INSERT INTO tenant_subscriptions (
            tenant_id, plan_id, status, billing_cycle,
            is_trial, trial_days_granted,
            subscription_start_date, subscription_end_date,
            current_period_start, current_period_end,
            grace_period_days, auto_renew
        ) VALUES (
            p_tenant_id, v_plan_id, 'active', v_default_cycle::billing_cycle_enum,
            false, 0,
            v_now, v_now + INTERVAL '1 year',
            v_now, v_now + INTERVAL '1 year',
            v_grace_period_days, true
        )
        RETURNING id INTO v_subscription_id;
    END IF;
    
    -- Initialize tenant_usage
    INSERT INTO tenant_usage (tenant_id, current_users, current_projects, storage_used_bytes)
    VALUES (p_tenant_id, 1, 0, 0)
    ON CONFLICT (tenant_id) DO NOTHING;
    
    -- Update tenant's subscription_plan_id
    UPDATE tenants SET subscription_plan_id = v_plan_id WHERE id = p_tenant_id;
    
    RETURN v_subscription_id;
END;
$$;


ALTER FUNCTION "public"."initialize_tenant_subscription"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_project_sub_phase"("p_project_phase_id" "uuid", "p_sub_phase_template_id" "uuid", "p_name" character varying, "p_display_order" integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_sub_phase_id UUID;
BEGIN
    INSERT INTO project_sub_phases (
        project_phase_id,
        sub_phase_template_id,
        name,
        display_order,
        status,
        progress_percentage,
        progress_mode
    ) VALUES (
        p_project_phase_id,
        p_sub_phase_template_id,
        p_name,
        p_display_order,
        'not_started'::project_sub_phase_status_enum,
        0,
        'auto'::progress_mode_enum
    ) RETURNING id INTO v_sub_phase_id;
    
    RETURN v_sub_phase_id;
END;
$$;


ALTER FUNCTION "public"."insert_project_sub_phase"("p_project_phase_id" "uuid", "p_sub_phase_template_id" "uuid", "p_name" character varying, "p_display_order" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_or_higher"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid() 
        AND r.hierarchy_level <= 1 -- Owner (0) or Admin (1)
        AND (r.tenant_id IS NULL OR r.tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()))
    );
END;
$$;


ALTER FUNCTION "public"."is_admin_or_higher"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_owner"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid() 
        AND r.slug = 'owner'
        AND (r.tenant_id IS NULL OR r.tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()))
    );
END;
$$;


ALTER FUNCTION "public"."is_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN (SELECT is_super_admin FROM users WHERE id = auth.uid());
END;
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_stage_transition"("p_from_stage" "public"."lead_stage_enum", "p_to_stage" "public"."lead_stage_enum") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF p_from_stage IN ('won', 'lost', 'disqualified') THEN
        RETURN FALSE;
    END IF;
    
    IF p_to_stage = 'disqualified' THEN
        RETURN p_from_stage = 'new';
    END IF;
    
    RETURN CASE 
        WHEN p_from_stage = 'new' AND p_to_stage IN ('qualified', 'disqualified') THEN TRUE
        WHEN p_from_stage = 'qualified' AND p_to_stage IN ('requirement_discussion', 'lost') THEN TRUE
        WHEN p_from_stage = 'requirement_discussion' AND p_to_stage IN ('proposal_discussion', 'lost') THEN TRUE
        WHEN p_from_stage = 'proposal_discussion' AND p_to_stage IN ('negotiation', 'lost') THEN TRUE
        WHEN p_from_stage = 'negotiation' AND p_to_stage IN ('won', 'lost') THEN TRUE
        ELSE FALSE
    END;
END;
$$;


ALTER FUNCTION "public"."is_valid_stage_transition"("p_from_stage" "public"."lead_stage_enum", "p_to_stage" "public"."lead_stage_enum") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_task_assignment_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_old_name TEXT;
    v_new_name TEXT;
BEGIN
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
        -- Get user names for better activity description
        SELECT name INTO v_old_name FROM users WHERE id = OLD.assigned_to;
        SELECT name INTO v_new_name FROM users WHERE id = NEW.assigned_to;
        
        INSERT INTO task_activities (task_id, activity_type, field_name, old_value, new_value, description, created_by)
        VALUES (
            NEW.id,
            'assigned',
            'assigned_to',
            OLD.assigned_to::TEXT,
            NEW.assigned_to::TEXT,
            CASE 
                WHEN NEW.assigned_to IS NULL THEN 'Task unassigned from ' || COALESCE(v_old_name, 'unknown')
                WHEN OLD.assigned_to IS NULL THEN 'Task assigned to ' || COALESCE(v_new_name, 'unknown')
                ELSE 'Task reassigned from ' || COALESCE(v_old_name, 'unknown') || ' to ' || COALESCE(v_new_name, 'unknown')
            END,
            NEW.updated_by
        );
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_task_assignment_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_task_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO task_activities (task_id, activity_type, field_name, old_value, new_value, description, created_by)
        VALUES (
            NEW.id,
            'status_changed',
            'status',
            OLD.status::TEXT,
            NEW.status::TEXT,
            'Status changed from ' || OLD.status || ' to ' || NEW.status,
            NEW.updated_by
        );
        
        -- Set completed_at and completed_by when task is completed
        IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
            NEW.completed_at := NOW();
            NEW.completed_by := NEW.updated_by;
        END IF;
        
        -- Clear completed fields if task is reopened
        IF OLD.status = 'completed' AND NEW.status != 'completed' THEN
            NEW.completed_at := NULL;
            NEW.completed_by := NULL;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_task_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notifications_read"("p_notification_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_mark_all" boolean DEFAULT false) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_id UUID;
    v_count INTEGER;
BEGIN
    v_user_id := auth.uid();
    
    IF p_mark_all THEN
        UPDATE notifications
        SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
        WHERE user_id = v_user_id AND is_read = FALSE;
    ELSE
        UPDATE notifications
        SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
        WHERE user_id = v_user_id 
        AND id = ANY(p_notification_ids)
        AND is_read = FALSE;
    END IF;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."mark_notifications_read"("p_notification_ids" "uuid"[], "p_mark_all" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_lead_won"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_record RECORD;
    v_lead_client_name VARCHAR(255);
    v_won_amount DECIMAL(12,2);
    v_triggered_by UUID;
BEGIN
    -- Only trigger when stage changes to 'won'
    IF NEW.stage = 'won' AND (OLD.stage IS NULL OR OLD.stage != 'won') THEN
        v_lead_client_name := NEW.client_name;
        v_won_amount := NEW.won_amount;
        v_triggered_by := auth.uid();
        
        -- Notify all users with sales-manager, manager, admin, or owner roles in this tenant
        FOR v_user_record IN 
            SELECT DISTINCT u.id, u.tenant_id
            FROM users u
            JOIN user_roles ur ON ur.user_id = u.id
            JOIN roles r ON r.id = ur.role_id
            WHERE u.tenant_id = NEW.tenant_id
            AND u.status = 'active'
            AND r.slug IN ('owner', 'admin', 'manager', 'sales-manager')
            AND u.id != v_triggered_by -- Don't notify the person who did the action
        LOOP
            PERFORM create_notification(
                v_user_record.tenant_id,
                v_user_record.id,
                'lead_won'::notification_type_enum,
                'Lead Won! 🎉',
                'Lead "' || v_lead_client_name || '" has been marked as Won' || 
                    CASE WHEN v_won_amount IS NOT NULL 
                         THEN ' for ₹' || TO_CHAR(v_won_amount, 'FM99,99,99,999') 
                         ELSE '' 
                    END,
                'lead',
                NEW.id,
                '/dashboard/sales/leads/' || NEW.id,
                v_triggered_by,
                'high'::notification_priority_enum,
                jsonb_build_object(
                    'lead_number', NEW.lead_number,
                    'client_name', v_lead_client_name,
                    'won_amount', v_won_amount
                )
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_lead_won"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_lead_stage_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_quotation_id UUID;
    v_existing_count INTEGER;
BEGIN
    -- Only trigger on stage change
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
        
        -- When moving TO proposal_discussion, auto-create quotation
        IF NEW.stage = 'proposal_discussion' THEN
            -- Check if lead already has a quotation (don't create duplicate)
            SELECT COUNT(*) INTO v_existing_count
            FROM quotations
            WHERE lead_id = NEW.id;
            
            -- Only create if no quotation exists
            IF v_existing_count = 0 THEN
                v_quotation_id := create_quotation_for_lead(NEW.id, NULL);
                
                -- We could also create a notification here
                -- INSERT INTO notifications (...) VALUES (...);
            END IF;
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."on_lead_stage_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reinitialize_all_project_phases"("p_tenant_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("project_id" "uuid", "project_name" character varying, "status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_project RECORD;
BEGIN
    FOR v_project IN 
        SELECT p.id, p.name, p.tenant_id, COALESCE(p.project_category::TEXT, 'turnkey') as category
        FROM projects p
        WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
        ORDER BY p.created_at
    LOOP
        BEGIN
            -- Delete existing phases
            DELETE FROM project_phases WHERE project_phases.project_id = v_project.id;
            
            -- Initialize new phases
            PERFORM initialize_project_phases(v_project.id, v_project.tenant_id, v_project.category);
            
            project_id := v_project.id;
            project_name := v_project.name;
            status := 'SUCCESS';
            RETURN NEXT;
            
        EXCEPTION WHEN OTHERS THEN
            project_id := v_project.id;
            project_name := v_project.name;
            status := 'ERROR: ' || SQLERRM;
            RETURN NEXT;
        END;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."reinitialize_all_project_phases"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reinitialize_project_phases"("p_project_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_tenant_id UUID;
    v_project_category TEXT;
BEGIN
    -- Get project details
    SELECT tenant_id, COALESCE(project_category::TEXT, 'turnkey')
    INTO v_tenant_id, v_project_category
    FROM projects
    WHERE id = p_project_id;
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Project not found: %', p_project_id;
    END IF;
    
    -- Delete existing phases (cascades to sub-phases, checklist items)
    DELETE FROM project_phases WHERE project_id = p_project_id;
    
    -- Initialize new phases from templates
    PERFORM initialize_project_phases(p_project_id, v_tenant_id, v_project_category);
    
    RAISE NOTICE 'Successfully reinitialized phases for project: %', p_project_id;
END;
$$;


ALTER FUNCTION "public"."reinitialize_project_phases"("p_project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_pricing_rules"("p_tenant_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_rev_ply UUID;
    v_rev_hw UUID;
    v_rev_lam UUID;
    v_rev_paint UUID;
    v_rev_glass UUID;
    v_rev_app UUID;
    v_rev_light UUID;
BEGIN
    -- Get revenue head IDs
    SELECT id INTO v_rev_ply FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-PLY';
    SELECT id INTO v_rev_hw FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-HW';
    SELECT id INTO v_rev_lam FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-LAM';
    SELECT id INTO v_rev_paint FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-PAINT';
    SELECT id INTO v_rev_glass FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-GLASS';
    SELECT id INTO v_rev_app FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-COMM-APP';
    SELECT id INTO v_rev_light FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-COMM-LIGHT';
    
    -- Delete existing rules for this tenant
    DELETE FROM pricing_rules WHERE tenant_id = p_tenant_id;
    
    INSERT INTO pricing_rules (tenant_id, name, description, category_pattern, item_type, markup_type, markup_value, revenue_head_id, priority) VALUES
    -- Material categories with standard markup
    (p_tenant_id, 'Plywood Markup', '18% markup on all plywood products', 'Plywood%', NULL, 'percentage', 18.00, v_rev_ply, 100),
    (p_tenant_id, 'MDF Markup', '15% markup on MDF boards', 'MDF%', NULL, 'percentage', 15.00, v_rev_ply, 99),
    (p_tenant_id, 'Hardware - Premium', '25% markup on premium hardware (Hettich, Hafele)', 'Hardware%', 'hardware', 'percentage', 25.00, v_rev_hw, 98),
    (p_tenant_id, 'Laminates Markup', '20% markup on laminates', 'Laminate%', NULL, 'percentage', 20.00, v_rev_lam, 97),
    (p_tenant_id, 'Paints Markup', '15% markup on paints and finishes', 'Paint%', NULL, 'percentage', 15.00, v_rev_paint, 96),
    (p_tenant_id, 'Glass Markup', '22% markup on glass and mirror', 'Glass%', NULL, 'percentage', 22.00, v_rev_glass, 95),
    
    -- Commission items (appliances, lighting) - these typically use MRP
    (p_tenant_id, 'Appliance Commission', 'Sell at MRP, track dealer margin as commission', 'Appliance%', NULL, 'percentage', 0.00, v_rev_app, 90),
    (p_tenant_id, 'Lighting Commission', 'Sell at MRP, track dealer margin as commission', 'Lighting%', NULL, 'percentage', 0.00, v_rev_light, 89),
    
    -- Default fallback
    (p_tenant_id, 'Default Markup', 'Default 15% markup for uncategorized items', '%', NULL, 'percentage', 15.00, NULL, 1);
    
    RETURN 'Seeded ' || (SELECT COUNT(*) FROM pricing_rules WHERE tenant_id = p_tenant_id) || ' pricing rules for tenant.';
END;
$$;


ALTER FUNCTION "public"."seed_pricing_rules"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_quotation_master_data"("p_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    -- Space Type IDs
    v_space_master_bedroom UUID;
    v_space_bedroom UUID;
    v_space_living_room UUID;
    v_space_kitchen UUID;
    v_space_dining UUID;
    v_space_bathroom UUID;
    v_space_foyer UUID;
    v_space_balcony UUID;
    v_space_pooja UUID;
    v_space_study UUID;
    
    -- Component Type IDs
    v_comp_wardrobe UUID;
    v_comp_tv_unit UUID;
    v_comp_false_ceiling UUID;
    v_comp_modular_kitchen UUID;
    v_comp_vanity UUID;
    v_comp_shoe_rack UUID;
    v_comp_crockery UUID;
    v_comp_study_table UUID;
    v_comp_bed UUID;
    v_comp_console UUID;
    
    -- Cost Attribute Type IDs
    v_attr_area UUID;
    v_attr_quantity UUID;
    v_attr_labour UUID;
    v_attr_hardware UUID;
BEGIN
    -- ========================================================================
    -- DELETE EXISTING DATA (order matters due to foreign keys)
    -- ========================================================================
    
    -- Delete in reverse order of dependencies
    DELETE FROM component_variant_types WHERE tenant_id = p_tenant_id AND is_system = true;
    DELETE FROM cost_attribute_types WHERE tenant_id = p_tenant_id;  -- no is_system column
    DELETE FROM component_types WHERE tenant_id = p_tenant_id AND is_system = true;
    DELETE FROM space_types WHERE tenant_id = p_tenant_id AND is_system = true;
    
    -- ========================================================================
    -- SPACE TYPES (fresh insert after delete)
    -- ========================================================================
    
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Master Bedroom', 'master-bedroom', 'Primary bedroom with attached bathroom', 'bed-double', 1, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_space_master_bedroom FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'master-bedroom';
    
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Bedroom', 'bedroom', 'Secondary bedroom', 'bed', 2, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_space_bedroom FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'bedroom';
    
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Living Room', 'living-room', 'Main living area', 'sofa', 3, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_space_living_room FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'living-room';
    
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Kitchen', 'kitchen', 'Cooking and food preparation area', 'utensils', 4, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_space_kitchen FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'kitchen';
    
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Dining', 'dining', 'Dining area', 'utensils-crossed', 5, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_space_dining FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'dining';
    
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Bathroom', 'bathroom', 'Bathroom/Toilet area', 'bath', 6, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_space_bathroom FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'bathroom';
    
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Foyer', 'foyer', 'Entrance/Foyer area', 'door-open', 7, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_space_foyer FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'foyer';
    
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Balcony', 'balcony', 'Balcony or terrace area', 'sun', 8, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_space_balcony FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'balcony';
    
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Pooja Room', 'pooja-room', 'Prayer/Worship room', 'flame', 9, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_space_pooja FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'pooja-room';
    
    INSERT INTO space_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Study', 'study', 'Study or home office', 'book-open', 10, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_space_study FROM space_types WHERE tenant_id = p_tenant_id AND slug = 'study';

    -- ========================================================================
    -- COMPONENT TYPES
    -- ========================================================================
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Wardrobe', 'wardrobe', 'Storage wardrobe with shutters', 'rectangle-vertical', 8, 8, 2, 1, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_wardrobe FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'wardrobe';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'TV Unit', 'tv-unit', 'Entertainment unit for TV and accessories', 'tv', 8, 8, 1.5, 2, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_tv_unit FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'tv-unit';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'False Ceiling', 'false-ceiling', 'Decorative ceiling work', 'layers', NULL, NULL, NULL, 3, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_false_ceiling FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'false-ceiling';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Modular Kitchen', 'modular-kitchen', 'Complete modular kitchen setup', 'utensils', NULL, NULL, 2, 4, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_modular_kitchen FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'modular-kitchen';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Vanity', 'vanity', 'Bathroom vanity with mirror and storage', 'square', 4, 3, 1.5, 5, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_vanity FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'vanity';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Shoe Rack', 'shoe-rack', 'Footwear storage unit', 'footprints', 4, 6, 1, 6, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_shoe_rack FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'shoe-rack';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Crockery Unit', 'crockery-unit', 'Display and storage for crockery', 'wine', 6, 8, 1.5, 7, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_crockery FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'crockery-unit';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Study Table', 'study-table', 'Desk for study or work', 'laptop', 5, 3, 2, 8, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_study_table FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'study-table';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Bed', 'bed', 'Bed with headboard and storage', 'bed', 6, 4, 7, 9, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_bed FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'bed';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, default_width, default_height, default_depth, display_order, is_active, is_system)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Console', 'console', 'Decorative console table', 'gallery-horizontal-end', 4, 3, 1, 10, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_console FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'console';

    -- ========================================================================
    -- COST ATTRIBUTE TYPES
    -- ========================================================================
    
    INSERT INTO cost_attribute_types (id, tenant_id, name, slug, description, data_type, unit, display_order, is_active)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Area', 'area', 'Area measurement (L x W)', 'area', 'sqft', 1, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_attr_area FROM cost_attribute_types WHERE tenant_id = p_tenant_id AND slug = 'area';
    
    INSERT INTO cost_attribute_types (id, tenant_id, name, slug, description, data_type, unit, display_order, is_active)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Quantity', 'quantity', 'Number of units', 'count', 'nos', 2, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_attr_quantity FROM cost_attribute_types WHERE tenant_id = p_tenant_id AND slug = 'quantity';
    
    INSERT INTO cost_attribute_types (id, tenant_id, name, slug, description, data_type, unit, display_order, is_active)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Labour', 'labour', 'Labour cost', 'number', 'nos', 3, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_attr_labour FROM cost_attribute_types WHERE tenant_id = p_tenant_id AND slug = 'labour';
    
    INSERT INTO cost_attribute_types (id, tenant_id, name, slug, description, data_type, unit, display_order, is_active)
    VALUES 
        (gen_random_uuid(), p_tenant_id, 'Hardware', 'hardware', 'Hardware items count', 'count', 'nos', 4, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_attr_hardware FROM cost_attribute_types WHERE tenant_id = p_tenant_id AND slug = 'hardware';

    -- ========================================================================
    -- COMPONENT VARIANT TYPES (The "Type" level)
    -- ========================================================================
    
    -- Wardrobe Variants
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_wardrobe, 'Ceiling Sliding', 'ceiling-sliding', 'Floor to ceiling wardrobe with sliding shutters', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft", "calculation": "L x W", "rate_field": "carcass_rate"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft", "calculation": "L x W", "rate_field": "shutter_rate"},
                {"name": "Sliding Mechanism", "type": "quantity", "unit": "nos", "per_shutter": true},
                {"name": "Labour", "type": "quantity", "unit": "nos", "rate_per_sqft": true}
            ]
         }'::jsonb, 1, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_wardrobe, 'Openable', 'openable', 'Wardrobe with hinged openable shutters', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft", "calculation": "L x W"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft", "calculation": "L x W"},
                {"name": "Hinges", "type": "quantity", "unit": "nos", "per_shutter": 4},
                {"name": "Labour", "type": "quantity", "unit": "nos", "rate_per_sqft": true}
            ]
         }'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_wardrobe, 'Openable With Loft', 'openable-with-loft', 'Wardrobe with openable shutters and top loft storage', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft", "calculation": "L x W"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft", "calculation": "L x W"},
                {"name": "Loft Area", "type": "area", "unit": "sqft", "calculation": "L x W"},
                {"name": "Hinges", "type": "quantity", "unit": "nos", "per_shutter": 4},
                {"name": "Labour", "type": "quantity", "unit": "nos", "rate_per_sqft": true}
            ]
         }'::jsonb, 3, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_wardrobe, 'Sliding With Loft', 'sliding-with-loft', 'Sliding wardrobe with top loft storage', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft", "calculation": "L x W"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft", "calculation": "L x W"},
                {"name": "Loft Area", "type": "area", "unit": "sqft", "calculation": "L x W"},
                {"name": "Sliding Mechanism", "type": "quantity", "unit": "nos", "per_shutter": true},
                {"name": "Labour", "type": "quantity", "unit": "nos", "rate_per_sqft": true}
            ]
         }'::jsonb, 4, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    -- Modular Kitchen Variants
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_modular_kitchen, 'L-Shape', 'l-shape', 'L-shaped modular kitchen layout', 
         '{
            "attributes": [
                {"name": "Base Cabinets Area", "type": "area", "unit": "sqft"},
                {"name": "Wall Cabinets Area", "type": "area", "unit": "sqft"},
                {"name": "Countertop Area", "type": "area", "unit": "sqft"},
                {"name": "Tall Unit Area", "type": "area", "unit": "sqft"},
                {"name": "Hardware", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 1, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_modular_kitchen, 'U-Shape', 'u-shape', 'U-shaped modular kitchen layout', 
         '{
            "attributes": [
                {"name": "Base Cabinets Area", "type": "area", "unit": "sqft"},
                {"name": "Wall Cabinets Area", "type": "area", "unit": "sqft"},
                {"name": "Countertop Area", "type": "area", "unit": "sqft"},
                {"name": "Tall Unit Area", "type": "area", "unit": "sqft"},
                {"name": "Hardware", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_modular_kitchen, 'Parallel', 'parallel', 'Parallel/Galley modular kitchen layout', 
         '{
            "attributes": [
                {"name": "Base Cabinets Area", "type": "area", "unit": "sqft"},
                {"name": "Wall Cabinets Area", "type": "area", "unit": "sqft"},
                {"name": "Countertop Area", "type": "area", "unit": "sqft"},
                {"name": "Hardware", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 3, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_modular_kitchen, 'Straight', 'straight', 'Single wall straight kitchen layout', 
         '{
            "attributes": [
                {"name": "Base Cabinets Area", "type": "area", "unit": "sqft"},
                {"name": "Wall Cabinets Area", "type": "area", "unit": "sqft"},
                {"name": "Countertop Area", "type": "area", "unit": "sqft"},
                {"name": "Hardware", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 4, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_modular_kitchen, 'Island', 'island', 'Kitchen with central island', 
         '{
            "attributes": [
                {"name": "Base Cabinets Area", "type": "area", "unit": "sqft"},
                {"name": "Wall Cabinets Area", "type": "area", "unit": "sqft"},
                {"name": "Island Area", "type": "area", "unit": "sqft"},
                {"name": "Countertop Area", "type": "area", "unit": "sqft"},
                {"name": "Tall Unit Area", "type": "area", "unit": "sqft"},
                {"name": "Hardware", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 5, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    -- False Ceiling Variants
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_false_ceiling, 'Plain', 'plain', 'Simple plain false ceiling', 
         '{
            "attributes": [
                {"name": "Ceiling Area", "type": "area", "unit": "sqft"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 1, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_false_ceiling, 'Peripheral Cove', 'peripheral-cove', 'False ceiling with peripheral cove lighting', 
         '{
            "attributes": [
                {"name": "Ceiling Area", "type": "area", "unit": "sqft"},
                {"name": "Cove Running Feet", "type": "quantity", "unit": "rft"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_false_ceiling, 'Designer', 'designer', 'Custom designer false ceiling', 
         '{
            "attributes": [
                {"name": "Ceiling Area", "type": "area", "unit": "sqft"},
                {"name": "Cove Running Feet", "type": "quantity", "unit": "rft"},
                {"name": "Profile Running Feet", "type": "quantity", "unit": "rft"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 3, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    -- TV Unit Variants
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_tv_unit, 'Wall Mounted', 'wall-mounted', 'Wall mounted TV unit', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft"},
                {"name": "Hinges", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 1, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_tv_unit, 'Floor Standing', 'floor-standing', 'Floor standing TV unit with storage', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft"},
                {"name": "Drawers", "type": "quantity", "unit": "nos"},
                {"name": "Hinges", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_tv_unit, 'Full Wall', 'full-wall', 'Full wall entertainment unit', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft"},
                {"name": "Back Panel Area", "type": "area", "unit": "sqft"},
                {"name": "Drawers", "type": "quantity", "unit": "nos"},
                {"name": "Hinges", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 3, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    -- Vanity Variants
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_vanity, 'Wall Hung', 'wall-hung', 'Wall hung vanity unit', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft"},
                {"name": "Countertop", "type": "quantity", "unit": "nos"},
                {"name": "Mirror", "type": "quantity", "unit": "nos"},
                {"name": "Hardware", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 1, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_vanity, 'Floor Standing', 'floor-standing', 'Floor standing vanity unit', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft"},
                {"name": "Countertop", "type": "quantity", "unit": "nos"},
                {"name": "Mirror", "type": "quantity", "unit": "nos"},
                {"name": "Hardware", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    -- Shoe Rack Variants
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_shoe_rack, 'Open Shelves', 'open-shelves', 'Open shelf shoe rack', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Shelves", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 1, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_shoe_rack, 'With Shutters', 'with-shutters', 'Shoe rack with shutter doors', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft"},
                {"name": "Shelves", "type": "quantity", "unit": "nos"},
                {"name": "Hinges", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    -- Crockery Unit Variants
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_crockery, 'Open Display', 'open-display', 'Open display crockery unit', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Glass Shelves", "type": "quantity", "unit": "nos"},
                {"name": "Back Panel Area", "type": "area", "unit": "sqft"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 1, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_crockery, 'Glass Shutters', 'glass-shutters', 'Crockery unit with glass shutter doors', 
         '{
            "attributes": [
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Glass Shutter Area", "type": "area", "unit": "sqft"},
                {"name": "Wooden Shutter Area", "type": "area", "unit": "sqft"},
                {"name": "Drawers", "type": "quantity", "unit": "nos"},
                {"name": "Hinges", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    -- Study Table Variants
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_study_table, 'Simple', 'simple', 'Simple study table with drawers', 
         '{
            "attributes": [
                {"name": "Table Top Area", "type": "area", "unit": "sqft"},
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Drawers", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 1, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_study_table, 'With Overhead Storage', 'with-overhead', 'Study table with overhead storage', 
         '{
            "attributes": [
                {"name": "Table Top Area", "type": "area", "unit": "sqft"},
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Overhead Storage Area", "type": "area", "unit": "sqft"},
                {"name": "Shutter Area", "type": "area", "unit": "sqft"},
                {"name": "Drawers", "type": "quantity", "unit": "nos"},
                {"name": "Hinges", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    -- Bed Variants
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_bed, 'Platform Bed', 'platform', 'Platform bed with headboard', 
         '{
            "attributes": [
                {"name": "Platform Area", "type": "area", "unit": "sqft"},
                {"name": "Headboard Area", "type": "area", "unit": "sqft"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 1, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_bed, 'Storage Bed', 'storage', 'Bed with under-storage', 
         '{
            "attributes": [
                {"name": "Platform Area", "type": "area", "unit": "sqft"},
                {"name": "Headboard Area", "type": "area", "unit": "sqft"},
                {"name": "Storage Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Hydraulic Mechanism", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    -- Console Variants
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_console, 'Wall Mounted', 'wall-mounted', 'Wall mounted console table', 
         '{
            "attributes": [
                {"name": "Top Area", "type": "area", "unit": "sqft"},
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Drawers", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 1, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    INSERT INTO component_variant_types (tenant_id, component_type_id, name, slug, description, cost_config, display_order, is_active, is_system)
    VALUES 
        (p_tenant_id, v_comp_console, 'Floor Standing', 'floor-standing', 'Floor standing console table', 
         '{
            "attributes": [
                {"name": "Top Area", "type": "area", "unit": "sqft"},
                {"name": "Carcass Area", "type": "area", "unit": "sqft"},
                {"name": "Drawers", "type": "quantity", "unit": "nos"},
                {"name": "Labour", "type": "quantity", "unit": "nos"}
            ]
         }'::jsonb, 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    RAISE NOTICE 'Seed data created successfully for tenant %', p_tenant_id;
END;
$$;


ALTER FUNCTION "public"."seed_quotation_master_data"("p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."seed_quotation_master_data"("p_tenant_id" "uuid") IS 'Seeds the quotation module master data (space types, component types, variant types, cost attributes) for a specific tenant.';



CREATE OR REPLACE FUNCTION "public"."seed_quotation_master_data_v2"("p_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    -- Component Type IDs
    v_comp_wardrobe UUID;
    v_comp_tv_unit UUID;
    v_comp_false_ceiling UUID;
    v_comp_modular_kitchen UUID;
    v_comp_vanity UUID;
    v_comp_shoe_rack UUID;
    v_comp_crockery UUID;
    v_comp_study_table UUID;
    v_comp_bed UUID;
    v_comp_console UUID;
    v_comp_dressing_table UUID;
    v_comp_bar_unit UUID;
    
    -- Cost Item Category IDs
    v_cat_material UUID;
    v_cat_hardware UUID;
    v_cat_finish UUID;
    v_cat_labour UUID;
    v_cat_service UUID;
BEGIN
    -- ========================================================================
    -- DELETE EXISTING DATA (order matters due to foreign keys)
    -- ========================================================================
    
    DELETE FROM component_variants WHERE tenant_id = p_tenant_id AND is_system = true;
    DELETE FROM cost_items WHERE tenant_id = p_tenant_id AND is_system = true;
    DELETE FROM cost_item_categories WHERE tenant_id = p_tenant_id AND is_system = true;
    DELETE FROM component_types WHERE tenant_id = p_tenant_id AND is_system = true;
    DELETE FROM space_types WHERE tenant_id = p_tenant_id AND is_system = true;
    
    -- ========================================================================
    -- SPACE TYPES (Generic - user names instances in quotation)
    -- ========================================================================
    
    INSERT INTO space_types (tenant_id, name, slug, description, icon, display_order, is_active, is_system) VALUES
        (p_tenant_id, 'Bedroom', 'bedroom', 'Any bedroom (Master, Kids, Guest, etc.)', 'bed', 1, true, true),
        (p_tenant_id, 'Kitchen', 'kitchen', 'Cooking and food preparation area', 'utensils', 2, true, true),
        (p_tenant_id, 'Living Room', 'living-room', 'Main living/drawing area', 'sofa', 3, true, true),
        (p_tenant_id, 'Dining', 'dining', 'Dining area', 'utensils-crossed', 4, true, true),
        (p_tenant_id, 'Bathroom', 'bathroom', 'Any bathroom/toilet', 'bath', 5, true, true),
        (p_tenant_id, 'Balcony', 'balcony', 'Any balcony or terrace', 'sun', 6, true, true),
        (p_tenant_id, 'Foyer', 'foyer', 'Entrance/lobby area', 'door-open', 7, true, true),
        (p_tenant_id, 'Study', 'study', 'Study room or home office', 'book-open', 8, true, true),
        (p_tenant_id, 'Pooja Room', 'pooja-room', 'Prayer/worship room', 'flame', 9, true, true),
        (p_tenant_id, 'Utility', 'utility', 'Utility/service area', 'wrench', 10, true, true),
        (p_tenant_id, 'Store Room', 'store-room', 'Storage room', 'archive', 11, true, true),
        (p_tenant_id, 'Theater Room', 'theater-room', 'Home theater', 'film', 12, true, true),
        (p_tenant_id, 'Terrace', 'terrace', 'Open terrace', 'cloud-sun', 13, true, true),
        (p_tenant_id, 'Passage', 'passage', 'Corridor/Hallway', 'move-horizontal', 14, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;

    -- ========================================================================
    -- COMPONENT TYPES (What gets built)
    -- ========================================================================
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Wardrobe', 'wardrobe', 'Storage wardrobe with shutters', 'rectangle-vertical', 1, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_wardrobe FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'wardrobe';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'TV Unit', 'tv-unit', 'Entertainment unit for TV', 'tv', 2, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_tv_unit FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'tv-unit';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'False Ceiling', 'false-ceiling', 'Decorative ceiling work', 'layers', 3, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_false_ceiling FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'false-ceiling';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Modular Kitchen', 'modular-kitchen', 'Complete modular kitchen', 'utensils', 4, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_modular_kitchen FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'modular-kitchen';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Vanity', 'vanity', 'Bathroom vanity with storage', 'square', 5, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_vanity FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'vanity';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Shoe Rack', 'shoe-rack', 'Footwear storage unit', 'footprints', 6, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_shoe_rack FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'shoe-rack';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Crockery Unit', 'crockery-unit', 'Display and storage for crockery', 'wine', 7, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_crockery FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'crockery-unit';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Study Table', 'study-table', 'Desk for study or work', 'laptop', 8, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_study_table FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'study-table';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Bed', 'bed', 'Bed with headboard', 'bed', 9, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_bed FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'bed';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Console', 'console', 'Decorative console table', 'gallery-horizontal-end', 10, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_console FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'console';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Dressing Table', 'dressing-table', 'Vanity/dressing unit', 'square-user', 11, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_dressing_table FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'dressing-table';
    
    INSERT INTO component_types (id, tenant_id, name, slug, description, icon, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Bar Unit', 'bar-unit', 'Home bar counter', 'beer', 12, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_comp_bar_unit FROM component_types WHERE tenant_id = p_tenant_id AND slug = 'bar-unit';

    -- ========================================================================
    -- COMPONENT VARIANTS (Types of components - optional level)
    -- ========================================================================
    
    -- Wardrobe Variants
    INSERT INTO component_variants (tenant_id, component_type_id, name, slug, description, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_comp_wardrobe, 'Sliding', 'sliding', 'Sliding shutter wardrobe', 1, true, true),
        (p_tenant_id, v_comp_wardrobe, 'Openable', 'openable', 'Hinged door wardrobe', 2, true, true),
        (p_tenant_id, v_comp_wardrobe, 'Sliding with Loft', 'sliding-loft', 'Sliding wardrobe with top loft', 3, true, true),
        (p_tenant_id, v_comp_wardrobe, 'Openable with Loft', 'openable-loft', 'Openable wardrobe with top loft', 4, true, true),
        (p_tenant_id, v_comp_wardrobe, 'Walk-in', 'walk-in', 'Walk-in closet style', 5, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    -- Modular Kitchen Variants
    INSERT INTO component_variants (tenant_id, component_type_id, name, slug, description, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_comp_modular_kitchen, 'L-Shape', 'l-shape', 'L-shaped kitchen layout', 1, true, true),
        (p_tenant_id, v_comp_modular_kitchen, 'U-Shape', 'u-shape', 'U-shaped kitchen layout', 2, true, true),
        (p_tenant_id, v_comp_modular_kitchen, 'Parallel', 'parallel', 'Parallel/Galley kitchen', 3, true, true),
        (p_tenant_id, v_comp_modular_kitchen, 'Straight', 'straight', 'Single wall kitchen', 4, true, true),
        (p_tenant_id, v_comp_modular_kitchen, 'Island', 'island', 'Kitchen with island', 5, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    -- False Ceiling Variants
    INSERT INTO component_variants (tenant_id, component_type_id, name, slug, description, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_comp_false_ceiling, 'Plain', 'plain', 'Simple plain ceiling', 1, true, true),
        (p_tenant_id, v_comp_false_ceiling, 'Peripheral Cove', 'peripheral-cove', 'With peripheral cove lighting', 2, true, true),
        (p_tenant_id, v_comp_false_ceiling, 'Designer', 'designer', 'Custom designer ceiling', 3, true, true),
        (p_tenant_id, v_comp_false_ceiling, 'Box Type', 'box-type', 'Box/Tray ceiling', 4, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    -- TV Unit Variants
    INSERT INTO component_variants (tenant_id, component_type_id, name, slug, description, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_comp_tv_unit, 'Wall Mounted', 'wall-mounted', 'Wall mounted unit', 1, true, true),
        (p_tenant_id, v_comp_tv_unit, 'Floor Standing', 'floor-standing', 'Floor standing unit', 2, true, true),
        (p_tenant_id, v_comp_tv_unit, 'Full Wall', 'full-wall', 'Full wall entertainment unit', 3, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    -- Vanity Variants
    INSERT INTO component_variants (tenant_id, component_type_id, name, slug, description, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_comp_vanity, 'Wall Hung', 'wall-hung', 'Wall hung vanity', 1, true, true),
        (p_tenant_id, v_comp_vanity, 'Floor Standing', 'floor-standing', 'Floor standing vanity', 2, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;
    
    -- Bed Variants
    INSERT INTO component_variants (tenant_id, component_type_id, name, slug, description, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_comp_bed, 'Platform', 'platform', 'Platform bed with headboard', 1, true, true),
        (p_tenant_id, v_comp_bed, 'Storage', 'storage', 'Bed with hydraulic storage', 2, true, true),
        (p_tenant_id, v_comp_bed, 'Poster', 'poster', 'Four poster bed', 3, true, true)
    ON CONFLICT (tenant_id, component_type_id, slug) DO NOTHING;

    -- ========================================================================
    -- COST ITEM CATEGORIES
    -- ========================================================================
    
    INSERT INTO cost_item_categories (id, tenant_id, name, slug, description, icon, color, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Material', 'material', 'Raw materials like plywood, MDF, etc.', 'box', '#4A5568', 1, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_cat_material FROM cost_item_categories WHERE tenant_id = p_tenant_id AND slug = 'material';
    
    INSERT INTO cost_item_categories (id, tenant_id, name, slug, description, icon, color, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Hardware', 'hardware', 'Hardware items like hinges, channels, handles', 'wrench', '#2D3748', 2, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_cat_hardware FROM cost_item_categories WHERE tenant_id = p_tenant_id AND slug = 'hardware';
    
    INSERT INTO cost_item_categories (id, tenant_id, name, slug, description, icon, color, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Finish', 'finish', 'Finishing materials like laminates, PU, acrylic', 'paintbrush', '#553C9A', 3, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_cat_finish FROM cost_item_categories WHERE tenant_id = p_tenant_id AND slug = 'finish';
    
    INSERT INTO cost_item_categories (id, tenant_id, name, slug, description, icon, color, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Labour', 'labour', 'Labour and workmanship costs', 'users', '#2B6CB0', 4, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_cat_labour FROM cost_item_categories WHERE tenant_id = p_tenant_id AND slug = 'labour';
    
    INSERT INTO cost_item_categories (id, tenant_id, name, slug, description, icon, color, display_order, is_active, is_system)
    VALUES (gen_random_uuid(), p_tenant_id, 'Service', 'service', 'Services like installation, transport', 'truck', '#276749', 5, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    SELECT id INTO v_cat_service FROM cost_item_categories WHERE tenant_id = p_tenant_id AND slug = 'service';

    -- ========================================================================
    -- COST ITEMS (Anything with a price)
    -- ========================================================================
    
    -- Materials (Area based - sqft)
    INSERT INTO cost_items (tenant_id, category_id, name, slug, description, unit_code, default_rate, quality_tier, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_cat_material, 'HDHMR PreLam 18mm', 'hdhmr-prelam-18mm', 'High Density HMR with pre-laminate finish', 'sqft', 85.00, 'standard', 1, true, true),
        (p_tenant_id, v_cat_material, 'HDHMR PreLam 25mm', 'hdhmr-prelam-25mm', 'High Density HMR 25mm for shelves', 'sqft', 95.00, 'standard', 2, true, true),
        (p_tenant_id, v_cat_material, 'Marine Plywood 18mm', 'marine-ply-18mm', 'BWP Marine grade plywood', 'sqft', 95.00, 'premium', 3, true, true),
        (p_tenant_id, v_cat_material, 'Marine Plywood 12mm', 'marine-ply-12mm', 'BWP Marine grade plywood 12mm', 'sqft', 75.00, 'premium', 4, true, true),
        (p_tenant_id, v_cat_material, 'MDF 18mm', 'mdf-18mm', 'Medium Density Fibreboard', 'sqft', 55.00, 'budget', 5, true, true),
        (p_tenant_id, v_cat_material, 'Particle Board 18mm', 'particle-board-18mm', 'Standard particle board', 'sqft', 45.00, 'budget', 6, true, true),
        (p_tenant_id, v_cat_material, 'Glass (Clear) 5mm', 'glass-clear-5mm', 'Clear float glass', 'sqft', 65.00, 'standard', 7, true, true),
        (p_tenant_id, v_cat_material, 'Glass (Frosted) 5mm', 'glass-frosted-5mm', 'Frosted glass', 'sqft', 85.00, 'standard', 8, true, true),
        (p_tenant_id, v_cat_material, 'Mirror 4mm', 'mirror-4mm', 'Standard mirror', 'sqft', 75.00, 'standard', 9, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    
    -- Finishes (Area based - sqft)
    INSERT INTO cost_items (tenant_id, category_id, name, slug, description, unit_code, default_rate, quality_tier, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_cat_finish, 'Laminate (Economy)', 'laminate-economy', 'Standard laminate finish', 'sqft', 35.00, 'budget', 1, true, true),
        (p_tenant_id, v_cat_finish, 'Laminate (Premium)', 'laminate-premium', 'Premium laminate (Merino, Century)', 'sqft', 55.00, 'standard', 2, true, true),
        (p_tenant_id, v_cat_finish, 'PU Finish', 'pu-finish', 'Polyurethane paint finish', 'sqft', 120.00, 'premium', 3, true, true),
        (p_tenant_id, v_cat_finish, 'Acrylic 1mm', 'acrylic-1mm', '1mm Acrylic sheet finish', 'sqft', 65.00, 'standard', 4, true, true),
        (p_tenant_id, v_cat_finish, 'Acrylic 2mm', 'acrylic-2mm', '2mm Acrylic sheet finish', 'sqft', 95.00, 'premium', 5, true, true),
        (p_tenant_id, v_cat_finish, 'Veneer (Natural)', 'veneer-natural', 'Natural wood veneer', 'sqft', 150.00, 'luxury', 6, true, true),
        (p_tenant_id, v_cat_finish, 'Veneer (Engineered)', 'veneer-engineered', 'Engineered veneer', 'sqft', 95.00, 'premium', 7, true, true),
        (p_tenant_id, v_cat_finish, 'Lacquer Finish', 'lacquer-finish', 'High gloss lacquer', 'sqft', 180.00, 'luxury', 8, true, true),
        (p_tenant_id, v_cat_finish, 'Membrane Finish', 'membrane-finish', 'PVC membrane finish', 'sqft', 75.00, 'standard', 9, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    
    -- Hardware (Quantity based - nos)
    INSERT INTO cost_items (tenant_id, category_id, name, slug, description, unit_code, default_rate, quality_tier, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_cat_hardware, 'Hinge (Standard)', 'hinge-standard', 'Standard concealed hinge', 'nos', 45.00, 'budget', 1, true, true),
        (p_tenant_id, v_cat_hardware, 'Hinge (Soft Close)', 'hinge-soft-close', 'Soft close hydraulic hinge', 'nos', 95.00, 'standard', 2, true, true),
        (p_tenant_id, v_cat_hardware, 'Hinge (German)', 'hinge-german', 'German brand (Hettich/Blum)', 'nos', 180.00, 'premium', 3, true, true),
        (p_tenant_id, v_cat_hardware, 'Drawer Channel (Standard)', 'drawer-channel-standard', 'Standard ball bearing channel', 'nos', 150.00, 'budget', 4, true, true),
        (p_tenant_id, v_cat_hardware, 'Drawer Channel (Soft Close)', 'drawer-channel-soft-close', 'Soft close drawer channel', 'nos', 350.00, 'standard', 5, true, true),
        (p_tenant_id, v_cat_hardware, 'Drawer Channel (Tandem)', 'drawer-channel-tandem', 'Tandem box system', 'nos', 850.00, 'premium', 6, true, true),
        (p_tenant_id, v_cat_hardware, 'Handle (Standard)', 'handle-standard', 'Standard cabinet handle', 'nos', 45.00, 'budget', 7, true, true),
        (p_tenant_id, v_cat_hardware, 'Handle (Premium)', 'handle-premium', 'Premium designer handle', 'nos', 150.00, 'standard', 8, true, true),
        (p_tenant_id, v_cat_hardware, 'Handle (Italian)', 'handle-italian', 'Imported Italian handle', 'nos', 450.00, 'luxury', 9, true, true),
        (p_tenant_id, v_cat_hardware, 'Sliding Mechanism (2 Door)', 'sliding-mechanism-2door', 'Sliding wardrobe mechanism for 2 doors', 'nos', 4500.00, 'standard', 10, true, true),
        (p_tenant_id, v_cat_hardware, 'Sliding Mechanism (3 Door)', 'sliding-mechanism-3door', 'Sliding wardrobe mechanism for 3 doors', 'nos', 6500.00, 'standard', 11, true, true),
        (p_tenant_id, v_cat_hardware, 'Hydraulic Bed Mechanism', 'hydraulic-bed', 'Hydraulic lift for storage bed', 'nos', 8500.00, 'standard', 12, true, true),
        (p_tenant_id, v_cat_hardware, 'Profile (Aluminium)', 'profile-aluminium', 'Aluminium profile for glass/shutter', 'rft', 85.00, 'standard', 13, true, true),
        (p_tenant_id, v_cat_hardware, 'Profile (G Handle)', 'profile-g-handle', 'G-profile handle', 'rft', 120.00, 'standard', 14, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    
    -- Labour (Area or Job based)
    INSERT INTO cost_items (tenant_id, category_id, name, slug, description, unit_code, default_rate, quality_tier, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_cat_labour, 'Carpentry Labour', 'carpentry-labour', 'Carpentry work labour per sqft', 'sqft', 45.00, 'standard', 1, true, true),
        (p_tenant_id, v_cat_labour, 'Lamination Labour', 'lamination-labour', 'Laminate application labour', 'sqft', 15.00, 'standard', 2, true, true),
        (p_tenant_id, v_cat_labour, 'PU Labour', 'pu-labour', 'PU finish application labour', 'sqft', 65.00, 'standard', 3, true, true),
        (p_tenant_id, v_cat_labour, 'False Ceiling Labour', 'false-ceiling-labour', 'False ceiling installation', 'sqft', 25.00, 'standard', 4, true, true),
        (p_tenant_id, v_cat_labour, 'Hardware Fitting', 'hardware-fitting', 'Hardware installation per piece', 'nos', 25.00, 'standard', 5, true, true),
        (p_tenant_id, v_cat_labour, 'Glass Fitting', 'glass-fitting', 'Glass cutting and fitting', 'sqft', 35.00, 'standard', 6, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;
    
    -- Services (Job/Fixed based)
    INSERT INTO cost_items (tenant_id, category_id, name, slug, description, unit_code, default_rate, quality_tier, display_order, is_active, is_system) VALUES
        (p_tenant_id, v_cat_service, 'Design Consultation', 'design-consultation', 'Interior design consultation', 'job', 15000.00, 'standard', 1, true, true),
        (p_tenant_id, v_cat_service, '3D Visualization', '3d-visualization', '3D rendering per room', 'nos', 5000.00, 'standard', 2, true, true),
        (p_tenant_id, v_cat_service, 'Site Supervision', 'site-supervision', 'On-site project supervision', 'job', 25000.00, 'standard', 3, true, true),
        (p_tenant_id, v_cat_service, 'Transportation', 'transportation', 'Material transportation', 'job', 8000.00, 'standard', 4, true, true),
        (p_tenant_id, v_cat_service, 'Site Cleaning', 'site-cleaning', 'Post-work site cleanup', 'job', 5000.00, 'standard', 5, true, true)
    ON CONFLICT (tenant_id, slug) DO NOTHING;

    RAISE NOTICE 'V2 Seed data created successfully for tenant %', p_tenant_id;
END;
$$;


ALTER FUNCTION "public"."seed_quotation_master_data_v2"("p_tenant_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."seed_quotation_master_data_v2"("p_tenant_id" "uuid") IS 'Seeds the quotation module V2 master data (space types, components, variants, cost item categories, cost items) for a specific tenant.';



CREATE OR REPLACE FUNCTION "public"."seed_revenue_heads"("p_tenant_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Delete existing for this tenant
    DELETE FROM revenue_heads WHERE tenant_id = p_tenant_id;
    
    INSERT INTO revenue_heads (tenant_id, code, name, description, category, gl_account_code, display_order) VALUES
    -- Design Fees
    (p_tenant_id, 'REV-DESIGN', 'Design Consultation Fee', 'Revenue from design consultation and planning services', 'design_fee', '4001', 1),
    (p_tenant_id, 'REV-3D', '3D Visualization Fee', 'Revenue from 3D renders and visualization', 'design_fee', '4002', 2),
    
    -- Material Margins
    (p_tenant_id, 'REV-MAT-PLY', 'Material Margin - Plywood & MDF', 'Margin on plywood, MDF, block board sales', 'material_margin', '4101', 10),
    (p_tenant_id, 'REV-MAT-HW', 'Material Margin - Hardware', 'Margin on hinges, channels, fittings', 'material_margin', '4102', 11),
    (p_tenant_id, 'REV-MAT-LAM', 'Material Margin - Laminates', 'Margin on laminates, veneers, acrylic', 'material_margin', '4103', 12),
    (p_tenant_id, 'REV-MAT-PAINT', 'Material Margin - Paints & Finishes', 'Margin on paints, PU, stains', 'material_margin', '4104', 13),
    (p_tenant_id, 'REV-MAT-GLASS', 'Material Margin - Glass & Mirror', 'Margin on glass, mirror, toughened glass', 'material_margin', '4105', 14),
    (p_tenant_id, 'REV-MAT-STONE', 'Material Margin - Stone & Quartz', 'Margin on quartz, granite, marble', 'material_margin', '4106', 15),
    (p_tenant_id, 'REV-MAT-OTHER', 'Material Margin - Other', 'Margin on other materials', 'material_margin', '4199', 19),
    
    -- Execution/Labor
    (p_tenant_id, 'REV-EXEC', 'Execution Margin', 'Margin on carpentry and installation labor', 'execution_margin', '4201', 20),
    (p_tenant_id, 'REV-SITE', 'Site Supervision', 'Site supervision and project management fees', 'execution_margin', '4202', 21),
    
    -- Commissions (Appliances, Lighting)
    (p_tenant_id, 'REV-COMM-APP', 'Appliance Commission', 'Commission on kitchen appliances (chimney, hob, oven, etc.)', 'appliance_commission', '4301', 30),
    (p_tenant_id, 'REV-COMM-LIGHT', 'Lighting Commission', 'Commission on lighting products (fixtures, LEDs, etc.)', 'lighting_commission', '4302', 31),
    (p_tenant_id, 'REV-COMM-SANITARY', 'Sanitary Commission', 'Commission on sanitary ware and bathroom fittings', 'appliance_commission', '4303', 32),
    (p_tenant_id, 'REV-COMM-ELEC', 'Electrical Commission', 'Commission on electrical items (fans, switches, etc.)', 'appliance_commission', '4304', 33),
    
    -- Referral/Partner
    (p_tenant_id, 'REV-REF', 'Referral Commission', 'Commission from partner referrals (AC, false ceiling, etc.)', 'referral_commission', '4401', 40),
    
    -- Service Charges
    (p_tenant_id, 'REV-SVC-HANDLING', 'Handling Charges', 'Material handling and logistics charges', 'service_charge', '4501', 50),
    (p_tenant_id, 'REV-SVC-WARRANTY', 'Extended Warranty', 'Extended warranty service fees', 'service_charge', '4502', 51);
    
    RETURN 'Seeded ' || (SELECT COUNT(*) FROM revenue_heads WHERE tenant_id = p_tenant_id) || ' revenue heads for tenant.';
END;
$$;


ALTER FUNCTION "public"."seed_revenue_heads"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_stock_data"("p_tenant_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_vendor_plywood UUID;
    v_vendor_hardware UUID;
    v_vendor_fabric UUID;
    v_vendor_glass UUID;
    v_vendor_paint UUID;
    v_vendor_laminate UUID;
    v_vendor_stone UUID;
    v_vendor_electrical UUID;
BEGIN
    -- =========================================================================
    -- INSERT VENDORS
    -- =========================================================================
    
    -- 1. Plywood & Wood Vendor
    INSERT INTO stock_vendors (id, tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (gen_random_uuid(), p_tenant_id, 'VND-0001', 'Century Plyboards India Ltd', 'Century Ply', 'Rajesh Kumar', 'sales@centuryply.com', '9876543210', 'Bangalore', 'Karnataka', '29AAACR5055K1ZK', 'Net 30', 30, 5, true)
    RETURNING id INTO v_vendor_plywood;

    -- 2. Hardware Vendor
    INSERT INTO stock_vendors (id, tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (gen_random_uuid(), p_tenant_id, 'VND-0002', 'Hettich India Pvt Ltd', 'Hettich', 'Amit Sharma', 'orders@hettich.in', '9876543211', 'Pune', 'Maharashtra', '27AABCH1234K1Z5', 'Net 45', 45, 5, true)
    RETURNING id INTO v_vendor_hardware;

    -- 3. Fabric & Upholstery Vendor
    INSERT INTO stock_vendors (id, tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (gen_random_uuid(), p_tenant_id, 'VND-0003', 'D''Decor Home Fabrics', 'D''Decor', 'Priya Patel', 'wholesale@ddecor.com', '9876543212', 'Mumbai', 'Maharashtra', '27AABCD5678K1Z2', 'Net 30', 30, 4, true)
    RETURNING id INTO v_vendor_fabric;

    -- 4. Glass Vendor
    INSERT INTO stock_vendors (id, tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (gen_random_uuid(), p_tenant_id, 'VND-0004', 'Saint-Gobain Glass India', 'Saint-Gobain', 'Vikram Singh', 'commercial@saint-gobain.in', '9876543213', 'Chennai', 'Tamil Nadu', '33AABCS9012K1Z8', 'Net 30', 30, 5, true)
    RETURNING id INTO v_vendor_glass;

    -- 5. Paint Vendor
    INSERT INTO stock_vendors (id, tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (gen_random_uuid(), p_tenant_id, 'VND-0005', 'Asian Paints Ltd', 'Asian Paints', 'Suresh Menon', 'dealers@asianpaints.com', '9876543214', 'Mumbai', 'Maharashtra', '27AAACA3456K1Z3', 'Net 15', 15, 5, true)
    RETURNING id INTO v_vendor_paint;

    -- 6. Laminate Vendor
    INSERT INTO stock_vendors (id, tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (gen_random_uuid(), p_tenant_id, 'VND-0006', 'Merino Industries Ltd', 'Merino Laminates', 'Deepak Jain', 'sales@merinoindia.com', '9876543215', 'New Delhi', 'Delhi', '07AABCM7890K1Z1', 'Net 30', 30, 4, true)
    RETURNING id INTO v_vendor_laminate;

    -- 7. Stone & Marble Vendor
    INSERT INTO stock_vendors (id, tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (gen_random_uuid(), p_tenant_id, 'VND-0007', 'Pokarna Engineered Stone', 'Pokarna', 'Rahul Agarwal', 'orders@pokarna.com', '9876543216', 'Hyderabad', 'Telangana', '36AABCP2345K1Z7', 'Net 45', 45, 4, true)
    RETURNING id INTO v_vendor_stone;

    -- 8. Electrical & Lighting Vendor
    INSERT INTO stock_vendors (id, tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (gen_random_uuid(), p_tenant_id, 'VND-0008', 'Havells India Ltd', 'Havells', 'Ankit Gupta', 'b2b@havells.com', '9876543217', 'Noida', 'Uttar Pradesh', '09AAACH6789K1Z4', 'Net 30', 30, 5, true)
    RETURNING id INTO v_vendor_electrical;

    -- =========================================================================
    -- INSERT MATERIALS - PLYWOOD & WOOD
    -- =========================================================================
    
    INSERT INTO stock_materials (company_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, preferred_vendor_id, storage_location, is_active) VALUES
    -- Plywood
    (p_tenant_id, '18mm BWP Marine Plywood', 'PLY-BWP-18', 'Boiling Water Proof plywood for wet areas, 8x4 ft sheets', 'Plywood', 'raw_material', 'sheet', 45, 20, 30, 2800, 3500, v_vendor_plywood, 'Warehouse A - Section 1', true),
    (p_tenant_id, '12mm BWP Marine Plywood', 'PLY-BWP-12', 'Boiling Water Proof plywood, 8x4 ft sheets', 'Plywood', 'raw_material', 'sheet', 60, 25, 40, 2200, 2750, v_vendor_plywood, 'Warehouse A - Section 1', true),
    (p_tenant_id, '18mm MR Grade Plywood', 'PLY-MR-18', 'Moisture Resistant plywood for general use, 8x4 ft sheets', 'Plywood', 'raw_material', 'sheet', 80, 30, 50, 1800, 2250, v_vendor_plywood, 'Warehouse A - Section 1', true),
    (p_tenant_id, '12mm MR Grade Plywood', 'PLY-MR-12', 'Moisture Resistant plywood, 8x4 ft sheets', 'Plywood', 'raw_material', 'sheet', 100, 40, 60, 1400, 1750, v_vendor_plywood, 'Warehouse A - Section 1', true),
    (p_tenant_id, '6mm MR Grade Plywood', 'PLY-MR-06', 'Thin plywood for backing, 8x4 ft sheets', 'Plywood', 'raw_material', 'sheet', 50, 20, 30, 850, 1100, v_vendor_plywood, 'Warehouse A - Section 1', true),
    (p_tenant_id, '19mm Block Board', 'PLY-BB-19', 'Block board for furniture cores, 8x4 ft sheets', 'Plywood', 'raw_material', 'sheet', 35, 15, 25, 2400, 3000, v_vendor_plywood, 'Warehouse A - Section 2', true),
    (p_tenant_id, '18mm Pre-Laminated MDF', 'MDF-PL-18', 'White pre-laminated MDF board, 8x4 ft', 'MDF', 'raw_material', 'sheet', 40, 15, 25, 1600, 2000, v_vendor_plywood, 'Warehouse A - Section 2', true),
    (p_tenant_id, '12mm Plain MDF', 'MDF-PL-12', 'Plain MDF for painting, 8x4 ft', 'MDF', 'raw_material', 'sheet', 55, 20, 30, 1100, 1400, v_vendor_plywood, 'Warehouse A - Section 2', true),
    (p_tenant_id, '8mm HDHMR Board', 'HDHMR-08', 'High Density HMR board, termite proof, 8x4 ft', 'HDHMR', 'raw_material', 'sheet', 30, 10, 20, 1900, 2400, v_vendor_plywood, 'Warehouse A - Section 2', true);

    -- =========================================================================
    -- INSERT MATERIALS - HARDWARE
    -- =========================================================================
    
    INSERT INTO stock_materials (company_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, preferred_vendor_id, storage_location, is_active) VALUES
    -- Hinges
    (p_tenant_id, 'Soft Close Hinge - Full Overlay', 'HW-HNG-SC-FO', 'Hettich soft close cabinet hinge, full overlay', 'Hardware - Hinges', 'hardware', 'pair', 200, 50, 100, 180, 250, v_vendor_hardware, 'Warehouse B - Rack 1', true),
    (p_tenant_id, 'Soft Close Hinge - Half Overlay', 'HW-HNG-SC-HO', 'Hettich soft close cabinet hinge, half overlay', 'Hardware - Hinges', 'hardware', 'pair', 150, 40, 80, 180, 250, v_vendor_hardware, 'Warehouse B - Rack 1', true),
    (p_tenant_id, 'Hydraulic Hinge 165°', 'HW-HNG-HYD-165', 'Wide angle hydraulic hinge for corner cabinets', 'Hardware - Hinges', 'hardware', 'pair', 80, 20, 40, 350, 480, v_vendor_hardware, 'Warehouse B - Rack 1', true),
    -- Channels & Slides
    (p_tenant_id, 'Telescopic Channel 18"', 'HW-CH-TEL-18', 'Ball bearing telescopic drawer channel, 18 inch', 'Hardware - Channels', 'hardware', 'pair', 120, 30, 60, 450, 600, v_vendor_hardware, 'Warehouse B - Rack 2', true),
    (p_tenant_id, 'Telescopic Channel 20"', 'HW-CH-TEL-20', 'Ball bearing telescopic drawer channel, 20 inch', 'Hardware - Channels', 'hardware', 'pair', 100, 25, 50, 500, 680, v_vendor_hardware, 'Warehouse B - Rack 2', true),
    (p_tenant_id, 'Soft Close Telescopic 18"', 'HW-CH-SC-18', 'Soft close telescopic channel, 18 inch', 'Hardware - Channels', 'hardware', 'pair', 80, 20, 40, 850, 1150, v_vendor_hardware, 'Warehouse B - Rack 2', true),
    (p_tenant_id, 'Tandem Box 500mm', 'HW-TB-500', 'Hettich Tandem Box drawer system, 500mm depth', 'Hardware - Drawer Systems', 'hardware', 'set', 25, 10, 15, 3200, 4200, v_vendor_hardware, 'Warehouse B - Rack 3', true),
    -- Handles & Knobs
    (p_tenant_id, 'Profile Handle 6" - Black', 'HW-HDL-PF-6B', 'Aluminum profile handle, matte black, 6 inch', 'Hardware - Handles', 'hardware', 'pcs', 100, 25, 50, 120, 180, v_vendor_hardware, 'Warehouse B - Rack 4', true),
    (p_tenant_id, 'Profile Handle 8" - Black', 'HW-HDL-PF-8B', 'Aluminum profile handle, matte black, 8 inch', 'Hardware - Handles', 'hardware', 'pcs', 80, 20, 40, 150, 220, v_vendor_hardware, 'Warehouse B - Rack 4', true),
    (p_tenant_id, 'G-Profile Handle - SS', 'HW-HDL-GP-SS', 'Stainless steel G-profile for modular kitchen', 'Hardware - Handles', 'hardware', 'rft', 200, 50, 100, 85, 120, v_vendor_hardware, 'Warehouse B - Rack 4', true),
    -- Kitchen Hardware
    (p_tenant_id, 'Corner Carousel Unit', 'HW-KIT-CCU', 'Revolving corner unit for L-shaped kitchen, 900mm', 'Hardware - Kitchen', 'hardware', 'set', 8, 3, 5, 8500, 11500, v_vendor_hardware, 'Warehouse B - Rack 5', true),
    (p_tenant_id, 'Tall Unit Pull-Out', 'HW-KIT-TPO', 'Tall unit pull-out basket system, 5 tier', 'Hardware - Kitchen', 'hardware', 'set', 6, 2, 4, 12000, 16000, v_vendor_hardware, 'Warehouse B - Rack 5', true),
    (p_tenant_id, 'Cutlery Tray Insert', 'HW-KIT-CTI', 'Wooden cutlery organizer, fits 600mm drawer', 'Hardware - Kitchen', 'hardware', 'pcs', 20, 5, 10, 1800, 2500, v_vendor_hardware, 'Warehouse B - Rack 5', true);

    -- =========================================================================
    -- INSERT MATERIALS - LAMINATES
    -- =========================================================================
    
    INSERT INTO stock_materials (company_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, 'Laminate - Natural Oak', 'LAM-WD-NOK', 'Merino 1mm decorative laminate, natural oak finish, 8x4 ft', 'Laminates - Wood Grain', 'raw_material', 'sheet', 30, 10, 20, 1400, 1800, v_vendor_laminate, 'Warehouse A - Section 3', true),
    (p_tenant_id, 'Laminate - Walnut Dark', 'LAM-WD-WDK', 'Merino 1mm decorative laminate, dark walnut, 8x4 ft', 'Laminates - Wood Grain', 'raw_material', 'sheet', 25, 10, 15, 1400, 1800, v_vendor_laminate, 'Warehouse A - Section 3', true),
    (p_tenant_id, 'Laminate - White Gloss', 'LAM-SO-WHG', 'High gloss white solid color laminate, 8x4 ft', 'Laminates - Solid', 'raw_material', 'sheet', 40, 15, 25, 1200, 1550, v_vendor_laminate, 'Warehouse A - Section 3', true),
    (p_tenant_id, 'Laminate - Grey Matt', 'LAM-SO-GRM', 'Matt grey solid color laminate, 8x4 ft', 'Laminates - Solid', 'raw_material', 'sheet', 35, 12, 20, 1200, 1550, v_vendor_laminate, 'Warehouse A - Section 3', true),
    (p_tenant_id, 'Laminate - Charcoal', 'LAM-SO-CHR', 'Charcoal solid laminate with texture, 8x4 ft', 'Laminates - Solid', 'raw_material', 'sheet', 20, 8, 15, 1350, 1750, v_vendor_laminate, 'Warehouse A - Section 3', true),
    (p_tenant_id, 'Acrylic Laminate - White', 'LAM-AC-WHT', 'High gloss acrylic finish laminate, white, 8x4 ft', 'Laminates - Acrylic', 'raw_material', 'sheet', 15, 5, 10, 3800, 4800, v_vendor_laminate, 'Warehouse A - Section 3', true),
    (p_tenant_id, 'PU Finish Laminate - Cream', 'LAM-PU-CRM', 'Premium PU painted finish, cream, 8x4 ft', 'Laminates - PU', 'raw_material', 'sheet', 12, 4, 8, 4500, 5800, v_vendor_laminate, 'Warehouse A - Section 3', true);

    -- =========================================================================
    -- INSERT MATERIALS - PAINTS & FINISHES
    -- =========================================================================
    
    INSERT INTO stock_materials (company_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, 'Primer - White', 'PNT-PRM-WHT', 'Asian Paints wood primer, white, 4 litre', 'Paints - Primer', 'consumable', 'can', 25, 10, 15, 850, 1100, v_vendor_paint, 'Warehouse C - Section 1', true),
    (p_tenant_id, 'PU Clear Finish - Matt', 'PNT-PU-CLM', 'Polyurethane clear coat, matt finish, 4 litre', 'Paints - PU', 'consumable', 'can', 15, 5, 10, 2800, 3600, v_vendor_paint, 'Warehouse C - Section 1', true),
    (p_tenant_id, 'PU Clear Finish - Gloss', 'PNT-PU-CLG', 'Polyurethane clear coat, gloss finish, 4 litre', 'Paints - PU', 'consumable', 'can', 12, 4, 8, 2800, 3600, v_vendor_paint, 'Warehouse C - Section 1', true),
    (p_tenant_id, 'Duco Paint - White', 'PNT-DCO-WHT', 'Nitrocellulose duco paint, white, 4 litre', 'Paints - Duco', 'consumable', 'can', 10, 3, 6, 3200, 4100, v_vendor_paint, 'Warehouse C - Section 1', true),
    (p_tenant_id, 'Wood Stain - Walnut', 'PNT-STN-WAL', 'Wood stain, walnut shade, 1 litre', 'Paints - Stain', 'consumable', 'can', 18, 6, 12, 650, 850, v_vendor_paint, 'Warehouse C - Section 1', true),
    (p_tenant_id, 'Wood Stain - Mahogany', 'PNT-STN-MAH', 'Wood stain, mahogany shade, 1 litre', 'Paints - Stain', 'consumable', 'can', 15, 5, 10, 650, 850, v_vendor_paint, 'Warehouse C - Section 1', true);

    -- =========================================================================
    -- INSERT MATERIALS - ADHESIVES & CONSUMABLES
    -- =========================================================================
    
    INSERT INTO stock_materials (company_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, 'Fevicol SH', 'ADH-FEV-SH', 'Synthetic resin adhesive for plywood, 50 kg drum', 'Adhesives', 'consumable', 'drum', 8, 3, 5, 4500, 5500, v_vendor_plywood, 'Warehouse C - Section 2', true),
    (p_tenant_id, 'Fevicol Marine', 'ADH-FEV-MR', 'Waterproof adhesive for wet areas, 20 kg', 'Adhesives', 'consumable', 'bucket', 6, 2, 4, 3200, 4000, v_vendor_plywood, 'Warehouse C - Section 2', true),
    (p_tenant_id, 'Contact Adhesive SR', 'ADH-CON-SR', 'Spray grade contact adhesive, 5 litre', 'Adhesives', 'consumable', 'can', 15, 5, 10, 1800, 2300, v_vendor_plywood, 'Warehouse C - Section 2', true),
    (p_tenant_id, 'PVC Edge Band - White 22mm', 'EDG-PVC-W22', 'PVC edge banding tape, white, 22mm x 50m roll', 'Edge Bands', 'consumable', 'roll', 25, 8, 15, 450, 600, v_vendor_laminate, 'Warehouse C - Section 3', true),
    (p_tenant_id, 'PVC Edge Band - Black 22mm', 'EDG-PVC-B22', 'PVC edge banding tape, black, 22mm x 50m roll', 'Edge Bands', 'consumable', 'roll', 20, 6, 12, 450, 600, v_vendor_laminate, 'Warehouse C - Section 3', true),
    (p_tenant_id, 'ABS Edge Band - Oak 22mm', 'EDG-ABS-O22', 'ABS edge banding with wood grain, 22mm x 25m roll', 'Edge Bands', 'consumable', 'roll', 15, 5, 10, 680, 900, v_vendor_laminate, 'Warehouse C - Section 3', true),
    (p_tenant_id, 'Sandpaper 120 Grit', 'SND-120', 'Sandpaper sheet 120 grit, 9x11 inch', 'Abrasives', 'consumable', 'sheet', 200, 50, 100, 25, 40, v_vendor_paint, 'Warehouse C - Section 4', true),
    (p_tenant_id, 'Sandpaper 220 Grit', 'SND-220', 'Sandpaper sheet 220 grit, 9x11 inch', 'Abrasives', 'consumable', 'sheet', 200, 50, 100, 28, 45, v_vendor_paint, 'Warehouse C - Section 4', true),
    (p_tenant_id, 'Sandpaper 400 Grit', 'SND-400', 'Sandpaper sheet 400 grit for finishing, 9x11 inch', 'Abrasives', 'consumable', 'sheet', 150, 40, 80, 32, 50, v_vendor_paint, 'Warehouse C - Section 4', true);

    -- =========================================================================
    -- INSERT MATERIALS - GLASS
    -- =========================================================================
    
    INSERT INTO stock_materials (company_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, 'Clear Float Glass 5mm', 'GLS-CLR-05', 'Clear float glass 5mm thick, per sqft', 'Glass - Clear', 'raw_material', 'sqft', 500, 100, 200, 85, 120, v_vendor_glass, 'Warehouse D - Section 1', true),
    (p_tenant_id, 'Clear Float Glass 8mm', 'GLS-CLR-08', 'Clear float glass 8mm thick, per sqft', 'Glass - Clear', 'raw_material', 'sqft', 300, 80, 150, 140, 190, v_vendor_glass, 'Warehouse D - Section 1', true),
    (p_tenant_id, 'Toughened Glass 10mm', 'GLS-TGH-10', 'Tempered safety glass 10mm, per sqft', 'Glass - Toughened', 'raw_material', 'sqft', 200, 50, 100, 280, 380, v_vendor_glass, 'Warehouse D - Section 1', true),
    (p_tenant_id, 'Frosted Glass 5mm', 'GLS-FRS-05', 'Acid etched frosted glass 5mm, per sqft', 'Glass - Frosted', 'raw_material', 'sqft', 150, 40, 80, 120, 165, v_vendor_glass, 'Warehouse D - Section 2', true),
    (p_tenant_id, 'Lacquered Glass - White', 'GLS-LAC-WHT', 'Back painted white glass 5mm, per sqft', 'Glass - Lacquered', 'raw_material', 'sqft', 100, 30, 50, 180, 250, v_vendor_glass, 'Warehouse D - Section 2', true),
    (p_tenant_id, 'Lacquered Glass - Black', 'GLS-LAC-BLK', 'Back painted black glass 5mm, per sqft', 'Glass - Lacquered', 'raw_material', 'sqft', 80, 25, 40, 180, 250, v_vendor_glass, 'Warehouse D - Section 2', true),
    (p_tenant_id, 'Mirror - Clear 4mm', 'GLS-MIR-04', 'Clear silver mirror 4mm, per sqft', 'Glass - Mirror', 'raw_material', 'sqft', 200, 50, 100, 95, 140, v_vendor_glass, 'Warehouse D - Section 3', true),
    (p_tenant_id, 'Mirror - Bronze Tint', 'GLS-MIR-BRZ', 'Bronze tinted mirror 4mm, per sqft', 'Glass - Mirror', 'raw_material', 'sqft', 80, 20, 40, 130, 185, v_vendor_glass, 'Warehouse D - Section 3', true);

    -- =========================================================================
    -- INSERT MATERIALS - FABRICS & UPHOLSTERY
    -- =========================================================================
    
    INSERT INTO stock_materials (company_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, 'Upholstery Fabric - Linen Grey', 'FAB-UPH-LGR', 'Premium linen blend upholstery fabric, grey, per meter', 'Fabrics - Upholstery', 'raw_material', 'mtr', 80, 20, 40, 650, 900, v_vendor_fabric, 'Warehouse E - Section 1', true),
    (p_tenant_id, 'Upholstery Fabric - Velvet Blue', 'FAB-UPH-VBL', 'Velvet upholstery fabric, royal blue, per meter', 'Fabrics - Upholstery', 'raw_material', 'mtr', 50, 15, 25, 1200, 1650, v_vendor_fabric, 'Warehouse E - Section 1', true),
    (p_tenant_id, 'Curtain Fabric - Blackout', 'FAB-CUR-BLK', 'Blackout curtain fabric, multiple colors, per meter', 'Fabrics - Curtains', 'raw_material', 'mtr', 100, 30, 50, 450, 650, v_vendor_fabric, 'Warehouse E - Section 2', true),
    (p_tenant_id, 'Curtain Fabric - Sheer White', 'FAB-CUR-SHW', 'Sheer voile curtain fabric, white, per meter', 'Fabrics - Curtains', 'raw_material', 'mtr', 120, 40, 60, 280, 400, v_vendor_fabric, 'Warehouse E - Section 2', true),
    (p_tenant_id, 'Leather - Tan Full Grain', 'FAB-LTH-TFG', 'Full grain leather, tan, per sqft', 'Fabrics - Leather', 'raw_material', 'sqft', 150, 40, 80, 180, 260, v_vendor_fabric, 'Warehouse E - Section 3', true),
    (p_tenant_id, 'Leatherette - Black', 'FAB-LRT-BLK', 'Premium leatherette/rexine, black, per meter', 'Fabrics - Leatherette', 'raw_material', 'mtr', 100, 25, 50, 350, 500, v_vendor_fabric, 'Warehouse E - Section 3', true),
    (p_tenant_id, 'Foam - 40 Density', 'FAB-FOM-40D', 'High resilience foam 40 density, per sqft (2" thick)', 'Fabrics - Foam', 'raw_material', 'sqft', 200, 50, 100, 65, 95, v_vendor_fabric, 'Warehouse E - Section 4', true),
    (p_tenant_id, 'Foam - 32 Density', 'FAB-FOM-32D', 'Medium density foam 32 density, per sqft (2" thick)', 'Fabrics - Foam', 'raw_material', 'sqft', 250, 60, 120, 45, 70, v_vendor_fabric, 'Warehouse E - Section 4', true);

    -- =========================================================================
    -- INSERT MATERIALS - STONE & COUNTERTOPS
    -- =========================================================================
    
    INSERT INTO stock_materials (company_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, 'Quartz Slab - Calacatta White', 'STN-QTZ-CAL', 'Engineered quartz, calacatta pattern, per sqft', 'Stone - Quartz', 'raw_material', 'sqft', 100, 25, 50, 550, 750, v_vendor_stone, 'Warehouse F - Section 1', true),
    (p_tenant_id, 'Quartz Slab - Pure White', 'STN-QTZ-PWH', 'Engineered quartz, pure white, per sqft', 'Stone - Quartz', 'raw_material', 'sqft', 120, 30, 60, 450, 620, v_vendor_stone, 'Warehouse F - Section 1', true),
    (p_tenant_id, 'Quartz Slab - Grey Mist', 'STN-QTZ-GRM', 'Engineered quartz, grey with subtle pattern, per sqft', 'Stone - Quartz', 'raw_material', 'sqft', 80, 20, 40, 480, 660, v_vendor_stone, 'Warehouse F - Section 1', true),
    (p_tenant_id, 'Granite - Black Galaxy', 'STN-GRN-BKG', 'Natural granite, black galaxy, per sqft', 'Stone - Granite', 'raw_material', 'sqft', 60, 15, 30, 280, 400, v_vendor_stone, 'Warehouse F - Section 2', true),
    (p_tenant_id, 'Granite - Tan Brown', 'STN-GRN-TBR', 'Natural granite, tan brown, per sqft', 'Stone - Granite', 'raw_material', 'sqft', 50, 12, 25, 220, 320, v_vendor_stone, 'Warehouse F - Section 2', true),
    (p_tenant_id, 'Italian Marble - Statuario', 'STN-MRB-STA', 'Premium Italian marble, statuario, per sqft', 'Stone - Marble', 'raw_material', 'sqft', 40, 10, 20, 1200, 1650, v_vendor_stone, 'Warehouse F - Section 3', true),
    (p_tenant_id, 'Indian Marble - Makrana White', 'STN-MRB-MAK', 'Indian white marble from Makrana, per sqft', 'Stone - Marble', 'raw_material', 'sqft', 80, 20, 40, 380, 520, v_vendor_stone, 'Warehouse F - Section 3', true);

    -- =========================================================================
    -- INSERT MATERIALS - ELECTRICAL & LIGHTING
    -- =========================================================================
    
    INSERT INTO stock_materials (company_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, 'LED Strip Light - Warm White', 'ELC-LED-WWH', 'LED strip 12V, warm white 3000K, per meter', 'Electrical - LED', 'accessory', 'mtr', 100, 25, 50, 120, 180, v_vendor_electrical, 'Warehouse G - Section 1', true),
    (p_tenant_id, 'LED Strip Light - Cool White', 'ELC-LED-CWH', 'LED strip 12V, cool white 6000K, per meter', 'Electrical - LED', 'accessory', 'mtr', 80, 20, 40, 120, 180, v_vendor_electrical, 'Warehouse G - Section 1', true),
    (p_tenant_id, 'LED Driver 30W', 'ELC-DRV-30W', 'Constant voltage LED driver 12V 30W', 'Electrical - Drivers', 'accessory', 'pcs', 30, 10, 20, 350, 480, v_vendor_electrical, 'Warehouse G - Section 2', true),
    (p_tenant_id, 'LED Driver 60W', 'ELC-DRV-60W', 'Constant voltage LED driver 12V 60W', 'Electrical - Drivers', 'accessory', 'pcs', 25, 8, 15, 550, 750, v_vendor_electrical, 'Warehouse G - Section 2', true),
    (p_tenant_id, 'COB Profile Light 10W', 'ELC-COB-10W', 'Recessed COB profile light 10W, warm white', 'Electrical - Lights', 'accessory', 'pcs', 50, 15, 30, 280, 400, v_vendor_electrical, 'Warehouse G - Section 3', true),
    (p_tenant_id, 'Modular Switch - 6A', 'ELC-SWT-06A', 'Havells modular switch 6A', 'Electrical - Switches', 'accessory', 'pcs', 100, 30, 50, 85, 125, v_vendor_electrical, 'Warehouse G - Section 4', true),
    (p_tenant_id, 'Modular Socket - 16A', 'ELC-SOK-16A', 'Havells modular socket 16A with shutter', 'Electrical - Switches', 'accessory', 'pcs', 60, 20, 35, 145, 210, v_vendor_electrical, 'Warehouse G - Section 4', true),
    (p_tenant_id, 'USB Charging Module', 'ELC-USB-2P', 'Dual USB charging module 2.1A', 'Electrical - Switches', 'accessory', 'pcs', 40, 10, 20, 380, 520, v_vendor_electrical, 'Warehouse G - Section 4', true);

    RETURN 'Stock data seeded successfully for tenant: ' || p_tenant_id::TEXT;
END;
$$;


ALTER FUNCTION "public"."seed_stock_data"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_stock_data_v2"("p_tenant_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    -- Brand IDs
    v_brand_century UUID;
    v_brand_greenply UUID;
    v_brand_hettich UUID;
    v_brand_hafele UUID;
    v_brand_ebco UUID;
    v_brand_merino UUID;
    v_brand_greenlam UUID;
    v_brand_asian_paints UUID;
    v_brand_berger UUID;
    v_brand_saint_gobain UUID;
    v_brand_asahi UUID;
    v_brand_ddecor UUID;
    v_brand_pokarna UUID;
    v_brand_havells UUID;
    v_brand_philips UUID;
    v_brand_fevicol UUID;
    -- Appliance Brands
    v_brand_faber UUID;
    v_brand_elica UUID;
    v_brand_bosch UUID;
    v_brand_kaff UUID;
    
    -- Vendor IDs (Local dealers)
    v_vendor_krishna_ply UUID;
    v_vendor_sharma_hardware UUID;
    v_vendor_city_laminates UUID;
    v_vendor_decor_fabrics UUID;
    v_vendor_glass_world UUID;
    v_vendor_paint_house UUID;
    v_vendor_stone_mart UUID;
    v_vendor_electric_plaza UUID;
    v_vendor_kitchen_world UUID;  -- New vendor for appliances
    
    -- Material IDs (for vendor pricing)
    v_mat_ply_bwp_18 UUID;
    v_mat_ply_mr_18 UUID;
    v_mat_hinge_sc UUID;
    v_mat_channel_18 UUID;
    
    -- Revenue head IDs
    v_rev_ply UUID;
    v_rev_hw UUID;
    v_rev_lam UUID;
    v_rev_paint UUID;
    v_rev_glass UUID;
    v_rev_stone UUID;
    v_rev_app UUID;
    v_rev_light UUID;
BEGIN
    -- Clean existing data for this tenant first (in order of dependencies)
    DELETE FROM commission_items WHERE tenant_id = p_tenant_id;
    DELETE FROM stock_vendor_materials WHERE tenant_id = p_tenant_id;
    DELETE FROM stock_vendor_brands WHERE tenant_id = p_tenant_id;
    DELETE FROM stock_materials WHERE company_id = p_tenant_id;
    DELETE FROM stock_vendors WHERE tenant_id = p_tenant_id;
    DELETE FROM stock_brands WHERE tenant_id = p_tenant_id;
    
    -- Get revenue head IDs (created by seed_revenue_heads)
    SELECT id INTO v_rev_ply FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-PLY';
    SELECT id INTO v_rev_hw FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-HW';
    SELECT id INTO v_rev_lam FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-LAM';
    SELECT id INTO v_rev_paint FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-PAINT';
    SELECT id INTO v_rev_glass FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-GLASS';
    SELECT id INTO v_rev_stone FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-MAT-STONE';
    SELECT id INTO v_rev_app FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-COMM-APP';
    SELECT id INTO v_rev_light FROM revenue_heads WHERE tenant_id = p_tenant_id AND code = 'REV-COMM-LIGHT';
    -- =========================================================================
    -- STEP 1: INSERT BRANDS (Manufacturers)
    -- =========================================================================
    
    -- Plywood Brands
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-CENTURY', 'Century Plyboards India Ltd', 'Century Ply', 'www.centuryply.com', ARRAY['Plywood', 'MDF', 'Veneers'], 'premium', true)
    RETURNING id INTO v_brand_century;
    
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-GREENPLY', 'Greenply Industries Ltd', 'Greenply', 'www.greenply.com', ARRAY['Plywood', 'MDF', 'Block Board'], 'premium', true)
    RETURNING id INTO v_brand_greenply;
    
    -- Hardware Brands
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, country, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-HETTICH', 'Hettich International', 'Hettich', 'www.hettich.com', 'Germany', ARRAY['Hinges', 'Channels', 'Drawer Systems', 'Kitchen Hardware'], 'luxury', true)
    RETURNING id INTO v_brand_hettich;
    
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, country, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-HAFELE', 'Häfele GmbH', 'Hafele', 'www.hafele.com', 'Germany', ARRAY['Hinges', 'Channels', 'Kitchen Hardware', 'Handles'], 'luxury', true)
    RETURNING id INTO v_brand_hafele;
    
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-EBCO', 'Ebco Private Limited', 'Ebco', 'www.ebco.in', ARRAY['Hinges', 'Channels', 'Kitchen Hardware'], 'standard', true)
    RETURNING id INTO v_brand_ebco;
    
    -- Laminate Brands
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-MERINO', 'Merino Industries Ltd', 'Merino', 'www.merinolam.com', ARRAY['Laminates', 'Compacts', 'Acrylic'], 'premium', true)
    RETURNING id INTO v_brand_merino;
    
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-GREENLAM', 'Greenlam Industries Ltd', 'Greenlam', 'www.greenlam.com', ARRAY['Laminates', 'Veneers', 'Compacts'], 'premium', true)
    RETURNING id INTO v_brand_greenlam;
    
    -- Paint Brands
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-ASIANPAINTS', 'Asian Paints Ltd', 'Asian Paints', 'www.asianpaints.com', ARRAY['Paints', 'Wood Finishes', 'PU Coatings'], 'premium', true)
    RETURNING id INTO v_brand_asian_paints;
    
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-BERGER', 'Berger Paints India Ltd', 'Berger', 'www.bergerpaints.com', ARRAY['Paints', 'Wood Finishes'], 'standard', true)
    RETURNING id INTO v_brand_berger;
    
    -- Glass Brands
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, country, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-SAINTGOBAIN', 'Saint-Gobain Glass', 'Saint-Gobain', 'www.saint-gobain-glass.com', 'France', ARRAY['Float Glass', 'Toughened Glass', 'Mirror'], 'luxury', true)
    RETURNING id INTO v_brand_saint_gobain;
    
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-ASAHI', 'Asahi India Glass Ltd', 'AIS Glass', 'www.aisglass.com', ARRAY['Float Glass', 'Toughened Glass', 'Lacquered Glass'], 'premium', true)
    RETURNING id INTO v_brand_asahi;
    
    -- Fabric Brand
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-DDECOR', 'D''Decor Home Fabrics', 'D''Decor', 'www.ddecor.com', ARRAY['Upholstery', 'Curtains', 'Wallcoverings'], 'premium', true)
    RETURNING id INTO v_brand_ddecor;
    
    -- Stone Brand
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-POKARNA', 'Pokarna Engineered Stone Ltd', 'Pokarna/Quantra', 'www.pokarna.com', ARRAY['Quartz', 'Engineered Stone'], 'premium', true)
    RETURNING id INTO v_brand_pokarna;
    
    -- Electrical Brands
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-HAVELLS', 'Havells India Ltd', 'Havells', 'www.havells.com', ARRAY['Switches', 'Wiring', 'Lighting'], 'premium', true)
    RETURNING id INTO v_brand_havells;
    
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, country, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-PHILIPS', 'Signify (Philips Lighting)', 'Philips', 'www.signify.com', 'Netherlands', ARRAY['LED Lighting', 'Drivers'], 'premium', true)
    RETURNING id INTO v_brand_philips;
    
    -- Adhesive Brand
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-FEVICOL', 'Pidilite Industries Ltd', 'Fevicol/Pidilite', 'www.pidilite.com', ARRAY['Adhesives', 'Sealants'], 'premium', true)
    RETURNING id INTO v_brand_fevicol;
    
    -- Kitchen Appliance Brands (Commission items)
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, country, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-FABER', 'Faber S.p.A.', 'Faber', 'www.faberindia.com', 'Italy', ARRAY['Chimneys', 'Hobs', 'Ovens'], 'premium', true)
    RETURNING id INTO v_brand_faber;
    
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, country, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-ELICA', 'Elica S.p.A.', 'Elica', 'www.elica.com', 'Italy', ARRAY['Chimneys', 'Hobs'], 'luxury', true)
    RETURNING id INTO v_brand_elica;
    
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, country, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-BOSCH', 'Robert Bosch GmbH', 'Bosch', 'www.bosch-home.in', 'Germany', ARRAY['Chimneys', 'Hobs', 'Ovens', 'Dishwashers'], 'luxury', true)
    RETURNING id INTO v_brand_bosch;
    
    INSERT INTO stock_brands (tenant_id, code, name, display_name, website, categories, quality_tier, is_active)
    VALUES (p_tenant_id, 'BRD-KAFF', 'Kaff Appliances India Pvt Ltd', 'Kaff', 'www.kaff.in', ARRAY['Chimneys', 'Hobs', 'Sinks'], 'standard', true)
    RETURNING id INTO v_brand_kaff;

    -- =========================================================================
    -- STEP 2: INSERT VENDORS (Local Dealers/Distributors)
    -- =========================================================================
    
    INSERT INTO stock_vendors (tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (p_tenant_id, 'VND-0001', 'Krishna Plywood & Timber', 'Krishna Ply', 'Ramesh Agarwal', 'sales@krishnaply.com', '9876543210', 'Bangalore', 'Karnataka', '29AAACR5055K1ZK', 'Net 30', 30, 5, true)
    RETURNING id INTO v_vendor_krishna_ply;
    
    INSERT INTO stock_vendors (tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (p_tenant_id, 'VND-0002', 'Sharma Hardware Solutions', 'Sharma Hardware', 'Vijay Sharma', 'orders@sharmahw.com', '9876543211', 'Bangalore', 'Karnataka', '29AABCH1234K1Z5', 'Net 45', 45, 5, true)
    RETURNING id INTO v_vendor_sharma_hardware;
    
    INSERT INTO stock_vendors (tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (p_tenant_id, 'VND-0003', 'City Laminates & Veneers', 'City Laminates', 'Pradeep Jain', 'info@citylaminates.com', '9876543212', 'Bangalore', 'Karnataka', '29AABCD5678K1Z2', 'Net 30', 30, 4, true)
    RETURNING id INTO v_vendor_city_laminates;
    
    INSERT INTO stock_vendors (tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (p_tenant_id, 'VND-0004', 'Decor Fabrics & Furnishings', 'Decor Fabrics', 'Meena Patel', 'wholesale@decorfabrics.com', '9876543213', 'Bangalore', 'Karnataka', '29AABCS9012K1Z8', 'Net 30', 30, 4, true)
    RETURNING id INTO v_vendor_decor_fabrics;
    
    INSERT INTO stock_vendors (tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (p_tenant_id, 'VND-0005', 'Glass World India', 'Glass World', 'Sunil Reddy', 'sales@glassworld.in', '9876543214', 'Bangalore', 'Karnataka', '29AAACA3456K1Z3', 'Net 15', 15, 5, true)
    RETURNING id INTO v_vendor_glass_world;
    
    INSERT INTO stock_vendors (tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (p_tenant_id, 'VND-0006', 'The Paint House', 'Paint House', 'Deepak Gupta', 'orders@painthouse.com', '9876543215', 'Bangalore', 'Karnataka', '29AABCM7890K1Z1', 'Net 15', 15, 4, true)
    RETURNING id INTO v_vendor_paint_house;
    
    INSERT INTO stock_vendors (tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (p_tenant_id, 'VND-0007', 'Stone Mart Enterprises', 'Stone Mart', 'Rakesh Agarwal', 'info@stonemart.in', '9876543216', 'Bangalore', 'Karnataka', '29AABCP2345K1Z7', 'Net 45', 45, 4, true)
    RETURNING id INTO v_vendor_stone_mart;
    
    INSERT INTO stock_vendors (tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (p_tenant_id, 'VND-0008', 'Electric Plaza', 'Electric Plaza', 'Ankit Verma', 'b2b@electricplaza.com', '9876543217', 'Bangalore', 'Karnataka', '29AAACH6789K1Z4', 'Net 30', 30, 5, true)
    RETURNING id INTO v_vendor_electric_plaza;
    
    INSERT INTO stock_vendors (tenant_id, code, name, display_name, contact_person, email, phone, city, state, gst_number, payment_terms, credit_days, rating, is_active)
    VALUES (p_tenant_id, 'VND-0009', 'Kitchen World Appliances', 'Kitchen World', 'Sanjay Mehta', 'dealer@kitchenworld.in', '9876543218', 'Bangalore', 'Karnataka', '29AABCK1234K1Z9', 'Net 45', 45, 5, true)
    RETURNING id INTO v_vendor_kitchen_world;

    -- =========================================================================
    -- STEP 3: LINK VENDORS TO BRANDS
    -- =========================================================================
    
    -- Krishna Ply sells Century, Greenply
    INSERT INTO stock_vendor_brands (tenant_id, vendor_id, brand_id, is_authorized_dealer, discount_percent) VALUES
    (p_tenant_id, v_vendor_krishna_ply, v_brand_century, true, 5),
    (p_tenant_id, v_vendor_krishna_ply, v_brand_greenply, true, 5),
    (p_tenant_id, v_vendor_krishna_ply, v_brand_fevicol, false, 2);
    
    -- Sharma Hardware sells Hettich, Hafele, Ebco
    INSERT INTO stock_vendor_brands (tenant_id, vendor_id, brand_id, is_authorized_dealer, discount_percent) VALUES
    (p_tenant_id, v_vendor_sharma_hardware, v_brand_hettich, true, 8),
    (p_tenant_id, v_vendor_sharma_hardware, v_brand_hafele, true, 8),
    (p_tenant_id, v_vendor_sharma_hardware, v_brand_ebco, true, 10);
    
    -- City Laminates sells Merino, Greenlam
    INSERT INTO stock_vendor_brands (tenant_id, vendor_id, brand_id, is_authorized_dealer, discount_percent) VALUES
    (p_tenant_id, v_vendor_city_laminates, v_brand_merino, true, 6),
    (p_tenant_id, v_vendor_city_laminates, v_brand_greenlam, true, 6);
    
    -- Decor Fabrics sells D'Decor
    INSERT INTO stock_vendor_brands (tenant_id, vendor_id, brand_id, is_authorized_dealer, discount_percent) VALUES
    (p_tenant_id, v_vendor_decor_fabrics, v_brand_ddecor, true, 10);
    
    -- Glass World sells Saint-Gobain, AIS
    INSERT INTO stock_vendor_brands (tenant_id, vendor_id, brand_id, is_authorized_dealer, discount_percent) VALUES
    (p_tenant_id, v_vendor_glass_world, v_brand_saint_gobain, true, 5),
    (p_tenant_id, v_vendor_glass_world, v_brand_asahi, true, 5);
    
    -- Paint House sells Asian Paints, Berger
    INSERT INTO stock_vendor_brands (tenant_id, vendor_id, brand_id, is_authorized_dealer, discount_percent) VALUES
    (p_tenant_id, v_vendor_paint_house, v_brand_asian_paints, true, 8),
    (p_tenant_id, v_vendor_paint_house, v_brand_berger, true, 10);
    
    -- Stone Mart sells Pokarna
    INSERT INTO stock_vendor_brands (tenant_id, vendor_id, brand_id, is_authorized_dealer, discount_percent) VALUES
    (p_tenant_id, v_vendor_stone_mart, v_brand_pokarna, true, 5);
    
    -- Electric Plaza sells Havells, Philips
    INSERT INTO stock_vendor_brands (tenant_id, vendor_id, brand_id, is_authorized_dealer, discount_percent) VALUES
    (p_tenant_id, v_vendor_electric_plaza, v_brand_havells, true, 12),
    (p_tenant_id, v_vendor_electric_plaza, v_brand_philips, true, 10);
    
    -- Kitchen World sells Faber, Elica, Bosch, Kaff
    INSERT INTO stock_vendor_brands (tenant_id, vendor_id, brand_id, is_authorized_dealer, discount_percent) VALUES
    (p_tenant_id, v_vendor_kitchen_world, v_brand_faber, true, 18),
    (p_tenant_id, v_vendor_kitchen_world, v_brand_elica, true, 15),
    (p_tenant_id, v_vendor_kitchen_world, v_brand_bosch, true, 12),
    (p_tenant_id, v_vendor_kitchen_world, v_brand_kaff, true, 20);

    -- =========================================================================
    -- STEP 4: INSERT MATERIALS WITH FULL PRICING TIERS
    -- Columns: vendor_cost, company_cost, retail_price, markup_percent
    -- =========================================================================
    
    -- PLYWOOD (Century brand from Krishna Ply vendor)
    -- vendor_cost = what we pay | company_cost = our quotation rate | retail_price = MRP
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active)
    VALUES (p_tenant_id, v_brand_century, '18mm BWP Marine Plywood - Century', 'PLY-CEN-BWP-18', 'Century Boiling Water Proof plywood for wet areas, 8x4 ft sheets', 'Plywood', 'raw_material', 'sheet', 45, 20, 30, 2800, 3500, 2800, 3300, 3500, 17.86, v_rev_ply, false, v_vendor_krishna_ply, 'Warehouse A - Section 1', true)
    RETURNING id INTO v_mat_ply_bwp_18;
    
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active)
    VALUES (p_tenant_id, v_brand_century, '12mm BWP Marine Plywood - Century', 'PLY-CEN-BWP-12', 'Century Boiling Water Proof plywood, 8x4 ft sheets', 'Plywood', 'raw_material', 'sheet', 60, 25, 40, 2200, 2750, 2200, 2600, 2750, 18.18, v_rev_ply, false, v_vendor_krishna_ply, 'Warehouse A - Section 1', true);
    
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active)
    VALUES (p_tenant_id, v_brand_century, '18mm MR Grade Plywood - Century', 'PLY-CEN-MR-18', 'Century Moisture Resistant plywood, 8x4 ft sheets', 'Plywood', 'raw_material', 'sheet', 80, 30, 50, 1800, 2250, 1800, 2125, 2250, 18.06, v_rev_ply, false, v_vendor_krishna_ply, 'Warehouse A - Section 1', true)
    RETURNING id INTO v_mat_ply_mr_18;
    
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, v_brand_greenply, '18mm BWP Plywood - Greenply', 'PLY-GRN-BWP-18', 'Greenply BWP grade, 8x4 ft sheets', 'Plywood', 'raw_material', 'sheet', 40, 20, 30, 2700, 3400, 2700, 3200, 3400, 18.52, v_rev_ply, false, v_vendor_krishna_ply, 'Warehouse A - Section 1', true),
    (p_tenant_id, v_brand_century, '19mm Block Board - Century', 'PLY-CEN-BB-19', 'Century block board for furniture cores, 8x4 ft', 'Plywood', 'raw_material', 'sheet', 35, 15, 25, 2400, 3000, 2400, 2850, 3000, 18.75, v_rev_ply, false, v_vendor_krishna_ply, 'Warehouse A - Section 2', true),
    (p_tenant_id, v_brand_century, '18mm Pre-Laminated MDF - Century', 'MDF-CEN-PL-18', 'Century white pre-laminated MDF board, 8x4 ft', 'MDF', 'raw_material', 'sheet', 40, 15, 25, 1600, 2000, 1600, 1850, 2000, 15.63, v_rev_ply, false, v_vendor_krishna_ply, 'Warehouse A - Section 2', true);

    -- HARDWARE (Hettich brand from Sharma Hardware) - Higher markup for premium hardware
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active)
    VALUES (p_tenant_id, v_brand_hettich, 'Soft Close Hinge - Full Overlay - Hettich', 'HW-HET-SC-FO', 'Hettich Sensys soft close cabinet hinge, full overlay', 'Hardware - Hinges', 'hardware', 'pair', 200, 50, 100, 220, 300, 220, 275, 300, 25.00, v_rev_hw, false, v_vendor_sharma_hardware, 'Warehouse B - Rack 1', true)
    RETURNING id INTO v_mat_hinge_sc;
    
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active)
    VALUES (p_tenant_id, v_brand_hettich, 'Telescopic Channel 18" - Hettich', 'HW-HET-TEL-18', 'Hettich ball bearing telescopic drawer channel, 18 inch', 'Hardware - Channels', 'hardware', 'pair', 120, 30, 60, 550, 720, 550, 690, 720, 25.45, v_rev_hw, false, v_vendor_sharma_hardware, 'Warehouse B - Rack 2', true)
    RETURNING id INTO v_mat_channel_18;
    
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, v_brand_hettich, 'Tandem Box 500mm - Hettich', 'HW-HET-TB-500', 'Hettich ArciTech/Tandem Box drawer system, 500mm', 'Hardware - Drawer Systems', 'hardware', 'set', 25, 10, 15, 3500, 4500, 3500, 4375, 4500, 25.00, v_rev_hw, false, v_vendor_sharma_hardware, 'Warehouse B - Rack 3', true),
    (p_tenant_id, v_brand_hafele, 'Soft Close Hinge - Hafele', 'HW-HAF-SC-FO', 'Hafele soft close cabinet hinge, full overlay', 'Hardware - Hinges', 'hardware', 'pair', 150, 40, 80, 200, 280, 200, 250, 280, 25.00, v_rev_hw, false, v_vendor_sharma_hardware, 'Warehouse B - Rack 1', true),
    (p_tenant_id, v_brand_ebco, 'Telescopic Channel 18" - Ebco', 'HW-EBC-TEL-18', 'Ebco economy telescopic channel, 18 inch', 'Hardware - Channels', 'hardware', 'pair', 100, 30, 50, 350, 480, 350, 420, 480, 20.00, v_rev_hw, false, v_vendor_sharma_hardware, 'Warehouse B - Rack 2', true),
    (p_tenant_id, v_brand_hettich, 'Corner Carousel Unit - Hettich', 'HW-HET-CCU', 'Hettich Le Mans corner unit for L-shaped kitchen', 'Hardware - Kitchen', 'hardware', 'set', 8, 3, 5, 12000, 16000, 12000, 15000, 16000, 25.00, v_rev_hw, false, v_vendor_sharma_hardware, 'Warehouse B - Rack 5', true);
    
    -- LAMINATES (Merino brand from City Laminates)
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, v_brand_merino, 'Laminate Natural Oak - Merino', 'LAM-MER-NOK', 'Merino 1mm decorative laminate, natural oak, 8x4 ft', 'Laminates - Wood Grain', 'raw_material', 'sheet', 30, 10, 20, 1400, 1800, 1400, 1680, 1800, 20.00, v_rev_lam, false, v_vendor_city_laminates, 'Warehouse A - Section 3', true),
    (p_tenant_id, v_brand_merino, 'Laminate White Gloss - Merino', 'LAM-MER-WHG', 'Merino high gloss white solid laminate, 8x4 ft', 'Laminates - Solid', 'raw_material', 'sheet', 40, 15, 25, 1200, 1550, 1200, 1440, 1550, 20.00, v_rev_lam, false, v_vendor_city_laminates, 'Warehouse A - Section 3', true),
    (p_tenant_id, v_brand_greenlam, 'Laminate Walnut Dark - Greenlam', 'LAM-GRL-WDK', 'Greenlam dark walnut laminate, 8x4 ft', 'Laminates - Wood Grain', 'raw_material', 'sheet', 25, 10, 15, 1450, 1850, 1450, 1740, 1850, 20.00, v_rev_lam, false, v_vendor_city_laminates, 'Warehouse A - Section 3', true),
    (p_tenant_id, v_brand_merino, 'Acrylic Laminate White - Merino', 'LAM-MER-AC-WHT', 'Merino Acrylam high gloss acrylic, white, 8x4 ft', 'Laminates - Acrylic', 'raw_material', 'sheet', 15, 5, 10, 3800, 4800, 3800, 4560, 4800, 20.00, v_rev_lam, false, v_vendor_city_laminates, 'Warehouse A - Section 3', true);
    
    -- PAINTS (Asian Paints from Paint House)
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, v_brand_asian_paints, 'Wood Primer - Asian Paints', 'PNT-AP-PRM', 'Asian Paints wood primer, white, 4 litre', 'Paints - Primer', 'consumable', 'can', 25, 10, 15, 850, 1100, 850, 980, 1100, 15.29, v_rev_paint, false, v_vendor_paint_house, 'Warehouse C - Section 1', true),
    (p_tenant_id, v_brand_asian_paints, 'PU Clear Matt - Asian Paints', 'PNT-AP-PU-CLM', 'Asian Paints Woodtech PU clear matt, 4 litre', 'Paints - PU', 'consumable', 'can', 15, 5, 10, 2800, 3600, 2800, 3220, 3600, 15.00, v_rev_paint, false, v_vendor_paint_house, 'Warehouse C - Section 1', true),
    (p_tenant_id, v_brand_berger, 'Wood Stain Walnut - Berger', 'PNT-BG-STN-WAL', 'Berger wood stain, walnut shade, 1 litre', 'Paints - Stain', 'consumable', 'can', 18, 6, 12, 600, 800, 600, 690, 800, 15.00, v_rev_paint, false, v_vendor_paint_house, 'Warehouse C - Section 1', true);
    
    -- ADHESIVES (Fevicol from Krishna Ply)
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, v_brand_fevicol, 'Fevicol SH', 'ADH-FEV-SH', 'Fevicol SH synthetic resin adhesive, 50 kg drum', 'Adhesives', 'consumable', 'drum', 8, 3, 5, 4500, 5500, 4500, 5175, 5500, 15.00, NULL, false, v_vendor_krishna_ply, 'Warehouse C - Section 2', true),
    (p_tenant_id, v_brand_fevicol, 'Fevicol Marine', 'ADH-FEV-MR', 'Fevicol Marine waterproof adhesive, 20 kg', 'Adhesives', 'consumable', 'bucket', 6, 2, 4, 3200, 4000, 3200, 3680, 4000, 15.00, NULL, false, v_vendor_krishna_ply, 'Warehouse C - Section 2', true);
    
    -- GLASS (Saint-Gobain from Glass World)
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, v_brand_saint_gobain, 'Clear Float Glass 5mm - Saint-Gobain', 'GLS-SG-CLR-05', 'Saint-Gobain clear float glass 5mm, per sqft', 'Glass - Clear', 'raw_material', 'sqft', 500, 100, 200, 90, 130, 90, 110, 130, 22.22, v_rev_glass, false, v_vendor_glass_world, 'Warehouse D - Section 1', true),
    (p_tenant_id, v_brand_saint_gobain, 'Toughened Glass 10mm - Saint-Gobain', 'GLS-SG-TGH-10', 'Saint-Gobain Planidur tempered glass 10mm, per sqft', 'Glass - Toughened', 'raw_material', 'sqft', 200, 50, 100, 300, 400, 300, 370, 400, 23.33, v_rev_glass, false, v_vendor_glass_world, 'Warehouse D - Section 1', true),
    (p_tenant_id, v_brand_asahi, 'Lacquered Glass White - AIS', 'GLS-AIS-LAC-WHT', 'AIS Décor back painted white glass, per sqft', 'Glass - Lacquered', 'raw_material', 'sqft', 100, 30, 50, 180, 250, 180, 220, 250, 22.22, v_rev_glass, false, v_vendor_glass_world, 'Warehouse D - Section 2', true),
    (p_tenant_id, v_brand_saint_gobain, 'Mirror Clear 4mm - Saint-Gobain', 'GLS-SG-MIR-04', 'Saint-Gobain silver mirror 4mm, per sqft', 'Glass - Mirror', 'raw_material', 'sqft', 200, 50, 100, 100, 150, 100, 122, 150, 22.00, v_rev_glass, false, v_vendor_glass_world, 'Warehouse D - Section 3', true);
    
    -- FABRICS (D'Decor from Decor Fabrics)
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, v_brand_ddecor, 'Upholstery Linen Grey - D''Decor', 'FAB-DD-UPH-LGR', 'D''Decor premium linen blend upholstery, grey, per mtr', 'Fabrics - Upholstery', 'raw_material', 'mtr', 80, 20, 40, 700, 950, 700, 840, 950, 20.00, NULL, false, v_vendor_decor_fabrics, 'Warehouse E - Section 1', true),
    (p_tenant_id, v_brand_ddecor, 'Blackout Curtain - D''Decor', 'FAB-DD-CUR-BLK', 'D''Decor blackout curtain fabric, per mtr', 'Fabrics - Curtains', 'raw_material', 'mtr', 100, 30, 50, 500, 700, 500, 600, 700, 20.00, NULL, false, v_vendor_decor_fabrics, 'Warehouse E - Section 2', true);
    
    -- STONE (Pokarna from Stone Mart)
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, v_brand_pokarna, 'Quartz Calacatta White - Quantra', 'STN-QNT-CAL', 'Quantra (Pokarna) engineered quartz, calacatta, per sqft', 'Stone - Quartz', 'raw_material', 'sqft', 100, 25, 50, 550, 750, 550, 660, 750, 20.00, v_rev_stone, false, v_vendor_stone_mart, 'Warehouse F - Section 1', true),
    (p_tenant_id, v_brand_pokarna, 'Quartz Pure White - Quantra', 'STN-QNT-PWH', 'Quantra (Pokarna) pure white quartz, per sqft', 'Stone - Quartz', 'raw_material', 'sqft', 120, 30, 60, 450, 620, 450, 540, 620, 20.00, v_rev_stone, false, v_vendor_stone_mart, 'Warehouse F - Section 1', true);
    
    -- ELECTRICAL (Havells, Philips from Electric Plaza) - These earn lighting commission
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, commission_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active) VALUES
    (p_tenant_id, v_brand_philips, 'LED Strip Warm White - Philips', 'ELC-PH-LED-WWH', 'Philips LED strip 12V, warm white 3000K, per mtr', 'Electrical - LED', 'accessory', 'mtr', 100, 25, 50, 150, 220, 150, 220, 220, NULL, 31.82, v_rev_light, true, v_vendor_electric_plaza, 'Warehouse G - Section 1', true),
    (p_tenant_id, v_brand_havells, 'Modular Switch 6A - Havells', 'ELC-HV-SWT-06A', 'Havells Pearlz modular switch 6A', 'Electrical - Switches', 'accessory', 'pcs', 100, 30, 50, 95, 140, 95, 140, 140, NULL, 32.14, v_rev_light, true, v_vendor_electric_plaza, 'Warehouse G - Section 4', true),
    (p_tenant_id, v_brand_havells, 'USB Charging Module - Havells', 'ELC-HV-USB-2P', 'Havells dual USB charging module 2.1A', 'Electrical - Switches', 'accessory', 'pcs', 40, 10, 20, 400, 550, 400, 550, 550, NULL, 27.27, v_rev_light, true, v_vendor_electric_plaza, 'Warehouse G - Section 4', true);
    
    -- =========================================================================
    -- KITCHEN APPLIANCES (Commission Items - Sell at MRP, earn commission)
    -- These are NOT marked up. Customer pays MRP, we earn the dealer margin.
    -- vendor_cost = dealer price | company_cost = MRP | retail_price = MRP
    -- is_commission_item = true | commission_percent = calculated
    -- =========================================================================
    
    INSERT INTO stock_materials (company_id, brand_id, name, sku, description, category, item_type, unit_of_measure, current_quantity, minimum_quantity, reorder_quantity, unit_cost, selling_price, vendor_cost, company_cost, retail_price, markup_percent, commission_percent, revenue_head_id, is_commission_item, preferred_vendor_id, storage_location, is_active) VALUES
    -- Chimneys (High-value commission items)
    (p_tenant_id, v_brand_faber, 'Kitchen Chimney 90cm - Faber Hood Zenith', 'APP-FAB-CHM-90', 'Faber Hood Zenith 90cm wall mounted chimney, 1200 m³/hr', 'Appliances - Chimney', 'accessory', 'pcs', 5, 2, 3, 32000, 45000, 32000, 45000, 45000, NULL, 28.89, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true),
    (p_tenant_id, v_brand_elica, 'Kitchen Chimney 90cm - Elica WDFL 906', 'APP-ELC-CHM-90', 'Elica WDFL 906 HAC MS NERO, auto-clean, 1200 m³/hr', 'Appliances - Chimney', 'accessory', 'pcs', 4, 2, 2, 38000, 52000, 38000, 52000, 52000, NULL, 26.92, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true),
    (p_tenant_id, v_brand_bosch, 'Kitchen Chimney 90cm - Bosch DWB098D50I', 'APP-BSH-CHM-90', 'Bosch Serie 4 wall mounted chimney, 867 m³/hr', 'Appliances - Chimney', 'accessory', 'pcs', 3, 1, 2, 45000, 58000, 45000, 58000, 58000, NULL, 22.41, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true),
    (p_tenant_id, v_brand_kaff, 'Kitchen Chimney 60cm - Kaff Opec BF 60', 'APP-KAF-CHM-60', 'Kaff Opec BF 60cm chimney, 1180 m³/hr, baffle filter', 'Appliances - Chimney', 'accessory', 'pcs', 6, 2, 4, 18000, 26000, 18000, 26000, 26000, NULL, 30.77, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true),
    
    -- Hobs (Built-in cooktops)
    (p_tenant_id, v_brand_faber, 'Built-in Hob 4 Burner - Faber Maxus', 'APP-FAB-HOB-4B', 'Faber Maxus HT604 CRS BR CI, 4 burner glass hob', 'Appliances - Hob', 'accessory', 'pcs', 4, 2, 3, 22000, 32000, 22000, 32000, 32000, NULL, 31.25, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true),
    (p_tenant_id, v_brand_elica, 'Built-in Hob 3 Burner - Elica Flexi', 'APP-ELC-HOB-3B', 'Elica Flexi FB MFC 3B 70 DX, 3 burner with flexi zone', 'Appliances - Hob', 'accessory', 'pcs', 3, 1, 2, 28000, 38000, 28000, 38000, 38000, NULL, 26.32, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true),
    (p_tenant_id, v_brand_bosch, 'Built-in Hob 4 Burner - Bosch PBH6B5B60I', 'APP-BSH-HOB-4B', 'Bosch Serie 2 tempered glass hob, 4 burner', 'Appliances - Hob', 'accessory', 'pcs', 3, 1, 2, 25000, 35000, 25000, 35000, 35000, NULL, 28.57, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true),
    (p_tenant_id, v_brand_kaff, 'Built-in Hob 4 Burner - Kaff NB 604', 'APP-KAF-HOB-4B', 'Kaff NB 604 BG, 4 brass burner glass hob', 'Appliances - Hob', 'accessory', 'pcs', 5, 2, 3, 12000, 18000, 12000, 18000, 18000, NULL, 33.33, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true),
    
    -- Built-in Ovens
    (p_tenant_id, v_brand_bosch, 'Built-in Oven 60cm - Bosch HBF011BR0Z', 'APP-BSH-OVN-60', 'Bosch Serie 2 built-in oven, 66L, 5 heating modes', 'Appliances - Oven', 'accessory', 'pcs', 2, 1, 2, 35000, 48000, 35000, 48000, 48000, NULL, 27.08, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true),
    (p_tenant_id, v_brand_faber, 'Built-in Oven 60cm - Faber FBIO 80L', 'APP-FAB-OVN-60', 'Faber FBIO 80L 6F built-in oven, 80L capacity', 'Appliances - Oven', 'accessory', 'pcs', 2, 1, 2, 42000, 56000, 42000, 56000, 56000, NULL, 25.00, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true),
    
    -- Sinks
    (p_tenant_id, v_brand_kaff, 'Kitchen Sink Double Bowl - Kaff KS 45x20', 'APP-KAF-SNK-DB', 'Kaff stainless steel double bowl sink 45x20 inch', 'Appliances - Sink', 'accessory', 'pcs', 6, 2, 4, 8500, 12500, 8500, 12500, 12500, NULL, 32.00, v_rev_app, true, v_vendor_kitchen_world, 'Showroom - Kitchen Section', true);

    -- =========================================================================
    -- STEP 5: ADD VENDOR PRICING (Same material, different vendors, different prices)
    -- =========================================================================
    
    -- Krishna Ply prices for plywood
    INSERT INTO stock_vendor_materials (tenant_id, vendor_id, material_id, unit_price, min_order_qty, lead_time_days, is_preferred, is_active) VALUES
    (p_tenant_id, v_vendor_krishna_ply, v_mat_ply_bwp_18, 2800, 5, 3, true, true),
    (p_tenant_id, v_vendor_krishna_ply, v_mat_ply_mr_18, 1800, 5, 3, true, true);
    
    -- Sharma Hardware prices for Hettich
    INSERT INTO stock_vendor_materials (tenant_id, vendor_id, material_id, unit_price, min_order_qty, lead_time_days, is_preferred, is_active) VALUES
    (p_tenant_id, v_vendor_sharma_hardware, v_mat_hinge_sc, 220, 10, 5, true, true),
    (p_tenant_id, v_vendor_sharma_hardware, v_mat_channel_18, 550, 10, 5, true, true);

    RETURN 'Stock data v2 seeded successfully for tenant: ' || p_tenant_id::TEXT || 
           '. Created: 20 brands (incl. appliances), 9 vendors, ~42 materials with full pricing tiers (vendor_cost, company_cost, retail_price, markup_percent, commission_percent).';
END;
$$;


ALTER FUNCTION "public"."seed_stock_data_v2"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."skip_sub_phase"("p_sub_phase_id" "uuid", "p_user_id" "uuid", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_sub_phase RECORD;
    v_project_id UUID;
BEGIN
    -- Get sub-phase and check if can skip
    SELECT psp.*, spt.can_skip, spt.skip_requires_reason,
           p.id as project_id
    INTO v_sub_phase
    FROM project_sub_phases psp
    JOIN project_sub_phase_templates spt ON psp.sub_phase_template_id = spt.id
    JOIN project_phases pp ON psp.project_phase_id = pp.id
    JOIN projects p ON pp.project_id = p.id
    WHERE psp.id = p_sub_phase_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Sub-phase not found');
    END IF;
    
    IF NOT COALESCE(v_sub_phase.can_skip, true) THEN
        RETURN jsonb_build_object('success', false, 'reason', 'This sub-phase cannot be skipped');
    END IF;
    
    IF COALESCE(v_sub_phase.skip_requires_reason, true) AND (p_reason IS NULL OR p_reason = '') THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Reason required to skip this sub-phase');
    END IF;
    
    -- Update sub-phase
    UPDATE project_sub_phases
    SET status = 'skipped'::project_sub_phase_status_enum,
        skipped = true,
        skip_reason = p_reason,
        skipped_by = p_user_id,
        skipped_at = NOW(),
        updated_at = NOW()
    WHERE id = p_sub_phase_id;
    
    -- Log activity
    INSERT INTO project_phase_activity_log (
        project_id, project_sub_phase_id,
        activity_type, description, 
        new_value,
        performed_by
    ) VALUES (
        v_sub_phase.project_id, p_sub_phase_id,
        'skipped', 'Sub-phase skipped: ' || p_reason,
        jsonb_build_object('status', 'skipped', 'reason', p_reason),
        p_user_id
    );
    
    RETURN jsonb_build_object('success', true, 'message', 'Sub-phase skipped');
END;
$$;


ALTER FUNCTION "public"."skip_sub_phase"("p_sub_phase_id" "uuid", "p_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."skip_sub_phase"("p_sub_phase_id" "uuid", "p_user_id" "uuid", "p_reason" "text") IS 'Skip a sub-phase with reason and logging';



CREATE OR REPLACE FUNCTION "public"."start_sub_phase"("p_sub_phase_id" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_can_start JSONB;
    v_project_id UUID;
BEGIN
    -- Check if can start
    v_can_start := can_start_sub_phase(p_sub_phase_id);
    
    IF NOT (v_can_start->>'can_start')::boolean THEN
        RETURN v_can_start;
    END IF;
    
    -- Get project for activity log
    SELECT p.id INTO v_project_id
    FROM project_sub_phases psp
    JOIN project_phases pp ON psp.project_phase_id = pp.id
    JOIN projects p ON pp.project_id = p.id
    WHERE psp.id = p_sub_phase_id;
    
    -- Update sub-phase
    UPDATE project_sub_phases
    SET status = 'in_progress'::project_sub_phase_status_enum,
        started_at = NOW(),
        started_by = p_user_id,
        updated_at = NOW()
    WHERE id = p_sub_phase_id;
    
    -- Log activity
    INSERT INTO project_phase_activity_log (
        project_id, project_sub_phase_id,
        activity_type, description, 
        old_value, new_value,
        performed_by
    ) VALUES (
        v_project_id, p_sub_phase_id,
        'status_change', 'Sub-phase started',
        jsonb_build_object('status', 'not_started'),
        jsonb_build_object('status', 'in_progress'),
        p_user_id
    );
    
    RETURN jsonb_build_object('success', true, 'message', 'Sub-phase started');
END;
$$;


ALTER FUNCTION "public"."start_sub_phase"("p_sub_phase_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."start_sub_phase"("p_sub_phase_id" "uuid", "p_user_id" "uuid") IS 'Start a sub-phase with validation and logging';



CREATE OR REPLACE FUNCTION "public"."sync_user_email_verification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- When auth.users email_confirmed_at is set (email verified)
    IF NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at != NEW.email_confirmed_at) THEN
        UPDATE public.users
        SET 
            email_verified_at = NEW.email_confirmed_at,
            status = 'active',
            updated_at = NOW()
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_user_email_verification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_update_payment_milestone_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Only trigger when status changes to 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        UPDATE project_payment_milestones
        SET status = 'due',
            updated_at = NOW()
        WHERE linked_phase_id = NEW.id 
          AND trigger_condition = 'on_completion'
          AND status = 'pending';
    END IF;
    
    -- Trigger for 'on_start'
    IF NEW.status = 'in_progress' AND (OLD.status IS NULL OR OLD.status = 'not_started') THEN
        UPDATE project_payment_milestones
        SET status = 'due',
            updated_at = NOW()
        WHERE linked_phase_id = NEW.id 
          AND trigger_condition = 'on_start'
          AND status = 'pending';
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_update_payment_milestone_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_update_phase_progress"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_phase_id UUID;
    v_progress_mode progress_mode_enum;
BEGIN
    v_phase_id := COALESCE(NEW.project_phase_id, OLD.project_phase_id);
    
    SELECT progress_mode INTO v_progress_mode
    FROM project_phases WHERE id = v_phase_id;
    
    IF v_progress_mode = 'auto' THEN
        UPDATE project_phases
        SET progress_percentage = calculate_phase_progress(v_phase_id),
            status = CASE 
                WHEN calculate_phase_progress(v_phase_id) = 100 THEN 'completed'::project_phase_status_enum
                WHEN calculate_phase_progress(v_phase_id) > 0 THEN 'in_progress'::project_phase_status_enum
                ELSE 'not_started'::project_phase_status_enum
            END,
            updated_at = NOW()
        WHERE id = v_phase_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."trg_update_phase_progress"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_update_project_progress"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_project_id UUID;
BEGIN
    v_project_id := COALESCE(NEW.project_id, OLD.project_id);
    
    UPDATE projects
    SET overall_progress = calculate_project_progress(v_project_id),
        updated_at = NOW()
    WHERE id = v_project_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."trg_update_project_progress"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_update_sub_phase_progress"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_sub_phase_id UUID;
    v_progress_mode progress_mode_enum;
BEGIN
    v_sub_phase_id := COALESCE(NEW.project_sub_phase_id, OLD.project_sub_phase_id);
    
    SELECT progress_mode INTO v_progress_mode
    FROM project_sub_phases WHERE id = v_sub_phase_id;
    
    IF v_progress_mode = 'auto' THEN
        UPDATE project_sub_phases
        SET progress_percentage = calculate_sub_phase_progress(v_sub_phase_id),
            status = CASE 
                WHEN calculate_sub_phase_progress(v_sub_phase_id) = 100 THEN 'completed'::project_sub_phase_status_enum
                WHEN calculate_sub_phase_progress(v_sub_phase_id) > 0 THEN 'in_progress'::project_sub_phase_status_enum
                ELSE 'not_started'::project_sub_phase_status_enum
            END,
            updated_at = NOW()
        WHERE id = v_sub_phase_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."trg_update_sub_phase_progress"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_record_stage_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
        INSERT INTO lead_stage_history (lead_id, from_stage, to_stage, changed_by)
        VALUES (NEW.id, OLD.stage, NEW.stage, COALESCE(auth.uid(), NEW.assigned_to, NEW.created_by));
        
        NEW.stage_changed_at := CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_record_stage_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_grn_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.grn_number IS NULL OR NEW.grn_number = '' THEN
        NEW.grn_number := generate_grn_number(NEW.tenant_id);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_grn_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_issue_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.issue_number IS NULL OR NEW.issue_number = '' THEN
        NEW.issue_number := generate_issue_number(NEW.tenant_id);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_issue_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_lead_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.lead_number IS NULL OR NEW.lead_number = '' THEN
        NEW.lead_number := generate_lead_number(NEW.tenant_id);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_lead_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_mr_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.mr_number IS NULL OR NEW.mr_number = '' THEN
        NEW.mr_number := generate_mr_number(NEW.tenant_id);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_mr_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_po_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.po_number IS NULL OR NEW.po_number = '' THEN
        NEW.po_number := generate_po_number(NEW.tenant_id);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_po_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_task_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.task_number IS NULL OR NEW.task_number = '' THEN
        NEW.task_number := generate_task_number(NEW.tenant_id);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_task_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_update_lead_last_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE leads
    SET 
        last_activity_at = CURRENT_TIMESTAMP,
        last_activity_type = NEW.activity_type
    WHERE id = NEW.lead_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_update_lead_last_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_update_user_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM update_tenant_usage(NEW.tenant_id);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM update_tenant_usage(OLD.tenant_id);
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."trigger_update_user_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_phase_progress"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_phase_id UUID;
    v_total_sub_phases INT;
    v_completed_sub_phases INT;
    v_in_progress_sub_phases INT;
    v_new_progress INT;
    v_new_status project_phase_status_enum;
BEGIN
    -- Get the phase_id
    IF TG_OP = 'DELETE' THEN
        v_phase_id := OLD.project_phase_id;
    ELSE
        v_phase_id := NEW.project_phase_id;
    END IF;
    
    -- Count sub-phases
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'completed'),
        COUNT(*) FILTER (WHERE status = 'in_progress')
    INTO v_total_sub_phases, v_completed_sub_phases, v_in_progress_sub_phases
    FROM project_sub_phases
    WHERE project_phase_id = v_phase_id;
    
    -- Calculate progress
    IF v_total_sub_phases > 0 THEN
        v_new_progress := (v_completed_sub_phases * 100) / v_total_sub_phases;
    ELSE
        v_new_progress := 0;
    END IF;
    
    -- Determine phase status based on sub-phases
    IF v_completed_sub_phases = v_total_sub_phases AND v_total_sub_phases > 0 THEN
        v_new_status := 'completed';
    ELSIF v_completed_sub_phases > 0 OR v_in_progress_sub_phases > 0 THEN
        v_new_status := 'in_progress';
    ELSE
        v_new_status := 'not_started';
    END IF;
    
    -- Update phase (only if progress_mode is 'auto')
    UPDATE project_phases
    SET 
        progress_percentage = v_new_progress,
        status = CASE WHEN progress_mode = 'auto' THEN v_new_status ELSE status END,
        actual_start_date = CASE 
            WHEN actual_start_date IS NULL AND v_new_status = 'in_progress' THEN NOW()::DATE 
            ELSE actual_start_date 
        END,
        actual_end_date = CASE 
            WHEN v_new_status = 'completed' THEN NOW()::DATE 
            ELSE actual_end_date 
        END,
        updated_at = NOW()
    WHERE id = v_phase_id
    AND progress_mode = 'auto';
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_phase_progress"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_po_payment_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_total_paid DECIMAL(14,2);
    v_total_amount DECIMAL(14,2);
BEGIN
    -- Calculate total paid
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM po_payments
    WHERE po_id = NEW.po_id;
    
    -- Get PO total
    SELECT total_amount INTO v_total_amount
    FROM stock_purchase_orders
    WHERE id = NEW.po_id;
    
    -- Update PO payment status and amount_paid
    UPDATE stock_purchase_orders
    SET 
        amount_paid = v_total_paid,
        payment_status = CASE
            WHEN v_total_paid >= v_total_amount THEN 'fully_paid'
            WHEN v_total_paid > 0 THEN 'partially_paid'
            ELSE 'pending'
        END,
        updated_at = NOW()
    WHERE id = NEW.po_id;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_po_payment_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_po_status"("p_po_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_total_qty DECIMAL(14,4);
    v_received_qty DECIMAL(14,4);
    v_new_status po_status;
BEGIN
    SELECT COALESCE(SUM(quantity), 0), COALESCE(SUM(received_qty), 0)
    INTO v_total_qty, v_received_qty
    FROM purchase_order_items
    WHERE po_id = p_po_id;
    
    IF v_received_qty = 0 THEN
        v_new_status := 'sent';
    ELSIF v_received_qty < v_total_qty THEN
        v_new_status := 'partially_received';
    ELSE
        v_new_status := 'received';
    END IF;
    
    UPDATE purchase_orders
    SET status = v_new_status, updated_at = NOW()
    WHERE id = p_po_id AND status IN ('sent', 'partially_received');
END;
$$;


ALTER FUNCTION "public"."update_po_status"("p_po_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_project_progress"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_project_id UUID;
    v_total_phases INT;
    v_completed_phases INT;
    v_new_progress INT;
BEGIN
    -- Get project_id
    IF TG_OP = 'DELETE' THEN
        v_project_id := OLD.project_id;
    ELSE
        v_project_id := NEW.project_id;
    END IF;
    
    -- Calculate progress from phases
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'completed')
    INTO v_total_phases, v_completed_phases
    FROM project_phases
    WHERE project_id = v_project_id;
    
    IF v_total_phases > 0 THEN
        -- Use average of phase progress percentages
        SELECT COALESCE(AVG(progress_percentage), 0)::INT
        INTO v_new_progress
        FROM project_phases
        WHERE project_id = v_project_id;
    ELSE
        v_new_progress := 0;
    END IF;
    
    -- Update project
    UPDATE projects
    SET 
        overall_progress = v_new_progress,
        updated_at = NOW()
    WHERE id = v_project_id;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_project_progress"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_projects_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_projects_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_stock_on_grn"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_item RECORD;
    v_current_qty DECIMAL(14,4);
    v_current_value DECIMAL(14,2);
    v_new_qty DECIMAL(14,4);
    v_new_avg_cost DECIMAL(12,2);
    v_location_id UUID;
    v_tenant_id UUID;
BEGIN
    IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
        v_location_id := NEW.location_id;
        v_tenant_id := NEW.tenant_id;
        
        FOR v_item IN 
            SELECT cost_item_id, accepted_qty, unit_price, unit_code
            FROM goods_receipt_items WHERE grn_id = NEW.id
        LOOP
            -- Get current stock
            SELECT COALESCE(quantity, 0), COALESCE(avg_cost, 0)
            INTO v_current_qty, v_current_value
            FROM stock_levels
            WHERE cost_item_id = v_item.cost_item_id 
            AND location_id = v_location_id;
            
            IF NOT FOUND THEN
                v_current_qty := 0;
                v_current_value := 0;
            END IF;
            
            v_new_qty := v_current_qty + v_item.accepted_qty;
            
            -- Calculate new average cost
            IF v_new_qty > 0 THEN
                v_new_avg_cost := ((v_current_qty * v_current_value) + (v_item.accepted_qty * v_item.unit_price)) / v_new_qty;
            ELSE
                v_new_avg_cost := v_item.unit_price;
            END IF;
            
            -- Upsert stock level
            INSERT INTO stock_levels (tenant_id, cost_item_id, location_id, quantity, avg_cost, last_receipt_date)
            VALUES (v_tenant_id, v_item.cost_item_id, v_location_id, v_item.accepted_qty, v_new_avg_cost, NOW())
            ON CONFLICT (tenant_id, cost_item_id, location_id)
            DO UPDATE SET
                quantity = stock_levels.quantity + v_item.accepted_qty,
                avg_cost = v_new_avg_cost,
                last_receipt_date = NOW(),
                updated_at = NOW();
            
            -- Create stock movement
            INSERT INTO stock_movements (
                tenant_id, cost_item_id, location_id, movement_type, quantity, unit_code,
                unit_cost, total_cost, balance_qty, balance_value,
                reference_type, reference_id, reference_number, created_by
            ) VALUES (
                v_tenant_id, v_item.cost_item_id, v_location_id, 'purchase_receipt', 
                v_item.accepted_qty, v_item.unit_code,
                v_item.unit_price, v_item.accepted_qty * v_item.unit_price,
                v_new_qty, v_new_qty * v_new_avg_cost,
                'grn', NEW.id, NEW.grn_number, NEW.confirmed_by
            );
            
            -- Update PO item received qty
            IF v_item.cost_item_id IS NOT NULL THEN
                UPDATE purchase_order_items
                SET received_qty = received_qty + v_item.accepted_qty, updated_at = NOW()
                WHERE id = (SELECT po_item_id FROM goods_receipt_items WHERE grn_id = NEW.id AND cost_item_id = v_item.cost_item_id LIMIT 1);
            END IF;
        END LOOP;
        
        -- Update PO status if applicable
        IF NEW.po_id IS NOT NULL THEN
            PERFORM update_po_status(NEW.po_id);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_stock_on_grn"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_stock_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_stock_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tenant_usage"("p_tenant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO tenant_usage (tenant_id, current_users, current_projects, active_projects, last_calculated_at)
    VALUES (
        p_tenant_id,
        (SELECT COUNT(*) FROM users WHERE tenant_id = p_tenant_id AND status = 'active'),
        0, -- TODO: Update when projects table exists
        0,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (tenant_id) DO UPDATE SET
        current_users = (SELECT COUNT(*) FROM users WHERE tenant_id = p_tenant_id AND status = 'active'),
        last_calculated_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP;
END;
$$;


ALTER FUNCTION "public"."update_tenant_usage"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tenant_users_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_tenant_users_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_tenant_access"("p_user_id" "uuid", "p_tenant_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM tenant_users 
        WHERE user_id = p_user_id 
        AND tenant_id = p_tenant_id 
        AND is_active = true
    );
END;
$$;


ALTER FUNCTION "public"."user_has_tenant_access"("p_user_id" "uuid", "p_tenant_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "action" character varying(100) NOT NULL,
    "description" "text",
    "ip_address" "inet",
    "user_agent" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."activity_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."approval_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "config_type" character varying(50) DEFAULT 'purchase_order'::character varying NOT NULL,
    "is_approval_required" boolean DEFAULT true,
    "auto_approve_limit" numeric(14,2) DEFAULT 0,
    "level1_limit" numeric(14,2) DEFAULT 50000,
    "level2_limit" numeric(14,2) DEFAULT 200000,
    "level1_role" character varying(50) DEFAULT 'manager'::character varying,
    "level2_role" character varying(50) DEFAULT 'director'::character varying,
    "level3_role" character varying(50) DEFAULT 'owner'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."approval_configs" OWNER TO "postgres";


COMMENT ON TABLE "public"."approval_configs" IS 'Configurable approval thresholds and roles per tenant';



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "action" character varying(100) NOT NULL,
    "entity_type" character varying(100) NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commission_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quotation_id" "uuid",
    "project_id" "uuid",
    "material_id" "uuid",
    "item_name" character varying(255) NOT NULL,
    "brand_id" "uuid",
    "vendor_id" "uuid",
    "quantity" numeric(12,2) DEFAULT 1,
    "unit" character varying(50) DEFAULT 'pcs'::character varying,
    "vendor_cost" numeric(12,2) NOT NULL,
    "selling_price" numeric(12,2) NOT NULL,
    "commission_amount" numeric(12,2) NOT NULL,
    "commission_percent" numeric(5,2),
    "revenue_head_id" "uuid",
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "sale_date" "date",
    "payment_received_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "commission_items_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'sold'::character varying, 'delivered'::character varying, 'paid'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."commission_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."component_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "component_type_id" "uuid",
    "name" character varying(200) NOT NULL,
    "description" "text",
    "default_width" numeric(10,2),
    "default_height" numeric(10,2),
    "default_depth" numeric(10,2),
    "quality_tier" character varying(20) DEFAULT 'standard'::character varying,
    "base_price" numeric(14,2),
    "template_data" "jsonb" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "variant_type_id" "uuid"
);


ALTER TABLE "public"."component_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."component_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "description" "text",
    "icon" character varying(50),
    "default_width" numeric(10,2),
    "default_height" numeric(10,2),
    "default_depth" numeric(10,2),
    "applicable_space_types" "uuid"[],
    "config_schema" "jsonb",
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "is_system" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."component_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."component_variant_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "component_type_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "description" "text",
    "icon" character varying(50),
    "cost_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "default_width" numeric(10,2),
    "default_height" numeric(10,2),
    "default_depth" numeric(10,2),
    "base_rate_per_sqft" numeric(12,2),
    "quality_tier" character varying(20) DEFAULT 'standard'::character varying,
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "is_system" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."component_variant_types" OWNER TO "postgres";


COMMENT ON TABLE "public"."component_variant_types" IS 'Tertiary level in quotation hierarchy: Space > Component > Type > Cost Attributes. 
     Defines variants like CeilingSliding, OpenableWithLoft for Wardrobe component type.';



COMMENT ON COLUMN "public"."component_variant_types"."cost_config" IS 'JSON configuration defining which cost attributes apply to this variant and how they are calculated.
     Example: {"attributes": [{"name": "Area", "type": "area", "unit": "sqft"}, {"name": "Hinges", "type": "quantity", "unit": "nos"}]}';



CREATE TABLE IF NOT EXISTS "public"."component_variants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "component_type_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "description" "text",
    "icon" character varying(50),
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "is_system" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."component_variants" OWNER TO "postgres";


COMMENT ON TABLE "public"."component_variants" IS 'Variants/types of components (e.g., Sliding, Openable for Wardrobe)';



CREATE TABLE IF NOT EXISTS "public"."cost_attribute_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "description" "text",
    "data_type" character varying(20) DEFAULT 'number'::character varying NOT NULL,
    "unit" character varying(20),
    "is_calculated" boolean DEFAULT false,
    "calculation_formula" "text",
    "applicable_categories" "uuid"[],
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cost_attribute_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cost_item_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "description" "text",
    "icon" character varying(50),
    "color" character varying(20),
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "is_system" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cost_item_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."cost_item_categories" IS 'Categories for organizing cost items (Material, Hardware, Labour, etc.)';



CREATE TABLE IF NOT EXISTS "public"."cost_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "name" character varying(200) NOT NULL,
    "slug" character varying(200) NOT NULL,
    "description" "text",
    "unit_code" character varying(20) NOT NULL,
    "default_rate" numeric(12,2) DEFAULT 0 NOT NULL,
    "specifications" "jsonb",
    "quality_tier" character varying(20) DEFAULT 'standard'::character varying,
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "is_system" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_stockable" boolean DEFAULT false,
    "reorder_level" numeric(12,4) DEFAULT 0,
    "min_order_qty" numeric(12,4) DEFAULT 1,
    "lead_time_days" integer DEFAULT 0,
    "default_vendor_id" "uuid"
);


ALTER TABLE "public"."cost_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."cost_items" IS 'Anything with a price - materials, hardware, labour, services';



CREATE TABLE IF NOT EXISTS "public"."email_verification_tokens" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" character varying(500) NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."email_verification_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goods_receipt_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "grn_id" "uuid" NOT NULL,
    "po_item_id" "uuid",
    "cost_item_id" "uuid" NOT NULL,
    "ordered_qty" numeric(12,4),
    "received_qty" numeric(12,4) NOT NULL,
    "accepted_qty" numeric(12,4) NOT NULL,
    "rejected_qty" numeric(12,4) DEFAULT 0,
    "unit_code" character varying(20) NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "rejection_reason" "text",
    "batch_number" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."goods_receipt_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goods_receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "grn_number" character varying(30) NOT NULL,
    "po_id" "uuid",
    "vendor_id" "uuid" NOT NULL,
    "receipt_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "location_id" "uuid" NOT NULL,
    "vendor_invoice_number" character varying(50),
    "vendor_invoice_date" "date",
    "vendor_challan_number" character varying(50),
    "subtotal" numeric(14,2) DEFAULT 0,
    "tax_amount" numeric(14,2) DEFAULT 0,
    "other_charges" numeric(14,2) DEFAULT 0,
    "grand_total" numeric(14,2) DEFAULT 0,
    "notes" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "confirmed_by" "uuid",
    "confirmed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."goods_receipts" OWNER TO "postgres";


COMMENT ON TABLE "public"."goods_receipts" IS 'Goods Receipt Notes - receiving stock from vendors';



CREATE TABLE IF NOT EXISTS "public"."lead_activities" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "activity_type" "public"."lead_activity_type_enum" NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "call_duration_seconds" integer,
    "call_outcome" character varying(50),
    "meeting_scheduled_at" timestamp with time zone,
    "meeting_location" character varying(255),
    "meeting_completed" boolean DEFAULT false,
    "meeting_notes" "text",
    "email_subject" character varying(255),
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."lead_activities" OWNER TO "postgres";


COMMENT ON TABLE "public"."lead_activities" IS 'Activity timeline for leads';



CREATE TABLE IF NOT EXISTS "public"."lead_documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "file_name" character varying(255) NOT NULL,
    "file_type" character varying(100),
    "file_size_bytes" bigint,
    "file_url" "text" NOT NULL,
    "storage_path" "text",
    "document_type" character varying(50),
    "description" "text",
    "uploaded_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."lead_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."lead_documents" IS 'Documents attached to leads';



CREATE TABLE IF NOT EXISTS "public"."lead_family_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "relation" character varying(50),
    "phone" character varying(20),
    "email" character varying(255),
    "is_decision_maker" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."lead_family_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."lead_family_members" IS 'Additional contacts/family members for a lead';



CREATE TABLE IF NOT EXISTS "public"."lead_notes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_pinned" boolean DEFAULT false,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."lead_notes" OWNER TO "postgres";


COMMENT ON TABLE "public"."lead_notes" IS 'Notes/comments on leads';



CREATE TABLE IF NOT EXISTS "public"."lead_stage_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "from_stage" "public"."lead_stage_enum",
    "to_stage" "public"."lead_stage_enum" NOT NULL,
    "changed_by" "uuid" NOT NULL,
    "change_reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."lead_stage_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."lead_stage_history" IS 'Audit trail of all stage changes';



CREATE TABLE IF NOT EXISTS "public"."lead_tasks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "due_date" "date",
    "due_time" time without time zone,
    "priority" character varying(20) DEFAULT 'medium'::character varying,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "completed_at" timestamp with time zone,
    "assigned_to" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."lead_tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."lead_tasks" IS 'Tasks associated with leads';



CREATE TABLE IF NOT EXISTS "public"."lead_won_requests" (
    "id" "uuid" NOT NULL,
    "lead_id" "uuid",
    "requested_by" "uuid",
    "requested_at" timestamp with time zone,
    "final_won_amount" numeric,
    "token_amount" numeric,
    "token_received_date" "date",
    "contract_signed_date" "date",
    "payment_terms" "text",
    "handover_checklist" "jsonb",
    "handover_notes" "text",
    "status" character varying(20),
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "rejection_reason" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."lead_won_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "lead_number" character varying(50) NOT NULL,
    "client_name" character varying(255) NOT NULL,
    "phone" character varying(20) NOT NULL,
    "email" character varying(255),
    "property_type" "public"."property_type_enum",
    "service_type" "public"."service_type_enum",
    "lead_source" "public"."lead_source_enum",
    "lead_source_detail" character varying(255),
    "target_start_date" "date",
    "target_end_date" "date",
    "property_name" character varying(255),
    "flat_number" character varying(50),
    "property_address" "text",
    "property_city" character varying(100),
    "property_pincode" character varying(10),
    "carpet_area_sqft" numeric(10,2),
    "budget_range" "public"."budget_range_enum",
    "estimated_value" numeric(12,2),
    "project_scope" "text",
    "special_requirements" "text",
    "stage" "public"."lead_stage_enum" DEFAULT 'new'::"public"."lead_stage_enum" NOT NULL,
    "stage_changed_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "disqualification_reason" "public"."disqualification_reason_enum",
    "disqualification_notes" "text",
    "lost_reason" "public"."lost_reason_enum",
    "lost_to_competitor" character varying(255),
    "lost_notes" "text",
    "won_amount" numeric(12,2),
    "won_at" timestamp with time zone,
    "contract_signed_date" "date",
    "expected_project_start" "date",
    "assigned_to" "uuid",
    "assigned_at" timestamp with time zone,
    "assigned_by" "uuid",
    "created_by" "uuid" NOT NULL,
    "requires_approval" boolean DEFAULT false,
    "approval_status" character varying(20) DEFAULT NULL::character varying,
    "approval_requested_at" timestamp with time zone,
    "approval_requested_by" "uuid",
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "approval_notes" "text",
    "priority" character varying(20) DEFAULT 'medium'::character varying,
    "last_activity_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "last_activity_type" "public"."lead_activity_type_enum",
    "next_followup_date" "date",
    "next_followup_notes" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "payment_terms" "text",
    "token_amount" numeric(12,2),
    "token_received_date" "date",
    "handover_notes" "text",
    "handover_completed" boolean DEFAULT false,
    "handover_completed_at" timestamp with time zone,
    "project_id" "uuid"
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


COMMENT ON TABLE "public"."leads" IS 'Main leads/opportunities table for sales pipeline';



CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "project_number" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "client_name" character varying(255),
    "client_email" character varying(255),
    "client_phone" character varying(50),
    "site_address" "text",
    "city" character varying(100),
    "state" character varying(100),
    "pincode" character varying(20),
    "project_type" character varying(50) DEFAULT 'residential'::character varying,
    "status" character varying(30) DEFAULT 'planning'::character varying,
    "start_date" "date",
    "expected_end_date" "date",
    "actual_end_date" "date",
    "quoted_amount" numeric(14,2) DEFAULT 0,
    "budget_amount" numeric(14,2) DEFAULT 0,
    "actual_cost" numeric(14,2) DEFAULT 0,
    "project_manager_id" "uuid",
    "lead_id" "uuid",
    "quotation_id" "uuid",
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "converted_from_lead_id" "uuid",
    "overall_progress" integer DEFAULT 0,
    "flat_number" character varying(50),
    "property_name" character varying(255),
    "carpet_area_sqft" numeric(10,2),
    "lead_source" character varying(50),
    "sales_rep_id" "uuid",
    "lead_won_date" timestamp with time zone,
    "property_type" "public"."project_property_type_enum" DEFAULT 'unknown'::"public"."project_property_type_enum",
    "budget_range" character varying(30),
    "lead_source_detail" character varying(255),
    "project_category" "public"."project_category_enum" DEFAULT 'turnkey'::"public"."project_category_enum",
    CONSTRAINT "projects_overall_progress_check" CHECK ((("overall_progress" >= 0) AND ("overall_progress" <= 100))),
    CONSTRAINT "projects_project_type_check" CHECK ((("project_type")::"text" = ANY ((ARRAY['residential'::character varying, 'commercial'::character varying, 'hospitality'::character varying, 'retail'::character varying, 'office'::character varying, 'villa'::character varying, 'apartment'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "projects_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['planning'::character varying, 'design'::character varying, 'procurement'::character varying, 'execution'::character varying, 'finishing'::character varying, 'handover'::character varying, 'completed'::character varying, 'on_hold'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


COMMENT ON TABLE "public"."projects" IS 'Interior design projects - aligned with leads module for seamless conversion';



COMMENT ON COLUMN "public"."projects"."project_type" IS 'DEPRECATED: Use property_type instead. Kept for backward compatibility.';



COMMENT ON COLUMN "public"."projects"."lead_id" IS 'DEPRECATED: Use converted_from_lead_id instead. Will be removed in future migration.';



COMMENT ON COLUMN "public"."projects"."flat_number" IS 'Flat/unit number (e.g., A-1502)';



COMMENT ON COLUMN "public"."projects"."property_name" IS 'Property/building name (e.g., Prestige Lakeside)';



COMMENT ON COLUMN "public"."projects"."carpet_area_sqft" IS 'Carpet area in square feet';



COMMENT ON COLUMN "public"."projects"."lead_source" IS 'How the lead was acquired';



COMMENT ON COLUMN "public"."projects"."sales_rep_id" IS 'Sales representative who converted the lead';



COMMENT ON COLUMN "public"."projects"."lead_won_date" IS 'Date when lead was marked as won';



COMMENT ON COLUMN "public"."projects"."property_type" IS 'Type of property (apartment, villa, commercial, etc.) - matches leads.property_type';



COMMENT ON COLUMN "public"."projects"."budget_range" IS 'Budget range from lead';



COMMENT ON COLUMN "public"."projects"."lead_source_detail" IS 'Additional source details (e.g., referrer name)';



COMMENT ON COLUMN "public"."projects"."project_category" IS 'Service category (turnkey, modular, renovation, etc.) - matches leads.service_type';



CREATE OR REPLACE VIEW "public"."leads_with_project_status" AS
 SELECT "l"."id",
    "l"."tenant_id",
    "l"."lead_number",
    "l"."client_name",
    "l"."phone",
    "l"."email",
    "l"."property_type",
    "l"."service_type",
    "l"."lead_source",
    "l"."lead_source_detail",
    "l"."target_start_date",
    "l"."target_end_date",
    "l"."property_name",
    "l"."flat_number",
    "l"."property_address",
    "l"."property_city",
    "l"."property_pincode",
    "l"."carpet_area_sqft",
    "l"."budget_range",
    "l"."estimated_value",
    "l"."project_scope",
    "l"."special_requirements",
    "l"."stage",
    "l"."stage_changed_at",
    "l"."disqualification_reason",
    "l"."disqualification_notes",
    "l"."lost_reason",
    "l"."lost_to_competitor",
    "l"."lost_notes",
    "l"."won_amount",
    "l"."won_at",
    "l"."contract_signed_date",
    "l"."expected_project_start",
    "l"."assigned_to",
    "l"."assigned_at",
    "l"."assigned_by",
    "l"."created_by",
    "l"."requires_approval",
    "l"."approval_status",
    "l"."approval_requested_at",
    "l"."approval_requested_by",
    "l"."approved_at",
    "l"."approved_by",
    "l"."approval_notes",
    "l"."priority",
    "l"."last_activity_at",
    "l"."last_activity_type",
    "l"."next_followup_date",
    "l"."next_followup_notes",
    "l"."created_at",
    "l"."updated_at",
    "l"."payment_terms",
    "l"."token_amount",
    "l"."token_received_date",
    "l"."handover_notes",
    "l"."handover_completed",
    "l"."handover_completed_at",
    "l"."project_id",
    "p"."id" AS "linked_project_id",
    "p"."project_number",
    "p"."status" AS "project_status",
    "p"."overall_progress" AS "project_progress",
        CASE
            WHEN ("p"."id" IS NOT NULL) THEN true
            ELSE false
        END AS "has_project"
   FROM ("public"."leads" "l"
     LEFT JOIN "public"."projects" "p" ON (("l"."project_id" = "p"."id")));


ALTER VIEW "public"."leads_with_project_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."material_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "description" "text",
    "applicable_component_types" "uuid"[],
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."material_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."material_presets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" character varying(200) NOT NULL,
    "description" "text",
    "applicable_component_types" "uuid"[],
    "quality_tier" character varying(20) DEFAULT 'standard'::character varying,
    "price_modifier" numeric(5,2) DEFAULT 1.0,
    "materials" "jsonb" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."material_presets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "name" character varying(200) NOT NULL,
    "code" character varying(50),
    "description" "text",
    "specifications" "jsonb",
    "unit" character varying(20) DEFAULT 'sqft'::character varying NOT NULL,
    "base_rate" numeric(12,2) DEFAULT 0 NOT NULL,
    "labour_rate" numeric(12,2) DEFAULT 0,
    "wastage_percent" numeric(5,2) DEFAULT 0,
    "alternatives" "uuid"[],
    "quality_tier" character varying(20) DEFAULT 'standard'::character varying,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "notification_type" "public"."notification_type_enum" NOT NULL,
    "in_app" boolean DEFAULT true,
    "email" boolean DEFAULT false,
    "push" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "public"."notification_type_enum" NOT NULL,
    "title" character varying(255) NOT NULL,
    "message" "text" NOT NULL,
    "priority" "public"."notification_priority_enum" DEFAULT 'normal'::"public"."notification_priority_enum" NOT NULL,
    "entity_type" character varying(50),
    "entity_id" "uuid",
    "action_url" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "triggered_by" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "expires_at" timestamp with time zone
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ownership_transfers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "from_user_id" "uuid" NOT NULL,
    "to_user_id" "uuid" NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "token" character varying(500) NOT NULL,
    "reason" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ownership_transfers_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying, 'expired'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."ownership_transfers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."password_reset_tokens" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" character varying(500) NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."password_reset_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "key" character varying(100) NOT NULL,
    "module" character varying(50) NOT NULL,
    "description" "text",
    "is_system_permission" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."po_approval_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "po_id" "uuid" NOT NULL,
    "action" character varying(30) NOT NULL,
    "from_status" character varying(30),
    "to_status" character varying(30),
    "performed_by" "uuid",
    "comments" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "po_approval_history_action_check" CHECK ((("action")::"text" = ANY ((ARRAY['submitted'::character varying, 'approved'::character varying, 'rejected'::character varying, 'cancelled'::character varying, 'sent_to_vendor'::character varying, 'acknowledged'::character varying, 'dispatched'::character varying, 'partially_received'::character varying, 'fully_received'::character varying, 'closed'::character varying, 'draft'::character varying])::"text"[])))
);


ALTER TABLE "public"."po_approval_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."po_approval_history" IS 'Audit trail for all PO status changes and approvals';



CREATE TABLE IF NOT EXISTS "public"."po_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "po_id" "uuid" NOT NULL,
    "payment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "payment_type" character varying(30) DEFAULT 'regular'::character varying,
    "payment_method" character varying(30),
    "reference_number" character varying(100),
    "bank_reference" character varying(100),
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "po_payments_payment_method_check" CHECK ((("payment_method")::"text" = ANY ((ARRAY['bank_transfer'::character varying, 'cheque'::character varying, 'cash'::character varying, 'upi'::character varying, 'card'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "po_payments_payment_type_check" CHECK ((("payment_type")::"text" = ANY ((ARRAY['advance'::character varying, 'regular'::character varying, 'final'::character varying, 'adjustment'::character varying])::"text"[])))
);


ALTER TABLE "public"."po_payments" OWNER TO "postgres";


COMMENT ON TABLE "public"."po_payments" IS 'Payment records against purchase orders';



CREATE TABLE IF NOT EXISTS "public"."pricing_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "category_pattern" character varying(100),
    "brand_id" "uuid",
    "item_type" character varying(50),
    "markup_type" character varying(20) NOT NULL,
    "markup_value" numeric(12,2),
    "tier_ranges" "jsonb",
    "revenue_head_id" "uuid",
    "priority" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pricing_rules_markup_type_check" CHECK ((("markup_type")::"text" = ANY ((ARRAY['percentage'::character varying, 'fixed'::character varying, 'tiered'::character varying])::"text"[])))
);


ALTER TABLE "public"."pricing_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_checklist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_sub_phase_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "is_completed" boolean DEFAULT false,
    "display_order" integer NOT NULL,
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."project_checklist_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."project_checklist_items" IS 'Checklist items within sub-phases';



CREATE TABLE IF NOT EXISTS "public"."stock_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "sku" character varying(100) NOT NULL,
    "description" "text",
    "category" character varying(100),
    "item_type" character varying(50) DEFAULT 'raw_material'::character varying,
    "unit_of_measure" character varying(50) DEFAULT 'pcs'::character varying,
    "current_quantity" numeric(12,2) DEFAULT 0,
    "minimum_quantity" numeric(12,2) DEFAULT 0,
    "reorder_quantity" numeric(12,2) DEFAULT 0,
    "unit_cost" numeric(12,2) DEFAULT 0,
    "selling_price" numeric(12,2),
    "preferred_vendor_id" "uuid",
    "storage_location" character varying(255),
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "brand_id" "uuid",
    "vendor_cost" numeric(12,2),
    "company_cost" numeric(12,2),
    "retail_price" numeric(12,2),
    "markup_percent" numeric(5,2),
    "markup_amount" numeric(12,2),
    "revenue_head_id" "uuid",
    "is_commission_item" boolean DEFAULT false,
    "commission_percent" numeric(5,2),
    "specifications" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "stock_materials_item_type_check" CHECK ((("item_type")::"text" = ANY ((ARRAY['raw_material'::character varying, 'hardware'::character varying, 'consumable'::character varying, 'finished_good'::character varying, 'accessory'::character varying])::"text"[])))
);


ALTER TABLE "public"."stock_materials" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_materials" IS 'Inventory items tracked for stock management';



COMMENT ON COLUMN "public"."stock_materials"."vendor_cost" IS 'Cost price from vendor/dealer';



COMMENT ON COLUMN "public"."stock_materials"."company_cost" IS 'Internal cost used in quotations (includes markup)';



COMMENT ON COLUMN "public"."stock_materials"."retail_price" IS 'MRP or market reference price';



COMMENT ON COLUMN "public"."stock_materials"."markup_percent" IS 'Percentage markup over vendor cost';



COMMENT ON COLUMN "public"."stock_materials"."is_commission_item" IS 'True for items where revenue is commission-based (appliances, lighting)';



COMMENT ON COLUMN "public"."stock_materials"."specifications" IS 'JSONB column storing material specifications like dimensions, weight, color, finish, grade, material composition, etc.';



CREATE TABLE IF NOT EXISTS "public"."stock_purchase_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "po_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "quantity" numeric(12,2) NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "tax_percent" numeric(5,2) DEFAULT 0,
    "discount_percent" numeric(5,2) DEFAULT 0,
    "total_amount" numeric(14,2) NOT NULL,
    "received_quantity" numeric(12,2) DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "project_id" "uuid",
    "cost_type" character varying(20) DEFAULT 'project'::character varying,
    "cost_code" character varying(50),
    CONSTRAINT "stock_po_items_cost_type_check" CHECK ((("cost_type")::"text" = ANY ((ARRAY['project'::character varying, 'stock'::character varying, 'overhead'::character varying])::"text"[])))
);


ALTER TABLE "public"."stock_purchase_order_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."stock_purchase_order_items"."project_id" IS 'Project this material is allocated to (NULL for stock/overhead)';



COMMENT ON COLUMN "public"."stock_purchase_order_items"."cost_type" IS 'project = project cost, stock = inventory, overhead = non-project expense';



COMMENT ON COLUMN "public"."stock_purchase_order_items"."cost_code" IS 'Code for non-project items (e.g., NP for Non-Project)';



CREATE TABLE IF NOT EXISTS "public"."stock_purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "po_number" character varying(50) NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "mr_id" "uuid",
    "order_date" "date" DEFAULT CURRENT_DATE,
    "expected_delivery" "date",
    "status" character varying(30) DEFAULT 'draft'::character varying,
    "subtotal" numeric(14,2) DEFAULT 0,
    "tax_amount" numeric(14,2) DEFAULT 0,
    "discount_amount" numeric(14,2) DEFAULT 0,
    "total_amount" numeric(14,2) DEFAULT 0,
    "shipping_address" "text",
    "billing_address" "text",
    "payment_terms" character varying(100),
    "notes" "text",
    "created_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "payment_status" character varying(30) DEFAULT 'pending'::character varying,
    "amount_paid" numeric(14,2) DEFAULT 0,
    "payment_due_date" "date",
    "submitted_for_approval_at" timestamp with time zone,
    "sent_to_vendor_at" timestamp with time zone,
    "acknowledged_at" timestamp with time zone,
    "dispatched_at" timestamp with time zone,
    "fully_received_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "cancellation_reason" "text",
    "requires_approval" boolean DEFAULT true,
    "approval_level" integer DEFAULT 1,
    "rejection_reason" "text",
    "rejected_by" "uuid",
    "rejected_at" timestamp with time zone,
    "closed_by" "uuid",
    "closed_at" timestamp with time zone,
    CONSTRAINT "stock_purchase_orders_payment_status_check" CHECK ((("payment_status")::"text" = ANY ((ARRAY['not_applicable'::character varying, 'pending'::character varying, 'advance_paid'::character varying, 'partially_paid'::character varying, 'fully_paid'::character varying, 'overdue'::character varying])::"text"[]))),
    CONSTRAINT "stock_purchase_orders_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['draft'::character varying, 'pending_approval'::character varying, 'approved'::character varying, 'rejected'::character varying, 'sent_to_vendor'::character varying, 'acknowledged'::character varying, 'dispatched'::character varying, 'partially_received'::character varying, 'fully_received'::character varying, 'closed'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."stock_purchase_orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_purchase_orders" IS 'Purchase orders sent to vendors';



COMMENT ON COLUMN "public"."stock_purchase_orders"."status" IS 'Order status: draft → pending_approval → approved → sent_to_vendor → dispatched → partially_received → fully_received';



COMMENT ON COLUMN "public"."stock_purchase_orders"."payment_status" IS 'Payment status: pending → advance_paid → partially_paid → fully_paid (independent of order status)';



COMMENT ON COLUMN "public"."stock_purchase_orders"."rejection_reason" IS 'Reason for PO rejection';



COMMENT ON COLUMN "public"."stock_purchase_orders"."rejected_by" IS 'User who rejected the PO';



COMMENT ON COLUMN "public"."stock_purchase_orders"."rejected_at" IS 'Timestamp when PO was rejected';



COMMENT ON COLUMN "public"."stock_purchase_orders"."closed_by" IS 'User who closed the PO after full receipt and payment';



COMMENT ON COLUMN "public"."stock_purchase_orders"."closed_at" IS 'Timestamp when PO was closed';



CREATE TABLE IF NOT EXISTS "public"."stock_vendors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "code" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "display_name" character varying(255),
    "contact_person" character varying(255),
    "email" character varying(255),
    "phone" character varying(50),
    "alternate_phone" character varying(50),
    "website" character varying(255),
    "address_line1" "text",
    "address_line2" "text",
    "city" character varying(100),
    "state" character varying(100),
    "pincode" character varying(20),
    "country" character varying(100) DEFAULT 'India'::character varying,
    "gst_number" character varying(20),
    "pan_number" character varying(20),
    "payment_terms" character varying(100),
    "credit_days" integer DEFAULT 30,
    "credit_limit" numeric(14,2) DEFAULT 0,
    "category_ids" "uuid"[],
    "bank_name" character varying(255),
    "bank_account_number" character varying(50),
    "bank_ifsc" character varying(20),
    "is_active" boolean DEFAULT true,
    "rating" integer DEFAULT 0,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_preferred" boolean DEFAULT false,
    CONSTRAINT "stock_vendors_rating_check" CHECK ((("rating" >= 0) AND ("rating" <= 5)))
);


ALTER TABLE "public"."stock_vendors" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_vendors" IS 'Suppliers and vendors for stock materials';



CREATE OR REPLACE VIEW "public"."project_material_costs" AS
 SELECT "p"."id" AS "project_id",
    "p"."project_number",
    "p"."name" AS "project_name",
    "p"."tenant_id",
    "poi"."id" AS "po_item_id",
    "po"."po_number",
    "po"."status" AS "po_status",
    "po"."payment_status",
    "m"."name" AS "material_name",
    "m"."sku",
    "poi"."quantity",
    "poi"."unit_price",
    "poi"."total_amount",
    "poi"."received_quantity",
    "poi"."cost_type",
    "po"."order_date",
    "po"."vendor_id",
    "v"."name" AS "vendor_name"
   FROM (((("public"."projects" "p"
     JOIN "public"."stock_purchase_order_items" "poi" ON (("poi"."project_id" = "p"."id")))
     JOIN "public"."stock_purchase_orders" "po" ON (("po"."id" = "poi"."po_id")))
     JOIN "public"."stock_materials" "m" ON (("m"."id" = "poi"."material_id")))
     LEFT JOIN "public"."stock_vendors" "v" ON (("v"."id" = "po"."vendor_id")))
  WHERE (("poi"."cost_type")::"text" = 'project'::"text");


ALTER VIEW "public"."project_material_costs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_payment_milestone_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "name" character varying(100) NOT NULL,
    "description" "text",
    "percentage" numeric(5,2),
    "trigger_phase_template_id" "uuid",
    "trigger_condition" character varying(20) DEFAULT 'on_completion'::character varying,
    "display_order" integer NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."project_payment_milestone_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_payment_milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "milestone_template_id" "uuid",
    "name" character varying(100) NOT NULL,
    "description" "text",
    "percentage" numeric(5,2),
    "amount" numeric(14,2),
    "linked_phase_id" "uuid",
    "trigger_condition" character varying(20) DEFAULT 'on_completion'::character varying,
    "status" "public"."payment_milestone_status_enum" DEFAULT 'pending'::"public"."payment_milestone_status_enum",
    "due_date" "date",
    "paid_at" timestamp with time zone,
    "paid_amount" numeric(14,2),
    "payment_reference" "text",
    "payment_method" character varying(50),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."project_payment_milestones" OWNER TO "postgres";


COMMENT ON TABLE "public"."project_payment_milestones" IS 'Payment milestones linked to phase completion';



CREATE TABLE IF NOT EXISTS "public"."project_phases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "phase_template_id" "uuid",
    "name" character varying(100) NOT NULL,
    "category_code" character varying(30),
    "status" "public"."project_phase_status_enum" DEFAULT 'not_started'::"public"."project_phase_status_enum",
    "progress_percentage" integer DEFAULT 0,
    "progress_mode" "public"."progress_mode_enum" DEFAULT 'auto'::"public"."progress_mode_enum",
    "assigned_to" "uuid",
    "display_order" integer NOT NULL,
    "planned_start_date" "date",
    "planned_end_date" "date",
    "actual_start_date" "date",
    "actual_end_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "can_start_parallel" boolean DEFAULT false,
    "started_at" timestamp with time zone,
    "started_by" "uuid",
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "estimated_duration_hours" integer,
    "estimated_hours" integer,
    "actual_hours" integer,
    CONSTRAINT "project_phases_progress_percentage_check" CHECK ((("progress_percentage" >= 0) AND ("progress_percentage" <= 100)))
);


ALTER TABLE "public"."project_phases" OWNER TO "postgres";


COMMENT ON TABLE "public"."project_phases" IS 'Actual phases for each project with progress tracking';



COMMENT ON COLUMN "public"."project_phases"."estimated_duration_hours" IS 'Estimated duration in hours for this phase (allows for finer granularity)';



CREATE OR REPLACE VIEW "public"."project_payment_milestones_view" AS
 SELECT "pm"."id",
    "pm"."project_id",
    "pm"."name",
    "pm"."description",
    "pm"."percentage",
    "pm"."amount",
    "pm"."linked_phase_id",
    "pm"."status",
    "pm"."due_date",
    "pm"."paid_at",
    "pm"."payment_reference",
    "pp"."name" AS "linked_phase_name",
    "pp"."status" AS "phase_status",
    "p"."project_number",
    "p"."name" AS "project_name",
    "p"."tenant_id"
   FROM (("public"."project_payment_milestones" "pm"
     JOIN "public"."projects" "p" ON (("pm"."project_id" = "p"."id")))
     LEFT JOIN "public"."project_phases" "pp" ON (("pm"."linked_phase_id" = "pp"."id")));


ALTER VIEW "public"."project_payment_milestones_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."project_payment_milestones_view" IS 'Payment milestones - filter amount column based on user role in application';



CREATE TABLE IF NOT EXISTS "public"."project_phase_activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "project_phase_id" "uuid",
    "project_sub_phase_id" "uuid",
    "activity_type" character varying(50) NOT NULL,
    "description" "text",
    "old_value" "jsonb",
    "new_value" "jsonb",
    "performed_by" "uuid" NOT NULL,
    "performed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."project_phase_activity_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."project_phase_activity_log" IS 'Activity log for all phase-related actions';



CREATE TABLE IF NOT EXISTS "public"."project_phase_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "project_sub_phase_id" "uuid" NOT NULL,
    "requested_by" "uuid" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "request_notes" "text",
    "approver_id" "uuid",
    "approver_role" character varying(50),
    "status" "public"."approval_status_enum" DEFAULT 'pending'::"public"."approval_status_enum",
    "responded_at" timestamp with time zone,
    "response_notes" "text",
    "revision_number" integer DEFAULT 1,
    "previous_approval_id" "uuid"
);


ALTER TABLE "public"."project_phase_approvals" OWNER TO "postgres";


COMMENT ON TABLE "public"."project_phase_approvals" IS 'Approval requests and responses for sub-phases';



CREATE TABLE IF NOT EXISTS "public"."project_phase_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "project_phase_id" "uuid",
    "project_sub_phase_id" "uuid",
    "file_name" character varying(255) NOT NULL,
    "file_type" character varying(100),
    "file_url" "text" NOT NULL,
    "file_size" integer,
    "attachment_type" character varying(50) NOT NULL,
    "category" character varying(50),
    "description" "text",
    "uploaded_by" "uuid" NOT NULL,
    "uploaded_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "attachment_phase_ref" CHECK ((("project_phase_id" IS NOT NULL) OR ("project_sub_phase_id" IS NOT NULL)))
);


ALTER TABLE "public"."project_phase_attachments" OWNER TO "postgres";


COMMENT ON TABLE "public"."project_phase_attachments" IS 'Files and documents attached to phases/sub-phases';



CREATE TABLE IF NOT EXISTS "public"."project_phase_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "code" character varying(30) NOT NULL,
    "description" "text",
    "display_order" integer NOT NULL,
    "icon" character varying(50),
    "color" character varying(30),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."project_phase_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."project_phase_categories" IS 'System-level phase categories (Pre-Project, Design, Site Work, etc.)';



CREATE TABLE IF NOT EXISTS "public"."project_phase_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "project_phase_id" "uuid",
    "project_sub_phase_id" "uuid",
    "comment_type" "public"."phase_comment_type_enum" DEFAULT 'note'::"public"."phase_comment_type_enum",
    "content" "text" NOT NULL,
    "parent_comment_id" "uuid",
    "mentioned_users" "uuid"[],
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_internal" boolean DEFAULT false,
    CONSTRAINT "comment_phase_ref" CHECK ((("project_phase_id" IS NOT NULL) OR ("project_sub_phase_id" IS NOT NULL)))
);


ALTER TABLE "public"."project_phase_comments" OWNER TO "postgres";


COMMENT ON TABLE "public"."project_phase_comments" IS 'Comments and notes on phases/sub-phases';



CREATE TABLE IF NOT EXISTS "public"."project_phase_dependencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_phase_id" "uuid" NOT NULL,
    "depends_on_phase_id" "uuid" NOT NULL,
    "dependency_type" "public"."phase_dependency_type_enum" DEFAULT 'soft'::"public"."phase_dependency_type_enum",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "project_phase_dependencies_check" CHECK (("project_phase_id" <> "depends_on_phase_id"))
);


ALTER TABLE "public"."project_phase_dependencies" OWNER TO "postgres";


COMMENT ON TABLE "public"."project_phase_dependencies" IS 'Dependencies between phases (hard=blocking, soft=warning)';



CREATE TABLE IF NOT EXISTS "public"."project_phase_dependency_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "phase_template_id" "uuid" NOT NULL,
    "depends_on_phase_template_id" "uuid" NOT NULL,
    "dependency_type" "public"."phase_dependency_type_enum" DEFAULT 'soft'::"public"."phase_dependency_type_enum",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "project_phase_dependency_templates_check" CHECK (("phase_template_id" <> "depends_on_phase_template_id"))
);


ALTER TABLE "public"."project_phase_dependency_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_phase_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "name" character varying(100) NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0,
    "applicable_to" "text"[] DEFAULT ARRAY['both'::"text"],
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."project_phase_groups" OWNER TO "postgres";


COMMENT ON TABLE "public"."project_phase_groups" IS 'Groups phases into workflow stages for visualization';



CREATE TABLE IF NOT EXISTS "public"."project_phase_status_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phase_id" "uuid",
    "sub_phase_id" "uuid",
    "previous_status" character varying(30),
    "new_status" character varying(30) NOT NULL,
    "notes" "text" NOT NULL,
    "changed_by" "uuid" NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "phase_or_subphase" CHECK (((("phase_id" IS NOT NULL) AND ("sub_phase_id" IS NULL)) OR (("phase_id" IS NULL) AND ("sub_phase_id" IS NOT NULL))))
);


ALTER TABLE "public"."project_phase_status_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_phase_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "category_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "code" character varying(50) NOT NULL,
    "description" "text",
    "applicable_to" "text"[] DEFAULT '{both}'::"text"[],
    "default_enabled" boolean DEFAULT true,
    "display_order" integer NOT NULL,
    "estimated_duration_days" integer,
    "is_system_template" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "phase_group_id" "uuid",
    "can_run_parallel" boolean DEFAULT false,
    "parallel_group_order" integer DEFAULT 0
);


ALTER TABLE "public"."project_phase_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."project_phase_templates" IS 'Phase templates - system defaults + tenant customizations';



CREATE TABLE IF NOT EXISTS "public"."project_sub_phases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_phase_id" "uuid" NOT NULL,
    "sub_phase_template_id" "uuid",
    "name" character varying(100) NOT NULL,
    "status" "public"."project_sub_phase_status_enum" DEFAULT 'not_started'::"public"."project_sub_phase_status_enum",
    "progress_percentage" integer DEFAULT 0,
    "progress_mode" "public"."progress_mode_enum" DEFAULT 'auto'::"public"."progress_mode_enum",
    "assigned_to" "uuid",
    "display_order" integer NOT NULL,
    "due_date" "date",
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "action_type" "public"."sub_phase_action_type_enum" DEFAULT 'manual'::"public"."sub_phase_action_type_enum",
    "started_at" timestamp with time zone,
    "started_by" "uuid",
    "skipped" boolean DEFAULT false,
    "skip_reason" "text",
    "skipped_by" "uuid",
    "skipped_at" timestamp with time zone,
    "actual_duration_hours" numeric(10,2),
    "form_data" "jsonb",
    "planned_start_date" "date",
    "planned_end_date" "date",
    "actual_start_date" "date",
    "actual_end_date" "date",
    "estimated_duration_hours" integer,
    "estimated_hours" integer,
    "actual_hours" integer,
    CONSTRAINT "project_sub_phases_progress_percentage_check" CHECK ((("progress_percentage" >= 0) AND ("progress_percentage" <= 100)))
);


ALTER TABLE "public"."project_sub_phases" OWNER TO "postgres";


COMMENT ON TABLE "public"."project_sub_phases" IS 'Sub-phases within each project phase';



COMMENT ON COLUMN "public"."project_sub_phases"."due_date" IS 'DEPRECATED: Use planned_end_date instead';



COMMENT ON COLUMN "public"."project_sub_phases"."planned_start_date" IS 'Planned start date for this sub-phase';



COMMENT ON COLUMN "public"."project_sub_phases"."planned_end_date" IS 'Planned end date for this sub-phase';



COMMENT ON COLUMN "public"."project_sub_phases"."actual_start_date" IS 'Actual start date when work began';



COMMENT ON COLUMN "public"."project_sub_phases"."actual_end_date" IS 'Actual end date when work completed';



COMMENT ON COLUMN "public"."project_sub_phases"."estimated_duration_hours" IS 'Estimated duration in hours (allows for quick tasks)';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "email" character varying(255) NOT NULL,
    "phone" character varying(20),
    "avatar_url" "text",
    "status" "public"."user_status_enum" DEFAULT 'pending_verification'::"public"."user_status_enum" NOT NULL,
    "is_super_admin" boolean DEFAULT false,
    "email_verified_at" timestamp with time zone,
    "last_login_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" "uuid",
    "primary_tenant_id" "uuid"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."project_phases_summary" AS
 SELECT "pp"."id",
    "pp"."project_id",
    "pp"."name",
    "pp"."category_code",
    "pp"."status",
    "pp"."progress_percentage",
    "pp"."assigned_to",
    "pp"."planned_start_date",
    "pp"."planned_end_date",
    "pp"."actual_start_date",
    "pp"."actual_end_date",
    "pp"."display_order",
    "p"."project_number",
    "p"."name" AS "project_name",
    "p"."tenant_id",
    "u"."name" AS "assigned_to_name",
    ( SELECT "count"(*) AS "count"
           FROM "public"."project_sub_phases"
          WHERE ("project_sub_phases"."project_phase_id" = "pp"."id")) AS "sub_phase_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."project_sub_phases"
          WHERE (("project_sub_phases"."project_phase_id" = "pp"."id") AND ("project_sub_phases"."status" = 'completed'::"public"."project_sub_phase_status_enum"))) AS "completed_sub_phases",
    ( SELECT "array_agg"("pp2"."name") AS "array_agg"
           FROM ("public"."project_phase_dependencies" "ppd"
             JOIN "public"."project_phases" "pp2" ON (("ppd"."depends_on_phase_id" = "pp2"."id")))
          WHERE (("ppd"."project_phase_id" = "pp"."id") AND ("ppd"."dependency_type" = 'hard'::"public"."phase_dependency_type_enum") AND ("pp2"."status" <> 'completed'::"public"."project_phase_status_enum"))) AS "blocking_dependencies"
   FROM (("public"."project_phases" "pp"
     JOIN "public"."projects" "p" ON (("pp"."project_id" = "p"."id")))
     LEFT JOIN "public"."users" "u" ON (("pp"."assigned_to" = "u"."id")));


ALTER VIEW "public"."project_phases_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_sub_phase_assignees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sub_phase_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "assigned_by" "uuid"
);


ALTER TABLE "public"."project_sub_phase_assignees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_sub_phase_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "phase_template_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "display_order" integer NOT NULL,
    "is_required" boolean DEFAULT false,
    "estimated_duration_days" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "action_type" "public"."sub_phase_action_type" DEFAULT 'manual'::"public"."sub_phase_action_type",
    "required_role" character varying(50),
    "required_uploads" "text"[],
    "approval_role" character varying(50),
    "can_skip" boolean DEFAULT true,
    "skip_requires_reason" boolean DEFAULT true,
    "completion_role" character varying(50),
    "required_upload_types" "text"[],
    "allow_parallel" boolean DEFAULT false,
    "instructions" "text",
    "form_schema" "jsonb",
    "estimated_duration_hours" integer
);


ALTER TABLE "public"."project_sub_phase_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotation_changes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quotation_id" "uuid" NOT NULL,
    "entity_type" character varying(50) NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "change_type" character varying(20) NOT NULL,
    "field_name" character varying(100),
    "old_value" "jsonb",
    "new_value" "jsonb",
    "changed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quotation_changes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotation_components" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quotation_id" "uuid" NOT NULL,
    "space_id" "uuid" NOT NULL,
    "component_type_id" "uuid",
    "name" character varying(200) NOT NULL,
    "description" "text",
    "width" numeric(10,2),
    "height" numeric(10,2),
    "depth" numeric(10,2),
    "configuration" "jsonb",
    "display_order" integer DEFAULT 0,
    "subtotal" numeric(14,2) DEFAULT 0,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "variant_type_id" "uuid",
    "component_variant_id" "uuid"
);


ALTER TABLE "public"."quotation_components" OWNER TO "postgres";


COMMENT ON TABLE "public"."quotation_components" IS 'Level 2: Components/Work items within each space';



CREATE TABLE IF NOT EXISTS "public"."quotation_cost_attributes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quotation_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "attribute_type_id" "uuid",
    "name" character varying(100) NOT NULL,
    "quantity" numeric(12,4) DEFAULT 0 NOT NULL,
    "unit" character varying(20),
    "rate" numeric(12,2) DEFAULT 0 NOT NULL,
    "amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "is_auto_calculated" boolean DEFAULT false,
    "calculation_source" "text",
    "display_order" integer DEFAULT 0,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "component_id" "uuid"
);


ALTER TABLE "public"."quotation_cost_attributes" OWNER TO "postgres";


COMMENT ON TABLE "public"."quotation_cost_attributes" IS 'Level 4: Detailed cost breakdown for each material';



CREATE TABLE IF NOT EXISTS "public"."quotation_line_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quotation_id" "uuid" NOT NULL,
    "quotation_space_id" "uuid",
    "quotation_component_id" "uuid",
    "cost_item_id" "uuid",
    "name" character varying(200) NOT NULL,
    "group_name" character varying(100),
    "length" numeric(10,2),
    "width" numeric(10,2),
    "quantity" numeric(10,2),
    "unit_code" character varying(20) NOT NULL,
    "rate" numeric(12,2) DEFAULT 0 NOT NULL,
    "amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "display_order" integer DEFAULT 0,
    "notes" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "measurement_unit" character varying(10) DEFAULT 'ft'::character varying
);


ALTER TABLE "public"."quotation_line_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."quotation_line_items" IS 'Actual line items in a quotation with measurements and pricing';



COMMENT ON COLUMN "public"."quotation_line_items"."group_name" IS 'Grouping label for display (e.g., Carcass, Shutter, Hardware)';



CREATE TABLE IF NOT EXISTS "public"."quotation_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quotation_id" "uuid" NOT NULL,
    "component_id" "uuid" NOT NULL,
    "material_id" "uuid",
    "category_id" "uuid",
    "name" character varying(200) NOT NULL,
    "category_name" character varying(100),
    "specifications" "jsonb",
    "display_order" integer DEFAULT 0,
    "subtotal" numeric(14,2) DEFAULT 0,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quotation_materials" OWNER TO "postgres";


COMMENT ON TABLE "public"."quotation_materials" IS 'Level 3: Materials and specifications for each component';



CREATE TABLE IF NOT EXISTS "public"."quotation_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quotation_id" "uuid" NOT NULL,
    "version" integer NOT NULL,
    "snapshot_data" "jsonb" NOT NULL,
    "change_summary" "text",
    "changed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quotation_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotation_spaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quotation_id" "uuid" NOT NULL,
    "space_type_id" "uuid",
    "name" character varying(100) NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0,
    "subtotal" numeric(14,2) DEFAULT 0,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quotation_spaces" OWNER TO "postgres";


COMMENT ON TABLE "public"."quotation_spaces" IS 'Level 1: Spaces/Rooms in the quotation';



CREATE TABLE IF NOT EXISTS "public"."quotation_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" character varying(200) NOT NULL,
    "description" "text",
    "property_type" character varying(50),
    "quality_tier" character varying(20) DEFAULT 'standard'::character varying,
    "base_price" numeric(14,2),
    "template_data" "jsonb" NOT NULL,
    "is_active" boolean DEFAULT true,
    "is_featured" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."quotation_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "quotation_number" character varying(50) NOT NULL,
    "version" integer DEFAULT 1,
    "parent_quotation_id" "uuid",
    "lead_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "project_id" "uuid",
    "client_name" character varying(200),
    "client_email" character varying(200),
    "client_phone" character varying(20),
    "property_name" character varying(200),
    "property_address" "text",
    "property_type" character varying(50),
    "carpet_area" numeric(10,2),
    "title" character varying(300),
    "description" "text",
    "status" character varying(30) DEFAULT 'draft'::character varying,
    "valid_from" "date" DEFAULT CURRENT_DATE,
    "valid_until" "date",
    "subtotal" numeric(14,2) DEFAULT 0,
    "discount_type" character varying(20),
    "discount_value" numeric(12,2) DEFAULT 0,
    "discount_amount" numeric(14,2) DEFAULT 0,
    "taxable_amount" numeric(14,2) DEFAULT 0,
    "tax_percent" numeric(5,2) DEFAULT 18,
    "tax_amount" numeric(14,2) DEFAULT 0,
    "overhead_percent" numeric(5,2) DEFAULT 0,
    "overhead_amount" numeric(14,2) DEFAULT 0,
    "grand_total" numeric(14,2) DEFAULT 0,
    "payment_terms" "jsonb",
    "terms_and_conditions" "text",
    "notes" "text",
    "sent_at" timestamp with time zone,
    "viewed_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "rejection_reason" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "auto_created" boolean DEFAULT false,
    "presentation_level" character varying(30) DEFAULT 'space_component'::character varying,
    "hide_dimensions" boolean DEFAULT true,
    "assigned_to" "uuid"
);


ALTER TABLE "public"."quotations" OWNER TO "postgres";


COMMENT ON TABLE "public"."quotations" IS 'Main quotation header with client and pricing details';



COMMENT ON COLUMN "public"."quotations"."lead_id" IS 'Required - every quotation must be linked to a lead';



COMMENT ON COLUMN "public"."quotations"."client_name" IS 'DEPRECATED - Use leads.client_name instead. Kept for backward compatibility.';



COMMENT ON COLUMN "public"."quotations"."client_email" IS 'DEPRECATED - Use leads.email instead. Kept for backward compatibility.';



COMMENT ON COLUMN "public"."quotations"."client_phone" IS 'DEPRECATED - Use leads.phone instead. Kept for backward compatibility.';



COMMENT ON COLUMN "public"."quotations"."property_name" IS 'DEPRECATED - Use leads.property_name instead. Kept for backward compatibility.';



COMMENT ON COLUMN "public"."quotations"."property_address" IS 'DEPRECATED - Use leads.property_address instead. Kept for backward compatibility.';



COMMENT ON COLUMN "public"."quotations"."property_type" IS 'DEPRECATED - Use leads.property_type instead. Kept for backward compatibility.';



COMMENT ON COLUMN "public"."quotations"."carpet_area" IS 'DEPRECATED - Use leads.carpet_area_sqft instead. Kept for backward compatibility.';



COMMENT ON COLUMN "public"."quotations"."auto_created" IS 'True if quotation was auto-created when lead moved to proposal_discussion stage';



COMMENT ON COLUMN "public"."quotations"."presentation_level" IS 'Controls what level of detail to show customer: space_only, space_component, space_component_type, full_detail';



COMMENT ON COLUMN "public"."quotations"."hide_dimensions" IS 'Hide length/width details from customer view';



CREATE OR REPLACE VIEW "public"."quotations_with_lead" AS
 SELECT "q"."id",
    "q"."tenant_id",
    "q"."quotation_number",
    "q"."version",
    "q"."parent_quotation_id",
    "q"."lead_id",
    "q"."client_id",
    "q"."project_id",
    "q"."title",
    "q"."description",
    "q"."status",
    "q"."valid_from",
    "q"."valid_until",
    "q"."subtotal",
    "q"."discount_type",
    "q"."discount_value",
    "q"."discount_amount",
    "q"."taxable_amount",
    "q"."tax_percent",
    "q"."tax_amount",
    "q"."overhead_percent",
    "q"."overhead_amount",
    "q"."grand_total",
    "q"."payment_terms",
    "q"."terms_and_conditions",
    "q"."notes",
    "q"."sent_at",
    "q"."viewed_at",
    "q"."approved_at",
    "q"."rejected_at",
    "q"."rejection_reason",
    "q"."assigned_to",
    "q"."created_by",
    "q"."updated_by",
    "q"."created_at",
    "q"."updated_at",
    COALESCE("l"."client_name", "q"."client_name") AS "client_name",
    COALESCE("l"."email", "q"."client_email") AS "client_email",
    COALESCE("l"."phone", "q"."client_phone") AS "client_phone",
    COALESCE("l"."property_name", "q"."property_name") AS "property_name",
    COALESCE("l"."property_address", "q"."property_address") AS "property_address",
    "l"."property_city",
    "l"."property_pincode",
    "l"."flat_number",
    "l"."carpet_area_sqft",
    COALESCE(("l"."property_type")::"text", ("q"."property_type")::"text") AS "property_type",
    "l"."service_type",
    "l"."budget_range",
    "l"."estimated_value",
    "l"."lead_source",
    "l"."stage" AS "lead_stage",
    "au"."name" AS "assigned_to_name",
    "au"."email" AS "assigned_to_email",
    "au"."avatar_url" AS "assigned_to_avatar"
   FROM (("public"."quotations" "q"
     LEFT JOIN "public"."leads" "l" ON (("l"."id" = "q"."lead_id")))
     LEFT JOIN "public"."users" "au" ON (("au"."id" = "q"."assigned_to")));


ALTER VIEW "public"."quotations_with_lead" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."revenue_heads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "code" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "category" character varying(50) NOT NULL,
    "gl_account_code" character varying(50),
    "tax_applicable" boolean DEFAULT true,
    "default_tax_rate" numeric(5,2) DEFAULT 18.00,
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "revenue_heads_category_check" CHECK ((("category")::"text" = ANY ((ARRAY['design_fee'::character varying, 'material_margin'::character varying, 'execution_margin'::character varying, 'appliance_commission'::character varying, 'lighting_commission'::character varying, 'referral_commission'::character varying, 'service_charge'::character varying, 'other'::character varying])::"text"[])))
);


ALTER TABLE "public"."revenue_heads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "granted" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid",
    "name" character varying(100) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "description" "text",
    "is_system_role" boolean DEFAULT false,
    "is_default" boolean DEFAULT false,
    "hierarchy_level" integer DEFAULT 100,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."space_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "space_type_id" "uuid",
    "name" character varying(200) NOT NULL,
    "description" "text",
    "quality_tier" character varying(20) DEFAULT 'standard'::character varying,
    "base_price" numeric(14,2),
    "template_data" "jsonb" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."space_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."space_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "description" "text",
    "icon" character varying(50),
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "is_system" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."space_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_adjustment_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "adjustment_id" "uuid" NOT NULL,
    "cost_item_id" "uuid" NOT NULL,
    "system_qty" numeric(12,4) NOT NULL,
    "actual_qty" numeric(12,4) NOT NULL,
    "variance_qty" numeric(12,4) GENERATED ALWAYS AS (("actual_qty" - "system_qty")) STORED,
    "unit_code" character varying(20) NOT NULL,
    "unit_cost" numeric(12,2),
    "variance_value" numeric(14,2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stock_adjustment_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "adjustment_number" character varying(30) NOT NULL,
    "adjustment_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "location_id" "uuid" NOT NULL,
    "reason" character varying(50) NOT NULL,
    "status" character varying(20) DEFAULT 'draft'::character varying,
    "notes" "text",
    "created_by" "uuid",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stock_adjustments" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_adjustments" IS 'Manual stock adjustments (physical count, damage, etc.)';



CREATE TABLE IF NOT EXISTS "public"."stock_brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "code" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "display_name" character varying(255),
    "logo_url" "text",
    "website" character varying(255),
    "country" character varying(100) DEFAULT 'India'::character varying,
    "description" "text",
    "categories" "text"[],
    "quality_tier" character varying(20) DEFAULT 'standard'::character varying,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_preferred" boolean DEFAULT false,
    CONSTRAINT "stock_brands_quality_tier_check" CHECK ((("quality_tier")::"text" = ANY ((ARRAY['budget'::character varying, 'standard'::character varying, 'premium'::character varying, 'luxury'::character varying])::"text"[])))
);


ALTER TABLE "public"."stock_brands" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_brands" IS 'Master list of manufacturers/brands (Century, Hettich, etc.)';



CREATE TABLE IF NOT EXISTS "public"."stock_goods_receipt_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "grn_id" "uuid" NOT NULL,
    "po_item_id" "uuid" NOT NULL,
    "quantity_received" numeric(12,2) NOT NULL,
    "quantity_accepted" numeric(12,2) NOT NULL,
    "quantity_rejected" numeric(12,2) DEFAULT 0,
    "rejection_reason" "text",
    "storage_location" character varying(255),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stock_goods_receipt_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_goods_receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "grn_number" character varying(50) NOT NULL,
    "po_id" "uuid" NOT NULL,
    "received_date" "date" DEFAULT CURRENT_DATE,
    "received_by" "uuid",
    "status" character varying(30) DEFAULT 'draft'::character varying,
    "delivery_note_number" character varying(100),
    "vehicle_number" character varying(50),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "stock_goods_receipts_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['draft'::character varying, 'pending_inspection'::character varying, 'completed'::character varying, 'partial'::character varying])::"text"[])))
);


ALTER TABLE "public"."stock_goods_receipts" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_goods_receipts" IS 'Goods receipt notes for received materials';



CREATE TABLE IF NOT EXISTS "public"."stock_issue_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_id" "uuid" NOT NULL,
    "cost_item_id" "uuid" NOT NULL,
    "mr_item_id" "uuid",
    "quantity" numeric(12,4) NOT NULL,
    "unit_code" character varying(20) NOT NULL,
    "unit_cost" numeric(12,2) NOT NULL,
    "total_cost" numeric(14,2) NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stock_issue_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "issue_number" character varying(30) NOT NULL,
    "project_id" "uuid",
    "lead_id" "uuid",
    "material_requirement_id" "uuid",
    "from_location_id" "uuid" NOT NULL,
    "to_location_id" "uuid",
    "issue_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "issue_type" character varying(20) NOT NULL,
    "status" character varying(20) DEFAULT 'draft'::character varying,
    "purpose" "text",
    "notes" "text",
    "created_by" "uuid",
    "confirmed_by" "uuid",
    "confirmed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stock_issues" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_issues" IS 'Stock issues to projects/locations';



CREATE TABLE IF NOT EXISTS "public"."stock_vendor_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "vendor_sku" character varying(100),
    "vendor_item_name" character varying(255),
    "unit_price" numeric(12,2) NOT NULL,
    "currency" character varying(3) DEFAULT 'INR'::character varying,
    "price_valid_from" "date",
    "price_valid_to" "date",
    "min_order_qty" numeric(12,2) DEFAULT 1,
    "lead_time_days" integer DEFAULT 7,
    "is_preferred" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stock_vendor_materials" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_vendor_materials" IS 'Pricing from each vendor for materials they supply';



COMMENT ON COLUMN "public"."stock_vendor_materials"."is_preferred" IS 'True if this vendor is the default/preferred supplier for this material';



CREATE OR REPLACE VIEW "public"."stock_material_best_prices" AS
 SELECT DISTINCT ON ("material_id") "material_id",
    "vendor_id",
    "unit_price" AS "best_price",
    "lead_time_days",
    "min_order_qty"
   FROM "public"."stock_vendor_materials"
  WHERE ("is_active" = true)
  ORDER BY "material_id", "unit_price";


ALTER VIEW "public"."stock_material_best_prices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_material_requisition_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mr_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "quantity_requested" numeric(12,2) NOT NULL,
    "quantity_approved" numeric(12,2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stock_material_requisition_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_material_requisitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "mr_number" character varying(50) NOT NULL,
    "project_id" "uuid",
    "requested_by" "uuid",
    "approved_by" "uuid",
    "required_date" "date",
    "priority" character varying(20) DEFAULT 'normal'::character varying,
    "status" character varying(30) DEFAULT 'draft'::character varying,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "stock_material_requisitions_priority_check" CHECK ((("priority")::"text" = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::"text"[]))),
    CONSTRAINT "stock_material_requisitions_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['draft'::character varying, 'submitted'::character varying, 'approved'::character varying, 'partially_approved'::character varying, 'rejected'::character varying, 'fulfilled'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."stock_material_requisitions" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_material_requisitions" IS 'Material requirement requests from projects';



CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "movement_type" character varying(30) NOT NULL,
    "quantity" numeric(12,2) NOT NULL,
    "reference_type" character varying(50),
    "reference_id" "uuid",
    "from_location" character varying(255),
    "to_location" character varying(255),
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "project_id" "uuid",
    CONSTRAINT "stock_movements_movement_type_check" CHECK ((("movement_type")::"text" = ANY ((ARRAY['purchase_receipt'::character varying, 'purchase_return'::character varying, 'issue_to_project'::character varying, 'return_from_project'::character varying, 'transfer'::character varying, 'adjustment_in'::character varying, 'adjustment_out'::character varying, 'opening_stock'::character varying])::"text"[])))
);


ALTER TABLE "public"."stock_movements" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_movements" IS 'Track all inventory movements';



CREATE TABLE IF NOT EXISTS "public"."stock_vendor_brands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "brand_id" "uuid" NOT NULL,
    "is_authorized_dealer" boolean DEFAULT false,
    "discount_percent" numeric(5,2) DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stock_vendor_brands" OWNER TO "postgres";


COMMENT ON TABLE "public"."stock_vendor_brands" IS 'Which brands each vendor is authorized to supply';



COMMENT ON COLUMN "public"."stock_vendor_brands"."is_authorized_dealer" IS 'True if vendor is an official authorized dealer for this brand';



CREATE TABLE IF NOT EXISTS "public"."sub_phase_completion_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_sub_phase_id" "uuid" NOT NULL,
    "requirement_type" character varying(50) NOT NULL,
    "requirement_key" character varying(100) NOT NULL,
    "requirement_label" character varying(255),
    "is_required" boolean DEFAULT true,
    "is_satisfied" boolean DEFAULT false,
    "satisfied_at" timestamp with time zone,
    "satisfied_by" "uuid",
    "reference_type" character varying(50),
    "reference_id" "uuid"
);


ALTER TABLE "public"."sub_phase_completion_requirements" OWNER TO "postgres";


COMMENT ON TABLE "public"."sub_phase_completion_requirements" IS 'Requirements that must be met to complete a sub-phase';



CREATE TABLE IF NOT EXISTS "public"."subscription_addons" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "addon_key" character varying(100) NOT NULL,
    "addon_name" character varying(255) NOT NULL,
    "quantity" integer DEFAULT 1,
    "price" numeric(10,2) NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."subscription_addons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_change_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "change_type" "public"."plan_change_type_enum" NOT NULL,
    "from_plan_id" "uuid",
    "to_plan_id" "uuid",
    "requested_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "effective_at" timestamp with time zone,
    "processed_at" timestamp with time zone,
    "status" "public"."plan_change_status_enum" DEFAULT 'pending'::"public"."plan_change_status_enum" NOT NULL,
    "proration_amount" integer,
    "requested_by" "uuid",
    "reason" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."subscription_change_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_invoices" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "invoice_number" character varying(50) NOT NULL,
    "description" "text",
    "subtotal" integer DEFAULT 0 NOT NULL,
    "tax_amount" integer DEFAULT 0 NOT NULL,
    "discount_amount" integer DEFAULT 0 NOT NULL,
    "total_amount" integer DEFAULT 0 NOT NULL,
    "currency" character(3) DEFAULT 'INR'::"bpchar" NOT NULL,
    "status" "public"."invoice_status_enum" DEFAULT 'pending'::"public"."invoice_status_enum" NOT NULL,
    "period_start" timestamp with time zone,
    "period_end" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "payment_method" character varying(50),
    "payment_provider" character varying(50),
    "payment_provider_invoice_id" character varying(255),
    "invoice_pdf_url" "text",
    "due_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."subscription_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_plan_features" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "feature_key" character varying(100) NOT NULL,
    "feature_name" character varying(255) NOT NULL,
    "included" boolean DEFAULT true,
    "limit_value" integer,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."subscription_plan_features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_plans" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "tenant_type" "public"."tenant_type_enum" NOT NULL,
    "description" "text",
    "price_monthly" numeric(10,2) DEFAULT 0 NOT NULL,
    "price_yearly" numeric(10,2) DEFAULT 0 NOT NULL,
    "max_users" integer DEFAULT 5 NOT NULL,
    "max_projects" integer,
    "max_storage_gb" numeric(10,2) DEFAULT 10 NOT NULL,
    "is_active" boolean DEFAULT true,
    "is_featured" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."subscription_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_config" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "config_key" character varying(100) NOT NULL,
    "config_value" "jsonb" NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_by" "text"
);


ALTER TABLE "public"."system_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_config" IS 'System-wide configuration. Changes only affect new signups.';



CREATE TABLE IF NOT EXISTS "public"."task_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "activity_type" character varying(50) NOT NULL,
    "field_name" character varying(100),
    "old_value" "text",
    "new_value" "text",
    "description" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."task_activities" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_activities" IS 'Activity log for task changes';



CREATE TABLE IF NOT EXISTS "public"."task_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "file_name" character varying(255) NOT NULL,
    "file_url" "text" NOT NULL,
    "file_size" integer,
    "file_type" character varying(100),
    "uploaded_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."task_attachments" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_attachments" IS 'File attachments on tasks';



CREATE TABLE IF NOT EXISTS "public"."task_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "parent_comment_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "updated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."task_comments" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_comments" IS 'Comments/discussion on tasks';



CREATE TABLE IF NOT EXISTS "public"."task_tag_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."task_tag_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" character varying(50) NOT NULL,
    "color" character varying(7) DEFAULT '#6B7280'::character varying,
    "description" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."task_tags" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_tags" IS 'Custom tags for task categorization';



CREATE TABLE IF NOT EXISTS "public"."task_template_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "parent_item_id" "uuid",
    "title" character varying(255) NOT NULL,
    "description" "text",
    "priority" "public"."task_priority" DEFAULT 'medium'::"public"."task_priority",
    "relative_due_days" integer,
    "estimated_hours" numeric(6,2),
    "assign_to_role" character varying(100),
    "assign_to_user_id" "uuid",
    "sort_order" integer DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."task_template_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_template_items" IS 'Individual task items within a template';



COMMENT ON COLUMN "public"."task_template_items"."relative_due_days" IS 'Due date as days offset from template trigger date';



CREATE TABLE IF NOT EXISTS "public"."task_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "category" "public"."task_template_category" DEFAULT 'general'::"public"."task_template_category" NOT NULL,
    "is_active" boolean DEFAULT true,
    "is_protected" boolean DEFAULT false,
    "default_priority" "public"."task_priority" DEFAULT 'medium'::"public"."task_priority",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."task_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_templates" IS 'Reusable task templates with protected categories';



COMMENT ON COLUMN "public"."task_templates"."is_protected" IS 'Protected templates can only be modified by users with manage_protected permission';



CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "task_number" character varying(20) NOT NULL,
    "parent_task_id" "uuid",
    "template_id" "uuid",
    "template_item_id" "uuid",
    "is_from_template" boolean DEFAULT false,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "priority" "public"."task_priority" DEFAULT 'medium'::"public"."task_priority",
    "status" "public"."task_status" DEFAULT 'todo'::"public"."task_status",
    "start_date" "date",
    "due_date" "date",
    "completed_at" timestamp with time zone,
    "estimated_hours" numeric(6,2),
    "actual_hours" numeric(6,2),
    "assigned_to" "uuid",
    "related_type" "public"."task_related_type",
    "related_id" "uuid",
    "is_recurring" boolean DEFAULT false,
    "recurrence_rule" "text",
    "recurrence_end_date" "date",
    "created_by" "uuid",
    "updated_by" "uuid",
    "completed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."tasks" IS 'Main tasks table supporting hierarchical tasks, templates, and cross-module linking';



COMMENT ON COLUMN "public"."tasks"."is_from_template" IS 'True if task was created from a template (restricts editing based on permissions)';



CREATE OR REPLACE VIEW "public"."tasks_with_details" AS
 SELECT "t"."id",
    "t"."tenant_id",
    "t"."task_number",
    "t"."parent_task_id",
    "t"."template_id",
    "t"."template_item_id",
    "t"."is_from_template",
    "t"."title",
    "t"."description",
    "t"."priority",
    "t"."status",
    "t"."start_date",
    "t"."due_date",
    "t"."completed_at",
    "t"."estimated_hours",
    "t"."actual_hours",
    "t"."assigned_to",
    "t"."related_type",
    "t"."related_id",
    "t"."is_recurring",
    "t"."recurrence_rule",
    "t"."recurrence_end_date",
    "t"."created_by",
    "t"."updated_by",
    "t"."completed_by",
    "t"."created_at",
    "t"."updated_at",
    "au"."name" AS "assigned_to_name",
    "au"."email" AS "assigned_to_email",
    "au"."avatar_url" AS "assigned_to_avatar",
    "cu"."name" AS "created_by_name",
    "cu"."email" AS "created_by_email",
    "cbu"."name" AS "completed_by_name",
    "tt"."name" AS "template_name",
    "tt"."category" AS "template_category",
    ( SELECT "count"(*) AS "count"
           FROM "public"."tasks" "st"
          WHERE ("st"."parent_task_id" = "t"."id")) AS "subtask_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."tasks" "st"
          WHERE (("st"."parent_task_id" = "t"."id") AND ("st"."status" = 'completed'::"public"."task_status"))) AS "completed_subtask_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."task_comments" "tc"
          WHERE (("tc"."task_id" = "t"."id") AND ("tc"."is_deleted" = false))) AS "comment_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."task_attachments" "ta"
          WHERE ("ta"."task_id" = "t"."id")) AS "attachment_count"
   FROM (((("public"."tasks" "t"
     LEFT JOIN "public"."users" "au" ON (("au"."id" = "t"."assigned_to")))
     LEFT JOIN "public"."users" "cu" ON (("cu"."id" = "t"."created_by")))
     LEFT JOIN "public"."users" "cbu" ON (("cbu"."id" = "t"."completed_by")))
     LEFT JOIN "public"."task_templates" "tt" ON (("tt"."id" = "t"."template_id")));


ALTER VIEW "public"."tasks_with_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."template_line_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "space_type_id" "uuid",
    "component_type_id" "uuid",
    "component_variant_id" "uuid",
    "cost_item_id" "uuid" NOT NULL,
    "group_name" character varying(100),
    "rate" numeric(12,2),
    "display_order" integer DEFAULT 0,
    "notes" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "measurement_unit" character varying(10) DEFAULT 'ft'::character varying
);


ALTER TABLE "public"."template_line_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."template_line_items" IS 'Cost items in a template with optional hierarchy context';



CREATE TABLE IF NOT EXISTS "public"."template_spaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "space_type_id" "uuid" NOT NULL,
    "default_name" character varying(100),
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."template_spaces" OWNER TO "postgres";


COMMENT ON TABLE "public"."template_spaces" IS 'Pre-defined space instances in a template';



CREATE TABLE IF NOT EXISTS "public"."tenant_lead_settings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "lead_number_prefix" character varying(10) DEFAULT 'LD'::character varying,
    "lead_number_next" integer DEFAULT 1,
    "require_won_approval" boolean DEFAULT false,
    "won_approval_roles" "uuid"[],
    "default_assignment" character varying(20) DEFAULT 'creator'::character varying,
    "stage_colors" "jsonb" DEFAULT '{"new": "#8B5CF6", "won": "#10B981", "lost": "#EF4444", "qualified": "#3B82F6", "negotiation": "#F97316", "disqualified": "#6B7280", "proposal_discussion": "#F59E0B", "requirement_discussion": "#06B6D4"}'::"jsonb",
    "auto_followup_days" integer DEFAULT 3,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tenant_lead_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenant_lead_settings" IS 'Per-tenant configuration for leads module';



CREATE TABLE IF NOT EXISTS "public"."tenant_payment_methods" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "provider" character varying(50) NOT NULL,
    "provider_customer_id" character varying(255),
    "provider_payment_method_id" character varying(255),
    "card_brand" character varying(20),
    "card_last_four" character varying(4),
    "card_exp_month" integer,
    "card_exp_year" integer,
    "is_default" boolean DEFAULT false,
    "is_valid" boolean DEFAULT true,
    "billing_name" character varying(255),
    "billing_email" character varying(255),
    "billing_address_line1" "text",
    "billing_address_line2" "text",
    "billing_city" character varying(100),
    "billing_state" character varying(100),
    "billing_postal_code" character varying(20),
    "billing_country" character(2) DEFAULT 'IN'::"bpchar",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tenant_payment_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_settings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "timezone" character varying(50) DEFAULT 'UTC'::character varying,
    "date_format" character varying(20) DEFAULT 'YYYY-MM-DD'::character varying,
    "currency" character(3) DEFAULT 'INR'::"bpchar",
    "language" character(2) DEFAULT 'en'::"bpchar",
    "business_hours" "jsonb",
    "notifications_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "auto_create_project_on_won" boolean DEFAULT true,
    "require_quotation_for_project" boolean DEFAULT false
);


ALTER TABLE "public"."tenant_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_stock_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "po_requires_approval" boolean DEFAULT false,
    "po_approval_threshold" numeric(14,2) DEFAULT 0,
    "po_number_prefix" character varying(10) DEFAULT 'PO'::character varying,
    "po_auto_number" boolean DEFAULT true,
    "grn_number_prefix" character varying(10) DEFAULT 'GRN'::character varying,
    "grn_auto_number" boolean DEFAULT true,
    "allow_over_receipt" boolean DEFAULT false,
    "over_receipt_tolerance" numeric(5,2) DEFAULT 0,
    "issue_number_prefix" character varying(10) DEFAULT 'ISS'::character varying,
    "issue_auto_number" boolean DEFAULT true,
    "mr_number_prefix" character varying(10) DEFAULT 'MR'::character varying,
    "mr_auto_number" boolean DEFAULT true,
    "allow_negative_stock" boolean DEFAULT false,
    "stock_valuation_method" character varying(20) DEFAULT 'avg_cost'::character varying,
    "default_warehouse_id" "uuid",
    "default_tax_percent" numeric(5,2) DEFAULT 18,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tenant_stock_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenant_stock_settings" IS 'Per-tenant configuration for stock module';



CREATE TABLE IF NOT EXISTS "public"."tenant_subscriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "public"."subscription_status_enum" DEFAULT 'trial'::"public"."subscription_status_enum" NOT NULL,
    "billing_cycle" "public"."billing_cycle_enum" DEFAULT 'monthly'::"public"."billing_cycle_enum" NOT NULL,
    "is_trial" boolean DEFAULT false,
    "trial_start_date" timestamp with time zone,
    "trial_end_date" timestamp with time zone,
    "current_period_start" timestamp with time zone NOT NULL,
    "current_period_end" timestamp with time zone NOT NULL,
    "cancelled_at" timestamp with time zone,
    "cancellation_reason" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "trial_days_granted" integer DEFAULT 0,
    "subscription_start_date" timestamp with time zone,
    "subscription_end_date" timestamp with time zone,
    "grace_period_days" integer DEFAULT 7,
    "grace_period_end" timestamp with time zone,
    "auto_renew" boolean DEFAULT true,
    "next_billing_date" timestamp with time zone,
    "last_payment_date" timestamp with time zone,
    "last_payment_amount" numeric(10,2),
    "cancellation_effective_date" timestamp with time zone
);


ALTER TABLE "public"."tenant_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_usage" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "current_users" integer DEFAULT 0 NOT NULL,
    "current_projects" integer DEFAULT 0 NOT NULL,
    "active_projects" integer DEFAULT 0 NOT NULL,
    "storage_used_bytes" bigint DEFAULT 0 NOT NULL,
    "documents_count" integer DEFAULT 0 NOT NULL,
    "clients_count" integer DEFAULT 0 NOT NULL,
    "quotations_this_month" integer DEFAULT 0 NOT NULL,
    "invoices_this_month" integer DEFAULT 0 NOT NULL,
    "last_calculated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tenant_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_usage_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "users_count" integer DEFAULT 0 NOT NULL,
    "projects_count" integer DEFAULT 0 NOT NULL,
    "storage_bytes" bigint DEFAULT 0 NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "snapshot_type" character varying(20) DEFAULT 'daily'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tenant_usage_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "joined_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "invited_by" "uuid",
    "removed_at" timestamp with time zone,
    "removed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."tenant_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_type" "public"."tenant_type_enum" NOT NULL,
    "company_name" character varying(255) NOT NULL,
    "company_registration_number" character varying(100),
    "email" character varying(255) NOT NULL,
    "phone" character varying(20),
    "country_code" character(2),
    "address_line1" "text",
    "address_line2" "text",
    "city" character varying(100),
    "state" character varying(100),
    "postal_code" character varying(20),
    "logo_url" "text",
    "subscription_plan_id" "uuid",
    "status" "public"."tenant_status_enum" DEFAULT 'trial'::"public"."tenant_status_enum" NOT NULL,
    "onboarding_completed" boolean DEFAULT false,
    "onboarding_step" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" "uuid",
    "gst_number" character varying(20)
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."units" (
    "code" character varying(20) NOT NULL,
    "name" character varying(50) NOT NULL,
    "calculation_type" character varying(20) NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."units" OWNER TO "postgres";


COMMENT ON TABLE "public"."units" IS 'Measurement units with calculation type (area, length, quantity, fixed)';



CREATE TABLE IF NOT EXISTS "public"."user_invitations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "invited_by_user_id" "uuid" NOT NULL,
    "role_id" "uuid",
    "token" character varying(500) NOT NULL,
    "status" "public"."invitation_status_enum" DEFAULT 'pending'::"public"."invitation_status_enum" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."user_invitations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_invitations"."metadata" IS 'Stores additional invitation data like role_ids array for multi-role support, first_name, last_name, designation';



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_user_id" "uuid"
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_sessions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_token" character varying(500),
    "ip_address" "inet",
    "user_agent" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."user_sessions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_project_lead_activities" AS
 SELECT "p"."id" AS "project_id",
    "p"."project_number",
    "la"."id" AS "activity_id",
    "la"."activity_type",
    "la"."title",
    "la"."description",
    "la"."meeting_notes",
    "la"."created_at",
    "u"."name" AS "created_by_name",
    "u"."avatar_url" AS "created_by_avatar"
   FROM ((("public"."projects" "p"
     JOIN "public"."leads" "l" ON (("p"."converted_from_lead_id" = "l"."id")))
     JOIN "public"."lead_activities" "la" ON (("la"."lead_id" = "l"."id")))
     LEFT JOIN "public"."users" "u" ON (("la"."created_by" = "u"."id")))
  ORDER BY "la"."created_at" DESC;


ALTER VIEW "public"."v_project_lead_activities" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_project_lead_activities" IS 'View of all lead activities for projects created from leads';



CREATE OR REPLACE VIEW "public"."v_project_lead_details" AS
 SELECT "p"."id" AS "project_id",
    "p"."project_number",
    "p"."name" AS "project_name",
    "p"."converted_from_lead_id",
    "l"."lead_number",
    "l"."client_name" AS "lead_client_name",
    "l"."phone" AS "lead_phone",
    "l"."email" AS "lead_email",
    "l"."lead_source",
    "l"."lead_source_detail",
    "l"."assigned_to" AS "lead_sales_rep_id",
    "sales_rep"."name" AS "lead_sales_rep_name",
    "l"."property_type",
    "l"."property_name" AS "lead_property_name",
    "l"."flat_number" AS "lead_flat_number",
    "l"."property_address" AS "lead_property_address",
    "l"."property_city" AS "lead_property_city",
    "l"."property_pincode" AS "lead_property_pincode",
    "l"."carpet_area_sqft" AS "lead_carpet_area",
    "l"."budget_range" AS "lead_budget_range",
    "l"."estimated_value" AS "lead_estimated_value",
    "l"."won_amount" AS "lead_won_amount",
    "l"."service_type" AS "lead_service_type",
    "l"."project_scope" AS "lead_project_scope",
    "l"."special_requirements" AS "lead_special_requirements",
    "l"."target_start_date" AS "lead_target_start",
    "l"."target_end_date" AS "lead_target_end",
    "l"."expected_project_start" AS "lead_expected_start",
    "l"."contract_signed_date" AS "lead_contract_signed",
    "l"."created_at" AS "lead_created_at",
    "l"."stage_changed_at" AS "lead_stage_changed_at",
    "l"."won_at" AS "lead_won_at",
        CASE
            WHEN (("l"."won_at" IS NOT NULL) AND ("l"."created_at" IS NOT NULL)) THEN (EXTRACT(day FROM ("l"."won_at" - "l"."created_at")))::integer
            ELSE NULL::integer
        END AS "lead_duration_days"
   FROM (("public"."projects" "p"
     LEFT JOIN "public"."leads" "l" ON (("p"."converted_from_lead_id" = "l"."id")))
     LEFT JOIN "public"."users" "sales_rep" ON (("l"."assigned_to" = "sales_rep"."id")));


ALTER VIEW "public"."v_project_lead_details" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_project_lead_details" IS 'View combining project with its original lead details for reporting';



CREATE OR REPLACE VIEW "public"."vendors" AS
 SELECT "id",
    "tenant_id",
    "code",
    "name",
    "display_name",
    "contact_person",
    "email",
    "phone",
    "alternate_phone",
    "website",
    "address_line1",
    "address_line2",
    "city",
    "state",
    "pincode",
    "country",
    "gst_number",
    "pan_number",
    "payment_terms",
    "credit_days",
    "credit_limit",
    "category_ids",
    "bank_name",
    "bank_account_number",
    "bank_ifsc",
    "is_active",
    "rating",
    "notes",
    "created_by",
    "created_at",
    "updated_at"
   FROM "public"."stock_vendors";


ALTER VIEW "public"."vendors" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_configs"
    ADD CONSTRAINT "approval_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approval_configs"
    ADD CONSTRAINT "approval_configs_tenant_id_config_type_key" UNIQUE ("tenant_id", "config_type");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commission_items"
    ADD CONSTRAINT "commission_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."component_templates"
    ADD CONSTRAINT "component_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."component_types"
    ADD CONSTRAINT "component_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."component_types"
    ADD CONSTRAINT "component_types_tenant_id_slug_key" UNIQUE ("tenant_id", "slug");



ALTER TABLE ONLY "public"."component_variant_types"
    ADD CONSTRAINT "component_variant_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."component_variant_types"
    ADD CONSTRAINT "component_variant_types_tenant_id_component_type_id_slug_key" UNIQUE ("tenant_id", "component_type_id", "slug");



ALTER TABLE ONLY "public"."component_variants"
    ADD CONSTRAINT "component_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."component_variants"
    ADD CONSTRAINT "component_variants_tenant_id_component_type_id_slug_key" UNIQUE ("tenant_id", "component_type_id", "slug");



ALTER TABLE ONLY "public"."cost_attribute_types"
    ADD CONSTRAINT "cost_attribute_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cost_attribute_types"
    ADD CONSTRAINT "cost_attribute_types_tenant_id_slug_key" UNIQUE ("tenant_id", "slug");



ALTER TABLE ONLY "public"."cost_item_categories"
    ADD CONSTRAINT "cost_item_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cost_item_categories"
    ADD CONSTRAINT "cost_item_categories_tenant_id_slug_key" UNIQUE ("tenant_id", "slug");



ALTER TABLE ONLY "public"."cost_items"
    ADD CONSTRAINT "cost_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cost_items"
    ADD CONSTRAINT "cost_items_tenant_id_slug_key" UNIQUE ("tenant_id", "slug");



ALTER TABLE ONLY "public"."email_verification_tokens"
    ADD CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_verification_tokens"
    ADD CONSTRAINT "email_verification_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."goods_receipt_items"
    ADD CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goods_receipts"
    ADD CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goods_receipts"
    ADD CONSTRAINT "goods_receipts_tenant_id_grn_number_key" UNIQUE ("tenant_id", "grn_number");



ALTER TABLE ONLY "public"."lead_activities"
    ADD CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_documents"
    ADD CONSTRAINT "lead_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_family_members"
    ADD CONSTRAINT "lead_family_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_notes"
    ADD CONSTRAINT "lead_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_stage_history"
    ADD CONSTRAINT "lead_stage_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_tasks"
    ADD CONSTRAINT "lead_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_won_requests"
    ADD CONSTRAINT "lead_won_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_categories"
    ADD CONSTRAINT "material_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_categories"
    ADD CONSTRAINT "material_categories_tenant_id_slug_key" UNIQUE ("tenant_id", "slug");



ALTER TABLE ONLY "public"."material_presets"
    ADD CONSTRAINT "material_presets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ownership_transfers"
    ADD CONSTRAINT "ownership_transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ownership_transfers"
    ADD CONSTRAINT "ownership_transfers_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."po_approval_history"
    ADD CONSTRAINT "po_approval_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."po_payments"
    ADD CONSTRAINT "po_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_rules"
    ADD CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_checklist_items"
    ADD CONSTRAINT "project_checklist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_payment_milestone_templates"
    ADD CONSTRAINT "project_payment_milestone_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_payment_milestones"
    ADD CONSTRAINT "project_payment_milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_phase_activity_log"
    ADD CONSTRAINT "project_phase_activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_phase_approvals"
    ADD CONSTRAINT "project_phase_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_phase_attachments"
    ADD CONSTRAINT "project_phase_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_phase_categories"
    ADD CONSTRAINT "project_phase_categories_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."project_phase_categories"
    ADD CONSTRAINT "project_phase_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_phase_comments"
    ADD CONSTRAINT "project_phase_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_phase_dependencies"
    ADD CONSTRAINT "project_phase_dependencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_phase_dependencies"
    ADD CONSTRAINT "project_phase_dependencies_project_phase_id_depends_on_phas_key" UNIQUE ("project_phase_id", "depends_on_phase_id");



ALTER TABLE ONLY "public"."project_phase_dependency_templates"
    ADD CONSTRAINT "project_phase_dependency_temp_phase_template_id_depends_on__key" UNIQUE ("phase_template_id", "depends_on_phase_template_id");



ALTER TABLE ONLY "public"."project_phase_dependency_templates"
    ADD CONSTRAINT "project_phase_dependency_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_phase_groups"
    ADD CONSTRAINT "project_phase_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_phase_status_logs"
    ADD CONSTRAINT "project_phase_status_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_phase_templates"
    ADD CONSTRAINT "project_phase_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_phase_templates"
    ADD CONSTRAINT "project_phase_templates_tenant_id_code_key" UNIQUE ("tenant_id", "code");



ALTER TABLE ONLY "public"."project_phases"
    ADD CONSTRAINT "project_phases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_sub_phase_assignees"
    ADD CONSTRAINT "project_sub_phase_assignees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_sub_phase_assignees"
    ADD CONSTRAINT "project_sub_phase_assignees_sub_phase_id_user_id_key" UNIQUE ("sub_phase_id", "user_id");



ALTER TABLE ONLY "public"."project_sub_phase_templates"
    ADD CONSTRAINT "project_sub_phase_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_sub_phases"
    ADD CONSTRAINT "project_sub_phases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_tenant_id_project_number_key" UNIQUE ("tenant_id", "project_number");



ALTER TABLE ONLY "public"."quotation_changes"
    ADD CONSTRAINT "quotation_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_components"
    ADD CONSTRAINT "quotation_components_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_cost_attributes"
    ADD CONSTRAINT "quotation_cost_attributes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_line_items"
    ADD CONSTRAINT "quotation_line_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_materials"
    ADD CONSTRAINT "quotation_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_snapshots"
    ADD CONSTRAINT "quotation_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_spaces"
    ADD CONSTRAINT "quotation_spaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotation_templates"
    ADD CONSTRAINT "quotation_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_tenant_id_quotation_number_version_key" UNIQUE ("tenant_id", "quotation_number", "version");



ALTER TABLE ONLY "public"."revenue_heads"
    ADD CONSTRAINT "revenue_heads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."revenue_heads"
    ADD CONSTRAINT "revenue_heads_tenant_id_code_key" UNIQUE ("tenant_id", "code");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."space_templates"
    ADD CONSTRAINT "space_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."space_types"
    ADD CONSTRAINT "space_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."space_types"
    ADD CONSTRAINT "space_types_tenant_id_slug_key" UNIQUE ("tenant_id", "slug");



ALTER TABLE ONLY "public"."stock_adjustment_items"
    ADD CONSTRAINT "stock_adjustment_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_tenant_id_adjustment_number_key" UNIQUE ("tenant_id", "adjustment_number");



ALTER TABLE ONLY "public"."stock_brands"
    ADD CONSTRAINT "stock_brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_brands"
    ADD CONSTRAINT "stock_brands_tenant_id_code_key" UNIQUE ("tenant_id", "code");



ALTER TABLE ONLY "public"."stock_goods_receipt_items"
    ADD CONSTRAINT "stock_goods_receipt_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_goods_receipts"
    ADD CONSTRAINT "stock_goods_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_goods_receipts"
    ADD CONSTRAINT "stock_goods_receipts_tenant_id_grn_number_key" UNIQUE ("tenant_id", "grn_number");



ALTER TABLE ONLY "public"."stock_issue_items"
    ADD CONSTRAINT "stock_issue_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_issues"
    ADD CONSTRAINT "stock_issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_issues"
    ADD CONSTRAINT "stock_issues_tenant_id_issue_number_key" UNIQUE ("tenant_id", "issue_number");



ALTER TABLE ONLY "public"."stock_material_requisition_items"
    ADD CONSTRAINT "stock_material_requisition_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_material_requisitions"
    ADD CONSTRAINT "stock_material_requisitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_material_requisitions"
    ADD CONSTRAINT "stock_material_requisitions_tenant_id_mr_number_key" UNIQUE ("tenant_id", "mr_number");



ALTER TABLE ONLY "public"."stock_materials"
    ADD CONSTRAINT "stock_materials_company_id_sku_key" UNIQUE ("company_id", "sku");



ALTER TABLE ONLY "public"."stock_materials"
    ADD CONSTRAINT "stock_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_purchase_order_items"
    ADD CONSTRAINT "stock_purchase_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_purchase_orders"
    ADD CONSTRAINT "stock_purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_purchase_orders"
    ADD CONSTRAINT "stock_purchase_orders_tenant_id_po_number_key" UNIQUE ("tenant_id", "po_number");



ALTER TABLE ONLY "public"."stock_vendor_brands"
    ADD CONSTRAINT "stock_vendor_brands_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_vendor_brands"
    ADD CONSTRAINT "stock_vendor_brands_vendor_id_brand_id_key" UNIQUE ("vendor_id", "brand_id");



ALTER TABLE ONLY "public"."stock_vendor_materials"
    ADD CONSTRAINT "stock_vendor_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_vendor_materials"
    ADD CONSTRAINT "stock_vendor_materials_vendor_id_material_id_key" UNIQUE ("vendor_id", "material_id");



ALTER TABLE ONLY "public"."stock_vendors"
    ADD CONSTRAINT "stock_vendors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_vendors"
    ADD CONSTRAINT "stock_vendors_tenant_id_code_key" UNIQUE ("tenant_id", "code");



ALTER TABLE ONLY "public"."sub_phase_completion_requirements"
    ADD CONSTRAINT "sub_phase_completion_requirem_project_sub_phase_id_requirem_key" UNIQUE ("project_sub_phase_id", "requirement_type", "requirement_key");



ALTER TABLE ONLY "public"."sub_phase_completion_requirements"
    ADD CONSTRAINT "sub_phase_completion_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_addons"
    ADD CONSTRAINT "subscription_addons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_change_requests"
    ADD CONSTRAINT "subscription_change_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_invoices"
    ADD CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_plan_features"
    ADD CONSTRAINT "subscription_plan_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_config"
    ADD CONSTRAINT "system_config_config_key_key" UNIQUE ("config_key");



ALTER TABLE ONLY "public"."system_config"
    ADD CONSTRAINT "system_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_activities"
    ADD CONSTRAINT "task_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_attachments"
    ADD CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_tag_assignments"
    ADD CONSTRAINT "task_tag_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_tags"
    ADD CONSTRAINT "task_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_template_items"
    ADD CONSTRAINT "task_template_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_templates"
    ADD CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_line_items"
    ADD CONSTRAINT "template_line_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_spaces"
    ADD CONSTRAINT "template_spaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_lead_settings"
    ADD CONSTRAINT "tenant_lead_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_lead_settings"
    ADD CONSTRAINT "tenant_lead_settings_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."tenant_payment_methods"
    ADD CONSTRAINT "tenant_payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_settings"
    ADD CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_settings"
    ADD CONSTRAINT "tenant_settings_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."tenant_stock_settings"
    ADD CONSTRAINT "tenant_stock_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_stock_settings"
    ADD CONSTRAINT "tenant_stock_settings_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."tenant_subscriptions"
    ADD CONSTRAINT "tenant_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_subscriptions"
    ADD CONSTRAINT "tenant_subscriptions_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."tenant_usage_history"
    ADD CONSTRAINT "tenant_usage_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_usage"
    ADD CONSTRAINT "tenant_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_usage"
    ADD CONSTRAINT "tenant_usage_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "unique_email_per_tenant" UNIQUE ("tenant_id", "email");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "unique_lead_number_per_tenant" UNIQUE ("tenant_id", "lead_number");



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "unique_pending_invitation" UNIQUE ("tenant_id", "email", "status");



ALTER TABLE ONLY "public"."ownership_transfers"
    ADD CONSTRAINT "unique_pending_transfer" UNIQUE ("tenant_id", "status");



ALTER TABLE ONLY "public"."subscription_plan_features"
    ADD CONSTRAINT "unique_plan_feature" UNIQUE ("plan_id", "feature_key");



ALTER TABLE ONLY "public"."subscription_plans"
    ADD CONSTRAINT "unique_plan_slug_per_type" UNIQUE ("tenant_type", "slug");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "unique_role_permission" UNIQUE ("role_id", "permission_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "unique_role_slug_per_tenant" UNIQUE ("tenant_id", "slug");



ALTER TABLE ONLY "public"."task_tags"
    ADD CONSTRAINT "unique_tag_name_per_tenant" UNIQUE ("tenant_id", "name");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "unique_task_number_per_tenant" UNIQUE ("tenant_id", "task_number");



ALTER TABLE ONLY "public"."task_tag_assignments"
    ADD CONSTRAINT "unique_task_tag" UNIQUE ("task_id", "tag_id");



ALTER TABLE ONLY "public"."task_templates"
    ADD CONSTRAINT "unique_template_name_per_tenant" UNIQUE ("tenant_id", "name");



ALTER TABLE ONLY "public"."tenant_usage_history"
    ADD CONSTRAINT "unique_tenant_snapshot" UNIQUE ("tenant_id", "snapshot_date", "snapshot_type");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "unique_user_notification_pref" UNIQUE ("user_id", "notification_type");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "unique_user_role" UNIQUE ("user_id", "role_id");



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "unique_user_tenant" UNIQUE ("user_id", "tenant_id");



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_activity_logs_action" ON "public"."activity_logs" USING "btree" ("action");



CREATE INDEX "idx_activity_logs_tenant_id_created" ON "public"."activity_logs" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_activity_logs_user_id_created" ON "public"."activity_logs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_adjustment_items_adjustment" ON "public"."stock_adjustment_items" USING "btree" ("adjustment_id");



CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_logs_entity" ON "public"."audit_logs" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_audit_logs_tenant_id" ON "public"."audit_logs" USING "btree" ("tenant_id");



CREATE INDEX "idx_checklist_items_sub_phase" ON "public"."project_checklist_items" USING "btree" ("project_sub_phase_id");



CREATE INDEX "idx_commission_items_quotation" ON "public"."commission_items" USING "btree" ("quotation_id");



CREATE INDEX "idx_commission_items_status" ON "public"."commission_items" USING "btree" ("status");



CREATE INDEX "idx_commission_items_tenant" ON "public"."commission_items" USING "btree" ("tenant_id");



CREATE INDEX "idx_completion_req_sub_phase" ON "public"."sub_phase_completion_requirements" USING "btree" ("project_sub_phase_id");



CREATE INDEX "idx_component_templates_tenant" ON "public"."component_templates" USING "btree" ("tenant_id", "is_active");



CREATE INDEX "idx_component_types_tenant" ON "public"."component_types" USING "btree" ("tenant_id", "is_active");



CREATE INDEX "idx_component_variant_types_active" ON "public"."component_variant_types" USING "btree" ("tenant_id", "is_active");



CREATE INDEX "idx_component_variant_types_component" ON "public"."component_variant_types" USING "btree" ("component_type_id");



CREATE INDEX "idx_component_variant_types_tenant" ON "public"."component_variant_types" USING "btree" ("tenant_id");



CREATE INDEX "idx_component_variants_component" ON "public"."component_variants" USING "btree" ("component_type_id");



CREATE INDEX "idx_component_variants_tenant" ON "public"."component_variants" USING "btree" ("tenant_id", "is_active");



CREATE INDEX "idx_cost_item_categories_tenant" ON "public"."cost_item_categories" USING "btree" ("tenant_id", "is_active");



CREATE INDEX "idx_cost_items_category" ON "public"."cost_items" USING "btree" ("category_id");



CREATE INDEX "idx_cost_items_tenant" ON "public"."cost_items" USING "btree" ("tenant_id", "is_active");



CREATE INDEX "idx_cost_items_unit" ON "public"."cost_items" USING "btree" ("unit_code");



CREATE INDEX "idx_email_verification_token" ON "public"."email_verification_tokens" USING "btree" ("token");



CREATE INDEX "idx_email_verification_user_id" ON "public"."email_verification_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_goods_receipts_date" ON "public"."goods_receipts" USING "btree" ("tenant_id", "receipt_date" DESC);



CREATE INDEX "idx_goods_receipts_po" ON "public"."goods_receipts" USING "btree" ("po_id");



CREATE INDEX "idx_goods_receipts_tenant" ON "public"."goods_receipts" USING "btree" ("tenant_id");



CREATE INDEX "idx_goods_receipts_vendor" ON "public"."goods_receipts" USING "btree" ("vendor_id");



CREATE INDEX "idx_grn_items_grn" ON "public"."goods_receipt_items" USING "btree" ("grn_id");



CREATE INDEX "idx_grn_items_po_item" ON "public"."goods_receipt_items" USING "btree" ("po_item_id");



CREATE INDEX "idx_issue_items_issue" ON "public"."stock_issue_items" USING "btree" ("issue_id");



CREATE INDEX "idx_issue_items_item" ON "public"."stock_issue_items" USING "btree" ("cost_item_id");



CREATE INDEX "idx_lead_activities_created" ON "public"."lead_activities" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_lead_activities_lead_id" ON "public"."lead_activities" USING "btree" ("lead_id");



CREATE INDEX "idx_lead_activities_type" ON "public"."lead_activities" USING "btree" ("activity_type");



CREATE INDEX "idx_lead_documents_lead_id" ON "public"."lead_documents" USING "btree" ("lead_id");



CREATE INDEX "idx_lead_family_members_lead_id" ON "public"."lead_family_members" USING "btree" ("lead_id");



CREATE INDEX "idx_lead_notes_lead_id" ON "public"."lead_notes" USING "btree" ("lead_id");



CREATE INDEX "idx_lead_stage_history_created" ON "public"."lead_stage_history" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_lead_stage_history_lead_id" ON "public"."lead_stage_history" USING "btree" ("lead_id");



CREATE INDEX "idx_lead_tasks_assigned_to" ON "public"."lead_tasks" USING "btree" ("assigned_to");



CREATE INDEX "idx_lead_tasks_due_date" ON "public"."lead_tasks" USING "btree" ("due_date");



CREATE INDEX "idx_lead_tasks_lead_id" ON "public"."lead_tasks" USING "btree" ("lead_id");



CREATE INDEX "idx_lead_tasks_status" ON "public"."lead_tasks" USING "btree" ("status");



CREATE INDEX "idx_leads_assigned_to" ON "public"."leads" USING "btree" ("assigned_to");



CREATE INDEX "idx_leads_created_at" ON "public"."leads" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_leads_created_by" ON "public"."leads" USING "btree" ("created_by");



CREATE INDEX "idx_leads_email" ON "public"."leads" USING "btree" ("tenant_id", "email");



CREATE INDEX "idx_leads_last_activity" ON "public"."leads" USING "btree" ("tenant_id", "last_activity_at" DESC);



CREATE INDEX "idx_leads_phone" ON "public"."leads" USING "btree" ("tenant_id", "phone");



CREATE INDEX "idx_leads_project_id" ON "public"."leads" USING "btree" ("project_id");



CREATE INDEX "idx_leads_stage" ON "public"."leads" USING "btree" ("tenant_id", "stage");



CREATE INDEX "idx_leads_tenant_id" ON "public"."leads" USING "btree" ("tenant_id");



CREATE INDEX "idx_materials_category" ON "public"."materials" USING "btree" ("category_id");



CREATE INDEX "idx_materials_tenant" ON "public"."materials" USING "btree" ("tenant_id", "is_active");



CREATE INDEX "idx_notification_prefs_user" ON "public"."notification_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_entity" ON "public"."notifications" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_notifications_tenant_created" ON "public"."notifications" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_notifications_type" ON "public"."notifications" USING "btree" ("type");



CREATE INDEX "idx_notifications_user_created" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_notifications_user_unread" ON "public"."notifications" USING "btree" ("user_id", "is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_ownership_transfers_from_user" ON "public"."ownership_transfers" USING "btree" ("from_user_id");



CREATE INDEX "idx_ownership_transfers_status" ON "public"."ownership_transfers" USING "btree" ("status");



CREATE INDEX "idx_ownership_transfers_tenant_id" ON "public"."ownership_transfers" USING "btree" ("tenant_id");



CREATE INDEX "idx_ownership_transfers_to_user" ON "public"."ownership_transfers" USING "btree" ("to_user_id");



CREATE INDEX "idx_ownership_transfers_token" ON "public"."ownership_transfers" USING "btree" ("token");



CREATE INDEX "idx_password_reset_token" ON "public"."password_reset_tokens" USING "btree" ("token");



CREATE INDEX "idx_password_reset_user_id" ON "public"."password_reset_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_payment_milestones_linked_phase" ON "public"."project_payment_milestones" USING "btree" ("linked_phase_id");



CREATE INDEX "idx_payment_milestones_project" ON "public"."project_payment_milestones" USING "btree" ("project_id");



CREATE INDEX "idx_payment_milestones_status" ON "public"."project_payment_milestones" USING "btree" ("project_id", "status");



CREATE INDEX "idx_permissions_key" ON "public"."permissions" USING "btree" ("key");



CREATE INDEX "idx_permissions_module" ON "public"."permissions" USING "btree" ("module");



CREATE INDEX "idx_phase_activity_phase" ON "public"."project_phase_activity_log" USING "btree" ("project_phase_id");



CREATE INDEX "idx_phase_activity_project" ON "public"."project_phase_activity_log" USING "btree" ("project_id");



CREATE INDEX "idx_phase_activity_sub_phase" ON "public"."project_phase_activity_log" USING "btree" ("project_sub_phase_id");



CREATE INDEX "idx_phase_activity_time" ON "public"."project_phase_activity_log" USING "btree" ("performed_at" DESC);



CREATE INDEX "idx_phase_activity_type" ON "public"."project_phase_activity_log" USING "btree" ("activity_type");



CREATE INDEX "idx_phase_approvals_approver" ON "public"."project_phase_approvals" USING "btree" ("approver_id");



CREATE INDEX "idx_phase_approvals_status" ON "public"."project_phase_approvals" USING "btree" ("status");



CREATE INDEX "idx_phase_approvals_sub_phase" ON "public"."project_phase_approvals" USING "btree" ("project_sub_phase_id");



CREATE INDEX "idx_phase_attachments_phase" ON "public"."project_phase_attachments" USING "btree" ("project_phase_id");



CREATE INDEX "idx_phase_attachments_project" ON "public"."project_phase_attachments" USING "btree" ("project_id");



CREATE INDEX "idx_phase_attachments_sub_phase" ON "public"."project_phase_attachments" USING "btree" ("project_sub_phase_id");



CREATE INDEX "idx_phase_comments_parent" ON "public"."project_phase_comments" USING "btree" ("parent_comment_id");



CREATE INDEX "idx_phase_comments_phase" ON "public"."project_phase_comments" USING "btree" ("project_phase_id");



CREATE INDEX "idx_phase_comments_project" ON "public"."project_phase_comments" USING "btree" ("project_id");



CREATE INDEX "idx_phase_comments_sub_phase" ON "public"."project_phase_comments" USING "btree" ("project_sub_phase_id");



CREATE INDEX "idx_phase_templates_category" ON "public"."project_phase_templates" USING "btree" ("category_id");



CREATE INDEX "idx_phase_templates_tenant" ON "public"."project_phase_templates" USING "btree" ("tenant_id");



CREATE INDEX "idx_plan_features_plan_id" ON "public"."subscription_plan_features" USING "btree" ("plan_id");



CREATE INDEX "idx_po_approval_history_action" ON "public"."po_approval_history" USING "btree" ("action");



CREATE INDEX "idx_po_approval_history_date" ON "public"."po_approval_history" USING "btree" ("created_at");



CREATE INDEX "idx_po_approval_history_po" ON "public"."po_approval_history" USING "btree" ("po_id");



CREATE INDEX "idx_po_items_cost_type" ON "public"."stock_purchase_order_items" USING "btree" ("cost_type");



CREATE INDEX "idx_po_items_project" ON "public"."stock_purchase_order_items" USING "btree" ("project_id");



CREATE INDEX "idx_po_payment_status" ON "public"."stock_purchase_orders" USING "btree" ("tenant_id", "payment_status");



CREATE INDEX "idx_po_payments_date" ON "public"."po_payments" USING "btree" ("payment_date");



CREATE INDEX "idx_po_payments_po" ON "public"."po_payments" USING "btree" ("po_id");



CREATE INDEX "idx_po_pending_approval" ON "public"."stock_purchase_orders" USING "btree" ("tenant_id", "status") WHERE (("status")::"text" = 'pending_approval'::"text");



CREATE INDEX "idx_po_requires_approval" ON "public"."stock_purchase_orders" USING "btree" ("tenant_id", "requires_approval");



CREATE INDEX "idx_po_status" ON "public"."stock_purchase_orders" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_pricing_rules_category" ON "public"."pricing_rules" USING "btree" ("category_pattern");



CREATE INDEX "idx_pricing_rules_tenant" ON "public"."pricing_rules" USING "btree" ("tenant_id");



CREATE INDEX "idx_project_phases_assigned" ON "public"."project_phases" USING "btree" ("assigned_to");



CREATE INDEX "idx_project_phases_project" ON "public"."project_phases" USING "btree" ("project_id");



CREATE INDEX "idx_project_phases_status" ON "public"."project_phases" USING "btree" ("project_id", "status");



CREATE INDEX "idx_project_phases_template" ON "public"."project_phases" USING "btree" ("phase_template_id");



CREATE INDEX "idx_project_sub_phases_phase" ON "public"."project_sub_phases" USING "btree" ("project_phase_id");



CREATE INDEX "idx_project_sub_phases_status" ON "public"."project_sub_phases" USING "btree" ("status");



CREATE INDEX "idx_project_sub_phases_template" ON "public"."project_sub_phases" USING "btree" ("sub_phase_template_id");



CREATE INDEX "idx_projects_active" ON "public"."projects" USING "btree" ("tenant_id", "is_active");



CREATE INDEX "idx_projects_converted_from_lead" ON "public"."projects" USING "btree" ("converted_from_lead_id");



CREATE INDEX "idx_projects_lead_source" ON "public"."projects" USING "btree" ("lead_source") WHERE ("lead_source" IS NOT NULL);



CREATE INDEX "idx_projects_manager" ON "public"."projects" USING "btree" ("project_manager_id");



CREATE INDEX "idx_projects_project_category" ON "public"."projects" USING "btree" ("tenant_id", "project_category");



CREATE INDEX "idx_projects_property_type" ON "public"."projects" USING "btree" ("property_type");



CREATE INDEX "idx_projects_sales_rep" ON "public"."projects" USING "btree" ("sales_rep_id") WHERE ("sales_rep_id" IS NOT NULL);



CREATE INDEX "idx_projects_status" ON "public"."projects" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_projects_tenant" ON "public"."projects" USING "btree" ("tenant_id");



CREATE INDEX "idx_quotation_components_order" ON "public"."quotation_components" USING "btree" ("space_id", "display_order");



CREATE INDEX "idx_quotation_components_quotation" ON "public"."quotation_components" USING "btree" ("quotation_id");



CREATE INDEX "idx_quotation_components_space" ON "public"."quotation_components" USING "btree" ("space_id");



CREATE INDEX "idx_quotation_cost_attributes_component" ON "public"."quotation_cost_attributes" USING "btree" ("component_id");



CREATE INDEX "idx_quotation_cost_attrs_material" ON "public"."quotation_cost_attributes" USING "btree" ("material_id");



CREATE INDEX "idx_quotation_cost_attrs_quotation" ON "public"."quotation_cost_attributes" USING "btree" ("quotation_id");



CREATE INDEX "idx_quotation_line_items_component" ON "public"."quotation_line_items" USING "btree" ("quotation_component_id");



CREATE INDEX "idx_quotation_line_items_quotation" ON "public"."quotation_line_items" USING "btree" ("quotation_id");



CREATE INDEX "idx_quotation_line_items_space" ON "public"."quotation_line_items" USING "btree" ("quotation_space_id");



CREATE INDEX "idx_quotation_materials_component" ON "public"."quotation_materials" USING "btree" ("component_id");



CREATE INDEX "idx_quotation_materials_quotation" ON "public"."quotation_materials" USING "btree" ("quotation_id");



CREATE INDEX "idx_quotation_spaces_order" ON "public"."quotation_spaces" USING "btree" ("quotation_id", "display_order");



CREATE INDEX "idx_quotation_spaces_quotation" ON "public"."quotation_spaces" USING "btree" ("quotation_id");



CREATE INDEX "idx_quotation_templates_tenant" ON "public"."quotation_templates" USING "btree" ("tenant_id", "is_active");



CREATE INDEX "idx_quotations_assigned_to" ON "public"."quotations" USING "btree" ("assigned_to");



CREATE INDEX "idx_quotations_created" ON "public"."quotations" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_quotations_lead" ON "public"."quotations" USING "btree" ("lead_id");



CREATE INDEX "idx_quotations_number" ON "public"."quotations" USING "btree" ("tenant_id", "quotation_number");



CREATE INDEX "idx_quotations_number_version" ON "public"."quotations" USING "btree" ("tenant_id", "quotation_number", "version" DESC);



CREATE INDEX "idx_quotations_status" ON "public"."quotations" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_quotations_tenant" ON "public"."quotations" USING "btree" ("tenant_id");



CREATE INDEX "idx_revenue_heads_category" ON "public"."revenue_heads" USING "btree" ("tenant_id", "category");



CREATE INDEX "idx_revenue_heads_tenant" ON "public"."revenue_heads" USING "btree" ("tenant_id");



CREATE INDEX "idx_role_permissions_permission_id" ON "public"."role_permissions" USING "btree" ("permission_id");



CREATE INDEX "idx_role_permissions_role_id" ON "public"."role_permissions" USING "btree" ("role_id");



CREATE INDEX "idx_roles_is_system" ON "public"."roles" USING "btree" ("is_system_role");



CREATE INDEX "idx_roles_slug" ON "public"."roles" USING "btree" ("slug");



CREATE INDEX "idx_roles_tenant_id" ON "public"."roles" USING "btree" ("tenant_id");



CREATE INDEX "idx_space_templates_tenant" ON "public"."space_templates" USING "btree" ("tenant_id", "is_active");



CREATE INDEX "idx_space_types_tenant" ON "public"."space_types" USING "btree" ("tenant_id", "is_active");



CREATE INDEX "idx_status_logs_phase" ON "public"."project_phase_status_logs" USING "btree" ("phase_id");



CREATE INDEX "idx_status_logs_sub_phase" ON "public"."project_phase_status_logs" USING "btree" ("sub_phase_id");



CREATE INDEX "idx_stock_adjustments_date" ON "public"."stock_adjustments" USING "btree" ("tenant_id", "adjustment_date" DESC);



CREATE INDEX "idx_stock_adjustments_tenant" ON "public"."stock_adjustments" USING "btree" ("tenant_id");



CREATE INDEX "idx_stock_brands_active" ON "public"."stock_brands" USING "btree" ("tenant_id", "is_active");



CREATE INDEX "idx_stock_brands_preferred" ON "public"."stock_brands" USING "btree" ("tenant_id", "is_preferred") WHERE ("is_preferred" = true);



CREATE INDEX "idx_stock_brands_tenant" ON "public"."stock_brands" USING "btree" ("tenant_id");



CREATE INDEX "idx_stock_grn_items_grn" ON "public"."stock_goods_receipt_items" USING "btree" ("grn_id");



CREATE INDEX "idx_stock_grn_po" ON "public"."stock_goods_receipts" USING "btree" ("po_id");



CREATE INDEX "idx_stock_grn_tenant" ON "public"."stock_goods_receipts" USING "btree" ("tenant_id");



CREATE INDEX "idx_stock_issues_date" ON "public"."stock_issues" USING "btree" ("tenant_id", "issue_date" DESC);



CREATE INDEX "idx_stock_issues_project" ON "public"."stock_issues" USING "btree" ("project_id");



CREATE INDEX "idx_stock_issues_tenant" ON "public"."stock_issues" USING "btree" ("tenant_id");



CREATE INDEX "idx_stock_materials_brand" ON "public"."stock_materials" USING "btree" ("brand_id");



CREATE INDEX "idx_stock_materials_category" ON "public"."stock_materials" USING "btree" ("company_id", "category");



CREATE INDEX "idx_stock_materials_company" ON "public"."stock_materials" USING "btree" ("company_id");



CREATE INDEX "idx_stock_materials_specifications" ON "public"."stock_materials" USING "gin" ("specifications");



CREATE INDEX "idx_stock_materials_type" ON "public"."stock_materials" USING "btree" ("company_id", "item_type");



CREATE INDEX "idx_stock_materials_vendor" ON "public"."stock_materials" USING "btree" ("preferred_vendor_id");



CREATE INDEX "idx_stock_movements_material" ON "public"."stock_movements" USING "btree" ("material_id");



CREATE INDEX "idx_stock_movements_project" ON "public"."stock_movements" USING "btree" ("project_id");



CREATE INDEX "idx_stock_movements_type" ON "public"."stock_movements" USING "btree" ("tenant_id", "movement_type");



CREATE INDEX "idx_stock_mr_items_mr" ON "public"."stock_material_requisition_items" USING "btree" ("mr_id");



CREATE INDEX "idx_stock_mr_status" ON "public"."stock_material_requisitions" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_stock_mr_tenant" ON "public"."stock_material_requisitions" USING "btree" ("tenant_id");



CREATE INDEX "idx_stock_po_closed_by" ON "public"."stock_purchase_orders" USING "btree" ("closed_by");



CREATE INDEX "idx_stock_po_items_po" ON "public"."stock_purchase_order_items" USING "btree" ("po_id");



CREATE INDEX "idx_stock_po_rejected_by" ON "public"."stock_purchase_orders" USING "btree" ("rejected_by");



CREATE INDEX "idx_stock_po_status" ON "public"."stock_purchase_orders" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_stock_po_status_payment" ON "public"."stock_purchase_orders" USING "btree" ("status", "payment_status");



CREATE INDEX "idx_stock_po_tenant" ON "public"."stock_purchase_orders" USING "btree" ("tenant_id");



CREATE INDEX "idx_stock_po_vendor" ON "public"."stock_purchase_orders" USING "btree" ("vendor_id");



CREATE INDEX "idx_stock_vendor_brands_brand" ON "public"."stock_vendor_brands" USING "btree" ("brand_id");



CREATE INDEX "idx_stock_vendor_brands_vendor" ON "public"."stock_vendor_brands" USING "btree" ("vendor_id");



CREATE INDEX "idx_stock_vendor_materials_material" ON "public"."stock_vendor_materials" USING "btree" ("material_id");



CREATE INDEX "idx_stock_vendor_materials_preferred" ON "public"."stock_vendor_materials" USING "btree" ("material_id", "is_preferred") WHERE ("is_preferred" = true);



CREATE INDEX "idx_stock_vendor_materials_vendor" ON "public"."stock_vendor_materials" USING "btree" ("vendor_id");



CREATE INDEX "idx_stock_vendors_active" ON "public"."stock_vendors" USING "btree" ("tenant_id", "is_active");



CREATE INDEX "idx_stock_vendors_city" ON "public"."stock_vendors" USING "btree" ("city");



CREATE INDEX "idx_stock_vendors_tenant" ON "public"."stock_vendors" USING "btree" ("tenant_id");



CREATE INDEX "idx_sub_phase_assignees_sub_phase" ON "public"."project_sub_phase_assignees" USING "btree" ("sub_phase_id");



CREATE INDEX "idx_sub_phase_assignees_user" ON "public"."project_sub_phase_assignees" USING "btree" ("user_id");



CREATE INDEX "idx_sub_phase_templates_phase" ON "public"."project_sub_phase_templates" USING "btree" ("phase_template_id");



CREATE INDEX "idx_subscription_addons_tenant_id" ON "public"."subscription_addons" USING "btree" ("tenant_id");



CREATE INDEX "idx_subscription_change_requests_status" ON "public"."subscription_change_requests" USING "btree" ("status");



CREATE INDEX "idx_subscription_change_requests_tenant" ON "public"."subscription_change_requests" USING "btree" ("tenant_id");



CREATE INDEX "idx_subscription_invoices_created" ON "public"."subscription_invoices" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_subscription_invoices_status" ON "public"."subscription_invoices" USING "btree" ("status");



CREATE INDEX "idx_subscription_invoices_tenant" ON "public"."subscription_invoices" USING "btree" ("tenant_id");



CREATE INDEX "idx_subscription_plans_is_active" ON "public"."subscription_plans" USING "btree" ("is_active");



CREATE INDEX "idx_subscription_plans_tenant_type" ON "public"."subscription_plans" USING "btree" ("tenant_type");



CREATE INDEX "idx_system_config_key" ON "public"."system_config" USING "btree" ("config_key");



CREATE INDEX "idx_task_activities_created" ON "public"."task_activities" USING "btree" ("created_at");



CREATE INDEX "idx_task_activities_task" ON "public"."task_activities" USING "btree" ("task_id");



CREATE INDEX "idx_task_activities_type" ON "public"."task_activities" USING "btree" ("activity_type");



CREATE INDEX "idx_task_attachments_task" ON "public"."task_attachments" USING "btree" ("task_id");



CREATE INDEX "idx_task_attachments_uploaded_by" ON "public"."task_attachments" USING "btree" ("uploaded_by");



CREATE INDEX "idx_task_comments_created_by" ON "public"."task_comments" USING "btree" ("created_by");



CREATE INDEX "idx_task_comments_parent" ON "public"."task_comments" USING "btree" ("parent_comment_id");



CREATE INDEX "idx_task_comments_task" ON "public"."task_comments" USING "btree" ("task_id");



CREATE INDEX "idx_task_tag_assignments_tag" ON "public"."task_tag_assignments" USING "btree" ("tag_id");



CREATE INDEX "idx_task_tag_assignments_task" ON "public"."task_tag_assignments" USING "btree" ("task_id");



CREATE INDEX "idx_task_tags_tenant" ON "public"."task_tags" USING "btree" ("tenant_id");



CREATE INDEX "idx_task_template_items_order" ON "public"."task_template_items" USING "btree" ("template_id", "sort_order");



CREATE INDEX "idx_task_template_items_parent" ON "public"."task_template_items" USING "btree" ("parent_item_id");



CREATE INDEX "idx_task_template_items_template" ON "public"."task_template_items" USING "btree" ("template_id");



CREATE INDEX "idx_task_templates_active" ON "public"."task_templates" USING "btree" ("is_active");



CREATE INDEX "idx_task_templates_category" ON "public"."task_templates" USING "btree" ("category");



CREATE INDEX "idx_task_templates_tenant" ON "public"."task_templates" USING "btree" ("tenant_id");



CREATE INDEX "idx_tasks_assigned" ON "public"."tasks" USING "btree" ("assigned_to");



CREATE INDEX "idx_tasks_assignee_status" ON "public"."tasks" USING "btree" ("assigned_to", "status");



CREATE INDEX "idx_tasks_created_by" ON "public"."tasks" USING "btree" ("created_by");



CREATE INDEX "idx_tasks_due_date" ON "public"."tasks" USING "btree" ("due_date");



CREATE INDEX "idx_tasks_parent" ON "public"."tasks" USING "btree" ("parent_task_id");



CREATE INDEX "idx_tasks_priority" ON "public"."tasks" USING "btree" ("priority");



CREATE INDEX "idx_tasks_related" ON "public"."tasks" USING "btree" ("related_type", "related_id");



CREATE INDEX "idx_tasks_status" ON "public"."tasks" USING "btree" ("status");



CREATE INDEX "idx_tasks_template" ON "public"."tasks" USING "btree" ("template_id");



CREATE INDEX "idx_tasks_tenant" ON "public"."tasks" USING "btree" ("tenant_id");



CREATE INDEX "idx_tasks_tenant_status_due" ON "public"."tasks" USING "btree" ("tenant_id", "status", "due_date");



CREATE INDEX "idx_template_line_items_component" ON "public"."template_line_items" USING "btree" ("component_type_id");



CREATE INDEX "idx_template_line_items_space" ON "public"."template_line_items" USING "btree" ("space_type_id");



CREATE INDEX "idx_template_line_items_template" ON "public"."template_line_items" USING "btree" ("template_id");



CREATE INDEX "idx_template_spaces_template" ON "public"."template_spaces" USING "btree" ("template_id");



CREATE UNIQUE INDEX "idx_tenant_payment_methods_default" ON "public"."tenant_payment_methods" USING "btree" ("tenant_id") WHERE ("is_default" = true);



CREATE INDEX "idx_tenant_payment_methods_tenant" ON "public"."tenant_payment_methods" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_settings_tenant_id" ON "public"."tenant_settings" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_subscriptions_plan_id" ON "public"."tenant_subscriptions" USING "btree" ("plan_id");



CREATE INDEX "idx_tenant_subscriptions_status" ON "public"."tenant_subscriptions" USING "btree" ("status");



CREATE INDEX "idx_tenant_subscriptions_sub_end" ON "public"."tenant_subscriptions" USING "btree" ("subscription_end_date");



CREATE INDEX "idx_tenant_subscriptions_tenant_id" ON "public"."tenant_subscriptions" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_subscriptions_trial_end" ON "public"."tenant_subscriptions" USING "btree" ("trial_end_date");



CREATE INDEX "idx_tenant_usage_history_date" ON "public"."tenant_usage_history" USING "btree" ("snapshot_date");



CREATE INDEX "idx_tenant_usage_history_tenant" ON "public"."tenant_usage_history" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_usage_tenant_id" ON "public"."tenant_usage" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_users_is_active" ON "public"."tenant_users" USING "btree" ("is_active");



CREATE INDEX "idx_tenant_users_tenant_active" ON "public"."tenant_users" USING "btree" ("tenant_id", "is_active");



CREATE INDEX "idx_tenant_users_tenant_id" ON "public"."tenant_users" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_users_user_id" ON "public"."tenant_users" USING "btree" ("user_id");



CREATE INDEX "idx_tenants_email" ON "public"."tenants" USING "btree" ("email");



CREATE INDEX "idx_tenants_gst_number" ON "public"."tenants" USING "btree" ("gst_number");



CREATE INDEX "idx_tenants_status" ON "public"."tenants" USING "btree" ("status");



CREATE INDEX "idx_tenants_tenant_type" ON "public"."tenants" USING "btree" ("tenant_type");



CREATE INDEX "idx_units_active" ON "public"."units" USING "btree" ("is_active", "display_order");



CREATE INDEX "idx_user_invitations_email" ON "public"."user_invitations" USING "btree" ("email");



CREATE INDEX "idx_user_invitations_status" ON "public"."user_invitations" USING "btree" ("status");



CREATE INDEX "idx_user_invitations_tenant_id" ON "public"."user_invitations" USING "btree" ("tenant_id");



CREATE INDEX "idx_user_invitations_token" ON "public"."user_invitations" USING "btree" ("token");



CREATE INDEX "idx_user_roles_role_id" ON "public"."user_roles" USING "btree" ("role_id");



CREATE INDEX "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");



CREATE INDEX "idx_user_sessions_expires_at" ON "public"."user_sessions" USING "btree" ("expires_at");



CREATE INDEX "idx_user_sessions_user_id" ON "public"."user_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_users_status" ON "public"."users" USING "btree" ("status");



CREATE INDEX "idx_users_tenant_id" ON "public"."users" USING "btree" ("tenant_id");



CREATE INDEX "idx_users_tenant_status" ON "public"."users" USING "btree" ("tenant_id", "status");



CREATE OR REPLACE TRIGGER "record_stage_change" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_record_stage_change"();



CREATE OR REPLACE TRIGGER "set_grn_number" BEFORE INSERT ON "public"."goods_receipts" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_grn_number"();



CREATE OR REPLACE TRIGGER "set_invoice_number" BEFORE INSERT ON "public"."subscription_invoices" FOR EACH ROW WHEN ((("new"."invoice_number" IS NULL) OR (("new"."invoice_number")::"text" = ''::"text"))) EXECUTE FUNCTION "public"."generate_invoice_number"();



CREATE OR REPLACE TRIGGER "set_issue_number" BEFORE INSERT ON "public"."stock_issues" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_issue_number"();



CREATE OR REPLACE TRIGGER "set_lead_number" BEFORE INSERT ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_lead_number"();



CREATE OR REPLACE TRIGGER "set_task_number" BEFORE INSERT ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_task_number"();



CREATE OR REPLACE TRIGGER "task_assignment_change" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."log_task_assignment_change"();



CREATE OR REPLACE TRIGGER "task_status_change" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."log_task_status_change"();



CREATE OR REPLACE TRIGGER "trg_checklist_progress" AFTER INSERT OR DELETE OR UPDATE ON "public"."project_checklist_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_update_sub_phase_progress"();



CREATE OR REPLACE TRIGGER "trg_lead_stage_change" AFTER UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."on_lead_stage_change"();



COMMENT ON TRIGGER "trg_lead_stage_change" ON "public"."leads" IS 'Auto-creates quotation when lead moves to proposal_discussion stage';



CREATE OR REPLACE TRIGGER "trg_payment_milestone_status" AFTER UPDATE ON "public"."project_phases" FOR EACH ROW EXECUTE FUNCTION "public"."trg_update_payment_milestone_status"();



CREATE OR REPLACE TRIGGER "trg_phase_project_progress" AFTER INSERT OR DELETE OR UPDATE ON "public"."project_phases" FOR EACH ROW EXECUTE FUNCTION "public"."trg_update_project_progress"();



CREATE OR REPLACE TRIGGER "trg_recalc_component_subtotal" AFTER INSERT OR DELETE OR UPDATE ON "public"."quotation_materials" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_component_subtotal"();



CREATE OR REPLACE TRIGGER "trg_recalc_component_subtotal_v2" AFTER INSERT OR DELETE OR UPDATE ON "public"."quotation_line_items" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_component_subtotal_v2"();



CREATE OR REPLACE TRIGGER "trg_recalc_material_subtotal" AFTER INSERT OR DELETE OR UPDATE ON "public"."quotation_cost_attributes" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_material_subtotal"();



CREATE OR REPLACE TRIGGER "trg_recalc_quotation_totals" AFTER INSERT OR DELETE OR UPDATE ON "public"."quotation_spaces" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_quotation_totals"();



CREATE OR REPLACE TRIGGER "trg_recalc_space_subtotal" AFTER INSERT OR DELETE OR UPDATE ON "public"."quotation_components" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_space_subtotal"();



CREATE OR REPLACE TRIGGER "trg_recalc_space_subtotal_v2" AFTER INSERT OR DELETE OR UPDATE ON "public"."quotation_line_items" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_space_subtotal_v2"();



CREATE OR REPLACE TRIGGER "trg_sub_phase_progress" AFTER INSERT OR DELETE OR UPDATE ON "public"."project_sub_phases" FOR EACH ROW EXECUTE FUNCTION "public"."trg_update_phase_progress"();



CREATE OR REPLACE TRIGGER "trg_update_stock_on_grn" AFTER UPDATE ON "public"."goods_receipts" FOR EACH ROW EXECUTE FUNCTION "public"."update_stock_on_grn"();



CREATE OR REPLACE TRIGGER "trigger_notify_lead_won" AFTER UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."notify_lead_won"();



CREATE OR REPLACE TRIGGER "trigger_tenant_users_updated_at" BEFORE UPDATE ON "public"."tenant_users" FOR EACH ROW EXECUTE FUNCTION "public"."update_tenant_users_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_phase_progress" AFTER INSERT OR DELETE OR UPDATE OF "status" ON "public"."project_sub_phases" FOR EACH ROW EXECUTE FUNCTION "public"."update_phase_progress"();



CREATE OR REPLACE TRIGGER "trigger_update_project_progress" AFTER INSERT OR DELETE OR UPDATE OF "progress_percentage", "status" ON "public"."project_phases" FOR EACH ROW EXECUTE FUNCTION "public"."update_project_progress"();



CREATE OR REPLACE TRIGGER "update_lead_last_activity" AFTER INSERT ON "public"."lead_activities" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_lead_last_activity"();



CREATE OR REPLACE TRIGGER "update_lead_notes_updated_at" BEFORE UPDATE ON "public"."lead_notes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_lead_tasks_updated_at" BEFORE UPDATE ON "public"."lead_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_leads_updated_at" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notification_preferences_updated_at" BEFORE UPDATE ON "public"."notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ownership_transfers_updated_at" BEFORE UPDATE ON "public"."ownership_transfers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_po_payment_status_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."po_payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_po_payment_status"();



CREATE OR REPLACE TRIGGER "update_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."update_projects_updated_at"();



CREATE OR REPLACE TRIGGER "update_roles_updated_at" BEFORE UPDATE ON "public"."roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stock_brands_updated_at" BEFORE UPDATE ON "public"."stock_brands" FOR EACH ROW EXECUTE FUNCTION "public"."update_stock_updated_at"();



CREATE OR REPLACE TRIGGER "update_stock_grn_updated_at" BEFORE UPDATE ON "public"."stock_goods_receipts" FOR EACH ROW EXECUTE FUNCTION "public"."update_stock_updated_at"();



CREATE OR REPLACE TRIGGER "update_stock_materials_updated_at" BEFORE UPDATE ON "public"."stock_materials" FOR EACH ROW EXECUTE FUNCTION "public"."update_stock_updated_at"();



CREATE OR REPLACE TRIGGER "update_stock_mr_updated_at" BEFORE UPDATE ON "public"."stock_material_requisitions" FOR EACH ROW EXECUTE FUNCTION "public"."update_stock_updated_at"();



CREATE OR REPLACE TRIGGER "update_stock_po_updated_at" BEFORE UPDATE ON "public"."stock_purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_stock_updated_at"();



CREATE OR REPLACE TRIGGER "update_stock_vendor_materials_updated_at" BEFORE UPDATE ON "public"."stock_vendor_materials" FOR EACH ROW EXECUTE FUNCTION "public"."update_stock_updated_at"();



CREATE OR REPLACE TRIGGER "update_stock_vendors_updated_at" BEFORE UPDATE ON "public"."stock_vendors" FOR EACH ROW EXECUTE FUNCTION "public"."update_stock_updated_at"();



CREATE OR REPLACE TRIGGER "update_subscription_addons_updated_at" BEFORE UPDATE ON "public"."subscription_addons" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_subscription_plans_updated_at" BEFORE UPDATE ON "public"."subscription_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_task_tags_updated_at" BEFORE UPDATE ON "public"."task_tags" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_task_template_items_updated_at" BEFORE UPDATE ON "public"."task_template_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_task_templates_updated_at" BEFORE UPDATE ON "public"."task_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tenant_lead_settings_updated_at" BEFORE UPDATE ON "public"."tenant_lead_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tenant_settings_updated_at" BEFORE UPDATE ON "public"."tenant_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tenant_subscriptions_updated_at" BEFORE UPDATE ON "public"."tenant_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tenants_updated_at" BEFORE UPDATE ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_count_trigger" AFTER INSERT OR DELETE OR UPDATE OF "status" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_user_count"();



CREATE OR REPLACE TRIGGER "update_user_invitations_updated_at" BEFORE UPDATE ON "public"."user_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_logs"
    ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."approval_configs"
    ADD CONSTRAINT "approval_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commission_items"
    ADD CONSTRAINT "commission_items_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."stock_brands"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commission_items"
    ADD CONSTRAINT "commission_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."stock_materials"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commission_items"
    ADD CONSTRAINT "commission_items_revenue_head_id_fkey" FOREIGN KEY ("revenue_head_id") REFERENCES "public"."revenue_heads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commission_items"
    ADD CONSTRAINT "commission_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commission_items"
    ADD CONSTRAINT "commission_items_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."stock_vendors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."component_templates"
    ADD CONSTRAINT "component_templates_component_type_id_fkey" FOREIGN KEY ("component_type_id") REFERENCES "public"."component_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."component_templates"
    ADD CONSTRAINT "component_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."component_templates"
    ADD CONSTRAINT "component_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."component_templates"
    ADD CONSTRAINT "component_templates_variant_type_id_fkey" FOREIGN KEY ("variant_type_id") REFERENCES "public"."component_variant_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."component_types"
    ADD CONSTRAINT "component_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."component_variant_types"
    ADD CONSTRAINT "component_variant_types_component_type_id_fkey" FOREIGN KEY ("component_type_id") REFERENCES "public"."component_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."component_variant_types"
    ADD CONSTRAINT "component_variant_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."component_variants"
    ADD CONSTRAINT "component_variants_component_type_id_fkey" FOREIGN KEY ("component_type_id") REFERENCES "public"."component_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."component_variants"
    ADD CONSTRAINT "component_variants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cost_attribute_types"
    ADD CONSTRAINT "cost_attribute_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cost_item_categories"
    ADD CONSTRAINT "cost_item_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cost_items"
    ADD CONSTRAINT "cost_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."cost_item_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cost_items"
    ADD CONSTRAINT "cost_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cost_items"
    ADD CONSTRAINT "cost_items_unit_code_fkey" FOREIGN KEY ("unit_code") REFERENCES "public"."units"("code");



ALTER TABLE ONLY "public"."email_verification_tokens"
    ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "fk_tenants_created_by_user" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "fk_tenants_subscription_plan" FOREIGN KEY ("subscription_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "fk_user_invitations_role" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."goods_receipt_items"
    ADD CONSTRAINT "goods_receipt_items_cost_item_id_fkey" FOREIGN KEY ("cost_item_id") REFERENCES "public"."cost_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."goods_receipt_items"
    ADD CONSTRAINT "goods_receipt_items_grn_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "public"."goods_receipts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goods_receipt_items"
    ADD CONSTRAINT "goods_receipt_items_unit_code_fkey" FOREIGN KEY ("unit_code") REFERENCES "public"."units"("code");



ALTER TABLE ONLY "public"."goods_receipts"
    ADD CONSTRAINT "goods_receipts_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."goods_receipts"
    ADD CONSTRAINT "goods_receipts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."goods_receipts"
    ADD CONSTRAINT "goods_receipts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goods_receipts"
    ADD CONSTRAINT "goods_receipts_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."lead_activities"
    ADD CONSTRAINT "lead_activities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead_activities"
    ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_documents"
    ADD CONSTRAINT "lead_documents_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_documents"
    ADD CONSTRAINT "lead_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead_family_members"
    ADD CONSTRAINT "lead_family_members_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_notes"
    ADD CONSTRAINT "lead_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead_notes"
    ADD CONSTRAINT "lead_notes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_stage_history"
    ADD CONSTRAINT "lead_stage_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead_stage_history"
    ADD CONSTRAINT "lead_stage_history_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_tasks"
    ADD CONSTRAINT "lead_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead_tasks"
    ADD CONSTRAINT "lead_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lead_tasks"
    ADD CONSTRAINT "lead_tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_won_requests"
    ADD CONSTRAINT "lead_won_requests_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id");



ALTER TABLE ONLY "public"."lead_won_requests"
    ADD CONSTRAINT "lead_won_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."lead_won_requests"
    ADD CONSTRAINT "lead_won_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_approval_requested_by_fkey" FOREIGN KEY ("approval_requested_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_categories"
    ADD CONSTRAINT "material_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."material_presets"
    ADD CONSTRAINT "material_presets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."material_presets"
    ADD CONSTRAINT "material_presets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."material_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ownership_transfers"
    ADD CONSTRAINT "ownership_transfers_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ownership_transfers"
    ADD CONSTRAINT "ownership_transfers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ownership_transfers"
    ADD CONSTRAINT "ownership_transfers_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."password_reset_tokens"
    ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."po_approval_history"
    ADD CONSTRAINT "po_approval_history_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."po_approval_history"
    ADD CONSTRAINT "po_approval_history_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."stock_purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."po_payments"
    ADD CONSTRAINT "po_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."po_payments"
    ADD CONSTRAINT "po_payments_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."stock_purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."po_payments"
    ADD CONSTRAINT "po_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_rules"
    ADD CONSTRAINT "pricing_rules_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."stock_brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_rules"
    ADD CONSTRAINT "pricing_rules_revenue_head_id_fkey" FOREIGN KEY ("revenue_head_id") REFERENCES "public"."revenue_heads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pricing_rules"
    ADD CONSTRAINT "pricing_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_checklist_items"
    ADD CONSTRAINT "project_checklist_items_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_checklist_items"
    ADD CONSTRAINT "project_checklist_items_project_sub_phase_id_fkey" FOREIGN KEY ("project_sub_phase_id") REFERENCES "public"."project_sub_phases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_payment_milestone_templates"
    ADD CONSTRAINT "project_payment_milestone_templa_trigger_phase_template_id_fkey" FOREIGN KEY ("trigger_phase_template_id") REFERENCES "public"."project_phase_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_payment_milestone_templates"
    ADD CONSTRAINT "project_payment_milestone_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_payment_milestones"
    ADD CONSTRAINT "project_payment_milestones_linked_phase_id_fkey" FOREIGN KEY ("linked_phase_id") REFERENCES "public"."project_phases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_payment_milestones"
    ADD CONSTRAINT "project_payment_milestones_milestone_template_id_fkey" FOREIGN KEY ("milestone_template_id") REFERENCES "public"."project_payment_milestone_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_payment_milestones"
    ADD CONSTRAINT "project_payment_milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_activity_log"
    ADD CONSTRAINT "project_phase_activity_log_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."project_phase_activity_log"
    ADD CONSTRAINT "project_phase_activity_log_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_activity_log"
    ADD CONSTRAINT "project_phase_activity_log_project_phase_id_fkey" FOREIGN KEY ("project_phase_id") REFERENCES "public"."project_phases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_activity_log"
    ADD CONSTRAINT "project_phase_activity_log_project_sub_phase_id_fkey" FOREIGN KEY ("project_sub_phase_id") REFERENCES "public"."project_sub_phases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_approvals"
    ADD CONSTRAINT "project_phase_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."project_phase_approvals"
    ADD CONSTRAINT "project_phase_approvals_previous_approval_id_fkey" FOREIGN KEY ("previous_approval_id") REFERENCES "public"."project_phase_approvals"("id");



ALTER TABLE ONLY "public"."project_phase_approvals"
    ADD CONSTRAINT "project_phase_approvals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_approvals"
    ADD CONSTRAINT "project_phase_approvals_project_sub_phase_id_fkey" FOREIGN KEY ("project_sub_phase_id") REFERENCES "public"."project_sub_phases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_approvals"
    ADD CONSTRAINT "project_phase_approvals_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."project_phase_attachments"
    ADD CONSTRAINT "project_phase_attachments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_attachments"
    ADD CONSTRAINT "project_phase_attachments_project_phase_id_fkey" FOREIGN KEY ("project_phase_id") REFERENCES "public"."project_phases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_attachments"
    ADD CONSTRAINT "project_phase_attachments_project_sub_phase_id_fkey" FOREIGN KEY ("project_sub_phase_id") REFERENCES "public"."project_sub_phases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_attachments"
    ADD CONSTRAINT "project_phase_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."project_phase_comments"
    ADD CONSTRAINT "project_phase_comments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."project_phase_comments"
    ADD CONSTRAINT "project_phase_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."project_phase_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_comments"
    ADD CONSTRAINT "project_phase_comments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_comments"
    ADD CONSTRAINT "project_phase_comments_project_phase_id_fkey" FOREIGN KEY ("project_phase_id") REFERENCES "public"."project_phases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_comments"
    ADD CONSTRAINT "project_phase_comments_project_sub_phase_id_fkey" FOREIGN KEY ("project_sub_phase_id") REFERENCES "public"."project_sub_phases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_dependencies"
    ADD CONSTRAINT "project_phase_dependencies_depends_on_phase_id_fkey" FOREIGN KEY ("depends_on_phase_id") REFERENCES "public"."project_phases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_dependencies"
    ADD CONSTRAINT "project_phase_dependencies_project_phase_id_fkey" FOREIGN KEY ("project_phase_id") REFERENCES "public"."project_phases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_dependency_templates"
    ADD CONSTRAINT "project_phase_dependency_temp_depends_on_phase_template_id_fkey" FOREIGN KEY ("depends_on_phase_template_id") REFERENCES "public"."project_phase_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_dependency_templates"
    ADD CONSTRAINT "project_phase_dependency_templates_phase_template_id_fkey" FOREIGN KEY ("phase_template_id") REFERENCES "public"."project_phase_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_dependency_templates"
    ADD CONSTRAINT "project_phase_dependency_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_groups"
    ADD CONSTRAINT "project_phase_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_status_logs"
    ADD CONSTRAINT "project_phase_status_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_phase_status_logs"
    ADD CONSTRAINT "project_phase_status_logs_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "public"."project_phases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_status_logs"
    ADD CONSTRAINT "project_phase_status_logs_sub_phase_id_fkey" FOREIGN KEY ("sub_phase_id") REFERENCES "public"."project_sub_phases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_templates"
    ADD CONSTRAINT "project_phase_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."project_phase_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phase_templates"
    ADD CONSTRAINT "project_phase_templates_phase_group_id_fkey" FOREIGN KEY ("phase_group_id") REFERENCES "public"."project_phase_groups"("id");



ALTER TABLE ONLY "public"."project_phase_templates"
    ADD CONSTRAINT "project_phase_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phases"
    ADD CONSTRAINT "project_phases_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_phases"
    ADD CONSTRAINT "project_phases_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."project_phases"
    ADD CONSTRAINT "project_phases_phase_template_id_fkey" FOREIGN KEY ("phase_template_id") REFERENCES "public"."project_phase_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_phases"
    ADD CONSTRAINT "project_phases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_phases"
    ADD CONSTRAINT "project_phases_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."project_sub_phase_assignees"
    ADD CONSTRAINT "project_sub_phase_assignees_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_sub_phase_assignees"
    ADD CONSTRAINT "project_sub_phase_assignees_sub_phase_id_fkey" FOREIGN KEY ("sub_phase_id") REFERENCES "public"."project_sub_phases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_sub_phase_assignees"
    ADD CONSTRAINT "project_sub_phase_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_sub_phase_templates"
    ADD CONSTRAINT "project_sub_phase_templates_phase_template_id_fkey" FOREIGN KEY ("phase_template_id") REFERENCES "public"."project_phase_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_sub_phase_templates"
    ADD CONSTRAINT "project_sub_phase_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_sub_phases"
    ADD CONSTRAINT "project_sub_phases_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_sub_phases"
    ADD CONSTRAINT "project_sub_phases_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_sub_phases"
    ADD CONSTRAINT "project_sub_phases_project_phase_id_fkey" FOREIGN KEY ("project_phase_id") REFERENCES "public"."project_phases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_sub_phases"
    ADD CONSTRAINT "project_sub_phases_skipped_by_fkey" FOREIGN KEY ("skipped_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."project_sub_phases"
    ADD CONSTRAINT "project_sub_phases_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."project_sub_phases"
    ADD CONSTRAINT "project_sub_phases_sub_phase_template_id_fkey" FOREIGN KEY ("sub_phase_template_id") REFERENCES "public"."project_sub_phase_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_project_manager_id_fkey" FOREIGN KEY ("project_manager_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_sales_rep_id_fkey" FOREIGN KEY ("sales_rep_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_changes"
    ADD CONSTRAINT "quotation_changes_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."quotation_changes"
    ADD CONSTRAINT "quotation_changes_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_components"
    ADD CONSTRAINT "quotation_components_component_type_id_fkey" FOREIGN KEY ("component_type_id") REFERENCES "public"."component_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_components"
    ADD CONSTRAINT "quotation_components_component_variant_id_fkey" FOREIGN KEY ("component_variant_id") REFERENCES "public"."component_variants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_components"
    ADD CONSTRAINT "quotation_components_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_components"
    ADD CONSTRAINT "quotation_components_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."quotation_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_components"
    ADD CONSTRAINT "quotation_components_variant_type_id_fkey" FOREIGN KEY ("variant_type_id") REFERENCES "public"."component_variant_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_cost_attributes"
    ADD CONSTRAINT "quotation_cost_attributes_attribute_type_id_fkey" FOREIGN KEY ("attribute_type_id") REFERENCES "public"."cost_attribute_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_cost_attributes"
    ADD CONSTRAINT "quotation_cost_attributes_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "public"."quotation_components"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_cost_attributes"
    ADD CONSTRAINT "quotation_cost_attributes_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."quotation_materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_cost_attributes"
    ADD CONSTRAINT "quotation_cost_attributes_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_line_items"
    ADD CONSTRAINT "quotation_line_items_cost_item_id_fkey" FOREIGN KEY ("cost_item_id") REFERENCES "public"."cost_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_line_items"
    ADD CONSTRAINT "quotation_line_items_quotation_component_id_fkey" FOREIGN KEY ("quotation_component_id") REFERENCES "public"."quotation_components"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_line_items"
    ADD CONSTRAINT "quotation_line_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_line_items"
    ADD CONSTRAINT "quotation_line_items_quotation_space_id_fkey" FOREIGN KEY ("quotation_space_id") REFERENCES "public"."quotation_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_line_items"
    ADD CONSTRAINT "quotation_line_items_unit_code_fkey" FOREIGN KEY ("unit_code") REFERENCES "public"."units"("code");



ALTER TABLE ONLY "public"."quotation_materials"
    ADD CONSTRAINT "quotation_materials_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."material_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_materials"
    ADD CONSTRAINT "quotation_materials_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "public"."quotation_components"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_materials"
    ADD CONSTRAINT "quotation_materials_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_materials"
    ADD CONSTRAINT "quotation_materials_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_snapshots"
    ADD CONSTRAINT "quotation_snapshots_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."quotation_snapshots"
    ADD CONSTRAINT "quotation_snapshots_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_spaces"
    ADD CONSTRAINT "quotation_spaces_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_spaces"
    ADD CONSTRAINT "quotation_spaces_space_type_id_fkey" FOREIGN KEY ("space_type_id") REFERENCES "public"."space_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotation_templates"
    ADD CONSTRAINT "quotation_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."quotation_templates"
    ADD CONSTRAINT "quotation_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_parent_quotation_id_fkey" FOREIGN KEY ("parent_quotation_id") REFERENCES "public"."quotations"("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."revenue_heads"
    ADD CONSTRAINT "revenue_heads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."space_templates"
    ADD CONSTRAINT "space_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."space_templates"
    ADD CONSTRAINT "space_templates_space_type_id_fkey" FOREIGN KEY ("space_type_id") REFERENCES "public"."space_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."space_templates"
    ADD CONSTRAINT "space_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."space_types"
    ADD CONSTRAINT "space_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_adjustment_items"
    ADD CONSTRAINT "stock_adjustment_items_adjustment_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "public"."stock_adjustments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_adjustment_items"
    ADD CONSTRAINT "stock_adjustment_items_cost_item_id_fkey" FOREIGN KEY ("cost_item_id") REFERENCES "public"."cost_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."stock_adjustment_items"
    ADD CONSTRAINT "stock_adjustment_items_unit_code_fkey" FOREIGN KEY ("unit_code") REFERENCES "public"."units"("code");



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_brands"
    ADD CONSTRAINT "stock_brands_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_goods_receipt_items"
    ADD CONSTRAINT "stock_goods_receipt_items_grn_id_fkey" FOREIGN KEY ("grn_id") REFERENCES "public"."stock_goods_receipts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_goods_receipt_items"
    ADD CONSTRAINT "stock_goods_receipt_items_po_item_id_fkey" FOREIGN KEY ("po_item_id") REFERENCES "public"."stock_purchase_order_items"("id");



ALTER TABLE ONLY "public"."stock_goods_receipts"
    ADD CONSTRAINT "stock_goods_receipts_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."stock_purchase_orders"("id");



ALTER TABLE ONLY "public"."stock_goods_receipts"
    ADD CONSTRAINT "stock_goods_receipts_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_goods_receipts"
    ADD CONSTRAINT "stock_goods_receipts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_issue_items"
    ADD CONSTRAINT "stock_issue_items_cost_item_id_fkey" FOREIGN KEY ("cost_item_id") REFERENCES "public"."cost_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."stock_issue_items"
    ADD CONSTRAINT "stock_issue_items_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "public"."stock_issues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_issue_items"
    ADD CONSTRAINT "stock_issue_items_unit_code_fkey" FOREIGN KEY ("unit_code") REFERENCES "public"."units"("code");



ALTER TABLE ONLY "public"."stock_issues"
    ADD CONSTRAINT "stock_issues_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_issues"
    ADD CONSTRAINT "stock_issues_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_issues"
    ADD CONSTRAINT "stock_issues_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_issues"
    ADD CONSTRAINT "stock_issues_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_material_requisition_items"
    ADD CONSTRAINT "stock_material_requisition_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."stock_materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_material_requisition_items"
    ADD CONSTRAINT "stock_material_requisition_items_mr_id_fkey" FOREIGN KEY ("mr_id") REFERENCES "public"."stock_material_requisitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_material_requisitions"
    ADD CONSTRAINT "stock_material_requisitions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_material_requisitions"
    ADD CONSTRAINT "stock_material_requisitions_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_material_requisitions"
    ADD CONSTRAINT "stock_material_requisitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_materials"
    ADD CONSTRAINT "stock_materials_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_materials"
    ADD CONSTRAINT "stock_materials_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_materials"
    ADD CONSTRAINT "stock_materials_preferred_vendor_id_fkey" FOREIGN KEY ("preferred_vendor_id") REFERENCES "public"."stock_vendors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."stock_materials"("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_purchase_order_items"
    ADD CONSTRAINT "stock_purchase_order_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."stock_materials"("id");



ALTER TABLE ONLY "public"."stock_purchase_order_items"
    ADD CONSTRAINT "stock_purchase_order_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "public"."stock_purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_purchase_order_items"
    ADD CONSTRAINT "stock_purchase_order_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_purchase_orders"
    ADD CONSTRAINT "stock_purchase_orders_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_purchase_orders"
    ADD CONSTRAINT "stock_purchase_orders_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_purchase_orders"
    ADD CONSTRAINT "stock_purchase_orders_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_purchase_orders"
    ADD CONSTRAINT "stock_purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_purchase_orders"
    ADD CONSTRAINT "stock_purchase_orders_mr_id_fkey" FOREIGN KEY ("mr_id") REFERENCES "public"."stock_material_requisitions"("id");



ALTER TABLE ONLY "public"."stock_purchase_orders"
    ADD CONSTRAINT "stock_purchase_orders_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_purchase_orders"
    ADD CONSTRAINT "stock_purchase_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_purchase_orders"
    ADD CONSTRAINT "stock_purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."stock_vendors"("id");



ALTER TABLE ONLY "public"."stock_vendor_brands"
    ADD CONSTRAINT "stock_vendor_brands_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."stock_brands"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_vendor_brands"
    ADD CONSTRAINT "stock_vendor_brands_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_vendor_brands"
    ADD CONSTRAINT "stock_vendor_brands_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."stock_vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_vendor_materials"
    ADD CONSTRAINT "stock_vendor_materials_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."stock_materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_vendor_materials"
    ADD CONSTRAINT "stock_vendor_materials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_vendor_materials"
    ADD CONSTRAINT "stock_vendor_materials_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."stock_vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_vendors"
    ADD CONSTRAINT "stock_vendors_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."stock_vendors"
    ADD CONSTRAINT "stock_vendors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sub_phase_completion_requirements"
    ADD CONSTRAINT "sub_phase_completion_requirements_project_sub_phase_id_fkey" FOREIGN KEY ("project_sub_phase_id") REFERENCES "public"."project_sub_phases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sub_phase_completion_requirements"
    ADD CONSTRAINT "sub_phase_completion_requirements_satisfied_by_fkey" FOREIGN KEY ("satisfied_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."subscription_addons"
    ADD CONSTRAINT "subscription_addons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_change_requests"
    ADD CONSTRAINT "subscription_change_requests_from_plan_id_fkey" FOREIGN KEY ("from_plan_id") REFERENCES "public"."subscription_plans"("id");



ALTER TABLE ONLY "public"."subscription_change_requests"
    ADD CONSTRAINT "subscription_change_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."subscription_change_requests"
    ADD CONSTRAINT "subscription_change_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_change_requests"
    ADD CONSTRAINT "subscription_change_requests_to_plan_id_fkey" FOREIGN KEY ("to_plan_id") REFERENCES "public"."subscription_plans"("id");



ALTER TABLE ONLY "public"."subscription_invoices"
    ADD CONSTRAINT "subscription_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_plan_features"
    ADD CONSTRAINT "subscription_plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_activities"
    ADD CONSTRAINT "task_activities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_activities"
    ADD CONSTRAINT "task_activities_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_attachments"
    ADD CONSTRAINT "task_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_attachments"
    ADD CONSTRAINT "task_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."task_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_tag_assignments"
    ADD CONSTRAINT "task_tag_assignments_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."task_tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_tag_assignments"
    ADD CONSTRAINT "task_tag_assignments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_tags"
    ADD CONSTRAINT "task_tags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_tags"
    ADD CONSTRAINT "task_tags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_template_items"
    ADD CONSTRAINT "task_template_items_assign_to_user_id_fkey" FOREIGN KEY ("assign_to_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_template_items"
    ADD CONSTRAINT "task_template_items_parent_item_id_fkey" FOREIGN KEY ("parent_item_id") REFERENCES "public"."task_template_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_template_items"
    ADD CONSTRAINT "task_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."task_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_templates"
    ADD CONSTRAINT "task_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_templates"
    ADD CONSTRAINT "task_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_templates"
    ADD CONSTRAINT "task_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."task_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_template_item_id_fkey" FOREIGN KEY ("template_item_id") REFERENCES "public"."task_template_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."template_line_items"
    ADD CONSTRAINT "template_line_items_component_type_id_fkey" FOREIGN KEY ("component_type_id") REFERENCES "public"."component_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."template_line_items"
    ADD CONSTRAINT "template_line_items_component_variant_id_fkey" FOREIGN KEY ("component_variant_id") REFERENCES "public"."component_variants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."template_line_items"
    ADD CONSTRAINT "template_line_items_cost_item_id_fkey" FOREIGN KEY ("cost_item_id") REFERENCES "public"."cost_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_line_items"
    ADD CONSTRAINT "template_line_items_space_type_id_fkey" FOREIGN KEY ("space_type_id") REFERENCES "public"."space_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."template_line_items"
    ADD CONSTRAINT "template_line_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."quotation_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_spaces"
    ADD CONSTRAINT "template_spaces_space_type_id_fkey" FOREIGN KEY ("space_type_id") REFERENCES "public"."space_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_spaces"
    ADD CONSTRAINT "template_spaces_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."quotation_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_lead_settings"
    ADD CONSTRAINT "tenant_lead_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_payment_methods"
    ADD CONSTRAINT "tenant_payment_methods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_settings"
    ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_stock_settings"
    ADD CONSTRAINT "tenant_stock_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_stock_settings"
    ADD CONSTRAINT "tenant_stock_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tenant_subscriptions"
    ADD CONSTRAINT "tenant_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."tenant_subscriptions"
    ADD CONSTRAINT "tenant_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_usage_history"
    ADD CONSTRAINT "tenant_usage_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_usage"
    ADD CONSTRAINT "tenant_usage_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_removed_by_fkey" FOREIGN KEY ("removed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_invitations"
    ADD CONSTRAINT "user_invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_primary_tenant_id_fkey" FOREIGN KEY ("primary_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete tenant roles" ON "public"."roles" FOR DELETE USING (("public"."is_admin_or_higher"() AND ("tenant_id" = ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))) AND ("is_system_role" = false)));



CREATE POLICY "Admins can manage approval configs" ON "public"."approval_configs" USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Admins can manage tenant roles" ON "public"."roles" FOR INSERT WITH CHECK (("public"."is_admin_or_higher"() AND ("tenant_id" = ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))));



CREATE POLICY "Admins can manage tenant settings" ON "public"."tenant_settings" USING (("tenant_id" IN ( SELECT "u"."tenant_id"
   FROM (("public"."users" "u"
     JOIN "public"."user_roles" "ur" ON (("ur"."user_id" = "u"."id")))
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")))
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."is_super_admin" = true) OR (("r"."slug")::"text" = ANY ((ARRAY['admin'::character varying, 'super-admin'::character varying])::"text"[])))))));



CREATE POLICY "Admins can update tenant roles" ON "public"."roles" FOR UPDATE USING (("public"."is_admin_or_higher"() AND ("tenant_id" = ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))) AND ("is_system_role" = false)));



CREATE POLICY "Admins can view audit logs" ON "public"."audit_logs" FOR SELECT USING (("tenant_id" IN ( SELECT "u"."tenant_id"
   FROM (("public"."users" "u"
     JOIN "public"."user_roles" "ur" ON (("ur"."user_id" = "u"."id")))
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")))
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."is_super_admin" = true) OR (("r"."slug")::"text" = ANY ((ARRAY['admin'::character varying, 'super-admin'::character varying])::"text"[])))))));



CREATE POLICY "Anyone can read permissions" ON "public"."permissions" FOR SELECT USING (true);



CREATE POLICY "Anyone can read role permissions" ON "public"."role_permissions" FOR SELECT USING (true);



CREATE POLICY "Anyone can read system roles" ON "public"."roles" FOR SELECT USING (("is_system_role" = true));



CREATE POLICY "Create status logs" ON "public"."project_phase_status_logs" FOR INSERT WITH CHECK ((("phase_id" IN ( SELECT "pp"."id"
   FROM ("public"."project_phases" "pp"
     JOIN "public"."projects" "p" ON (("pp"."project_id" = "p"."id")))
  WHERE ("p"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))) OR ("sub_phase_id" IN ( SELECT "psp"."id"
   FROM (("public"."project_sub_phases" "psp"
     JOIN "public"."project_phases" "pp" ON (("psp"."project_phase_id" = "pp"."id")))
     JOIN "public"."projects" "p" ON (("pp"."project_id" = "p"."id")))
  WHERE ("p"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"())))))));



CREATE POLICY "Insert phase activity" ON "public"."project_phase_activity_log" FOR INSERT WITH CHECK (("project_id" IN ( SELECT "p"."id"
   FROM ("public"."projects" "p"
     JOIN "public"."users" "u" ON (("p"."tenant_id" = "u"."tenant_id")))
  WHERE ("u"."id" = "auth"."uid"()))));



CREATE POLICY "Involved users can update ownership transfer" ON "public"."ownership_transfers" FOR UPDATE USING ((("from_user_id" = "auth"."uid"()) OR ("to_user_id" = "auth"."uid"())));



CREATE POLICY "Manage checklist items" ON "public"."project_checklist_items" USING (("project_sub_phase_id" IN ( SELECT "psp"."id"
   FROM (("public"."project_sub_phases" "psp"
     JOIN "public"."project_phases" "pp" ON (("psp"."project_phase_id" = "pp"."id")))
     JOIN "public"."projects" "p" ON (("pp"."project_id" = "p"."id")))
  WHERE ("p"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Manage completion requirements" ON "public"."sub_phase_completion_requirements" USING (("project_sub_phase_id" IN ( SELECT "psp"."id"
   FROM (("public"."project_sub_phases" "psp"
     JOIN "public"."project_phases" "pp" ON (("psp"."project_phase_id" = "pp"."id")))
     JOIN "public"."projects" "p" ON (("pp"."project_id" = "p"."id")))
  WHERE ("p"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Manage dependency templates" ON "public"."project_phase_dependency_templates" USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Manage payment milestone templates" ON "public"."project_payment_milestone_templates" USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Manage payment milestones" ON "public"."project_payment_milestones" USING (("project_id" IN ( SELECT "projects"."id"
   FROM "public"."projects"
  WHERE ("projects"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Manage phase approvals" ON "public"."project_phase_approvals" USING (("project_id" IN ( SELECT "p"."id"
   FROM ("public"."projects" "p"
     JOIN "public"."users" "u" ON (("p"."tenant_id" = "u"."tenant_id")))
  WHERE ("u"."id" = "auth"."uid"()))));



CREATE POLICY "Manage phase attachments" ON "public"."project_phase_attachments" USING (("project_id" IN ( SELECT "p"."id"
   FROM ("public"."projects" "p"
     JOIN "public"."users" "u" ON (("p"."tenant_id" = "u"."tenant_id")))
  WHERE ("u"."id" = "auth"."uid"()))));



CREATE POLICY "Manage phase comments" ON "public"."project_phase_comments" USING (("project_id" IN ( SELECT "p"."id"
   FROM ("public"."projects" "p"
     JOIN "public"."users" "u" ON (("p"."tenant_id" = "u"."tenant_id")))
  WHERE ("u"."id" = "auth"."uid"()))));



CREATE POLICY "Manage phase dependencies" ON "public"."project_phase_dependencies" USING (("project_phase_id" IN ( SELECT "pp"."id"
   FROM ("public"."project_phases" "pp"
     JOIN "public"."projects" "p" ON (("pp"."project_id" = "p"."id")))
  WHERE ("p"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Manage phase templates" ON "public"."project_phase_templates" USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Manage project phases" ON "public"."project_phases" USING (("project_id" IN ( SELECT "projects"."id"
   FROM "public"."projects"
  WHERE ("projects"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Manage project sub-phases" ON "public"."project_sub_phases" USING (("project_phase_id" IN ( SELECT "pp"."id"
   FROM ("public"."project_phases" "pp"
     JOIN "public"."projects" "p" ON (("pp"."project_id" = "p"."id")))
  WHERE ("p"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Manage sub-phase assignees" ON "public"."project_sub_phase_assignees" USING (("sub_phase_id" IN ( SELECT "psp"."id"
   FROM (("public"."project_sub_phases" "psp"
     JOIN "public"."project_phases" "pp" ON (("psp"."project_phase_id" = "pp"."id")))
     JOIN "public"."projects" "p" ON (("pp"."project_id" = "p"."id")))
  WHERE ("p"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Manage sub-phase templates" ON "public"."project_sub_phase_templates" USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Owner can create ownership transfer" ON "public"."ownership_transfers" FOR INSERT WITH CHECK ((("from_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."slug")::"text" = 'owner'::"text") AND (("r"."tenant_id" IS NULL) OR ("r"."tenant_id" = "r"."tenant_id")))))));



CREATE POLICY "Plan features are viewable by everyone" ON "public"."subscription_plan_features" FOR SELECT USING (true);



CREATE POLICY "Service role full access to tenant_users" ON "public"."tenant_users" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Subscription plans are viewable by everyone" ON "public"."subscription_plans" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Super admins can manage subscription" ON "public"."tenant_subscriptions" USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_super_admin" = true)))));



CREATE POLICY "System can create notifications" ON "public"."notifications" FOR INSERT WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"()));



CREATE POLICY "System can insert activity logs" ON "public"."activity_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert audit logs" ON "public"."audit_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can add PO history in their tenant" ON "public"."po_approval_history" FOR INSERT WITH CHECK (("po_id" IN ( SELECT "stock_purchase_orders"."id"
   FROM "public"."stock_purchase_orders"
  WHERE ("stock_purchase_orders"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can create invitations" ON "public"."user_invitations" FOR INSERT WITH CHECK (("tenant_id" = ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can create tenant variant types" ON "public"."component_variant_types" FOR INSERT WITH CHECK (("tenant_id" = ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete component variants of their tenant" ON "public"."component_variants" FOR DELETE USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete cost item categories of their tenant" ON "public"."cost_item_categories" FOR DELETE USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete cost items of their tenant" ON "public"."cost_items" FOR DELETE USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete materials in their company" ON "public"."stock_materials" FOR DELETE USING (("company_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete quotation line items of their tenant" ON "public"."quotation_line_items" FOR DELETE USING (("quotation_id" IN ( SELECT "quotations"."id"
   FROM "public"."quotations"
  WHERE ("quotations"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete template line items of their tenant" ON "public"."template_line_items" FOR DELETE USING (("template_id" IN ( SELECT "quotation_templates"."id"
   FROM "public"."quotation_templates"
  WHERE ("quotation_templates"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete template spaces of their tenant" ON "public"."template_spaces" FOR DELETE USING (("template_id" IN ( SELECT "quotation_templates"."id"
   FROM "public"."quotation_templates"
  WHERE ("quotation_templates"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete tenant invitations" ON "public"."user_invitations" FOR DELETE USING (("tenant_id" = ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete tenant variant types" ON "public"."component_variant_types" FOR DELETE USING (("tenant_id" = ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can delete vendors in their tenant" ON "public"."stock_vendors" FOR DELETE USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert component variants for their tenant" ON "public"."component_variants" FOR INSERT WITH CHECK (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert cost item categories for their tenant" ON "public"."cost_item_categories" FOR INSERT WITH CHECK (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert cost items for their tenant" ON "public"."cost_items" FOR INSERT WITH CHECK (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert materials in their company" ON "public"."stock_materials" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert quotation line items for their tenant" ON "public"."quotation_line_items" FOR INSERT WITH CHECK (("quotation_id" IN ( SELECT "quotations"."id"
   FROM "public"."quotations"
  WHERE ("quotations"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert template line items for their tenant" ON "public"."template_line_items" FOR INSERT WITH CHECK (("template_id" IN ( SELECT "quotation_templates"."id"
   FROM "public"."quotation_templates"
  WHERE ("quotation_templates"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert template spaces for their tenant" ON "public"."template_spaces" FOR INSERT WITH CHECK (("template_id" IN ( SELECT "quotation_templates"."id"
   FROM "public"."quotation_templates"
  WHERE ("quotation_templates"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert vendors in their tenant" ON "public"."stock_vendors" FOR INSERT WITH CHECK (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage GRN items" ON "public"."stock_goods_receipt_items" USING (("grn_id" IN ( SELECT "stock_goods_receipts"."id"
   FROM "public"."stock_goods_receipts"
  WHERE ("stock_goods_receipts"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage GRNs in their tenant" ON "public"."stock_goods_receipts" USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage MR items" ON "public"."stock_material_requisition_items" USING (("mr_id" IN ( SELECT "stock_material_requisitions"."id"
   FROM "public"."stock_material_requisitions"
  WHERE ("stock_material_requisitions"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage PO items" ON "public"."stock_purchase_order_items" USING (("po_id" IN ( SELECT "stock_purchase_orders"."id"
   FROM "public"."stock_purchase_orders"
  WHERE ("stock_purchase_orders"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage PO payments in their tenant" ON "public"."po_payments" USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage POs in their tenant" ON "public"."stock_purchase_orders" USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage brands in their tenant" ON "public"."stock_brands" USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage commission items in their tenant" ON "public"."commission_items" USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage movements in their tenant" ON "public"."stock_movements" USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage own preferences" ON "public"."notification_preferences" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage pricing rules in their tenant" ON "public"."pricing_rules" USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage projects in their tenant" ON "public"."projects" USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage requisitions in their tenant" ON "public"."stock_material_requisitions" USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage revenue heads in their tenant" ON "public"."revenue_heads" USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage vendor brands in their tenant" ON "public"."stock_vendor_brands" USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can manage vendor materials in their tenant" ON "public"."stock_vendor_materials" USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can read own record" ON "public"."users" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can read own roles" ON "public"."user_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read tenant invitations" ON "public"."user_invitations" FOR SELECT USING (("tenant_id" = ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update component variants of their tenant" ON "public"."component_variants" FOR UPDATE USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update cost item categories of their tenant" ON "public"."cost_item_categories" FOR UPDATE USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update cost items of their tenant" ON "public"."cost_items" FOR UPDATE USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update materials in their company" ON "public"."stock_materials" FOR UPDATE USING (("company_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own record" ON "public"."users" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can update own tenant" ON "public"."tenants" FOR UPDATE USING (("id" = ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))) WITH CHECK (("id" = ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update quotation line items of their tenant" ON "public"."quotation_line_items" FOR UPDATE USING (("quotation_id" IN ( SELECT "quotations"."id"
   FROM "public"."quotations"
  WHERE ("quotations"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update template line items of their tenant" ON "public"."template_line_items" FOR UPDATE USING (("template_id" IN ( SELECT "quotation_templates"."id"
   FROM "public"."quotation_templates"
  WHERE ("quotation_templates"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update template spaces of their tenant" ON "public"."template_spaces" FOR UPDATE USING (("template_id" IN ( SELECT "quotation_templates"."id"
   FROM "public"."quotation_templates"
  WHERE ("quotation_templates"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can update tenant invitations" ON "public"."user_invitations" FOR UPDATE USING (("tenant_id" = ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))) WITH CHECK (("tenant_id" = ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update tenant variant types" ON "public"."component_variant_types" FOR UPDATE USING (("tenant_id" = ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))) WITH CHECK (("tenant_id" = ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can update vendors in their tenant" ON "public"."stock_vendors" FOR UPDATE USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view GRN items" ON "public"."stock_goods_receipt_items" FOR SELECT USING (("grn_id" IN ( SELECT "stock_goods_receipts"."id"
   FROM "public"."stock_goods_receipts"
  WHERE ("stock_goods_receipts"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view GRNs in their tenant" ON "public"."stock_goods_receipts" FOR SELECT USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view MR items" ON "public"."stock_material_requisition_items" FOR SELECT USING (("mr_id" IN ( SELECT "stock_material_requisitions"."id"
   FROM "public"."stock_material_requisitions"
  WHERE ("stock_material_requisitions"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view PO history in their tenant" ON "public"."po_approval_history" FOR SELECT USING (("po_id" IN ( SELECT "stock_purchase_orders"."id"
   FROM "public"."stock_purchase_orders"
  WHERE ("stock_purchase_orders"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view PO items" ON "public"."stock_purchase_order_items" FOR SELECT USING (("po_id" IN ( SELECT "stock_purchase_orders"."id"
   FROM "public"."stock_purchase_orders"
  WHERE ("stock_purchase_orders"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view PO payments in their tenant" ON "public"."po_payments" FOR SELECT USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view POs in their tenant" ON "public"."stock_purchase_orders" FOR SELECT USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view activity logs" ON "public"."activity_logs" FOR SELECT USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view approval configs in their tenant" ON "public"."approval_configs" FOR SELECT USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view brands in their tenant" ON "public"."stock_brands" FOR SELECT USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view commission items in their tenant" ON "public"."commission_items" FOR SELECT USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view component variants of their tenant" ON "public"."component_variants" FOR SELECT USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view cost item categories of their tenant" ON "public"."cost_item_categories" FOR SELECT USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view cost items of their tenant" ON "public"."cost_items" FOR SELECT USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view materials in their company" ON "public"."stock_materials" FOR SELECT USING (("company_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view movements in their tenant" ON "public"."stock_movements" FOR SELECT USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view own memberships" ON "public"."tenant_users" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own preferences" ON "public"."notification_preferences" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own tenant" ON "public"."tenants" FOR SELECT USING (true);



CREATE POLICY "Users can view pricing rules in their tenant" ON "public"."pricing_rules" FOR SELECT USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view projects in their tenant" ON "public"."projects" FOR SELECT USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view quotation line items of their tenant" ON "public"."quotation_line_items" FOR SELECT USING (("quotation_id" IN ( SELECT "quotations"."id"
   FROM "public"."quotations"
  WHERE ("quotations"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view requisitions in their tenant" ON "public"."stock_material_requisitions" FOR SELECT USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view revenue heads in their tenant" ON "public"."revenue_heads" FOR SELECT USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view template line items of their tenant" ON "public"."template_line_items" FOR SELECT USING (("template_id" IN ( SELECT "quotation_templates"."id"
   FROM "public"."quotation_templates"
  WHERE ("quotation_templates"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view template spaces of their tenant" ON "public"."template_spaces" FOR SELECT USING (("template_id" IN ( SELECT "quotation_templates"."id"
   FROM "public"."quotation_templates"
  WHERE ("quotation_templates"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Users can view tenant memberships" ON "public"."tenant_users" FOR SELECT USING (("tenant_id" IN ( SELECT "tenant_users_1"."tenant_id"
   FROM "public"."tenant_users" "tenant_users_1"
  WHERE (("tenant_users_1"."user_id" = "auth"."uid"()) AND ("tenant_users_1"."is_active" = true)))));



CREATE POLICY "Users can view tenant settings" ON "public"."tenant_settings" FOR SELECT USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view tenant subscription" ON "public"."tenant_subscriptions" FOR SELECT USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view tenant variant types" ON "public"."component_variant_types" FOR SELECT USING (("tenant_id" = ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own ownership transfers" ON "public"."ownership_transfers" FOR SELECT USING ((("from_user_id" = "auth"."uid"()) OR ("to_user_id" = "auth"."uid"())));



CREATE POLICY "Users can view vendor brands in their tenant" ON "public"."stock_vendor_brands" FOR SELECT USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view vendor materials in their tenant" ON "public"."stock_vendor_materials" FOR SELECT USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view vendors in their tenant" ON "public"."stock_vendors" FOR SELECT USING (("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "View checklist items" ON "public"."project_checklist_items" FOR SELECT USING (("project_sub_phase_id" IN ( SELECT "psp"."id"
   FROM (("public"."project_sub_phases" "psp"
     JOIN "public"."project_phases" "pp" ON (("psp"."project_phase_id" = "pp"."id")))
     JOIN "public"."projects" "p" ON (("pp"."project_id" = "p"."id")))
  WHERE ("p"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "View completion requirements" ON "public"."sub_phase_completion_requirements" FOR SELECT USING (("project_sub_phase_id" IN ( SELECT "psp"."id"
   FROM (("public"."project_sub_phases" "psp"
     JOIN "public"."project_phases" "pp" ON (("psp"."project_phase_id" = "pp"."id")))
     JOIN "public"."projects" "p" ON (("pp"."project_id" = "p"."id")))
  WHERE ("p"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "View dependency templates" ON "public"."project_phase_dependency_templates" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))));



CREATE POLICY "View payment milestone templates" ON "public"."project_payment_milestone_templates" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))));



CREATE POLICY "View payment milestones" ON "public"."project_payment_milestones" FOR SELECT USING (("project_id" IN ( SELECT "projects"."id"
   FROM "public"."projects"
  WHERE ("projects"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "View phase activity" ON "public"."project_phase_activity_log" FOR SELECT USING (("project_id" IN ( SELECT "p"."id"
   FROM ("public"."projects" "p"
     JOIN "public"."users" "u" ON (("p"."tenant_id" = "u"."tenant_id")))
  WHERE ("u"."id" = "auth"."uid"()))));



CREATE POLICY "View phase approvals" ON "public"."project_phase_approvals" FOR SELECT USING (("project_id" IN ( SELECT "p"."id"
   FROM ("public"."projects" "p"
     JOIN "public"."users" "u" ON (("p"."tenant_id" = "u"."tenant_id")))
  WHERE ("u"."id" = "auth"."uid"()))));



CREATE POLICY "View phase attachments" ON "public"."project_phase_attachments" FOR SELECT USING (("project_id" IN ( SELECT "p"."id"
   FROM ("public"."projects" "p"
     JOIN "public"."users" "u" ON (("p"."tenant_id" = "u"."tenant_id")))
  WHERE ("u"."id" = "auth"."uid"()))));



CREATE POLICY "View phase comments" ON "public"."project_phase_comments" FOR SELECT USING (("project_id" IN ( SELECT "p"."id"
   FROM ("public"."projects" "p"
     JOIN "public"."users" "u" ON (("p"."tenant_id" = "u"."tenant_id")))
  WHERE ("u"."id" = "auth"."uid"()))));



CREATE POLICY "View phase dependencies" ON "public"."project_phase_dependencies" FOR SELECT USING (("project_phase_id" IN ( SELECT "pp"."id"
   FROM ("public"."project_phases" "pp"
     JOIN "public"."projects" "p" ON (("pp"."project_id" = "p"."id")))
  WHERE ("p"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "View phase groups" ON "public"."project_phase_groups" FOR SELECT USING (true);



CREATE POLICY "View phase templates" ON "public"."project_phase_templates" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))));



CREATE POLICY "View project phases" ON "public"."project_phases" FOR SELECT USING (("project_id" IN ( SELECT "projects"."id"
   FROM "public"."projects"
  WHERE ("projects"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "View project sub-phases" ON "public"."project_sub_phases" FOR SELECT USING (("project_phase_id" IN ( SELECT "pp"."id"
   FROM ("public"."project_phases" "pp"
     JOIN "public"."projects" "p" ON (("pp"."project_id" = "p"."id")))
  WHERE ("p"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "View status logs" ON "public"."project_phase_status_logs" FOR SELECT USING ((("phase_id" IN ( SELECT "pp"."id"
   FROM ("public"."project_phases" "pp"
     JOIN "public"."projects" "p" ON (("pp"."project_id" = "p"."id")))
  WHERE ("p"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))) OR ("sub_phase_id" IN ( SELECT "psp"."id"
   FROM (("public"."project_sub_phases" "psp"
     JOIN "public"."project_phases" "pp" ON (("psp"."project_phase_id" = "pp"."id")))
     JOIN "public"."projects" "p" ON (("pp"."project_id" = "p"."id")))
  WHERE ("p"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"())))))));



CREATE POLICY "View sub-phase assignees" ON "public"."project_sub_phase_assignees" FOR SELECT USING (("sub_phase_id" IN ( SELECT "psp"."id"
   FROM (("public"."project_sub_phases" "psp"
     JOIN "public"."project_phases" "pp" ON (("psp"."project_phase_id" = "pp"."id")))
     JOIN "public"."projects" "p" ON (("pp"."project_id" = "p"."id")))
  WHERE ("p"."tenant_id" IN ( SELECT "users"."tenant_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "View sub-phase templates" ON "public"."project_sub_phase_templates" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" IN ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))));



ALTER TABLE "public"."activity_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "adjustment_items_tenant_isolation" ON "public"."stock_adjustment_items" USING (("adjustment_id" IN ( SELECT "stock_adjustments"."id"
   FROM "public"."stock_adjustments"
  WHERE ("stock_adjustments"."tenant_id" = "public"."get_user_tenant_id"()))));



ALTER TABLE "public"."approval_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commission_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."component_variant_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."component_variants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cost_item_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cost_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_verification_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goods_receipt_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goods_receipts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "goods_receipts_tenant_isolation" ON "public"."goods_receipts" USING (("tenant_id" = "public"."get_user_tenant_id"()));



CREATE POLICY "grn_items_tenant_isolation" ON "public"."goods_receipt_items" USING (("grn_id" IN ( SELECT "goods_receipts"."id"
   FROM "public"."goods_receipts"
  WHERE ("goods_receipts"."tenant_id" = "public"."get_user_tenant_id"()))));



CREATE POLICY "issue_items_tenant_isolation" ON "public"."stock_issue_items" USING (("issue_id" IN ( SELECT "stock_issues"."id"
   FROM "public"."stock_issues"
  WHERE ("stock_issues"."tenant_id" = "public"."get_user_tenant_id"()))));



ALTER TABLE "public"."lead_activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_activities_access" ON "public"."lead_activities" USING ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE (("leads"."id" = "lead_activities"."lead_id") AND ("leads"."tenant_id" = "public"."get_user_tenant_id"())))));



ALTER TABLE "public"."lead_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_documents_access" ON "public"."lead_documents" USING ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE (("leads"."id" = "lead_documents"."lead_id") AND ("leads"."tenant_id" = "public"."get_user_tenant_id"())))));



ALTER TABLE "public"."lead_family_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_family_members_access" ON "public"."lead_family_members" USING ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE (("leads"."id" = "lead_family_members"."lead_id") AND ("leads"."tenant_id" = "public"."get_user_tenant_id"())))));



ALTER TABLE "public"."lead_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_notes_access" ON "public"."lead_notes" USING ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE (("leads"."id" = "lead_notes"."lead_id") AND ("leads"."tenant_id" = "public"."get_user_tenant_id"())))));



ALTER TABLE "public"."lead_stage_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_stage_history_access" ON "public"."lead_stage_history" USING ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE (("leads"."id" = "lead_stage_history"."lead_id") AND ("leads"."tenant_id" = "public"."get_user_tenant_id"())))));



ALTER TABLE "public"."lead_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_tasks_access" ON "public"."lead_tasks" USING ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE (("leads"."id" = "lead_tasks"."lead_id") AND ("leads"."tenant_id" = "public"."get_user_tenant_id"())))));



ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leads_tenant_isolation" ON "public"."leads" USING (("tenant_id" = "public"."get_user_tenant_id"()));



ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ownership_transfers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."password_reset_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."po_approval_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."po_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_checklist_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_payment_milestone_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_payment_milestones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_phase_activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_phase_approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_phase_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_phase_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_phase_dependencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_phase_dependency_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_phase_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_phase_status_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_phase_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_phases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_sub_phase_assignees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_sub_phase_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_sub_phases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotation_components" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quotation_components_tenant_isolation" ON "public"."quotation_components" USING (("quotation_id" IN ( SELECT "quotations"."id"
   FROM "public"."quotations"
  WHERE ("quotations"."tenant_id" = "public"."get_user_tenant_id"()))));



ALTER TABLE "public"."quotation_cost_attributes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quotation_cost_attributes_tenant_isolation" ON "public"."quotation_cost_attributes" USING (("quotation_id" IN ( SELECT "quotations"."id"
   FROM "public"."quotations"
  WHERE ("quotations"."tenant_id" = "public"."get_user_tenant_id"()))));



ALTER TABLE "public"."quotation_line_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotation_materials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quotation_materials_tenant_isolation" ON "public"."quotation_materials" USING (("quotation_id" IN ( SELECT "quotations"."id"
   FROM "public"."quotations"
  WHERE ("quotations"."tenant_id" = "public"."get_user_tenant_id"()))));



ALTER TABLE "public"."quotation_spaces" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quotation_spaces_tenant_isolation" ON "public"."quotation_spaces" USING (("quotation_id" IN ( SELECT "quotations"."id"
   FROM "public"."quotations"
  WHERE ("quotations"."tenant_id" = "public"."get_user_tenant_id"()))));



ALTER TABLE "public"."quotations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quotations_tenant_isolation" ON "public"."quotations" USING (("tenant_id" = "public"."get_user_tenant_id"()));



ALTER TABLE "public"."revenue_heads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_adjustment_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_adjustments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_adjustments_tenant_isolation" ON "public"."stock_adjustments" USING (("tenant_id" = "public"."get_user_tenant_id"()));



ALTER TABLE "public"."stock_brands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_goods_receipt_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_goods_receipts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_issue_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_issues" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_issues_tenant_isolation" ON "public"."stock_issues" USING (("tenant_id" = "public"."get_user_tenant_id"()));



ALTER TABLE "public"."stock_material_requisition_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_material_requisitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_materials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_purchase_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_purchase_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_vendor_brands" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_vendor_materials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stock_vendors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sub_phase_completion_requirements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_addons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_change_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscription_change_requests_select" ON "public"."subscription_change_requests" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"()));



ALTER TABLE "public"."subscription_invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscription_invoices_select" ON "public"."subscription_invoices" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"()));



ALTER TABLE "public"."subscription_plan_features" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscription_plan_features_select" ON "public"."subscription_plan_features" FOR SELECT USING (true);



ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscription_plans_select" ON "public"."subscription_plans" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."system_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_activities_access" ON "public"."task_activities" USING (("task_id" IN ( SELECT "tasks"."id"
   FROM "public"."tasks"
  WHERE ("tasks"."tenant_id" = "public"."get_user_tenant_id"()))));



ALTER TABLE "public"."task_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_attachments_access" ON "public"."task_attachments" USING (("task_id" IN ( SELECT "tasks"."id"
   FROM "public"."tasks"
  WHERE ("tasks"."tenant_id" = "public"."get_user_tenant_id"()))));



ALTER TABLE "public"."task_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_comments_access" ON "public"."task_comments" USING (("task_id" IN ( SELECT "tasks"."id"
   FROM "public"."tasks"
  WHERE ("tasks"."tenant_id" = "public"."get_user_tenant_id"()))));



ALTER TABLE "public"."task_tag_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_tag_assignments_access" ON "public"."task_tag_assignments" USING (("task_id" IN ( SELECT "tasks"."id"
   FROM "public"."tasks"
  WHERE ("tasks"."tenant_id" = "public"."get_user_tenant_id"()))));



ALTER TABLE "public"."task_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_tags_tenant_isolation" ON "public"."task_tags" USING (("tenant_id" = "public"."get_user_tenant_id"()));



ALTER TABLE "public"."task_template_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_template_items_access" ON "public"."task_template_items" USING (("template_id" IN ( SELECT "task_templates"."id"
   FROM "public"."task_templates"
  WHERE ("task_templates"."tenant_id" = "public"."get_user_tenant_id"()))));



ALTER TABLE "public"."task_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "task_templates_tenant_isolation" ON "public"."task_templates" USING (("tenant_id" = "public"."get_user_tenant_id"()));



ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tasks_tenant_isolation" ON "public"."tasks" USING (("tenant_id" = "public"."get_user_tenant_id"()));



ALTER TABLE "public"."template_line_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."template_spaces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_lead_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_lead_settings_access" ON "public"."tenant_lead_settings" USING (("tenant_id" = "public"."get_user_tenant_id"()));



ALTER TABLE "public"."tenant_payment_methods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_payment_methods_delete" ON "public"."tenant_payment_methods" FOR DELETE USING (("tenant_id" = "public"."get_user_tenant_id"()));



CREATE POLICY "tenant_payment_methods_insert" ON "public"."tenant_payment_methods" FOR INSERT WITH CHECK (("tenant_id" = "public"."get_user_tenant_id"()));



CREATE POLICY "tenant_payment_methods_select" ON "public"."tenant_payment_methods" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"()));



CREATE POLICY "tenant_payment_methods_update" ON "public"."tenant_payment_methods" FOR UPDATE USING (("tenant_id" = "public"."get_user_tenant_id"()));



ALTER TABLE "public"."tenant_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_stock_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_stock_settings_tenant_isolation" ON "public"."tenant_stock_settings" USING (("tenant_id" = "public"."get_user_tenant_id"()));



ALTER TABLE "public"."tenant_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_usage_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_usage_history_select" ON "public"."tenant_usage_history" FOR SELECT USING (("tenant_id" = "public"."get_user_tenant_id"()));



CREATE POLICY "tenant_usage_select" ON "public"."tenant_usage" FOR SELECT USING ((("tenant_id" = ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."is_super_admin" = true))))));



CREATE POLICY "tenant_usage_update" ON "public"."tenant_usage" FOR UPDATE USING (("tenant_id" = ( SELECT "users"."tenant_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



ALTER TABLE "public"."tenant_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_commission"("p_selling_price" numeric, "p_vendor_cost" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_commission"("p_selling_price" numeric, "p_vendor_cost" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_commission"("p_selling_price" numeric, "p_vendor_cost" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_company_cost"("p_vendor_cost" numeric, "p_markup_percent" numeric, "p_markup_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_company_cost"("p_vendor_cost" numeric, "p_markup_percent" numeric, "p_markup_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_company_cost"("p_vendor_cost" numeric, "p_markup_percent" numeric, "p_markup_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_component_subtotal"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_component_subtotal"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_component_subtotal"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_component_subtotal_v2"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_component_subtotal_v2"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_component_subtotal_v2"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_line_item_amount"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_line_item_amount"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_line_item_amount"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_material_subtotal"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_material_subtotal"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_material_subtotal"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_phase_progress"("p_phase_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_phase_progress"("p_phase_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_phase_progress"("p_phase_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_po_totals"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_po_totals"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_po_totals"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_project_progress"("p_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_project_progress"("p_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_project_progress"("p_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_quotation_totals"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_quotation_totals"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_quotation_totals"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_space_subtotal"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_space_subtotal"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_space_subtotal"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_space_subtotal_v2"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_space_subtotal_v2"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_space_subtotal_v2"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_sub_phase_progress"("p_sub_phase_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_sub_phase_progress"("p_sub_phase_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_sub_phase_progress"("p_sub_phase_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_complete_sub_phase"("p_sub_phase_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_complete_sub_phase"("p_sub_phase_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_complete_sub_phase"("p_sub_phase_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_move_lead_to_won"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_move_lead_to_won"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_move_lead_to_won"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_phase_start"("p_phase_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_phase_start"("p_phase_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_phase_start"("p_phase_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_start_phase"("p_phase_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_start_phase"("p_phase_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_start_phase"("p_phase_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_start_sub_phase"("p_sub_phase_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_start_sub_phase"("p_sub_phase_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_start_sub_phase"("p_sub_phase_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"("days_to_keep" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"("days_to_keep" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"("days_to_keep" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_sub_phase"("p_sub_phase_id" "uuid", "p_user_id" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_sub_phase"("p_sub_phase_id" "uuid", "p_user_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_sub_phase"("p_sub_phase_id" "uuid", "p_user_id" "uuid", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_type" "public"."notification_type_enum", "p_title" character varying, "p_message" "text", "p_entity_type" character varying, "p_entity_id" "uuid", "p_action_url" "text", "p_triggered_by" "uuid", "p_priority" "public"."notification_priority_enum", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_type" "public"."notification_type_enum", "p_title" character varying, "p_message" "text", "p_entity_type" character varying, "p_entity_id" "uuid", "p_action_url" "text", "p_triggered_by" "uuid", "p_priority" "public"."notification_priority_enum", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_type" "public"."notification_type_enum", "p_title" character varying, "p_message" "text", "p_entity_type" character varying, "p_entity_id" "uuid", "p_action_url" "text", "p_triggered_by" "uuid", "p_priority" "public"."notification_priority_enum", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_project_from_lead"("p_lead_id" "uuid", "p_created_by" "uuid", "p_project_category" "text", "p_initialize_phases" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."create_project_from_lead"("p_lead_id" "uuid", "p_created_by" "uuid", "p_project_category" "text", "p_initialize_phases" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_project_from_lead"("p_lead_id" "uuid", "p_created_by" "uuid", "p_project_category" "text", "p_initialize_phases" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_quotation_for_lead"("p_lead_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_quotation_for_lead"("p_lead_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_quotation_for_lead"("p_lead_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_quotation_revision"("p_quotation_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_quotation_revision"("p_quotation_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_quotation_revision"("p_quotation_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_tasks_from_template"("p_template_id" "uuid", "p_tenant_id" "uuid", "p_created_by" "uuid", "p_related_type" "public"."task_related_type", "p_related_id" "uuid", "p_start_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."create_tasks_from_template"("p_template_id" "uuid", "p_tenant_id" "uuid", "p_created_by" "uuid", "p_related_type" "public"."task_related_type", "p_related_id" "uuid", "p_start_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_tasks_from_template"("p_template_id" "uuid", "p_tenant_id" "uuid", "p_created_by" "uuid", "p_related_type" "public"."task_related_type", "p_related_id" "uuid", "p_start_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."duplicate_quotation"("p_quotation_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."duplicate_quotation"("p_quotation_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."duplicate_quotation"("p_quotation_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_grn_number"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_grn_number"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_grn_number"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invoice_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_issue_number"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_issue_number"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_issue_number"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_lead_number"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_lead_number"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_lead_number"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_mr_number"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_mr_number"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_mr_number"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_po_number"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_po_number"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_po_number"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_project_number"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_project_number"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_project_number"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_quotation_number"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_quotation_number"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_quotation_number"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_task_number"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_task_number"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_task_number"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_lead_statistics"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_lead_statistics"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_lead_statistics"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_material_markup"("p_tenant_id" "uuid", "p_material_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_material_markup"("p_tenant_id" "uuid", "p_material_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_material_markup"("p_tenant_id" "uuid", "p_material_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_po_approval_level"("p_tenant_id" "uuid", "p_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_po_approval_level"("p_tenant_id" "uuid", "p_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_po_approval_level"("p_tenant_id" "uuid", "p_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_project_lead_summary"("p_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_project_lead_summary"("p_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_project_lead_summary"("p_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_project_workflow"("p_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_project_workflow"("p_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_project_workflow"("p_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_subscription_status"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_subscription_status"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_subscription_status"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tenant_auto_create_project_setting"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tenant_auto_create_project_setting"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tenant_auto_create_project_setting"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tenant_usage_with_limits"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tenant_usage_with_limits"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tenant_usage_with_limits"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unread_notification_count"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unread_notification_count"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unread_notification_count"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_hierarchy_level"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_hierarchy_level"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_hierarchy_level"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_permissions"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_permissions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_permissions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_tenant_ids"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_tenant_ids"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_tenant_ids"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_tenants"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_tenants"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_tenants"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_variant_cost_config"("p_variant_type_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_variant_cost_config"("p_variant_type_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_variant_cost_config"("p_variant_type_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_permission"("permission_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_permission"("permission_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("permission_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_project_phases"("p_project_id" "uuid", "p_tenant_id" "uuid", "p_project_category" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_project_phases"("p_project_id" "uuid", "p_tenant_id" "uuid", "p_project_category" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_project_phases"("p_project_id" "uuid", "p_tenant_id" "uuid", "p_project_category" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_project_phases_v2"("p_project_id" "uuid", "p_tenant_id" "uuid", "p_project_category" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_project_phases_v2"("p_project_id" "uuid", "p_tenant_id" "uuid", "p_project_category" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_project_phases_v2"("p_project_id" "uuid", "p_tenant_id" "uuid", "p_project_category" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_tenant_subscription"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_tenant_subscription"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_tenant_subscription"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_project_sub_phase"("p_project_phase_id" "uuid", "p_sub_phase_template_id" "uuid", "p_name" character varying, "p_display_order" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."insert_project_sub_phase"("p_project_phase_id" "uuid", "p_sub_phase_template_id" "uuid", "p_name" character varying, "p_display_order" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_project_sub_phase"("p_project_phase_id" "uuid", "p_sub_phase_template_id" "uuid", "p_name" character varying, "p_display_order" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_or_higher"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_or_higher"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_or_higher"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_valid_stage_transition"("p_from_stage" "public"."lead_stage_enum", "p_to_stage" "public"."lead_stage_enum") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_stage_transition"("p_from_stage" "public"."lead_stage_enum", "p_to_stage" "public"."lead_stage_enum") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_stage_transition"("p_from_stage" "public"."lead_stage_enum", "p_to_stage" "public"."lead_stage_enum") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_task_assignment_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_task_assignment_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_task_assignment_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_task_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_task_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_task_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_notifications_read"("p_notification_ids" "uuid"[], "p_mark_all" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."mark_notifications_read"("p_notification_ids" "uuid"[], "p_mark_all" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notifications_read"("p_notification_ids" "uuid"[], "p_mark_all" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_lead_won"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_lead_won"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_lead_won"() TO "service_role";



GRANT ALL ON FUNCTION "public"."on_lead_stage_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_lead_stage_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_lead_stage_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reinitialize_all_project_phases"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reinitialize_all_project_phases"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reinitialize_all_project_phases"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reinitialize_project_phases"("p_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reinitialize_project_phases"("p_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reinitialize_project_phases"("p_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_pricing_rules"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_pricing_rules"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_pricing_rules"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_quotation_master_data"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_quotation_master_data"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_quotation_master_data"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_quotation_master_data_v2"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_quotation_master_data_v2"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_quotation_master_data_v2"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_revenue_heads"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_revenue_heads"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_revenue_heads"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_stock_data"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_stock_data"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_stock_data"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_stock_data_v2"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."seed_stock_data_v2"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_stock_data_v2"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."skip_sub_phase"("p_sub_phase_id" "uuid", "p_user_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."skip_sub_phase"("p_sub_phase_id" "uuid", "p_user_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."skip_sub_phase"("p_sub_phase_id" "uuid", "p_user_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."start_sub_phase"("p_sub_phase_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."start_sub_phase"("p_sub_phase_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_sub_phase"("p_sub_phase_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_email_verification"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_email_verification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_email_verification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_update_payment_milestone_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_update_payment_milestone_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_update_payment_milestone_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_update_phase_progress"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_update_phase_progress"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_update_phase_progress"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_update_project_progress"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_update_project_progress"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_update_project_progress"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_update_sub_phase_progress"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_update_sub_phase_progress"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_update_sub_phase_progress"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_record_stage_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_record_stage_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_record_stage_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_grn_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_grn_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_grn_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_issue_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_issue_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_issue_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_lead_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_lead_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_lead_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_mr_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_mr_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_mr_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_po_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_po_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_po_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_task_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_task_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_task_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_update_lead_last_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_lead_last_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_lead_last_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_update_user_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_user_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_user_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_phase_progress"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_phase_progress"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_phase_progress"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_po_payment_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_po_payment_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_po_payment_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_po_status"("p_po_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_po_status"("p_po_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_po_status"("p_po_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_project_progress"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_project_progress"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_project_progress"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_projects_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_projects_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_projects_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_stock_on_grn"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_stock_on_grn"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_stock_on_grn"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_stock_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_stock_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_stock_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tenant_usage"("p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_tenant_usage"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tenant_usage"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tenant_users_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tenant_users_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tenant_users_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_tenant_access"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_tenant_access"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_tenant_access"("p_user_id" "uuid", "p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_logs" TO "service_role";



GRANT ALL ON TABLE "public"."approval_configs" TO "anon";
GRANT ALL ON TABLE "public"."approval_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_configs" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."commission_items" TO "anon";
GRANT ALL ON TABLE "public"."commission_items" TO "authenticated";
GRANT ALL ON TABLE "public"."commission_items" TO "service_role";



GRANT ALL ON TABLE "public"."component_templates" TO "anon";
GRANT ALL ON TABLE "public"."component_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."component_templates" TO "service_role";



GRANT ALL ON TABLE "public"."component_types" TO "anon";
GRANT ALL ON TABLE "public"."component_types" TO "authenticated";
GRANT ALL ON TABLE "public"."component_types" TO "service_role";



GRANT ALL ON TABLE "public"."component_variant_types" TO "anon";
GRANT ALL ON TABLE "public"."component_variant_types" TO "authenticated";
GRANT ALL ON TABLE "public"."component_variant_types" TO "service_role";



GRANT ALL ON TABLE "public"."component_variants" TO "anon";
GRANT ALL ON TABLE "public"."component_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."component_variants" TO "service_role";



GRANT ALL ON TABLE "public"."cost_attribute_types" TO "anon";
GRANT ALL ON TABLE "public"."cost_attribute_types" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_attribute_types" TO "service_role";



GRANT ALL ON TABLE "public"."cost_item_categories" TO "anon";
GRANT ALL ON TABLE "public"."cost_item_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_item_categories" TO "service_role";



GRANT ALL ON TABLE "public"."cost_items" TO "anon";
GRANT ALL ON TABLE "public"."cost_items" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_items" TO "service_role";



GRANT ALL ON TABLE "public"."email_verification_tokens" TO "anon";
GRANT ALL ON TABLE "public"."email_verification_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."email_verification_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."goods_receipt_items" TO "anon";
GRANT ALL ON TABLE "public"."goods_receipt_items" TO "authenticated";
GRANT ALL ON TABLE "public"."goods_receipt_items" TO "service_role";



GRANT ALL ON TABLE "public"."goods_receipts" TO "anon";
GRANT ALL ON TABLE "public"."goods_receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."goods_receipts" TO "service_role";



GRANT ALL ON TABLE "public"."lead_activities" TO "anon";
GRANT ALL ON TABLE "public"."lead_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_activities" TO "service_role";



GRANT ALL ON TABLE "public"."lead_documents" TO "anon";
GRANT ALL ON TABLE "public"."lead_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_documents" TO "service_role";



GRANT ALL ON TABLE "public"."lead_family_members" TO "anon";
GRANT ALL ON TABLE "public"."lead_family_members" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_family_members" TO "service_role";



GRANT ALL ON TABLE "public"."lead_notes" TO "anon";
GRANT ALL ON TABLE "public"."lead_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_notes" TO "service_role";



GRANT ALL ON TABLE "public"."lead_stage_history" TO "anon";
GRANT ALL ON TABLE "public"."lead_stage_history" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_stage_history" TO "service_role";



GRANT ALL ON TABLE "public"."lead_tasks" TO "anon";
GRANT ALL ON TABLE "public"."lead_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."lead_won_requests" TO "anon";
GRANT ALL ON TABLE "public"."lead_won_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_won_requests" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."leads_with_project_status" TO "anon";
GRANT ALL ON TABLE "public"."leads_with_project_status" TO "authenticated";
GRANT ALL ON TABLE "public"."leads_with_project_status" TO "service_role";



GRANT ALL ON TABLE "public"."material_categories" TO "anon";
GRANT ALL ON TABLE "public"."material_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."material_categories" TO "service_role";



GRANT ALL ON TABLE "public"."material_presets" TO "anon";
GRANT ALL ON TABLE "public"."material_presets" TO "authenticated";
GRANT ALL ON TABLE "public"."material_presets" TO "service_role";



GRANT ALL ON TABLE "public"."materials" TO "anon";
GRANT ALL ON TABLE "public"."materials" TO "authenticated";
GRANT ALL ON TABLE "public"."materials" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."ownership_transfers" TO "anon";
GRANT ALL ON TABLE "public"."ownership_transfers" TO "authenticated";
GRANT ALL ON TABLE "public"."ownership_transfers" TO "service_role";



GRANT ALL ON TABLE "public"."password_reset_tokens" TO "anon";
GRANT ALL ON TABLE "public"."password_reset_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."password_reset_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."permissions" TO "anon";
GRANT ALL ON TABLE "public"."permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."permissions" TO "service_role";



GRANT ALL ON TABLE "public"."po_approval_history" TO "anon";
GRANT ALL ON TABLE "public"."po_approval_history" TO "authenticated";
GRANT ALL ON TABLE "public"."po_approval_history" TO "service_role";



GRANT ALL ON TABLE "public"."po_payments" TO "anon";
GRANT ALL ON TABLE "public"."po_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."po_payments" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_rules" TO "anon";
GRANT ALL ON TABLE "public"."pricing_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_rules" TO "service_role";



GRANT ALL ON TABLE "public"."project_checklist_items" TO "anon";
GRANT ALL ON TABLE "public"."project_checklist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."project_checklist_items" TO "service_role";



GRANT ALL ON TABLE "public"."stock_materials" TO "anon";
GRANT ALL ON TABLE "public"."stock_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_materials" TO "service_role";



GRANT ALL ON TABLE "public"."stock_purchase_order_items" TO "anon";
GRANT ALL ON TABLE "public"."stock_purchase_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_purchase_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."stock_purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."stock_purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_purchase_orders" TO "service_role";



GRANT ALL ON TABLE "public"."stock_vendors" TO "anon";
GRANT ALL ON TABLE "public"."stock_vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_vendors" TO "service_role";



GRANT ALL ON TABLE "public"."project_material_costs" TO "anon";
GRANT ALL ON TABLE "public"."project_material_costs" TO "authenticated";
GRANT ALL ON TABLE "public"."project_material_costs" TO "service_role";



GRANT ALL ON TABLE "public"."project_payment_milestone_templates" TO "anon";
GRANT ALL ON TABLE "public"."project_payment_milestone_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."project_payment_milestone_templates" TO "service_role";



GRANT ALL ON TABLE "public"."project_payment_milestones" TO "anon";
GRANT ALL ON TABLE "public"."project_payment_milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."project_payment_milestones" TO "service_role";



GRANT ALL ON TABLE "public"."project_phases" TO "anon";
GRANT ALL ON TABLE "public"."project_phases" TO "authenticated";
GRANT ALL ON TABLE "public"."project_phases" TO "service_role";



GRANT ALL ON TABLE "public"."project_payment_milestones_view" TO "anon";
GRANT ALL ON TABLE "public"."project_payment_milestones_view" TO "authenticated";
GRANT ALL ON TABLE "public"."project_payment_milestones_view" TO "service_role";



GRANT ALL ON TABLE "public"."project_phase_activity_log" TO "anon";
GRANT ALL ON TABLE "public"."project_phase_activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."project_phase_activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."project_phase_approvals" TO "anon";
GRANT ALL ON TABLE "public"."project_phase_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."project_phase_approvals" TO "service_role";



GRANT ALL ON TABLE "public"."project_phase_attachments" TO "anon";
GRANT ALL ON TABLE "public"."project_phase_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."project_phase_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."project_phase_categories" TO "anon";
GRANT ALL ON TABLE "public"."project_phase_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."project_phase_categories" TO "service_role";



GRANT ALL ON TABLE "public"."project_phase_comments" TO "anon";
GRANT ALL ON TABLE "public"."project_phase_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."project_phase_comments" TO "service_role";



GRANT ALL ON TABLE "public"."project_phase_dependencies" TO "anon";
GRANT ALL ON TABLE "public"."project_phase_dependencies" TO "authenticated";
GRANT ALL ON TABLE "public"."project_phase_dependencies" TO "service_role";



GRANT ALL ON TABLE "public"."project_phase_dependency_templates" TO "anon";
GRANT ALL ON TABLE "public"."project_phase_dependency_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."project_phase_dependency_templates" TO "service_role";



GRANT ALL ON TABLE "public"."project_phase_groups" TO "anon";
GRANT ALL ON TABLE "public"."project_phase_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."project_phase_groups" TO "service_role";



GRANT ALL ON TABLE "public"."project_phase_status_logs" TO "anon";
GRANT ALL ON TABLE "public"."project_phase_status_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."project_phase_status_logs" TO "service_role";



GRANT ALL ON TABLE "public"."project_phase_templates" TO "anon";
GRANT ALL ON TABLE "public"."project_phase_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."project_phase_templates" TO "service_role";



GRANT ALL ON TABLE "public"."project_sub_phases" TO "anon";
GRANT ALL ON TABLE "public"."project_sub_phases" TO "authenticated";
GRANT ALL ON TABLE "public"."project_sub_phases" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."project_phases_summary" TO "anon";
GRANT ALL ON TABLE "public"."project_phases_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."project_phases_summary" TO "service_role";



GRANT ALL ON TABLE "public"."project_sub_phase_assignees" TO "anon";
GRANT ALL ON TABLE "public"."project_sub_phase_assignees" TO "authenticated";
GRANT ALL ON TABLE "public"."project_sub_phase_assignees" TO "service_role";



GRANT ALL ON TABLE "public"."project_sub_phase_templates" TO "anon";
GRANT ALL ON TABLE "public"."project_sub_phase_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."project_sub_phase_templates" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_changes" TO "anon";
GRANT ALL ON TABLE "public"."quotation_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_changes" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_components" TO "anon";
GRANT ALL ON TABLE "public"."quotation_components" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_components" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_cost_attributes" TO "anon";
GRANT ALL ON TABLE "public"."quotation_cost_attributes" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_cost_attributes" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_line_items" TO "anon";
GRANT ALL ON TABLE "public"."quotation_line_items" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_line_items" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_materials" TO "anon";
GRANT ALL ON TABLE "public"."quotation_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_materials" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."quotation_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_spaces" TO "anon";
GRANT ALL ON TABLE "public"."quotation_spaces" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_spaces" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_templates" TO "anon";
GRANT ALL ON TABLE "public"."quotation_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_templates" TO "service_role";



GRANT ALL ON TABLE "public"."quotations" TO "anon";
GRANT ALL ON TABLE "public"."quotations" TO "authenticated";
GRANT ALL ON TABLE "public"."quotations" TO "service_role";



GRANT ALL ON TABLE "public"."quotations_with_lead" TO "anon";
GRANT ALL ON TABLE "public"."quotations_with_lead" TO "authenticated";
GRANT ALL ON TABLE "public"."quotations_with_lead" TO "service_role";



GRANT ALL ON TABLE "public"."revenue_heads" TO "anon";
GRANT ALL ON TABLE "public"."revenue_heads" TO "authenticated";
GRANT ALL ON TABLE "public"."revenue_heads" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."space_templates" TO "anon";
GRANT ALL ON TABLE "public"."space_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."space_templates" TO "service_role";



GRANT ALL ON TABLE "public"."space_types" TO "anon";
GRANT ALL ON TABLE "public"."space_types" TO "authenticated";
GRANT ALL ON TABLE "public"."space_types" TO "service_role";



GRANT ALL ON TABLE "public"."stock_adjustment_items" TO "anon";
GRANT ALL ON TABLE "public"."stock_adjustment_items" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_adjustment_items" TO "service_role";



GRANT ALL ON TABLE "public"."stock_adjustments" TO "anon";
GRANT ALL ON TABLE "public"."stock_adjustments" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_adjustments" TO "service_role";



GRANT ALL ON TABLE "public"."stock_brands" TO "anon";
GRANT ALL ON TABLE "public"."stock_brands" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_brands" TO "service_role";



GRANT ALL ON TABLE "public"."stock_goods_receipt_items" TO "anon";
GRANT ALL ON TABLE "public"."stock_goods_receipt_items" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_goods_receipt_items" TO "service_role";



GRANT ALL ON TABLE "public"."stock_goods_receipts" TO "anon";
GRANT ALL ON TABLE "public"."stock_goods_receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_goods_receipts" TO "service_role";



GRANT ALL ON TABLE "public"."stock_issue_items" TO "anon";
GRANT ALL ON TABLE "public"."stock_issue_items" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_issue_items" TO "service_role";



GRANT ALL ON TABLE "public"."stock_issues" TO "anon";
GRANT ALL ON TABLE "public"."stock_issues" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_issues" TO "service_role";



GRANT ALL ON TABLE "public"."stock_vendor_materials" TO "anon";
GRANT ALL ON TABLE "public"."stock_vendor_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_vendor_materials" TO "service_role";



GRANT ALL ON TABLE "public"."stock_material_best_prices" TO "anon";
GRANT ALL ON TABLE "public"."stock_material_best_prices" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_material_best_prices" TO "service_role";



GRANT ALL ON TABLE "public"."stock_material_requisition_items" TO "anon";
GRANT ALL ON TABLE "public"."stock_material_requisition_items" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_material_requisition_items" TO "service_role";



GRANT ALL ON TABLE "public"."stock_material_requisitions" TO "anon";
GRANT ALL ON TABLE "public"."stock_material_requisitions" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_material_requisitions" TO "service_role";



GRANT ALL ON TABLE "public"."stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_movements" TO "service_role";



GRANT ALL ON TABLE "public"."stock_vendor_brands" TO "anon";
GRANT ALL ON TABLE "public"."stock_vendor_brands" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_vendor_brands" TO "service_role";



GRANT ALL ON TABLE "public"."sub_phase_completion_requirements" TO "anon";
GRANT ALL ON TABLE "public"."sub_phase_completion_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."sub_phase_completion_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_addons" TO "anon";
GRANT ALL ON TABLE "public"."subscription_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_addons" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_change_requests" TO "anon";
GRANT ALL ON TABLE "public"."subscription_change_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_change_requests" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_invoices" TO "anon";
GRANT ALL ON TABLE "public"."subscription_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_plan_features" TO "anon";
GRANT ALL ON TABLE "public"."subscription_plan_features" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_plan_features" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_plans" TO "anon";
GRANT ALL ON TABLE "public"."subscription_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_plans" TO "service_role";



GRANT ALL ON TABLE "public"."system_config" TO "anon";
GRANT ALL ON TABLE "public"."system_config" TO "authenticated";
GRANT ALL ON TABLE "public"."system_config" TO "service_role";



GRANT ALL ON TABLE "public"."task_activities" TO "anon";
GRANT ALL ON TABLE "public"."task_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."task_activities" TO "service_role";



GRANT ALL ON TABLE "public"."task_attachments" TO "anon";
GRANT ALL ON TABLE "public"."task_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."task_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."task_comments" TO "anon";
GRANT ALL ON TABLE "public"."task_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."task_comments" TO "service_role";



GRANT ALL ON TABLE "public"."task_tag_assignments" TO "anon";
GRANT ALL ON TABLE "public"."task_tag_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."task_tag_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."task_tags" TO "anon";
GRANT ALL ON TABLE "public"."task_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."task_tags" TO "service_role";



GRANT ALL ON TABLE "public"."task_template_items" TO "anon";
GRANT ALL ON TABLE "public"."task_template_items" TO "authenticated";
GRANT ALL ON TABLE "public"."task_template_items" TO "service_role";



GRANT ALL ON TABLE "public"."task_templates" TO "anon";
GRANT ALL ON TABLE "public"."task_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."task_templates" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."tasks_with_details" TO "anon";
GRANT ALL ON TABLE "public"."tasks_with_details" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks_with_details" TO "service_role";



GRANT ALL ON TABLE "public"."template_line_items" TO "anon";
GRANT ALL ON TABLE "public"."template_line_items" TO "authenticated";
GRANT ALL ON TABLE "public"."template_line_items" TO "service_role";



GRANT ALL ON TABLE "public"."template_spaces" TO "anon";
GRANT ALL ON TABLE "public"."template_spaces" TO "authenticated";
GRANT ALL ON TABLE "public"."template_spaces" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_lead_settings" TO "anon";
GRANT ALL ON TABLE "public"."tenant_lead_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_lead_settings" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_payment_methods" TO "anon";
GRANT ALL ON TABLE "public"."tenant_payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_payment_methods" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_settings" TO "anon";
GRANT ALL ON TABLE "public"."tenant_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_settings" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_stock_settings" TO "anon";
GRANT ALL ON TABLE "public"."tenant_stock_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_stock_settings" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."tenant_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_usage" TO "anon";
GRANT ALL ON TABLE "public"."tenant_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_usage" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_usage_history" TO "anon";
GRANT ALL ON TABLE "public"."tenant_usage_history" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_usage_history" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_users" TO "anon";
GRANT ALL ON TABLE "public"."tenant_users" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_users" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."units" TO "anon";
GRANT ALL ON TABLE "public"."units" TO "authenticated";
GRANT ALL ON TABLE "public"."units" TO "service_role";



GRANT ALL ON TABLE "public"."user_invitations" TO "anon";
GRANT ALL ON TABLE "public"."user_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_sessions" TO "anon";
GRANT ALL ON TABLE "public"."user_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."v_project_lead_activities" TO "anon";
GRANT ALL ON TABLE "public"."v_project_lead_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."v_project_lead_activities" TO "service_role";



GRANT ALL ON TABLE "public"."v_project_lead_details" TO "anon";
GRANT ALL ON TABLE "public"."v_project_lead_details" TO "authenticated";
GRANT ALL ON TABLE "public"."v_project_lead_details" TO "service_role";



GRANT ALL ON TABLE "public"."vendors" TO "anon";
GRANT ALL ON TABLE "public"."vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."vendors" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







