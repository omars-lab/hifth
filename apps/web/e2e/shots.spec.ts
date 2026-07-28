import { test, expect, type Locator, type Page } from "@playwright/test";
import { COACH_STORAGE_KEY } from "../src/coach";

/*
 * The pictures in the validation guide (docs/validation/guide.html).
 *
 * A manual runbook describes screens its reader has never seen. «expect: a dark
 * slab across the top reading «قياس الأداء على هذا الجهاز»» is prose about a
 * thing, and prose about a thing is not the thing — the reader cannot tell a
 * near-miss from a match, which is exactly the judgement the step is asking for.
 *
 * So the guide carries screenshots, and this file is where they come from. They
 * are captured from the real build, by the same harness that runs the e2e
 * suite, into docs/validation/shots/<id>.png — never hand-cropped and never
 * pasted in. A hand-captured screenshot is a second copy of the UI that drifts
 * silently, which is the failure the whole one-source/three-renderers shape of
 * the ledger exists to prevent. These regenerate with `make shots`.
 *
 * This is documentation, not assertion: no baselines, no toHaveScreenshot, no
 * diff gate. The e2e and golden suites are what hold the UI still. What *is*
 * asserted here is that each shot photographs the thing it claims to — a shot
 * of an empty rail or of a results table reading «too few frames» would teach
 * the reader the wrong expectation, which is worse than having no picture.
 *
 * Two passes, because the perf probe is a build-time flag (VITE_PERF_PROBE=1,
 * read in src/main.tsx) and deliberately not a URL param:
 *
 *   @probe — against a probe build   (make shots runs this first)
 *   @app   — against an ordinary one
 */

/** Where the guide looks for them. Relative to apps/web (Playwright's cwd). */
const SHOTS = "../../docs/validation/shots";

/**
 * Seed the app into its "not the first time" state.
 *
 * A first-run coach tour and a storage notice are both fine things to ship and
 * terrible things to photograph, and whether they appear depends on events a
 * headless run may not fire. Same seeding the golden harness uses. Applies to
 * both passes: the probe shots are of the mushaf-plus-slab, and a coach strip
 * wedged between them is not what step 1 is asking anyone to recognise.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript((coachKey: string) => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        persist: async () => true,
        persisted: async () => true,
        estimate: async () => ({ usage: 1_000_000, quota: 40 * 1024 * 1024 * 1024 }),
      },
    });
    try {
      localStorage.setItem(coachKey, "1");
    } catch {
      /* private mode — nothing to seed */
    }
  }, COACH_STORAGE_KEY);
});

/**
 * There is a mushaf on screen to photograph.
 *
 * `svg[role='group']` alone is not enough: PageStage mounts every page it has
 * visited and hides all but one with `display: none` (setCurrentPage), so after
 * a hop the *first* match can be the page you came from. Waiting on that one
 * means waiting on an element that will never be visible again.
 */
async function stageReady(page: Page): Promise<void> {
  await expect(page.locator("svg[role='group']:visible").first()).toBeVisible({
    timeout: 20_000,
  });
}

/** Full viewport — for "what does this screen look like" shots. */
async function screen(page: Page, id: string): Promise<void> {
  await page.screenshot({ path: `${SHOTS}/${id}.png` });
}

/**
 * One element, clipped. Legibility is the whole point: these are read on a
 * phone, inside a card, at a couple of hundred CSS pixels wide. A full viewport
 * shrunk to that width turns a rail of chips into a smudge, and the reader is
 * being asked to compare wording.
 */
async function crop(target: Locator, id: string): Promise<void> {
  await target.screenshot({ path: `${SHOTS}/${id}.png` });
}

/**
 * The same, with room around it.
 *
 * The hop rail is 56×96 CSS pixels of glyph-and-badge chips pinned to the page
 * edge. Clipped exactly, it is an unrecognisable strip: the reader is being
 * told to find it, and "find it" needs the thing it sits next to.
 *
 * Unlike an element screenshot, a clip is in page coordinates and nothing
 * scrolls it into view — so this scrolls first and measures after. It then
 * asserts the clip still contains the whole element. Clamping to the viewport
 * is what keeps an out-of-bounds clip from throwing, and it is also how a shot
 * gets quietly truncated: the first version of the colophon crops came out
 * 40 px tall, because the sheet scrolls inside itself and the section was
 * below the fold. A short picture of the right thing looks like a picture of
 * the wrong thing, and this file's one job is that it isn't.
 */
async function cropAround(page: Page, target: Locator, id: string, pad: number): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  expect(box, `${id}: nothing to photograph`).not.toBeNull();
  // Mirrors the `shots` project's viewport (playwright.config.ts). It is only a
  // fallback for a headed run with no viewport set, but a stale one would clamp
  // clips to a screen nobody is using and truncate the pictures silently.
  const vp = page.viewportSize() ?? { width: 390, height: 844 };
  const x = Math.max(0, box!.x - pad);
  const y = Math.max(0, box!.y - pad);
  const width = Math.min(vp.width - x, box!.width + pad * 2);
  const height = Math.min(vp.height - y, box!.height + pad * 2);
  expect(
    { width: width >= box!.width, height: height >= box!.height },
    `${id}: the clip cuts the element it is meant to photograph ` +
      `(${Math.round(width)}×${Math.round(height)} for a ` +
      `${Math.round(box!.width)}×${Math.round(box!.height)} box)`,
  ).toEqual({ width: true, height: true });
  await page.screenshot({ path: `${SHOTS}/${id}.png`, clip: { x, y, width, height } });
}

test.describe("@probe · the on-device perf probe", () => {
  // 15 s of recording plus the beats between segments, and the run has to
  // finish before the results shot can be taken.
  test.setTimeout(120_000);

  test("idle, running, results", async ({ page }) => {
    await page.goto("/");
    const slab = page.locator("#hifth-perf");
    await expect(slab).toBeVisible();
    await stageReady(page);

    // 1. Idle. What you should see the moment the LAN URL opens: the mushaf as
    //    normal, plus the slab. The two together are the shot — a crop of the
    //    slab alone would not answer "am I on the probe build?", which is the
    //    only question step 1 asks.
    await screen(page, "probe-idle");

    // 2. Running. Captured mid-segment rather than during the one-second
    //    «استعد» beat: the countdown under an instruction is the state the
    //    reader has to recognise, and it is the state they will be in for
    //    fifteen of the next sixteen seconds.
    // Nothing drives the page during the run. On a phone the frames come from a
    // finger; here they come from the compositor, which keeps ticking rAF at
    // ~120 fps in headless with the page untouched — measured, not assumed (the
    // assertion below is what holds it). Driving it with synthetic pans was the
    // first attempt and it photographed a page shoved into a corner with an ayah
    // accidentally selected: a picture of the harness, not of the check.
    await page.getByRole("button", { name: "ابدأ" }).click();
    await expect(slab.locator(".count")).toBeVisible();
    await expect(slab.locator(".big")).toHaveText("مرّر الصفحة بإصبع واحد", {
      timeout: 10_000,
    });
    await screen(page, "probe-running");

    // 3. Results. The table only exists once all three segments have run.
    const table = slab.locator("table");
    await expect(table).toBeVisible({ timeout: 40_000 });

    // A results shot that reads «too few frames — not driven» would teach the
    // reader that an undriven segment is what a finished run looks like. It is
    // the one outcome the runbook tells them to re-run, so it must never be the
    // picture of success.
    await expect(table).not.toContainText("too few frames");
    await expect(slab.locator("textarea")).toHaveValue(/"check": "perf-verdict-on-device"/);
    await screen(page, "probe-results");
  });
});

test.describe("@app · the screens a runbook step describes", () => {
  test("a selected ayah, its rail, and a hop popover", async ({ page }) => {
    await page.goto("/#/hafs-kfqc/2:48");
    await stageReady(page);
    await expect(page.getByRole("button", { name: /الآية الحالية البقرة · ٢:٤٨/ })).toBeVisible();
    // The ink has to have landed, or this photographs an unselected page.
    await expect(page.locator("#hifth-overlay .hl-sel")).not.toHaveCount(0);
    await screen(page, "ayah-selected");

    const rail = page.getByRole("group", { name: "روابط الآية" });
    await expect(rail).toBeVisible();
    // Chips, not an empty rail: the step this illustrates is about how the
    // chips read, so a rail with nothing in it illustrates nothing.
    await expect(rail.getByRole("button")).not.toHaveCount(0);
    await cropAround(page, rail, "hop-rail", 56);

    await rail.getByRole("button", { name: /متشابهات في السورة/ }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: /انتقل إلى/ }).first()).toBeVisible();
    await crop(sheet, "hop-popover");
  });

  test("the trail, after a cross-page hop", async ({ page }) => {
    // `via` is the share-link form of "I arrived here from there", which is
    // exactly the state a bead records — reachable without driving the whole
    // tap → rail → popover → hop sequence again.
    await page.goto("/#/hafs-kfqc/2:123?via=2:48");
    await stageReady(page);
    const trail = page.locator('footer[aria-label="المسار"]');
    await expect(trail).toBeVisible();
    await expect(trail.getByRole("button", { name: /ارجع إلى/ })).not.toHaveCount(0);
    await crop(trail, "trail-beads");
  });

  test("the colophon: the source offer, and the credits", async ({ page }) => {
    await page.goto("/");
    await stageReady(page);
    await page.getByRole("button", { name: /عن حِفظ/ }).click();
    const sheet = page.getByRole("dialog", { name: "عن حِفظ" });
    await expect(sheet).toBeVisible();

    // One section each, not the whole sheet twice. Two steps send the reader to
    // two different named sections, and a crop of the sheet is a picture of both
    // — at this viewport it fits without scrolling, so the two ids resolved to
    // the same image and the second step illustrated nothing. A shot has to
    // photograph the thing its step names.
    const block = (heading: string) =>
      sheet.locator("section").filter({ has: page.getByRole("heading", { name: heading }) });

    // Padded, because the sheet's padding is on the sheet and not on the
    // sections inside it: clipped to its own box, a credit line touches both
    // edges of the picture and reads as one that was cut off. Nothing is cut
    // (the rows measure 398 px inside a 398 px section) — but a reader cannot
    // tell "flush" from "truncated", and doubting the picture is doubting the
    // step.
    const source = block("الرخصة والمصدر");
    await expect(source.getByRole("link", { name: /الشيفرة المصدرية/ })).toBeVisible();
    await cropAround(page, source, "colophon-source", 12);

    const credits = block("المصادر");
    await expect(credits.locator('a[href="http://corpus.quran.com"]')).toBeVisible();
    await cropAround(page, credits, "colophon-credits", 12);
  });
});
