/**
 * Seeds the quotation catalogue into a Basic / Standard / Premium / Luxury ladder.
 *
 * WHY THIS EXISTS
 * The Scenarios modal lets a seller move a whole category up or down a grade
 * ("take Carcass to Premium"). That only works if a category holds exactly one
 * family of item with one entry per tier. The original catalogue did not: the
 * Hardware category mixed hinges and handles (two ladders in one bucket), and
 * Accessories held six unrelated products that happened to share a unit - so
 * "upgrade Accessories" could swap an organiser basket for a corner carousel.
 *
 * So each tiered category now holds one family, four tiers, monotonic in price.
 * Categories where grade is not a real axis - Labour, Service, Accessories -
 * stay untiered and are excluded from tier swaps entirely.
 *
 * SAFETY
 * Existing rows are updated in place rather than deleted and recreated, so
 * every foreign key still resolves: template line items and the line items on
 * live quotations keep pointing at a real row. Anything the new catalogue does
 * not claim is deactivated, never deleted - goods_receipt_items references
 * cost items with ON DELETE RESTRICT, and a delete would fail or orphan data.
 *
 * Re-runnable: matching is by slug first, then by the legacy name in `from`.
 *
 *   node scripts/seed-quotation-catalogue.js [--dry]
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

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Tiered families: one category, one family, four tiers, rising in price.
// `from` names the legacy item this row takes over, so its id - and every
// reference to it - survives the reshape.
const TIERED = [
  {
    category: "Carcass", slug: "carcass", unit: "sqft", color: "#8B5CF6", order: 1,
    tiers: [
      { tier: "basic",    rate: 1500, cost: 1050, from: "HDHMR 18mm - Basic",
        desc: "16mm commercial ply, laminate on one face. 5-year warranty." },
      { tier: "standard", rate: 2000, cost: 1400, from: "HDHMR 18mm - Standard",
        desc: "18mm HDHMR, laminate both faces, edge-banded. 7-year warranty." },
      { tier: "premium",  rate: 2500, cost: 1700, from: "HDHMR 18mm - Classic",
        desc: "18mm BWP marine ply, branded laminate both faces. 10-year warranty." },
      { tier: "luxury",   rate: 3200, cost: 2100, from: "HDHMR 18mm - Signature",
        desc: "18mm BWR marine ply, anti-termite treated, imported laminate both faces. 15-year warranty." },
    ],
  },
  {
    category: "Shutters", slug: "shutters", unit: "sqft", color: "#3B82F6", order: 2,
    renameFrom: "Doors",
    tiers: [
      { tier: "basic",    rate: 1875, cost: 1300, from: "Door Basic - Plain",
        desc: "Plain laminate finish on 18mm MDF." },
      { tier: "standard", rate: 2500, cost: 1700, from: "Door Standard - Laminate",
        desc: "Matte laminate on 18mm HDHMR, edge-banded on all sides." },
      { tier: "premium",  rate: 3125, cost: 2100, from: "Door Classic - Premium Laminate",
        desc: "Acrylic or PU finish on 18mm BWP ply, soft-close fittings." },
      { tier: "luxury",   rate: 4000, cost: 2650, from: "Door Signature - Custom Finish",
        desc: "Imported high-gloss acrylic or natural veneer with PU top coat, handleless profile." },
    ],
  },
  {
    category: "Hinges", slug: "hinges", unit: "nos", color: "#0EA5E9", order: 3,
    tiers: [
      { tier: "basic",    rate: 750,  cost: 520,
        desc: "Mild steel hinge, standard closing. No damping." },
      { tier: "standard", rate: 1000, cost: 700, from: "Hinges - Indian Quality",
        desc: "Indian branded soft-close hinge, tested to 25,000 cycles." },
      { tier: "premium",  rate: 1200, cost: 820, from: "Hinges - German (Blum/Hettich)",
        desc: "Blum or Hettich soft-close hinge, tested to 50,000 cycles." },
      { tier: "luxury",   rate: 1600, cost: 1080,
        desc: "Blum Clip-top Blumotion with integrated damping, 80,000 cycles, lifetime warranty." },
    ],
  },
  {
    category: "Handles", slug: "handles", unit: "nos", color: "#14B8A6", order: 4,
    tiers: [
      { tier: "basic",    rate: 300,  cost: 200, from: "Knob - Brass",
        desc: "Brass knob, polished finish." },
      { tier: "standard", rate: 500,  cost: 340, from: "Handle - Chrome Finish",
        desc: "Chrome-finish aluminium handle, 128mm centres." },
      { tier: "premium",  rate: 750,  cost: 500, from: "Handle - Stainless Steel",
        desc: "Brushed stainless steel handle, concealed fixing." },
      { tier: "luxury",   rate: 1200, cost: 800,
        desc: "Imported designer handle, PVD finish, concealed fixing." },
    ],
  },
  {
    category: "Drawer Systems", slug: "drawer-systems", unit: "nos", color: "#F59E0B", order: 5,
    renameFrom: "Drawers",
    tiers: [
      { tier: "basic",    rate: 1800, cost: 1250,
        desc: "Telescopic ball-bearing runner, 35kg load, no damping." },
      { tier: "standard", rate: 2500, cost: 1700, from: "Soft Close Drawer Unit - Standard",
        desc: "Soft-close undermount runner, 40kg load." },
      { tier: "premium",  rate: 3500, cost: 2350, from: "Soft Close Drawer Unit - Premium",
        desc: "Blum Tandembox soft-close system, 50kg load." },
      { tier: "luxury",   rate: 4800, cost: 3200,
        desc: "Blum Legrabox with push-to-open and internal drawer, 70kg load." },
    ],
  },
  {
    category: "Wall Paneling", slug: "wall-paneling", unit: "sqft", color: "#EC4899", order: 6,
    renameFrom: "Paneling",
    tiers: [
      { tier: "basic",    rate: 750,  cost: 520,
        desc: "8mm laminate-finish MDF paneling, butt-jointed." },
      { tier: "standard", rate: 1000, cost: 700, from: "Wall Paneling - Standard",
        desc: "Louvered or grooved MDF paneling with laminate finish." },
      { tier: "premium",  rate: 1800, cost: 1200,
        desc: "12mm veneer-finish paneling with PU top coat." },
      { tier: "luxury",   rate: 2800, cost: 1850, from: "Wall Paneling - Marble",
        desc: "Italian marble or stone-finish cladding with concealed fixing." },
    ],
  },
  {
    category: "Profile Lighting", slug: "profile-lighting", unit: "rft", color: "#EAB308", order: 7,
    renameFrom: "Lighting",
    tiers: [
      { tier: "basic",    rate: 75,  cost: 50,
        desc: "Surface-mounted LED strip, 2700K, no profile or diffuser." },
      { tier: "standard", rate: 100, cost: 70, from: "Wardrobe - Profile Lighting - Straight",
        desc: "Aluminium profile with diffuser, 2700K LED strip, driver included." },
      { tier: "premium",  rate: 150, cost: 100,
        desc: "Recessed aluminium profile, tunable white LED, driver included." },
      { tier: "luxury",   rate: 220, cost: 145,
        desc: "Recessed profile with sensor-activated dimming, RGBW LED, imported driver." },
    ],
  },
];

// Untiered. Grade is not the axis here: a corner carousel is an extra, not the
// premium version of a basket, and "premium labour" is not something you sell.
// quality_tier is cleared so tier swaps skip these entirely.
const UNTIERED = [
  { category: "Accessories", slug: "accessories", unit: "nos", color: "#A855F7", order: 8,
    items: [
      { name: "Corner Carousel", rate: 4000, cost: 2650, desc: "Rotating corner unit with two shelves." },
      { name: "Organizer Basket - Large", rate: 700, cost: 470, desc: "Wire pull-out basket, full width." },
      { name: "Organizer Basket - Small", rate: 450, cost: 300, desc: "Wire pull-out basket, half width." },
      { name: "Tandem Drawer Runner", rate: 3000, cost: 2000, desc: "Standalone tandem runner pair for a retrofit drawer." },
      { name: "LED Light Strip - 6ft", rate: 1500, cost: 1000, desc: "Loose LED strip, 6ft, driver included." },
      { name: "LED Light Strip - 3ft", rate: 900, cost: 600, desc: "Loose LED strip, 3ft, driver included." },
      { name: "Toe Board", rate: 300, cost: 200, desc: "Skirting board below a floor-standing unit." },
    ] },
  { category: "Labour", slug: "labour", unit: "sqft", color: "#64748B", order: 9,
    items: [
      { name: "Installation Labour - Standard", rate: 350, cost: 240, desc: "On-site assembly and fitting, standard layout." },
      { name: "Installation Labour - Complex", rate: 600, cost: 410, desc: "On-site fitting where site conditions need extra work - false ceilings, uneven walls, tight access." },
      { name: "Fabrication Labour - Custom", rate: 500, cost: 340, desc: "Custom fabrication carried out on site." },
      { name: "Finishing Labour - Polish & Setup", rate: 250, cost: 170, desc: "Final polish, alignment and handover setup." },
    ] },
  { category: "Service", slug: "service", unit: "lot", color: "#94A3B8", order: 10,
    items: [
      { name: "Site Cleanup - Per Visit", rate: 20000, cost: 13000, unit: "lot", desc: "Debris removal and deep clean at handover." },
      { name: "Delivery Charges", rate: 6000, cost: 4000, unit: "lot", desc: "Transport of finished units to site." },
      { name: "Wall Protection - Per Wall", rate: 20, cost: 13, unit: "sqft", desc: "Protective film on finished walls during work." },
      { name: "Floor Protector - Heavy Duty", rate: 20, cost: 13, unit: "sqft", desc: "Heavy-duty floor covering during work." },
    ] },
];

const TIER_LABEL = { basic: "Basic", standard: "Standard", premium: "Premium", luxury: "Luxury" };

(async () => {
  const { data: tenants } = await db.from("quotation_cost_items").select("tenant_id");
  const tenantIds = [...new Set((tenants || []).map((t) => t.tenant_id))];
  if (tenantIds.length === 0) return console.log("No tenant has a catalogue yet - nothing to reshape.");

  for (const tenantId of tenantIds) {
    console.log(`\n=== tenant ${tenantId} ===`);

    const { data: existingCats } = await db
      .from("quotation_cost_item_categories").select("*").eq("tenant_id", tenantId);
    const { data: existingItems } = await db
      .from("quotation_cost_items").select("*").eq("tenant_id", tenantId);

    const catByName = Object.fromEntries((existingCats || []).map((c) => [c.name, c]));
    const catBySlug = Object.fromEntries((existingCats || []).map((c) => [c.slug, c]));
    const itemByName = Object.fromEntries((existingItems || []).map((i) => [i.name, i]));
    const itemBySlug = Object.fromEntries((existingItems || []).map((i) => [i.slug, i]));
    const claimed = new Set();

    const allGroups = [
      ...TIERED.map((g) => ({ ...g, tiered: true })),
      ...UNTIERED.map((g) => ({ ...g, tiered: false })),
    ];

    for (const group of allGroups) {
      // --- category ---
      let cat = catBySlug[group.slug] || (group.renameFrom && catByName[group.renameFrom]) || catByName[group.category];
      const catPayload = {
        tenant_id: tenantId, name: group.category, slug: group.slug,
        color: group.color, display_order: group.order, is_active: true,
      };
      if (cat) {
        if (!DRY) await db.from("quotation_cost_item_categories").update(catPayload).eq("id", cat.id);
        console.log(`  category ${cat.name === group.category ? "=" : `${cat.name} ->`} ${group.category}`);
      } else {
        if (!DRY) {
          const { data } = await db.from("quotation_cost_item_categories").insert(catPayload).select().single();
          cat = data;
        }
        console.log(`  category + ${group.category}`);
      }
      if (DRY && !cat) cat = { id: "(dry)" };

      // --- items ---
      const rows = group.tiered
        ? group.tiers.map((t) => ({
            name: `${group.category} - ${TIER_LABEL[t.tier]}`,
            tier: t.tier, rate: t.rate, cost: t.cost, desc: t.desc,
            unit: group.unit, from: t.from,
          }))
        : group.items.map((i) => ({
            name: i.name, tier: null, rate: i.rate, cost: i.cost,
            desc: i.desc, unit: i.unit || group.unit, from: i.name,
          }));

      rows.forEach((r, idx) => {
        r.slug = slugify(r.name);
        r.order = idx + 1;
      });

      for (const r of rows) {
        const existing = itemBySlug[r.slug] || (r.from && itemByName[r.from]);
        const payload = {
          tenant_id: tenantId, category_id: cat.id, name: r.name, slug: r.slug,
          description: r.desc, unit_code: r.unit, default_rate: r.rate,
          company_cost: r.cost, vendor_cost: Math.round(r.cost * 0.92),
          quality_tier: r.tier, display_order: r.order, is_active: true,
        };
        if (existing) {
          claimed.add(existing.id);
          if (!DRY) await db.from("quotation_cost_items").update(payload).eq("id", existing.id);
          console.log(`    ${existing.name === r.name ? "=" : `${existing.name} ->`} ${r.name}  Rs.${r.rate}`);
        } else {
          if (!DRY) {
            const { data, error } = await db.from("quotation_cost_items").insert(payload).select().single();
            if (error) { console.log(`    ! ${r.name}: ${error.message}`); continue; }
            claimed.add(data.id);
          }
          console.log(`    + ${r.name}  Rs.${r.rate}`);
        }
      }
    }

    // Anything the new catalogue did not claim is retired, not removed:
    // goods_receipt_items references cost items ON DELETE RESTRICT.
    const orphans = (existingItems || []).filter((i) => !claimed.has(i.id) && i.is_active);
    for (const o of orphans) {
      if (!DRY) await db.from("quotation_cost_items").update({ is_active: false }).eq("id", o.id);
      console.log(`    - retired ${o.name}`);
    }

    const usedCatIds = new Set();
    const { data: after } = await db.from("quotation_cost_items")
      .select("category_id").eq("tenant_id", tenantId).eq("is_active", true);
    (after || []).forEach((i) => usedCatIds.add(i.category_id));
    const staleCats = (existingCats || []).filter((c) => !usedCatIds.has(c.id) && c.is_active);
    for (const c of staleCats) {
      if (!DRY) await db.from("quotation_cost_item_categories").update({ is_active: false }).eq("id", c.id);
      console.log(`  - retired category ${c.name}`);
    }
  }
  console.log(DRY ? "\n(dry run - nothing written)" : "\ndone");
})();
