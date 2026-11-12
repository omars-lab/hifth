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
    (window as unknown as { carryTab: Window }).carryTab.postMessage({ type: "hifth-carry", file }, "*");
  }, file);
  await page.waitForTimeout(500);
  await expect(tab.getByText(/came across from the old address/)).toHaveCount(0);
  expect((await savedIds(tab)).bookmarks).toEqual([]);
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
