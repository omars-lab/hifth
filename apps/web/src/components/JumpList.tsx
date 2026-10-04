import { Suspense, useLayoutEffect, useRef, useState } from "react";
import { parseAyahKey, type Edge } from "@hifth/core";
import { useT, type Strings } from "../i18n";
import type { Lang } from "../lang";
import { DiffView } from "./DiffView";
import rows from "./NoteShelf.module.css";
import own from "./JumpList.module.css";
import styles from "./VerseNotes.module.css";

/** The card's width once the screen has room for all of it. */
const WIDTH = 360;

const DAY = 24 * 60 * 60 * 1000;

/** The least room worth opening the list into, above the verse or below the mark. */
const ROOM = 180;

/**
 * Where the list stands, top to bottom. Below the mark when the mark is high
 * on the screen. Otherwise above the whole verse, not only above the mark:
 * the verse's saved arrow is in the lines over its mark, and a list opened
 * just above the mark covered the arrow it was opened to show (finding 1 of
 * docs/design/jump-arrows-options.md). A verse at the top of the screen
 * leaves no room over it, so the list then opens below the mark after all,
 * scrolling inside itself; the whole verse is above its mark. Only when
 * neither side has room does it stand on the verse, by the mark.
 */
export function listPlace(
  anchor: { top: number; bottom: number },
  verseTop: number | null,
  screen: number,
): { top: number; maxBlockSize?: number } | { bottom: number; maxBlockSize?: number } {
  if (anchor.bottom + 8 < screen * 0.55) return { top: anchor.bottom + 8 };
  const over = verseTop === null ? anchor.top : Math.min(anchor.top, verseTop);
  if (over - 8 - 12 >= ROOM) return { bottom: screen - over + 8, maxBlockSize: over - 8 - 12 };
  const under = screen - anchor.bottom - 8 - 12;
  if (under >= ROOM) return { top: anchor.bottom + 8, maxBlockSize: under };
  return { bottom: screen - anchor.top + 8 };
}

/** The top of a verse on the screen, on the page that holds the point it was tapped at. */
function verseTopAt(key: string, x: number): number | null {
  const at = parseAyahKey(key);
  if (!at) return null;
  for (const el of document.querySelectorAll(`path.ayahPolygon[surah="${at.surah}"][ayah="${at.ayah}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && x >= r.left && x <= r.right) return r.top;
  }
  return null;
}

/**
 * When a jump last happened, in the words a person would use: today,
 * yesterday, the weekday within the last week, and the date after that.
 * Counted in calendar days on this device's clock, so a jump at 23:50 is
 * "yesterday" ten minutes later.
 */
export function lastWhen(at: number, now: number, lang: Lang, t: Strings): string {
  const dayOf = (ms: number) => {
    const d = new Date(ms);
    return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / DAY);
  };
  const ago = dayOf(now) - dayOf(at);
  if (ago <= 0) return t.jumpToday;
  if (ago === 1) return t.jumpYesterday;
  const fmt =
    ago < 7
      ? new Intl.DateTimeFormat(lang, { weekday: "long" })
      : new Intl.DateTimeFormat(lang === "en" ? "en-GB" : lang, { day: "numeric", month: "short" });
  return t.jumpOnDay(fmt.format(at));
}

export interface JumpRow {
  id: string;
  /** Where it went, or null while not said yet. */
  to: string | null;
  /** "Al-A'raf · 7:161", or "Not sure yet". */
  label: string;
  /** How many times it happened, and when it last did. */
  times: number;
  lastAt: number;
  beaten: boolean;
  /** The two verses' look-alike link, when the app knows one: what Compare shows. */
  edge?: Edge;
}

interface JumpListProps {
  /** "Jumps from 2:58". */
  head: string;
  fromKey: string;
  rows: readonly JumpRow[];
  /** The mark that was tapped, so the list opens beside it, never over the verse. */
  anchor: { top: number; bottom: number; x: number };
  onGo: (to: string) => void;
  onAgain: (id: string) => void;
  onBeaten: (id: string, beaten: boolean) => void;
  /** Hide it from the page; the page map keeps it, to bring back. */
  onDismiss: (id: string) => void;
  onDelete: (id: string) => void;
  onSayWhere: (id: string) => void;
  onClose: () => void;
}

/**
 * The list a tap on a verse's jump mark opens (docs/design/confusion-jumps.md,
 * "How do you list, follow and delete jumps?"): one row for each verse your
 * memory went to from here, the most often first, each with Go, Compare
 * (the two verses side by side, as the look-alike list shows them), Again
 * (one more time, without drawing), Beaten, Dismiss (off the page, kept in
 * the page map's list to bring back), and Delete. A jump not named yet
 * offers Say where instead. Built and closed like the list a note dot opens.
 */
export function JumpList({
  head,
  fromKey,
  rows: list,
  anchor,
  onGo,
  onAgain,
  onBeaten,
  onDismiss,
  onDelete,
  onSayWhere,
  onClose,
}: JumpListProps): JSX.Element {
  const { t, lang } = useT();
  const now = Date.now();
  const ref = useRef<HTMLDivElement>(null);
  const [comparing, setComparing] = useState<string | null>(null);
  // Listening starts in the step the list is drawn, so an Escape pressed as
  // it appears closes it rather than falling on the page behind.
  useLayoutEffect(() => {
    ref.current?.querySelector("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    const onDown = (e: PointerEvent) => {
      const at = e.target as Element | null;
      // The Undo bar answers what was just done here; pressing it keeps the list.
      if (!ref.current?.contains(at) && !at?.closest?.("[data-undo-bar]")) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);
  const place = listPlace(anchor, verseTopAt(fromKey, anchor.x), window.innerHeight);
  const wide = window.innerWidth >= WIDTH + 48;
  const left = Math.min(Math.max(anchor.x - WIDTH / 2, 12), window.innerWidth - WIDTH - 12);
  return (
    <div
      ref={ref}
      className={`${styles.list} ${own.card}`}
      role="dialog"
      aria-label={head}
      data-jump-list=""
      style={{
        ...place,
        ...(wide ? { left, right: "auto", width: WIDTH, marginInline: 0 } : {}),
      }}
    >
      <h3 className={styles.head}>{head}</h3>
      <ul className={rows.list}>
        {list.map((r) => {
          const open = comparing === r.id && r.edge;
          return (
            <li key={r.id} className={own.row} data-beaten={r.beaten || undefined}>
              <span className={rows.title}>{r.label}</span>
              <span className={rows.about}>{t.jumpTimes(r.times, lastWhen(r.lastAt, now, lang, t))}</span>
              <span className={own.actions}>
                {r.to ? (
                  <>
                    <button type="button" className={own.action} onClick={() => onGo(r.to!)}>
                      {t.jumpGo}
                    </button>
                    {r.edge && (
                      <button
                        type="button"
                        className={own.action}
                        aria-expanded={comparing === r.id}
                        onClick={() => setComparing((c) => (c === r.id ? null : r.id))}
                      >
                        {t.jumpCompare}
                      </button>
                    )}
                    <button type="button" className={own.action} onClick={() => onAgain(r.id)}>
                      {t.jumpAgain}
                    </button>
                    <button
                      type="button"
                      className={own.action}
                      aria-pressed={r.beaten}
                      onClick={() => onBeaten(r.id, !r.beaten)}
                    >
                      {t.jumpBeaten}
                    </button>
                  </>
                ) : (
                  <button type="button" className={own.action} onClick={() => onSayWhere(r.id)}>
                    {t.jumpSayWhere}
                  </button>
                )}
                <button type="button" className={own.action} onClick={() => onDismiss(r.id)}>
                  {t.jumpDismiss}
                </button>
                <button type="button" className={`${own.action} ${own.delete}`} onClick={() => onDelete(r.id)}>
                  {t.jumpDelete}
                </button>
              </span>
              {open && (
                <div className={own.compare} data-jump-compare="">
                  <Suspense fallback={null}>
                    <DiffView edge={r.edge!} fromKey={fromKey} />
                  </Suspense>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
