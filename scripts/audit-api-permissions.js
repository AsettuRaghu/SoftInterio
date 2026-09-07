/**
 * Which write endpoints enforce a permission, and which only check a session.
 *
 * audit-api-security.js proves every route calls protectApiRoute - that is
 * authentication: "are you signed in, and still a member of this tenant". It
 * says nothing about authorisation: "may *you* do this".
 *
 * The distinction is not academic. Every quotation template route passed the
 * security audit while accepting a write from any signed-in user, so a viewer
 * could overwrite a template through the API even though the UI hid the button.
 *
 *   node scripts/audit-api-permissions.js [--all]
 */
const fs = require("fs");
const path = require("path");

const API_DIR = path.join(__dirname, "..", "src", "app", "api");
const SHOW_ALL = process.argv.includes("--all");

// Writes that are the user acting on their own account, or that carry their own
// gate inside the handler. Listed rather than silently skipped.
const SELF_SERVICE = [
  "auth/", "billing/webhook", "quotations/client/",
  "settings/profile", "notifications",
];

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name === "route.ts") out.push(full);
  }
  return out;
};

const rows = [];

for (const file of walk(API_DIR)) {
  const src = fs.readFileSync(file, "utf8");
  const route = file
    .slice(file.indexOf("src/app/api/") + "src/app/api/".length)
    .replace(/\/route\.ts$/, "");

  for (const verb of ["POST", "PUT", "PATCH", "DELETE"]) {
    const start = src.indexOf(`export async function ${verb}`);
    if (start === -1) continue;

    // The handler body, up to the next exported handler.
    const nextExport = src.slice(start + 1).search(/\nexport async function /);
    const body = src.slice(start, nextExport === -1 ? undefined : start + 1 + nextExport);

    const hasPermission = /requiredPermissions\s*:/.test(body);
    const selfService = SELF_SERVICE.some((p) => route.startsWith(p));

    rows.push({ route, verb, hasPermission, selfService });
  }
}

const unguarded = rows.filter((r) => !r.hasPermission && !r.selfService);
const guarded = rows.filter((r) => r.hasPermission);

console.log(`Write handlers: ${rows.length}`);
console.log(`  enforce a permission: ${guarded.length}`);
console.log(`  session only:         ${unguarded.length}`);
console.log(`  self-service/webhook: ${rows.length - guarded.length - unguarded.length}\n`);

const byRoute = {};
unguarded.forEach((r) => (byRoute[r.route] ??= []).push(r.verb));

console.log("Session-only writes, grouped by area:\n");
const areas = {};
Object.entries(byRoute).forEach(([route, verbs]) => {
  const area = route.split("/")[0];
  (areas[area] ??= []).push(`${route} [${verbs.join(",")}]`);
});
Object.entries(areas)
  .sort((a, b) => b[1].length - a[1].length)
  .forEach(([area, list]) => {
    console.log(`  ${area} (${list.length})`);
    (SHOW_ALL ? list : list.slice(0, 6)).forEach((l) => console.log(`     ${l}`));
    if (!SHOW_ALL && list.length > 6) console.log(`     ... and ${list.length - 6} more`);
  });

if (guarded.length) {
  console.log("\nAlready enforcing a permission:");
  guarded.forEach((r) => console.log(`  ${r.route} [${r.verb}]`));
}
