/**
 * PERMISSION DRIFT AUDIT
 *
 * The compiler now catches a mistyped permission: requiredPermissions, the
 * navigation config, route-permissions and PermissionGate are all typed
 * against PermissionKey. That only holds while the generated key list matches
 * the database, so this checks the one thing types cannot.
 *
 * Reports, in order of seriousness:
 *   1. Generated file stale        - types no longer describe reality
 *   2. Permission granted to nobody - defined and wired, but unreachable
 *   3. Permission never referenced  - defined, granted, enforced nowhere
 *
 * Exits non-zero only for (1), which is the one that breaks correctness.
 *
 * Usage: node scripts/audit-permission-keys.js
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const env = {};
fs.readFileSync(path.join(__dirname, "../.env.local"), "utf-8")
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

const SRC = path.join(__dirname, "../src");

function sourceFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (/\.(ts|tsx)$/.test(entry.name) && !full.endsWith("roles-permissions.ts"))
      acc.push(full);
  }
  return acc;
}

async function fetchAll(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || !data.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

(async () => {
  let failed = false;

  // --- 1. is the generated file current? ---
  let stale = false;
  try {
    execSync("node " + path.join(__dirname, "generate-permission-types.js") + " --dry", {
      stdio: "pipe",
    });
  } catch {
    stale = true;
  }
  console.log(
    stale
      ? "STALE: src/types/roles-permissions.ts no longer matches the database.\n" +
          "       Run: node scripts/generate-permission-types.js\n"
      : "Generated types are up to date.\n"
  );
  if (stale) failed = true;

  const permissions = await fetchAll("permissions", "id, key, module");
  const grants = await fetchAll("role_permissions", "permission_id, granted");

  // --- 2. granted to nobody ---
  const grantedTo = new Set(
    grants.filter((g) => g.granted !== false).map((g) => g.permission_id)
  );
  const ungranted = permissions.filter((p) => !grantedTo.has(p.id));

  // --- 3. never referenced in code ---
  const corpus = sourceFiles(SRC)
    .map((f) => fs.readFileSync(f, "utf-8"))
    .join("\n");
  const unreferenced = permissions.filter((p) => !corpus.includes(`"${p.key}"`) && !corpus.includes(`'${p.key}'`));

  console.log(`Permissions defined: ${permissions.length}`);
  console.log(`  granted to no role: ${ungranted.length}`);
  console.log(`  never referenced in src/: ${unreferenced.length}\n`);

  if (ungranted.length) {
    console.log("Granted to nobody (defined but unreachable):");
    ungranted.slice(0, 20).forEach((p) => console.log(`  ${p.key}`));
    if (ungranted.length > 20) console.log(`  ... and ${ungranted.length - 20} more`);
    console.log("");
  }

  const byModule = {};
  unreferenced.forEach((p) => (byModule[p.module] ??= []).push(p.key));
  if (unreferenced.length) {
    console.log("Never referenced in code (nothing enforces these):");
    Object.entries(byModule)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([m, keys]) =>
        console.log(`  ${m} (${keys.length}): ${keys.slice(0, 5).join(", ")}${keys.length > 5 ? " ..." : ""}`)
      );
  }

  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
