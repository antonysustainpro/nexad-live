import { defineConfig, devices } from "@playwright/test";

/**
 * NEXUSAD E2E TEST CONFIGURATION
 *
 * Three run modes:
 *
 * 1. LOCAL DEV  (default)  — spins up "npm run dev" on port 3001,
 *    tests hit real RunPod backend via /api/proxy.
 *
 * 2. CI  (env CI=true)  — expects a pre-built Next.js server on port 3001.
 *    Set BACKEND_URL to override the RunPod target.
 *
 * 3. PRODUCTION SMOKE  (env BASE_URL=https://nexusad.ai)  — hits prod directly,
 *    no local server started.
 */

const isCI = !!process.env.CI;
const isProductionSmoke = !!process.env.BASE_URL && process.env.BASE_URL !== "http://localhost:3001";

const baseURL = process.env.BASE_URL || "http://localhost:3001";

export default defineConfig({
  testDir: "./e2e",

  // Global timeout per test (real backend calls need extra headroom)
  timeout: 60000,

  // Retry once on flaky network timeouts
  retries: isCI ? 2 : 1,

  // Run test files in parallel; tests within a file run sequentially
  fullyParallel: true,
  workers: isCI ? 2 : undefined,

  // HTML report + JSON for CI dashboards
  reporter: [
    ["html", { outputFolder: "test-results/html", open: "never" }],
    ["json", { outputFile: "test-results/results.json" }],
    ["list"],
  ],

  use: {
    baseURL,
    headless: true,
    viewport: { width: 1440, height: 900 },

    // Capture artefacts only on failure to keep CI lean
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",

    // Real network calls to RunPod go through Next.js /api/proxy.
    // We do NOT block any hosts — real backend is the point.
    bypassCSP: false,

    // Give real API calls enough time
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  // Spin up the dev server unless hitting prod directly
  webServer:
    !isProductionSmoke
      ? {
          command: isCI ? "npm run start -- -p 3001" : "npm run dev -- -p 3001",
          port: 3001,
          reuseExistingServer: !isCI,
          timeout: isCI ? 120000 : 60000,
          env: {
            // Forward backend URL into the Next.js process so /api/proxy routes correctly
            BACKEND_API_URL: process.env.BACKEND_API_URL || "https://4ljj3bdk1x0vhv-9000.proxy.runpod.net/api/v1",
            NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "https://4ljj3bdk1x0vhv-9000.proxy.runpod.net/api/v1",
          },
        }
      : undefined,

  projects: [
    // -----------------------------------------------------------------------
    // DESKTOP  — primary surface, all critical journeys run here
    // -----------------------------------------------------------------------
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },

    // -----------------------------------------------------------------------
    // MOBILE  — verify the same journeys work on a small viewport
    // -----------------------------------------------------------------------
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        // Playwright's iPhone 13 preset already sets viewport + UA
      },
    },

    // -----------------------------------------------------------------------
    // TABLET  — mid-size viewport
    // -----------------------------------------------------------------------
    {
      name: "tablet",
      use: {
        ...devices["iPad (gen 7)"],
        viewport: { width: 768, height: 1024 },
      },
    },
  ],
});
