import { test, expect, type Locator } from "@playwright/test";

/*
 * The running heads: the page says where it is, the way a printed mus'haf does.
 *
 * Owner, 2026-09-30, from another reader's screenshots: the surah's name in the
 * top-left corner, the juz in the top-right, the page number at the foot. They
 * are printed on the paper — in a band above and below the text, never over it —
 * so they turn, slide and magnify with the page instead of floating on the glass.
 *
 * The band moves the text down the leaf, so everything that places a verse on
 * the screen has to allow for it. That is proved where it can be proved exactly:
 * the arithmetic in `packages/core/src/view.test.ts` ("the text's offset inside
 * the leaf"), and, end to end, the share tray's row that holds a verse's last
 * line clear of the tray to the pixel (`share-sheet.spec.ts`).
 */

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(l: Locator): Promise<Box> {
  const b = await l.boundingBox();
  expect(b, "element has no box").not.toBeNull();
  return b!;
}

test.describe("Hifth · the page says where it is", () => {
  test.beforeEach(async ({ page }) => {
    // The install notice takes a strip off the stage; nothing here is about it.
    await page.addInitScript(() => {
      try {
        localStorage.setItem("hifth.notice.install-ios", "1");
      } catch {
        /* private window: the notice shows, and the rows still hold */
      }
    });
  });

  test("surah top-left, juz top-right, page number at the foot, on the paper", async ({ page }) => {
    await page.goto("/?lang=en#/hafs-kfqc/p26");
    const leaf = page.locator('[data-host-page="26"]');
    const svg = leaf.locator("svg[role='group']");
    await expect(svg).toBeVisible();

    const surah = leaf.locator("[data-running-head='surah']");
    const juz = leaf.locator("[data-running-head='juz']");
    const folio = leaf.locator("[data-running-head='page']");
    await expect(surah).toHaveText("Al-Baqarah");
    await expect(juz).toHaveText("Juz 2");
    await expect(folio).toHaveText("26");

    const l = await boxOf(leaf);
    const t = await boxOf(svg);
    const s = await boxOf(surah);
    const j = await boxOf(juz);
    const f = await boxOf(folio);
    const mid = t.x + t.width / 2;

    // Above the text and below it, never over it.
    expect(s.y + s.height, "the surah's name overlaps the text").toBeLessThanOrEqual(t.y + 0.5);
    expect(j.y + j.height, "the juz overlaps the text").toBeLessThanOrEqual(t.y + 0.5);
    expect(f.y, "the page number overlaps the text").toBeGreaterThanOrEqual(t.y + t.height - 0.5);
    // On the paper: inside the leaf's own edges.
    for (const [name, b] of [["surah", s], ["juz", j], ["page", f]] as const) {
      expect(b.y, `${name} is above the leaf`).toBeGreaterThanOrEqual(l.y);
      expect(b.y + b.height, `${name} is below the leaf`).toBeLessThanOrEqual(l.y + l.height);
    }
    // The corners, and the middle of the foot.
    expect(s.x + s.width, "the surah's name is not on the left").toBeLessThan(mid);
    expect(j.x, "the juz is not on the right").toBeGreaterThan(mid);
    expect(Math.abs(f.x + f.width / 2 - mid), "the page number is not centred").toBeLessThan(2);
  });

  test("in Arabic, with Arabic digits", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p26");
    const leaf = page.locator('[data-host-page="26"]');
    await expect(leaf.locator("[data-running-head='surah']")).toHaveText("البقرة");
    await expect(leaf.locator("[data-running-head='juz']")).toHaveText("الجزء ٢");
    await expect(leaf.locator("[data-running-head='page']")).toHaveText("٢٦");
  });

  test("the surah is the one the page opens in", async ({ page }) => {
    // Page 50 opens on the first verse of Al-Imran; the one before it ends
    // Al-Baqarah. Juz 3 runs across both.
    await page.goto("/?lang=en#/hafs-kfqc/p50");
    const leaf = page.locator('[data-host-page="50"]');
    await expect(leaf.locator("[data-running-head='surah']")).toHaveText("Ali 'Imran");
    await expect(leaf.locator("[data-running-head='juz']")).toHaveText("Juz 3");
  });
});
