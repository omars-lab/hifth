import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import { COACH_STORAGE_KEY } from "../src/coach";
import { PEN_HOME_KEY } from "../src/pen-home";
import { PEN_SIDE_KEY } from "../src/pen-side";
import { LANG_STORAGE_KEY } from "../src/lang";

/*
 * Where the page tools sit on a computer, or an iPad held sideways
 * (docs/design/notes-style-toolbar.md, ①). The owner asked on 2026-10-05 for
 * every home the study drew to be built and offered as a setting:
 *
 *   strip   today's row above the book, the default;
 *   float   A · a palette dragged to any edge of the window, as in Notes;
 *   bottom  B · a Mark up button in the bottom row, the pens in its place;
 *   side    C · the pens down the margin beside the book, or B where there
 *           is no margin.
 *
 * What each home promises, and what these tests hold it to: B and C cover no
 * line of either page, and A comes to rest on an edge and stays there.
 */
test.use({ locale: "en-US" });

const IPAD = { width: 1180, height: 820 };

async function openWith(page: Page, home: string | null, size = IPAD): Promise<void> {
  await page.setViewportSize(size);
  await page.addInitScript(
    ([coach, key, value]) => {
      try {
        localStorage.setItem(coach, "1");
        if (value && !localStorage.getItem("pen-homes-seeded")) {
          localStorage.setItem(key, value);
          localStorage.setItem("pen-homes-seeded", "1");
        }
      } catch {
        /* private mode */
      }
    },
    [COACH_STORAGE_KEY, PEN_HOME_KEY, home] as const,
  );
  await page.goto("/#/hafs-kfqc/p7");
  await expect(page.locator("svg[aria-labelledby='page-label-7']:visible")).toBeVisible();
}

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The two open pages, as drawn. */
async function leaves(page: Page): Promise<Box[]> {
  const boxes: Box[] = [];
  for (const n of [7, 8]) {
    const box = await page.locator(`svg[aria-labelledby='page-label-${n}']:visible`).boundingBox();
    if (box) boxes.push(box);
  }
  expect(boxes).toHaveLength(2);
  return boxes;
}

async function coversNoLine(page: Page, palette: Locator): Promise<void> {
  const box = (await palette.boundingBox())!;
  for (const leaf of await leaves(page)) expect(overlaps(box, leaf), "the pens sit on a page").toBe(false);
}

const home = (page: Page, name: string) => page.locator(`[data-pen-home="${name}"]`);

/** Whatever else the bottom row draws (the hint, the trail, full screen) that a box sits on. */
async function bottomRowUnder(page: Page, target: Locator): Promise<string[]> {
  const box = (await target.boundingBox())!;
  return page.locator("footer").evaluate((footer, b) => {
    const mine = footer.querySelector('[data-pen-home="bottom"]');
    return [...footer.querySelectorAll<HTMLElement>("*")]
      .filter((el) => !mine?.contains(el) && el.children.length === 0)
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.x < b.x + b.width && b.x < r.right && r.y < b.y + b.height && b.y < r.bottom;
      })
      .map((el) => el.textContent?.trim() || el.tagName);
  }, box);
}

/** The box stays inside the reading area, clear of the bars above and below. */
async function insideReadingArea(page: Page, target: Locator): Promise<void> {
  const box = (await target.boundingBox())!;
  const area = (await page.locator("main").boundingBox())!;
  expect(box.y, "rises into the bar above").toBeGreaterThanOrEqual(area.y);
  expect(box.y + box.height, "drops into the bar below").toBeLessThanOrEqual(area.y + area.height);
}

test.describe("where the pens sit", () => {
  test("today's strip above the book is the default, and nothing else shows", async ({ page }) => {
    await openWith(page, null);
    await expect(home(page, "strip")).toBeVisible();
    await expect(home(page, "strip").getByRole("radio")).toHaveCount(10);
    for (const other of ["float", "bottom", "side"]) await expect(home(page, other)).toHaveCount(0);
  });

  test("on a large iPad nobody has set, the pens wait behind the Mark up button", async ({ browser }) => {
    // The owner's pick, 2026-10-11 (notes-style-toolbar ①): a finger, not a mouse.
    const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: IPAD, locale: "en-US" });
    const page = await context.newPage();
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
    await openWith(page, null);
    await expect(home(page, "bottom")).toBeVisible();
    await expect(home(page, "strip")).toHaveCount(0);
    await context.close();
  });

  test("nobody has set it: when the screen turns out to be a finger's after the app starts, the pens follow", async ({ page, browserName }) => {
    // The first screen once came up on an iPad with the computer's strip,
    // because the app asked "is this a finger?" a single time, as it started,
    // and the answer was not in yet. An unset home now follows the answer.
    test.skip(browserName !== "chromium", "only Chromium can make the screen a finger's after the start");
    await openWith(page, null);
    await expect(home(page, "strip")).toBeVisible();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await cdp.send("Emulation.setEmitTouchEventsForMouse", { enabled: true, configuration: "mobile" });
    await expect.poll(() => page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
    await expect(home(page, "bottom")).toBeVisible();
    await expect(home(page, "strip")).toHaveCount(0);
  });

  test("B · a Mark up button opens the pens in the bottom row, covering no line, and Done puts them away", async ({ page }) => {
    await openWith(page, "bottom");
    await expect(home(page, "strip")).toHaveCount(0);
    const bar = home(page, "bottom");
    await expect(bar.getByRole("radio")).toHaveCount(0);
    // Closed, it takes a place of its own in the row, on top of nothing.
    expect(await bottomRowUnder(page, bar.getByRole("button", { name: "Mark up" }))).toEqual([]);
    // Nor does it make the row taller: every pixel it took came off the page.
    expect((await page.locator("footer").boundingBox())!.height).toBeLessThanOrEqual(45);
    await bar.getByRole("button", { name: "Mark up" }).click();
    const pens = bar.getByRole("toolbar", { name: "Page tools" });
    await expect(pens.getByRole("radio")).toHaveCount(10);
    await coversNoLine(page, pens);
    await pens.getByRole("radio", { name: "Mistake" }).click();
    await expect(pens.getByRole("radio", { name: "Mistake" })).toHaveAttribute("aria-checked", "true");
    // Said to a mouse, as here: click, not tap.
    await expect(pens).toContainText("Click a word to mark a mistake");
    await pens.getByRole("button", { name: "Done" }).click();
    await expect(bar.getByRole("radio")).toHaveCount(0);
    await expect(bar).toHaveAttribute("data-tool", "select");
  });

  test("A · the floating palette comes to rest on the edge it is dragged to, and stays there", async ({ page }) => {
    await openWith(page, "float");
    const palette = home(page, "float");
    await expect(palette.getByRole("radio")).toHaveCount(10);
    // It starts along the bottom, lying flat.
    let box = (await palette.boundingBox())!;
    expect(box.width).toBeGreaterThan(box.height);
    expect(box.y + box.height).toBeGreaterThan(IPAD.height - 40);

    const grip = palette.locator("[data-pen-grip]");
    const g = (await grip.boundingBox())!;
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(300, 400, { steps: 8 });
    await page.mouse.move(30, 380, { steps: 8 });
    await page.mouse.up();

    // On the left edge it stands upright, flush with the window.
    await expect.poll(async () => (await palette.boundingBox())!.x).toBeLessThan(20);
    box = (await palette.boundingBox())!;
    expect(box.height).toBeGreaterThan(box.width);

    await page.reload();
    await expect(palette.getByRole("radio")).toHaveCount(10);
    box = (await palette.boundingBox())!;
    expect(box.x).toBeLessThan(20);
    expect(box.height).toBeGreaterThan(box.width);
  });

  test("C · the pens stand down the margin beside the book, covering no line", async ({ page }) => {
    for (const size of [IPAD, { width: 1440, height: 900 }]) {
      await openWith(page, "side", size);
      const rail = home(page, "side");
      await expect(rail.getByRole("radio")).toHaveCount(10);
      const box = (await rail.boundingBox())!;
      expect(box.height).toBeGreaterThan(box.width);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      await coversNoLine(page, rail);
      // The highlighter's pens join it without pushing it into the bars.
      await rail.getByRole("radio", { name: "Highlight" }).click();
      // Both rows: the passage's pens and the held words' (⑤, 2026-10-12).
      for (const row of ["Highlighter colour", "Colour of words you hold"])
        await expect(rail.getByRole("radiogroup", { name: row }).getByRole("radio", { name: "Pink" })).toBeVisible();
      await insideReadingArea(page, rail);
      await coversNoLine(page, rail);
      // Done puts the pen down, so the next size starts as this one did.
      await rail.getByRole("button", { name: "Done" }).click();
      await expect(rail).toHaveAttribute("data-tool", "select");
    }
  });

  test("C · with no margin beside the book, the pens go to the bottom row instead", async ({ page }) => {
    await openWith(page, "side", { width: 1100, height: 1100 });
    await expect(home(page, "side")).toHaveCount(0);
    await expect(home(page, "bottom").getByRole("button", { name: "Mark up" })).toBeVisible();
  });

  test("the setting switches the home at once, and is remembered", async ({ page }) => {
    await openWith(page, null);
    await page.getByRole("button", { name: /About Hifth/ }).click();
    const choices = page.getByRole("dialog").locator('[aria-labelledby="colophon-pen-home"]').getByRole("radio");
    await expect(choices).toHaveCount(4);
    await choices.and(page.locator('[data-pen-home-choice="bottom"]')).click();
    await expect(choices.and(page.locator('[data-pen-home-choice="bottom"]'))).toHaveAttribute("aria-checked", "true");
    expect(await page.evaluate((k) => localStorage.getItem(k), PEN_HOME_KEY)).toBe("bottom");
    await page.keyboard.press("Escape");
    await expect(home(page, "strip")).toHaveCount(0);
    await expect(home(page, "bottom").getByRole("button", { name: "Mark up" })).toBeVisible();
  });
});

/*
 * Which side the pens stand on (docs/PLAN.md, 95). The owner chose on
 * 2026-10-12 (notes-style-toolbar ④): the right by default, in both
 * languages; a setting in the info panel puts the pens down the side and the
 * Mark up button on the left, mirrored. On an iPad held sideways, in both
 * languages, each side: wholly on its half of the screen, at that edge, and
 * clear of the page.
 */
test.describe("which side the pens stand on", () => {
  async function openOn(browser: Browser, opts: { lang: string; side: string | null; home: string }) {
    const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: IPAD, locale: "en-US" });
    const page = await context.newPage();
    await page.addInitScript(
      ([coach, langKey, lang, homeKey, home, sideKey, side]) => {
        try {
          if (localStorage.getItem("pen-side-seeded")) return;
          localStorage.setItem(coach, "1");
          localStorage.setItem(langKey, lang);
          localStorage.setItem(homeKey, home);
          if (side) localStorage.setItem(sideKey, side);
          localStorage.setItem("pen-side-seeded", "1");
        } catch {
          /* private mode */
        }
      },
      [COACH_STORAGE_KEY, LANG_STORAGE_KEY, opts.lang, PEN_HOME_KEY, opts.home, PEN_SIDE_KEY, opts.side] as const,
    );
    await page.goto("/#/hafs-kfqc/p7");
    await expect(page.locator("svg[aria-labelledby='page-label-7']:visible")).toBeVisible();
    return { page, context };
  }

  /** Wholly on that side's half of the screen, and against that edge of the window. */
  function onSide(box: Box, side: string, edge: number): void {
    if (side === "left") {
      expect(box.x + box.width, "reaches past the middle").toBeLessThan(IPAD.width / 2);
      expect(box.x, "away from the left edge").toBeLessThan(edge);
    } else {
      expect(box.x, "reaches past the middle").toBeGreaterThan(IPAD.width / 2);
      expect(box.x + box.width, "away from the right edge").toBeGreaterThan(IPAD.width - edge);
    }
  }

  for (const lang of ["en", "ar"])
    for (const [side, seeded] of [["right", null], ["left", "left"]] as const) {
      test(`${lang} · ${side}${seeded ? "" : " (the default)"}: the pens down the side stand on the ${side}, mirrored, covering no line`, async ({ browser }) => {
        const { page, context } = await openOn(browser, { lang, side: seeded, home: "side" });
        const rail = home(page, "side");
        await expect(rail.getByRole("radio")).toHaveCount(10);
        onSide((await rail.boundingBox())!, side, 20);
        await coversNoLine(page, rail);
        // With the highlighter's pens out, they stand on the book's side of
        // the tools, so the tools keep to the window's edge on either side.
        await rail.locator("[role=radio][aria-keyshortcuts=H]").click();
        await expect(rail).toHaveAttribute("data-tool", "highlight");
        const groups = rail.getByRole("radiogroup");
        const tools = (await groups.filter({ has: page.locator("[aria-keyshortcuts=H]") }).boundingBox())!;
        const pens = (await groups.filter({ hasNot: page.locator("[aria-keyshortcuts=H]") }).first().boundingBox())!;
        if (side === "left") expect(pens.x, "the pens are on the book's side of the tools").toBeGreaterThan(tools.x);
        else expect(pens.x, "the pens are on the book's side of the tools").toBeLessThan(tools.x);
        onSide((await rail.boundingBox())!, side, 20);
        await coversNoLine(page, rail);
        await insideReadingArea(page, rail);
        await context.close();
      });

      test(`${lang} · ${side}${seeded ? "" : " (the default)"}: the Mark up button stands at the ${side} end of the bottom row, on top of nothing`, async ({ browser }) => {
        const { page, context } = await openOn(browser, { lang, side: seeded, home: "bottom" });
        const button = home(page, "bottom").locator("button[aria-expanded]");
        await expect(button).toBeVisible();
        onSide((await button.boundingBox())!, side, 40);
        expect(await bottomRowUnder(page, button)).toEqual([]);
        await coversNoLine(page, button);
        await context.close();
      });
    }

  test("the setting moves them at once, and is remembered", async ({ browser }) => {
    const { page, context } = await openOn(browser, { lang: "en", side: null, home: "side" });
    await page.getByRole("button", { name: /About Hifth/ }).click();
    const choices = page.getByRole("dialog").locator('[aria-labelledby="colophon-pen-side"]').getByRole("radio");
    await expect(choices).toHaveCount(2);
    await expect(choices.and(page.locator('[data-pen-side-choice="right"]'))).toHaveAttribute("aria-checked", "true");
    await choices.and(page.locator('[data-pen-side-choice="left"]')).click();
    await expect(choices.and(page.locator('[data-pen-side-choice="left"]'))).toHaveAttribute("aria-checked", "true");
    expect(await page.evaluate((k) => localStorage.getItem(k), PEN_SIDE_KEY)).toBe("left");
    await page.keyboard.press("Escape");
    onSide((await home(page, "side").boundingBox())!, "left", 20);
    await page.reload();
    await expect(home(page, "side").getByRole("radio")).toHaveCount(10);
    onSide((await home(page, "side").boundingBox())!, "left", 20);
    await context.close();
  });
});
