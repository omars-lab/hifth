/**
 * After a release, look at the live site the way a reader's browser does.
 *
 * The front page, the privacy page and the app must answer, and the app must carry the
 * commit just released. Every development address must answer with an error, or the same way as an
 * address that cannot exist, never with what it serves on this laptop. The tests hand verifyLive a
 * made-up network: a map from address to answer. Written before live.mjs and seen failing.
 *
 * Run with: pnpm test:scripts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEV_PATHS, verifyLive } from "./live.mjs";

const BASE = "https://hifth.app";
const HEAD = "0123456789abcdef0123456789abcdef01234567";
const SHELL = '<!doctype html><script type="module" src="./assets/index-abc.js"></script>';

/** A site that answers the way a good release does: real pages, and the app for any /read/ path. */
function goodSite() {
  return {
    "/": [200, '<h1>Hifth</h1><a href="/read/">Open Hifth in your browser</a>'],
    "/privacy.html": [200, "<p>Write to us.</p>"],
    "/read/": [200, SHELL],
    // Like the real build: the commit sits in a script the main one loads later, not in the
    // main script itself (seen in the 2026-11-11 build: rarely-used-*.js).
    "/read/assets/index-abc.js": [200, 'const s=()=>import("./rarely-used-xyz.js");'],
    "/read/assets/rarely-used-xyz.js": [200, `const c="${HEAD}";`],
  };
}

/**
 * A made-up fetch: a listed address answers as listed, and any other address gets `unknown`:
 * a plain 404 by default, or, the way Cloudflare Pages answers when a site has no 404 page,
 * the front page with a 200 (measured with wrangler pages dev, 2026-11-11).
 */
function network(site, unknown = () => [404, "Not found"]) {
  const asked = [];
  const fetch = async (url) => {
    const path = new URL(url).pathname;
    asked.push(path);
    const hit = site[path] ?? unknown(site, path);
    return { status: hit[0], text: async () => hit[1] };
  };
  return { fetch, asked };
}

test("a good release passes, and every development address was asked", async () => {
  const net = network(goodSite());
  const problems = await verifyLive(BASE, { commit: HEAD, fetch: net.fetch });
  assert.deepEqual(problems, []);
  for (const path of DEV_PATHS) assert.ok(net.asked.includes(path), `never asked ${path}`);
});

test("a page that does not answer is reported", async () => {
  const site = goodSite();
  site["/privacy.html"] = [404, "Not found"];
  const problems = await verifyLive(BASE, { commit: HEAD, fetch: network(site).fetch });
  assert.deepEqual(problems.map((p) => p.path), ["/privacy.html"]);
});

test("an app built from another commit is reported", async () => {
  const problems = await verifyLive(BASE, { commit: "f".repeat(40), fetch: network(goodSite()).fetch });
  assert.equal(problems.length, 1);
  assert.equal(problems[0].path, "/read/assets/index-abc.js");
  assert.match(problems[0].why, /commit/);
});

test("a pitch build or a debug copy that went up is reported", async () => {
  const site = goodSite();
  site["/read/pitch/"] = [200, "<html>the pitch</html>"];
  site["/read/sw.js.map"] = [200, '{"version":3,"sources":[]}'];
  const problems = await verifyLive(BASE, { commit: HEAD, fetch: network(site).fetch });
  assert.deepEqual(problems.map((p) => p.path).sort(), ["/read/pitch/", "/read/sw.js.map"]);
});

test("a development feature in the live front page is reported", async () => {
  const site = goodSite();
  site["/"] = [200, '<script type="module" src="/@vite/client"></script><a href="/read/">Open</a>'];
  const problems = await verifyLive(BASE, { commit: HEAD, fetch: network(site).fetch });
  assert.deepEqual(problems.map((p) => p.path), ["/"]);
  assert.match(problems[0].why, /live reload/);
});

test("a site that cannot be reached says so instead of passing", async () => {
  const fetch = async () => {
    throw new Error("getaddrinfo ENOTFOUND hifth.app");
  };
  const problems = await verifyLive(BASE, { commit: HEAD, fetch });
  assert.ok(problems.length > 0);
  assert.match(problems[0].why, /could not reach/);
});

test("a host that answers every unknown address with the front page still passes a good release", async () => {
  const frontPage = (site) => [200, site["/"][1]];
  const problems = await verifyLive(BASE, { commit: HEAD, fetch: network(goodSite(), frontPage).fetch });
  assert.deepEqual(problems, []);
});

test("on that host, a pitch build that went up is still reported", async () => {
  const site = goodSite();
  site["/read/pitch/"] = [200, "<html>the pitch</html>"];
  const frontPage = (s) => [200, s["/"][1]];
  const problems = await verifyLive(BASE, { commit: HEAD, fetch: network(site, frontPage).fetch });
  assert.deepEqual(problems.map((p) => p.path), ["/read/pitch/"]);
});

test("a development address that answers with the app's own page is reported", async () => {
  const site = goodSite();
  site["/read/docs/"] = site["/read/"];
  const problems = await verifyLive(BASE, { commit: HEAD, fetch: network(site).fetch });
  assert.deepEqual(problems.map((p) => p.path), ["/read/docs/"]);
});
