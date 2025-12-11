-- Migration: Update budget_range_enum values
-- Description: Change budget range options to more realistic values (~10L, ~20L, etc.)

-- Step 1: Save the view definitions before dropping them
-- We need to recreate them after changing the enum

-- Step 2: Drop dependent views
DROP VIEW IF EXISTS quotations_with_lead CASCADE;
DROP VIEW IF EXISTS leads_with_project_status CASCADE;
DROP VIEW IF EXISTS v_project_lead_details CASCADE;

-- Step 3: Create the new enum type
CREATE TYPE budget_range_enum_new AS ENUM (
    'below_10l',
    'around_10l',
    'around_20l',
    'around_30l',
    'around_40l',
    'around_50l',
    'above_50l',
    'not_disclosed'
);

-- Step 4: Add a temporary column with the new enum type
ALTER TABLE leads ADD COLUMN budget_range_new budget_range_enum_new;

-- Step 5: Migrate data from old enum to new enum with mapping
UPDATE leads SET budget_range_new = CASE 
    WHEN budget_range = 'below_5l' THEN 'below_10l'::budget_range_enum_new
    WHEN budget_range = '5l_10l' THEN 'around_10l'::budget_range_enum_new
    WHEN budget_range = '10l_20l' THEN 'around_20l'::budget_range_enum_new
    WHEN budget_range = '20l_35l' THEN 'around_30l'::budget_range_enum_new
    WHEN budget_range = '35l_50l' THEN 'around_40l'::budget_range_enum_new
    WHEN budget_range = '50l_1cr' THEN 'around_50l'::budget_range_enum_new
    WHEN budget_range = 'above_1cr' THEN 'above_50l'::budget_range_enum_new
    WHEN budget_range = 'not_disclosed' THEN 'not_disclosed'::budget_range_enum_new
    ELSE NULL
END
WHERE budget_range IS NOT NULL;

-- Step 6: Drop the old column
ALTER TABLE leads DROP COLUMN budget_range;

-- Step 7: Rename the new column to the original name
ALTER TABLE leads RENAME COLUMN budget_range_new TO budget_range;

-- Step 8: Drop the old enum type
DROP TYPE budget_range_enum;

-- Step 9: Rename the new enum type to the original name
ALTER TYPE budget_range_enum_new RENAME TO budget_range_enum;

-- Step 10: Recreate the views

-- Recreate leads_with_project_status view
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

-- Recreate v_project_lead_details view
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

-- Recreate quotations_with_lead view
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

-- Add comment explaining the enum values
COMMENT ON TYPE budget_range_enum IS 'Budget range options: below_10l (Below ₹10 Lakhs), around_10l (~₹10 Lakhs), around_20l (~₹20 Lakhs), around_30l (~₹30 Lakhs), around_40l (~₹40 Lakhs), around_50l (~₹50 Lakhs), above_50l (Above ₹50 Lakhs), not_disclosed (Not Disclosed)';
