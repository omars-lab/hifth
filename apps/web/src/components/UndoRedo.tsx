import { createContext, useContext } from "react";
import { useT } from "../i18n";
import styles from "./UndoRedo.module.css";

/** What the two buttons need from App: whether each has a step to take, and how. */
export interface MarkUndo {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

/**
 * Set by App, read by every bar the pens live in, so each can show the same
 * two buttons without being handed them through its props.
 */
export const MarkUndoContext = createContext<MarkUndo | null>(null);

const MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Undo and redo for the reader's kept marks (docs/design/notes-style-toolbar.md
 * ③): the two curved arrows Notes keeps beside its pens. Nothing to take back,
 * and the button is greyed. Draws nothing outside App. `upright` stands the
 * two one above the other, for a bar that runs down a side.
 */
export function UndoRedo({ upright = false }: { upright?: boolean }): JSX.Element | null {
  const { t } = useT();
  const u = useContext(MarkUndoContext);
  if (!u) return null;
  const key = MAC ? "⌘" : "Ctrl+";
  return (
    <div className={upright ? `${styles.pair} ${styles.upright}` : styles.pair} data-mark-undo="">
      <button
        type="button"
        className={styles.button}
        aria-label={t.markUndo}
        aria-keyshortcuts={MAC ? "Meta+Z" : "Control+Z"}
        title={`${t.markUndo} (${key}Z)`}
        disabled={!u.canUndo}
        onClick={u.onUndo}
      >
        <Arrow />
      </button>
      <button
        type="button"
        className={styles.button}
        aria-label={t.markRedo}
        aria-keyshortcuts={MAC ? "Meta+Shift+Z" : "Control+Shift+Z"}
        title={`${t.markRedo} (${key}Shift+Z)`}
        disabled={!u.canRedo}
        onClick={u.onRedo}
      >
        <Arrow redo />
      </button>
    </div>
  );
}

/** A curved arrow back; redo is the same arrow turned to face forward. */
function Arrow({ redo = false }: { redo?: boolean }): JSX.Element {
  return (
    <svg
      className={redo ? `${styles.icon} ${styles.redo}` : styles.icon}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  );
}
