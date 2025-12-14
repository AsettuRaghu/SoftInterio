# Project Metadata Foreign Keys - Complete Fix

## The Problem

You reported that the Project Overview tab was not showing client and property information, and you received this error:

```
Error fetching full project details: {
  code: 'PGRST200',
  details: "Searched for a foreign key relationship between 'projects' and 'leads' using the hint 'converted_from_lead_id'",
  message: "Could not find a relationship between 'projects' and 'leads' in the schema cache"
}
```

### Root Causes

1. **Missing Foreign Key**: The `projects.converted_from_lead_id` column did NOT have a foreign key constraint to `leads.id`
2. **Supabase Join Syntax**: The API was trying to use Supabase's join syntax which requires proper FK constraints
3. **Incomplete Relationships**: Not all project metadata was properly linked via foreign keys

## The Solution

### ✅ Database Changes

**Migration 057** adds the missing foreign key constraint and verifies all relationships:

```sql
-- Adds: projects.converted_from_lead_id → leads.id
ALTER TABLE projects
ADD CONSTRAINT projects_converted_from_lead_id_fkey
FOREIGN KEY (converted_from_lead_id)
REFERENCES leads(id)
ON DELETE SET NULL;
```

**All Project Metadata Now Properly Linked:**

| Column                   | References      | Status       |
| ------------------------ | --------------- | ------------ |
| `client_id`              | `clients.id`    | ✅ FK exists |
| `property_id`            | `properties.id` | ✅ FK exists |
| `converted_from_lead_id` | `leads.id`      | ✅ FK added  |
| `project_manager_id`     | `users.id`      | ✅ FK exists |

### ✅ API Changes

**Changed from Supabase join syntax to explicit queries:**

**Before (Unreliable):**

```typescript
.select(`
  *,
  client:clients!client_id(name, email, phone),
  property:properties!property_id(...),
  lead:leads!converted_from_lead_id(...)
`)
```

**After (Reliable):**

```typescript
// Fetch project
const project = await supabase
  .from("projects")
  .select("*")
  .eq("id", id)
  .single();

// Fetch client separately
const client = await supabase
  .from("clients")
  .select("...")
  .eq("id", project.client_id)
  .single();

// Fetch property separately
const property = await supabase
  .from("properties")
  .select("...")
  .eq("id", project.property_id)
  .single();

// Fetch lead separately
const lead = await supabase
  .from("leads")
  .select("...")
  .eq("id", project.converted_from_lead_id)
  .single();
```

**Benefits:**

- Works regardless of FK constraint names
- Better error handling
- Easier to debug
- More explicit and maintainable

## Steps to Apply the Fix

### 1. Run the Foreign Key Migration

```bash
# Connect to your Supabase database
psql -h your-supabase-host -d postgres -f database/migrations/057_add_project_lead_foreign_key.sql
```

This will:

- Add the missing `projects_converted_from_lead_id_fkey` constraint
- Verify all project metadata foreign keys exist
- Create index for better performance
- Report status of all constraints

### 2. Populate Missing Data (if needed)

If you ran migration 054 already, this should be done. But to be sure:

```bash
psql -h your-supabase-host -d postgres -f database/migrations/054_populate_project_client_property_ids.sql
```

This ensures all projects converted from leads have proper `client_id` and `property_id` set.

### 3. Restart Your Development Server

```bash
# Kill the current server (Ctrl+C)
npm run dev
```

The API changes are already in the code, so restarting will pick them up.

### 4. Test the Fix

1. Navigate to any project (especially one converted from a lead)
2. Go to the "Overview" tab
3. You should now see:
   - **Client Information**: Name, Email, Phone
   - **Property Details**: All property information
   - **Lead Details**: Lead source, assigned to, won date

### 5. Verify with Diagnostic (Optional)

Run the complete diagnostic to verify everything:

```bash
psql -h your-supabase-host -d postgres -f database/migrations/056_complete_diagnostic.sql
```

## What Changed in Your Database Schema

### Foreign Key Relationships Added

```sql
-- NEW: Links project to originating lead
projects.converted_from_lead_id → leads.id
  ON DELETE SET NULL
  (Allows tracking which lead became this project)
```

### Complete Project Metadata Structure

```
projects table
├── client_id ──────────→ clients.id (FK)
├── property_id ────────→ properties.id (FK)
├── converted_from_lead_id ─→ leads.id (FK) [NEWLY ADDED]
└── project_manager_id ─→ users.id (FK)
```

### Why This Matters

1. **Data Integrity**: Foreign keys prevent orphaned records
2. **Referential Integrity**: Ensures related records exist
3. **Cascading Actions**: Properly handles deletions
4. **Query Performance**: Enables database-level optimizations
5. **Supabase Integration**: Allows PostgREST to understand relationships
6. **Type Safety**: Better TypeScript type inference

## Expected Console Output

After the fix, you should see in your browser console:

```
Project data fetched: {
  project_id: "c8712f9a-84b2-46d5-8e97-9d41c2f62544",
  has_client_id: true,
  has_property_id: true,
  has_lead_id: true,
  client_found: true,
  property_found: true,
  lead_found: true
}
```

## Troubleshooting

### If client_found or property_found is false:

Run migration 054 again:

```bash
psql -h your-host -d postgres -f database/migrations/054_populate_project_client_property_ids.sql
```

### If the FK constraint fails to add:

Check for orphaned records:

```sql
-- Find projects with invalid converted_from_lead_id
SELECT p.id, p.project_number, p.converted_from_lead_id
FROM projects p
LEFT JOIN leads l ON p.converted_from_lead_id = l.id
WHERE p.converted_from_lead_id IS NOT NULL
  AND l.id IS NULL;
```

Fix any orphaned records before adding the constraint.

### If still seeing the error:

1. Make sure you restarted the dev server
2. Clear browser cache
3. Check browser console for the debug log
4. Run the diagnostic script to verify data

## Summary

✅ **Foreign Key Added**: `projects.converted_from_lead_id → leads.id`  
✅ **All Metadata Linked**: client, property, lead, project_manager  
✅ **API Refactored**: Explicit queries instead of join syntax  
✅ **Error Handling**: Better logging and debugging  
✅ **Data Integrity**: Proper constraints and relationships

Your projects table now has complete and proper foreign key relationships for all metadata!
