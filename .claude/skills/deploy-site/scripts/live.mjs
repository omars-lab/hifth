/**
 * After a release, look at the live site the way a reader's browser does.
 *
 *   PAGES      must answer, and must carry no sign of a development feature.
 *   the app    must carry the commit just released, so its source-code offer names the
 *              source it was really built from. The commit sits in the main script or in a
 *              script the main one names.
 *   DEV_PATHS  addresses that only mean something on this laptop. Each must answer with an
 *              error, or with the same page the host gives an address that cannot exist,
 *              never with real content.
 *
 * Measured with Cloudflare's local Pages server on 2026-11-11: with no 404.html the host
 * answers every unknown address 200 with the front page, and it ignores a
 * "/read/* /read/index.html 200" rule as an endless loop. So the site ships a 404.html and no
 * rules file, and this look compares against addresses that cannot exist rather than assume
 * a 404. Write-up: docs/issues/hifth-app-unknown-addresses.md.
 *
 * Tests: live.test.mjs. Called by release-hifth-app.mjs verify.
 */
import { markersIn } from "./shipped.mjs";

const PAGES = ["/", "/privacy.html", "/read/"];

export const DEV_PATHS = [
  "/read/pitch/",
  "/read/docs/",
  "/read/sw.js.map",
  "/intent/",
  "/.intent/picture/index.html",
  "/dev-fixtures/qul-page-1.json",
  "/read/dev-fixtures/qul-page-1.json",
  "/@vite/client",
  "/functions/api/notify.js",
  "/.env",
];

/**
 * @param {string} base  the site's address, such as https://hifth.app
 * @param {{commit: string, fetch?: typeof fetch}} opts
 * @returns {Promise<{path: string, why: string}[]>}
 */
export async function verifyLive(base, { commit, fetch = globalThis.fetch }) {
  const problems = [];
  const get = async (path) => {
    try {
      const res = await fetch(new URL(path, base).href, { redirect: "follow" });
      return { status: res.status, body: await res.text() };
    } catch (error) {
      problems.push({ path, why: `could not reach it (${error.message})` });
      return null;
    }
  };

  const bodies = {};
  for (const path of PAGES) {
    const res = await get(path);
    if (!res) return problems;
    bodies[path] = res.body;
    if (res.status !== 200) {
      problems.push({ path, why: `answered ${res.status}, not 200` });
      continue;
    }
    for (const why of markersIn(res.body)) problems.push({ path, why });
  }

  const src = /src="(\.?\/?(?:read\/)?assets\/index-[\w-]+\.js)"/.exec(bodies["/read/"] ?? "")?.[1];
  if (!src) {
    problems.push({ path: "/read/", why: "the app's page names no main script, so it cannot start" });
  } else {
    const path = new URL(src, new URL("/read/", base)).pathname;
    const res = await get(path);
    // The build puts the commit in a script the main one loads later (rarely-used-*.js in the
    // 2026-11-11 build), so look in each script the main one names, one step down.
    let carries = res?.body.includes(commit) ?? true;
    if (res && !carries) {
      for (const name of new Set(res.body.match(/\.\/[\w-]+\.js/g) ?? [])) {
        const more = await get(new URL(name, new URL(path, base)).pathname);
        if (more?.body.includes(commit)) {
          carries = true;
          break;
        }
      }
    }
    if (res && !carries) {
      problems.push({ path, why: `the live app does not carry commit ${commit.slice(0, 8)}; the release did not take, or a cache still serves the old one` });
    }
  }

  // What the host answers for an address that cannot exist, at the top and under /read/. A
  // development address that answers the same way is serving nothing, whatever the host does
  // with unknown addresses (Cloudflare Pages without a 404 page answers 200 with the front
  // page; measured with wrangler pages dev, 2026-11-11).
  const nothing = new Set();
  for (const path of ["/no-such-page-hifth-release-check", "/read/no-such-page-hifth-release-check"]) {
    const res = await get(path);
    if (res) nothing.add(res.body);
  }
  for (const path of DEV_PATHS) {
    const res = await get(path);
    if (!res || res.status >= 400 || nothing.has(res.body)) continue;
    problems.push({ path, why: `answered ${res.status} with real content; only this laptop should serve it` });
  }
  return problems;
}
