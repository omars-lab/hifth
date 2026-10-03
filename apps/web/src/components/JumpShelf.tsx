import { useT } from "../i18n";
import { lastWhen } from "./JumpList";
import own from "./JumpShelf.module.css";
import styles from "./NoteShelf.module.css";

/** One jump as the page map lists it. */
export interface JumpShelfItem {
  id: string;
  /** The verse your memory left, where a tap on the row goes. */
  from: string;
  /** Where it went, or null while not said yet. */
  to: string | null;
  times: number;
  lastAt: number;
  beaten: boolean;
}

interface JumpShelfProps {
  /** Every jump the reader holds, the most often first. */
  jumps: readonly JumpShelfItem[];
  /** The ones dismissed from the page, the latest first, kept to bring back. */
  dismissed: readonly JumpShelfItem[];
  /** Go to the verse the jump left from. */
  onGo: (from: string) => void;
  /** Put a dismissed jump back on the page. */
  onBringBack: (id: string) => void;
}

/**
 * The page map's list of jumps (docs/design/confusion-jumps.md, "All your
 * jumps"): every place your memory went somewhere else, the ones you hit most
 * often first, beside the bookmarks and the notes. The glance before a
 * revision starts: what do I keep getting wrong? A row goes to the verse you
 * left, where the red mark opens the full list for it.
 *
 * Under it, folded, the jumps dismissed from the page: dismissing hides a
 * jump and never deletes it, so this is where one comes back from.
 */
export function JumpShelf({ jumps, dismissed, onGo, onBringBack }: JumpShelfProps): JSX.Element {
  const { t, lang } = useT();
  const now = Date.now();
  return (
    <section className={styles.shelf} aria-labelledby="jump-shelf-head">
      <h3 id="jump-shelf-head" className={styles.head}>
        {t.jumpShelfHead}
      </h3>
      {jumps.length === 0 && dismissed.length === 0 ? (
        <p className={styles.empty}>{t.jumpShelfEmpty}</p>
      ) : (
        <ul className={styles.list} aria-labelledby="jump-shelf-head">
          {jumps.map((j) => (
            <li key={j.id} className={j.beaten ? own.beaten : undefined}>
              <button type="button" className={styles.item} onClick={() => onGo(j.from)}>
                <span className={styles.title}>{j.to ? t.jumpPair(j.from, j.to) : t.jumpPairUnsure(j.from)}</span>
                <span className={styles.about}>
                  {t.jumpTimes(j.times, lastWhen(j.lastAt, now, lang, t))}
                  {j.beaten && ` · ${t.jumpBeaten}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {dismissed.length > 0 && (
        <details className={own.dismissed} role="group" aria-label={t.jumpShelfDismissed(dismissed.length)}>
          <summary className={own.summary}>{t.jumpShelfDismissed(dismissed.length)}</summary>
          <ul className={styles.list}>
            {dismissed.map((j) => (
              <li key={j.id} className={own.kept}>
                <span className={own.keptText}>
                  <span className={styles.title}>{j.to ? t.jumpPair(j.from, j.to) : t.jumpPairUnsure(j.from)}</span>
                  <span className={styles.about}>{t.jumpTimes(j.times, lastWhen(j.lastAt, now, lang, t))}</span>
                </span>
                <button type="button" className={own.bringBack} onClick={() => onBringBack(j.id)}>
                  {t.jumpBringBack}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
