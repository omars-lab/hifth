import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  isLetterShard,
  isMarkShard,
  isWordShard,
  lettersOfWord,
  signsOfWord,
  TAJWEED_RULES,
  WordIndex,
  type MistakeAnswer,
  type MistakeKind,
  type ReachedSign,
} from "@hifth/core";
import type { MistakeAsk } from "../mistake-ask";
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
   * "mistake": the mistake tool's question, what went wrong: a sign (the
   * harakat), the whole word, or another verse it went into. A mark already
   * made shows its pick pressed and can be cleared.
   */
  mode: "note" | "mistake";
  /**
   * Stand in the verse drawer's place — on the bottom of the window, over the
   * bar under the page — rather than beside the word (selection-drawer = D).
   * The word tool's row does; the mistake picker opens on its word, and docks
   * only where it fits neither under nor over it (a phone).
   */
  docked?: boolean | undefined;
  /**
   * Docked, stand on top of this box instead of the window's foot: the verse
   * drawer, when a tap on a word of the lit verse opens the word above it
   * (selection-drawer ①, a setting). Null when that box is not on screen.
   * It follows that box as it slides in or changes size.
   */
  stackAbove?: (() => Element | null) | undefined;
  /** Stacked, where its top stands, so the page lifts the verse clear of it; null once it closes. */
  onCover?: ((top: number | null) => void) | undefined;
  /**
   * Stacked on the verse's drawer, how it shows that (ayah-drawer ①): "path"
   * heads it with the verse under it, a button back down to it; "tag" names
   * its level and edges it in colour. Left out when it stands alone.
   */
  marks?: "path" | "tag" | undefined;
  /**
   * Mistake mode: what the mark says went wrong so far, shown pressed, and the
   * kind the question opens at. Left out when nothing is marked yet.
   */
  answered?: MistakeAnswer | undefined;
  /**
   * Mistake mode: how the question is laid out (the reader's setting): the
   * kinds first, the kinds as tabs, or every choice at once.
   */
  ask?: MistakeAsk | undefined;
  /**
   * Mistake mode: an answer was picked, with the name to say for it (the
   * sign's, the rule's). Without it a sign or the whole word falls back to
   * `onPick`, as the question was before it asked the kind.
   */
  onAnswer?: ((answer: MistakeAnswer, name: string | null) => void) | undefined;
  /** Mistake mode: the reader went into another verse; asking where is App's. */
  onAnother?: (() => void) | undefined;
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

/** Where its word stands, top and bottom, on the box: what a test checks it stays off. */
function markWord(box: HTMLElement, r: { top: number; bottom: number } | null) {
  if (!r) return;
  box.dataset.wordTop = String(Math.round(r.top));
  box.dataset.wordBottom = String(Math.round(r.bottom));
}
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
 * Smaller in the drawer, whose rows run on one line each: two rows of the full
 * size stood half a page tall and covered the lower lines, the tapped word's too.
 */
const DOCKED_COPY_PX = 52;

/** The kinds of mistake that have choices of their own: which sign, which letter, which rule. */
type DetailKind = Exclude<MistakeKind, "word">;
const DETAIL_KINDS: readonly DetailKind[] = ["sign", "letter", "rule"];

/** The kind a mark already says, when that kind has choices to open at. */
function detailOf(answered: MistakeAnswer | undefined): DetailKind | null {
  return answered && answered.what !== "word" ? answered.what : null;
}

/** Whether the mark so far says this answer; false when nothing is marked yet. */
function says(answered: MistakeAnswer | undefined, a: MistakeAnswer): boolean {
  if (!answered || answered.what !== a.what) return false;
  if (a.what === "sign") return answered.what === "sign" && answered.mark === a.mark;
  if (a.what === "letter") return answered.what === "letter" && answered.letter === a.letter;
  if (a.what === "rule") return answered.what === "rule" && answered.rule === a.rule;
  return true;
}

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
  docked: dockedAsked = false,
  stackAbove,
  onCover,
  marks,
  answered,
  ask = "list",
  onAnswer,
  onPick,
  onPickMany,
  onPickLetter,
  onClear,
  onAnother,
  onClose,
}: WordPartsProps): JSX.Element {
  const { t } = useT();
  // Mistake mode, kind first or as tabs: which kind's choices are showing. Null is the
  // list of kinds (kind first); a word already marked opens at its own kind's choices.
  const [open, setOpen] = useState<DetailKind | null>(() => detailOf(answered));
  // Beside its word, it docks when it fits neither under nor over it: on a phone a long word's
  // question stood the whole screen tall over the word it asked about (2026-10-16).
  const [noRoom, setNoRoom] = useState(false);
  const docked = dockedAsked || noRoom;
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

  // Docked: where its top edge stands when the word is low (undefined until
  // measured, null for the bottom of the window).
  const [dockTop, setDockTop] = useState<number | null | undefined>(undefined);
  // Docked where it fits on neither side of the word whole: as tall as the room on the side
  // with more, its rows scrolling, so it never stands over the word (undefined when it fits).
  const [dockRoom, setDockRoom] = useState<number | undefined>(undefined);
  // Stacked: how far its foot stands above the window's foot (the verse
  // drawer's height), or undefined when it stands on the window's foot.
  const [dockLift, setDockLift] = useState<number | undefined>(undefined);
  const stackAboveRef = useRef(stackAbove);
  stackAboveRef.current = stackAbove;
  const onCoverRef = useRef(onCover);
  onCoverRef.current = onCover;
  useEffect(() => () => onCoverRef.current?.(null), []);

  // Docked, it stands on the bottom of the window, unless that would cover the
  // word: then at the top, just under the tool bar (word-drawer-placement = B).
  // Where it fits whole on neither side, it takes the side with more room and
  // shrinks to it (a phone on its side with a note open, 2026-10-16).
  useEffect(() => {
    if (!docked) return;
    let stopFollowing = () => {};
    const frame = requestAnimationFrame(() => {
      const box = boxRef.current;
      if (!box) return;
      const r = anchorRef.current();
      markWord(box, r);
      // Its full height, held to half the window as its style holds it, whatever room the last word left.
      const h = Math.min(box.scrollHeight, window.innerHeight / 2);
      setDockRoom(undefined);
      setDockLift(undefined);
      // Stacked on the verse drawer: its foot on the drawer's top, as tall as
      // the room above it allows, whatever word it is.
      // It measures again while that drawer is still sliding in or growing,
      // which left it overlapping the drawer one time in thirty (2026-11-09).
      const drawerBelow = stackAboveRef.current?.() ?? null;
      if (drawerBelow) {
        const place = () => {
          const below = drawerBelow.getBoundingClientRect();
          setDockTop(null);
          setDockLift(Math.max(0, window.innerHeight - below.top));
          setDockRoom(h > below.top ? below.top : undefined);
          onCoverRef.current?.(below.top - Math.min(h, below.top));
        };
        place();
        const watch = new ResizeObserver(place);
        watch.observe(drawerBelow);
        window.addEventListener("resize", place);
        let live = true;
        void Promise.all(drawerBelow.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined))).then(
          () => live && place(),
        );
        stopFollowing = () => {
          live = false;
          watch.disconnect();
          window.removeEventListener("resize", place);
        };
        return;
      }
      if (!r || r.bottom + MARGIN <= window.innerHeight - h) {
        setDockTop(null);
        return;
      }
      const tools = document.querySelector<HTMLElement>('[role="toolbar"][data-tool]:not([data-phone-bar])');
      const toolsFoot = tools?.getBoundingClientRect().bottom ?? 0;
      const under = toolsFoot < window.innerHeight / 2 ? toolsFoot : 0;
      const roomAbove = r.top - MARGIN - under;
      const roomBelow = window.innerHeight - r.bottom - MARGIN;
      if (h > roomAbove && roomBelow > roomAbove) {
        setDockTop(null);
        setDockRoom(roomBelow);
        return;
      }
      setDockTop(under);
      if (h > roomAbove) setDockRoom(roomAbove);
    });
    return () => {
      cancelAnimationFrame(frame);
      stopFollowing();
    };
  }, [data, docked, open]);

  // Stand below the word, or above it when there is no room; measured a frame
  // late so the row has its size.
  useEffect(() => {
    if (docked) return;
    const frame = requestAnimationFrame(() => {
      const box = boxRef.current;
      if (!box) return;
      const r = anchorRef.current();
      markWord(box, r);
      const w = box.offsetWidth;
      const h = box.offsetHeight;
      const cx = r ? (r.left + r.right) / 2 : window.innerWidth / 2;
      const below = r ? r.bottom + MARGIN : window.innerHeight / 2 - h / 2;
      if (r && below + h + MARGIN > window.innerHeight && r.top - h - MARGIN < MARGIN) {
        setNoRoom(true);
        return;
      }
      const top = !r || below + h + MARGIN <= window.innerHeight ? below : Math.max(MARGIN, r.top - h - MARGIN);
      const left = Math.min(Math.max(MARGIN, cx - w / 2), window.innerWidth - w - MARGIN);
      setAt({ left, top });
    });
    return () => cancelAnimationFrame(frame);
  }, [data, docked, open]);

  const placed = docked ? dockTop !== undefined : at !== null;
  useEffect(() => {
    if (placed) boxRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [placed, open]);

  // Escape closes it from the moment it is drawn, not only once it holds the
  // keyboard: it is placed a frame late and focused after that, and an Escape
  // pressed in between fell on the page, where every other Escape steps aside
  // for an open panel. Set up in the step that draws it, as the bookmark
  // drawer's is. The box's own handler marks the ones it already took.
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A press anywhere else closes it, as the note box does.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onCloseRef.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []);

  const { box, signs, letters } = data;
  const ZOOM = Math.min(MAX_ZOOM, (docked ? DOCKED_COPY_PX : COPY_PX) / (box.height + PAD * 2));
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
  const mistake = mode === "mistake";
  /** Mistake mode: say the answer, by the new callback where App gave one, else as before. */
  const answer = (a: MistakeAnswer, name: string | null) => {
    if (onAnswer) onAnswer(a, name);
    else if (a.what === "word") onPick(null, null);
    else if (a.what === "sign") onPick(a.mark, name);
  };
  const kindName: Record<DetailKind, string> = {
    sign: t.mistakeKindSign,
    letter: t.mistakeKindLetter,
    rule: t.mistakeKindRule,
  };
  const whichName: Record<DetailKind, string> = {
    sign: t.mistakeSignWhich,
    letter: t.mistakeLetterWhich,
    rule: t.mistakeRuleWhich,
  };

  const wordButton = (
    <button
      type="button"
      className={styles.part}
      aria-pressed={mistake ? says(answered, { what: "word" }) : undefined}
      data-part="word"
      onClick={() => (mistake ? answer({ what: "word" }, null) : onPick(null, null))}
    >
      <span className={styles.copy} style={{ width: cw, height: ch }} aria-hidden="true">
        {print()}
      </span>
      <span className={styles.name}>{t.mistakeWholeWord}</span>
    </button>
  );
  const signButtons = signs.map((s) => {
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
          mistake
            ? says(answered, { what: "sign", mark: s.index })
            : several.length > 0
              ? several.includes(s.index)
              : undefined
        }
        data-part="sign"
        data-sign={s.index}
        onClick={(e) => (mistake ? answer({ what: "sign", mark: s.index }, s.name) : takeSign(e, s.index, s.name))}
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
  });
  /** One letter of the word, cut from the print along the letter's own outline. */
  const letterButton = (i: number, onClick: () => void) => {
    const clip = `polygon(${(letters[i] ?? [])
      .map(([x, y]) => `${((x - x0) * ZOOM).toFixed(1)}px ${((y - y0) * ZOOM).toFixed(1)}px`)
      .join(", ")})`;
    const name = t.wordPartsLetter(i + 1);
    return (
      <button
        key={i}
        type="button"
        className={styles.part}
        aria-pressed={mistake ? says(answered, { what: "letter", letter: i }) : undefined}
        data-part="letter"
        data-letter={i}
        aria-label={name}
        onClick={onClick}
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
  };
  /** Mistake mode: the choices one kind of mistake needs. */
  const choicesOf = (kind: DetailKind) => {
    if (kind === "sign")
      return signs.length > 0 ? (
        <div className={styles.row}>{signButtons}</div>
      ) : (
        <p className={styles.none}>{t.mistakeNoSigns}</p>
      );
    if (kind === "letter")
      return (
        <div className={styles.row} data-letters={letters.length}>
          {letters.length > 1 &&
            letters.map((_, i) => letterButton(i, () => answer({ what: "letter", letter: i }, t.wordPartsLetter(i + 1))))}
          <button
            type="button"
            className={styles.rule}
            data-part="letter-any"
            aria-pressed={says(answered, { what: "letter" })}
            onClick={() => answer({ what: "letter" }, null)}
          >
            {t.mistakeAnyLetter}
          </button>
        </div>
      );
    return (
      <div className={styles.rules}>
        {TAJWEED_RULES.map((rule) => {
          const name = t.ruleName(rule.label, rule.latin);
          return (
            <button
              key={rule.id}
              type="button"
              className={styles.rule}
              data-part="rule"
              data-rule={rule.id}
              aria-pressed={says(answered, { what: "rule", rule: rule.id })}
              onClick={() => answer({ what: "rule", rule: rule.id }, name.primary)}
            >
              <span className={styles.ruleMark} style={{ color: `var(--tj-${rule.id})` }} aria-hidden="true">
                {rule.mark}
              </span>
              <span>{name.primary}</span>
              <span className={styles.ruleLatin}>{name.secondary}</span>
            </button>
          );
        })}
      </div>
    );
  };
  const anotherButton = onAnother && (
    <button type="button" className={styles.another} data-part="another" onClick={onAnother}>
      {t.mistakeAnother}
    </button>
  );
  const clearButton = onClear && (
    <button type="button" className={styles.clear} onClick={onClear}>
      {t.mistakeClear}
    </button>
  );
  const clearRow = clearButton && <div className={styles.actions}>{clearButton}</div>;
  const actionsRow = (anotherButton || clearButton) && (
    <div className={styles.actions}>
      {anotherButton}
      {clearButton}
    </div>
  );

  return (
    <div
      ref={boxRef}
      className={
        (docked ? `${styles.box} ${styles.docked} ${dockTop != null ? styles.dockedTop : styles.dockedBottom}` : styles.box) +
        (marks === "tag" ? ` ${styles.upper}` : "")
      }
      role="dialog"
      aria-label={heading}
      data-word-parts={mode}
      data-docked={docked ? (dockTop != null ? "top" : "bottom") : undefined}
      style={
        docked
          ? dockTop === undefined
            ? { visibility: "hidden" }
            : {
                ...(dockTop !== null && { top: dockTop }),
                ...(dockRoom !== undefined && { maxBlockSize: dockRoom }),
                ...(dockLift !== undefined && { insetBlockEnd: dockLift }),
              }
          : at
            ? { left: at.left, top: at.top }
            : { visibility: "hidden" }
      }
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className={styles.head}>
        {marks === "path" ? (
          // The verse under it, then this drawer: pressing the verse steps back down to it.
          <span>
            <button type="button" className={styles.crumb} aria-label={t.drawerBack(label)} onClick={onClose}>
              {label}
            </button>
            <span aria-hidden="true"> › </span>
            <span>{t.drawerWord}</span>
          </span>
        ) : (
          <span>
            {marks === "tag" && <span className={styles.level}>{t.levelWord}</span>}
            {heading}
          </span>
        )}
        {docked && (
          <button type="button" className={styles.close} aria-label={t.close} onClick={onClose}>
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>
      {mode === "note" && (
        <div className={styles.hint}>
          {t.wordPartsHint}
          {gathering && <span className={styles.hintMany}>{t.sep}{t.wordPartsHintMany}</span>}
        </div>
      )}
      {mode === "note" ? (
        <>
          <div className={styles.row}>
            {wordButton}
            {signButtons}
          </div>
          {onPickLetter && letters.length > 1 && (
            <div className={styles.row} data-letters={letters.length}>
              {letters.map((_, i) => letterButton(i, () => onPickLetter(i)))}
            </div>
          )}
          {gathering && several.length > 0 && (
            <div className={styles.actions}>
              <button type="button" className={styles.many} data-note-many onClick={() => onPickMany!(several)}>
                {t.wordPartsMany(several.length)}
              </button>
            </div>
          )}
        </>
      ) : ask === "steps" ? (
        // A: the kinds first, then the picked kind's choices, with a way back.
        open === null ? (
          <>
            <div className={styles.kinds} data-ask="steps">
              {wordButton}
              {DETAIL_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={styles.kind}
                  data-kind={k}
                  aria-pressed={answered?.what === k}
                  onClick={() => setOpen(k)}
                >
                  {kindName[k]}
                  <span aria-hidden="true"> ›</span>
                </button>
              ))}
              {anotherButton}
            </div>
            {clearRow}
          </>
        ) : (
          <>
            <div className={styles.which} data-ask="steps" data-open={open}>
              <button type="button" className={styles.back} data-ask-back onClick={() => setOpen(null)}>
                <span aria-hidden="true">‹ </span>
                {t.mistakeBack}
              </button>
              <span>{whichName[open]}</span>
            </div>
            {choicesOf(open)}
            {clearRow}
          </>
        )
      ) : ask === "tabs" ? (
        // B: the kinds as tabs, the picked one's choices under them; the whole word and
        // another verse stay where they always are.
        <>
          {/* The whole word as one full-width row, as in A: alone in a row of cards it
              left most of the panel empty beside it (seen 2026-11-12, wide and iPad). */}
          <div className={styles.kinds}>{wordButton}</div>
          <div className={styles.tabs} role="tablist" data-ask="tabs">
            {DETAIL_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                className={styles.tab}
                data-kind={k}
                aria-selected={(open ?? "sign") === k}
                onClick={() => setOpen(k)}
              >
                {kindName[k]}
              </button>
            ))}
          </div>
          <div role="tabpanel" data-open={open ?? "sign"}>
            {choicesOf(open ?? "sign")}
          </div>
          {actionsRow}
        </>
      ) : (
        // C: every choice at once, grouped by kind: the question as it was, then the
        // letters and the rules under it.
        <>
          <div className={styles.row} data-ask="list">
            {wordButton}
            {signButtons}
          </div>
          {signs.length === 0 && <p className={styles.none}>{t.mistakeNoSigns}</p>}
          <div className={styles.group}>{kindName.letter}</div>
          {choicesOf("letter")}
          <div className={styles.group}>{kindName.rule}</div>
          {choicesOf("rule")}
          {actionsRow}
        </>
      )}
    </div>
  );
}
