import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Serveur de test isolé : base .env.test, port 3100, boîte mail dédiée.
const testEnv: Record<string, string> = {};
config({ path: ".env.test", processEnv: testEnv, quiet: true });
const E2E_MAILBOX = ".dev-mailbox-e2e";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 300_000,
  expect: { timeout: 30_000 },
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: testEnv.APP_URL ?? "http://localhost:3100",
    locale: "fr-FR",
    timezoneId: "Africa/Dakar",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx next dev --port 3100",
    url: "http://localhost:3100",
    timeout: 180_000,
    reuseExistingServer: false,
    // Next.js lit aussi .env : on neutralise les services externes (salle virtuelle en mode démo).
    env: { ...testEnv, DEV_MAILBOX_DIR: E2E_MAILBOX, LIVEKIT_URL: "", LIVEKIT_API_KEY: "", LIVEKIT_API_SECRET: "" },
  },
});
