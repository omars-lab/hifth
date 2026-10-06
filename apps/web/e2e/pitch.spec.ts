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

  for (const screen of [
    { name: "a laptop", width: 1440, height: 900 },
    { name: "an iPad on its side", width: 1366, height: 1024 },
  ]) {
    test(`a note opened from the facing page leaves its look-alike chips in sight on ${screen.name}`, async ({
      browser,
    }) => {
      // The chips stood beside the page the reader was on, not beside the
      // verse they are about. Tapping a verse on the facing page laid its note
      // over the page the chips stood beside, and the card, a little wider than
      // the page, reached over them: on the iPad the chip was half hidden.
      const context = await browser.newContext({ viewport: { width: screen.width, height: screen.height } });
      await context.addInitScript(() => localStorage.setItem("hifth.coach.v1", "1"));
      const page = await context.newPage();
      await page.goto("/#/hafs-kfqc/p440");
      await expect(pageSvg(page, 439)).toBeVisible({ timeout: 20_000 });
      // 35:40 is the 3700th verse, on page 439, the right-hand page; it has a
      // look-alike, so a chip comes up for it.
      await verse(page, 439, 3700).click();
      await expect(sheet(page)).toBeVisible();
      expect(await sheet(page).getAttribute("data-side")).toBe("left");
      const chip = page.getByRole("group", { name: "Links from this ayah" }).getByRole("button").first();
      await expect(chip).toBeVisible();
      await settle(sheet(page));
      await settle(chip);
      const card = (await sheet(page).boundingBox())!;
      const pill = (await chip.boundingBox())!;
      expect(overlaps(card, pill), "the note covers the look-alike chip").toBe(false);
      expect(await sideOf(page, chip), "the chip stands by its verse's page").toBe("right");
      await context.close();
    });
  }

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

  test("the arrow keys still turn the page while a note sits beside it", async ({ page }) => {
    // The note card beside the spread leaves the page usable — no veil, verses
    // still tap — but the keyboard took any open panel for one that owns the
    // keys, so the arrows did nothing until the note was closed.
    await page.goto("/#/hafs-kfqc/2:255");
    await expect(sheet(page)).toBeVisible({ timeout: 20_000 });
    await expect(sheet(page)).toHaveAttribute("aria-modal", "false");
    await expect(pageSvg(page, 42)).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(pageSvg(page, 42), "the next opening replaced page 42").toHaveCount(0);
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

  test("the similar-verse buttons hold only look-alikes; the book's cross-references stay in the note", async ({
    page,
  }) => {
    // 2:48 reads almost word for word like 2:122 and 2:123; the book also
    // cross-references it to 2:255 and 2:184 by meaning, and to 82:19, which
    // the app already links with its own line.
    await page.goto("/#/hafs-kfqc/2:48");
    await expect(page.getByRole("dialog", { name: /2:48/ })).toBeVisible({ timeout: 20_000 });
    const roads = sheet(page).getByRole("button", { name: /Hop to/ });
    await expect(roads.first()).toBeVisible();
    const names = await roads.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
    expect(names.some((n) => /2:255\b/.test(n)), "the book's cross-reference is in the note").toBe(true);
    expect(names.filter((n) => /82:19\b/.test(n)), "82:19 is listed once").toHaveLength(1);

    await page.locator('button[data-direction="loop"]').click();
    const list = page.getByRole("dialog", { name: /this surah/i });
    await expect(list).toBeVisible();
    const rows = await list.getByRole("listitem").allInnerTexts();
    expect(rows.join(" | ")).toMatch(/2:122/);
    expect(rows.join(" | ")).toMatch(/2:123/);
    expect(rows.join(" | ")).not.toMatch(/2:255|2:184/);
  });

  test("a note on the right leaves the look-alike chips in sight and in reach", async ({ page }) => {
    // 2:49 sits on the left leaf, so its note lands on the right — the same
    // side the look-alike chips live on. They used to peek out from under it.
    await page.goto("/#/hafs-kfqc/2:49");
    await expect(page.getByRole("dialog", { name: /2:49/ })).toBeVisible({ timeout: 20_000 });
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

  test("in English the drawer reads left to right, though it lies on the right-to-left page", async ({ page }) => {
    // It inherited the mus'haf's direction, so the line under the credit read
    // ".Shown privately, …" — its full stop in front — and sat against the
    // right edge, and the close button sat at the left end.
    await page.goto("/#/hafs-kfqc/2:255?open=commentary");
    const note = sheet(page);
    await expect(note).toBeVisible({ timeout: 20_000 });
    expect(await note.evaluate((el) => getComputedStyle(el).direction)).toBe("ltr");

    const close = (await note.getByRole("button", { name: "Close" }).boundingBox())!;
    const title = (await note.getByRole("heading", { level: 2 }).boundingBox())!;
    expect(close.x).toBeGreaterThan(title.x);

    const line = note.locator("footer").getByText("Shown privately", { exact: false });
    const gap = await line.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getClientRects()[0]!.left - el.getBoundingClientRect().left;
    });
    expect(gap).toBeLessThan(2);
  });

  test("with one page showing, a note in the corner beside it leaves the page where it was", async ({ page }) => {
    // The note reported itself as covering the foot of the window whenever it
    // was not on a facing leaf, so the page slid up about 300px under the
    // toolbar to clear a card that sat well off to its side.
    await page.goto("/#/hafs-kfqc/p42");
    await expect(pageSvg(page, 42)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("radio", { name: "One page" }).click();
    await expect.poll(() => book(page).getAttribute("data-solo")).toBe("true");
    const paper = page.locator('[data-live="true"] [data-host-page]:visible');
    await settle(paper);
    const before = (await paper.boundingBox())!;

    // A tap, not a link: a link frames its verse magnified, which moves the
    // page for its own reason.
    await verse(page, 42, 263).click();
    await expect(sheet(page)).toBeVisible();
    await settle(sheet(page));
    const card = (await sheet(page).boundingBox())!;
    expect(card.x).toBeGreaterThan(before.x + before.width);
    await settle(paper);
    const after = (await paper.boundingBox())!;
    expect(Math.abs(after.y - before.y)).toBeLessThan(2);
  });

  for (const screen of [
    { name: "a laptop", width: 1440, height: 900 },
    { name: "an iPad held upright", width: 1024, height: 1366 },
  ]) {
    test(`with one page showing on ${screen.name}, the note ends above the page bar`, async ({ browser }) => {
      // The corner card stood a fixed gap off the window's foot, so with one
      // page open it ran down over the full-screen button, the verse's chip and
      // the page bar: the reader could not move to another page without
      // closing the note first.
      const context = await browser.newContext({ viewport: { width: screen.width, height: screen.height } });
      await context.addInitScript(() => localStorage.setItem("hifth.coach.v1", "1"));
      const page = await context.newPage();
      await page.goto("/#/hafs-kfqc/36:12?view=one");
      await expect(sheet(page)).toBeVisible({ timeout: 20_000 });
      await expect.poll(() => book(page).getAttribute("data-solo")).toBe("true");
      await settle(sheet(page));
      const card = (await sheet(page).boundingBox())!;
      const full = (await page.getByRole("button", { name: "Full screen" }).boundingBox())!;
      const bar = (await page.getByRole("navigation", { name: "Page bar" }).boundingBox())!;
      expect(card.y + card.height).toBeLessThanOrEqual(full.y);
      expect(card.y + card.height).toBeLessThanOrEqual(bar.y);
      // And it is still a card worth reading, not squeezed to a strip.
      expect(card.height).toBeGreaterThan(screen.height / 4);
      // Standing higher, it must still leave the verse it is about in sight.
      await settle(page.locator('[data-live="true"] [data-host-page]:visible'));
      const lines = await litLineBoxes(page);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) expect(overlaps(line, card)).toBe(false);
      await context.close();
    });
  }

  test("an iPad held upright opens on one page, and turned on its side opens the book", async ({ browser }) => {
    // Upright, two pages side by side were each half the screen wide, with
    // empty space above and below: the mus'haf read small on the very screen
    // it is shown on. One page upright and two on its side is what a reader
    // of a printed mus'haf on an iPad expects.
    const context = await browser.newContext({ viewport: { width: 1024, height: 1366 }, hasTouch: true });
    await context.addInitScript(() => localStorage.setItem("hifth.coach.v1", "1"));
    const page = await context.newPage();
    await page.goto("/#/hafs-kfqc/p440");
    await expect(pageSvg(page, 440)).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => book(page).getAttribute("data-solo")).toBe("true");
    await expect(page.getByRole("radio", { name: "One page" })).toBeChecked();

    await page.setViewportSize({ width: 1366, height: 1024 });
    await expect.poll(() => book(page).getAttribute("data-solo")).toBeNull();
    await expect(page.getByRole("radio", { name: "Two pages" })).toBeChecked();
    await context.close();
  });

  test("once the reader picks two pages upright, turning the iPad does not undo it", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1024, height: 1366 }, hasTouch: true });
    await context.addInitScript(() => localStorage.setItem("hifth.coach.v1", "1"));
    const page = await context.newPage();
    await page.goto("/#/hafs-kfqc/p440");
    await expect.poll(() => book(page).getAttribute("data-solo"), { timeout: 20_000 }).toBe("true");
    await page.getByRole("radio", { name: "Two pages" }).click();
    await expect.poll(() => book(page).getAttribute("data-solo")).toBeNull();

    await page.setViewportSize({ width: 1366, height: 1024 });
    await page.setViewportSize({ width: 1024, height: 1366 });
    await page.waitForTimeout(300);
    expect(await book(page).getAttribute("data-solo")).toBeNull();
    await context.close();
  });

  test("switching to one page with a note open leaves the page where it was", async ({ page }) => {
    // The note on the facing leaf moves to the corner card when the book closes
    // to one page. It worked out what it covered at once, while the book was
    // still two pages wide, and never looked again, so the page stayed slid up
    // under the toolbar for a card that sat off to its side. 2:28 sits near
    // the foot of its page, where a note claiming the foot lifts it.
    await page.goto("/#/hafs-kfqc/2:28");
    await expect(sheet(page)).toBeVisible({ timeout: 20_000 });
    await settle(sheet(page));
    await page.getByRole("radio", { name: "One page" }).click();
    await expect.poll(() => book(page).getAttribute("data-solo")).toBe("true");
    const paper = page.locator('[data-live="true"] [data-host-page]:visible');
    await settle(sheet(page));
    await settle(paper);
    const open = (await paper.boundingBox())!;

    await sheet(page).getByRole("button", { name: "Close" }).click();
    await expect(sheet(page)).toHaveCount(0);
    await settle(paper);
    const closed = (await paper.boundingBox())!;
    expect(Math.abs(open.y - closed.y)).toBeLessThan(2);
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

  test("a related verse's note starts at its top, not where the last one was scrolled to", async ({ page }) => {
    // The list of related verses sits at the foot of a note, so reaching it
    // scrolls the note down. Following one turned the note to the new verse
    // but left it scrolled down, so the reader landed in the middle of a note
    // they had not started.
    await page.goto("/#/hafs-kfqc/2:258");
    await expect(sheet(page)).toContainText("Related verses", { timeout: 20_000 });
    await sheet(page).getByRole("button", { name: /Hop to .*2:28/ }).click();
    await expect(page.getByRole("dialog", { name: /2:28/ })).toBeVisible();
    await expect.poll(() => sheet(page).evaluate((el) => el.scrollTop)).toBe(0);
  });

  for (const [where, pageNo, key] of [
    // A tall word from the line above made 2:41 look as if it had no room left
    // for its number, so it got no button at all.
    ["2:41, under a tall word from the line above", 7, "2:41"],
    // Under a surah's opening the verse outlines split the number down its middle.
    ["3:1, whose number the outlines split in two", 50, "3:1"],
  ] as const) {
    test(`every printed verse number has its button, on the number: ${where}`, async ({ page }) => {
      await page.goto(`/#/hafs-kfqc/p${pageNo}`);
      const svg = pageSvg(page, pageNo);
      const mark = svg.locator(`[data-verse-number][data-verse-key="quran/hafs-kfqc/${key}"]`);
      await expect(mark).toHaveCount(1, { timeout: 20_000 });
      // The printed number nearest the button, in the page's own units, must
      // hold the button's centre on screen.
      const onNumber = await mark.evaluate((el) => {
        const svgEl = (el as SVGGraphicsElement).ownerSVGElement!;
        const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(el.getAttribute("transform") ?? "");
        if (!m) return "no position";
        const [cx, cy] = [Number(m[1]), Number(m[2])];
        let best: Element | null = null;
        let bestD = Infinity;
        for (const g of svgEl.querySelectorAll("g")) {
          const x = g.getAttribute("ayah:x");
          const y = g.getAttribute("ayah:y");
          if (x === null || y === null) continue;
          const d = Math.hypot(Number(x) - cx, Number(y) - cy);
          if (d < bestD) [best, bestD] = [g, d];
        }
        if (!best) return "no printed numbers";
        const printed = best.getBoundingClientRect();
        const button = el.getBoundingClientRect();
        const [bx, by] = [button.x + button.width / 2, button.y + button.height / 2];
        return bx >= printed.left && bx <= printed.right && by >= printed.top && by <= printed.bottom
          ? "on"
          : `off by ${bestD.toFixed(1)} units`;
      });
      expect(onNumber).toBe("on");
    });
  }
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

  test("the way back has a space between its arrow and its words", async ({ page }) => {
    // The space after the arrow was a trailing space inside the button's own
    // row, which the row drops, so the arrow sat glued to the first word.
    await page.goto("/#/hafs-kfqc/1:6");
    await expect(sheet(page)).toBeVisible({ timeout: 20_000 });
    await sheet(page).getByRole("button", { name: /Hop to .*6:153/ }).click();
    const back = sheet(page).getByRole("button", { name: /^Back to .*1:6/ });
    await expect(back).toBeVisible();
    const gap = await back.evaluate((el) => {
      const arrow = el.querySelector("[aria-hidden]")!.getBoundingClientRect();
      const words = document.createRange();
      words.selectNodeContents(el.lastChild!);
      return words.getClientRects()[0]!.left - arrow.right;
    });
    expect(gap).toBeGreaterThanOrEqual(3);
  });

  test("in Arabic the way back's arrow bends the way the line reads, clear of its words", async ({ page }) => {
    // The arrow was one glyph for both languages, so in Arabic it pointed
    // away from the start of the line it sat at, and was glued to it there too.
    await page.goto("/?lang=ar#/hafs-kfqc/1:6");
    await expect(sheet(page)).toBeVisible({ timeout: 20_000 });
    await sheet(page).getByRole("button", { name: /^انتقل إلى .*(6:153|٦:١٥٣)/ }).click();
    const back = sheet(page).getByRole("button", { name: /^ارجع إلى / });
    await expect(back).toBeVisible();
    await expect(back.locator("[aria-hidden]")).toHaveText("↪");
    const gap = await back.evaluate((el) => {
      const arrow = el.querySelector("[aria-hidden]")!.getBoundingClientRect();
      const words = document.createRange();
      words.selectNodeContents(el.lastChild!);
      return arrow.left - words.getClientRects()[0]!.right;
    });
    expect(gap).toBeGreaterThanOrEqual(3);
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

  test("an iPhone's first screen opens on the page, not on an install notice", async ({ browser }) => {
    // Safari on an iPhone was told to install the app before anything else: a
    // strip a fifth of the screen tall, about storage a demo never needs, on
    // the screen a visitor first judges the demo by. The iPhone browser id is
    // what makes the app take the visitor for an iPhone.
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    });
    // The first-visit tips are put away, as they are after the first visit:
    // while they are up the notice waits its turn anyway.
    await context.addInitScript(() => localStorage.setItem("hifth.coach.v1", "1"));
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByText("Tap a verse to read its Study Quran note")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Install Hifth so it stays with you offline")).toHaveCount(0);
    await context.close();
  });

  test("the first screen's hint does not leave one word alone on its second line", async ({ page }) => {
    // At a phone's width the line wrapped after "Study Quran", leaving "note"
    // by itself under it — the first thing a visitor reads looked unfinished.
    await page.goto("/");
    const hint = page.getByText("Tap a verse to read its Study Quran note");
    await expect(hint).toBeVisible({ timeout: 20_000 });
    const widths = await hint.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const rows = new Map<number, number>();
      for (const r of range.getClientRects()) {
        const top = Math.round(r.top);
        rows.set(top, (rows.get(top) ?? 0) + r.width);
      }
      return [...rows.values()];
    });
    if (widths.length > 1) {
      expect(Math.min(...widths), `line widths ${widths.map(Math.round).join(", ")}`).toBeGreaterThan(
        Math.max(...widths) * 0.5,
      );
    }
  });

  test("deep in a long note, its title and close button stay at the top", async ({ page }) => {
    // The whole sheet scrolled as one, so the handle, the book's name with the
    // verse, and the close button went up with the first lines of the note.
    await page.goto("/#/hafs-kfqc/2:255");
    await expect(sheet(page)).toBeVisible({ timeout: 20_000 });
    await sheet(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    await sheet(page).evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect(sheet(page)).toHaveAttribute("data-tall", "true");
    await sheet(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    await page.waitForTimeout(400);
    await sheet(page).evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    expect(await sheet(page).evaluate((el) => el.scrollTop), "the note scrolled").toBeGreaterThan(500);
    const box = (await sheet(page).boundingBox())!;
    for (const [what, target] of [
      ["the close button", sheet(page).getByRole("button", { name: "Close" })],
      ["the verse's name", sheet(page).getByText("2:255").first()],
      ["the handle", sheet(page).getByRole("button", { name: /^Show less/ })],
    ] as const) {
      const at = (await target.boundingBox())!;
      expect(at.y, `${what} is still inside the sheet`).toBeGreaterThanOrEqual(box.y - 1);
      // And on top, not under the note's text: it is what a tap there reaches.
      const hit = await page.evaluate(
        ([x, y]) => document.elementFromPoint(x!, y!)?.closest("header, button") !== null,
        [at.x + at.width / 2, at.y + at.height / 2],
      );
      expect(hit, `${what} is not covered by the note's text`).toBe(true);
    }
  });

  test("with the note open, a verse's number opens its menu clear of the verse", async ({ page }) => {
    // Pressing the number closes the note, so the page drops back down from
    // where it had been lifted to sit above the note. The menu was placed
    // before the drop and stayed where the page had been: on the verse.
    await page.goto("/#/hafs-kfqc/2:255");
    await expect(sheet(page)).toBeVisible({ timeout: 20_000 });
    await sheet(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const number = pageSvg(page, 42).locator('[data-verse-number][data-verse-key="quran/hafs-kfqc/2:255"]');
    await settle(number);
    const at = (await number.boundingBox())!;
    await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
    const menu = page.getByRole("menu", { name: /2:255/ });
    await expect(menu).toBeVisible();
    await settle(verse(page, 42, 262));
    await settle(menu);
    const menuBox = (await menu.boundingBox())!;
    const verseBox = (await verse(page, 42, 262).boundingBox())!;
    expect(overlaps(menuBox, verseBox), `menu ${JSON.stringify(menuBox)} verse ${JSON.stringify(verseBox)}`).toBe(
      false,
    );
  });

  for (const pick of [
    { key: "2:255", page: 42, item: /^Same roots/ },
    { key: "36:31", page: 442, item: /^Similar verses in later surahs/ },
  ]) {
    test(`a list picked from the number keeps its verse in sight, as the note does: ${pick.item.source}`, async ({
      page,
    }) => {
      // The note opens short and the page moves up to show the verse above it.
      // The roots and similar-verses lists rose over most of the screen behind
      // a dimmed page instead, and the verse they are about was under them.
      await page.goto(`/#/hafs-kfqc/${pick.key}`);
      await expect(sheet(page)).toBeVisible({ timeout: 20_000 });
      await sheet(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
      const number = pageSvg(page, pick.page).locator(
        `[data-verse-number][data-verse-key="quran/hafs-kfqc/${pick.key}"]`,
      );
      await settle(number);
      const at = (await number.boundingBox())!;
      await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
      const menu = page.getByRole("menu", { name: new RegExp(pick.key) });
      await settle(menu);
      await menu.getByRole("menuitem", { name: pick.item }).click();
      const list = page.getByRole("dialog");
      await expect(list).toHaveCount(1);
      await list.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
      const lit = page.locator("#hifth-overlay .hl-sel").first();
      await settle(lit);
      const box = (await list.boundingBox())!;
      expect(box.y, "the list opens on the lower part of the screen").toBeGreaterThan(844 * 0.5);
      const lines = await litLineBoxes(page);
      const first = lines[0]!;
      expect(first.y, "the verse's first line is on the screen").toBeGreaterThanOrEqual(0);
      expect(first.y + first.height, "the verse's first line is above the list").toBeLessThanOrEqual(box.y);
      const onTop = await page.evaluate(
        ([x, y]) => document.elementFromPoint(x!, y!)?.closest("svg") !== null,
        [first.x + first.width / 2, first.y + first.height / 2],
      );
      expect(onTop, "the verse, not a veil, is under its first line").toBe(true);
    });
  }

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

    // The verse's own number was stripped from the front of its note. The
    // note's opening words are read from the private book at run time, never
    // written here: the repository carries none of its text.
    const opening = await page.evaluate(async () => {
      const book = await (await fetch("./assets/private/study-quran/2.json")).json();
      const first = (book.verses["2:255"].commentary as string[])[0]!;
      return first.replace(/^\d+\s+/, "").split(/\s+/).slice(0, 4).join(" ");
    });
    expect(opening.split(" ")).toHaveLength(4);
    await expect(sheet(page)).toContainText(opening);
    await expect(sheet(page)).not.toContainText(`255 ${opening}`);
  });

  test("a look-alike list takes the note's place, and closing it brings the note back", async ({ page }) => {
    // One drawer for a verse at a time. Tapping a look-alike chip while the note
    // was open used to stack the list's sheet on top of the note's, squeezing
    // the page to a sliver with two of seven look-alikes in reach. 2:49 has
    // look-alikes in later surahs (7:141, 14:6).
    await page.goto("/#/hafs-kfqc/2:49");
    const note = page.getByRole("dialog", { name: /2:49/ });
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
    // 2:54 is a verse of several lines, mid-page, with look-alikes (so it has
    // chips) and a note that lifts it.
    await page.goto("/#/hafs-kfqc/2:54");
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

test.describe("Hifth · a surah's name opens its introduction", () => {
  // Owner, 2026-10-04: the surah's context belongs next to its name, above the
  // basmala, not stacked on top of verse 1's note; and the name itself is the
  // button, washed so it looks pressable, rather than a small ⓘ beside it.
  test("Ya-Sin's name is the button, and it opens the introduction by itself", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p440");
    const name = pageSvg(page, 440).getByRole("button", { name: /^Surah introduction/ });
    await expect(name).toBeVisible({ timeout: 20_000 });
    // The whole name, centred on the page, above the opening verse (36:1 is the 3706th).
    const leaf = (await pageSvg(page, 440).boundingBox())!;
    const opening = (await verse(page, 440, 3706).boundingBox())!;
    const box = (await name.boundingBox())!;
    expect(box.width).toBeGreaterThan(40);
    expect(Math.abs(box.x + box.width / 2 - (leaf.x + leaf.width / 2))).toBeLessThan(6);
    expect(box.y + box.height).toBeLessThanOrEqual(opening.y);
    // No ⓘ drawn on top of it.
    await expect(name.locator("text")).toHaveCount(0);
    await name.click();
    const intro = sheet(page).getByRole("region", { name: "Surah introduction" });
    await expect(intro).toBeVisible();
    expect((await intro.locator("p").allTextContents()).join(" ").length).toBeGreaterThan(1000);
    // Nothing of any verse: no translation, no verse commentary.
    await expect(sheet(page).locator("blockquote")).toHaveCount(0);
    await expect(sheet(page).getByRole("region", { name: "Commentary" })).toHaveCount(0);
  });

  test("the name answers the keyboard too", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p440");
    const name = pageSvg(page, 440).getByRole("button", { name: /^Surah introduction/ });
    await expect(name).toBeVisible({ timeout: 20_000 });
    await name.focus();
    await page.keyboard.press("Enter");
    await expect(sheet(page).getByRole("region", { name: "Surah introduction" })).toBeVisible();
  });

  test("verse 1's own note no longer carries the introduction", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/36:1");
    await expect(sheet(page)).toBeVisible({ timeout: 20_000 });
    await expect(sheet(page).getByRole("region", { name: "Commentary" })).toBeVisible();
    await expect(sheet(page).getByRole("region", { name: "Surah introduction" })).toHaveCount(0);
  });

  test("a surah with no basmala, At-Tawbah, has its name as the button too", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p187");
    const name = pageSvg(page, 187).getByRole("button", { name: /^Surah introduction/ });
    await expect(name).toBeVisible({ timeout: 20_000 });
    const opening = (await verse(page, 187, 1236).boundingBox())!;
    const box = (await name.boundingBox())!;
    expect(box.width).toBeGreaterThan(40);
    expect(box.y + box.height).toBeLessThanOrEqual(opening.y);
  });

  // The first two pages draw no line for the surah's name, so there the
  // introduction keeps a small ⓘ beside the basmala.
  for (const [p, surah] of [[1, "Al-Fatihah"], [2, "Al-Baqarah"]] as const) {
    test(`page ${p} has the ⓘ though its print draws no name line, and it opens ${surah}`, async ({ page }) => {
      await page.goto(`/#/hafs-kfqc/p${p}`);
      const badge = pageSvg(page, p).getByRole("button", { name: /^Surah introduction/ });
      await expect(badge).toBeVisible({ timeout: 20_000 });
      await badge.click();
      await expect(sheet(page).getByRole("region", { name: "Surah introduction" })).toBeVisible();
      await expect(sheet(page)).toContainText(surah);
    });
  }
});

test.describe("Hifth · a verse's number opens a menu of what to read on it", () => {
  // Owner, 2026-10-04: a tap on the verse's number picks what to read about
  // it (its note, similar verses, words from the same roots, its recitation,
  // the surah's introduction); a tap on its words still opens the note at once.
  const KEY = "quran/hafs-kfqc/36:12";
  const number = (page: Page) => pageSvg(page, 440).locator(`[data-verse-number][data-verse-key="${KEY}"]`);
  const menu = (page: Page) => page.getByRole("menu", { name: /36:12/ });
  // Pressed where a mouse would press it, not by reaching into the page: 36:12
  // ends the bottom line of a left-hand page, under the corner a reader grabs
  // to turn it, and a click there has to reach the number all the same.
  const press = async (page: Page) => {
    const b = (await number(page).boundingBox())!;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  };

  test("the number lists what there is, and the note waits to be picked", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p440");
    await expect(number(page)).toBeVisible({ timeout: 20_000 });
    await expect(number(page)).toHaveAccessibleName(/36:12/);
    // On the verse's last line, in the gap left of its last word.
    const ring = (await number(page).boundingBox())!;
    const v = (await verse(page, 440, 3717).boundingBox())!;
    expect(ring.y + ring.height / 2).toBeGreaterThan(v.y);
    expect(ring.y + ring.height / 2).toBeLessThan(v.y + v.height);
    await press(page);
    await expect(menu(page)).toBeVisible();
    const items = menu(page).getByRole("menuitem");
    const item = (name: RegExp) => menu(page).getByRole("menuitem", { name });
    await expect(item(/^Commentary/)).toContainText("Study Quran");
    // 36:12 reads like no other verse, so there is no similar-verses line:
    // the book's cross-references are in its note, not dressed as look-alikes.
    await expect(item(/^Similar verses/)).toHaveCount(0);
    await expect(item(/^Same roots/)).toHaveCount(1);
    await expect(item(/^Listen/)).toHaveCount(1);
    await expect(item(/^Surah introduction/)).toHaveCount(1);
    // Owner, 2026-10-04: every line leads with its icon, the one the app
    // already uses for the same thing in the verse's tools and its rail.
    const icon = (name: RegExp) => item(name).locator("[data-glyph]");
    await expect(icon(/^Commentary/)).toHaveText("✎");
    await expect(icon(/^Same roots/)).toHaveText("⬡");
    await expect(icon(/^Listen/)).toHaveText("▶");
    await expect(items.locator("[data-glyph]").filter({ hasText: "▶" })).toHaveCount(1);
    await expect(icon(/^Surah introduction/)).toHaveText("ⓘ");
    // The icons stand in one column, so the words line up after them.
    const iconLefts = await items.locator("[data-glyph]").evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().left)),
    );
    expect(new Set(iconLefts).size).toBe(1);
    const wordLefts = await items.locator("[data-caption]").evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().left)),
    );
    expect(new Set(wordLefts).size).toBe(1);
    // A short list standing by the number, one line under another — not a row
    // of seven stretched across the window.
    const box = (await menu(page).boundingBox())!;
    expect(box.width).toBeLessThan(420);
    const lefts = await items.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
    expect(new Set(lefts).size).toBe(1);
    expect(Math.abs(box.x + box.width / 2 - (ring.x + ring.width / 2))).toBeLessThan(box.width / 2 + 1);
    // The menu is the choice, so the note is not opened behind it.
    await expect(sheet(page).getByRole("region", { name: "Commentary" })).toHaveCount(0);
    // And the verse is now the selected one, its number washed.
    await expect(pageSvg(page, 440).locator("[data-verse-number][data-selected]")).toHaveAttribute("data-verse-key", KEY);
  });

  test("picking the note opens it, and the menu goes", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p440");
    await expect(number(page)).toBeVisible({ timeout: 20_000 });
    await press(page);
    await menu(page).getByRole("menuitem", { name: /^Commentary/ }).click();
    await expect(menu(page)).toHaveCount(0);
    await expect(sheet(page).getByRole("region", { name: "Commentary" })).toBeVisible();
  });

  // 36:31, two pages on, reads like verses both before and after it in the
  // mus'haf, so its menu has both similar-verses lines.
  const LOOKS = "quran/hafs-kfqc/36:31";
  const openLooksMenu = async (page: Page) => {
    await page.goto("/#/hafs-kfqc/p442");
    const n = pageSvg(page, 442).locator(`[data-verse-number][data-verse-key="${LOOKS}"]`);
    await expect(n).toBeVisible({ timeout: 20_000 });
    await n.focus();
    await page.keyboard.press("Enter");
    const m = page.getByRole("menu", { name: /36:31/ });
    await expect(m).toBeVisible();
    return m;
  };

  test("similar verses each have a line, with the rail's own icon", async ({ page }) => {
    const m = await openLooksMenu(page);
    const icon = (name: RegExp) => m.getByRole("menuitem", { name }).locator("[data-glyph]");
    // Similar verses wear "looks like" with a small mark for which way, the
    // same as their buttons on the page's edge: a bare arrow said where, not
    // what, and the later one was the very triangle that means listen (owner,
    // 2026-10-04).
    await expect(icon(/^Similar verses in earlier surahs/)).toHaveText("≈←");
    await expect(icon(/^Similar verses in later surahs/)).toHaveText("≈→");
  });

  test("picking similar verses opens that list, not the note", async ({ page }) => {
    const m = await openLooksMenu(page);
    await m.getByRole("menuitem", { name: /^Similar verses in later surahs/ }).click();
    await expect(page.getByRole("dialog", { name: /later/i })).toBeVisible();
    await expect(page.getByRole("region", { name: "Commentary" })).toHaveCount(0);
  });

  for (const [line, dialog] of [
    [/^Similar verses in later surahs/, /later/i],
    [/^Same roots/, /^Roots/],
  ] as const) {
    test(`what is picked from the menu lies over the facing page: ${line.source}`, async ({ page }) => {
      // The note lies over the facing page, fitted to the book. The roots and
      // similar-verses lists kept the older card in the window's corner, so on
      // a spread they ran past the book's foot and over the page slider.
      const m = await openLooksMenu(page);
      await m.getByRole("menuitem", { name: line }).click();
      const list = page.getByRole("dialog", { name: dialog });
      await expect(list).toBeVisible();
      await list.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
      const open = (await book(page).boundingBox())!;
      const box = (await list.boundingBox())!;
      expect(box.y, "its top is the book's top").toBeGreaterThanOrEqual(open.y - 1);
      expect(box.y + box.height, "its foot is the book's foot").toBeLessThanOrEqual(open.y + open.height + 1);
      // On the page across the fold from the verse, not over it.
      const n = pageSvg(page, 442).locator(`[data-verse-number][data-verse-key="${LOOKS}"]`);
      expect(await sideOf(page, list)).not.toBe(await sideOf(page, n));
    });
  }

  test("a short list stands only as tall as what it holds", async ({ page }) => {
    // Laid over the facing page, a list was stretched to the page's full
    // height whatever it held: 36:31's one later look-alike sat at the top of
    // a card as tall as the book, empty below it.
    const m = await openLooksMenu(page);
    await m.getByRole("menuitem", { name: /^Similar verses in later surahs/ }).click();
    const list = page.getByRole("dialog", { name: /later/i });
    await expect(list).toBeVisible();
    await list.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const open = (await book(page).boundingBox())!;
    expect((await list.boundingBox())!.height).toBeLessThan(open.height / 2);
  });

  test("a highlighted passage's menu stands only as tall as what it holds", async ({ page }) => {
    // The same for the menu of a passage marked by a press, a hold and a drag.
    // 36:14 to 36:16 on page 441 is a passage with no links yet, so its menu
    // is a line and two buttons.
    await page.goto("/#/hafs-kfqc/p442");
    const from = verse(page, 441, 3719);
    await expect(from).toBeVisible({ timeout: 20_000 });
    await settle(from);
    const a = (await from.boundingBox())!;
    const b = (await verse(page, 441, 3721).boundingBox())!;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
    await page.mouse.up();
    const menu = page.getByRole("dialog", { name: /36:14/ });
    await expect(menu).toBeVisible();
    await menu.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const open = (await book(page).boundingBox())!;
    const box = (await menu.boundingBox())!;
    expect(box.y, "its top is the book's top").toBeGreaterThanOrEqual(open.y - 1);
    expect(box.height).toBeLessThan(open.height / 2);
  });

  test("picking the introduction opens it", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p440");
    await expect(number(page)).toBeVisible({ timeout: 20_000 });
    await press(page);
    await menu(page).getByRole("menuitem", { name: /^Surah introduction/ }).click();
    await expect(sheet(page).getByRole("region", { name: "Surah introduction" })).toBeVisible();
  });

  test("the keyboard opens it, and Escape closes it", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p440");
    await expect(number(page)).toBeVisible({ timeout: 20_000 });
    await number(page).focus();
    await page.keyboard.press("Enter");
    await expect(menu(page)).toBeVisible();
    await expect(menu(page).getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu(page).getByRole("menuitem").nth(1)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu(page)).toHaveCount(0);
  });

  test("the menu stands clear of the whole verse, not over its first lines", async ({ page }) => {
    // 2:285 runs over three lines of page 49 and its number ends the last one,
    // so a menu placed just above the number stood on the verse's own words.
    await page.goto("/#/hafs-kfqc/p49");
    const n = pageSvg(page, 49).locator(`[data-verse-number][data-verse-key="quran/hafs-kfqc/2:285"]`);
    await expect(n).toBeVisible({ timeout: 20_000 });
    await settle(n);
    const b = (await n.boundingBox())!;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    const m = page.getByRole("menu", { name: /2:285/ });
    await expect(m).toBeVisible();
    await settle(m);
    const box = (await m.boundingBox())!;
    const v = (await verse(page, 49, 292).boundingBox())!;
    expect(overlaps(box, v), "the menu covers 2:285's own lines").toBe(false);
    // Still beside its number, not thrown across the page.
    expect(Math.abs(box.x + box.width / 2 - (b.x + b.width / 2))).toBeLessThan(box.width / 2 + 1);
  });

  test("a tap on the verse's words still opens its note straight away", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/p440");
    await expect(number(page)).toBeVisible({ timeout: 20_000 });
    await verse(page, 440, 3717).click();
    await expect(sheet(page).getByRole("region", { name: "Commentary" })).toBeVisible();
    await expect(menu(page)).toHaveCount(0);
  });
});

test.describe("Hifth · the verse's tools on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("every word under a tool is shown whole, in both languages", async ({ page }) => {
    // The pitch build puts six tools in one row on a phone, and the words under
    // them were cut short with an ellipsis: "Commentary" and "Same roots", and
    // in Arabic «الجذور نفسها» and «شارك المسار».
    for (const lang of ["en", "ar"]) {
      // Come from 2:30, so the share tool offers the trail: its longest name.
      await page.goto(`/?lang=${lang}#/hafs-kfqc/2:44?via=2:30`);
      // The link opens the book's note; the tools come back when it closes.
      await expect(sheet(page)).toBeVisible({ timeout: 20_000 });
      await page.keyboard.press("Escape");
      const tools = page.getByRole("region", { name: lang === "ar" ? "أدوات البقرة، ٢:٤٤" : "Tools for Al-Baqarah · 2:44" });
      await expect(tools).toBeVisible({ timeout: 20_000 });
      await tools.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined))));
      const cut = await tools
        .locator("span")
        .evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 0.5).map((el) => el.textContent ?? ""));
      expect(cut, `${lang}: words cut short under a tool`).toEqual([]);
      // Wider cells must still leave the whole row on the screen.
      const row = (await tools.boundingBox())!;
      const last = await tools.locator(":scope > div > :is(button, a, div)").evaluateAll((els) =>
        Math.max(...els.map((el) => el.getBoundingClientRect().right)),
      );
      expect(row.x).toBeGreaterThanOrEqual(0);
      expect(last).toBeLessThanOrEqual(390);
    }
  });
});

test.describe("Hifth · the commentary drawer with the app in Arabic", () => {
  // The drawer was pinned left to right and spoke only English. In Arabic its
  // own words and layout now follow the app, while The Study Quran's English
  // stays left to right inside it.
  test.use({ locale: "ar" });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("hifth.lang.v1", "ar"));
  });

  test("the first screen's hint is in Arabic, naming the book", async ({ page }) => {
    // It was one English sentence written straight into the screen, so an
    // Arabic visitor's whole first-visit guidance was in the wrong language.
    await page.goto("/");
    await expect(page.getByText("المس آيةً لتقرأ تعليق Study Quran عليها")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Tap a verse to read its Study Quran note")).toHaveCount(0);
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

  test("the foot of the note credits the book in English from the left, and says where it is shown in Arabic", async ({
    page,
  }) => {
    // The line about where this is shown was typed in English straight into
    // the app, so in Arabic it came out right to left with its full stop in
    // front, and the book's credit wrapped onto a ragged right edge.
    await page.goto("/#/hafs-kfqc/2:255?open=commentary");
    const foot = sheet(page).locator("footer");
    await expect(foot).toBeVisible({ timeout: 20_000 });

    const book = foot.locator('[lang="en"]');
    await expect(book).toHaveCount(1);
    expect(await book.evaluate((el) => getComputedStyle(el).direction)).toBe("ltr");
    // A line of its own, starting at the foot's left edge like the prose above it.
    const gap = await book.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getClientRects()[0]!.left - el.parentElement!.getBoundingClientRect().left;
    });
    expect(gap).toBeLessThan(2);

    // Ours: the app's own words, so Arabic, with no English left in it.
    const shown = (await foot.innerText()).replace(await book.innerText(), "").trim();
    expect(shown).toMatch(/[\u0600-\u06FF]/);
    expect(shown).not.toMatch(/[A-Za-z]/);
  });
});
