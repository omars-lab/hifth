import { useCallback, useEffect, useRef } from "react";
import { orderForHifz, type Edge, type LeafSide, type TafsirEntry, type TafsirSource } from "@hifth/core";
import { useT } from "../i18n";
import styles from "./CommentaryLens.module.css";

interface CommentaryLensTriggerProps {
  /** Whether the focused ayah has an entry from the active provider. */
  present: boolean;
  open: boolean;
  onToggle: () => void;
}

/**
 * The ✎ trigger in the trail bar — the app's one commentary opener, next to ⬡
 * and the share button. It appears only when the active provider actually has a
 * note for the focused ayah, so a tap always lands on something (an ayah with no
 * commentary simply has no ✎, rather than a ✎ that opens an empty sheet).
 */
export function CommentaryLensTrigger({
  present,
  open,
  onToggle,
}: CommentaryLensTriggerProps): JSX.Element | null {
  const { t } = useT();
  if (!present) return null;
  return (
    <button
      type="button"
      className={styles.trigger}
      aria-expanded={open}
      aria-label={t.commentaryTrigger}
      onClick={onToggle}
    >
      <span aria-hidden="true">✎</span>
    </button>
  );
}

interface CommentaryLensProps {
  /** The focused ayah's commentary, or null when the sheet is closed. */
  entry: TafsirEntry | null;
  /** Who the commentary is from — a note is never anonymous. */
  source: TafsirSource | null;
  /** The note's cross-references as runtime `tafsir-ref` edges (never shipped). */
  edges: readonly Edge[];
  /** Whether a ref's target page is vendored (loadable). Unvendored → disabled. */
  canHop: (toKey: string) => boolean;
  /** Leap to a referenced ayah — a tafsir-ref edge hops like any other. */
  onHop: (edge: Edge) => void;
  /** Dismiss the sheet. */
  onClose: () => void;
  /**
   * Which physical side of a wide screen the card lands on, or null for the
   * chrome-direction default — the leaf the ayah is *not* on, so the card never
   * covers the ayah it is about (desktop.md §5). Same contract as RootLens.
   */
  side?: LeafSide | null;
}

/** Focusable descendants of `root`, in tab order (excludes disabled + hidden). */
function focusables(root: HTMLElement): HTMLElement[] {
  const sel =
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(sel));
}

/**
 * CommentaryLens — the ✎ sheet (decision `tafsir-provider`, plan §H4).
 *
 * Shows the focused ayah's commentary from the active `TafsirProvider`: a source
 * line, the translation, each commentary run (an OCR-recovered run is marked, so
 * a diacritic-lossy line is never passed off as the faithful channel), and the
 * note's cross-references as leap rows — nearest first, an unvendored target's
 * leap honestly disabled. The refs are `tafsir-ref` edges built at runtime and
 * rendered here only; they are never written into a shipped shard.
 *
 * A11y: the same modal contract as HopPopover and RootLens — focus in on open,
 * Tab trapped, Escape closes, focus restored to the trigger. Sheet on phones,
 * floating card on wide screens (CSS). The helpers are duplicated rather than
 * shared: the sheets are diverging surfaces (see RootLens.tsx).
 */
export function CommentaryLens({
  entry,
  source,
  edges,
  canHop,
  onHop,
  onClose,
  side = null,
}: CommentaryLensProps): JSX.Element | null {
  const { t, dir } = useT();
  const sheetRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const open = entry !== null;

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

  const commentary = entry.commentary ?? [];
  const ordered = orderForHifz(edges);
  const isEmpty = !entry.translation && commentary.length === 0 && ordered.length === 0;

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={t.commentaryTitle}
        dir={dir}
        data-side={side ?? undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className={styles.grip} aria-hidden="true" />
        <header className={styles.head}>
          <span className={styles.glyph} aria-hidden="true">
            ✎
          </span>
          <h2 className={styles.title}>{t.commentaryTitle}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t.close}>
            ✕
          </button>
        </header>

        {source && <p className={styles.source}>{t.commentarySource(source.label, source.license)}</p>}

        {isEmpty && <p className={styles.empty}>{t.commentaryEmpty}</p>}

        {entry.translation && <p className={styles.translation}>{entry.translation}</p>}

        {commentary.length > 0 && (
          <div className={styles.blocks}>
            {commentary.map((block, i) => (
              <section key={i} className={styles.block}>
                {(block.lemma || block.channel === "ocr") && (
                  <div className={styles.blockMeta}>
                    {block.lemma && (
                      <span className={styles.lemma}>
                        {t.commentaryLemma(block.lemma[0], block.lemma[1])}
                      </span>
                    )}
                    {block.channel === "ocr" && (
                      <span className={styles.ocr} title={t.commentaryOcrNote}>
                        {t.commentaryOcr}
                      </span>
                    )}
                  </div>
                )}
                <p className={styles.blockText}>{block.text}</p>
              </section>
            ))}
          </div>
        )}

        {ordered.length > 0 && (
          <section className={styles.refs}>
            <h3 className={styles.refsTitle}>{t.commentaryRefs}</h3>
            <ul className={styles.hops}>
              {ordered.map((edge) => {
                const enabled = canHop(edge.to);
                const label = t.ayahLabel(edge.to) ?? edge.to;
                return (
                  <li key={edge.to} className={styles.hopRow}>
                    <span className={styles.hopText}>
                      <span className={styles.hopLabel}>{label}</span>
                      <span className={styles.distance} data-near={edge.dir.dPage === 0 || undefined}>
                        {t.distance(edge.dir.dPage)}
                        {!enabled && <span className={styles.unavailable}>{t.commentaryUnavailable}</span>}
                      </span>
                    </span>
                    <button
                      type="button"
                      className={styles.hop}
                      disabled={!enabled}
                      onClick={() => onHop(edge)}
                      aria-label={t.hopTo(label)}
                    >
                      <span aria-hidden="true">↪</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
