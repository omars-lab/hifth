import { useT } from "../i18n";
import styles from "./TrailBeads.module.css";

/** One hop origin on the trail: where you were, and its page. */
export interface TrailBead {
  key: string;
  page: number;
}

interface TrailBeadsProps {
  /** Hop origins, oldest → newest. Empty = no trail yet. */
  trail: readonly TrailBead[];
  /** The ayah you are on now (the live bead at the end of the string). */
  currentKey: string | null;
  /** Rewind to a trail bead (pops everything after it). */
  onBeadBack: (index: number) => void;
  /** Clear the current selection (tap the live bead). */
  onClearCurrent: () => void;
}

/**
 * TrailBeads — the subha (prayer-bead) trail (spec §9, PLAN signature element).
 * Each hop threads a bead; tapping an earlier bead rewinds there (the same code
 * path as a forward hop — spec §7). The live bead at the string's end is the
 * current ayah. Empty trail shows a quiet hint instead.
 */
export function TrailBeads({
  trail,
  currentKey,
  onBeadBack,
  onClearCurrent,
}: TrailBeadsProps): JSX.Element {
  const { t } = useT();
  if (!currentKey) {
    return <span className={styles.hint}>{t.tapHint}</span>;
  }

  const currentLabel = t.ayahLabel(currentKey) ?? currentKey;

  return (
    // No `dir` of its own: the trail is a subha, threaded in the direction the
    // ayat were read. Its container in App pins RTL for both languages.
    <div className={styles.trail} aria-label={t.trail}>
      <span className={styles.string} aria-hidden="true" />
      {trail.map((bead, i) => {
        const label = t.ayahLabel(bead.key) ?? bead.key;
        return (
          <button
            key={`${bead.key}-${i}`}
            type="button"
            className={styles.bead}
            onClick={() => onBeadBack(i)}
            aria-label={t.beadBack(label)}
          >
            <span className={styles.beadDot} aria-hidden="true" />
            <span className={styles.beadLabel}>{label}</span>
          </button>
        );
      })}
      <button
        type="button"
        className={`${styles.bead} ${styles.beadCurrent}`}
        onClick={onClearCurrent}
        aria-current="location"
        aria-label={t.beadCurrent(currentLabel)}
      >
        <span className={styles.beadDot} aria-hidden="true" />
        <span className={styles.beadLabel}>{currentLabel}</span>
      </button>
    </div>
  );
}
