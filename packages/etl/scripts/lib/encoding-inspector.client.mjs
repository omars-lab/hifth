/**
 * The encoding inspector, as it runs in the browser.
 *
 * This file never executes in Node. `probe-encodings.mjs` reads it as text and
 * writes it into the report's single `<script>`, immediately after the source
 * of `lib/tajweed-fold.mjs` with its `export ` keywords stripped — which is why
 * `foldAyah`, `CORRECTIONS` and the rest below are free identifiers rather than
 * imports, and why the `global` comment below is not laziness. The point of that
 * arrangement is stated in the design doc and worth restating: the fold that
 * computes these numbers is the *same bytes* the ETL ran, so a toggle in this
 * page cannot drift from the probe it is meant to explain.
 *
 * Everything else here is presentation. There is no framework and no build
 * step: a report has to open from `file://` years after the corpus it describes
 * moved on, and every dependency is one more thing that has to still exist then.
 *
 * ## The one non-obvious decision
 *
 * Aggregates are recomputed **from the embedded corpus on every toggle**, not
 * looked up in precomputed tables. That is the whole reason the corpus is
 * embedded at all — a table of results per correction combination would be 2ⁿ
 * tables, and would go stale the moment a sixth correction was added. Folding
 * all 6,236 ayahs takes a few hundred milliseconds, which is cheap enough to do
 * on a checkbox, and it means the number under the toggle is measured rather
 * than remembered.
 */
/* global CORRECTIONS, ALL_CORRECTIONS, DRIFT_LIMIT, foldAyah, touchClass, touched, oracleOf, driftOnset, driftShape, nameOf, nameWindow, HIFTH_DATA */

const DATA = HIFTH_DATA;
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, String(v));
  }
  for (const kid of [].concat(kids)) if (kid) n.append(kid);
  return n;
};
const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(2)}%` : "—");
const num = (n) => n.toLocaleString("en-US");

// ------------------------------------------------------------------- state --

const state = {
  on: new Set(ALL_CORRECTIONS),
  view: "ayah",
  key: "2:4",
  annotation: null,
  filter: null, // { label, keys: [ayah keys] }
  sort: {}, // table id → { col, dir }
};

/** The ayahs, in mus'haf order — the order every list and the ± buttons use. */
const KEYS = Object.keys(DATA.ayahs);
const ORDER = new Map(KEYS.map((k, i) => [k, i]));

/**
 * How many ayahs each distinct `data-hafs` string appears in, mus'haf-wide.
 *
 * The denominator for the drift-onset table, and the difference between an
 * instrument and a word-frequency list. «وَ» stands inside 95 drift windows
 * because it stands inside everything; «ٱلۡأٓخِرَةِ» stands inside 41 because it
 * is the cause — switch `alef-madda` off and watch it come back to the top of
 * that table, which is how the correction was found. Only the ratio tells the
 * two apart, so the ratio is a column.
 * Corrections do not change which words exist, so this is computed once.
 */
const WORD_AYAHS = (() => {
  const f = new Map();
  for (const a of Object.values(DATA.ayahs)) {
    for (const text of new Set(a.w)) f.set(text, (f.get(text) ?? 0) + 1);
  }
  return f;
})();

/** `"2:4"` → the ayah's words in the shape the fold wants. */
function wordsOf(key) {
  const a = DATA.ayahs[key];
  if (!a) return null;
  return a.w.map((hafs, i) => ({ hafs, waw: a.v[i] === "1", mark: a.m[i] === "1" }));
}
const BASMALA = wordsOf("1:1");

/** The fold for one ayah under the current toggles, plus its annotations. */
function foldOf(key) {
  const a = DATA.ayahs[key];
  const [surah, ayah] = key.split(":").map(Number);
  const words = wordsOf(key);
  const indices = words.map((_, i) => i + 1);
  const f = foldAyah({ surah, ayah, words, basmala: BASMALA, indices, on: state.on });
  const annotations = (a.a ?? []).map(([r, start, end]) => ({ rule: DATA.rules[r], start, end }));
  return { ...f, words, annotations, surah, ayah, entry: a };
}

// ------------------------------------------------------------- measurement --

/**
 * Every aggregate, from the corpus, under the current toggles.
 *
 * One pass. The drill-down index is built here rather than by re-filtering
 * later, because "which ayahs are behind this row" is the question every table
 * in the report exists to be asked, and a row that cannot answer it is a number
 * with nowhere to go.
 */
function measure() {
  const t0 = performance.now();
  const bucket = new Map(); // drill-down: bucket id → Set of ayah keys
  const put = (id, key) => {
    let s = bucket.get(id);
    if (!s) bucket.set(id, (s = new Set()));
    s.add(key);
  };

  const totals = { annotations: 0, one: 0, twoAdjacent: 0, wider: 0, pastEnd: 0, oracleN: 0, oracleHit: 0 };
  const perRule = new Map();
  const perSurah = new Map();
  const deltas = new Map();
  const shapes = new Map();
  const onsets = new Map();
  const residual = [];

  for (const key of KEYS) {
    const { cps, hosts, annotations, surah } = foldOf(key);
    const checkable = [];
    let su = perSurah.get(surah);
    if (!su) perSurah.set(surah, (su = { surah, ayahs: 0, annotations: 0, oracleN: 0, oracleHit: 0, missAyahs: 0 }));
    su.ayahs += 1;
    const ayahDeltas = [];

    for (const a of annotations) {
      totals.annotations += 1;
      su.annotations += 1;
      let r = perRule.get(a.rule);
      if (!r) perRule.set(a.rule, (r = { rule: a.rule, n: 0, one: 0, twoAdjacent: 0, wider: 0, pastEnd: 0, oracleN: 0, oracleHit: 0 }));
      r.n += 1;

      const cls = touchClass(hosts, a.start, a.end, cps.length);
      const field = cls === "two-adjacent" ? "twoAdjacent" : cls === "past-end" ? "pastEnd" : cls;
      totals[field] += 1;
      r[field] += 1;
      put(`touch:${cls}`, key);
      if (cls !== "one") put(`touch-rule:${cls}:${a.rule}`, key);

      const o = oracleOf(cps, a);
      if (!o) continue;
      totals.oracleN += 1;
      r.oracleN += 1;
      su.oracleN += 1;
      checkable.push({ start: a.start, delta: o.delta ?? DRIFT_LIMIT + 1 });
      if (o.hit) {
        totals.oracleHit += 1;
        r.oracleHit += 1;
        su.oracleHit += 1;
        continue;
      }
      const d = o.delta;
      deltas.set(d, (deltas.get(d) ?? 0) + 1);
      put(`delta:${d}`, key);
      ayahDeltas.push(d);

      const shape = driftShape(cps, a.start, d);
      let sh = shapes.get(shape);
      if (!sh) shapes.set(shape, (sh = { shape, n: 0, deltas: new Set(), rules: new Set(), keys: new Set() }));
      sh.n += 1;
      sh.deltas.add(d);
      sh.rules.add(a.rule);
      sh.keys.add(key);
      put(`shape:${shape}`, key);
    }

    if (ayahDeltas.length) {
      su.missAyahs += 1;
      residual.push({ key, misses: ayahDeltas.length, deltas: [...new Set(ayahDeltas)].sort((x, y) => x - y) });
      put(ayahDeltas.every((d) => d === ayahDeltas[0]) ? "residual:constant" : "residual:mixed", key);

      // Where the drift began, blamed on the print words inside the window. One
      // ayah contributes one count to each distinct word it brackets — the same
      // word appearing in forty windows is the signal, and counting it twice for
      // one ayah would drown it in ayah length.
      const onset = driftOnset(checkable, hosts, cps);
      if (onset) {
        for (const text of new Set(onset.words.map((w) => w.text))) {
          let o = onsets.get(text);
          if (!o) onsets.set(text, (o = { text, ayahs: 0, deltas: new Set(), bounded: 0, keys: new Set() }));
          o.ayahs += 1;
          o.deltas.add(onset.delta);
          if (onset.bounded) o.bounded += 1;
          o.keys.add(key);
          put(`onset:${text}`, key);
        }
      }
    }
    for (const a of annotations) put(`rule:${a.rule}`, key);
    put(`surah:${surah}`, key);
  }

  return {
    totals,
    perRule: [...perRule.values()],
    perSurah: [...perSurah.values()],
    deltas: [...deltas.entries()].sort((a, b) => (a[0] ?? 99) - (b[0] ?? 99)),
    shapes: [...shapes.values()].sort((a, b) => b.n - a.n),
    onsets: [...onsets.values()].sort((a, b) => b.ayahs - a.ayahs),
    residual: residual.sort((a, b) => b.misses - a.misses),
    bucket,
    ms: performance.now() - t0,
  };
}

let M = null;

// -------------------------------------------------------------- the ⓘ parts --

/**
 * A sortable table. `cols` are `{ id, label, get, fmt, align, cls }`.
 *
 * `initial` matters more than it looks: a table of print words sorted by
 * frequency is a different instrument from one in mus'haf order, and the
 * default has to be the order the reader came for. `dir` is 1 ascending,
 * −1 descending, for strings and numbers alike.
 */
function table(id, cols, rows, onRow, initial = { col: cols[1]?.id ?? cols[0].id, dir: -1 }) {
  const sort = state.sort[id] ?? initial;
  const col = cols.find((c) => c.id === sort.col) ?? cols[0];
  const sorted = [...rows].sort((a, b) => {
    const x = col.get(a);
    const y = col.get(b);
    if (typeof x === "string" || typeof y === "string") return String(x).localeCompare(String(y)) * sort.dir;
    return ((x ?? -Infinity) - (y ?? -Infinity)) * sort.dir;
  });
  const head = el("tr", {}, cols.map((c) =>
    el("th", {
      class: `${c.align === "r" ? "r" : ""} ${c.id === sort.col ? "sorted" : ""}`,
      text: `${c.label}${c.id === sort.col ? (sort.dir < 0 ? " ↓" : " ↑") : ""}`,
      onclick: () => {
        state.sort[id] = { col: c.id, dir: c.id === sort.col ? -sort.dir : -1 };
        render();
      },
    })));
  const body = sorted.map((row) =>
    el("tr", { class: onRow ? "clickable" : "", onclick: onRow ? () => onRow(row) : null },
      cols.map((c) => el("td", { class: c.align === "r" ? "r" : c.cls?.(row) ?? "", text: c.fmt ? c.fmt(row) : String(c.get(row) ?? "") }))));
  return el("table", { class: "grid" }, [el("thead", {}, head), el("tbody", {}, body)]);
}

/** Show a set of ayahs as a drillable list, and remember what it is a list of. */
function drill(label, keys) {
  state.filter = { label, keys: [...keys].sort((a, b) => ORDER.get(a) - ORDER.get(b)) };
  state.view = "list";
  render();
}

function goto(key) {
  state.key = key;
  state.annotation = null;
  state.view = "ayah";
  render();
}

/** A codepoint cell, with its index and its Unicode name in the title. */
function cpCell(cps, i, hostAt, inSpan) {
  const ch = cps[i];
  const host = hostAt[i];
  return el("span", {
    class: `cp${inSpan ? " in-span" : ""}${host === undefined ? " gap" : host % 2 ? " odd" : " even"}${ch === " " ? " sp" : ""}`,
    title: `${i} · ${nameOf(ch)}${host === undefined ? "" : ` · host ${host}`}`,
  }, [
    el("b", { text: ch === " " ? "␣" : ch }),
    el("i", { text: i % 10 === 0 ? String(i) : "" }),
  ]);
}

// ------------------------------------------------------------- the ayah view --

function viewAyah() {
  const key = state.key;
  if (!DATA.ayahs[key]) return el("p", { class: "empty", text: `No ayah ${key} in this print.` });
  const f = foldOf(key);
  const { cps, hosts, words, annotations, entry } = f;
  const out = el("div", {});

  // Which host owns each codepoint — the tint that makes word boundaries
  // legible in a string that has none.
  const hostAt = [];
  hosts.forEach((h, i) => {
    for (let x = h.from; x < h.to; x += 1) hostAt[x] = i;
  });

  const sel = state.annotation === null ? null : annotations[state.annotation];
  const inSpan = (i) => sel && i >= sel.start && i < sel.end;

  out.append(el("div", { class: "ayah-head" }, [
    el("h2", { text: `${key} — ${DATA.surahs[f.surah - 1].name} · ${DATA.surahs[f.surah - 1].ename}` }),
    el("p", { class: "sub", text: `page ${DATA.pages[key]} of the print · ${words.length} print words (${words.filter((w) => w.mark).length} pause marks) · ${annotations.length} tajweed annotations · ${cps.length} codepoints reconstructed${f.prefix ? ` (${f.prefix} of them the prepended basmala)` : ""}` }),
  ]));

  // ① the artwork. Named, never drawn — see the design doc's blind spots.
  out.append(el("section", {}, [
    el("h3", { text: "① the page artwork" }),
    el("p", { class: "note", text: `Page ${DATA.pages[key]}, in apps/web/public/assets/pages/. Anonymous outlined <path>s: no letter, no ligature, no word. This tool deliberately shows none of it — it reconciles encodings, not ink. Word boxes for this ayah ship in assets/words/hafs-kfqc/${DATA.pages[key]}.json.` }),
  ]));

  // ② the print's word text.
  const wordRows = words.map((w, i) => ({ i, w, span: f.spans[i] }));
  out.append(el("section", {}, [
    el("h3", { text: "② the print's word text — data-hafs, as the ligature corpus numbers it" }),
    table("words", [
      { id: "i", label: "print", get: (r) => r.i + 1, align: "r" },
      { id: "hafs", label: "data-hafs", get: (r) => r.w.hafs, cls: () => "ar" },
      { id: "cp", label: "codepoints", get: (r) => [...r.w.hafs].length, align: "r" },
      { id: "kind", label: "kind", get: (r) => (r.w.mark ? "pause mark" : r.w.waw ? "split waw" : "word") },
      { id: "span", label: "in the fold", get: (r) => (r.span ? r.span[0] : null), fmt: (r) => (r.span ? `[${r.span[0]}, ${r.span[1]})` : "— dropped") },
      { id: "qac", label: "QAC word", get: (r) => qacOf(entry, r.i + 1) ?? "", fmt: (r) => qacLabel(entry, r.i + 1) },
    ], wordRows, (r) => {
      const s = r.span;
      if (!s) return;
      state.annotation = annotations.findIndex((a) => a.start < s[1] && a.end > s[0]);
      render();
    }, { col: "i", dir: 1 }),
  ]));

  // ③ the QAC alignment.
  out.append(el("section", {}, [el("h3", { text: "③ the QAC word index — the committed print↔QAC map" }), alignPanel(entry)]));

  // ④ the ruler.
  const ruler = el("div", { class: "ruler" });
  for (let i = 0; i < cps.length; i += 1) ruler.append(cpCell(cps, i, hostAt, inSpan(i)));
  out.append(el("section", {}, [
    el("h3", { text: "④ Tanzil codepoint offsets — the fold, with a ruler" }),
    el("p", { class: "note", text: "The string below is not vendored anywhere. It is the print's words joined under the corrections toggled above; index 0 is tajweed offset 0. Tints mark word boundaries; ␣ is a space the fold inserted. Hover any cell for its Unicode name." }),
    ruler,
  ]));

  // the annotations, on that ruler.
  const annRows = annotations.map((a, i) => {
    const o = oracleOf(cps, a);
    const cls = touchClass(hosts, a.start, a.end, cps.length);
    const hit = touched(hosts, a.start, a.end);
    return { i, a, o, cls, hit };
  });
  out.append(el("section", {}, [
    el("h3", { text: "the annotations, and what each one lands on" }),
    table("ann", [
      { id: "rule", label: "rule", get: (r) => r.a.rule },
      { id: "span", label: "[start, end)", get: (r) => r.a.start, fmt: (r) => `[${r.a.start}, ${r.a.end})` },
      { id: "text", label: "what it covers", get: (r) => cps.slice(r.a.start, r.a.end).join(""), cls: () => "ar" },
      { id: "cls", label: "touches", get: (r) => r.cls },
      { id: "words", label: "print word(s)", get: (r) => r.hit.length, fmt: (r) => r.hit.map((h) => (hosts[h].print === null ? "basmala" : hosts[h].print)).join(", ") || "—" },
      { id: "oracle", label: "oracle", get: (r) => (r.o ? (r.o.hit ? 2 : 1) : 0), fmt: (r) => (!r.o ? "— no letter" : r.o.hit ? `✓ ${r.o.want}` : `✗ ${r.o.want}`), cls: (r) => (!r.o ? "muted" : r.o.hit ? "ok" : "bad") },
      { id: "delta", label: "delta", get: (r) => (r.o && !r.o.hit ? (r.o.delta ?? 99) : null), fmt: (r) => (!r.o || r.o.hit ? "" : r.o.delta === null ? `beyond ±${DRIFT_LIMIT}` : r.o.delta > 0 ? `+${r.o.delta}` : String(r.o.delta)) },
    ], annRows, (r) => {
      state.annotation = r.i;
      render();
    }, { col: "span", dir: 1 }),
  ]));

  // Where this ayah's drift began, if it has one. Shown next to the annotation
  // table rather than inside the diff, because it is a fact about the ayah and
  // not about whichever annotation happens to be selected.
  const onset = driftOnset(annRows.filter((r) => r.o).map((r) => ({ start: r.a.start, delta: r.o.delta ?? DRIFT_LIMIT + 1 })), hosts, cps);
  if (onset) {
    out.append(el("p", { class: "note" }, [
      el("b", { text: "drift onset: " }),
      el("span", { text: `the first miss is at ${onset.to} and ${onset.bounded ? `the last hit before it is at ${onset.from}` : "no annotation before it was a hit"}, so the divergence is somewhere in ` }),
      el("code", { class: "ar", text: onset.words.map((w) => w.text).join(" ") || "the codepoints between them" }),
      el("span", { text: ` — print word${onset.words.length === 1 ? "" : "s"} ${onset.words.map((w) => w.print).join(", ") || "—"}. Everything outside that window is cleared by a hit on either side.` }),
    ]));
  }

  if (state.annotation !== null && annotations[state.annotation]) {
    out.append(charDiff(cps, annRows[state.annotation]));
  } else {
    out.append(el("p", { class: "note", text: "Click an annotation row (or a print word) to light it up on the ruler and, at a miss, to open the character-level diff." }));
  }
  return out;
}

/** The character-level diff: the codepoints around the expected offset, named. */
function charDiff(cps, row) {
  const { a, o } = row;
  const box = el("section", { class: "diff" }, [el("h3", { text: `selected: ${a.rule} [${a.start}, ${a.end})` })]);
  if (!o) {
    box.append(el("p", { class: "note", text: `${a.rule} names no characteristic letter — sixteen of the eighteen source rules describe a manner of articulation, and no single codepoint witnesses one. This annotation is counted for paintability and cannot be checked for alignment.` }));
    return box;
  }
  box.append(el("p", {
    class: o.hit ? "verdict ok" : "verdict bad",
    text: o.hit
      ? `Oracle hit. Offset ${a.start} lands on ${nameOf(o.want)}, which is what ${a.rule} must start on.`
      : o.delta === null
        ? `Oracle miss. ${nameOf(o.want)} is not within ±${DRIFT_LIMIT} of offset ${a.start} in either direction — a different finding from a large drift.`
        : `Oracle miss by ${o.delta > 0 ? "+" : ""}${o.delta}. ${nameOf(o.want)} sits at ${a.start + o.delta}, so the fold ran ${o.delta > 0 ? "long" : "short"} by ${Math.abs(o.delta)} codepoint${Math.abs(o.delta) === 1 ? "" : "s"} before this letter.`,
  }));
  const win = nameWindow(cps, a.start, 5);
  box.append(el("table", { class: "grid names" }, [
    el("thead", {}, el("tr", {}, [el("th", { text: "at" }), el("th", { text: "" }), el("th", { text: "codepoint" }), el("th", { text: "" })])),
    el("tbody", {}, win.map((c) =>
      el("tr", { class: c.focus ? "focus" : o.delta !== null && c.at === a.start + o.delta ? "found" : "" }, [
        el("td", { class: "r", text: String(c.at) }),
        el("td", { class: "ar", text: c.ch === " " ? "␣" : c.ch }),
        el("td", { text: c.name }),
        el("td", { class: "muted", text: c.focus ? "← the offset says the letter is here" : o.delta !== null && c.at === a.start + o.delta ? "← it is actually here" : "" }),
      ]))),
  ]));
  if (!o.hit) {
    const shape = driftShape(cps, a.start, o.delta);
    box.append(el("p", { class: "note" }, [
      el("span", { text: "drift shape: " }),
      el("code", { class: "ar", text: shape }),
      el("span", { text: `  — ${[...shape].map(nameOf).join(" · ")}. ` }),
      el("a", { href: "#", onclick: (e) => { e.preventDefault(); state.view = "drift"; render(); }, text: "See every miss in the mus'haf with this shape →" }),
    ]));
  }
  return box;
}

// -------------------------------------------------------- the alignment view --

const qacOf = (entry, printIndex) => {
  if (!entry.q) return null;
  const lex = entry.w.map((_, i) => i + 1).filter((i) => entry.m[i - 1] !== "1");
  const at = lex.indexOf(printIndex);
  return at === -1 ? null : entry.q[at];
};
const qacLabel = (entry, printIndex) => {
  if (!entry.q) return entry.x ? "— no map" : "—";
  const q = qacOf(entry, printIndex);
  if (q === null) return "— pause mark";
  const span = entry.s?.[printIndex] ?? 1;
  return span > 1 ? `${q}–${q + span - 1}` : String(q);
};

function alignPanel(entry) {
  if (!entry.q) {
    return el("div", {}, [
      el("p", { class: "verdict bad", text: `No map: ${entry.x ?? "this ayah is not in the alignment"}` }),
      el("p", { class: "note", text: "Both indices remain valid here; what is absent is the relation between them. All four exceptions are orthographic — the two corpora spell one word differently, so no partition of equal strings exists. word-indexing.md ③ says why they are named rather than folded away." }),
    ]);
  }
  const lex = entry.w.map((_, i) => i + 1).filter((i) => entry.m[i - 1] !== "1");
  const rows = [];
  for (let q = 1; q <= (entry.k?.length ?? 0); q += 1) {
    const prints = lex.filter((p, i) => {
      const span = entry.s?.[p] ?? 1;
      return q >= entry.q[i] && q < entry.q[i] + span;
    });
    const shape = prints.length === 2 ? "2→1  the print split at the rasm" : prints.length > 2 ? `${prints.length}→1` : (entry.s?.[prints[0]] ?? 1) > 1 ? "1→2  one print word, two QAC words" : "1→1";
    rows.push({ q, prints, shape, skeleton: entry.k[q - 1] ?? "" });
  }
  return el("div", {}, [
    table("align", [
      { id: "q", label: "QAC", get: (r) => r.q, align: "r" },
      { id: "sk", label: "folded skeleton", get: (r) => r.skeleton, fmt: (r) => r.skeleton || "—" },
      { id: "p", label: "print word(s)", get: (r) => r.prints.join(", ") },
      { id: "ar", label: "data-hafs", get: (r) => r.prints.map((p) => entry.w[p - 1]).join(" "), cls: () => "ar" },
      { id: "shape", label: "shape", get: (r) => r.shape },
    ], rows, null, { col: "q", dir: 1 }),
    el("p", { class: "note", text: "The skeleton is what the aligner actually partitions on — both corpora reduced to consonants with hamza seats folded to alif. A 2→1 row is two print words whose skeletons concatenate to one QAC word's; that is the whole content of the map." }),
  ]);
}

// -------------------------------------------------------------- other views --

function viewAggregates() {
  const t = M.totals;
  const out = el("div", {});
  out.append(el("section", {}, [
    el("h3", { text: "the headline, under the toggles as they stand" }),
    el("div", { class: "tiles" }, [
      tile("oracle on the expected letter", `${pct(t.oracleHit, t.oracleN)}`, `${num(t.oracleHit)} / ${num(t.oracleN)}`),
      tile("inside one print word", pct(t.one, t.annotations), num(t.one)),
      tile("two adjacent print words", pct(t.twoAdjacent, t.annotations), num(t.twoAdjacent)),
      tile("wider than two", pct(t.wider, t.annotations), num(t.wider)),
      tile("past the end of the text", String(t.pastEnd), "annotations"),
      tile("ayahs carrying a miss", String(M.residual.length), `of ${num(KEYS.length)}`),
    ]),
  ]));

  out.append(el("section", {}, [
    el("h3", { text: "by rule — all eighteen the source emits" }),
    el("p", { class: "note", text: "Rules, not the seven families build-tajweed.mjs paints in: a family is a rendering decision and this tool is about encodings. Only two rules carry an oracle obligation; the rest inherit its verdict." }),
    table("byRule", [
      { id: "rule", label: "rule", get: (r) => r.rule },
      { id: "n", label: "annotations", get: (r) => r.n, fmt: (r) => num(r.n), align: "r" },
      { id: "one", label: "one word", get: (r) => r.one / r.n, fmt: (r) => pct(r.one, r.n), align: "r" },
      { id: "two", label: "two adjacent", get: (r) => r.twoAdjacent / r.n, fmt: (r) => pct(r.twoAdjacent, r.n), align: "r" },
      { id: "wider", label: "wider", get: (r) => r.wider, align: "r" },
      { id: "past", label: "past end", get: (r) => r.pastEnd, align: "r" },
      { id: "oracle", label: "oracle", get: (r) => (r.oracleN ? r.oracleHit / r.oracleN : null), fmt: (r) => (r.oracleN ? `${pct(r.oracleHit, r.oracleN)}  (${num(r.oracleN)})` : "— no letter"), align: "r" },
    ], M.perRule, (r) => drill(`ayahs carrying ${r.rule}`, M.bucket.get(`rule:${r.rule}`) ?? [])),
  ]));

  out.append(el("section", {}, [
    el("h3", { text: "by surah" }),
    table("bySurah", [
      { id: "n", label: "#", get: (r) => r.surah, align: "r" },
      { id: "name", label: "surah", get: (r) => DATA.surahs[r.surah - 1].ename },
      { id: "ayahs", label: "ayahs", get: (r) => r.ayahs, align: "r" },
      { id: "ann", label: "annotations", get: (r) => r.annotations, fmt: (r) => num(r.annotations), align: "r" },
      { id: "oracle", label: "oracle", get: (r) => (r.oracleN ? r.oracleHit / r.oracleN : null), fmt: (r) => pct(r.oracleHit, r.oracleN), align: "r" },
      { id: "miss", label: "ayahs with a miss", get: (r) => r.missAyahs, align: "r" },
    ], M.perSurah, (r) => drill(`surah ${r.surah} — ${DATA.surahs[r.surah - 1].ename}`, M.bucket.get(`surah:${r.surah}`) ?? []), { col: "n", dir: 1 }),
  ]));

  const missTotal = M.totals.oracleN - M.totals.oracleHit;
  out.append(el("section", {}, [
    el("h3", { text: "by signed delta — how far the letter is from where the offsets put it" }),
    el("p", { class: "note", text: "Positive means the fold ran long: the reconstruction carries codepoints the offsets do not count. Negative means it ran short. A histogram that clusters and decays is the signature of one repeated insertion — that is how correction 3 was found." }),
    table("byDelta", [
      { id: "d", label: "delta", get: (r) => r[0] ?? 99, fmt: (r) => (r[0] === null ? `beyond ±${DRIFT_LIMIT}` : r[0] > 0 ? `+${r[0]}` : String(r[0])) },
      { id: "n", label: "misses", get: (r) => r[1], fmt: (r) => num(r[1]), align: "r" },
      { id: "share", label: "of all misses", get: (r) => r[1] / missTotal, fmt: (r) => pct(r[1], missTotal), align: "r" },
      { id: "bar", label: "", get: (r) => r[1], fmt: (r) => "█".repeat(Math.max(1, Math.round((30 * r[1]) / Math.max(1, missTotal)))) },
    ], M.deltas, (r) => drill(`ayahs with a miss at delta ${r[0] ?? "beyond"}`, M.bucket.get(`delta:${r[0]}`) ?? []), { col: "d", dir: 1 }),
  ]));

  out.append(el("section", {}, [
    el("h3", { text: "by residual class" }),
    table("byResidual", [
      { id: "cls", label: "class", get: (r) => r.label },
      { id: "n", label: "ayahs", get: (r) => r.n, align: "r" },
      { id: "why", label: "what it means", get: (r) => r.why },
    ], [
      { label: "one constant drift", n: (M.bucket.get("residual:constant") ?? new Set()).size, why: "every miss in the ayah is the same distance — one spelling difference, orthographic", id: "residual:constant" },
      { label: "mixed drifts", n: (M.bucket.get("residual:mixed") ?? new Set()).size, why: "two or more distances in one ayah — more than one divergence, or a structural one", id: "residual:mixed" },
    ], (r) => drill(r.label, M.bucket.get(r.id) ?? [])),
  ]));

  out.append(el("section", {}, [
    el("h3", { text: "by how many print words a span touches" }),
    table("byTouch", [
      { id: "cls", label: "class", get: (r) => r.label },
      { id: "n", label: "annotations", get: (r) => r.n, fmt: (r) => num(r.n), align: "r" },
      { id: "share", label: "share", get: (r) => r.n / t.annotations, fmt: (r) => pct(r.n, t.annotations), align: "r" },
      { id: "why", label: "", get: (r) => r.why },
    ], [
      { id: "one", label: "one word", n: t.one, why: "paintable as one box" },
      { id: "two-adjacent", label: "two adjacent words", n: t.twoAdjacent, why: "cross-word phonology — idghaam, ikhfa, iqlab — painting correctly across two boxes" },
      { id: "wider", label: "wider than two", n: t.wider, why: "more boxes than any of these rules should need" },
      { id: "past-end", label: "past the end", n: t.pastEnd, why: "the offsets run off the end of the reconstruction" },
    ], (r) => drill(`ayahs with a ${r.label} span`, M.bucket.get(`touch:${r.id}`) ?? [])),
  ]));
  return out;
}

const tile = (label, big, small) =>
  el("div", { class: "tile" }, [el("b", { text: big }), el("span", { text: label }), el("i", { text: small })]);

function viewDrift() {
  const out = el("div", {});
  out.append(el("section", {}, [
    el("h3", { text: "where the drift begins — the words between the last hit and the first miss" }),
    el("p", { class: "note", text: "The offsets are cumulative, so one divergent codepoint pushes every later annotation in its ayah by the same amount, and the residual bears that out — almost every affected ayah carries exactly one delta throughout, whatever the correction set. So a miss says the drift exists and the last hit before it says where. Everything in between is suspect; everything outside is cleared. A word standing in dozens of those windows is not a coincidence, it is the correction: this is the table the four orthographic corrections were read off, and switching one off is how to watch it name that correction again." }),
    table("onsets", [
      { id: "text", label: "print word in the window", get: (r) => r.text, cls: () => "ar big" },
      { id: "cps", label: "codepoints", get: (r) => [...r.text].map(nameOf).join(" · ") },
      { id: "ayahs", label: "residual ayahs", get: (r) => r.ayahs, align: "r" },
      { id: "corpus", label: "ayahs it is in", get: (r) => WORD_AYAHS.get(r.text) ?? 0, fmt: (r) => num(WORD_AYAHS.get(r.text) ?? 0), align: "r" },
      { id: "share", label: "implicated", get: (r) => r.ayahs / (WORD_AYAHS.get(r.text) || 1), fmt: (r) => pct(r.ayahs, WORD_AYAHS.get(r.text) ?? 0), align: "r" },
      { id: "bounded", label: "bounded", get: (r) => r.bounded, fmt: (r) => `${r.bounded}/${r.ayahs}`, align: "r" },
      { id: "deltas", label: "delta(s)", get: (r) => [...r.deltas][0] ?? 0, fmt: (r) => [...r.deltas].sort((a, b) => (a ?? 99) - (b ?? 99)).map((d) => (d === null ? "∅" : d > 0 ? `+${d}` : d)).join(", ") },
    ], M.onsets, (r) => drill(`residual ayahs bracketing “${r.text}”`, r.keys), { col: "ayahs", dir: -1 }),
    el("p", { class: "note", text: "Sort by “implicated” — it is the column that separates a cause from a coincidence. A word standing in 95 windows out of the 4,000 ayahs it appears in is background; a word standing in 41 out of 44 is the answer. “bounded” is how many windows had a hit to their left: an unbounded one starts at offset 0 and only means “somewhere before the first miss”, so a word that is never bounded is weaker evidence than its count suggests." }),
  ]));

  out.append(el("h3", { text: "drift shapes — the codepoints under the miss itself" }));
  out.append(el("p", { class: "note", text: "The other cut, and the narrower one: at +d, the codepoints in [start, start+d) that the reconstruction carries and the offsets do not; at −d, the print's own spelling around the letter, since what is missing is in a text this repo does not hold. This explains a divergence adjacent to the annotation and nothing else — for a drift that began upstream these codepoints are just wherever the reader was standing when the bill came due, which is why the table above exists." }));
  out.append(table("shapes", [
    { id: "shape", label: "shape", get: (r) => r.shape, cls: () => "ar big" },
    { id: "names", label: "codepoints", get: (r) => [...r.shape].map(nameOf).join(" · ") },
    { id: "n", label: "misses", get: (r) => r.n, fmt: (r) => num(r.n), align: "r" },
    { id: "ayahs", label: "ayahs", get: (r) => r.keys.size, align: "r" },
    { id: "deltas", label: "delta(s)", get: (r) => [...r.deltas][0] ?? 0, fmt: (r) => [...r.deltas].sort((a, b) => (a ?? 99) - (b ?? 99)).map((d) => (d === null ? "∅" : d > 0 ? `+${d}` : d)).join(", ") },
    { id: "rules", label: "rule(s)", get: (r) => [...r.rules].join(", ") },
  ], M.shapes, (r) => drill(`misses shaped “${r.shape}”`, r.keys), { col: "n", dir: -1 }));
  return out;
}

function viewAlign() {
  const out = el("div", {});
  const shapes = { "1→1": 0, "2→1": 0, "1→2": 0 };
  const buckets = { "1→1": new Set(), "2→1": new Set(), "1→2": new Set() };
  let mapped = 0;
  let printWords = 0;
  let qacWords = 0;
  for (const key of KEYS) {
    const e = DATA.ayahs[key];
    if (!e.q) continue;
    mapped += 1;
    printWords += e.q.length;
    qacWords += e.k?.length ?? 0;
    const counts = new Map();
    e.q.forEach((q, i) => {
      const p = e.w.map((_, j) => j + 1).filter((j) => e.m[j - 1] !== "1")[i];
      counts.set(q, (counts.get(q) ?? 0) + 1);
      if ((e.s?.[p] ?? 1) > 1) {
        shapes["1→2"] += 1;
        buckets["1→2"].add(key);
      }
    });
    for (const [, n] of counts) {
      if (n === 1) shapes["1→1"] += 1;
      else {
        shapes["2→1"] += 1;
        buckets["2→1"].add(key);
      }
    }
    buckets["1→1"].add(key);
  }
  // A 1→2 block is also counted as 1→1 by the run above; take it back out.
  shapes["1→1"] -= shapes["1→2"];

  out.append(el("section", {}, [
    el("h3", { text: "the print↔QAC map, over the whole mus'haf" }),
    el("div", { class: "tiles" }, [
      tile("ayahs mapped", num(mapped), `of ${num(KEYS.length)}`),
      tile("lexical print words", num(printWords), "pause marks are not in the map"),
      tile("QAC words", num(qacWords), ""),
      tile("1→1 blocks", num(shapes["1→1"]), "the ordinary case"),
      tile("2→1 blocks", num(shapes["2→1"]), "the print split at the rasm"),
      tile("1→2 blocks", num(shapes["1→2"]), "15:7, and only 15:7"),
    ]),
    el("p", { class: "note", text: "No shape other than these three occurs. The two indices are monotone — they never cross, they only group differently — which is what makes a block alignment possible at all rather than an edit-distance score with a threshold somebody has to tune." }),
  ]));

  out.append(el("section", {}, [
    el("h3", { text: "the four ayahs no alignment reaches" }),
    table("exc", [
      { id: "key", label: "ayah", get: (r) => r.key },
      { id: "why", label: "why", get: (r) => r.why },
    ], Object.entries(DATA.exceptions).map(([key, why]) => ({ key, why })), (r) => goto(r.key), { col: "key", dir: 1 }),
    el("p", { class: "note", text: "All four are orthographic, not segmentational: the two corpora spell the word differently, so no partition of equal strings exists because the strings are not equal. Three of them are one word appearing three times." }),
  ]));

  out.append(el("section", {}, [
    el("h3", { text: "browse" }),
    el("p", {}, [
      el("a", { href: "#", onclick: (e) => { e.preventDefault(); drill("ayahs with a 2→1 block", buckets["2→1"]); }, text: `ayahs where the print split a word (${buckets["2→1"].size}) →` }),
    ]),
    el("p", {}, [
      el("a", { href: "#", onclick: (e) => { e.preventDefault(); drill("ayahs with a 1→2 block", buckets["1→2"]); }, text: `ayahs where one print word covers two QAC words (${buckets["1→2"].size}) →` }),
    ]),
  ]));
  return out;
}

function viewList() {
  const f = state.filter;
  if (!f) return el("p", { class: "empty", text: "Nothing selected. Pick a row in Aggregates." });
  const rows = f.keys.map((key) => {
    const r = M.residual.find((x) => x.key === key);
    return { key, surah: Number(key.split(":")[0]), words: DATA.ayahs[key].w.length, ann: (DATA.ayahs[key].a ?? []).length, misses: r?.misses ?? 0, deltas: r ? r.deltas.join(", ") : "" };
  });
  return el("div", {}, [
    el("h3", { text: `${f.label} — ${num(f.keys.length)} ayah${f.keys.length === 1 ? "" : "s"}` }),
    table("list", [
      { id: "key", label: "ayah", get: (r) => ORDER.get(r.key) },
      { id: "surah", label: "surah", get: (r) => DATA.surahs[r.surah - 1].ename },
      { id: "words", label: "print words", get: (r) => r.words, align: "r" },
      { id: "ann", label: "annotations", get: (r) => r.ann, align: "r" },
      { id: "misses", label: "oracle misses", get: (r) => r.misses, align: "r" },
      { id: "deltas", label: "delta(s)", get: (r) => r.deltas },
    ].map((c) => (c.id === "key" ? { ...c, fmt: (r) => r.key } : c)), rows, (r) => goto(r.key), { col: "key", dir: 1 }),
  ]);
}

function viewAbout() {
  const d = DATA.meta;
  return el("div", {}, [
    el("section", {}, [
      el("h3", { text: "what this report is of" }),
      el("dl", { class: "kv" }, [
        el("dt", { text: "generated" }), el("dd", { text: d.generated }),
        el("dt", { text: "ligature corpus" }), el("dd", { text: `${d.pin.repo} @ ${d.pin.commit}` }),
        el("dt", { text: "tajweed source" }), el("dd", { text: `${d.tajweedFile} · sha256 ${d.tajweedSha}` }),
        el("dt", { text: "alignment pin" }), el("dd", { text: d.alignmentMethod }),
        el("dt", { text: "read" }), el("dd", { text: `${num(d.ayahs)} ayahs · ${num(d.words)} print words · ${num(d.annotations)} annotations · ${d.megabytes} MB of print SVG` }),
      ]),
      el("p", { class: "note", text: "Everything above is a pin. If any of them moved, this report is of a corpus that no longer exists — regenerate rather than argue with it." }),
    ]),
    el("section", {}, [
      el("h3", { text: "what it is blind to" }),
      el("ul", {}, [
        el("li", { text: "Whether the colours are right. This is geometry and identity only; the palette waits on a hafiz." }),
        el("li", { text: "Sixteen of the eighteen rules. Only hamzat_wasl and lam_shamsiyyah name a letter, so only they can witness alignment; everything else inherits their verdict." }),
        el("li", { text: "Tanzil's own tokenisation. The reconstruction is OF the print, so “two words” here always means two print boxes and never a claim about Tanzil." }),
        el("li", { text: "The ink. No glyphs, no boxes, no geometry — the page artwork is named and never drawn." }),
        el("li", { text: "QAC segment granularity. A print word maps to a QAC word; PREFIX/STEM/SUFFIX is not in the map." }),
        el("li", { text: "Any other print or any other edition of QAC. Both are pinned, and a different pin is a new measurement rather than an upgrade." }),
      ]),
    ]),
    el("section", {}, [
      el("h3", { text: "the corrections, and the evidence each was earned by" }),
      el("dl", { class: "kv" }, CORRECTIONS.flatMap((c) => [
        el("dt", { text: c.id }),
        el("dd", {}, [el("b", { text: c.title }), el("p", { text: c.what }), el("p", { class: "note", text: c.evidence })]),
      ])),
    ]),
  ]);
}

// -------------------------------------------------------------------- shell --

function toggles() {
  const box = el("div", { class: "toggles" });
  for (const c of CORRECTIONS) {
    const id = `t-${c.id}`;
    box.append(el("label", { for: id, title: `${c.what}\n\n${c.evidence}` }, [
      el("input", {
        type: "checkbox", id, checked: state.on.has(c.id) ? "checked" : null,
        onchange: (e) => {
          if (e.target.checked) state.on.add(c.id);
          else state.on.delete(c.id);
          M = null;
          render();
        },
      }),
      el("span", { text: c.title }),
    ]));
  }
  box.append(el("span", { class: "spacer" }));
  box.append(el("span", { class: "ms", text: M ? `recomputed in ${M.ms.toFixed(0)} ms` : "" }));
  return box;
}

function nav() {
  const tabs = [["ayah", "Ayah"], ["aggregates", "Aggregates"], ["drift", "Drift shapes"], ["align", "Print ↔ QAC"], ["list", state.filter ? `List · ${state.filter.label}` : "List"], ["about", "About"]];
  const box = el("nav", {});
  for (const [id, label] of tabs) {
    box.append(el("button", {
      class: state.view === id ? "on" : "", text: label,
      onclick: () => { state.view = id; render(); },
    }));
  }
  const picker = el("span", { class: "picker" });
  const input = el("input", { type: "text", value: state.key, size: 8, "aria-label": "ayah" });
  const go = () => {
    const v = input.value.trim();
    if (DATA.ayahs[v]) goto(v);
    else input.classList.add("bad");
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  input.addEventListener("input", () => input.classList.remove("bad"));
  const step = (d) => {
    const i = ORDER.get(state.key);
    if (i === undefined) return;
    goto(KEYS[Math.min(KEYS.length - 1, Math.max(0, i + d))]);
  };
  picker.append(el("button", { text: "‹", onclick: () => step(-1), title: "previous ayah" }), input,
    el("button", { text: "›", onclick: () => step(1), title: "next ayah" }),
    el("button", { text: "go", onclick: go }));
  box.append(picker);
  return box;
}

function render() {
  if (!M) M = measure();
  const root = $("#app");
  root.replaceChildren();
  root.append(el("header", {}, [
    el("h1", { text: "Hifth — encoding inspector" }),
    el("p", { class: "sub", text: "four descriptions of one text, and where they disagree" }),
    toggles(),
    nav(),
  ]));
  const body = el("main", {});
  body.append(
    state.view === "ayah" ? viewAyah()
      : state.view === "aggregates" ? viewAggregates()
        : state.view === "drift" ? viewDrift()
          : state.view === "align" ? viewAlign()
            : state.view === "list" ? viewList()
              : viewAbout(),
  );
  root.append(body);
  const hash = state.view === "ayah" ? `#${state.key}` : `#${state.view}`;
  if (location.hash !== hash) history.replaceState(null, "", hash);
}

/**
 * The hash is the only address this report has, and it has to work in both
 * directions — a deep link pasted into a bug report opens on the ayah, and an
 * ayah typed into the address bar of an already-open report goes there. The
 * second half is the one that is easy to forget, and forgetting it makes the
 * URL look like an address while behaving like a decoration.
 */
function fromHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (DATA.ayahs[h]) {
    state.key = h;
    state.view = "ayah";
    state.annotation = null;
  } else if (["aggregates", "drift", "align", "list", "about"].includes(h)) {
    state.view = h;
  }
}
addEventListener("hashchange", () => {
  fromHash();
  render();
});
fromHash();
render();
