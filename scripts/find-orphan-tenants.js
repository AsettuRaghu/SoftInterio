/**
 * ORPHAN TENANT FINDER
 *
 * An orphan is a tenant row with no users at all. These were produced by a bug
 * in the signup flow: the tenant was created before the user, and nothing
 * removed it when user creation failed. Each orphan holds a live trial
 * subscription and occupies its company email, which is UNIQUE on tenants -
 * so the address could not be reused for signup.
 *
 * The signup path now compensates properly (see rollbackTenantCreation in
 * src/lib/auth/service.ts). This script finds and clears what was left behind.
 *
 * Usage:
 *   node scripts/find-orphan-tenants.js            # report only, changes nothing
 *   node scripts/find-orphan-tenants.js --delete   # delete the orphans found
 *
 * Deleting a tenant cascades to tenant_settings, tenant_subscriptions and
 * tenant_usage. Tenants WITH users are never touched, whatever flags you pass.
 */

const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");

const env = {};
envContent.split("\n").forEach((line) => {
  if (line && !line.startsWith("#")) {
    const i = line.indexOf("=");
    if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
});

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const shouldDelete = process.argv.includes("--delete");

(async () => {
  const { data: tenants, error } = await supabase
    .from("tenants")
    .select("id, company_name, email, status, created_at, created_by_user_id")
    .order("created_at");

  if (error) {
    console.error("Failed to read tenants:", error.message);
    process.exit(1);
  }

  const { data: users } = await supabase.from("users").select("id, tenant_id");
  const tenantsWithUsers = new Set((users || []).map((u) => u.tenant_id));

  const orphans = tenants.filter((t) => !tenantsWithUsers.has(t.id));
  const healthy = tenants.filter((t) => tenantsWithUsers.has(t.id));

  console.log(
    `\n${tenants.length} tenant(s): ${healthy.length} with users, ${orphans.length} orphaned\n`
  );

  if (orphans.length === 0) {
    console.log("No orphans. Nothing to do.\n");
    process.exit(0);
  }

  for (const t of orphans) {
    const { count: subs } = await supabase
      .from("tenant_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", t.id);

    console.log(`  ${t.company_name}`);
    console.log(`    id:            ${t.id}`);
    console.log(`    email:         ${t.email}`);
    console.log(`    created:       ${t.created_at.slice(0, 10)}`);
    console.log(`    status:        ${t.status}`);
    console.log(`    subscriptions: ${subs || 0}`);
    console.log("");
  }

  if (!shouldDelete) {
    console.log("Report only. Re-run with --delete to remove these.\n");
    process.exit(0);
  }

  console.log("Deleting orphans...\n");
  let deleted = 0;

  for (const t of orphans) {
    // Re-check immediately before deleting. Cheap, and it means a tenant that
    // gained a user since the scan above is never destroyed.
    const { count } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", t.id);

    if (count && count > 0) {
      console.log(`  SKIP  ${t.company_name} - gained ${count} user(s) since scan`);
      continue;
    }

    const { error: delError } = await supabase
      .from("tenants")
      .delete()
      .eq("id", t.id);

    if (delError) {
      console.log(`  FAIL  ${t.company_name} - ${delError.message}`);
    } else {
      console.log(`  OK    ${t.company_name} (${t.email})`);
      deleted++;
    }
  }

  console.log(`\n${deleted} of ${orphans.length} orphan(s) deleted.\n`);
})();
