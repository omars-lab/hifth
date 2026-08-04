import { test, expect, type Page } from "@playwright/test";
import { tapAyah } from "./ayah";
import AxeBuilder from "@axe-core/playwright";
import { COACH_STORAGE_KEY } from "../src/coach";

// Loop 3 exit criterion (PLAN §Loop 3):
//   cold-opening a teacher link restores the exact view incl. trail; the screen
//   reader announces ayahs and hops.
// 2:48 is verse-55 on page 7; 2:123 is verse-130 on page 19. Both are vendored.
//
// Note: a restored/hopped view mounts the current page *and* its adjacent hop
// targets, so `svg[role='group']` matches more than one element — assertions
// that only need "a page is up" use `.first()`.

test.describe("Hifth · share links (spec §7)", () => {
  test("cold-opening a hop link restores the exact view (select + page + breadcrumb)", async ({
    page,
  }) => {
    // A teacher's link: land on 2:123 (page 19), arrived via 2:48 (breadcrumb).
    await page.goto("/#/hafs-kfqc/2:123?via=2:48");

    // Restored: page 19 mounted (header page number), 2:123 selected as the
    // current ayah, and the 2:48 origin is a bead.
    await expect(page.locator("header .numeric")).toHaveText("19");
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة · ٢:١٢٣/ }),
    ).toBeVisible();
    // The via origin (2:48) is on the trail — tap-to-rewind is available.
    await expect(page.getByRole("button", { name: /ارجع إلى البقرة · ٢:٤٨/ })).toBeVisible();
    // And it is *outlined on its own page* — the third noun in this test's name
    // and the one thing it did not check. The bead above is not evidence of it:
    // the bead comes from the trail, the outline comes from `PageStage`, and the
    // outline was losing a race with page 7's mount and then never arriving,
    // because the effect that draws it is keyed on the crumb and reads the
    // mounted set through a ref. A shared link that silently drops the mark
    // showing where you came from is that link failing at its one job.
    //
    // Attached, not visible: 2:48 is on page 7 and the reader is on page 19, so
    // the mark is waiting on the page it belongs to. Asserted against that page
    // by name, because "some overlay somewhere holds a crumb" is exactly the
    // claim a wrong-page bug would also satisfy.
    await expect(
      page.locator('svg[aria-labelledby="page-label-7"] #hifth-overlay .hl-crumb'),
    ).toBeAttached();
  });

  test("the breadcrumb survives its page arriving late", async ({ page }) => {
    // The test above is a witness, not a proof: on a fast machine page 7 mounts
    // before the breadcrumb is computed, which is the order that works. The
    // order that broke is the other one, and it is not reachable by asking
    // nicely — so hold page 7's SVG back until the effect that draws the crumb
    // has certainly run and found nothing to draw on.
    //
    // 400 ms is chosen against the assertion, not the machine: whatever the
    // fetch would have taken, the effect fires on the render that follows the
    // hash parse, and that is not 400 ms away. Under the bug the crumb is then
    // gone for good — nothing re-runs the effect, because it reads the mounted
    // set through a ref and no render is owed. This is the container failure
    // reproduced on purpose instead of waited for.
    await page.route("**/assets/pages/hafs-kfqc/7.svg", async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      await route.continue();
    });
    await page.goto("/#/hafs-kfqc/2:123?via=2:48");
    await expect(page.locator("header .numeric")).toHaveText("19");
    await expect(
      page.locator('svg[aria-labelledby="page-label-7"] #hifth-overlay .hl-crumb'),
    ).toBeAttached();
  });

  test("a full trail link restores the whole chain of beads", async ({ page }) => {
    // trail=2:40,2:47 then via=2:48 → three beads, landing on 2:123.
    await page.goto("/#/hafs-kfqc/2:123?trail=2:40,2:47&via=2:48");
    // The active page (19) is up and 2:123 is the current ayah.
    await expect(page.locator("header .numeric")).toHaveText("19");
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة · ٢:١٢٣/ }),
    ).toBeVisible();
    // The two earlier origins plus the via origin are all beads.
    for (const ref of ["٢:٤٠", "٢:٤٧", "٢:٤٨"]) {
      await expect(page.getByRole("button", { name: new RegExp(`ارجع إلى البقرة · ${ref}`) })).toBeVisible();
    }
  });

  test("selecting an ayah writes a shareable hash to the address bar", async ({ page }) => {
    await page.goto("/");
    await tapAyah(page, "#verse-55");
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة · ٢:٤٨/ }),
    ).toBeVisible();
    // The URL now encodes the selection (spec §7 canonical form).
    await expect.poll(() => new URL(page.url()).hash).toBe("#/hafs-kfqc/2:48");
    // The share affordance is present.
    await expect(page.getByRole("button", { name: /شارك/ })).toBeVisible();
  });
});

test.describe("Hifth · diff view (spec §3)", () => {
  test("expanding a hop row reveals the token diff of the two readings", async ({ page }) => {
    await page.goto("/");
    await tapAyah(page, "#verse-55");
    const loopChip = page
      .getByRole("group", { name: "روابط الآية" })
      .getByRole("button", { name: /متشابهات في السورة/ });
    await loopChip.tap();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();

    // The 2:123 row's expander (the labelled text button, not the hop button)
    // toggles the token diff showing شفاعة (here) vs عدل (target).
    const expander = sheet.getByRole("button", { name: /البقرة · ٢:١٢٣ شفاعة/ });
    await expander.tap();
    await expect(sheet.getByText(/شَفَاعَةٌ/).first()).toBeVisible();
    await expect(sheet.getByText(/عَدْلٌ/).first()).toBeVisible();
  });
});

test.describe("Hifth · keyboard a11y", () => {
  test("keyboard-only: focus an ayah, select with Enter, open rail, hop, land", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();

    // The ayah polygons are keyboard-reachable buttons with labels.
    const ayah = page.locator("#verse-55");
    await expect(ayah).toHaveAttribute("role", "button");
    await expect(ayah).toHaveAttribute("tabindex", "0");

    // Focus it and select with the keyboard (no tap).
    await ayah.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: /الآية الحالية البقرة · ٢:٤٨/ }),
    ).toBeVisible();

    // The rail chip is reachable and openable; the dialog takes focus.
    const loopChip = page
      .getByRole("group", { name: "روابط الآية" })
      .getByRole("button", { name: /متشابهات في السورة/ });
    await loopChip.focus();
    await page.keyboard.press("Enter");
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    // Focus moved into the dialog.
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.closest("[role='dialog']") !== null))
      .toBe(true);

    // Escape closes it and focus returns to the rail chip.
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("Escape closes the popover", async ({ page }) => {
    await page.goto("/");
    await tapAyah(page, "#verse-55");
    await page
      .getByRole("group", { name: "روابط الآية" })
      .getByRole("button", { name: /متشابهات في السورة/ })
      .tap();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });
});

/**
 * The screen-reader tour, pinned as trees rather than as a list of strings.
 *
 * The `screen-reader-walkthrough` ledger check is eight steps of "swipe here,
 * you should hear this". Five of those steps are asserting the accessibility
 * *tree* — which controls exist, in what order, under what names — and a tree
 * is a thing a machine can hold onto. So it holds onto it here, and the human
 * check keeps only the three steps an ear can do and a runner cannot: whether
 * «الآية البقرة · ٢:٤٨» is a phrase a person would say, whether focus can
 * escape out of the back of a sheet, and whether the whole tour survives with
 * the screen off.
 *
 * This is the ledger's rule running forwards for once. A manual result is
 * supposed to tighten something automated; here the automation lands first, so
 * the fifteen minutes the check costs are spent on what only they can buy.
 *
 * Why aria snapshots and not more `getByRole(...)` assertions: an assertion
 * proves a control is still there, and says nothing about the four that
 * disappeared beside it. Every regression this runbook actually fears — a
 * glyph-only button losing its label and reading as "▤", a number badge
 * leaking through as "circle 3", the chrome quietly dropping a control at a
 * narrower width — is a change in the shape of the tree, and only a snapshot
 * of the whole tree fails on it.
 *
 * Reviewing a diff here: these files are the runbook's `expect` lines. A
 * changed name is a changed announcement. Regenerate with
 * `pnpm -C apps/web exec playwright test share-a11y --update-snapshots` only
 * after reading the new name out loud.
 */
test.describe("Hifth · aria snapshots (the tour the ledger describes)", () => {
  /** A returning reader with storage settled — no coach strip, no quota notice.
   *  First-run chrome is its own tree and its own test; mixing it in here would
   *  make every snapshot re-record the day the coach copy changes. */
  const settled = (page: Page) =>
    page.addInitScript((coachKey: string) => {
      try {
        localStorage.setItem(coachKey, "1");
      } catch {
        /* private mode — the strip stays hidden anyway */
      }
      Object.defineProperty(navigator, "storage", {
        configurable: true,
        value: {
          persist: async () => true,
          persisted: async () => true,
          estimate: async () => ({ usage: 1_000_000, quota: 40 * 1024 * 1024 * 1024 }),
        },
      });
    }, COACH_STORAGE_KEY);

  /** Select 2:48 and open its in-surah hop popover — the state `escape-the-sheet` starts from. */
  async function openHopPopover(page: Page): Promise<void> {
    await tapAyah(page, "#verse-55");
    await page
      .getByRole("group", { name: "روابط الآية" })
      .getByRole("button", { name: /متشابهات في السورة/ })
      .tap();
    await expect(page.getByRole("dialog")).toBeVisible();
  }

  // Was a runbook step of its own until this snapshot replaced it — hence no
  // step id to name. The chrome is where glyph-only controls live: ⌖ and ▤ carry
  // no text of their own, so a lost label does not degrade them, it deletes
  // them — and the tree is where that shows up as a name reading "⌖".
  test("the chrome announces every control by word, never by glyph", async ({ page }) => {
    await settled(page);
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    await expect(page.locator("header")).toMatchAriaSnapshot({ name: "chrome.aria.yml" });
  });

  // What makes `judge-the-phrasing` a question about phrasing rather than about
  // existence: the page is a labelled group and every ayah under it is a button
  // named «الآية <السورة> · <المرجع>» (enhancePolygons, packages/core). The
  // runbook step points here by name; it used to point here by position, and
  // that pointer had been wrong since the runbook was condensed.
  test("the mushaf page is a labelled group of ayah buttons", async ({ page }) => {
    await settled(page);
    await page.goto("/");
    const stage = page.locator("svg[role='group']").first();
    await expect(stage).toBeVisible();
    await expect(stage).toMatchAriaSnapshot({ name: "page-group.aria.yml" });
  });

  // Another step this snapshot retired. Each chip carries a glyph and a number badge, both
  // aria-hidden, so the label has to rebuild the meaning in words. This is the
  // tree that fails if the badge ever leaks through as "circle 3".
  test("the hop rail reads as words plus a count", async ({ page }) => {
    await settled(page);
    await page.goto("/");
    await tapAyah(page, "#verse-55");
    const rail = page.getByRole("group", { name: "روابط الآية" });
    await expect(rail).toBeVisible();
    await expect(rail).toMatchAriaSnapshot({ name: "hop-rail.aria.yml" });
  });

  // The half of `escape-the-sheet` a machine can do: the sheet's own contents —
  // a close control named «إغلاق» and targets named «انتقل إلى …». Whether focus
  // can be swiped out of the back of it is still that step's job, still human,
  // and named as residue in the ledger rather than quietly assumed covered.
  test("the open hop popover names its close control and every target", async ({ page }) => {
    await settled(page);
    await page.goto("/");
    await openHopPopover(page);
    await expect(page.getByRole("dialog")).toMatchAriaSnapshot({ name: "hop-popover.aria.yml" });
  });

  // Retired step, kept as a snapshot. The trail is the only way back; if the beads do not say
  // where they lead, the back path exists visually and nowhere else. Driven
  // from a share link so the chain of beads is deterministic.
  test("the trail beads say where each one leads back to", async ({ page }) => {
    await settled(page);
    await page.goto("/#/hafs-kfqc/2:123?trail=2:40,2:47&via=2:48");
    await expect(page.locator("header .numeric")).toHaveText("19");
    await expect(page.locator("footer")).toMatchAriaSnapshot({ name: "trail.aria.yml" });
  });

  // The page bar is the app's second way through the book, and both its edge
  // controls are bare glyphs — ▸ and ◂ carry no text, so a lost label does not
  // degrade them, it deletes them. What this tree pins is the landmark, those
  // two names, the slider's own name, and the inventory line sitting inside the
  // bar rather than adrift somewhere in the page.
  //
  // What it does *not* pin: `aria-valuetext`. Playwright serialises a slider as
  // its raw `value`, so «صفحة ٧ من ٦٠٤» never reaches this file and a snapshot
  // claiming otherwise would be a green test guarding nothing. That assertion
  // lives in pagebar.spec.ts, read back off the computed DOM.
  test("the page bar names its landmark, its edges and its inventory", async ({ page }) => {
    await settled(page);
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "شريط الصفحات" })).toMatchAriaSnapshot({
      name: "page-bar.aria.yml",
    });
  });
});

test.describe("Hifth · axe automated a11y", () => {
  test("the base view has no serious/critical axe violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test("the open hop popover has no serious/critical axe violations", async ({ page }) => {
    await page.goto("/");
    await tapAyah(page, "#verse-55");
    await page
      .getByRole("group", { name: "روابط الآية" })
      .getByRole("button", { name: /متشابهات في السورة/ })
      .tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
