#!/usr/bin/env node
/**
 * Builds `docs/design/tajweed-colours.html` — the options page for the decision
 * "how much of the tajweed colouring can a reader change?".
 *
 * Sibling of `scripts/build-mark-options.mjs`, deliberately: the two pages are
 * about the same seven colours from two directions (how *finely* they are
 * painted, and how *fixed* they are), a reader will very likely arrive at one
 * from the other, and two option pages that do not look like siblings read as
 * two projects. It shares that script's stylesheet and its specimen mechanism.
 *
 * Everything it draws comes from committed bytes and is recomputed on every
 * build — there is no extract step and no cache:
 *
 *   the palette          apps/web/src/styles/tokens.css        (so it cannot drift)
 *   the seven families   packages/core/src/skins.ts            (label, mark, salience)
 *   the eighteen rules   .../skins/hafs-kfqc/tajweed/rules.json
 *   what each rule costs .../skins/hafs-kfqc/tajweed/*.json    (all 114 shards)
 *   the picture          docs/design/mark-granularity.data.json + page 2's print
 *
 * The alternative palettes below are the only invented numbers on the page, and
 * they are invented on purpose: an option about recolouring cannot be judged
 * from a paragraph saying recolouring is possible. They are labelled as
 * illustrations wherever they appear.
 *
 * Run: `node scripts/build-palette-options.mjs`
 *      `node scripts/build-palette-options.mjs --artifact`  (self-contained copy)
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DATA = join(ROOT, "docs/design/mark-granularity.data.json");
const OUT = join(ROOT, "docs/design/tajweed-colours.html");
const OUT_ARTIFACT = join(ROOT, "docs/design/tajweed-colours.artifact.html");
const TAJWEED = join(ROOT, "apps/web/public/assets/skins/hafs-kfqc/tajweed");
const ARTIFACT = process.argv.includes("--artifact");

// ─────────────────────────────────────────────────────── what core paints ────

/** The seven families, read out of core so the labels and marks cannot drift. */
function families() {
  const src = readFileSync(join(ROOT, "packages/core/src/skins.ts"), "utf8");
  const re = /\{ id: "([a-z-]+)", label: "([^"]+)", latin: "([^"]+)", mark: "([^"]+)", salience: (\d+) \}/g;
  const out = [...src.matchAll(re)].map((m) => ({
    id: m[1],
    label: m[2],
    latin: m[3],
    mark: m[4],
    salience: Number(m[5]),
  }));
  if (out.length === 0) {
    console.error("could not read TAJWEED_RULES out of packages/core/src/skins.ts");
    process.exit(1);
  }
  return out;
}

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

// ──────────────────────────────────────────── what the shards actually say ────

/**
 * Every rule the shipped shards use, with what it would cost a reader to be
 * given a colour picker for it. `ayahs` is where the rule occurs; `shown` is
 * where its family also won the verse's single colour, which is the only place
 * a per-rule colour could possibly be seen at today's granularity.
 */
function ruleStats(fams) {
  const vocab = JSON.parse(readFileSync(join(TAJWEED, "rules.json"), "utf8"));
  const familyOf = new Map(vocab.rules.map((r) => [r.id, r.family]));
  const salience = new Map(fams.map((f) => [f.id, f.salience]));

  const occ = new Map();
  const ayahsWith = new Map();
  const shown = new Map();
  // Verses where the winning family is carried by more than one distinct rule —
  // the verses at which "which of the eighteen colours does this wash take?"
  // has no answer that is not arbitrary.
  let ambiguous = 0;
  let total = 0;

  for (const name of readdirSync(TAJWEED)) {
    if (!/^\d+\.json$/.test(name)) continue;
    const shard = JSON.parse(readFileSync(join(TAJWEED, name), "utf8"));
    for (const entry of Object.values(shard)) {
      total += 1;
      const ids = Object.keys(entry);
      const lead = ids
        .map((id) => familyOf.get(id))
        .reduce((a, b) => (salience.get(b) > salience.get(a) ? b : a));
      let leadRules = 0;
      for (const [id, spans] of Object.entries(entry)) {
        occ.set(id, (occ.get(id) ?? 0) + spans.length / 2);
        ayahsWith.set(id, (ayahsWith.get(id) ?? 0) + 1);
        if (familyOf.get(id) === lead) {
          shown.set(id, (shown.get(id) ?? 0) + 1);
          leadRules += 1;
        }
      }
      if (leadRules > 1) ambiguous += 1;
    }
  }

  const rules = vocab.rules
    .map((r) => ({
      id: r.id,
      family: r.family,
      occ: occ.get(r.id) ?? 0,
      ayahs: ayahsWith.get(r.id) ?? 0,
      shown: shown.get(r.id) ?? 0,
    }))
    .sort((a, b) => b.ayahs - a.ayahs);

  return { source: vocab.source, rules, ayahs: total, ambiguous, familyOf };
}

// ────────────────────────────────────────────── colour, as arithmetic ────────

function hexToHsl(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [((h * 60) + 360) % 360, s * 100, l * 100];
}

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.min(100, Math.max(0, s)) / 100;
  l = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];
  const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Relative luminance and the WCAG contrast ratio, for the honesty column. */
function luminance(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** How far apart two colours are, as a plain distance in the HSL cylinder.
 *  Crude on purpose — it is used only to rank pairs, never to certify one. */
function apart(a, b) {
  const [h1, s1, l1] = hexToHsl(a);
  const [h2, s2, l2] = hexToHsl(b);
  const dh = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2)) / 180;
  return Math.hypot(dh * 60, (s1 - s2) / 2, l1 - l2);
}

/**
 * Option C at its best honest version: eighteen colours, each family's hue
 * fanned out in lightness and a little in hue, widest fan to the family with
 * the most rules. Built rather than hand-picked so nobody can say the argument
 * was won by choosing bad colours — this is what a careful person would produce.
 */
function fanned(pal, stats, fams) {
  const byFamily = new Map(fams.map((f) => [f.id, []]));
  for (const r of stats.rules) byFamily.get(r.family)?.push(r);
  const out = {};
  for (const [family, rules] of byFamily) {
    const [h, s, l] = hexToHsl(pal.fill[family]);
    const n = rules.length;
    rules.forEach((r, i) => {
      if (n === 1) {
        out[r.id] = pal.fill[family];
        return;
      }
      const t = i / (n - 1) - 0.5; // −0.5 … +0.5, commonest rule keeps the base end
      out[r.id] = hslToHex(h + t * 26, s - Math.abs(t) * 14, l + t * 30);
    });
  }
  return out;
}

// ───────────────────────────────────────────── the illustrative schemes ──────

/**
 * Two whole palettes a reader might be offered under option D, and one of them
 * doubles as option B's "the reader changed things" picture. Neither is
 * proposed here — they exist so the options can be looked at rather than read.
 *
 * `print` follows the convention the colour-coded printed mus'hafs settled on
 * — red for the elongations, green for the nasal sounds, light blue for the
 * echoing letters, grey for the letters that are written and not said. Those
 * editions have no colour for idghām or for the joining hamza, because they do
 * not mark them; the two here are ours, kept quiet so they read as extra.
 */
const SCHEMES = [
  {
    id: "print",
    name: "Like a printed colour-coded mus'haf",
    note: "Red elongations, green nasal sounds, blue echoing letters, grey silent letters.",
    fill: {
      madd: "#c62828",
      "madd-lazim": "#7f1d1d",
      ghunnah: "#2e7d32",
      qalqalah: "#4fa3d1",
      silent: "#9e9e9e",
      idgham: "#7b5aa6",
      wasl: "#b0a48f",
    },
  },
  {
    id: "contrast",
    name: "Darker, for a bright room",
    note: "The same seven meanings, pushed deeper so they hold up on a phone in sunlight.",
    fill: {
      madd: "#a83200",
      "madd-lazim": "#5c1500",
      ghunnah: "#00625a",
      qalqalah: "#00457a",
      silent: "#3d352c",
      idgham: "#8e2f6b",
      wasl: "#6a5f50",
    },
  },
];

// ───────────────────────────────────────────────────────────── render ────────

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pct = (n, d) => `${((n / d) * 100).toFixed(2)}%`;
const pct1 = (n, d) => `${((n / d) * 100).toFixed(1)}%`;
const num = (n) => n.toLocaleString("en");

function render() {
  if (!existsSync(DATA)) {
    console.error(`missing ${DATA} — build the mark-granularity page first`);
    process.exit(1);
  }
  const fams = families();
  const pal = palette();
  const stats = ruleStats(fams);
  const data = JSON.parse(readFileSync(DATA, "utf8"));
  const c = data.corpus;
  const fan = fanned(pal, stats, fams);

  const FAM = new Map(fams.map((f) => [f.id, f]));
  const ORDER = [...fams].sort((a, b) => a.salience - b.salience).map((f) => f.id);
  const label = (id) => FAM.get(id)?.latin ?? id;

  const manifest = JSON.parse(readFileSync(join(ROOT, "apps/web/public/assets/manifest.json"), "utf8"));
  const viewBox = manifest.viewBoxOverrides?.[String(data.page)] ?? manifest.viewBox;
  const print = `../../apps/web/public/assets/pages/hafs-kfqc/${data.page}.svg`;
  const printDefs = ARTIFACT
    ? `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="print" viewBox="${esc(viewBox)}">${
        readFileSync(join(ROOT, `apps/web/public/assets/pages/hafs-kfqc/${data.page}.svg`), "utf8")
          .replace(/^[\s\S]*?<svg[^>]*>/, "")
          .replace(/<\/svg>\s*$/, "")
      }</symbol></svg>`
    : "";

  // ── the pictures ───────────────────────────────────────────────────────────

  const washAttrs = (colour, family) =>
    `fill="${colour}" fill-opacity="${pal.wash}" stroke="${colour}" ` +
    `stroke-width="${pal.stroke}" stroke-dasharray="${pal.dash[family]}" ` +
    `stroke-linejoin="round" vector-effect="non-scaling-stroke"`;

  /** The page as the app draws it, under whatever palette is handed in. */
  const bandWith = (fill) =>
    data.ayahs
      .filter((a) => a.poly)
      .map((a) => `<path d="${a.poly}" ${washAttrs(fill[a.lead] ?? pal.fill[a.lead], a.lead)}/>`)
      .join("");

  /** Option C on the page: each verse's one wash takes the colour of one *rule*
   *  inside the winning family — the commonest, because nothing says otherwise. */
  const bandPerRule = () => {
    let arbitrary = 0;
    const paths = [];
    for (const a of data.ayahs) {
      if (!a.poly) continue;
      const counts = new Map();
      for (const ann of a.anns) {
        if (ann.family !== a.lead) continue;
        counts.set(ann.rule, (counts.get(ann.rule) ?? 0) + 1);
      }
      if (counts.size > 1) arbitrary += 1;
      const winner = [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
      const colour = (winner && fan[winner]) || pal.fill[a.lead];
      paths.push(`<path d="${a.poly}" ${washAttrs(colour, a.lead)}/>`);
    }
    return { svg: paths.join(""), arbitrary };
  };

  /** A reader who set two families to the same colour. The point of the picture
   *  is what still separates them: the outline pattern, which is not editable. */
  const bandCollided = () => {
    const collided = { ...pal.fill, ghunnah: pal.fill.madd };
    return bandWith(collided);
  };

  const cropped = (crop) => crop;
  const specimen = (layer, { crop = null, label: cap = "" } = {}) => {
    const [vx, vy, vw, vh] = (crop ?? viewBox).split(/\s+/).map(Number);
    const [, , pw, ph] = viewBox.split(/\s+/).map(Number);
    const pc = (n) => `${(n * 100).toFixed(4)}%`;
    const inner = ARTIFACT ? `<use href="#print" x="0" y="0" width="${pw}" height="${ph}"/>` : "";
    return `<figure class="spec" style="--ar:${((vh / vw) * 100).toFixed(4)}%">
  <div class="win">
    ${ARTIFACT ? "" : `<img class="print" src="${esc(print)}" alt=""
         style="width:${pc(pw / vw)};height:${pc(ph / vh)};left:${pc(-vx / vw)};top:${pc(-vy / vh)}">`}
    <svg class="ov" viewBox="${esc(cropped(crop ?? viewBox))}" aria-hidden="true">${inner}${layer}</svg>
  </div>
  ${cap ? `<figcaption>${cap}</figcaption>` : ""}
</figure>`;
  };

  /** The three-line band the option cards are cropped to: 2:3 and its neighbours. */
  const BAND = "6 68 228 70";

  // ── the legends ────────────────────────────────────────────────────────────

  const keyRow = (id, colour, name, right) =>
    `<div class="pk">
      <span class="chipL" style="--c:${colour}"></span>
      <b>${esc(name)}</b>
      <span class="mk" lang="ar" dir="rtl">${esc(FAM.get(id)?.mark ?? "")}</span>
      <svg class="dashline" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="3" x2="100" y2="3" stroke="${colour}" stroke-width="2" stroke-dasharray="${pal.dash[id]}"/></svg>
      <span class="dim">${right}</span>
    </div>`;

  const todayKey = ORDER.map((id) =>
    keyRow(id, pal.fill[id], label(id), `${pct1((c.wins[id] ?? 0) + (c.invisible[id] ?? 0), c.ayahs)} of verses`),
  ).join("");

  const schemeKey = (scheme) =>
    ORDER.map((id) => `<span class="sw" style="--c:${scheme.fill[id]}" title="${esc(label(id))}"></span>`).join("");

  // ── the eighteen, and what a picker for each would buy ─────────────────────

  const ruleRows = stats.rules
    .map(
      (r) => `<tr>
  <td><span class="sw" style="--c:${fan[r.id]}"></span><span class="swn">${esc(r.id.replace(/_/g, " "))}</span></td>
  <td><span class="chip off" style="--c:${pal.fill[r.family]}">${esc(label(r.family))}</span></td>
  <td class="n">${num(r.occ)}</td>
  <td class="n">${num(r.ayahs)}</td>
  <td class="bar"><span style="width:${(r.shown / r.ayahs) * 100}%;background:${pal.fill[r.family]}"></span></td>
  <td class="n">${pct1(r.shown, r.ayahs)}</td>
</tr>`,
    )
    .join("\n");

  // The pair of today's seven that sit closest together, stated rather than
  // claimed — it is the number that says how much headroom a fan of eighteen
  // has, which is the whole of option C's problem.
  const pairs = [];
  for (let i = 0; i < ORDER.length; i += 1) {
    for (let j = i + 1; j < ORDER.length; j += 1) {
      pairs.push({ a: ORDER[i], b: ORDER[j], d: apart(pal.fill[ORDER[i]], pal.fill[ORDER[j]]) });
    }
  }
  pairs.sort((x, y) => x.d - y.d);
  const tightestToday = pairs[0];

  const fanPairs = [];
  const fanIds = stats.rules.map((r) => r.id);
  for (let i = 0; i < fanIds.length; i += 1) {
    for (let j = i + 1; j < fanIds.length; j += 1) {
      fanPairs.push({ a: fanIds[i], b: fanIds[j], d: apart(fan[fanIds[i]], fan[fanIds[j]]) });
    }
  }
  fanPairs.sort((x, y) => x.d - y.d);
  const tightestFan = fanPairs[0];
  const tighterThanToday = fanPairs.filter((p) => p.d < tightestToday.d).length;

  const paperContrast = ORDER.map((id) => ({ id, r: contrast(pal.fill[id], "#fdfaf4") })).sort(
    (a, b) => a.r - b.r,
  );

  const perRule = bandPerRule();
  const pageRules = new Set(data.ayahs.flatMap((a) => a.anns.map((x) => x.rule))).size;

  const fanChips = stats.rules
    .map(
      (r) =>
        `<span class="chip" style="--c:${fan[r.id]};background:${fan[r.id]};color:#fff;border-color:${fan[r.id]}">${esc(
          r.id.replace(/_/g, " "),
        )}</span>`,
    )
    .join("");

  // The checked-in copy is a whole document, because it is read from `file://`
  // and a fragment renders there in quirks mode. The publishable copy is the
  // body only: the host wraps it in its own skeleton, and a second <html> inside
  // that one is discarded along with whatever it was carrying.
  const head = ARTIFACT
    ? `<title>Whose colours are they? — can a reader recolour Hifth's tajweed marks</title>
<style>${STYLE}</style>`
    : `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Whose colours are they? — can a reader recolour Hifth's tajweed marks</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Four options for how much of Hifth's tajweed colouring a reader can change, each drawn on a real page of the mus'haf.">
<style>${STYLE}</style>
</head>
<body>`;

  const html = `${head}
${printDefs}
<header class="head">
  <p class="eyebrow">Hifth · a decision, drawn on paper</p>
  <h1>Whose colours are they?</h1>
  <p class="standfirst">
    Hifth tints a verse to flag a recitation rule inside it, and it uses seven colours it chose
    itself. A reader who learned from a colour-coded printed mus'haf learned different ones. This
    page asks whether a reader should be able to change ours — and, if so, how far down that goes:
    the seven groups the app shows, or all
    <strong>${stats.rules.length}</strong> rules the data underneath actually distinguishes.
  </p>
  <div class="stats">
    <div><b>7</b><span>colours on screen today, fixed</span></div>
    <div><b>${stats.rules.length}</b><span>rules the data tells apart</span></div>
    <div><b>${pct(c.discarded, c.anns)}</b><span>of those rules are invisible at the size we colour</span></div>
  </div>
  <div class="note plain">
    <h4>Four words, before we start</h4>
    <p>
      A <strong>tajweed rule</strong> tells a reciter to do something at a particular spot — hold a
      vowel, hum through a letter, skip one. A <strong>madd</strong> is a held vowel; a
      <strong>ghunnah</strong> is a hum through the nose; a <strong>qalqalah</strong> is a slight
      echo on a stopped letter. Hifth sorts every rule into <strong>seven groups</strong> and gives
      each group a colour, an outline pattern and a small Arabic letter, so the colour is never
      carrying the meaning on its own.
    </p>
  </div>
</header>

<main>

<section>
  <h2><span class="num">1</span>What is being decided?</h2>
  <p class="lede">
    Whether a reader can change the tajweed colours, and how far down the change reaches.
  </p>
  <p>
    Four answers, drawn side by side further down. <strong>A</strong>: leave them fixed.
    <strong>B</strong>: a reader recolours the seven groups. <strong>C</strong>: a reader recolours
    all ${stats.rules.length} rules. <strong>D</strong>: no picker at all — a short list of whole
    ready-made schemes to choose between.
  </p>
</section>

<section>
  <h2><span class="num">2</span>Why is this being asked now?</h2>
  <p>
    Because the app only just started knowing which rule it is looking at. Until this week the
    colouring data was stored as the seven groups and the finer names were thrown away when it was
    built — an <em>ikhfa</em> and an <em>iqlab</em> were the same thing by the time anything could
    ask. They are now kept, all ${stats.rules.length} of them, which cost
    <strong>17.5%</strong> more to download and bought exactly one thing: the question on this page
    became answerable in more than one way.
  </p>
  <p>
    And because a reader arriving from a printed colour-coded mus'haf arrives with colours already
    in their head. Ours are not wrong, but they are ours.
  </p>
</section>

<section>
  <h2><span class="num">3</span>What happens if nobody decides?</h2>
  <p>
    Nothing breaks. Option A is what the app does today: seven colours, chosen once, the same for
    everyone. Nothing else is waiting behind this question and it can sit open indefinitely.
  </p>
  <p>
    The cost is that a reader who finds our green unreadable, or who knows red as the elongation
    colour and meets orange, has nowhere to go but switching the colouring off entirely — which is
    the one control that does exist today, and is a blunt answer to a small complaint.
  </p>
</section>

<section>
  <h2><span class="num">4</span>What colours does the app use today, and where did they come from?</h2>
  <p>
    Seven, drawn from a palette designed to stay distinguishable to readers with the common kinds of
    colour blindness. Each group also gets its own outline pattern and its own small Arabic letter,
    so nothing on screen depends on telling two hues apart. Here they are on a real page — three
    lines of the second page of the mus'haf, at about the size a phone shows them.
  </p>
  ${specimen(bandWith(pal.fill), { crop: BAND, label: "What the app draws today. One tint per verse, in the rarest kind of rule that verse carries." })}
  <div class="pal">${todayKey}</div>
  <p class="small dim" style="margin-top:1rem">
    The right-hand figure is how many verses in the whole mus'haf carry that kind of rule at all —
    not how many show it. Most of them show nothing, which is the subject of a
    <a href="mark-granularity.html">separate question</a>.
  </p>
  <table class="grid">
    <caption>How each colour stands against the paper. Anything under 3 is a colour that has to lean on its outline pattern to be found, which is exactly why the outline patterns exist.</caption>
    <thead><tr><th>group</th><th class="n">contrast against the page</th><th></th></tr></thead>
    <tbody>
${paperContrast
  .map(
    (p) => `<tr><td><span class="sw" style="--c:${pal.fill[p.id]}"></span><span class="swn">${esc(label(p.id))}</span></td>
  <td class="n">${p.r.toFixed(2)}</td>
  <td class="bar"><span style="width:${Math.min(100, (p.r / 8) * 100)}%;background:${pal.fill[p.id]}"></span></td></tr>`,
  )
  .join("\n")}
    </tbody>
  </table>
</section>

<section>
  <h2><span class="num">5</span>If a reader picks two colours the same, does the page break?</h2>
  <p class="lede">
    No — and this is the reason a colour picker is safe to offer at all.
  </p>
  <p>
    Below is the same three lines with two different kinds of rule set to the identical colour, which
    is the worst thing a reader could do with a picker. The verses are still told apart, because the
    outline pattern is not part of what a reader would be changing: one group is drawn with a long
    dash, the other with a fine dot.
  </p>
  ${specimen(bandCollided(), { crop: BAND, label: "Two groups, one colour, still separable. The outline pattern and the small Arabic letter stay fixed under every option on this page." })}
  <div class="note">
    <p>
      <strong>So the constraint is narrow.</strong> Whatever is offered, the outline patterns and the
      letters stay ours. A reader is choosing hues, not choosing whether the page remains readable
      without them.
    </p>
  </div>
</section>

<section>
  <h2><span class="num">6</span>What do printed mus'hafs and other apps do?</h2>
  <p>
    <strong>We looked.</strong> The printed colour-coded mus'hafs — the Damascus edition most people
    mean by the term, and the several editions that followed it — settle on a small number of
    colours and hold them fixed: red for the elongations, green for the nasal sounds, blue for the
    echoing letters, grey for letters written and not pronounced. One publisher describes covering
    28 rules with three colour families; others run to about seven. In every case the reader gets a
    legend at the foot of the page, not a choice.
  </p>
  <p>
    Among apps, the pattern we found is a <em>switch</em>, not a palette: the colouring is turned on
    or off in settings, and the colours themselves are the publisher's. We did not find a mus'haf
    app that lets a reader change which colour means which rule. That is worth stating as what it
    is — an absence in what we searched, not proof that none exists.
  </p>
  <dl class="prior">
    <dt>Printed, fixed, and explained at the foot of every page.</dt>
    <dd>
      The colour-coded print tradition is old enough to be a convention, and the convention is that
      the reader is taught the colours rather than asked for them. It is the strongest argument for
      option D over B: a scheme is a thing you can learn, a hue you picked yourself is not.
      <span class="src">Sources:
        <a href="https://www.islamicbookstore.com/tajweed.html">Mushaf al-Tajweed, Dar al-Maarifah</a> ·
        <a href="https://gatewaytoquran.com/color-coded-quran/">Colour-coded Qur'an, seven colours</a>
      </span>
    </dd>
    <dt>In apps, the control is a toggle.</dt>
    <dd>
      Tajweed colours are switched on in settings and that is the whole of it; where a reader can
      interact with a colour, it is to ask what the rule means, not to change it.
      <span class="src">Sources:
        <a href="https://support.muslimpro.com/hc/en-us/articles/115002005787-How-to-activate-the-coloured-Tajweed-for-Quran">Muslim Pro — turning tajweed colours on</a> ·
        <a href="https://gtaf.org/blog/tajweed-colour-code-in-quran-app/">Greentech Apps — tajweed colour code</a> ·
        <a href="https://github.com/quran/quran_android/issues/439">quran_android — colour-coded tajweed support</a>
      </span>
    </dd>
    <dt>Where the idea of an editable palette actually comes from.</dt>
    <dd>
      Not from mus'hafs. From code editors and reading apps, where a colour theme is expected to be
      the reader's and shipping a few good ones is standard. That is a real precedent, but it is a
      precedent for <em>schemes</em> — nobody recolours a syntax highlighter one token type at a
      time either.
    </dd>
  </dl>
</section>

<section>
  <h2><span class="num">7</span>What have we already decided that ties our hands?</h2>
  <dl class="prior">
    <dt>The app colours a whole verse at a time — and that question is still open.</dt>
    <dd>
      A verse carries <strong>${c.meanFamilies.toFixed(1)}</strong> different kinds of rule on
      average and gets one colour, so <strong>${pct(c.discarded, c.anns)}</strong> of everything we
      know is already invisible. This is the constraint that decides between B and C below, and it
      is not settled: it has <a href="mark-granularity.html">its own page</a>.
    </dd>
    <dt>A reader can already turn the colouring off completely.</dt>
    <dd>
      That control exists and stays. Everything here is about what happens when it is on.
    </dd>
    <dt>Colour is never the only carrier.</dt>
    <dd>
      Every group has an outline pattern and an Arabic letter as well as a hue, so a reader who
      cannot separate two colours has two other ways to. Section 5 is what that buys.
    </dd>
  </dl>
</section>

<section>
  <h2><span class="num">8</span>How much would a reader actually see change?</h2>
  <p class="lede">
    For the seven groups: all of it. For the ${stats.rules.length} rules: almost none of it, today.
  </p>
  <p>
    A colour can only be seen where it is painted, and the app paints one tint per verse in whichever
    group is rarest. So a colour given to a single rule shows up only in the verses where that rule's
    group won — the last column below. Change the colour of the commonest elongation and
    <strong>${pct1(stats.rules.find((r) => r.id === "madd_2").shown, stats.rules.find((r) => r.id === "madd_2").ayahs)}</strong>
    of the verses that contain it would look any different.
  </p>
  <table class="grid">
    <caption>All ${stats.rules.length} rules in the shipped data, commonest first. The swatches are option C's colours, built by fanning each group's hue — see section 11. “Where it could show” is the share of that rule's verses in which its group also won the verse's one tint.</caption>
    <thead><tr><th>rule</th><th>group</th><th class="n">places</th><th class="n">verses</th><th></th><th class="n">where it could show</th></tr></thead>
    <tbody>
${ruleRows}
    </tbody>
  </table>
  <div class="note">
    <p>
      <strong>And ${num(stats.ambiguous)} verses have no answer at all.</strong> In
      ${pct1(stats.ambiguous, stats.ayahs)} of the ${num(stats.ayahs)} coloured verses, the winning
      group is carried by more than one rule at once — two kinds of elongation in the same verse, say.
      There is one tint to give and two colours that want it, and nothing in the data says which. At
      verse size, ${stats.rules.length} colours is not a finer picture; it is the same picture with a
      coin toss in it.
    </p>
  </div>
</section>

<section>
  <h2><span class="num">9</span>The options, drawn</h2>
  <p>
    All four on the same three lines, so the comparison is by eye rather than by adjective.
  </p>

  <div class="opt">
    <div class="opt-h"><h3>A · Leave the colours fixed</h3><p class="tag">what the app does today</p></div>
    ${specimen(bandWith(pal.fill), { crop: BAND })}
    <div class="cost">
      <div><h4>What a reader gets</h4><p>One set of colours, the same on every device, chosen to survive colour blindness. A legend that means the same thing to two people talking about it.</p></div>
      <div><h4>What it costs</h4><p>A reader who finds a colour unreadable, or who learned different ones, can only switch the whole thing off.</p></div>
      <div><h4>What it costs us</h4><p>Nothing. No new screen, no stored preference, no way for a reader to make the page worse.</p></div>
    </div>
  </div>

  <div class="opt">
    <div class="opt-h"><h3>B · A reader recolours the seven groups</h3><p class="tag">seven colour pickers</p></div>
    ${specimen(bandWith(SCHEMES[0].fill), { crop: BAND, label: "The same three lines after a reader moved all seven towards the printed convention. Illustration — these are not proposed values." })}
    <div class="cost">
      <div><h4>What a reader gets</h4><p>Their own colours, at the only size the app actually paints. Someone who learned red elongations can have red elongations.</p></div>
      <div><h4>What it costs</h4><p>Seven pickers is a real screen to design, and a reader can produce a palette worse than the one they started from — recoverable, since section 5 shows the page still works, and a reset returns it.</p></div>
      <div><h4>What it costs us</h4><p>A settings surface, seven stored values, and the colours stop being something two people can assume they share.</p></div>
    </div>
  </div>

  <div class="opt">
    <div class="opt-h"><h3>C · A reader recolours all ${stats.rules.length} rules</h3><p class="tag">${stats.rules.length} colour pickers</p></div>
    ${specimen(perRule.svg, { crop: BAND, label: `The same three lines with every rule given its own colour. ${perRule.arbitrary > 0 ? `On ${perRule.arbitrary} of these verses the tint had to be picked between two rules that both qualified.` : "Barely distinguishable from A, because there is still one tint per verse."}` })}
    <div class="pal-chips">${fanChips}</div>
    <div class="cost">
      <div><h4>What a reader gets</h4><p>In principle, the full grain of the data: an ikhfa told apart from an iqlab by colour.</p></div>
      <div><h4>What it costs</h4><p>${stats.rules.length} colours do not fit. Fanning each group's hue out as far as it will honestly go still puts <strong>${tighterThanToday}</strong> pairs closer together than the closest pair in today's seven. And at verse size most of them never paint at all — section 8.</p></div>
      <div><h4>What it costs us</h4><p>${stats.rules.length} pickers, ${stats.rules.length} names to write in two languages, and a legend nobody can hold in their head.</p></div>
    </div>
  </div>

  <div class="opt">
    <div class="opt-h"><h3>D · Offer a few ready-made schemes</h3><p class="tag">no picker; a short list</p></div>
    <div class="two">
      ${specimen(bandWith(pal.fill), { crop: BAND, label: "As it ships." })}
      ${SCHEMES.map((s) => specimen(bandWith(s.fill), { crop: BAND, label: `${esc(s.name)}. ${esc(s.note)} Illustration.` })).join("\n      ")}
    </div>
    <div class="schemes">
      <div><span class="swn">As it ships</span> ${ORDER.map((id) => `<span class="sw" style="--c:${pal.fill[id]}"></span>`).join("")}</div>
      ${SCHEMES.map((s) => `<div><span class="swn">${esc(s.name)}</span> ${schemeKey(s)}</div>`).join("\n      ")}
    </div>
    <div class="cost">
      <div><h4>What a reader gets</h4><p>A choice that cannot go wrong, in one tap. Each scheme is designed as a whole, checked for colour blindness as a whole, and can be named — which means two people can still talk about it.</p></div>
      <div><h4>What it costs</h4><p>Not the colours a particular reader wanted, only the nearest of three or four. Somebody has to design each scheme and stand behind it.</p></div>
      <div><h4>What it costs us</h4><p>One stored value instead of seven, one screen with three rows on it, and no way for a reader to break their own page.</p></div>
    </div>
  </div>
</section>

<section>
  <h2><span class="num">10</span>What else could be considered, and why is it not here?</h2>
  <dl class="prior">
    <dt>Let a reader choose which kinds of rule to show, rather than what colour they are.</dt>
    <dd>
      Show only the elongations, say. This is a different and possibly better answer to the same
      frustration, it needs no palette at all, and — unlike C — it gets more useful the more rules
      the data distinguishes. It is left off because it is not a colour question, and because it
      belongs with the question of how finely we paint rather than this one. It stays available
      whichever of A, B, C or D wins.
    </dd>
    <dt>One slider for how strong the colouring is, and nothing else.</dt>
    <dd>
      Most complaints about a wash are that it is too loud or too faint, not that it is the wrong
      hue. This is the cheapest thing on the page and it may well be the thing actually being asked
      for. It is left off because it does not answer "whose colours are they" — but if the answer to
      this page is A, it is the next thing to build.
    </dd>
    <dt>Follow the printed convention exactly and stop.</dt>
    <dd>
      Change our seven to the Damascus colours and offer nothing. It is a defensible answer and it
      is not on the list because that convention has no colour for two of our seven groups, and
      because it would trade a palette that survives colour blindness for one that was designed for
      ink on paper.
    </dd>
  </dl>
</section>

<section>
  <h2><span class="num">11</span>What would change the answer?</h2>
  <ul class="wch">
    <li>
      <strong>Colouring smaller than a whole verse.</strong> This is the big one. If the app starts
      tinting the exact letter a rule lands on, ${pct(c.discarded, c.anns)} of the rules stop being
      invisible, the ${num(stats.ambiguous)} undecidable verses in section 8 stop being undecidable,
      and C goes from pointless to plausible in a single change. That question has
      <a href="mark-granularity.html">its own page</a> and is still open; this one should probably not
      be answered with C before it is answered.
    </li>
    <li>
      <strong>A hafiz saying our green is not their green.</strong> One person reciting from a page
      and naming a colour that reads wrong would settle B versus D faster than anything here.
    </li>
    <li>
      <strong>A reader who cannot use the palette we chose.</strong> The current seven are picked to
      survive the common kinds of colour blindness, but "common" is doing work in that sentence. One
      report of a pair that genuinely cannot be separated turns B from a preference into an
      accessibility fix — and then it should not wait behind anything.
    </li>
    <li>
      <strong>Somebody wanting to share a scheme.</strong> If schemes turn out to be something a
      teacher hands to a class, D grows a name-and-a-link and B does not scale to it at all.
    </li>
  </ul>
</section>

<section>
  <h2><span class="num">12</span>What is this page not settling?</h2>
  <p>
    How finely the app paints — that is the separate open question this page keeps pointing at.
    Whether the colouring is on by default. What the ${stats.rules.length} rules should be
    <em>called</em> in Arabic and English, which becomes necessary the moment anything shows them one
    by one. Whether a reader can ask what a colour means by touching it. And nothing at all about
    where the rule data came from or how good it is, which has its own record.
  </p>
</section>

<section>
  <h2><span class="num">13</span>So what should we build?</h2>
  <p class="lede">
    The real choice is between <strong>B</strong> and <strong>D</strong>. A needs no decision, and
    C is the one option this page can argue against with a picture rather than an opinion.
  </p>
  <p>
    The case against C is section 8 and section 9's third card together: at the size we paint,
    ${stats.rules.length} colours mostly cannot be seen, on ${num(stats.ambiguous)} verses the app
    would have to guess which one to use, and fanned as generously as they honestly can be they are
    still ${tighterThanToday} pairs tighter than anything we ship today. That is not an argument
    against ever telling ${stats.rules.length} rules apart — it is an argument that colour is the
    wrong tool for it until we paint smaller than a verse.
  </p>
  <p>
    Between B and D: B gives a reader exactly what they asked for and gives us seven ways for a page
    to end up worse than it started. D gives a reader less, keeps the palette something designed
    rather than assembled, and keeps it nameable — which matters more than it sounds, because a
    colour scheme two people share is a thing they can talk about and a colour scheme one person
    invented is not.
  </p>
</section>

</main>

<footer>
  <p>
    <strong>Where the pictures come from.</strong> Nothing here is a mock-up. The page is the real
    mus'haf image the app ships and the tinted shapes are the same ones the app taps against. The
    seven colours, their outline patterns and their Arabic letters are read out of the app's own
    stylesheet and source when this page is built, so they cannot drift from what Hifth looks like.
    Every count comes from the ${stats.rules.length} rules in the shipped data, recomputed on each
    build. The alternative palettes in options B and D are drawn to make the options visible and are
    labelled as illustrations wherever they appear — nothing on this page proposes them.
  </p>
  <p class="dim small">
    Built by <code>scripts/build-palette-options.mjs</code> — edit that, not this. The rule data is
    <code>${esc(stats.source)}</code>; the print is
    <code>assets/pages/hafs-kfqc/${data.page}.svg</code>, outlined shapes only, no text.
  </p>
</footer>
${ARTIFACT ? "" : "</body>\n</html>\n"}`;

  const out = ARTIFACT ? OUT_ARTIFACT : OUT;
  writeFileSync(out, html);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
  console.log(`${basename(out)} — ${kb} KB, ${stats.rules.length} rules, ${pageRules} of them on page ${data.page}`);
  console.log(
    `  ${num(stats.ambiguous)}/${num(stats.ayahs)} verses (${pct1(stats.ambiguous, stats.ayahs)}) have a winning family carried by more than one rule`,
  );
  console.log(
    `  fanned to ${stats.rules.length}: ${tighterThanToday} pairs closer than today's tightest (${label(tightestToday.a)}/${label(tightestToday.b)}), worst ${tightestFan.a}/${tightestFan.b}`,
  );
}

// ────────────────────────────────────────────────────────────── style ────────
//
// Shared with `build-mark-options.mjs` by being the same, on purpose: the two
// pages are the same kind of document about the same seven colours, and a
// reader crossing between them should not feel they changed project. The
// additions at the end are the ones this page needs and that one does not.

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
.opt .two{ padding:1.15rem; border-bottom:1px solid var(--rule); }
.opt .two .win{ border:1px solid var(--rule); border-radius:4px; }
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
.bar{ width:26%; min-width:4rem; }
.bar span{ display:block; height:.5rem; border-radius:2px; background:var(--accent); }

.chip{ display:inline-block; font-size:.72rem; padding:.1rem .45rem; border-radius:99px;
  margin:.1rem .25rem .1rem 0; border:1px solid var(--c); white-space:nowrap;
  font-family:ui-sans-serif,system-ui,sans-serif; }
.chip.off{ color:var(--dim); opacity:.85; }
.sw{ display:inline-block; width:.7rem; height:.7rem; border-radius:2px; background:var(--c);
  margin-right:.45rem; vertical-align:-1px; }
.swn{ font-size:.88rem; }

.note{ border-left:3px solid var(--accent); background:var(--tint); padding:1rem 1.15rem;
  border-radius:0 5px 5px 0; margin:1.5rem 0 0; }
.note p:last-child{ margin:0; }

.pal{ display:grid; grid-template-columns:repeat(auto-fit,minmax(19rem,1fr)); gap:.15rem 1.5rem; }
.pk{ display:grid; grid-template-columns:1.4rem 8rem 1.2rem 1fr auto; gap:.6rem; align-items:center;
  padding:.4rem 0; border-bottom:1px solid var(--rule); font-size:.85rem; }
.pk b{ font-family:ui-sans-serif,system-ui,sans-serif; font-weight:600; }
.chipL{ width:1.4rem; height:1.4rem; border-radius:3px; background:var(--c); }
.dashline{ width:100%; height:6px; }
.pk .dim{ font-size:.78rem; font-variant-numeric:tabular-nums; }
.pk .mk{ font-size:1rem; }

/* Option C's eighteen, shown together at legend size — the collisions are the
   argument, so they have to sit next to each other rather than in a table. */
.pal-chips{ padding:1rem 1.15rem; border-bottom:1px solid var(--rule); }
.pal-chips .chip{ border:0; font-weight:600; }

.schemes{ padding:0 1.15rem 1.15rem; display:grid; gap:.5rem; }
.schemes div{ display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; }
.schemes .swn{ min-width:16rem; color:var(--dim); }
.schemes .sw{ width:1.35rem; height:1.35rem; margin:0; border-radius:3px; }

/* An earlier answer, or an option left off: the claim in the term, the reason in
   the definition. A list, not a table — these are read, not compared. */
.prior{ margin:1.25rem 0 0; max-width:64ch; }
.prior dt{ font-family:ui-sans-serif,"Helvetica Neue",Arial,system-ui,sans-serif; font-size:.92rem;
  font-weight:650; margin-top:1.1rem; }
.prior dt:first-child{ margin-top:0; }
.prior dd{ margin:.35rem 0 0; padding-left:1rem; border-left:2px solid var(--rule);
  font-size:.94rem; color:var(--ink); }
.src{ display:block; margin-top:.5rem; font-size:.8rem; color:var(--dim); }

.wch{ margin:1.25rem 0 0; padding-left:1.15rem; max-width:64ch; }
.wch li{ margin-bottom:.7rem; }

footer{ margin-top:3rem; padding-top:1.5rem; padding-bottom:4rem; border-top:1px solid var(--rule); }
footer p{ font-size:.85rem; color:var(--dim); }
footer strong{ color:var(--ink); }
@media (max-width:34rem){ .cost>div{ border-right:0; border-bottom:1px solid var(--rule); }
  .schemes .swn{ min-width:0; flex:1 0 100%; } }
`;

// ──────────────────────────────────────────────────────────────── main ───────

render();
