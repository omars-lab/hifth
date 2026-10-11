import { test, expect, type Locator, type Page } from "@playwright/test";
import { ayahTarget } from "./ayah";
import { COACH_STORAGE_KEY } from "../src/coach";
import { VERSE_GESTURES_KEY } from "../src/verse-gestures";
import { RUN_MARK_KEY } from "../src/run-mark";
import { RUN_FOLLOW_KEY } from "../src/run-follow";
import { fakePlayer } from "./player";

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

/**
 * Turn ahead one page by hand, from page `from` to page `to`: the arrow key on
 * a computer, a finger swept to the right across the page on a phone. `during`
 * runs with the hand still down, past the distance that turns the page; on a
 * computer, and an iPad held sideways, that hand is on the open book's outer
 * edge, pulling the page over.
 */
async function turnAhead(page: Page, isMobile: boolean, from: number, to: number, during?: () => Promise<void>): Promise<void> {
  if (!isMobile && !during) {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("ArrowLeft");
  } else if (!isMobile) {
    const rail = (await page.getByTestId("edge-grab-left").boundingBox())!;
    const y = rail.y + rail.height * 0.2;
    await page.mouse.move(rail.x + 6, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i += 1) await page.mouse.move(rail.x + 6 + i * 45, y);
    if (during) await during();
    await page.mouse.up();
  } else {
    const box = (await page.locator(`svg[aria-labelledby='page-label-${from}']:visible`).boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.3, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i += 1) await page.mouse.move(box.x + box.width * (0.3 + i * 0.05), y);
    if (during) await during();
    await page.mouse.up();
  }
  await expect(page.locator(`svg[aria-labelledby='page-label-${to}']:visible`)).toBeVisible();
}

const drawer = (page: Page): Locator => page.getByRole("region", { name: /^Tools for / });
const small = (page: Page): Locator => page.getByRole("menu", { name: /^More for / });
const topBar = (page: Page): Locator => page.getByRole("banner");
const FIVE = ["Play to", "Mark", "Note", "Copy", "Jump…"];
const words = (page: Page): Locator => page.locator("#hifth-overlay [data-hl-group='word']");

/** The verses the page has marked in one of its highlight groups, as "2:40". */
async function marked(page: Page, group: string): Promise<string[]> {
  const keys = await page
    .locator(`#hifth-overlay [data-hl-group='${group}']`)
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-hl-key") ?? "?"));
  return [...new Set(keys.map((k) => k.slice(k.lastIndexOf("/") + 1)))];
}

/** "Play to" from the verse 2:39 to 2:41, on page 7. */
async function playThreeVerses(page: Page): Promise<void> {
  await openWith(page, null);
  await hold(page, "#verse-46");
  await small(page).getByRole("menuitem", { name: "Play to" }).click();
  await tap(page, false, "#verse-48");
}

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
    const backToSeven = async () => {
      await page.goto("/#/hafs-kfqc/p7");
      await expect(page.locator("svg[aria-labelledby='page-label-7']:visible")).toBeVisible();
    };
    // Playing it takes the page to its first verse, where the recitation is.
    await holdCorner(page, "surah");
    await menu(page).getByRole("menuitem", { name: "Play" }).click();
    await expect(said(page)).toHaveText("Playing Al-Baqarah · 2:1 to 2:286");
    await expect(page.locator("svg[aria-labelledby='page-label-2']:visible")).toBeVisible();
    await backToSeven();

    await holdCorner(page, "juz");
    await menu(page).getByRole("menuitem", { name: "Play" }).click();
    await expect(said(page)).toHaveText("Playing Al-Fatihah · 1:1 to Al-Baqarah · 2:141");
    await expect(page.locator("svg[aria-labelledby='page-label-1']:visible")).toBeVisible();
    await backToSeven();

    await holdCorner(page, "juz");
    await menu(page).getByRole("menuitem", { name: "Copy" }).click();
    const copied = await page.evaluate(() => (window as unknown as { copied: string[] }).copied);
    expect(copied[0]).toMatch(/^Juz 1 — http.*#\/hafs-kfqc\/1:1$/);

    await holdCorner(page, "surah");
    await menu(page).getByRole("menuitem", { name: "Go to the start" }).click();
    await expect(page).toHaveURL(/#\/hafs-kfqc\/2:1(\?|$)/);
  });

  // A presenter holds the surah's corner and plays it, then talks over the
  // recitation. The page stayed where it was: the room heard 2:1 with page 7 on
  // the screen, and heard the run go on past every page after it. The page goes
  // to the verse being recited, and turns as the run reaches the next page,
  // with the recitation carrying on across the turn. A verse chosen before the
  // run is left behind with its page, and does not stop the run when it goes.
  test("a run that goes past the page takes the page with it", async ({ page, isMobile }) => {
    const player = await fakePlayer(page);
    await openWith(page, null);
    await tap(page, isMobile, "#verse-46");
    await expect(drawer(page)).toBeVisible();
    await holdCorner(page, "surah");
    await menu(page).getByRole("menuitem", { name: "Play" }).click();
    await expect.poll(player.files).toEqual(["002001.mp3"]);
    await expect(page.locator("svg[aria-labelledby='page-label-2']:visible")).toBeVisible();
    await expect(page.locator("svg[aria-labelledby='page-label-7']:visible")).toHaveCount(0);
    for (let n = 2; n <= 6; n++) {
      await player.end();
      await expect.poll(player.files).toHaveLength(n);
    }
    expect((await player.files()).at(-1)).toBe("002006.mp3");
    await expect(page.locator("svg[aria-labelledby='page-label-3']:visible")).toBeVisible();
    // The verse's tools stay up for the verse being recited, Pause in reach.
    await expect(drawer(page).getByRole("button", { name: "Pause Al-Baqarah · 2:6" })).toBeVisible();
    // Still reciting on the far side of the turn.
    await page.waitForTimeout(400);
    await player.end();
    await expect.poll(async () => (await player.files()).at(-1)).toBe("002007.mp3");
  });

  // Mid-surah the presenter turns ahead to show the room something else. The
  // next verse pulled the page straight back to the recitation, so a page could
  // not be shown while the run played. A turn by hand now stands, and the page
  // picks the run up again when the recitation reaches the page being shown.
  test("a page turned by hand during a run stays turned", async ({ page, isMobile }) => {
    const player = await fakePlayer(page);
    await openWith(page, null);
    await tap(page, isMobile, "#verse-46");
    await expect(drawer(page)).toBeVisible();
    await holdCorner(page, "surah");
    await menu(page).getByRole("menuitem", { name: "Play" }).click();
    await expect.poll(player.files).toEqual(["002001.mp3"]);
    await expect(page.locator("svg[aria-labelledby='page-label-2']:visible")).toBeVisible();
    await turnAhead(page, isMobile, 2, 3);
    if (isMobile) await turnAhead(page, isMobile, 3, 4);
    await turnAhead(page, isMobile, isMobile ? 4 : 3, 5);
    await page.waitForTimeout(400);
    await player.end();
    await expect.poll(player.files).toHaveLength(2);
    await page.waitForTimeout(800);
    await expect(page.locator("svg[aria-labelledby='page-label-5']:visible")).toBeVisible();
    await expect(page.locator("svg[aria-labelledby='page-label-2']:visible")).toHaveCount(0);
    // The recitation still plays on, Pause in reach.
    await expect(drawer(page).getByRole("button", { name: "Pause Al-Baqarah · 2:2" })).toBeVisible();
  });

  // A presenter plays a short surah from its corner and talks over it; the
  // page goes to the surah's start and turns with it. When the recitation was
  // over, the page went plain: the verse chosen before the run had been let go
  // pages back, so nothing was lit and the verse's tools closed, with no Play
  // in reach to hear it again. The last verse recited is lit instead, its
  // tools up, as a run that stays on its page ends lit (items 57 and 60).
  test("a run that took the page along ends with its last verse lit", async ({ page }) => {
    const player = await fakePlayer(page);
    await openWith(page, null);
    await page.goto("/#/hafs-kfqc/p563");
    await expect(page.locator("svg[aria-labelledby='page-label-563']:visible")).toBeVisible();
    const head = (await page.locator('[data-host-page="563"] [data-running-head="surah"]').boundingBox())!;
    await page.mouse.move(head.x + head.width / 2, head.y + head.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();
    await menu(page).getByRole("menuitem", { name: "Play" }).click();
    await expect.poll(player.files).toEqual(["067001.mp3"]);
    await expect(page.locator("svg[aria-labelledby='page-label-562']:visible")).toBeVisible();
    for (let n = 2; n <= 30; n++) {
      await player.end();
      await expect.poll(player.files).toHaveLength(n);
    }
    expect((await player.files()).at(-1)).toBe("067030.mp3");
    await expect(page.locator("svg[aria-labelledby='page-label-564']:visible")).toBeVisible();
    await page.waitForTimeout(400);
    await player.end();
    await page.waitForTimeout(400);
    expect(await marked(page, "selection")).toEqual(["67:30"]);
    await expect(page).toHaveURL(/#\/hafs-kfqc\/67:30(\?|$)/);
    await expect(drawer(page).getByRole("button", { name: /^Play .*67:30$/ })).toBeVisible();
    await expect(page.locator("svg[aria-labelledby='page-label-564']:visible")).toBeVisible();
    // The last verse sits at the foot of its page, where a phone's tools card
    // rises: the light is only worth having if the card leaves it in sight.
    await page.waitForTimeout(600);
    const card = (await drawer(page).boundingBox())!;
    const lines = await page.evaluate(() =>
      [...document.querySelectorAll<SVGGraphicsElement>("#hifth-overlay .hl-sel")].map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }),
    );
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      const under = l.x < card.x + card.width && card.x < l.x + l.width && l.y < card.y + card.height && card.y < l.y + l.height;
      expect(under, `a lit line at ${JSON.stringify(l)} under the tools at ${JSON.stringify(card)}`).toBe(false);
    }
  });

  // A verse can end while the hand is still taking the page over, the turn not
  // yet let go (a swipe on a phone, a pull on the open book's edge on a
  // computer; a finger on that edge is tested below): the page is still the recitation's
  // page then, and the turn that follows is still a turn by hand.
  test("a verse that ends mid-swipe does not undo the swipe", async ({ page, isMobile }) => {
    const player = await fakePlayer(page);
    await openWith(page, null);
    await tap(page, isMobile, "#verse-46");
    await expect(drawer(page)).toBeVisible();
    await holdCorner(page, "surah");
    await menu(page).getByRole("menuitem", { name: "Play" }).click();
    await expect.poll(player.files).toEqual(["002001.mp3"]);
    await expect(page.locator("svg[aria-labelledby='page-label-2']:visible")).toBeVisible();
    await page.waitForTimeout(400);
    await turnAhead(page, isMobile, 2, 3, async () => {
      await player.end();
      await expect.poll(player.files).toHaveLength(2);
    });
    await page.waitForTimeout(400);
    await player.end();
    await expect.poll(player.files).toHaveLength(3);
    await page.waitForTimeout(800);
    await expect(page.locator("svg[aria-labelledby='page-label-3']:visible")).toBeVisible();
    await expect(page.locator("svg[aria-labelledby='page-label-2']:visible")).toHaveCount(0);
    await expect(drawer(page).getByRole("button", { name: "Pause Al-Baqarah · 2:3" })).toBeVisible();
  });

  test("with going back chosen, the next verse brings a turned page back to the recitation", async ({ page, isMobile }) => {
    await page.addInitScript((key) => {
      try {
        localStorage.setItem(key, "back");
      } catch {
        /* private mode */
      }
    }, RUN_FOLLOW_KEY);
    const player = await fakePlayer(page);
    await openWith(page, null);
    await tap(page, isMobile, "#verse-46");
    await expect(drawer(page)).toBeVisible();
    await holdCorner(page, "surah");
    await menu(page).getByRole("menuitem", { name: "Play" }).click();
    await expect.poll(player.files).toEqual(["002001.mp3"]);
    await expect(page.locator("svg[aria-labelledby='page-label-2']:visible")).toBeVisible();
    await turnAhead(page, isMobile, 2, 3);
    if (isMobile) await turnAhead(page, isMobile, 3, 4);
    await turnAhead(page, isMobile, isMobile ? 4 : 3, 5);
    await page.waitForTimeout(400);
    await player.end();
    await expect.poll(player.files).toHaveLength(2);
    await expect(page.locator("svg[aria-labelledby='page-label-2']:visible")).toBeVisible();
  });
});

// Held sideways, the iPad shows the open book, which turns by its outer edge.
// The tests above pull that edge with a mouse; this one with a finger, sent
// through Chromium's own touch input (WebKit's cannot be driven so headless),
// at the size of an iPad on its side, since a finger is how the room turns it.
test("a finger pulling the open book's outer edge turns it, at the size of an iPad on its side", async ({ page }) => {
  test.skip(test.info().project.name !== "android", "real touches are sent through Chromium");
  await page.setViewportSize({ width: 1194, height: 834 });
  await page.goto("/#/hafs-kfqc/p8");
  await expect(page.locator("svg[aria-labelledby='page-label-7']:visible")).toBeVisible();
  await expect(page.locator("svg[aria-labelledby='page-label-8']:visible")).toBeVisible();
  const rail = (await page.getByTestId("edge-grab-left").boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const y = rail.y + rail.height * 0.2;
  const x0 = rail.x + 6;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y, id: 1 }] });
  for (let i = 1; i <= 12; i += 1) {
    await page.waitForTimeout(20);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + i * 30, y, id: 1 }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.locator("svg[aria-labelledby='page-label-9']:visible")).toBeVisible();
  await expect(page.locator("svg[aria-labelledby='page-label-7']:visible")).toHaveCount(0);
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
    // The tap that ended the pick did not also open a menu; the verse's tools
    // come back instead, with the run's Pause on them.
    await expect(small(page)).toHaveCount(0);
    await expect(drawer(page).getByRole("button", { name: /^(Play|Pause) Al-Baqarah · 2:39$/ })).toBeVisible();
  });

  // The run is the one place the app starts a verse with no tap behind it:
  // each next file begins when the last one ends. Nothing checked that it did.
  test("Play to moves on to the next verse each time one ends, and stops after the last", async ({
    page,
  }) => {
    const player = await fakePlayer(page);
    await playThreeVerses(page);
    await expect.poll(player.files).toEqual(["002039.mp3"]);
    await player.end();
    await expect.poll(player.files).toEqual(["002039.mp3", "002040.mp3"]);
    await player.end();
    await expect.poll(player.files).toEqual(["002039.mp3", "002040.mp3", "002041.mp3"]);
    await player.end();
    await page.waitForTimeout(300);
    expect(await player.files()).toEqual(["002039.mp3", "002040.mp3", "002041.mp3"]);
  });

  // A presenter stops a run to say something about the verse, then carries on.
  // The verse's tools had been set aside to pick where to stop, so there was no
  // Pause at all; and the button sat on the run's first verse, so once the
  // second was playing it read Play, and a press started that first verse
  // alone, dropping the rest.
  test("pausing a run part way through pauses it, and the next press carries on from there", async ({
    page,
  }) => {
    const player = await fakePlayer(page);
    await playThreeVerses(page);
    await expect.poll(player.files).toEqual(["002039.mp3"]);
    await player.end();
    await expect.poll(player.files).toEqual(["002039.mp3", "002040.mp3"]);
    // The button speaks for the verse being recited, and pauses it.
    await drawer(page).getByRole("button", { name: "Pause Al-Baqarah · 2:40" }).click();
    await expect(drawer(page).getByRole("button", { name: "Play Al-Baqarah · 2:40" })).toBeVisible();
    // The next press resumes that verse, not the run's first, and the run goes on.
    await drawer(page).getByRole("button", { name: "Play Al-Baqarah · 2:40" }).click();
    await expect(drawer(page).getByRole("button", { name: "Pause Al-Baqarah · 2:40" })).toBeVisible();
    expect(await player.files()).toEqual(["002039.mp3", "002040.mp3"]);
    await player.end();
    await expect.poll(player.files).toEqual(["002039.mp3", "002040.mp3", "002041.mp3"]);
  });

  // The room's wifi drops on the second verse of a run: a press once it is back
  // fetches that verse again, and the run still reaches its last verse.
  test("a run whose next verse failed to load carries on from it on the next press", async ({ page }) => {
    const player = await fakePlayer(page);
    await playThreeVerses(page);
    await expect.poll(player.files).toEqual(["002039.mp3"]);
    await player.end();
    await expect.poll(player.files).toEqual(["002039.mp3", "002040.mp3"]);
    await player.fail();
    const retry = drawer(page).getByRole("button", { name: "Play Al-Baqarah · 2:40" });
    await expect(retry).toHaveAttribute("data-phase", "error");
    await retry.click();
    await expect.poll(player.files).toEqual(["002039.mp3", "002040.mp3", "002040.mp3"]);
    await player.end();
    await expect.poll(player.files).toEqual(["002039.mp3", "002040.mp3", "002040.mp3", "002041.mp3"]);
  });

  // A presenter plays a run and talks over it: the room has to see which verse
  // is being recited, not only the first one, which stays chosen. By default the
  // verse's light moves with the recitation and comes back to the first verse
  // when the run is over; the other way keeps the first verse lit and rings the
  // one being recited.
  test("a run's light moves to each verse as it is recited, and back to the first when it is over", async ({
    page,
  }) => {
    const player = await fakePlayer(page);
    await playThreeVerses(page);
    await expect.poll(player.files).toEqual(["002039.mp3"]);
    await expect.poll(() => marked(page, "selection")).toEqual(["2:39"]);
    await player.end();
    await expect.poll(() => marked(page, "selection")).toEqual(["2:40"]);
    await player.end();
    await expect.poll(() => marked(page, "selection")).toEqual(["2:41"]);
    expect(await marked(page, "heard")).toEqual([]);
    await player.end();
    await expect.poll(() => marked(page, "selection")).toEqual(["2:39"]);
  });

  test("how a run shows its verse is a setting in the info panel, the light by default, and remembered", async ({
    page,
  }) => {
    await openWith(page, null);
    await page.getByRole("button", { name: /About Hifth/ }).click();
    const group = page
      .getByRole("dialog", { name: /About Hifth/ })
      .getByRole("radiogroup", { name: "The verse being recited" });
    await expect(group.getByRole("radio", { checked: true })).toHaveText("The light moves");
    await group.getByRole("radio", { name: "A ring moves" }).click();
    await expect(group.getByRole("radio", { checked: true })).toHaveText("A ring moves");
    expect(await page.evaluate((k) => localStorage.getItem(k), RUN_MARK_KEY)).toBe("ring");
  });

  test("with the ring chosen, the first verse stays lit and a ring follows the recitation", async ({ page }) => {
    await page.addInitScript((key) => {
      try {
        localStorage.setItem(key, "ring");
      } catch {
        /* private mode */
      }
    }, RUN_MARK_KEY);
    const player = await fakePlayer(page);
    await playThreeVerses(page);
    await expect.poll(player.files).toEqual(["002039.mp3"]);
    await expect.poll(() => marked(page, "heard")).toEqual(["2:39"]);
    await player.end();
    await expect.poll(() => marked(page, "heard")).toEqual(["2:40"]);
    expect(await marked(page, "selection")).toEqual(["2:39"]);
    await player.end();
    await player.end();
    await expect.poll(() => marked(page, "heard")).toEqual([]);
    expect(await marked(page, "selection")).toEqual(["2:39"]);
  });

  test("F switches full screen on a computer", async ({ page }) => {
    await openWith(page, "a");
    await page.keyboard.press("KeyF");
    await expect(topBar(page)).toBeHidden();
    await page.keyboard.press("KeyF");
    await expect(topBar(page)).toBeVisible();
  });
});
