/**
 * Gives a lead number to leads created before numbering was applied.
 *
 * WHY: seven leads carry no lead_number - all created before 15 December 2025,
 * where the numbered sequence begins at LD-202512-023. They are not junk:
 * between them they hold quotations, documents, tasks and activities, and two
 * of them became live projects. Deleting them would orphan those projects, so
 * the fix is to number them, not remove them.
 *
 * Numbers follow the existing format, LD-YYYYMM-NNN, taken from the lead's own
 * creation month and filling the lowest sequence numbers still free in that
 * month for that tenant. Oldest lead gets the lowest number, so the sequence
 * reads chronologically like the rest.
 *
 * Re-runnable: only touches rows where lead_number is null.
 *
 *   node scripts/backfill-lead-numbers.js [--dry]
 */
const fs = require("fs");
const path = require("path");
const env = {};
fs.readFileSync(path.join(__dirname, "../.env.local"), "utf-8")
  .split("\n")
  .forEach((l) => {
    const i = l.indexOf("=");
    if (i > 0 && !l.trim().startsWith("#")) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  });
const { createClient } = require("@supabase/supabase-js");
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const DRY = process.argv.includes("--dry");

const monthKey = (iso) => iso.slice(0, 7).replace("-", ""); // 2025-12-11 -> 202512

(async () => {
  const { data: missing } = await db
    .from("leads")
    .select("id, tenant_id, created_at, stage, client:clients(name)")
    .is("lead_number", null)
    .order("created_at", { ascending: true });

  if (!missing?.length) {
    console.log("Every lead already has a number.");
    return;
  }

  // Everything already taken, so a backfilled number can never collide with a
  // number the generator handed out.
  const { data: taken } = await db
    .from("leads")
    .select("tenant_id, lead_number")
    .not("lead_number", "is", null);

  const used = new Set((taken || []).map((l) => `${l.tenant_id}:${l.lead_number}`));

  for (const lead of missing) {
    const month = monthKey(lead.created_at);
    let seq = 1;
    let candidate;
    do {
      candidate = `LD-${month}-${String(seq).padStart(3, "0")}`;
      seq += 1;
    } while (used.has(`${lead.tenant_id}:${candidate}`));

    used.add(`${lead.tenant_id}:${candidate}`);
    const who = lead.client?.name || "no client";
    console.log(
      `  ${candidate}  <-  ${lead.id.slice(0, 8)}  ${lead.created_at.slice(0, 10)}  ${who} (${lead.stage})`
    );

    if (!DRY) {
      const { error } = await db
        .from("leads")
        .update({ lead_number: candidate })
        .eq("id", lead.id);
      if (error) console.log(`    ! ${error.message}`);
    }
  }

  console.log(DRY ? "\n(dry run - nothing written)" : `\ndone - ${missing.length} lead(s) numbered`);
})();
