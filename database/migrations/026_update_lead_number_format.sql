-- Migration: Update lead number format to LD-YYYYMM-XXX
-- Description: Change lead numbering convention to monthly reset format
-- Format: LD-YYYYMM-XXX where XXX resets each month per tenant

-- Step 1: Add column to track current month for the counter
ALTER TABLE tenant_lead_settings 
ADD COLUMN IF NOT EXISTS lead_number_month VARCHAR(6) DEFAULT TO_CHAR(CURRENT_DATE, 'YYYYMM');

-- Step 2: Update the generate_lead_number function
CREATE OR REPLACE FUNCTION "public"."generate_lead_number"("p_tenant_id" "uuid") RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_prefix VARCHAR(10);
    v_next_num INTEGER;
    v_current_month VARCHAR(6);
    v_stored_month VARCHAR(6);
    v_lead_number VARCHAR(50);
BEGIN
    -- Get current month in YYYYMM format
    v_current_month := TO_CHAR(CURRENT_DATE, 'YYYYMM');
    
    -- Ensure tenant settings exist
    INSERT INTO tenant_lead_settings (tenant_id, lead_number_month, lead_number_next)
    VALUES (p_tenant_id, v_current_month, 1)
    ON CONFLICT (tenant_id) DO NOTHING;
    
    -- Get current stored month
    SELECT lead_number_month INTO v_stored_month
    FROM tenant_lead_settings
    WHERE tenant_id = p_tenant_id;
    
    -- If month has changed, reset the counter
    IF v_stored_month IS NULL OR v_stored_month != v_current_month THEN
        UPDATE tenant_lead_settings
        SET lead_number_month = v_current_month,
            lead_number_next = 2  -- Will return 1, then increment to 2
        WHERE tenant_id = p_tenant_id
        RETURNING lead_number_prefix, 1 INTO v_prefix, v_next_num;
    ELSE
        -- Same month, just increment
        UPDATE tenant_lead_settings
        SET lead_number_next = lead_number_next + 1
        WHERE tenant_id = p_tenant_id
        RETURNING lead_number_prefix, lead_number_next - 1 INTO v_prefix, v_next_num;
    END IF;
    
    -- Generate lead number: LD-YYYYMM-XXX (3 digits, padded)
    v_lead_number := v_prefix || '-' || v_current_month || '-' || LPAD(v_next_num::TEXT, 3, '0');
    
    RETURN v_lead_number;
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION "public"."generate_lead_number"("p_tenant_id" "uuid") IS 'Generates unique lead numbers per tenant in format LD-YYYYMM-XXX. Counter resets each month.';

-- Add comment for the new column
COMMENT ON COLUMN "public"."tenant_lead_settings"."lead_number_month" IS 'Tracks the current month for lead number counter reset (YYYYMM format)';
