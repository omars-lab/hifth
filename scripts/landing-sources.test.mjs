/**
 * The sources page at hifth.app says where the pages, the colours and the data come from, in
 * English and in Arabic. It must say exactly what the app's own sources list says, which is
 * what each source's entry in SOURCES.md declares (the ```colophon block under its heading).
 *
 * Why: the two permission emails point the rights holders at this page, and a reader who
 * wants to know whose work they are reading finds it here without installing anything. A page
 * that dropped a source, or swapped two licences, would say the wrong thing to the very people
 * whose terms it repeats. Added 2026-11-17 (backlog launch-citations-page).
 *
 * Each row on the page carries its source's short name (data-source="<id>"), so the check
 * compares row against entry, field for field, both ways: no credited source missing, no row
 * for a source the record does not credit. A short name the licence file uses in backticks is
 * a source it relies on, so each one must have an entry, and that entry must be on the page or
 * say why it is not. The licence file's plain-prose mentions ("Tanzil", "Waqar144") are not
 * checked; those are the same sources under their everyday names.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readDeclarations } from "./colophon-record.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LANDING = join(ROOT, "apps", "landing");
const read = (path) => readFileSync(join(ROOT, path), "utf8");

// The Arabic pages carry no vowel marks (landing-page.test.mjs), so a shadda in the record's
// Arabic is dropped on the page. Both sides are compared without them.
const MARKS = /[ً-ْٰ]/g;
const plain = (s) => s.replace(/<[^>]*>/g, "").replace(MARKS, "").replace(/\s+/g, " ").trim();

const FIELDS = {
  en: { what: "whatEn", who: "whoEn", licence: "licenceEn" },
  ar: { what: "what", who: "who", licence: "licence" },
};

/** The rows of a sources page, by short name: what, who, licence, and the link. */
export function sourceRows(html) {
  const rows = new Map();
  for (const [, id, body] of html.matchAll(/<li class="source" data-source="([^"]+)">([\s\S]*?)<\/li>/g)) {
    const field = (name) => plain(body.match(new RegExp(`class="${name}"[^>]*>([\\s\\S]*?)</(?:span|a)>`))?.[1] ?? "");
    rows.set(id, {
      what: field("what"),
      who: field("who"),
      licence: field("licence"),
      href: body.match(/<a class="link" href="([^"]+)"/)?.[1] ?? "",
    });
  }
  return rows;
}

/** The short names the licence file relies on: each backticked word that names an entry heading. */
export function namedInLicences(licencesMd, ids) {
  return [...new Set([...licencesMd.matchAll(/`([a-z0-9][a-z0-9._-]*)`/g)].map((m) => m[1]))].filter((w) => ids.has(w));
}

/** What is wrong with a sources page in one language; empty means it matches the record. */
export function sourcesProblems(html, lang, declarations) {
  const problems = [];
  const rows = sourceRows(html);
  const keys = FIELDS[lang];
  for (const [id, row] of declarations) {
    if ("not-credited" in row) {
      if (rows.has(id)) problems.push(`${id}: on the page, but the record says it is not credited`);
      continue;
    }
    const shown = rows.get(id);
    if (!shown) {
      problems.push(`${id}: credited in SOURCES.md, missing from the page`);
      continue;
    }
    for (const [field, key] of Object.entries(keys)) {
      if (shown[field] !== plain(row[key] ?? "")) problems.push(`${id}: ${field} is "${shown[field]}", the record says "${plain(row[key] ?? "")}"`);
    }
    if (shown.href !== row.href) problems.push(`${id}: link is "${shown.href}", the record says "${row.href}"`);
  }
  for (const id of rows.keys()) {
    if (!declarations.has(id)) problems.push(`${id}: on the page, but SOURCES.md has no entry for it`);
  }
  return problems;
}

// Made-up entries, so the rule is tried on input whose answer is known.
const RECORD = new Map([
  ["paper-a", { what: "صفحات", who: "مطبعة ألف", licence: "إتاحة حرّة", href: "https://a.example", whatEn: "Pages", whoEn: "Press A", licenceEn: "Free to use" }],
  ["data-b", { what: "بيانات", who: "باء", licence: "CC BY", href: "https://b.example", whatEn: "Data", whoEn: "B", licenceEn: "CC BY" }],
  ["font-c", { "not-credited": "ships nothing" }],
]);
const li = (id, what, who, licence, href) =>
  `<li class="source" data-source="${id}"><span class="what">${what}</span> <span class="who">${who}</span> <span class="licence">${licence}</span> <a class="link" href="${href}">${href}</a></li>`;
const GOOD_EN = li("paper-a", "Pages", "Press A", "Free to use", "https://a.example") + li("data-b", "Data", "B", "CC BY", "https://b.example");

test("a page that matches the record passes, in English and in Arabic", () => {
  assert.deepEqual(sourcesProblems(GOOD_EN, "en", RECORD), []);
  const ar = li("paper-a", "صفحات", "مطبعة ألف", "إتاحة حرة", "https://a.example") + li("data-b", "بيانات", "باء", "CC BY", "https://b.example");
  assert.deepEqual(sourcesProblems(ar, "ar", RECORD), [], "a dropped shadda is not a difference");
});

test("a missing source, a swapped licence and a wrong link are each refused", () => {
  const missing = li("paper-a", "Pages", "Press A", "Free to use", "https://a.example");
  assert.deepEqual(sourcesProblems(missing, "en", RECORD), ["data-b: credited in SOURCES.md, missing from the page"]);
  const swapped = li("paper-a", "Pages", "Press A", "CC BY", "https://a.example") + li("data-b", "Data", "B", "Free to use", "https://b.example");
  assert.equal(sourcesProblems(swapped, "en", RECORD).length, 2);
  const link = GOOD_EN.replace("https://b.example\"", "https://elsewhere.example\"");
  assert.match(sourcesProblems(link, "en", RECORD).join("\n"), /data-b: link/);
});

test("a row for a source the record does not credit, or does not have, is refused", () => {
  const extra = GOOD_EN + li("font-c", "Font", "C", "OFL", "https://c.example") + li("ghost", "X", "Y", "Z", "https://x.example");
  assert.deepEqual(sourcesProblems(extra, "en", RECORD), [
    "font-c: on the page, but the record says it is not credited",
    "ghost: on the page, but SOURCES.md has no entry for it",
  ]);
});

test("the licence file's backticked short names are picked out, and nothing else", () => {
  const md = "From the corpus (`data-b` in `SOURCES.md`), built by `build.mjs`; see `paper-a`.";
  assert.deepEqual(namedInLicences(md, new Set(RECORD.keys())), ["data-b", "paper-a"]);
});

const { declarations, problems: recordProblems } = readDeclarations(read("SOURCES.md"));

test("the sources record reads cleanly", () => {
  assert.deepEqual(recordProblems, []);
});

for (const [path, lang] of [["apps/landing/sources.html", "en"], ["apps/landing/ar/sources.html", "ar"]]) {
  test(`${path} lists every source the record credits, as the record says it`, () => {
    const found = sourcesProblems(read(path), lang, declarations);
    assert.deepEqual(found, [], found.join("\n"));
  });
}

test("every source the licence file relies on is on the sources page, or says why not", () => {
  const ids = new Set(declarations.keys());
  const named = namedInLicences(read("LICENSES.md"), ids);
  assert.ok(named.length >= 3, `the licence file names sources by short name (found ${named.join(", ")})`);
  const rows = sourceRows(read("apps/landing/sources.html"));
  const unaccounted = named.filter((id) => !rows.has(id) && !("not-credited" in declarations.get(id)));
  assert.deepEqual(unaccounted, []);
});

test("every page of the site links its sources page", () => {
  for (const [path, href] of [
    ["index.html", "/sources.html"],
    ["privacy.html", "/sources.html"],
    ["sources.html", "/privacy.html"],
    ["ar/index.html", "/ar/sources.html"],
    ["ar/privacy.html", "/ar/sources.html"],
    ["ar/sources.html", "/ar/privacy.html"],
  ]) {
    const footer = readFileSync(join(LANDING, path), "utf8").match(/<footer>[\s\S]*?<\/footer>/)?.[0] ?? "";
    assert.match(footer, new RegExp(`href="${href.replace(/\./g, "\\.")}"`), `${path}'s footer links ${href}`);
  }
});
