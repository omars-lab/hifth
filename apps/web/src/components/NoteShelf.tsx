import { useT } from "../i18n";
import styles from "./NoteShelf.module.css";

/** One note as the list shows it: what to call it, and what it is about. */
export interface NoteShelfItem {
  id: string;
  title: string;
  /** Its scope and how many verses it holds: "Juz 1 · 3 verses". */
  about: string;
}

interface NoteShelfProps {
  /** The reader's notes, the one used last first. */
  notes: readonly NoteShelfItem[];
  /** Go to the note's first verse and step through the rest from there. */
  onFollow: (id: string) => void;
}

/**
 * The page map's list of notes (docs/design/scoped-notes.md, step 4): every
 * note the reader holds, beside the bookmarks, each one a tap from being
 * followed verse by verse. This is where a note stops being only a pin on the
 * one page it was written on.
 */
export function NoteShelf({ notes, onFollow }: NoteShelfProps): JSX.Element {
  const { t } = useT();
  return (
    <section className={styles.shelf} aria-labelledby="note-shelf-head">
      <h3 id="note-shelf-head" className={styles.head}>
        {t.noteShelfHead}
      </h3>
      {notes.length === 0 ? (
        <p className={styles.empty}>{t.noteShelfEmpty}</p>
      ) : (
        <ul className={styles.list}>
          {notes.map((n) => (
            <li key={n.id}>
              <button type="button" className={styles.item} onClick={() => onFollow(n.id)}>
                <span className={styles.title}>{n.title}</span>
                <span className={styles.about}>{n.about}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
