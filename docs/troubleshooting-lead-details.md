# Troubleshooting: Project Overview Not Showing Lead Details

## Quick Checks

### 1. Did you run migration 058?

```bash
psql -h your-host -d postgres -f database/migrations/058_rename_lead_column.sql
```

This migration:

- Renames `converted_from_lead_id` → `lead_id`
- Adds the foreign key constraint
- Creates the index

**Without this migration, the column still has the old name and the API won't find the lead!**

### 2. Check Browser Console

Open the project page and check the console for the debug log:

```javascript
Project data fetched: {
  project_id: "...",
  project_number: "PRJ-...",
  has_client_id: true/false,
  has_property_id: true/false,
  has_lead_id: true/false,      // <- Should be TRUE if converted from lead
  lead_id_value: "uuid or null",// <- Should have a UUID value
  client_found: true/false,
  property_found: true/false,
  lead_found: true/false,        // <- Should be TRUE if lead exists
  lead_data: { id: "...", lead_source: "..." } or null
}
```

### 3. Check the Database

Run this query to see if the project has a `lead_id`:

```sql
-- Check if the column was renamed
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'projects'
  AND column_name IN ('lead_id', 'converted_from_lead_id');
-- Should only show 'lead_id', not 'converted_from_lead_id'

-- Check a specific project
SELECT
  id,
  project_number,
  name,
  lead_id,        -- Should have value if converted from lead
  client_id,
  property_id
FROM projects
WHERE id = 'YOUR_PROJECT_ID_HERE';

-- Check if the lead exists
SELECT
  id,
  lead_number,
  lead_source,
  lead_source_detail,
  assigned_to,
  won_at,
  project_id
FROM leads
WHERE id = 'LEAD_ID_FROM_ABOVE';
```

## Common Issues & Solutions

### Issue 1: Column Still Named `converted_from_lead_id`

**Symptom**: API log shows `has_lead_id: false` even though project was converted from lead

**Solution**: Run migration 058

```bash
psql -h your-host -d postgres -f database/migrations/058_rename_lead_column.sql
```

### Issue 2: `lead_id` is NULL

**Symptom**: Project has no `lead_id` value in database

**Solution**: Run migration 054 to populate from leads table

```bash
psql -h your-host -d postgres -f database/migrations/054_populate_project_client_property_ids.sql
```

Or manually update:

```sql
UPDATE projects p
SET lead_id = l.id
FROM leads l
WHERE l.project_id = p.id
  AND p.lead_id IS NULL;
```

### Issue 3: Lead Record Doesn't Exist

**Symptom**: `has_lead_id: true` but `lead_found: false`

**Solution**: The lead may have been deleted. Check:

```sql
SELECT * FROM leads WHERE id = 'LEAD_ID_FROM_PROJECT';
```

If missing, you'll need to remove the reference:

```sql
UPDATE projects SET lead_id = NULL WHERE id = 'PROJECT_ID';
```

### Issue 4: FK Constraint Error

**Symptom**: Error about foreign key constraint when querying

**Solution**: Verify FK exists:

```sql
SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE table_name = 'projects'
  AND constraint_type = 'FOREIGN KEY'
  AND constraint_name = 'projects_lead_id_fkey';
```

If missing, run:

```sql
ALTER TABLE projects
ADD CONSTRAINT projects_lead_id_fkey
FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
```

### Issue 5: Didn't Restart Dev Server

**Symptom**: Code changes not reflected

**Solution**: Restart the server

```bash
# Stop with Ctrl+C
npm run dev
```

## Step-by-Step Verification

1. **Run migrations in order:**

   ```bash
   # Populate missing IDs
   psql -h host -d db -f database/migrations/054_populate_project_client_property_ids.sql

   # Rename column and add FK
   psql -h host -d db -f database/migrations/058_rename_lead_column.sql
   ```

2. **Verify in database:**

   ```sql
   -- Should show SUCCESS message
   SELECT 'Migration 058 complete!' as status;

   -- Check column exists
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'projects' AND column_name = 'lead_id';
   ```

3. **Restart server:**

   ```bash
   npm run dev
   ```

4. **Check browser console** for the debug log

5. **View Project Overview tab** - should now show:
   - Client Information (if client_id set)
   - Property Details (if property_id set)
   - Lead Details (if lead_id set)

## Still Not Working?

Share the output from:

1. **Browser console log** (the "Project data fetched" object)

2. **Database query result:**

   ```sql
   SELECT
     p.id,
     p.project_number,
     p.lead_id,
     l.id as actual_lead_id,
     l.lead_source,
     CASE
       WHEN p.lead_id IS NULL THEN 'No lead_id in project'
       WHEN l.id IS NULL THEN 'lead_id set but lead does not exist'
       ELSE 'OK'
     END as status
   FROM projects p
   LEFT JOIN leads l ON p.lead_id = l.id
   WHERE p.id = 'YOUR_PROJECT_ID'
   LIMIT 1;
   ```

3. **Migration status:**
   ```sql
   -- Check if column was renamed
   SELECT EXISTS (
     SELECT 1 FROM information_schema.columns
     WHERE table_name = 'projects' AND column_name = 'lead_id'
   ) as lead_id_exists,
   EXISTS (
     SELECT 1 FROM information_schema.columns
     WHERE table_name = 'projects' AND column_name = 'converted_from_lead_id'
   ) as old_column_still_exists;
   -- Should show: lead_id_exists=true, old_column_still_exists=false
   ```

This will help identify exactly where the issue is!
