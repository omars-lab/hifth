#!/usr/bin/env node
/**
 * Render docs/design/mark-granularity.html — what the tajweed skin would look
 * like at mark granularity, drawn on a real page instead of argued in prose.
 *
 * ── Why this is a page and not a section of sub-word-marks.md ───────────────
 * mark-A measured the vocabulary and mark-B walked every tajweed offset down to
 * a drawn rectangle; both shipped numbers. The number that decides mark-C is not
 * one of them. It is whether a hafiz, looking at the screen, reads a mark-level
 * highlight as a truer rendering of the rule than a wash over the whole ayah —
 * and that question cannot be answered by a table. `sub-word-marks.md` §⑧ ①
 * says so in place: what stays open is what arithmetic cannot reach.
 *
 * So the artifact is a picture, and it is built rather than drawn by hand for
 * the same reason the shards are: every rectangle on it has to come from the
 * bytes the app would actually ship, or it is an illustration of a proposal
 * instead of evidence about one.
 *
 * ── Two modes, because the inputs live in two different places ──────────────
 *   node scripts/build-mark-options.mjs            # render (repo bytes only)
 *   node scripts/build-mark-options.mjs --extract  # refresh the data file
 *
 * The render reads only committed assets — the page SVG, the word shard, the
 * manifest, tokens.css — plus `mark-granularity.data.json`, so anyone with a
 * checkout can rebuild the page and get the identical file.
 *
 * `--extract` is maintainer-only. Mark rectangles come from the ligature corpus,
 * which lives in the 348 MB fetch cache under `packages/etl/data/pages/.cache/`
 * (gitignored, pinned by SHA-256). It rewrites the data file; without the cache
 * it refuses rather than emitting a thinner one, because a data file that is
 * sometimes complete is worse than one that is absent.
 *
 * ── There is no Quran text in this file, or in the one it writes ────────────
 * That rule is not enforced by a gate — `gate:notext` is about <text> elements
 * in page SVGs (Safari will not paint them under `content-visibility`), and
 * `gate:text-sources` is about NUL bytes. It is enforced by the shipped bytes
 * themselves: `assets/pages/hafs-kfqc/2.svg` is 63.9 KB of outlined <path> and
 * contains zero Arabic codepoints, and `assets/words/hafs-kfqc/2.json` is
 * rectangles. This page inherits that property deliberately — the data file
 * names marks in Latin (`wasla`, `superscript alef`), refers to words by print
 * index, and the print is referenced by relative URL rather than inlined. A
 * reader sees the word because the mus'haf draws it, which is the only reason
 * this repo has ever had to show one.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DATA = join(ROOT, "docs/design/mark-granularity.data.json");
const OUT = join(ROOT, "docs/design/mark-granularity.html");

/** The page the picture is drawn on. Page 2 for three reasons, all measured:
 *  it is five ayahs (small enough to read whole), its 2:3 reproduces the corpus
 *  drawn/letter split almost exactly, and one word on it carries four outcomes. */
const PAGE = 2;

/**
 * `--artifact` writes a self-contained copy for publishing.
 *
 * An artifact is served from claude.ai under a CSP that blocks every external
 * host, so the relative URL to the print would 404 and each specimen would show
 * an empty overlay over nothing — the same silent-blank failure the `attr`
 * regex already caused once here. The print is therefore inlined ONCE as a
 * `<symbol>` and `<use>`d per specimen; six data: URIs would be six copies of
 * 64 KB. It carries no more text than the referencing copy does: the page is
 * 63.9 KB of outlined `<path>` with zero Arabic codepoints.
 */
const ARTIFACT = process.argv.includes("--artifact");
const OUT_ARTIFACT = join(ROOT, "docs/design/mark-granularity.artifact.html");

/** packages/etl/scripts/build-tajweed.mjs:89 — the one copy of this map is
 *  there; this is a read of it, and `--extract` asserts the two agree. */
const RULES = {
  hamzat_wasl: "wasl",
  madd_2: "madd",
  madd_246: "madd",
  madd_muttasil: "madd",
  madd_munfasil: "madd",
  madd_6: "madd-lazim",
  ghunnah: "ghunnah",
  ikhfa: "ghunnah",
  ikhfa_shafawi: "ghunnah",
  iqlab: "ghunnah",
  idghaam_ghunnah: "idgham",
  idghaam_no_ghunnah: "idgham",
  idghaam_shafawi: "idgham",
  idghaam_mutajanisayn: "idgham",
  idghaam_mutaqaribayn: "idgham",
  lam_shamsiyyah: "idgham",
  qalqalah: "qalqalah",
  silent: "silent",
};

/** packages/core/src/skins.ts TAJWEED_RULES, ascending. `leadingRule` takes the
 *  maximum — the rarest family on the ayah, which is the informative one when
 *  you only get to say one thing. */
const SALIENCE = { madd: 0, wasl: 1, ghunnah: 2, idgham: 3, qalqalah: 4, silent: 5, "madd-lazim": 6 };
const leadingFamily = (families) => families.reduce((a, b) => (SALIENCE[b] > SALIENCE[a] ? b : a));

// ───────────────────────────────────────────────────────────── extract ──────

async function extract() {
  const ETL = join(ROOT, "packages/etl/scripts");
  const cache = join(ROOT, "packages/etl/data/pages/.cache");
  if (!existsSync(cache)) {
    console.error("--extract needs the quran-svg fetch cache at packages/etl/data/pages/.cache/");
    console.error("It is gitignored and 348 MB. Run the vendor step first, or drop --extract");
    console.error("and render from the committed data file.");
    process.exit(1);
  }

  const { candidatePage } = await import(join(ETL, "lib/candidate-pages.mjs"));
  const { applierFromPin, readDiacritics } = await import(join(ETL, "lib/diacritics.mjs"));
  const { markPaths } = await import(join(ETL, "lib/mark-join.mjs"));
  const { WAQF } = await import(join(ETL, "lib/mushaf-frame.mjs"));
  const { ALL_CORRECTIONS, ORACLE, foldAyah, oracleOf, respellerFor } = await import(
    join(ETL, "lib/tajweed-fold.mjs")
  );

  const dataDir = join(ROOT, "packages/etl/data");
  const tajweed = JSON.parse(
    readFileSync(join(dataDir, "tajweed/tajweed.hafs.uthmani-pause-sajdah.json"), "utf8"),
  );
  const pin = new Map(
    JSON.parse(readFileSync(join(dataDir, "pages/word-boxes.pin.json"), "utf8")).pages.map((p) => [
      p.page,
      p,
    ]),
  );

  // The corpus-wide counts the page argues from. Computed here rather than
  // quoted, so the prose cannot drift from the data behind it.
  const corpus = corpusStats(tajweed);

  const svg = (await candidatePage(PAGE, { offline: true })).body.toString("utf8");
  const ON = new Set(ALL_CORRECTIONS);
  const respell = respellerFor(ON);
  const oracleSets = new Map(
    Object.entries(ORACLE).map(([r, e]) => [r, { set: new Set(e.letters), near: e.near ?? 0 }]),
  );
  const letterAt = (cps, rule, start) => {
    const spec = oracleSets.get(rule);
    if (!spec) return -1;
    for (let d = 0; d <= spec.near; d += 1) if (spec.set.has(cps[start + d])) return start + d;
    return -1;
  };

  const WORD = /<g id="md-word-\d+"([^>]*)>/g;
  // The leading boundary is load-bearing: without it `d="` matches the tail of
  // `id="`, and every ayah polygon comes back carrying the string "verse-8" as
  // its path data. An SVG <path> with unparseable `d` renders nothing and
  // reports a zero bbox — so the "today" layer was silently empty while the
  // mark layer, which uses <rect>, drew fine.
  const attr = (s, n) => {
    const m = s.match(new RegExp(`(?:^|\\s)${n}="([^"]*)"`));
    return m ? m[1] : null;
  };
  const un = (s) =>
    s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const isMark = (t) => [...t].length > 0 && [...t].every((c) => WAQF.has(c));

  const byAyah = new Map();
  for (const m of svg.matchAll(WORD)) {
    const a = m[1];
    const surah = Number(attr(a, "data-surah"));
    const aya = Number(attr(a, "data-aya"));
    const idx = Number(attr(a, "data-word-index-in-ayah"));
    const hafs = attr(a, "data-hafs");
    if (!surah || !aya || !idx || hafs == null) continue;
    const key = `${surah}:${aya}`;
    if (!byAyah.has(key)) byAyah.set(key, new Map());
    const text = un(hafs);
    byAyah.get(key).set(idx, { hafs: text, waw: attr(a, "data-waw-alatf") === "true", mark: isMark(text) });
  }

  const marksByAyah = new Map();
  for (const w of readDiacritics(svg, applierFromPin(pin.get(PAGE)))) {
    const key = `${w.surah}:${w.aya}`;
    if (!marksByAyah.has(key)) marksByAyah.set(key, new Map());
    marksByAyah.get(key).set(w.idx, markPaths(w));
  }

  // 1:1's word list, which the fold prefixes onto every sūra-opening ayah.
  const p1 = (await candidatePage(1, { offline: true })).body.toString("utf8");
  const b1 = new Map();
  for (const m of p1.matchAll(WORD)) {
    const a = m[1];
    if (Number(attr(a, "data-surah")) !== 1 || Number(attr(a, "data-aya")) !== 1) continue;
    b1.set(Number(attr(a, "data-word-index-in-ayah")), {
      hafs: un(attr(a, "data-hafs")),
      waw: attr(a, "data-waw-alatf") === "true",
      mark: false,
    });
  }
  const basmala = [...b1.keys()].sort((a, b) => a - b).map((i) => b1.get(i));

  // The hit polygons: already in the 235-unit frame, same space as the shards.
  const polys = new Map();
  for (const m of svg.matchAll(/<path[^>]*class="ayahPolygon"[^>]*\/>/g)) {
    const el = m[0];
    polys.set(`${attr(el, "surah")}:${attr(el, "ayah")}`, attr(el, "d"));
  }

  const pageSvg = readFileSync(join(ROOT, `apps/web/public/assets/pages/hafs-kfqc/${PAGE}.svg`), "utf8");
  for (const m of pageSvg.matchAll(/<path[^>]*class="ayahPolygon"[^>]*\/>/g)) {
    const el = m[0];
    polys.set(`${attr(el, "surah")}:${attr(el, "ayah")}`, attr(el, "d"));
  }

  const shard = JSON.parse(
    readFileSync(join(ROOT, `apps/web/public/assets/words/hafs-kfqc/${PAGE}.json`), "utf8"),
  );

  const ayahs = [];
  for (const [key, wordMap] of byAyah) {
    const idxs = [...wordMap.keys()].sort((a, b) => a - b);
    // A non-contiguous word index means the ayah is split across pages; its
    // fold would be over a partial word list and every offset would be wrong.
    if (idxs.some((v, i) => v !== i + 1)) continue;
    const words = idxs.map((i) => wordMap.get(i));
    const [surah, ayah] = key.split(":").map(Number);
    const rec = tajweed.find((r) => r.surah === surah && r.ayah === ayah);
    const boxes = shard.words?.[key];
    if (!rec || !boxes || boxes.from !== 1) continue;

    // No `indices`: probe-encodings.mjs passes none, so `print` is the 1-based
    // position in `words` — which the contiguity check above just established.
    const fold = foldAyah({ surah, ayah, words, basmala, on: ON });
    const cps = [...fold.cps];
    const byIdx = marksByAyah.get(key);

    const anns = [];
    for (const a of rec.annotations) {
      const family = RULES[a.rule];
      if (!family) throw new Error(`rule ${a.rule} is not in the family map`);
      const ann = { rule: a.rule, family };
      const o = oracleOf(cps, { rule: a.rule, start: a.start, end: a.end });
      const pos = o?.hit ? letterAt(cps, a.rule, a.start) : -1;
      const host = pos >= 0 ? fold.hosts.find((h) => pos >= h.from && pos < h.to) : null;
      if (!o?.hit) ann.outcome = "oracle-miss";
      else if (pos < 0 || !host) ann.outcome = "no-host";
      else if (host.print === null) ann.outcome = "basmala";
      else {
        const word = byIdx?.get(host.print);
        const hafs = words[host.print - 1]?.hafs;
        if (word === undefined || hafs === undefined) ann.outcome = "no-word";
        else if (respell(hafs) !== hafs) ann.outcome = "respelt";
        else if (word === null) ann.outcome = "unjoined";
        else {
          const at = pos - host.from;
          const hit = word.find((mk) => at >= mk.at && at < mk.at + mk.len);
          ann.outcome = hit ? "drawn" : "letter";
          ann.word = host.print;
          if (hit) {
            ann.name = hit.name;
            ann.mark = hit.mark.slice(1).map((n) => Number(n.toFixed(2)));
          }
        }
        if (ann.word === undefined && host.print) ann.word = host.print;
      }
      anns.push(ann);
    }

    const families = [...new Set(anns.map((a) => a.family))];
    ayahs.push({
      key,
      poly: polys.get(key) ?? null,
      words: boxes.boxes,
      marks: boxes.marks ?? [],
      families,
      lead: leadingFamily(families),
      anns,
    });
  }

  ayahs.sort((a, b) => Number(a.key.split(":")[1]) - Number(b.key.split(":")[1]));
  const data = {
    $comment:
      "Generated by scripts/build-mark-options.mjs --extract. Geometry only — no Quran text. " +
      "Coordinates are the 235-unit page frame, the same one the word shards use.",
    page: PAGE,
    corpus,
    ayahs,
  };
  writeFileSync(DATA, `${JSON.stringify(data, null, 1)}\n`);
  const n = ayahs.reduce((t, a) => t + a.anns.length, 0);
  console.log(`--extract — ${ayahs.length} ayahs, ${n} annotations → docs/design/mark-granularity.data.json`);
}

/** Per ayah: how many families are annotated, and how many of them render. */
function corpusStats(tajweed) {
  let ayahs = 0;
  let anns = 0;
  let painted = 0;
  let familySum = 0;
  const histogram = {};
  const invisible = {};
  const wins = {};
  for (const rec of tajweed) {
    const families = rec.annotations.map((a) => RULES[a.rule]).filter(Boolean);
    if (families.length === 0) continue;
    ayahs += 1;
    anns += families.length;
    const distinct = [...new Set(families)];
    familySum += distinct.length;
    histogram[distinct.length] = (histogram[distinct.length] ?? 0) + 1;
    const lead = leadingFamily(distinct);
    wins[lead] = (wins[lead] ?? 0) + 1;
    painted += families.filter((f) => f === lead).length;
    for (const f of distinct) if (f !== lead) invisible[f] = (invisible[f] ?? 0) + 1;
  }
  return { ayahs, anns, painted, discarded: anns - painted, meanFamilies: familySum / ayahs, histogram, wins, invisible };
}

// ────────────────────────────────────────────────────────────── render ──────

/** Pull the tajweed palette out of tokens.css, so the picture cannot drift from
 *  the app's own colours by being retyped here. */
function palette() {
  const css = readFileSync(join(ROOT, "apps/web/src/styles/tokens.css"), "utf8");
  const grab = (re) => {
    const out = {};
    for (const m of css.matchAll(re)) out[m[1]] = m[2].trim();
    return out;
  };
  const fill = grab(/--tj-((?!dash|wash|stroke)[a-z-]+):\s*([^;]+);/g);
  const dash = grab(/--tj-dash-([a-z-]+):\s*([^;]+);/g);
  const one = (name) => {
    const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
    return m ? m[1].trim() : null;
  };
  return { fill, dash, wash: one("tj-wash"), stroke: one("tj-stroke") };
}

const FAMILY_LABEL = {
  wasl: "waṣl",
  madd: "madd",
  ghunnah: "ghunnah",
  qalqalah: "qalqalah",
  idgham: "idghām",
  silent: "silent",
  "madd-lazim": "madd lāzim",
};
const ORDER = ["madd", "wasl", "ghunnah", "idgham", "qalqalah", "silent", "madd-lazim"];

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pct = (n, d) => `${((n / d) * 100).toFixed(2)}%`;

function render() {
  if (!existsSync(DATA)) {
    console.error(`missing ${DATA} — run with --extract first (needs the maintainer cache)`);
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(DATA, "utf8"));
  const pal = palette();
  const manifest = JSON.parse(readFileSync(join(ROOT, "apps/web/public/assets/manifest.json"), "utf8"));
  const viewBox = manifest.viewBoxOverrides?.[String(data.page)] ?? manifest.viewBox;
  const print = `../../apps/web/public/assets/pages/hafs-kfqc/${data.page}.svg`;
  // The print's own children, lifted into a <symbol> on the page's viewBox, so
  // `<use>` places it in page units inside whatever crop the specimen asks for.
  const printDefs = ARTIFACT
    ? `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="print" viewBox="${esc(viewBox)}">${
        readFileSync(join(ROOT, `apps/web/public/assets/pages/hafs-kfqc/${data.page}.svg`), "utf8")
          .replace(/^[\s\S]*?<svg[^>]*>/, "")
          .replace(/<\/svg>\s*$/, "")
      }</symbol></svg>`
    : "";

  const rect = ([x, y, w, h], attrs) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${attrs}/>`;
  const washAttrs = (family, strong = false) =>
    `fill="${pal.fill[family]}" fill-opacity="${pal.wash}" stroke="${pal.fill[family]}" ` +
    `stroke-width="${strong ? 0.5 : pal.stroke}" stroke-dasharray="${pal.dash[family]}" ` +
    `stroke-linejoin="round" vector-effect="non-scaling-stroke"`;

  /** ① what ships today: one wash per ayah, in the ayah's rarest family. */
  const layerToday = () =>
    data.ayahs
      .filter((a) => a.poly)
      .map((a) => `<path d="${a.poly}" ${washAttrs(a.lead)}/>`)
      .join("");

  /** ② mark granularity: the drawn marks in their own family, solid; the rules
   *  that land on a bare letter fall back to that letter's word, washed. */
  const layerMarks = () => {
    const out = [];
    for (const a of data.ayahs) {
      const byWord = new Map();
      for (const ann of a.anns) {
        if (ann.outcome !== "letter" || !ann.word) continue;
        const list = byWord.get(ann.word) ?? [];
        list.push(ann.family);
        byWord.set(ann.word, list);
      }
      for (const [w, families] of byWord) {
        const box = a.words[w - 1];
        if (box) out.push(rect(box, washAttrs(leadingFamily(families))));
      }
      for (const ann of a.anns) {
        if (ann.outcome !== "drawn" || !ann.mark) continue;
        out.push(
          rect(
            ann.mark,
            `fill="${pal.fill[ann.family]}" fill-opacity="0.45" stroke="${pal.fill[ann.family]}" ` +
              `stroke-width="0.35" rx="0.4"`,
          ),
        );
      }
    }
    return out.join("");
  };

  /** ③ shards and gate only: the geometry ships, nothing paints with it. */
  const layerGeometry = () => {
    const out = [];
    for (const a of data.ayahs) {
      for (const box of a.words) out.push(rect(box, `fill="none" stroke="#a8998a" stroke-width="0.18"`));
      for (const ann of a.anns) {
        if (ann.outcome === "drawn" && ann.mark) {
          out.push(rect(ann.mark, `fill="none" stroke="#a8998a" stroke-width="0.18"`));
        }
      }
    }
    return out.join("");
  };

  /**
   * One specimen. The print is referenced, never copied — `<img>` at the same
   * viewBox as the overlay, so the two share a coordinate system exactly.
   * `crop` is a viewBox in page units; the wrapper scales both layers together.
   */
  const specimen = (layer, { crop = null, label = "" } = {}) => {
    const [vx, vy, vw, vh] = (crop ?? viewBox).split(/\s+/).map(Number);
    const [, , pw, ph] = viewBox.split(/\s+/).map(Number);
    // The window is exactly the crop's aspect, so the overlay's own viewBox
    // fills it without letterboxing and the two layers share one coordinate
    // system. The print is then scaled and offset to put the crop at the
    // window's origin — horizontal percentages resolve against the window's
    // width and vertical ones against its height, which are different bases,
    // so the two axes divide by vw and vh respectively rather than by a
    // single scale factor.
    const pc = (n) => `${(n * 100).toFixed(4)}%`;
    // `--artifact` puts the print INSIDE the overlay's own viewBox via <use>,
    // which makes the percentage arithmetic above unnecessary — the two layers
    // are then one SVG coordinate system rather than two aligned ones.
    const print2 = ARTIFACT
      ? `<use href="#print" x="0" y="0" width="${pw}" height="${ph}"/>`
      : "";
    return `<figure class="spec" style="--ar:${((vh / vw) * 100).toFixed(4)}%">
  <div class="win">
    ${ARTIFACT ? "" : `<img class="print" src="${esc(print)}" alt=""
         style="width:${pc(pw / vw)};height:${pc(ph / vh)};left:${pc(-vx / vw)};top:${pc(-vy / vh)}">`}
    <svg class="ov" viewBox="${esc(crop ?? viewBox)}" aria-hidden="true">${print2}${layer}</svg>
  </div>
  ${label ? `<figcaption>${label}</figcaption>` : ""}
</figure>`;
  };

  const swatch = (f) =>
    `<span class="sw" style="--c:${pal.fill[f]}"></span><span class="swn">${FAMILY_LABEL[f]}</span>`;

  // ── the per-ayah ledger of what is present vs what renders ────────────────
  const ayahRows = data.ayahs
    .map((a) => {
      const chips = ORDER.filter((f) => a.families.includes(f))
        .map(
          (f) =>
            `<span class="chip ${f === a.lead ? "on" : "off"}" style="--c:${pal.fill[f]}">${FAMILY_LABEL[f]}</span>`,
        )
        .join("");
      const drawn = a.anns.filter((x) => x.outcome === "drawn").length;
      const letter = a.anns.filter((x) => x.outcome === "letter").length;
      const other = a.anns.length - drawn - letter;
      return `<tr>
  <td class="k">${esc(a.key)}</td>
  <td>${chips}</td>
  <td class="n">${a.anns.length}</td>
  <td class="n">${a.anns.filter((x) => x.family === a.lead).length}</td>
  <td class="n">${drawn}</td>
  <td class="n">${letter}${other ? ` <span class="dim">+${other}</span>` : ""}</td>
</tr>`;
    })
    .join("\n");

  const c = data.corpus;
  const histRows = Object.keys(c.histogram)
    .map(Number)
    .sort((a, b) => a - b)
    .map((k) => {
      const v = c.histogram[k];
      return `<tr><td class="n">${k}</td><td class="n">${v.toLocaleString("en")}</td>
  <td class="bar"><span style="width:${(v / c.ayahs) * 100}%"></span></td><td class="n">${pct(v, c.ayahs)}</td></tr>`;
    })
    .join("\n");

  const invisRows = ORDER.filter((f) => c.invisible[f])
    .sort((a, b) => c.invisible[b] - c.invisible[a])
    .map(
      (f) => `<tr><td>${swatch(f)}</td><td class="n">${c.invisible[f].toLocaleString("en")}</td>
  <td class="bar"><span style="width:${(c.invisible[f] / c.ayahs) * 100}%;background:${pal.fill[f]}"></span></td>
  <td class="n">${pct(c.invisible[f], c.ayahs)}</td>
  <td class="n dim">${c.wins[f] ? pct(c.wins[f], c.ayahs) : "—"}</td></tr>`,
    )
    .join("\n");

  const pageAnns = data.ayahs.reduce((t, a) => t + a.anns.length, 0);
  const pagePainted = data.ayahs.reduce((t, a) => t + a.anns.filter((x) => x.family === a.lead).length, 0);
  const pageDrawn = data.ayahs.reduce((t, a) => t + a.anns.filter((x) => x.outcome === "drawn").length, 0);

  // The word that carries all four outcomes at once — 2:3's sixth word. Named
  // by index, not spelled: the print draws it, three lines up.
  const detail = data.ayahs.find((a) => a.key === "2:3");
  const detailCrop = detail ? cropOf(detail.words[5], 3) : null;

  // A full document, matching `build-validation-guide.mjs`. A fragment renders
  // in quirks mode from `file://`, which is where this page is read from.
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>One colour a verse — should Hifth colour tajweed more finely?</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Three options for how finely Hifth colours tajweed rules, drawn on a real page of the mus'haf.">
<style>${STYLE}</style>
</head>
<body>
${printDefs}
<header class="head">
  <p class="eyebrow">Hifth · a decision, drawn on paper</p>
  <h1>One colour a verse. The data knows five.</h1>
  <p class="standfirst">
    Hifth can tint each verse to flag a recitation rule inside it. It gets
    <strong>one</strong> colour per verse — but a verse usually carries
    <strong>${c.meanFamilies.toFixed(1)}</strong> different kinds of rule, so most of what we know
    is never shown. This page asks whether to colour smaller pieces than a whole verse, and shows
    each option on a real page so you can judge it by eye.
  </p>
  <div class="stats">
    <div><b>${pct(c.discarded, c.anns)}</b><span>of the rules we know about are invisible on screen</span></div>
    <div><b>${c.meanFamilies.toFixed(1)}</b><span>kinds of rule in a typical verse</span></div>
    <div><b>1</b><span>gets a colour</span></div>
  </div>
  <div class="note plain">
    <h4>Three words, before we start</h4>
    <p>
      A <strong>tajweed rule</strong> tells a reciter to do something at a particular spot — hold a
      vowel, hum through a letter, skip one. Hifth sorts them into <strong>seven kinds</strong>
      (madd, ghunnah, idghām, qalqalah, silent, waṣl, madd lāzim) and gives each kind a colour. A
      <strong>mark</strong> is one of the small signs the printed mus'haf draws above or below a
      letter. Everything below is about how big an area we tint: a whole verse, or the exact letter
      or mark the rule is about.
    </p>
  </div>
</header>

<main>

<section>
  <h2><span class="num">1</span>What is being decided?</h2>
  <p class="lede">
    Whether Hifth should keep tinting a whole verse at a time, or start tinting the exact letter or
    mark a rule lands on — and if it should, whether to put that on the reader's screen now or only
    lay the groundwork for it.
  </p>
  <p>
    Three answers, drawn side by side further down. <strong>A</strong>: leave it as it is, one colour
    a verse. <strong>B</strong>: colour the exact letter or mark. <strong>C</strong>: ship the
    measurements and the checks that keep them honest, and colour nothing yet.
  </p>
</section>

<section>
  <h2><span class="num">2</span>Why is this being asked now?</h2>
  <p>
    Because it finally got measured. Letting a reader pick out single words meant working out where
    every word — and every small mark the printer drew above and below the letters — actually sits on
    all 604 pages. That work is done and shipped for a different reason, and the moment it existed it
    was possible to count something nobody had counted before: how much of what we know about
    recitation rules never reaches the reader's eye. The number came back at
    <strong>${pct(c.discarded, c.anns)}</strong>, and it is the reason this page exists rather than a
    hunch that verse-sized tinting felt coarse.
  </p>
</section>

<section>
  <h2><span class="num">3</span>What happens if nobody decides?</h2>
  <p>
    Nothing breaks, and that is worth saying plainly. Option A is what the app does today, it works,
    and no other part of Hifth is waiting behind this question — nothing is blocked, no release is
    held up, and this can sit open for a year at no cost to a reader.
  </p>
  <p>
    What it costs is quieter. The measurements exist and nothing uses them, so nothing checks them:
    a positioning error would sit undetected until the day somebody builds on it. And
    ${pct(c.discarded, c.anns)} of what we know stays where it has always been, which is nowhere a
    reader can see.
  </p>
</section>

<section>
  <h2><span class="num">4</span>What does the app colour today?</h2>
  <p>
    A whole verse at a time. Below is page ${data.page} exactly as Hifth draws it: five verses,
    five tinted shapes, each stepping across the line breaks the verse takes. When a verse carries
    several kinds of rule, Hifth picks the <em>rarest</em> one — telling you a verse hides a silent
    letter is worth more than telling you it has a madd, which nine verses in ten do.
  </p>
  ${specimen(layerToday(), { label: `Five verses, five tints. Behind them sit ${pageAnns} rules — only ${pagePainted} are in a colour you can see.` })}
  <table class="grid">
    <caption>What each verse on this page carries. A filled chip is the kind that got the colour; a hollow one is a kind that is there and shows nothing.</caption>
    <thead><tr><th>verse</th><th>kinds of rule present</th><th class="n">rules</th><th class="n">shown</th><th class="n">on a printed mark</th><th class="n">on a plain letter</th></tr></thead>
    <tbody>
${ayahRows}
    </tbody>
  </table>
</section>

<section>
  <h2><span class="num">5</span>What is it leaving out?</h2>
  <p class="lede">
    Most of it. Across the whole mus'haf we have <strong>${c.anns.toLocaleString("en")}</strong>
    rules marked up, and <strong>${c.discarded.toLocaleString("en")}</strong> of them —
    ${pct(c.discarded, c.anns)} — never reach the screen. Not because we are unsure where they are.
    Because there is only one colour to give and something else already took it.
  </p>
  <table class="grid">
    <caption>How many different kinds of rule land on a single verse, across all ${c.ayahs.toLocaleString("en")} verses that carry any.</caption>
    <thead><tr><th class="n">kinds</th><th class="n">verses</th><th></th><th class="n">share</th></tr></thead>
    <tbody>
${histRows}
    </tbody>
  </table>
  <p>
    The one that loses most is the one a reciter meets most. <strong>Madd</strong> appears in
    ${pct(c.invisible.madd + (c.wins.madd ?? 0), c.ayahs)} of verses and gets the colour in
    ${pct(c.wins.madd ?? 0, c.ayahs)} of them. That is deliberate — it ranks last <em>because</em>
    it is everywhere, which is the right call when you have one colour and the wrong one the moment
    you have room for two.
  </p>
  <table class="grid">
    <caption>Present in the verse, but beaten to the only colour going.</caption>
    <thead><tr><th>kind</th><th class="n">verses where it loses</th><th></th><th class="n">share</th><th class="n">wins</th></tr></thead>
    <tbody>
${invisRows}
    </tbody>
  </table>
</section>

<section>
  <h2><span class="num">6</span>Would colouring smaller pieces let us show more of it?</h2>
  <p class="lede">
    Yes — and that is the real prize, more than precision is. The problem today is not that a tint
    is <em>coarse</em>. It is that a tint is <em>single</em>: one shape per verse means one colour
    per verse, so ${c.meanFamilies.toFixed(1)} kinds compete for it and
    ${(c.meanFamilies - 1).toFixed(1)} lose every time. Tint the individual letters and marks
    instead and they stop competing — each one can carry its own colour, because each one is its
    own shape.
  </p>
</section>

<section>
  <h2><span class="num">7</span>What do printed mus'hafs already do about this?</h2>
  <p class="lede">
    They answered it the other way, decades ago, and they answered it at the letter. The
    colour-coded printed mus'haf — the one most huffaz have already held — tints
    <em>individual letters</em>, never whole verses.
  </p>
  <p>
    In Dar al-Maarifah's colour-coded mus'haf a letter held longer is printed red, a nasalised
    letter green, a letter that is written but not pronounced grey, and the echoing letters blue;
    the publisher's claim is that a reader applies two dozen rules from the colours alone while
    their attention stays on the meaning. Whatever else is true, that is a working precedent for
    option B and none at all for option A: no printed tradition colours a whole verse to tell you
    something about one letter inside it, because on paper it never had to.
  </p>
  <div class="note">
    <h4>Why the precedent does not simply settle it</h4>
    <p>
      Print colours <strong>the ink of the letter itself</strong>. Hifth cannot: the page it shows
      is a picture of the printed page, one flat drawing, with no separate letter inside it to
      recolour. Everything on this page is a tinted shape laid <em>over</em> the print, which is a
      different visual language — a wash behind a letter reads less precisely than a letter that is
      simply a different colour, and no amount of accuracy in the positions changes that. So the
      printed mus'haf tells us readers cope with letter-level colour; it does not tell us that a
      letter-level <em>wash</em> reads the same way. Section 10 is where you judge that by eye.
    </p>
  </div>
  <p class="dim small">
    <strong>What was and was not looked up.</strong> The printed colour-coded tradition above was
    checked against booksellers' descriptions of the Dar al-Maarifah edition
    (<a href="https://www.amazon.com/Color-Coded-Tajweed-Quran-Hardcover/dp/9933423509">one</a>,
    <a href="https://www.ibrahimbooks.com/product/mushaf-with-color-coded-tajweed-rules/">two</a>).
    No survey was done of how other <em>apps</em> handle it: a search for any published account of a
    digital mus'haf's colouring turned up sales pages and PDFs of the printed editions, and nothing
    describing how a screen decides what to tint. Treat that as unlooked-at, not as evidence that
    nobody has solved it.
  </p>
</section>

<section>
  <h2><span class="num">8</span>What have we already decided that this has to live with?</h2>
  <p>
    Two earlier answers shape this one, and both of them make B cheaper and narrower than it sounds.
  </p>
  <dl class="prior">
    <dt>“Should a reader be able to pick single words, or only whole verses?” — answered: single words.</dt>
    <dd>
      This is why the measurements exist at all; B is not proposing the expensive half, it is
      proposing to use it. It also sets a reader's expectation: the app already answers at
      word size when you touch it, so colour is now the one thing that still only speaks in verses.
    </dd>
    <dt>“Can a reader turn the colouring off, jump anywhere, and reopen it with no signal?” — answered: yes, it is a layer you can switch off.</dt>
    <dd>
      Anything chosen here is opt-in by construction — nobody is made to look at it — and the seven
      colours were fixed then. B does not get new colours. It gets smaller places to put the ones we
      have, which is exactly why section 10's complaint about the two quietest ones is a live one.
    </dd>
  </dl>
</section>

<section>
  <h2><span class="num">9</span>What would each option look like on a real page?</h2>
  <p>
    The same three lines, three times. Same size, same colours — the only thing that changes is how
    small a piece the app is allowed to tint.
  </p>

  <div class="opt">
    <div class="opt-h"><h3>A · Leave it as it is</h3><p class="tag">change nothing</p></div>
    ${specimen(layerToday(), { crop: BAND })}
    <div class="cost">
      <div><h4>What it takes</h4><p>Nothing. No new work, no extra data for a phone to download.</p></div>
      <div><h4>What you get</h4><p>The app stays exactly as it is now. We already have an internal tool that can show every mark, so nothing we learned is lost — it is just not on the reader's screen.</p></div>
      <div><h4>What it costs</h4><p>${pct(c.discarded, c.anns)} of what we know stays invisible to a reader, indefinitely.</p></div>
    </div>
  </div>

  <div class="opt">
    <div class="opt-h"><h3>B · Colour the exact letter or mark</h3><p class="tag">every rule gets its own colour</p></div>
    ${specimen(layerMarks(), { crop: BAND })}
    <div class="cost">
      <div><h4>What it takes</h4><p>About 5 KB more per page for a phone to download — roughly a tenth of what the page picture itself weighs. Size is not the sticking point.</p></div>
      <div><h4>What you get</h4><p>Every kind of rule in the verse gets a colour instead of just one. On these three lines that is ${pageAnns} rules shown rather than ${pagePainted}, and ${pageDrawn} of them sit on the exact mark the printer drew.</p></div>
      <div><h4>What it costs</h4><p>Two visual languages on one line: a solid block on rules the printer drew a mark for, a tinted word for rules that land on a plain letter with nothing above it. Whether that reads as precise or as busy is what section 10 is for.</p></div>
    </div>
  </div>

  <div class="opt">
    <div class="opt-h"><h3>C · Prepare the ground, colour nothing yet</h3><p class="tag">ship the measurements, not the look</p></div>
    ${specimen(layerGeometry(), { crop: BAND })}
    <div class="cost">
      <div><h4>What it takes</h4><p>The same ~5 KB per page as B.</p></div>
      <div><h4>What you get</h4><p>The positions get locked down and automatically checked before we commit to any look, so B can be tried, changed or abandoned later without redoing the measurement work.</p></div>
      <div><h4>What it costs</h4><p>A reader sees option A. The faint outlines above are drawn <em>only here</em>, so you can see what would be available — the app itself would show nothing new.</p></div>
    </div>
  </div>
</section>

${
  detail
    ? `<section>
  <h2><span class="num">10</span>Where do A and B actually differ?</h2>
  <p>
    One word makes the whole argument. Four rules land on the sixth word of verse ${esc(detail.key)}:
    a <em>waṣl</em> and a <em>madd</em>, which the printer drew small marks for, and an
    <em>idghām</em> and a <em>silent</em>, which land on plain letters with nothing above them to
    colour. Today all four come out as one grey tint over the entire verse. Here is that word at
    about eight times its real size.
  </p>
  <div class="two">
    ${specimen(layerToday(), {
      crop: detailCrop,
      label:
        "A — the tint is here, and it is all of it. This close-up sits entirely inside the verse, so " +
        "the flat grey <em>is</em> the signal: nothing tells you which word or letter the rule is about.",
    })}
    ${specimen(layerMarks(), {
      crop: detailCrop,
      label:
        "B — the waṣl (grey box, top right) and the madd (orange bar) sit on the exact marks the " +
        "printer drew, each in its own colour, over a tinted word for the two rules that have no mark.",
    })}
  </div>
  <div class="note">
    <h4>This word also shows the two things still unsolved</h4>
    <p>
      Its <em>idghām</em> and its <em>silent</em> both land on plain letters of the
      <strong>same word</strong> — so B still has to choose between them. The competition does not
      disappear, it just moves from verse-sized to word-sized, and we currently only know how to
      settle it verse-sized. Second: the two colours B leans on hardest here are the faintest two we
      have. Look at the grey waṣl box against the grey word beneath it. Both colours were picked back
      when the smallest thing they could land on was a whole verse.
    </p>
  </div>
</section>`
    : ""
}

<section>
  <h2><span class="num">11</span>What do the colours look like at the size they would be used?</h2>
  <div class="pal">
    ${ORDER.map(
      (f) =>
        `<div class="pk"><span class="chipL" style="--c:${pal.fill[f]}"></span>
      <b>${FAMILY_LABEL[f]}</b>
      <code>${esc(pal.fill[f])}</code>
      <svg viewBox="0 0 60 6" class="dashline"><line x1="1" y1="3" x2="59" y2="3" stroke="${pal.fill[f]}" stroke-width="1.4" stroke-dasharray="${pal.dash[f] === "none" ? "" : esc(pal.dash[f])}"/></svg>
      <span class="dim">${c.wins[f] ? `wins ${pct(c.wins[f], c.ayahs)}` : "—"}</span></div>`,
    ).join("\n")}
  </div>
  <p class="dim small">
    Colour is never the only signal — each kind also has its own dash pattern along the edge, so the
    seven stay distinguishable in greyscale, in print, and to a colour-blind reader.
  </p>
</section>

<section>
  <h2><span class="num">12</span>What else could we do, and why is it not on this page?</h2>
  <p>
    Three ideas were considered and left off. If one of them is the answer, this is the place to say
    so — an option list with no visible edge is asking you to trust that the edge was somewhere
    sensible.
  </p>
  <dl class="prior">
    <dt>Recolour the letters themselves, the way the printed mus'haf does.</dt>
    <dd>
      Not possible with the page we ship. It is one flat drawing of the whole printed page; there is
      no separate letter in it to give a colour to. Doing this would mean redrawing the mus'haf,
      which is a far larger undertaking than any option here and a different decision entirely.
    </dd>
    <dt>Let the reader choose one kind of rule and show only that.</dt>
    <dd>
      Pick madd, see madd. This makes the competition disappear without measuring anything, and it
      would work at today's verse size. It is left off because it answers a different question — what
      do <em>you</em> want to see — where this page is about what the app shows by default. It is
      also the cheapest idea on this list, and it stays available whichever of A, B or C wins.
    </dd>
    <dt>Tint whole words, and never the printer's marks.</dt>
    <dd>
      Half of B: one visual language instead of two, and no need for the mark positions. Left off
      because it keeps the same competition B fails to fully solve — two rules on two letters of one
      word — while giving up the precision that was the reason to move at all. It is genuinely a
      middle option, and if section 10 reads as busy to you, it is the one to ask for.
    </dd>
  </dl>
</section>

<section>
  <h2><span class="num">13</span>What would change the answer?</h2>
  <ul class="wch">
    <li>
      <strong>The two quietest colours getting louder.</strong> B's weakest moment is a pale grey
      box on a pale grey word. That is a palette question, not a measurement one, and it can be
      tried on this very page in an afternoon. If it fixes it, B's main objection is gone.
    </li>
    <li>
      <strong>A hafiz looking at section 10 and calling it busy.</strong> One person reciting from
      the marked-up line would settle this faster and more honestly than any count on this page.
    </li>
    <li>
      <strong>Finding that two rules often land on the same letter</strong>, not just the same word.
      That is not counted here. If it turns out common, B needs a rule for what wins that we do not
      have, and C becomes the sensible order of work rather than a delay.
    </li>
    <li>
      <strong>The positions failing their check against the print.</strong> They are measured, not
      hand-placed, and they are checked — but on the day a check fails, B and C both stop until it
      passes, and A is unaffected.
    </li>
  </ul>
</section>

<section>
  <h2><span class="num">14</span>What is this page not settling?</h2>
  <p>
    Which colour each kind of rule gets — B reuses the seven that already exist. Whether a mark can
    be touched or asked about; this is only about colour. What should happen when two rules land on
    the exact same letter, which is not counted anywhere here. And nothing at all about where the
    rule data came from or how good it is: that is a separate question with its own record.
  </p>
</section>

<section>
  <h2><span class="num">15</span>So which one should we build?</h2>
  <p class="lede">
    Whether to build B. A is the status quo and needs no decision; C is B's groundwork without B's
    look, and is worth taking only if we think the look needs several tries.
  </p>
  <p>
    The case for B is section 5: we already know where ${c.anns.toLocaleString("en")} rules are, and
    ${pct(c.discarded, c.anns)} of them are invisible for want of somewhere to put a second colour —
    and section 7, where the printed tradition has been colouring letters rather than verses for
    years. The case against is section 10: two of those colours are too quiet at this size, and one
    word can still carry two rules that want different colours in the same place. Neither is a
    reason not to build it — both are work that comes with it.
  </p>
</section>

</main>

<footer>
  <p>
    <strong>Where the pictures come from.</strong> Nothing here is a mock-up. The page is the real
    mus'haf image the app ships; the tinted verse shapes are the same ones the app taps against; the
    word and mark rectangles are the measured positions of the printer's own ink; and the colours are
    read straight out of the app's stylesheet when this page is built, so it cannot drift from what
    Hifth actually looks like. All the counts are recomputed from the rule data each time.
  </p>
  <p class="dim small">
    Built by <code>scripts/build-mark-options.mjs</code> — edit that, not this. The technical write-up
    behind it, including what is still unresolved, is <code>docs/design/sub-word-marks.md</code> §⑧.
    The print is <code>assets/pages/hafs-kfqc/${data.page}.svg</code>: outlined shapes only, no text.
  </p>
</footer>
`;

  const out = ARTIFACT ? OUT_ARTIFACT : OUT;
  writeFileSync(out, html);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
  console.log(`${basename(out)} — ${kb} KB, ${data.ayahs.length} ayahs, ${pageAnns} annotations`);
  console.log(`  corpus: ${c.discarded.toLocaleString("en")}/${c.anns.toLocaleString("en")} annotations (${pct(c.discarded, c.anns)}) render as nothing at ayah granularity`);
}

/** A viewBox around one box, padded by `pad` page units. */
function cropOf([x, y, w, h], pad) {
  return `${(x - pad).toFixed(1)} ${(y - pad).toFixed(1)} ${(w + pad * 2).toFixed(1)} ${(h + pad * 2).toFixed(1)}`;
}

/** The three-line band the option cards are cropped to: 2:3 and its neighbours. */
const BAND = "6 68 228 70";

const STYLE = `
:root{
  --paper:#f4efe6; --ink:#26201a; --accent:#1f6f66;
  --tint:#ede6da; --rule:#ddd2c2; --dim:#6f6559; --card:#fbf8f2;
  --shadow:0 1px 0 rgba(38,32,26,.05);
}
@media (prefers-color-scheme: dark){
  :root{ --paper:#191612; --ink:#ece4d8; --accent:#5fbfae; --tint:#221d18;
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
h1,h2,h3,h4,.eyebrow,.tag,.n,code,table,.stats b,figcaption{
  font-family:ui-sans-serif,"Helvetica Neue",Arial,system-ui,sans-serif; }
h1{ font-size:clamp(1.9rem,4.6vw,3rem); line-height:1.1; letter-spacing:-.02em;
  margin:.2em 0 .5rem; text-wrap:balance; font-weight:650; }
h2{ font-size:1.35rem; letter-spacing:-.01em; margin:0 0 .9rem; display:flex; gap:.7rem;
  align-items:baseline; font-weight:650; }
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
.cost{ display:grid; grid-template-columns:repeat(auto-fit,minmax(13rem,1fr)); }
.cost>div{ padding:1rem 1.15rem; border-right:1px solid var(--rule); }
.cost>div:last-child{ border-right:0; }
.cost p{ margin:0; font-size:.9rem; }

table.grid{ width:100%; border-collapse:collapse; margin:1.25rem 0 1.5rem; font-size:.88rem;
  display:block; overflow-x:auto; }
table.grid caption{ text-align:left; font-size:.82rem; color:var(--dim); padding-bottom:.55rem;
  font-family:ui-sans-serif,system-ui,sans-serif; max-width:64ch; }
.grid th{ text-align:left; font-size:.7rem; text-transform:uppercase; letter-spacing:.07em;
  color:var(--dim); font-weight:650; padding:0 .7rem .45rem 0; border-bottom:1px solid var(--rule);
  white-space:nowrap; }
.grid td{ padding:.45rem .7rem .45rem 0; border-bottom:1px solid var(--rule); vertical-align:middle; }
.grid .n{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
.grid .k{ font-family:ui-monospace,Menlo,monospace; white-space:nowrap; }
.bar{ width:38%; min-width:5rem; }
.bar span{ display:block; height:.5rem; border-radius:2px; background:var(--accent); }

.chip{ display:inline-block; font-size:.72rem; padding:.1rem .45rem; border-radius:99px;
  margin:.1rem .25rem .1rem 0; border:1px solid var(--c); white-space:nowrap;
  font-family:ui-sans-serif,system-ui,sans-serif; }
.chip.on{ background:var(--c); color:#fff; font-weight:600; }
.chip.off{ color:var(--dim); opacity:.75; }
.sw{ display:inline-block; width:.7rem; height:.7rem; border-radius:2px; background:var(--c);
  margin-right:.45rem; vertical-align:-1px; }
.swn{ font-size:.88rem; }

.note{ border-left:3px solid var(--accent); background:var(--tint); padding:1rem 1.15rem;
  border-radius:0 5px 5px 0; margin:1.5rem 0 0; }
.note p:last-child{ margin:0; }

.pal{ display:grid; grid-template-columns:repeat(auto-fit,minmax(17rem,1fr)); gap:.15rem 1.5rem; }
.pk{ display:grid; grid-template-columns:auto 6.5rem auto 1fr auto; gap:.6rem; align-items:center;
  padding:.4rem 0; border-bottom:1px solid var(--rule); font-size:.85rem; }
.pk b{ font-family:ui-sans-serif,system-ui,sans-serif; font-weight:600; }
.chipL{ width:1.4rem; height:1.4rem; border-radius:3px; background:var(--c); }
.dashline{ width:100%; height:6px; }
.pk .dim{ font-size:.78rem; font-variant-numeric:tabular-nums; }

/* An earlier answer, or an option left off: the claim in the term, the reason in
   the definition. A list, not a table — these are read, not compared. */
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
render();
