import { useEffect, useMemo, useState } from "react";

/*
 * The dev diff view — the second draughtsman from `qul-store-purpose`.
 *
 * Left: the print the app ships for this page (the outlined SVG, exactly what a
 * reader sees). Right: the same page drawn from the held store — which verse, and
 * which run of words, sits on each of the fifteen lines, with a medallion wherever
 * an ayah ends on the page. Stand the two together and the registration question
 * answers itself by eye: does the right verse land on the right line, does a break
 * fall where it should.
 *
 * WHY NO ARABIC HERE. Two reasons, one line. (1) The store's word text is a
 * font-private, one-codepoint-per-word encoding that only the QPC V4 font draws as
 * words; without that font it renders as the wrong glyph, so a faithful letter-render
 * waits on the font (docs/issues/qul-diff-render-needs-font.md). (2) This file is
 * checked in, and the repo ships no Qur'an text — gate:scripture would refuse a
 * single Arabic codepoint in this source. So the render is structural: verse numbers,
 * word counts, ayah boundaries. It answers the registration question without a glyph.
 */

type Word = {
  word_id: number;
  surah: number;
  ayah: number;
  position: number;
  text: string;
};

type Line = {
  line_number: number;
  line_type: string;
  is_centered: boolean;
  surah_number: number | null;
  first_word_id: number | null;
  last_word_id: number | null;
  words: Word[];
};

type Fixture = { page: number; lines: Line[] };

type Load =
  | { state: "loading" }
  | { state: "absent"; page: number }
  | { state: "error"; message: string }
  | { state: "ok"; fixture: Fixture };

const PAGE_MIN = 1;
const PAGE_MAX = 604;
const EDITION = "hafs-kfqc";

/*
 * The print's own word-shape font, dev-served from the ETL's gitignored cache (see
 * `qulFixturesDev` in vite.config.ts). It is ONE FILE PER PAGE: page N's words are the
 * code points FC41, FC42, … and only `pN.ttf` maps them to N's words — the same code point
 * is a different word in every other page's file, and a general Arabic font shows it as
 * an unrelated ligature. So the face is declared per page, under a family name that carries
 * the page number, and the declaration changes with the page. The family name is ours; the
 * file is the library's (QUL resource 240). Neither this file nor the CSS below carries a
 * single Arabic letter: the letters arrive at run time, in dev, and nowhere else.
 */
const fontFamily = (page: number) => `Hifth QUL Dev V4 p${page}`;
const fontCss = (page: number) =>
  `@font-face{font-family:"${fontFamily(page)}";src:url("/dev-fixtures/fonts/p${page}.ttf") format("truetype");font-display:block;}`;

function clampPage(n: number): number {
  if (!Number.isFinite(n)) return PAGE_MIN;
  return Math.min(PAGE_MAX, Math.max(PAGE_MIN, Math.round(n)));
}

function pageFromUrl(): number {
  const p = new URLSearchParams(window.location.search).get("page");
  return clampPage(parseInt(p ?? "", 10) || PAGE_MIN);
}

/** The structural label beside each run of words: "surah:ayah", digits only. */
function verseLabel(w: Word): string {
  return `${w.surah}:${w.ayah}`;
}

/**
 * Which words end their ayah *on this page* — the landmark a reader sees as an ayah
 * medallion. A boundary is a transition to a different ayah in the page's own word
 * order; the page's final word is left unmarked, because whether its ayah ends here
 * or runs onto the next page is not knowable from this page alone.
 */
function ayahEndIds(lines: Line[]): Set<number> {
  const flat: Word[] = [];
  for (const l of lines) for (const w of l.words) flat.push(w);
  flat.sort((a, b) => a.word_id - b.word_id);
  const ends = new Set<number>();
  for (let i = 0; i < flat.length - 1; i++) {
    const a = flat[i];
    const b = flat[i + 1];
    if (!a || !b) continue;
    if (a.surah !== b.surah || a.ayah !== b.ayah) ends.add(a.word_id);
  }
  return ends;
}

/** A line's words grouped into contiguous same-ayah runs, in reading order. */
function ayahGroups(words: Word[]): { key: string; words: Word[] }[] {
  const groups: { key: string; words: Word[] }[] = [];
  for (const w of words) {
    const key = verseLabel(w);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.words.push(w);
    else groups.push({ key, words: [w] });
  }
  return groups;
}

export function QulDiff() {
  const [page, setPage] = useState<number>(pageFromUrl);
  const [load, setLoad] = useState<Load>({ state: "loading" });

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("page", String(page));
    window.history.replaceState(null, "", url);

    let live = true;
    setLoad({ state: "loading" });
    fetch(`/dev-fixtures/qul-page-${page}.json`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json();
        if (!live) return;
        if (body && body.error === "fixture-absent") {
          setLoad({ state: "absent", page });
          return;
        }
        if (!r.ok) {
          setLoad({ state: "error", message: `HTTP ${r.status}` });
          return;
        }
        setLoad({ state: "ok", fixture: body as Fixture });
      })
      .catch((e) => {
        if (live) setLoad({ state: "error", message: String(e) });
      });
    return () => {
      live = false;
    };
  }, [page]);

  return (
    <div style={S.app}>
      <style>{fontCss(page)}</style>
      <Header page={page} onPage={(n) => setPage(clampPage(n))} />
      <main style={S.split}>
        <section style={S.pane}>
          <h2 style={S.paneTitle}>
            Shipped print <span style={S.paneSub}>edition {EDITION}</span>
          </h2>
          <div style={S.printWrap}>
            <img
              key={page}
              src={`/assets/pages/${EDITION}/${page}.svg`}
              alt={`Print page ${page}`}
              style={S.printImg}
            />
          </div>
        </section>
        <section style={S.pane}>
          <h2 style={S.paneTitle}>
            Store page <span style={S.paneSub}>held copy · QPC V4 words · library font</span>
          </h2>
          <StorePane load={load} page={page} />
        </section>
      </main>
      <footer style={S.foot}>
        Each line is drawn twice: the store's words in the print's own per-page font (the
        library's tajweed-coloured pack — the colour is the library's, not a finding — served
        in dev from a gitignored cache, never from the tree or the shipped bundle), and under
        them the structure — the verse and word run on the line, and a medallion where an
        ayah ends. Compare line for line against the print on the left; a word on the wrong
        line, or an ayah ending on the wrong line, is a registration finding.
        Background: docs/issues/qul-diff-render-needs-font.md.
      </footer>
    </div>
  );
}

function Header({ page, onPage }: { page: number; onPage: (n: number) => void }) {
  return (
    <header style={S.header}>
      <div>
        <div style={S.h1}>QUL page diff</div>
        <div style={S.tagline}>
          The store as second draughtsman — print beside our own drawing, to check the
          page is registered right.
        </div>
      </div>
      <div style={S.nav}>
        <button
          type="button"
          style={S.btn}
          onClick={() => onPage(page - 1)}
          disabled={page <= PAGE_MIN}
        >
          ‹ prev
        </button>
        <label style={S.pageLabel}>
          page
          <input
            type="number"
            min={PAGE_MIN}
            max={PAGE_MAX}
            value={page}
            onChange={(e) => onPage(parseInt(e.target.value, 10))}
            style={S.pageInput}
          />
          <span style={S.pageMax}>/ {PAGE_MAX}</span>
        </label>
        <button
          type="button"
          style={S.btn}
          onClick={() => onPage(page + 1)}
          disabled={page >= PAGE_MAX}
        >
          next ›
        </button>
      </div>
    </header>
  );
}

function StorePane({ load, page }: { load: Load; page: number }) {
  if (load.state === "loading") return <div style={S.msg}>Reading the store…</div>;
  if (load.state === "error")
    return <div style={S.msg}>Could not read the fixture: {load.message}</div>;
  if (load.state === "absent") return <Absent page={page} />;

  const { lines } = load.fixture;
  const ordered = [...lines].sort((a, b) => a.line_number - b.line_number);
  return <StoreLines lines={ordered} page={page} />;
}

function StoreLines({ lines, page }: { lines: Line[]; page: number }) {
  const ends = useMemo(() => ayahEndIds(lines), [lines]);

  const ayahWords = lines.flatMap((l) => (l.line_type === "ayah" ? l.words : []));
  const first = ayahWords[0];
  const last = ayahWords[ayahWords.length - 1];
  const range =
    first && last
      ? first.surah === last.surah && first.ayah === last.ayah
        ? verseLabel(first)
        : `${verseLabel(first)} … ${verseLabel(last)}`
      : "—";

  return (
    <div>
      <div style={S.summary}>
        <span>
          <strong>{lines.length}</strong> lines
        </span>
        <span>
          <strong>{ayahWords.length}</strong> words
        </span>
        <span>
          verses <strong dir="ltr">{range}</strong>
        </span>
      </div>
      <ol style={S.lines}>
        {lines.map((l) => (
          <StoreLine key={l.line_number} line={l} ends={ends} page={page} />
        ))}
      </ol>
    </div>
  );
}

function StoreLine({ line, ends, page }: { line: Line; ends: Set<number>; page: number }) {
  const centered = line.is_centered || line.line_type !== "ayah";
  const rowStyle: React.CSSProperties = {
    ...S.line,
    justifyContent: centered ? "center" : "flex-start",
  };

  let content: React.ReactNode;
  let glyphs: React.ReactNode = null;
  if (line.line_type === "ayah") {
    // One private code point per printed word, so the join is the whole layout step:
    // the font supplies the shapes, the space the only spacing. Full-measure lines are
    // justified as the print's are; a centred line (a surah's last, short line) is not.
    glyphs = (
      <span
        style={{
          ...S.glyphs,
          fontFamily: `"${fontFamily(page)}", serif`,
          textAlign: centered ? "center" : "justify",
          textAlignLast: centered ? "center" : "justify",
        }}
        dir="rtl"
        lang="ar"
      >
        {line.words.map((w) => w.text).join(" ")}
      </span>
    );
    const groups = ayahGroups(line.words);
    content = groups.map((g, i) => {
      const firstWord = g.words[0];
      const lastWord = g.words[g.words.length - 1];
      if (!firstWord || !lastWord) return null;
      const endsHere = ends.has(lastWord.word_id);
      const ayahNo = firstWord.ayah;
      return (
        <span key={i} style={S.group}>
          <span style={S.groupVerse} dir="ltr">
            {g.key}
          </span>
          <span style={S.groupCount}>×{g.words.length}</span>
          {endsHere && (
            <span style={S.medallion} title={`ayah ${ayahNo} ends here`}>
              {ayahNo}
            </span>
          )}
        </span>
      );
    });
  } else {
    // a surah-name header or the basmala band — not an ayah line
    const label =
      line.surah_number != null
        ? `Sūrah ${line.surah_number}`
        : line.line_type.replace(/_/g, " ");
    content = <span style={S.band}>{label}</span>;
  }

  return (
    <li style={S.lineRow}>
      <span style={S.gutter}>
        <span style={S.lineNo}>{line.line_number}</span>
        <span style={S.lineType}>{line.line_type}</span>
      </span>
      <span style={S.lineBody}>
        {glyphs}
        <span style={rowStyle} dir="rtl">
          {content}
        </span>
      </span>
    </li>
  );
}

function Absent({ page }: { page: number }) {
  return (
    <div style={S.absent}>
      <p style={{ margin: "0 0 8px" }}>
        No fixture for page {page} yet. Pull it out of the store (dev only, gitignored;
        the credential comes from dotenvx and is never typed):
      </p>
      <pre style={S.pre}>
        dotenvx run -- node packages/etl/scripts/qul-page-fixture.mjs --page {page}
      </pre>
      <p style={{ margin: "8px 0 0", opacity: 0.7 }}>
        Then reload. The word text lands only in the dev fixture, never in the tree or
        the shipped bundle.
      </p>
    </div>
  );
}

const INK = "#2a2622";
const PAPER = "#f6f2ea";
const CARD = "#fffdf8";
const EDGE = "#e6dfd1";
const ACCENT = "#7a5a2f";

const S: Record<string, React.CSSProperties> = {
  app: {
    minHeight: "100vh",
    background: PAPER,
    color: INK,
    font: "14px/1.5 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 24,
    flexWrap: "wrap",
    padding: "16px 24px",
    borderBottom: `1px solid ${EDGE}`,
    background: CARD,
  },
  h1: { fontSize: 18, fontWeight: 700, letterSpacing: 0.2 },
  tagline: { maxWidth: 520, opacity: 0.7, marginTop: 2 },
  nav: { display: "flex", alignItems: "center", gap: 8 },
  btn: {
    font: "inherit",
    padding: "6px 12px",
    border: `1px solid ${EDGE}`,
    borderRadius: 6,
    background: PAPER,
    color: INK,
    cursor: "pointer",
  },
  pageLabel: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 },
  pageInput: {
    font: "inherit",
    width: 64,
    padding: "5px 8px",
    border: `1px solid ${EDGE}`,
    borderRadius: 6,
    textAlign: "center",
  },
  pageMax: { opacity: 0.6 },
  split: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)",
    gap: 20,
    padding: 24,
    alignItems: "start",
  },
  pane: {
    background: CARD,
    border: `1px solid ${EDGE}`,
    borderRadius: 10,
    padding: 16,
  },
  paneTitle: { margin: "0 0 12px", fontSize: 14, fontWeight: 700 },
  paneSub: { fontWeight: 400, opacity: 0.55, marginInlineStart: 8, fontSize: 12 },
  printWrap: {
    display: "flex",
    justifyContent: "center",
    background: "#fff",
    border: `1px solid ${EDGE}`,
    borderRadius: 8,
    padding: 12,
  },
  printImg: { width: "100%", maxWidth: 440, height: "auto", display: "block" },
  summary: {
    display: "flex",
    gap: 18,
    padding: "8px 10px",
    marginBottom: 10,
    background: PAPER,
    border: `1px solid ${EDGE}`,
    borderRadius: 8,
    fontSize: 13,
  },
  lines: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 },
  lineRow: {
    display: "grid",
    gridTemplateColumns: "56px 1fr",
    gap: 10,
    alignItems: "start",
    minHeight: 34,
    padding: "3px 6px",
    borderRadius: 6,
    background: PAPER,
  },
  gutter: { display: "flex", flexDirection: "column", lineHeight: 1.1, paddingTop: 6 },
  lineBody: { display: "grid", gap: 2, minWidth: 0 },
  glyphs: {
    display: "block",
    fontSize: 27,
    lineHeight: 1.75,
    color: INK,
    whiteSpace: "nowrap",
    overflow: "hidden",
  },
  lineNo: { fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  lineType: { fontSize: 10, opacity: 0.5, textTransform: "uppercase", letterSpacing: 0.3 },
  line: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },
  group: { display: "inline-flex", alignItems: "center", gap: 4 },
  groupVerse: {
    fontVariantNumeric: "tabular-nums",
    fontWeight: 600,
    color: ACCENT,
    fontSize: 13,
  },
  groupCount: { fontSize: 11, opacity: 0.55 },
  medallion: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 20,
    height: 20,
    padding: "0 4px",
    borderRadius: 999,
    border: `1.5px solid ${ACCENT}`,
    color: ACCENT,
    fontSize: 11,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  },
  band: {
    padding: "3px 12px",
    borderRadius: 999,
    background: "rgba(122,90,47,0.1)",
    border: `1px solid rgba(122,90,47,0.3)`,
    color: ACCENT,
    fontWeight: 600,
    fontSize: 13,
  },
  summaryStrong: {},
  msg: { padding: 16, opacity: 0.7 },
  absent: { padding: 4 },
  pre: {
    margin: 0,
    padding: "10px 12px",
    background: INK,
    color: "#f4ede0",
    borderRadius: 8,
    fontSize: 12.5,
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  foot: {
    padding: "12px 24px 28px",
    maxWidth: 900,
    opacity: 0.65,
    fontSize: 12.5,
    lineHeight: 1.6,
  },
};
