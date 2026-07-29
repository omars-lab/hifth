import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAX_JUMP_RESULTS, juzOf, parseJump, type JumpTarget } from "@hifth/core";
import { SURAH_NAMES_AR, SURAH_NAMES_EN } from "../format";
import { useT, type Strings } from "../i18n";
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

/*
 * Both rows read through `t.ayahAt(surah, ayah)` and not `t.ayahLabel(key)`.
 * A `JumpTarget` carries coordinates, never a canonical key, and `ayahLabel`
 * answers null to anything that is not `quran/<edition>/2:58` — so the obvious
 * `t.ayahLabel(\`${surah}:${ayah}\`) ?? …` falls through to its own fallback and
 * prints the bare "2:58" with Latin digits in the middle of the Arabic UI. It
 * looks like a label, which is why it survived a screenshot and was caught by
 * `wayfinding.spec.ts` asserting the digits.
 */

/** The row's headline — what you are about to land on, in the app's own words. */
function targetTitle(target: JumpTarget, t: Strings): string {
  if (target.kind === "juz") return t.juzN(target.juz!);
  if (target.kind === "ayah") return t.ayahAt(target.surah, target.ayah);
  return t.surahName(target.surah);
}

/** The row's second line — where that lands, said the way a hafiz would say it. */
function targetHint(target: JumpTarget, t: Strings): string {
  const juz = t.juzN(juzOf(target.surah, target.ayah));
  if (target.kind === "juz") return t.jumpStartsAt(t.ayahAt(target.surah, target.ayah));
  if (target.kind === "ayah") return juz;
  return `${t.surahN(target.surah)} · ${juz}`;
}

/** A stable DOM id per row, for `aria-activedescendant`. */
function optionId(t: JumpTarget, i: number): string {
  return `jump-opt-${i}-${t.kind}-${t.surah}-${t.ayah}`;
}

/**
 * Every reading of the query, in both name tables, best first.
 *
 * A hafiz reading the English chrome still knows the surah as البقرة, and one
 * reading the Arabic chrome may well type "baqarah" on a laptop keyboard with
 * no Arabic layout. So the field is bilingual regardless of the UI language:
 * the current language's table is searched first (its matches rank highest,
 * which is the whole point of `parseJump`'s ordering), then the other one, and
 * `push`'s identity rule inside core would have deduped — but it runs per call,
 * so the merge de-dupes here on the same three fields.
 *
 * The cap is applied *after* the merge, so a query that only makes sense in the
 * other language still fills the list.
 */
function parseBoth(query: string, primary: readonly string[]): JumpTarget[] {
  const other = primary === SURAH_NAMES_AR ? SURAH_NAMES_EN : SURAH_NAMES_AR;
  const out = parseJump(query, primary);
  for (const target of parseJump(query, other)) {
    const dup = out.some(
      (o) => o.kind === target.kind && o.surah === target.surah && o.ayah === target.ayah,
    );
    if (!dup) out.push(target);
  }
  return out.slice(0, MAX_JUMP_RESULTS);
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
  const { t, dir } = useT();
  const sheetRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const targets = useMemo(() => parseBoth(query, t.names), [query, t.names]);

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
        aria-label={t.goTo}
        // A sheet is chrome, so it reads in the UI language's direction —
        // including the field, whose query is a place name in either script.
        dir={dir}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className={styles.grip} aria-hidden="true" />
        <header className={styles.head}>
          <span className={styles.glyph} aria-hidden="true">
            ⌖
          </span>
          <h2 className={styles.title}>{t.goTo}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t.close}>
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
          aria-label={t.jumpInput}
          placeholder={t.jumpPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />

        {hasQuery ? (
          targets.length === 0 ? (
            <p className={styles.empty}>{t.jumpEmpty}</p>
          ) : (
            <ul className={styles.list} id={listId} role="listbox" aria-label={t.jumpResults}>
              {targets.map((target, i) => (
                <li key={optionId(target, i)} role="presentation">
                  <button
                    type="button"
                    id={optionId(target, i)}
                    role="option"
                    aria-selected={i === active}
                    className={styles.row}
                    data-active={i === active || undefined}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => take(target)}
                  >
                    <span className={styles.rowTitle}>{targetTitle(target, t)}</span>
                    <span className={styles.rowHint}>{targetHint(target, t)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          // "Pick" as well as "type": on a phone the keyboard costs a third of
          // the screen, and the juz is how a hafiz schedules revision.
          <div className={styles.juzGrid} role="group" aria-label={t.juzGroup}>
            {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
              <button
                key={j}
                type="button"
                className={styles.juz}
                aria-label={t.juzN(j)}
                // The query is synthetic, not typed, so it uses the prefix form
                // core parses in either language and never reaches a name table.
                onClick={() => take(parseJump(`j${j}`, t.names)[0])}
              >
                {t.num(j)}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
