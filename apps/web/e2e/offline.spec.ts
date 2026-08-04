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

/**
 * Take this origin's storage, the way an ITP sweep or a quota purge would.
 *
 * Shared by the eviction tests and the pack tests below, and deliberately not
 * copied into either: the `storageTypes` choice is an argument, not a setting.
 * Not "all" — that unregisters the worker too, which is a *harsher* state than
 * eviction and one the app cannot respond to because it never boots. Taking the
 * caches and leaving the registration is the case with a survivor in it, and
 * the one the app is responsible for. It also leaves IndexedDB standing, which
 * is what makes a swept pack *detectable* rather than merely absent: the
 * register still says which files juz 1 was made of.
 */
async function evict(page: Page, context: BrowserContext): Promise<void> {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Storage.clearDataForOrigin", {
    origin: new URL(page.url()).origin,
    storageTypes: "cache_storage",
  });
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

/*
 * Loop 6b's exit criterion, minus the eight days (task #137).
 *
 * The two describes above prove the *foundation*: a page you have visited still
 * opens offline, and the shell comes back after a sweep. A pack claims something
 * neither of them does — that a juz you deliberately kept opens offline
 * **including its pages you have never been to**. That is the promise a hafiz on
 * a plane is relying on, and nothing above tests it, because everything above
 * only ever caches what browsing happened to touch.
 *
 * `PackShelf.test.tsx` renders the shelf over `fake-indexeddb` and a hand-built
 * Cache Storage, and proves the picture is drawn correctly. It cannot prove the
 * three things that make the feature real, all of which span a page load or a
 * browser API the fake does not have:
 *
 *   1. **The pack is what serves the page.** In the unit test, "cached" is a
 *      Map. Here it is asserted by name — the file must be in `hifth-pack-v1`
 *      and in no other bucket before the network is cut, so a green offline
 *      navigation cannot be the runtime cache quietly covering for us.
 *   2. **A real sweep is noticed.** The register survives in IndexedDB, the
 *      bytes do not, and the app has to find the difference across a cold boot
 *      rather than in the same tick that wrote them.
 *   3. **`torn` is counted against real Cache Storage.** The state that matters
 *      most is the one that half-works, and the fake could agree with a wrong
 *      implementation of `cache.keys()` all day.
 *
 * The eight days themselves stay a device check (`offline-survival-8-day` in the
 * ledger). ITP's timer lives in the browser process; what it *does* when it
 * fires is `Storage.clearDataForOrigin`, and that is one CDP call away.
 */
test.describe("Hifth · a pinned juz", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "service-worker + offline emulation + CDP is Chromium-only, as above",
  );

  const PACK_CACHE = "hifth-pack-v1";
  // Juz 1 runs 1:1–2:141, so the page the app opens on is inside it and page 15
  // is too — while being nowhere near page 7's hop targets, which is what makes
  // it a page the reader has genuinely never been to. Both halves are asserted
  // below rather than assumed.
  const PAGE_15_SVG = "/assets/pages/hafs-kfqc/15.svg";

  /** Which Cache Storage buckets hold `url` — by name, which is the assertion. */
  async function cachedIn(page: Page, url: string): Promise<string[]> {
    return await page.evaluate(async (needle: string) => {
      const hits: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        if (keys.some((r) => r.url.includes(needle))) hits.push(name);
      }
      return hits;
    }, url);
  }

  /**
   * Leave `url` in the pack and nowhere else.
   *
   * Pinning writes the file twice, and finding that out is worth the paragraph:
   * `pinPack` fetches through the page, the service worker sees an ordinary page
   * request, and its `hifth-pages` route caches it as well. So a juz costs its
   * bytes twice for a while, and a 21-page pin pushes most of the reader's
   * browsing trail out of that 32-entry LRU on its way through. Neither breaks
   * anything — `packedFetch` reads the pack first, and the LRU is a convenience
   * — but the duplicate is exactly what would let this test pass without a pack
   * at all.
   *
   * Deleting the copy is therefore not a workaround; it is the state the pack
   * exists for. Thirty-two pages of ordinary reading evicts the trail copy on
   * its own, and the day the reader opens the app in the air, the pack is the
   * only thing that still has page 15.
   */
  async function dropOutsidePack(page: Page, url: string): Promise<void> {
    await page.evaluate(
      async ({ needle, keep }: { needle: string; keep: string }) => {
        for (const name of await caches.keys()) {
          if (name === keep) continue;
          const cache = await caches.open(name);
          for (const req of await cache.keys()) {
            if (req.url.includes(needle)) await cache.delete(req);
          }
        }
      },
      { needle: url, keep: PACK_CACHE },
    );
  }

  /**
   * Start where a reader is on their second visit.
   *
   * The coach strip *holds* the storage notice — they are both strips above the
   * stage and stacked they cost a third of a phone — so a test about which
   * sentence the banner picks has to start after the teaching is done. Same
   * reasoning as `stubStorage` below; the strips sharing a screen has its own
   * test there.
   */
  async function seenCoachMarks(page: Page): Promise<void> {
    await page.addInitScript((key: string) => {
      try {
        localStorage.setItem(key, "1");
      } catch {
        /* private mode — the strip does not show there either */
      }
    }, COACH_STORAGE_KEY);
  }

  /** The sheet, opened the way a reader opens it: the page chip in the chrome. */
  async function openShelf(page: Page) {
    await page.getByRole("button", { name: /ما فتحتَه من المصحف/ }).tap();
    const sheet = page.getByRole("dialog", { name: "ما فتحتَه من المصحف" });
    await expect(sheet).toBeVisible();
    return sheet;
  }

  /**
   * Warm the shell, then keep the juz the reader is standing in.
   *
   * Waits for `whole`, not for the button to disappear: a pin that wrote four of
   * twenty-three files also makes the offer vanish, and every test below would
   * then be measuring a torn pack while claiming to measure a whole one.
   */
  async function pinJuzHere(page: Page): Promise<void> {
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    await awaitController(page);
    await page.reload();
    await expect(page.locator("svg[role='group']").first()).toBeVisible();

    const sheet = await openShelf(page);
    // Juz scope, because a pack *is* a juz and the shelf is not rendered at the
    // other two. Pressing the radio is also the assertion that it is reachable.
    await sheet.getByRole("radio", { name: "جزء" }).tap();
    await sheet.getByRole("button", { name: "احفظ الجزء ١ هنا" }).tap();
    await expect(sheet.locator("[data-health]")).toHaveAttribute("data-health", "whole", {
      timeout: 90_000,
    });

    // Escape, deliberately, and not the ✕. Keeping a juz removes the very button
    // the reader pressed — the offer goes when the pack arrives — and a sheet
    // whose Escape handler lived on its own subtree lost its keyboard exit with
    // it: focus falls to <body>, silently, with no blur to react to. This closed
    // with a pointer only until the handler moved to the document (RevisionMap);
    // leaving the ✕ here would have let it break again without a sound.
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  }

  test("opens a page the reader has never visited, with the network gone", async ({
    page,
    context,
  }) => {
    await seenCoachMarks(page);
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();

    // The premise, asserted rather than assumed: nothing has put page 15
    // anywhere. If a future prefetch reaches it, this line fails here — where
    // it reads as "pick another page" — instead of turning the offline
    // navigation below into a test that passes for the wrong reason.
    expect(await cachedIn(page, PAGE_15_SVG)).toEqual([]);

    await pinJuzHere(page);

    expect(await cachedIn(page, PAGE_15_SVG)).toContain(PACK_CACHE);
    // …and in the pack *only*, so a green run below cannot be the browsing cache
    // quietly covering for us. See `dropOutsidePack`: this is not a contrivance,
    // it is where a pinned juz stands after any real session of reading.
    await dropOutsidePack(page, PAGE_15_SVG);
    expect(await cachedIn(page, PAGE_15_SVG)).toEqual([PACK_CACHE]);

    await context.setOffline(true);
    try {
      // Cold boot, then go somewhere new. Not a reload of page 15 — the reader
      // in the aeroplane opens the app and *then* decides where to revise.
      await page.reload();
      await expect(page.locator("svg[role='group']").first()).toBeVisible();
      await page.evaluate(() => {
        window.location.hash = "#/hafs-kfqc/p15";
      });

      await expect(page.locator("svg[aria-labelledby='page-label-15']")).toBeVisible();
      await expect(page.locator("header .numeric")).toHaveText("15");
      // And it is still an instrument, not a picture. Selecting works, and the
      // juz's adjacency came down with its paper — asserted on the cache rather
      // than by looking for a rail, because whether *this* ayah has edges is a
      // fact about the corpus, and a test that quietly depended on it would go
      // red the next time the mutashabihat data is rebuilt.
      await tapAyah(page, "#verse-101:visible");
      await expect(page.getByRole("button", { name: /الآية الحالية/ })).toBeVisible();
      expect(await cachedIn(page, "/assets/adj/hafs-kfqc/2.json")).toContain(PACK_CACHE);
    } finally {
      await context.setOffline(false);
    }
  });

  test("a sweep is said out loud, and the juz can be put back", async ({ page, context }) => {
    await seenCoachMarks(page);
    await pinJuzHere(page);
    await evict(page, context);

    // The shell repairs itself first (see the eviction describe above) and
    // reloads once the refill lands, so wait for the tab to go quiet before
    // looking — otherwise the assertion races a navigation.
    await page.reload();
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    await awaitController(page);

    // The register outlived the bytes, which is the only reason there is
    // anything to say. Everything else the strip can say is a warning about
    // storage that *may* go; this one is a loss already taken, and it outranks
    // them for exactly that reason.
    const notice = page.locator("[data-notice]");
    await expect(notice).toHaveAttribute("data-notice", "pack-gone");
    await expect(notice).toContainText("لم تعد في هذا الجهاز");

    // The action opens the shelf. It deliberately does not start a download: a
    // banner tap that spends several megabytes, with no size on screen and
    // possibly on cellular, is a thing readers learn not to press.
    await notice.getByRole("button", { name: "اعرض المحفوظ" }).tap();
    const sheet = page.getByRole("dialog", { name: "ما فتحتَه من المصحف" });
    await expect(sheet).toBeVisible();
    // Landed at juz scope without a press — `openAt`. Arriving at hizb scope
    // would put the reader one press from the thing the strip sent them for, on
    // a sheet where the shelf is not even rendered.
    await expect(sheet.getByRole("radio", { name: "جزء" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    const row = sheet.locator("[data-health]");
    await expect(row).toHaveAttribute("data-health", "gone");

    // Re-pin from the register's own url list. It is the list that went missing,
    // not a fresh plan — which is also why this works when the manifest itself
    // was swept.
    await row.getByRole("button", { name: "احفظه من جديد" }).tap();
    await expect(row).toHaveAttribute("data-health", "whole", { timeout: 90_000 });
    // The bytes are really back, not just the register's opinion of them. `gone`
    // was read off Cache Storage a moment ago, so `whole` has to be too.
    expect(await cachedIn(page, PAGE_15_SVG)).toContain(PACK_CACHE);
  });

  test("a pack the sweep only half took is not left looking kept", async ({ page }) => {
    await seenCoachMarks(page);
    await pinJuzHere(page);

    // A quota purge is not all-or-nothing, and this is the shape that gets past
    // people: twenty of twenty-three pages still open, so the juz behaves until
    // the reader reaches one of the three. Deleting from the live cache is
    // exactly what one looks like from inside the tab — nothing is told.
    const kept = await page.evaluate(async (name: string) => {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      for (const req of keys.slice(0, 3)) await cache.delete(req);
      return keys.length - 3;
    }, PACK_CACHE);
    expect(kept).toBeGreaterThan(0);

    await page.reload();
    await expect(page.locator("svg[role='group']").first()).toBeVisible();

    // `torn` counts as swept for the strip. Most of a juz is not a juz, and the
    // reader would otherwise find the hole in aeroplane mode, at the page they
    // were revising.
    await expect(page.locator("[data-notice]")).toHaveAttribute("data-notice", "pack-gone");

    const sheet = await openShelf(page);
    await sheet.getByRole("radio", { name: "جزء" }).tap();
    const row = sheet.locator("[data-health]");
    await expect(row).toHaveAttribute("data-health", "torn");
    // Not colour alone — the sentence says it too, and says how much is left
    // (WCAG 1.4.1). The count is read off real Cache Storage, not off a Map.
    await expect(row).toContainText("ناقص");
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
