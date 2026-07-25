import { test, expect } from "@playwright/test";
import { tapAyah } from "./ayah";
import AxeBuilder from "@axe-core/playwright";

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
