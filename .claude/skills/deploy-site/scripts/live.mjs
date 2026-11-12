/**
 * After a release, look at the live site the way a reader's browser does.
 *
 *   PAGES      must answer, and must carry no sign of a development feature.
 *   the app    must carry the commit just released, so its source-code offer names the
 *              source it was really built from.
 *   DEV_PATHS  addresses that only mean something on this laptop. Each must answer with
 *              nothing (an error), or with the app's own page (the /read/ fallback), and
 *              never with real content.
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
    if (res && !res.body.includes(commit)) {
      problems.push({ path, why: `the live app does not carry commit ${commit.slice(0, 8)}; the release did not take, or a cache still serves the old one` });
    }
  }

  for (const path of DEV_PATHS) {
    const res = await get(path);
    if (!res || res.status >= 400 || res.body === bodies["/read/"]) continue;
    problems.push({ path, why: `answered ${res.status} with real content; only this laptop should serve it` });
  }
  return problems;
}
