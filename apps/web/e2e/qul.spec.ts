import { test, expect } from "@playwright/test";
import { tapAyah } from "./ayah";

// The ↗ per-verse "open on QUL" link (task #68) is a developer's tool: the
// owner asked (2026-11-07) that it show only while the app runs on this laptop
// in dev mode, not in a real build. These tests run against the real build, so
// what they pin is that a reader never sees it, even with a verse selected. The
// address it would open is pinned by `qul.test.ts`.
test.describe("Hifth · the QUL link is for developers only", () => {
  test("a real build shows no QUL link, even with a verse selected", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();

    // Select 2:48 (verse-55 on page 7, vendored): the drawer opens with its tools.
    await tapAyah(page, "#verse-55");
    await expect(page.getByRole("button", { name: /٢:٤٨/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /QUL/ })).toHaveCount(0);
  });
});
