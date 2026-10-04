import { defineConfig } from "@playwright/test";

// Credentials: the admin from the backend's .env (`set -a; . ../fast-ticket/.env; set +a`) and the non-admin test
// agent from .env.local. Neither is ever committed.
try {
  process.loadEnvFile(".env.local");
} catch {
  /* optional */
}

const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  // The login route allows 10 attempts a minute per address: log in once (global setup) and reuse the session.
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
