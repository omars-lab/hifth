/**
 * Keep the live release's app files for one more release (launch item 24).
 *
 * Every upload to Cloudflare Pages replaces the whole site. The app's scripts carry a
 * fingerprint in their names, so a new build names every script afresh, and the old names are
 * gone the moment it goes up. A page a reader opened before the upload still asks for those old
 * names: a second tab, or the moments after the reader taps "Reload" in another tab. With the
 * old names gone, that page breaks.
 *
 * So before an upload, this reads the list of files the live site's offline worker holds, and
 * copies into the new release every fingerprinted app file the new build no longer has. Only
 * the live release's own list is read, so files carried from the release before it are not
 * carried again: a file stays one release, then goes.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * The fingerprinted app files an offline worker's script lists, as paths under /read/.
 * Workbox writes each precached file as {url:"…",revision:…}; a file whose name already holds
 * its fingerprint has revision null, and those are the only ones whose name changes with every
 * build. Only files under assets/ are taken, and only safe relative names.
 */
export function fingerprintedFiles(workerText) {
  const found = new Set();
  for (const m of workerText.matchAll(/\{\s*url:\s*"([^"]+)",\s*revision:\s*null\s*\}/g)) {
    const url = m[1];
    if (/^assets\/[\w.-]+\.(js|css)$/.test(url)) found.add(url);
  }
  return [...found].sort();
}

/**
 * Copy into `out/read/` the live release's fingerprinted files the new build lacks.
 * `get(url)` fetches one address and answers { status, bytes }. Returns what was carried, or
 * { problem } when the live site answered but a file could not be fetched, since uploading
 * then would break the pages readers have open.
 */
export async function carryPrevious({ out, site, get }) {
  try {
    const worker = await get(`${site}/read/sw.js`);
    if (worker.status === 404) return { carried: [], none: true };
    if (worker.status !== 200) return { problem: `the live site's offline worker answered ${worker.status}` };
    const carried = [];
    for (const file of fingerprintedFiles(Buffer.from(worker.bytes).toString("utf8"))) {
      const dest = join(out, "read", file);
      if (existsSync(dest)) continue;
      const r = await get(`${site}/read/${file}`);
      if (r.status !== 200) return { problem: `${file} on the live site answered ${r.status}` };
      // A site that answers every address with a page would hand back a page here; a page
      // saved under a script's name breaks the old tab as surely as a missing file.
      if (/text\/html/.test(r.type ?? "")) return { problem: `${file} on the live site came back as a page` };
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, Buffer.from(r.bytes));
      carried.push(file);
    }
    return { carried };
  } catch (e) {
    return { problem: `could not reach the live site (${e.message})` };
  }
}

/** The real fetch, for carryPrevious. No cookies, no cache. */
export async function fetchBytes(url) {
  const r = await fetch(url, { cache: "no-store", credentials: "omit", redirect: "follow" });
  return {
    status: r.status,
    type: r.headers.get("content-type") ?? "",
    bytes: r.ok ? new Uint8Array(await r.arrayBuffer()) : new Uint8Array(),
  };
}
