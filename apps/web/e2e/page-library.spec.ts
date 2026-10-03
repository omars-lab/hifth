import { test, expect } from "@playwright/test";

/*
 * The app draws its screens with Preact's small copy of React, not React's own
 * page-drawing library (docs/performance.md, item 18): the same components, about
 * 38 KB less for every first visit to download. Which library ended up in the
 * start-up script is only known after bundling, so this reads the built script's
 * source map. The rest of the suite is what proves the components still behave.
 */

test.use({ serviceWorkers: "block" });

test("the start-up script carries Preact, and none of React's own library", async ({ page }) => {
  await page.goto("/");
  const src = await page.locator('script[type="module"][src]').first().getAttribute("src");
  expect(src, "the page names its start-up script").toBeTruthy();
  const map = await (await page.request.get(`${new URL(src!, page.url()).href}.map`)).json();
  const sources: string[] = map.sources;
  // Guard against a map that names nothing (the check would pass without looking).
  expect(sources.some((s) => s.endsWith("src/App.tsx"))).toBe(true);
  expect(sources.filter((s) => /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?react-dom\//.test(s))).toEqual([]);
  expect(sources.filter((s) => /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?react\//.test(s))).toEqual([]);
  expect(sources.some((s) => /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?preact\//.test(s))).toBe(true);
});
