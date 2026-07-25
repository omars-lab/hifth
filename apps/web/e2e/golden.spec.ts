import { test, expect, type Locator, type Page } from "@playwright/test";

/*
 * Golden-image regression over the highlight geometry (PLAN follow-up ③, moved
 * here from Loop 5).
 *
 * What this covers that nothing else can: the *shape and colour of the paint*.
 * The DOM tests already assert that `.hl-sel` exists, that a range produced two
 * `.hl-hlt` clones, that the marquee rect appears and disappears. None of them
 * can see that the wash traces the ayah's polygon, that the breadcrumb's dashed
 * verdigris outline still reads as quieter than the amber selection, or that a
 * clone landed in the overlay's coordinate space rather than 3 px off it.
 *
 * Scope of a shot: the **page SVG element only** — mushaf geometry plus the
 * `#hifth-overlay` clones. Deliberately not the chrome: the rail, the sheets
 * and the trail are text, they are asserted by role and name elsewhere, and
 * they would make every baseline hostage to font rendering. The SVG corpus is
 * outlined paths with no `<text>` (the `gate:notext` CI rule guarantees it), so
 * a baseline here is nearly pure geometry.
 *
 * The axes are `SKINS × SHOTS`. Only `plain` exists today; a tajweed skin adds
 * one entry to SKINS and the whole matrix re-generates with new file names —
 * no test is re-authored, and no existing baseline is invalidated.
 */

/**
 * A skin is a stylesheet swap over identical geometry (PLAN §5), and the §7
 * link grammar already carries it as `?skin=`. So the tajweed row is literally
 * `{ id: "tajweed", param: "skin=tajweed" }` once the skin ships: the matrix
 * doubles, the new baselines are new files, and every existing one still holds
 * — which is the point of asserting geometry the skin must not move.
 */
const SKINS = [{ id: "plain", param: "" }] as const;

/** The vendored pages, with the ayahs each shot drives (see manifest.json). */
const SHOTS = [
  // page 7 — 2:38–2:48. 2:40 and 2:47 are a same-page hop pair, so the
  // breadcrumb and the selection are both visible in one frame.
  { page: 7, state: "selection", link: "2:47" },
  { page: 7, state: "breadcrumb", link: "2:40?via=2:47" },
  { page: 7, state: "phrase", link: "2:47-2:48" },
  // page 9 — 2:58–2:61, the shortest page: four big polygons, so a mis-scaled
  // clone shows up here first.
  { page: 9, state: "selection", link: "2:58" },
  { page: 9, state: "breadcrumb", link: "2:59?via=2:58" },
  { page: 9, state: "phrase", link: "2:58-2:59" },
  // page 19 — 2:120–2:126, the densest of the three.
  { page: 19, state: "selection", link: "2:122" },
  { page: 19, state: "breadcrumb", link: "2:123?via=2:122" },
  { page: 19, state: "phrase", link: "2:121-2:122" },
] as const;

/**
 * Adjacent polygon pairs to drag the live marquee across.
 *
 * Page 7 only, and not for lack of ambition: the marquee is a viewport-space
 * dashed rect, so a second page would re-photograph the same code path. The
 * shot needs a page with nothing selected on it, and the only link form that
 * gives one — the bare `#/<edition>/p<N>` page — currently updates the header
 * and the mounted set but not the *visible* page (PageStage mounts the initial
 * page once and thereafter follows `navigateTo`, which the `select: null`
 * restore branch never calls). Page 7 is the page the app cold-opens on, so it
 * is the one page where the bare form happens to agree with what is on screen.
 * Worth fixing; not worth encoding the bug into a baseline.
 */
const MARQUEES = [{ page: 7, from: "#verse-54", to: "#verse-55" }] as const;

/** The visible page's SVG — the only host not `display: none` (PageStage). */
function stage(page: Page, pageNo: number): Locator {
  return page.locator(`svg[aria-labelledby="page-label-${pageNo}"]:visible`);
}

/**
 * Open a link and settle the stage. The sheets are hidden rather than closed:
 * closing a range's menu drops the highlight with it (App.tsx), and the menu's
 * own contents are covered by `range.spec`. `visibility` keeps layout identical
 * whether a sheet is in flow or fixed, so hiding it can never move the stage.
 */
async function open(page: Page, hash: string, pageNo: number): Promise<Locator> {
  // Report the origin as already-persisted so the storage notice stays silent.
  // Not cosmetic: whether it renders depends on a `beforeinstallprompt` that a
  // headless run may or may not fire, and a baseline must not depend on a race.
  // (Its own appearance is asserted in offline.spec.ts.)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        persist: async () => true,
        persisted: async () => true,
        estimate: async () => ({ usage: 1_000_000, quota: 40 * 1024 * 1024 * 1024 }),
      },
    });
    // Mark the coach marks seen (CoachMarks.COACH_STORAGE_KEY). A first-run
    // tour on top of the stage is a fine thing to ship and a terrible thing to
    // photograph — it is asserted by role in its own spec.
    try {
      localStorage.setItem("hifth.coach.v1", "1");
    } catch {
      /* private mode — nothing to seed */
    }
  });
  await page.goto(`/#/hafs-kfqc/${hash}`);
  const svg = stage(page, pageNo);
  // Generous: a deep link to a page other than the cold-open one has to fetch
  // ~160 KB of SVG, and the selection's hop targets queue their own pages behind
  // it. Under parallel workers the default 5s is a coin-flip, and a golden
  // harness that flakes on *arrival* teaches people to re-run it.
  await expect(svg).toBeVisible({ timeout: 20_000 });
  await page.addStyleTag({ content: '[role="dialog"] { visibility: hidden !important; }' });
  return svg;
}

/** Append a skin's query param to a link that may already carry `?via=`. */
function withSkin(link: string, param: string): string {
  if (!param) return link;
  return link.includes("?") ? `${link}&${param}` : `${link}?${param}`;
}

for (const skin of SKINS) {
  test.describe(`golden · ${skin.id}`, () => {
    for (const shot of SHOTS) {
      test(`page ${shot.page} · ${shot.state}`, async ({ page }) => {
        const svg = await open(page, withSkin(shot.link, skin.param), shot.page);
        await expect(svg).toHaveScreenshot(`p${shot.page}-${shot.state}-${skin.id}.png`);
      });
    }

    for (const m of MARQUEES) {
      test(`page ${m.page} · marquee`, async ({ page }) => {
        // The bare-page link form (`#/…/p9`) puts the page on screen with
        // nothing selected — the marquee must be the only paint in the frame.
        const host = await open(page, withSkin(`p${m.page}`, skin.param), m.page);

        const from = await page.locator(`${m.from}:visible`).boundingBox();
        const to = await page.locator(`${m.to}:visible`).boundingBox();
        expect(from).not.toBeNull();
        expect(to).not.toBeNull();

        // Hold past LONG_PRESS_MS (350 in @hifth/core) so the stroke latches as
        // a marquee, then stop mid-drag with the button still down: the live
        // dashed rect is only on screen while the finger is.
        await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(550);
        await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 12 });
        await expect(page.locator("#hifth-overlay rect.hl-marquee")).toHaveCount(1);
        await expect(host).toHaveScreenshot(`p${m.page}-marquee-${skin.id}.png`);
        await page.mouse.up();
      });
    }
  });
}
