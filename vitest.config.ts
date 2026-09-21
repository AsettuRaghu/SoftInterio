import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests for the pure pieces that price a customer's quotation - the
// formula evaluator, the costing rule, the option shapes. No database, no
// React: `npm test` runs in a second.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
