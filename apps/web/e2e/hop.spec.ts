import { test, expect } from "@playwright/test";
import { contextWithout } from "./inventory";
import { pageNumber } from "./page-number";

// Loop 2 exit criterion (PLAN §Loop 2):
//   tap 2:48 → rail → popover → hop to 2:123 cross-page → bead back, one-handed.
// 2:48 is verse-55 on page 7; 2:123 is verse-130 on page 19. Both are vendored.
test.describe("Hifth · the hop", () => {
  // Owner, 2026-10-04: a bare arrow did not read as "similar", and the later
  // one was the triangle that means listen. A chip now says "looks like" (≈)
  // and then, smaller, which way — in that order on the mus'haf's side too,
  // where the page's right-to-left would otherwise put the arrow first.
  test("a similar-verses chip reads 'looks like', then a small mark for which way", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']")).toBeVisible();
    await page.locator("#verse-55").tap();
    const chip = page.getByRole("group", { name: "روابط الآية" }).getByRole("button", { name: /متشابهات في السورة/ });
    await expect(chip).toBeVisible();
    const sign = chip.locator("[data-sign]");
    const mark = chip.locator("[data-mark]");
    await expect(sign).toHaveText("≈");
    await expect(mark).toHaveText("↻");
    const s = (await sign.boundingBox())!;
    const m = (await mark.boundingBox())!;
    expect(m.x).toBeGreaterThan(s.x);
    expect(m.height).toBeLessThan(s.height * 0.85);
    await expect(chip).not.toContainText("▶");
  });

  // On a phone the page fills the screen's width, so the page's top corner,
  // where the chips used to float, is where the first line's opening words
  // are: 2:49 opens page 8, and its first word sat under the chip. The chips
  // now stand in the strip at the top of the page, between the surah's name
  // and the juz, which holds no words at all. 6:21 has three chips, the most
  // any verse has, and sits on a left-hand page, whose paper is not centred
  // on the screen; English labels are the longer ones.
  test("on a phone the chips stand in the page's top strip, clear of the first line and both labels", async ({ page }) => {
    const cases = [["2:49", "#verse-56"], ["6:21", null]] as const;
    for (const [lang, [key, verse]] of ["ar", "en"].flatMap((l) => cases.map((c) => [l, c] as const))) {
      await page.goto(`/?lang=${lang}#/hafs-kfqc/${key}`);
      const rail = page.getByRole("group").filter({ has: page.locator("button[data-direction]") });
      await expect(rail).toBeVisible();
      // The running heads are printed once the page has drawn, which can be
      // a beat after the chips arrive, and under load the page can still be
      // redrawing as it is measured: the whole measurement is taken again
      // until the page has settled.
      await expect(async () => {
        const boxOf = async (which: string) => {
          const label = page.locator(`[data-running-head="${which}"]:visible`).first();
          await expect(label).not.toBeEmpty();
          const box = await label.boundingBox();
          expect(box, `${lang} ${key}: the ${which} label is drawn`).not.toBeNull();
          return box!;
        };
        const surah = await boxOf("surah");
        const juz = await boxOf("juz");
        const chips = rail.getByRole("button");
        expect(await chips.count()).toBeGreaterThan(verse ? 0 : 2);
        const top = verse ? (await page.locator(verse).boundingBox())!.y : Infinity;
        for (const chip of await chips.all()) {
          const box = await chip.boundingBox();
          expect(box, `${lang} ${key}: the chip is drawn`).not.toBeNull();
          expect(box!.x, `${lang} ${key}: clear of the surah's name`).toBeGreaterThanOrEqual(surah.x + surah.width);
          expect(box!.x + box!.width, `${lang} ${key}: clear of the juz`).toBeLessThanOrEqual(juz.x);
          expect(box!.y + box!.height, `${lang} ${key}: above the first line`).toBeLessThanOrEqual(top);
          // Drawn slim, still a whole thumb's worth to tap: a point 8px above
          // the pill is the chip's.
          const hit = await page.evaluate(
            ([x, y]) => document.elementFromPoint(x!, y!)?.closest("button[data-direction]") !== null,
            [box!.x + box!.width / 2, box!.y - 8],
          );
          expect(hit, `${lang} ${key}: a tap just above the pill still lands`).toBe(true);
        }
      }).toPass();
    }
  });

  // Walking the Arabic iPad app, 2026-10-09 (look-alike rows ③): the note on
  // 2:48's pair read in English, and its two-way arrow drew as a blue emoji.
  test("in the Arabic app a pair's note reads in Arabic, its arrow as plain text", async ({ page }) => {
    await page.goto("/?lang=ar");
    await expect(page.locator("svg[role='group']")).toBeVisible();
    await page.locator("#verse-55").tap();
    await page.getByRole("group", { name: "روابط الآية" }).getByRole("button", { name: /متشابهات في السورة/ }).tap();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("button", { name: /انتقل إلى البقرة، ٢:١٢٣/ })).toBeVisible();
    // Read each row whole, so the check does not lean on how a note is marked up.
    const rows = await sheet.locator("li").allTextContents();
    expect(rows.length, "the list has rows").toBeGreaterThan(0);
    for (const row of rows) {
      expect(row, "no English left in the row").not.toMatch(/[A-Za-z]/);
      // The go-to arrow on each row drew as an emoji tile too (2026-10-09).
      expect(row, "any arrow is asked for as text").not.toMatch(/[↔↪↩↗](?!\uFE0E)/u);
    }
  });

  test("tap 2:48 → rail → popover → cross-page hop to 2:123 → bead back", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']")).toBeVisible();

    // 1. Tap 2:48 on page 7.
    const ayah = page.locator("#verse-55");
    await expect(ayah).toHaveCount(1);
    await ayah.tap();
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة، ٢:٤٨/ }),
    ).toBeVisible();

    // 2. The hop rail appears with at least the same-surah loop chip (≈↻).
    const rail = page.getByRole("group", { name: "روابط الآية" });
    await expect(rail).toBeVisible();
    const loopChip = rail.getByRole("button", { name: /متشابهات في السورة/ });
    await expect(loopChip).toBeVisible();

    // 3. Open its popover; the 2:123 hop row is listed and enabled (vendored).
    await loopChip.tap();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    const hopBtn = sheet.getByRole("button", { name: /انتقل إلى البقرة، ٢:١٢٣/ });
    await expect(hopBtn).toBeEnabled();

    // 4. Hop — cross-page to page 19. The page id updates and 2:123 becomes
    //    current (its selection highlight lands on the newly mounted page).
    await hopBtn.tap();
    await expect(page.locator("header .numeric")).toHaveText(pageNumber(19));
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة، ٢:١٢٣/ }),
    ).toBeVisible();
    // the origin 2:48 kept its breadcrumb (still on the mounted page 7).
    await expect(page.locator("#hifth-overlay .hl-crumb")).not.toHaveCount(0);
    // Arriving by a hop leaves the verse's tool drawer down: on a phone it rises
    // over the bar the way back lives in, and hid the bead below (main was red
    // on iPhone from the drawer's first day until this).
    await expect(page.getByRole("region", { name: /البقرة، ٢:١٢٣/ })).toHaveCount(0);

    // 5. A trail bead for the origin (2:48) is threaded; tap it to rewind.
    const bead = page.getByRole("button", { name: /ارجع إلى البقرة، ٢:٤٨/ });
    await expect(bead).toBeVisible();
    await bead.tap();

    // Back on page 7 with 2:48 current again — same code path as a forward hop.
    await expect(page.locator("header .numeric")).toHaveText(pageNumber(7));
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة، ٢:٤٨/ }),
    ).toBeVisible();
    // Coming back is a hop too, so the drawer stays down; a tap still raises it.
    const tools = page.getByRole("region", { name: /البقرة، ٢:٤٨/ });
    await expect(tools).toHaveCount(0);
    await ayah.tap();
    await expect(tools).toBeVisible();
  });

  test("un-vendored hop targets are surfaced but disabled (no ghost pages)", async ({ browser }) => {
    // 2:120 on page 19 is the ayah whose chips are *entirely* dead ends when the
    // two pages behind them are absent: ≈↻ holds only 2:145 (page 22) and ≈→ only
    // 13:37 (page 254). Neither was vendored before Loop 4b, which made this row
    // free; both are vendored now, so the scarcity is arranged (`./inventory`).
    //
    // Two chips, not one sheet's depth: the promise is about the rail's buckets.
    // Shown-and-disabled is the whole design — a rail that hid what it could not
    // reach would leave a hafiz believing an ayah has no mutashabihat, which is a
    // stronger and more wrong claim than "we do not have that page".
    const { context, page } = await contextWithout(browser, [22, 254]);
    try {
      await page.goto("/#/hafs-kfqc/2:120");
      // Name page 19 rather than taking `.first()`, which resolves to whichever
      // <svg> is first in the DOM, warm or visible.
      await expect(page.locator('svg[aria-labelledby="page-label-19"]')).toBeVisible();
      await expect(
        page.getByRole("button", { name: /الآية الحالية البقرة، ٢:١٢٠/ }),
      ).toBeVisible();

      const rail = page.getByRole("group", { name: "روابط الآية" });
      await expect(rail).toBeVisible();

      for (const chipName of [/متشابهات في السورة/, /سور لاحقة/]) {
        const chip = rail.getByRole("button", { name: chipName });
        await expect(chip).toBeVisible();
        await chip.tap();

        const sheet = page.getByRole("dialog");
        // Every link is shown, none leaps to a page we do not have, and each one
        // says so and links out to the verse on the outside library instead.
        const rows = sheet.getByRole("listitem");
        await expect(rows.first()).toBeVisible();
        const count = await rows.count();
        await expect(sheet.getByRole("button", { name: /انتقل إلى/ })).toHaveCount(0);
        await expect(sheet.getByText(/غير متوفّرة بعد/)).toHaveCount(count);
        await expect(sheet.getByRole("link", { name: /المكتبة القرآنية الجامعة/ })).toHaveCount(count);

        await sheet.getByRole("button", { name: "إغلاق" }).tap();
        await expect(page.getByRole("dialog")).toHaveCount(0);
      }
    } finally {
      await context.close();
    }
  });

  test("with the whole print vendored, those same chips land", async ({ page }) => {
    // The other side of the row above, and the thing Loop 4b actually bought.
    // Same ayah, same two chips, no fixture: 2:145 and 13:37 are now pages we
    // have, so the leap is enabled and taking it arrives — page 22 for the ≈↻
    // chip, which is a cross-page hop of the ordinary kind.
    //
    // Worth its own row rather than an assertion appended to the first, because
    // the two are opposite verdicts on the same DOM and a rail that disabled
    // everything would pass one of them perfectly.
    await page.goto("/#/hafs-kfqc/2:120");
    await expect(page.locator('svg[aria-labelledby="page-label-19"]')).toBeVisible();

    const rail = page.getByRole("group", { name: "روابط الآية" });
    await rail.getByRole("button", { name: /متشابهات في السورة/ }).tap();
    const sheet = page.getByRole("dialog");
    const hop = sheet.getByRole("button", { name: /انتقل إلى البقرة، ٢:١٤٥/ });
    await expect(hop).toBeEnabled();
    await hop.tap();

    await expect(page.locator("header .numeric")).toHaveText(pageNumber(22));
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة، ٢:١٤٥/ }),
    ).toBeVisible();
  });

  test("the shard for where the rail can send you is fetched before you go", async ({ page }) => {
    // `docs/performance.md` ⑧. Shards used to be prefetched by *mounted page* — the
    // right eager step for the tap, and the wrong one for the hop. A
    // mutashabihat edge is a resemblance across the mus'haf, so it usually
    // lands in another surah, and the one shard nobody asked for was the one
    // belonging to the place the reader was a single tap from going.
    //
    // 2:120 is the case that makes it visible rather than merely arguable. It
    // sits on page 19, which carries surah 2 and nothing else, and its ≈→ chip
    // holds exactly one edge: 13:37. So surah 13's shard is reachable from this
    // screen in one tap and is on no mounted page at all — under the old rule
    // it could not have been fetched by anything except arriving there.
    const asked = new Set<string>();
    page.on("request", (req) => {
      const m = /\/assets\/adj\/[^/]+\/(\d+)\.json$/.exec(new URL(req.url()).pathname);
      if (m?.[1]) asked.add(m[1]);
    });

    await page.goto("/#/hafs-kfqc/2:120");
    const rail = page.getByRole("group", { name: "روابط الآية" });
    await expect(rail).toBeVisible();
    await expect(rail.getByRole("button", { name: /سور لاحقة/ })).toBeVisible();

    // The premise, and it is the half that fails loudest if the rail ever stops
    // needing a shard at all: surah 2's own shard is what drew the chips.
    await expect
      .poll(() => asked.has("2"), { message: "the selection's own shard was never fetched" })
      .toBe(true);

    // The claim. No chip has been opened and no hop taken — the reader is
    // simply looking at a rail that offers surah 13.
    await expect
      .poll(() => asked.has("13"), {
        message: "the hop target's shard was not prefetched — the rail's far side starts cold",
      })
      .toBe(true);

    // …and it is still a prefetch, not a load-everything: 114 shards are ~200 KB
    // gzipped, and a rule that fetched them all would pass the line above while
    // being the bug in the other direction.
    expect(asked.size, `fetched ${[...asked].sort().join(", ")}`).toBeLessThan(5);
  });
});
