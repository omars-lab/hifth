import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { carryPrevious, fingerprintedFiles } from "./carry-previous.mjs";

// A made-up worker script in the shape workbox writes: two fingerprinted scripts, a style,
// the unfingerprinted app list, the page itself and an icon.
const WORKER = `self.x([{url:"index.html",revision:"abc"},{url:"assets/index-OLD111.js",revision:null},` +
  `{url:"assets/rarely-used-OLD222.js",revision:null},{url:"assets/index-OLD333.css",revision:null},` +
  `{url:"assets/manifest.json",revision:null},{url:"icons/icon-192.png",revision:"def"},` +
  `{url:"../escape.js",revision:null}],{})`;

const SITE = "https://site.example";

/** A live site made of `files` (address → text); anything else answers 404. */
function liveSite(files) {
  const asked = [];
  const get = async (url) => {
    asked.push(url);
    return url in files
      ? { status: 200, bytes: new TextEncoder().encode(files[url]) }
      : { status: 404, bytes: new Uint8Array() };
  };
  return { get, asked };
}

function newRelease(names) {
  const out = mkdtempSync(join(tmpdir(), "carry-test-"));
  mkdirSync(join(out, "read", "assets"), { recursive: true });
  for (const n of names) writeFileSync(join(out, "read", n), "new");
  return out;
}

test("only the fingerprinted scripts and styles are carried, never a path that leaves the folder", () => {
  assert.deepEqual(fingerprintedFiles(WORKER), [
    "assets/index-OLD111.js",
    "assets/index-OLD333.css",
    "assets/rarely-used-OLD222.js",
  ]);
});

test("the live release's old files go into the new release beside the new ones", async () => {
  const out = newRelease(["assets/index-NEW.js", "assets/rarely-used-OLD222.js"]);
  const { get } = liveSite({
    [`${SITE}/read/sw.js`]: WORKER,
    [`${SITE}/read/assets/index-OLD111.js`]: "old script",
    [`${SITE}/read/assets/index-OLD333.css`]: "old style",
  });
  const r = await carryPrevious({ out, site: SITE, get });
  assert.deepEqual(r.carried, ["assets/index-OLD111.js", "assets/index-OLD333.css"]);
  assert.equal(readFileSync(join(out, "read", "assets", "index-OLD111.js"), "utf8"), "old script");
  // A name both releases share keeps the new build's copy.
  assert.equal(readFileSync(join(out, "read", "assets", "rarely-used-OLD222.js"), "utf8"), "new");
  assert.ok(existsSync(join(out, "read", "assets", "index-NEW.js")));
});

test("the first upload, with nothing live yet, carries nothing and goes ahead", async () => {
  const out = newRelease(["assets/index-NEW.js"]);
  const r = await carryPrevious({ out, site: SITE, get: liveSite({}).get });
  assert.deepEqual(r, { carried: [], none: true });
});

test("a live file that will not come stops the upload, so open pages do not break", async () => {
  const out = newRelease(["assets/index-NEW.js"]);
  const { get } = liveSite({ [`${SITE}/read/sw.js`]: WORKER, [`${SITE}/read/assets/index-OLD111.js`]: "old" });
  const r = await carryPrevious({ out, site: SITE, get });
  assert.match(r.problem, /index-OLD333\.css/);
});

test("a page handed back under a script's name is not saved as the script", async () => {
  const out = newRelease([]);
  const get = async (url) =>
    url.endsWith("sw.js")
      ? { status: 200, type: "application/javascript", bytes: new TextEncoder().encode(WORKER) }
      : { status: 200, type: "text/html; charset=utf-8", bytes: new TextEncoder().encode("<html>") };
  const r = await carryPrevious({ out, site: SITE, get });
  assert.match(r.problem, /came back as a page/);
  assert.equal(existsSync(join(out, "read", "assets", "index-OLD111.js")), false);
});

test("a live site that cannot be reached stops the upload and says why", async () => {
  const out = newRelease([]);
  const get = async () => {
    throw new Error("no answer");
  };
  assert.match((await carryPrevious({ out, site: SITE, get })).problem, /could not reach the live site \(no answer\)/);
});

test("a live worker that answers neither yes nor not-found stops the upload too", async () => {
  const out = newRelease([]);
  const get = async () => ({ status: 503, bytes: new Uint8Array() });
  assert.match((await carryPrevious({ out, site: SITE, get })).problem, /503/);
});
