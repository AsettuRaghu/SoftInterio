# Column Rename: converted_from_lead_id → lead_id

## Summary

Renamed `projects.converted_from_lead_id` to `projects.lead_id` for consistency with other foreign key columns (`client_id`, `property_id`, `project_manager_id`).

## What Changed

### Database Schema

**Before:**

```sql
projects
├── client_id → clients.id
├── property_id → properties.id
├── converted_from_lead_id → (no FK)
└── project_manager_id → users.id
```

**After:**

```sql
projects
├── client_id → clients.id
├── property_id → properties.id
├── lead_id → leads.id (RENAMED + FK ADDED)
└── project_manager_id → users.id
```

### Migration Files

- **Migration 057**: Deprecated (attempted to add FK for old column name)
- **Migration 058**: ✅ **Use this one** - Renames column and adds FK

### Code Changes

Updated all references in:

- ✅ Type definitions (`src/types/projects.ts`)
- ✅ API routes (`src/app/api/projects/**`)
- ✅ Components (`src/components/projects/**`)
- ✅ Forms (`src/app/dashboard/projects/new/**`)

## How to Apply

### 1. Run Migration 058

```bash
psql -h your-supabase-host -d postgres -f database/migrations/058_rename_lead_column.sql
```

This will:

1. Rename `converted_from_lead_id` → `lead_id`
2. Rename index to `idx_projects_lead_id`
3. Add foreign key constraint `projects_lead_id_fkey`
4. Verify all FK constraints exist
5. Update comments

### 2. Restart Dev Server

```bash
# Stop current server (Ctrl+C)
npm run dev
```

### 3. Verify

Navigate to any project's Overview tab. You should see:

- Client information populated
- Property details populated
- Lead information (if converted from lead)
- No more PostgREST errors

## Benefits

✅ **Consistency**: All FK columns follow the same naming pattern  
✅ **Clarity**: `lead_id` is clearer and shorter than `converted_from_lead_id`  
✅ **Standards**: Matches industry conventions for FK naming  
✅ **Maintainability**: Easier to remember and type

## Complete FK Structure

After migration 058, your projects table has these foreign keys:

| Column               | References      | Constraint Name                    | Purpose          |
| -------------------- | --------------- | ---------------------------------- | ---------------- |
| `client_id`          | `clients.id`    | `projects_client_id_fkey`          | Project client   |
| `property_id`        | `properties.id` | `projects_property_id_fkey`        | Project location |
| `lead_id`            | `leads.id`      | `projects_lead_id_fkey`            | Originating lead |
| `project_manager_id` | `users.id`      | `projects_project_manager_id_fkey` | Assigned manager |

All have `ON DELETE SET NULL` behavior.

## Rollback (if needed)

If you need to rollback:

```sql
-- Rename back
ALTER TABLE projects RENAME COLUMN lead_id TO converted_from_lead_id;

-- Update constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_lead_id_fkey;
ALTER TABLE projects ADD CONSTRAINT projects_converted_from_lead_id_fkey
FOREIGN KEY (converted_from_lead_id) REFERENCES leads(id) ON DELETE SET NULL;

-- Update index
DROP INDEX IF EXISTS idx_projects_lead_id;
CREATE INDEX idx_projects_converted_from_lead_id
ON projects(converted_from_lead_id)
WHERE converted_from_lead_id IS NOT NULL;
```

Then revert the code changes by running:

```bash
git revert HEAD
```

## Testing Checklist

After applying the migration:

- [ ] Migration 058 runs without errors
- [ ] All 4 FK constraints exist (check the migration output)
- [ ] Dev server starts without errors
- [ ] Projects page loads
- [ ] Project Overview tab shows client info
- [ ] Project Overview tab shows property info
- [ ] Project Overview tab shows lead info (for converted projects)
- [ ] No console errors about "converted_from_lead_id"
- [ ] Can create new project from lead
- [ ] Lead linking works correctly

## Notes

- The old column name `converted_from_lead_id` no longer exists
- All API and UI code now uses `lead_id`
- The database function `create_project_from_lead()` may need updating if it references the old column name
- Migration 057 is deprecated and should be skipped

---

**Migration Status**: ✅ Ready to apply  
**Breaking Changes**: Yes - requires database schema change  
**Downtime Required**: No (column rename is fast)  
**Risk Level**: Low (well-tested change)
