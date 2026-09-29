import { useEffect, useMemo, useState } from "react";
import { StorePageSvg } from "./StorePageSvg";
import {
  classifyPlacement,
  EDITION,
  loadFixture,
  loadTapShapes,
  loadWordBoxes,
  parseViewBox,
  type Fixture,
  type Line,
  type PageGeometry,
  type PlacementReport,
  type StoreWordBox,
  type TapShape,
  type ViewBox,
  type Word,
  type WordBoxes,
} from "./storePage";

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
 * The drawing itself lives in `storePage.ts` and is shared with the in-app overlay
 * (`overlay.ts`): the store's words set in the print's own per-page font, at the
 * print's geometry, which this page reads from the app's own word boxes. Under it,
 * the structure — verse and word run per line, a medallion where an ayah ends — so a
 * slip can be named by line and verse, not only seen.
 *
 * WHY NO ARABIC HERE. The store's word text is a font-private, one-codepoint-per-word
 * encoding that only the page's own font file draws as words
 * (docs/issues/qul-diff-render-needs-font.md), and it arrives at run time from a
 * gitignored fixture. This file is checked in, and the repo ships no Qur'an text —
 * gate:scripture would refuse a single Arabic codepoint in this source.
 */

type Load =
  | { state: "loading" }
  | { state: "absent"; page: number }
  | { state: "error"; message: string }
  | { state: "ok"; fixture: Fixture; boxes: WordBoxes | null; viewBox: ViewBox };

/** How the two pages stand: beside each other, or the store laid over the print. */
type View = "side" | "overlay";

const PAGE_MIN = 1;
const PAGE_MAX = 604;
/** The print's default viewBox; pages 1 and 2 override it in the manifest. */
const DEFAULT_VIEWBOX: ViewBox = { x: 0, y: 0, w: 345, h: 550 };
/** The store's ink when it lies over the print: a blue the print never uses. */
const OVERLAY_INK = "#1d4ed8";

function clampPage(n: number): number {
  if (!Number.isFinite(n)) return PAGE_MIN;
  return Math.min(PAGE_MAX, Math.max(PAGE_MIN, Math.round(n)));
}

function pageFromUrl(): number {
  const p = new URLSearchParams(window.location.search).get("page");
  return clampPage(parseInt(p ?? "", 10) || PAGE_MIN);
}

function viewFromUrl(): View {
  return new URLSearchParams(window.location.search).get("view") === "overlay" ? "overlay" : "side";
}

let manifestCache: Promise<{ viewBox?: string; viewBoxOverrides?: Record<string, string> } | null> | null =
  null;
function loadManifest() {
  manifestCache ??= fetch("/assets/manifest.json")
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return manifestCache;
}

async function viewBoxOf(page: number): Promise<ViewBox> {
  const m = await loadManifest();
  return parseViewBox(m?.viewBoxOverrides?.[String(page)] ?? m?.viewBox) ?? DEFAULT_VIEWBOX;
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
  const [view, setView] = useState<View>(viewFromUrl);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [geom, setGeom] = useState<PageGeometry | null>(null);
  const [boxes, setBoxes] = useState<StoreWordBox[]>([]);
  const [shapes, setShapes] = useState<TapShape[]>([]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("page", String(page));
    url.searchParams.set("view", view);
    window.history.replaceState(null, "", url);
  }, [page, view]);

  useEffect(() => {
    let live = true;
    setLoad({ state: "loading" });
    setGeom(null);
    setBoxes([]);
    Promise.all([loadFixture(page), loadWordBoxes(page), viewBoxOf(page)])
      .then(([fixture, boxes, viewBox]) => {
        if (!live) return;
        if (!fixture) setLoad({ state: "absent", page });
        else setLoad({ state: "ok", fixture, boxes, viewBox });
      })
      .catch((e) => {
        if (live) setLoad({ state: "error", message: String(e) });
      });
    return () => {
      live = false;
    };
  }, [page]);

  // The app's tap shapes for this page, read from the very asset that draws them,
  // so a store word can be asked whether it lands where a reader can tap its ayah.
  useEffect(() => {
    let live = true;
    setShapes([]);
    loadTapShapes(page)
      .then((s) => {
        if (live) setShapes(s);
      })
      .catch(() => {
        if (live) setShapes([]);
      });
    return () => {
      live = false;
    };
  }, [page]);

  const report = useMemo<PlacementReport | null>(
    () => (boxes.length && shapes.length ? classifyPlacement(boxes, shapes) : null),
    [boxes, shapes],
  );

  const print = (
    <img
      key={page}
      src={`/assets/pages/${EDITION}/${page}.svg`}
      alt={`Print page ${page}`}
      style={S.printImg}
    />
  );

  return (
    <div style={S.app}>
      <Header
        page={page}
        onPage={(n) => setPage(clampPage(n))}
        view={view}
        onView={setView}
      />
      {view === "side" ? (
        <main style={S.split}>
          <section style={S.pane}>
            <h2 style={S.paneTitle}>
              Shipped print <span style={S.paneSub}>edition {EDITION}</span>
            </h2>
            <div style={S.printWrap}>{print}</div>
          </section>
          <section style={S.pane}>
            <h2 style={S.paneTitle}>
              Store page{" "}
              <span style={S.paneSub}>held copy · QPC V4 words · library font · print geometry</span>
            </h2>
            {load.state === "ok" ? (
              <div style={S.printWrap}>
                <div style={S.printImg}>
                  <StorePageSvg
                    fixture={load.fixture}
                    boxes={load.boxes}
                    viewBox={load.viewBox}
                    page={page}
                    onGeometry={setGeom}
                    onWordBoxes={setBoxes}
                  />
                </div>
              </div>
            ) : (
              <StoreStatus load={load} page={page} />
            )}
          </section>
        </main>
      ) : (
        <main style={S.single}>
          <section style={S.pane}>
            <h2 style={S.paneTitle}>
              Store over print{" "}
              <span style={S.paneSub}>
                the print in black, the store's words in blue, at the print's geometry
              </span>
            </h2>
            <div style={S.printWrap}>
              <div style={{ ...S.printImg, position: "relative" }}>
                {print}
                {load.state === "ok" && (
                  <StorePageSvg
                    fixture={load.fixture}
                    boxes={load.boxes}
                    viewBox={load.viewBox}
                    page={page}
                    fill={OVERLAY_INK}
                    style={S.overlay}
                    onGeometry={setGeom}
                    onWordBoxes={setBoxes}
                  />
                )}
              </div>
            </div>
            {load.state !== "ok" && <StoreStatus load={load} page={page} />}
          </section>
        </main>
      )}
      <section style={S.structure}>
        <h2 style={S.paneTitle}>
          Line by line{" "}
          <span style={S.paneSub}>
            what the store says is on each line · where the print's lines were measured
          </span>
        </h2>
        {load.state === "ok" ? (
          <StoreLines lines={[...load.fixture.lines].sort((a, b) => a.line_number - b.line_number)} geom={geom} />
        ) : (
          <StoreStatus load={load} page={page} />
        )}
      </section>
      <section style={S.structure}>
        <h2 style={S.paneTitle}>
          Where a tap lands{" "}
          <span style={S.paneSub}>
            does each store word sit where the app lets a reader tap its ayah?
          </span>
        </h2>
        {load.state === "ok" ? (
          <TapLanding report={report} geom={geom} />
        ) : (
          <StoreStatus load={load} page={page} />
        )}
      </section>
      <footer style={S.foot}>
        The store's page is drawn in the print's own per-page font (the library's
        tajweed-coloured pack — the colour is the library's, not a finding — served in dev
        from a gitignored cache, never from the tree or the shipped bundle), each line set at
        the height the print's own word boxes say that line is. Beside the print, or laid
        over it in blue: a blue word with no black under it, or an ayah ending on the wrong
        line, is a registration finding. The same drawing mounts in the running app behind a
        dev-only flag (make dev-qul). Background: docs/issues/qul-diff-render-needs-font.md.
      </footer>
    </div>
  );
}

function Header({
  page,
  onPage,
  view,
  onView,
}: {
  page: number;
  onPage: (n: number) => void;
  view: View;
  onView: (v: View) => void;
}) {
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
        <span style={S.seg} role="group" aria-label="view">
          {(["side", "overlay"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onView(v)}
              style={{ ...S.segBtn, ...(view === v ? S.segOn : null) }}
              aria-pressed={view === v}
            >
              {v === "side" ? "side by side" : "overlay"}
            </button>
          ))}
        </span>
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

function StoreStatus({ load, page }: { load: Load; page: number }) {
  if (load.state === "loading") return <div style={S.msg}>Reading the store…</div>;
  if (load.state === "error")
    return <div style={S.msg}>Could not read the fixture: {load.message}</div>;
  if (load.state === "absent") return <Absent page={page} />;
  return null;
}

function TapLanding({
  report,
  geom,
}: {
  report: PlacementReport | null;
  geom: PageGeometry | null;
}) {
  if (!report) return <p style={S.muted}>Measuring the store's words against the tap shapes…</p>;
  const paired = geom ? geom.rows === geom.ayahLines : false;
  const crossed = report.inNeighbour.length;
  const off = report.outside.length;
  const clean = crossed === 0 && off === 0;
  return (
    <div>
      <div style={S.summary}>
        <span>
          <strong>{report.ok}</strong> of <strong>{report.total}</strong> words tap their own ayah
        </span>
        {crossed > 0 && (
          <span>
            <strong style={{ color: "#b4231b" }}>{crossed}</strong> land on a neighbour
          </span>
        )}
        {off > 0 && (
          <span>
            <strong style={{ color: "#b4231b" }}>{off}</strong> land on no ayah
          </span>
        )}
        {clean && <span style={{ color: "#1f7a44" }}>every word taps its own ayah</span>}
      </div>
      {!paired && (
        <p style={S.tapWarn}>
          This page's lines were placed by fit (print rows {geom?.rows ?? "?"} vs store lines{" "}
          {geom?.ayahLines ?? "?"}), so a miss below is a guess about where the lines are, not a
          store finding. Trust the count only where the two agree.
        </p>
      )}
      {!clean && (
        <ul style={S.tapList}>
          {report.inNeighbour.map((w) => (
            <li key={w.word}>
              <span dir="ltr" style={S.tapWord}>{w.word}</span> — the store places it in ayah{" "}
              <strong dir="ltr">{w.ayah}</strong>, but its box taps{" "}
              <strong dir="ltr">{w.landedIn}</strong>
            </li>
          ))}
          {report.outside.map((w) => (
            <li key={w.word}>
              <span dir="ltr" style={S.tapWord}>{w.word}</span> — the store places it in ayah{" "}
              <strong dir="ltr">{w.ayah}</strong>, but its box taps no ayah shape
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StoreLines({ lines, geom }: { lines: Line[]; geom: PageGeometry | null }) {
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
        {geom && (
          <span title="rows of word boxes the print has, against ayah lines the store has">
            print rows <strong>{geom.rows}</strong> · store ayah lines{" "}
            <strong>{geom.ayahLines}</strong>
            {geom.rows !== geom.ayahLines && (
              <strong style={{ color: "#b4231b" }}> — unpaired, lines placed by fit</strong>
            )}
          </span>
        )}
      </div>
      <ol style={S.lines}>
        {lines.map((l) => (
          <StoreLine
            key={l.line_number}
            line={l}
            ends={ends}
            slot={geom?.lines.find((s) => s.line === l) ?? null}
          />
        ))}
      </ol>
    </div>
  );
}

function StoreLine({
  line,
  ends,
  slot,
}: {
  line: Line;
  ends: Set<number>;
  slot: { y: number; measured: boolean } | null;
}) {
  const centered = line.is_centered || line.line_type !== "ayah";
  const rowStyle: React.CSSProperties = {
    ...S.line,
    justifyContent: centered ? "center" : "flex-start",
  };

  let content: React.ReactNode;
  if (line.line_type === "ayah") {
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
        <span style={rowStyle} dir="rtl">
          {content}
        </span>
      </span>
      <span style={S.where} title="the line's centre on the print, in the page's own units">
        {slot ? (
          <>
            y {slot.y.toFixed(1)}
            <span style={S.whereHow}>{slot.measured ? "measured" : "by fit"}</span>
          </>
        ) : null}
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
  seg: {
    display: "inline-flex",
    border: `1px solid ${EDGE}`,
    borderRadius: 6,
    overflow: "hidden",
    marginInlineEnd: 8,
  },
  segBtn: {
    font: "inherit",
    fontSize: 13,
    padding: "6px 10px",
    border: 0,
    background: PAPER,
    color: INK,
    cursor: "pointer",
  },
  segOn: { background: ACCENT, color: "#fff" },
  single: { padding: 24, display: "grid", justifyContent: "center" },
  overlay: { position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.72 },
  structure: { padding: "0 24px", maxWidth: 1100 },
  where: {
    fontSize: 11,
    opacity: 0.6,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
    paddingTop: 6,
    textAlign: "right",
  },
  whereHow: { display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.3 },
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
  printImg: { width: "100%", maxWidth: 520, height: "auto", display: "block" },
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
  muted: { opacity: 0.6, fontSize: 13, margin: "6px 0" },
  tapWarn: {
    margin: "0 0 10px",
    padding: "8px 10px",
    background: "#fdf3e7",
    border: `1px solid #e7cfa6`,
    borderRadius: 8,
    fontSize: 12.5,
    lineHeight: 1.5,
  },
  tapList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gap: 4,
    fontSize: 13,
    lineHeight: 1.5,
  },
  tapWord: {
    fontVariantNumeric: "tabular-nums",
    fontWeight: 600,
    background: PAPER,
    border: `1px solid ${EDGE}`,
    borderRadius: 5,
    padding: "0 5px",
  },
  lineRow: {
    display: "grid",
    gridTemplateColumns: "56px 1fr 72px",
    gap: 10,
    alignItems: "start",
    minHeight: 34,
    padding: "3px 6px",
    borderRadius: 6,
    background: PAPER,
  },
  gutter: { display: "flex", flexDirection: "column", lineHeight: 1.1, paddingTop: 6 },
  lineBody: { display: "grid", gap: 2, minWidth: 0 },
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
