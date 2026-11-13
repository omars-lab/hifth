import { test, expect, type BrowserContext, type Page } from "@playwright/test";

/*
 * Carrying a reader's marks from the old address to hifth.app (apps/web/src/moved.ts).
 *
 * A browser keeps a site's saved things under its exact address, so one server
 * reached as "localhost" and as "127.0.0.1" is two separate sites with two
 * separate stores: here, the old address and the new. Both are named in each
 * page's own storage as stand-ins, which the app honours only over plain http.
 *
 * Written 2026-11-12 with the carry; the bookmarks-hook test beside it was
 * watched failing first (a bookmark loaded before the saved ones were read in
 * replaced them on disk). All three kinds of mark are checked on disk after a
 * reload, since each is saved by its own code and read in at its own pace.
 */

const DB = "hifth.bookmarks.v1";
const KEY = (v: string) => `quran/hafs-kfqc/${v}`;

function bookmark(id: string, page: number) {
  return { id, key: KEY(`2:${page}`), page, name: `made-up ${id}`, timeline: [{ at: 1, what: "dropped", page }] };
}

function note(id: string, verse: string) {
  return {
    id,
    kind: "comment",
    scope: { type: "page", edition: "hafs-kfqc", page: 7 },
    text: `Made up words ${id}`,
    verses: [{ key: KEY(verse), addedAt: 1_000, spot: { page: 7, word: 2, x: 210, y: 180, onHarakah: false } }],
    createdAt: 1_000,
    updatedAt: 1_000,
    usedAt: 1_000,
  };
}

function jump(id: string, from: string, to: string) {
  return {
    id,
    from: { key: KEY(from), word: 3 },
    to: { key: KEY(to) },
    times: [{ at: 1_000, device: "d-test" }],
    state: "sometimes",
    createdAt: 1_000,
    updatedAt: 1_000,
  };
}

interface Marks {
  bookmarks: unknown[];
  notes: unknown[];
  jumps: unknown[];
}

async function putMarks(page: Page, marks: Marks): Promise<void> {
  await page.evaluate(
    ({ db, marks }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(db);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("sets", "readwrite");
          const sets = tx.objectStore("sets");
          sets.put({ id: "mine", bookmarks: marks.bookmarks });
          sets.put({ id: "scoped-notes", notes: marks.notes });
          sets.put({ id: "confusions", confusions: marks.jumps });
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { db: DB, marks },
  );
}

/** The ids of every mark saved at this page's address, read from disk, each kind sorted. */
async function savedIds(page: Page): Promise<{ bookmarks: string[]; notes: string[]; jumps: string[] }> {
  return page.evaluate(
    (db) =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open(db);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          if (!open.result.objectStoreNames.contains("sets")) {
            open.result.close();
            resolve({ bookmarks: [], notes: [], jumps: [] });
            return;
          }
          const sets = open.result.transaction("sets").objectStore("sets");
          const ids = (key: string, field: string) =>
            new Promise<string[]>((res, rej) => {
              const get = sets.get(key);
              get.onsuccess = () => res(((get.result?.[field] ?? []) as { id: string }[]).map((m) => m.id).sort());
              get.onerror = () => rej(get.error);
            });
          Promise.all([ids("mine", "bookmarks"), ids("scoped-notes", "notes"), ids("confusions", "confusions")])
            .then(([bookmarks, notes, jumps]) => {
              open.result.close();
              resolve({ bookmarks, notes, jumps });
            })
            .catch(reject);
        };
      }),
    DB,
  );
}

interface Seam {
  page: number;
  at: number;
}

/** Where the reader left off at this page's address: the red ribbon, kept beside the bookmarks. */
async function putSeam(page: Page, seam: Seam): Promise<void> {
  await page.evaluate(
    ({ db, seam }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(db);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("sets", "readwrite");
          tx.objectStore("sets").put({ id: "seam", ...seam });
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { db: DB, seam },
  );
}

async function savedSeam(page: Page): Promise<Seam | null> {
  return page.evaluate(
    (db) =>
      new Promise<Seam | null>((resolve, reject) => {
        const open = indexedDB.open(db);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          if (!open.result.objectStoreNames.contains("sets")) {
            open.result.close();
            resolve(null);
            return;
          }
          const get = open.result.transaction("sets").objectStore("sets").get("seam");
          get.onsuccess = () => {
            open.result.close();
            const r = get.result as (Seam & { id: string }) | undefined;
            resolve(r ? { page: r.page, at: r.at } : null);
          };
          get.onerror = () => reject(get.error);
        };
      }),
    DB,
  );
}

const RECORD_DB = "hifth.revision.v1";

/** Looks at this page's address, as the app records them: one row per day. Made-up verses, recent days. */
async function putLooks(page: Page, n: number): Promise<void> {
  await page.evaluate(
    ({ db, n }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(db, 1);
        open.onupgradeneeded = () => {
          open.result.createObjectStore("days", { keyPath: "day" });
          open.result.createObjectStore("meta", { keyPath: "id" });
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("days", "readwrite");
          for (let i = 0; i < n; i++) {
            const at = Date.now() - (i + 1) * 86_400_000;
            const day = new Date(at).toISOString().slice(0, 10);
            tx.objectStore("days").put({ day, events: [{ key: `quran/hafs-kfqc/2:${40 + i}`, page: 7, at, tz: 0 }] });
          }
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { db: RECORD_DB, n },
  );
}

/**
 * How many looks this page's address holds. Counting never makes the database:
 * an empty one left behind here would have no room for the app to write into.
 */
async function lookCount(page: Page): Promise<number> {
  return page.evaluate(
    (db) =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open(db);
        open.onupgradeneeded = () => open.transaction?.abort();
        open.onerror = () => (open.error?.name === "AbortError" ? resolve(0) : reject(open.error));
        open.onsuccess = () => {
          if (!open.result.objectStoreNames.contains("days")) {
            open.result.close();
            resolve(0);
            return;
          }
          const all = open.result.transaction("days").objectStore("days").getAll();
          all.onsuccess = () => {
            open.result.close();
            resolve((all.result as { events: unknown[] }[]).reduce((n, d) => n + d.events.length, 0));
          };
          all.onerror = () => reject(all.error);
        };
      }),
    RECORD_DB,
  );
}

/** Waits until the tab has reloaded once, which laying carried settings does. */
async function reloaded(tab: Page) {
  await expect
    .poll(() =>
      tab
        .evaluate(() => (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming).type)
        .catch(() => "navigating"),
    )
    .toBe("reload");
}

/** Both stand-in addresses for every page in the test's browser, popups included, in English. */
async function standIns(context: BrowserContext, baseURL: string | undefined) {
  const port = new URL(baseURL!).port;
  const addresses = { old: `http://localhost:${port}`, next: `http://127.0.0.1:${port}` };
  await context.addInitScript((addresses) => {
    localStorage.setItem("hifth.lang.v1", "en");
    localStorage.setItem("hifth.moved.addresses.v1", JSON.stringify(addresses));
  }, addresses);
  return addresses;
}

test("the old address carries bookmarks, notes and jumps to the new one, keeping what the new one had", async ({
  page,
  context,
  baseURL,
}) => {
  const { old, next } = await standIns(context, baseURL);

  // The new address already holds one of each of its own.
  const ahead = await context.newPage();
  await ahead.goto(`${next}/#/hafs-kfqc/p7`);
  await expect(ahead.getByTestId("moved-sheet")).toHaveCount(0);
  await putMarks(ahead, {
    bookmarks: [bookmark("b-new", 9)],
    notes: [note("n-new", "2:40")],
    jumps: [jump("j-new", "2:58", "7:161")],
  });
  await ahead.close();

  // The old address holds two bookmarks, a note and a jump.
  await page.goto(`${old}/#/hafs-kfqc/p7`);
  await putMarks(page, {
    bookmarks: [bookmark("b-old-1", 5), bookmark("b-old-2", 6)],
    notes: [note("n-old", "2:39")],
    jumps: [jump("j-old", "2:59", "2:35")],
  });
  await page.reload();

  const sheet = page.getByTestId("moved-sheet");
  await expect(sheet).toBeVisible();
  const opened = context.waitForEvent("page");
  await sheet.getByRole("button", { name: "Carry them to hifth.app" }).click();
  const arrived = await opened;

  await expect(sheet.getByRole("status")).toHaveText("4 items carried to hifth.app");
  await expect(sheet.getByRole("link", { name: "Open hifth.app" })).toBeVisible();
  await expect(arrived.getByText("4 items came across from the old address")).toBeAttached();

  const all = {
    bookmarks: ["b-new", "b-old-1", "b-old-2"],
    notes: ["n-new", "n-old"],
    jumps: ["j-new", "j-old"],
  };
  await expect.poll(() => savedIds(arrived)).toEqual(all);

  // A reload of the new page keeps all of it and does not take the file again,
  // and the old page, reopened, offers hifth.app rather than a second carry.
  await arrived.reload();
  await expect(arrived.getByText(/came across from the old address/)).toHaveCount(0);
  await expect.poll(() => savedIds(arrived)).toEqual(all);
  await page.reload();
  await expect(page.getByTestId("moved-sheet").getByRole("link", { name: "Open hifth.app" })).toBeVisible();
});

// Found 2026-11-12 (hifth-app-site ⑧): the carry brought the marks but not the
// place, so a hafiz landed on page one of hifth.app and had to find their page
// again by hand. The new tab now opens where they left off.
// The old page records the page it sits on as the reader's place after a few
// seconds, as it would for a real reader, so each test opens it on page 250.
test("the new address opens where the reader left off at the old one", async ({ page, context, baseURL }) => {
  const { old } = await standIns(context, baseURL);
  await page.goto(`${old}/#/hafs-kfqc/p250`);
  await putSeam(page, { page: 250, at: 2_000 });
  await page.reload();

  const opened = context.waitForEvent("page");
  await page.getByTestId("moved-sheet").getByRole("button", { name: "Carry them to hifth.app" }).click();
  const arrived = await opened;

  await expect(arrived).toHaveURL(/#\/hafs-kfqc\/p250$/);
  await expect.poll(async () => (await savedSeam(arrived))?.page).toBe(250);
});

// Found 2026-11-12 (hifth-app-site ⑧): the carry left the reader's settings
// behind, so hifth.app opened with none of the choices they had made. Settings
// are read as the app starts, so the new tab reloads once they are laid; the
// reload must wait until the marks and the place are saved, or it cuts them off.
test("the reader's settings come across too, and the reload they need loses nothing", async ({
  page,
  context,
  baseURL,
}) => {
  const { old } = await standIns(context, baseURL);
  await page.goto(`${old}/#/hafs-kfqc/p250`);
  await putMarks(page, {
    bookmarks: [bookmark("b-old-1", 5), bookmark("b-old-2", 6)],
    notes: [note("n-old", "2:39")],
    jumps: [jump("j-old", "2:59", "2:35")],
  });
  await putSeam(page, { page: 250, at: 2_000 });
  await page.evaluate(() => localStorage.setItem("hifth.app.pages.v1", "row"));
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Pages of the app" })).toBeVisible();

  const opened = context.waitForEvent("page");
  await page.getByTestId("moved-sheet").getByRole("button", { name: "Carry them to hifth.app" }).click();
  const arrived = await opened;
  await reloaded(arrived);

  await expect(arrived.getByRole("navigation", { name: "Pages of the app" })).toBeVisible();
  // The reload must not swallow the line that says what came across.
  await expect(arrived.getByText("4 items came across from the old address")).toBeAttached();
  expect(await arrived.evaluate(() => localStorage.getItem("hifth.app.pages.v1"))).toBe("row");
  // This card's own record of the carry stays at the old address.
  expect(await arrived.evaluate(() => localStorage.getItem("hifth.moved.carried.v1"))).toBeNull();
  await expect(arrived).toHaveURL(/#\/hafs-kfqc\/p250$/);
  await expect.poll(async () => (await savedSeam(arrived))?.page).toBe(250);
  await expect
    .poll(() => savedIds(arrived))
    .toEqual({ bookmarks: ["b-old-1", "b-old-2"], notes: ["n-old"], jumps: ["j-old"] });
});

// The setting the owner noticed missing: the language. Only the old address
// has one here, so the new one would otherwise open in the device's language.
test("the language chosen at the old address is the one hifth.app opens in", async ({ page, context, baseURL }) => {
  const port = new URL(baseURL!).port;
  const addresses = { old: `http://localhost:${port}`, next: `http://127.0.0.1:${port}` };
  await context.addInitScript((addresses) => {
    localStorage.setItem("hifth.moved.addresses.v1", JSON.stringify(addresses));
    if (location.origin === addresses.old && !localStorage.getItem("hifth.lang.v1"))
      localStorage.setItem("hifth.lang.v1", "ar");
  }, addresses);
  await page.goto(`${addresses.old}/#/hafs-kfqc/p7`);
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");

  const opened = context.waitForEvent("page");
  await page.getByTestId("moved-sheet").getByRole("button").first().click();
  const arrived = await opened;
  await reloaded(arrived);

  // The page's own markup already says Arabic before the app runs, so the proof
  // is the app's line about what came across, written in Arabic after the reload.
  await expect(arrived.getByText(/من العنوان القديم/)).toBeAttached();
  await expect(arrived.locator("html")).toHaveAttribute("lang", "ar");
  expect(await arrived.evaluate(() => localStorage.getItem("hifth.lang.v1"))).toBe("ar");
});

// Owner, 2026-11-12: the reader decides who sees their data. What they have
// opened (which ayahs, when, and where they marked a mistake) goes to hifth.app
// only when they tick the box that says so; "Carry them" alone never sends it,
// and the box stays on the card afterwards so it can still be sent later.
test("what the reader has opened goes only when they tick the box for it, and can be sent later", async ({
  page,
  context,
  baseURL,
}) => {
  const { old } = await standIns(context, baseURL);
  await page.goto(`${old}/#/hafs-kfqc/p7`);
  await putMarks(page, { bookmarks: [bookmark("b-old", 5)], notes: [], jumps: [] });
  await putLooks(page, 3);
  await page.reload();

  // Carried without the box: the marks go, the record stays.
  const sheet = page.getByTestId("moved-sheet");
  const box = sheet.getByRole("checkbox", { name: /Also send what I have opened/ });
  await expect(box).not.toBeChecked();
  let opened = context.waitForEvent("page");
  await sheet.getByRole("button", { name: "Carry them to hifth.app" }).click();
  const first = await opened;
  await expect(sheet.getByRole("status")).toHaveText("1 item carried to hifth.app");
  await expect.poll(() => savedIds(first)).toMatchObject({ bookmarks: ["b-old"] });
  expect(await lookCount(first)).toBe(0);

  // The box is still there; ticked, the card offers to send just that.
  await box.check();
  opened = context.waitForEvent("page");
  await sheet.getByRole("button", { name: "Send what I have opened" }).click();
  const second = await opened;
  await expect(sheet.getByRole("status")).toContainText("What you have opened went too.");
  await expect.poll(() => lookCount(second)).toBe(3);
  await expect(box).toHaveCount(0);
  await expect(sheet.getByRole("link", { name: "Open hifth.app" })).toBeVisible();

  // Sent again (the card forgot it had), nothing is counted twice.
  await page.evaluate(() => localStorage.removeItem("hifth.moved.record.v1"));
  await page.reload();
  await page.getByTestId("moved-sheet").getByRole("checkbox", { name: /Also send what I have opened/ }).check();
  opened = context.waitForEvent("page");
  await page.getByTestId("moved-sheet").getByRole("button", { name: "Send what I have opened" }).click();
  const third = await opened;
  await expect(page.getByTestId("moved-sheet").getByRole("status")).toContainText("What you have opened went too.");
  await expect.poll(() => lookCount(third)).toBe(3);
});

test("a place the new address already has, newer than the old one's, is kept", async ({ page, context, baseURL }) => {
  const { old, next } = await standIns(context, baseURL);
  const ahead = await context.newPage();
  await ahead.goto(`${next}/#/hafs-kfqc/p9`);
  // Newer than anything the old page could record while this test runs.
  const later = Date.now() + 10 * 60_000;
  await putSeam(ahead, { page: 300, at: later });
  await ahead.close();

  await page.goto(`${old}/#/hafs-kfqc/p250`);
  await putSeam(page, { page: 250, at: 2_000 });
  await page.reload();

  const opened = context.waitForEvent("page");
  await page.getByTestId("moved-sheet").getByRole("button", { name: "Carry them to hifth.app" }).click();
  const arrived = await opened;

  await expect(arrived).toHaveURL(/#\/hafs-kfqc\/p300$/);
  await expect.poll(() => savedSeam(arrived)).toEqual({ page: 300, at: later });
});

// A slow phone: the old page answers only after the new tab has sat on its first
// page long enough to record it as read. That first page must not beat the place
// the reader actually left off.
test("a slow carry still opens where the reader left off", async ({ page, context, baseURL }) => {
  const { old } = await standIns(context, baseURL);
  await page.goto(`${old}/#/hafs-kfqc/p250`);
  await putSeam(page, { page: 250, at: 2_000 });
  await page.reload();
  await expect(page.getByTestId("moved-sheet")).toBeVisible();
  // Keep the old address's store busy writing for 8 s: it cannot read the place,
  // so it cannot answer, until then. Plain storage, so every browser is slowed alike.
  await page.evaluate(
    (db) =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open(db);
        open.onsuccess = () => {
          const sets = open.result.transaction("sets", "readwrite").objectStore("sets");
          const until = Date.now() + 8_000;
          const spin = () => {
            if (Date.now() < until) sets.get("nothing").onsuccess = spin;
            else open.result.close();
          };
          spin();
          resolve();
        };
      }),
    DB,
  );

  const opened = context.waitForEvent("page");
  await page.getByTestId("moved-sheet").getByRole("button", { name: "Carry them to hifth.app" }).click();
  const arrived = await opened;

  await expect(arrived).toHaveURL(/#\/hafs-kfqc\/p250$/, { timeout: 15_000 });
  await expect.poll(async () => (await savedSeam(arrived))?.page).toBe(250);
});

test("a place on a page this edition does not have is not kept", async ({ page, context, baseURL }) => {
  const { old } = await standIns(context, baseURL);
  await page.goto(`${old}/#/hafs-kfqc/p7`);
  await putSeam(page, { page: 9_999, at: 2_000 });
  await page.reload();

  const opened = context.waitForEvent("page");
  const sheet = page.getByTestId("moved-sheet");
  await sheet.getByRole("button", { name: "Carry them to hifth.app" }).click();
  const arrived = await opened;

  await expect(sheet.getByRole("link", { name: "Open hifth.app" })).toBeVisible();
  await page.waitForTimeout(500);
  // Under a slow run the old page may record page 7 first and carry that; either
  // way page 9999 is never kept or turned to.
  expect((await savedSeam(arrived))?.page).not.toBe(9_999);
  await expect(arrived).not.toHaveURL(/p9999/);
});

test("a page at any other address that opens the new one cannot hand it marks", async ({ page, context, baseURL }) => {
  const { next } = await standIns(context, baseURL);
  // The opener here is at the new address itself, not the old one: a real
  // opener, at the wrong address, sending exactly what the old page would.
  await page.goto(`${next}/#/hafs-kfqc/p7`);
  const opened = context.waitForEvent("page");
  await page.evaluate((url) => {
    (window as unknown as { carryTab: Window | null }).carryTab = window.open(url);
  }, `${next}/#/carry`);
  const tab = await opened;
  await tab.waitForLoadState("load");
  await page.waitForTimeout(500);
  // A whole, valid file, so the only reason left to refuse it is who sent it.
  const file = JSON.stringify({ kind: "hifth.bookmarks", version: 1, savedAt: 1_000, bookmarks: [bookmark("intruder", 8)] });
  await page.evaluate((file) => {
    (window as unknown as { carryTab: Window }).carryTab.postMessage(
      { type: "hifth-carry", file, seam: { page: 400, at: 9_000 } },
      "*",
    );
  }, file);
  await page.waitForTimeout(500);
  await expect(tab.getByText(/came across from the old address/)).toHaveCount(0);
  expect((await savedIds(tab)).bookmarks).toEqual([]);
  expect(await savedSeam(tab)).toBeNull();
  await expect(tab).not.toHaveURL(/p400/);
});

test("when the new tab cannot open, the card offers the file instead", async ({ page, context, baseURL }) => {
  const { old } = await standIns(context, baseURL);
  await page.addInitScript(() => {
    window.open = () => null;
  });
  await page.goto(`${old}/#/hafs-kfqc/p7`);
  const sheet = page.getByTestId("moved-sheet");
  await sheet.getByRole("button", { name: "Carry them to hifth.app" }).click();
  await expect(sheet.getByRole("status")).toHaveText(
    "hifth.app did not answer. Save to a file here, then load that file at hifth.app.",
  );
  await expect(sheet.getByRole("button", { name: "Save to a file" })).toBeVisible();
});

// Found looking at it at phone width, 2026-11-12: floating at the foot of the
// screen, the card sat over the page bar and the trail, the reader's way through
// the book. It is a row of its own above them now, as the note-following bar is.
test("the card covers neither the page bar nor the trail", async ({ page, context, baseURL }) => {
  const { old } = await standIns(context, baseURL);
  await page.goto(`${old}/#/hafs-kfqc/p7`);
  const card = await page.getByTestId("moved-sheet").boundingBox();
  for (const below of [page.getByRole("navigation", { name: "Page bar" }), page.getByRole("contentinfo", { name: "Trail" })]) {
    const box = await below.boundingBox();
    expect(card!.y + card!.height).toBeLessThanOrEqual(box!.y + 0.5);
  }
});

test("Later puts the sheet away", async ({ page, context, baseURL }) => {
  const { old } = await standIns(context, baseURL);
  await page.goto(`${old}/#/hafs-kfqc/p7`);
  const sheet = page.getByTestId("moved-sheet");
  await sheet.getByRole("button", { name: "Later" }).click();
  await expect(sheet).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("moved-sheet")).toHaveCount(0);
});
