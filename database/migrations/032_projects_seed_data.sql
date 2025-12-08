-- =====================================================
-- Migration: 032_projects_seed_data.sql
-- Description: Seed data for 5 sample projects
-- Date: 2024-12-06
-- =====================================================

-- Insert sample projects for testing
-- Note: This will insert for all existing tenants

INSERT INTO projects (
    tenant_id,
    project_number,
    name,
    description,
    client_name,
    client_email,
    client_phone,
    site_address,
    city,
    state,
    pincode,
    project_type,
    status,
    start_date,
    expected_end_date,
    quoted_amount,
    budget_amount,
    is_active,
    created_at
)
SELECT 
    t.id as tenant_id,
    'PRJ-25-0001' as project_number,
    'Villa Serenity - Modern Living' as name,
    'Complete interior design for a 4500 sq ft luxury villa including living areas, bedrooms, kitchen, and outdoor spaces' as description,
    'Rajesh Sharma' as client_name,
    'rajesh.sharma@email.com' as client_email,
    '+91 98765 43210' as client_phone,
    '123, Palm Grove Layout, Whitefield' as site_address,
    'Bangalore' as city,
    'Karnataka' as state,
    '560066' as pincode,
    'residential' as project_type,
    'execution' as status,
    '2025-01-15'::date as start_date,
    '2025-06-30'::date as expected_end_date,
    4500000.00 as quoted_amount,
    4200000.00 as budget_amount,
    true as is_active,
    NOW() - INTERVAL '45 days' as created_at
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.tenant_id = t.id AND p.project_number = 'PRJ-25-0001'
);

INSERT INTO projects (
    tenant_id,
    project_number,
    name,
    description,
    client_name,
    client_email,
    client_phone,
    site_address,
    city,
    state,
    pincode,
    project_type,
    status,
    start_date,
    expected_end_date,
    quoted_amount,
    budget_amount,
    is_active,
    created_at
)
SELECT 
    t.id as tenant_id,
    'PRJ-25-0002' as project_number,
    'Skyline Office - Corporate HQ' as name,
    'Modern corporate office interior for 12,000 sq ft space including reception, conference rooms, workstations, and executive cabins' as description,
    'TechVenture Pvt Ltd' as client_name,
    'admin@techventure.com' as client_email,
    '+91 80 4567 8900' as client_phone,
    '5th Floor, Prestige Tower, MG Road' as site_address,
    'Bangalore' as city,
    'Karnataka' as state,
    '560001' as pincode,
    'office' as project_type,
    'procurement' as status,
    '2025-02-01'::date as start_date,
    '2025-08-15'::date as expected_end_date,
    8500000.00 as quoted_amount,
    8000000.00 as budget_amount,
    true as is_active,
    NOW() - INTERVAL '30 days' as created_at
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.tenant_id = t.id AND p.project_number = 'PRJ-25-0002'
);

INSERT INTO projects (
    tenant_id,
    project_number,
    name,
    description,
    client_name,
    client_email,
    client_phone,
    site_address,
    city,
    state,
    pincode,
    project_type,
    status,
    start_date,
    expected_end_date,
    quoted_amount,
    budget_amount,
    is_active,
    created_at
)
SELECT 
    t.id as tenant_id,
    'PRJ-25-0003' as project_number,
    'Cafe Aroma - Boutique Coffee Shop' as name,
    'Complete interior design for 1800 sq ft boutique cafe including seating areas, counter, kitchen, and outdoor patio' as description,
    'Priya Menon' as client_name,
    'priya@cafearoma.in' as client_email,
    '+91 99001 12233' as client_phone,
    '42, 12th Cross, Indiranagar' as site_address,
    'Bangalore' as city,
    'Karnataka' as state,
    '560038' as pincode,
    'hospitality' as project_type,
    'design' as status,
    '2025-03-01'::date as start_date,
    '2025-05-31'::date as expected_end_date,
    1800000.00 as quoted_amount,
    1650000.00 as budget_amount,
    true as is_active,
    NOW() - INTERVAL '15 days' as created_at
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.tenant_id = t.id AND p.project_number = 'PRJ-25-0003'
);

INSERT INTO projects (
    tenant_id,
    project_number,
    name,
    description,
    client_name,
    client_email,
    client_phone,
    site_address,
    city,
    state,
    pincode,
    project_type,
    status,
    start_date,
    expected_end_date,
    quoted_amount,
    budget_amount,
    is_active,
    created_at
)
SELECT 
    t.id as tenant_id,
    'PRJ-25-0004' as project_number,
    'Urban Nest - Apartment Renovation' as name,
    '3BHK apartment complete renovation - 2200 sq ft including modular kitchen, wardrobes, false ceiling, and flooring' as description,
    'Anand Kumar' as client_name,
    'anand.kumar@gmail.com' as client_email,
    '+91 98450 67890' as client_phone,
    'B-404, Prestige Lakeside Habitat, Varthur' as site_address,
    'Bangalore' as city,
    'Karnataka' as state,
    '560087' as pincode,
    'residential' as project_type,
    'planning' as status,
    '2025-04-01'::date as start_date,
    '2025-07-15'::date as expected_end_date,
    2800000.00 as quoted_amount,
    2600000.00 as budget_amount,
    true as is_active,
    NOW() - INTERVAL '5 days' as created_at
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.tenant_id = t.id AND p.project_number = 'PRJ-25-0004'
);

INSERT INTO projects (
    tenant_id,
    project_number,
    name,
    description,
    client_name,
    client_email,
    client_phone,
    site_address,
    city,
    state,
    pincode,
    project_type,
    status,
    start_date,
    expected_end_date,
    quoted_amount,
    budget_amount,
    is_active,
    created_at
)
SELECT 
    t.id as tenant_id,
    'PRJ-25-0005' as project_number,
    'Fashion Forward - Retail Showroom' as name,
    'Premium fashion retail showroom interior - 3500 sq ft including display areas, trial rooms, checkout counter, and storage' as description,
    'Style House Pvt Ltd' as client_name,
    'info@stylehouse.co.in' as client_email,
    '+91 80 2345 6789' as client_phone,
    'Ground Floor, Phoenix Mall, Mahadevapura' as site_address,
    'Bangalore' as city,
    'Karnataka' as state,
    '560048' as pincode,
    'retail' as project_type,
    'execution' as status,
    '2025-01-20'::date as start_date,
    '2025-04-30'::date as expected_end_date,
    3200000.00 as quoted_amount,
    3000000.00 as budget_amount,
    true as is_active,
    NOW() - INTERVAL '40 days' as created_at
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.tenant_id = t.id AND p.project_number = 'PRJ-25-0005'
);

-- Verify the inserts
-- SELECT project_number, name, status, client_name FROM projects ORDER BY project_number;
