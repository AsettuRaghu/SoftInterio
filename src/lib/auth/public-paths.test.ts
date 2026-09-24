import { describe, it, expect } from "vitest";
import { isPublicPath } from "./public-paths";

/**
 * The allowlist is the wall around every unauthenticated page, so the boundary
 * cases are worth pinning: a prefix must not leak the path that merely starts
 * with the same letters.
 */
describe("isPublicPath", () => {
  it("lets the quotation link through, with its token", () => {
    expect(isPublicPath("/quotation")).toBe(true);
    expect(isPublicPath("/quotation/abc123")).toBe(true);
    expect(isPublicPath("/quotation/abc123/anything")).toBe(true);
  });

  it("stops at a segment boundary", () => {
    // The trap a regex or a bare startsWith would fall into.
    expect(isPublicPath("/quotationsecret")).toBe(false);
    expect(isPublicPath("/quotations")).toBe(false);
    expect(isPublicPath("/quotation-config")).toBe(false);
  });

  it("keeps everything else behind sign-in", () => {
    for (const p of [
      "/dashboard",
      "/dashboard/quotations/123",
      "/scope-summary/abc",
      "/settings",
      "/",
      "",
    ]) {
      expect(isPublicPath(p)).toBe(false);
    }
  });
});
