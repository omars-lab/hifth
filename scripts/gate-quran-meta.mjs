#!/usr/bin/env node
/**
 * CI gate: the structural tables in `@hifth/core` are what their source says.
 *
 * `AYAH_COUNTS`, `JUZ_STARTS` and `HIZB_STARTS` are hand-typed constants —
 * deliberately, because core is framework-free and must not read a file to answer
 * "which juz is this ayah in". The cost of a typed constant is that it can be
 * typed wrong, and this particular class of wrong is invisible: every number
 * stays in range, the list stays ascending, the count stays right, and the only
 * symptom is an ayah quietly filed under the wrong division. #80 was exactly that
 * shape — a whole corpus off by one, shipped, for four loops.
 *
 * So the constants keep an upstream: the Tanzil metadata file, vendored verbatim
 * at packages/etl/data/meta/quran-data.xml (CC BY; see the adjacent
 * PROVENANCE.md). This gate re-derives all three tables from those bytes and
 * diffs them against what core exports. The prose comment on JUZ_STARTS has named
 * Tanzil since Loop 4a; this is the first thing that checks it.
 *
 * Read from the TypeScript source, not from `dist/`: the gate must fail on the
 * commit that introduces the typo, and dist is a build artifact that may be
 * stale, absent, or (in CI's gate job) never built at all.
 *
 * HIZB IS NOT HALF A JUZ. Tanzil publishes no hizb element — the division is
 * given at its finest grain as 240 `<quarter>` (أرباع الأحزاب) and a hizb is four
 * of them, so hizb h opens at quarter 4h−3. The arithmetic shortcut (split each
 * juz down the middle) agrees with the truth for 4 of 30 even hizbs and misses by
 * up to 39 ayahs elsewhere, so the last check here is the one that refuses it.
 *
 * Run: `pnpm gate:quran-meta` (also in `pnpm gates`, `make ci` and CI).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const XML = join(ROOT, "packages", "etl", "data", "meta", "quran-data.xml");
const META = join(ROOT, "packages", "core", "src", "quran-meta.ts");

const problems = [];

// ── The source of truth ──────────────────────────────────────────────────────
const xml = readFileSync(XML, "utf8");

/** Every `<tag … sura="s" aya="a">` in document order, as [s, a] pairs. */
function pairs(tag) {
  const re = new RegExp(`<${tag}\\s+index="(\\d+)"\\s+sura="(\\d+)"\\s+aya="(\\d+)"`, "g");
  return [...xml.matchAll(re)].map((m) => [Number(m[2]), Number(m[3])]);
}

const juz = pairs("juz");
const quarters = pairs("quarter");
const suraCounts = [...xml.matchAll(/<sura\s+index="(\d+)"\s+ayas="(\d+)"/g)].map((m) =>
  Number(m[2]),
);
// A hizb is four quarters: 1, 5, 9 … 237.
const hizb = quarters.filter((_, i) => i % 4 === 0);

// The vendored file being the wrong file is the one failure that would make
// every check below pass vacuously.
if (juz.length !== 30 || quarters.length !== 240 || suraCounts.length !== 114) {
  console.error(
    `gate:quran-meta — FAIL: ${XML.replace(ROOT, "")} does not look like the Tanzil ` +
      `metadata (found ${suraCounts.length} sura, ${juz.length} juz, ${quarters.length} ` +
      `quarter elements; expected 114 / 30 / 240).`,
  );
  process.exit(1);
}

// ── What core claims ─────────────────────────────────────────────────────────
const src = readFileSync(META, "utf8");

/** The numbers of an exported `const NAME = [...]`, flat. */
function numbersOf(name) {
  const at = src.indexOf(`export const ${name}`);
  if (at === -1) return null;
  const open = src.indexOf("[", at);
  const close = src.indexOf("];", open);
  if (open === -1 || close === -1) return null;
  return [...src.slice(open + 1, close).matchAll(/-?\d+/g)].map((m) => Number(m[0]));
}

/** Flat numbers → [s, a] pairs. */
const asPairs = (flat) => flat.reduce((out, n, i) => {
  if (i % 2 === 0) out.push([n, flat[i + 1]]);
  return out;
}, []);

const TABLES = [
  { name: "AYAH_COUNTS", expected: suraCounts, actual: numbersOf("AYAH_COUNTS"), width: 1 },
  { name: "JUZ_STARTS", expected: juz, actual: null, width: 2 },
  { name: "HIZB_STARTS", expected: hizb, actual: null, width: 2 },
];
TABLES[1].actual = asPairs(numbersOf("JUZ_STARTS") ?? []);
TABLES[2].actual = asPairs(numbersOf("HIZB_STARTS") ?? []);

const show = (v) => (Array.isArray(v) ? `${v[0]}:${v[1]}` : String(v));

for (const { name, expected, actual, width } of TABLES) {
  if (!actual || actual.length === 0) {
    problems.push(`${name} is not exported from packages/core/src/quran-meta.ts as an array literal`);
    continue;
  }
  if (actual.length !== expected.length) {
    problems.push(
      `${name} has ${actual.length} entries; the Tanzil metadata has ${expected.length}`,
    );
    continue;
  }
  for (let i = 0; i < expected.length; i++) {
    const a = actual[i];
    const e = expected[i];
    const same = width === 1 ? a === e : a[0] === e[0] && a[1] === e[1];
    if (!same) {
      problems.push(
        `${name}[${i}] is ${show(a)}, but the Tanzil metadata says ${show(e)} ` +
          `(entry #${i + 1}).`,
      );
    }
  }
}

// ── Cross-check: a juz is two hizbs ──────────────────────────────────────────
//
// True of the source by construction, so this is really a check on the derivation
// above: if the quarter stride were ever wrong, this is what would say so.
for (let k = 0; k < 30; k++) {
  const [hs, ha] = hizb[2 * k];
  const [js, ja] = juz[k];
  if (hs !== js || ha !== ja) {
    problems.push(
      `derivation is wrong: hizb ${2 * k + 1} starts ${hs}:${ha} but juz ${k + 1} ` +
        `starts ${js}:${ja} — every odd hizb opens a juz.`,
    );
  }
}

// ── The shortcut this whole file exists to refuse ────────────────────────────
{
  const offsets = [];
  let acc = 0;
  for (const n of suraCounts) {
    offsets.push(acc);
    acc += n;
  }
  const abs = ([s, a]) => offsets[s - 1] + a;
  let onMidpoint = 0;
  for (let k = 0; k < 30; k++) {
    const start = abs(juz[k]);
    const end = k === 29 ? acc + 1 : abs(juz[k + 1]);
    if (abs(hizb[2 * k + 1]) === Math.floor((start + end) / 2)) onMidpoint++;
  }
  if (onMidpoint > 4) {
    problems.push(
      `${onMidpoint} of 30 even hizbs sit at their juz's arithmetic midpoint — the ` +
        `real division has 4. Either the source file changed or HIZB_STARTS was ` +
        `regenerated by halving the juz, which is the one derivation that must never ` +
        `be used: it is wrong for 26 of 30 hizbs, by up to 39 ayahs.`,
    );
  }
}

if (problems.length > 0) {
  console.error("gate:quran-meta — FAIL:");
  for (const p of problems) console.error("  -", p);
  process.exit(1);
}

console.log(
  `gate:quran-meta — OK (114 ayah counts, 30 juz, 60 hizb from 240 quarters, ` +
    `all matching packages/etl/data/meta/quran-data.xml)`,
);
