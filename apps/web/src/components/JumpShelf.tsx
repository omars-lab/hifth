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
  /** Go to the verse the jump left from. */
  onGo: (from: string) => void;
}

/**
 * The page map's list of jumps (docs/design/confusion-jumps.md, "All your
 * jumps"): every place your memory went somewhere else, the ones you hit most
 * often first, beside the bookmarks and the notes. The glance before a
 * revision starts: what do I keep getting wrong? A row goes to the verse you
 * left, where the red mark opens the full list for it.
 */
export function JumpShelf({ jumps, onGo }: JumpShelfProps): JSX.Element {
  const { t, lang } = useT();
  const now = Date.now();
  return (
    <section className={styles.shelf} aria-labelledby="jump-shelf-head">
      <h3 id="jump-shelf-head" className={styles.head}>
        {t.jumpShelfHead}
      </h3>
      {jumps.length === 0 ? (
        <p className={styles.empty}>{t.jumpShelfEmpty}</p>
      ) : (
        <ul className={styles.list}>
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
    </section>
  );
}
