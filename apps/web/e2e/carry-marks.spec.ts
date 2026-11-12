import { test, expect, type Page } from "@playwright/test";

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
 * replaced them on disk).
 */

const DB = "hifth.bookmarks.v1";

function mark(id: string, page: number) {
  return { id, key: `quran/hafs-kfqc/2:${page}`, page, name: `made-up ${id}`, timeline: [{ at: 1, what: "dropped", page }] };
}

async function putBookmarks(page: Page, bookmarks: unknown[]): Promise<void> {
  await page.evaluate(
    ({ db, bookmarks }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(db);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("sets", "readwrite");
          tx.objectStore("sets").put({ id: "mine", bookmarks });
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { db: DB, bookmarks },
  );
}

async function savedIds(page: Page): Promise<string[]> {
  return page.evaluate(
    (db) =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open(db);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result.transaction("sets").objectStore("sets").get("mine");
          get.onsuccess = () => {
            open.result.close();
            const set = (get.result?.bookmarks ?? []) as { id: string }[];
            resolve(set.map((b) => b.id).sort());
          };
          get.onerror = () => reject(get.error);
        };
      }),
    DB,
  );
}

test("the old address carries its bookmarks to the new one, keeping what the new one had", async ({
  page,
  context,
  baseURL,
}) => {
  const port = new URL(baseURL!).port;
  const old = `http://localhost:${port}`;
  const next = `http://127.0.0.1:${port}`;
  await context.addInitScript(
    (addresses) => {
      localStorage.setItem("hifth.lang.v1", "en");
      localStorage.setItem("hifth.moved.addresses.v1", JSON.stringify(addresses));
    },
    { old, next },
  );

  // The new address already holds one bookmark of its own.
  const ahead = await context.newPage();
  await ahead.goto(`${next}/#/hafs-kfqc/p7`);
  await expect(ahead.getByTestId("moved-sheet")).toHaveCount(0);
  await putBookmarks(ahead, [mark("kept-at-new", 9)]);
  await ahead.close();

  // The old address holds two.
  await page.goto(`${old}/#/hafs-kfqc/p7`);
  await putBookmarks(page, [mark("from-old-1", 5), mark("from-old-2", 6)]);
  await page.reload();

  const sheet = page.getByTestId("moved-sheet");
  await expect(sheet).toBeVisible();
  const opened = context.waitForEvent("page");
  await sheet.getByRole("button", { name: "Carry them to hifth.app" }).click();
  const arrived = await opened;

  await expect(sheet.getByRole("status")).toHaveText("2 items carried to hifth.app");
  await expect(sheet.getByRole("link", { name: "Open hifth.app" })).toBeVisible();
  await expect(arrived.getByText("2 items came across from the old address")).toBeAttached();
  await expect.poll(() => savedIds(arrived)).toEqual(["from-old-1", "from-old-2", "kept-at-new"]);

  // A reload of the new page does not take the file again, and the old page,
  // reopened, offers hifth.app rather than a second carry.
  await arrived.reload();
  await expect.poll(() => savedIds(arrived)).toEqual(["from-old-1", "from-old-2", "kept-at-new"]);
  await page.reload();
  await expect(page.getByTestId("moved-sheet").getByRole("link", { name: "Open hifth.app" })).toBeVisible();
});

test("a page that did not open the new one cannot hand it bookmarks", async ({ page, context, baseURL }) => {
  const port = new URL(baseURL!).port;
  const old = `http://localhost:${port}`;
  const next = `http://127.0.0.1:${port}`;
  await context.addInitScript(
    (addresses) => {
      localStorage.setItem("hifth.lang.v1", "en");
      localStorage.setItem("hifth.moved.addresses.v1", JSON.stringify(addresses));
    },
    { old, next },
  );
  // Opened straight from a link, with the carry's ending but no old page behind it.
  await page.goto(`${next}/#/carry`);
  await page.waitForTimeout(300);
  await page.evaluate(() =>
    window.postMessage({ type: "hifth-carry", file: JSON.stringify({ kind: "hifth.bookmarks", version: 1, bookmarks: [] }) }, "*"),
  );
  await page.waitForTimeout(300);
  await expect(page.getByText(/came across from the old address/)).toHaveCount(0);
  expect(await savedIds(page)).toEqual([]);
});

test("Later puts the sheet away", async ({ page, context, baseURL }) => {
  const port = new URL(baseURL!).port;
  await context.addInitScript(
    (addresses) => {
      localStorage.setItem("hifth.lang.v1", "en");
      localStorage.setItem("hifth.moved.addresses.v1", JSON.stringify(addresses));
    },
    { old: `http://localhost:${port}`, next: `http://127.0.0.1:${port}` },
  );
  await page.goto("/#/hafs-kfqc/p7");
  const sheet = page.getByTestId("moved-sheet");
  await sheet.getByRole("button", { name: "Later" }).click();
  await expect(sheet).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("moved-sheet")).toHaveCount(0);
});
