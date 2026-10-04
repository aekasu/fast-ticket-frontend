import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests for the pure pieces (parsing, formatting, expansion). The screens are covered end to end by Playwright.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
