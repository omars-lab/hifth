import { useCallback, useEffect, useRef } from "react";
import { orderForHifz, type Edge, type LeafSide } from "@hifth/core";
import { useT } from "../i18n";
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
}: {
  has: boolean;
  open: boolean;
  onToggle: () => void;
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
    </button>
  );
}

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
}): JSX.Element | null {
  const { t } = useT();
  const sheetRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const open = entry !== null;

  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const sheet = sheetRef.current;
    if (sheet) (focusables(sheet)[0] ?? sheet).focus();
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
      if (e.key !== "Tab") return;
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
    [onClose],
  );

  if (!entry) return null;
  const label = t.ayahLabel(entry.verse.key) ?? entry.verse.ref;

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={`Commentary on ${label}`}
        // The reading is English (The Study Quran), so this surface reads
        // left-to-right regardless of the app's chrome direction.
        dir="ltr"
        data-side={side ?? undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className={styles.grip} aria-hidden="true" />
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
                {para}
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
