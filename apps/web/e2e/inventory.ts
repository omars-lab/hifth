import type { Browser, BrowserContext, Page } from "@playwright/test";
import type { CompactManifest } from "@hifth/core";

/**
 * A build with a hole in it, on demand.
 *
 * Loop 4b vendored all 604 pages, and that closed a surface the app was
 * deliberately built to have: the facing leaf that says «صفحة N ليست في هذه
 * النسخة», the page bar's «المتوفّر …», `nearestPage`'s announcement, the hop
 * chip that is shown and disabled. None of that is dead code — it is what the
 * *next* edition will look like on the day it arrives partial, exactly as
 * `hafs-kfqc` did for six loops, and it is what `docs/design/desktop.md` §4
 * promised. Deleting the tests because today's corpus is complete would leave
 * the promise standing with nothing behind it.
 *
 * So the scarcity is manufactured instead of assumed. The compact manifest is
 * an ayah→page table (`packages/core/src/manifest.ts`) in which "this edition
 * does not carry that ayah" is written as page `0`; zeroing every entry that
 * points at page 8 makes `expandManifest` emit a corpus with no page 8 in it,
 * which is bit-for-bit the shape Loop 0 shipped. Nothing in the app is told it
 * is under test.
 *
 * Two things this has to do that a bare `page.route` cannot:
 *
 *   • **Block the service worker.** `assets/manifest.json` is in the precache
 *     list (`vite.config.ts`) and the worker uses `clientsClaim`, so a
 *     controlled page reads the manifest from the cache and never issues a
 *     request for `page.route` to see. The interception would be a silent
 *     no-op and the test would go green asserting nothing — the same trap
 *     `page-turn.spec.ts`'s «a turn to a page that never arrives» documents.
 *   • **Own the context**, because that is where `serviceWorkers` is set. The
 *     caller gets both back and must close the context.
 *
 * `browser.newContext` under @playwright/test still applies the project's
 * `use` block, so a desktop-project caller gets 1440×900 and a phone caller
 * gets its device — the fixture changes the corpus and nothing else.
 */
export async function contextWithout(
  browser: Browser,
  missing: readonly number[],
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const gone = new Set(missing);

  await context.route("**/assets/manifest.json", async (route) => {
    const res = await route.fetch();
    const wire = (await res.json()) as CompactManifest;
    // Fail loudly rather than fulfilling an unchanged body. If the ETL ever
    // writes the full shape again, `ayahPages` is undefined, `.map` throws
    // here, and the test says so — instead of passing against a complete
    // corpus while claiming to test a partial one.
    if (!Array.isArray(wire.ayahPages)) {
      throw new Error("manifest is not the compact shape — this fixture cannot trim it");
    }
    await route.fulfill({
      json: { ...wire, ayahPages: wire.ayahPages.map((p) => (gone.has(p) ? 0 : p)) },
    });
  });

  return { context, page: await context.newPage() };
}
