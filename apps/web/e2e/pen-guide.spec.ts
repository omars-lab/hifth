import { test, expect, type Locator, type Page } from "@playwright/test";
import { COACH_STORAGE_KEY } from "../src/coach";
import { MARK_TOOLS_KEY } from "../src/mark-tools";
import { PEN_KEY, WORD_PEN_KEY } from "../src/pen";
import { TIP_PENS, TIP_PENS_KEY } from "../src/pen-ring";

/*
 * A page in the info panel that shows the pens an Apple Pencil opens at its
 * tip and says what each one does (.claude/plans/open-work-2026-11.md, 3b).
 *
 * The pens on it are the ones the iPad opens, working, in the layout the
 * reader set (rings or a row). They are for trying: a press there must change
 * nothing on the mus'haf page, and nothing the app remembers.
 *
 * Written before the build (2026-11-11) and watched failing: the info panel
 * had no such page.
 */
test.use({ locale: "en-US" });

async function openGuide(page: Page, seed: Record<string, string> = {}): Promise<Locator> {
  await page.addInitScript(
    ([coach, values]) => {
      try {
        localStorage.setItem(coach, "1");
        if (!localStorage.getItem("pen-guide-seeded")) {
          for (const [k, v] of Object.entries(values)) localStorage.setItem(k, v);
          localStorage.setItem("pen-guide-seeded", "1");
        }
      } catch {
        /* private mode */
      }
    },
    [COACH_STORAGE_KEY, seed] as const,
  );
  await page.goto("/#/hafs-kfqc/p7");
  await expect(page.locator("svg[aria-labelledby='page-label-7']:visible")).toBeVisible();
  await page.getByRole("button", { name: /About Hifth/ }).click();
  const panel = page.getByRole("dialog", { name: "About Hifth" });
  await panel.getByRole("button", { name: "See what each pen does" }).click();
  const guide = panel.locator("[data-pen-guide]");
  await expect(guide).toBeVisible();
  return guide;
}

const pens = (guide: Locator): Locator => guide.locator("[data-pencil-pens]");
const toolRadios = (guide: Locator): Locator => pens(guide).getByRole("radiogroup", { name: "Page tools" }).getByRole("radio");

/** Each button's name and the words that explain it (the element it is described by). */
async function explained(guide: Locator): Promise<Array<{ name: string; says: string; shown: boolean }>> {
  return pens(guide)
    .getByRole("radio")
    .evaluateAll((buttons) =>
      buttons.map((b) => {
        const line = document.getElementById(b.getAttribute("aria-describedby") ?? "");
        return {
          name: b.getAttribute("aria-label") ?? "",
          says: (line?.textContent ?? "").trim(),
          shown: !!line && line.getClientRects().length > 0,
        };
      }),
    );
}

function expectAllExplained(rows: Array<{ name: string; says: string; shown: boolean }>): void {
  for (const row of rows) {
    expect(row.name, "a pen with no name").not.toBe("");
    expect(row.shown, `${row.name} has an explanation on the page`).toBe(true);
    // More than the name said again: what it does, and when to reach for it.
    expect(row.says.length, `${row.name} is explained, not only named: "${row.says}"`).toBeGreaterThan(row.name.length + 30);
  }
}

/** Everything a press could have changed outside the guide. */
async function outside(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const kept: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      kept[k] = localStorage.getItem(k) ?? "";
    }
    return {
      kept,
      pen: document.documentElement.dataset.pen ?? null,
      wordPen: document.documentElement.dataset.wordPen ?? null,
      tools: [...document.querySelectorAll<HTMLElement>("[data-tool]")].filter((el) => !el.closest("[data-pen-guide]")).map((el) => el.dataset.tool),
      // What is drawn on the mus'haf page itself.
      drawn: [...document.querySelectorAll("main svg")].map((svg) => svg.querySelectorAll("*").length),
    };
  });
}

for (const layout of TIP_PENS) {
  test.describe(`Hifth · the pencil's pens, explained (${layout})`, () => {
    test("every pen is there, in the reader's layout, with its explanation", async ({ page }) => {
      const guide = await openGuide(page, { [TIP_PENS_KEY]: layout });
      await expect(pens(guide)).toHaveAttribute("data-pencil-pens", layout);
      // How to open them for real is said first.
      await expect(guide).toContainText("Squeeze");
      await expect(guide).toContainText("Show tool palette");
      const count = await toolRadios(guide).count();
      expect(count).toBeGreaterThanOrEqual(8);
      expectAllExplained(await explained(guide));
      // Each tool in turn, so the choices a tool opens are checked too.
      for (let i = 0; i < count; i++) {
        const radio = toolRadios(guide).nth(i);
        if ((await radio.getAttribute("aria-checked")) !== "true") await radio.click();
        await expect(radio).toHaveAttribute("aria-checked", "true");
        // The pens stay out here: a pick does not put them away.
        await expect(toolRadios(guide)).toHaveCount(count);
        expectAllExplained(await explained(guide));
      }
    });

    test("pressing the highlighter shows its pens, and nothing lands on the mus'haf page", async ({ page }) => {
      const guide = await openGuide(page, { [TIP_PENS_KEY]: layout });
      const before = await outside(page);
      await pens(guide).getByRole("radio", { name: "Highlight", exact: true }).click();
      const passage = pens(guide).getByRole("radiogroup", { name: "Highlighter colour" });
      const held = pens(guide).getByRole("radiogroup", { name: "Colour of words you hold" });
      await expect(passage.getByRole("radio")).toHaveCount(4);
      await expect(held.getByRole("radio")).toHaveCount(4);
      // The pens here work: a press picks.
      await passage.getByRole("radio", { name: "Pink" }).click();
      await expect(passage.getByRole("radio", { name: "Pink" })).toHaveAttribute("aria-checked", "true");
      await held.getByRole("radio", { name: "Yellow" }).click();
      await expect(held.getByRole("radio", { name: "Yellow" })).toHaveAttribute("aria-checked", "true");
      await pens(guide).getByRole("radio", { name: "Mistake", exact: true }).click();
      await expect(pens(guide)).toHaveAttribute("data-tool", "mistake");
      // And none of it reached the page, or what the app remembers.
      expect(await outside(page)).toEqual(before);
      expect(await page.evaluate(([a, b]) => [localStorage.getItem(a), localStorage.getItem(b)], [PEN_KEY, WORD_PEN_KEY] as const)).toEqual([null, null]);
    });
  });
}

test.describe("Hifth · the pencil's pens, explained", () => {
  test("Note, Harakat and Word are each explained, as one button or as three", async ({ page }) => {
    const guide = await openGuide(page, { [MARK_TOOLS_KEY]: "three" });
    for (const name of ["Note", "Harakat", "Word"]) {
      await expect(pens(guide).getByRole("radio", { name, exact: true })).toBeVisible();
    }
    expectAllExplained(await explained(guide));
  });

  test("Back, or Escape, returns to the info panel", async ({ page }) => {
    const guide = await openGuide(page);
    const panel = page.getByRole("dialog", { name: "About Hifth" });
    await guide.getByRole("button", { name: "Back" }).click();
    await expect(guide).toHaveCount(0);
    const open = panel.getByRole("button", { name: "See what each pen does" });
    await expect(open).toBeFocused();
    await open.click();
    await expect(guide).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(guide).toHaveCount(0);
    // One Escape goes back; the panel is still open.
    await expect(panel).toBeVisible();
  });

  test("the pens fit the panel, none off the edge of the screen", async ({ page }) => {
    const guide = await openGuide(page);
    await pens(guide).getByRole("radio", { name: "Highlight", exact: true }).click();
    await pens(guide).scrollIntoViewIfNeeded();
    const off = await pens(guide)
      .getByRole("radio")
      .evaluateAll((buttons) =>
        buttons
          .map((b) => ({ name: b.getAttribute("aria-label"), r: b.getBoundingClientRect() }))
          .filter(({ r }) => r.left < 0 || r.right > window.innerWidth)
          .map(({ name }) => name),
      );
    expect(off).toEqual([]);
  });
});
