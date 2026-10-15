/**
 * Read the words, their boxes and how far each leans, off every picture of the captured book that
 * a note was read from (page-words.swift does one picture; this walks them all). Each block of a
 * note names the picture it came from (`chapter-N_pM.png`), so those are the pictures read: a
 * note is then matched to exactly the picture it was taken from.
 *
 * The output holds the book's words, so it goes beside the pictures, in the books repository's
 * ignored work folder (`.work/slant/`), never into this repository. A page already read is
 * skipped, so a stopped run picks up where it stopped. Each page logs a line before and after,
 * and one that takes longer than a minute is stopped and logged, so a stall shows in the log.
 *
 *   node packages/etl/tools/pitch/page-words.mjs              # every page not yet read
 *   node packages/etl/tools/pitch/page-words.mjs chapter-2_p05   # just these pictures, read again
 */
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { picturesOf } from "./picture-slant.mjs";

const here = dirname(fileURLToPath(import.meta.url));
// The captured book, beside the main checkout (a worktree is deeper; extract.mjs finds it the same way).
const repo = resolve(here, "../../../..");
const main = dirname(resolve(repo, execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd: repo, encoding: "utf8" }).trim()));
const book = [resolve(repo, "../books/books/study-quran"), resolve(main, "../books/books/study-quran")].find((d) => existsSync(join(d, "tafseer-bundle")));
if (!book) throw new Error("no captured book beside this checkout");
const pages = join(book, ".work");
const out = join(book, ".work/slant");
mkdirSync(out, { recursive: true });
const log = join(out, "run.log");
const ev = (event, kv = {}) => {
  const line = [new Date().toISOString(), `pid=${process.pid}`, `ev=${event}`, ...Object.entries(kv).map(([k, v]) => `${k}=${v}`)].join(" ");
  appendFileSync(log, line + "\n");
};

const bin = join(out, "page-words");
const built = spawnSync("swiftc", ["-O", join(here, "page-words.swift"), "-o", bin], { encoding: "utf8" });
if (built.status !== 0) {
  ev("build_failed", { msg: JSON.stringify((built.stderr || "").slice(0, 200)) });
  process.exit(1);
}

const asked = process.argv.slice(2);
const bundle = join(book, "tafseer-bundle");
const names = asked.length
  ? asked
  : readdirSync(bundle)
      .filter((f) => /^\d+\.json$/.test(f))
      .flatMap((f) => picturesOf(JSON.parse(readFileSync(join(bundle, f), "utf8"))))
      .map((f) => f.slice(0, -4))
      .filter((f, i, all) => all.indexOf(f) === i);
ev("start", { n: names.length });
let done = 0, failed = 0, skipped = 0;
for (const n of names) {
  const dst = join(out, `${n}.json`);
  if (!asked.length && existsSync(dst)) { skipped++; continue; }
  ev("page", { n, phase: "before" });
  const t0 = Date.now();
  const r = spawnSync(bin, [join(pages, `${n}.png`)], { encoding: "utf8", timeout: 60_000, maxBuffer: 64 << 20 });
  if (r.error?.code === "ETIMEDOUT") { failed++; ev("page_timeout", { n }); continue; }
  if (r.status !== 0) { failed++; ev("page_failed", { n, status: r.status }); continue; }
  writeFileSync(dst, r.stdout);
  done++;
  ev("page", { n, phase: "after", ms: Date.now() - t0 });
}
ev("done", { done, skipped, failed, total: names.length });
