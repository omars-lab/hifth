import { test, expect, type Locator, type Page } from "@playwright/test";

/*
 * The pitch build's held commentary — the one screen no public test can touch.
 *
 * `make e2e` builds the PUBLIC bundle, and the public bundle drops the pitch
 * layer entirely (the private code is dead-code-eliminated), so nothing in the
 * ordinary suite ever mounts the commentary sheet. This spec is the exception,
 * and it can only run where two things the public build lacks are both present:
 * the pitch bundle (VITE_PITCH=1) and the private note file, which is gitignored
 * and lives on one laptop. So it runs only under the `pitch` project, which
 * `make pitch-e2e` builds and serves; a bare `playwright test` skips it, the
 * same way `make golden` is honest about running only where its baseline is.
 *
 * What it guards, from the "no drawer on tap" report:
 *   1. Tapping a verse that HAS a Study Quran note opens the note on that tap —
 *      not on a second click of a footer button (the two-click bug).
 *   2. The note lands on the FACING leaf, opposite the verse (Option D,
 *      docs/design/ayah-drawer.md), so it never covers the verse it is about —
 *      checked on both leaves: al-Fātiḥah on the right, al-Baqarah on the left.
 *   3. The coverage is the whole Qur'an, not just al-Fātiḥah: a verse in a later
 *      surah, on the other leaf, opens its own note too.
 */

// Skip loudly rather than fail if this file is run outside `make pitch-e2e`
// (against a public build, where the sheet is not in the bundle at all).
test.skip(
  process.env.HIFTH_PITCH !== "1",
  "pitch-only: run `make pitch-e2e` (needs VITE_PITCH=1 and the private note file)",
);

const book = (page: Page): Locator => page.getByTestId("page-book");
const sheet = (page: Page): Locator => page.getByRole("dialog");

/** The visible page's SVG — the only host not `display: none` (PageStage). */
const pageSvg = (page: Page, pageNo: number): Locator =>
  page.locator(`svg[aria-labelledby="page-label-${pageNo}"]:visible`);

// An ayah polygon, scoped to the one visible copy of its leaf: several pages are
// mounted at once (PLAN §4 DOM budget), so `#verse-1` is not unique document-wide.
const verse = (page: Page, leaf: number, ordinal: number): Locator =>
  pageSvg(page, leaf).locator(`#verse-${ordinal}`);

/** Which side of the gutter a box's centre falls on. */
async function sideOf(page: Page, target: Locator): Promise<"left" | "right"> {
  const open = (await book(page).boundingBox())!;
  const box = (await target.boundingBox())!;
  return box.x + box.width / 2 < open.x + open.width / 2 ? "left" : "right";
}

// A pointer and a window whose width crosses the spread breakpoint: the note is
// a floating card here, not a phone bottom sheet, so it can land on a side.
test.use({ locale: "en-US", viewport: { width: 1440, height: 900 } });

test.describe("Hifth · the pitch build's Study Quran commentary", () => {
  test("tapping an al-Fātiḥah verse opens its note on the facing leaf", async ({ page }) => {
    // The page-1 spread, nothing selected — the demo's opening screen.
    await page.goto("/#/hafs-kfqc/p1");
    await expect(pageSvg(page, 1)).toBeVisible({ timeout: 20_000 });
    await expect(sheet(page), "no selection, so no note yet").toHaveCount(0);

    // Tap the first ayah of al-Fātiḥah (the 1st ayah overall = 1:1).
    await verse(page, 1, 1).click();

    // The note opens on this tap — the whole point of the fix.
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page)).toContainText("Study Quran");
    // al-Fātiḥah sits on the right leaf, so its note rises over the LEFT one.
    expect(await sheet(page).getAttribute("data-side")).toBe("left");
    expect(await sideOf(page, sheet(page))).toBe("left");
  });

  test("a later surah's verse opens its note on the facing leaf", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p1");
    await expect(pageSvg(page, 2)).toBeVisible({ timeout: 20_000 });
    await expect(sheet(page), "no selection, so no note yet").toHaveCount(0);

    // 2:3 is the 10th ayah overall (al-Fātiḥah's 7, then 2:1, 2:2, 2:3) and sits
    // on the left leaf. Its surah's notes load on the tap; the note then opens.
    await verse(page, 2, 10).click();

    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page)).toContainText("Study Quran");
    // A left-leaf verse raises its note over the RIGHT leaf — the other side
    // from al-Fātiḥah above, so the two tests pin both halves of Option D.
    expect(await sheet(page).getAttribute("data-side")).toBe("right");
    expect(await sideOf(page, sheet(page))).toBe("right");
  });

  test("the verse stays bright beside its note, and a tap on the next verse turns the note to it", async ({
    page,
  }) => {
    await page.goto("/#/hafs-kfqc/p1");
    await expect(pageSvg(page, 1)).toBeVisible({ timeout: 20_000 });
    await verse(page, 1, 2).click();
    await expect(page.getByRole("dialog", { name: /1:2/ })).toBeVisible();

    // No veil over the page: what sits under the next verse's middle is the page itself.
    const next = (await verse(page, 1, 3).boundingBox())!;
    const onTop = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x!, y!)?.closest("svg") !== null,
      [next.x + next.width / 2, next.y + next.height / 2],
    );
    expect(onTop, "the page, not a veil, is under the pointer").toBe(true);

    // So reading on is one tap: the note follows the verse.
    await verse(page, 1, 3).click();
    await expect(page.getByRole("dialog", { name: /1:3/ })).toBeVisible();
    await expect(sheet(page)).toHaveCount(1);
  });

  test("outside al-Fātiḥah each related verse says what is there, not one line for all", async ({ page }) => {
    // 6:153 takes The Study Quran's own cross-references, not hand-written roads.
    await page.goto("/#/hafs-kfqc/6:153");
    await expect(page.getByRole("dialog", { name: /6:153/ })).toBeVisible({ timeout: 20_000 });
    const cards = sheet(page).getByRole("button", { name: /Hop to/ });
    await expect(cards.first()).toBeVisible();
    const texts = await cards.allInnerTexts();
    expect(texts.length).toBeGreaterThan(1);
    // Each card opens the target's own translation, so no two read the same.
    expect(new Set(texts).size).toBe(texts.length);
    for (const text of texts) expect(text).not.toContain("cross-references from here");
  });

  test("a note on the right leaves the look-alike chips in sight and in reach", async ({ page }) => {
    // 2:255 sits on the left leaf, so its note lands on the right — the same
    // corner the look-alike chips live in. They used to peek out from under it.
    await page.goto("/#/hafs-kfqc/2:255");
    await expect(page.getByRole("dialog", { name: /2:255/ })).toBeVisible({ timeout: 20_000 });
    expect(await sheet(page).getAttribute("data-side")).toBe("right");

    // Measure the note at rest, not mid-way through its slide in.
    await sheet(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const note = (await sheet(page).boundingBox())!;
    const chips = page.getByRole("group").getByRole("button", { name: /Similar verses/ });
    expect(await chips.count()).toBeGreaterThan(0);
    for (const box of await chips.evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect),
    )) {
      const overlaps =
        box.left < note.x + note.width && box.right > note.x &&
        box.top < note.y + note.height && box.bottom > note.y;
      expect(overlaps, "a look-alike chip is under the note").toBe(false);
    }
  });

  test("a note ends on its words, not on the book's section-break stars", async ({ page }) => {
    // 573 notes closed with the print's "* * *" divider, copied in as text.
    await page.goto("/#/hafs-kfqc/1:1");
    await expect(sheet(page)).toContainText("Related verses", { timeout: 20_000 });
    await expect(sheet(page)).not.toContainText("* * *");
  });

  test("a related verse in the note hops there and opens its own note", async ({ page }) => {
    // 1:6 — the straight-path verse — carries The Study Quran's own
    // cross-references, folded into the note as a "Related verses" list. This is
    // the whole point of the roads-in-the-drawer choice: read and navigate on
    // one surface, no rail buried behind the scrim.
    await page.goto("/#/hafs-kfqc/1:6");
    await expect(sheet(page)).toBeVisible({ timeout: 20_000 });
    await expect(sheet(page)).toContainText("Related verses");

    // Tap the road to al-Anʿām 6:153 (a reachable, vendored page). The label is
    // the target's own ayah label, the button its "Hop to …" name.
    await sheet(page).getByRole("button", { name: /Hop to .*6:153/ }).click();

    // The hop landed and the arrived verse's own note opened in turn: the same
    // dialog now names 6:153 (App re-opens the note on the new selection).
    await expect(page.getByRole("dialog", { name: /6:153/ })).toBeVisible();
    // And it is a real note, not an empty shell — its commentary is present.
    await expect(sheet(page)).toContainText("The Study Quran");
  });
});

test.describe("Hifth · the pitch commentary on a phone", () => {
  // A phone is a single page with no facing leaf to place the note on, so the
  // note is a full-width bottom sheet, not a card pinned to one side. This is
  // the other half of the "no drawer on tap" report: the desktop tests above
  // check the side placement; this one checks the phone path opens at all and
  // does not try to take a side it has no room for.
  test.use({ viewport: { width: 390, height: 844 } });

  test("tapping a verse opens a full-width bottom sheet with no side", async ({ page }) => {
    // Deep-linking a verse selects it, which opens the note the same way a tap
    // does (the pitch build opens on selection). 2:255 is Āyat al-Kursī.
    await page.goto("/#/hafs-kfqc/2:255");
    await expect(sheet(page)).toBeVisible({ timeout: 20_000 });
    await expect(sheet(page)).toContainText("Study Quran");

    // No facing leaf on a phone, so the note takes no side: the attribute is
    // absent (App.tsx sheetSide returns null whenever it is not a desktop
    // two-page spread) and the sheet spans nearly the full window width.
    expect(await sheet(page).getAttribute("data-side")).toBeNull();
    const box = (await sheet(page).boundingBox())!;
    expect(box.width).toBeGreaterThan(390 * 0.9);

    // The verse's own number was stripped from the front of its note.
    await expect(sheet(page)).toContainText("This verse is known as");
    await expect(sheet(page)).not.toContainText("255 This verse is known as");
  });
});
