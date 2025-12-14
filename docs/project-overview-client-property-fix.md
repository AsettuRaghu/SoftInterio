# Project Overview Tab - Client & Property Information

## Issue Summary

The Project Overview tab was showing empty client and property information fields. This was due to:

1. **Schema Changes**: The `projects` table was cleaned up to use foreign key references (`client_id` and `property_id`) instead of storing duplicate client/property data directly in the projects table.

2. **Missing References**: Some projects may have been created or converted from leads without properly setting the `client_id` and `property_id` foreign keys.

## Solution Implemented

### 1. Enhanced Component Display

Updated [src/components/projects/ProjectOverviewTab.tsx](src/components/projects/ProjectOverviewTab.tsx) to:

- Add proper null checks for `project.client` and `project.property`
- Display helpful empty state messages when client or property data is missing
- Show clear indication that the data needs to be linked

### 2. Database Migration

Created [database/migrations/054_populate_project_client_property_ids.sql](database/migrations/054_populate_project_client_property_ids.sql) to:

- Populate missing `client_id` and `property_id` for projects converted from leads
- Report on any projects still missing these references
- Add helpful comments to the schema

## How to Fix Existing Data

Run the migration script:

```bash
# Using psql
psql -h your-host -d your-database -f database/migrations/054_populate_project_client_property_ids.sql

# Or using Supabase CLI
supabase db push
```

## Data Flow Architecture

### When Lead is Converted to Project

The `create_project_from_lead()` database function:

1. Reads `client_id` and `property_id` from the lead
2. Sets these IDs directly on the new project
3. The project now has proper foreign key references

### When API Fetches Project Details

The `/api/projects/[id]` endpoint:

1. Fetches the project record with basic fields
2. Joins with `clients` table using `client_id`
3. Joins with `properties` table using `property_id`
4. Flattens the related data into `project.client` and `project.property` objects

### When Overview Tab Renders

The `ProjectOverviewTab` component:

1. Receives the flattened project object with `client` and `property` nested objects
2. Displays the data if present
3. Shows an empty state message if the references are null

## Expected Behavior

After running the migration:

- All projects converted from leads should have proper client and property information
- The Overview tab will display all relevant details
- Projects created manually may still need client/property linking

## Manual Linking (Future Enhancement)

For projects that still don't have client/property references, consider adding:

- A "Link Client" button in the empty state
- A "Link Property" button in the empty state
- Modal dialogs to search and select existing clients/properties
- Or create new client/property records and link them

## Verification

To verify the fix is working:

1. Navigate to any project converted from a lead
2. Go to the "Overview" tab
3. The Client Information section should show:
   - Client Name
   - Email
   - Phone
4. The Property Details section should show:
   - Property Type
   - Property Name
   - Address details
   - Room counts
   - Carpet area, etc.

If data is still missing, run this SQL query to check:

```sql
SELECT
  p.id,
  p.project_number,
  p.name,
  p.client_id,
  p.property_id,
  p.converted_from_lead_id,
  c.name as client_name,
  pr.property_name
FROM projects p
LEFT JOIN clients c ON p.client_id = c.id
LEFT JOIN properties pr ON p.property_id = pr.id
WHERE p.is_active = true
ORDER BY p.created_at DESC
LIMIT 10;
```

This will show if the foreign keys are set and if the related records exist.
