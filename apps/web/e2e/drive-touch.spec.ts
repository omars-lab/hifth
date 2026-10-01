import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

/*
 * A recording of a web page shows no finger, so a tap and a hold look the same
 * in it. An options note that compares "tap a verse" with "hold a verse" needs
 * the finger drawn in: a grey mark where it lands, a ring that fills while it
 * stays, a ripple when it is only a tap, and a numbered label saying what is
 * happening. The record-demo skill keeps the script that draws them; the drive
 * tool sends the real touch the app reacts to and takes the frames.
 *
 * The first test drives the drawing script directly with touches sent through
 * the browser's own input; the others run the drive tool the way a person
 * would and check what it wrote.
 */

const DRIVE = fileURLToPath(new URL("./tools/drive.mjs", import.meta.url));
const MARKS = fileURLToPath(new URL("../../../.claude/skills/record-demo/scripts/touch-marks.js", import.meta.url));

// Only the desktop project runs this (playwright.config.ts): the tool launches
// its own browser, and touches are sent through Chromium's own input.
test("the finger mark sits under the finger, its ring fills while held, and a tap ripples instead", async ({ browser, baseURL, browserName }) => {
  test.skip(browserName !== "chromium", "touches are sent through Chromium's own input");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${baseURL}/#/hafs-kfqc/p7`);
  await page.locator("svg[role='group']").filter({ visible: true }).first().waitFor();
  await page.evaluate("window.TOUCH_HOLD_MS = 500");
  await page.evaluate(readFileSync(MARKS, "utf8"));
  const cdp = await ctx.newCDPSession(page);
  const touch = (type: "touchStart" | "touchEnd", x = 0, y = 0) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  const ringLeft = () =>
    page.evaluate(() => {
      const ring = document.querySelector("[data-touch-mark] [data-touch-ring]");
      return ring ? parseFloat(getComputedStyle(ring).strokeDashoffset) : null;
    });

  // A hold: the mark is centred on the finger, the ring starts empty and is full by the hold time.
  await touch("touchStart", 200, 400);
  const mark = page.locator("[data-touch-mark]");
  await expect(mark).toHaveCount(1);
  const box = (await mark.boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - 200)).toBeLessThan(2);
  expect(Math.abs(box.y + box.height / 2 - 400)).toBeLessThan(2);
  const empty = (await ringLeft())!;
  expect(empty).toBeGreaterThan(100);
  await page.waitForTimeout(700);
  expect(await ringLeft()).toBeLessThan(1);
  await touch("touchEnd");
  await expect(mark).toHaveAttribute("data-touch-kind", "hold");
  await expect(mark).toHaveCount(0, { timeout: 2000 });

  // A tap: lifted at once, so it is marked as a tap and its ring never shows.
  await touch("touchStart", 120, 300);
  await page.waitForTimeout(40);
  await touch("touchEnd");
  await expect(mark).toHaveAttribute("data-touch-kind", "tap");
  expect(await page.locator("[data-touch-mark] [data-touch-ring]").evaluate((r) => getComputedStyle(r).opacity)).toBe("0");

  // The numbered step label.
  await page.evaluate("window.__step(2, 'Keep holding')");
  await expect(page.locator("[data-touch-step]")).toHaveText(/^2\s*Keep holding$/);
  await ctx.close();
});

test("drive's tap= reaches the app as a real finger: the tapped verse's menu opens", async ({ baseURL }) => {
  test.setTimeout(60_000);
  const dir = mkdtempSync(join(tmpdir(), "drive-touch-"));
  try {
    const log = execFileSync(
      process.execPath,
      [
        DRIVE,
        "--base", String(baseURL),
        "--hash", "#/hafs-kfqc/p7",
        "--locale", "en-US",
        // #verse-52 is 2:45, counted from the book's start.
        "--act", "settle=300; tap=#verse-52; settle=800",
        "--expect", 'section[aria-label*="2:45"], [role="region"][aria-label*="2:45"]',
        "--out", join(dir, "shot.png"),
      ],
      { stdio: "pipe", timeout: 50_000 },
    ).toString();
    expect(log).toMatch(/ev=touch_down kind=tap x=\d+ y=\d+/);
    expect(log).toMatch(/ev=expect_ok/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("drive with --marks and --frames records a held touch as timed screenshots, labelled by step=", async ({ baseURL }) => {
  test.setTimeout(60_000);
  const dir = mkdtempSync(join(tmpdir(), "drive-touch-"));
  try {
    const frames = join(dir, "frames");
    const log = execFileSync(
      process.execPath,
      [
        DRIVE,
        "--base", String(baseURL),
        "--hash", "#/hafs-kfqc/p7",
        "--marks",
        "--frames", frames,
        "--act", "step=1|Hold a verse; settle=200; hold=#verse-52|900; step=2|Let go; settle=300",
        "--expect", "[data-touch-step]",
        "--out", join(dir, "shot.png"),
      ],
      { stdio: "pipe", timeout: 50_000 },
    ).toString();

    // The finger stayed down as long as asked.
    const held = Number(/ev=touch_up kind=hold held_ms=(\d+)/.exec(log)?.[1]);
    expect(held).toBeGreaterThanOrEqual(900);
    expect(log).toMatch(/ev=expect_ok/);

    // Screenshots, each listed with how long it shows, covering the whole run.
    const pngs = readdirSync(frames).filter((f) => /^f\d{4}\.png$/.test(f));
    expect(pngs.length).toBeGreaterThan(8);
    const list = readFileSync(join(frames, "frames.txt"), "utf8");
    const durations = [...list.matchAll(/^duration ([\d.]+)$/gm)].map((m) => Number(m[1]));
    expect(durations.length).toBe(pngs.length);
    const total = durations.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(1.2);
    expect(total).toBeLessThan(6);
    // Phone-sharp: the screenshots are twice the 390-wide window.
    const png = readFileSync(join(frames, pngs[0] ?? "f0000.png"));
    expect(png.readUInt32BE(16)).toBe(780);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
