import { test, expect, type Locator, type Page } from "@playwright/test";
import { ayahTarget } from "./ayah";

/*
 * The two tools the harakah-pick decision chose (D): the harakat tool, where a
 * magnifier follows the pointer with no press and a click notes the sign it
 * rings; and the word tool, where a tap opens a word into its parts and picking
 * one drops a note on it. Desktop only, like the bar they sit on.
 */
test.use({ locale: "en-US" });

const pageSvg = (page: Page, pageNo: number): Locator =>
  page.locator(`svg[aria-labelledby="page-label-${pageNo}"]:visible`);
const bar = (page: Page): Locator => page.getByRole("toolbar", { name: "Page tools" });
const toolBtn = (page: Page, name: string): Locator => bar(page).getByRole("radio", { name, exact: true });
const pins = (page: Page): Locator => page.locator("[data-note-pin]:visible");
const box = (page: Page): Locator => page.getByRole("dialog", { name: /^Your note on / });
const loupe = (page: Page): Locator => page.locator("[data-sign-loupe]");
const parts = (page: Page): Locator => page.getByRole("dialog", { name: /^The parts of a word in / });

/**
 * Where on screen the sign nearest the middle of page 7 sits, read from the
 * sign data itself: mid-page, so no corner (the bookmark fold) is over it.
 */
async function midSign(page: Page): Promise<{ x: number; y: number; id: string }> {
  return page.evaluate(async () => {
    const res = await fetch(new URL("assets/marks/hafs-kfqc/7.json", document.baseURI));
    const shard = (await res.json()) as { marks: Record<string, { r: number[] }[]> };
    let best = { d: Infinity, id: "", r: [0, 0, 0, 0] };
    for (const [ayah, list] of Object.entries(shard.marks))
      list.forEach((m, i) => {
        const d = Math.hypot(m.r[0]! + m.r[2]! / 2 - 172, m.r[1]! + m.r[3]! / 2 - 275);
        if (d < best.d) best = { d, id: `${ayah}/${i}`, r: m.r };
      });
    const r = best.r;
    const svg = [...document.querySelectorAll<SVGSVGElement>('svg[aria-labelledby="page-label-7"]')].find(
      (s) => s.getBoundingClientRect().width > 0,
    )!;
    const pt = svg.createSVGPoint();
    pt.x = r[0]! + r[2]! / 2;
    pt.y = r[1]! + r[3]! / 2;
    const at = pt.matrixTransform(svg.getScreenCTM()!);
    return { x: at.x, y: at.y, id: best.id };
  });
}

test.describe("Hifth · the harakat and word tools", () => {
  test("K: the magnifier follows the pointer with no press, and a click notes the sign", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();

    await page.keyboard.press("KeyK");
    await expect(toolBtn(page, "Harakat")).toHaveAttribute("aria-checked", "true");
    await expect(bar(page)).toContainText("Point at a vowel-sign");

    const at = await midSign(page);
    await page.mouse.move(at.x - 20, at.y - 20);
    await page.mouse.move(at.x, at.y, { steps: 4 });
    await expect(loupe(page)).toHaveAttribute("data-sign-loupe", at.id);

    await page.mouse.click(at.x, at.y);
    await expect(box(page)).toBeVisible();
    await expect(pins(page)).toHaveCount(1);
    await box(page).getByRole("textbox").fill("Fatha, not kasra");
    await page.keyboard.press("Escape");
    await expect(box(page)).toHaveCount(0);
    // The tool stays up for the next sign.
    await expect(toolBtn(page, "Harakat")).toHaveAttribute("aria-checked", "true");

    // Leaving the page puts the magnifier away; another tool never shows it.
    await page.mouse.move(2, 2);
    await expect(loupe(page)).toHaveCount(0);
    await page.keyboard.press("KeyV");
    await page.mouse.move(at.x, at.y, { steps: 4 });
    await expect(loupe(page)).toHaveCount(0);
  });

  test("W: a tap opens the word into its parts, and a part picked takes a note", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 7)).toBeVisible();

    await page.keyboard.press("KeyW");
    await expect(toolBtn(page, "Word")).toHaveAttribute("aria-checked", "true");
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    await expect(parts(page)).toBeVisible();
    // The whole word first, then one copy per sign.
    await expect(parts(page).locator('[data-part="word"]')).toHaveCount(1);
    expect(await parts(page).locator('[data-part="sign"]').count()).toBeGreaterThan(0);
    // The tap opened the word; it did not select the verse.
    await expect(page.locator("#hifth-overlay .hl-sel")).toHaveCount(0);

    // Escape closes it with nothing written.
    await page.keyboard.press("Escape");
    await expect(parts(page)).toHaveCount(0);
    await expect(pins(page)).toHaveCount(0);

    await page.mouse.click(at.x, at.y);
    await parts(page).locator('[data-part="sign"]').first().click();
    await expect(parts(page)).toHaveCount(0);
    await expect(box(page)).toBeVisible();
    await box(page).getByRole("textbox").fill("The sukun is held too long");
    await page.keyboard.press("Escape");
    await expect(pins(page)).toHaveCount(1);
    await expect(toolBtn(page, "Word")).toHaveAttribute("aria-checked", "true");
  });
});
