/**
 * Seeds a ladder of quotation print formats, one per level of detail.
 *
 * The same quotation gets shown to different audiences: a client comparing
 * options wants room totals, a client who has asked "what am I paying for"
 * wants components, and an internal review wants every cost item. Those are
 * the same numbers presented at four depths, which is exactly what itemise_to
 * and price_at express - so they are four saved formats rather than four
 * documents or four sets of manual toggling.
 *
 * Re-runnable: matched by name, existing rows are updated in place so a format
 * already chosen for a print keeps its id.
 *
 *   node scripts/seed-print-formats.js [--dry]
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

// Everything the four formats agree on. Only the depth differs.
const COMMON = {
  cover_enabled: false,
  show_specifications: false,
  show_company_details: true,
  show_bank_details: true,
  show_payment_terms: true,
  show_terms: true,
  header_color: "#1e293b",
  is_active: true,
};

const FORMATS = [
  {
    name: "Summary — room totals",
    description:
      "One line per room with its total. For a first conversation or an options comparison, where the number is the point and the breakdown is noise.",
    // Nothing below the room is printed, so the detail flags have nothing to
    // act on - they are set false to keep the saved row honest.
    itemise_to: "space",
    price_at: "space",
    show_descriptions: false,
    show_dimensions: false,
    show_quantities: false,
    display_order: 1,
    is_default: false,
    // Replaces nothing - this level did not exist before.
    replaces: null,
  },
  {
    name: "Standard — components",
    description:
      "Rooms and the components in each, priced per component. The usual client document.",
    itemise_to: "component",
    price_at: "component",
    show_descriptions: true,
    show_dimensions: false,
    show_quantities: false,
    display_order: 2,
    is_default: true,
    replaces: "Print : Spaces + Components + Descriptions",
  },
  {
    name: "Detailed — cost categories",
    description:
      "Components broken into cost categories (carcass, shutters, hardware) with prices still only at component level, so the make-up is visible without exposing per-item rates.",
    itemise_to: "category",
    price_at: "component",
    show_descriptions: true,
    show_dimensions: false,
    show_quantities: true,
    display_order: 3,
    is_default: false,
    replaces: "Print : Spaces + Components + Components Categories + Price",
  },
  {
    name: "Client BOQ",
    description:
      "The client document: rooms, what is in each, the material it is made of, and a price per component. No tax row - GST is stated at actuals in the notes.",
    itemise_to: "component",
    price_at: "component",
    show_descriptions: true,
    show_dimensions: false,
    show_quantities: false,
    display_order: 5,
    is_default: false,
    replaces: null,
  },
  {
    name: "Internal BOQ",
    description:
      "The working document: every cost item with its size, quantity and rate, priced throughout. Shows your rates - internal use.",
    itemise_to: "cost_item",
    price_at: "cost_item",
    show_descriptions: true,
    show_dimensions: true,
    show_quantities: true,
    display_order: 6,
    is_default: false,
    replaces: null,
  },
  {
    name: "Full — every cost item",
    description:
      "Every cost item with its dimensions, quantity and rate. Internal review and costing checks - this one shows your rates.",
    itemise_to: "cost_item",
    price_at: "cost_item",
    show_descriptions: true,
    show_dimensions: true,
    show_quantities: true,
    display_order: 4,
    is_default: false,
    replaces: null,
  },
];

(async () => {
  const { data: tenants } = await db.from("tenants").select("id, company_name");

  for (const tenant of tenants || []) {
    console.log(`\n=== ${tenant.company_name} ===`);
    const { data: existing } = await db
      .from("quotation_print_formats")
      .select("id, name")
      .eq("tenant_id", tenant.id);
    const byName = Object.fromEntries((existing || []).map((f) => [f.name, f]));

    for (const format of FORMATS) {
      const { replaces, ...fields } = format;
      const row = { ...COMMON, ...fields, tenant_id: tenant.id };
      // Take over the old row where one matches, so a format that has already
      // been used keeps its identity instead of being duplicated beside it.
      const target = byName[format.name] || (replaces ? byName[replaces] : null);

      const write = async (fn) => {
        const { error } = await fn(row);
        if (error) console.log("    ! " + error.message);
      };

      if (target) {
        console.log(
          `  ${target.name === format.name ? "=" : `${target.name} ->`} ${format.name}` +
            `  (${format.itemise_to} / priced at ${format.price_at})`
        );
        if (!DRY) {
          await write((payload) =>
            db.from("quotation_print_formats").update(payload).eq("id", target.id)
          );
        }
      } else {
        console.log(`  + ${format.name}  (${format.itemise_to} / priced at ${format.price_at})`);
        if (!DRY) {
          await write((payload) =>
            db.from("quotation_print_formats").insert(payload)
          );
        }
      }
    }
  }
  console.log(DRY ? "\n(dry run)" : "\ndone");
})();
