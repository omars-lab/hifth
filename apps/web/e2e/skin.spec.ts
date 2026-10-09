import { test, expect, type Page } from "@playwright/test";
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

/**
 * The page's fingerprint once it has stopped changing. Opening on a verse marks
 * it with the highlighter a moment after the page shows, and the marks are fitted
 * to the letters again once those are laid out; a fingerprint taken before that
 * differs from every later one for reasons that have nothing to do with the skin
 * (2 runs in 300 on a busy machine). So wait for the marks, then for two reads in
 * a row to agree.
 */
async function settledSignature(page: Page): Promise<string> {
  await expect(page.locator("#hifth-overlay .hl-sel path.hl-band")).toHaveCount(2);
  let last: string | null = null;
  await expect
    .poll(async () => {
      const now = (await page.evaluate(SIGNATURE)) as string | null;
      const same = now !== null && now === last;
      last = now;
      return same;
    }, { intervals: [250] })
    .toBe(true);
  return last!;
}

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

    const plain = await settledSignature(page);
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

  // Found walking the pitch in the iPad app, 2026-10-08: the key, opened with
  // the colours still off, said "none on this page" for every rule, because
  // the rules are only fetched once the colours go on. A page of al-Baqarah
  // has madd on it; a key that says otherwise is wrong, not empty.
  test("the key counts the page's rules even with the colours off", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:38");
    await expect(page.locator(toggle)).toHaveAttribute("aria-pressed", "false");
    await page.getByLabel("مفتاح ألوان التجويد").click();
    const legend = page.getByRole("dialog", { name: "مفتاح ألوان التجويد" });
    await expect(legend).toBeVisible();
    await expect(legend.getByText(/آية في صفحة/).first()).toBeVisible({ timeout: 10_000 });
    // Opening the key does not switch the colours on behind the reader's back.
    await expect(page.locator(toggle)).toHaveAttribute("aria-pressed", "false");
  });

  // While the rules are still on their way the key has nothing to say yet;
  // "none on this page" in that moment is a wrong answer, not a pending one.
  test("the key does not say a rule is missing while it is still counting", async ({ browser }) => {
    // Own the context: the service worker answers the fetch itself, where
    // `page.route` cannot slow it.
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    await page.route("**/assets/skins/**/tajweed/2.json", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto("/#/hafs-kfqc/2:38");
    await page.getByLabel("مفتاح ألوان التجويد").click();
    const legend = page.getByRole("dialog", { name: "مفتاح ألوان التجويد" });
    await expect(legend).toBeVisible();
    await expect(legend.getByText("لا شيء في هذه الصفحة")).toHaveCount(0);
    await expect(legend.getByText(/آية في صفحة/).first()).toBeVisible({ timeout: 10_000 });
    await context.close();
  });

  // Found walking the pitch in the Mac app, 2026-10-08: on a laptop-sized
  // window the key is taller than its card, so the last rule is cut at the
  // edge and the source's credit, a licence condition, sits out of sight with
  // nothing to say there is more. While there is more below, the card shows
  // it; once the reader reaches the end, the cue goes.
  test("a key taller than its card says there is more, until the end is reached", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#/hafs-kfqc/p45");
    await page.getByLabel("مفتاح ألوان التجويد").click();
    const legend = page.getByRole("dialog", { name: "مفتاح ألوان التجويد" });
    await expect(legend).toBeVisible();
    // The key's rows fill in once the page's colours are counted, which under
    // load is a beat after the card opens: measure once it has filled.
    await expect.poll(() => legend.evaluate((el) => el.scrollHeight > el.clientHeight + 1)).toBe(true);
    await expect(legend).toHaveAttribute("data-more", "below");
    await legend.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect(legend).not.toHaveAttribute("data-more", "below");
    await expect(legend.locator("a[href]").last()).toBeInViewport();
  });

  test("a key that fits its card shows no cue", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1400 });
    await page.goto("/#/hafs-kfqc/p45");
    await page.getByLabel("مفتاح ألوان التجويد").click();
    const legend = page.getByRole("dialog", { name: "مفتاح ألوان التجويد" });
    await expect(legend).toBeVisible();
    await expect(legend.getByText(/آية في صفحة/).first()).toBeVisible({ timeout: 10_000 });
    await expect(legend).not.toHaveAttribute("data-more", "below");
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
