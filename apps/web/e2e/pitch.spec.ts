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

/** Wait until a thing on the page stops moving: two consecutive identical boxes. */
async function settle(target: Locator): Promise<void> {
  let last = "";
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await target.boundingBox());
        const stable = now === last;
        last = now;
        return stable;
      },
      { intervals: [100, 100, 100, 150, 200, 300], timeout: 10_000 },
    )
    .toBe(true);
}

type Box = { x: number; y: number; width: number; height: number };

/**
 * The boxes of a highlighted verse's lines, in window px, topmost first. The
 * wash is one filled band per line of the verse, so each band's own box is the
 * ink it lays down.
 */
async function litLineBoxes(page: Page): Promise<Box[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<SVGGraphicsElement>("#hifth-overlay .hl-sel")]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      })
      .sort((a, b) => a.y - b.y),
  );
}

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// A pointer and a window whose width crosses the spread breakpoint: the note is
// a floating card here, not a phone bottom sheet, so it can land on a side.
test.use({ locale: "en-US", viewport: { width: 1440, height: 900 } });

test.describe("Hifth · the pitch build's Study Quran commentary", () => {
  test("the first screen says a tap opens The Study Quran's note", async ({ page }) => {
    // The tips open only from settings, so this one line is the whole of what
    // a first visit is told. The public build's hint says only "select it",
    // which leaves a visitor to the demo not knowing the notes exist.
    await page.goto("/");
    await expect(page.getByText("Tap a verse to read its Study Quran note")).toBeVisible({ timeout: 20_000 });
  });

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

  for (const [where, hash, side] of [
    ["al-Fātiḥah, on the right leaf", "#/hafs-kfqc/1:2", "left"],
    ["Āyat al-Kursī, on the left leaf", "#/hafs-kfqc/2:255", "right"],
  ] as const) {
    test(`the note lies over the whole facing page, with no strip of cut-off words beside it: ${where}`, async ({
      page,
    }) => {
      // The card stood a fixed width in from the window's edge, so it hid most
      // of the facing page and left a strip of it showing, the words cut off
      // mid-line at the card's edge. Over the whole page, from the fold to the
      // outer edge, it reads as a page of commentary laid on the book.
      await page.goto(`/${hash}`);
      await expect(sheet(page)).toBeVisible({ timeout: 20_000 });
      expect(await sheet(page).getAttribute("data-side")).toBe(side);
      await settle(sheet(page));
      const open = (await book(page).boundingBox())!;
      const card = (await sheet(page).boundingBox())!;
      const fold = open.x + open.width / 2;
      const [inner, outer] = side === "right" ? [card.x, card.x + card.width] : [card.x + card.width, card.x];
      expect(Math.abs(inner - fold), "the card starts at the fold").toBeLessThanOrEqual(8);
      if (side === "right") expect(outer, "and reaches the page's outer edge").toBeGreaterThanOrEqual(open.x + open.width);
      else expect(outer, "and reaches the page's outer edge").toBeLessThanOrEqual(open.x);
      expect(card.y, "from the page's top").toBeLessThanOrEqual(open.y + 1);
      expect(card.y + card.height, "to its foot").toBeGreaterThanOrEqual(open.y + open.height - 1);
    });
  }

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

  test("a verse the commentary cites is a link that goes there", async ({ page }) => {
    // 6:153's note says "See also 5:15–16" in its running prose. That citation
    // is the book's own road; a tap on it goes to 5:15 and opens its note.
    await page.goto("/#/hafs-kfqc/6:153");
    const note = page.getByRole("dialog", { name: /6:153/ });
    await expect(note).toBeVisible({ timeout: 20_000 });
    const cited = page
      .getByRole("region", { name: "Commentary" })
      .getByRole("button", { name: /5:15/ });
    await expect(cited).toBeVisible();
    await cited.click();
    await expect(page.getByRole("dialog", { name: /5:15/ })).toBeVisible();

    // 5:15's note lists "2:42, 140, …" — the bare 140 is 2:140, and a link too.
    await page
      .getByRole("region", { name: "Commentary" })
      .getByRole("button", { name: /2:140\b/ })
      .click();
    await expect(page.getByRole("dialog", { name: /2:140/ })).toBeVisible();
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

test.describe("Hifth · the way back from a note on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("after following a related verse, the note offers the way back", async ({ page }) => {
    // On a phone the note covers the trail bar, so the bead that leads back was
    // out of reach until the note was closed. The note now carries it itself.
    await page.goto("/#/hafs-kfqc/1:6");
    await expect(sheet(page)).toBeVisible({ timeout: 20_000 });
    // Nothing to go back to yet: this is where the reading started.
    await expect(sheet(page).getByRole("button", { name: /^Back to/ })).toHaveCount(0);

    await sheet(page).getByRole("button", { name: /Hop to .*6:153/ }).click();
    await expect(page.getByRole("dialog", { name: /6:153/ })).toBeVisible();

    // A thumb has to be able to hit it: as tall as every other control.
    const back = sheet(page).getByRole("button", { name: /^Back to .*1:6/ });
    expect((await back.boundingBox())!.height, "the way back is smaller than a thumb").toBeGreaterThanOrEqual(44);
    await back.click();
    await expect(page.getByRole("dialog", { name: /1:6/ })).toBeVisible();
    await expect(sheet(page).getByRole("button", { name: /^Back to/ })).toHaveCount(0);
  });

  test("a note opened by a link wears no focus box", async ({ page }) => {
    // Nobody pressed a key, so there is no keyboard user to show where focus
    // went; a ring round the close button only reads as a stray box on the demo.
    await page.goto("/#/hafs-kfqc/1:6");
    await expect(sheet(page)).toBeVisible({ timeout: 20_000 });
    // What is drawn, not the browser's own flag: the focused element's outline.
    const ringed = await page.evaluate(() => {
      const el = document.activeElement;
      return el && getComputedStyle(el).outlineStyle !== "none" ? el.outerHTML.slice(0, 80) : null;
    });
    expect(ringed, "something wears a focus ring on arrival").toBeNull();
    // Focus is still inside the note, so a screen reader lands there and Tab
    // starts from it.
    expect(await sheet(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
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
    await sheet(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const box = (await sheet(page).boundingBox())!;
    expect(box.width).toBeGreaterThan(390 * 0.9);

    // It opens short, so the verse it is about stays in sight above it, bright
    // and not under a veil — it used to rise over five-sixths of the screen.
    expect(box.y, "the note opens on the lower part of the screen").toBeGreaterThan(844 * 0.5);
    const lit = page.locator("#hifth-overlay .hl-sel").first();
    const verseTop = (await lit.boundingBox())!;
    const onTop = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x!, y!)?.closest("svg") !== null,
      [verseTop.x + verseTop.width / 2, verseTop.y + verseTop.height / 2],
    );
    expect(onTop, "the verse, not a veil, is under its first line").toBe(true);

    // Reading on grows it: a scroll inside the note takes the whole screen.
    await sheet(page).hover();
    await page.mouse.wheel(0, 200);
    await expect
      .poll(async () => (await sheet(page).boundingBox())!.y, { message: "the note grows" })
      .toBeLessThan(844 * 0.3);

    // The verse's own number was stripped from the front of its note.
    await expect(sheet(page)).toContainText("This verse is known as");
    await expect(sheet(page)).not.toContainText("255 This verse is known as");
  });

  test("a look-alike list takes the note's place, and closing it brings the note back", async ({ page }) => {
    // One drawer for a verse at a time. Tapping a look-alike chip while the note
    // was open used to stack the list's sheet on top of the note's, squeezing
    // the page to a sliver with two of seven look-alikes in reach.
    await page.goto("/#/hafs-kfqc/2:255");
    const note = page.getByRole("dialog", { name: /2:255/ });
    await expect(note).toBeVisible({ timeout: 20_000 });

    await page.locator('button[data-direction="later"]').click();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(note).toBeHidden();

    await page.getByRole("dialog").getByRole("button", { name: "Close" }).first().click();
    await expect(note).toBeVisible();
  });

  test("the hop chips do not sit on the first line of the verse the note lifted", async ({ page }) => {
    // The note lifts the verse into the part of the screen still showing, and
    // used to put its first line right at the top — under the hop chips that
    // float in the top corner. The reader was shown the verse with its opening
    // words covered by the very buttons that lead away from it (native-shell ⑩).
    await page.goto("/#/hafs-kfqc/2:255");
    await expect(sheet(page)).toBeVisible({ timeout: 20_000 });
    await sheet(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const rail = page.getByRole("group", { name: "Links from this ayah" });
    await expect(rail).toBeVisible();
    // The lift is a movement, so the claim is about where it ends: wait for
    // the verse's outline to stop moving before measuring anything against it.
    const lit = page.locator("#hifth-overlay .hl-sel").first();
    await settle(lit);
    const chips = (await rail.boundingBox())!;
    const lines = await litLineBoxes(page);
    expect(lines.length).toBeGreaterThan(1);
    const covered = lines.filter((line) => overlaps(line, chips));
    expect(covered, `the chips ${JSON.stringify(chips)} sit on ${JSON.stringify(covered)}`).toEqual([]);
    // And the lift still holds: the verse's first line is above the note.
    expect(lines[0]!.y + lines[0]!.height).toBeLessThanOrEqual((await sheet(page).boundingBox())!.y);
  });

  test("a verse low on the page moves up clear of the note, every line of it", async ({ page }) => {
    // 6:157 closes page 149, so its note would open right over it. The page
    // moves up so the whole verse sits in the part of the screen still showing.
    await page.goto("/#/hafs-kfqc/6:157");
    await expect(sheet(page)).toBeVisible({ timeout: 20_000 });
    await sheet(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const noteTop = async () => (await sheet(page).boundingBox())!.y;
    // The verse's own outline on the page: 6:157 is the 946th verse (al-Fātiḥah
    // 7, al-Baqarah 286, Āl ʿImrān 200, al-Nisāʾ 176, al-Māʾidah 120, then 157).
    const lowest = async () => {
      const box = await verse(page, 149, 946).boundingBox();
      return box ? box.y + box.height : Infinity;
    };
    await expect
      .poll(async () => (await lowest()) <= (await noteTop()), {
        message: "the verse's last line is above the note",
      })
      .toBe(true);
  });
});

test.describe("Hifth · links straight into the commentary", () => {
  // Owner, 2026-09-29: another app should be able to open the note of a verse,
  // or a surah's context, from a link — the same link the native shell's
  // x-callback-url `open` composes from `verse=` and `open=`.
  test("?open=commentary opens the verse's note", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:255?open=commentary");
    await expect(page.getByRole("dialog", { name: /2:255/ })).toBeVisible({ timeout: 20_000 });
    await expect(sheet(page)).toContainText("Study Quran");
    // The introduction belongs to the opening verse; a middle verse's note does not carry it.
    await expect(sheet(page).getByRole("region", { name: "Surah introduction" })).toHaveCount(0);
  });

  test("?open=context leads the note with the surah's introduction, on any verse", async ({
    page,
  }) => {
    await page.goto("/#/hafs-kfqc/2:255?open=context");
    await expect(page.getByRole("dialog", { name: /2:255/ })).toBeVisible({ timeout: 20_000 });
    await expect(sheet(page).getByRole("region", { name: "Surah introduction" })).toBeVisible();
    // The address settles on the verse alone: the panel was a way in, not a view.
    await expect.poll(() => page.evaluate(() => location.hash)).toBe("#/hafs-kfqc/2:255");
  });

  // Every introduction ended on the opening verse's translation, which the
  // print sets under it as the surah's first line. Then 61 surahs had none at
  // all and Al-Kahf's began on "Finally,": the book's capture never read a
  // surah's first page when it sat on the right of a two-page spread, until
  // the introductions were read again one page at a time.
  for (const verse of ["7:1", "18:10", "36:1"]) {
    test(`the introduction at ${verse} is there in full and ends on its own words`, async ({ page }) => {
      await page.goto(`/#/hafs-kfqc/${verse}?open=context`);
      const intro = sheet(page).getByRole("region", { name: "Surah introduction" });
      await expect(intro).toBeVisible({ timeout: 20_000 });
      const paras = (await intro.locator("p").allTextContents()).map((p) => p.trim());
      const opening = await page.evaluate(async () => {
        const book = await (await fetch("./assets/private/study-quran/1.json")).json();
        return (book.verses["1:1"].translation as string).replace(/[.\s]+$/, "");
      });
      expect(opening.length).toBeGreaterThan(0);
      expect(paras.map((p) => p.replace(/[.\s]+$/, ""))).not.toContain(opening);
      expect(paras[0]).not.toMatch(/^…/);
      expect(paras.join(" ").length).toBeGreaterThan(1000);
    });
  }
});

test.describe("Hifth · the ⓘ beside a surah's name opens its introduction", () => {
  // Owner, 2026-10-04: the surah's context belongs next to its name, above the
  // basmala, as a badge of its own, not stacked on top of verse 1's note.
  test("the badge sits on Ya-Sin's title line and opens the introduction by itself", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p440");
    const badge = pageSvg(page, 440).getByRole("button", { name: /^Surah introduction/ });
    await expect(badge).toBeVisible({ timeout: 20_000 });
    // Above the opening verse (36:1 is the 3706th), so on the title line or the basmala's.
    const opening = (await verse(page, 440, 3706).boundingBox())!;
    const mark = (await badge.boundingBox())!;
    expect(mark.y + mark.height).toBeLessThanOrEqual(opening.y);
    await badge.click();
    const intro = sheet(page).getByRole("region", { name: "Surah introduction" });
    await expect(intro).toBeVisible();
    expect((await intro.locator("p").allTextContents()).join(" ").length).toBeGreaterThan(1000);
    // Nothing of any verse: no translation, no verse commentary.
    await expect(sheet(page).locator("blockquote")).toHaveCount(0);
    await expect(sheet(page).getByRole("region", { name: "Commentary" })).toHaveCount(0);
  });

  test("the badge answers the keyboard too", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p440");
    const badge = pageSvg(page, 440).getByRole("button", { name: /^Surah introduction/ });
    await expect(badge).toBeVisible({ timeout: 20_000 });
    await badge.focus();
    await page.keyboard.press("Enter");
    await expect(sheet(page).getByRole("region", { name: "Surah introduction" })).toBeVisible();
  });

  test("verse 1's own note no longer carries the introduction", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/36:1");
    await expect(sheet(page)).toBeVisible({ timeout: 20_000 });
    await expect(sheet(page).getByRole("region", { name: "Commentary" })).toBeVisible();
    await expect(sheet(page).getByRole("region", { name: "Surah introduction" })).toHaveCount(0);
  });

  test("a surah with no basmala, At-Tawbah, has the badge too", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p187");
    const badge = pageSvg(page, 187).getByRole("button", { name: /^Surah introduction/ });
    await expect(badge).toBeVisible({ timeout: 20_000 });
    const opening = (await verse(page, 187, 1236).boundingBox())!;
    const mark = (await badge.boundingBox())!;
    expect(mark.y + mark.height).toBeLessThanOrEqual(opening.y);
  });

  // The first two pages draw no line for the surah's name, so the badge was
  // missing from both; it now sits beside the basmala there.
  for (const [p, surah] of [[1, "Al-Fatihah"], [2, "Al-Baqarah"]] as const) {
    test(`page ${p} has the badge though its print draws no name line, and it opens ${surah}`, async ({ page }) => {
      await page.goto(`/#/hafs-kfqc/p${p}`);
      const badge = pageSvg(page, p).getByRole("button", { name: /^Surah introduction/ });
      await expect(badge).toBeVisible({ timeout: 20_000 });
      await badge.click();
      await expect(sheet(page).getByRole("region", { name: "Surah introduction" })).toBeVisible();
      await expect(sheet(page)).toContainText(surah);
    });
  }
});

test.describe("Hifth · the commentary drawer with the app in Arabic", () => {
  // The drawer was pinned left to right and spoke only English. In Arabic its
  // own words and layout now follow the app, while The Study Quran's English
  // stays left to right inside it.
  test.use({ locale: "ar" });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("hifth.lang.v1", "ar"));
  });

  test("the drawer is laid out right to left and speaks Arabic; the book's English still reads left to right", async ({
    page,
  }) => {
    await page.goto("/#/hafs-kfqc/2:255?open=commentary");
    const note = sheet(page);
    await expect(note).toBeVisible({ timeout: 20_000 });
    await expect(note).toHaveAccessibleName(/^تفسير /);
    expect(await note.evaluate((el) => getComputedStyle(el).direction)).toBe("rtl");

    // Its own controls are laid out from the right: close sits at the left end.
    const close = (await note.getByRole("button", { name: "إغلاق" }).boundingBox())!;
    const title = (await note.getByRole("heading", { level: 2 }).boundingBox())!;
    expect(close.x).toBeLessThan(title.x);

    // The book's words: English, left to right, starting at the left edge.
    const prose = note.getByRole("region", { name: "التفسير" });
    await expect(prose).toHaveAttribute("lang", "en");
    expect(await prose.evaluate((el) => getComputedStyle(el).direction)).toBe("ltr");
    // Where the first line's words actually start, not the paragraph's box
    // (which spans the column either way).
    const gap = await prose.locator("p").first().evaluate((p) => {
      const range = document.createRange();
      range.selectNodeContents(p);
      return range.getClientRects()[0]!.left - p.getBoundingClientRect().left;
    });
    expect(gap).toBeLessThan(2);
    await page.screenshot({ path: test.info().outputPath("drawer-ar.png") });
  });
});
