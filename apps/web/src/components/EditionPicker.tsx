import { useCallback, useEffect, useRef } from "react";
import { EDITIONS, type Concordance, type EditionMeta } from "@hifth/core";
import { useT, type Strings } from "../i18n";
import styles from "./EditionPicker.module.css";

interface EditionPickerProps {
  /** Whether the picker is open. */
  open: boolean;
  /** The edition currently mounted (the manifest's). */
  current: string;
  /** The selected ayah, if any — the position a switch would have to carry. */
  currentKey: string | null;
  /** The cross-edition mapping table. Empty today; the seam is real. */
  concordance: Concordance;
  /** Switch to a vendored edition. */
  onSelect: (edition: string) => void;
  /** Dismiss the sheet. */
  onClose: () => void;
}

/** Focusable descendants of `root`, in tab order (excludes disabled + hidden). */
function focusables(root: HTMLElement): HTMLElement[] {
  const sel =
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(sel));
}

/**
 * "Where would I be, in that mushaf?" — spec §7's one-line concordance prompt,
 * answered honestly. Three outcomes, three sentences:
 *   • same edition            → nothing to say
 *   • a table exists          → the ayah's ref over there
 *   • no table (today, all)   → say so, plainly, instead of implying the
 *                               numbers happen to match
 */
function concordanceNote(
  edition: EditionMeta,
  current: string,
  currentKey: string | null,
  concordance: Concordance,
  t: Strings,
): string | null {
  if (edition.id === current) return null;
  if (!currentKey) return null;
  if (!concordance.has(current, edition.id)) return t.editionNoTable;
  const mapped = concordance.map(currentKey, edition.id);
  if (!mapped) return t.editionNoCounterpart;
  return t.editionMapsTo(t.ayahRef(mapped) ?? mapped);
}

/**
 * An edition's proper names, in the language the chrome is speaking.
 *
 * Core owns the edition list — id, status, and the reason a riwayah is not
 * vendored are facts about the build, not copy. But «حفص عن عاصم» and the
 * publisher's name are written in core in Arabic, and an English sheet that
 * kept them would read half-translated. So the bundle may override the three
 * display strings and nothing else; a missing override falls back to core's
 * own, which is what the Arabic bundle does for all four (its overrides are
 * empty, deliberately: core's strings *are* the Arabic copy).
 */
function editionCopy(edition: EditionMeta, t: Strings): EditionMeta {
  const over = t.editionCopy[edition.id];
  if (!over) return edition;
  return {
    ...edition,
    label: over.label,
    riwayah: over.riwayah,
    // Spread rather than assigned: an override with no `reason` must leave
    // core's in place, not blank the line that says why a riwayah is missing.
    ...(over.reason === undefined ? {} : { reason: over.reason }),
  };
}

/**
 * EditionPicker — what exists, and what does not, with the real reason
 * (PLAN §Loop 6a; spec §1 "edition is part of every key").
 *
 * Only `hafs-kfqc` is vendored today. The picker refuses to pretend otherwise
 * in either direction: it does not hide the other riwayat (that would imply
 * Hifth is a single-mushaf app by design), and it does not offer them (that
 * would be a ghost). They are listed, disabled, each with the actual blocker —
 * the same surfaced-but-disabled rule the hop rail applies to edges pointing at
 * pages Loop 4b has not vendored yet.
 *
 * The concordance line under each row is the seam a switch will travel on:
 * a position moves between editions through a table or not at all (spec §1
 * forbids assuming index equality). With no table shipped, every row says so.
 *
 * A11y: HopPopover's contract — modal dialog, focus in, Tab trapped, Escape
 * closes, focus restored.
 */
export function EditionPicker({
  open,
  current,
  currentKey,
  concordance,
  onSelect,
  onClose,
}: EditionPickerProps): JSX.Element | null {
  const { t, dir } = useT();
  const sheetRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const sheet = sheetRef.current;
    if (sheet) (focusables(sheet)[0] ?? sheet).focus();
    return () => {
      restoreRef.current?.focus?.();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
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
    [onClose],
  );

  if (!open) return null;

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={t.mushaf}
        dir={dir}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className={styles.grip} aria-hidden="true" />
        <header className={styles.head}>
          <span className={styles.glyph} aria-hidden="true">
            ▤
          </span>
          <h2 className={styles.title}>{t.mushaf}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t.close}>
            ✕
          </button>
        </header>

        <ul className={styles.list}>
          {EDITIONS.map((raw) => {
            const edition = editionCopy(raw, t);
            const isCurrent = raw.id === current;
            const enabled = raw.status === "vendored" && !isCurrent;
            const note = concordanceNote(raw, current, currentKey, concordance, t);
            return (
              <li key={raw.id} className={styles.row}>
                <button
                  type="button"
                  className={styles.pick}
                  disabled={!enabled}
                  aria-current={isCurrent ? "true" : undefined}
                  onClick={() => onSelect(raw.id)}
                >
                  <span className={styles.label}>
                    {edition.label}
                    {isCurrent && <span className={styles.badge}>{t.editionCurrent}</span>}
                  </span>
                  <span className={styles.riwayah}>{edition.riwayah}</span>
                  {edition.reason && <span className={styles.reason}>{edition.reason}</span>}
                  {note && <span className={styles.note}>{note}</span>}
                </button>
              </li>
            );
          })}
        </ul>

        <p className={styles.foot}>{t.editionFoot}</p>
      </div>
    </>
  );
}
