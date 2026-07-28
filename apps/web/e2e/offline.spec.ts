import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { tapAyah } from "./ayah";
import { COACH_STORAGE_KEY } from "../src/coach";

/*
 * Loop 6a, the ungated half of the exit criterion (PLAN §Loop 6a):
 *   a page you have visited still opens when the network is gone.
 *
 * Pin-a-juz packs are Loop 6b (they need the corpus of Loop 4b — pinning a juz
 * while three pages are vendored is theatre). What is testable today is the
 * foundation and, just as importantly, its failure paths: a denied
 * `persist()` and a browser that clears site data on close both have to render
 * as UI rather than as a console warning nobody reads.
 *
 * Chromium only. Playwright's WebKit does not run our service worker against
 * the preview server the way a real iOS Safari does, and `setOffline` does not
 * reach WebKit's network stack — a green WebKit run here would be a lie, and a
 * red one would be about the harness. The iOS half of offline is a device
 * check: the 8+ day ITP survival test, which is Loop 6b's, on hardware.
 */

const PAGE_7_SVG = "/assets/pages/hafs-kfqc/7.svg";

/** Resolve once the service worker is installed AND controlling this page. */
async function awaitController(page: Page): Promise<void> {
  await page.waitForFunction(
    async () => {
      const reg = await navigator.serviceWorker.ready;
      return reg.active !== null && navigator.serviceWorker.controller !== null;
    },
    undefined,
    { timeout: 30_000 },
  );
}

/** True once `url` is in any Cache Storage bucket (precache or runtime). */
async function awaitCached(page: Page, url: string): Promise<void> {
  await page.waitForFunction(
    async (needle: string) => {
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        if (keys.some((r) => r.url.includes(needle))) return true;
      }
      return false;
    },
    url,
    { timeout: 30_000 },
  );
}

test.describe("Hifth · offline", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "service-worker + offline emulation is Chromium-only in Playwright",
  );

  test("a visited page still opens with the network offline", async ({ page, context }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    await awaitController(page);

    // The first visit installs the SW mid-flight, so some of its requests were
    // already in the air uncontrolled. One online reload is the honest
    // "you have visited this page" state: everything now goes through the SW.
    await page.reload();
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    await awaitCached(page, PAGE_7_SVG);
    await awaitCached(page, "/assets/manifest.json");

    await context.setOffline(true);
    try {
      await page.reload();

      // The shell came from the precache, the registry with it, and the mushaf
      // page from the runtime cache — assert on real geometry, since a
      // navigation fallback would also render *a* shell.
      await expect(page.locator("svg[role='group']").first()).toBeVisible();
      await expect(page.locator("#verse-54:visible")).toHaveCount(1);
      await expect(page.locator("header .numeric")).toHaveText("7");

      // …and the app is still an instrument offline, not a picture: tapping an
      // ayah surfaces its rail, which means the adjacency shard came out of the
      // data cache too.
      await tapAyah(page, "#verse-54:visible");
      await expect(page.getByRole("group", { name: "روابط الآية" })).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });

  test("an offline hop lands on a page whose SVG was cached alongside it", async ({
    page,
    context,
  }) => {
    // Selecting 2:48 mounts its hop targets' pages (PLAN §4 DOM budget), which
    // is also what fills the page cache ahead of the leap. Offline, the leap
    // must therefore still work — this is the behaviour "visited pages survive"
    // is actually for.
    await page.goto("/#/hafs-kfqc/2:48");
    await awaitController(page);
    await page.reload();
    await expect(page.getByRole("button", { name: /الآية الحالية البقرة · ٢:٤٨/ })).toBeVisible();
    await awaitCached(page, "/assets/pages/hafs-kfqc/19.svg");

    await context.setOffline(true);
    try {
      const rail = page.getByRole("group", { name: "روابط الآية" });
      await rail.getByRole("button", { name: /متشابهات في السورة/ }).tap();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /انتقل إلى البقرة · ٢:١٢٣/ })
        .tap();
      await expect(page.locator("header .numeric")).toHaveText("19");
      await expect(
        page.getByRole("button", { name: /الآية الحالية البقرة · ٢:١٢٣/ }),
      ).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });
});

/*
 * Research follow-up ④ (docs/research/2026-07-27-unattended-validation.md §3.3).
 *
 * The ledger's `offline-survival-8-day` check asks a human to leave a phone
 * alone for eight days and see whether the app is still there. The eight days
 * are not automatable — ITP's sweep timer lives in the browser process, so
 * `page.clock` cannot fast-forward it, and ITP Debug Mode only logs. But the
 * eight days were never the interesting part. Both of that check's `tunes` are
 * about the app's *reaction* to eviction, and eviction itself is one CDP call:
 * `Storage.clearDataForOrigin` takes an origin's bytes out from under a live
 * page, which is what a sweep does. The waiting was the only thing standing
 * between us and the assertions.
 *
 * That turned out to matter, because the two tests below were both red when
 * they were written. What they now pin:
 *
 *   1. Eviction is survivable at all. Workbox fills the precache in the service
 *      worker's `install` handler; eviction takes the bytes but leaves the
 *      registration, so the worker never installs again and the shell never
 *      comes back. Runtime caches refill on demand, so online everything looks
 *      fine — and the next offline launch is the browser's own error page.
 *      Measured before the fix: three reloads and an explicit
 *      `registration.update()` all left the precache empty.
 *   2. The app never claims a page it is not showing. Offline with an evicted
 *      cache is how a *vendored* page fails to fetch, which is the one case
 *      that gets past App's resolver gate.
 */
test.describe("Hifth · eviction", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "CDP's Storage domain is Chromium-only, as is the rest of this file",
  );

  /** Take this origin's storage, the way an ITP sweep or a quota purge would. */
  async function evict(page: Page, context: BrowserContext): Promise<void> {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Storage.clearDataForOrigin", {
      origin: new URL(page.url()).origin,
      // Not "all": that unregisters the worker too, which is a *harsher* state
      // than eviction and one the app cannot respond to because it never boots.
      // Taking the caches and leaving the registration is the case with a
      // survivor in it, and the one the app is responsible for.
      storageTypes: "cache_storage",
    });
  }

  /** Warm the shell, the registry and page 7 into cache, SW controlling. */
  async function warm(page: Page): Promise<void> {
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    await awaitController(page);
    await page.reload();
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    await awaitCached(page, PAGE_7_SVG);
    await awaitCached(page, "/assets/manifest.json");
  }

  test("an evicted shell is rebuilt, so offline still works afterwards", async ({
    page,
    context,
  }) => {
    await warm(page);
    await evict(page, context);

    // Nothing is asked of the reader here — this is the repair, and the reader
    // never knew anything was wrong. `index.html` is the assertion because it
    // is the navigation fallback: it is exactly the entry whose absence turns
    // an offline launch into the browser's error page.
    await page.reload();
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    await awaitCached(page, "/index.html");
    await awaitCached(page, "/assets/manifest.json");
    await awaitCached(page, PAGE_7_SVG);
    // Then wait for the tab to go quiet. The repair reloads itself once the
    // refill is confirmed, and that reload is the whole precondition: going
    // offline while the refill is still in flight tests the wreckage, not the
    // repair — an offline boot mid-install serves `index.html` (the first entry
    // written) and then no scripts (the last), which renders exactly nothing.
    await page.waitForLoadState("networkidle");
    // A refilled precache in front of an uncontrolled page serves nobody: the
    // navigation request never reaches the worker that holds it.
    await awaitController(page);

    // The claim is not "a cache exists", it is "offline still works" — so go
    // offline and boot cold, which is the promise Loop 6a actually made.
    await context.setOffline(true);
    try {
      await page.reload();
      await expect(page.locator("svg[role='group']").first()).toBeVisible();
      await expect(page.locator("#verse-54:visible")).toHaveCount(1);
      await expect(page.locator("header .numeric")).toHaveText("7");
    } finally {
      await context.setOffline(false);
    }
  });

  test("a page that would not load is said, not silently swapped for another", async ({
    page,
    context,
  }) => {
    await warm(page);
    await evict(page, context);
    await context.setOffline(true);
    try {
      // Page 19 is vendored — the resolver resolves it and App's chip gating
      // lets it through — but its bytes are gone and there is no network. The
      // failure mode this pins: the chrome moves to ١٩, the fetch fails, and
      // the stage keeps page 7. A reader mid-review would be told they are on
      // 19 while looking at 7, and a screen-reader user would be told it out
      // loud with nothing on screen to contradict it.
      await page.evaluate(() => {
        window.location.hash = "#/hafs-kfqc/p19";
      });

      const alert = page.getByRole("alert");
      await expect(alert).toBeVisible();
      await expect(alert).toContainText("تعذّر تحميل صفحة ١٩");

      // And the stage still holds the page it really has, rather than a blank.
      await expect(page.locator("svg[aria-labelledby='page-label-7']")).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });
});

test.describe("Hifth · storage durability, as UI", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "StorageManager overrides + the notice are exercised on Chromium",
  );

  /**
   * Replace StorageManager before any app code runs, and mark the coach marks
   * seen. The second half is not incidental setup: the notice is *held* while
   * the coach strip is up, because both are strips in the layout above the
   * stage and stacked they cost a third of a phone's stage. These tests are
   * about which sentence the banner picks, so they start where a reader is by
   * their second visit — the case where the strips share a screen has its own
   * test below.
   */
  async function stubStorage(
    page: Page,
    opts: { persisted: boolean; quota: number },
  ): Promise<void> {
    await page.addInitScript(
      ({
        persisted,
        quota,
        coachKey,
      }: {
        persisted: boolean;
        quota: number;
        coachKey: string;
      }) => {
        Object.defineProperty(navigator, "storage", {
          configurable: true,
          value: {
            persist: async () => persisted,
            persisted: async () => persisted,
            estimate: async () => ({ usage: 1_000_000, quota }),
          },
        });
        try {
          localStorage.setItem(coachKey, "1");
        } catch {
          /* private mode — the strip does not show there either */
        }
      },
      { ...opts, coachKey: COACH_STORAGE_KEY },
    );
  }

  test("the storage warning waits for the coach strip to finish teaching", async ({ page }) => {
    // The Loop 6a merge defect, as a test. Two agents each added a strip *in*
    // the layout above the stage, each for the same good reason — neither may
    // cover an ayah. Together they took 226px of a 412×839 phone: the stage
    // dropped from 713px to 487px on precisely the visit where a reader is
    // deciding what this app is. They take turns now, teaching first.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "storage", {
        configurable: true,
        value: {
          persist: async () => false,
          persisted: async () => false,
          estimate: async () => ({ usage: 1_000_000, quota: 40 * 1024 * 1024 * 1024 }),
        },
      });
    });
    await page.goto("/");

    const coach = page.getByRole("region", { name: "كيف تتنقّل" });
    await expect(coach).toBeVisible();
    await expect(page.locator("[data-notice]")).toHaveCount(0);

    await coach.getByRole("button", { name: "تخطَّ" }).click();
    await expect(coach).toHaveCount(0);

    // Held, not cancelled: the same warning is still owed once the band is free.
    await expect(page.locator("[data-notice]")).toHaveAttribute("data-notice", "best-effort");
  });

  test("a denied persist() renders a warning, not a console message", async ({ page }) => {
    await stubStorage(page, { persisted: false, quota: 40 * 1024 * 1024 * 1024 });
    await page.goto("/");
    const notice = page.locator("[data-notice]");
    await expect(notice).toHaveAttribute("data-notice", "best-effort");
    await expect(notice).toContainText("غير مضمون");

    // Dismissible, and it stays dismissed — a warning that returns every launch
    // is a warning nobody reads.
    await notice.getByRole("button", { name: "إخفاء التنبيه" }).click();
    await expect(page.locator("[data-notice]")).toHaveCount(0);
    await page.reload();
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    await expect(page.locator("[data-notice]")).toHaveCount(0);
  });

  test("a capped quota is called out ahead of everything else", async ({
    page,
  }) => {
    // ~300 MB is Chromium's cap when "clear cookies and site data when you
    // close all windows" is on. Note the grant is *true* here: the cap wins,
    // because nothing survives the browser closing either way.
    await stubStorage(page, { persisted: true, quota: 300 * 1024 * 1024 });
    await page.goto("/");
    const notice = page.locator("[data-notice]");
    await expect(notice).toHaveAttribute("data-notice", "capped");
    await expect(notice).toContainText("عند إغلاق كل النوافذ");
  });

  test("a persisted origin is told nothing at all", async ({ page }) => {
    await stubStorage(page, { persisted: true, quota: 40 * 1024 * 1024 * 1024 });
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    await expect(page.locator("[data-notice]")).toHaveCount(0);
  });
});
