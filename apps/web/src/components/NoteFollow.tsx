import { useEffect, useState } from "react";
import { useT } from "../i18n";
import styles from "./NoteFollow.module.css";

interface NoteFollowProps {
  /** The note's title. */
  title: string;
  /** The note's words after its first line, shown when the title is tapped. */
  words: string;
  /** Which verse of the note the reader is on, from 0. */
  at: number;
  /** How many verses the note holds. */
  count: number;
  onStep: (to: number) => void;
  onStop: () => void;
}

/**
 * The small bar shown while following a note (docs/design/scoped-notes.md,
 * screen 3): the note's name, where you are in it, and a step either way. It
 * does not record a revision look, for the same reason a hop does not: the app
 * moved you. Escape leaves, unless a box or sheet is open and wants it. A
 * tap on the name unfolds the rest of the note under the bar, so you can read
 * what you wrote about these verses without leaving them.
 */
export function NoteFollow({ title, words, at, count, onStep, onStop }: NoteFollowProps): JSX.Element {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || document.querySelector('[role="dialog"]')) return;
      onStop();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onStop]);
  return (
    <div className={styles.follow} role="group" aria-label={t.noteFollowing}>
      <div className={styles.bar}>
      {words ? (
        <button type="button" className={styles.title} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {title}
        </button>
      ) : (
        <span className={styles.title}>{title}</span>
      )}
      <span className={styles.where}>{t.noteFollowAt(at + 1, count)}</span>
      <button
        type="button"
        className={styles.step}
        aria-label={t.noteFollowPrev}
        disabled={at === 0}
        onClick={() => onStep(at - 1)}
      >
        ‹
      </button>
      <button
        type="button"
        className={styles.step}
        aria-label={t.noteFollowNext}
        disabled={at >= count - 1}
        onClick={() => onStep(at + 1)}
      >
        ›
      </button>
      <button type="button" className={styles.step} aria-label={t.noteFollowStop} onClick={onStop}>
        ✕
      </button>
      </div>
      {open && words && <p className={styles.words}>{words}</p>}
    </div>
  );
}
