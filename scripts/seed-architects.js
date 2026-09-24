/**
 * Seeds the architects a business refers work from.
 *
 * More than 95% of this business's leads arrive as referrals, most from
 * architects, so the architect list is not decoration - it is who gets chased
 * when a customer stops answering, and who gets thanked when the job closes.
 * `lead_source` has carried `architect_referral` from the start with nowhere to
 * say WHICH architect; these are the first rows of the other half (see
 * `leads.referred_by_partner_id`).
 *
 * A script rather than a migration, because these are one tenant's contacts and
 * not something every future database should be born with.
 *
 * Re-runnable: matched on the partner's name within the tenant, so running it
 * twice adds nothing and an architect edited by hand keeps their edits. Each
 * gets a primary contact of the same name, because that is what every other
 * create path does and `/api/partners/match` searches contact phones.
 *
 *   node scripts/seed-architects.js [--dry] [--tenant <id>]
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
const TENANT_ARG = process.argv.indexOf("--tenant");

/** Names as the business gave them. No phone or email yet - they add those. */
const ARCHITECTS = ["Naveen", "Akshanra", "Divya", "Prabhashimi"];

async function main() {
  let tenantId = TENANT_ARG > -1 ? process.argv[TENANT_ARG + 1] : null;
  if (!tenantId) {
    // `tenants` has no `name` column - it is `company_name`. Selecting the id
    // alone keeps this working whatever that column is called next.
    const { data, error } = await db.from("tenants").select("id").order("created_at").limit(1);
    if (error) throw new Error(`Could not read tenants: ${error.message}`);
    if (!data || !data.length) throw new Error("No tenant found - pass --tenant <id>");
    tenantId = data[0].id;
    console.log(`Tenant: ${tenantId}`);
  }

  const { data: type } = await db.from("partner_types").select("code").eq("code", "architect").maybeSingle();
  if (!type) throw new Error("The 'architect' partner type does not exist");

  for (const name of ARCHITECTS) {
    const { data: existing } = await db
      .from("partners").select("id").eq("tenant_id", tenantId).eq("name", name).maybeSingle();

    if (existing) {
      const { data: link } = await db
        .from("partner_type_links").select("partner_id")
        .eq("partner_id", existing.id).eq("type_code", "architect").maybeSingle();
      if (link) { console.log(`  = ${name} already an architect`); continue; }
      if (DRY) { console.log(`  + ${name} exists, would add the architect type`); continue; }
      await db.from("partner_type_links").insert({ partner_id: existing.id, type_code: "architect" });
      console.log(`  + ${name} existed, added the architect type`);
      continue;
    }

    if (DRY) { console.log(`  + would create ${name} as an architect`); continue; }

    const { data: partner, error } = await db
      .from("partners").insert({ tenant_id: tenantId, kind: "person", name, status: "active" })
      .select("id").single();
    if (error) { console.error(`  ! ${name}: ${error.message}`); continue; }
    await db.from("partner_type_links").insert({ partner_id: partner.id, type_code: "architect" });
    await db.from("partner_contacts").insert({
      tenant_id: tenantId, partner_id: partner.id, name, is_primary: true, is_decision_maker: true,
    });
    console.log(`  + created ${name}`);
  }

  const { count } = await db
    .from("partner_type_links").select("partner_id", { count: "exact", head: true }).eq("type_code", "architect");
  console.log(`\nArchitects on record: ${count || 0}${DRY ? " (dry run - nothing written)" : ""}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
