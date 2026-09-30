import { test, expect } from "@playwright/test";

// The link builder on the app-links contract page composes a link as you pick,
// and says what the Mac and iPad app will do with it, in the same words the
// contract's examples use. This drives the real page in a real browser: the
// unit tests prove the rules, this proves the form is wired to them.
const PAGE = "/docs/design/app-url-scheme.html";

test.describe("Hifth · the link builder on the contract page", () => {
  test("a verse with words in a mode makes three links, and the app would open it", async ({ page }) => {
    await page.goto(PAGE);
    const form = page.locator("#link-builder");
    await form.getByLabel("Verse").check();
    await form.locator('[name="verse"]').fill("2:255");
    await form.locator('[name="words"]').fill("3-7");
    await form.locator('[name="mode"]').selectOption("highlight");
    await expect(page.locator("#out-plain")).toHaveText("hifth:///hafs-kfqc/2:255?w=3-7&tool=highlight");
    await expect(page.locator("#out-request")).toHaveText("hifth://x-callback-url/open?verse=2:255&words=3-7&mode=highlight");
    await expect(page.locator("#out-site")).toHaveText(/^https:\/\/.+\/#\/hafs-kfqc\/2:255\?w=3-7&tool=highlight$/);
    await expect(page.locator("#out-outcome")).toHaveText("open #/hafs-kfqc/2:255?w=3-7&tool=highlight");
    await expect(page.locator("#open-in-app")).toHaveAttribute("href", "hifth:///hafs-kfqc/2:255?w=3-7&tool=highlight");
  });

  test("a mus'haf the app does not ship is refused by name, and there is no link to send", async ({ page }) => {
    await page.goto(PAGE);
    const form = page.locator("#link-builder");
    await form.locator('[name="page"]').fill("45");
    await expect(page.locator("#out-plain")).toHaveText("hifth:///hafs-kfqc/p45");
    await form.locator('[name="edition"]').selectOption("warsh-libya");
    await expect(page.locator("#out-outcome")).toContainText("error bad-route");
    await expect(page.locator("#out-outcome")).toContainText("warsh-libya is not in the app yet");
    await expect(page.locator("#out-outcome")).toContainText("hafs-kfqc");
    await expect(page.locator("#out-plain")).toHaveText("");
    await expect(page.locator("#open-in-app")).toBeHidden();
  });

  test("picking a surah opens its context; the fields for the other places are off", async ({ page }) => {
    await page.goto(PAGE);
    const form = page.locator("#link-builder");
    await form.getByLabel("Surah").check();
    await expect(form.locator('[name="page"]')).toBeDisabled();
    await expect(form.locator('[name="verse"]')).toBeDisabled();
    await form.locator('[name="surah"]').fill("36");
    await expect(page.locator("#out-plain")).toHaveText("hifth:///hafs-kfqc/36:1?open=context");
    await form.locator('[name="x-success"]').fill("shortcuts://x-callback-url/run-shortcut?name=Next");
    await expect(page.locator("#out-request")).toHaveText(
      "hifth://x-callback-url/open?surah=36&x-success=shortcuts://x-callback-url/run-shortcut?name=Next",
    );
  });

  test("an empty form says what it needs, in the contract's words", async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.locator("#out-outcome")).toContainText("error missing-route");
    await expect(page.locator("#out-outcome")).toContainText("open needs a page");
  });
});
