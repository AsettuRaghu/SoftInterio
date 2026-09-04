/**
 * VIEW RLS LEAK PROBE
 *
 * Queries every public view using ONLY the anon key and no session, i.e. as a
 * complete stranger who read the key out of the browser bundle.
 *
 * A view owned by "postgres" without security_invoker executes with the
 * owner's rights and silently bypasses row level security on its base tables.
 *
 * Every view must return 0 rows here. Any row count is a cross-tenant leak.
 *
 * Usage: node scripts/check-view-rls.js
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

// Deliberately the ANON key with no session.
const anon = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Views in the public schema, plus a base table as a control: `tasks` has
// working RLS, so it proves the probe itself is sound.
const VIEWS = [
  "tasks_with_details",
  "tasks_with_timing",
  "project_phases_summary",
  "project_notes_combined",
  "project_payment_milestones_view",
  "project_material_costs",
  "stock_material_best_prices",
  "vendors",
  "cost_items_with_stock",
];

const CONTROL = "tasks";

(async () => {
  console.log("\nProbing as UNAUTHENTICATED anon. Every view must return 0 rows.\n");

  let leaks = 0;
  let checked = 0;

  const control = await anon.from(CONTROL).select("id").limit(1);
  if (control.error) {
    console.log(`control: ${CONTROL} is unreadable (${control.error.message})`);
  } else if (control.data.length > 0) {
    console.log(`control: ${CONTROL} LEAKED - RLS is broken on the base table itself\n`);
  } else {
    console.log(`control: ${CONTROL} correctly returned 0 rows\n`);
  }

  for (const view of VIEWS) {
    const { data, error } = await anon.from(view).select("*").limit(5);

    if (error) {
      // "does not exist" just means the migration hasn't run yet.
      const missing = /does not exist|schema cache/i.test(error.message);
      console.log(
        `  ${missing ? "-" : "OK"}  ${view.padEnd(34)} ${
          missing ? "not present" : "blocked (" + error.message.slice(0, 45) + ")"
        }`
      );
      if (!missing) checked++;
      continue;
    }

    checked++;
    if (data.length > 0) {
      leaks++;
      console.log(`  !!  ${view.padEnd(34)} LEAKED ${data.length} ROW(S)`);
    } else {
      console.log(`  OK  ${view.padEnd(34)} 0 rows`);
    }
  }

  console.log(
    `\n${leaks === 0 ? "PASS" : "FAIL"} - ${checked} view(s) checked, ${leaks} leaking.\n`
  );
  process.exit(leaks === 0 ? 0 : 1);
})();
