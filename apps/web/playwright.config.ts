import { defineConfig, devices } from "@playwright/test";

// Mobile is the acceptance device (PLAN §8). Loop 0 runs the smoke tour on an
// iPhone and an Android viewport against the production build served locally.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One retry everywhere: WebKit occasionally needs a second attempt when the
  // machine is busy launching the other project's contexts (page-setup starves
  // past the timeout). A retry absorbs that infra flake without masking real
  // failures, which fail both attempts.
  retries: 1,
  // Cap parallelism: WebKit (iPhone) is heavy, and too many concurrent contexts
  // starve the browser on constrained machines/CI runners, timing out during
  // page setup. Two keeps the suite parallel but stable across both projects.
  workers: 2,
  // WebKit page setup under contention can exceed the 30s default; give tests
  // room so a slow-but-correct launch isn't scored as a failure.
  timeout: 60_000,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 13"] } },
    { name: "android", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "pnpm exec vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
