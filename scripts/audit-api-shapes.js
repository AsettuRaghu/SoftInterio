/**
 * Compares what each API route returns against what its callers read.
 *
 * WHY: two bugs in one week came from a caller and a route disagreeing about a
 * response shape, and both were invisible until something failed at runtime.
 * The revision route replies { quotation }, a caller read data.id, and the app
 * navigated to /quotations/undefined. The PDF route reports its cause in
 * `details`, and the dialog showed only the generic headline.
 *
 * TypeScript cannot catch this: a route handler returns NextResponse, and
 * `await res.json()` is `any` on the other side. So this reads both sides as
 * text and reports where they disagree.
 *
 * Heuristic by nature - it parses source rather than executing it - so treat
 * the output as a list to check, not a list of confirmed bugs.
 *
 *   node scripts/audit-api-shapes.js [--verbose]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "src");
const VERBOSE = process.argv.includes("--verbose");

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
};

const files = walk(ROOT);

// ---------------------------------------------------------------- routes ----
// Route path from the file path: src/app/api/a/[id]/b/route.ts -> /api/a/*/b
const routeKey = (file) =>
  file
    .slice(file.indexOf("src/app") + "src/app".length)
    .replace(/\/route\.ts$/, "")
    .replace(/\[[^\]]+\]/g, "*");

const routes = new Map();

/**
 * Comments confuse the brace counting - a `// Line items without a space`
 * beside a key hid every key after it, so routes looked like they returned
 * less than they do.
 */
const stripComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

for (const file of files.filter((f) => f.endsWith("/route.ts"))) {
  const src = stripComments(fs.readFileSync(file, "utf8"));
  const keys = new Set();

  // Every NextResponse.json({ ... }) that is not an error reply.
  const re = /NextResponse\.json\(\s*\{([\s\S]*?)\}\s*(?:,\s*\{[^}]*\}\s*)?\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const body = m[1];
    // Error replies count too. A 409 that returns existingClientId, or a 500
    // that returns details, is part of the contract - a caller reading either
    // is correct, and skipping those branches reported both as mismatches.
    // Top-level keys only: `foo:` or `foo,` at depth zero of this object.
    let depth = 0;
    let current = "";
    for (const ch of body) {
      if ("{[(".includes(ch)) depth++;
      else if ("}])".includes(ch)) depth--;
      else if (ch === "," && depth === 0) {
        const k = current.trim().split(/[:\s]/)[0];
        if (/^[a-zA-Z_][\w]*$/.test(k)) keys.add(k);
        current = "";
        continue;
      }
      current += ch;
    }
    const last = current.trim().split(/[:\s]/)[0];
    if (/^[a-zA-Z_][\w]*$/.test(last)) keys.add(last);
  }

  if (keys.size) routes.set(routeKey(file), { file, keys });
}

// --------------------------------------------------------------- callers ----
const findings = [];

let skippedPromiseAll = 0;

for (const file of files.filter((f) => !f.includes("/app/api/"))) {
  // Comments are stripped here too. Without it a comment explaining a past
  // bug - "reading data.id gave undefined" - was itself reported as reading
  // data.id, so a fixed bug kept showing up as broken.
  const src = stripComments(fs.readFileSync(file, "utf8"));
  const lines = src.split("\n");

  lines.forEach((line, i) => {
    const urlMatch = line.match(/fetch\(\s*[`"']([^`"']*\/api\/[^`"'?]*)/);
    if (!urlMatch) return;

    // Normalise a template literal into the same shape as the route key.
    const url = urlMatch[1].replace(/\$\{[^}]*\}/g, "*").replace(/\/$/, "");

    const route = routes.get(url) || routes.get(url.replace(/\/\*$/, ""));
    if (!route) return;

    // Promise.all pairs each response by array position, which this cannot
    // follow - it would attribute one response's fields to another's route.
    // Counted and skipped rather than guessed at.
    const before = lines.slice(Math.max(0, i - 6), i + 1).join("\n");
    if (/Promise\.all\(\s*\[/.test(before)) {
      skippedPromiseAll++;
      return;
    }

    // Follow this response specifically rather than scanning a window.
    //
    // A first attempt looked at the next twenty-five lines for anything of the
    // form data.x, which reported every neighbouring fetch in a Promise.all as
    // a mismatch. So: find the variable this response was assigned to, find
    // where it is parsed, and only then look at what is read off the parsed
    // object.
    // Stop at the next fetch, so one caller never reads another's response.
    // Without this a DELETE and a download sitting in the same component -
    // both writing `const data = await response.json()` - had the second's
    // fields attributed to the first.
    const rest = lines.slice(i + 1, i + 30);
    const nextFetch = rest.findIndex((l) => /\bfetch\(/.test(l));
    const window = [
      line,
      ...(nextFetch === -1 ? rest : rest.slice(0, nextFetch)),
    ].join("\n");

    const resVar =
      (line.match(/(?:const|let)\s+(\w+)\s*=\s*await\s+fetch/) || [])[1] ||
      (line.match(/(?:const|let)\s+\{\s*\w+\s*\}\s*=\s*await\s+fetch/) ? null : null);

    // const data = await res.json()  /  const { a, b } = await res.json()
    const parsePattern = resVar
      ? new RegExp(
          `(?:const|let)\\s+(\\w+|\\{[^}]*\\})\\s*=\\s*await\\s+${resVar}\\.json\\(\\)`
        )
      : /(?:const|let)\s+(\w+|\{[^}]*\})\s*=\s*await\s+\w+\.json\(\)/;

    const parsed = window.match(parsePattern);
    if (!parsed) return;

    const reads = new Set();
    const target = parsed[1];

    if (target.startsWith("{")) {
      // Destructured: every name is a top-level key, renames included.
      target
        .replace(/[{}]/g, "")
        .split(",")
        .map((part) => part.split(":")[0].trim())
        .filter(Boolean)
        .forEach((k) => reads.add(k));
    } else {
      const readRe = new RegExp(`\\b${target}\\??\\.([a-zA-Z_]\\w*)`, "g");
      let r;
      while ((r = readRe.exec(window)) !== null) reads.add(r[1]);
    }

    for (const key of reads) {
      // json() and other Response members are not payload fields.
      if (["json", "ok", "status", "statusText", "headers", "blob", "text", "map", "filter", "length", "forEach"].includes(key))
        continue;
      if (route.keys.has(key)) continue;
      findings.push({
        file: file.slice(file.indexOf("src/")),
        line: i + 1,
        url,
        key,
        routeFile: route.file.slice(route.file.indexOf("src/")),
        returns: [...route.keys].sort().join(", "),
      });
    }
  });
}

// ---------------------------------------------------------------- report ----
console.log(`Routes with a known shape: ${routes.size}`);
console.log(`Possible mismatches: ${findings.length}`);
console.log(
  `Skipped inside Promise.all: ${skippedPromiseAll} (position-paired, not analysable here)\n`
);

const byRoute = {};
findings.forEach((f) => (byRoute[f.url] ??= []).push(f));

for (const [url, items] of Object.entries(byRoute).sort()) {
  console.log(`${url}`);
  console.log(`   returns: ${items[0].returns}`);
  const seen = new Set();
  for (const f of items) {
    const sig = `${f.file}:${f.key}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    console.log(`   reads .${f.key.padEnd(22)} ${f.file}:${f.line}`);
  }
  console.log("");
}

if (VERBOSE) {
  console.log("\n--- every route shape ---");
  [...routes.entries()].sort().forEach(([k, v]) =>
    console.log(`${k}\n   ${[...v.keys].sort().join(", ")}`)
  );
}
