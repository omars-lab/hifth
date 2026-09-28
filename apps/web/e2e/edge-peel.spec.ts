import { test, expect, type Locator, type Page } from "@playwright/test";
import { TURN_STYLE_KEY } from "../src/turn-style";
import { foldsSeen, watchFolds } from "./fold";

/*
 * The corner that lifts with the hand (#189).
 *
 * Owner, 2026-09-28 demo walk: on a computer, dragging a page corner did
 * nothing until the mouse came up. A page held by its corner lifts with the
 * hand, and the next opening shows underneath while it is still held; let go
 * far enough and it goes over, short of it and it falls back.
 *
 * In its own file so Firefox — the browser the owner reads in — runs it too:
 * the peel is clip-paths, a transform and a shadow filter, which is exactly
 * where two engines disagree.
 */

const pageSvg = (page: Page, pageNo: number): Locator =>
  page.locator(`svg[aria-labelledby="page-label-${pageNo}"]:visible`);
const NUM = "header .numeric";
const peel = (page: Page): Locator => page.getByTestId("edge-peel");

async function railBox(page: Page, side: "left" | "right") {
  const box = await page.getByTestId(`edge-grab-${side}`).boundingBox();
  expect(box, "the fore-edge has no box").not.toBeNull();
  return box!;
}

async function openAt8(page: Page): Promise<void> {
  await page.goto("/#/hafs-kfqc/p8");
  await expect(page.getByTestId("page-spread")).toBeVisible();
  await expect(pageSvg(page, 8)).toBeVisible();
}

test.describe("Hifth · lifting a page by its corner", () => {
  test("mid-grab the corner lifts with the hand and the next pages show beneath", async ({
    page,
  }) => {
    await watchFolds(page);
    await openAt8(page);

    const rail = await railBox(page, "left");
    const y = rail.y + rail.height * 0.15;
    await page.mouse.move(rail.x + 6, y);
    await page.mouse.down();
    for (let i = 1; i <= 5; i += 1) await page.mouse.move(rail.x + 6 + i * 40, y + i * 4);

    // Still held: the peel is up, and beneath the lifted corner is page 10 —
    // the left leaf of the next opening, standing still where it will lie.
    await expect(peel(page)).toBeVisible();
    await expect(peel(page).getByTestId("edge-peel-under")).toHaveAttribute("src", /\/10\.svg$/);
    // The flap in the hand is plain paper under the default turn style: no
    // drawn letter rides a moving surface (turn-style decision, 2026-09-26 —
    // curling the real words was the option left out).
    await expect(peel(page).getByTestId("edge-peel-flap")).toBeVisible();
    await expect(peel(page).getByTestId("edge-peel-back")).toBeHidden();
    // The corner has moved with the pointer.
    const lift = Number(await peel(page).getAttribute("data-lift"));
    expect(lift, "the corner did not follow the hand").toBeGreaterThan(150);
    // The live pages were not moved to make it: the page drawing has no transform.
    const moved = await pageSvg(page, 8).evaluate((el) => getComputedStyle(el).transform);
    expect(moved).toBe("none");
    await expect(page.locator(NUM)).toHaveText("8");

    await page.mouse.up();
    await expect(page.locator(NUM)).toHaveText("9");
    await expect(peel(page)).toHaveCount(0);
    // The reader watched the leaf go over by hand; no band plays it again.
    expect(await foldsSeen(page), "a band played the turn again after the peel").toEqual([]);
  });

  // Owner, 2026-09-28 (Firefox): the turn did not land on the finished page —
  // a blank page, then a jump in size. The picture of a page in the peel must
  // stand exactly where its drawing will, and from the moment the leaf lies
  // flat until the drawings take over, every frame must show both pages.
  test("the lifted pages stand where their drawings land, and nothing goes blank", async ({
    page,
  }) => {
    await openAt8(page);
    // Both pages of the opening drawn, so the facing leaf's box is known.
    await expect(pageSvg(page, 7)).toBeVisible();
    const box = async (loc: Locator) => {
      const b = (await loc.boundingBox())!;
      return [b.x, b.y, b.width, b.height].map(Math.round);
    };
    const leftDrawing = await box(pageSvg(page, 8));
    const rightDrawing = await box(pageSvg(page, 7));

    // Every frame from the release on: is each page of the new opening shown,
    // and where? A picture counts once it has loaded; a drawing once it has ink.
    await page.evaluate(() => {
      const w = window as unknown as { __frames: string[] };
      w.__frames = [];
      const r = (el: Element) => {
        const b = el.getBoundingClientRect();
        return [b.x, b.y, b.width, b.height].map(Math.round).join(",");
      };
      const drawn = (n: number) => {
        const s = [...document.querySelectorAll(`svg[aria-labelledby="page-label-${n}"]`)].find(
          (e) => e.getBoundingClientRect().width > 0 && e.querySelector("path"),
        );
        return s ? `svg@${r(s)}` : null;
      };
      const pic = (id: string) => {
        const i = document.querySelector(`[data-testid="${id}"]`) as HTMLImageElement | null;
        if (!i) return null;
        return i.complete && i.naturalWidth > 0 ? `img@${r(i)}` : "img-unloaded";
      };
      const t0 = performance.now();
      const tick = () => {
        const landed = document.querySelector('[data-testid="edge-peel"][data-landed]');
        if (landed) w.__frames.push(`landed 10=${pic("edge-peel-under")} 9=${pic("edge-peel-back")}`);
        else if (w.__frames.length > 0 || document.querySelector("header .numeric")?.textContent === "9")
          w.__frames.push(`live 10=${drawn(10)} 9=${drawn(9)}`);
        if (performance.now() - t0 < 4000) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    const rail = await railBox(page, "left");
    const y = rail.y + rail.height * 0.15;
    await page.mouse.move(rail.x + 6, y);
    await page.mouse.down();
    for (let i = 1; i <= 5; i += 1) await page.mouse.move(rail.x + 6 + i * 40, y + i * 4);

    // Held: page 10 beneath sits exactly on the left page's drawing.
    const under = peel(page).getByTestId("edge-peel-under");
    await expect(under).toBeVisible();
    expect(await box(under), "the page beneath is not where its drawing will be").toEqual(leftDrawing);

    await page.mouse.up();
    await expect(page.locator(NUM)).toHaveText("9");
    await expect(peel(page)).toHaveCount(0);
    await expect(pageSvg(page, 10)).toBeVisible();
    await page.waitForTimeout(300);

    const frames = await page.evaluate(() => (window as unknown as { __frames: string[] }).__frames);
    expect(frames.some((f) => f.startsWith("landed")), "the leaf was never laid flat").toBe(true);
    const at = (b: number[]) => b.join(",");
    const bad = frames.filter((f) => {
      if (f.startsWith("landed"))
        return f !== `landed 10=img@${at(leftDrawing)} 9=img@${at(rightDrawing)}`;
      return f !== `live 10=svg@${at(leftDrawing)} 9=svg@${at(rightDrawing)}`;
    });
    expect(bad, "a frame after the release showed a blank or misplaced page").toEqual([]);
  });

  // Owner, 2026-09-28 (Firefox): the lifted corner poked out above the page and
  // hung below it. The paper stands a little inside the book, top and foot; the
  // corner in the hand is the paper's corner, so the peel is drawn on the paper.
  test("the lifted corner is the paper's corner, not the book's box", async ({ page }) => {
    await openAt8(page);
    const paper = (await pageSvg(page, 8).locator("..").boundingBox())!;
    const book = (await page.getByTestId("page-book").boundingBox())!;
    expect(paper.y - book.y, "the paper no longer stands inside the book").toBeGreaterThan(2);

    const rail = await railBox(page, "left");
    const y = rail.y + rail.height * 0.05;
    await page.mouse.move(rail.x + 6, y);
    await page.mouse.down();
    for (let i = 1; i <= 5; i += 1) await page.mouse.move(rail.x + 6 + i * 40, y + i * 8);

    const layer = (await peel(page).boundingBox())!;
    expect(Math.round(layer.y), "the peel starts above the paper").toBe(Math.round(paper.y));
    expect(Math.round(layer.height), "the peel is not the paper's height").toBe(Math.round(paper.height));
    await page.mouse.up();
    await expect(page.locator(NUM)).toHaveText("9");
  });

  // Owner, 2026-09-28 (Firefox): with two pages open an arrow had to be pressed
  // twice, and every second press flashed and did nothing. A turn stepped one
  // page — from 7, that is 8, already open beside it. A turn moves an opening.
  test("each arrow press and each corner pull turns a whole opening", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 8)).toBeVisible();
    await expect(page.locator(NUM)).toHaveText("7");

    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(NUM)).toHaveText("9");
    await expect(pageSvg(page, 10)).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(NUM)).toHaveText("7");
    await expect(pageSvg(page, 8)).toBeVisible();

    // The corner pulled from the right-hand page's opening lands on the next one too.
    const rail = await railBox(page, "left");
    const y = rail.y + rail.height * 0.15;
    await page.mouse.move(rail.x + 6, y);
    await page.mouse.down();
    for (let i = 1; i <= 5; i += 1) await page.mouse.move(rail.x + 6 + i * 40, y + i * 4);
    await expect(peel(page).getByTestId("edge-peel-under")).toHaveAttribute("src", /\/10\.svg$/);
    await page.mouse.up();
    await expect(page.locator(NUM)).toHaveText("9");
  });

  test("the right edge lifts toward the earlier pages", async ({ page }) => {
    await openAt8(page);

    const rail = await railBox(page, "right");
    const x = rail.x + rail.width - 6;
    const y = rail.y + rail.height * 0.85;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 5; i += 1) await page.mouse.move(x - i * 40, y - i * 4);

    // From the opening (7, 8), pulling back shows 5 beneath and 6 on the back.
    await expect(peel(page)).toHaveAttribute("data-side", "right");
    await expect(peel(page).getByTestId("edge-peel-under")).toHaveAttribute("src", /\/5\.svg$/);
    await expect(peel(page).getByTestId("edge-peel-back")).toBeHidden();

    // Carried back the way it came, the corner falls back and nothing turns.
    for (let i = 4; i >= 0; i -= 1) await page.mouse.move(x - i * 40, y - i * 4);
    await page.mouse.up();
    await expect(peel(page)).toHaveCount(0);
    await expect(page.locator(NUM)).toHaveText("8");
  });

  // The reader's turn style carries into the peel: the skeleton curl's flap
  // shows grey lines where words will be; the shadow lift has no flap at all,
  // only a shadow where the corner comes up. Neither moves a drawn letter.
  for (const [style, flap, lines] of [
    ["curl", 1, true],
    ["lift", 0, false],
  ] as const) {
    test(`under the ${style} turn style the lifted corner follows it`, async ({ page }) => {
      await page.addInitScript(
        ([k, v]) => localStorage.setItem(k, v),
        [TURN_STYLE_KEY, style] as const,
      );
      await openAt8(page);
      const rail = await railBox(page, "left");
      const y = rail.y + rail.height * 0.15;
      await page.mouse.move(rail.x + 6, y);
      await page.mouse.down();
      for (let i = 1; i <= 5; i += 1) await page.mouse.move(rail.x + 6 + i * 40, y + i * 4);

      await expect(peel(page)).toHaveAttribute("data-style", style);
      await expect(peel(page).getByTestId("edge-peel-flap")).toHaveCount(flap);
      await expect(peel(page).getByTestId("edge-peel-back")).toBeHidden();
      expect(await peel(page).locator("[data-skeleton] i").count() > 0).toBe(lines);
      await page.mouse.up();
      await expect(page.locator(NUM)).toHaveText("9");
    });
  }

  test("a reader who asked for less motion gets the turn and no peel", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openAt8(page);

    const rail = await railBox(page, "left");
    const y = rail.y + rail.height * 0.2;
    await page.mouse.move(rail.x + 6, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i += 1) await page.mouse.move(rail.x + 6 + i * 45, y);
    await expect(peel(page)).toHaveCount(0);
    await page.mouse.up();
    await expect(page.locator(NUM)).toHaveText("9");
  });
});
