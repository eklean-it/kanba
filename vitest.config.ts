import { defineConfig } from "vitest/config";
import path from "node:path";

// First test setup in this repo. It shipped V1 on 2026-07-10 with zero tests and
// no CI, which is a poor place to be for the tool the whole team is moving onto —
// nothing would catch a bad push. Start with the security-critical and
// data-shaping logic; UI tests can follow.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
