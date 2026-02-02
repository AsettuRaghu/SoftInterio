/**
 * Server-side logging configuration
 * Suppresses Next.js built-in HTTP request logging from the dev server
 * Only our custom API logger will be visible
 *
 * This file must be JavaScript (.js) to run at module load time
 */

// Store original console methods
const originalLog = console.log;
const originalInfo = console.info;
const originalError = console.error;
const originalWarn = console.warn;

// Regex patterns for Next.js dev server logs we want to suppress
const SUPPRESS_PATTERNS = [
  // Next.js dev server HTTP request logs: "GET /path 200 in 123ms"
  /^\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+[/\w].*\s+(1\d{2}|2\d{2}|3\d{2}|4\d{2}|5\d{2})\s+in\s+[\d.]+\s*[ms]{1,2}/i,
  // Page route logs: "GET /dashboard 200 in 123ms"
  /^\s+(GET|POST)\s+\/dashboard[/\w]*\s+(1\d{2}|2\d{2}|3\d{2}|4\d{2}|5\d{2})\s+in\s+[\d.]+/i,
  // Render/compile logs
  /compile:\s*[\d.]+m?s|proxy\.ts:\s*[\d.]+m?s|render:\s*[\d.]+m?s/i,
  // Ready messages
  /✓.*Ready in/,
  // Build warnings
  /\[baseline-browser-mapping\]/,
  /middleware.*deprecated/i,
  // HMR messages
  /hmr.*update/i,
];

/**
 * Check if log should be suppressed
 */
function shouldSuppress(message) {
  if (typeof message !== "string") return false;
  return SUPPRESS_PATTERNS.some((pattern) => {
    try {
      return pattern.test(message);
    } catch {
      return false;
    }
  });
}

/**
 * Check if any argument contains suppressed patterns
 */
function containsSuppressedContent(...args) {
  return args.some((arg) => {
    if (typeof arg === "string") {
      return shouldSuppress(arg);
    }
    return false;
  });
}

// Override console methods to filter Next.js dev server logs
console.log = function (...args) {
  if (!containsSuppressedContent(...args)) {
    originalLog.apply(console, args);
  }
};

console.info = function (...args) {
  if (!containsSuppressedContent(...args)) {
    originalInfo.apply(console, args);
  }
};

// Keep error and warn as-is (don't suppress actual errors/warnings)
console.error = originalError;
console.warn = originalWarn;

module.exports = {};
