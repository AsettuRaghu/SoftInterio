#!/usr/bin/env node
/**
 * API Route Security Update Script
 *
 * This script automatically adds protectApiRoute() to all unprotected routes.
 * Run: node scripts/update-api-security.js
 */

const fs = require("fs");
const path = require("path");

const API_DIR = path.join(__dirname, "..", "src", "app", "api");

// Routes that should remain public (no protection needed)
const PUBLIC_ROUTES = [
  "auth/signin",
  "auth/signup",
  "auth/forgot-password",
  "auth/reset-password",
  "auth/validate-invite",
  "auth/complete-invite",
  "auth/accept-invite",
  "auth/callback",
  "auth/check-user",
  "auth/cleanup-and-reinvite",
  "auth/signout", // signout doesn't need protection
  "billing/plans",
];

// Routes that need special handling (admin operations)
const ADMIN_ROUTES = [
  "team/invite",
  "team/members",
  "team/members/[id]/roles",
  "team/members/[id]/reactivate",
  "team/members/[id]/transfer-ownership",
];

function getAllRouteFiles(dir, files = []) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      getAllRouteFiles(fullPath, files);
    } else if (item === "route.ts") {
      files.push(fullPath);
    }
  }

  return files;
}

function getRelativePath(filePath) {
  return path.relative(API_DIR, filePath).replace(/\/route\.ts$/, "");
}

function shouldSkip(relativePath) {
  return (
    PUBLIC_ROUTES.some((p) => relativePath.startsWith(p)) ||
    relativePath.startsWith("debug")
  );
}

function isAlreadyProtected(content) {
  return content.includes("protectApiRoute");
}

function hasExportedHandlers(content) {
  return /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/.test(
    content,
  );
}

function needsAdminClient(relativePath) {
  return ADMIN_ROUTES.some(
    (p) => relativePath === p || relativePath.startsWith(p + "/"),
  );
}

function updateRouteFile(filePath) {
  const relativePath = getRelativePath(filePath);
  let content = fs.readFileSync(filePath, "utf8");

  if (shouldSkip(relativePath)) {
    return { path: relativePath, status: "skipped", reason: "public route" };
  }

  if (!hasExportedHandlers(content)) {
    return { path: relativePath, status: "skipped", reason: "no handlers" };
  }

  if (isAlreadyProtected(content)) {
    return { path: relativePath, status: "already-protected" };
  }

  // Add import at the top
  const importStatement = `import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";`;

  // Check if import already exists
  if (!content.includes("protectApiRoute")) {
    // Find the last import statement
    const importRegex = /^import .+;?\s*$/gm;
    let lastImportEnd = 0;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      lastImportEnd = match.index + match[0].length;
    }

    if (lastImportEnd > 0) {
      content =
        content.slice(0, lastImportEnd) +
        "\n" +
        importStatement +
        content.slice(lastImportEnd);
    } else {
      content = importStatement + "\n\n" + content;
    }
  }

  // Now update each handler function
  const handlers = ["GET", "POST", "PUT", "PATCH", "DELETE"];

  for (const handler of handlers) {
    // Pattern to match handler function
    const handlerPattern = new RegExp(
      `(export\\s+async\\s+function\\s+${handler}\\s*\\([^)]*\\)\\s*\\{)\\s*\\n(\\s*)try\\s*\\{\\s*\\n(\\s*)(?:const\\s+supabase|const\\s+adminSupabase|const\\s+userSupabase|const\\s+\\{)`,
      "g",
    );

    const protectionCode = `$1
$2try {
$3// Protect API route
$3const guard = await protectApiRoute(request);
$3if (!guard.success) {
$3  return createErrorResponse(guard.error!, guard.statusCode!);
$3}
$3const { user } = guard;
$3
$3const`;

    if (handlerPattern.test(content)) {
      content = content.replace(handlerPattern, protectionCode);
    }
  }

  // Also handle simple patterns without try-catch
  for (const handler of handlers) {
    const simplePattern = new RegExp(
      `(export\\s+async\\s+function\\s+${handler}\\s*\\([^)]*\\)\\s*\\{)\\s*\\n(\\s*)(const\\s+supabase)`,
      "g",
    );

    if (
      simplePattern.test(content) &&
      !content.includes("protectApiRoute(request)")
    ) {
      content = content.replace(
        simplePattern,
        `$1
$2// Protect API route
$2const guard = await protectApiRoute(request);
$2if (!guard.success) {
$2  return createErrorResponse(guard.error!, guard.statusCode!);
$2}
$2const { user } = guard;

$2$3`,
      );
    }
  }

  fs.writeFileSync(filePath, content);
  return { path: relativePath, status: "updated" };
}

function main() {
  console.log("\n🔐 API Route Security Update Script\n");
  console.log("=".repeat(60));

  const routeFiles = getAllRouteFiles(API_DIR);
  const results = routeFiles.map(updateRouteFile);

  const updated = results.filter((r) => r.status === "updated");
  const skipped = results.filter((r) => r.status === "skipped");
  const alreadyProtected = results.filter(
    (r) => r.status === "already-protected",
  );

  console.log("\n✅ UPDATED (" + updated.length + ")");
  updated.forEach((r) => console.log("  ✓ " + r.path));

  console.log("\n⚪ ALREADY PROTECTED (" + alreadyProtected.length + ")");
  alreadyProtected.forEach((r) => console.log("  - " + r.path));

  console.log("\n⏭️  SKIPPED (" + skipped.length + ")");
  skipped.forEach((r) => console.log("  - " + r.path + " (" + r.reason + ")"));

  console.log("\n" + "=".repeat(60));
  console.log("Done! Updated " + updated.length + " routes.");
  console.log('\nRun "node scripts/audit-api-security.js" to verify.');
}

main();
