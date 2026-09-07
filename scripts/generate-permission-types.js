/**
 * PERMISSION TYPE GENERATOR
 *
 * Rewrites src/types/roles-permissions.ts from the database.
 *
 * That file used to be hand-written and had drifted badly: it declared 159 of
 * the 265 permissions that exist and 18 of the 21 roles, so 106 granted
 * permissions could not be named in TypeScript at all. PermissionGate types
 * its prop as PermissionKey, which meant a UI gate on any of them would not
 * compile. Generating it makes the database the single source of truth.
 *
 * Deliberately not generated: anything expressing a role hierarchy. The
 * permission model is flat - a person can do what their grants say and nothing
 * is inherited - even though roles.hierarchy_level still exists in the schema.
 *
 * Usage: node scripts/generate-permission-types.js [--dry]
 */

const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "../.env.local");
const env = {};
fs.readFileSync(envPath, "utf-8")
  .split("\n")
  .forEach((line) => {
    if (line && !line.trim().startsWith("#")) {
      const i = line.indexOf("=");
      if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  });

const { createClient } = require("@supabase/supabase-js");
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const OUT = path.join(__dirname, "../src/types/roles-permissions.ts");
const DRY = process.argv.includes("--dry");

const quote = (s) => `'${String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

/** PostgREST caps a plain select at 1000 rows; page rather than trust one call. */
async function fetchAll(table, columns, orderBy) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from(table)
      .select(columns)
      .order(orderBy)
      .range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

function union(values) {
  if (values.length === 0) return "never";
  return values.map((v) => `\n  | ${quote(v)}`).join("");
}

(async () => {
  const permissions = await fetchAll("permissions", "key, module, description", "key");
  const roles = await fetchAll(
    "roles",
    "slug, name, description, tenant_id",
    "slug"
  );

  // A tenant-specific role cannot appear in a compile-time union, so only the
  // system roles are emitted. Today every role is a system role.
  const systemRoles = roles.filter((r) => !r.tenant_id);
  const skipped = roles.length - systemRoles.length;

  const modules = [...new Set(permissions.map((p) => p.module))].sort();

  const body = `/**
 * Roles and permissions - GENERATED FILE, DO NOT EDIT BY HAND.
 *
 * Regenerate with:  node scripts/generate-permission-types.js
 *
 * The database is the source of truth. This file exists so permission keys and
 * role slugs can be named in TypeScript, and so a typo becomes a compile error
 * rather than a silent denial at runtime.
 *
 * There is deliberately nothing here expressing a role hierarchy. The model is
 * flat: a person can do what their granted permissions say, and nothing is
 * inherited. roles.hierarchy_level still exists in the schema and is not used.
 *
 * Generated from ${permissions.length} permissions and ${systemRoles.length} system roles.
 */

// =====================================================
// PERMISSIONS
// =====================================================

export type PermissionModule =${union(modules)};

export type PermissionKey =${union(permissions.map((p) => p.key))};

export interface PermissionDefinition {
  key: PermissionKey;
  module: PermissionModule;
  description: string | null;
}

/**
 * Every permission that exists, for building an administration UI. Grouped by
 * module with PERMISSIONS_BY_MODULE below.
 */
export const PERMISSION_CATALOGUE: readonly PermissionDefinition[] = [
${permissions
  .map(
    (p) =>
      `  { key: ${quote(p.key)}, module: ${quote(p.module)}, description: ${
        p.description ? quote(p.description) : "null"
      } },`
  )
  .join("\n")}
];

export const PERMISSIONS_BY_MODULE: Record<
  PermissionModule,
  readonly PermissionDefinition[]
> = PERMISSION_CATALOGUE.reduce(
  (acc, permission) => {
    (acc[permission.module] ||= []).push(permission);
    return acc;
  },
  {} as Record<PermissionModule, PermissionDefinition[]>
);

/** Runtime membership test, for values that only exist as strings. */
const PERMISSION_KEY_SET: ReadonlySet<string> = new Set(
  PERMISSION_CATALOGUE.map((p) => p.key)
);

export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_KEY_SET.has(value);
}

// =====================================================
// ROLES
// =====================================================

export type RoleSlug =${union(systemRoles.map((r) => r.slug))};

export const ROLE_NAMES: Record<RoleSlug, string> = {
${systemRoles.map((r) => `  ${quote(r.slug)}: ${quote(r.name)},`).join("\n")}
};

export const ROLE_DESCRIPTIONS: Record<RoleSlug, string | null> = {
${systemRoles
  .map(
    (r) =>
      `  ${quote(r.slug)}: ${r.description ? quote(r.description) : "null"},`
  )
  .join("\n")}
};
`;

  if (DRY) {
    const existing = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf-8") : "";
    console.log(
      existing === body
        ? "src/types/roles-permissions.ts is up to date"
        : "src/types/roles-permissions.ts is STALE - run without --dry"
    );
    process.exit(existing === body ? 0 : 1);
  }

  fs.writeFileSync(OUT, body);
  console.log(
    `Wrote ${path.relative(process.cwd(), OUT)}: ` +
      `${permissions.length} permissions across ${modules.length} modules, ` +
      `${systemRoles.length} roles${skipped ? ` (${skipped} tenant-specific roles skipped)` : ""}.`
  );
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
