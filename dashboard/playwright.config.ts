import { defineConfig, devices } from "@playwright/test";

/** E2E on the built static export (`pnpm build` first), served under the GitHub Pages base path. */
const PORT = 4173;
const BASE = process.env.DASHBOARD_BASE_PATH ?? "/shorts-pipeline";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // CI never writes reference screenshots: a platform without its baseline skips the visual test
  updateSnapshots: process.env.CI ? "none" : "missing",
  use: { baseURL: `http://localhost:${PORT}${BASE}/`, trace: "retain-on-failure" },
  webServer: {
    command: "node e2e/serve.mjs",
    url: `http://localhost:${PORT}${BASE}/`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT), DASHBOARD_BASE_PATH: BASE },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true } },
  ],
});
