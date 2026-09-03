import { useEffect, useMemo, useRef, useState } from "react";
import {
  divergentRuns,
  isWordShard,
  wordDiff,
  WordIndex,
  type DiffSide,
  type Edge,
  type Rect,
} from "@hifth/core";
import { loadPageSvg, loadWordShard } from "../assets";
import { useT } from "../i18n";
import styles from "./DiffView.module.css";

interface DiffViewProps {
  /** The look-alike edge this row is about — it carries both shared runs. */
  edge: Edge;
  /** Source ayah key ("here" — where the reader currently is). */
  fromKey: string;
}

/** A page's artwork and its word geometry, which are always wanted together. */
interface Loaded {
  readonly markup: string;
  readonly index: WordIndex;
}

/** Breathing room around a crop, in page units — about a letter's width. */
const PAD = 2;

/** The smallest rectangle containing all of them, or null if there are none. */
function union(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const r of rects) {
    left = Math.min(left, r.x);
    top = Math.min(top, r.y);
    right = Math.max(right, r.x + r.width);
    bottom = Math.max(bottom, r.y + r.height);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** An SVG path `d` tracing one rectangle — four straight sides and a close. */
function rectPath(r: Rect): string {
  return `M${r.x} ${r.y}H${r.x + r.width}V${r.y + r.height}H${r.x}Z`;
}

/** The overlay geometry for one wash rectangle, grown a whisker for a snug fit. */
function appendBand(svg: SVGSVGElement, r: Rect, cls: string): void {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", String(r.x - 0.5));
  rect.setAttribute("y", String(r.y - 0.5));
  rect.setAttribute("width", String(r.width + 1));
  rect.setAttribute("height", String(r.height + 1));
  rect.setAttribute("rx", "1");
  rect.setAttribute("class", cls);
  svg.appendChild(rect);
}

/**
 * One side of the comparison: the ayah as the mus'haf prints it, veiled down to
 * its own lines and washed to show where it agrees with its partner and where
 * it does not.
 *
 * Three overlays go on, in this order, all in the page's own coordinate space:
 *  - a **scrim** — one paper-coloured shape covering the whole crop with the
 *    ayah's own lines punched out of it, so the neighbouring words the crop
 *    happened to catch fade back and cannot be read as part of this ayah;
 *  - a **green** wash on the words the two ayat share;
 *  - an **ochre** wash on each run of words that differ.
 *
 * The page's own markup is mounted once and then cropped by overriding the
 * `viewBox` — word boxes and page artwork are authored in the same user units
 * (page 1 is `0 0 235 235`, and its words run x 11.6–227.5, y 19.5–211.7), so a
 * band rectangle is a crop rectangle with no conversion in between. Nothing is
 * redrawn or re-parsed when the washes change; only the overlays move.
 */
function PrintedAyah({
  side,
  loaded,
}: {
  side: DiffSide;
  loaded: Loaded;
}): JSX.Element | null {
  const host = useRef<HTMLDivElement>(null);

  const present = loaded.index.span(side.key);
  // The ayah's own lines — the crop's extent, and the holes the scrim leaves.
  const lines = present ? loaded.index.bandsFor(side.key, present.from, present.to) : [];
  const box = union(lines);

  // The shared opening, clamped to what this page actually carries (a run can
  // begin on the leaf before), and the divergent tails at either end.
  const [sFrom, sTo] = side.shared;
  const shared =
    present && Math.max(sFrom, present.from) <= Math.min(sTo, present.to)
      ? loaded.index.bandsFor(
          side.key,
          Math.max(sFrom, present.from),
          Math.min(sTo, present.to),
        )
      : [];
  const diff = present
    ? divergentRuns(present, side.shared).flatMap(([from, to]) =>
        loaded.index.bandsFor(side.key, from, to),
      )
    : [];

  useEffect(() => {
    const el = host.current;
    if (!el || !box) return;
    // Same idiom as the stage: hand the browser the page's markup as authored
    // (PageStage.tsx does `host.innerHTML = markup`), then take hold of the
    // root it produced. Re-cropping is an attribute write, not a re-parse.
    el.innerHTML = loaded.markup;
    const svg = el.firstElementChild as SVGSVGElement | null;
    if (!svg) return;
    svg.setAttribute(
      "viewBox",
      `${box.x - PAD} ${box.y - PAD} ${box.width + PAD * 2} ${box.height + PAD * 2}`,
    );
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("class", styles.page as string);
    // The artwork is decoration here — the label above the crop is what names
    // the ayah, and a screen reader should not walk 20 KB of path data.
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    // The scrim: the padded crop rectangle, then each of the ayah's own lines
    // (grown a hair so a descender is not clipped) as an even-odd hole. What is
    // left painted is exactly the margin and the neighbours' ink.
    const outer = {
      x: box.x - PAD,
      y: box.y - PAD,
      width: box.width + PAD * 2,
      height: box.height + PAD * 2,
    };
    const holes = lines
      .map((b) => rectPath({ x: b.x - 1, y: b.y - 1, width: b.width + 2, height: b.height + 2 }))
      .join("");
    const scrim = document.createElementNS("http://www.w3.org/2000/svg", "path");
    scrim.setAttribute("d", rectPath(outer) + holes);
    scrim.setAttribute("fill-rule", "evenodd");
    scrim.setAttribute("class", styles.scrim as string);
    svg.appendChild(scrim);
    // Then the two washes, over the ink, sharing the page's coordinate space.
    for (const r of shared) appendBand(svg, r, styles.wShare as string);
    for (const r of diff) appendBand(svg, r, styles.wDiff as string);
  }, [loaded, box, shared, diff, lines]);

  if (!box) return null;
  return <div ref={host} className={styles.crop} />;
}

/**
 * DiffView (spec §3 diff) — the "why these two are confusable" panel a hop row
 * expands to.
 *
 * It stacks the source ayah and its look-alike **as the mus'haf prints them**,
 * cropped out of the page artwork that already ships. Each side is veiled down
 * to its own lines, its shared opening washed green and its divergent tail
 * washed ochre. Which words those are is not a judgement made here: the edge
 * carries the matching run on both sides in the print's own word numbering, and
 * the leftover at either end is what differs.
 *
 * Renders nothing when the edge names no words (452 of 2,996 look-alike edges
 * match in more than one place, so they name none), or when either page's
 * artwork or geometry is not to hand — the row keeps its plain note, exactly as
 * it did for every pair the old twelve-ayah table did not cover.
 */
export function DiffView({ edge, fromKey }: DiffViewProps): JSX.Element | null {
  const { t } = useT();
  const diff = useMemo(() => wordDiff(edge, fromKey), [edge, fromKey]);
  const edition = useMemo(() => editionOf(edge.to), [edge.to]);
  const [sides, setSides] = useState<{ from: Loaded; to: Loaded } | null>(null);

  useEffect(() => {
    if (!diff) return;
    let live = true;
    // Fetched here rather than threaded down from the stage: the panel only
    // exists while a row is expanded, the source page is already in the browser
    // cache because the reader is looking at it, and the target's page is the
    // one a hop would need next anyway.
    const load = async (s: DiffSide): Promise<Loaded | null> => {
      const [markup, shard] = await Promise.all([
        loadPageSvg(edition, s.page).catch(() => null),
        loadWordShard(edition, s.page),
      ]);
      if (!markup || !shard || !isWordShard(shard)) return null;
      const index = new WordIndex(shard);
      return index.has(s.key) ? { markup, index } : null;
    };
    void Promise.all([load(diff.from), load(diff.to)]).then(([from, to]) => {
      if (!live) return;
      setSides(from && to ? { from, to } : null);
    });
    return () => {
      live = false;
    };
  }, [diff, edition]);

  if (!diff || !sides) return null;
  // The sides carry bare refs, which is what the geometry is keyed by — but the
  // surah name comes from the canonical form, so it is rebuilt for the label
  // rather than carried twice.
  const named = (bare: string) => t.ayahLabel(`quran/${edition}/${bare}`) ?? bare;
  const fromLabel = named(diff.from.key);
  const toLabel = named(diff.to.key);

  return (
    <div className={styles.diff}>
      <div className={styles.side}>
        <span className={styles.who}>
          {fromLabel} · {t.hereTag}
        </span>
        <PrintedAyah side={diff.from} loaded={sides.from} />
      </div>
      <div className={styles.side}>
        <span className={styles.who}>{toLabel}</span>
        <PrintedAyah side={diff.to} loaded={sides.to} />
      </div>
    </div>
  );
}

/** `"quran/hafs-kfqc/2:123"` → `"hafs-kfqc"`. */
function editionOf(key: string): string {
  const parts = key.split("/");
  return parts.length >= 2 ? (parts[1] as string) : "hafs-kfqc";
}
