import { useT } from "../i18n";
import styles from "./RootLens.module.css";

/*
 * The button lives apart from the lens itself: the button is on screen with
 * every selected verse, while the lens is opened by few readers and is loaded
 * the first time it is (see e2e/lazy-tools.spec.ts).
 */

interface RootLensTriggerProps {
  /** Distinct roots on the selection. */
  count: number;
  /**
   * Curated `shared-root` edges on the selection (Loop 6a). They ride *inside*
   * the lens, so the trigger must appear for them even on an ayah the corpus
   * has no roots for — otherwise a hand-verified pair would be unreachable.
   */
  curated?: number;
  open: boolean;
  onToggle: () => void;
  /** A word under the glyph, shown when the button sits in the verse drawer. */
  caption?: string;
}

/**
 * The ⬡ trigger — **the app's only ⬡** since Loop 6a.
 *
 * The collision it resolves: the hop rail used to carry a ⬡ chip counting the
 * *curated* shared-root edges (a handful, hand-verified) while this button
 * counted the *corpus-wide* root families (1,642 roots). Same glyph, two counts,
 * and a hafiz has every reason to read one as a subset of the other — which
 * neither the data nor the curation can promise. The rail's other three chips
 * are directions of one edge type (↻ same surah, ◀ earlier, ▶ later); ⬡ was a
 * *type* wearing a direction's clothes and never belonged there.
 *
 * So: the rail is mutashabihat by direction, full stop, and ⬡ means roots, in
 * one place, with one number. The curated edges are not dropped — they are
 * pinned at the top of the lens, marked as hand-verified, which is where a more
 * trustworthy row should sit anyway.
 */
export function RootLensTrigger({
  count,
  curated = 0,
  open,
  onToggle,
  caption,
}: RootLensTriggerProps): JSX.Element | null {
  const { t } = useT();
  if (count === 0 && curated === 0) return null;
  return (
    <button
      type="button"
      className={styles.trigger}
      aria-expanded={open}
      aria-label={t.rootsTrigger(count, curated)}
      onClick={onToggle}
    >
      <span aria-hidden="true">⬡</span>
      <span className="numeric" aria-hidden="true">
        {t.num(count)}
      </span>
      {curated > 0 && (
        <span className={styles.pickedDot} aria-hidden="true" />
      )}
      {caption && <span data-caption="">{caption}</span>}
    </button>
  );
}
