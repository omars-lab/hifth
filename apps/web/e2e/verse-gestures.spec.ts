import { test, expect, type Locator, type Page } from "@playwright/test";
import { ayahTarget } from "./ayah";
import { COACH_STORAGE_KEY } from "../src/coach";
import { VERSE_GESTURES_KEY } from "../src/verse-gestures";

/*
 * What a tap and a hold on a verse do (docs/design/verse-tap-and-hold.md). The
 * owner made it a setting on 2026-10-01, with C as the default:
 *
 *   A  a tap hides or shows the bars; a hold opens the fuller verse menu.
 *   B  a tap or a hold opens the fuller menu; full screen is a button.
 *   C  a tap opens today's menu; a hold opens a small menu beside the verse;
 *      full screen is a button, as in B.
 *
 * On a computer a click always opens the menu, and F switches full screen.
 * Runs on the computer and both phones. A held finger is driven with the mouse,
 * as the marquee test does: Playwright's touchscreen can only tap.
 */
test.use({ locale: "en-US" });

async function openWith(page: Page, choice: string | null): Promise<void> {
  await page.addInitScript(
    ([coach, key, value]) => {
      try {
        localStorage.setItem(coach, "1");
        if (value) localStorage.setItem(key, value);
      } catch {
        /* private mode */
      }
      Object.defineProperty(navigator, "storage", {
        configurable: true,
        value: {
          persist: async () => true,
          persisted: async () => true,
          estimate: async () => ({ usage: 1_000_000, quota: 40 * 1024 * 1024 * 1024 }),
        },
      });
    },
    [COACH_STORAGE_KEY, VERSE_GESTURES_KEY, choice] as const,
  );
  await page.goto("/#/hafs-kfqc/p7");
  await expect(page.locator("svg[aria-labelledby='page-label-7']:visible")).toBeVisible();
}

/** A finger (or a mouse button) that lets go at once. */
async function tap(page: Page, isMobile: boolean, sel: string): Promise<void> {
  const at = await ayahTarget(page, sel);
  if (isMobile) await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
}

/** Press, keep still past the hold time, let go. */
async function hold(page: Page, sel: string): Promise<void> {
  const at = await ayahTarget(page, sel);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
}

const drawer = (page: Page): Locator => page.getByRole("region", { name: /^Tools for / });
const small = (page: Page): Locator => page.getByRole("menu", { name: /^More for / });
const topBar = (page: Page): Locator => page.getByRole("banner");
const FIVE = ["Play to", "Mark", "Note", "Copy", "Jump…"];
const words = (page: Page): Locator => page.locator("#hifth-overlay [data-hl-group='word']");

test.describe("Hifth · tap and hold on a verse", () => {
  test("the setting is in the info panel, C when nobody chose, and remembered", async ({ page, isMobile }) => {
    await openWith(page, null);
    const about = page.getByRole("button", { name: /About Hifth/ });
    if (isMobile) await about.tap();
    else await about.click();
    const group = page.getByRole("dialog", { name: /About Hifth/ }).getByRole("radiogroup", { name: "Tap and hold on a verse" });
    await expect(group.getByRole("radio", { checked: true })).toHaveText("Hold opens a small menu");
    await group.getByRole("radio", { name: "Tap hides the bars" }).click();
    await expect(group.getByRole("radio", { checked: true })).toHaveText("Tap hides the bars");
    expect(await page.evaluate((k) => localStorage.getItem(k), VERSE_GESTURES_KEY)).toBe("a");
  });

  test("C: a tap opens today's menu; a hold opens a small one beside the verse, not over it", async ({ page, isMobile }) => {
    await openWith(page, null);
    await tap(page, isMobile, "#verse-46");
    await expect(drawer(page)).toBeVisible();
    await expect(drawer(page).getByRole("button", { name: /Play to/ })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await hold(page, "#verse-47");
    await expect(small(page)).toBeVisible();
    await expect(small(page).getByRole("menuitem")).toHaveText(FIVE);
    await expect(drawer(page)).toHaveCount(0);
    // A still hold is the menu, not also the older "hold to pick words": no
    // word is lit under it, and so one Escape is enough to close it.
    await expect(words(page)).toHaveCount(0);
    // The verse is lit, and the menu stands clear of it.
    await expect(page.locator("#hifth-overlay .hl-sel")).not.toHaveCount(0);
    const menu = (await small(page).boundingBox())!;
    const verse = (await page.locator("#verse-47:visible").boundingBox())!;
    const overlaps =
      menu.x < verse.x + verse.width && verse.x < menu.x + menu.width &&
      menu.y < verse.y + verse.height && verse.y < menu.y + menu.height;
    expect(overlaps, `menu ${JSON.stringify(menu)} over verse ${JSON.stringify(verse)}`).toBe(false);
    await page.screenshot({ path: test.info().outputPath("c-hold.png") });
    await page.keyboard.press("Escape");
    await expect(small(page)).toHaveCount(0);
  });

  test("C: full screen is a button in the bottom line, and a small button brings the bars back", async ({ page }) => {
    await openWith(page, null);
    await page.getByRole("button", { name: "Full screen" }).click();
    await expect(topBar(page)).toBeHidden();
    await page.screenshot({ path: test.info().outputPath("c-full.png") });
    await page.getByRole("button", { name: "Show the bars" }).click();
    await expect(topBar(page)).toBeVisible();
  });

  test("the full-screen button takes no room from the page: the bottom line is as tall as without it", async ({ page, context }) => {
    const footerHeight = async (p: Page): Promise<number> => (await p.locator("footer").first().boundingBox())!.height;
    await openWith(page, "a");
    await expect(page.getByRole("button", { name: "Full screen" })).toHaveCount(0);
    const other = await context.newPage();
    await openWith(other, "c");
    await expect(other.getByRole("button", { name: "Full screen" })).toBeVisible();
    expect(await footerHeight(other)).toBeCloseTo(await footerHeight(page), 0);
  });

  test("A: a hold opens the fuller menu; on a phone a tap hides the bars and another brings them back", async ({ page, isMobile }) => {
    await openWith(page, "a");
    await hold(page, "#verse-46");
    await expect(drawer(page)).toBeVisible();
    for (const name of FIVE) await expect(drawer(page).getByRole("button", { name: new RegExp(`^${name.replace(/…$/, "")}`) })).toBeVisible();
    await expect(words(page)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(drawer(page)).toHaveCount(0);

    await tap(page, isMobile, "#verse-47");
    if (isMobile) {
      await expect(topBar(page)).toBeHidden();
      await expect(drawer(page)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Show the bars" })).toHaveCount(0);
      await tap(page, isMobile, "#verse-47");
      await expect(topBar(page)).toBeVisible();
    } else {
      // A mouse has no natural hold, so a click keeps opening the menu.
      await expect(drawer(page)).toBeVisible();
      await expect(topBar(page)).toBeVisible();
    }
  });

  // The ring that shows a keyboard user where they are is for the keyboard: a
  // finger or a mouse already knows which verse it pressed, and on a phone the
  // browser's blue box read as a stray mark beside the orange.
  test("a tapped verse shows no focus ring; one reached by the keyboard does", async ({ page, isMobile }) => {
    const ring = (): Promise<{ id: string; style: string }> =>
      page.evaluate(() => {
        const a = document.activeElement as Element;
        return { id: a.id, style: getComputedStyle(a).outlineStyle };
      });
    await openWith(page, null);
    await tap(page, isMobile, "#verse-46");
    await expect(drawer(page)).toBeVisible();
    expect(await ring()).toEqual({ id: "verse-46", style: "none" });

    await page.keyboard.press("ArrowDown");
    const next = await ring();
    expect(next.id).toBe("verse-47");
    expect(next.style).not.toBe("none");
  });

  test("B: a tap opens the fuller menu, and full screen is a button", async ({ page, isMobile }) => {
    await openWith(page, "b");
    await tap(page, isMobile, "#verse-46");
    await expect(drawer(page)).toBeVisible();
    await expect(drawer(page).getByRole("button", { name: /^Copy/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Full screen" })).toBeVisible();
  });
});

/*
 * The page's corners answer a hold too (PLAN 27, owner 2026-09-30): the page
 * number acts on the page, the surah's name on the surah, the juz on the juz,
 * each with its own small menu, the way a hold on a verse acts on the verse.
 */
test.describe("Hifth · holding the page's corners", () => {
  const corner = (page: Page, which: "page" | "surah" | "juz"): Locator =>
    page.locator(`[data-host-page="7"] [data-running-head="${which}"]`);
  const menu = (page: Page): Locator => page.getByRole("menu", { name: /^More for / });
  const said = (page: Page): Locator => page.locator('[role="status"][aria-live="polite"]');

  async function holdCorner(page: Page, which: "page" | "surah" | "juz"): Promise<void> {
    const b = (await corner(page, which).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();
  }

  async function open(page: Page): Promise<void> {
    await page.addInitScript(() => {
      const w = window as unknown as { copied: string[]; shared: string[] };
      w.copied = [];
      w.shared = [];
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async (s: string) => void w.copied.push(s) },
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (d: { url: string }) => void w.shared.push(d.url),
      });
      HTMLMediaElement.prototype.play = () => Promise.resolve();
    });
    await openWith(page, null);
  }

  test("each corner opens its own menu, named for what was held", async ({ page }) => {
    await open(page);
    // Nothing lies over a label: what a press there reaches is the label.
    for (const which of ["surah", "juz"] as const) {
      const b = (await corner(page, which).boundingBox())!;
      for (const fx of [0.1, 0.5, 0.9]) {
        const hit = await page.evaluate(
          ([x, y]) => (document.elementFromPoint(x!, y!) as HTMLElement | null)?.dataset.runningHead ?? "something else",
          [b.x + b.width * fx, b.y + b.height / 2],
        );
        expect(hit, `${which} at ${fx} of its width`).toBe(which);
      }
    }

    await holdCorner(page, "surah");
    await expect(menu(page)).toHaveAccessibleName("More for Al-Baqarah");
    await expect(menu(page).getByRole("menuitem")).toHaveText(["Play", "Go to the start", "New note", "Copy", "Share"]);
    await page.keyboard.press("Escape");

    await holdCorner(page, "juz");
    await expect(menu(page)).toHaveAccessibleName("More for Juz 1");
    await expect(menu(page).getByRole("menuitem")).toHaveText(["Play", "Go to the start", "New note", "Copy", "Share"]);
    await page.keyboard.press("Escape");

    // On a phone the bottom bar lies over the foot of the page, so the page
    // number is reached the way a reader would reach it: full screen first.
    if (test.info().project.name !== "desktop") {
      await page.getByRole("button", { name: "Full screen" }).click();
      await expect(page.getByRole("button", { name: "Show the bars" })).toBeVisible();
    }
    // The bars slide away, and the page settles into the room they leave.
    await expect
      .poll(async () => {
        const b = (await corner(page, "page").boundingBox())!;
        return page.evaluate(
          ([x, y]) => (document.elementFromPoint(x!, y!) as HTMLElement | null)?.dataset.runningHead ?? "something else",
          [b.x + b.width / 2, b.y + b.height / 2],
        );
      }, { message: "nothing lies over the page number" })
      .toBe("page");
    await page.waitForTimeout(400);
    await holdCorner(page, "page");
    await expect(menu(page)).toHaveAccessibleName("More for Page 7");
    await expect(menu(page).getByRole("menuitem")).toHaveText(["Play", "Bookmark", "New note", "Copy", "Share"]);
  });

  test("a quick tap on a corner opens nothing", async ({ page, isMobile }) => {
    await open(page);
    const b = (await corner(page, "surah").boundingBox())!;
    if (isMobile) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(300);
    await expect(menu(page)).toHaveCount(0);
  });

  test("the page's menu plays the page, bookmarks it, copies and shares its link", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop", "what each item does is the same on every device");
    await open(page);
    await holdCorner(page, "page");
    await menu(page).getByRole("menuitem", { name: "Play" }).click();
    await expect(said(page)).toHaveText("Playing Al-Baqarah · 2:38 to 2:48");

    await holdCorner(page, "page");
    await menu(page).getByRole("menuitem", { name: "Copy" }).click();
    await expect(said(page)).toHaveText("Copied a link to Page 7");
    const copied = await page.evaluate(() => (window as unknown as { copied: string[] }).copied);
    expect(copied).toHaveLength(1);
    expect(copied[0]).toMatch(/^Page 7 — http.*#\/hafs-kfqc\/p7$/);

    await holdCorner(page, "page");
    await menu(page).getByRole("menuitem", { name: "Share" }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { shared: string[] }).shared)).toEqual([
      expect.stringMatching(/#\/hafs-kfqc\/p7$/),
    ]);

    await holdCorner(page, "page");
    await menu(page).getByRole("menuitem", { name: "Bookmark" }).click();
    await expect(said(page)).toContainText("Bookmark dropped");
  });

  test("the surah's and the juz's menus play all of it and go to where it starts", async ({ page }) => {
    test.skip(test.info().project.name !== "desktop", "what each item does is the same on every device");
    await open(page);
    await holdCorner(page, "surah");
    await menu(page).getByRole("menuitem", { name: "Play" }).click();
    await expect(said(page)).toHaveText("Playing Al-Baqarah · 2:1 to 2:286");

    await holdCorner(page, "juz");
    await menu(page).getByRole("menuitem", { name: "Play" }).click();
    await expect(said(page)).toHaveText("Playing Al-Fatihah · 1:1 to Al-Baqarah · 2:141");

    await holdCorner(page, "juz");
    await menu(page).getByRole("menuitem", { name: "Copy" }).click();
    const copied = await page.evaluate(() => (window as unknown as { copied: string[] }).copied);
    expect(copied[0]).toMatch(/^Juz 1 — http.*#\/hafs-kfqc\/1:1$/);

    await holdCorner(page, "surah");
    await menu(page).getByRole("menuitem", { name: "Go to the start" }).click();
    await expect(page).toHaveURL(/#\/hafs-kfqc\/2:1(\?|$)/);
  });
});

test.describe("Hifth · the four new verse buttons", () => {
  test.skip(({ isMobile }) => isMobile, "the buttons are the same on every device; one run is enough");

  test("Copy puts the verse's name and a link on the clipboard, not its words", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { copied: string[] }).copied = [];
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async (s: string) => void (window as unknown as { copied: string[] }).copied.push(s) },
      });
    });
    await openWith(page, null);
    await hold(page, "#verse-46");
    await small(page).getByRole("menuitem", { name: "Copy" }).click();
    await expect(small(page)).toHaveCount(0);
    const copied = await page.evaluate(() => (window as unknown as { copied: string[] }).copied);
    expect(copied).toHaveLength(1);
    expect(copied[0]).toMatch(/^Al-Baqarah · 2:39 — http.*#\/hafs-kfqc\/2:39/);
    await expect(page.locator('[role="status"][aria-live="polite"]')).toHaveText("Copied a link to Al-Baqarah · 2:39");
  });

  test("Note pins a note on the verse and opens the box", async ({ page }) => {
    await openWith(page, null);
    await hold(page, "#verse-46");
    await small(page).getByRole("menuitem", { name: "Note" }).click();
    await expect(page.getByRole("dialog", { name: /^Your note on / })).toBeVisible();
    await expect(page.locator("[data-note-pin]:visible")).toHaveCount(1);
  });

  test("Mark paints the verse", async ({ page }) => {
    await openWith(page, null);
    await hold(page, "#verse-46");
    await small(page).getByRole("menuitem", { name: "Mark" }).click();
    await expect(small(page)).toHaveCount(0);
    await expect(page.locator('[role="status"][aria-live="polite"]')).toHaveText(/^Highlighted Al-Baqarah · 2:39/);
  });

  test("Play to asks for the verse to stop at, then plays the run", async ({ page }) => {
    // No recitation in a test runner: a play that fails would say so over the line checked here.
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = () => Promise.resolve();
    });
    await openWith(page, null);
    await hold(page, "#verse-46");
    await small(page).getByRole("menuitem", { name: "Play to" }).click();
    const said = page.locator('[role="status"][aria-live="polite"]');
    // A finger is told to tap, a mouse to click.
    const finger = await page.evaluate(() => matchMedia("(pointer: coarse)").matches);
    await expect(said).toHaveText(finger ? "Tap the verse to stop at" : "Click the verse to stop at");
    await tap(page, false, "#verse-48");
    await expect(said).toHaveText("Playing Al-Baqarah · 2:39 to 2:41");
    // The tap that ended the pick did not also open a menu.
    await expect(drawer(page)).toHaveCount(0);
  });

  test("F switches full screen on a computer", async ({ page }) => {
    await openWith(page, "a");
    await page.keyboard.press("KeyF");
    await expect(topBar(page)).toBeHidden();
    await page.keyboard.press("KeyF");
    await expect(topBar(page)).toBeVisible();
  });
});
