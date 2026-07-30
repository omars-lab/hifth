import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { tapAyah } from "./ayah";

/*
 * The revision map, against a real build — task #91, under umbrella #88.
 *
 * `RevisionMap.test.tsx` renders the sheet over `fake-indexeddb` and proves the
 * picture is drawn correctly. It cannot prove the two things that make the
 * feature real, because both of them span a page load:
 *
 *   1. **A tap becomes a durable look.** The unit test hands the component a
 *      record. Here the record is made by touching the mus'haf, and read back by
 *      a browser that has been reloaded — the same journey the hafiz makes when
 *      they close the app and open it a week later. A store that wrote to memory
 *      would pass every unit test in the repo and lose a year of history.
 *   2. **An emptied record still says how old it is.** Task #90's whole defence
 *      against iOS's seven-day sweep is that the map is dated: a record that was
 *      wiped this morning must read as a *young* record, not as "you have
 *      revised nothing". The wipe itself is one CDP call, the same instrument
 *      `offline.spec.ts` uses to take the caches.
 *
 * Chromium only, for the second test's sake — CDP's Storage domain is Chromium's
 * — but the first test runs everywhere, because "does a tap survive a reload" is
 * exactly the question WebKit answers differently.
 */

/** Open the map from where a reader finds it: the page chip in the chrome. */
async function openMap(page: Page) {
  await page.getByRole("button", { name: /ما فتحتَه من المصحف/ }).tap();
  const sheet = page.getByRole("dialog", { name: "ما فتحتَه من المصحف" });
  await expect(sheet).toBeVisible();
  return sheet;
}

/** The cell for one hizb, found by the name a screen reader would hear. */
function hizb(sheet: ReturnType<Page["getByRole"]>, name: RegExp) {
  return sheet.getByRole("list", { name: "خريطة المصحف" }).getByRole("listitem", { name });
}

test.describe("Hifth · the revision map", () => {
  test("a tap on an ayah is still on the map after a reload", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();

    // Before: page 7 is vendored, so hizb 1 is *here* — and never opened. That
    // is the distinction the whole component is built around, and asserting it
    // first is what makes the assertion after the tap mean something.
    let sheet = await openMap(page);
    await expect(hizb(sheet, /^الحزب ١ · لم يُفتح$/)).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    await tapAyah(page, "#verse-55");
    await recorded(page);

    // Reload before looking. A record held in React state would pass without
    // this line, which is the entire point of the line.
    await page.reload();
    await expect(page.locator("svg[role='group']").first()).toBeVisible();

    sheet = await openMap(page);
    await expect(hizb(sheet, /^الحزب ١ · فُتح اليوم$/)).toHaveCount(1);
    // Hizb 3 has no vendored paper — pages 7 and 9 are in hizb 1, page 19 is in
    // hizb 2, and nothing else is here. It must not be sitting in the same grey
    // as a hizb the reader neglected: 601 of 604 pages are absent, and if absent
    // read as cold the picture would tell a hafiz they had abandoned the Qur'an.
    await expect(hizb(sheet, /^الحزب ٣ · غير متوفّر في هذه النسخة$/)).toHaveCount(1);
    // Counted in the unit on screen, and counting only what is here — the page
    // bar's «المتوفّر ٣ من ٦٠٤ صفحة» one division coarser.
    await expect(sheet.getByText("المتوفّر ٢ من ٦٠ حزب")).toBeVisible();
  });

  test("a wiped record reads as a young record, not as an empty one", async ({
    page,
    context,
  }) => {
    test.skip(
      test.info().project.name === "iphone",
      "CDP's Storage domain is Chromium-only, as it is in offline.spec.ts",
    );

    await page.goto("/");
    await expect(page.locator("svg[role='group']").first()).toBeVisible();
    await tapAyah(page, "#verse-55");
    await recorded(page);

    let sheet = await openMap(page);
    await expect(hizb(sheet, /^الحزب ١ · فُتح اليوم$/)).toHaveCount(1);
    await page.keyboard.press("Escape");

    // Take the record the way an ITP sweep does. Only IndexedDB: the caches are
    // a different failure with its own tests, and clearing them here would be
    // testing two things and learning which one broke from neither.
    await wipe(page, context);
    await page.reload();
    await expect(page.locator("svg[role='group']").first()).toBeVisible();

    sheet = await openMap(page);
    // The history is gone — that part is not preventable, and the app does not
    // pretend otherwise.
    await expect(hizb(sheet, /^الحزب ١ · لم يُفتح$/)).toHaveCount(1);
    // But the sheet is dated. This is the line that stops an empty map from
    // reading as an accusation: `since` is stamped when the store is *opened*,
    // so a record wiped this morning is visibly one morning old rather than a
    // year of revision that never happened.
    //
    // What this cannot stage is the eight-day-old record that a sweep empties;
    // that is `offline-survival-8-day` in the ledger, and it needs a phone and a
    // week. What it does pin is the invariant that makes that case survivable —
    // the map never renders an empty picture without saying how long it has been
    // recording.
    await expect(sheet.getByText(/^يُسجَّل منذ ٢٠[٠-٩]{2}-[٠-٩]{2}-[٠-٩]{2}$/)).toBeVisible();
  });
});

/**
 * Wait until a tap has actually reached storage.
 *
 * `recordLook` is fired and forgotten from the tap handler — deliberately, so
 * that a write never sits inside a gesture — which means a `reload()` issued a
 * millisecond later can outrun the transaction. That is a race in the test and
 * not in the app: nothing reloads a phone out from under a reader mid-tap. It
 * showed up as one Chromium run in eight failing at "still on the map after a
 * reload", which is the worst possible way for it to show up, because the honest
 * failure of that same assertion is the bug the test exists to catch.
 *
 * So the wait is here rather than in the assertion's timeout: the sheet reads
 * the record once when it opens, so retrying the *assertion* re-queries a DOM
 * that will never change. Waiting for the row first is what makes the assertion
 * after the reload mean "it was stored, and it survived".
 *
 * `expect.poll` over `page.evaluate`, deliberately, and not `waitForFunction`:
 * that one's raf poller does not await a returned promise, so an async probe
 * hands it a Promise object, which is truthy, and it succeeds on the first tick
 * no matter what the database holds. Written that way this helper passed even
 * when moved *above* the tap — a wait that never waits, which is worse than no
 * wait at all. `evaluate` does await, so the boolean this returns is the answer.
 */
async function recorded(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const req = indexedDB.open("hifth.revision.v1");
            // No store yet means no tap has landed yet. Roll the creation back,
            // or this probe leaves a schema-less database at version 1 behind —
            // which the app would then open without an upgrade and never be
            // able to write to, turning a flaky test into a broken one.
            req.onupgradeneeded = () => req.transaction?.abort();
            req.onerror = () => resolve(false);
            req.onsuccess = () => {
              const db = req.result;
              if (!db.objectStoreNames.contains("days")) {
                db.close();
                return resolve(false);
              }
              const all = db.transaction("days").objectStore("days").getAll();
              all.onerror = () => {
                db.close();
                resolve(false);
              };
              all.onsuccess = () => {
                const days = all.result as { events?: readonly unknown[] }[];
                db.close();
                resolve(days.some((day) => (day.events?.length ?? 0) > 0));
              };
            };
          }),
      ),
    )
    .toBe(true);
}

/** Take this origin's IndexedDB, the way an ITP sweep or a quota purge would. */
async function wipe(page: Page, context: BrowserContext): Promise<void> {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Storage.clearDataForOrigin", {
    origin: new URL(page.url()).origin,
    storageTypes: "indexeddb",
  });
}
