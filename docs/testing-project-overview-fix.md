# Testing the Project Overview Fix

## Steps to Test

1. **Start the development server** (if not already running):

   ```bash
   npm run dev
   ```

2. **Navigate to a project**:

   - Go to Dashboard > Projects
   - Click on any project that was converted from a lead
   - Click on the "Overview" tab

3. **Expected Results**:
   - **Client Information section** should show:
     - Client Name
     - Email
     - Phone
   - **Property Details section** should show:
     - Property Type
     - Property Name
     - Block/Tower
     - Flat Number
     - Bedrooms, Bathrooms, Balconies
     - Carpet Area
     - Facing direction
     - Furnishing status
     - Address details

## If Data Is Still Missing

Run these diagnostic queries in your Supabase SQL Editor:

```sql
-- Check if a specific project has client_id and property_id set
SELECT
  id,
  project_number,
  name,
  client_id,
  property_id,
  converted_from_lead_id
FROM projects
WHERE id = 'YOUR_PROJECT_ID_HERE';

-- Check if the client record exists
SELECT * FROM clients WHERE id = 'CLIENT_ID_FROM_ABOVE';

-- Check if the property record exists
SELECT * FROM properties WHERE id = 'PROPERTY_ID_FROM_ABOVE';

-- Check the lead that this project was converted from
SELECT
  id,
  lead_number,
  client_id,
  property_id,
  project_id
FROM leads
WHERE id = 'CONVERTED_FROM_LEAD_ID_FROM_ABOVE';
```

## What Changed

### API Changes ([src/app/api/projects/[id]/route.ts](../src/app/api/projects/[id]/route.ts))

- Changed from using Supabase's join syntax to explicit separate queries
- This avoids potential issues with foreign key constraint names
- Fetches client, property, and lead data independently
- More reliable and easier to debug

### Component Changes ([src/components/projects/ProjectOverviewTab.tsx](../src/components/projects/ProjectOverviewTab.tsx))

- Added proper null checks for missing data
- Shows helpful empty state messages when data is not linked
- Better user experience

## Common Issues

### Issue: Client/Property IDs are NULL in projects table

**Solution**: Run the migration script:

```bash
psql -h your-host -d your-db -f database/migrations/054_populate_project_client_property_ids.sql
```

### Issue: Client or Property records don't exist

**Solution**: The lead may have been created before the client/property tables were added. You'll need to:

1. Create the client record manually
2. Create the property record manually
3. Update the project to link to these records

### Issue: Foreign key constraints are missing

**Solution**: Add them manually:

```sql
ALTER TABLE projects
ADD CONSTRAINT projects_client_id_fkey
FOREIGN KEY (client_id) REFERENCES clients(id);

ALTER TABLE projects
ADD CONSTRAINT projects_property_id_fkey
FOREIGN KEY (property_id) REFERENCES properties(id);
```

## Browser Console Debugging

Open the browser console and check for:

1. Network tab - Look for the API call to `/api/projects/[id]`
2. Check the response payload - Look for `client` and `property` objects
3. Check for any error messages in the console

If you see errors, please share them for further debugging.
