import { defineConfig, devices } from "@playwright/test";

// Mobile is the acceptance device (PLAN §8). Loop 0 runs the smoke tour on an
// iPhone and an Android viewport against the production build served locally.
//
// HIFTH_BASE_URL points the run at an already-served build instead of starting
// one. That is what makes `make golden-linux` possible: the preview server runs
// on the host (its node_modules are built for the host), while the browser runs
// in the Playwright Linux container that produces CI-shaped baselines.
const externalBase = process.env.HIFTH_BASE_URL;

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
    baseURL: externalBase ?? "http://localhost:4173",
    trace: "on-first-retry",
  },
  // Golden images are geometry, and geometry is rasterized per platform — the
  // same build differs by a few anti-aliased pixels between macOS and Linux. The
  // path carries the platform so a Linux baseline set can be added beside the
  // committed macOS one (see `make golden-linux`) rather than fighting it.
  snapshotPathTemplate: "{testDir}/__screenshots__/{platform}/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      // Tolerance for anti-aliasing only: 0.5% of pixels, and a pixel must
      // differ meaningfully to count. A wash that moved, a clone that landed in
      // the wrong coordinate space, or a skin that shifted geometry are all
      // orders of magnitude larger than this.
      maxDiffPixelRatio: 0.005,
      threshold: 0.25,
      animations: "disabled",
      caret: "hide",
    },
  },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 13"] }, testIgnore: /golden\.spec\.ts/ },
    { name: "android", use: { ...devices["Pixel 7"] }, testIgnore: /golden\.spec\.ts/ },
    {
      // The golden-image project. Its viewport is spelled out rather than taken
      // from `devices` on purpose: a Playwright upgrade that retunes a device
      // descriptor would silently invalidate every committed baseline.
      name: "golden",
      testMatch: /golden\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  ...(externalBase
    ? {}
    : {
        webServer: {
          command: "pnpm exec vite preview --port 4173 --strictPort",
          url: "http://localhost:4173",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
