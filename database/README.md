# Database Schema

This folder contains the complete database schema for the SoftInterio ERP system.

## Files

### `schema.sql`

The complete PostgreSQL schema exported from Supabase. This is the **single source of truth** for the database structure.

Contains:

- **Types**: All custom ENUMs (lead_stage_enum, project_status_enum, etc.)
- **Tables**: All 50+ tables for the entire application
- **Functions**: Stored procedures for business logic
- **Views**: Database views for complex queries
- **Grants**: Permission grants for Supabase roles

### `seed_data.sql` (if present)

Reference data required for new deployments:

- System roles and permissions
- Default space types, component types
- Subscription plans
- Phase templates

## Usage

### For New Deployments

1. Run `schema.sql` in your Supabase SQL editor
2. Run `seed_data.sql` if you need reference data

### For Schema Updates

1. Make changes directly in Supabase
2. Re-export the schema using: `supabase db dump --schema public > database/schema.sql`

## Important Notes

- This schema is exported from the production Supabase database
- Do NOT manually edit the schema.sql file - always export from Supabase
- The INSERT statements inside `schema.sql` are part of function bodies, not seed data
- RLS policies are managed directly in Supabase Dashboard

## Schema Export Command

```bash
# Using Supabase CLI
supabase db dump --schema public > database/schema.sql

# Or from Supabase Dashboard:
# Settings > Database > Schema > Download
```

## Last Updated

December 2024 - Full schema with all modules (Auth, Leads, Quotations, Projects, Tasks, Stock)
