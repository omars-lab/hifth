import { useLayoutEffect, useRef } from "react";
import rows from "./NoteShelf.module.css";
import own from "./JumpPicker.module.css";
import styles from "./VerseNotes.module.css";

/** The card's width once the screen has room for all of it. */
const WIDTH = 320;

export interface JumpChoice {
  /** The verse's key. */
  key: string;
  /** "Al-A'raf · 7:161". */
  label: string;
  /** What it has in common with the verse you left, e.g. "word for word". */
  about?: string;
}

interface JumpPickerProps {
  /** "Where did 2:58 take you?" */
  head: string;
  /** The verse's look-alikes, twins first. */
  choices: readonly JumpChoice[];
  /** Where the arrow was let go, so the list opens beside it, never over the verse. */
  anchor: { top: number; bottom: number; x: number };
  notSure: string;
  another: string;
  onPick: (key: string) => void;
  /** Saved with no destination, to be named later from the list. */
  onNotSure: () => void;
  /** Name it in the go-to box instead. */
  onAnother: () => void;
  /** Escape or a tap elsewhere: nothing is saved. */
  onClose: () => void;
}

/**
 * The question a jump's arrow asks when it is let go where no verse is
 * (docs/design/confusion-jumps.md, "Say where you went"): the verse's
 * look-alikes first, word-for-word twins at the top, then another verse
 * named in the go-to box, then "not sure yet". Built like the list a verse's
 * note dot opens, and closed the same ways.
 */
export function JumpPicker({
  head,
  choices,
  anchor,
  notSure,
  another,
  onPick,
  onNotSure,
  onAnother,
  onClose,
}: JumpPickerProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  // Listening starts in the step the list is drawn, so an Escape pressed as
  // it appears closes it rather than falling on the page behind.
  useLayoutEffect(() => {
    ref.current?.querySelector("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);
  const below = anchor.bottom + 8 < window.innerHeight * 0.55;
  const wide = window.innerWidth >= WIDTH + 48;
  const left = Math.min(Math.max(anchor.x - WIDTH / 2, 12), window.innerWidth - WIDTH - 12);
  return (
    <div
      ref={ref}
      className={styles.list}
      role="dialog"
      aria-label={head}
      data-jump-picker=""
      style={{
        ...(below ? { top: anchor.bottom + 8 } : { bottom: window.innerHeight - anchor.top + 8 }),
        ...(wide ? { left, right: "auto", width: WIDTH, marginInline: 0 } : {}),
      }}
    >
      <h3 className={styles.head}>{head}</h3>
      <ul className={rows.list}>
        {choices.map((c) => (
          <li key={c.key}>
            <button type="button" className={`${rows.item} ${own.choice}`} onClick={() => onPick(c.key)}>
              <span className={rows.title}>{c.label}</span>
              {c.about && <span className={rows.about}>{c.about}</span>}
            </button>
          </li>
        ))}
        <li>
          <button type="button" className={`${rows.item} ${own.choice}`} onClick={onAnother}>
            <span className={rows.title}>{another}</span>
          </button>
        </li>
        <li>
          <button type="button" className={`${rows.item} ${own.choice}`} onClick={onNotSure}>
            <span className={rows.title}>{notSure}</span>
          </button>
        </li>
      </ul>
    </div>
  );
}
