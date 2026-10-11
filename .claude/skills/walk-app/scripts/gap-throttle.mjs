#!/usr/bin/env node
/**
 * The silence between two verses of a run, in Chromium, at three connection
 * speeds and for each way of making the next verse ready (docs/PLAN.md, item 63).
 *
 *   node .claude/skills/walk-app/scripts/gap-throttle.mjs [--url <app>] [--ahead hold,ask,off]
 *
 * --url    the app to open, default the public site; a local build served by
 *          `vite preview` works the same (http://localhost:<port>/).
 * --ahead  which of the settings to try, default all three.
 *
 * Each speed and setting gets a fresh browser, so nothing one run fetched is
 * there for the next. Prints one line each: speed, setting, the gaps in
 * milliseconds. Recitation comes from the public recitation host either way.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const here = new URL(".", import.meta.url);
const require = createRequire(new URL("../../../../apps/web/package.json", here));
const { chromium, devices } = require("@playwright/test");

const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const base = arg("url", "https://blog.bytesofpurpose.com/hifth/");
const aheads = arg("ahead", "hold,ask,off").split(",");
const walk = readFileSync(new URL("gap-walk.js", here), "utf8");

/** Name, added delay each way in ms, and download speed in kilobits a second. */
const SPEEDS = [
  ["home", 0, 0],
  ["slow-wifi", 300, 1500],
  ["poor", 600, 400],
];

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
for (const [speed, latency, kbps] of SPEEDS) {
  for (const ahead of aheads) {
    const ctx = await browser.newContext({ ...devices["iPad Pro 11 landscape"] });
    await ctx.addInitScript((way) => localStorage.setItem("hifth.run.ahead.v1", way), ahead);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await page.goto(new URL("#/hafs-kfqc/p600", base).href);
    await page.waitForTimeout(4000);
    if (latency) {
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency,
        downloadThroughput: kbps * 128,
        uploadThroughput: kbps * 128,
      });
    }
    const result = await page.evaluate(walk).catch((e) => String(e));
    console.log(`speed=${speed} ahead=${ahead} ${result}`);
    await ctx.close();
  }
}
await browser.close();
