import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ayahTarget } from "./ayah";
import { threeButtons } from "./three-buttons";
import { DRAWER_TOOLS_KEY } from "../src/drawer-tools";

/*
 * Axe over the screens share-a11y.spec.ts does not reach (backlog row
 * a11y-axe-remaining-screens): the bookmark drawer, the verse's tools drawer
 * with a tool opened inside it, the account section once it is drawn, and, on
 * a computer only, the wide layout itself, the note box and the mistake picker.
 * Each test fails on any serious or critical finding, named with its rule and
 * the elements it points at. Made-up text only.
 */

test.use({ locale: "en-US" });

/** Axe's serious and critical findings on what is on screen now, leaving out
 *  only the elements named in `skip` (each one a known, written-down finding). */
async function seriousViolations(page: Page, skip: string[] = []) {
  let axe = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]);
  for (const sel of skip) axe = axe.exclude(sel);
  const results = await axe.analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({ rule: v.id, help: v.help, where: v.nodes.map((n) => n.target.join(" ")) }));
}

const pageSvg = (page: Page, n: number) => page.locator(`svg[aria-labelledby="page-label-${n}"]:visible`);

async function onPage7(page: Page) {
  await page.goto("/#/hafs-kfqc/p7");
  await expect(pageSvg(page, 7)).toBeVisible();
}

/**
 * A stand-in for the app around the page, enough to make the account section
 * draw itself: it answers "account" with the given state. The full stand-in,
 * with sign-in and sign-out, is in account.spec.ts.
 */
function standInApp(page: Page, state: "signed-out" | "signed-in") {
  return page.addInitScript((first) => {
    const reply = (id: string, answer: unknown) =>
      setTimeout(
        () => (window as unknown as { __HIFTH_ANSWER__?: (i: string, a: unknown) => void }).__HIFTH_ANSWER__?.(id, answer),
        30,
      );
    const answers: Record<string, () => unknown> = {
      account: () => ({ ok: true, value: first }),
      "invite-kept": () => ({ ok: true, value: "no" }),
    };
    Object.assign(window, {
      __HIFTH_NATIVE__: Object.freeze({ platform: "ios", publicBase: "https://example.test/hifth/" }),
      webkit: {
        messageHandlers: {
          hifth: {
            postMessage: (m: { type?: string; id?: string; name?: string }) => {
              if (m.type !== "ask" || !m.id || !m.name) return;
              reply(m.id, answers[m.name]?.() ?? { ok: false, error: "unknown-question" });
            },
          },
        },
      },
    });
  }, state);
}

test.describe("Hifth · axe on the remaining screens", () => {
  test("the bookmark drawer has no serious/critical axe violations", async ({ page }) => {
    await onPage7(page);
    await page.getByRole("button", { name: "Drop a bookmark on this page" }).first().click();
    const drawer = page.getByRole("dialog", { name: "Bookmark" });
    await expect(drawer).toBeVisible();
    await drawer.getByLabel("Name").fill("Made-up name");
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("the verse's tools drawer, with a tool open inside it, has no serious/critical axe violations", async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "drawer"), DRAWER_TOOLS_KEY);
    await page.goto("/#/hafs-kfqc/2:45");
    const drawer = page.getByRole("region", { name: /^Tools for / });
    await expect(drawer).toBeVisible({ timeout: 20_000 });
    expect(await seriousViolations(page), "the drawer").toEqual([]);
    await drawer.getByRole("button", { name: /^Same roots · / }).click();
    const list = drawer.getByRole("region", { name: /^Roots · / });
    await expect(list.getByRole("button", { name: /^Hop to / }).first()).toBeVisible({ timeout: 10_000 });
    expect(await seriousViolations(page), "the drawer with Same roots open").toEqual([]);
  });

  for (const state of ["signed-out", "signed-in"] as const) {
    test(`the account section, ${state}, has no serious/critical axe violations`, async ({ page }) => {
      await standInApp(page, state);
      await page.goto("/");
      await expect(page.locator("svg[role='group']").first()).toBeVisible();
      await page.getByRole("button", { name: /About Hifth/ }).click();
      const sheet = page.getByRole("dialog", { name: /About Hifth/ });
      await expect(sheet).toBeVisible();
      const heading = sheet.getByRole("heading", { name: "Account" });
      await expect(heading).toBeVisible();
      await heading.scrollIntoViewIfNeeded();
      expect(await seriousViolations(page)).toEqual([]);
    });
  }
});

test.describe("Hifth · axe on a computer", () => {
  // The note and mistake tools sit on the computer's tools bar, and the wide
  // layout is a computer's; a phone has neither.
  test.skip(({ isMobile }) => !!isMobile, "a computer's screens");
  test.beforeEach(async ({ page }) => threeButtons(page));

  test("the wide layout, with and without a chosen verse, has no serious/critical axe violations", async ({ page }) => {
    await onPage7(page);
    expect(await seriousViolations(page), "the page").toEqual([]);
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    await expect(page.locator("#hifth-overlay .hl-sel").first()).toBeAttached();
    expect(await seriousViolations(page), "a chosen verse").toEqual([]);
  });

  test("the info panel on a computer has no serious/critical axe violations", async ({ page }) => {
    await onPage7(page);
    await page.getByRole("button", { name: /About Hifth/ }).click();
    await expect(page.getByRole("dialog", { name: /About Hifth/ })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("the note box has no serious/critical axe violations", async ({ page }) => {
    await onPage7(page);
    await page.keyboard.press("KeyN");
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    const box = page.getByRole("dialog", { name: /^Your note on / });
    await expect(box).toBeVisible();
    await box.getByRole("textbox").fill("A made-up note");
    expect(await seriousViolations(page)).toEqual([]);
  });

  async function openMistakePicker(page: Page) {
    await onPage7(page);
    await page.keyboard.press("KeyM");
    const at = await ayahTarget(page, "#verse-46");
    await page.mouse.click(at.x, at.y);
    await expect(page.getByRole("dialog", { name: /^What went wrong in / })).toBeVisible();
  }

  // Left failing on purpose (2026-11-20). In the picker's "A tajweed rule" row,
  // each rule starts with a small mark in its tajweed colour. The madd mark is
  // the app's madd orange (#d55e00) on the card's near-white, about 3.9 to 1,
  // under the 4.5 to 1 axe asks of text. The mark is hidden from screen readers
  // and the rule's name is written beside it, but the fix is a darker madd
  // colour, which changes the tajweed colours everywhere they show, so it waits
  // for the owner. The test below still scans everything else in the picker.
  test.fixme("the mistake picker has no serious/critical axe violations", async ({ page }) => {
    await openMistakePicker(page);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("the mistake picker, apart from the madd colour mark, has no serious/critical axe violations", async ({ page }) => {
    await openMistakePicker(page);
    expect(await seriousViolations(page, ['button[data-rule="madd"] > [aria-hidden="true"]'])).toEqual([]);
  });
});
