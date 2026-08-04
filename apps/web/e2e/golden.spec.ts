import { test, expect, type Locator, type Page } from "@playwright/test";
import { COACH_STORAGE_KEY } from "../src/coach";

/*
 * Golden-image regression over the highlight geometry (PLAN follow-up ③, moved
 * here from Loop 5).
 *
 * What this covers that nothing else can: the *shape and colour of the paint*.
 * The DOM tests already assert that `.hl-sel` exists, that a range produced
 * `.hl-hlt` marks, that the marquee rect appears and disappears. None of them
 * can see that a swipe lands along the middle of its line, that the breadcrumb's
 * dashed verdigris outline still reads as quieter than the amber selection, or
 * that a mark landed in the overlay's coordinate space rather than 3 px off it.
 *
 * It is also the only gate that can see a *blend*. `mix-blend-mode: multiply` is
 * what makes the amber read as ink over scripture rather than as a slab across
 * it, and the difference between those two is invisible to every assertion that
 * looks at the DOM: same elements, same classes, same computed styles. Only a
 * picture shows whether you can still read the ayah under the mark.
 *
 * Scope of a shot: the **page SVG element only** — mushaf geometry plus the
 * `#hifth-overlay` marks. Deliberately not the chrome: the rail, the sheets
 * and the trail are text, they are asserted by role and name elsewhere, and
 * they would make every baseline hostage to font rendering. The SVG corpus is
 * outlined paths with no `<text>` (the `gate:notext` CI rule guarantees it), so
 * a baseline here is nearly pure geometry.
 *
 * **That paragraph was a statement of intent that the harness did not keep, and
 * the gap cost a loop.** An element screenshot photographs the element's *box on
 * the page*, not the element's own painting: the stage SVG is scaled to fill the
 * window, so the header, the trail and the page bar all sit inside its box and
 * inside every baseline recorded before this comment. Nobody could see that from
 * here, which is exactly how it went wrong — `ef86c0a` changed the page bar's
 * inventory from 604 overlapping opaque ticks to one run bar at `opacity: 0.55`,
 * had no reason to think it had touched a *geometry* baseline, and shipped
 * without re-recording one. The result was not a red gate. It was ~2.3k pixels
 * of permanent difference against a 2 487-pixel budget (`maxDiffPixelRatio:
 * 0.005` over 559×890), i.e. **every shot in this file quietly spending ~94% of
 * its tolerance on a control that this file says it does not photograph** — and
 * then two of them failing on the first small thing that landed on top.
 *
 * So `CHROME` is masked, and the claim above is now true by construction. The
 * masked rects are painted a flat colour before the comparison, so no future
 * change to the header, the trail or the bar can spend the geometry gate's
 * budget again; each of those surfaces is asserted by role and name in its own
 * spec, which is where a change to them should show up. The lesson generalises
 * past this file: a tolerance is only a tolerance while nothing is standing on
 * it, and a gate that is 94% consumed reports "pass" right up until it doesn't.
 *
 * The axes are `SKINS × SHOTS`. Only `plain` exists today; a tajweed skin adds
 * one entry to SKINS and the whole matrix re-generates with new file names —
 * no test is re-authored, and no existing baseline is invalidated.
 */

/**
 * A skin is a stylesheet swap over identical geometry (PLAN §5). The tajweed
 * row is literally `{ id: "tajweed", param: "skin=tajweed" }`: the matrix
 * doubles, the new baselines are new files, and every existing one still holds
 * — which is the point of asserting geometry the skin must not move.
 *
 * Deliberately not added yet, on two conditions that are not about this file:
 *
 *   1. `skin=tajweed` is not a readable link param today, and it must not
 *      become a plain one just to satisfy a test. The skin is opt-in per
 *      session precisely so a beta annotation layer cannot arrive via someone
 *      else's shared link; a production-readable param re-opens that by a
 *      different door. Gate the reader on a test-only flag.
 *   2. The palette is beta pending a hafiz sign-off — the one event most
 *      likely to move hue, wash opacity and dash pattern. Baselines committed
 *      before it would make the gate's first real firing the expected,
 *      ignorable kind, which is how a team learns to reflex-`--update-snapshots`.
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
 * Page 7 only, and not for lack of ambition: the marquee is a dashed rect in
 * the overlay's coordinate space, so a second page would re-photograph the same
 * code path. The shot needs a page with nothing selected on it, which is what
 * the bare `#/<edition>/p<N>` form gives — it used to update the header and the
 * mounted set without moving the *visible* page, so page 7 was picked because
 * it is the page the app cold-opens on and therefore the one page where the bug
 * did not show. That is fixed (`showPage`, 8b39fa2) and deep-link.spec.ts holds
 * the line, so any page would work now; page 7 stays because a second marquee
 * baseline would cost bytes and catch nothing.
 */
const MARQUEES = [{ page: 7, from: "#verse-46", to: "#verse-47" }] as const;

/** The visible page's SVG — the only host not `display: none` (PageStage). */
function stage(page: Page, pageNo: number): Locator {
  return page.locator(`svg[aria-labelledby="page-label-${pageNo}"]:visible`);
}

/**
 * The three chrome surfaces that overlap the stage's box, masked out of every
 * shot (see the scope note at the top of this file).
 *
 * Selected by landmark rather than by CSS-module class, because a mask that
 * silently stops matching does not fail — it just puts the chrome back in the
 * baseline, which is the failure mode this exists to end. `header` and `footer`
 * are one element each in the app shell; the bar is the only `nav` holding a
 * range input, and it is a `nav` because it is the second way through the book
 * (PageSlider).
 */
function chrome(page: Page): Locator[] {
  return [
    page.locator("header"),
    page.locator("footer"),
    page.locator("nav:has(input[type='range'])"),
  ];
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
  await page.addInitScript((coachKey: string) => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        persist: async () => true,
        persisted: async () => true,
        estimate: async () => ({ usage: 1_000_000, quota: 40 * 1024 * 1024 * 1024 }),
      },
    });
    // Mark the coach marks seen. A first-run tour on top of the stage is a fine
    // thing to ship and a terrible thing to photograph — it is asserted by role
    // in its own spec.
    try {
      localStorage.setItem(coachKey, "1");
    } catch {
      /* private mode — nothing to seed */
    }
  }, COACH_STORAGE_KEY);
  await page.goto(`/#/hafs-kfqc/${hash}`);
  const svg = stage(page, pageNo);
  // Generous: a deep link to a page other than the cold-open one has to fetch
  // ~160 KB of SVG, and the selection's hop targets queue their own pages behind
  // it. Under parallel workers the default 5s is a coin-flip, and a golden
  // harness that flakes on *arrival* teaches people to re-run it.
  await expect(svg).toBeVisible({ timeout: 20_000 });
  await page.addStyleTag({ content: '[role="dialog"] { visibility: hidden !important; }' });
  await settle(svg);
  // A shot named `breadcrumb` must not be able to photograph a frame without
  // one. The crumb is not painted with the page: `PageStage` draws it in an
  // effect that needs the *origin* ayah's page mounted, so it can lose a race
  // with that mount and `settle` will still return true — the stage is not
  // moving, it is just wrong. That is not hypothetical; it is what failed in
  // the Linux container while every local run was green, and it only became
  // visible once the masked chrome gave the tolerance back.
  //
  // It was also not "slow, so late". The effect read the mounted set through a
  // ref, so losing the race once meant the crumb never arrived at all — a real
  // defect on any shared `?via=` link, fixed in `PageStage.mountPage` and held
  // by `share-a11y.spec.ts`, which reproduces the losing order on purpose
  // rather than waiting for a slow machine to supply it. This assertion stays
  // anyway: it is what turned an unexplained image diff into that finding.
  if (hash.includes("via=")) {
    await expect(page.locator("#hifth-overlay .hl-crumb").first()).toBeVisible();
  }
  return svg;
}

/**
 * Wait until the stage stops moving.
 *
 * Visible is not the same as still: mounting a page is followed by a centring
 * tween, and a hop adds a pan on top of it. A shot taken during either one
 * photographs a frame that depends on how fast the machine got here — which is
 * how a golden gate turns into a coin flip, and how the same shot ended up
 * framing different parts of the page on macOS and in the Linux container.
 * Two consecutive identical boxes is the cheapest honest definition of "at
 * rest"; the tween moves the box every frame while it runs.
 */
async function settle(target: Locator): Promise<void> {
  let last = "";
  await expect
    .poll(
      async () => {
        const box = await target.boundingBox();
        const now = JSON.stringify(box);
        const stable = now === last;
        last = now;
        return stable;
      },
      { intervals: [100, 100, 100, 150, 200, 300], timeout: 10_000 },
    )
    .toBe(true);
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
        await expect(svg).toHaveScreenshot(`p${shot.page}-${shot.state}-${skin.id}.png`, {
          mask: chrome(page),
        });
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

        // Corner to corner, not centre to centre. The ayah polygons are
        // line-slabs stacked vertically, so both centres share almost the same
        // x and the marquee came out a hairline of zero width — a rectangle
        // with no area is not a photograph of a marquee. Sweeping from the
        // start of one line to the end of the next is also what a reader's
        // drag actually looks like.
        const startX = from!.x + from!.width * 0.9;
        const endX = to!.x + to!.width * 0.1;

        // Hold past LONG_PRESS_MS (350 in @hifth/core) so the stroke latches as
        // a marquee, then stop mid-drag with the button still down: the live
        // dashed rect is only on screen while the finger is.
        await page.mouse.move(startX, from!.y + from!.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(550);
        await page.mouse.move(endX, to!.y + to!.height / 2, { steps: 12 });

        // Existence is not the thing being photographed. The rect is created
        // the moment the stroke latches, with zero size, and only takes its
        // geometry from a later pointermove — so `toHaveCount(1)` returns while
        // there is still nothing to see. Wait for real area instead, or the
        // baseline records whatever the machine's speed happened to allow.
        const marquee = page.locator("#hifth-overlay rect.hl-marquee");
        await expect
          .poll(async () => {
            const box = await marquee.boundingBox();
            return box ? Math.round(box.width * box.height) : 0;
          })
          .toBeGreaterThan(1_000);
        await expect(host).toHaveScreenshot(`p${m.page}-marquee-${skin.id}.png`, {
          mask: chrome(page),
        });
        await page.mouse.up();
      });
    }
  });
}
