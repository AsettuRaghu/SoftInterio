-- Migration to cleanup projects and leads tables by removing redundant/deprecated columns
-- Includes handling of dependent views 'quotations_with_lead', 'leads_with_project_status', and 'v_project_lead_details'

-- 1. Drop dependent views first to avoid locking/dependency errors
DROP VIEW IF EXISTS "public"."quotations_with_lead";
DROP VIEW IF EXISTS "public"."leads_with_project_status";
DROP VIEW IF EXISTS "public"."v_project_lead_details";

-- 2. Cleanup Projects Table
ALTER TABLE "public"."projects" 
  DROP COLUMN IF EXISTS "site_address",
  DROP COLUMN IF EXISTS "city",
  DROP COLUMN IF EXISTS "state",
  DROP COLUMN IF EXISTS "pincode",
  DROP COLUMN IF EXISTS "quoted_amount",
  DROP COLUMN IF EXISTS "budget_amount",
  DROP COLUMN IF EXISTS "sales_rep_id", -- Now retrieved via leads or dedicated logic
  DROP COLUMN IF EXISTS "project_type", -- Deprecated/Redundant
  DROP COLUMN IF EXISTS "property_type"; -- User requested removal

-- 3. Cleanup Leads Table
ALTER TABLE "public"."leads"
  DROP COLUMN IF EXISTS "client_name_deprecated",
  DROP COLUMN IF EXISTS "phone_deprecated",
  DROP COLUMN IF EXISTS "email_deprecated",
  DROP COLUMN IF EXISTS "property_address_deprecated",
  DROP COLUMN IF EXISTS "property_name_deprecated",
  DROP COLUMN IF EXISTS "flat_number_deprecated",
  DROP COLUMN IF EXISTS "property_city_deprecated",
  DROP COLUMN IF EXISTS "property_pincode_deprecated",
  DROP COLUMN IF EXISTS "carpet_area_sqft_deprecated",
  DROP COLUMN IF EXISTS "property_category_deprecated",
  DROP COLUMN IF EXISTS "property_subtype_deprecated",
  DROP COLUMN IF EXISTS "property_type_deprecated",
  DROP COLUMN IF EXISTS "property_type_old",
  -- Additional columns requested for removal
  DROP COLUMN IF EXISTS "handover_completed",
  DROP COLUMN IF EXISTS "handover_notes",
  DROP COLUMN IF EXISTS "payment_terms",
  DROP COLUMN IF EXISTS "token_amount",
  DROP COLUMN IF EXISTS "token_received_date",
  DROP COLUMN IF EXISTS "handover_completed_at";

-- 4. Re-create 'leads_with_project_status' view using normalized relationships
-- Removed dropped columns: payment_terms, token_amount, token_received_date, handover_notes, handover_completed, handover_completed_at
CREATE OR REPLACE VIEW "public"."leads_with_project_status" AS
 SELECT "l"."id",
    "l"."tenant_id",
    "l"."lead_number",
    -- Client Details from Clients table
    "c"."name" AS "client_name",
    "c"."phone" AS "phone",
    "c"."email" AS "email",
    
    -- Property Details from Properties table
    CAST("p"."property_type" AS text) AS "property_type",
    "p"."property_name" AS "property_name",
    "p"."unit_number" AS "flat_number",
    "p"."address_line1" AS "property_address",
    "p"."city" AS "property_city",
    "p"."pincode" AS "property_pincode",
    "p"."carpet_area" AS "carpet_area_sqft",
    
    -- Lead Specific Fields
    "l"."service_type",
    "l"."lead_source",
    "l"."lead_source_detail",
    "l"."target_start_date",
    "l"."target_end_date",
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
    "l"."project_id",
    
    -- Project Status Joins
    "proj"."id" AS "linked_project_id",
    "proj"."project_number",
    "proj"."status" AS "project_status",
    "proj"."overall_progress" AS "project_progress",
    CASE
        WHEN ("proj"."id" IS NOT NULL) THEN true
        ELSE false
    END AS "has_project"
   FROM "public"."leads" "l"
     LEFT JOIN "public"."clients" "c" ON "l"."client_id" = "c"."id"
     LEFT JOIN "public"."properties" "p" ON "l"."property_id" = "p"."id"
     LEFT JOIN "public"."projects" "proj" ON "l"."project_id" = "proj"."id";

ALTER VIEW "public"."leads_with_project_status" OWNER TO "postgres";
GRANT ALL ON TABLE "public"."leads_with_project_status" TO "anon";
GRANT ALL ON TABLE "public"."leads_with_project_status" TO "authenticated";
GRANT ALL ON TABLE "public"."leads_with_project_status" TO "service_role";

-- 5. Re-create 'quotations_with_lead' view using normalized relationships
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
    
    -- Client Details: Prefer Quotation snapshot, fallback to Client table
    COALESCE("q"."client_name", "c"."name") AS "client_name",
    COALESCE("q"."client_email", "c"."email") AS "client_email",
    COALESCE("q"."client_phone", "c"."phone") AS "client_phone",
    
    -- Property Details: Prefer Quotation snapshot, fallback to Property table
    COALESCE("q"."property_name", "p"."property_name") AS "property_name",
    COALESCE("q"."property_address", "p"."address_line1") AS "property_address",
    
    -- Normalized fields from Property table (replacing deprecated lead flat fields)
    "p"."city" AS "property_city",
    "p"."pincode" AS "property_pincode",
    "p"."unit_number" AS "flat_number",
    "p"."carpet_area" AS "carpet_area_sqft",
    
    -- Property Type: Prefer Property table ref, or fallback
    CAST("p"."property_type" AS text) AS "property_type",
    
    -- Fields from Lead
    "l"."service_type",
    "l"."budget_range",
    "l"."estimated_value",
    "l"."lead_source",
    "l"."stage" AS "lead_stage",
    
    -- Assigned User fields
    "au"."name" AS "assigned_to_name",
    "au"."email" AS "assigned_to_email",
    "au"."avatar_url" AS "assigned_to_avatar"
   FROM (((("public"."quotations" "q"
     LEFT JOIN "public"."leads" "l" ON (("l"."id" = "q"."lead_id")))
     LEFT JOIN "public"."users" "au" ON (("au"."id" = "q"."assigned_to")))
     LEFT JOIN "public"."clients" "c" ON (("l"."client_id" = "c"."id")))
     LEFT JOIN "public"."properties" "p" ON (("l"."property_id" = "p"."id")));

ALTER VIEW "public"."quotations_with_lead" OWNER TO "postgres";
GRANT ALL ON TABLE "public"."quotations_with_lead" TO "anon";
GRANT ALL ON TABLE "public"."quotations_with_lead" TO "authenticated";
GRANT ALL ON TABLE "public"."quotations_with_lead" TO "service_role";

-- 6. Re-create 'v_project_lead_details' view using normalized relationships
CREATE OR REPLACE VIEW "public"."v_project_lead_details" AS
 SELECT "p"."id" AS "project_id",
    "p"."project_number",
    "p"."name" AS "project_name",
    "p"."converted_from_lead_id",
    "l"."lead_number",
    -- Client
    "c"."name" AS "lead_client_name",
    "c"."phone" AS "lead_phone",
    "c"."email" AS "lead_email",
    "l"."lead_source",
    "l"."lead_source_detail",
    "l"."assigned_to" AS "lead_sales_rep_id",
    "sales_rep"."name" AS "lead_sales_rep_name",
    -- Property
    CAST("prop"."property_type" AS text) AS "property_type",
    "prop"."property_name" AS "lead_property_name",
    "prop"."unit_number" AS "lead_flat_number",
    "prop"."address_line1" AS "lead_property_address",
    "prop"."city" AS "lead_property_city",
    "prop"."pincode" AS "lead_property_pincode",
    "prop"."carpet_area" AS "lead_carpet_area",
    -- Lead Details
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
        WHEN ("l"."won_at" IS NOT NULL AND "l"."created_at" IS NOT NULL) 
        THEN (EXTRACT(day FROM "l"."won_at" - "l"."created_at"))::integer
        ELSE NULL::integer
    END AS "lead_duration_days"
   FROM "public"."projects" "p"
     LEFT JOIN "public"."leads" "l" ON "p"."converted_from_lead_id" = "l"."id"
     LEFT JOIN "public"."clients" "c" ON "l"."client_id" = "c"."id"
     LEFT JOIN "public"."properties" "prop" ON "l"."property_id" = "prop"."id"
     LEFT JOIN "public"."users" "sales_rep" ON "l"."assigned_to" = "sales_rep"."id";

ALTER VIEW "public"."v_project_lead_details" OWNER TO "postgres";
