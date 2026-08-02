import { test, expect } from "@playwright/test";

// Loop 2 exit criterion (PLAN §Loop 2):
//   tap 2:48 → rail → popover → hop to 2:123 cross-page → bead back, one-handed.
// 2:48 is verse-55 on page 7; 2:123 is verse-130 on page 19. Both are vendored.
test.describe("Hifth · the hop", () => {
  test("tap 2:48 → rail → popover → cross-page hop to 2:123 → bead back", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']")).toBeVisible();

    // 1. Tap 2:48 on page 7.
    const ayah = page.locator("#verse-55");
    await expect(ayah).toHaveCount(1);
    await ayah.tap();
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة · ٢:٤٨/ }),
    ).toBeVisible();

    // 2. The hop rail appears with at least the same-surah loop chip (↻).
    const rail = page.getByRole("group", { name: "روابط الآية" });
    await expect(rail).toBeVisible();
    const loopChip = rail.getByRole("button", { name: /متشابهات في السورة/ });
    await expect(loopChip).toBeVisible();

    // 3. Open its popover; the 2:123 hop row is listed and enabled (vendored).
    await loopChip.tap();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    const hopBtn = sheet.getByRole("button", { name: /انتقل إلى البقرة · ٢:١٢٣/ });
    await expect(hopBtn).toBeEnabled();

    // 4. Hop — cross-page to page 19. The page id updates and 2:123 becomes
    //    current (its selection highlight lands on the newly mounted page).
    await hopBtn.tap();
    await expect(page.locator("header .numeric")).toHaveText("19");
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة · ٢:١٢٣/ }),
    ).toBeVisible();
    // the origin 2:48 kept its breadcrumb (still on the mounted page 7).
    await expect(page.locator("#hifth-overlay .hl-crumb")).not.toHaveCount(0);

    // 5. A trail bead for the origin (2:48) is threaded; tap it to rewind.
    const bead = page.getByRole("button", { name: /ارجع إلى البقرة · ٢:٤٨/ });
    await expect(bead).toBeVisible();
    await bead.tap();

    // Back on page 7 with 2:48 current again — same code path as a forward hop.
    await expect(page.locator("header .numeric")).toHaveText("7");
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة · ٢:٤٨/ }),
    ).toBeVisible();
  });

  test("un-vendored hop targets are surfaced but disabled (no ghost pages)", async ({ page }) => {
    // 2:120 on page 19 is the one ayah in the vendored corpus whose chips are
    // *entirely* dead ends: ↻ holds only 2:145 (page 22) and ▶ only 13:37
    // (page 254), neither vendored until Loop 4b. Two chips, so this covers the
    // rail's promise across buckets rather than depth inside one sheet — the
    // 47.8%-wrong corpus this used to lean on is gone, and with it any bucket
    // that had three dead ends in it.
    await page.goto("/#/hafs-kfqc/2:120");
    // Both dead-end pages stay unmounted, but 2:145's page 22 does not — a hop
    // target keeps its page warm. Name page 19 rather than taking `.first()`,
    // which resolves to whichever <svg> is first in the DOM, warm or visible.
    await expect(page.locator('svg[aria-labelledby="page-label-19"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة · ٢:١٢٠/ }),
    ).toBeVisible();

    const rail = page.getByRole("group", { name: "روابط الآية" });
    await expect(rail).toBeVisible();

    for (const chipName of [/متشابهات في السورة/, /سور لاحقة/]) {
      const chip = rail.getByRole("button", { name: chipName });
      await expect(chip).toBeVisible();
      await chip.tap();

      const sheet = page.getByRole("dialog");
      // Every link is shown, but every leap is disabled — honest dead-end notes.
      const hopBtns = sheet.getByRole("button", { name: /انتقل إلى/ });
      await expect(hopBtns.first()).toBeVisible();
      const count = await hopBtns.count();
      for (let i = 0; i < count; i++) {
        await expect(hopBtns.nth(i)).toBeDisabled();
      }
      await expect(sheet.getByText(/غير متوفّرة بعد/).first()).toBeVisible();

      await sheet.getByRole("button", { name: "إغلاق" }).tap();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  });

  test("the shard for where the rail can send you is fetched before you go", async ({ page }) => {
    // `docs/backlog.md` ⑧. Shards used to be prefetched by *mounted page* — the
    // right eager step for the tap, and the wrong one for the hop. A
    // mutashabihat edge is a resemblance across the mus'haf, so it usually
    // lands in another surah, and the one shard nobody asked for was the one
    // belonging to the place the reader was a single tap from going.
    //
    // 2:120 is the case that makes it visible rather than merely arguable. It
    // sits on page 19, which carries surah 2 and nothing else, and its ▶ chip
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
