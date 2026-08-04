#!/usr/bin/env node
/**
 * Does a word box from the candidate corpus land on our page?
 *
 * `probe-ligature-print.mjs` answered the question that blocked this one — the
 * candidate paginates the same print we do — and closed with the next wall:
 *
 * > word boxes do not transfer without a per-page registration against the text
 * > block (theirs states one as `data-rect` on `#md-page-inner`).
 *
 * That sentence contains a prediction, and the prediction is wrong. There is a
 * registration, it is not per-page, and it is not against the text block.
 *
 * ## The correspondence nobody had to invent
 *
 * Both corpora already mark the same physical objects: the **ayah-end
 * ornaments**. Ours are `<g ayah:x ayah:y>` in polygon space; theirs are
 * `<g id="md-aya-mark-NNN" data-surah data-aya>`. Every page therefore comes
 * with 5–20 exact point correspondences, free, needing no fonts, no rendering
 * and no judgment — which is the same standard the print probe held itself to.
 *
 * Fit `ours = s·theirs + t` on those points by least squares, independently in x
 * and y, and **measure the residual** rather than assuming one exists. The
 * residual is what decides this, so it is what gets recorded.
 *
 * Two details are load-bearing and were both learned the hard way:
 *
 * - **Document order is not reading order.** Our marker elements come out
 *   reversed on p120 and scrambled within a line on p577. Pairing on emitted
 *   order fits a mirror image: p575 and p577 produced a negative x scale and a
 *   residual of 157. Both sides are sorted into canonical reading order — band
 *   by y, then right-to-left within a band — before pairing.
 * - **Their y is top-down, like our polygons.** Our *ink* is y-flipped by the
 *   `matrix(1.3333 0 0 -1.3333 …)` the page sits under, but the ayah polygons
 *   live outside that matrix. Registering against the polygons is what makes the
 *   fit a plain positive scale instead of a flip.
 *
 * ## The check the fit has to survive
 *
 * A good residual on the markers only proves the markers line up. So every word
 * on every page is mapped through the fitted transform and its centre tested
 * against **its own ayah's** polygon — keyed on `(surah, aya)`, because keying on
 * ayah alone matches the wrong surah on a page carrying several short ones, which
 * is how an earlier version of this probe talked itself into a false negative.
 *
 * A miss is not automatically our bug or theirs. Waqf and hizb marks (ۖ ۗ ۚ ۛ ۞)
 * are separate words in their corpus, sit superscript above the line, and their
 * centres routinely fall in the previous line's band — benign, and counted
 * separately so the interesting residue is visible underneath.
 *
 * What the residue turned out to be is recorded in the result file: it is a
 * defect in **our** polygons, not in the registration.
 *
 * Nothing is vendored. Like the print probe, this is a decision probe: run when
 * the question is asked, recorded beside the hashes of the bytes it read, so a
 * rerun against the same pin either reproduces or says loudly that upstream
 * moved. The pin itself is not restated — it is read from
 * `ligature-svg.probe.json`, so there is one pin and not two. Fetched pages land
 * in the gitignored `.cache/words/` that `build-words.mjs` also reads, so a
 * rerun after that build costs nothing and reads the same bytes it shipped.
 *
 * Usage:
 *   node packages/etl/scripts/probe-word-registration.mjs          # the 61 pages
 *   node packages/etl/scripts/probe-word-registration.mjs --all    # all 604
 *   node packages/etl/scripts/probe-word-registration.mjs --write  # record it
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// The geometry, the parsing and the fit moved to lib/ when build-words.mjs
// needed them: this probe's recorded residual is only evidence about what the
// builder ships if both run the same arithmetic. See that file's header.
import { candidatePage, pin } from "./lib/candidate-pages.mjs";
import { fitFrames, pointInRings, readOurs, readTheirs, WAQF } from "./lib/mushaf-frame.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "data", "pages");
const RESULT = join(DATA, "word-registration.probe.json");
const PAGES = join(HERE, "..", "..", "..", "apps", "web", "public", "assets", "pages", "hafs-kfqc");

const { repo, commit } = pin.candidate;

/**
 * The pages worth fetching.
 *
 * The print probe's 56 — every V1/V2 divergence band plus its controls — because
 * reusing them means this probe's hashes cross-check that one's, and a page that
 * changed upstream shows up in both. Plus five pages the corpus-wide scan of our
 * own polygons flagged as suspicious (431, 545, 551, 554, 602), because a probe
 * that only looked at healthy pages could not tell "registration works" from
 * "registration works where our data happens to be complete".
 */
const EXTRA = [431, 545, 551, 554, 602];
const DEFAULT_PAGES = [
  ...new Set([
    1, 2, 119, 120, 121, 122, 123, 143, 144, 145, 146, 530, 531, 532, 533, 534, 535,
    ...Array.from({ length: 37 }, (_, i) => 564 + i),
    601, 604, ...EXTRA,
  ]),
].sort((a, b) => a - b);

/** Viewport widths the stage is actually asked to render 345 viewBox units across. */
const WIDTHS = { "320": 320, "390": 390, "430": 430 };

const all = process.argv.includes("--all");
const write = process.argv.includes("--write");
const wanted = all ? Array.from({ length: 604 }, (_, i) => i + 1) : DEFAULT_PAGES;

function analyse(page, svg) {
  const { marks, words } = readTheirs(svg);
  const ours = readOurs(readFileSync(join(PAGES, `${page}.svg`), "utf8"));
  const T = fitFrames(marks, ours.marks);

  const missed = [];
  for (const w of words) {
    const b = T.apply(w.box);
    const cx = (b[0] + b[2]) / 2;
    const cy = (b[1] + b[3]) / 2;
    const rings = ours.verses.get(`${w.surah}:${w.aya}`) ?? [];
    if (!pointInRings(rings, cx, cy)) {
      missed.push({ key: `${w.surah}:${w.aya}`, idx: w.idx, line: w.line, hafs: w.hafs });
    }
  }
  const waqf = missed.filter((m) => [...m.hafs].every((c) => WAQF.has(c))).length;
  return {
    page,
    viewBox: ours.vb.join(" "),
    markers: T.markers,
    sx: T.sx,
    tx: T.tx,
    sy: T.sy,
    ty: T.ty,
    residual: T.residual,
    words: words.length,
    missed: missed.length,
    missedWaqf: waqf,
    // Which ayahs lost words, and how many — the shape of the residue.
    gaps: Object.entries(
      missed
        .filter((m) => ![...m.hafs].every((c) => WAQF.has(c)))
        .reduce((acc, m) => ({ ...acc, [m.key]: (acc[m.key] ?? 0) + 1 }), {}),
    )
      .filter(([, n]) => n >= 3)
      .map(([key, n]) => ({ key, words: n })),
  };
}

// --------------------------------------------------------------------- run --

console.log(`\n  probe:word-registration — ${repo} @ ${commit.slice(0, 12)}`);
console.log(`  ${wanted.length} page(s): fitting ours = s·theirs + t on the ayah-end ornaments\n`);

const rows = [];
const failed = [];
let bytes = 0;

for (const page of wanted) {
  const { body, sha256 } = await candidatePage(page);
  bytes += body.length;
  try {
    const r = analyse(page, body.toString("utf8"));
    rows.push({ ...r, sha256 });
    const flag = r.missed - r.missedWaqf >= 3 ? "✗" : "·";
    process.stdout.write(
      `  ${flag} p${String(page).padStart(3)}  ${String(r.markers).padStart(2)} marks` +
        `  residual ${r.residual.toFixed(3)}` +
        `  ${String(r.missed).padStart(3)}/${String(r.words).padStart(3)} words adrift` +
        `${r.gaps.length ? `   ← ${r.gaps.map((g) => `${g.key} (${g.words})`).join(", ")}` : ""}\n`,
    );
  } catch (e) {
    failed.push({ page, why: String(e.message) });
    process.stdout.write(`  ? p${String(page).padStart(3)}  ${e.message}\n`);
  }
}

const std = rows.filter((r) => r.viewBox === "0 0 345 550");
const group = (name, g) => {
  if (!g.length) return null;
  const range = (k) => [Math.min(...g.map((r) => r[k])), Math.max(...g.map((r) => r[k]))];
  return { name, pages: g.length, sx: range("sx"), tx: range("tx"), sy: range("sy"), ty: range("ty") };
};
const groups = [
  group("even", std.filter((r) => r.page % 2 === 0)),
  group("odd", std.filter((r) => r.page % 2 === 1)),
  group("override", rows.filter((r) => r.viewBox !== "0 0 345 550")),
].filter(Boolean);

const residuals = std.map((r) => r.residual).sort((a, b) => a - b);
const maxRes = residuals.at(-1) ?? 0;
const medRes = residuals[Math.floor(residuals.length / 2)] ?? 0;
const totalWords = rows.reduce((t, r) => t + r.words, 0);
const totalMissed = rows.reduce((t, r) => t + r.missed, 0);
const totalWaqf = rows.reduce((t, r) => t + r.missedWaqf, 0);
const holes = rows.flatMap((r) => r.gaps.map((g) => ({ page: r.page, ...g })));

console.log("");
for (const g of groups) {
  console.log(
    `  ${g.name.padEnd(9)} (${String(g.pages).padStart(2)}): ` +
      `sx ${g.sx[0].toFixed(5)}–${g.sx[1].toFixed(5)}  tx ${g.tx[0].toFixed(3)}–${g.tx[1].toFixed(3)}  ` +
      `sy ${g.sy[0].toFixed(5)}–${g.sy[1].toFixed(5)}  ty ${g.ty[0].toFixed(3)}–${g.ty[1].toFixed(3)}`,
  );
}
console.log(`\n  marker residual: median ${medRes.toFixed(3)}, max ${maxRes.toFixed(3)} viewBox units`);
for (const [label, w] of Object.entries(WIDTHS)) {
  console.log(`    at ${label} px wide: median ${(medRes * (w / 345)).toFixed(3)} px, max ${(maxRes * (w / 345)).toFixed(3)} px`);
}
console.log(
  `\n  ${totalMissed}/${totalWords} word centres (${((totalMissed / totalWords) * 100).toFixed(1)}%) fall outside their own ayah polygon` +
    `\n    ${totalWaqf} are single waqf/hizb marks — superscript, above their line, benign` +
    `\n    ${totalMissed - totalWaqf} are ordinary words, on ${new Set(holes.map((h) => h.page)).size} page(s)`,
);

const verdict = maxRes < 1 ? "registers" : "does-not-register";
console.log(`\n  verdict: ${verdict} — (${(bytes / 1024 / 1024).toFixed(1)} MB read)\n`);

if (write) {
  const prior = JSON.parse(readFileSync(RESULT, "utf8"));
  writeFileSync(
    RESULT,
    `${JSON.stringify(
      {
        ...prior,
        ranOn: new Date().toISOString().slice(0, 10),
        verdict,
        transform: {
          groups: groups.map((g) => ({
            ...g,
            sx: g.sx.map((v) => Number(v.toFixed(5))),
            tx: g.tx.map((v) => Number(v.toFixed(3))),
            sy: g.sy.map((v) => Number(v.toFixed(5))),
            ty: g.ty.map((v) => Number(v.toFixed(3))),
          })),
          residualViewBoxUnits: { median: Number(medRes.toFixed(3)), max: Number(maxRes.toFixed(3)) },
          residualDevicePx: Object.fromEntries(
            Object.entries(WIDTHS).map(([label, w]) => [
              label,
              { median: Number((medRes * (w / 345)).toFixed(3)), max: Number((maxRes * (w / 345)).toFixed(3)) },
            ]),
          ),
        },
        coverage: {
          words: totalWords,
          missed: totalMissed,
          missedWaqfOrHizb: totalWaqf,
          missedOrdinary: totalMissed - totalWaqf,
          holes,
        },
        failed,
        pages: rows.map((r) => ({
          page: r.page,
          sha256: r.sha256,
          markers: r.markers,
          residual: Number(r.residual.toFixed(4)),
          words: r.words,
          missed: r.missed,
        })),
      },
      null,
      2,
    )}\n`,
  );
  console.log(`  wrote ${RESULT}\n`);
}

process.exitCode = verdict === "registers" ? 0 : 1;
