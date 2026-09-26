import { useEffect } from "react";
import { useT } from "../i18n";
import styles from "./UndoBar.module.css";

/** How long the chance to undo stays on screen. */
export const UNDO_MS = 8000;

interface UndoBarProps {
  /** What just happened, in one line. */
  said: string;
  onUndo: () => void;
  /** The chance has passed, or the reader has moved on. */
  onDone: () => void;
}

/**
 * One line saying what just happened, with a button to take it back. It goes
 * away on its own after a few seconds; nothing is asked before the change, so
 * the change is always one tap from being undone instead.
 */
export function UndoBar({ said, onUndo, onDone }: UndoBarProps): JSX.Element {
  const { t } = useT();
  useEffect(() => {
    const timer = setTimeout(onDone, UNDO_MS);
    return () => clearTimeout(timer);
  }, [said, onDone]);
  return (
    <div className={styles.bar} data-undo-bar="">
      <span className={styles.said}>{said}</span>
      <button type="button" className={styles.undo} onClick={onUndo}>
        {t.bmUndo}
      </button>
    </div>
  );
}
