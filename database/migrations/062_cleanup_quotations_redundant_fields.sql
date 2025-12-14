-- Remove redundant fields from quotations table
-- These fields are already available through client_id and lead_id relationships

-- Step 1: Drop the view that depends on these columns
DROP VIEW IF EXISTS public.quotations_with_lead;

-- Step 2: Update the create_quotation_from_lead function to remove references
CREATE OR REPLACE FUNCTION public.create_quotation_from_lead(p_lead_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_quotation_id UUID;
    v_quotation_number VARCHAR(50);
    v_tenant_id UUID;
    v_lead RECORD;
    v_client RECORD;
    v_property RECORD;
    v_assignee UUID;
BEGIN
    -- Get lead details
    SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found';
    END IF;

    v_tenant_id := v_lead.tenant_id;
    
    -- Get client details
    SELECT * INTO v_client FROM clients WHERE id = v_lead.client_id;
    
    -- Get property details
    SELECT * INTO v_property FROM properties WHERE id = v_lead.property_id;

    -- Determine assignee (lead assigned_to or created_by)
    v_assignee := COALESCE(v_lead.assigned_to, v_lead.created_by);

    -- Generate quotation number
    v_quotation_number := 'QUO-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || 
                          LPAD(NEXTVAL('quotation_number_seq')::TEXT, 4, '0');

    -- Create quotation WITHOUT redundant fields
    INSERT INTO quotations (
        tenant_id,
        quotation_number,
        version,
        lead_id,
        client_id,
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
        v_lead.client_id,
        COALESCE(v_lead.service_type::VARCHAR, 'Interior') || ' - ' || v_client.name,
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
        created_by,
        tenant_id
    ) VALUES (
        p_lead_id,
        'quotation_created',
        'Quotation ' || v_quotation_number || ' Created',
        'A new quotation was automatically created for this lead.',
        v_assignee,
        v_tenant_id
    );

    RETURN v_quotation_id;
END;
$function$;

-- Step 3: Drop the redundant client fields
ALTER TABLE public.quotations 
DROP COLUMN IF EXISTS client_name,
DROP COLUMN IF EXISTS client_email,
DROP COLUMN IF EXISTS client_phone;

-- Step 4: Drop the redundant property fields
ALTER TABLE public.quotations 
DROP COLUMN IF EXISTS property_name,
DROP COLUMN IF EXISTS property_address,
DROP COLUMN IF EXISTS property_type,
DROP COLUMN IF EXISTS carpet_area;

-- Step 5: Recreate the view without the redundant fields
CREATE OR REPLACE VIEW public.quotations_with_lead AS
SELECT 
    q.id,
    q.tenant_id,
    q.quotation_number,
    q.version,
    q.parent_quotation_id,
    q.lead_id,
    q.client_id,
    q.project_id,
    q.title,
    q.description,
    q.status,
    q.valid_from,
    q.valid_until,
    q.subtotal,
    q.discount_type,
    q.discount_value,
    q.discount_amount,
    q.taxable_amount,
    q.tax_percent,
    q.tax_amount,
    q.overhead_percent,
    q.overhead_amount,
    q.grand_total,
    q.payment_terms,
    q.terms_and_conditions,
    q.notes,
    q.sent_at,
    q.viewed_at,
    q.approved_at,
    q.rejected_at,
    q.rejection_reason,
    q.assigned_to,
    q.created_by,
    q.updated_by,
    q.created_at,
    q.updated_at,
    -- Get from relationships instead
    c.name AS client_name,
    c.email AS client_email,
    c.phone AS client_phone,
    p.property_name,
    p.address_line1::TEXT AS property_address,
    p.city AS property_city,
    p.pincode AS property_pincode,
    p.unit_number AS flat_number,
    p.carpet_area AS carpet_area_sqft,
    p.property_type::TEXT AS property_type,
    l.service_type,
    l.budget_range,
    l.estimated_value,
    l.lead_source,
    l.stage AS lead_stage,
    au.name AS assigned_to_name,
    au.email AS assigned_to_email,
    au.avatar_url AS assigned_to_avatar
FROM quotations q
LEFT JOIN leads l ON l.id = q.lead_id
LEFT JOIN users au ON au.id = q.assigned_to
LEFT JOIN clients c ON c.id = q.client_id
LEFT JOIN properties p ON p.id = l.property_id;

-- Step 6: Add comments to explain the relationships
COMMENT ON COLUMN public.quotations.client_id IS 'Reference to clients table - use this to get client name, email, phone';
COMMENT ON COLUMN public.quotations.lead_id IS 'Reference to leads table - use this to get property information via lead.property_id';
COMMENT ON COLUMN public.quotations.project_id IS 'Reference to projects table - use this to get project information';
