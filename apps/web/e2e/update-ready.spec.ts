import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { COACH_STORAGE_KEY } from "../src/coach";

/*
 * Launch item 24: the browser version says when a new version is ready, and
 * the reader chooses when to switch.
 *
 * A new release is a new offline worker script. To make one without a second
 * build, this file serves the built app from its own small server and changes
 * only the worker script it hands out: the same files, one more line. To the
 * browser that is a new release, which is all the strip reacts to.
 *
 * Chromium only, like the other offline tests: Playwright's WebKit does not run
 * the worker the way a real iPhone does (see offline.spec.ts).
 */

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
};

let server: Server;
let origin = "";
/** What the server hands out as sw.js; a test changes it to "release" a new version. */
let worker = "";

test.beforeAll(async () => {
  worker = await readFile(join(DIST, "sw.js"), "utf8");
  server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    if (path === "/sw.js") {
      res.writeHead(200, { "content-type": TYPES[".js"], "cache-control": "no-cache" });
      res.end(worker);
      return;
    }
    const rel = normalize(path === "/" ? "/index.html" : path).replace(/^\/+/, "");
    if (rel.startsWith("..")) {
      res.writeHead(403).end();
      return;
    }
    readFile(join(DIST, rel))
      .then((body) => {
        res.writeHead(200, { "content-type": TYPES[extname(rel)] ?? "application/octet-stream" });
        res.end(body);
      })
      .catch(() => res.writeHead(404).end());
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const addr = server.address();
  origin = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

test.afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()));
});

/**
 * A reader on their second visit: tips seen, storage kept, so no other notice
 * has a claim on the strip and anything it shows is about the new version.
 */
async function openReader(page: Page): Promise<void> {
  await page.addInitScript((coachKey: string) => {
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        persist: async () => true,
        persisted: async () => true,
        estimate: async () => ({ usage: 1_000_000, quota: 40 * 1024 ** 3 }),
      },
    });
    try {
      localStorage.setItem(coachKey, "1");
    } catch {
      /* private mode */
    }
  }, COACH_STORAGE_KEY);
  await page.goto(`${origin}/`);
  await page.waitForFunction(
    async () => {
      const reg = await navigator.serviceWorker.ready;
      return reg.active !== null && navigator.serviceWorker.controller !== null;
    },
    undefined,
    { timeout: 30_000 },
  );
}

/** Put a new release on the server, and have the page look for it now rather than in an hour. */
async function release(page: Page, n: number): Promise<void> {
  worker = `${worker}\n// release ${n}\n`;
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.update();
  });
}

test.describe("Hifth · a new version is ready", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "service-worker updates are exercised on Chromium (see offline.spec.ts)",
  );

  test("the reader is told, and Reload starts the new version on the same page", async ({ page }) => {
    await openReader(page);
    await expect(page.locator("[data-notice]")).toHaveCount(0);
    const before = new URL(page.url()).hash;

    await release(page, 1);
    const strip = page.locator('[data-notice="update-ready"]');
    await expect(strip).toBeVisible({ timeout: 30_000 });
    // Nothing switched by itself: the page is still the one the reader opened.
    expect(await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.waiting !== null))).toBe(true);

    await page.evaluate(() => {
      (window as Window & { __stillOld?: boolean }).__stillOld = true;
    });
    await strip.getByRole("button", { name: "أعد التحميل" }).click();

    // A reload happened (the mark set above is gone), into the new worker, and the
    // strip has nothing left to say.
    await page.waitForFunction(() => !(window as Window & { __stillOld?: boolean }).__stillOld, undefined, { timeout: 30_000 });
    await page.waitForFunction(
      async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg?.waiting === null && navigator.serviceWorker.controller !== null;
      },
      undefined,
      { timeout: 30_000 },
    );
    await expect(page.locator("[data-notice]")).toHaveCount(0);
    expect(new URL(page.url()).hash).toBe(before);
  });

  test("a second open tab is told too once the first one switches", async ({ page, context }) => {
    await openReader(page);
    const other = await context.newPage();
    await other.goto(`${origin}/`);
    await other.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, { timeout: 30_000 });

    await release(page, 2);
    await expect(page.locator('[data-notice="update-ready"]')).toBeVisible({ timeout: 30_000 });
    await page.locator('[data-notice="update-ready"]').getByRole("button", { name: "أعد التحميل" }).click();

    // The other tab was not reloaded under the reader. It is told a new version
    // is running, and its own Reload is theirs to press.
    await expect(other.locator('[data-notice="update-ready"]')).toBeVisible({ timeout: 30_000 });
  });

  test("hiding it lasts this visit only", async ({ page }) => {
    await openReader(page);
    await release(page, 3);
    const strip = page.locator('[data-notice="update-ready"]');
    await expect(strip).toBeVisible({ timeout: 30_000 });
    await strip.getByRole("button", { name: "إخفاء التنبيه" }).click();
    await expect(strip).toHaveCount(0);

    // Coming back without pressing Reload: the new version is still waiting, and
    // the reader is told again.
    await page.reload();
    await expect(page.locator('[data-notice="update-ready"]')).toBeVisible({ timeout: 30_000 });
  });
});
