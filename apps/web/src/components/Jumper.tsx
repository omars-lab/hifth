import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { juzOf, parseJump, type JumpTarget } from "@hifth/core";
import { SURAH_NAMES_AR, surahName, toArabicDigits } from "../format";
import styles from "./Jumper.module.css";

interface JumperProps {
  /** Whether the jumper is open. */
  open: boolean;
  /** Land on a target — L3 routes it through the same path a live hop uses. */
  onJump: (target: JumpTarget) => void;
  /** Dismiss without going anywhere. */
  onClose: () => void;
}

/** Focusable descendants of `root`, in tab order (excludes disabled + hidden). */
function focusables(root: HTMLElement): HTMLElement[] {
  const sel =
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(sel));
}

/** The row's headline — what you are about to land on, in the app's own words. */
function targetTitle(t: JumpTarget): string {
  if (t.kind === "juz") return `الجزء ${toArabicDigits(t.juz!)}`;
  if (t.kind === "ayah") {
    return `${surahName(t.surah)} · ${toArabicDigits(t.surah)}:${toArabicDigits(t.ayah)}`;
  }
  return surahName(t.surah);
}

/** The row's second line — where that lands, said the way a hafiz would say it. */
function targetHint(t: JumpTarget): string {
  const juz = `الجزء ${toArabicDigits(juzOf(t.surah, t.ayah))}`;
  if (t.kind === "juz") {
    return `يبدأ من ${surahName(t.surah)} · ${toArabicDigits(t.surah)}:${toArabicDigits(t.ayah)}`;
  }
  if (t.kind === "ayah") return juz;
  return `سورة ${toArabicDigits(t.surah)} · ${juz}`;
}

/** A stable DOM id per row, for `aria-activedescendant`. */
function optionId(t: JumpTarget, i: number): string {
  return `jump-opt-${i}-${t.kind}-${t.surah}-${t.ayah}`;
}

/**
 * Jumper — go anywhere (PLAN §Loop 6a).
 *
 * One field answers the three ways a hafiz names a place: a surah (by name or
 * number), a juz, or a full `surah:ayah`. Typing offers every reading of what
 * was typed, best first (the ranking is `parseJump` in core, tested there); an
 * empty field offers the thirty juz as a grid, because "pick" has to work as
 * well as "type" on a phone with no keyboard open.
 *
 * Landing is not this component's business: it calls `onJump`, and L3 routes the
 * target through the *same* restore path a live hop and a cold-opened link use
 * (spec §7 — there must be exactly one navigation code path; Loop 3's record
 * explains why a second one drifts).
 *
 * A11y: the HopPopover contract — a real modal dialog, focus into the field on
 * open, Tab trapped, Escape closes, focus restored to whatever opened it. The
 * field itself is a combobox: ↑/↓ move the active option, Enter takes it.
 */
export function Jumper({ open, onJump, onClose }: JumperProps): JSX.Element | null {
  const sheetRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const targets = useMemo(() => parseJump(query, SURAH_NAMES_AR), [query]);

  // Capture the trigger, focus the field, and reset the query on open; restore
  // focus on close (a jumper that reopens holding the last query would make the
  // second jump start by deleting the first one).
  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;
    inputRef.current?.focus();
    return () => {
      restoreRef.current?.focus?.();
      setQuery("");
      setActive(0);
    };
  }, [open]);

  // A new query invalidates the old cursor.
  useEffect(() => setActive(0), [query]);

  const take = useCallback(
    (t: JumpTarget | undefined) => {
      if (!t) return;
      onJump(t);
      onClose();
    },
    [onJump, onClose],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (targets.length === 0) return;
        e.preventDefault();
        setActive((i) => {
          const next = i + (e.key === "ArrowDown" ? 1 : -1);
          return (next + targets.length) % targets.length;
        });
        return;
      }
      if (e.key === "Enter" && document.activeElement === inputRef.current) {
        e.preventDefault();
        take(targets[active]);
        return;
      }
      if (e.key !== "Tab") return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const items = focusables(sheet);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const el = document.activeElement;
      if (e.shiftKey && el === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && el === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose, targets, active, take],
  );

  if (!open) return null;

  const listId = "jump-results";
  const hasQuery = query.trim().length > 0;

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="اذهب إلى"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className={styles.grip} aria-hidden="true" />
        <header className={styles.head}>
          <span className={styles.glyph} aria-hidden="true">
            ⌖
          </span>
          <h2 className={styles.title}>اذهب إلى</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </header>

        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          role="combobox"
          aria-expanded={targets.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            targets[active] ? optionId(targets[active]!, active) : undefined
          }
          aria-label="اسم السورة أو رقمها، أو ٢:٢٥٥، أو جزء ٩"
          placeholder="البقرة · ٢:٢٥٥ · جزء ٩"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />

        {hasQuery ? (
          targets.length === 0 ? (
            <p className={styles.empty}>لا مكان بهذا الاسم أو الرقم</p>
          ) : (
            <ul className={styles.list} id={listId} role="listbox" aria-label="النتائج">
              {targets.map((t, i) => (
                <li key={optionId(t, i)} role="presentation">
                  <button
                    type="button"
                    id={optionId(t, i)}
                    role="option"
                    aria-selected={i === active}
                    className={styles.row}
                    data-active={i === active || undefined}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => take(t)}
                  >
                    <span className={styles.rowTitle}>{targetTitle(t)}</span>
                    <span className={styles.rowHint}>{targetHint(t)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          // "Pick" as well as "type": on a phone the keyboard costs a third of
          // the screen, and the juz is how a hafiz schedules revision.
          <div className={styles.juzGrid} role="group" aria-label="الأجزاء">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
              <button
                key={j}
                type="button"
                className={styles.juz}
                aria-label={`الجزء ${toArabicDigits(j)}`}
                onClick={() => take(parseJump(`ج${j}`, SURAH_NAMES_AR)[0])}
              >
                {toArabicDigits(j)}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
