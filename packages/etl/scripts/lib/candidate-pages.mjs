/**
 * Fetching the ligature corpus, once.
 *
 * The candidate is 595 KB of SVG per page — 351 MB for the mus'haf. It is not
 * vendored and never will be (the whole point of word-B is that we ship the
 * boxes, not the pictures), but the probe and the builder both read it, and a
 * builder that re-downloaded a third of a gigabyte on every run would be a
 * builder nobody re-runs. So: the same shape `vendor-pages.mjs` uses for our own
 * upstream — a gitignored cache under `packages/etl/data/pages/.cache/`, keyed
 * by page, plus a SHA-256 of every byte read so the pin can say what was read.
 *
 * The pin itself is not restated here. It is read from
 * `ligature-svg.probe.json`, so there is one pin and not two, and a pin bump
 * moves both readers at once.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "..", "data", "pages");
const CACHE = join(DATA, ".cache", "words");

export const pin = JSON.parse(readFileSync(join(DATA, "ligature-svg.probe.json"), "utf8"));

const pad3 = (n) => String(n).padStart(3, "0");
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

/**
 * One page of the candidate corpus, from the cache if it is there. `offline`
 * turns a cache miss into an error rather than a download — what a caller wants
 * when it is re-running a build and a silent 351 MB fetch would be a surprise.
 */
export async function candidatePage(page, { offline = false } = {}) {
  const dest = join(CACHE, `${pad3(page)}.svg`);
  if (existsSync(dest)) {
    const body = readFileSync(dest);
    return { body, sha256: sha(body), cached: true };
  }
  if (offline) {
    throw new Error(`page ${page} is not in ${CACHE.replace(DATA, "…")} — re-run with --fetch`);
  }
  const { repo, commit, path } = pin.candidate;
  const url = `https://raw.githubusercontent.com/${repo}/${commit}/${encodeURIComponent(path)}/${pad3(page)}.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(dest, body);
  return { body, sha256: sha(body), cached: false };
}
