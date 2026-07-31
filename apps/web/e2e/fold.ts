import type { Page } from "@playwright/test";

/*
 * Watching the fold — shared by the phone spec that asks *what the band says* and
 * the desktop spec that asks *how far it reaches*.
 *
 * Both questions are about a band that exists for 240 ms and then removes
 * itself, and one of them is usually about a band that must never exist at all.
 * That rules out polling: "I looked twice and saw nothing" is a weaker claim
 * than "nothing was ever added", and a 240 ms sweep is comfortably long enough
 * to be missed by two `expect`s and comfortably short enough to be missed by
 * one. So the recorder is a `MutationObserver` armed before the app boots, and
 * every sighting is measured at the instant of insertion — by then the element
 * is in the document and has a box, and a moment later it is animating.
 */

/** One band, as it looked the moment the app put it on the stage. */
export interface FoldSighting {
  /** The word it carried: `crease`, `gap` or `hole`. Never `none` — see §3.4. */
  word: string;
  /**
   * The `data-testid` of the element it was inserted into, or null for one that
   * has none. This is the whole of docs/design/page-transition.md §3.5: on a
   * desktop spread the band belongs to the open book (`page-book`) and on a
   * phone it belongs to the single stage, which carries `data-leaf` instead.
   */
  host: string | null;
  /** `data-leaf` of the host, for the phone case where there is no testid. */
  hostLeaf: string | null;
  /** The band's own width at insertion, and its host's. Both in CSS pixels. */
  width: number;
  hostWidth: number;
}

interface FoldWindow {
  __folds: FoldSighting[];
}

/**
 * Arm the recorder. Call before `goto` — an init script runs once per document,
 * and a band inserted by the very first turn is one this file exists to catch.
 */
export async function watchFolds(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: FoldSighting[] = [];
    (window as unknown as FoldWindow).__folds = seen;
    const note = (node: Node): void => {
      if (!(node instanceof HTMLElement) || !node.hasAttribute("data-fold")) return;
      const host = node.parentElement;
      seen.push({
        word: node.getAttribute("data-fold") ?? "",
        host: host?.getAttribute("data-testid") ?? null,
        hostLeaf: host?.getAttribute("data-leaf") ?? null,
        width: node.getBoundingClientRect().width,
        hostWidth: host?.getBoundingClientRect().width ?? 0,
      });
    };
    // `document`, not `document.documentElement`. An init script runs before the
    // document has an element to hand — `documentElement` is null at that
    // moment, `observe(null)` throws, and the whole recorder is silently gone
    // while `__folds` still answers `[]`. That reads as "no band was ever
    // inserted", which is exactly what several rows assert, so the wrong target
    // here would have turned both specs into rubber stamps.
    new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) note(n);
    }).observe(document, { subtree: true, childList: true });
  });
}

/** Every band inserted so far, in order. */
export const foldsSeen = (page: Page): Promise<FoldSighting[]> =>
  page.evaluate(() => (window as unknown as FoldWindow).__folds.slice());

/** Just the words, for the rows that only care what was said. */
export const foldWords = async (page: Page): Promise<string[]> =>
  (await foldsSeen(page)).map((f) => f.word);
