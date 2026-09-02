/**
 * Shared reader for docs/decisions.json and the records it indexes.
 *
 * Three things read this — the gate, the terminal renderer and the markdown
 * builder — and a decision that reads one way in the terminal and another in
 * the committed page is worse than no page, because the disagreement is silent.
 * So the parsing, the joins and the hash live here once. Same shape and same
 * reason as scripts/issues.mjs and scripts/use-cases.mjs.
 *
 * The interesting work in this file is `plainLanguage`, which is the only place
 * that knows what the CLAUDE.md tenet means in characters. A tenet nobody can
 * fail is a preference; this one fails a build.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";
import { publicUrl } from "./site.mjs";

export const DECISIONS_PATH = join(ROOT, "docs", "decisions.json");
export const DOC_PATH = join(ROOT, "docs", "decisions", "README.md");
export const RECORD_DIR = join(ROOT, "docs", "decisions");

/** The four words. Defined in docs/decisions.json's $comment; enforced here. */
export const STATUSES = ["open", "decided", "living", "superseded"];

/** Open first — nobody scans this list to admire the settled ones. */
export const STATUS_ORDER = ["open", "living", "decided", "superseded"];

/**
 * The one address an `artifact` may be: the checked-in page's own, on the site.
 *
 * Until 2026-09-01 this was a host check — the link had to be on the one host
 * decision pages were put on — and the address was minted there, written back
 * here by hand, and lived on a host that could go away. Now the build stages
 * every page under docs/ onto the app's own site at the same path (see
 * stage-docs.mjs), so the public address is a function of the path and nothing
 * else. Derived here, and the gate refuses a row that says anything different:
 * a link a reader can only reach through a second host is a link with a second
 * way to die.
 */
export function artifactFor(d) {
  return d.page ? publicUrl(d.page) : null;
}

export function readDecisions() {
  if (!existsSync(DECISIONS_PATH)) {
    console.error(`decisions missing at ${DECISIONS_PATH}`);
    process.exit(1);
  }
  const { decisions } = JSON.parse(readFileSync(DECISIONS_PATH, "utf8"));
  return decisions;
}

/** Every record in docs/decisions/, minus the generated index. */
export function records() {
  return readdirSync(RECORD_DIR)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .map((f) => `docs/decisions/${f}`)
    .sort();
}

/**
 * A record's own title, read at build time.
 *
 * Never stored in the register. The titles here are sentences with opinions in
 * them — "The grain gets finer where the finger already is" — and the moment
 * one lives in two files, one of them is a copy that stops being true without
 * anybody noticing. The register stores the *question*; the record owns the
 * *answer*, and the answer is read out of it whenever it is shown.
 */
export function titleOf(file) {
  const path = join(ROOT, file);
  if (!existsSync(path)) return null;
  const m = readFileSync(path, "utf8").match(/^#\s+(.+?)\s*$/m);
  return m ? m[1] : null;
}

/** `docs/x.md#anchor` → `{ file, anchor }`. */
export function splitDoc(doc) {
  const i = doc.indexOf("#");
  return i === -1 ? { file: doc, anchor: null } : { file: doc.slice(0, i), anchor: doc.slice(i + 1) };
}

/** GitHub's heading slug, near enough: lowercase, drop punctuation, spaces → dashes. */
export const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");

/** Does a file carry a heading this anchor could be pointing at? */
export function hasAnchor(file, anchor) {
  const path = join(ROOT, file);
  if (!existsSync(path)) return false;
  const want = slug(anchor);
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.startsWith("#"))
    .some((l) => {
      const text = l.replace(/^#+\s*/, "");
      return slug(text) === want || text.startsWith(anchor);
    });
}

/**
 * The CLAUDE.md tenet, in characters: does this sentence make a reader who has
 * never opened the repo look something up?
 *
 * Returns the offending fragments, or an empty array. Each pattern is here
 * because it is a way a question stops being answerable by a stranger — not
 * because it is ugly. Prose is allowed to be long, technical and Arabic; it is
 * not allowed to name a file, a function or a command.
 *
 * Deliberately not checked: reading age, sentence length, whether a word is
 * "hard". Those are taste, and a gate that enforces taste gets switched off.
 */
export function plainLanguage(text) {
  const bad = [];
  const flag = (re, why) => {
    for (const m of text.matchAll(re)) bad.push(`${m[0]} — ${why}`);
  };
  flag(/\S+\.(mjs|[jt]sx?|json|css|html|md|svg|yml)\b/g, "names a file");
  flag(/\S*\/\S+/g, "names a path");
  flag(/`[^`]*`/g, "quotes code");
  flag(/\b(pnpm|npm|node|make|git)\s+\S+/g, "names a command");
  flag(/\bgate:[a-z0-9-]+/g, "names a gate");
  flag(/\b[a-z]+[A-Z]\w*/g, "names a symbol");
  flag(/\b\w+_\w+\b/g, "names a symbol");
  return bad;
}

/**
 * The slice the committed page renders, and therefore the slice whose change
 * makes docs/decisions/README.md stale. Not the whole file: editing `$comment`
 * should not fail a build over a page that never shows it.
 */
export function docPayload(decisions) {
  return decisions.map((d) => ({
    id: d.id,
    question: d.question,
    status: d.status,
    options: d.options ?? [],
    artifact: d.artifact ?? null,
    page: d.page ?? null,
    doc: d.doc,
    decided: d.decided ?? null,
    by: d.by ?? null,
    date: d.date ?? null,
    related: d.related ?? [],
    supersededBy: d.supersededBy ?? null,
    // The record's title is read, not stored — but it is rendered, so a retitled
    // record has to restale the page too, or the index quietly shows the old one.
    title: titleOf(splitDoc(d.doc).file),
  }));
}

/** Stable short hash of the rendered slice; stamped into README.md. */
export function decisionsHash(decisions) {
  return createHash("sha256").update(JSON.stringify(docPayload(decisions))).digest("hex").slice(0, 12);
}

/** The hash README.md was built from, or null if there is no page (or no stamp). */
export function docHash() {
  if (!existsSync(DOC_PATH)) return null;
  const m = readFileSync(DOC_PATH, "utf8").match(/<!-- decisions-hash: ([0-9a-f]+) -->/);
  return m ? m[1] : null;
}
