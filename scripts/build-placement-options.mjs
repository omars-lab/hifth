#!/usr/bin/env node
/**
 * Render docs/design/mark-placement.html — where the app should put the
 * rectangles it draws over the print, with each answer drawn on a real page of
 * the mus'haf at the size it would actually be used.
 *
 * ── Why this is a page and not a section of mark-registration.md ────────────
 * The write-up already carries the measurement, and it is not in dispute: the
 * frame every rectangle rides on is fitted on the verse-end ornaments, the only
 * objects the two prints both label, and it is excellent there and about a
 * mark-height wrong at the text. What the write-up cannot do is answer the
 * question that is actually open, which is how much correction is worth its
 * cost — and that is a question about what a person sees on a screen, at the
 * size they see it. A table of overlap fractions cannot be looked at.
 *
 * So the options are drawn. Every rectangle on this page is the rectangle the
 * app would ship under that option, computed by the same code the shards would
 * be built with, over the same print the app serves.
 *
 * ── Two modes, because the inputs live in two different places ──────────────
 *   node scripts/build-placement-options.mjs            # render (repo bytes)
 *   node scripts/build-placement-options.mjs --extract  # refresh the data file
 *
 * The render reads only committed bytes — the page SVG, the word shard, the
 * manifest, the stylesheet — plus `mark-placement.data.json`, so anyone with a
 * checkout rebuilds the identical file.
 *
 * `--extract` is maintainer-only twice over. It needs the 348 MB gitignored
 * fetch cache under `packages/etl/data/pages/.cache/` for the ligature corpus,
 * and it needs a per-mark displacement file — the one `probe-mark-ink.mjs`
 * writes with `--rows-out`, which takes about an hour over all 604 pages and is
 * far too large to commit. Both are named on the command line; without either
 * it refuses rather than emitting a thinner data file, because a data file that
 * is sometimes complete is worse than one that is absent.
 *
 *   node scripts/build-placement-options.mjs --extract --rows <rows.json>
 *
 * That one file is the whole input. The held-out grades used to be read out of
 * four separate scorer runs named with a `--held-out` flag, and that was worse
 * in both directions: the four could silently be over different page sets, and
 * omitting the flag emitted a data file with no held-out block at all — which
 * every consumer then fell back out of, into figures graded on their own
 * training marks, under captions still saying they were held out. They are now
 * computed here, from these rows, on the same split for every rung.
 *
 * ── There is no Quran text in this file, or in the one it writes ────────────
 * Same property as `build-mark-options.mjs`, and for the same reason: the data
 * file is rectangles and Latin mark names, the print is referenced rather than
 * inlined, and the print itself is outlined `<path>` with zero Arabic
 * codepoints. A reader sees the word because the mus'haf draws it.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DATA = join(ROOT, "docs/design/mark-placement.data.json");
const OUT = join(ROOT, "docs/design/mark-placement.html");
const OUT_ARTIFACT = join(ROOT, "docs/design/mark-placement.artifact.html");

/**
 * Two copies, and one run writes both. They differ in exactly one thing: where
 * the picture of the mus'haf comes from.
 *
 * The checked-in copy points at the print with a relative URL, which is right
 * for somebody who opens the file inside a checkout and keeps it small. The
 * published copy cannot do that — it is served from claude.ai under a CSP that
 * blocks every external host, so the relative URL resolves to nothing and every
 * specimen is an empty overlay over blank paper. That copy inlines the print
 * ONCE as a `<symbol>` and `<use>`s it per specimen.
 *
 * This used to be a `--artifact` flag, and the flag is why the published page
 * lost its subject: the two copies were produced by two hand-run commands, so
 * the checked-in one could be rebuilt and look perfect while the published one
 * stayed twenty minutes behind, missing an option. A reader of the repo has no
 * way to notice — the copy they open is the one that is right. Writing both
 * from one pass is not a convenience; it removes the only state in which the
 * repo lies about what was published.
 */
const COPIES = [
  { artifact: false, out: OUT },
  { artifact: true, out: OUT_ARTIFACT },
];

/** How far a rectangle may sit from its own ink before it is "badly out". */
const FAR = 0.75;

const GRAINS = ["shipped", "page", "line", "tilt"];

/**
 * When is the mark's own ink search allowed to place it? — option H's guard.
 *
 * Two refusals, and both were found by measuring rather than by worrying. The
 * fear that a per-mark search would snap onto the *neighbouring* mark turns out
 * to be very nearly groundless on this print: the nearest mark of any name is a
 * median 8.32 units away and the nearest one that looks identical is 24.80,
 * against a search that reaches 3 and an error near 1. Across all 326,515 marks
 * the search lands nearer some other mark 1.09% of the time and nearer an
 * identical-looking one 0.01% — 48 marks in the whole mus'haf. That objection is
 * retired; it was the main argument against this option and it did not survive
 * contact with the numbers.
 *
 * What the measurement does refuse is different and sharper. Where the match is
 * weak the search is chasing noise: below 0.55 it departs from the printed
 * line's own answer by a median 1.7 to 2.8 units and throws 44–72% of marks more
 * than 2 units, against a median 0.21 and 0.2% above the threshold. And a search
 * that stops at its own boundary has not found anything — it has run out of room,
 * so its answer is a fact about the window and not about the ink. Those two sets
 * do not get placed from ink; they inherit the printed line, which is the whole
 * reason this is an option and not a hazard.
 *
 * The boundary test is per axis, and getting that wrong cost this page a set of
 * numbers. The search slides the mark's outline over a *square* window, ±radius
 * in each direction independently, so it ran out of room exactly when one of the
 * two components came back sitting on ±radius. An earlier version of this line
 * asked whether the straight-line distance exceeded the radius, which draws a
 * circle inside that square and throws away every corner of it — 8,358 marks
 * whose match was a median 0.905 against an achievable 0.909, discarded under a
 * caption saying the search had run out of room when it had not been near its
 * edge. Distance travelled is not evidence of a bad placement; a weak match and
 * a pinned search are.
 */
const TRUST = { iou: 0.55, radius: 3 };
const atWindowEdge = (r) =>
  Math.abs(Math.abs(r.dx) - TRUST.radius) < 1e-6 || Math.abs(Math.abs(r.dy) - TRUST.radius) < 1e-6;
const trusted = (r) => r.iouBest >= TRUST.iou && !atWindowEdge(r);

/** The grain names the correction builder knows, keyed by ours. */
const GRAIN_ARG = { page: "page", line: "line", tilt: "line-tilt" };

const argOf = (name, fallback = null) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
};

const r3 = (n) => Math.round(n * 1000) / 1000;
const r2 = (n) => Math.round(n * 100) / 100;

// ───────────────────────────────────────────────────────────── extract ──────

async function extract() {
  const ETL = join(ROOT, "packages/etl/scripts");
  const cache = join(ROOT, "packages/etl/data/pages/.cache");
  const rowsPath = argOf("--rows");
  if (!existsSync(cache)) {
    console.error("--extract needs the quran-svg fetch cache at packages/etl/data/pages/.cache/");
    console.error("It is gitignored and 348 MB. Run the vendor step first, or drop --extract.");
    process.exit(1);
  }
  if (!rowsPath || !existsSync(rowsPath)) {
    console.error("--extract needs --rows <file>, the per-mark displacements.");
    console.error("  node packages/etl/scripts/probe-mark-ink.mjs --pages-n 604 --sample 400000 \\");
    console.error("    --grain line-tilt --out <html> --shift-out <json> --rows-out <rows.json>");
    process.exit(1);
  }

  const { candidatePage } = await import(join(ETL, "lib/candidate-pages.mjs"));
  const { applierFromPin, readDiacritics } = await import(join(ETL, "lib/diacritics.mjs"));
  const { readOurs, readTheirs, readingOrder } = await import(join(ETL, "lib/mushaf-frame.mjs"));
  const { correctionFor, shuffledCorrectionFor, splitHalfLadder, residualsUnder, half } = await import(
    join(ETL, "lib/registration-grain.mjs")
  );

  const rows = JSON.parse(readFileSync(rowsPath, "utf8"));
  const byPage = new Map();
  for (const r of rows) {
    if (!byPage.has(r.page)) byPage.set(r.page, []);
    byPage.get(r.page).push(r);
  }

  /** How far each mark still is from its own ink, once a correction is applied. */
  const residuals = (rs, corr) =>
    rs.map((r) => {
      const a = corr.apply(r);
      return Math.hypot(r.dx - a.dx, r.dy - a.dy);
    });
  const share = (xs) => xs.filter((v) => v > FAR).length / xs.length;
  const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  };

  const NONE = { apply: () => ({ dx: 0, dy: 0 }) };
  const corrections = (rs) => ({
    shipped: NONE,
    page: correctionFor("page", rs),
    line: correctionFor("line", rs),
    tilt: correctionFor("line-tilt", rs),
  });

  // ── the corpus, one row per page, so the page we draw can be placed in it ──
  const perPage = [];
  for (const [page, rs] of byPage) {
    const c = corrections(rs);
    const row = { page, n: rs.length, lines: new Set(rs.map((r) => r.line)).size };
    for (const g of GRAINS) row[g] = share(residuals(rs, c[g]));
    perPage.push(row);
  }
  perPage.sort((a, b) => a.page - b.page);

  const corpusMedian = {};
  for (const g of GRAINS) corpusMedian[g] = r3(median(perPage.map((p) => p[g])));
  const corpusAll = {};
  {
    // Pooled over every mark rather than averaged over pages: a page with more
    // marks should weigh more, and the held-out figures are pooled too.
    const all = [];
    for (const g of GRAINS) all.push([g, []]);
    const acc = new Map(all);
    for (const [, rs] of byPage) {
      const c = corrections(rs);
      for (const g of GRAINS) acc.get(g).push(...residuals(rs, c[g]));
    }
    for (const g of GRAINS) {
      corpusAll[g] = { far: r3(share(acc.get(g))), p50: r3(median(acc.get(g))) };
    }
  }

  // The control that says a per-line correction is not a richer model flattering
  // itself: give every line another line's correction and it gets worse than
  // applying no per-line correction at all.
  const shuffled = [];
  for (const [, rs] of byPage) shuffled.push(...residuals(rs, shuffledCorrectionFor("line-tilt", rs)));
  const shuffle = r3(share(shuffled));

  // ── the page we draw ───────────────────────────────────────────────────────
  const PAGE = Number(argOf("--page", "179"));
  const drawn = byPage.get(PAGE);
  if (!drawn) {
    console.error(`page ${PAGE} is not in ${basename(rowsPath)}`);
    process.exit(1);
  }
  const corr = corrections(drawn);
  const at = (r) => {
    const o = {};
    for (const g of GRAINS) {
      if (g === "shipped") continue;
      const a = corr[g].apply(r);
      o[g] = [r3(a.dx), r3(a.dy)];
    }
    // Option H, which is not a grain and cannot be built by the grain builder:
    // where the mark's own ink match is convincing, the mark goes exactly where
    // the search found it; where it is not, it inherits the printed line. The
    // fallback is what makes this shippable rather than reckless — see TRUST.
    const a = corr.tilt.apply(r);
    o.mark = trusted(r) ? [r3(r.dx), r3(r.dy)] : [r3(a.dx), r3(a.dy)];
    return o;
  };

  const pin = new Map(
    JSON.parse(readFileSync(join(ROOT, "packages/etl/data/pages/word-boxes.pin.json"), "utf8")).pages.map(
      (p) => [p.page, p],
    ),
  );
  const pinRow = pin.get(PAGE);
  const apply = applierFromPin(pinRow);
  const theirSvg = (await candidatePage(PAGE, { offline: true })).body.toString("utf8");
  const ourSvg = readFileSync(join(ROOT, `apps/web/public/assets/pages/hafs-kfqc/${PAGE}.svg`), "utf8");

  // Word boxes, and which printed line each was set on. The shipped shard is
  // the geometry the app actually draws; the corpus is the only thing that
  // knows the line, so the two are joined on the print's own word index.
  const lineOf = new Map();
  for (const w of readDiacritics(theirSvg, apply)) lineOf.set(`${w.surah}:${w.aya}:${w.idx}`, w.line);
  const shard = JSON.parse(
    readFileSync(join(ROOT, `apps/web/public/assets/words/hafs-kfqc/${PAGE}.json`), "utf8"),
  );
  const words = [];
  for (const [key, entry] of Object.entries(shard.words ?? {})) {
    entry.boxes.forEach((b, i) => {
      const line = lineOf.get(`${key}:${entry.from + i}`);
      if (!line) return;
      const box = b.map(r2);
      words.push({ l: line, b: box, o: at({ page: PAGE, line, box }) });
    });
  }

  // The verse-end circles: the objects the whole frame was fitted on, and
  // therefore the one held-out witness on this page that is not made of ink.
  const theirs = readingOrder(
    readTheirs(theirSvg).marks.map((t) => {
      const [x0, y0, x1, y1] = apply(t.box);
      return [(x0 + x1) / 2, (y0 + y1) / 2];
    }),
    11,
  );
  const ours = readingOrder(readOurs(ourSvg).marks, 11);
  const markLineY = new Map();
  for (const r of drawn) {
    const y = r.box[1] + r.box[3] / 2;
    const list = markLineY.get(r.line) ?? [];
    list.push(y);
    markLineY.set(r.line, list);
  }
  const lineMidY = [...markLineY].map(([l, ys]) => [l, median(ys)]);
  const ornaments = [];
  if (theirs.length === ours.length) {
    theirs.forEach((t, i) => {
      // An ornament carries no line number of its own, so it is given the
      // printed line whose marks sit nearest it down the page — which is the
      // line whose correction would move it.
      const line = lineMidY.reduce((best, [l, y]) =>
        Math.abs(y - t[1]) < Math.abs(best[1] - t[1]) ? [l, y] : best,
      )[0];
      const box = [t[0] - 2, t[1] - 2, 4, 4];
      ornaments.push({
        l: line,
        fit: [r2(t[0]), r2(t[1])],
        ours: [r2(ours[i][0]), r2(ours[i][1])],
        o: at({ page: PAGE, line, box }),
      });
    });
  }

  // ── the held-out ladder ───────────────────────────────────────────────────
  // Every figure the page quotes as evidence comes from here, and it is computed
  // in this process from the same rows the rest of the file reads. It used to be
  // read out of four separate scorer runs named on the command line, which was
  // wrong twice: the four could be over different page sets and nothing said so,
  // and forgetting the flag left the block empty, at which point the page quietly
  // fell back to figures graded on their own training marks while still captioned
  // as held out. Computing it here means it cannot go missing and it cannot
  // disagree with the corpus figures beside it.
  //
  // The split is `half()`, which keys on the mark's own identity rather than its
  // position, so the same mark is on the same side of the split in every run and
  // in every rung. `shipped` is scored on the same held-out half as the rest —
  // it has no correction to fit, but it must be graded on the same marks or the
  // first row of the ladder is not comparable with the ones under it.
  const wilson = (k, n) => {
    if (!n) return [];
    const z = 1.96;
    const p = k / n;
    const d = 1 + (z * z) / n;
    const c = p + (z * z) / (2 * n);
    const s = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
    return [r2(100 * ((c - s) / d)), r2(100 * ((c + s) / d))];
  };

  const heldOut = {};
  for (const g of GRAINS) {
    const rung =
      g === "shipped"
        ? { groups: { pages: byPage.size }, heldOut: residualsUnder(rows.filter((r) => half(r) === 1), NONE.apply), trained: residualsUnder(rows.filter((r) => half(r) === 0), NONE.apply) }
        : splitHalfLadder(rows, GRAIN_ARG[g]);
    const h = rung.heldOut;
    heldOut[g] = {
      pages: rung.groups.pages,
      scored: h.n,
      far: r2(h.over),
      ci: wilson(Math.round((h.over / 100) * h.n), h.n),
      p50: r3(h.med),
      p95: r3(h.p95),
      // The gap to the same correction graded on the marks it was fitted from.
      // A rung that only wins on its own training marks has earned nothing, so
      // the overfit is carried beside the figure rather than left to be trusted.
      trained: r2(rung.trained.over),
    };
  }
  // The shuffle control, graded on the same held-out half as the rungs it is
  // compared against. It was previously only available fitted-and-scored on
  // every mark, which meant the page put a trained figure next to a held-out one
  // and invited a reader to divide them.
  heldOut.shuffle = r2(splitHalfLadder(rows, "line-tilt", { shuffled: true }).heldOut.over);

  // ── option H, which this instrument cannot grade and must still describe ───
  //
  // Every rung above is a model fitted on half the marks and graded on the other
  // half. H is not a model: on the marks it accepts it ships the measurement
  // itself, so its residual there is zero by construction and that zero carries
  // no information whatever — a fact stated on the page rather than dressed up
  // as a win. What CAN be said honestly is two things, and both are here: how
  // much of the book it places from direct evidence, and how the part it refuses
  // to place that way scores under the model it falls back to. The second is the
  // only error H can be blamed for by this measurement, and it is not small on
  // its own terms, which is exactly why the fallback set is named and counted
  // rather than averaged away.
  {
    const acc = rows.filter(trusted);
    const fall = rows.filter((r) => !trusted(r));
    const { apply } = correctionFor("line-tilt", rows);
    const resid = (rs) => {
      const d = rs.map((r) => {
        const a = apply(r);
        return Math.hypot(r.dx - a.dx, r.dy - a.dy);
      }).sort((x, y) => x - y);
      const at2 = (p) => d[Math.min(d.length - 1, Math.floor(p * d.length))] ?? 0;
      return { far: r2((100 * d.filter((x) => x > FAR).length) / d.length), p50: r3(at2(0.5)), p95: r3(at2(0.95)) };
    };
    const f = resid(fall);
    heldOut.mark = {
      placed: acc.length,
      fellBack: fall.length,
      share: r2((100 * acc.length) / rows.length),
      weak: rows.filter((r) => r.iouBest < TRUST.iou).length,
      clamped: rows.filter(atWindowEdge).length,
      fallback: f,
      // What H leaves badly out across the whole book, counting only the marks
      // it did not place from ink — the accepted ones contribute a zero this
      // instrument is not entitled to claim.
      far: r2((f.far * fall.length) / rows.length),
    };
  }

  // ── how close together the marks actually are ──────────────────────────────
  //
  // This answers the objection that killed the per-mark idea the first time it
  // was written up: that a search for the nearest ink would find the *neighbour's*
  // and centre a rectangle neatly on the wrong mark. It was asserted from a guess
  // that adjacent marks sit about a unit apart. They do not, and the page now
  // prints the real distances instead of the guess. Measured per page against
  // every other mark on that page, from box centre to box centre — the same
  // frame everything else here is in.
  const neighbour = (() => {
    const cen = (r) => [r.box[0] + r.box[2] / 2, r.box[1] + r.box[3] / 2];
    const any = [];
    const same = [];
    let jumpAny = 0;
    let jumpSame = 0;
    for (const [, rs] of byPage) {
      const pts = rs.map(cen);
      for (let i = 0; i < rs.length; i++) {
        let dAny = Infinity;
        let dSame = Infinity;
        let nAny = null;
        let nSame = null;
        for (let j = 0; j < rs.length; j++) {
          if (i === j) continue;
          const g = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
          if (g < dAny) { dAny = g; nAny = j; }
          if (rs[j].name === rs[i].name && g < dSame) { dSame = g; nSame = j; }
        }
        if (nAny !== null) any.push(dAny);
        if (nSame !== null) same.push(dSame);
        // Where the search actually ended up, against where the neighbours are.
        // A "jump" is a landing that is closer to another mark's centre than to
        // its own — the failure the objection predicted, counted rather than feared.
        const lx = pts[i][0] + rs[i].dx;
        const ly = pts[i][1] + rs[i].dy;
        const own = Math.hypot(rs[i].dx, rs[i].dy);
        if (nAny !== null && Math.hypot(lx - pts[nAny][0], ly - pts[nAny][1]) < own) jumpAny++;
        if (nSame !== null && Math.hypot(lx - pts[nSame][0], ly - pts[nSame][1]) < own) jumpSame++;
      }
    }
    const med = (a) => { a.sort((x, y) => x - y); return r2(a[Math.floor(a.length / 2)] ?? 0); };
    return {
      anyP50: med(any),
      sameP50: med(same),
      radius: TRUST.radius,
      jumpAny: r2((100 * jumpAny) / rows.length),
      jumpSame: r3((100 * jumpSame) / rows.length),
      jumpSameN: jumpSame,
    };
  })();

  const data = {
    $comment: [
      "Generated by scripts/build-placement-options.mjs --extract. Geometry only — no Quran text.",
      "Coordinates are the page frame the word shards use. `b` is the rectangle the app ships",
      "today; `o` is how far each option would move it, and `ink` how far it would have to move",
      "to sit on the printer's own ink. Mark names are Latin; words are referred to by the",
      "print's own word index and never by their text.",
    ],
    ran: new Date().toISOString().slice(0, 10),
    page: PAGE,
    viewBox: (ourSvg.match(/viewBox="([^"]*)"/)?.[1] ?? "0 0 345 550").trim(),
    far: FAR,
    pin: { markers: pinRow.markers, residual: pinRow.residual, words: pinRow.words },
    marks: drawn.map((r) => ({
      n: r.name,
      l: r.line,
      b: r.box.map(r2),
      ink: [r3(r.dx), r3(r.dy)],
      // Whether option H is willing to place this mark from its own ink. Kept
      // per mark rather than recomputed in the renderer so the picture and the
      // count in §7 cannot drift apart.
      t: trusted(r) ? 1 : 0,
      o: at(r),
    })),
    words,
    ornaments,
    drawnPage: {
      ...Object.fromEntries(GRAINS.map((g) => [g, r3(share(residuals(drawn, corr[g])))])),
      // H on the drawn page. A mark it accepts contributes a zero, because it is
      // placed at the very thing this column measures distance to — which is the
      // honest arithmetic and also the reason the caption beside it says so.
      mark: r3(
        share(
          drawn.map((r) => {
            if (trusted(r)) return 0;
            const a = corr.tilt.apply(r);
            return Math.hypot(r.dx - a.dx, r.dy - a.dy);
          }),
        ),
      ),
    },
    corpus: {
      pages: perPage.length,
      marks: rows.length,
      pooled: corpusAll,
      medianPage: corpusMedian,
      shuffle,
      lines: perPage.reduce((t, p) => t + p.lines, 0),
    },
    heldOut,
    neighbour,
    unmeasured: [1, 2, 603, 604],
  };
  writeFileSync(DATA, `${JSON.stringify(data, null, 1)}\n`);
  console.log(
    `--extract — page ${PAGE}: ${data.marks.length} marks, ${words.length} words, ` +
      `${ornaments.length} verse-end circles → ${basename(DATA)}`,
  );
  console.log(
    `  corpus ${perPage.length} pages, ${rows.length.toLocaleString("en")} marks: ` +
      GRAINS.map((g) => `${g} ${(corpusAll[g].far * 100).toFixed(1)}%`).join(" · ") +
      ` · shuffled lines ${(shuffle * 100).toFixed(1)}%`,
  );
}

// ────────────────────────────────────────────────────────────── render ──────

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pctS = (n) => `${(n * 100).toFixed(1)}%`;

/** Colours read out of the app's own stylesheet, so the picture cannot drift. */
function palette() {
  const css = readFileSync(join(ROOT, "apps/web/src/styles/tokens.css"), "utf8");
  const one = (name) => css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim() ?? null;
  return {
    mark: one("tj-ghunnah") ?? "#7a4fb5",
    word: one("tj-madd") ?? "#1f6f66",
    ink: one("tj-qalqalah") ?? "#b5522f",
  };
}

// The letters are the record's, not this page's. The record enumerated six
// options in the order they were written and this page draws four of them, so
// numbering them A–D here would have given the same option two names depending
// on which document a reader happened to open. C and D and E stay in the record
// and are named in §⑩ below; the two that are only in the record are the ones
// nothing would be gained by drawing.
const OPTIONS = [
  {
    id: "A",
    grain: "shipped",
    title: "Leave the rectangles where they are",
    tag: "what the app does today",
    what: "Nothing changes. The rectangle for every mark and every word stays where the fit on the verse-end circles put it.",
  },
  {
    id: "B",
    grain: "page",
    title: "Line each page up as a whole",
    tag: "two more numbers a page",
    what: "Every rectangle on a page moves together, by one amount worked out from that page's own marks.",
  },
  {
    id: "F",
    grain: "tilt",
    title: "Line each printed line up on its own, and let it tilt",
    tag: "the recommendation — four more numbers a line",
    what: "Each printed line gets its own amount, and that amount is allowed to grow along the line rather than being the same at both ends. Marks and words move together.",
  },
  {
    id: "G",
    grain: "tilt",
    title: "Line the marks up, and leave the words where they are",
    tag: "the same, for half the page's geometry",
    what: "The same per-line correction, applied only to the marks. Word rectangles stay on the fit they ship on today.",
    wordsStay: true,
  },
  {
    id: "H",
    grain: "mark",
    title: "Put each mark where its own ink is, and line up the rest",
    tag: "the most accurate — and the one this measurement cannot grade",
    what: "Every mark whose ink was found convincingly goes exactly where it was found. The rest — and every word rectangle — get the per-line correction instead.",
  },
];

// The tradeoffs, as a board rather than a table. Section 7 already grades every
// option on accuracy, and accuracy is the one axis on which F and G are the same
// number — so a page that stopped there would show a reader two identical rows
// and no reason to prefer either. What separates them is entirely cost: what has
// to be rebuilt, and what has to be kept in step forever afterwards. Those are
// prose facts, so they are stored as prose here and drawn beside the measured
// bar, which is the only figure on the board that comes out of the data.
// `tone` is semantic and deliberately not the page's accent: three muted hues
// that survive both themes, so severity reads before any of the words do.
const TRADEOFFS = {
  A: {
    verdict: "what the app does today",
    build: {
      tone: "good",
      head: "Nothing",
      body: "No new numbers to work out, nothing to write down, nothing to rebuild.",
    },
    disturbs: {
      tone: "good",
      head: "Nothing",
      body: "Every rectangle in the app stays exactly where it is.",
    },
    risk: {
      tone: "bad",
      head: "The complaint stands",
      body: "Almost every rectangle sits about a mark's height from the mark it is meant to name. Colouring one exact letter cannot be built on rectangles this far out — it would put the colour on the letter next door.",
    },
    undo: { tone: "good", head: "Nothing to undo", body: "" },
  },
  B: {
    verdict: "better, and measurably not enough",
    build: {
      tone: "good",
      head: "Two numbers a page",
      body: "About PAGES2 numbers for the whole book, in a table the app already has a place for.",
    },
    disturbs: {
      tone: "warn",
      head: "Every word rectangle",
      body: "Moving a page moves the words on it too, so every word rectangle the app ships is rebuilt and re-checked, and the pictures the tests compare against may move.",
    },
    risk: {
      tone: "warn",
      head: "About one rectangle in six is still badly out",
      body: "And that is the ceiling, not a first attempt: the best correction of this shape that could be fitted to a page from its own ink does not do better. Adding a stretch to it buys under two percent and makes a third of pages worse.",
    },
    undo: { tone: "warn", head: "Reversible, not free", body: "Dropping the table means rebuilding everything it moved." },
  },
  F: {
    verdict: "the recommendation",
    build: {
      tone: "warn",
      head: "Four numbers a printed line",
      body: "About LINES4 numbers for the whole book, in a table that does not exist yet — both the part that builds the rectangles and the part that reads them have to learn it.",
    },
    disturbs: {
      tone: "warn",
      head: "Every word rectangle",
      body: "Same as the option above: the words move with the marks, so all of them are rebuilt and re-checked and the comparison pictures may move.",
    },
    risk: {
      tone: "warn",
      head: "What is left over has changed character",
      body: "Not just shrunk. After this correction a small minority of rectangles are badly out for some reason of their own, rather than every rectangle being slightly out — and nobody has yet looked for what that reason is.",
    },
    undo: { tone: "warn", head: "Reversible, not free", body: "Dropping the table means rebuilding everything it moved." },
  },
  G: {
    verdict: "the fork worth noticing",
    build: {
      tone: "warn",
      head: "The same table",
      body: "Exactly the same numbers as the option above. The only difference is what they are applied to.",
    },
    disturbs: {
      tone: "good",
      head: "Only the marks",
      body: "No word rectangle moves, so nothing the app already ships for words is rebuilt, re-checked, or re-photographed.",
    },
    risk: {
      tone: "bad",
      head: "Two geometries from one measurement, forever",
      body: "The marks would sit on a lining-up we measured, and the words on one we have measured as wrong — and something has to hold the two to each other from then on. The saving is real and it is one-off; the obligation is permanent.",
    },
    undo: { tone: "good", head: "Easiest to undo", body: "Nothing shipped has moved, so dropping it rebuilds nothing." },
  },
  H: {
    verdict: "the most accurate, and the least provable",
    build: {
      tone: "bad",
      head: "Two numbers for every mark",
      body: "MARKS2 numbers for the whole book — not a rule that explains anything, but one measurement of one printing, written down in full. It cannot live in the small table the app reads today and needs a file of its own beside it.",
    },
    disturbs: {
      tone: "warn",
      head: "Every word rectangle, still",
      body: "The marks go where their own ink is, but words and verse-end circles have no such measurement, so they take the per-line correction — which means they move, are rebuilt, and are re-checked exactly as in the two options above.",
    },
    risk: {
      tone: "bad",
      head: "It cannot be graded, and it says nothing about an unmeasured page",
      body: "Every other option can be marked on marks it never saw. This one has nothing held back, so the only honest check is a person looking at rectangles and saying whether they sit right. And because it records rather than explains, it predicts nothing at all about a printing nobody has measured.",
    },
    undo: { tone: "warn", head: "Reversible, not free", body: "Dropping the table means rebuilding everything it moved — the same cost as the two options above." },
  },
};

function render({ artifact: ARTIFACT, out }) {
  if (!existsSync(DATA)) {
    console.error(`missing ${basename(DATA)} — run with --extract first (needs the maintainer cache)`);
    process.exit(1);
  }
  const d = JSON.parse(readFileSync(DATA, "utf8"));
  const pal = palette();
  const print = `../../apps/web/public/assets/pages/hafs-kfqc/${d.page}.svg`;
  const [, , pw, ph] = d.viewBox.split(/\s+/).map(Number);

  const printDefs = ARTIFACT
    ? `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="print" viewBox="${esc(d.viewBox)}">${
        readFileSync(join(ROOT, `apps/web/public/assets/pages/hafs-kfqc/${d.page}.svg`), "utf8")
          .replace(/^[\s\S]*?<svg[^>]*>/, "")
          .replace(/<\/svg>\s*$/, "")
      }</symbol></svg>`
    : "";

  /** A rectangle, moved by whatever the option would move it by. */
  const moved = (o, grain) => {
    const [x, y, w, h] = o.b;
    if (grain === "shipped") return [x, y, w, h];
    const [dx, dy] = o.o[grain] ?? [0, 0];
    return [x + dx, y + dy, w, h];
  };
  const rect = ([x, y, w, h], attrs) =>
    `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" ${attrs}/>`;

  const markAttrs = `fill="${pal.mark}" fill-opacity="0.22" stroke="${pal.mark}" stroke-width="0.22" rx="0.3"`;
  const wordAttrs = `fill="none" stroke="${pal.word}" stroke-width="0.22"`;

  /**
   * A rectangle nowhere near the crop is a rectangle nobody will see, and every
   * specimen would otherwise carry all 692 of them. Clipping to the crop is what
   * keeps this page a hundred kilobytes rather than a megabyte.
   */
  const inCrop = (crop) => {
    if (!crop) return () => true;
    const [vx, vy, vw, vh] = crop.split(/\s+/).map(Number);
    return ([x, y, w, h]) => x + w > vx - 2 && x < vx + vw + 2 && y + h > vy - 2 && y < vy + vh + 2;
  };

  /** The layer one option would draw. */
  const layer = (opt, crop = null) => {
    const keep = inCrop(crop);
    const out = [];
    for (const w of d.words) {
      const b = moved(w, opt.wordsStay ? "shipped" : opt.grain);
      if (keep(b)) out.push(rect(b, wordAttrs));
    }
    for (const m of d.marks) {
      const b = moved(m, opt.grain);
      if (keep(b)) out.push(rect(b, markAttrs));
    }
    return out.join("");
  };

  /** Where the ink actually is: the rectangle moved onto its own ink. */
  const layerInk = (crop = null) => {
    const keep = inCrop(crop);
    return d.marks
      .map((m) => [m.b[0] + m.ink[0], m.b[1] + m.ink[1], m.b[2], m.b[3]])
      .filter(keep)
      .map((b) =>
        rect(b, `fill="none" stroke="${pal.ink}" stroke-width="0.22" stroke-dasharray="0.8 0.6" rx="0.3"`),
      )
      .join("");
  };

  /** The verse-end circles, and where an option would move them to. */
  const layerOrnaments = (grain) =>
    d.ornaments
      .map((o) => {
        const [dx, dy] = grain === "shipped" ? [0, 0] : (o.o[grain] ?? [0, 0]);
        const a = `<circle cx="${o.ours[0]}" cy="${o.ours[1]}" r="2.6" fill="none" stroke="${pal.word}" stroke-width="0.3"/>`;
        const b = `<circle cx="${(o.fit[0] + dx).toFixed(2)}" cy="${(o.fit[1] + dy).toFixed(2)}" r="1.1" fill="${pal.ink}" fill-opacity="0.85"/>`;
        return a + b;
      })
      .join("");

  const specimen = (inner, { crop = null, label = "", cls = "" } = {}) => {
    const [vx, vy, vw, vh] = (crop ?? d.viewBox).split(/\s+/).map(Number);
    const pc = (n) => `${(n * 100).toFixed(4)}%`;
    const print2 = ARTIFACT ? `<use href="#print" x="0" y="0" width="${pw}" height="${ph}"/>` : "";
    return `<figure class="spec ${cls}" style="--ar:${((vh / vw) * 100).toFixed(4)}%">
  <div class="win">
    ${ARTIFACT ? "" : `<img class="print" src="${esc(print)}" alt=""
         style="width:${pc(pw / vw)};height:${pc(ph / vh)};left:${pc(-vx / vw)};top:${pc(-vy / vh)}">`}
    <svg class="ov" viewBox="${esc(crop ?? d.viewBox)}" aria-hidden="true">${print2}${inner}</svg>
  </div>
  ${label ? `<figcaption>${label}</figcaption>` : ""}
</figure>`;
  };

  // ── the crops, chosen from the drawn page's own geometry ──────────────────
  //
  // A whole page shows what the reader is being asked about; a band shows three
  // printed lines at about the size a phone draws them; a close crop is the
  // only size at which the difference between the last two options is visible
  // at all, and saying that plainly is more honest than picking a crop that
  // flatters the recommendation.
  const lines = [...new Set(d.marks.map((m) => m.l))].sort((a, b) => a - b);
  const midLine = lines[Math.floor(lines.length / 2)];
  const onMid = d.marks.filter((m) => m.l === midLine);
  // The band is the true extent of three printed lines — measured off their own
  // boxes rather than guessed as a multiple of the line spacing, which left a
  // sliver of a fourth line clipped along the top edge.
  const band = [midLine - 1, midLine, midLine + 1];
  const all = [...d.marks, ...d.words];
  const inBand = all.filter((m) => band.includes(m.l));
  const onLine = (l) => all.filter((m) => m.l === l);
  // The window is cut through the white space between printed lines, not tight
  // to the band's own ink: a word box is as tall as its line, so a crop that
  // stops at the band's edge lets the next line's boxes lean into the picture.
  const gapAbove = onLine(midLine - 2), gapBelow = onLine(midLine + 2);
  const bandTop = Math.min(...inBand.map((m) => m.b[1]));
  const bandBot = Math.max(...inBand.map((m) => m.b[1] + m.b[3]));
  const top = gapAbove.length
    ? (bandTop + Math.max(...gapAbove.map((m) => m.b[1] + m.b[3]))) / 2
    : bandTop - 2;
  const bot = gapBelow.length
    ? (bandBot + Math.min(...gapBelow.map((m) => m.b[1]))) / 2
    : bandBot + 2;
  const BAND = `8 ${top.toFixed(1)} ${(pw - 16).toFixed(1)} ${(bot - top).toFixed(1)}`;
  // The close crop sits at the mark on the middle line the tilt has moved
  // furthest, so it shows the biggest honest difference between the last two
  // options rather than an average one — and the caption says which. It has to
  // be a mark with a page around it: the furthest-moved mark on this page sits
  // hard against the outer margin, and a window half of which is off the paper
  // shows a fragment nobody can read.
  const CW = 34, CH = 17;
  const roomy = onMid.filter(
    (m) => m.b[0] > CW / 2 + 4 && m.b[0] < pw - CW / 2 - 4,
  );
  const far = [...(roomy.length ? roomy : onMid)].sort(
    (a, b) => Math.hypot(...b.o.tilt) - Math.hypot(...a.o.tilt),
  )[0] ?? onMid[0];
  const CLOSE = `${(far.b[0] - CW / 2).toFixed(1)} ${(far.b[1] - CH / 2).toFixed(1)} ${CW} ${CH}`;
  // How much bigger the close crop is than the band beside it, stated rather
  // than asserted — the two are drawn to the same width on the page.
  const closeMag = Math.round((pw - 16) / CW);

  const share = (g) => d.drawnPage[g];
  const ho = (g) => d.heldOut[g] ?? null;
  const c = d.corpus;
  // How big a mark actually is, so the distances in section 7 are in something a
  // reader can picture. Taken from the page being drawn rather than written down,
  // because the page being drawn is the one the reader is looking at.
  const medOf = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
  const MARK_W = medOf(d.marks.map((m) => m.b[2])).toFixed(1);
  const MARK_H = medOf(d.marks.map((m) => m.b[3])).toFixed(1);

  const optionCard = (opt) => {
    const h = ho(opt.grain);
    const perMark = opt.grain === "mark";
    const num = h
      ? `${h.far.toFixed(2)}%`
      : `${(c.pooled[opt.grain].far * 100).toFixed(1)}%`;
    const ci = !perMark && h?.ci?.length === 2 ? ` <span class="dim">[${h.ci[0].toFixed(2)}, ${h.ci[1].toFixed(2)}]</span>` : "";
    // H's two numbers do not mean what the other four options' numbers mean, and
    // the caption is where that is said rather than in a footnote nobody reaches.
    // Its "badly out" counts only the marks it declined to place from ink; the
    // ones it did place sit on the measurement itself and cannot be scored by it.
    const note = perMark
      ? `counting only the ${(100 - h.share).toFixed(1)}% it would not place from ink — the rest sit on the measurement and cannot be graded by it`
      : "measured on marks the correction was not worked out from";
    const near = perMark
      ? `<div><h4>Placed from the mark's own ink</h4><p><b class="big">${h.share.toFixed(1)}%</b><br><span class="dim small">${h.fellBack.toLocaleString("en")} marks fall back to the printed line: ${h.clamped.toLocaleString("en")} where the search ran out of room and ${h.weak.toLocaleString("en")} where it found nothing convincing</span></p></div>`
      : `<div><h4>On this page</h4><p><b class="big">${pctS(share(opt.grain))}</b><br><span class="dim small">of ${d.marks.length} marks further than ${d.far} of a unit from their own ink</span></p></div>`;
    return `<article class="opt" id="option-${opt.id}">
  <header class="opt-h">
    <h3>${opt.id} — ${esc(opt.title)}</h3>
    <p class="tag">${esc(opt.tag)}</p>
  </header>
  ${specimen(layer(opt, BAND), { crop: BAND })}
  ${specimen(layer(opt, CLOSE) + layerInk(CLOSE), { crop: CLOSE, label: `The same option, close up — about ${closeMag} times the size above, on the mark this correction moves furthest. The dashed outlines are where the marks really are, so the gap you can see is the error this option leaves behind.` })}
  <div class="cost">
    <div><h4>What it does</h4><p>${esc(opt.what)}</p></div>
    <div><h4>Rectangles badly out</h4><p><b class="big">${num}</b>${ci}<br><span class="dim small">${note}</span></p></div>
    ${near}
  </div>
</article>`;
  };

  // The board. One column an option, one row a question a decider actually has.
  // The only measured thing on it is the bar, and it is drawn to the same scale
  // in every column so the collapse from A to F is a length rather than a digit.
  // Laid out row-major in one grid rather than as four independent columns: the
  // whole value of a board is that "what it disturbs" sits on one line across all
  // four, and a per-column flex stack only lines up by luck. The label column is
  // sticky because the board is wider than a phone and scrolls; a row whose label
  // has scrolled off is a row of adjectives attached to nothing.
  const fill = (s) =>
    s
      .replace("PAGES2", (c.pages * 2).toLocaleString("en"))
      .replace("LINES4", (c.lines * 4).toLocaleString("en"))
      .replace("MARKS2", (c.marks * 2).toLocaleString("en"));

  const boardCell = (t) =>
    `<div class="tc tone-${t.tone}"><b>${esc(t.head)}</b>${
      t.body ? `<span>${esc(fill(t.body))}</span>` : ""
    }</div>`;

  const barCell = (opt) => {
    const h = ho(opt.grain);
    const pct = h ? h.far : c.pooled[opt.grain].far * 100;
    // H's bar is not the same measurement as the other four and the caption has
    // to say so where the bar is, not in a note underneath it. Its figure counts
    // only the marks it declines to place from ink; the ones it does place are
    // sitting on the very thing that would grade them.
    const cap =
      opt.grain === "mark"
        ? "of rectangles land badly out — counting only the ones it will not place from ink"
        : "of rectangles land badly out";
    return `<div class="tc bar-cell">
    <b>${pct.toFixed(1)}<span class="pc">%</span></b>
    <div class="bar"><i style="width:${Math.max(pct, 0.8).toFixed(2)}%"></i></div>
    <span>${cap}</span>
  </div>`;
  };

  const boardRow = (label, pick) =>
    `<div class="tc lbl">${esc(label)}</div>` +
    OPTIONS.map((o) => boardCell(TRADEOFFS[o.id][pick])).join("");

  const board = `<div class="board" role="group" aria-label="What each option costs">
  <div class="bh lbl"></div>
  ${OPTIONS.map(
    (o) => `<div class="bh">
    <h3>${o.id}</h3>
    <p class="bt">${esc(o.title)}</p>
    <p class="bv">${esc(TRADEOFFS[o.id].verdict)}</p>
  </div>`,
  ).join("")}
  <div class="tc lbl">How wrong it leaves things</div>
  ${OPTIONS.map(barCell).join("")}
  ${boardRow("What it costs to work out", "build")}
  ${boardRow("What it disturbs", "disturbs")}
  ${boardRow("What it risks", "risk")}
  ${boardRow("Getting back", "undo")}
</div>`;

  const ladderRow = (g, label) => {
    const h = ho(g);
    return `<tr>
  <td>${esc(label)}</td>
  <td class="n">${h ? `${h.far.toFixed(2)}%` : "—"}</td>
  <td class="n">${h?.ci?.length === 2 ? `${h.ci[0].toFixed(2)} – ${h.ci[1].toFixed(2)}` : "—"}</td>
  <td class="n">${h ? h.p50.toFixed(2) : "—"}</td>
  <td class="n">${h ? h.p95.toFixed(2) : "—"}</td>
  <td class="n">${h ? `${h.trained.toFixed(2)}%` : "—"}</td>
</tr>`;
  };

  // H's row in the same table, which is a different row and has to look like one.
  // Four of its six columns are honestly empty: splitting a page's marks in half
  // grades a correction the other half never saw, and H has no other half — each
  // mark carries its own two numbers, so there is nothing held back to grade with.
  // What can be stated is the part that *is* a model: the marks it hands to the
  // printed line, and how those fare.
  const markRow = () => {
    const h = ho("mark");
    if (!h) return "";
    return `<tr class="aside">
  <td>H — each mark, where its own ink is<span class="dim small"><br>on the ${(100 - h.share).toFixed(1)}% it hands back to the printed line</span></td>
  <td class="n">${h.far.toFixed(2)}%</td>
  <td class="n">—</td>
  <td class="n">${h.fallback.p50.toFixed(2)}</td>
  <td class="n">${h.fallback.p95.toFixed(2)}</td>
  <td class="n">—</td>
</tr>`;
  };

  const html = `<title>Where the rectangles go</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${STYLE}</style>
${printDefs}
<div class="head">
  <p class="eyebrow">A decision, drawn — Hifth</p>
  <h1>Should the app line up what it draws one page at a time, or one printed line at a time?</h1>
  <p class="standfirst">
    Hifth draws a rectangle over every mark and every word in the mus'haf, so it knows what your
    finger is touching. Today those rectangles sit about a mark's height away from the marks they
    are meant to be on. There are five things we could do about it, and this page draws all five on
    the same real page of the mus'haf, at the size you would actually see them.
  </p>
  <div class="stats">
    <div><b>${(c.pooled.shipped.far * 100).toFixed(0)}%</b><span>of rectangles are badly out today</span></div>
    <div><b>${ho("tilt") ? `${ho("tilt").far.toFixed(1)}%` : pctS(c.pooled.tilt.far)}</b><span>after the recommended fix</span></div>
    <div><b>${c.marks.toLocaleString("en")}</b><span>marks measured, on ${c.pages} pages</span></div>
    <div><b>${c.unmeasuredCount ?? d.unmeasured.length}</b><span>pages nothing could measure</span></div>
  </div>
</div>

<main>

<section>
  <h2><span class="num">1</span>A few words, before anything else</h2>
  <dl class="prior">
    <dt>Mark</dt>
    <dd>One of the small signs printed above or below a letter — the vowel signs, the doubling sign,
      the little circle over a silent letter. There are about ${Math.round(c.marks / c.pages / 10) * 10}
      of them on a page.</dd>
    <dt>Printed line</dt>
    <dd>One line of text as the printer set it. A page of this mus'haf holds fifteen, and the
      printer stretches each one on its own so both ends reach the margins.</dd>
    <dt>Verse-end circle</dt>
    <dd>The small ornament that closes each verse. There are ${d.pin.markers} of them on the page
      drawn here, and they matter more than they look — see section 3.</dd>
    <dt>Badly out</dt>
    <dd>A rectangle sitting further than ${d.far} of a unit from the ink it is meant to be on, on a
      page ${pw} units across, where a mark is about five units wide. Roughly: far enough that you
      would point at it and say it is on the wrong thing.</dd>
  </dl>
</section>

<section>
  <h2><span class="num">2</span>What does it look like today?</h2>
  <p class="lede">
    This is a real page of the mus'haf with the app's own rectangles drawn on it. The filled boxes
    are marks; the outlines are words.
  </p>
  ${specimen(layer(OPTIONS[0], BAND), { crop: BAND, label: `Three printed lines of page ${d.page}, at about the size a phone draws them. Every filled box is where the app currently believes a mark is.` })}
  ${specimen(layer(OPTIONS[0], CLOSE) + layerInk(CLOSE), { crop: CLOSE, label: `Close up. The dashed outlines are where each mark actually is; the filled boxes are where the app puts them. That gap is the whole subject of this page.` })}
  <p>
    <strong>So why not simply draw the dashed outlines?</strong> It is the first thing anybody asks
    here, and it is a good enough question that it became option H below. The honest answer has two
    halves. The outlines are not a placement, they are the measurement: each one is where a search
    around that one mark found the most ink, which makes them the answer sheet every other option is
    marked against — ship them and the score is perfect by construction, and a perfect score that
    could not have come out any other way tells you nothing. And they are a record rather than a
    rule: two numbers written down for each of ${c.marks.toLocaleString("en")} marks, which say what
    this printing did and predict nothing whatever about a page nobody has measured.
  </p>
  <p>
    Neither of those makes it wrong to ship — they make it something a different kind of check has
    to vouch for. Option H does ship them, with a guard, and section 12 says what would have to be
    true before anybody could trust it.
  </p>
  <p>
    Across the whole mus'haf, ${(c.pooled.shipped.far * 100).toFixed(0)} rectangles in every hundred
    are badly out by the definition above. It is not a handful of bad pages: it is nearly every
    rectangle on nearly every page, all sliding the same way.
  </p>
</section>

<section>
  <h2><span class="num">3</span>Why are they out at all?</h2>
  <p class="lede">
    Because of how the app learned where things are on the page — and the answer is a little
    embarrassing, which is exactly why it is worth reading.
  </p>
  <p>
    Hifth ships pictures of the mus'haf from one source and the positions of the marks from another.
    The two draw the same print at different sizes, so something has to line them up. The only
    objects both sources name are the verse-end circles, so those are what the lining-up was
    measured on — and it works beautifully. On the page drawn here the circles land within
    ${d.pin.residual} of a unit of each other, which is a fraction of the width of one of them.
  </p>
  ${specimen(layerOrnaments("shipped"), { crop: BAND, label: `The verse-end circles. The large outlines are where our picture of the page has them; the small dots are where the other source says they are, after the lining-up. They agree.` })}
  <p>
    <strong>And then the text is out by a mark's height anyway.</strong> The two prints agree about
    where their ornaments sit and disagree about where they set their words. So a lining-up measured
    on the ornaments grades itself as excellent and is wrong where it is used.
  </p>
</section>

<section>
  <h2><span class="num">4</span>Why is this being asked now, and what if nobody answers?</h2>
  <p>
    A by-eye session was opened to judge whether a proposed correction was better than what ships,
    and it was stopped after a handful of trials because the person sitting it reported the
    rectangles were wrong in several ways at once. That is not a verdict about the correction; it is
    a report that both things being compared were frequently wrong. The measurement then confirmed
    it. So the question has to be settled before any more of anyone's time is spent looking at
    rectangles.
  </p>
  <p>
    If nobody decides, option A is what happens, and it is not neutral: colouring a mark, tapping a
    mark, or telling a reader which mark a rule lands on all rest on the rectangle being on the
    right thing. Those are the next things this app was going to build, and they are all waiting on
    this.
  </p>
</section>

<section>
  <h2><span class="num">5</span>Does anyone outside this project have this problem?</h2>
  <p class="lede">
    Yes, and one half of it is a published result with a name. The other half we looked for and did
    not find.
  </p>
  <dl class="prior">
    <dt>Lining up on one thing and using it for another is a known trap</dt>
    <dd>
      In medical imaging the error where you measured is called fiducial registration error and the
      error where you actually care is target registration error, and
      <a href="https://spie.org/Publications/Proceedings/Paper/10.1117/12.813601">Fitzpatrick showed
      the two are uncorrelated</a> — how well the lining-up closed tells you nothing about how wrong
      it is at the target. Our own numbers reproduce it: the closeness at the circles predicts
      almost nothing about the error at the text, and on the component that matters most it is
      slightly <em>anti</em>-correlated, which
      <a href="https://www.sciencedirect.com/science/article/abs/pii/S1361841511000028">theory also
      predicts</a>. There is even
      <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC7612039/">a teaching tool built to break the
      intuition</a>, because practitioners keep falling for it. So did we, for three sittings.
    </dd>
    <dt>The remedy is the one below: hold out something the lining-up never saw</dt>
    <dd>
      <a href="http://insightsoftwareconsortium.github.io/SimpleITK-Notebooks/Python_html/68_Registration_Errors.html">SimpleITK's
      worked notebook</a> is the standard version. Section 8 is ours, inverted: the circles stop
      being what we measure on and become what we check against.
    </dd>
    <dt>Why the printed line, and not something else</dt>
    <dd>
      Two settings of the same text drift apart because their letter widths and line spacing differ,
      so the error builds up <em>along</em> a line and resets at the next one. That is documented in
      typesetting —
      <a href="http://martin.hoppenheit.info/blog/2018/pdfa-validation-and-inconsistent-glyph-width-information/">inconsistent
      glyph widths</a>,
      <a href="https://www.syncfusion.com/blogs/post/pdf-font-issues-javascript-pdf-viewer">substituted
      metrics moving line breaks</a>,
      <a href="https://silnrsi.github.io/FDBP/en-US/Line_Metrics.html">line metrics</a>, and most
      sharply in
      <a href="https://arxiv.org/pdf/2206.02285">work showing letter positions leak redacted words</a>.
      This was written down <em>before</em> our own numbers were looked at, and then it held.
    </dd>
    <dt>Global first, then local, is the conventional shape</dt>
    <dd>
      <a href="https://www.cise.ufl.edu/~anand/pdf/rangarajan_cviu_si_final.pdf">Thin-plate splines</a>
      pair a global part with a local warp;
      <a href="https://dl.acm.org/doi/10.1007/978-3-031-70546-5_20">a 2024 document-registration
      paper</a> learns a coarse transform then a fine one; and there is
      <a href="https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10503868">a patent on
      line-based registration for moving annotations between images</a>, which is almost exactly
      what we are doing.
    </dd>
    <dt>What we looked for and did not find — said plainly</dt>
    <dd>
      Nobody appears to have published on our actual case: lining up two independently typeset
      editions of the <em>same</em> text at the level of individual letters, where both sides are
      drawn shapes with no photographs and no text recognition involved. The document work we found
      is all about photographs of paper, where the distortion is physical. Nor did we find anyone
      writing up the inversion in section 9 as a recipe. Two areas were not opened at all:
      Arabic-typesetting corpora, and the Qur'anic-computing literature. Either could hold
      something.
    </dd>
  </dl>
</section>

<section>
  <h2><span class="num">6</span>The options, drawn</h2>
  <p class="lede">
    All five on the same page, the same crops, the same size. For the first four, the percentages
    under each are measured on marks that option's correction was not worked out from, which is the
    only way a finer correction cannot flatter itself. The last one, H, cannot be measured that way
    at all, and its card says what it reports instead.
  </p>
  ${OPTIONS.map(optionCard).join("\n")}
</section>

<section>
  <h2><span class="num">7</span>The same options, as numbers</h2>
  <table class="grid">
    <caption>
      Every mark on all ${c.pages} pages, ${c.marks.toLocaleString("en")} of them, split down the
      middle: half of each page's marks used to work the correction out, the other half — which the
      correction never saw — used to grade it. The first column is that grade. The last column is the
      same correction marked on its own homework, and the gap between the two is what a correction
      fitting noise rather than a real difference between the two prints would show up as. The two
      middle distances are in the same units as the pictures above, where the typical mark on this
      page is ${MARK_W} units across and ${MARK_H} tall — so a miss past ${d.far} of a unit,
      which is what &ldquo;badly out&rdquo; counts, is a rectangle sitting off its own mark.
    </caption>
    <thead><tr>
      <th>Option</th><th class="n">Badly out</th><th class="n">95% range</th>
      <th class="n">Typical miss</th><th class="n">Worst 5%</th><th class="n">Marked on its own homework</th>
    </tr></thead>
    <tbody>
      ${ladderRow("shipped", "A — as it ships")}
      ${ladderRow("page", "B — each page")}
      ${ladderRow("line", "E — each printed line, no tilt")}
      ${ladderRow("tilt", "F and G — each line, tilted")}
      ${markRow()}
    </tbody>
  </table>
  <div class="note">
    <p>
      <strong>Why H's row is mostly empty, and why that is the honest way to print it.</strong>
      Every other row is graded by holding half of each page's marks back and marking the
      correction on marks it never saw. H has nothing to hold back: each mark carries its own two
      numbers, so there is no second half of anything. What the row does state is the part of H
      that is a model — the ${d.heldOut.mark.fellBack.toLocaleString("en")} marks it refuses to
      place from ink and hands to the printed line instead, which is
      ${(100 - d.heldOut.mark.share).toFixed(1)}% of the mus'haf and where all of its remaining
      error lives. The other ${d.heldOut.mark.share.toFixed(1)}% sit exactly on the ink they were
      measured against, so their score is zero by construction and means nothing at all. That is
      the trade this option asks you to accept: far fewer rectangles out of place, and no way for
      this instrument to prove it. Section 12 says what could.
    </p>
    <p>
      <strong>The control that makes this a finding rather than a bigger model.</strong> Give every
      printed line <em>another</em> line's correction, chosen at random, and grade it on the same
      unseen half: ${d.heldOut.shuffle.toFixed(1)}% of rectangles are badly out — worse than
      applying no per-line correction at all, and
      ${(d.heldOut.shuffle / ho("tilt").far).toFixed(0)} times worse than the real one. So the
      per-line figures are not what any correction with that many knobs would have given. The last
      column says the same thing from the other side: the finest correction does flatter itself, by
      ${(ho("tilt").far - ho("tilt").trained).toFixed(1)} points, and that is the whole of the
      flattery — against a fall from ${ho("page").far.toFixed(1)}% to
      ${ho("tilt").far.toFixed(1)}% that it cannot account for.
    </p>
  </div>
</section>

<section>
  <h2><span class="num">8</span>What does each one cost?</h2>
  <p class="lede">
    Accuracy is one column of this and it is the column where two of the options are the same
    number. Everything that separates them is here instead: what has to be worked out, what it
    disturbs on the way in, and what has to be kept true forever afterwards.
  </p>
  ${board}
  <div class="note">
    <p>
      <strong>Read F and G side by side, because that is the fork this page cannot settle by
      measuring.</strong> Their first rows are identical, and not by coincidence — they are the same
      correction, so no measurement on this page can tell them apart. Every figure here is taken on
      marks, and G is the option that leaves the words alone, so the whole of its cost falls
      somewhere nothing above is looking. It buys one rebuild it does not have to do, and pays for it
      by keeping two different linings-up true to each other for as long as the app exists.
    </p>
  </div>
</section>

<section>
  <h2><span class="num">9</span>What does moving everything do to the verse-end circles?</h2>
  <p class="lede">
    This is the check that costs us something, so it is the one worth trusting. The circles are the
    one thing on the page that is <em>not</em> ink under a rectangle — the correction is worked out
    without them, so where they end up is a free, independent opinion.
  </p>
  <p>
    The opinion is unwelcome and it is the same at every option: correcting the text pulls the
    circles off themselves, on every page measured. That is not a bug in the correction. It is the
    two prints disagreeing about their text and agreeing about their ornaments, stated from the
    other side — you cannot have both, and this is the cost of choosing the text.
  </p>
  <div class="two">
    ${specimen(layerOrnaments("shipped"), { crop: BAND, label: "A — the circles land on themselves." })}
    ${specimen(layerOrnaments("tilt"), { crop: BAND, label: "C — the same circles, after the recommended correction. They no longer do." })}
  </div>
  <p>
    Whether that matters depends entirely on what the circles are used for, and today they are used
    for one thing: working out the lining-up in the first place. Nothing the reader touches is
    placed by them. So the honest statement is that this option trades an error nobody sees for an
    error everybody sees — in the right direction — and that trade should be made knowingly rather
    than discovered later.
  </p>
</section>

<section>
  <h2><span class="num">10</span>What about the pages nothing could measure?</h2>
  <p>
    ${d.unmeasured.length} pages of the mus'haf — ${d.unmeasured.join(", ")} — carry too little to
    measure a correction from. They are the opening and closing pages, which are set differently
    from every other page in the book.
  </p>
  <p>
    <strong>This is the whole of the generalisation question, and it is worth being blunt about
    it.</strong> Every option here is worked out on the very page it is applied to. There is no
    version of this that generalises to a page it has not seen, because there is no model of a page
    — there is a table. That is not a flaw to be fixed; a table over ${c.pages} pages and
    ${c.lines.toLocaleString("en")} printed lines is exactly the right shape when each page really
    does differ. But it means those ${d.unmeasured.length} pages get whatever fallback we choose,
    and the fallback is the entire answer for them. The proposal is that they keep option A
    unchanged, and that the app never claims a precision there it has not earned.
  </p>
</section>

<section>
  <h2><span class="num">11</span>What else could have been on this page?</h2>
  <dl class="prior">
    <dt>Letting every rectangle find its own nearest ink, with nothing holding it back</dt>
    <dd>
      This page was written twice on this point, and the first version was wrong, so the reasoning
      is left here rather than quietly replaced. The objection was that two marks sit about as far
      apart as the error is large, so a search for the nearest ink would sometimes find the
      <em>neighbour's</em> and centre a rectangle neatly on the wrong mark — which is one of the
      complaints that started all of this. It was worth measuring rather than asserting, and it did
      not survive. The nearest mark of any kind is a median ${d.neighbour.anyP50} units away and the
      nearest one that <em>looks the same</em> is ${d.neighbour.sameP50}, against a search that
      reaches ${d.neighbour.radius} and an error near one. Across all
      ${c.marks.toLocaleString("en")} marks the search ends up nearer some other mark
      ${d.neighbour.jumpAny.toFixed(2)}% of the time and nearer an identical-looking one
      ${d.neighbour.jumpSame.toFixed(2)}% — ${d.neighbour.jumpSameN} marks in the whole mus'haf.
      <strong>What the measuring did refuse is different.</strong> Where the ink match is poor the
      search is chasing noise rather than finding a mark, and a search that stops at the edge of the
      distance it was allowed has not found anything at all — it has run out of room. Option H is
      this idea with those two refusals built in, and the marks it refuses inherit the printed line.
    </dd>
    <dt>Drawing the marks but never letting anything point at one</dt>
    <dd>
      Kept in the written record as option D and not drawn here, because there is nothing to draw:
      it puts the same rectangles on the page and forbids the feature that would use them. It is
      the honest halfway house if none of the four below is good enough, and it is a decision about
      the app rather than about placement.
    </dd>
    <dt>Stretching each page rather than sliding it</dt>
    <dd>
      Option C in the written record. Measured and dropped. The stretch is real — it is certain, statistically — and it is worth
      about a fifth of the sliding, removes under two per cent of what is left, and makes a third of
      pages slightly worse. It is a footnote, not an option.
    </dd>
    <dt>Correcting word by word</dt>
    <dd>
      Not usable. A word carries about four marks, and an average over four marks is mostly noise;
      the correction would fit the noise and look excellent while being worse. The printed line is
      the finest grain with enough marks in it to mean anything.
    </dd>
    <dt>Fixing the mark names instead</dt>
    <dd>
      Already ruled out by counting. Every one of the ${c.marks.toLocaleString("en")} marks was
      checked against the name the printer gave it, and the number of genuinely wrong names is zero.
      Every complaint about a rectangle being on the wrong thing is this page's problem, not a
      naming problem, and the two are kept separate on purpose.
    </dd>
  </dl>
</section>

<section>
  <h2><span class="num">12</span>What would change the answer?</h2>
  <ul class="wch">
    <li>
      <strong>A person preferring the old rectangle.</strong> Everything here is measured against
      ink. One forced-choice sitting on pages the correction was never worked out from is the only
      witness that is not, and it is owed before anything ships. If a reader cannot see the
      difference, option B is the cheaper answer and this page over-argues.
    </li>
    <li>
      <strong>Someone finding a use for the verse-end circles.</strong> If the circles ever place
      something a reader touches, section 9 stops being a free trade and becomes a real cost.
    </li>
    <li>
      <strong>The remainder turning out to have a cause of its own.</strong> After the best
      correction here, the rectangles that are still badly out are more concentrated than the
      general spread predicts — a minority are badly out for a reason, rather than everything being
      slightly out. Nobody has looked for that reason yet, and finding it could make a sixth option.
    </li>
    <li>
      <strong>Somebody checking option H by eye and finding it holds.</strong> H cannot be graded
      the way the others are, and that is not a reason to refuse it — it is a statement about which
      instrument is needed. The check it wants is not the same as the one above: rather than being
      shown two rectangles and asked which sits better, a reader is shown a sample of rectangles H
      has placed and asked, of each one, whether it is on the mark it is named after. If a sample
      drawn at random comes back clean, the <em>procedure</em> that placed all
      ${c.marks.toLocaleString("en")} of them has been vouched for, which is the only kind of
      guarantee a record rather than a rule can be given. That sitting has not happened. Until it
      does, H is the most accurate option on this page and the one with the least behind it.
    </li>
  </ul>
</section>

<section>
  <h2><span class="num">13</span>What is this not settling?</h2>
  <p>
    Not whether the app should colour individual marks at all — that is
    <a href="mark-granularity.html">its own question</a>, and it is open. Not which colours anything
    is drawn in. Not the mark names, which were counted and are right. And not the four pages in
    section 10, which need their own answer whichever option wins.
  </p>
</section>

</main>

<footer>
  <p>
    <strong>Where the pictures come from.</strong> Nothing here is a mock-up. The page is the real
    mus'haf image the app ships. Every rectangle is computed by the same code that would build the
    shipped geometry, from the printer's own measured ink, and the colours are read out of the app's
    stylesheet when this page is built. All the counts are recomputed from the measurements each
    time.
  </p>
  <p class="dim small">
    Built by <code>scripts/build-placement-options.mjs</code> — edit that, not this. The technical
    write-up behind it, including everything that is still unresolved, is
    <code>docs/design/mark-registration.md</code>. Page ${d.page} was chosen because its numbers sit
    at the middle of all ${c.pages} measured pages on every option, not at either end. The print is
    <code>assets/pages/hafs-kfqc/${d.page}.svg</code>: outlined shapes only, no text. Measured
    ${d.ran}.
  </p>
</footer>
`;

  writeFileSync(out, html);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
  console.log(`${basename(out)} — ${kb} KB, page ${d.page}, ${d.marks.length} marks, ${d.words.length} words`);
  return () => {
    for (const g of GRAINS) {
      const h = ho(g);
      console.log(`  ${g.padEnd(8)} this page ${pctS(share(g)).padStart(6)}   corpus ${pctS(c.pooled[g].far).padStart(6)}${h ? `   held out ${h.far.toFixed(2)}%` : ""}`);
    }
  };
}

const STYLE = `
:root{
  --paper:#f4efe6; --ink:#26201a; --accent:#1f6f66;
  --tint:#ede6da; --rule:#ddd2c2; --dim:#6f6559; --card:#fbf8f2;
  --shadow:0 1px 0 rgba(38,32,26,.05);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){ --paper:#191612; --ink:#ece4d8; --accent:#5fbfae; --tint:#221d18;
    --rule:#3a322a; --dim:#9a8d7d; --card:#201b16; --shadow:none; }
}
:root[data-theme="dark"]{ --paper:#191612; --ink:#ece4d8; --accent:#5fbfae; --tint:#221d18;
  --rule:#3a322a; --dim:#9a8d7d; --card:#201b16; --shadow:none; }
:root[data-theme="light"]{ --paper:#f4efe6; --ink:#26201a; --accent:#1f6f66; --tint:#ede6da;
  --rule:#ddd2c2; --dim:#6f6559; --card:#fbf8f2; --shadow:0 1px 0 rgba(38,32,26,.05); }

body{ background:var(--paper); color:var(--ink); margin:0;
  font:16px/1.65 "Iowan Old Style","Charter","Palatino Linotype",Palatino,Georgia,serif;
  -webkit-text-size-adjust:100%; }
main,.head,footer{ max-width:60rem; margin:0 auto; padding:0 1.5rem; }
h1,h2,h3,h4,.eyebrow,.tag,.n,code,table,.stats b,figcaption,.big{
  font-family:ui-sans-serif,"Helvetica Neue",Arial,system-ui,sans-serif; }
h1{ font-size:clamp(1.9rem,4.6vw,3rem); line-height:1.1; letter-spacing:-.02em;
  margin:.2em 0 .5rem; text-wrap:balance; font-weight:650; }
h2{ font-size:1.35rem; letter-spacing:-.01em; margin:0 0 .9rem; display:flex; gap:.7rem;
  align-items:baseline; font-weight:650; text-wrap:balance; }
h3{ font-size:1.08rem; margin:0; font-weight:650; }
h4{ font-size:.72rem; margin:0 0 .35rem; text-transform:uppercase; letter-spacing:.09em;
  color:var(--dim); font-weight:650; }
p{ margin:0 0 1rem; max-width:64ch; }
code{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.86em;
  background:var(--tint); padding:.1em .35em; border-radius:3px; }
strong{ font-weight:650; }
.dim{ color:var(--dim); } .small{ font-size:.85rem; }
a{ color:var(--accent); text-underline-offset:2px; }
a:focus-visible{ outline:2px solid var(--accent); outline-offset:2px; border-radius:2px; }

.head{ padding-top:3.5rem; padding-bottom:1rem; }
.eyebrow{ font-size:.72rem; letter-spacing:.16em; text-transform:uppercase; color:var(--accent);
  margin:0; font-weight:650; }
.standfirst{ font-size:1.1rem; max-width:58ch; }
.stats{ display:flex; flex-wrap:wrap; gap:1px; background:var(--rule); border:1px solid var(--rule);
  border-radius:6px; overflow:hidden; margin:1.75rem 0 0; }
.stats div{ flex:1 1 11rem; background:var(--card); padding:.9rem 1rem; }
.stats b{ display:block; font-size:1.7rem; font-variant-numeric:tabular-nums; letter-spacing:-.02em;
  line-height:1.1; }
.stats span{ display:block; font-size:.8rem; color:var(--dim); margin-top:.15rem; }

section{ padding:3rem 0 0; border-top:1px solid var(--rule); margin-top:3rem; }
section:first-child{ border-top:0; }
.num{ font-size:.72rem; color:var(--paper); background:var(--accent); width:1.5rem; height:1.5rem;
  border-radius:50%; display:inline-grid; place-items:center; flex:0 0 auto; font-weight:650;
  font-variant-numeric:tabular-nums; }
.lede{ font-size:1.06rem; }

.spec{ margin:1.5rem 0; }
.win{ position:relative; width:100%; padding-top:var(--ar); overflow:hidden; background:#fdfaf4;
  border:1px solid var(--rule); border-radius:5px; }
@media (prefers-color-scheme: dark){ .win{ background:#f4efe6; } }
.print{ position:absolute; display:block; max-width:none; }
.ov{ position:absolute; inset:0; width:100%; height:100%; }
figcaption{ font-size:.8rem; color:var(--dim); margin-top:.5rem; max-width:64ch; }
.two{ display:grid; grid-template-columns:repeat(auto-fit,minmax(15rem,1fr)); gap:1.25rem; }
.two .spec{ margin:0; }

.opt{ border:1px solid var(--rule); border-radius:7px; overflow:hidden; margin:1.5rem 0 0;
  background:var(--card); box-shadow:var(--shadow); }
.opt-h{ padding:1rem 1.15rem; display:flex; flex-wrap:wrap; gap:.2rem 1rem; align-items:baseline;
  border-bottom:1px solid var(--rule); }
.tag{ margin:0; font-size:.78rem; color:var(--dim); letter-spacing:.02em; }
.opt .spec{ margin:0; }
.opt .win{ border:0; border-radius:0; border-bottom:1px solid var(--rule); }
.opt figcaption{ padding:.5rem 1.15rem 0; margin:0; }
.cost{ display:grid; grid-template-columns:repeat(auto-fit,minmax(13rem,1fr)); border-top:1px solid var(--rule); }
.cost>div{ padding:1rem 1.15rem; border-right:1px solid var(--rule); }
.cost>div:last-child{ border-right:0; }
.cost p{ margin:0; font-size:.9rem; }
.big{ font-size:1.5rem; font-variant-numeric:tabular-nums; letter-spacing:-.02em; font-weight:650; }

table.grid{ width:100%; border-collapse:collapse; margin:1.25rem 0 1.5rem; font-size:.88rem;
  display:block; overflow-x:auto; }
table.grid caption{ text-align:left; font-size:.82rem; color:var(--dim); padding-bottom:.55rem;
  font-family:ui-sans-serif,system-ui,sans-serif; max-width:64ch; }
.grid th{ text-align:left; font-size:.7rem; text-transform:uppercase; letter-spacing:.07em;
  color:var(--dim); font-weight:650; padding:0 .7rem .45rem 0; border-bottom:1px solid var(--rule);
  white-space:nowrap; }
.grid td{ padding:.45rem .7rem .45rem 0; border-bottom:1px solid var(--rule); vertical-align:middle; }
.grid .n{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
/* H's row is a different kind of statement from the four above it, and four of
   its six cells are honestly empty. Setting it off keeps a reader from scanning
   down the column and reading those dashes as a worse score. */
.grid tr.aside td{ border-top:2px solid var(--rule); background:var(--tint); }
.grid tr.aside td:first-child{ padding-left:.7rem; }

/* The tradeoff board. Severity is its own hue set, kept away from --accent so a
   column reads as good-or-costly before any of its words are read. */
:root{ --t-good:#2f6b45; --t-warn:#8a5a12; --t-bad:#a03c28; }
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){ --t-good:#6fbf8e; --t-warn:#d9a441; --t-bad:#e08a72; }
}
:root[data-theme="dark"]{ --t-good:#6fbf8e; --t-warn:#d9a441; --t-bad:#e08a72; }
:root[data-theme="light"]{ --t-good:#2f6b45; --t-warn:#8a5a12; --t-bad:#a03c28; }

/* Sized so all five columns fit inside the reading column on a desktop and the
   board only scrolls where it must. It is the one element on the page where a
   reader compares across, and a board that scrolls when it did not need to hides
   a column from somebody who never thought to drag it. */
.board{ display:grid; grid-template-columns:7rem repeat(5,minmax(10.4rem,1fr));
  gap:1px; background:var(--rule); border:1px solid var(--rule); border-radius:7px;
  overflow-x:auto; margin:1.5rem 0 0; box-shadow:var(--shadow);
  align-items:stretch; }
.bh{ background:var(--tint); padding:.85rem 1rem; }
.lbl{ position:sticky; left:0; z-index:1; background:var(--tint); font-size:.7rem;
  text-transform:uppercase; letter-spacing:.07em; color:var(--dim); font-weight:650;
  font-family:ui-sans-serif,"Helvetica Neue",Arial,system-ui,sans-serif;
  border-left:0; box-shadow:1px 0 0 var(--rule); justify-content:center; }
.bh h3{ font-size:1.45rem; letter-spacing:-.02em; line-height:1; color:var(--accent); }
.bt{ margin:.3rem 0 0; font-size:.86rem; line-height:1.35; }
.bv{ margin:.35rem 0 0; font-size:.72rem; text-transform:uppercase; letter-spacing:.08em;
  color:var(--dim); font-family:ui-sans-serif,system-ui,sans-serif; font-weight:650; }
.tc{ background:var(--card); padding:.8rem 1rem; display:flex; flex-direction:column; gap:.25rem;
  border-left:3px solid transparent; }
.tc b{ font-family:ui-sans-serif,"Helvetica Neue",Arial,system-ui,sans-serif; font-size:.84rem;
  font-weight:650; line-height:1.3; }
.tc span{ font-size:.83rem; line-height:1.45; color:var(--dim); }
.tone-good{ border-left-color:var(--t-good); } .tone-good b{ color:var(--t-good); }
.tone-warn{ border-left-color:var(--t-warn); } .tone-warn b{ color:var(--t-warn); }
.tone-bad{ border-left-color:var(--t-bad); } .tone-bad b{ color:var(--t-bad); }
.bar-cell b{ font-size:1.8rem; font-variant-numeric:tabular-nums; letter-spacing:-.03em;
  line-height:1; color:var(--ink); }
.bar-cell .pc{ font-size:.9rem; color:var(--dim); margin-left:.1em; letter-spacing:0; }
.bar{ height:7px; border-radius:4px; background:var(--tint); overflow:hidden;
  box-shadow:inset 0 0 0 1px var(--rule); }
.bar i{ display:block; height:100%; background:var(--t-bad); border-radius:4px; }

.note{ border-left:3px solid var(--accent); background:var(--tint); padding:1rem 1.15rem;
  border-radius:0 5px 5px 0; margin:1.5rem 0 0; }
.note p:last-child{ margin:0; }

.prior{ margin:1.25rem 0 0; max-width:64ch; }
.prior dt{ font-family:ui-sans-serif,"Helvetica Neue",Arial,system-ui,sans-serif; font-size:.92rem;
  font-weight:650; margin-top:1.1rem; }
.prior dt:first-child{ margin-top:0; }
.prior dd{ margin:.35rem 0 0; padding-left:1rem; border-left:2px solid var(--rule);
  font-size:.94rem; color:var(--ink); }

.wch{ margin:1.25rem 0 0; padding-left:1.15rem; max-width:64ch; }
.wch li{ margin-bottom:.7rem; }

footer{ margin-top:3rem; padding-top:1.5rem; padding-bottom:4rem; border-top:1px solid var(--rule); }
footer p{ font-size:.85rem; color:var(--dim); }
footer strong{ color:var(--ink); }
@media (max-width:34rem){ .cost>div{ border-right:0; border-bottom:1px solid var(--rule); } }
`;

// ──────────────────────────────────────────────────────────────── main ──────

if (process.argv.includes("--extract")) await extract();

/**
 * Both copies, always, from one read of the measurements — and the figures
 * printed once at the end rather than once per copy, because the same numbers
 * twice reads like two runs disagreeing about nothing.
 */
let figures;
for (const copy of COPIES) figures = render(copy);
figures();
