import { createContext, useContext } from "react";
import { useT } from "../i18n";
import styles from "./UndoRedo.module.css";

/** What the buttons need from App: whether each has a step to take, and how. */
export interface MarkUndo {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** The eraser is on: a tap on a kept mark takes it off. */
  erasing: boolean;
  /** Put the eraser on, or down again. */
  onErase: () => void;
}

/**
 * Set by App, read by every bar the pens live in, so each can show the same
 * two buttons without being handed them through its props.
 */
export const MarkUndoContext = createContext<MarkUndo | null>(null);

const MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * The eraser, and undo and redo for the reader's kept marks
 * (docs/design/notes-style-toolbar.md ③): Notes keeps the same three beside its
 * pens. The eraser takes one mark off per tap and asks nothing, since Undo puts
 * it back; it is not one of the tools, so the tools' row keeps its length.
 * Nothing to take back, and the arrow is greyed. Draws nothing outside App.
 * `upright` stands them one above the other, for a bar that runs down a side.
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
        aria-label={t.toolErase}
        aria-pressed={u.erasing}
        aria-keyshortcuts="E"
        title={`${t.toolErase} (E)`}
        onClick={u.onErase}
      >
        <Eraser />
      </button>
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

/** An eraser's block, tipped over the line it rubs out. */
function Eraser(): JSX.Element {
  return (
    <svg
      className={styles.eraser}
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
      <path d="m7 20-3.6-3.6a2 2 0 0 1 0-2.8L13.6 3.4a2 2 0 0 1 2.8 0l4.2 4.2a2 2 0 0 1 0 2.8L10.4 20" />
      <path d="M7 20h13" />
      <path d="m8.5 8.5 7 7" />
    </svg>
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
