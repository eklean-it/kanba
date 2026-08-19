import { describe, expect, it } from "vitest";
import { isSuperAdmin, SUPER_ADMIN_EMAILS } from "@/lib/super-admins";

// This allowlist is the UX half of the gate on /dashboard/team and
// /dashboard/boards; /api/admin/* is the real boundary. Both call this function,
// so a bug here is a permissions bug on a route that can provision accounts,
// reset passwords, and read every board. Worth pinning.

describe("isSuperAdmin", () => {
  it("accepts exactly the three allowlisted addresses", () => {
    expect(SUPER_ADMIN_EMAILS).toHaveLength(3);
    for (const email of SUPER_ADMIN_EMAILS) {
      expect(isSuperAdmin(email)).toBe(true);
    }
  });

  it("rejects everyone else, including other eklean.com staff", () => {
    // Jared is deliberately NOT on this list — that is why /dashboard/team was
    // invisible to him and read as a dead link (Erykah, 2026-08-18).
    for (const email of [
      "jared@eklean.com",
      "customerservice@eklean.com",
      "schedule@eklean.com",
      "attacker@evil.com",
    ]) {
      expect(isSuperAdmin(email), email).toBe(false);
    }
  });

  it("rejects null, undefined and empty", () => {
    expect(isSuperAdmin(null)).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
    expect(isSuperAdmin("")).toBe(false);
    expect(isSuperAdmin("   ")).toBe(false);
  });

  it("tolerates surrounding whitespace and mixed case", () => {
    expect(isSuperAdmin("  erykah@eklean.com ")).toBe(true);
    expect(isSuperAdmin("Erykah@eklean.com")).toBe(true);
    expect(isSuperAdmin("ERYKAH@EKLEAN.COM")).toBe(true);
  });

  it("does not match on a substring or a lookalike domain", () => {
    for (const email of [
      "erykah@eklean.com.evil.com",
      "xerykah@eklean.com",
      "erykah@eklean.co",
      "erykah@ekleann.com",
    ]) {
      expect(isSuperAdmin(email), email).toBe(false);
    }
  });
});
