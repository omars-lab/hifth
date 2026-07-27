import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Loop 6a exit criterion (PLAN §Loop 6a): "instant plain⇄tajweed toggle with
// identical geometry".
//
// The geometry half is the one worth automating, and it is checked the same way
// `geometrySignature` checks it in the unit tier: fingerprint every shape
// attribute of the mounted page, flip the skin, fingerprint again, compare
// bytes. A unit test proves the Highlighter does not touch geometry; this
// proves the whole app — CSS included — does not either, in a real browser
// where `d` could in principle be rewritten by anything on the page.

/** Tag + geometry attributes of every element in the page SVG, document order. */
const SIGNATURE = `(() => {
  const svg = document.querySelector("main svg[role='group']");
  if (!svg) return null;
  const ATTRS = ["d","points","x","y","x1","y1","x2","y2","cx","cy","r","rx","ry",
    "width","height","transform","viewBox","preserveAspectRatio","clip-path","mask"];
  const line = (el) => el.tagName + ATTRS.map((a) =>
    el.getAttribute(a) === null ? "" : "|" + a + "=" + el.getAttribute(a)).join("");
  return [line(svg), ...[...svg.querySelectorAll("*")].map(line)].join("\\n");
})()`;

const toggle = "header button[aria-pressed]";

test.describe("Hifth · tajweed skin (spec §8)", () => {
  test("the beta badge is visible before the skin is ever switched on", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:38");
    // Not behind the toggle, not in a settings screen: on the control itself.
    await expect(page.locator(`${toggle} >> text=تجريبي`)).toBeVisible();
    await expect(page.locator(toggle)).toHaveAttribute("aria-pressed", "false");
  });

  test("plain → tajweed → plain leaves the page geometry byte-identical", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:38");
    await expect(page.locator("main svg[role='group']").first()).toBeVisible();

    const plain = await page.evaluate(SIGNATURE);
    expect(plain).toBeTruthy();

    await page.locator(toggle).click();
    await expect(page.locator("main svg.skin-tajweed").first()).toBeAttached();
    expect(await page.evaluate(SIGNATURE)).toBe(plain);

    await page.locator(toggle).click();
    expect(await page.evaluate(SIGNATURE)).toBe(plain);
  });

  test("switching on marks ayahs with their rules", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:38");
    await page.locator(toggle).click();
    // The shard is fetched on toggle, so the first marks land asynchronously.
    const marked = page.locator("main svg .ayahPolygon[data-tj]");
    await expect(marked.first()).toBeAttached({ timeout: 10_000 });
    // Every marked polygon carries a leading-rule class, which is what paints.
    const classes = await marked.first().getAttribute("class");
    expect(classes).toMatch(/\btj-mark-[a-z-]+\b/);
  });

  test("switching off removes every rule class again", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:38");
    await page.locator(toggle).click();
    await expect(page.locator("main svg .ayahPolygon[data-tj]").first()).toBeAttached({
      timeout: 10_000,
    });
    await page.locator(toggle).click();
    await expect(page.locator("main svg .ayahPolygon[data-tj]")).toHaveCount(0);
    await expect(page.locator("main svg .ayahPolygon[class*='tj-']")).toHaveCount(0);
  });

  test("the legend is a real dialog: it names the rules and closes on Escape", async ({
    page,
  }) => {
    await page.goto("/#/hafs-kfqc/2:38");
    await page.getByLabel("مفتاح ألوان التجويد").click();

    const legend = page.getByRole("dialog", { name: "مفتاح ألوان التجويد" });
    await expect(legend).toBeVisible();
    // Colour is never the only channel: every family is named in Arabic.
    for (const rule of ["مدّ", "همزة وصل", "قلقلة", "إدغام"]) {
      await expect(legend.getByText(rule, { exact: true }).first()).toBeVisible();
    }
    // And the two things a hafiz must know before trusting it.
    await expect(legend.getByText(/تجريبية/)).toBeVisible();
    await expect(legend.getByText(/الآية كاملة/)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(legend).toBeHidden();
  });

  test("no axe violations with the skin on and the legend open", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:38");
    await page.locator(toggle).click();
    await page.getByLabel("مفتاح ألوان التجويد").click();
    await expect(page.getByRole("dialog", { name: "مفتاح ألوان التجويد" })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
