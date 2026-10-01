/* global process, console */ // a Node script among browser mocks, which get browser globals only
// The checker's sample for the moving-option-pictures note, and the shape the
// record-demo scripts should take. It differs from the two research samples in
// two ways the note measured:
//   1. the touch is a REAL held touch (Chromium's own input), not made-up page
//      events or a click under a drawn ring, so the app reacts as it would to a
//      finger and the drawn ring cannot disagree with what the app received;
//   2. the frames are SCREENSHOTS at the phone's full pixel size, with the time
//      each was taken, not the browser's video (which records at window size
//      and adds compression flicker that bloats the GIF).
// It writes numbered PNGs and a frames.txt list (file + how long it shows) for
// ffmpeg's concat reader. remake.sh runs it and makes the GIF and the strip.
//
//   node docs/design/moving-option-pictures/mocks/remake.mjs \
//     --base http://localhost:4183 --press hold|tap --out <dir>
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const require = createRequire(resolve("apps/web/package.json"));
const { chromium } = require("@playwright/test");

const arg = (k, d) => {
  const i = process.argv.indexOf("--" + k);
  return i === -1 ? d : process.argv[i + 1];
};
const base = arg("base", "http://localhost:4183");
const press = arg("press", "hold");
const out = resolve(arg("out", "apps/web/test-results/remake"));
const A = resolve("docs/design/moving-option-pictures-a/mocks"); // note A's finger marks and menu mock
const log = (ev, kv = "") => console.log(`${new Date().toISOString()} pid=${process.pid} ev=${ev} ${kv}`);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  locale: "en-US",
});
const page = await ctx.newPage();
await page.goto(`${base}/#/hafs-kfqc/p7`, { waitUntil: "load" });
await page.locator("svg[role='group']").filter({ visible: true }).first().waitFor();
const ev = (src) => page.evaluate((s) => (0, eval)(s), src);
await ev(readFileSync(join(A, "touch-marks.js"), "utf8"));
if (press === "hold") await ev(readFileSync(join(A, "fuller-menu-on-open.js"), "utf8"));

// Screenshots as fast as they come (about 19 a second here), each stamped.
const stamps = [];
let filming = true;
const camera = (async () => {
  while (filming) {
    const t = Date.now();
    const f = `f${String(stamps.length).padStart(4, "0")}.png`;
    writeFileSync(join(out, f), await page.screenshot({ type: "png" }));
    stamps.push([f, t]);
  }
})();

const step = (n, text) => ev(`__step(${n}, ${JSON.stringify(text)})`);
await step(1, press === "hold" ? "Put a finger on a verse" : "Today: tap a verse");
await page.waitForTimeout(900);
const pt = await ev(`(() => { const v = [...document.querySelectorAll('path[aria-label^="Ayah "]')]
  .find((p) => p.getAttribute("aria-label").endsWith(" 2:45") && p.getBoundingClientRect().width > 0);
  const b = v.getBoundingClientRect(); return { x: b.x + b.width * 0.55, y: b.y + b.height / 2 }; })()`);
const cdp = await ctx.newCDPSession(page);
log("touch_start", `press=${press} x=${Math.round(pt.x)} y=${Math.round(pt.y)}`);
await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: pt.x, y: pt.y, id: 1 }] });
if (press === "hold") {
  await page.waitForTimeout(150);
  await step(2, "Keep holding: ring fills");
  await page.waitForTimeout(700);
} else {
  await page.waitForTimeout(90);
}
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
log("touch_end", `press=${press}`);
await step(press === "hold" ? 3 : 2, press === "hold" ? "Let go: the menu rises" : "The verse menu rises");
await page.waitForTimeout(2200);
const focus = await ev(`document.activeElement && (document.activeElement.getAttribute("aria-label") || document.activeElement.tagName)`);
log("end", `focused=${JSON.stringify(focus)}`);
filming = false;
await camera;
await browser.close();

// ffmpeg concat list: each frame shows until the next one was taken; the last
// one is held 1.5 s so the eye can read the end before the loop restarts.
const lines = stamps.map(([f, t], i) => {
  const next = i + 1 < stamps.length ? stamps[i + 1][1] : t + 1500;
  return `file '${f}'\nduration ${((next - t) / 1000).toFixed(3)}`;
});
lines.push(`file '${stamps.at(-1)[0]}'`); // concat needs the last file twice for its duration to count
writeFileSync(join(out, "frames.txt"), lines.join("\n") + "\n");
const secs = (stamps.at(-1)[1] - stamps[0][1]) / 1000;
log("frames", `n=${stamps.length} secs=${secs.toFixed(2)} fps=${(stamps.length / secs).toFixed(1)} out=${out}`);
