import { test, expect, type Locator, type Page } from "@playwright/test";
import { COACH_STORAGE_KEY } from "../src/coach";
import { ayahTarget } from "./ayah";

/*
 * The pictures on hifth.app's front page (apps/landing/index.html), taken from
 * the real app by the same harness that runs the e2e suite, into
 * apps/landing/shots/<name>.jpg. Remade with `make landing-shots`; nothing here
 * is hand-cropped or pasted in, so a picture cannot drift from the app it shows.
 *
 * Always the plain public build that `vite preview` serves from dist/, never
 * the pitch build: the front page is public, and the pitch build can show The
 * Study Quran's text. The project only exists when HIFTH_LANDING_SHOTS=1
 * (playwright.config.ts), so an ordinary e2e run never rewrites these.
 *
 * Like the guide's pictures (shots.spec.ts) this is documentation, not a gate,
 * but each test asserts the thing it photographs is on the screen: a picture of
 * an empty sheet would sell a feature the page then fails to show. Anything a
 * reader would type is made up here; no translation or commentary is shown.
 */

/** Relative to apps/web, Playwright's working folder. */
const OUT = "../../apps/landing/shots";
/** JPEG quality: small enough for a front page, clean enough for the script. */
const QUALITY = 82;

const LAPTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const IPAD = { width: 820, height: 1180 };

test.use({ locale: "en-US" });

/** The app as a reader sees it after the first day: no welcome tour, no storage notice. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript((coachKey: string) => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        persist: async () => true,
        persisted: async () => true,
        estimate: async () => ({ usage: 1_000_000, quota: 40 * 1024 * 1024 * 1024 }),
      },
    });
    try {
      localStorage.setItem(coachKey, "1");
    } catch {
      /* private mode: nothing to seed */
    }
  }, COACH_STORAGE_KEY);
});

const pageSvg = (page: Page, n: number): Locator => page.locator(`svg[aria-labelledby="page-label-${n}"]:visible`);
const picker = (page: Page): Locator => page.getByRole("dialog", { name: /^What went wrong in / });
const washes = (page: Page): Locator => page.locator("[data-mistake-word]:visible");
const signRings = (page: Page): Locator => page.locator("[data-mistake-sign]:visible");

/** Let transitions and the fonts finish, so no picture catches a sheet half way in. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  await page.waitForTimeout(300);
}

async function screen(page: Page, name: string, quality = QUALITY): Promise<void> {
  await settle(page);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality });
}

/** Room around a crop: one number for every side, or a side at a time. */
type Pad = number | { top: number; right: number; bottom: number; left: number };

/**
 * The smallest box holding every target, with room around it, clamped to the
 * screen. Asserts the clamp did not cut a target, since a short picture of the
 * right thing looks like a picture of the wrong thing.
 */
async function cropAround(
  page: Page,
  targets: Locator[],
  name: string,
  { pad = 24 as Pad, quality = QUALITY } = {},
): Promise<void> {
  const p = typeof pad === "number" ? { top: pad, right: pad, bottom: pad, left: pad } : pad;
  await settle(page);
  const boxes = await Promise.all(targets.map((t) => t.boundingBox()));
  boxes.forEach((b, i) => expect(b, `${name}: target ${i} is not on the screen`).not.toBeNull());
  const vp = page.viewportSize()!;
  const left = Math.min(...boxes.map((b) => b!.x));
  const top = Math.min(...boxes.map((b) => b!.y));
  const right = Math.max(...boxes.map((b) => b!.x + b!.width));
  const bottom = Math.max(...boxes.map((b) => b!.y + b!.height));
  const x = Math.max(0, left - p.left);
  const y = Math.max(0, top - p.top);
  const width = Math.min(vp.width, right + p.right) - x;
  const height = Math.min(vp.height, bottom + p.bottom) - y;
  expect(
    { left: left >= 0, top: top >= 0, right: right <= vp.width, bottom: bottom <= vp.height },
    `${name}: a target runs off the screen`,
  ).toEqual({ left: true, top: true, right: true, bottom: true });
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality, clip: { x, y, width, height } });
}

/** A word marked wrong, the way the mistakes test does it: a click, then "The whole word". */
async function markWholeWord(page: Page, verse: string): Promise<void> {
  const at = await ayahTarget(page, verse);
  await page.mouse.click(at.x, at.y);
  await picker(page).getByRole("button", { name: "The whole word" }).click();
  await expect(picker(page)).toHaveCount(0);
}

/** A wrong harakat: a click, then the first sign the question offers. */
async function markSign(page: Page, verse: string): Promise<void> {
  const at = await ayahTarget(page, verse);
  await page.mouse.click(at.x, at.y);
  await picker(page).locator("[data-sign]").first().click();
  await expect(picker(page)).toHaveCount(0);
}

test.describe("on a laptop", () => {
  test.use({ viewport: LAPTOP });

  test("device-desktop: the open book, two pages side by side", async ({ page }) => {
    // A common laptop's screen rather than a large one: the same book, fewer bytes.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("page-spread")).toBeVisible();
    await expect(page.locator("svg[aria-labelledby^='page-label-']:visible")).toHaveCount(2);
    // Two full pages of script at 2x run large; a lighter JPEG keeps the front page quick.
    await screen(page, "device-desktop", 62);
  });

  test("feature-mistakes: a wrong word and a wrong harakat, and the question that asks which", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7?tool=mistake");
    await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });
    await markWholeWord(page, "#verse-46");
    await markSign(page, "#verse-50");
    // A wrong harakat shades its word as well as ringing the sign: two words, one ring.
    await expect(washes(page)).toHaveCount(2);
    await expect(signRings(page)).toHaveCount(1);
    // The question open on a third word, so the picture shows what a tap asks.
    const at = await ayahTarget(page, "#verse-48");
    await page.mouse.click(at.x, at.y);
    await expect(picker(page)).toBeVisible();
    await cropAround(page, [pageSvg(page, 7), picker(page)], "feature-mistakes");
  });

  test("feature-notes: a note pinned on a verse, with made-up words in it", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press("KeyN");
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    const box = page.getByRole("dialog", { name: /^Your note on / });
    await expect(box).toBeVisible();
    await box.getByRole("textbox").fill("Teacher: hold the madd here for four counts. I rushed it twice this week.");
    await expect(page.locator("[data-note-pin]:visible")).toHaveCount(1);
    await cropAround(page, [pageSvg(page, 7), box], "feature-notes");
  });

  test("feature-record: a month of revision, with the days a mistake was marked", async ({ page }) => {
    const today = new Date(2026, 2, 28, 18, 0, 0);
    await page.clock.setFixedTime(today);
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });
    // One real look, so the app has made its own stores before the made-up month goes in.
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    await expect.poll(() => looks(page)).toBeGreaterThan(0);

    // A made-up month: most days opened, a few missed, mistakes on some.
    const tz = -today.getTimezoneOffset();
    const skip = new Set([3, 4, 11, 17, 18, 24]);
    for (let d = 1; d <= 27; d += 1) {
      if (skip.has(d)) continue;
      const at = new Date(2026, 2, d, 6, 30).getTime();
      const first = 2 + ((d * 7) % 40);
      const events = Array.from({ length: 3 + (d % 4) }, (_, i) => ({
        key: `quran/hafs-kfqc/2:${(first + i) * 5}`,
        page: first + i,
        at: at + i * 60_000,
        tz,
        ...(d % 5 === 0 && i === 0 ? { slip: true } : {}),
      }));
      await seed(page, `2026-03-${String(d).padStart(2, "0")}`, events);
    }
    await page.reload();
    await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /what you have opened$/ }).click();
    const sheet = page.getByRole("dialog", { name: "What you have opened" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("radio", { name: "Month", exact: true }).click();
    const month = sheet.getByRole("group", { name: "Mar 2026" });
    await expect(month.locator('[data-day][data-state="worked"]')).toHaveCount(22);
    // The sheet down to the month and a little after it; the lists below it are for another picture.
    const s = (await sheet.boundingBox())!;
    const m = (await month.boundingBox())!;
    const cut = m.y + m.height + 24 - (s.y + s.height);
    await cropAround(page, [sheet], "feature-record", { pad: { top: 0, right: 0, bottom: cut, left: 0 } });
  });

  test("feature-lookalikes: a verse and the verses that read almost like it", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:48");
    const chips = page.getByRole("group", { name: "Links from this ayah" }).first();
    await expect(chips).toBeVisible({ timeout: 20_000 });
    await chips.locator("button[data-direction]").first().click();
    const list = page.getByRole("dialog");
    await expect(list).toBeVisible();
    await expect(list.getByRole("button", { name: /2:123/ }).first()).toBeAttached();
    // No room above: the list sits just under the toolbar, and a strip of toolbar reads as a cut.
    await cropAround(page, [pageSvg(page, 7), list], "feature-lookalikes", {
      pad: { top: 0, right: 24, bottom: 24, left: 24 },
      quality: 62,
    });
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: PHONE, hasTouch: true });

  test("device-phone: one page, the size of the hand", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });
    await screen(page, "device-phone");
  });

  test("feature-share: a verse sent as a link that opens at it", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
    await page.goto("/?share=c#/hafs-kfqc/2:48");
    const share = page.getByRole("button", { name: "Share this ayah as a link" });
    await expect(share).toBeVisible({ timeout: 20_000 });
    await share.click();
    const sheet = page.getByRole("dialog", { name: "Share this ayah as a link" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("radio", { name: "The ayah as it is" })).toBeChecked();
    await screen(page, "feature-share");
  });
});

test.describe("on an iPad, with the pencil", () => {
  test.use({ viewport: IPAD, hasTouch: true });

  test("device-ipad-pen: mistakes marked with the pencil's tip", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "the pencil is sent through Chromium's own input channel");
    // Count what kind of pointer the page hears, so the picture is of a pencil's mark and not a mouse's.
    await page.addInitScript(() => {
      const w = window as Window & { __kinds?: string[] };
      w.__kinds = [];
      addEventListener("pointerdown", (e) => w.__kinds!.push(e.pointerType), true);
    });
    await page.goto("/#/hafs-kfqc/p7?tool=mistake");
    await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });

    const cdp = await page.context().newCDPSession(page);
    const pen = async (verse: string): Promise<void> => {
      const { x, y } = await ayahTarget(page, verse);
      const base = { x, y, pointerType: "pen" as const, button: "left" as const, clickCount: 1, force: 0.5 };
      await cdp.send("Input.dispatchMouseEvent", { ...base, type: "mouseMoved", buttons: 0 });
      await cdp.send("Input.dispatchMouseEvent", { ...base, type: "mousePressed", buttons: 1 });
      await cdp.send("Input.dispatchMouseEvent", { ...base, type: "mouseReleased", buttons: 0 });
    };

    await pen("#verse-46");
    await picker(page).getByRole("button", { name: "The whole word" }).click();
    await expect(picker(page)).toHaveCount(0);
    await pen("#verse-50");
    await picker(page).locator("[data-sign]").first().click();
    await expect(picker(page)).toHaveCount(0);
    // A wrong harakat shades its word as well as ringing the sign: two words, one ring.
    await expect(washes(page)).toHaveCount(2);
    await expect(signRings(page)).toHaveCount(1);
    const kinds = await page.evaluate(() => (window as Window & { __kinds?: string[] }).__kinds ?? []);
    expect(kinds, "the marks were made by a pencil").toContain("pen");
    // The question open on a third word, asked by the pencil.
    await pen("#verse-55");
    await expect(picker(page)).toBeVisible();
    await screen(page, "device-ipad-pen", 74);
  });
});

/** How many looks the device's record holds. */
function looks(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open("hifth.revision.v1");
        req.onupgradeneeded = () => req.transaction?.abort();
        req.onerror = () => resolve(0);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("days")) {
            db.close();
            return resolve(0);
          }
          const all = db.transaction("days").objectStore("days").getAll();
          all.onerror = () => (db.close(), resolve(0));
          all.onsuccess = () => {
            db.close();
            resolve((all.result as { events: unknown[] }[]).reduce((n, d) => n + d.events.length, 0));
          };
        };
      }),
  );
}

/** Made-up looks for one day, put straight into the device's record (as record-days.spec.ts does). */
function seed(page: Page, day: string, events: { key: string; page: number; at: number; tz: number; slip?: boolean }[]): Promise<void> {
  return page.evaluate(
    ({ day, events }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("hifth.revision.v1");
        req.onupgradeneeded = () => req.transaction?.abort();
        req.onerror = () => reject(new Error("the record has no store yet"));
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(["days", "meta"], "readwrite");
          tx.objectStore("days").put({ day, events });
          if (day === "2026-03-01") tx.objectStore("meta").put({ id: "since", day });
          tx.oncomplete = () => (db.close(), resolve());
          tx.onerror = () => reject(tx.error);
        };
      }),
    { day, events },
  );
}

/*
 * The opening picture, in each of the front page's languages (owner, 2026-11-12: "i want to
 * see two pages view as well", and an English/Arabic bar). Two facing pages as on a computer,
 * and one page on a phone set in front of them, both with one verse highlighted. The app picks
 * its language from the browser here, the way a reader's own browser would, so the phone's
 * buttons are in the language of the page the picture sits on.
 */
for (const [suffix, locale] of [["", "en-US"], ["-ar", "ar"]] as const) {
  test.describe(`the opening picture${suffix ? ", in Arabic" : ""}`, () => {
    test.use({ locale });

    /** The highlighter draws itself along the verse, line by line, after the page lands. */
    const drawn = (page: Page) => page.waitForTimeout(2_000);

    test(`hero-spread${suffix}: two facing pages, one verse highlighted`, async ({ page }) => {
      await page.setViewportSize(LAPTOP);
      await page.goto("/#/hafs-kfqc/2:48");
      const pages = page.locator('svg[aria-labelledby^="page-label-"]:visible');
      await expect(pages).toHaveCount(2, { timeout: 20_000 });
      await expect(page.locator("html")).toHaveAttribute("lang", locale.slice(0, 2));
      await drawn(page);
      await cropAround(page, [pages.nth(0), pages.nth(1)], `hero-spread${suffix}`, { pad: 0, quality: 62 });
    });

    test.describe("on a phone", () => {
      test.use({ viewport: PHONE, hasTouch: true });

      test(`hero-phone${suffix}: one page in the hand`, async ({ page }) => {
        await page.goto("/#/hafs-kfqc/2:48");
        await expect(pageSvg(page, 7)).toBeVisible({ timeout: 20_000 });
        await expect(page.locator("html")).toHaveAttribute("lang", locale.slice(0, 2));
        await drawn(page);
        await screen(page, `hero-phone${suffix}`);
      });
    });
  });
}
