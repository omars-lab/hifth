import { useEffect, useRef, useState } from "react";
import {
  isLetterShard,
  isMarkShard,
  isWordShard,
  lettersOfWord,
  signsOfWord,
  WordIndex,
  type ReachedSign,
} from "@hifth/core";
import { loadLetterShard, loadMarkShard, loadWordShard } from "../assets";
import { useT } from "../i18n";
import type { WordRect } from "./PageStage";
import styles from "./WordParts.module.css";

/** One word as the row of parts draws it: its box on the page, and its signs in reading order. */
export interface WordPartsData {
  readonly box: { x: number; y: number; width: number; height: number };
  readonly signs: readonly ReachedSign[];
  /**
   * Each letter's outline on the page, right to left, in the page's units;
   * empty when the print could not be cut into letters for this word.
   */
  readonly letters: readonly (readonly (readonly [number, number])[])[];
}

/** A word's box, signs and letters from the page's word, sign and letter data, once they are in. */
export function useWordParts(edition: string, page: number, key: string, word: number): WordPartsData | null {
  const [data, setData] = useState<WordPartsData | null>(null);
  useEffect(() => {
    let live = true;
    setData(null);
    const bare = key.slice(key.lastIndexOf("/") + 1).split("#")[0]!;
    // A page with no letter data yet still opens, with signs only.
    const letterShard = loadLetterShard(edition, page).catch(() => null);
    void Promise.all([loadWordShard(edition, page), loadMarkShard(edition, page), letterShard]).then(([ws, ms, ls]) => {
      if (!live || !ws || !isWordShard(ws)) return;
      const box = new WordIndex(ws).boxOf(key, word);
      if (!box) return;
      const signs = ms && isMarkShard(ms) ? signsOfWord(ms, bare, word) : [];
      const letters = ls && isLetterShard(ls) ? lettersOfWord(ls, bare, word, box) : [];
      setData({ box: { x: box.x, y: box.y, width: box.width, height: box.height }, signs, letters });
    });
    return () => {
      live = false;
    };
  }, [edition, page, key, word]);
  return data;
}

interface WordPartsProps {
  /** The verse, as the reader reads it ("Al-Baqarah 38"). */
  label: string;
  data: WordPartsData;
  /** The page's drawing, and its size in its own units. */
  pageSrc: string;
  pageSize: { w: number; h: number };
  /** Where the word is on screen, read when the row is placed; null stands it mid-window. */
  anchor: () => WordRect | null;
  /**
   * "note": the word tool, where picking a part drops a note on it.
   * "mistake": the mistake tool's second tap, where picking a part says where
   * the slip was, the current pick is shown pressed, and the mark can be cleared.
   */
  mode: "note" | "mistake";
  /** The sign picked so far (mistake mode); null for the whole word. */
  chosen?: number | null | undefined;
  /** A part was picked: a sign's place in its verse's list, or null for the whole word. */
  onPick: (mark: number | null, name: string | null) => void;
  /**
   * Note mode only: several signs were gathered (Shift- or ⌘-click) and the
   * reader asked for one note on all of them.
   */
  onPickMany?: ((marks: number[]) => void) | undefined;
  /** Note mode only: one letter was picked, by its place from the right (0 = first). */
  onPickLetter?: ((letter: number) => void) | undefined;
  onClear?: (() => void) | undefined;
  onClose: () => void;
}

/** Room kept between the row and the window's edge, and below the word. */
const MARGIN = 12;
/** Page units of paper kept round the word in each copy. */
const PAD = 2.5;
/**
 * How tall each copy is drawn, in pixels, and the most it may enlarge the
 * print: tall enough that a sign is plain, short enough that a long word's
 * row stays a strip beside the page rather than a wall over it.
 */
const COPY_PX = 76;
const MAX_ZOOM = 3.4;

/**
 * The word tool's row of parts: the fuller version of A that the harakah-pick
 * decision chose (D). The tapped word opens into one enlarged copy of itself
 * for each vowel-sign, with that sign in full ink and the rest of the word
 * faint, so every copy still reads as the word and only one part is there to
 * take; the first copy is the whole word. Right to left, in reading order.
 *
 * Every copy is the print itself, cut from the page's drawing, so it works on
 * all 604 pages. Under the word tool a second row gives each letter its own
 * copy (letter-parts = A): the print cut where one letter joins the next, from
 * the page's letter data. A word the cut was not trusted on has no such row.
 */
export function WordParts({
  label,
  data,
  pageSrc,
  pageSize,
  anchor,
  mode,
  chosen = null,
  onPick,
  onPickMany,
  onPickLetter,
  onClear,
  onClose,
}: WordPartsProps): JSX.Element {
  const { t } = useT();
  // Signs gathered for one note. A plain click with none gathered still picks
  // at once, so the one-part case stays one click; Shift or ⌘ starts a
  // gathering, and once one is under way every click on a sign toggles it.
  const [several, setSeveral] = useState<number[]>([]);
  const gathering = mode === "note" && onPickMany !== undefined;
  const takeSign = (e: React.MouseEvent, index: number, name: string) => {
    if (gathering && (several.length > 0 || e.shiftKey || e.metaKey || e.ctrlKey)) {
      setSeveral((s) => (s.includes(index) ? s.filter((x) => x !== index) : [...s, index]));
      return;
    }
    onPick(index, name);
  };
  const boxRef = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;

  // Stand below the word, or above it when there is no room; measured a frame
  // late so the row has its size.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const box = boxRef.current;
      if (!box) return;
      const r = anchorRef.current();
      const w = box.offsetWidth;
      const h = box.offsetHeight;
      const cx = r ? (r.left + r.right) / 2 : window.innerWidth / 2;
      const below = r ? r.bottom + MARGIN : window.innerHeight / 2 - h / 2;
      const top = !r || below + h + MARGIN <= window.innerHeight ? below : Math.max(MARGIN, r.top - h - MARGIN);
      const left = Math.min(Math.max(MARGIN, cx - w / 2), window.innerWidth - w - MARGIN);
      setAt({ left, top });
    });
    return () => cancelAnimationFrame(frame);
  }, [data]);

  const placed = at !== null;
  useEffect(() => {
    if (placed) boxRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [placed]);

  // A press anywhere else closes it, as the note box does.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onCloseRef.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []);

  const { box, signs, letters } = data;
  const ZOOM = Math.min(MAX_ZOOM, COPY_PX / (box.height + PAD * 2));
  const x0 = box.x - PAD;
  const y0 = box.y - PAD;
  const cw = (box.width + PAD * 2) * ZOOM;
  const ch = (box.height + PAD * 2) * ZOOM;
  const page = { width: pageSize.w * ZOOM, height: pageSize.h * ZOOM };
  /** The print, placed so the word's corner sits at (0, 0) of the copy, less `dx, dy`. */
  const print = (dx = 0, dy = 0) => (
    <img
      src={pageSrc}
      alt=""
      draggable={false}
      style={{ ...page, left: -(x0 * ZOOM) - dx, top: -(y0 * ZOOM) - dy }}
    />
  );
  const heading = mode === "mistake" ? t.mistakePicker(label) : t.wordParts(label);

  return (
    <div
      ref={boxRef}
      className={styles.box}
      role="dialog"
      aria-label={heading}
      data-word-parts={mode}
      style={at ? { left: at.left, top: at.top } : { visibility: "hidden" }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className={styles.head}>{heading}</div>
      {mode === "note" && (
        <div className={styles.hint}>
          {t.wordPartsHint}
          {gathering && <span className={styles.hintMany}> · {t.wordPartsHintMany}</span>}
        </div>
      )}
      <div className={styles.row}>
        <button
          type="button"
          className={styles.part}
          aria-pressed={mode === "mistake" ? chosen === null : undefined}
          data-part="word"
          onClick={() => onPick(null, null)}
        >
          <span className={styles.copy} style={{ width: cw, height: ch }} aria-hidden="true">
            {print()}
          </span>
          <span className={styles.name}>{t.mistakeWholeWord}</span>
        </button>
        {signs.map((s) => {
          // The sign's own window on the print, in the copy's pixels.
          const sx = (s.r[0] - 0.6 - x0) * ZOOM;
          const sy = (s.r[1] - 0.6 - y0) * ZOOM;
          const sw = (s.r[2] + 1.2) * ZOOM;
          const sh = (s.r[3] + 1.2) * ZOOM;
          return (
            <button
              key={s.index}
              type="button"
              className={styles.part}
              aria-pressed={
                mode === "mistake" ? chosen === s.index : several.length > 0 ? several.includes(s.index) : undefined
              }
              data-part="sign"
              data-sign={s.index}
              onClick={(e) => takeSign(e, s.index, s.name)}
            >
              <span className={styles.copy} style={{ width: cw, height: ch }} aria-hidden="true">
                <span className={styles.faint}>{print()}</span>
                <span className={styles.solid} style={{ left: sx, top: sy, width: sw, height: sh }}>
                  {print(sx, sy)}
                </span>
                <span className={styles.ring} style={{ left: sx - 2, top: sy - 2, width: sw + 4, height: sh + 4 }} />
              </span>
              <span className={styles.name}>{s.name}</span>
            </button>
          );
        })}
      </div>
      {mode === "note" && onPickLetter && letters.length > 1 && (
        <div className={styles.row} data-letters={letters.length}>
          {letters.map((outline, i) => {
            // The letter's own outline on the print, in the copy's pixels.
            const clip = `polygon(${outline
              .map(([x, y]) => `${((x - x0) * ZOOM).toFixed(1)}px ${((y - y0) * ZOOM).toFixed(1)}px`)
              .join(", ")})`;
            const name = t.wordPartsLetter(i + 1);
            return (
              <button
                key={i}
                type="button"
                className={styles.part}
                data-part="letter"
                data-letter={i}
                aria-label={name}
                onClick={() => onPickLetter(i)}
              >
                <span className={styles.copy} style={{ width: cw, height: ch }} aria-hidden="true">
                  <span className={styles.faint}>{print()}</span>
                  <span className={styles.letter} style={{ clipPath: clip }}>
                    {print()}
                  </span>
                </span>
                <span className={styles.name}>{name}</span>
              </button>
            );
          })}
        </div>
      )}
      {gathering && several.length > 0 && (
        <div className={styles.actions}>
          <button type="button" className={styles.many} data-note-many onClick={() => onPickMany!(several)}>
            {t.wordPartsMany(several.length)}
          </button>
        </div>
      )}
      {mode === "mistake" && signs.length === 0 && <p className={styles.none}>{t.mistakeNoSigns}</p>}
      {mode === "mistake" && onClear && (
        <div className={styles.actions}>
          <button type="button" className={styles.clear} onClick={onClear}>
            {t.mistakeClear}
          </button>
        </div>
      )}
    </div>
  );
}
