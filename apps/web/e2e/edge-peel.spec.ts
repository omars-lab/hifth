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
    // Near the head, just below the bookmark corner, which the fold keeps (#201).
    const y = rail.y + 56;
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

  // Owner, 2026-09-28 (Firefox): "transition into new pages is weird with
  // arrows". The arrow turn swapped the right page first, cross-faded it, and
  // for a moment showed the new right page beside the old left one. An arrow on
  // an open book now plays the same peel a hand does: every frame shows the old
  // opening, the leaf going over, or the new opening — never half of each.
  test("an arrow turn goes over like a hand's and never shows a mismatched pair", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(pageSvg(page, 8)).toBeVisible();
    await expect(pageSvg(page, 7)).toBeVisible();
    await page.evaluate(() => {
      const w = window as unknown as { __frames: string[]; __out: number[] };
      w.__frames = [];
      w.__out = [];
      const t0 = performance.now();
      const tick = () => {
        const drawn = [...document.querySelectorAll('[data-testid="page-book"] svg[aria-labelledby^="page-label-"]')]
          .filter((e) => e.getBoundingClientRect().width > 0 && e.querySelector("path"))
          .map((e) => Number(e.getAttribute("aria-labelledby")!.slice("page-label-".length)))
          .sort((a, b) => a - b)
          .join(",");
        const peeled = document.querySelector('[data-testid="edge-peel"]') ? "peel" : "flat";
        w.__frames.push(`${peeled} ${drawn}`);
        // How far the visible flap stands outside the paper: its clip outline,
        // carried through its transform (origin 0 0), against the peel layer,
        // which is the paper's own box.
        const layer = document.querySelector<HTMLElement>('[data-testid="edge-peel"]');
        const flap = document.querySelector<HTMLElement>('[data-testid="edge-peel-flap"]');
        if (layer && flap) {
          const m = (flap.style.transform.match(/-?[\d.]+/g) ?? []).map(Number);
          const pts = (flap.style.clipPath.match(/-?[\d.]+px -?[\d.]+px/g) ?? []).map((q) => q.split(" ").map(parseFloat));
          const ys = pts.map(([x, y]) => m[1]! * x! + m[3]! * y! + m[5]!);
          w.__out.push(Math.max(0, -Math.min(...ys), Math.max(...ys) - layer.clientHeight));
        }
        if (performance.now() - t0 < 2500) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(NUM)).toHaveText("9");
    await expect(pageSvg(page, 10)).toBeVisible();
    await page.waitForTimeout(2600);

    const frames = await page.evaluate(() => (window as unknown as { __frames: string[] }).__frames);
    const bad = frames.filter((f) => f.startsWith("flat") && f !== "flat 7,8" && f !== "flat 9,10");
    expect(bad, "a frame showed half of one opening and half of the other").toEqual([]);
    expect(frames.some((f) => f.startsWith("peel")), "the leaf never went over").toBe(true);
    // And, as the owner asked of the hand's corner (#198), the leaf never stands
    // above or below the paper on its way over.
    const out = await page.evaluate(() => (window as unknown as { __out: number[] }).__out);
    expect(out.length, "the flap was never measured").toBeGreaterThan(3);
    expect(Math.max(...out), "the turning leaf stood outside the paper").toBeLessThan(1);
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

// The bookmark corner lives on the same free corner the hand lifts, so it is
// held still here, where the open book on a computer (and Firefox) is tested.
test.describe("Hifth · the folded bookmark corner on the open book", () => {
  test.use({ locale: "en-US" });

  // Owner, Firefox, p7 (#201): the folded corner was laid across the strip of
  // page edges beside the paper, and the paper's corner was cut away to the
  // desk, so a flap stood outside the page with the edges running up past it.
  // A fold turns down the top leaf only: the flap lies on the paper, and the
  // pages beneath it — their edge strip included — stay whole.
  test("a folded corner lies on the paper, and the page edges beside it stay whole", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p7");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    await page.getByRole("button", { name: "Drop a bookmark on this page" }).first().click();
    const drawer = page.getByRole("dialog", { name: "Bookmark" });
    await drawer.getByRole("button", { name: "Save name" }).click();
    await expect(drawer).toBeHidden();
    const unfold = page.getByRole("button", { name: /Unfold this corner/ });
    await expect(unfold).toHaveAttribute("data-folded", "");
    await page.mouse.move(5, 5);
    await page.waitForTimeout(400); // the fold opens with a short ease

    const m = await unfold.evaluate((btn) => {
      const flap = btn.querySelector("span > span") as HTMLElement;
      const f = flap.getBoundingClientRect();
      // The leaf this corner belongs to: the visible page whose top corner it sits on.
      const hosts = [...document.querySelectorAll<HTMLElement>("[data-leaf]")].filter(
        (h) => h.getBoundingClientRect().width > 0 && getComputedStyle(h).visibility !== "hidden",
      );
      const host = hosts
        .map((h) => ({ h, r: h.getBoundingClientRect() }))
        .sort((a, b) => Math.abs(a.r.top - f.top) + Math.min(Math.abs(a.r.right - f.right), Math.abs(a.r.left - f.left))
          - (Math.abs(b.r.top - f.top) + Math.min(Math.abs(b.r.right - f.right), Math.abs(b.r.left - f.left))))[0]!;
      const side = host.h.dataset.leaf;
      const cs = getComputedStyle(host.h);
      const z = host.r.width / host.h.offsetWidth;
      const edge = side === "right" ? parseFloat(cs.paddingRight) : parseFloat(cs.paddingLeft);
      const border = parseFloat(cs.borderTopWidth);
      const paperR = host.r.right - (edge + border) * z;
      const paperL = host.r.left + (edge + border) * z;
      // A point on the strip of page edges, below the rounded corner and level
      // with the fold: it must still belong to the leaf, not to the desk.
      const px = side === "right" ? host.r.right - (border + edge / 2) * z : host.r.left + (border + edge / 2) * z;
      const py = f.top + f.height / 2;
      const hit = document.elementsFromPoint(px, py).includes(host.h);
      // The page beneath the fold is drawn where the corner was, and the paper's
      // outer corner is rounded: nowhere may it paint past the leaf onto the desk.
      const under = btn.querySelector(":scope > span:first-child") as HTMLElement;
      const u = under.getBoundingClientRect();
      let outside = 0;
      for (let y = u.top + 0.125; y < u.bottom; y += 0.25)
        for (let x = u.left + 0.125; x < u.right; x += 0.25) {
          const at = document.elementsFromPoint(x, y);
          if (at.includes(under) && !at.includes(host.h)) outside++;
        }
      return { side, f: { l: f.left, r: f.right, w: f.width }, paperL, paperR, hit, outside };
    });
    expect(m.f.w).toBeGreaterThan(10);
    if (m.side === "right") expect(m.f.r).toBeLessThanOrEqual(m.paperR + 0.5);
    else expect(m.f.l).toBeGreaterThanOrEqual(m.paperL - 0.5);
    expect(m.hit, "the page edges beside the fold are cut away").toBe(true);
    expect(m.outside, "the page under the fold pokes past the rounded corner").toBe(0);
  });

  // Owner, Firefox (#202): with one page on the desk the ribbon hung out on the
  // desk beside the book, and zoomed in it lay across the folded corner. A
  // ribbon hangs from its own page, toward the spine, clear of the fold.
  for (const view of ["one", "two"]) {
    test(`a bookmark's ribbon hangs from its own page, clear of the folded corner (${view} page view)`, async ({ page }) => {
      await page.goto(`/#/hafs-kfqc/p6?view=${view}`);
      await expect(page.locator('svg[aria-labelledby="page-label-6"]')).toBeVisible();
      await page.getByRole("button", { name: "Drop a bookmark on this page" }).first().click();
      const drawer = page.getByRole("dialog", { name: "Bookmark" });
      await drawer.getByRole("button", { name: "Save name" }).click();
      await expect(drawer).toBeHidden();
      await page.mouse.move(5, 5);
      await page.waitForTimeout(400);
      const unfold = page.getByRole("button", { name: /Unfold this corner/ });
      const ribbon = page.getByRole("button", { name: /^Bookmark:/ });
      const r = (await ribbon.boundingBox())!;
      const f = (await unfold.boundingBox())!;
      const leaf = await unfold.evaluate((btn) => {
        const b = btn.getBoundingClientRect();
        const hosts = [...document.querySelectorAll<HTMLElement>("[data-leaf]")]
          .map((h) => h.getBoundingClientRect())
          .filter((h) => h.width > 0 && b.left >= h.left - 1 && b.right <= h.right + 1 && Math.abs(b.top - h.top) < 4);
        const h = hosts[0]!;
        return { left: h.left, right: h.right };
      });
      expect(r.x, "the ribbon hangs off the page").toBeGreaterThanOrEqual(leaf.left);
      expect(r.x + r.width, "the ribbon hangs off the page").toBeLessThanOrEqual(leaf.right);
      const apart = r.x >= f.x + f.width || r.x + r.width <= f.x;
      expect(apart, "the ribbon lies across the folded corner").toBe(true);
    });
  }

  // The same report: the page showing under the fold was the same paper as the
  // page itself, so the fold read as a flat square pasted on. The page beneath
  // sits in the flap's shadow, darker than the page, as a real dog-ear does.
  test("the page under a folded corner is shaded darker than the page", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p6?view=one");
    await expect(page.locator('svg[aria-labelledby="page-label-6"]')).toBeVisible();
    await page.getByRole("button", { name: "Drop a bookmark on this page" }).first().click();
    const drawer = page.getByRole("dialog", { name: "Bookmark" });
    await drawer.getByRole("button", { name: "Save name" }).click();
    await expect(drawer).toBeHidden();
    const unfold = page.getByRole("button", { name: /Unfold this corner/ });
    const shades = await unfold.evaluate((btn) => {
      const lum = (c: string) => {
        const [r, g, b] = c.match(/[\d.]+/g)!.map(Number);
        return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
      };
      const under = getComputedStyle(btn.querySelector(":scope > span:first-child")!).backgroundImage;
      // Every colour stop but the thin top edge line, which is darker on purpose.
      const stops = [...under.matchAll(/rgba?\([^)]*\)/g)].map((m) => m[0]);
      const b = btn.getBoundingClientRect();
      const host = [...document.querySelectorAll<HTMLElement>("[data-leaf]")].find((h) => {
        const r = h.getBoundingClientRect();
        return r.width > 0 && b.left >= r.left - 1 && b.right <= r.right + 1 && Math.abs(b.top - r.top) < 4;
      })!;
      return { paper: lum(getComputedStyle(host).backgroundColor), under: stops.map(lum) };
    });
    const brightest = Math.max(...shades.under);
    expect(brightest, "the page under the fold is as light as the page").toBeLessThan(shades.paper - 8);
  });
});
