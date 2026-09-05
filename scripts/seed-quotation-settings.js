/**
 * Seeds tenant_quotation_settings from the tenant's own company record.
 *
 * WHY: the quotation PDF reads its letterhead - company name, address, GSTIN,
 * bank block - from this table. It had zero rows, so every PDF printed
 * anonymous regardless of what the print format said. Almost everything it
 * needs already exists on the tenants row; only the bank block does not.
 *
 * Re-runnable: an existing row is left alone except for fields that are still
 * blank, so hand-edited settings are never overwritten.
 *
 *   node scripts/seed-quotation-settings.js [--dry]
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

// Placeholder until the real account is supplied - clearly fake so it cannot
// be mistaken for a live account if it reaches a document by accident.
const placeholderBank = (companyName) => ({
  bank_name: "HDFC Bank",
  // Follows the tenant, so a second tenant does not inherit the first one's
  // account holder.
  bank_account_name: companyName,
  bank_account_number: "00000000000000",
  bank_ifsc_code: "HDFC0000000",
  bank_branch: "Yelahanka, Bengaluru",
});

(async () => {
  const { data: tenants } = await db
    .from("tenants")
    .select(
      "id, company_name, email, phone, address_line1, address_line2, city, state, postal_code, gst_number"
    );

  for (const t of tenants || []) {
    const address = [t.address_line2, t.address_line1, t.city, t.state, t.postal_code]
      .filter(Boolean)
      .join(", ");

    const desired = {
      tenant_id: t.id,
      company_name: t.company_name,
      company_address: address || null,
      company_phone: t.phone,
      company_email: t.email,
      company_gstin: t.gst_number,
      ...placeholderBank(t.company_name),
    };

    const { data: existing } = await db
      .from("tenant_quotation_settings")
      .select("*")
      .eq("tenant_id", t.id)
      .maybeSingle();

    if (!existing) {
      console.log(`+ ${t.company_name}`);
      Object.entries(desired).forEach(([k, v]) => k !== "tenant_id" && console.log(`    ${k}: ${v}`));
      if (!DRY) {
        const { error } = await db.from("tenant_quotation_settings").insert(desired);
        if (error) console.log("  ! " + error.message);
      }
      continue;
    }

    // Only fill gaps.
    const patch = {};
    Object.entries(desired).forEach(([k, v]) => {
      if (k === "tenant_id") return;
      if (v && !existing[k]) patch[k] = v;
    });
    if (Object.keys(patch).length === 0) {
      console.log(`= ${t.company_name} (already complete)`);
      continue;
    }
    console.log(`~ ${t.company_name}: filling ${Object.keys(patch).join(", ")}`);
    if (!DRY) await db.from("tenant_quotation_settings").update(patch).eq("id", existing.id);
  }
  console.log(DRY ? "\n(dry run)" : "\ndone");
})();
