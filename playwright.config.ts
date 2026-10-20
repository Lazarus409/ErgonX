import { defineConfig, devices } from "@playwright/test";

/**
 * Release smoke tests. They expect the backend (seeded with seed_ergonx_demo) and
 * the frontend to be running already; see e2e/README.md. E2E_BROWSER_CHANNEL=msedge
 * uses an installed Edge instead of Playwright's own Chromium.
 */
export default defineConfig({
  testDir: "./e2e/specs",
  // `next dev` compiles each route on its first visit, which can take a minute or more.
  timeout: 300_000,
  expect: { timeout: 120_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    navigationTimeout: 180_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.E2E_BROWSER_CHANNEL } },
    { name: "phone", use: { ...devices["Pixel 7"], channel: process.env.E2E_BROWSER_CHANNEL } },
  ],
});
