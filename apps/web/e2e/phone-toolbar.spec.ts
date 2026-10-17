import { test, expect, type Locator, type Page } from "@playwright/test";
import { ayahTarget } from "./ayah";
import { midSign } from "./signs";

/*
 * The page tools on a phone, step 5 of docs/design/page-toolbar-plan.md: three
 * layouts on trial (docs/decisions/phone-toolbar.md), picked by the address.
 * Each must reach every tool, and a tool picked on a phone must work on the
 * page by a tap: here the word tool opens a word into its parts.
 */
test.use({ locale: "en-US" });
test.skip(({ isMobile }) => !isMobile, "the phone's own bars");

const parts = (page: Page): Locator => page.getByRole("dialog", { name: /^The parts of a word in / });
const radio = (page: Page, name: string): Locator => page.getByRole("radio", { name, exact: true });
const bar = (page: Page, id: string): Locator => page.locator(`[data-phone-bar="${id}"]`);

/** The card is open, and wherever it meets the open tools it is the card a finger lands on. */
async function overTheTools(page: Page, card: Locator): Promise<void> {
  await expect(card).toBeVisible();
  await card.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((x) => x.finished)));
  const tray = (await page.getByRole("toolbar", { name: "Page tools" }).boundingBox())!;
  const box = (await card.boundingBox())!;
  const top = Math.max(tray.y, box.y);
  const bottom = Math.min(tray.y + tray.height, box.y + box.height);
  expect(bottom, "the card reaches down over the tray").toBeGreaterThan(top);
  for (const y of [top + 4, (top + bottom) / 2, bottom - 4])
    for (const x of [box.x + 24, box.x + box.width / 2, box.x + box.width - 24])
      expect(
        await page.evaluate(([px, py]) => !!document.elementFromPoint(px!, py!)?.closest('[role="dialog"]'), [x, y]),
        `at ${Math.round(x)},${Math.round(y)} the card is on top`,
      ).toBe(true);
}

test.describe("Hifth · the page tools on a phone", () => {
  test("C, shown by default: the Tools button slides the tools up, and a tool picked works by a tap", async ({
    page,
  }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(bar(page, "c")).toBeVisible();
    // The desktop bar and the other two layouts are not there.
    await expect(page.locator('[data-phone-bar="a"], [data-phone-bar="b"]')).toHaveCount(0);
    await expect(page.getByRole("toolbar", { name: "Page tools" })).toHaveCount(0);

    await bar(page, "c").getByRole("button", { name: /^Page tools · Select is on$/ }).click();
    await expect(page.getByRole("toolbar", { name: "Page tools" }).getByRole("radio")).toHaveCount(10);
    await radio(page, "Word").click();
    await expect(page.getByText("Tap a word to open it into its parts")).toBeVisible();
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    await expect(parts(page)).toBeVisible();
    // No keyboard on a phone, so no word about Shift.
    await expect(parts(page).getByText(/Shift/)).toBeHidden();
    await page.keyboard.press("Escape");

    // Closing the tray puts the page back to plain reading.
    await page.getByRole("button", { name: "Close the tools" }).click();
    await expect(bar(page, "c").getByRole("button", { name: /Select is on$/ })).toBeVisible();
  });

  test("holding a tool locks it on, so a run of notes is one tap each", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await bar(page, "c").getByRole("button", { name: /^Page tools · Select is on$/ }).click();
    const note = radio(page, "Note");
    // The tray slides up; a press made while it moves slides off the button.
    await note.evaluate((el) =>
      Promise.all(el.closest('[role="toolbar"]')!.getAnimations({ subtree: true }).map((x) => x.finished)),
    );
    const r = (await note.boundingBox())!;
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await expect(note).toHaveAttribute("aria-checked", "true");
    await expect(note).toHaveAttribute("data-locked", "true");
    await expect(page.getByText("Note stays on: tap it again to put it down")).toBeVisible();

    const pins = page.locator("[data-note-pin]:visible");
    const box = page.locator("[data-note-box]");
    let at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    await box.getByRole("textbox").fill("First slip");
    at = await ayahTarget(page, "#verse-51");
    await page.mouse.click(at.x, at.y);
    await expect(pins).toHaveCount(2);
    await expect(note).toHaveAttribute("aria-checked", "true");

    // A tap on the locked tool puts it down.
    await box.getByRole("button", { name: "Done" }).click();
    await note.click();
    await expect(radio(page, "Select")).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("[data-locked]")).toHaveCount(0);
  });

  test("a note opened low on the page stands above the open tools, not under them", async ({ page }) => {
    // The tray stays up while a tool is on, and the note box only kept clear of
    // the window's edge: a note on the last lines opened under the tray, with
    // its Done button out of reach.
    await page.goto("/#/hafs-kfqc/p7");
    await bar(page, "c").getByRole("button", { name: /^Page tools · Select is on$/ }).click();
    await radio(page, "Note").click();
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    const box = page.locator("[data-note-box]");
    await expect(box).toBeVisible();
    await expect(box.getByRole("textbox")).toBeFocused();
    const tray = (await page.getByRole("toolbar", { name: "Page tools" }).boundingBox())!;
    const card = (await box.boundingBox())!;
    expect(card.y + card.height).toBeLessThanOrEqual(tray.y);
    await box.getByRole("button", { name: "Done" }).click();
    await expect(box).toHaveCount(0);
  });

  test("a highlight's card opens over the open tools, not under them", async ({ page }) => {
    // The tray was drawn on the layer kept for passing messages, above every
    // card that opens over the page: a highlight's card slid up behind it, and
    // the tray hid the card's title and the top of its list (2026-10-10,
    // walking the live site on a phone).
    await page.goto("/#/hafs-kfqc/p7");
    await bar(page, "c").getByRole("button", { name: /^Page tools · Select is on$/ }).click();
    await radio(page, "Highlight").click();
    const from = await ayahTarget(page, "#verse-46");
    const to = await ayahTarget(page, "#verse-47");
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await overTheTools(page, page.getByRole("dialog", { name: /^Highlighted passage · / }));
  });

  test("a word's parts open over the open tools, not under them", async ({ page }) => {
    // The same layer put the word tool's card under the tray: the tray hid
    // its top row of parts (2026-10-10, the live site). The iPhone's install
    // notice is put away first: it pushes the verse down under the tools.
    await page.addInitScript(() => localStorage.setItem("hifth.notice.install-ios", "1"));
    await page.goto("/#/hafs-kfqc/p7");
    await bar(page, "c").getByRole("button", { name: /^Page tools · Select is on$/ }).click();
    await radio(page, "Word").click();
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    await overTheTools(page, parts(page));
  });

  test("the harakat tool's magnifier goes once the finger lifts, and the sign keeps its note", async ({ page }) => {
    // A tap rang the sign and opened its note, and the magnifier stayed on over
    // the lines above it while the note was written: it was put up again a
    // moment after the finger had already gone (2026-10-10, the live site).
    // The iPhone's install notice is put away first, as a reader does once: it
    // pushes the page down and the middle of it under the tools.
    await page.addInitScript(() => localStorage.setItem("hifth.notice.install-ios", "1"));
    await page.goto("/#/hafs-kfqc/p7");
    await bar(page, "c").getByRole("button", { name: /^Page tools · Select is on$/ }).click();
    await radio(page, "Harakat").click();
    const at = await midSign(page);
    await page.touchscreen.tap(at.x, at.y);
    await expect(page.getByRole("dialog", { name: /^Your note on / })).toBeVisible();
    await expect(page.locator("[data-note-pin]:visible")).toHaveCount(1);
    await page.waitForTimeout(500);
    await expect(page.locator("[data-sign-loupe]")).toHaveCount(0);
  });

  test("every tool, and the highlighter's pens, fit across the phone without pushing the page sideways", async ({
    page,
  }) => {
    // Nine tools at a thumb's width each, with their gaps, came to about 428
    // points: wider than a 390-point phone. Opening the tray widened the whole
    // page, and picking the highlighter slid it sideways under the reader.
    const fits = async (what: string) => {
      const m = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth,
        screen: innerWidth,
        scrolled: scrollX,
        radios: [...document.querySelectorAll<HTMLElement>('[role="radio"]')]
          .filter((el) => el.offsetParent)
          .map((el) => el.getBoundingClientRect())
          .map((r) => [Math.round(r.left), Math.round(r.right)]),
      }));
      expect(m.page, `${what}: the page is no wider than the screen`).toBeLessThanOrEqual(m.screen);
      expect(m.scrolled, `${what}: the page has not slid sideways`).toBe(0);
      for (const [left, right] of m.radios) {
        expect(left, `${what}: every button starts on the screen`).toBeGreaterThanOrEqual(0);
        expect(right, `${what}: every button ends on the screen`).toBeLessThanOrEqual(m.screen);
      }
      // Still a thumb's height, even where the row is tight across.
      for (const h of await page.locator('[role="radio"]:visible').evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().height),
      ))
        expect(h, `${what}: every button is a thumb's height`).toBeGreaterThanOrEqual(44);
    };

    await page.goto("/#/hafs-kfqc/p7");
    await bar(page, "c").getByRole("button", { name: /^Page tools · / }).click();
    await fits("C, the tray open");
    await radio(page, "Highlight").click();
    await expect(page.getByRole("radiogroup", { name: "Highlighter colour" })).toBeVisible();
    await fits("C, the highlighter on");

    await page.goto("/?phonebar=a#/hafs-kfqc/p7");
    await expect(bar(page, "a").getByRole("radio")).toHaveCount(10);
    await fits("A, the strip");
  });

  test("the Mistake pen's question stays on the screen, off its word and over the look-alike buttons, upright and on its side", async ({
    page,
  }) => {
    // Walking the phone (2026-10-16): a long word's question stood one choice to a row down the
    // whole screen, two of its buttons below the foot and two under the look-alike buttons, over
    // the word it asked about; on its side, tapped low on the page, it covered the word too.
    // And on its side with little page left (a note open under it), the drawer it docks into
    // stood half over the tapped word's line.
    await page.addInitScript(() => localStorage.setItem("hifth.notice.install-ios", "1"));
    await page.goto("/#/hafs-kfqc/2:48?tool=mistake");
    await expect(page.locator("[data-direction]:visible").first()).toBeVisible();
    const ask = page.getByRole("dialog", { name: /^What went wrong in / });
    for (const size of [null, { width: 844, height: 390 }, { width: 844, height: 300 }]) {
      if (size) await page.setViewportSize(size);
      await page.waitForTimeout(800);
      // The middle of the verses in sight and the foot of the page at either side, as the walk taps.
      const spots = await page.evaluate(() => {
        const svg = [...document.querySelectorAll<SVGSVGElement>("svg[aria-labelledby^='page-label-']")].find(
          (e) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility === "visible",
        )!;
        const lines = [...svg.querySelectorAll(".ayahPolygon")]
          .map((e) => e.getBoundingClientRect())
          .filter((b) => b.width > 0 && b.bottom > 0 && b.top < innerHeight);
        const top = Math.max(0, Math.min(...lines.map((b) => b.top)));
        const bottom = Math.min(innerHeight - 30, Math.max(...lines.map((b) => b.bottom)));
        const left = Math.min(...lines.map((b) => b.left));
        const right = Math.max(...lines.map((b) => b.right));
        const all = [
          { name: "middle", x: (left + right) / 2, y: (top + bottom) / 2 },
          { name: "foot-right", x: right - 24, y: bottom - 14 },
          { name: "foot-left", x: left + 24, y: bottom - 14 },
        ];
        return all.filter((p) => svg.contains(document.elementFromPoint(p.x, p.y)) && document.elementFromPoint(p.x, p.y)?.tagName !== "circle");
      });
      expect(spots.length, "spots on the page to tap").toBeGreaterThan(0);
      for (const at of spots) {
        const where = `${size ? `on its side ${size.height} tall` : "upright"}, ${at.name}`;
        await page.mouse.click(at.x, at.y);
        await expect(ask, where).toBeVisible();
        await ask.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((x) => x.finished)));
        const seen = await ask.evaluate((el, p) => {
          const r = el.getBoundingClientRect();
          const buttons = [...el.querySelectorAll("button")];
          return {
            marked: el.dataset.wordTop !== undefined,
            inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
            // Over the word it asks about, which it says it stands off; or over the tap.
            onWord:
              (p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom) ||
              (Number(el.dataset.wordBottom) > r.top && Number(el.dataset.wordTop) < r.bottom),
            // A button is reachable if, scrolled to, it is the thing a finger lands on.
            covered: buttons.filter((b) => {
              b.scrollIntoView({ block: "nearest", inline: "nearest" });
              const q = b.getBoundingClientRect();
              return !b.contains(document.elementFromPoint((q.left + q.right) / 2, (q.top + q.bottom) / 2));
            }).length,
          };
        }, at);
        expect(seen, where).toEqual({ marked: true, inside: true, onWord: false, covered: 0 });
        await page.keyboard.press("Escape");
        await expect(ask).toHaveCount(0);
      }
    }
  });

  test("a focused choice in the Mistake pen's question keeps its label readable", async ({ page }) => {
    // The first choice is focused as the question opens; a focus outline, not the solid fill of
    // the button that marks many signs, which left its label dark on dark.
    await page.goto("/#/hafs-kfqc/p7?tool=mistake");
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    const whole = page.getByRole("dialog", { name: /^What went wrong in / }).getByRole("button", { name: "The whole word" });
    await expect(whole).toBeVisible();
    // Read off the style sheet, since Safari's engine does not move the keyboard's focus to a
    // button: the choice's own focus rule draws an outline and leaves the fill alone.
    const fills = await whole.evaluate((b) => {
      const own = [...b.classList].map((c) => `.${c}:focus-visible`);
      const rules = [...document.styleSheets].flatMap((sheet) => {
        try {
          return [...sheet.cssRules];
        } catch {
          return [];
        }
      });
      return rules
        .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule)
        .filter((r) => r.selectorText.split(",").some((sel) => own.includes(sel.trim())))
        .map((r) => `${r.style.background || r.style.backgroundColor || "none"}|${r.style.outline ? "outline" : "-"}`);
    });
    expect(fills.length, "the choice has a focus rule").toBeGreaterThan(0);
    for (const f of fills) expect(f).toBe("none|outline");
  });

  test("A: a strip under the top bar, one tap to a tool", async ({ page }) => {
    await page.goto("/?phonebar=a#/hafs-kfqc/p7");
    await expect(bar(page, "a").getByRole("radio")).toHaveCount(10);
    await radio(page, "Mistake").click();
    await expect(radio(page, "Mistake")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("Tap a word to mark a mistake")).toBeVisible();
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    await page.getByRole("dialog", { name: /^What went wrong in / }).getByRole("button", { name: "The whole word" }).click();
    await expect(page.locator("[data-mistake-word]:visible")).toHaveCount(1);
  });

  test("B: the pen case fans the tools out and closes on a pick", async ({ page }) => {
    await page.goto("/?phonebar=b#/hafs-kfqc/p7");
    const button = bar(page, "b").getByRole("button", { name: /^Page tools · / });
    await button.click();
    await expect(bar(page, "b").getByRole("radio")).toHaveCount(10);
    await radio(page, "Note").click();
    await expect(bar(page, "b").getByRole("radio")).toHaveCount(0);
    await expect(button).toHaveAccessibleName("Page tools · Note is on");
    // A tap anywhere else closes it without a pick.
    await button.click();
    await page.locator("footer").click({ position: { x: 8, y: 8 } });
    await expect(bar(page, "b").getByRole("radio")).toHaveCount(0);
  });
});
