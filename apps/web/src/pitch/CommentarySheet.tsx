import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  formatAyahKey,
  orderForHifz,
  parseAyahKey,
  type Edge,
  type LeafSide,
} from "@hifth/core";
import { useT } from "../i18n";
import { splitCitations } from "./citations";
import type { PitchCommentary } from "./pitch";
import styles from "./CommentarySheet.module.css";

/**
 * The ✎ trigger — the door to The Study Quran's commentary on the selected
 * verse. Private pitch build only (see `pitch.ts`); it renders nothing when the
 * verse has no held commentary, exactly like the ⬡ root trigger.
 */
export function CommentaryTrigger({
  has,
  open,
  onToggle,
  caption,
}: {
  has: boolean;
  open: boolean;
  onToggle: () => void;
  /** A word under the glyph, shown when the button sits in the verse drawer. */
  caption?: string;
}): JSX.Element | null {
  if (!has) return null;
  return (
    <button
      type="button"
      className={styles.trigger}
      aria-expanded={open}
      aria-label="Study Quran commentary"
      onClick={onToggle}
    >
      <span aria-hidden="true">✎</span>
      {caption && <span data-caption="">{caption}</span>}
    </button>
  );
}

/** How much of a phone's height the note opens at — `38vh` in the stylesheet. */
const SHORT_SHARE = 0.38;

/** Focusable descendants of `root`, in tab order (excludes disabled + hidden). */
function focusables(root: HTMLElement): HTMLElement[] {
  const sel =
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(sel));
}

/**
 * CommentarySheet — the reading surface for the pitch.
 *
 * Same bottom-sheet contract as HopPopover / RootLens (a real modal dialog:
 * focus in on open, Tab trapped, Escape closes, focus restored), but its body is
 * built for *reading*, not for a list of hops: a comfortable measure, the
 * editors' translation set large, then the commentary prose. On the surah's
 * opening verse it leads with the surah introduction.
 *
 * Held copy lives only in the JSON this renders — never in these bytes.
 */
export function CommentarySheet({
  entry,
  onClose,
  side = null,
  roads = [],
  canHop,
  onHop,
  onGo,
  onCover,
}: {
  entry: PitchCommentary | null;
  onClose: () => void;
  side?: LeafSide | null;
  /**
   * The verses this one connects to — The Study Quran's own cross-references,
   * merged into the app's adjacency and handed straight back here. Tapping one
   * jumps there (and, in the pitch build, opens that verse's note in turn), so
   * the reading and the roads live on one surface instead of the note burying a
   * rail behind it. Empty when the verse leads nowhere the app can reach.
   */
  roads?: readonly Edge[];
  /** Whether a target's page is vendored (unreachable targets are shown, disabled). */
  canHop?: (toKey: string) => boolean;
  /** Jump to a related verse — the same hop the rail uses, so it leaves a trail. */
  onHop?: (edge: Edge) => void;
  /**
   * Go to a verse the commentary cites in its prose ("see 5:15–16") — the
   * book's own roads, inline, taking the same hop as the cards below.
   */
  onGo?: (key: string) => void;
  /**
   * Where the short phone note starts, in window px, or null when it is closed
   * or standing beside the verse — so the page can move the verse up above it.
   * Stays at the short height while the note is grown: the page underneath is
   * covered then anyway, and moving it would only be motion nobody sees.
   */
  onCover?: (top: number | null) => void;
}): JSX.Element | null {
  const { t } = useT();
  const sheetRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const open = entry !== null;
  // On a spread the note stands on the facing leaf, beside the verse, not over
  // it: no veil dims the page, and a tap on the next verse turns the note to it.
  // A phone has no facing leaf, so there it stays a sheet over the page.
  const beside = side !== null;
  // A phone opens the note short, on the lower part of the screen, so the verse
  // it is about stays in sight above it and nothing dims the page. Reading on —
  // a scroll inside the note, or a tap on its handle — grows it to the full
  // height, and only then does it cover the page like a sheet.
  const [tall, setTall] = useState(false);
  const verseKey = entry?.verse.key ?? null;
  useEffect(() => setTall(false), [verseKey]);
  const modal = !beside && tall;

  useLayoutEffect(() => {
    if (!onCover) return;
    const sheet = sheetRef.current;
    if (!open || beside || !sheet) {
      onCover(null);
      return;
    }
    // The short height is worked out, not read off the box: the box may still be
    // easing down from the previous verse's grown note.
    const report = () =>
      onCover(window.innerHeight - Math.min(sheet.scrollHeight, window.innerHeight * SHORT_SHARE));
    report();
    window.addEventListener("resize", report);
    return () => window.removeEventListener("resize", report);
  }, [open, beside, verseKey, onCover]);
  useEffect(() => () => onCover?.(null), [onCover]);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const sheet = sheetRef.current;
    // First focus on the close button, as it always was — not the phone's
    // handle, which comes first in the note but is not where a reader starts.
    if (sheet) (sheet.querySelector<HTMLElement>(`.${styles.close}`) ?? focusables(sheet)[0] ?? sheet).focus();
    // Reading always starts at the top, even when the same sheet re-opens on a
    // different verse.
    if (sheet) sheet.scrollTop = 0;
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
      if (e.key !== "Tab" || !modal) return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const items = focusables(sheet);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose, modal],
  );

  if (!entry) return null;
  const label = t.ayahLabel(entry.verse.key) ?? entry.verse.ref;
  // A citation in the prose names only surah:verse; it is in this note's edition.
  const edition = parseAyahKey(entry.verse.key)?.edition;
  const citedKey = (surah: number, ayah: number): string | null =>
    edition ? formatAyahKey(edition, surah, ayah) : null;

  return (
    <>
      {modal && <div className={styles.scrim} onClick={onClose} aria-hidden="true" />}
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal={modal}
        aria-label={`Commentary on ${label}`}
        // The reading is English (The Study Quran), so this surface reads
        // left-to-right regardless of the app's chrome direction.
        dir="ltr"
        data-side={side ?? undefined}
        data-tall={tall || undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onScroll={(e) => {
          if (!beside && !tall && e.currentTarget.scrollTop > 0) setTall(true);
        }}
      >
        {beside ? (
          <div className={styles.grip} aria-hidden="true" />
        ) : (
          <button
            type="button"
            className={styles.grip}
            aria-label={tall ? "Show less of the note" : "Show all of the note"}
            aria-expanded={tall}
            onClick={() => setTall((v) => !v)}
          />
        )}
        <header className={styles.head}>
          <span className={styles.glyph} aria-hidden="true">
            ✎
          </span>
          <div className={styles.heading}>
            <h2 className={styles.title}>The Study Quran</h2>
            <span className={styles.ref}>{label}</span>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t.close}>
            ✕
          </button>
        </header>

        <div className={styles.body}>
          {entry.showIntro && entry.intro.length > 0 && (
            <section className={styles.intro} aria-label="Surah introduction">
              <h3 className={styles.introTitle}>{entry.title}</h3>
              {entry.intro.map((para, i) => (
                <p key={i} className={styles.introPara}>
                  {para}
                </p>
              ))}
            </section>
          )}

          <blockquote className={styles.translation}>{entry.verse.translation}</blockquote>

          <section className={styles.commentary} aria-label="Commentary">
            {entry.verse.commentary.map((para, i) => (
              <p key={i} className={styles.para}>
                {splitCitations(para).map((part, j) => {
                  if (typeof part === "string") return part;
                  const key = citedKey(part.surah, part.ayah);
                  if (!key) return part.text;
                  return (
                    <button
                      key={j}
                      type="button"
                      className={styles.cite}
                      disabled={!onGo || !(canHop?.(key) ?? true)}
                      aria-label={`Go to ${t.ayahLabel(key) ?? part.text}`}
                      onClick={() => onGo?.(key)}
                    >
                      {part.text}
                    </button>
                  );
                })}
              </p>
            ))}
          </section>

          {roads.length > 0 && (
            <section className={styles.related} aria-label="Related verses">
              <h3 className={styles.relatedTitle}>Related verses</h3>
              <p className={styles.relatedLede}>
                Where The Study Quran connects this verse. Tap one to go there.
              </p>
              <ul className={styles.roads}>
                {orderForHifz(roads).map((edge) => {
                  const enabled = canHop ? canHop(edge.to) : true;
                  const label = t.ayahLabel(edge.to) ?? edge.to;
                  return (
                    <li key={`${edge.type}:${edge.to}`} className={styles.road}>
                      <button
                        type="button"
                        className={styles.roadHop}
                        disabled={!enabled || !onHop}
                        onClick={() => onHop?.(edge)}
                        aria-label={t.hopTo(label)}
                      >
                        <span className={styles.roadLabel}>
                          {label}
                          {edge.twin && <span className={styles.badge}>{t.twin}</span>}
                        </span>
                        {edge.note && <span className={styles.roadNote}>{edge.note}</span>}
                        {!enabled && (
                          <span className={styles.roadUnavailable}>{t.pageUnavailable}</span>
                        )}
                        <span className={styles.roadArrow} aria-hidden="true">
                          ↪
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <footer className={styles.credit}>
          The Study Quran — Seyyed Hossein Nasr, editor-in-chief (HarperOne, 2015).
          <span className={styles.creditNote}>
            Shown privately, with the rights-holders, for a collaboration.
          </span>
        </footer>
      </div>
    </>
  );
}
