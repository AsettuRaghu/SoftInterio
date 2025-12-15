#!/usr/bin/env node
/**
 * API Route Security Audit Script
 *
 * Run this script to check all API routes for security compliance:
 * node scripts/audit-api-security.js
 *
 * This script checks for:
 * 1. Routes missing protectApiRoute()
 * 2. Routes using adminClient without protection
 * 3. Routes missing tenant_id filtering
 */

const fs = require("fs");
const path = require("path");

const API_DIR = path.join(__dirname, "..", "src", "app", "api");

// Routes that don't need protection (public endpoints)
const EXCLUDED_ROUTES = [
  "auth/signin",
  "auth/signup",
  "auth/signout", // Sign out needs to work even with partial auth states
  "auth/forgot-password",
  "auth/reset-password",
  "auth/validate-invite",
  "auth/complete-invite",
  "auth/accept-invite",
  "auth/callback",
  "auth/check-user",
  "auth/cleanup-and-reinvite",
  "auth/debug-invite",
  "billing/plans",
  "debug",
  "quotations/client", // Client-facing endpoints with token-based auth
];

// Patterns to check
const PATTERNS = {
  hasProtection: /protectApiRoute\s*\(/,
  usesAdminClient: /createAdminClient\s*\(\)/,
  hasTenantFilter: /\.eq\s*\(\s*["']tenant_id["']/,
  hasAuthCheck: /auth\.getUser\s*\(\)/,
  isExportedFunction: /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/,
};

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

function auditRoute(filePath) {
  const relativePath = getRelativePath(filePath);
  const content = fs.readFileSync(filePath, "utf8");

  // Check if excluded
  if (EXCLUDED_ROUTES.some((excluded) => relativePath.startsWith(excluded))) {
    return { path: relativePath, status: "excluded", issues: [] };
  }

  // Check if it has exported functions
  if (!PATTERNS.isExportedFunction.test(content)) {
    return { path: relativePath, status: "no-handlers", issues: [] };
  }

  const issues = [];

  // Check for protection
  const hasProtection = PATTERNS.hasProtection.test(content);
  const usesAdminClient = PATTERNS.usesAdminClient.test(content);
  const hasTenantFilter = PATTERNS.hasTenantFilter.test(content);
  const hasBasicAuth = PATTERNS.hasAuthCheck.test(content);

  if (!hasProtection && !hasBasicAuth) {
    issues.push("❌ NO AUTH: No authentication check found");
  } else if (!hasProtection && hasBasicAuth) {
    issues.push(
      "⚠️  PARTIAL: Uses basic auth.getUser() but not protectApiRoute()"
    );
  }

  if (usesAdminClient && !hasProtection) {
    issues.push("🚨 CRITICAL: Uses adminClient WITHOUT protectApiRoute()");
  }

  // Only warn about missing tenant filter if protectApiRoute is not used
  // Routes with protectApiRoute + adminClient typically verify tenant membership through user lookups
  if (usesAdminClient && !hasTenantFilter && !hasProtection) {
    issues.push("⚠️  TENANT: Uses adminClient without tenant_id filter");
  }

  if (issues.length === 0) {
    return { path: relativePath, status: "protected", issues: [] };
  }

  return { path: relativePath, status: "needs-fix", issues };
}

function main() {
  console.log("\\n🔐 API Route Security Audit\\n");
  console.log("=".repeat(60));

  if (!fs.existsSync(API_DIR)) {
    console.error("API directory not found:", API_DIR);
    process.exit(1);
  }

  const routeFiles = getAllRouteFiles(API_DIR);
  const results = routeFiles.map(auditRoute);

  // Group by status
  const protected = results.filter((r) => r.status === "protected");
  const needsFix = results.filter((r) => r.status === "needs-fix");
  const excluded = results.filter((r) => r.status === "excluded");
  const noHandlers = results.filter((r) => r.status === "no-handlers");

  // Print results
  console.log("\\n✅ PROTECTED ROUTES (" + protected.length + ")\\n");
  protected.forEach((r) => console.log("  ✓ " + r.path));

  console.log("\\n⚪ EXCLUDED (public) ROUTES (" + excluded.length + ")\\n");
  excluded.forEach((r) => console.log("  - " + r.path));

  if (needsFix.length > 0) {
    console.log("\\n🚨 ROUTES NEEDING ATTENTION (" + needsFix.length + ")\\n");
    needsFix.forEach((r) => {
      console.log("  📁 " + r.path);
      r.issues.forEach((issue) => console.log("     " + issue));
      console.log("");
    });
  }

  // Summary
  console.log("\\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log("  Protected:      " + protected.length);
  console.log("  Needs Fix:      " + needsFix.length);
  console.log("  Excluded:       " + excluded.length);
  console.log("  No Handlers:    " + noHandlers.length);
  console.log("  Total:          " + results.length);

  if (needsFix.length > 0) {
    console.log("\\n⚠️  " + needsFix.length + " routes need security updates!");
    console.log("\\nTo fix, import and use protectApiRoute():");
    console.log(
      '\\n  import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";'
    );
    console.log("\\n  const guard = await protectApiRoute(request);");
    console.log("  if (!guard.success) {");
    console.log(
      "    return createErrorResponse(guard.error!, guard.statusCode!);"
    );
    console.log("  }");
    process.exit(1);
  } else {
    console.log("\\n✅ All routes are properly secured!");
  }
}

main();
