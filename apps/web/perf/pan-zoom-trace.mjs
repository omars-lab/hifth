/**
 * Loop 1 performance harness — pan/zoom + highlight-toggle on the densest page.
 *
 * This is a DIAGNOSTIC, not a CI gate. The plan calls the perf verdict "Loop 1's
 * real product," but the go/no-go number is *real-device* fps, which cannot be
 * captured in headless Chromium. So this script does two jobs:
 *
 *   1. Emulated baseline (what CI hardware can measure): drives a scripted
 *      pan → zoom → pan → highlight-toggle sequence on page 7 (the densest
 *      bundled page) under CPU throttling, and reports frame-time percentiles
 *      via requestAnimationFrame sampling. Use it to catch regressions.
 *
 *   2. On-device recipe: the same sequence runs against a URL you pass, so you
 *      can point it at a preview served to your phone (or use the manual steps
 *      printed at the end) and read the real fps off actual hardware.
 *
 * The architecture verdict (inline-SVG-everywhere vs content-visibility
 * virtualization vs raster-glyph fallback) stays OPEN until the on-device number
 * exists — see docs/decisions/loop-1.md and task #24.
 *
 * Usage:
 *   node apps/web/perf/pan-zoom-trace.mjs                 # emulated baseline, 4x CPU throttle
 *   node apps/web/perf/pan-zoom-trace.mjs --url http://<lan-ip>:4173 --throttle 1
 *   node apps/web/perf/pan-zoom-trace.mjs --headed        # watch it run
 *
 * Requires a running preview (pnpm --filter @hifth/web preview) unless --url is
 * given. Chromium only (uses CDP for CPU throttling + frame stats).
 */

import { chromium, devices } from "@playwright/test";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const URL = flag("url", "http://localhost:4173/");
const THROTTLE = Number(flag("throttle", "4")); // CDP CPU slowdown multiplier
const HEADED = has("headed");
const POLY = flag("poly", "verse-45"); // a real polygon on page 7 to toggle

/** Sequence of view manipulations, expressed as programmatic transforms so the
 * measurement is deterministic (a hand-swipe is not repeatable). */
async function run() {
  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await context.newPage();

  // CPU throttling to emulate a mid/low-tier device (CI machines are fast).
  const client = await context.newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.locator("svg[role='img']").waitFor();

  // Inject a rAF frame-time sampler.
  await page.evaluate(() => {
    const w = window;
    w.__frames = [];
    let last = performance.now();
    const tick = (now) => {
      w.__frames.push(now - last);
      last = now;
      w.__rafId = requestAnimationFrame(tick);
    };
    w.__rafId = requestAnimationFrame(tick);
  });

  // Drive a pan → zoom-in → pan → zoom-out sweep by writing the host transform,
  // then toggle a highlight repeatedly. This exercises the exact paths the real
  // gestures drive (the host transform + overlay clone insertion).
  await page.evaluate(async ({ polyId }) => {
    const host = document.querySelector('[class*="host"]');
    const svg = document.querySelector("svg[role='img']");
    const overlay = document.getElementById("hifth-overlay");
    const src = document.getElementById(polyId);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    if (!host || !svg || !overlay) return;

    const steps = 120;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const z = 1 + 1.5 * Math.sin(t * Math.PI); // 1 → 2.5 → 1
      const x = 80 * Math.sin(t * Math.PI * 2);
      const y = 60 * Math.cos(t * Math.PI * 2);
      host.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${z})`;
      // Toggle a highlight clone every few frames (INP-relevant overlay churn).
      if (src && i % 4 === 0) {
        overlay.innerHTML = "";
        const clone = src.cloneNode(true);
        clone.removeAttribute("id");
        clone.setAttribute("class", "hl hl-sel");
        overlay.appendChild(clone);
      }
      await sleep(8); // ~120Hz drive; real frame cadence is what we measure
    }
  }, { polyId: POLY });

  const frames = await page.evaluate(() => {
    cancelAnimationFrame(window.__rafId);
    return window.__frames.slice(5); // drop warmup frames
  });

  await browser.close();

  frames.sort((a, b) => a - b);
  const pct = (p) => frames[Math.min(frames.length - 1, Math.floor((p / 100) * frames.length))];
  const mean = frames.reduce((s, f) => s + f, 0) / frames.length;
  const over16 = frames.filter((f) => f > 16.7).length;

  console.log("\n  Hifth Loop 1 — pan/zoom + highlight-toggle frame times");
  console.log(`  URL:            ${URL}`);
  console.log(`  CPU throttle:   ${THROTTLE}x (emulated mid-tier; 1x = native)`);
  console.log(`  Frames sampled: ${frames.length}`);
  console.log(`  Mean:           ${mean.toFixed(1)} ms  (~${(1000 / mean).toFixed(0)} fps)`);
  console.log(`  Median (p50):   ${pct(50).toFixed(1)} ms`);
  console.log(`  p95:            ${pct(95).toFixed(1)} ms`);
  console.log(`  Worst:          ${frames[frames.length - 1].toFixed(1)} ms`);
  console.log(`  Frames > 16.7ms: ${over16} (${((100 * over16) / frames.length).toFixed(0)}% — jank budget)`);
  console.log("\n  NOTE: emulated baseline only. The architecture verdict needs");
  console.log("  real-device fps. To capture on your phone:");
  console.log("    1) pnpm build && pnpm -C apps/web exec vite preview --host --port 4173");
  console.log("    2) open http://<your-mac-LAN-IP>:4173 on the phone, pinch/pan page 7");
  console.log("    3) record with Safari Web Inspector (iOS) or Chrome DevTools remote (Android)\n");
}

run().catch((e) => {
  console.error("perf harness failed:", e.message);
  console.error("is a preview running? try: pnpm --filter @hifth/web preview");
  process.exit(1);
});
