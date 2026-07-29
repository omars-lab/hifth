import { defineConfig, devices } from "@playwright/test";

// Mobile is the acceptance device (PLAN §8). Loop 0 runs the smoke tour on an
// iPhone and an Android viewport against the production build served locally.
//
// HIFTH_BASE_URL points the run at an already-served build instead of starting
// one. That is what makes `make golden-linux` possible: the preview server runs
// on the host (its node_modules are built for the host), while the browser runs
// in the Playwright Linux container that produces CI-shaped baselines.
const externalBase = process.env.HIFTH_BASE_URL;

// The guide's screenshots (e2e/shots.spec.ts → docs/validation/shots/) are a
// documentation build, not a test. Their project only exists when `make shots`
// asks for it, so a plain `make e2e` can neither rewrite committed pictures as a
// side effect nor fail on the @probe half, which needs a VITE_PERF_PROBE build
// that an ordinary run does not have.
const shots = process.env.HIFTH_SHOTS === "1";

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
  // Playwright's own reporters, not a hand-rolled one. They are complementary to
  // this repo's validation reporting, and the split is worth stating because it
  // decides what must never be duplicated:
  //
  //   this report          → did the automated tier hold, and exactly where did
  //                          it break — trace, DOM snapshot, console, network,
  //                          and the three-way image diff for a golden failure.
  //   make validate/guide  → what a human still has to do, and what their
  //                          verdict tunes (docs/validation/ledger.json).
  //
  // The ledger points *at* a run; it never restates one. Read either with
  // `make report`; the /review-reports skill says which answers which question.
  //
  // `open: "never"` is load-bearing. The html reporter defaults to serving the
  // report on failure, which would hang `make e2e`, `make ci` and every agent
  // that runs them behind a web server nobody asked for.
  //
  // `github` in CI annotates the failing line in the PR diff. `list` stays
  // alongside it so the raw log is still readable.
  reporter: [
    process.env.CI ? (["github"] as const) : (["list"] as const),
    ["html", { open: "never" as const }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  use: {
    baseURL: externalBase ?? "http://localhost:4173",
    // Arabic is the suite's default because it is the app's, and because every
    // committed aria snapshot and golden image was recorded in it. Without this
    // the chrome's language would be the *runner's* locale: a laptop set to
    // en-US and a CI container set to C would disagree about what the header
    // says, and the snapshots would fail on one machine and pass on the other
    // for a reason nothing in the diff would explain. `lang.spec.ts` overrides
    // it per-file with `test.use({ locale: "en-US" })` — that is the one place
    // the other language is under test, and it should have to say so.
    locale: "ar",
    // The first attempt is not traced — `retries: 1` means a real failure always
    // gets a second, traced run, and tracing every passing test costs the whole
    // suite time for artifacts nobody opens.
    trace: "on-first-retry",
    // Cheap, and the difference between "toHaveText failed" and seeing the screen
    // it failed on. Image-comparison failures write their own diff triptych.
    screenshot: "only-on-failure",
  },
  // Golden images are geometry, and geometry is rasterized per platform — the
  // same build differs by a few anti-aliased pixels between macOS and Linux. The
  // path carries the platform so a Linux baseline set can be added beside the
  // committed macOS one (see `make golden-linux`) rather than fighting it.
  snapshotPathTemplate: "{testDir}/__screenshots__/{platform}/{arg}{ext}",
  expect: {
    // Aria snapshots are text, not geometry — they must NOT inherit the golden
    // images' `{platform}` path. The accessibility tree is the same tree on
    // macOS and Linux; splitting it per platform would mean a label fixed on
    // one and left broken on the other, with both files green.
    //
    // `{projectName}` instead: iPhone and Pixel are different viewports, and a
    // control the chrome drops at a narrower width is exactly the kind of
    // regression this is here to catch. One tree per device, no platform axis.
    toMatchAriaSnapshot: {
      pathTemplate: "{testDir}/__aria__/{projectName}/{arg}{ext}",
    },
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
  projects: shots
    ? [
        {
          // A picture in a phone runbook should have been taken on a phone, and
          // no baseline rides on it, so a device drift here changes the picture
          // and breaks nothing. Two deliberate departures from `golden`:
          //
          // `isMobile` is off. It turns on Chromium's meta-viewport emulation,
          // which reports a *layout* viewport separate from the visual one —
          // invisible to a golden run, which only ever photographs one SVG
          // element, and fatal here, where every clip is computed in page
          // coordinates and lands somewhere else. Touch stays on; it is what the
          // app branches on.
          //
          // 390×844, the same viewport the goldens use. It was 430 for six
          // loops for a bad reason that is now fixed: the header's intrinsic
          // width was a flat 430 CSS px, so at 390 the document was 40 px wider
          // than the viewport and every full-viewport shot came out as a mushaf
          // sliced down both edges — a real defect, but not something to
          // photograph, because a picture of it teaches the reader that a
          // half-cut page is the expected screen. The chrome now fits from 320
          // up (e2e/chrome-fit.spec.ts), so the runbook can be photographed on
          // the phone most readers are holding.
          name: "shots",
          testMatch: /shots\.spec\.ts/,
          use: {
            browserName: "chromium",
            viewport: { width: 390, height: 844 },
            deviceScaleFactor: 2,
            hasTouch: true,
          },
        },
      ]
    : [
        { name: "iphone", use: { ...devices["iPhone 13"] }, testIgnore: /(golden|shots)\.spec\.ts/ },
        {
          name: "android",
          use: { ...devices["Pixel 7"] },
          testIgnore: /(golden|shots)\.spec\.ts/,
        },
        {
          // The golden-image project. Its viewport is spelled out rather than
          // taken from `devices` on purpose: a Playwright upgrade that retunes a
          // device descriptor would silently invalidate every committed baseline.
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
